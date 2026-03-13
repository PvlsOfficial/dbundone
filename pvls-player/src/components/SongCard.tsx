"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Play, Pause, Download, MoreHorizontal, Music2,
  CheckCircle2, Clock, Star
} from "lucide-react";
import { cn, formatDuration, formatFileSize } from "@/lib/utils";
import { RatingStars } from "./RatingStars";
import type { Song } from "@/types";

interface SongCardProps {
  song: Song;
  index: number;
  isPlaying: boolean;
  isCurrent: boolean;
  onPlay: (song: Song) => void;
  onOpenModal: (song: Song) => void;
  onDownload: (song: Song) => void;
  onRating: (song: Song, rating: number) => void;
  viewMode: "list" | "grid";
}

const FORMAT_COLORS: Record<string, string> = {
  flac: "text-emerald-400",
  wav: "text-sky-400",
  mp3: "text-violet-400",
  aac: "text-amber-400",
};

export function SongCard({
  song,
  index,
  isPlaying,
  isCurrent,
  onPlay,
  onOpenModal,
  onDownload,
  onRating,
  viewMode,
}: SongCardProps) {
  const [downloading, setDownloading] = useState(false);
  const displayName = song.customName ?? song.name;
  const formatColor = FORMAT_COLORS[song.format] ?? "text-white/40";

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloading(true);
    await onDownload(song);
    setDownloading(false);
  };

  if (viewMode === "grid") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "group relative rounded-2xl border p-4 cursor-pointer transition-all duration-200",
          "bg-white/[0.03] border-white/[0.06] hover:border-[hsl(var(--accent-hsl)/0.4)]",
          "hover:bg-white/[0.06]",
          isCurrent && "border-[hsl(var(--accent-hsl)/0.6)] bg-[hsl(var(--accent-hsl)/0.08)]"
        )}
        onClick={() => onPlay(song)}
      >
        {/* Artwork placeholder */}
        <div className={cn(
          "w-full aspect-square rounded-xl mb-3 flex items-center justify-center",
          "bg-white/[0.04] relative overflow-hidden"
        )}>
          <Music2 className="w-10 h-10 text-white/20" />
          {isCurrent && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              {isPlaying ? (
                <div className="flex items-end gap-0.5 h-8">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-1 bg-[hsl(var(--accent-hsl))] rounded-full animate-pulse"
                      style={{
                        height: `${Math.random() * 60 + 40}%`,
                        animationDelay: `${i * 0.15}s`,
                        animationDuration: `${0.8 + Math.random() * 0.4}s`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <Pause className="w-8 h-8 text-white" />
              )}
            </div>
          )}

          {/* Play overlay */}
          {!isCurrent && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="w-10 h-10 text-white fill-white" />
            </div>
          )}
        </div>

        <p className="font-medium text-sm text-white truncate">{displayName}</p>
        <div className="flex items-center justify-between mt-1">
          <span className={cn("text-xs font-mono uppercase font-semibold", formatColor)}>
            {song.format}
          </span>
          {song.duration && (
            <span className="text-xs text-white/30">{formatDuration(song.duration)}</span>
          )}
        </div>
        {song.rating ? (
          <RatingStars rating={song.rating} readonly size="sm" />
        ) : null}

        {/* Context menu btn */}
        <button
          className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
          onClick={(e) => { e.stopPropagation(); onOpenModal(song); }}
        >
          <MoreHorizontal className="w-4 h-4 text-white" />
        </button>

        {song.isDownloaded && (
          <CheckCircle2 className="absolute top-3 left-3 w-4 h-4 text-emerald-400 opacity-70" />
        )}
      </motion.div>
    );
  }

  // List view
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer",
        "transition-all duration-150",
        "hover:bg-white/[0.05]",
        isCurrent && "bg-[hsl(var(--accent-hsl)/0.12)] hover:bg-[hsl(var(--accent-hsl)/0.15)]"
      )}
      onClick={() => onPlay(song)}
    >
      {/* Index / playing indicator */}
      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
        {isCurrent ? (
          isPlaying ? (
            <div className="flex items-end gap-px h-5 w-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex-1 bg-[hsl(var(--accent-hsl))] rounded-full animate-pulse"
                  style={{
                    animationDelay: `${i * 0.2}s`,
                    animationDuration: "0.8s",
                  }}
                />
              ))}
            </div>
          ) : (
            <Pause className="w-4 h-4 text-[hsl(var(--accent-hsl))]" />
          )
        ) : (
          <>
            <span className="text-sm text-white/30 group-hover:hidden font-mono">
              {(index + 1).toString().padStart(2, "0")}
            </span>
            <Play className="w-4 h-4 text-white hidden group-hover:block fill-white" />
          </>
        )}
      </div>

      {/* Song info */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-medium text-sm truncate",
          isCurrent ? "text-[hsl(var(--accent-hsl))]" : "text-white/90"
        )}>
          {displayName}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("text-xs font-mono uppercase font-semibold", formatColor)}>
            {song.format}
          </span>
          <span className="text-xs text-white/25">{formatFileSize(song.size)}</span>
          {song.rating ? <RatingStars rating={song.rating} readonly size="sm" /> : null}
        </div>
      </div>

      {/* Duration */}
      {song.duration && (
        <div className="hidden sm:flex items-center gap-1 text-white/30">
          <Clock className="w-3 h-3" />
          <span className="text-xs font-mono">{formatDuration(song.duration)}</span>
        </div>
      )}

      {/* Actions — always visible on mobile, hover-reveal on desktop */}
      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {!song.isDownloaded ? (
          <button
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
            onClick={handleDownload}
            title="Download locally"
          >
            {downloading ? (
              <div className="w-3 h-3 border border-white/40 border-t-white/80 rounded-full animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 text-white/50 hover:text-white" />
            )}
          </button>
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-1.5" />
        )}
        <button
          className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
          onClick={(e) => { e.stopPropagation(); onOpenModal(song); }}
          title="More options"
        >
          <MoreHorizontal className="w-4 h-4 text-white/50 hover:text-white" />
        </button>
      </div>
    </motion.div>
  );
}
