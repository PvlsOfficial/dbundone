import type { AppSettings } from "@shared/types"

export const DEFAULT_SETTINGS: AppSettings = {
  flStudioPath: null,
  aiApiKey: "",
  aiApiUrl: null,
  aiProvider: "local",
  theme: "dark",
  customThemeColor: "#1a1a2e",
  accentColor: "#6366f1",
  autoGenerateArtwork: false,
  excludeAutosaves: true,
  selectedDAWs: ["FL Studio", "Ableton Live"],
  dawFolders: {},
  viewMode: "grid",
}
