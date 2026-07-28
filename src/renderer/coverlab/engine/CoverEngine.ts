// CoverEngine — composites Cover Lab layers (2D) into a source texture, then runs
// an ordered WebGL2 effect chain (ping-pong FBOs) for preview, PNG and GIF export.

import { GIFEncoder, quantize, applyPalette } from "gifenc"
import {
  buildFragmentSource,
  getEffectDef,
  paramUniformDecls,
  PASSTHROUGH_FRAG,
  VERT_SRC,
} from "./effects"
import {
  animateLayer,
  AssetCache,
  compositeLayers,
  docHasAnimatedSource,
  docHasLayerAnim,
  docHasLayerEffects,
  drawLayer,
  drawLayerRaw,
  fillBackground,
  layerHasEffects,
  loadDocAssets,
} from "./composite"
import {
  createFullscreenQuad,
  createGL,
  createProgram,
  createRenderTarget,
  flipRowsY,
  hexToRgb,
  RenderTarget,
  resizeRenderTarget,
} from "./glUtils"
import { CoverDoc, EffectDef, EffectInstance, ParamAnim, ParamSpec } from "./types"

interface CachedProgram {
  program: WebGLProgram
  locs: Map<string, WebGLUniformLocation | null>
}

export interface GifExportOptions {
  size: number
  fps: number
  durationSec: number
  onProgress?: (fraction: number) => void
}

export class CoverEngine {
  private gl: WebGL2RenderingContext
  private quad: WebGLVertexArrayObject
  private passthrough: CachedProgram
  private programs = new Map<string, CachedProgram>()
  private targets: [RenderTarget, RenderTarget]
  private srcTex: WebGLTexture
  private srcCanvas: HTMLCanvasElement
  private srcCtx: CanvasRenderingContext2D
  // Scratch surfaces for per-layer effects: one to render a layer alone, one to
  // hold the chain's processed pixels before compositing them back.
  private layerCanvas: HTMLCanvasElement
  private layerCtx: CanvasRenderingContext2D
  private fxCanvas: HTMLCanvasElement
  private fxCtx: CanvasRenderingContext2D
  private assets: AssetCache = new Map()

  // Painted motion masks. Effects read u_mask via maskAt(); a pass binds either
  // its instance's own mask (inst.mask) or, failing that, the doc-level mask
  // (doc.motionMask). 1x1 white (whiteTex) stands in wherever no mask is painted
  // so maskAt()==1. Decoded images and uploaded GL textures are cached by src.
  private whiteTex: WebGLTexture
  private maskImgs = new Map<string, HTMLImageElement | null>()
  private maskTexes = new Map<string, WebGLTexture>()

  private doc: CoverDoc | null = null
  private sourceDirty = true
  private compositedW = 0
  private compositedH = 0

  /** Per-instance compile errors, surfaced to the UI (e.g. custom shader). */
  private errors = new Map<string, string>()
  private onErrors?: (errors: Map<string, string>) => void

