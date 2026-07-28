// VizLab — type definitions for the Three.js audio visualizer.
//
// A VizScene is an ordered stack of layers rendered as Three.js objects in one
// scene (a perspective camera unifies 2D-style planes and the 3D sphere), plus a
// global post-processing effect stack (bloom, chromatic aberration, glitch …).
// Every numeric knob can be modulated by an LFO and/or the live audio.

export type LayerType =
  | "background"
  | "image"
  | "bars"
  | "wave"
  | "radial"
  | "particles"
  | "text"
  | "stereoScope"
  | "vuMeter"
  | "orbit"
  | "sphere"

/** Global post-processing effects applied to the whole composited scene. */
export type PostFXType = "bloom" | "chromatic" | "noise" | "vignette" | "scanline" | "pixelate"

/** A single tunable knob exposed in the inspector. */
export type ParamSpec =
  | { key: string; label: string; type: "range"; min: number; max: number; step?: number; default: number; unit?: string }
  | { key: string; label: string; type: "color"; default: string }
  | { key: string; label: string; type: "bool"; default: boolean }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; default: string }
  | { key: string; label: string; type: "text"; default: string }

export type ParamValue = number | string | boolean

export type LFOShape = "sine" | "triangle" | "saw" | "square" | "noise"
export type AudioBand = "level" | "bass" | "mid" | "treble" | "custom"

/** Optional per-parameter modulation: an LFO swing and/or audio reactivity. */
export interface ParamMod {
  lfo?: { shape: LFOShape; rate: number; depth: number; phase?: number }
  audio?: { band: AudioBand; amount: number; focus?: number; width?: number }
}

/** Position/scale/rotation applied to a layer object (planes & 3D alike). */
export interface Transform {
  posX: number
  posY: number
  zoom: number
  rot: number
}

/** A global post effect instance in the scene's FX chain. */
export interface EffectInstance {
  id: string
  type: PostFXType
  enabled: boolean
  params: Record<string, ParamValue>
  mod?: Record<string, ParamMod>
}

export interface VizLayer {
  id: string
  type: LayerType
  name: string
  visible: boolean
  opacity: number
  blend: "normal" | "add" | "screen" | "multiply"
  params: Record<string, ParamValue>
  mod?: Record<string, ParamMod>
  transform?: Transform
  /** For image/orbit layers: a loadable URL (data:) for the picture. */
  src?: string
}

export interface VizScene {
  width: number
  height: number
  layers: VizLayer[]
  /** Global post-processing chain, applied after compositing all layers. */
  effects: EffectInstance[]
}

/** Per-frame audio snapshot. Band values are normalized 0..1 and smoothed. */
export interface AudioFrame {
  freq: Uint8Array
  wave: Uint8Array
  waveL: Uint8Array
  waveR: Uint8Array
  freqL: Uint8Array
  freqR: Uint8Array
  level: number
  bass: number
  mid: number
  treble: number
  rmsL: number
  rmsR: number
  time: number
}

/** Resolves a layer/effect's parameters for the current frame (applies modulation). */
export interface Resolver {
  n: (key: string, fallback?: number) => number
  s: (key: string, fallback?: string) => string
  b: (key: string, fallback?: boolean) => boolean
}

/** Static metadata for a layer kind: its display name and inspector knobs. */
export interface LayerMeta {
  type: LayerType
  name: string
  params: ParamSpec[]
}

/** Static metadata for a post effect kind. */
export interface PostFXMeta {
  type: PostFXType
  name: string
  params: ParamSpec[]
}
