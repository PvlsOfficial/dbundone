// Composites Cover Lab layers onto a 2D canvas. The result becomes the source
// texture for the WebGL effect chain. Keeping composition in 2D makes text,
// gradients, blend modes, transforms and animated GIFs trivial; the GPU only
// does the FX.

import { parseGIF, decompressFrames } from "gifuct-js"
import { CoverDoc, GradientLayer, ImageLayer, Layer, ParamAnim, SolidLayer, TextLayer } from "./types"

export type LoadedAsset =
  | { kind: "image"; img: HTMLImageElement; width: number; height: number }
  | {
      kind: "gif"
      frames: HTMLCanvasElement[]
      /** Cumulative end-time (ms) of each frame. */
      cumulative: number[]
      totalMs: number
      width: number
      height: number
    }

export type AssetCache = Map<string, LoadedAsset>

function isGifSrc(src: string): boolean {
  return src.startsWith("data:image/gif") || /\.gif($|\?)/i.test(src)
}

/**
 * Turn an image source into raw bytes. Data URLs are decoded directly (Tauri's
 * webview CSP can block `fetch()` of data: URLs, which silently broke GIF import);
 * everything else is fetched normally.
 */
async function srcToArrayBuffer(src: string): Promise<ArrayBuffer> {
  if (src.startsWith("data:")) {
    const comma = src.indexOf(",")
    const header = src.slice(5, comma)
    const payload = src.slice(comma + 1)
    if (header.includes("base64")) {
      const bin = atob(payload)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return bytes.buffer
    }
    const text = decodeURIComponent(payload)
    const bytes = new Uint8Array(text.length)
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i)
    return bytes.buffer
  }
  return (await fetch(src)).arrayBuffer()
}

async function decodeGif(src: string): Promise<LoadedAsset | null> {
  try {
    const buf = await srcToArrayBuffer(src)
    const gif = parseGIF(buf)
    const frames = decompressFrames(gif, true)
    if (frames.length === 0) return null
    const W = gif.lsd.width
    const H = gif.lsd.height

    const main = document.createElement("canvas")
    main.width = W
    main.height = H
    const mctx = main.getContext("2d")!
    const temp = document.createElement("canvas")
    const tctx = temp.getContext("2d")!

    const out: HTMLCanvasElement[] = []
    const cumulative: number[] = []
    let acc = 0
    let prevDims: { left: number; top: number; width: number; height: number } | null = null
    let prevDisposal = 0
    let savedState: ImageData | null = null

    for (const frame of frames) {
      // Apply the PREVIOUS frame's disposal before drawing this one.
      if (prevDisposal === 2 && prevDims) {
        mctx.clearRect(prevDims.left, prevDims.top, prevDims.width, prevDims.height)
      } else if (prevDisposal === 3 && savedState) {
        mctx.putImageData(savedState, 0, 0)
      }
      if (frame.disposalType === 3) {
        savedState = mctx.getImageData(0, 0, W, H)
      }

      temp.width = frame.dims.width
      temp.height = frame.dims.height
      const id = tctx.createImageData(frame.dims.width, frame.dims.height)
      id.data.set(frame.patch)
      tctx.putImageData(id, 0, 0)
      mctx.drawImage(temp, frame.dims.left, frame.dims.top)

      const snap = document.createElement("canvas")
      snap.width = W
      snap.height = H
      snap.getContext("2d")!.drawImage(main, 0, 0)
      out.push(snap)

      const delay = frame.delay && frame.delay >= 20 ? frame.delay : 100
      acc += delay
      cumulative.push(acc)
      prevDims = frame.dims
      prevDisposal = frame.disposalType
    }

    return { kind: "gif", frames: out, cumulative, totalMs: acc, width: W, height: H }
  } catch (e) {
    console.warn("Failed to decode GIF:", e)
    return null
  }
}

function loadImage(src: string): Promise<LoadedAsset | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () =>
      resolve({ kind: "image", img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height })
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** Load (and cache) all image/GIF sources referenced by the doc. */
export async function loadDocAssets(doc: CoverDoc, cache: AssetCache): Promise<void> {
  const srcs = new Set<string>()
  for (const layer of doc.layers) {
    if (layer.type === "image" && layer.src && !cache.has(layer.src)) srcs.add(layer.src)
  }
  await Promise.all(
    Array.from(srcs).map(async (src) => {
      const asset = isGifSrc(src) ? await decodeGif(src) : await loadImage(src)
      if (asset) cache.set(src, asset)
    })
  )
}

/** True if any visible image layer resolves to a decoded GIF (animated source). */
export function docHasAnimatedSource(doc: CoverDoc, cache: AssetCache): boolean {
  return doc.layers.some(
    (l) => l.visible && l.type === "image" && cache.get((l as ImageLayer).src)?.kind === "gif"
  )
}

function gifFrameIndex(asset: Extract<LoadedAsset, { kind: "gif" }>, timeSec: number, speed: number): number {
  if (asset.totalMs <= 0) return 0
  const ms = (((timeSec * 1000 * speed) % asset.totalMs) + asset.totalMs) % asset.totalMs
  for (let i = 0; i < asset.cumulative.length; i++) {
    if (ms < asset.cumulative[i]) return i
  }
  return asset.frames.length - 1
}

