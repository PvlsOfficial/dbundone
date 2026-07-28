// Cover Lab document model — layers composited on a 2D canvas, then run through a
// WebGL2 effect chain. See CoverEngine.ts for how these are rendered.

export type BlendMode =
  | "source-over"
  | "multiply"
  | "screen"
  | "overlay"
  | "lighten"
  | "darken"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity"

export const BLEND_MODES: { label: string; value: BlendMode }[] = [
  { label: "Normal", value: "source-over" },
  { label: "Multiply", value: "multiply" },
  { label: "Screen", value: "screen" },
  { label: "Overlay", value: "overlay" },
  { label: "Lighten", value: "lighten" },
  { label: "Darken", value: "darken" },
  { label: "Color Dodge", value: "color-dodge" },
  { label: "Color Burn", value: "color-burn" },
  { label: "Hard Light", value: "hard-light" },
  { label: "Soft Light", value: "soft-light" },
  { label: "Difference", value: "difference" },
  { label: "Exclusion", value: "exclusion" },
  { label: "Hue", value: "hue" },
  { label: "Saturation", value: "saturation" },
  { label: "Color", value: "color" },
  { label: "Luminosity", value: "luminosity" },
]

export type LayerType = "image" | "text" | "solid" | "gradient"

export interface BaseLayer {
  id: string
  name: string
  type: LayerType
  visible: boolean
  opacity: number // 0..1
  blend: BlendMode
  // Transform — normalized: x/y are the layer center in 0..1 of the canvas,
  // scale is relative to a "fill" baseline, rotation in degrees.
  x: number
  y: number
  scale: number
  rotation: number
  /**
   * Per-layer effect chain. When present and non-empty, this layer is rendered to
   * its own texture, run through these effects, then composited (with its blend &
   * opacity) onto the canvas — so an effect can target one layer instead of the
   * whole cover. Effects are clipped to the layer's shape (its alpha coverage).
   */
  effects?: EffectInstance[]
  /**
   * Per-property animation envelopes, keyed by property name (x, y, scale,
   * rotation, opacity, and type-specific keys like size, angle, color). Each
   * envelope modulates that property over the loop so it can pulse/drift and
   * still loop seamlessly. Colour keys cycle hue; numeric keys swing within
   * their range.
   */
  anim?: Record<string, ParamAnim>
}

export interface ImageLayer extends BaseLayer {
  type: "image"
  /** data: URL or a tauri asset URL */
  src: string
  fit: "cover" | "contain" | "stretch"
  /** Playback rate for animated GIFs (1 = the GIF's own intended speed). */
  gifSpeed?: number
}

export interface TextLayer extends BaseLayer {
  type: "text"
  text: string
  font: string
  weight: number
  /** size as a fraction of canvas height */
  size: number
  color: string
  align: "left" | "center" | "right"
  letterSpacing: number
}

export interface SolidLayer extends BaseLayer {
  type: "solid"
  color: string
}

export interface GradientLayer extends BaseLayer {
  type: "gradient"
  from: string
  to: string
  angle: number // degrees
}

export type Layer = ImageLayer | TextLayer | SolidLayer | GradientLayer

// ── Effects ──────────────────────────────────────────────────────────────────

export type ParamSpec =
  | { key: string; label: string; type: "range"; min: number; max: number; step: number; default: number }
  | { key: string; label: string; type: "color"; default: string }
  | { key: string; label: string; type: "bool"; default: boolean }
  | { key: string; label: string; type: "select"; options: { label: string; value: number }[]; default: number }

export interface EffectDef {
  id: string
  name: string
  category: string
  /** GLSL ES 3.00 fragment body. See effects.ts for the injected prelude/uniforms. */
  frag: string
  params: ParamSpec[]
  /** True if the effect animates over u_time (relevant for GIF export). */
  animatable: boolean
  /**
   * True if the effect reads the painted motion mask (maskAt). Such effects get a
   * per-instance "Paint Mask" control so each one can be confined to its own
   * region; when an instance has no mask of its own it falls back to the doc mask.
   */
  usesMask?: boolean
}

export type ParamValue = number | string | boolean

/**
 * Per-param animation envelope. The param's base value is modulated over the loop
 * so an effect can pulse / breathe and still loop seamlessly (the modulation is a
 * pure function of the looping phase). Only meaningful for numeric (range) params.
 */
export interface ParamAnim {
  /** Modulation depth, as a fraction of the param's full range (0..1). */
  depth: number
  /** Whole cycles completed over one loop (kept integer so the loop is seamless). */
  cycles: number
  /**
   * Waveform used to modulate the value. The first five oscillate back and forth
   * around the base value. "spin" instead advances continuously in one direction —
   * a full 360° revolution per cycle for rotation / gradient angle, and a full
   * trip around the colour wheel for colour properties — so a spinning layer keeps
   * turning the same way (and a colour cycles through every hue) instead of
   * rocking between two extremes. (`depth` is ignored for those circular cases.)
   */
  shape: "sine" | "triangle" | "pulse" | "rampUp" | "rampDown" | "spin"
}

export interface EffectInstance {
  id: string // instance id
  effectId: string // registry id or "custom"
  enabled: boolean
  params: Record<string, ParamValue>
  /** Optional per-param animation envelopes (keyed by ParamSpec.key). */
  anim?: Record<string, ParamAnim>
  /** For the custom-GLSL effect: the user-editable fragment body. */
  customFrag?: string
  /**
   * Optional per-instance painted motion mask: PNG data URL with white strokes on
   * a transparent background. For mask-aware effects (Live Motion, Blob Tracker)
   * this confines the effect to the painted region for THIS instance only —
   * letting several stacked instances each move a different area. When absent the
   * effect falls back to the doc-level motionMask.
   */
  mask?: string
}

export interface AnimationSettings {
  fps: number
  durationSec: number
}

export interface CoverDoc {
  width: number
  height: number
  background: string
  /** Bottom layer first. */
  layers: Layer[]
  /** Applied in order (first = closest to the source). */
  effects: EffectInstance[]
  animation: AnimationSettings
  /**
   * User-painted motion mask: PNG data URL with white strokes on a transparent
   * background. Motion effects (Live Motion, Blob Tracker, custom via maskAt)
   * only move painted areas; absent = the whole image moves.
   */
  motionMask?: string
}
