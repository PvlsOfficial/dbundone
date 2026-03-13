"use client";

import { useState, useCallback, useEffect } from "react";
import type { Song, Playlist } from "@/types";
import { getAllSongs, saveSong, getAllPlaylists, savePlaylist, deletePlaylist } from "@/lib/db";
import { generateId } from "@/lib/utils";

export type SortField = "name" | "addedAt" | "duration" | "rating" | "playCount" | "format";
export type SortDir = "asc" | "desc";
export type ViewMode = "list" | "grid";

export function useLibrary() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("addedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filterFormat, setFilterFormat] = useState<string>("all");

  useEffect(() => {
    getAllSongs().then(setSongs);
    getAllPlaylists().then(setPlaylists);
  }, []);

  const syncSongs = useCallback((incoming: Song[]) => {
    setSongs((prev) => {
      const map = new Map(prev.map((s) => [s.id, s]));
      for (const song of incoming) {
        const existing = map.get(song.id);
        // Preserve local metadata (rating, customName, etc.)
        map.set(song.id, existing ? { ...song, ...pick(existing, LOCAL_FIELDS) } : song);
      }
      const merged = Array.from(map.values());
      // Persist all
      merged.forEach((s) => saveSong(s));
      return merged;
    });
  }, []);

  const updateSong = useCallback(async (id: string, patch: Partial<Song>) => {
    setSongs((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, ...patch };
        saveSong(updated);
        return updated;
      })
    );
  }, []);

  const createPlaylist = useCallback(async (name: string, color?: string) => {
    const playlist: Playlist = {
      id: generateId(),
      name,
      songIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      color,
    };
    await savePlaylist(playlist);
    setPlaylists((prev) => [...prev, playlist]);
    return playlist;
  }, []);

  const updatePlaylist = useCallback(async (id: string, patch: Partial<Playlist>) => {
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, ...patch, updatedAt: new Date().toISOString() };
        savePlaylist(updated);
        return updated;
      })
    );
  }, []);

  const removePlaylist = useCallback(async (id: string) => {
    await deletePlaylist(id);
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    if (activePlaylistId === id) setActivePlaylistId(null);
  }, [activePlaylistId]);

  const addToPlaylist = useCallback(async (playlistId: string, songId: string) => {
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id !== playlistId) return p;
        if (p.songIds.includes(songId)) return p;
        const updated = { ...p, songIds: [...p.songIds, songId], updatedAt: new Date().toISOString() };
        savePlaylist(updated);
        return updated;
      })
    );
  }, []);

  const removeFromPlaylist = useCallback(async (playlistId: string, songId: string) => {
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id !== playlistId) return p;
        const updated = { ...p, songIds: p.songIds.filter((id) => id !== songId), updatedAt: new Date().toISOString() };
        savePlaylist(updated);
        return updated;
      })
    );
  }, []);

  // Filtered + sorted songs
  const activeSongs = (() => {
    let list = songs;

    if (activePlaylistId) {
      const pl = playlists.find((p) => p.id === activePlaylistId);
      if (pl) {
        const idSet = new Set(pl.songIds);
        list = pl.songIds
          .map((id) => list.find((s) => s.id === id))
          .filter(Boolean) as Song[];
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          (s.customName ?? s.name).toLowerCase().includes(q) ||
          s.format.toLowerCase().includes(q)
      );
    }

    if (filterFormat !== "all") {
      list = list.filter((s) => s.format === filterFormat);
    }

    list = [...list].sort((a, b) => {
      let va: unknown = a[sortField];
      let vb: unknown = b[sortField];
      if (va === undefined) va = sortField === "rating" ? 0 : sortField === "playCount" ? 0 : "";
      if (vb === undefined) vb = sortField === "rating" ? 0 : sortField === "playCount" ? 0 : "";
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc"
        ? (va as number) - (vb as number)
        : (vb as number) - (va as number);
    });

    return list;
  })();

  const formats = Array.from(new Set(songs.map((s) => s.format))).sort();

  return {
    songs,
    activeSongs,
    playlists,
    activePlaylistId,
    setActivePlaylistId,
    search,
    setSearch,
    sortField,
    setSortField,
    sortDir,
    setSortDir,
    viewMode,
    setViewMode,
    filterFormat,
    setFilterFormat,
    formats,
    syncSongs,
    updateSong,
    createPlaylist,
    updatePlaylist,
    removePlaylist,
    addToPlaylist,
    removeFromPlaylist,
  };
}

const LOCAL_FIELDS: (keyof Song)[] = [
  "customName",
  "rating",
  "comments",
  "playCount",
  "lastPlayedAt",
  "isDownloaded",
  "artworkColor",
];

function pick<T extends object>(obj: T, keys: (keyof T)[]): Partial<T> {
  const result: Partial<T> = {};
  for (const key of keys) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
}