// ── Per-layer property animation ─────────────────────────────────────────────

/** Min/max range for each animatable numeric layer property (matches the UI). */
const LAYER_RANGES: Record<string, [number, number]> = {
  x: [-0.5, 1.5],
  y: [-0.5, 1.5],
  scale: [0.05, 4],
  rotation: [-180, 180],
  opacity: [0, 1],
  size: [0.02, 0.6],
  weight: [100, 900],
  letterSpacing: [-0.1, 0.5],
  angle: [0, 360],
}
const COLOR_KEYS = new Set(["color", "from", "to"])
// Properties that wrap at 360° — a "spin" envelope turns these continuously.
const CIRCULAR_KEYS = new Set(["rotation", "angle"])

/** Looping waveform in -1..1 (mirrors the shader & effect-param animator). */
function animWave(shape: ParamAnim["shape"], p: number): number {
  switch (shape) {
    case "triangle":
      return (1 - Math.abs(p * 2 - 1)) * 2 - 1
    case "pulse":
      return p < 0.5 ? 1 : -1
    case "rampUp":
      return p * 2 - 1
    case "rampDown":
      return 1 - p * 2
    case "sine":
    default:
      return Math.sin(p * Math.PI * 2)
  }
}

function animPhase(anim: ParamAnim, time: number, duration: number): number {
  const cycles = Math.max(1, Math.round(anim.cycles || 1))
  const phase = duration > 0 ? (time / duration) * cycles : time * cycles
  return phase - Math.floor(phase)
}

function hexToHsl(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let s = 0
  let hue = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) hue = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) hue = (b - r) / d + 2
    else hue = (r - g) / d + 4
    hue /= 6
  }
  return [hue * 360, s, l]
}

function hslToHex(hDeg: number, s: number, l: number): string {
  const h = ((hDeg % 360) + 360) % 360 / 360
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  let r: number
  let g: number
  let b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0")
  return `#${to(r)}${to(g)}${to(b)}`
}

/** Apply a layer's animation envelopes for the given time, returning a clone. */
export function animateLayer(layer: Layer, time: number, duration: number): Layer {
  if (!layer.anim || Object.keys(layer.anim).length === 0) return layer
  const out: Record<string, unknown> = { ...layer }
  for (const [key, anim] of Object.entries(layer.anim)) {
    if (!anim) continue
    const phase = animPhase(anim, time, duration) // 0..1, looping
    const spin = anim.shape === "spin"
    if (COLOR_KEYS.has(key)) {
      const base = (layer as unknown as Record<string, unknown>)[key]
      if (typeof base === "string") {
        const hsl = hexToHsl(base)
        if (hsl) {
          // Spin walks the whole colour wheel (seamless: 360° ≡ 0°); the other
          // shapes swing ±180°·depth around the base hue.
          const deltaHue = spin ? phase * 360 : animWave(anim.shape, phase) * (anim.depth || 0) * 180
          out[key] = hslToHex(hsl[0] + deltaHue, hsl[1], hsl[2])
        }
      }
    } else {
      const range = LAYER_RANGES[key]
      const base = (layer as unknown as Record<string, unknown>)[key]
      if (range && typeof base === "number") {
        if (spin && CIRCULAR_KEYS.has(key)) {
          // One full revolution per cycle, same direction — no clamp so it wraps.
          out[key] = base + phase * 360
        } else if (spin) {
          // Non-circular property: a one-directional rising ramp within range.
          const v = base + phase * (anim.depth || 0) * (range[1] - range[0])
          out[key] = Math.min(range[1], Math.max(range[0], v))
        } else {
          const v = base + animWave(anim.shape, phase) * (anim.depth || 0) * (range[1] - range[0])
          out[key] = Math.min(range[1], Math.max(range[0], v))
        }
      }
    }
  }
  return out as unknown as Layer
}

/** True if any layer has at least one animation envelope (animated source). */
export function docHasLayerAnim(doc: CoverDoc): boolean {
  return doc.layers.some((l) => l.anim && Object.keys(l.anim).length > 0)
}

function applyTransform(ctx: CanvasRenderingContext2D, layer: Layer, w: number, h: number): void {
  ctx.translate(layer.x * w, layer.y * h)
  ctx.rotate((layer.rotation * Math.PI) / 180)
  ctx.scale(layer.scale, layer.scale)
}

function drawSource(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  iw: number,
  ih: number,
  fit: ImageLayer["fit"],
  w: number,
  h: number
): void {
  if (!iw || !ih) return
  let dw = w
  let dh = h
  if (fit !== "stretch") {
    const scale = fit === "cover" ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih)
    dw = iw * scale
    dh = ih * scale
  }
  ctx.drawImage(source, -dw / 2, -dh / 2, dw, dh)
}

function drawSolidLayer(ctx: CanvasRenderingContext2D, layer: SolidLayer, w: number, h: number): void {
  ctx.fillStyle = layer.color
  ctx.fillRect(-w / 2, -h / 2, w, h)
}

