// Built-in vibe presets + user preset storage for Cover Lab.

import { defaultParams, makeEffect, makeLayer } from "./doc"
import { CoverDoc, EffectInstance } from "./types"

export interface Preset {
  id: string
  name: string
  description: string
  doc: CoverDoc
}

function fx(effectId: string, params: Record<string, number | string | boolean> = {}): EffectInstance {
  const base = makeEffect(effectId)
  return { ...base, params: { ...defaultParams(effectId), ...params } }
}

const SQUARE = { width: 1024, height: 1024 }

export const BUILTIN_PRESETS: Preset[] = [
  {
    id: "starter-logo",
    name: "Logo + Glow",
    description: "Drop your logo on a gradient, it glows",
    doc: {
      ...SQUARE,
      background: "#05050a",
      layers: [
        makeLayer("gradient", { name: "Background", from: "#1a0033", to: "#0a0a2a", angle: 120 }),
        makeLayer("image", {
          name: "Logo",
          scale: 0.55,
          fit: "contain",
          effects: [fx("bloom", { threshold: 0.4, intensity: 1.3, radius: 2.6 }), fx("chromatic", { amount: 0.02 })],
        }),
      ],
      effects: [fx("grain", { amount: 0.06, size: 1 }), fx("vignette", { amount: 0.7, radius: 0.82, softness: 0.55 })],
      animation: { fps: 20, durationSec: 3 },
    },
  },
  {
    id: "starter-photo",
    name: "Logo + Photo",
    description: "Background photo and a glowing logo",
    doc: {
      ...SQUARE,
      background: "#000000",
      layers: [
        makeLayer("image", {
          name: "Background photo",
          fit: "cover",
          effects: [fx("colorgrade", { saturation: 0.8, contrast: 1.15, brightness: 0.9 }), fx("grain", { amount: 0.08, size: 1 })],
        }),
        makeLayer("image", {
          name: "Logo",
          scale: 0.5,
          fit: "contain",
          effects: [fx("bloom", { threshold: 0.45, intensity: 1.1, radius: 2.4 })],
        }),
      ],
      effects: [fx("vignette", { amount: 0.8, radius: 0.78, softness: 0.5 })],
      animation: { fps: 20, durationSec: 3 },
    },
  },
  {
    id: "dystopian",
    name: "Dystopian",
    description: "Smoky, desaturated, high-contrast doom",
    doc: {
      ...SQUARE,
      background: "#05060a",
      layers: [
        makeLayer("gradient", { name: "Sky", from: "#10131c", to: "#2a2f3a", angle: 90 }),
        makeLayer("text", { name: "Title", text: "RUINS", size: 0.22, color: "#d8dde6", letterSpacing: 0.06, y: 0.5 }),
      ],
      effects: [
        fx("fog", { density: 0.65, color: "#8b94a3", height: 0.7, speed: 0.4 }),
        fx("colorgrade", { saturation: 0.45, contrast: 1.25, brightness: 0.95 }),
        fx("grain", { amount: 0.22, size: 1.2 }),
        fx("vignette", { amount: 0.85, radius: 0.7, softness: 0.5 }),
      ],
      animation: { fps: 16, durationSec: 3 },
    },
  },
  {
    id: "modern-album",
    name: "Modern Album",
    description: "Clean duotone with bold type",
    doc: {
      ...SQUARE,
      background: "#0a0a2a",
      layers: [
        makeLayer("gradient", { name: "Wash", from: "#12022e", to: "#3a006a", angle: 135 }),
        makeLayer("text", { name: "Artist", text: "ARTIST\nNAME", size: 0.14, color: "#ffffff", letterSpacing: 0.04, weight: 800 }),
      ],
      effects: [
        fx("duotone", { dark: "#0a0a2a", light: "#ff2e6c", contrast: 1.3 }),
        fx("bloom", { threshold: 0.55, intensity: 0.9, radius: 2.2 }),
        fx("grain", { amount: 0.08, size: 1 }),
      ],
      animation: { fps: 16, durationSec: 3 },
    },
  },
  {
    id: "morph",
    name: "Liquid Morph",
    description: "Flowing, hypnotic animated warp",
    doc: {
      ...SQUARE,
      background: "#000000",
      layers: [makeLayer("gradient", { name: "Plasma", from: "#00ffd5", to: "#ff00aa", angle: 60 })],
      effects: [
        fx("warp", { amount: 0.18, scale: 4, speed: 0.8 }),
        fx("gradientmap", { low: "#04001a", mid: "#7a00ff", high: "#00ffe1", mix: 0.85 }),
        fx("bloom", { threshold: 0.5, intensity: 1.1, radius: 2.5 }),
      ],
      animation: { fps: 20, durationSec: 4 },
    },
  },
  {
    id: "glitch",
    name: "Glitch",
    description: "Datamoshed, broken-signal energy",
    doc: {
      ...SQUARE,
      background: "#000000",
      layers: [
        makeLayer("gradient", { name: "Base", from: "#001028", to: "#ff0033", angle: 20 }),
        makeLayer("text", { name: "Tag", text: "404", size: 0.3, color: "#00ffd5", weight: 900 }),
      ],
      effects: [
        fx("glitch", { intensity: 0.6, blocks: 50, speed: 2 }),
        fx("rgbshift", { amount: 0.02, speed: 3 }),
        fx("scanlines", { count: 700, strength: 0.4, curvature: 0.1 }),
      ],
      animation: { fps: 20, durationSec: 2.5 },
    },
  },
  {
    id: "neon-grid",
    name: "Neon Retro",
    description: "Synthwave CRT with halftone",
    doc: {
      ...SQUARE,
      background: "#0a0020",
      layers: [
        makeLayer("gradient", { name: "Sunset", from: "#ff006e", to: "#3a0ca3", angle: 90 }),
        makeLayer("text", { name: "Title", text: "RETRO", size: 0.2, color: "#ffffff", weight: 800, letterSpacing: 0.08 }),
      ],
      effects: [
        fx("bloom", { threshold: 0.5, intensity: 1.4, radius: 3 }),
        fx("scanlines", { count: 500, strength: 0.5, curvature: 0.18 }),
        fx("chromatic", { amount: 0.04 }),
      ],
      animation: { fps: 16, durationSec: 3 },
    },
  },
  {
    id: "kaleido",
    name: "Kaleidoscope",
    description: "Mirrored, spinning psychedelia",
    doc: {
      ...SQUARE,
      background: "#000000",
      layers: [makeLayer("gradient", { name: "Source", from: "#ffea00", to: "#ff006e", angle: 30 })],
      effects: [
        fx("warp", { amount: 0.12, scale: 5, speed: 0.5 }),
        fx("kaleidoscope", { segments: 8, spin: 0.4 }),
        fx("gradientmap", { low: "#04001a", mid: "#00ffd5", high: "#ffffff", mix: 0.7 }),
      ],
      animation: { fps: 20, durationSec: 4 },
    },
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Slow drifting northern-lights wash",
    doc: {
      ...SQUARE,
      background: "#01030a",
      layers: [
        makeLayer("gradient", { name: "Night", from: "#02030f", to: "#0a1d2e", angle: 90 }),
        makeLayer("text", { name: "Title", text: "AURORA", size: 0.13, color: "#eafff7", weight: 600, letterSpacing: 0.18, y: 0.82 }),
      ],
      effects: [
        fx("warp", { amount: 0.16, scale: 2.4, speed: 0.45 }),
        fx("gradientmap", { low: "#020a14", mid: "#1bd6a0", high: "#9b7bff", mix: 0.8 }),
        fx("bloom", { threshold: 0.45, intensity: 1.2, radius: 3 }),
        fx("grain", { amount: 0.06, size: 1 }),
        fx("vignette", { amount: 0.6, radius: 0.85, softness: 0.6 }),
      ],
      animation: { fps: 20, durationSec: 4 },
    },
  },
  {
    id: "liquid-chrome",
    name: "Liquid Chrome",
    description: "Molten metal ripples, hypnotic loop",
    doc: {
      ...SQUARE,
      background: "#000000",
      layers: [makeLayer("gradient", { name: "Metal", from: "#3a3a3a", to: "#e8e8e8", angle: 120 })],
      effects: [
        fx("warp", { amount: 0.22, scale: 3.2, speed: 0.9 }),
        fx("ripple", { amplitude: 0.018, frequency: 26, speed: 2 }),
        fx("gradientmap", { low: "#06070d", mid: "#7d8aa6", high: "#ffffff", mix: 0.7 }),
        fx("sharpen", { amount: 0.8 }),
        fx("vignette", { amount: 0.7, radius: 0.8, softness: 0.5 }),
      ],
      animation: { fps: 24, durationSec: 4 },
    },
  },
  {
    id: "risograph",
    name: "Risograph",
    description: "Two-ink halftone print look",
    doc: {
      ...SQUARE,
      background: "#f4efe3",
      layers: [
        makeLayer("gradient", { name: "Paper", from: "#f4efe3", to: "#e7dcc6", angle: 90 }),
        makeLayer("text", { name: "Title", text: "PRESS\nPLAY", size: 0.18, color: "#15110c", weight: 900, letterSpacing: 0.02 }),
      ],
      effects: [
        fx("halftone", { scale: 10, angle: 0.35 }),
        fx("duotone", { dark: "#1b2a6b", light: "#ff4d3d", contrast: 1.4 }),
        fx("grain", { amount: 0.1, size: 1.4 }),
      ],
      animation: { fps: 12, durationSec: 2 },
    },
  },
  {
    id: "vaporwave",
    name: "Vaporwave",
    description: "Pastel chrome dreamscape",
    doc: {
      ...SQUARE,
      background: "#1a0033",
      layers: [
        makeLayer("gradient", { name: "Sky", from: "#ff77e9", to: "#6a5cff", angle: 75 }),
        makeLayer("text", { name: "Title", text: "ＡＥＳＴＨＥＴＩＣ", size: 0.1, color: "#ffffff", weight: 700, letterSpacing: 0.05, y: 0.5 }),
      ],
      effects: [
        fx("twirl", { angle: 1.2, radius: 0.7, spin: 0.5 }),
        fx("gradientmap", { low: "#1c0a3a", mid: "#ff7ae0", high: "#9bf6ff", mix: 0.6 }),
        fx("chromatic", { amount: 0.05 }),
        fx("scanlines", { count: 480, strength: 0.35, curvature: 0.14 }),
        fx("bloom", { threshold: 0.5, intensity: 1, radius: 2.4 }),
      ],
      animation: { fps: 20, durationSec: 4 },
    },
  },
  {
    id: "living-portrait",
    name: "Living Portrait",
    description: "Drop in a photo — it breathes & drifts",
    doc: {
      ...SQUARE,
      background: "#000000",
      layers: [
        makeLayer("gradient", { name: "Backdrop", from: "#0c0c10", to: "#23232c", angle: 90 }),
        makeLayer("text", { name: "Hint", text: "ADD A PHOTO LAYER", size: 0.05, color: "#8a8a96", weight: 600, letterSpacing: 0.1, y: 0.5 }),
      ],
      effects: [
        fx("livemotion", { mode: 0, speed: 0.7, amount: 0.08, turb: 0.4, detail: 3, follow: 0.85 }),
        fx("grain", { amount: 0.07, size: 1.1 }),
        fx("vignette", { amount: 0.7, radius: 0.82, softness: 0.55 }),
      ],
      animation: { fps: 24, durationSec: 4 },
    },
  },
  {
    id: "infrared",
    name: "Infrared",
    description: "Thermal-cam heat map, pulsing",
    doc: {
      ...SQUARE,
      background: "#000000",
      layers: [
        makeLayer("gradient", { name: "Field", from: "#000010", to: "#220000", angle: 45 }),
        makeLayer("text", { name: "Title", text: "HEAT", size: 0.26, color: "#ffffff", weight: 900, letterSpacing: 0.04 }),
      ],
      effects: [
        fx("warp", { amount: 0.1, scale: 3, speed: 0.6 }),
        fx("thermal", { mix: 1 }),
        fx("bloom", { threshold: 0.55, intensity: 1.1, radius: 2.6 }),
      ],
      animation: { fps: 20, durationSec: 3 },
    },
  },
]

// ── User presets (localStorage) ────────────────────────────────────────────────

const USER_KEY = "dbundone:coverLab:userPresets"

export function loadUserPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Preset[]) : []
  } catch {
    return []
  }
}

export function saveUserPreset(preset: Preset): Preset[] {
  const presets = loadUserPresets().filter((p) => p.id !== preset.id)
  presets.unshift(preset)
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(presets))
  } catch {
    // ignore quota errors
  }
  return presets
}

export function deleteUserPreset(id: string): Preset[] {
  const presets = loadUserPresets().filter((p) => p.id !== id)
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(presets))
  } catch {
    // ignore
  }
  return presets
}
