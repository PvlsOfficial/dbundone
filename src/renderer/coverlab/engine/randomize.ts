// Build a tasteful-but-random effect stack for the "Randomize" button.
//
// We don't just pick any effects at any params — that mostly produces mud. Instead
// we draw from curated category buckets (a look + grade + finish), pick params
// within sane sub-ranges, and occasionally animate one param so the result moves.

import { EFFECTS } from "./effects"
import { makeEffect, defaultParams } from "./doc"
import { EffectDef, EffectInstance, ParamAnim } from "./types"

const byId = (id: string): EffectDef | undefined => EFFECTS.find((e) => e.id === id)

// Buckets, drawn roughly in render order: motion/distort → texture/retro → grade → finish.
const BUCKETS: string[][] = [
  ["warp", "twirl", "wave", "ripple", "kaleidoscope", "livemotion", "spin", "bulge", "datamosh", "jelly"],
  ["vhs", "scanlines", "crtmonitor", "halftone", "glitch", "badtv", "crystallize", "pixelate", "hologram", "matrixrain", "dither8", "onebit", "bluenoise", "ascii", "riso", "palettedither", "kuwahara", "ledpanel", "topo", "comic", "hexmosaic"],
  ["duotone", "gradientmap", "colorgrade", "thermal", "posterize", "sepia", "temperature", "neonbleed"],
  ["bloom", "fog", "lightleak", "vignette", "grain", "chromatic", "rgbshift", "neonedge", "circuit"],
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** A value biased toward the upper-middle of a range (looks more deliberate). */
function randInRange(min: number, max: number, step: number): number {
  // Bias: average two uniforms → centre-weighted, then nudge up a touch.
  const t = (Math.random() + Math.random()) / 2
  const raw = min + t * (max - min)
  const snapped = Math.round(raw / step) * step
  return Math.min(max, Math.max(min, snapped))
}

function randomParams(def: EffectDef): Record<string, number | string | boolean> {
  const out = { ...defaultParams(def.id) }
  for (const p of def.params) {
    if (p.type === "range") out[p.key] = randInRange(p.min, p.max, p.step)
    else if (p.type === "bool") out[p.key] = Math.random() < 0.5
    else if (p.type === "select") out[p.key] = pick(p.options).value
    // colors keep their defaults — random colors mostly look wrong
  }
  return out
}

const SHAPES: ParamAnim["shape"][] = ["sine", "triangle", "pulse"]

/** Pick one animatable range param and give it a gentle envelope. */
function maybeAnimate(def: EffectDef): Record<string, ParamAnim> | undefined {
  if (!def.animatable || Math.random() < 0.5) return undefined
  const ranges = def.params.filter((p) => p.type === "range")
  if (ranges.length === 0) return undefined
  const target = pick(ranges)
  return {
    [target.key]: { depth: 0.3 + Math.random() * 0.4, cycles: 1 + Math.floor(Math.random() * 3), shape: pick(SHAPES) },
  }
}

/** Returns 2–4 randomized, ordered effect instances. */
export function randomEffects(): EffectInstance[] {
  const count = 2 + Math.floor(Math.random() * 3) // 2..4
  const buckets = [...BUCKETS].sort(() => Math.random() - 0.5).slice(0, count)
  // Keep bucket order stable so grades land after distorts and finishes land last.
  buckets.sort((a, b) => BUCKETS.indexOf(a) - BUCKETS.indexOf(b))
  const out: EffectInstance[] = []
  for (const bucket of buckets) {
    const def = byId(pick(bucket))
    if (!def) continue
    const inst = makeEffect(def.id)
    inst.params = randomParams(def)
    const anim = maybeAnimate(def)
    if (anim) inst.anim = anim
    out.push(inst)
  }
  return out
}
