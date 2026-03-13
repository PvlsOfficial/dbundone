"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListMusic, Plus, Trash2, ChevronRight, Library, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Playlist } from "@/types";

const PLAYLIST_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
];

interface PlaylistSidebarProps {
  playlists: Playlist[];
  activePlaylistId: string | null;
  onSelect: (id: string | null) => void;
  onCreatePlaylist: (name: string, color?: string) => void;
  onDeletePlaylist: (id: string) => void;
  isOpen: boolean;
  onClose?: () => void;
}

export function PlaylistSidebar({
  playlists,
  activePlaylistId,
  onSelect,
  onCreatePlaylist,
  onDeletePlaylist,
  isOpen,
  onClose,
}: PlaylistSidebarProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PLAYLIST_COLORS[0]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreatePlaylist(newName.trim(), selectedColor);
    setNewName("");
    setCreating(false);
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && onClose && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <motion.aside
        className={cn(
          "fixed left-0 top-0 z-40 w-64",
          "bottom-20 lg:bottom-0", // stop above PlayerBar on mobile
          "bg-[#0d0d0d] border-r border-white/[0.06] flex flex-col",
          "lg:relative lg:z-auto lg:translate-x-0",
          "lg:pb-20", // on desktop the PlayerBar is fixed and overlaps the bottom — pad it out
          "transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="font-brand text-sm font-semibold text-white/80">Library</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setCreating(true)}
              className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors"
              title="New playlist"
            >
              <Plus className="w-4 h-4" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors lg:hidden"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {/* All Songs */}
          <button
            onClick={() => onSelect(null)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left",
              activePlaylistId === null
                ? "bg-[hsl(var(--accent-hsl)/0.15)] text-white"
                : "text-white/50 hover:text-white hover:bg-white/[0.04]"
            )}
          >
            <Library className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium flex-1">All Songs</span>
            {activePlaylistId === null && <ChevronRight className="w-3 h-3" />}
          </button>

          {playlists.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-white/20 px-3 mb-1.5 uppercase tracking-wider">Playlists</p>
              {playlists.map((pl) => (
                <div key={pl.id} className="group relative">
                  <button
                    onClick={() => onSelect(pl.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left",
                      activePlaylistId === pl.id
                        ? "bg-[hsl(var(--accent-hsl)/0.15)] text-white"
                        : "text-white/50 hover:text-white hover:bg-white/[0.04]"
                    )}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: pl.color ?? "#6366f1" }}
                    />
                    <span className="text-sm font-medium flex-1 truncate">{pl.name}</span>
                    <span className="text-xs text-white/20">{pl.songIds.length}</span>
                  </button>
                  <button
                    onClick={() => onDeletePlaylist(pl.id)}
                    className="absolute right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-red-400/50 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create playlist form */}
        <AnimatePresence>
          {creating && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-white/[0.06] p-4 space-y-3 overflow-hidden"
            >
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setCreating(false);
                }}
                placeholder="Playlist name..."
                className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-[hsl(var(--accent-hsl)/0.5)]"
              />
              <div className="flex gap-1.5 flex-wrap">
                {PLAYLIST_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={cn(
                      "w-5 h-5 rounded-full transition-all",
                      selectedColor === color && "ring-2 ring-white ring-offset-2 ring-offset-[#0d0d0d]"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCreating(false)}
                  className="flex-1 py-1.5 rounded-lg text-xs text-white/40 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="flex-1 py-1.5 rounded-lg text-xs bg-[hsl(var(--accent-hsl)/0.2)] text-[hsl(var(--accent-hsl))] disabled:opacity-30 hover:bg-[hsl(var(--accent-hsl)/0.3)] transition-colors"
                >
                  Create
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>
    </>
  );
}
