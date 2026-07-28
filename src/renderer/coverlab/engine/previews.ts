// Generates small live thumbnails for every effect by running each one (with its
// default params) over a fixed sample composition through a single offscreen
// CoverEngine. Results are cached module-wide so the gallery is instant after the
// first open.

import { CoverEngine } from "./CoverEngine"
import { EFFECTS } from "./effects"
import { makeEffect, makeLayer } from "./doc"
import { CoverDoc } from "./types"

let cache: Record<string, string> | null = null
let inflight: Promise<Record<string, string>> | null = null

/** A colourful, feature-rich sample so distortions/edges/colour shifts all read clearly. */
function sampleDoc(): CoverDoc {
  return {
    width: 160,
    height: 160,
    background: "#0b0b12",
    layers: [
      makeLayer("gradient", { name: "bg", from: "#3a0ca3", to: "#ff006e", angle: 45 }),
      makeLayer("solid", { name: "cyan", color: "#00e5ff", x: 0.33, y: 0.36, scale: 0.36, rotation: 18 }),
      makeLayer("gradient", { name: "warm", from: "#ffd000", to: "#ff3b00", angle: 120, x: 0.66, y: 0.64, scale: 0.42, rotation: -14 }),
      makeLayer("text", { name: "type", text: "Aa", color: "#ffffff", size: 0.46, weight: 800, x: 0.5, y: 0.52 }),
    ],
    effects: [],
    animation: { fps: 16, durationSec: 3 },
  }
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${mime};base64,` + btoa(bin)
}

/**
 * Render (or return cached) preview thumbnails keyed by effect id. `onOne` is
 * called as each preview finishes so the gallery can fill in progressively.
 */
export async function getEffectPreviews(
  size = 132,
  onOne?: (id: string, dataUrl: string) => void
): Promise<Record<string, string>> {
  if (cache) {
    if (onOne) for (const [id, url] of Object.entries(cache)) onOne(id, url)
    return cache
  }
  if (inflight) {
    const result = await inflight
    if (onOne) for (const [id, url] of Object.entries(result)) onOne(id, url)
    return result
  }

  inflight = (async () => {
    const canvas = document.createElement("canvas")
    const out: Record<string, string> = {}
    let engine: CoverEngine | null = null
    try {
      engine = new CoverEngine(canvas)
      const base = sampleDoc()
      // Render the cheap static PNGs first so the grid fills instantly, then go
      // back and produce the small looping GIFs for animated effects.
      const ordered = [...EFFECTS].sort((a, b) => Number(a.animatable) - Number(b.animatable))
      for (const def of ordered) {
        const doc: CoverDoc = { ...base, effects: [makeEffect(def.id)] }
        engine.setDoc(doc)
        try {
          let url: string
          if (def.animatable) {
            // A short looping GIF — the browser plays it for free as an <img>.
            const bytes = await engine.exportGIF({ size: Math.min(size, 112), fps: 12, durationSec: 1.5 })
            url = bytesToDataUrl(bytes, "image/gif")
          } else {
            const bytes = await engine.exportPNG(size)
            url = bytesToDataUrl(bytes, "image/png")
          }
          out[def.id] = url
          onOne?.(def.id, url)
        } catch {
          // Skip any effect that fails to render a preview.
        }
        // Yield so the UI can paint each tile as it lands.
        await new Promise((r) => setTimeout(r, 0))
      }
    } catch {
      // WebGL unavailable — gallery will fall back to name-only tiles.
    } finally {
      engine?.dispose()
    }
    cache = out
    return out
  })()
  return inflight
}
