"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, Play, Pause, SkipBack, SkipForward,
  Repeat, Repeat1, Shuffle, Volume2, VolumeX, Volume1,
  Music2, Download, MoreHorizontal, CheckCircle2,
} from "lucide-react";
import WaveSurfer from "wavesurfer.js";
import { cn, formatDuration } from "@/lib/utils";
import { RatingStars } from "./RatingStars";
import type { PlayerState, Song } from "@/types";

interface NowPlayingProps {
  open: boolean;
  onClose: () => void;
  state: PlayerState;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onVolume: (v: number) => void;
  onMute: () => void;
  onNext: () => void;
  onPrev: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onRating?: (rating: number) => void;
  onOpenModal?: (song: Song) => void;
  onDownload?: (song: Song) => void;
  showWaveform?: boolean;
}

export function NowPlaying({
  open,
  onClose,
  state,
  onTogglePlay,
  onSeek,
  onVolume,
  onMute,
  onNext,
  onPrev,
  onShuffle,
  onRepeat,
  onRating,
  onOpenModal,
  onDownload,
  showWaveform = true,
}: NowPlayingProps) {
  const waveRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const { currentSong, isPlaying, currentTime, duration, volume, muted, shuffle, repeat } = state;

  const displayName = currentSong?.customName ?? currentSong?.name ?? "";
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  // WaveSurfer setup
  useEffect(() => {
    if (!open || !showWaveform || !waveRef.current || !currentSong?.url) return;

    wsRef.current?.destroy();

    const ws = WaveSurfer.create({
      container: waveRef.current,
      waveColor: "rgba(255,255,255,0.12)",
      progressColor: "hsl(var(--accent-hsl, 238 87% 67%))",
      cursorColor: "transparent",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 80,
      normalize: true,
      backend: "WebAudio",
    });

    ws.load(currentSong.url);
    ws.on("interaction", (newTime: number) => {
      onSeek(newTime);
    });

    wsRef.current = ws;

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
  }, [open, currentSong?.url, showWaveform]);

  // Sync playback position to waveform
  useEffect(() => {
    if (!wsRef.current || !duration) return;
    const progress = currentTime / duration;
    if (Math.abs(wsRef.current.getCurrentTime() - currentTime) > 1) {
      wsRef.current.seekTo(progress);
    }
  }, [currentTime, duration]);

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-[60] bg-[#0a0a0a] flex flex-col"
        >
          {/* Gradient background */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: `radial-gradient(ellipse at 50% 0%, hsl(var(--accent-hsl, 238 87% 67%) / 0.5) 0%, transparent 70%)`,
            }}
          />

          <div className="relative flex flex-col h-full max-w-lg mx-auto w-full px-6">
            {/* Header */}
            <div className="flex items-center justify-between pt-14 pb-6">
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <ChevronDown className="w-5 h-5 text-white" />
              </button>
              <div className="text-center">
                <p className="text-xs text-white/40 uppercase tracking-widest font-medium">
                  Now Playing
                </p>
              </div>
              <div className="flex gap-2">
                {currentSong && onDownload && (
                  <button
                    onClick={() => onDownload(currentSong)}
                    className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    {currentSong.isDownloaded ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Download className="w-4 h-4 text-white/60" />
                    )}
                  </button>
                )}
                {currentSong && onOpenModal && (
                  <button
                    onClick={() => onOpenModal(currentSong)}
                    className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4 text-white/60" />
                  </button>
                )}
              </div>
            </div>

            {/* Artwork */}
            <div className="flex-1 flex flex-col justify-center gap-8">
              <div className="w-64 h-64 mx-auto rounded-3xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shadow-2xl">
                <Music2 className="w-24 h-24 text-white/10" />
              </div>

              {/* Song title + rating */}
              <div className="text-center space-y-3">
                <h2 className="text-2xl font-semibold text-white tracking-tight">
                  {displayName || "—"}
                </h2>
                <div className="flex justify-center">
                  <RatingStars rating={currentSong?.rating} onChange={onRating} size="lg" />
                </div>
              </div>

              {/* Waveform */}
              {showWaveform && (
                <div className="w-full h-20" ref={waveRef} />
              )}

              {/* Progress bar (fallback) */}
              {!showWaveform && (
                <div>
                  <div
                    className="w-full h-1.5 bg-white/10 rounded-full cursor-pointer"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      onSeek(((e.clientX - rect.left) / rect.width) * duration);
                    }}
                  >
                    <div
                      className="h-full bg-[hsl(var(--accent-hsl))] rounded-full"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-white/30 font-mono">{formatDuration(currentTime)}</span>
                    <span className="text-xs text-white/30 font-mono">{formatDuration(duration)}</span>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center justify-center gap-6 pb-4">
                <button
                  onClick={onShuffle}
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                    shuffle ? "text-[hsl(var(--accent-hsl))]" : "text-white/30 hover:text-white"
                  )}
                >
                  <Shuffle className="w-5 h-5" />
                </button>

                <button
                  onClick={onPrev}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-white/10 text-white/70 hover:text-white transition-all"
                >
                  <SkipBack className="w-7 h-7 fill-current" />
                </button>

                <button
                  onClick={onTogglePlay}
                  className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-transform"
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7 text-black fill-black" />
                  ) : (
                    <Play className="w-7 h-7 text-black fill-black ml-1" />
                  )}
                </button>

                <button
                  onClick={onNext}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-white/10 text-white/70 hover:text-white transition-all"
                >
                  <SkipForward className="w-7 h-7 fill-current" />
                </button>

                <button
                  onClick={onRepeat}
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                    repeat !== "none" ? "text-[hsl(var(--accent-hsl))]" : "text-white/30 hover:text-white"
                  )}
                >
                  {repeat === "one" ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                </button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-3 pb-safe-area pb-8">
                <button onClick={onMute} className="text-white/30 hover:text-white transition-colors">
                  <VolumeIcon className="w-4 h-4" />
                </button>
                <div
                  className="flex-1 h-1.5 bg-white/10 rounded-full cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    onVolume((e.clientX - rect.left) / rect.width);
                  }}
                >
                  <div
                    className="h-full bg-white/50 rounded-full"
                    style={{ width: `${(muted ? 0 : volume) * 100}%` }}
                  />
                </div>
                <Volume2 className="w-4 h-4 text-white/30" />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
