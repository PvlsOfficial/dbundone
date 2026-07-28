// Global post-processing effects for the Three.js engine. Each PostFXDef knows
// its inspector knobs, how to instantiate the postprocessing Effect, and how to
// push (modulated) parameters into it every frame.

import * as THREE from "three"
import {
  BloomEffect, ChromaticAberrationEffect, Effect, NoiseEffect, PixelationEffect,
  ScanlineEffect, VignetteEffect, BlendFunction,
} from "postprocessing"
import type { AudioFrame, ParamSpec, PostFXType, Resolver } from "../types"

export interface PostFXDef {
  type: PostFXType
  name: string
  params: ParamSpec[]
  create(): Effect
  update(effect: Effect, P: Resolver, frame: AudioFrame): void
}

const bloom: PostFXDef = {
  type: "bloom",
  name: "Bloom / Glow",
  params: [
    { key: "intensity", label: "Intensity", type: "range", min: 0, max: 5, step: 0.05, default: 1.6 },
    { key: "threshold", label: "Threshold", type: "range", min: 0, max: 1, step: 0.01, default: 0.08 },
    { key: "radius", label: "Radius", type: "range", min: 0, max: 1, step: 0.01, default: 0.7 },
  ],
  create: () => new BloomEffect({ intensity: 1.6, luminanceThreshold: 0.08, luminanceSmoothing: 0.2, mipmapBlur: true, radius: 0.7 }),
  update: (e, P) => {
    const b = e as BloomEffect
    b.intensity = P.n("intensity")
    b.luminanceMaterial.threshold = P.n("threshold")
    ;(b.mipmapBlurPass as unknown as { radius: number }).radius = P.n("radius")
  },
}

const chromatic: PostFXDef = {
  type: "chromatic",
  name: "Chromatic Aberration",
  params: [
    { key: "amount", label: "Amount", type: "range", min: 0, max: 8, step: 0.05, default: 1 },
    { key: "reactive", label: "Beat react", type: "range", min: 0, max: 8, step: 0.05, default: 1.5 },
  ],
  create: () => new ChromaticAberrationEffect({ offset: new THREE.Vector2(0, 0), radialModulation: false, modulationOffset: 0 }),
  update: (e, P, frame) => {
    const c = e as ChromaticAberrationEffect
    const a = (P.n("amount") + P.n("reactive") * frame.level) * 0.001
    ;(c.offset as THREE.Vector2).set(a, a * 0.6)
  },
}

const noise: PostFXDef = {
  type: "noise",
  name: "Film Noise",
  params: [{ key: "amount", label: "Amount", type: "range", min: 0, max: 1, step: 0.01, default: 0.25 }],
  create: () => new NoiseEffect({ blendFunction: BlendFunction.SCREEN, premultiply: true }),
  update: (e, P) => { e.blendMode.opacity.value = P.n("amount") },
}

const vignette: PostFXDef = {
  type: "vignette",
  name: "Vignette",
  params: [
    { key: "darkness", label: "Darkness", type: "range", min: 0, max: 1.5, step: 0.01, default: 0.7 },
    { key: "offset", label: "Offset", type: "range", min: 0, max: 1, step: 0.01, default: 0.35 },
  ],
  create: () => new VignetteEffect({ darkness: 0.7, offset: 0.35 }),
  update: (e, P) => {
    const v = e as VignetteEffect
    v.darkness = P.n("darkness")
    v.offset = P.n("offset")
  },
}

const scanline: PostFXDef = {
  type: "scanline",
  name: "Scanlines",
  params: [
    { key: "density", label: "Density", type: "range", min: 0, max: 4, step: 0.05, default: 1.2 },
    { key: "opacity", label: "Opacity", type: "range", min: 0, max: 1, step: 0.01, default: 0.3 },
  ],
  create: () => new ScanlineEffect({ density: 1.2 }),
  update: (e, P) => {
    const s = e as ScanlineEffect
    s.density = P.n("density")
    s.blendMode.opacity.value = P.n("opacity")
  },
}

const pixelate: PostFXDef = {
  type: "pixelate",
  name: "Pixelate",
  params: [{ key: "granularity", label: "Granularity", type: "range", min: 0, max: 60, step: 1, default: 0 }],
  create: () => new PixelationEffect(0),
  update: (e, P) => { (e as PixelationEffect).granularity = P.n("granularity") },
}

export const POSTFX_DEFS: Record<PostFXType, PostFXDef> = {
  bloom, chromatic, noise, vignette, scanline, pixelate,
}

export function getPostFXDef(type: PostFXType): PostFXDef {
  return POSTFX_DEFS[type]
}

export function defaultEffectParams(type: PostFXType): Record<string, number | string | boolean> {
  const out: Record<string, number | string | boolean> = {}
  for (const p of POSTFX_DEFS[type].params) out[p.key] = p.default
  return out
}

export function effectParamRanges(type: PostFXType): Record<string, { min: number; max: number }> {
  const out: Record<string, { min: number; max: number }> = {}
  for (const p of POSTFX_DEFS[type].params) if (p.type === "range") out[p.key] = { min: p.min, max: p.max }
  return out
}

export const ADDABLE_EFFECTS: { type: PostFXType; name: string }[] =
  (Object.keys(POSTFX_DEFS) as PostFXType[]).map((type) => ({ type, name: POSTFX_DEFS[type].name }))
