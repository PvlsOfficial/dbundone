"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Edit3, Plus, Trash2, Send, Clock, Download,
  ListPlus, CheckCircle2, Music2,
} from "lucide-react";
import { cn, formatDuration, formatFileSize, generateId } from "@/lib/utils";
import { RatingStars } from "./RatingStars";
import type { Song, Playlist, Comment } from "@/types";

interface SongModalProps {
  song: Song | null;
  playlists: Playlist[];
  onClose: () => void;
  onUpdateSong: (id: string, patch: Partial<Song>) => void;
  onAddToPlaylist: (playlistId: string, songId: string) => void;
  onCreatePlaylist: (name: string) => Promise<Playlist>;
  onDownload: (song: Song) => void;
}

export function SongModal({
  song,
  playlists,
  onClose,
  onUpdateSong,
  onAddToPlaylist,
  onCreatePlaylist,
  onDownload,
}: SongModalProps) {
  const [tab, setTab] = useState<"info" | "comments" | "playlists">("info");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (song) {
      setNameInput(song.customName ?? song.name);
      setTab("info");
    }
  }, [song]);

  if (!song) return null;

  const displayName = song.customName ?? song.name;
  const comments = song.comments ?? [];

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== song.name) {
      onUpdateSong(song.id, { customName: trimmed });
    } else if (!trimmed || trimmed === song.name) {
      onUpdateSong(song.id, { customName: undefined });
    }
    setEditingName(false);
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    const comment: Comment = {
      id: generateId(),
      text: newComment.trim(),
      timestamp: 0,
      createdAt: new Date().toISOString(),
    };
    onUpdateSong(song.id, { comments: [...comments, comment] });
    setNewComment("");
  };

  const handleDeleteComment = (id: string) => {
    onUpdateSong(song.id, { comments: comments.filter((c) => c.id !== id) });
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    const pl = await onCreatePlaylist(newPlaylistName.trim());
    onAddToPlaylist(pl.id, song.id);
    setNewPlaylistName("");
  };

  const handleDownload = async () => {
    setDownloading(true);
    await onDownload(song);
    setDownloading(false);
  };

  const inPlaylists = playlists.filter((p) => p.songIds.includes(song.id));

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Panel */}
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className={cn(
            "relative w-full sm:max-w-md",
            "bg-[#111111] border border-white/[0.08] rounded-t-3xl sm:rounded-2xl",
            "max-h-[85vh] flex flex-col overflow-hidden"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle (mobile) */}
          <div className="sm:hidden w-10 h-1 bg-white/20 rounded-full mx-auto mt-3" />

          {/* Header */}
          <div className="flex items-start gap-3 p-5 border-b border-white/[0.06]">
            <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center flex-shrink-0">
              <Music2 className="w-6 h-6 text-white/20" />
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                  className="w-full bg-white/[0.08] border border-[hsl(var(--accent-hsl)/0.5)] rounded-lg px-2 py-1 text-sm font-medium text-white outline-none"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white truncate">{displayName}</p>
                  <button
                    onClick={() => setEditingName(true)}
                    className="flex-shrink-0 text-white/30 hover:text-white transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-xs text-white/40 mt-0.5">{song.originalName}</p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 pt-3">
            {(["info", "comments", "playlists"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                  tab === t
                    ? "bg-[hsl(var(--accent-hsl)/0.15)] text-[hsl(var(--accent-hsl))]"
                    : "text-white/40 hover:text-white"
                )}
              >
                {t}
                {t === "comments" && comments.length > 0 && (
                  <span className="ml-1 text-[10px] opacity-60">({comments.length})</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {tab === "info" && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <RatingStars
                    rating={song.rating}
                    onChange={(r) => onUpdateSong(song.id, { rating: r })}
                    size="lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Format", value: song.format.toUpperCase() },
                    { label: "Size", value: formatFileSize(song.size) },
                    { label: "Duration", value: song.duration ? formatDuration(song.duration) : "—" },
                    { label: "Plays", value: String(song.playCount ?? 0) },
                    { label: "Added", value: new Date(song.addedAt).toLocaleDateString() },
                    { label: "Status", value: song.isDownloaded ? "Downloaded" : "Streaming" },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/[0.03] rounded-xl p-3">
                      <p className="text-xs text-white/30 mb-1">{label}</p>
                      <p className="text-sm font-medium text-white">{value}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleDownload}
                  disabled={song.isDownloaded || downloading}
                  className={cn(
                    "w-full py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
                    song.isDownloaded
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-[hsl(var(--accent-hsl)/0.15)] text-[hsl(var(--accent-hsl))] hover:bg-[hsl(var(--accent-hsl)/0.25)] border border-[hsl(var(--accent-hsl)/0.2)]"
                  )}
                >
                  {song.isDownloaded ? (
                    <><CheckCircle2 className="w-4 h-4" /> Downloaded</>
                  ) : downloading ? (
                    <><div className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" /> Downloading...</>
                  ) : (
                    <><Download className="w-4 h-4" /> Download locally</>
                  )}
                </button>
              </div>
            )}

            {tab === "comments" && (
              <div className="space-y-3">
                {comments.length === 0 && (
                  <p className="text-center text-white/30 text-sm py-8">No comments yet</p>
                )}
                {comments.map((c) => (
                  <div key={c.id} className="bg-white/[0.03] rounded-xl p-3 group">
                    <p className="text-sm text-white/80">{c.text}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-white/25">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400/60 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex gap-2 pt-2">
                  <input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                    placeholder="Add a comment..."
                    className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-[hsl(var(--accent-hsl)/0.5)]"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="w-9 h-9 rounded-xl bg-[hsl(var(--accent-hsl)/0.15)] flex items-center justify-center disabled:opacity-30 hover:bg-[hsl(var(--accent-hsl)/0.25)] transition-colors"
                  >
                    <Send className="w-4 h-4 text-[hsl(var(--accent-hsl))]" />
                  </button>
                </div>
              </div>
            )}

            {tab === "playlists" && (
              <div className="space-y-2">
                {inPlaylists.length > 0 && (
                  <p className="text-xs text-white/30 px-1">Already in</p>
                )}
                {inPlaylists.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[hsl(var(--accent-hsl)/0.08)] border border-[hsl(var(--accent-hsl)/0.15)]">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(var(--accent-hsl))]" />
                    <span className="text-sm text-white">{p.name}</span>
                  </div>
                ))}

                {playlists.filter((p) => !p.songIds.includes(song.id)).length > 0 && (
                  <>
                    <p className="text-xs text-white/30 px-1 pt-2">Add to playlist</p>
                    {playlists
                      .filter((p) => !p.songIds.includes(song.id))
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => onAddToPlaylist(p.id, song.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/[0.05] text-white/70 hover:text-white transition-colors text-left"
                        >
                          <ListPlus className="w-4 h-4" />
                          <span className="text-sm">{p.name}</span>
                        </button>
                      ))}
                  </>
                )}

                <div className="flex gap-2 pt-2">
                  <input
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreatePlaylist()}
                    placeholder="New playlist name..."
                    className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-[hsl(var(--accent-hsl)/0.5)]"
                  />
                  <button
                    onClick={handleCreatePlaylist}
                    disabled={!newPlaylistName.trim()}
                    className="w-9 h-9 rounded-xl bg-[hsl(var(--accent-hsl)/0.15)] flex items-center justify-center disabled:opacity-30 hover:bg-[hsl(var(--accent-hsl)/0.25)] transition-colors"
                  >
                    <Plus className="w-4 h-4 text-[hsl(var(--accent-hsl))]" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