  constructor(canvas: HTMLCanvasElement) {
    this.gl = createGL(canvas)
    const gl = this.gl
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
    this.quad = createFullscreenQuad(gl)
    this.passthrough = { program: createProgram(gl, VERT_SRC, PASSTHROUGH_FRAG), locs: new Map() }
    this.targets = [createRenderTarget(gl, 16, 16), createRenderTarget(gl, 16, 16)]
    this.srcTex = gl.createTexture()!
    this.srcCanvas = document.createElement("canvas")
    this.srcCtx = this.srcCanvas.getContext("2d")!
    this.layerCanvas = document.createElement("canvas")
    this.layerCtx = this.layerCanvas.getContext("2d", { willReadFrequently: true })!
    this.fxCanvas = document.createElement("canvas")
    this.fxCtx = this.fxCanvas.getContext("2d")!
    this.whiteTex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.whiteTex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, WHITE_PIXEL)
  }

  setErrorHandler(cb: (errors: Map<string, string>) => void) {
    this.onErrors = cb
  }

  setDoc(doc: CoverDoc) {
    this.doc = doc
    this.sourceDirty = true
  }

  /** Mark the composited source stale (call when a layer changes). */
  invalidateSource() {
    this.sourceDirty = true
  }

  async ensureImages(): Promise<void> {
    if (!this.doc) return
    await loadDocAssets(this.doc, this.assets)
    // Decode every mask referenced by the doc (global + per-instance) and drop
    // any that are no longer used, freeing their GL textures.
    const wanted = this.maskSrcs()
    for (const src of wanted) {
      if (!this.maskImgs.has(src)) this.maskImgs.set(src, await loadImageElement(src))
    }
    for (const src of [...this.maskImgs.keys()]) {
      if (wanted.has(src)) continue
      this.maskImgs.delete(src)
      const tex = this.maskTexes.get(src)
      if (tex) {
        this.gl.deleteTexture(tex)
        this.maskTexes.delete(src)
      }
    }
  }

  /** Every mask src the current doc references: the global one plus per-instance ones. */
  private maskSrcs(): Set<string> {
    const set = new Set<string>()
    const doc = this.doc
    if (!doc) return set
    if (doc.motionMask) set.add(doc.motionMask)
    const collect = (effects?: EffectInstance[]) => {
      for (const e of effects ?? []) if (e.mask) set.add(e.mask)
    }
    collect(doc.effects)
    for (const l of doc.layers) collect(l.effects)
    return set
  }

  /**
   * The GL texture for a mask src (uploading lazily on first use), or the white
   * fallback when there's no mask. Binds the texture to the active unit as a side
   * effect of uploading, so callers re-bind it explicitly afterwards.
   */
  private maskTexFor(src: string | undefined): WebGLTexture {
    if (!src) return this.whiteTex
    const img = this.maskImgs.get(src)
    if (!img) return this.whiteTex // not decoded yet (or failed) — no-op mask
    const cached = this.maskTexes.get(src)
    if (cached) return cached
    const gl = this.gl
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    this.maskTexes.set(src, tex)
    return tex
  }

  /** Whether the composited source animates over time (has a decoded GIF layer). */
  private hasAnimatedSource(): boolean {
    return this.doc ? docHasAnimatedSource(this.doc, this.assets) : false
  }

  private loc(cp: CachedProgram, name: string): WebGLUniformLocation | null {
    if (!cp.locs.has(name)) {
      cp.locs.set(name, this.gl.getUniformLocation(cp.program, name))
    }
    return cp.locs.get(name) ?? null
  }

  private programKey(inst: EffectInstance): string {
    return inst.effectId === "custom" ? `custom:${hashString(inst.customFrag || "")}` : inst.effectId
  }

  /** Compile (and cache) the program for an instance. Returns null on failure. */
  private getProgram(inst: EffectInstance, def: EffectDef): CachedProgram | null {
    const key = this.programKey(inst)
    const cached = this.programs.get(key)
    if (cached) return cached
    const body = inst.effectId === "custom" ? inst.customFrag || def.frag : def.frag
    const fragSrc = buildFragmentSource(paramUniformDecls(def), body)
    try {
      const program = createProgram(this.gl, VERT_SRC, fragSrc)
      const cp: CachedProgram = { program, locs: new Map() }
      this.programs.set(key, cp)
      if (this.errors.delete(inst.id)) this.flushErrors()
      return cp
    } catch (e) {
      this.errors.set(inst.id, String(e instanceof Error ? e.message : e))
      this.flushErrors()
      return null
    }
  }

  /** Validate a custom fragment body without affecting render state. Returns error or null. */
  validateCustom(body: string): string | null {
    const def = getEffectDef("custom")!
    const fragSrc = buildFragmentSource(paramUniformDecls(def), body)
    try {
      const program = createProgram(this.gl, VERT_SRC, fragSrc)
      this.gl.deleteProgram(program)
      return null
    } catch (e) {
      return String(e instanceof Error ? e.message : e)
    }
  }

  private flushErrors() {
    this.onErrors?.(new Map(this.errors))
  }

  private docDims(maxDim?: number): { w: number; h: number } {
    const doc = this.doc!
    if (!maxDim) return { w: doc.width, h: doc.height }
    const aspect = doc.width / doc.height
    if (aspect >= 1) return { w: maxDim, h: Math.round(maxDim / aspect) }
    return { w: Math.round(maxDim * aspect), h: maxDim }
  }

  /** Upload a 2D canvas into the source texture (flipped to GL orientation). */
  private uploadCanvasToSrcTex(canvas: HTMLCanvasElement) {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
  }

  private compositeSource(w: number, h: number, time: number, force = false, duration = this.doc!.animation.durationSec) {
    const doc = this.doc!
    const hasLayerFx = docHasLayerEffects(doc)
    // Animated (GIF) sources, per-layer effects and animated layer properties must
    // re-composite every frame; otherwise the static composite is cached.
    const animated = this.hasAnimatedSource() || hasLayerFx || docHasLayerAnim(doc)
    if (!force && !animated && !this.sourceDirty && this.compositedW === w && this.compositedH === h) return
    this.srcCanvas.width = w
    this.srcCanvas.height = h
    if (hasLayerFx) {
      this.compositeWithLayerEffects(w, h, time, duration)
    } else {
      compositeLayers(this.srcCtx, doc, this.assets, w, h, time, duration)
    }
    this.uploadCanvasToSrcTex(this.srcCanvas)
    this.compositedW = w
    this.compositedH = h
    this.sourceDirty = false
  }

  /**
   * Composite layers when one or more carry their own effect chain. Plain layers
   * are drawn straight; an effected layer is rendered alone, run through its chain
   * on the GPU, clipped to its own silhouette, then composited with its blend mode.
   */
  private compositeWithLayerEffects(w: number, h: number, time: number, duration: number) {
    const doc = this.doc!
    const main = this.srcCtx
    fillBackground(main, doc.background, w, h)
    for (const layer of doc.layers) {
      // Animated opacity/blend drive the composite; transform/content animate inside the draw helpers.
      const a = animateLayer(layer, time, duration)
      if (!a.visible || a.opacity <= 0) continue
      if (!layerHasEffects(layer)) {
        drawLayer(main, layer, this.assets, w, h, time, duration)
        continue
      }
      // 1) Render the layer alone onto a transparent scratch canvas.
      this.layerCanvas.width = w
      this.layerCanvas.height = h
      drawLayerRaw(this.layerCtx, layer, this.assets, w, h, time, duration)
      const coverage = this.layerCtx.getImageData(0, 0, w, h).data // straight alpha
      // 2) Upload it and run the layer's own effect chain on the GPU.
      this.uploadCanvasToSrcTex(this.layerCanvas)
      const result = this.renderChain(w, h, time, duration, layer.effects!)
      const pixels = this.readback(result, w, h)
      // 3) Clip the processed pixels to the layer's shape so effects don't flood
      //    the whole frame with an opaque rectangle.
      for (let i = 3; i < pixels.length; i += 4) {
        if (coverage[i] < pixels[i]) pixels[i] = coverage[i]
      }
      // 4) Composite the processed layer with its blend mode & opacity.
      this.fxCanvas.width = w
      this.fxCanvas.height = h
      const img = this.fxCtx.createImageData(w, h)
      img.data.set(pixels)
      this.fxCtx.putImageData(img, 0, 0)
      main.save()
      main.globalAlpha = a.opacity
      main.globalCompositeOperation = a.blend as GlobalCompositeOperation
      main.drawImage(this.fxCanvas, 0, 0)
      main.restore()
    }
  }

  private setEffectUniforms(cp: CachedProgram, def: EffectDef, inst: EffectInstance, w: number, h: number, time: number, duration: number) {
    const gl = this.gl
    gl.uniform1i(this.loc(cp, "u_tex"), 0)
    gl.uniform1i(this.loc(cp, "u_mask"), 1)
    gl.uniform2f(this.loc(cp, "u_resolution"), w, h)
    gl.uniform1f(this.loc(cp, "u_time"), time)
    gl.uniform1f(this.loc(cp, "u_duration"), duration)
    for (const p of def.params) {
      const name = `u_${p.key}`
      const raw = inst.params[p.key]
      if (p.type === "color") {
        const [r, g, b] = hexToRgb(typeof raw === "string" ? raw : p.default)
        gl.uniform3f(this.loc(cp, name), r, g, b)
      } else if (p.type === "bool") {
        gl.uniform1f(this.loc(cp, name), raw ? 1 : 0)
      } else {
        let v = typeof raw === "number" ? raw : p.default
        const anim = inst.anim?.[p.key]
        if (anim && p.type === "range") v = animatedParam(p, v, anim, time, duration)
        gl.uniform1f(this.loc(cp, name), v)
      }
    }
  }

  private drawQuad() {
    const gl = this.gl
    gl.bindVertexArray(this.quad)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindVertexArray(null)
  }

  /** Run an effect chain at w×h for the given time; result lives in the returned target. */
  private renderChain(
    w: number,
    h: number,
    time: number,
    duration: number,
    effects: EffectInstance[] = this.doc!.effects
  ): RenderTarget {
    const gl = this.gl
    resizeRenderTarget(gl, this.targets[0], w, h)
    resizeRenderTarget(gl, this.targets[1], w, h)

    const passes: { cp: CachedProgram; def: EffectDef; inst: EffectInstance }[] = []
    for (const inst of effects) {
      if (!inst.enabled) continue
      const def = getEffectDef(inst.effectId)
      if (!def) continue
      const cp = this.getProgram(inst, def)
      if (cp) passes.push({ cp, def, inst })
    }

    if (passes.length === 0) {
      // Passthrough copy so the result is always in an FBO (needed for readback).
      const target = this.targets[0]
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo)
      gl.viewport(0, 0, w, h)
      gl.useProgram(this.passthrough.program)
      gl.uniform1i(this.loc(this.passthrough, "u_tex"), 0)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.srcTex)
      this.drawQuad()
      return target
    }

    let readTex = this.srcTex
    let last = this.targets[0]
    passes.forEach(({ cp, def, inst }, i) => {
      const target = this.targets[i % 2]
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo)
      gl.viewport(0, 0, w, h)
      gl.useProgram(cp.program)
      this.setEffectUniforms(cp, def, inst, w, h, time, duration)
      // u_mask = this instance's own mask if it has one, else the doc-level mask.
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, this.maskTexFor(inst.mask ?? this.doc!.motionMask))
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, readTex)
      this.drawQuad()
      readTex = target.tex
      last = target
    })
    return last
  }

  /** Render the current doc to the bound canvas at preview (doc) resolution. */
  render(time: number) {
    if (!this.doc) return
    const { w, h } = this.docDims()
    const canvas = this.gl.canvas as HTMLCanvasElement
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    this.compositeSource(w, h, time)
    const result = this.renderChain(w, h, time, this.doc.animation.durationSec)
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, w, h)
    gl.useProgram(this.passthrough.program)
    gl.uniform1i(this.loc(this.passthrough, "u_tex"), 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, result.tex)
    this.drawQuad()
  }

  private readback(target: RenderTarget, w: number, h: number): Uint8Array {
    const gl = this.gl
    const pixels = new Uint8Array(w * h * 4)
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo)
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    flipRowsY(pixels, w, h)
    return pixels
  }

  /** Render to an offscreen 2D canvas and return PNG bytes. */
  async exportPNG(maxDim: number, time = 0): Promise<Uint8Array> {
    if (!this.doc) throw new Error("No document loaded")
    await this.ensureImages()
    const { w, h } = this.docDims(maxDim)
    this.compositeSource(w, h, time, true)
    const result = this.renderChain(w, h, time, this.doc.animation.durationSec)
    const pixels = this.readback(result, w, h)
    this.sourceDirty = true // preview re-composites at its own size next frame
    return await pixelsToImageBytes(pixels, w, h, "image/png")
  }

  /** Render an animated GIF and return its bytes. */
  async exportGIF(opts: GifExportOptions): Promise<Uint8Array> {
    if (!this.doc) throw new Error("No document loaded")
    await this.ensureImages()
    const { w, h } = this.docDims(opts.size)
    const fps = Math.max(1, Math.min(50, Math.round(opts.fps)))
    const frameCount = Math.max(1, Math.min(300, Math.round(fps * opts.durationSec)))
    const delay = Math.round(1000 / fps)
    // Drive the loop off the exact frame grid (period = frameCount/fps) so the
    // discrete frames evenly sample one full period: frame f sits at phase
    // f/frameCount, and frame (frameCount-1) flows straight back into frame 0.
    const loopDuration = frameCount / fps

    // Pass 1 — derive ONE stable palette from low-res samples taken across the
    // whole loop. Quantizing each frame independently makes colors drift between
    // frames ("boiling"), which reads as a glitchy shimmer; a shared palette
    // keeps colors locked frame-to-frame.
    const sample = this.docDims(Math.min(opts.size, 160))
    const sampleCount = Math.min(frameCount, 12)
    const sampleFrames: Uint8Array[] = []
    for (let i = 0; i < sampleCount; i++) {
      const f = Math.min(frameCount - 1, Math.round((i / sampleCount) * frameCount))
      const time = f / fps
      this.compositeSource(sample.w, sample.h, time, true, loopDuration)
      const result = this.renderChain(sample.w, sample.h, time, loopDuration)
      sampleFrames.push(this.readback(result, sample.w, sample.h))
    }
    const totalLen = sampleFrames.reduce((n, a) => n + a.length, 0)
    const combined = new Uint8Array(totalLen)
    let off = 0
    for (const a of sampleFrames) {
      combined.set(a, off)
      off += a.length
    }
    const palette = quantize(combined, 256, { format: "rgb565" })

    // Pass 2 — render every full-res frame and index it against the shared palette.
    const gif = GIFEncoder()
    for (let f = 0; f < frameCount; f++) {
      const time = f / fps
      this.compositeSource(w, h, time, true, loopDuration)
      const result = this.renderChain(w, h, time, loopDuration)
      const pixels = this.readback(result, w, h)
      const index = applyPalette(pixels, palette, "rgb565")
      // repeat: 0 on the first frame writes the loop-forever extension.
      gif.writeFrame(index, w, h, f === 0 ? { palette, delay, repeat: 0 } : { palette, delay })
      opts.onProgress?.((f + 1) / frameCount)
      // Yield so the progress UI can update and we don't lock the main thread.
      await new Promise((r) => setTimeout(r, 0))
    }
    gif.finish()
    this.sourceDirty = true
    return gif.bytes()
  }

  dispose() {
    const gl = this.gl
    this.programs.forEach((cp) => gl.deleteProgram(cp.program))
    this.programs.clear()
    gl.deleteProgram(this.passthrough.program)
    this.targets.forEach((t) => {
      gl.deleteFramebuffer(t.fbo)
      gl.deleteTexture(t.tex)
    })
    gl.deleteTexture(this.srcTex)
    gl.deleteTexture(this.whiteTex)
    this.maskTexes.forEach((t) => gl.deleteTexture(t))
    this.maskTexes.clear()
    gl.deleteVertexArray(this.quad)
  }
}

