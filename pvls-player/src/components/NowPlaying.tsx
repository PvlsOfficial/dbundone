"use client";

import { useEffect, useRef } from "react";
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
  accentColor?: string;
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
  accentColor,
}: NowPlayingProps) {
  const waveRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const { currentSong, isPlaying, currentTime, duration, volume, muted, shuffle, repeat } = state;

  const displayName = currentSong?.customName ?? currentSong?.name ?? "";
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  // Esc closes the view
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        onTogglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onTogglePlay]);

  // WaveSurfer setup — re-create when song or accent color changes
  useEffect(() => {
    if (!open || !showWaveform || !waveRef.current || !currentSong?.url) return;

    wsRef.current?.destroy();

    const hsl = typeof document !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--accent-hsl").trim()
      : "238 87% 67%";
    const progressColor = `hsl(${hsl || "238 87% 67%"})`;

    const ws = WaveSurfer.create({
      container: waveRef.current,
      waveColor: "rgba(255,255,255,0.10)",
      progressColor,
      cursorColor: "transparent",
      barWidth: 2,
      barGap: 2,
      barRadius: 3,
      height: 96,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentSong?.url, showWaveform, accentColor]);

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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[60] overflow-hidden bg-[#06060a]"
        >
          {/* Animated ambient backdrop */}
          <motion.div
            className="absolute -top-1/3 -left-1/4 w-[80vw] h-[80vw] rounded-full blur-3xl opacity-50 pointer-events-none"
            style={{ background: "radial-gradient(circle, hsl(var(--accent-hsl) / 0.55), transparent 60%)" }}
            animate={{ x: [0, 80, -40, 0], y: [0, -60, 40, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-1/3 -right-1/4 w-[70vw] h-[70vw] rounded-full blur-3xl opacity-40 pointer-events-none"
            style={{ background: "radial-gradient(circle, hsl(var(--accent-hsl) / 0.45), transparent 60%)" }}
            animate={{ x: [0, -60, 40, 0], y: [0, 50, -30, 0] }}
            transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-1/3 right-1/3 w-[40vw] h-[40vw] rounded-full blur-3xl opacity-30 pointer-events-none"
            style={{ background: "radial-gradient(circle, hsl(var(--accent-hsl) / 0.6), transparent 60%)" }}
            animate={{ scale: isPlaying ? [1, 1.15, 1] : 1, opacity: isPlaying ? [0.25, 0.4, 0.25] : 0.2 }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Subtle film grain / vignette */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.6)_100%)]" />

          {/* Top bar */}
          <div className="relative z-10 flex items-center justify-between px-6 sm:px-10 pt-6 sm:pt-8">
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-xl flex items-center justify-center hover:bg-white/[0.08] transition-colors"
              title="Close (Esc)"
            >
              <ChevronDown className="w-5 h-5 text-white/80" />
            </button>

            <div className="flex flex-col items-center">
              <span className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-medium">
                Now Playing
              </span>
              <span className="text-xs text-white/50 mt-1 font-mono">
                {formatDuration(currentTime)} <span className="text-white/20 mx-1">/</span> {formatDuration(duration)}
              </span>
            </div>

            <div className="flex gap-2">
              {currentSong && onDownload && (
                <button
                  type="button"
                  onClick={() => onDownload(currentSong)}
                  className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-xl flex items-center justify-center hover:bg-white/[0.08] transition-colors"
                  title={currentSong.isDownloaded ? "Downloaded" : "Download"}
                >
                  {currentSong.isDownloaded ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Download className="w-4 h-4 text-white/70" />
                  )}
                </button>
              )}
              {currentSong && onOpenModal && (
                <button
                  type="button"
                  onClick={() => onOpenModal(currentSong)}
                  className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-xl flex items-center justify-center hover:bg-white/[0.08] transition-colors"
                  title="More"
                >
                  <MoreHorizontal className="w-4 h-4 text-white/70" />
                </button>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="relative z-10 h-[calc(100dvh-80px)] flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 px-6 sm:px-10 pb-6">
            {/* Artwork */}
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative shrink-0"
            >
              {/* Glow halo */}
              <motion.div
                className="absolute inset-0 rounded-[2.5rem] blur-3xl"
                style={{ background: "radial-gradient(circle, hsl(var(--accent-hsl) / 0.7), transparent 70%)" }}
                animate={{ scale: isPlaying ? [1, 1.08, 1] : 1, opacity: isPlaying ? [0.7, 1, 0.7] : 0.4 }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Artwork tile */}
              <motion.div
                animate={{ rotate: isPlaying ? 360 : 0 }}
                transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                className="relative w-[68vw] max-w-[360px] aspect-square sm:max-w-[420px] lg:w-[40vh] lg:max-w-[440px] rounded-[2rem] overflow-hidden border border-white/[0.08] shadow-[0_30px_120px_-20px_rgba(0,0,0,0.8)]"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--accent-hsl) / 0.25), rgba(255,255,255,0.02) 50%, hsl(var(--accent-hsl) / 0.15))",
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <Music2 className="w-1/3 h-1/3 text-white/15" />
                </div>
                {/* Shine */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent" />
                {/* Vinyl center dot */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-white/30 ring-4 ring-black/50" />
                </div>
              </motion.div>
            </motion.div>

            {/* Right: details + controls */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col w-full max-w-2xl"
            >
              {/* Title block */}
              <div className="text-center lg:text-left space-y-3">
                <p className="text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--accent-hsl))]/80 font-medium">
                  Track
                </p>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-white tracking-tight leading-[1.05] break-words">
                  {displayName || "—"}
                </h2>
                <div className="flex justify-center lg:justify-start">
                  <RatingStars rating={currentSong?.rating} onChange={onRating} size="lg" />
                </div>
              </div>

              {/* Waveform / progress */}
              <div className="mt-8">
                {showWaveform ? (
                  <div className="w-full" ref={waveRef} />
                ) : (
                  <div
                    className="w-full h-2 bg-white/[0.06] rounded-full cursor-pointer group/seek"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      onSeek(((e.clientX - rect.left) / rect.width) * duration);
                    }}
                  >
                    <div
                      className="h-full bg-[hsl(var(--accent-hsl))] rounded-full relative"
                      style={{ width: `${progress * 100}%` }}
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover/seek:opacity-100 transition-opacity shadow-lg" />
                    </div>
                  </div>
                )}
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-white/40 font-mono">{formatDuration(currentTime)}</span>
                  <span className="text-xs text-white/40 font-mono">{formatDuration(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="mt-8 flex items-center justify-center lg:justify-start gap-2 sm:gap-4">
                <button
                  type="button"
                  onClick={onShuffle}
                  className={cn(
                    "w-11 h-11 rounded-2xl flex items-center justify-center transition-all",
                    "hover:bg-white/[0.06]",
                    shuffle ? "text-[hsl(var(--accent-hsl))]" : "text-white/40 hover:text-white"
                  )}
                  title="Shuffle"
                >
                  <Shuffle className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={onPrev}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-white/[0.06] text-white/80 hover:text-white transition-all"
                  title="Previous"
                >
                  <SkipBack className="w-6 h-6 fill-current" />
                </button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={onTogglePlay}
                  className={cn(
                    "relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full flex items-center justify-center",
                    "bg-white text-black shadow-[0_10px_50px_-5px_hsl(var(--accent-hsl)/0.6)]",
                    "hover:scale-105 transition-transform"
                  )}
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7 fill-black" />
                  ) : (
                    <Play className="w-7 h-7 fill-black ml-1" />
                  )}
                </motion.button>

                <button
                  type="button"
                  onClick={onNext}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-white/[0.06] text-white/80 hover:text-white transition-all"
                  title="Next"
                >
                  <SkipForward className="w-6 h-6 fill-current" />
                </button>

                <button
                  type="button"
                  onClick={onRepeat}
                  className={cn(
                    "w-11 h-11 rounded-2xl flex items-center justify-center transition-all",
                    "hover:bg-white/[0.06]",
                    repeat !== "none" ? "text-[hsl(var(--accent-hsl))]" : "text-white/40 hover:text-white"
                  )}
                  title={`Repeat: ${repeat}`}
                >
                  {repeat === "one" ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                </button>
              </div>

              {/* Volume */}
              <div className="mt-8 flex items-center gap-3 max-w-sm mx-auto lg:mx-0 w-full">
                <button type="button" onClick={onMute} className="text-white/40 hover:text-white transition-colors">
                  <VolumeIcon className="w-4 h-4" />
                </button>
                <div
                  className="flex-1 h-1.5 bg-white/[0.06] rounded-full cursor-pointer group/vol"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    onVolume((e.clientX - rect.left) / rect.width);
                  }}
                >
                  <div
                    className="h-full bg-white/60 rounded-full group-hover/vol:bg-white transition-colors"
                    style={{ width: `${(muted ? 0 : volume) * 100}%` }}
                  />
                </div>
                <Volume2 className="w-4 h-4 text-white/30" />
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
