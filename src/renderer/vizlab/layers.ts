// Layer metadata — the inspector knobs each layer type exposes. Drawing happens
// in the Three.js layer objects (./three/layerObjects.ts); this file is just the
// static description used by the UI and the parameter resolver.

import type { LayerMeta, LayerType, ParamSpec } from "./types"

const background: LayerMeta = {
  type: "background",
  name: "Background",
  params: [
    { key: "style", label: "Style", type: "select", default: "gradient", options: [
      { value: "solid", label: "Solid" }, { value: "gradient", label: "Linear" }, { value: "radial", label: "Radial glow" },
    ] },
    { key: "color1", label: "Color A", type: "color", default: "#0a0a16" },
    { key: "color2", label: "Color B", type: "color", default: "#1e1b4b" },
    { key: "angle", label: "Angle", type: "range", min: 0, max: 360, default: 135, unit: "°" },
    { key: "pulse", label: "Beat pulse", type: "range", min: 0, max: 1, step: 0.01, default: 0.25 },
    { key: "vignette", label: "Vignette", type: "range", min: 0, max: 1, step: 0.01, default: 0.25 },
  ],
}

const bars: LayerMeta = {
  type: "bars",
  name: "Spectrum (EQ)",
  params: [
    { key: "shape", label: "Shape", type: "select", default: "bars", options: [
      { value: "bars", label: "Bars" }, { value: "line", label: "Line" }, { value: "area", label: "Filled area" },
    ] },
    { key: "count", label: "Resolution", type: "range", min: 8, max: 256, step: 1, default: 96 },
    { key: "sensitivity", label: "Sensitivity", type: "range", min: 0.2, max: 5, step: 0.05, default: 1.3 },
    { key: "height", label: "Height", type: "range", min: 0.1, max: 1.8, step: 0.01, default: 0.85 },
    { key: "smooth", label: "Smoothing", type: "range", min: 0, max: 0.95, step: 0.01, default: 0.5 },
    { key: "gap", label: "Bar gap", type: "range", min: 0, max: 0.9, step: 0.01, default: 0.22 },
    { key: "thickness", label: "Line thickness", type: "range", min: 1, max: 16, step: 0.5, default: 3 },
    { key: "baseline", label: "Baseline", type: "range", min: 0, max: 1, step: 0.01, default: 0.92 },
    { key: "mirror", label: "Mirror", type: "select", default: "none", options: [
      { value: "none", label: "None" }, { value: "updown", label: "Up / down" }, { value: "center", label: "From center" },
    ] },
    { key: "peaks", label: "Peak caps (bars)", type: "bool", default: false },
    { key: "color1", label: "Color top", type: "color", default: "#a855f7" },
    { key: "color2", label: "Color bottom", type: "color", default: "#22d3ee" },
  ],
}

const wave: LayerMeta = {
  type: "wave",
  name: "Waveform",
  params: [
    { key: "mode", label: "Mode", type: "select", default: "mirror", options: [
      { value: "line", label: "Oscilloscope" }, { value: "mirror", label: "Mirror" },
    ] },
    { key: "thickness", label: "Thickness", type: "range", min: 1, max: 16, step: 0.5, default: 3 },
    { key: "amp", label: "Amplitude", type: "range", min: 0.05, max: 1, step: 0.01, default: 0.4 },
    { key: "y", label: "Position", type: "range", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "color", label: "Color", type: "color", default: "#f472b6" },
  ],
}