function drawGradientLayer(ctx: CanvasRenderingContext2D, layer: GradientLayer, w: number, h: number): void {
  const angle = (layer.angle * Math.PI) / 180
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const len = (Math.abs(dx) * w + Math.abs(dy) * h) / 2
  const grad = ctx.createLinearGradient(-dx * len, -dy * len, dx * len, dy * len)
  grad.addColorStop(0, layer.from)
  grad.addColorStop(1, layer.to)
  ctx.fillStyle = grad
  ctx.fillRect(-w / 2, -h / 2, w, h)
}

function drawTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer, w: number, h: number): void {
  const fontPx = Math.max(4, layer.size * h)
  // Quote the family so multi-word installed fonts ("Comic Sans MS") work.
  ctx.font = `${layer.weight} ${fontPx}px "${layer.font}"`
  ctx.fillStyle = layer.color
  ctx.textAlign = layer.align
  ctx.textBaseline = "middle"
  const lines = layer.text.split("\n")
  const lineHeight = fontPx * 1.15
  const totalHeight = lineHeight * lines.length
  let y = -totalHeight / 2 + lineHeight / 2
  for (const line of lines) {
    drawSpacedText(ctx, line, 0, y, layer.letterSpacing * fontPx, layer.align)
    y += lineHeight
  }
}

function drawSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: "left" | "center" | "right"
): void {
  if (!spacing) {
    ctx.fillText(text, x, y)
    return
  }
  const widths = Array.from(text).map((ch) => ctx.measureText(ch).width)
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, text.length - 1)
  let cursor = align === "center" ? -total / 2 : align === "right" ? -total : 0
  const prevAlign = ctx.textAlign
  ctx.textAlign = "left"
  Array.from(text).forEach((ch, i) => {
    ctx.fillText(ch, x + cursor, y)
    cursor += widths[i] + spacing
  })
  ctx.textAlign = prevAlign
}

/** Whether a layer carries its own (enabled) effect chain. */
export function layerHasEffects(layer: Layer): boolean {
  return !!layer.effects && layer.effects.some((e) => e.enabled)
}

/** Whether any layer in the doc carries its own effect chain. */
export function docHasLayerEffects(doc: CoverDoc): boolean {
  return doc.layers.some(layerHasEffects)
}

/** Paint the document background onto an already-sized ctx. */
export function fillBackground(ctx: CanvasRenderingContext2D, color: string, w: number, h: number): void {
  ctx.save()
  ctx.globalCompositeOperation = "source-over"
  ctx.globalAlpha = 1
  ctx.fillStyle = color || "#000000"
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

/** Draw a single layer's pixels (transform applied) — no blend/opacity wrapper. */
function drawLayerContent(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  cache: AssetCache,
  w: number,
  h: number,
  timeSec: number
): void {
  applyTransform(ctx, layer, w, h)
  switch (layer.type) {
    case "image": {
      const asset = cache.get(layer.src)
      if (asset?.kind === "image") {
        drawSource(ctx, asset.img, asset.width, asset.height, layer.fit, w, h)
      } else if (asset?.kind === "gif") {
        const idx = gifFrameIndex(asset, timeSec, layer.gifSpeed ?? 1)
        drawSource(ctx, asset.frames[idx], asset.width, asset.height, layer.fit, w, h)
      }
      break
    }
    case "solid":
      drawSolidLayer(ctx, layer, w, h)
      break
    case "gradient":
      drawGradientLayer(ctx, layer, w, h)
      break
    case "text":
      drawTextLayer(ctx, layer, w, h)
      break
  }
}

/** Composite one layer onto ctx using its (animated) blend mode & opacity. */
export function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  cache: AssetCache,
  w: number,
  h: number,
  timeSec: number,
  duration = 0
): void {
  const a = animateLayer(layer, timeSec, duration)
  if (!a.visible || a.opacity <= 0) return
  ctx.save()
  ctx.globalAlpha = a.opacity
  ctx.globalCompositeOperation = a.blend as GlobalCompositeOperation
  drawLayerContent(ctx, a, cache, w, h, timeSec)
  ctx.restore()
}

/**
 * Draw a single layer alone onto a transparent ctx at full opacity & normal
 * blend. Used as the source for a per-layer effect chain (the layer's blend and
 * opacity are applied later, when its processed result is composited).
 */
export function drawLayerRaw(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  cache: AssetCache,
  w: number,
  h: number,
  timeSec: number,
  duration = 0
): void {
  const a = animateLayer(layer, timeSec, duration)
  ctx.clearRect(0, 0, w, h)
  ctx.save()
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = "source-over"
  drawLayerContent(ctx, a, cache, w, h, timeSec)
  ctx.restore()
}

/** Render every visible layer onto `ctx` (already sized w×h) at the given time. */
export function compositeLayers(
  ctx: CanvasRenderingContext2D,
  doc: CoverDoc,
  cache: AssetCache,
  w: number,
  h: number,
  timeSec: number,
  duration = doc.animation.durationSec
): void {
  fillBackground(ctx, doc.background, w, h)
  for (const layer of doc.layers) drawLayer(ctx, layer, cache, w, h, timeSec, duration)
}
