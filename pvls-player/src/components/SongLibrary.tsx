"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, SortAsc, SortDesc, Grid3X3, List, Filter,
  Music2, Loader2, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SongCard } from "./SongCard";
import type { Song, Playlist } from "@/types";
import type { SortField, SortDir, ViewMode } from "@/hooks/useLibrary";

interface SongLibraryProps {
  songs: Song[];
  currentSongId?: string;
  isPlaying: boolean;
  playlists: Playlist[];
  search: string;
  onSearch: (q: string) => void;
  sortField: SortField;
  onSortField: (f: SortField) => void;
  sortDir: SortDir;
  onSortDir: (d: SortDir) => void;
  viewMode: ViewMode;
  onViewMode: (m: ViewMode) => void;
  filterFormat: string;
  onFilterFormat: (f: string) => void;
  formats: string[];
  onPlay: (song: Song) => void;
  onOpenModal: (song: Song) => void;
  onDownload: (song: Song) => void;
  onRating: (song: Song, rating: number) => void;
  loading?: boolean;
  error?: string;
  totalCount?: number;
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "addedAt", label: "Date Added" },
  { value: "duration", label: "Duration" },
  { value: "rating", label: "Rating" },
  { value: "playCount", label: "Play Count" },
  { value: "format", label: "Format" },
];

export function SongLibrary({
  songs,
  currentSongId,
  isPlaying,
  playlists,
  search,
  onSearch,
  sortField,
  onSortField,
  sortDir,
  onSortDir,
  viewMode,
  onViewMode,
  filterFormat,
  onFilterFormat,
  formats,
  onPlay,
  onOpenModal,
  onDownload,
  onRating,
  loading,
  error,
  totalCount,
}: SongLibraryProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex-shrink-0 space-y-2 pb-4">
        {/* Search + view mode */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search songs..."
              className="w-full bg-white/[0.05] border border-white/[0.06] rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-[hsl(var(--accent-hsl)/0.4)] transition-colors"
            />
          </div>

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center transition-colors border",
              showFilters
                ? "bg-[hsl(var(--accent-hsl)/0.15)] border-[hsl(var(--accent-hsl)/0.3)] text-[hsl(var(--accent-hsl))]"
                : "bg-white/[0.04] border-white/[0.06] text-white/40 hover:text-white"
            )}
          >
            <Filter className="w-4 h-4" />
          </button>

          <button
            onClick={() => onViewMode(viewMode === "list" ? "grid" : "list")}
            className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white transition-colors"
          >
            {viewMode === "list" ? <Grid3X3 className="w-4 h-4" /> : <List className="w-4 h-4" />}
          </button>
        </div>

        {/* Filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 pt-1">
                {/* Sort */}
                <select
                  value={sortField}
                  onChange={(e) => onSortField(e.target.value as SortField)}
                  className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white/70 outline-none"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                <button
                  onClick={() => onSortDir(sortDir === "asc" ? "desc" : "asc")}
                  className="flex items-center gap-1 bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white/70 hover:text-white transition-colors"
                >
                  {sortDir === "asc" ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />}
                  {sortDir === "asc" ? "A→Z" : "Z→A"}
                </button>

                {/* Format filter */}
                <div className="flex gap-1 flex-wrap">
                  {["all", ...formats].map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => onFilterFormat(fmt)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-xs font-medium font-mono uppercase transition-all",
                        filterFormat === fmt
                          ? "bg-[hsl(var(--accent-hsl)/0.2)] text-[hsl(var(--accent-hsl))]"
                          : "bg-white/[0.04] text-white/30 hover:text-white"
                      )}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        <div className="flex items-center gap-2 text-xs text-white/25">
          <span>{songs.length} song{songs.length !== 1 ? "s" : ""}</span>
          {totalCount && totalCount !== songs.length && (
            <span>of {totalCount} total</span>
          )}
        </div>
      </div>

      {/* Song list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 text-[hsl(var(--accent-hsl))] animate-spin" />
            <p className="text-sm text-white/40">Syncing from OneDrive...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 px-8 text-center">
            <AlertCircle className="w-8 h-8 text-red-400/60" />
            <p className="text-sm text-white/40">{error}</p>
          </div>
        )}

        {!loading && !error && songs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center">
              <Music2 className="w-8 h-8 text-white/15" />
            </div>
            <div className="text-center">
              <p className="text-white/40 font-medium">No songs found</p>
              <p className="text-white/20 text-sm mt-1">
                Add your OneDrive share URL in settings
              </p>
            </div>
          </div>
        )}

        {!loading && songs.length > 0 && (
          viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {songs.map((song, i) => (
                <SongCard
                  key={song.id}
                  song={song}
                  index={i}
                  isPlaying={isPlaying}
                  isCurrent={song.id === currentSongId}
                  onPlay={onPlay}
                  onOpenModal={onOpenModal}
                  onDownload={onDownload}
                  onRating={(s, r) => onRating(s, r)}
                  viewMode="grid"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              {songs.map((song, i) => (
                <SongCard
                  key={song.id}
                  song={song}
                  index={i}
                  isPlaying={isPlaying}
                  isCurrent={song.id === currentSongId}
                  onPlay={onPlay}
                  onOpenModal={onOpenModal}
                  onDownload={onDownload}
                  onRating={(s, r) => onRating(s, r)}
                  viewMode="list"
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