const radial: LayerMeta = {
  type: "radial",
  name: "Radial Spectrum",
  params: [
    { key: "count", label: "Spokes", type: "range", min: 16, max: 220, step: 1, default: 96 },
    { key: "radius", label: "Inner radius", type: "range", min: 0.05, max: 0.45, step: 0.01, default: 0.18 },
    { key: "length", label: "Length", type: "range", min: 0.05, max: 0.6, step: 0.01, default: 0.22 },
    { key: "thickness", label: "Thickness", type: "range", min: 1, max: 16, step: 0.5, default: 3 },
    { key: "spin", label: "Spin speed", type: "range", min: -3, max: 3, step: 0.05, default: 0.15 },
    { key: "focus", label: "Freq focus", type: "range", min: 0, max: 1, step: 0.01, default: 0.3 },
    { key: "spread", label: "Freq spread", type: "range", min: 0.2, max: 1, step: 0.01, default: 1 },
    { key: "color1", label: "Color inner", type: "color", default: "#22d3ee" },
    { key: "color2", label: "Color outer", type: "color", default: "#a855f7" },
    { key: "mirror", label: "Mirror", type: "bool", default: true },
  ],
}

const particles: LayerMeta = {
  type: "particles",
  name: "Particles",
  params: [
    { key: "count", label: "Count", type: "range", min: 10, max: 2000, step: 10, default: 300 },
    { key: "size", label: "Size", type: "range", min: 0.5, max: 16, step: 0.5, default: 3 },
    { key: "speed", label: "Drift speed", type: "range", min: 0, max: 3, step: 0.05, default: 0.4 },
    { key: "direction", label: "Direction", type: "select", default: "up", options: [
      { value: "up", label: "Up" }, { value: "down", label: "Down" }, { value: "out", label: "Outward" },
    ] },
    { key: "react", label: "Beat burst", type: "range", min: 0, max: 1.5, step: 0.01, default: 0.6 },
    { key: "twinkle", label: "Twinkle", type: "range", min: 0, max: 1, step: 0.01, default: 0.4 },
    { key: "color", label: "Color", type: "color", default: "#ffffff" },
  ],
}

const image: LayerMeta = {
  type: "image",
  name: "Image / Cover",
  params: [
    { key: "fit", label: "Fit", type: "select", default: "cover", options: [
      { value: "cover", label: "Cover" }, { value: "contain", label: "Contain" },
    ] },
    { key: "followCover", label: "Follow track cover", type: "bool", default: false },
    { key: "scale", label: "Scale", type: "range", min: 0.1, max: 2, step: 0.01, default: 0.5 },
    { key: "round", label: "Corner round", type: "range", min: 0, max: 0.5, step: 0.01, default: 0 },
    { key: "beatZoom", label: "Beat zoom", type: "range", min: 0, max: 0.4, step: 0.01, default: 0.06 },
    { key: "focus", label: "Zoom freq focus", type: "range", min: 0, max: 1, step: 0.01, default: 0.05 },
    { key: "spin", label: "Spin", type: "range", min: -2, max: 2, step: 0.02, default: 0 },
  ],
}