const WHITE_PIXEL = new Uint8Array([255, 255, 255, 255])

/**
 * Modulate a numeric param over the loop. The phase matches the shader's
 * loopPhase() (fract(time/duration)) so CPU-driven param motion stays in lockstep
 * with shader-driven motion and loops seamlessly. Cycles are whole, so phase 0 and
 * phase 1 land on the same value.
 */
function animatedParam(
  spec: Extract<ParamSpec, { type: "range" }>,
  base: number,
  anim: ParamAnim,
  time: number,
  duration: number
): number {
  const cycles = Math.max(1, Math.round(anim.cycles || 1))
  const phase = duration > 0 ? (time / duration) * cycles : time * cycles
  const p = phase - Math.floor(phase) // 0..1
  let wave: number // -1..1 (or 0..1 for ramps/pulse)
  switch (anim.shape) {
    case "triangle":
      wave = (1 - Math.abs(p * 2 - 1)) * 2 - 1
      break
    case "pulse":
      wave = p < 0.5 ? 1 : -1
      break
    case "rampUp":
      wave = p * 2 - 1
      break
    case "rampDown":
      wave = 1 - p * 2
      break
    case "spin":
      // Effect params aren't angular, so a continuous spin reads as a rising
      // sweep across the range (then loops back) — same as Ramp ↑.
      wave = p * 2 - 1
      break
    case "sine":
    default:
      wave = Math.sin(p * Math.PI * 2)
      break
  }
  const range = spec.max - spec.min
  const v = base + wave * (anim.depth || 0) * range
  return Math.min(spec.max, Math.max(spec.min, v))
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function hashString(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return (h >>> 0).toString(36) + ":" + s.length
}

async function pixelsToImageBytes(
  pixels: Uint8Array,
  w: number,
  h: number,
  mime: string
): Promise<Uint8Array> {
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")!
  const imageData = ctx.createImageData(w, h)
  imageData.data.set(pixels)
  ctx.putImageData(imageData, 0, 0)
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), mime)
  )
  return new Uint8Array(await blob.arrayBuffer())
}
