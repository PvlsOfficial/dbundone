-- =========================================================================
-- DBundone Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =========================================================================

-- 1) Profiles table — stores display name & avatar for each auth user
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop + recreate the trigger (safe to re-run)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Project shares table — who shared which project with whom
create table if not exists public.project_shares (
  id uuid primary key default gen_random_uuid(),
  -- The user who is sharing
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  -- The user receiving the share
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  -- A unique project ID that the sender uses locally (from the Tauri SQLite DB)
  project_local_id text not null,
  -- Human-readable project metadata (so recipient can see what was shared)
  project_title text not null,
  project_daw text,
  project_bpm real,
  project_key text,
  project_genre text,
  -- Extended metadata — full project detail for the recipient to view
  project_artists text,
  project_status text,          -- idea / in-progress / mixing / mastering / finished
  project_tags text[],           -- array of tag names
  project_collection text,       -- collection/group name
  project_time_spent real,       -- minutes
  project_created_at timestamptz,-- original project creation date
  project_updated_at timestamptz,-- original project last modified date
  -- Optional message from sender
  message text,
  -- Shared media URLs (uploaded to Supabase Storage)
  audio_url text,
  audio_name text,
  image_url text,
  image_name text,
  -- Permission level: view (read-only) or edit (can add annotations, change status)
  permission text not null default 'view' check (permission in ('view', 'edit')),
  -- All shared versions with their annotations stored as JSONB
  shared_versions jsonb not null default '[]'::jsonb,
  -- Status: pending, accepted, declined
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Prevent duplicate shares of the same project to the same user
  unique (from_user_id, to_user_id, project_local_id)
);

-- 3) Row Level Security — users can only see shares they're part of
alter table public.profiles enable row level security;
alter table public.project_shares enable row level security;

-- Profiles: anyone authenticated can read any profile (for search)
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- Profiles: users can update their own profile
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Shares: users can see shares they sent or received
drop policy if exists "Users can view own shares" on public.project_shares;
create policy "Users can view own shares"
  on public.project_shares for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- Shares: authenticated users can create shares (as sender)
drop policy if exists "Users can create shares" on public.project_shares;
create policy "Users can create shares"
  on public.project_shares for insert
  with check (auth.uid() = from_user_id);

-- Shares: sender can delete their own shares
drop policy if exists "Sender can delete shares" on public.project_shares;
create policy "Sender can delete shares"
  on public.project_shares for delete
  using (auth.uid() = from_user_id);

-- Shares: sender OR recipient can update (accept/decline, annotations, permission, status)
drop policy if exists "Recipient can update share status" on public.project_shares;
drop policy if exists "Users can update own shares" on public.project_shares;
create policy "Users can update own shares"
  on public.project_shares for update
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- 4) Indexes for performance
create index if not exists idx_shares_from on public.project_shares(from_user_id);
create index if not exists idx_shares_to on public.project_shares(to_user_id);
create index if not exists idx_profiles_email on public.profiles(email);

-- 5) Updated_at auto-update
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists shares_updated_at on public.project_shares;
create trigger shares_updated_at
  before update on public.project_shares
  for each row execute function public.set_updated_at();

-- =========================================================================
-- MIGRATION: If you already ran the old schema without extended metadata,
-- run these ALTER statements to add the new columns:
-- =========================================================================
-- alter table public.project_shares add column if not exists project_artists text;
-- alter table public.project_shares add column if not exists project_status text;
-- alter table public.project_shares add column if not exists project_tags text[];
-- alter table public.project_shares add column if not exists project_collection text;
-- alter table public.project_shares add column if not exists project_time_spent real;
-- alter table public.project_shares add column if not exists project_created_at timestamptz;
-- alter table public.project_shares add column if not exists project_updated_at timestamptz;

-- =========================================================================
-- MIGRATION: Add shared media columns (audio + image uploads)
-- =========================================================================
-- alter table public.project_shares add column if not exists audio_url text;
-- alter table public.project_shares add column if not exists audio_name text;
-- alter table public.project_shares add column if not exists image_url text;
-- alter table public.project_shares add column if not exists image_name text;

-- =========================================================================
-- MIGRATION: Add permission + shared_versions columns, fix RLS
-- =========================================================================
-- alter table public.project_shares add column if not exists permission text not null default 'view';
-- alter table public.project_shares add column if not exists shared_versions jsonb not null default '[]'::jsonb;
--
-- -- Fix RLS: allow BOTH sender and recipient to update shares
-- drop policy if exists "Recipient can update share status" on public.project_shares;
-- drop policy if exists "Users can update own shares" on public.project_shares;
-- create policy "Users can update own shares"
--   on public.project_shares for update
--   using (auth.uid() = from_user_id or auth.uid() = to_user_id);
