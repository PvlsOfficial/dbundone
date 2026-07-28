import type { SoundType } from "@shared/types"

export interface SoundTypeMeta {
  id: SoundType
  label: string
  /** Higher-level grouping used by the type-first layout. */
  group: "Drums" | "Bass" | "Melodic" | "FX" | "Vocals" | "Loops" | "Unsorted"
  color: string
}

/** Canonical sound types + display metadata. Order defines default sortGroup. */
export const SOUND_TYPES: SoundTypeMeta[] = [
  { id: "kick", label: "Kicks", group: "Drums", color: "#ef4444" },
  { id: "snare", label: "Snares", group: "Drums", color: "#f59e0b" },
  { id: "clap", label: "Claps", group: "Drums", color: "#eab308" },
  { id: "hat_closed", label: "Closed Hats", group: "Drums", color: "#22d3ee" },
  { id: "hat_open", label: "Open Hats", group: "Drums", color: "#06b6d4" },
  { id: "perc", label: "Perc", group: "Drums", color: "#a3e635" },
  { id: "tom", label: "Toms", group: "Drums", color: "#fb923c" },
  { id: "rim", label: "Rims", group: "Drums", color: "#f97316" },
  { id: "crash", label: "Crashes", group: "Drums", color: "#14b8a6" },
  { id: "ride", label: "Rides", group: "Drums", color: "#2dd4bf" },
  { id: "cymbal", label: "Cymbals", group: "Drums", color: "#10b981" },
  { id: "shaker", label: "Shakers", group: "Drums", color: "#84cc16" },
  { id: "snap", label: "Snaps", group: "Drums", color: "#facc15" },
  { id: "808", label: "808s", group: "Drums", color: "#8b5cf6" },
  { id: "bass", label: "Bass", group: "Bass", color: "#6366f1" },
  { id: "melody", label: "Melodic", group: "Melodic", color: "#c084fc" },
  { id: "vocal", label: "Vocals", group: "Vocals", color: "#f472b6" },
  { id: "fx", label: "FX", group: "FX", color: "#ec4899" },
  { id: "loop", label: "Loops", group: "Loops", color: "#38bdf8" },
  { id: "unknown", label: "Unsorted", group: "Unsorted", color: "#94a3b8" },
]

export const SOUND_TYPE_MAP: Record<string, SoundTypeMeta> = Object.fromEntries(
  SOUND_TYPES.map((s) => [s.id, s])
)

export function soundLabel(id: string): string {
  return SOUND_TYPE_MAP[id]?.label ?? id
}

export function soundColor(id: string): string {
  return SOUND_TYPE_MAP[id]?.color ?? "#94a3b8"
}
