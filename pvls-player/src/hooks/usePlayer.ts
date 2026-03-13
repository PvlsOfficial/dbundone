"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Song, PlayerState } from "@/types";
import { getCachedAudio, cacheAudio, saveSong, getSong } from "@/lib/db";

// Songs in the player always use the direct OneDrive URL (fresh after sync).
// The blob cache is only used by the download feature and shown as "downloaded" badge.

export function usePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PlayerState>({
    currentSong: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    volume: 0.8,
    muted: false,
    currentTime: 0,
    duration: 0,
    shuffle: false,
    repeat: "none",
  });
  const handleEndedRef = useRef<() => void>(() => {});

  // Init audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    audio.addEventListener("timeupdate", () =>
      setState((s) => ({ ...s, currentTime: audio.currentTime }))
    );
    audio.addEventListener("loadedmetadata", () =>
      setState((s) => ({ ...s, duration: audio.duration }))
    );
    audio.addEventListener("ended", () => handleEndedRef.current());
    audio.addEventListener("play", () => setState((s) => ({ ...s, isPlaying: true })));
    audio.addEventListener("pause", () => setState((s) => ({ ...s, isPlaying: false })));
    audio.addEventListener("error", () => {
      console.error("[Player] Audio error:", audio.error?.code, audio.error?.message, audio.src.slice(0, 80));
      setState((s) => ({ ...s, isPlaying: false }));
    });

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = state.muted ? 0 : state.volume;
    }
  }, [state.volume, state.muted]);

  const loadSong = useCallback(async (song: Song, autoPlay = true) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();

    // Prefer song.url (the pre-authenticated CDN URL returned by the songs API).
    // Only fall back to the streaming proxy when song.url is missing or expired.
    let src = song.url;

    if (!src) {
      // Read token synchronously from localStorage — no async gap, gesture context preserved
      let token = "";
      try {
        const raw = localStorage.getItem("pvls_ms_tokens");
        if (raw) token = JSON.parse(raw).access_token ?? "";
      } catch {}

      if (token) {
        src = `/api/stream?id=${encodeURIComponent(song.id)}&t=${encodeURIComponent(token)}`;
      }
    }

    if (!src) {
      console.warn("[Player] No URL for song:", song.name);
      return;
    }
    audio.src = src;

    if (autoPlay) {
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch((err: Error) => {
          // AbortError is expected when the user switches songs before the
          // previous play() resolves — not a real error, safe to ignore.
          if (err.name !== "AbortError") {
            console.error("[Player] play() rejected:", err.name, err.message);
          }
        });
      }
    }

    // Update play count in background
    getSong(song.id).then((existing) => {
      if (existing) {
        saveSong({
          ...existing,
          playCount: (existing.playCount ?? 0) + 1,
          lastPlayedAt: new Date().toISOString(),
        });
      }
    }).catch(() => {});
  }, []);

  const play = useCallback(
    (song: Song, queue?: Song[], index?: number) => {
      const newQueue = queue ?? state.queue;
      const newIndex = index ?? newQueue.findIndex((s) => s.id === song.id);

      setState((s) => ({
        ...s,
        currentSong: song,
        queue: newQueue,
        queueIndex: newIndex,
      }));

      // Don't await — keeps user gesture context alive for audio.play()
      loadSong(song);
    },
    [state.queue, loadSong]
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch((err: Error) => console.error("[Player] togglePlay failed:", err.message));
    } else {
      audio.pause();
    }
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setState((s) => ({ ...s, currentTime: time }));
  }, []);

  const setVolume = useCallback((vol: number) => {
    setState((s) => ({ ...s, volume: Math.max(0, Math.min(1, vol)), muted: false }));
  }, []);

  const toggleMute = useCallback(() => {
    setState((s) => ({ ...s, muted: !s.muted }));
  }, []);

  const handleEnded = useCallback(() => {
    setState((s) => {
      if (s.repeat === "one") {
        audioRef.current?.play().catch(() => {});
        return s;
      }
      let nextIndex = s.shuffle
        ? Math.floor(Math.random() * s.queue.length)
        : s.queueIndex + 1;
      if (nextIndex >= s.queue.length) {
        if (s.repeat === "all") nextIndex = 0;
        else return { ...s, isPlaying: false };
      }
      const nextSong = s.queue[nextIndex];
      if (nextSong) loadSong(nextSong);
      return { ...s, currentSong: nextSong, queueIndex: nextIndex };
    });
  }, [loadSong]);

  // Keep ref in sync so the event listener always has the latest version
  useEffect(() => {
    handleEndedRef.current = handleEnded;
  }, [handleEnded]);

  const playNext = useCallback(() => {
    setState((s) => {
      const nextIndex = s.shuffle
        ? Math.floor(Math.random() * s.queue.length)
        : (s.queueIndex + 1) % s.queue.length;
      const nextSong = s.queue[nextIndex];
      if (nextSong) loadSong(nextSong);
      return { ...s, currentSong: nextSong ?? s.currentSong, queueIndex: nextIndex };
    });
  }, [loadSong]);

  const playPrev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    setState((s) => {
      const prevIndex = s.queueIndex > 0 ? s.queueIndex - 1 : s.queue.length - 1;
      const prevSong = s.queue[prevIndex];
      if (prevSong) loadSong(prevSong);
      return { ...s, currentSong: prevSong ?? s.currentSong, queueIndex: prevIndex };
    });
  }, [loadSong]);

  const toggleShuffle = useCallback(() =>
    setState((s) => ({ ...s, shuffle: !s.shuffle })), []);

  const cycleRepeat = useCallback(() => {
    setState((s) => {
      const modes: PlayerState["repeat"][] = ["none", "all", "one"];
      return { ...s, repeat: modes[(modes.indexOf(s.repeat) + 1) % modes.length] };
    });
  }, []);

  const downloadSong = useCallback(async (song: Song) => {
    const existing = await getCachedAudio(song.id);
    if (existing) return;
    const res = await fetch(song.downloadUrl);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();
    await cacheAudio(song.id, blob);
    const dbSong = await getSong(song.id);
    if (dbSong) await saveSong({ ...dbSong, isDownloaded: true });
  }, []);

  return {
    state,
    audioRef,
    play,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    playNext,
    playPrev,
    toggleShuffle,
    cycleRepeat,
    downloadSong,
  };
}
