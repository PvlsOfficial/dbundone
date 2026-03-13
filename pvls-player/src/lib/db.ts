import { openDB, type IDBPDatabase } from "idb";
import type { Song, Playlist, AppSettings } from "@/types";

const DB_NAME = "pvls-player";
const DB_VERSION = 1;

type PvlsDB = {
  songs: {
    key: string;
    value: Song;
    indexes: { "by-name": string; "by-rating": number };
  };
  playlists: {
    key: string;
    value: Playlist;
  };
  settings: {
    key: string;
    value: { key: string; value: unknown };
  };
  audioCache: {
    key: string;
    value: { id: string; blob: Blob; cachedAt: number };
  };
};

let dbPromise: Promise<IDBPDatabase<PvlsDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<PvlsDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const songStore = db.createObjectStore("songs", { keyPath: "id" });
        songStore.createIndex("by-name", "name");
        songStore.createIndex("by-rating", "rating");

        db.createObjectStore("playlists", { keyPath: "id" });
        db.createObjectStore("settings", { keyPath: "key" });
        db.createObjectStore("audioCache", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

// Songs
export async function saveSong(song: Song) {
  const db = await getDb();
  await db.put("songs", song);
}

export async function getSong(id: string): Promise<Song | undefined> {
  const db = await getDb();
  return db.get("songs", id);
}

export async function getAllSongs(): Promise<Song[]> {
  const db = await getDb();
  return db.getAll("songs");
}

export async function deleteSong(id: string) {
  const db = await getDb();
  await db.delete("songs", id);
}

// Playlists
export async function savePlaylist(playlist: Playlist) {
  const db = await getDb();
  await db.put("playlists", playlist);
}

export async function getPlaylist(id: string): Promise<Playlist | undefined> {
  const db = await getDb();
  return db.get("playlists", id);
}

export async function getAllPlaylists(): Promise<Playlist[]> {
  const db = await getDb();
  return db.getAll("playlists");
}

export async function deletePlaylist(id: string) {
  const db = await getDb();
  await db.delete("playlists", id);
}

// Settings
export async function saveSetting(key: string, value: unknown) {
  const db = await getDb();
  await db.put("settings", { key, value });
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  const row = await db.get("settings", key);
  return row?.value as T | undefined;
}

// Audio cache
export async function cacheAudio(id: string, blob: Blob) {
  const db = await getDb();
  await db.put("audioCache", { id, blob, cachedAt: Date.now() });
}

export async function getCachedAudio(id: string): Promise<Blob | undefined> {
  const db = await getDb();
  const entry = await db.get("audioCache", id);
  return entry?.blob;
}

export async function deleteCachedAudio(id: string) {
  const db = await getDb();
  await db.delete("audioCache", id);
}

export async function getCacheSize(): Promise<number> {
  const db = await getDb();
  const all = await db.getAll("audioCache");
  return all.reduce((sum, entry) => sum + entry.blob.size, 0);
}
