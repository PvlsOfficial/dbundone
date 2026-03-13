"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X, Wifi, HardDrive, LogIn, LogOut,
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
  { name: "Amber", value: "#f59e0b" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Emerald", value: "#10b981" },
  { name: "Sky", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Silver", value: "#a0a0a0" },
];

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
  isAuthenticated: boolean;
  authError?: string | null;
  onLogin: () => void;
  onLogout: () => void;
}

export function SettingsModal({
  open,
  onClose,
  settings,
  onUpdate,
  isAuthenticated,
  authError,
  onLogin,
  onLogout,
}: SettingsModalProps) {
  // All settings apply immediately — no draft
  const update = (patch: Partial<AppSettings>) => onUpdate(patch);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/75" />

          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={cn(
              "relative w-full sm:max-w-sm",
              "bg-[#111111] border border-white/8 rounded-t-3xl sm:rounded-2xl",
              "max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle (mobile) */}
            <div className="sm:hidden w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1" />

            <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
              <h2 className="font-semibold text-white text-base">Settings</h2>
              <button
                type="button"
                onClick={onClose}
                title="Close"
                className="w-8 h-8 rounded-lg bg-white/6 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">

              {/* Account */}
              <section className="space-y-3">
                <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Account</h3>
                {isAuthenticated ? (
                  <div className="flex items-center gap-3 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06]">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium">Microsoft connected</p>
                      <p className="text-xs text-white/35">OneDrive access active</p>
                    </div>
                    <button
                      type="button"
                      onClick={onLogout}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign out
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 p-3.5 rounded-xl border border-white/6 bg-white/3">
                      <AlertCircle className="w-5 h-5 text-amber-400/60 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-white/70">Not signed in</p>
                        <p className="text-xs text-white/30">Sign in to load your music</p>
                      </div>
                    </div>
                    {authError && (
                      <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/[0.06]">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-300/80 leading-relaxed">{authError}</p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={onLogin}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-medium transition-all",
                        "bg-[hsl(var(--accent-hsl)/0.15)] text-[hsl(var(--accent-hsl))]",
                        "hover:bg-[hsl(var(--accent-hsl)/0.25)] border border-[hsl(var(--accent-hsl)/0.2)]"
                      )}
                    >
                      <LogIn className="w-4 h-4" />
                      Sign in with Microsoft
                    </button>
                  </>
                )}
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
                        "flex flex-col items-center gap-2.5 p-4 rounded-xl border transition-all",
                        settings.playbackMode === mode
                          ? "border-[hsl(var(--accent-hsl)/0.5)] bg-[hsl(var(--accent-hsl)/0.1)] text-white"
                          : "border-white/6 text-white/40 hover:text-white hover:border-white/20"
                      )}
                    >
                      {mode === "streaming" ? <Wifi className="w-5 h-5" /> : <HardDrive className="w-5 h-5" />}
                      <span className="text-xs font-medium capitalize">{mode}</span>
                    </button>
                  ))}
                </div>

                {(["autoDownload", "showWaveform"] as const).map((key) => (
                  <label key={key} className="flex items-center justify-between py-2 cursor-pointer">
                    <span className="text-sm text-white/70">
                      {key === "autoDownload" ? "Auto-download new songs" : "Show waveform"}
                    </span>
                    <button
                      type="button"
                      onClick={() => update({ [key]: !settings[key] })}
                      aria-label={key === "autoDownload" ? "Toggle auto-download" : "Toggle waveform"}
                      className={cn(
                        "w-11 h-6 rounded-full transition-all relative shrink-0",
                        settings[key] ? "bg-[hsl(var(--accent-hsl))]" : "bg-white/20"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all",
                        settings[key] ? "left-6" : "left-1"
                      )} />
                    </button>
                  </label>
                ))}
              </section>

              {/* Color theme */}
              <section className="space-y-3">
                <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Color Theme</h3>

                {/* Color grid — larger swatches, clear selected state */}
                <div className="grid grid-cols-6 gap-2">
                  {ACCENT_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      title={preset.name}
                      aria-label={preset.name}
                      onClick={() => update({ accentColor: preset.value })}
                      className={cn(
                        "relative w-full aspect-square rounded-xl transition-all hover:scale-110 active:scale-95",
                        settings.accentColor === preset.value
                          ? "ring-2 ring-white ring-offset-2 ring-offset-[#111111] scale-105"
                          : "opacity-70 hover:opacity-100"
                      )}
                      style={{ backgroundColor: preset.value }}
                    >
                      {settings.accentColor === preset.value && (
                        <CheckCircle2 className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Custom color picker */}
                <label
                  className={cn(
                    "flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer",
                    !ACCENT_PRESETS.some((p) => p.value === settings.accentColor)
                      ? "border-white/40 bg-white/8"
                      : "border-white/6 hover:border-white/20"
                  )}
                >
                  <div
                    className="w-9 h-9 rounded-xl border border-white/20 overflow-hidden relative shrink-0 shadow-lg"
                    style={{ backgroundColor: settings.accentColor }}
                  >
                    <input
                      type="color"
                      value={settings.accentColor}
                      onChange={(e) => update({ accentColor: e.target.value })}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 font-medium">Custom</p>
                    <p className="text-xs text-white/30 font-mono">{settings.accentColor}</p>
                  </div>
                  <span className="text-xs text-white/30 shrink-0">Pick</span>
                </label>
              </section>
            </div>

            {/* Done button */}
            <div className="p-4 border-t border-white/6">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-white/6 hover:bg-white/10 text-white/70 hover:text-white font-medium text-sm transition-all"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
