"use client";

import { useState, useEffect, useCallback } from "react";
import type { AppSettings } from "@/types";
import { getAccentHSL } from "@/lib/utils";

const DEFAULT_SETTINGS: AppSettings = {
  playbackMode: "streaming",
  autoDownload: false,
  accentColor: "#6366f1",
  showWaveform: true,
};

const SETTINGS_KEY = "pvls-player-settings";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      }
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const hsl = getAccentHSL(settings.accentColor);
    document.documentElement.style.setProperty("--accent-hsl", hsl);
  }, [settings.accentColor, loaded]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { settings, updateSettings, loaded };
}
