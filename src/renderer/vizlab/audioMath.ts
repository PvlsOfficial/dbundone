// Audio math shared by layers and the modulation system: frequency-weighted
// sampling (so reactivity can focus on the kick/bass vs highs), spectrum binning
// for bars, LFO evaluation and the parameter-modulation resolver.

import type { AudioBand, AudioFrame, LFOShape, ParamMod, ParamValue, Resolver, VizLayer } from "./types"

/**
 * Weighted energy of the spectrum around a normalized focus point.
 *  focus 0 → lows (kick/bass), 1 → highs. `width` is the half-window (0..1).
 * Uses a raised-cosine window so the response is smooth, not boxy.
 */
export function weightedBand(freq: Uint8Array, focus: number, width: number): number {
  const usable = Math.floor(freq.length * 0.85)
  const center = clamp01(focus) * usable
  const half = Math.max(1, width * usable)
  let sum = 0
  let wsum = 0
  const a = Math.max(0, Math.floor(center - half))
  const b = Math.min(usable, Math.ceil(center + half))
  for (let i = a; i < b; i++) {
    const d = (i - center) / half // -1..1
    const w = 0.5 + 0.5 * Math.cos(d * Math.PI) // raised cosine
    sum += freq[i] * w
    wsum += w
  }
  return wsum > 0 ? sum / wsum / 255 : 0
}

/** The named band value for the current frame (custom uses focus/width). */
export function bandValue(frame: AudioFrame, band: AudioBand, focus = 0, width = 0.1): number {
  switch (band) {
    case "bass": return frame.bass
    case "mid": return frame.mid
    case "treble": return frame.treble
    case "custom": return weightedBand(frame.freq, focus, width)
    case "level":
    default: return frame.level
  }
}

/**
 * Bin the spectrum into `count` buckets for bars. `focus`/`spread` reshape which
 * part of the spectrum is emphasized; `tilt` lifts the highs (which are quieter);
 * `curve` is a perceptual exponent for bucket spacing.
 */
export function sampleSpectrum(
  freq: Uint8Array,
  count: number,
  opts: { focus?: number; spread?: number; tilt?: number; curve?: number } = {},
): number[] {
  const focus = clamp01(opts.focus ?? 0.35)
  const spread = clamp01(opts.spread ?? 1)
  const tilt = opts.tilt ?? 0.5
  const curve = opts.curve ?? 1.6
  const usable = Math.floor(freq.length * 0.8)
  const out: number[] = new Array(count)
  for (let i = 0; i < count; i++) {
    // Map bar index → a normalized spectrum position, centred on `focus` and
    // scaled by `spread` so you can zoom into a frequency region.
    const u = i / Math.max(1, count - 1)
    const centred = (u - 0.5) * spread + focus
    const t = Math.pow(clamp01(centred), curve)
    const t1 = Math.pow(clamp01(centred + spread / count), curve)
    const a = Math.floor(t * usable)
    const b = Math.max(a + 1, Math.floor(t1 * usable))
    let sum = 0
    for (let j = a; j < b; j++) sum += freq[j]
    let v = sum / (b - a) / 255
    // Tilt: boost highs by their normalized position so the top end isn't tiny.
    v *= 1 + tilt * u * 1.5
    out[i] = Math.min(1, v)
  }
  return out
}

/**
 * Sample the spectrum the way a real EQ / analyzer looks: log-spaced frequency
 * bands (lows left, highs right) with a gentle high-frequency slope so the top
 * end stays visible. Returns `count` values in 0..1. No focus/spread/tilt knobs —
 * it just maps the audible range musically.
 */
