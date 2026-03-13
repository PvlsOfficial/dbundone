import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let clientUrl = "";

export function getSupabase(url: string, anonKey: string): SupabaseClient {
  if (!client || clientUrl !== url) {
    client = createClient(url, anonKey);
    clientUrl = url;
  }
  return client;
}

export interface RemoteSongMeta {
  id: string;
  custom_name?: string;
  rating?: number;
  play_count?: number;
  updated_at?: string;
}

export interface RemoteComment {
  id: string;
  song_id: string;
  text: string;
  timestamp: number;
  created_at: string;
}

export interface RemotePlaylist {
  id: string;
  name: string;
  song_ids: string[];
  color?: string;
  created_at: string;
  updated_at: string;
}

export async function upsertSongMeta(
  supabase: SupabaseClient,
  meta: RemoteSongMeta
) {
  return supabase
    .from("pvls_songs")
    .upsert({ ...meta, updated_at: new Date().toISOString() })
    .select()
    .single();
}

export async function fetchSongMeta(
  supabase: SupabaseClient,
  id: string
): Promise<RemoteSongMeta | null> {
  const { data } = await supabase
    .from("pvls_songs")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

export async function fetchAllSongMeta(
  supabase: SupabaseClient
): Promise<RemoteSongMeta[]> {
  const { data } = await supabase.from("pvls_songs").select("*");
  return data ?? [];
}

export async function addComment(
  supabase: SupabaseClient,
  comment: Omit<RemoteComment, "created_at">
) {
  return supabase
    .from("pvls_comments")
    .insert({ ...comment, created_at: new Date().toISOString() });
}

export async function fetchComments(
  supabase: SupabaseClient,
  songId: string
): Promise<RemoteComment[]> {
  const { data } = await supabase
    .from("pvls_comments")
    .select("*")
    .eq("song_id", songId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function deleteComment(supabase: SupabaseClient, id: string) {
  return supabase.from("pvls_comments").delete().eq("id", id);
}

export async function upsertPlaylist(
  supabase: SupabaseClient,
  playlist: RemotePlaylist
) {
  return supabase
    .from("pvls_playlists")
    .upsert({ ...playlist, updated_at: new Date().toISOString() });
}

export async function fetchPlaylists(
  supabase: SupabaseClient
): Promise<RemotePlaylist[]> {
  const { data } = await supabase
    .from("pvls_playlists")
    .select("*")
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function deleteRemotePlaylist(
  supabase: SupabaseClient,
  id: string
) {
  return supabase.from("pvls_playlists").delete().eq("id", id);
}
