-- PVLS Player Supabase Schema
-- Run this in your Supabase SQL editor

-- Song metadata (ratings, custom names, play counts)
CREATE TABLE IF NOT EXISTS pvls_songs (
  id TEXT PRIMARY KEY,
  custom_name TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  play_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS but allow public read, anon write (personal use)
ALTER TABLE pvls_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON pvls_songs FOR SELECT USING (true);
CREATE POLICY "Anon write" ON pvls_songs FOR ALL USING (true) WITH CHECK (true);

-- Comments per song
CREATE TABLE IF NOT EXISTS pvls_comments (
  id TEXT PRIMARY KEY,
  song_id TEXT NOT NULL REFERENCES pvls_songs(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  timestamp FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pvls_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON pvls_comments FOR SELECT USING (true);
CREATE POLICY "Anon write" ON pvls_comments FOR ALL USING (true) WITH CHECK (true);

-- Playlists
CREATE TABLE IF NOT EXISTS pvls_playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  song_ids TEXT[] DEFAULT '{}',
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pvls_playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON pvls_playlists FOR SELECT USING (true);
CREATE POLICY "Anon write" ON pvls_playlists FOR ALL USING (true) WITH CHECK (true);
