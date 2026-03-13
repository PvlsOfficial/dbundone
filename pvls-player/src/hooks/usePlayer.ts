"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Song, PlayerState } from "@/types";
import { getCachedAudio, cacheAudio, saveSong, getSong } from "@/lib/db";

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

  // Init audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    audio.addEventListener("timeupdate", () => {
      setState((s) => ({ ...s, currentTime: audio.currentTime }));
    });
    audio.addEventListener("loadedmetadata", () => {
      setState((s) => ({ ...s, duration: audio.duration }));
    });
    audio.addEventListener("ended", () => {
      handleEnded();
    });
    audio.addEventListener("play", () => {
      setState((s) => ({ ...s, isPlaying: true }));
    });
    audio.addEventListener("pause", () => {
      setState((s) => ({ ...s, isPlaying: false }));
    });

    return () => {
      audio.pause();
      audio.src = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Try cached blob first
    let src = song.url;
    try {
      const blob = await getCachedAudio(song.id);
      if (blob) {
        src = URL.createObjectURL(blob);
      }
    } catch {
      // fall back to streaming
    }

    audio.src = src;
    if (autoPlay) {
      await audio.play().catch(() => {});
    }

    // Update play count
    try {
      const existing = await getSong(song.id);
      if (existing) {
        await saveSong({
          ...existing,
          playCount: (existing.playCount ?? 0) + 1,
          lastPlayedAt: new Date().toISOString(),
        });
      }
    } catch {
      // non-critical
    }
  }, []);

  const play = useCallback(
    async (song: Song, queue?: Song[], index?: number) => {
      const newQueue = queue ?? state.queue;
      const newIndex = index ?? newQueue.findIndex((s) => s.id === song.id);

      setState((s) => ({
        ...s,
        currentSong: song,
        queue: newQueue,
        queueIndex: newIndex,
      }));

      await loadSong(song);
    },
    [state.queue, loadSong]
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
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
      let nextIndex = s.queueIndex + 1;
      if (s.shuffle) {
        nextIndex = Math.floor(Math.random() * s.queue.length);
      }
      if (nextIndex >= s.queue.length) {
        if (s.repeat === "all") {
          nextIndex = 0;
        } else {
          return { ...s, isPlaying: false };
        }
      }
      const nextSong = s.queue[nextIndex];
      loadSong(nextSong);
      return { ...s, currentSong: nextSong, queueIndex: nextIndex };
    });
  }, [loadSong]);

  const playNext = useCallback(() => {
    setState((s) => {
      let nextIndex = s.shuffle
        ? Math.floor(Math.random() * s.queue.length)
        : s.queueIndex + 1;
      if (nextIndex >= s.queue.length) nextIndex = 0;
      const nextSong = s.queue[nextIndex];
      if (nextSong) loadSong(nextSong);
      return { ...s, currentSong: nextSong ?? s.currentSong, queueIndex: nextIndex };
    });
  }, [loadSong]);

  const playPrev = useCallback(() => {
    const audio = audioRef.current;
    // If more than 3s in, restart current
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

  const toggleShuffle = useCallback(() => {
    setState((s) => ({ ...s, shuffle: !s.shuffle }));
  }, []);

  const cycleRepeat = useCallback(() => {
    setState((s) => {
      const modes: PlayerState["repeat"][] = ["none", "all", "one"];
      const next = modes[(modes.indexOf(s.repeat) + 1) % modes.length];
      return { ...s, repeat: next };
    });
  }, []);

  const downloadSong = useCallback(async (song: Song) => {
    const existing = await getCachedAudio(song.id);
    if (existing) return;

    const res = await fetch(song.downloadUrl);
    const blob = await res.blob();
    await cacheAudio(song.id, blob);

    const dbSong = await getSong(song.id);
    if (dbSong) {
      await saveSong({ ...dbSong, isDownloaded: true });
    }
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