export function sampleEQ(freq: Uint8Array, count: number): number[] {
  const n = freq.length
  // Skip bin 0/1 (DC + sub-rumble) and start ~40 Hz so the low end isn't a wall
  // of identical bars or a single blown-out bin.
  const minBin = 2
  const maxBin = Math.floor(n * 0.72) // ~16 kHz at a 44.1 kHz sample rate
  const ratio = maxBin / minBin
  const out: number[] = new Array(count)
  for (let i = 0; i < count; i++) {
    const a = minBin * Math.pow(ratio, i / count)
    const b = minBin * Math.pow(ratio, (i + 1) / count)
    // Low frequencies span less than one FFT bin per bar, so flooring would make
    // several bars share the same bin (blocky/duplicate). Read a LINEARLY
    // INTERPOLATED value at the band's geometric centre instead → smooth lows.
    const center = Math.sqrt(a * b)
    const c0 = Math.min(n - 1, Math.floor(center))
    const cf = center - Math.floor(center)
    const s0 = freq[c0]
    const s1 = freq[Math.min(n - 1, c0 + 1)]
    let v = s0 * (1 - cf) + s1 * cf
    // For wide (high-frequency) bands, lift toward the band peak so a sparse band
    // with one strong bin still registers.
    const lo = Math.floor(a)
    const hi = Math.min(n, Math.ceil(b))
    if (hi - lo > 2) {
      let peak = 0
      for (let j = lo; j < hi; j++) if (freq[j] > peak) peak = freq[j]
      v = v * 0.5 + peak * 0.5
    }
    v /= 255
    // Gentle analyzer slope (highs carry less energy in music).
    v *= 1 + (i / count) * 0.8
    // Not clamped — the caller applies sensitivity + soft saturation.
    out[i] = v
  }
  return out
}

/** Evaluate an LFO at time t → signal in roughly -1..1 (0..1 for saw/square ramps). */
export function evalLFO(shape: LFOShape, rate: number, time: number, phase = 0): number {
  const p = (time * rate + phase) % 1
  const x = p < 0 ? p + 1 : p
  switch (shape) {
    case "triangle": return (1 - Math.abs(x * 2 - 1)) * 2 - 1 // -1..1 triangle
    case "saw": return x * 2 - 1
    case "square": return x < 0.5 ? 1 : -1
    case "noise": return valueNoise(time * rate + phase) * 2 - 1
    case "sine":
    default: return Math.sin(x * Math.PI * 2)
  }
}

/** Smooth 1-D value noise in 0..1, used for LFOs and warp displacement. */
export function valueNoise(x: number): number {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  return lerp(hash01(i), hash01(i + 1), u)
}

/**
 * Resolve a single numeric parameter for this frame: base + LFO swing + audio
 * reactivity, clamped to [min,max] when provided.
 */
export function resolveNumber(
  base: number,
  mod: ParamMod | undefined,
  frame: AudioFrame,
  range?: { min: number; max: number },
): number {
  let v = base
  if (mod?.lfo) {
    v += evalLFO(mod.lfo.shape, mod.lfo.rate, frame.time, mod.lfo.phase) * mod.lfo.depth
  }
  if (mod?.audio) {
    v += bandValue(frame, mod.audio.band, mod.audio.focus ?? 0, mod.audio.width ?? 0.1) * mod.audio.amount
  }
  if (range) v = Math.min(range.max, Math.max(range.min, v))
  return v
}

/**
 * Build a Resolver for a layer's params for this frame. `ranges` maps param keys
 * to their min/max so modulated values stay in bounds.
 */
export function makeResolver(
  params: Record<string, ParamValue>,
  mod: Record<string, ParamMod> | undefined,
  frame: AudioFrame,
  ranges: Record<string, { min: number; max: number }> = {},
): Resolver {
  return {
    n: (key, fb = 0) => {
      const raw = params[key]
      const base = typeof raw === "number" ? raw : fb
      return resolveNumber(base, mod?.[key], frame, ranges[key])
    },
    s: (key, fb = "") => {
      const raw = params[key]
      return typeof raw === "string" ? raw : fb
    },
    b: (key, fb = false) => {
      const raw = params[key]
      return typeof raw === "boolean" ? raw : fb
    },
  }
}

export function hasMod(mod?: ParamMod): boolean {
  return !!(mod && (mod.lfo || mod.audio))
}

// ── helpers ────────────────────────────────────────────────────────────────
export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
function hash01(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

// Convenience for layers that want a raw param ignoring modulation.
export function getMod(layer: VizLayer, key: string): ParamMod | undefined {
  return layer.mod?.[key]
}
