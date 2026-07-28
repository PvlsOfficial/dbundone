// VizLab templates + factories for the Three.js engine.

import { defaultParams, getLayerMeta } from "./layers"
import { defaultEffectParams } from "./three/postfx"
import type { EffectInstance, LayerType, ParamMod, PostFXType, Transform, VizLayer, VizScene } from "./types"

let counter = 0
export function uid(prefix = "l"): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}_${counter}`
}

export function identityTransform(): Transform {
  return { posX: 0, posY: 0, zoom: 1, rot: 0 }
}

const GLOWY: LayerType[] = ["sphere", "particles", "orbit", "radial", "wave", "bars", "stereoScope"]
export function defaultBlend(type: LayerType): VizLayer["blend"] {
  return GLOWY.includes(type) ? "add" : "normal"
}

export function makeLayer(type: LayerType, overrides: Partial<VizLayer> = {}): VizLayer {
  const meta = getLayerMeta(type)
  const { params: paramOverrides, transform, mod, ...rest } = overrides
  return {
    id: uid(type),
    type,
    name: meta.name,
    visible: true,
    opacity: 1,
    blend: defaultBlend(type),
    ...rest,
    params: { ...defaultParams(type), ...(paramOverrides || {}) },
    transform: transform ?? identityTransform(),
    mod: mod ?? {},
  }
}

export function makeEffect(type: PostFXType, params: Record<string, number | string | boolean> = {}, mod: Record<string, ParamMod> = {}): EffectInstance {
  return {
    id: uid(`fx_${type}`),
    type,
    enabled: true,
    params: { ...defaultEffectParams(type), ...params },
    mod,
  }
}

export const ASPECTS: { label: string; w: number; h: number }[] = [
  { label: "Wide 16:9", w: 1920, h: 1080 },
  { label: "Square 1:1", w: 1080, h: 1080 },
  { label: "Story 9:16", w: 1080, h: 1920 },
  { label: "Classic 4:3", w: 1440, h: 1080 },
]

export interface VizPreset {
  id: string
  name: string
  description: string
  build: (w: number, h: number) => VizScene
}

/** Bass-focused beat zoom, ready to drop on transform.zoom. */
function bassZoom(amount = 0.12): ParamMod {
  return { audio: { band: "custom", amount, focus: 0.04, width: 0.08 } }
}

export const PRESETS: VizPreset[] = [
  {
    id: "trap-nation",
    name: "Trap Nation",
    description: "Cover in a radial ring, bass-pumping zoom, heavy bloom.",
    build: (w, h) => ({
      width: w, height: h,
      layers: [
        makeLayer("background", { params: { style: "radial", color1: "#05010f", color2: "#1a0b3d", vignette: 0 } }),
        makeLayer("radial", { name: "Ring", params: { count: 150, radius: 0.26, length: 0.18, spin: 0.08, color1: "#c084fc", color2: "#22d3ee" }, mod: { zoom: bassZoom(0.08) } }),
        makeLayer("image", { name: "Cover", params: { fit: "cover", followCover: true, round: 0, scale: 0.42, beatZoom: 0.12, focus: 0.04 } }),
        makeLayer("text", { name: "Title", params: { text: "NOW PLAYING", size: 0.1, y: 0.9 } }),
      ],
      effects: [makeEffect("bloom", { intensity: 1.8, threshold: 0.05 }), makeEffect("chromatic", { amount: 0.6, reactive: 2 }), makeEffect("vignette", { darkness: 0.6 })],
    }),
  },
  {
    id: "ncs-sphere",
    name: "NCS Sphere",
    description: "Rotating audio-reactive sphere with strong bloom.",
    build: (w, h) => ({
      width: w, height: h,
      layers: [
        makeLayer("background", { params: { style: "radial", color1: "#020617", color2: "#0e2a4d" } }),
        makeLayer("sphere", { params: { detail: 4, radius: 0.55, displace: 0.55, spin: 0.25, color1: "#22d3ee", color2: "#7c3aed" } }),
        makeLayer("text", { name: "Title", params: { text: "TRACK TITLE", size: 0.09, y: 0.9 } }),
      ],
      effects: [makeEffect("bloom", { intensity: 2, threshold: 0.04 }), makeEffect("chromatic", { amount: 0.5, reactive: 1.5 })],
    }),
  },
  {
    id: "neon-bars",
    name: "Neon Bars",
    description: "Glowing spectrum bars with chromatic aberration.",
    build: (w, h) => ({
      width: w, height: h,
      layers: [
        makeLayer("background", { params: { style: "gradient", color1: "#05010f", color2: "#1a0b3d" } }),
        makeLayer("bars", { params: { count: 80, color1: "#c084fc", color2: "#22d3ee", height: 0.8 } }),
        makeLayer("text", { name: "Title", params: { text: "NOW PLAYING", size: 0.09, y: 0.92 } }),
      ],
      effects: [makeEffect("bloom", { intensity: 1.5, threshold: 0.1 }), makeEffect("chromatic", { amount: 1, reactive: 2 }), makeEffect("vignette", {})],
    }),
  },
  {
    id: "stereo-lab",
    name: "Stereo Lab",
    description: "Lissajous stereo scope + VU meter, analog feel.",
    build: (w, h) => ({
      width: w, height: h,
      layers: [
        makeLayer("background", { params: { style: "gradient", color1: "#0b1026", color2: "#1a1147", angle: 120 } }),
        makeLayer("stereoScope", { params: { mode: "lissajous", scale: 0.6, color1: "#22d3ee", color2: "#f472b6" } }),
        makeLayer("vuMeter", { name: "VU", params: { x: 0.5, y: 0.9, size: 0.22 } }),
      ],
      effects: [makeEffect("bloom", { intensity: 1.4 }), makeEffect("scanline", { opacity: 0.15 }), makeEffect("vignette", {})],
    }),
  },
]

export function blankScene(w = 1920, h = 1080): VizScene {
  return PRESETS[0].build(w, h)
}