const text: LayerMeta = {
  type: "text",
  name: "Text",
  params: [
    { key: "text", label: "Text", type: "text", default: "TRACK TITLE" },
    { key: "size", label: "Size", type: "range", min: 0.02, max: 0.4, step: 0.005, default: 0.12 },
    { key: "x", label: "X", type: "range", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "y", label: "Y", type: "range", min: 0, max: 1, step: 0.01, default: 0.82 },
    { key: "weight", label: "Weight", type: "range", min: 100, max: 900, step: 100, default: 800 },
    { key: "align", label: "Align", type: "select", default: "center", options: [
      { value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" },
    ] },
    { key: "color", label: "Color", type: "color", default: "#ffffff" },
    { key: "beatScale", label: "Beat scale", type: "range", min: 0, max: 0.3, step: 0.01, default: 0.05 },
  ],
}

const stereoScope: LayerMeta = {
  type: "stereoScope",
  name: "Stereo Scope",
  params: [
    { key: "mode", label: "Mode", type: "select", default: "lissajous", options: [
      { value: "lissajous", label: "Lissajous" }, { value: "dual", label: "Dual wave" },
    ] },
    { key: "scale", label: "Scale", type: "range", min: 0.1, max: 1, step: 0.01, default: 0.6 },
    { key: "thickness", label: "Thickness", type: "range", min: 0.5, max: 8, step: 0.5, default: 1.5 },
    { key: "color1", label: "Color L", type: "color", default: "#22d3ee" },
    { key: "color2", label: "Color R", type: "color", default: "#f472b6" },
  ],
}

const vuMeter: LayerMeta = {
  type: "vuMeter",
  name: "VU Meter",
  params: [
    { key: "x", label: "X", type: "range", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "y", label: "Y", type: "range", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "size", label: "Size", type: "range", min: 0.1, max: 1, step: 0.01, default: 0.5 },
    { key: "segments", label: "Segments", type: "range", min: 6, max: 40, step: 1, default: 20 },
    { key: "low", label: "Color low", type: "color", default: "#22c55e" },
    { key: "high", label: "Color peak", type: "color", default: "#ef4444" },
  ],
}

const orbit: LayerMeta = {
  type: "orbit",
  name: "Orbit Light",
  params: [
    { key: "count", label: "Objects", type: "range", min: 1, max: 12, step: 1, default: 1 },
    { key: "radius", label: "Orbit radius", type: "range", min: 0.05, max: 0.5, step: 0.01, default: 0.28 },
    { key: "speed", label: "Speed", type: "range", min: -3, max: 3, step: 0.05, default: 0.6 },
    { key: "size", label: "Object size", type: "range", min: 0.01, max: 0.3, step: 0.005, default: 0.06 },
    { key: "beatRadius", label: "Beat radius", type: "range", min: 0, max: 0.3, step: 0.01, default: 0.06 },
    { key: "color", label: "Color", type: "color", default: "#ffffff" },
  ],
}

const sphere: LayerMeta = {
  type: "sphere",
  name: "Sphere",
  params: [
    { key: "detail", label: "Density", type: "range", min: 1, max: 6, step: 1, default: 4 },
    { key: "radius", label: "Radius", type: "range", min: 0.2, max: 1, step: 0.01, default: 0.55 },
    { key: "displace", label: "Audio displace", type: "range", min: 0, max: 1.2, step: 0.01, default: 0.5 },
    { key: "noiseScale", label: "Noise scale", type: "range", min: 0.3, max: 6, step: 0.05, default: 1.8 },
    { key: "spin", label: "Spin", type: "range", min: -2, max: 2, step: 0.02, default: 0.25 },
    { key: "dot", label: "Dot size", type: "range", min: 1, max: 20, step: 0.5, default: 6 },
    { key: "wire", label: "Wireframe", type: "bool", default: false },
    { key: "color1", label: "Color near", type: "color", default: "#22d3ee" },
    { key: "color2", label: "Color far", type: "color", default: "#7c3aed" },
  ],
}

export const LAYER_META: Record<LayerType, LayerMeta> = {
  background, image, bars, wave, radial, particles, text, stereoScope, vuMeter, orbit, sphere,
}

export function getLayerMeta(type: LayerType): LayerMeta {
  return LAYER_META[type]
}

export function defaultParams(type: LayerType): Record<string, number | string | boolean> {
  const out: Record<string, number | string | boolean> = {}
  for (const p of LAYER_META[type].params) out[p.key] = p.default
  return out
}

const rangeCache = new Map<LayerType, Record<string, { min: number; max: number }>>()
export function layerParamRanges(type: LayerType): Record<string, { min: number; max: number }> {
  let cached = rangeCache.get(type)
  if (!cached) {
    cached = {}
    for (const p of LAYER_META[type].params) if (p.type === "range") cached[p.key] = { min: p.min, max: p.max }
    rangeCache.set(type, cached)
  }
  return cached
}

export const ADDABLE_LAYERS: { type: LayerType; name: string }[] = (
  ["sphere", "bars", "wave", "radial", "stereoScope", "vuMeter", "orbit", "particles", "image", "text", "background"] as LayerType[]
).map((type) => ({ type, name: LAYER_META[type].name }))

export type { ParamSpec }
