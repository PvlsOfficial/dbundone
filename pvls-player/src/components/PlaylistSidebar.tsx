"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, ChevronRight, Library, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Playlist } from "@/types";

export const PLAYLIST_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#a855f7", "#10b981",
];

interface CreatePlaylistModalProps {
  onClose: () => void;
  onCreate: (name: string, color: string) => void;
}

export function CreatePlaylistModal({ onClose, onCreate }: CreatePlaylistModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PLAYLIST_COLORS[0]);

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), color);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/75" />
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 8 }}
        transition={{ type: "spring", damping: 28, stiffness: 360 }}
        className="relative w-full max-w-sm bg-[#111111] border border-white/[0.1] rounded-2xl p-5 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white text-base">New Playlist</h3>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="w-7 h-7 rounded-lg bg-white/6 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
            if (e.key === "Escape") onClose();
          }}
          placeholder="Playlist name..."
          className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-[hsl(var(--accent-hsl)/0.5)] transition-colors"
        />

        <div>
          <p className="text-xs text-white/30 mb-2.5 font-medium uppercase tracking-wider">Color</p>
          <div className="grid grid-cols-6 gap-2.5">
            {PLAYLIST_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                title={c}
                aria-label={`Select color ${c}`}
                className={cn(
                  "w-full aspect-square rounded-xl transition-all hover:scale-110",
                  color === c && "ring-2 ring-white ring-offset-2 ring-offset-[#111111] scale-110"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm text-white/40 hover:text-white bg-white/4 hover:bg-white/8 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[hsl(var(--accent-hsl))] text-white disabled:opacity-30 hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Create
          </button>
        </div>
      </motion.div>
    </div>
  );
}

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
          "bottom-20 lg:bottom-0",
          "bg-[#0d0d0d] border-r border-white/[0.06] flex flex-col",
          "lg:relative lg:z-auto lg:translate-x-0",
          "lg:pb-20",
          "transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="font-brand text-sm font-semibold text-white/80">Library</h2>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors"
              title="New playlist"
            >
              <Plus className="w-4 h-4" />
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title="Close sidebar"
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
            onClick={() => { onSelect(null); onClose?.(); }}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left",
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
                    type="button"
                    onClick={() => { onSelect(pl.id); onClose?.(); }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left",
                      activePlaylistId === pl.id
                        ? "bg-[hsl(var(--accent-hsl)/0.15)] text-white"
                        : "text-white/50 hover:text-white hover:bg-white/4"
                    )}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0 inline-block"
                      style={{ backgroundColor: pl.color ?? "#6366f1" }}
                    />
                    <span className="text-sm font-medium flex-1 truncate">{pl.name}</span>
                    <span className="text-xs text-white/20">{pl.songIds.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePlaylist(pl.id)}
                    title={`Delete ${pl.name}`}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-lg flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-400/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* New playlist shortcut at bottom of list */}
          <button
            onClick={() => setCreating(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left text-white/25 hover:text-white/60 hover:bg-white/[0.03] mt-2"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">New playlist</span>
          </button>
        </div>
      </motion.aside>

      {/* Centered create modal */}
      <AnimatePresence>
        {creating && (
          <CreatePlaylistModal
            onClose={() => setCreating(false)}
            onCreate={(name, color) => onCreatePlaylist(name, color)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
