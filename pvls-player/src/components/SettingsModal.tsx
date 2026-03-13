"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Save, Wifi, HardDrive, LogIn, LogOut,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppSettings } from "@/types";

const ACCENT_PRESETS = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Orange", value: "#f97316" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Emerald", value: "#10b981" },
  { name: "White", value: "#a0a0a0" },
];

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
  isAuthenticated: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export function SettingsModal({
  open,
  onClose,
  settings,
  onUpdate,
  isAuthenticated,
  onLogin,
  onLogout,
}: SettingsModalProps) {
  const [draft, setDraft] = useState(settings);

  const handleSave = () => {
    onUpdate(draft);
    onClose();
  };

  const update = (patch: Partial<AppSettings>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className={cn(
              "relative w-full sm:max-w-sm",
              "bg-[#111111] border border-white/[0.08] rounded-t-3xl sm:rounded-2xl",
              "max-h-[85vh] flex flex-col overflow-hidden"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden w-10 h-1 bg-white/20 rounded-full mx-auto mt-3" />

            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h2 className="font-semibold text-white">Settings</h2>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">

              {/* Microsoft Account */}
              <section className="space-y-3">
                <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Account</h3>
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border",
                  isAuthenticated
                    ? "border-emerald-500/20 bg-emerald-500/[0.06]"
                    : "border-white/[0.06] bg-white/[0.03]"
                )}>
                  {isAuthenticated ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-white font-medium">Microsoft connected</p>
                        <p className="text-xs text-white/35">OneDrive access active</p>
                      </div>
                      <button
                        type="button"
                        onClick={onLogout}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign out
                      </button>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-amber-400/60 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-white/70">Not signed in</p>
                        <p className="text-xs text-white/30">Sign in to load your music</p>
                      </div>
                      <button
                        type="button"
                        onClick={onLogin}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-[hsl(var(--accent-hsl)/0.15)] text-[hsl(var(--accent-hsl))] hover:bg-[hsl(var(--accent-hsl)/0.25)] transition-colors"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        Sign in
                      </button>
                    </>
                  )}
                </div>
              </section>

              {/* Playback */}
              <section className="space-y-3">
                <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Playback</h3>
                <div className="grid grid-cols-2 gap-2">
                  {(["streaming", "local"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => update({ playbackMode: mode })}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                        draft.playbackMode === mode
                          ? "border-[hsl(var(--accent-hsl)/0.5)] bg-[hsl(var(--accent-hsl)/0.1)] text-white"
                          : "border-white/[0.06] text-white/40 hover:text-white hover:border-white/20"
                      )}
                    >
                      {mode === "streaming" ? <Wifi className="w-5 h-5" /> : <HardDrive className="w-5 h-5" />}
                      <span className="text-xs font-medium capitalize">{mode}</span>
                      <span className="text-[10px] text-current opacity-50">
                        {mode === "streaming" ? "Always online" : "Downloads songs"}
                      </span>
                    </button>
                  ))}
                </div>
                <label className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-white/70">Auto-download new songs</span>
                  <button
                    type="button"
                    onClick={() => update({ autoDownload: !draft.autoDownload })}
                    className={cn(
                      "w-10 h-6 rounded-full transition-all relative flex-shrink-0",
                      draft.autoDownload ? "bg-[hsl(var(--accent-hsl))]" : "bg-white/20"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all",
                      draft.autoDownload ? "left-5" : "left-1"
                    )} />
                  </button>
                </label>
                <label className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-white/70">Show waveform</span>
                  <button
                    type="button"
                    onClick={() => update({ showWaveform: !draft.showWaveform })}
                    className={cn(
                      "w-10 h-6 rounded-full transition-all relative flex-shrink-0",
                      draft.showWaveform ? "bg-[hsl(var(--accent-hsl))]" : "bg-white/20"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all",
                      draft.showWaveform ? "left-5" : "left-1"
                    )} />
                  </button>
                </label>
              </section>

              {/* Accent */}
              <section className="space-y-2">
                <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Color</h3>
                <div className="grid grid-cols-4 gap-2">
                  {ACCENT_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => update({ accentColor: preset.value })}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all",
                        draft.accentColor === preset.value
                          ? "border-white/40 bg-white/10"
                          : "border-white/[0.06] hover:border-white/20"
                      )}
                    >
                      <div className="w-5 h-5 rounded-full" style={{ backgroundColor: preset.value }} />
                      <span className="text-[10px] text-white/40">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="p-4 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={handleSave}
                className="w-full py-3 rounded-xl bg-[hsl(var(--accent-hsl))] text-white font-medium text-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
