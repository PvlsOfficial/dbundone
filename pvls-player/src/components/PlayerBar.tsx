"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Repeat, Repeat1,
  Shuffle, Volume2, VolumeX, Volume1, ChevronUp, Music2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDuration } from "@/lib/utils";
import { RatingStars } from "./RatingStars";
import type { PlayerState } from "@/types";

interface PlayerBarProps {
  state: PlayerState;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onVolume: (v: number) => void;
  onMute: () => void;
  onNext: () => void;
  onPrev: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onExpandNowPlaying: () => void;
  onRating?: (rating: number) => void;
}

export function PlayerBar({
  state,
  onTogglePlay,
  onSeek,
  onVolume,
  onMute,
  onNext,
  onPrev,
  onShuffle,
  onRepeat,
  onExpandNowPlaying,
  onRating,
}: PlayerBarProps) {
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { currentSong, isPlaying, currentTime, duration, volume, muted, shuffle, repeat } = state;

  const progress = duration > 0 ? currentTime / duration : 0;

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * duration);
  }, [duration, onSeek]);

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const displayName = currentSong?.customName ?? currentSong?.name ?? "";

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-[#0a0a0a]/95 backdrop-blur-xl",
        "border-t border-white/[0.06]",
        "safe-area-inset-bottom"
      )}
    >
      {/* Progress bar - full width, clickable */}
      <div
        ref={progressRef}
        className="w-full h-1 bg-white/10 cursor-pointer group/progress hover:h-2 transition-all duration-150 -mt-px"
        onClick={handleProgressClick}
      >
        <div
          className="h-full bg-[hsl(var(--accent-hsl))] relative rounded-r-full transition-all"
          style={{ width: `${progress * 100}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity -translate-x-1/2" />
        </div>
      </div>

      <div className="px-4 py-3 flex items-center gap-4">
        {/* Song info */}
        <div
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
          onClick={onExpandNowPlaying}
        >
          <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
            <Music2 className="w-5 h-5 text-white/30" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {displayName || "Nothing playing"}
            </p>
            {currentSong && (
              <div className="flex items-center gap-2">
                <RatingStars
                  rating={currentSong.rating}
                  onChange={onRating}
                  size="sm"
                />
                <span className="text-xs text-white/30 font-mono">
                  {formatDuration(currentTime)}/{formatDuration(duration)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Center controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onShuffle}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
              "hover:bg-white/10",
              shuffle ? "text-[hsl(var(--accent-hsl))]" : "text-white/40 hover:text-white"
            )}
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={onPrev}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/10 text-white/70 hover:text-white transition-all"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={onTogglePlay}
            className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center transition-all",
              "bg-[hsl(var(--accent-hsl))] hover:scale-105 active:scale-95 shadow-lg",
              "shadow-[hsl(var(--accent-hsl)/0.4)]"
            )}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-white fill-white" />
            ) : (
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            )}
          </button>

          <button
            onClick={onNext}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/10 text-white/70 hover:text-white transition-all"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={onRepeat}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
              "hover:bg-white/10",
              repeat !== "none" ? "text-[hsl(var(--accent-hsl))]" : "text-white/40 hover:text-white"
            )}
          >
            {repeat === "one" ? (
              <Repeat1 className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Volume - hidden on mobile */}
        <div className="hidden md:flex items-center gap-2 flex-1 justify-end">
          <button
            onClick={onMute}
            className="text-white/40 hover:text-white transition-colors"
          >
            <VolumeIcon className="w-4 h-4" />
          </button>
          <div
            ref={volumeRef}
            className="w-24 h-1.5 bg-white/10 rounded-full cursor-pointer group/vol hover:h-2 transition-all"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onVolume((e.clientX - rect.left) / rect.width);
            }}
          >
            <div
              className="h-full bg-white/60 rounded-full"
              style={{ width: `${(muted ? 0 : volume) * 100}%` }}
            />
          </div>

          <button
            onClick={onExpandNowPlaying}
            className="ml-2 text-white/30 hover:text-white transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Safe area padding for iPhone */}
      <div className="pb-safe" />
    </motion.div>
  );
}
