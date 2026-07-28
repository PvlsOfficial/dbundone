// Three.js layer objects — each VizLayer type rendered as a Three object in the
// shared scene. They live in world space where y ∈ [-1, 1] and x ∈ [-aspect,
// aspect] (the camera frames exactly that at z=0), so 2D-style layers and the 3D
// sphere coexist under one camera and one global post-processing chain.

import * as THREE from "three"
import { clamp01, sampleEQ, sampleSpectrum, weightedBand } from "../audioMath"
import type { AudioFrame, LayerType, Resolver, VizLayer } from "../types"

export interface LayerCtx {
  worldW: number
  worldH: number
  aspect: number
  frame: AudioFrame
  P: Resolver
  time: number
}

export abstract class LayerObject {
  abstract object: THREE.Object3D
  materials: THREE.Material[] = []
  abstract update(ctx: LayerCtx, layer: VizLayer): void
  dispose() {
    this.object.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
    })
    for (const mat of this.materials) mat.dispose()
  }
}

// ── shared helpers ────────────────────────────────────────────────────────────
const C = (hex: string) => new THREE.Color(hex || "#000000")
function frac(n: number) { return n - Math.floor(n) }
function yFrac(y: number, worldH: number) { return (0.5 - y) * worldH } // UI y(0 top) → world y

let _disc: THREE.Texture | null = null
function discTexture(): THREE.Texture {
  if (_disc) return _disc
  const c = document.createElement("canvas")
  c.width = c.height = 64
  const x = c.getContext("2d")!
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, "rgba(255,255,255,1)")
  g.addColorStop(0.4, "rgba(255,255,255,0.6)")
  g.addColorStop(1, "rgba(255,255,255,0)")
  x.fillStyle = g
  x.fillRect(0, 0, 64, 64)
  _disc = new THREE.CanvasTexture(c)
  return _disc
}

// ── background (fullscreen gradient plane) ────────────────────────────────────
const BG_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uC1, uC2; uniform float uStyle, uPulse; uniform vec2 uDir;
varying vec2 vUv;
void main(){
  float t;
  if (uStyle < 0.5) { t = 0.0; }                                  // solid
  else if (uStyle < 1.5) { t = dot(vUv - 0.5, uDir) + 0.5; }      // linear
  else { t = clamp(length(vUv - 0.5) * 1.6 / uPulse, 0.0, 1.0); } // radial
  vec3 col = (uStyle < 0.5) ? uC1 : mix((uStyle < 1.5 ? uC1 : uC2), (uStyle < 1.5 ? uC2 : uC1), t);
  gl_FragColor = vec4(col, 1.0);
}`
const BG_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`

class BackgroundObject extends LayerObject {
  object: THREE.Mesh
  private mat: THREE.ShaderMaterial
  constructor() {
    super()
    this.mat = new THREE.ShaderMaterial({
      vertexShader: BG_VERT, fragmentShader: BG_FRAG, depthTest: false, depthWrite: false,
      uniforms: { uC1: { value: C("#0a0a16") }, uC2: { value: C("#1e1b4b") }, uStyle: { value: 1 }, uPulse: { value: 1 }, uDir: { value: new THREE.Vector2(1, 0) } },
    })
    this.object = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat)
    this.materials = [this.mat]
  }
  update(ctx: LayerCtx, _layer: VizLayer) {
    const { P, frame, worldW, worldH } = ctx
    this.object.scale.set(worldW, worldH, 1)
    const styleMap: Record<string, number> = { solid: 0, gradient: 1, radial: 2 }
    const u = this.mat.uniforms
    ;(u.uStyle.value as number) = styleMap[P.s("style", "gradient")] ?? 1
    ;(u.uC1.value as THREE.Color).set(P.s("color1", "#0a0a16"))
    ;(u.uC2.value as THREE.Color).set(P.s("color2", "#1e1b4b"))
    u.uPulse.value = 1 + frame.bass * P.n("pulse", 0.25)
    const a = (P.n("angle", 135) * Math.PI) / 180
    ;(u.uDir.value as THREE.Vector2).set(Math.cos(a), Math.sin(a))
  }
}

// ── spectrum (EQ): bars / line / filled area ─────────────────────────────────
class BarsObject extends LayerObject {
  object: THREE.Group
  private bars: THREE.InstancedMesh
  private caps: THREE.InstancedMesh
  private lineTop: THREE.Line
  private lineBot: THREE.Line
  private area: THREE.Mesh
  private barMat: THREE.MeshBasicMaterial
  private capMat: THREE.MeshBasicMaterial
  private lineMat: THREE.LineBasicMaterial
  private areaMat: THREE.MeshBasicMaterial
  private dummy = new THREE.Object3D()
  private smooth = new Float32Array(BarsObject.MAX)
  private peak = new Float32Array(BarsObject.MAX)
  private cA = new THREE.Color(); private cB = new THREE.Color(); private tmp = new THREE.Color()
  private static MAX = 256
  constructor() {
    super()
    const MAX = BarsObject.MAX
    this.barMat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false })
    this.capMat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false })
    this.lineMat = new THREE.LineBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, vertexColors: true })
    this.areaMat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, vertexColors: true })
    this.bars = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), this.barMat, MAX)
    this.bars.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.caps = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), this.capMat, MAX)
    this.caps.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    // line (top + optional mirrored bottom), each its own coloured geometry
    const mkLine = () => {
      const g = new THREE.BufferGeometry()
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX * 3), 3))
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(MAX * 3), 3))
      return new THREE.Line(g, this.lineMat)
    }
    this.lineTop = mkLine(); this.lineBot = mkLine()
    // area ribbon (top/bottom vertex pairs, indexed)
    const ag = new THREE.BufferGeometry()
    ag.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX * 2 * 3), 3))
    ag.setAttribute("color", new THREE.BufferAttribute(new Float32Array(MAX * 2 * 3), 3))
    const idx = new Uint16Array((MAX - 1) * 6)
    for (let s = 0; s < MAX - 1; s++) {
      const a = s * 2, b = s * 2 + 1, c = (s + 1) * 2, d = (s + 1) * 2 + 1, o = s * 6
      idx[o] = a; idx[o + 1] = b; idx[o + 2] = c; idx[o + 3] = b; idx[o + 4] = d; idx[o + 5] = c
    }
    ag.setIndex(new THREE.BufferAttribute(idx, 1))
    this.area = new THREE.Mesh(ag, this.areaMat)
    this.object = new THREE.Group()
    this.object.add(this.bars, this.caps, this.area, this.lineTop, this.lineBot)
    this.materials = [this.barMat, this.capMat, this.lineMat, this.areaMat]
  }
  update(ctx: LayerCtx, layer: VizLayer) {
    const { P, frame, worldW, worldH } = ctx
    const MAX = BarsObject.MAX
    const shape = P.s("shape", "bars")
    const count = Math.min(MAX, Math.max(2, Math.round(P.n("count", 96))))
    const sens = P.n("sensitivity", 1.3)
    const maxH = P.n("height", 0.85) * worldH * 0.5
    const baseline = P.n("baseline", 0.92)
    const mirror = P.s("mirror", "none")
    const sm = P.n("smooth", 0.5)
    const raw = sampleEQ(frame.freq, count)
    this.cA.set(P.s("color1", "#a855f7")); this.cB.set(P.s("color2", "#22d3ee"))
    const baseY = yFrac(baseline, worldH)
    // smoothed, sensitivity-saturated values (never clip flat at the top)
    for (let i = 0; i < count; i++) {
      const target = 1 - Math.exp(-Math.max(0, raw[i]) * sens)
      this.smooth[i] = target > this.smooth[i] ? target : this.smooth[i] * sm + target * (1 - sm)
      this.peak[i] = Math.max(this.smooth[i], this.peak[i] - 0.012)
    }
    // top/bottom y for a value, honouring the mirror mode
    const span = (v: number): [number, number] => {
      const h = v * maxH
      if (mirror === "updown") return [baseY - h, baseY + h]
      if (mirror === "center") return [-h, h]
      return [baseY, baseY + h]
    }

    const isBars = shape === "bars", isLine = shape === "line", isArea = shape === "area"
    this.bars.visible = isBars
    this.caps.visible = isBars && P.b("peaks", false)
    this.area.visible = isArea
    this.lineTop.visible = isLine
    this.lineBot.visible = isLine && mirror !== "none"

    if (isBars) {
      const slot = worldW / count
      const bw = slot * (1 - P.n("gap", 0.22))
      const showCaps = P.b("peaks", false)
      for (let i = 0; i < count; i++) {
        const v = this.smooth[i]
        const [bot, top] = span(v)
        const cy = (top + bot) / 2
        const sy = Math.max(worldH * 0.004, top - bot)
        const x = -worldW / 2 + slot * i + slot / 2
        this.dummy.position.set(x, cy, 0); this.dummy.scale.set(bw, sy, 1); this.dummy.updateMatrix()
        this.bars.setMatrixAt(i, this.dummy.matrix)
        this.tmp.copy(this.cB).lerp(this.cA, clamp01(v))
        this.bars.setColorAt(i, this.tmp)
        if (showCaps) {
          const [, ptop] = span(this.peak[i])
          this.dummy.position.set(x, ptop, 0); this.dummy.scale.set(bw, worldH * 0.012, 1); this.dummy.updateMatrix()
          this.caps.setMatrixAt(i, this.dummy.matrix)
          this.caps.setColorAt(i, this.cA)
        }
      }
      this.bars.count = count; this.bars.instanceMatrix.needsUpdate = true
      if (this.bars.instanceColor) this.bars.instanceColor.needsUpdate = true
      this.caps.count = showCaps ? count : 0
      this.caps.instanceMatrix.needsUpdate = true
      if (this.caps.instanceColor) this.caps.instanceColor.needsUpdate = true
    } else if (isLine) {
      this.lineMat.linewidth = P.n("thickness", 3)
      const pT = this.lineTop.geometry.getAttribute("position") as THREE.BufferAttribute
      const cT = this.lineTop.geometry.getAttribute("color") as THREE.BufferAttribute
      const pB = this.lineBot.geometry.getAttribute("position") as THREE.BufferAttribute
      const cB2 = this.lineBot.geometry.getAttribute("color") as THREE.BufferAttribute
      for (let i = 0; i < count; i++) {
        const v = this.smooth[i]
        const [bot, top] = span(v)
        const x = -worldW / 2 + (i / (count - 1)) * worldW
        this.tmp.copy(this.cB).lerp(this.cA, clamp01(v))
        pT.setXYZ(i, x, top, 0); cT.setXYZ(i, this.tmp.r, this.tmp.g, this.tmp.b)
        pB.setXYZ(i, x, bot, 0); cB2.setXYZ(i, this.tmp.r, this.tmp.g, this.tmp.b)
      }
      pT.needsUpdate = true; cT.needsUpdate = true; pB.needsUpdate = true; cB2.needsUpdate = true
      this.lineTop.geometry.setDrawRange(0, count); this.lineBot.geometry.setDrawRange(0, count)
    } else if (isArea) {
      const pos = this.area.geometry.getAttribute("position") as THREE.BufferAttribute
      const col = this.area.geometry.getAttribute("color") as THREE.BufferAttribute
      for (let i = 0; i < count; i++) {
        const v = this.smooth[i]
        const [bot, top] = span(v)
        const x = -worldW / 2 + (i / (count - 1)) * worldW
        pos.setXYZ(i * 2, x, top, 0); col.setXYZ(i * 2, this.cA.r, this.cA.g, this.cA.b)
        pos.setXYZ(i * 2 + 1, x, bot, 0); col.setXYZ(i * 2 + 1, this.cB.r, this.cB.g, this.cB.b)
      }
      pos.needsUpdate = true; col.needsUpdate = true
      this.area.geometry.setDrawRange(0, (count - 1) * 6)
    }
  }
}

// ── waveform (line + optional mirror) ─────────────────────────────────────────
class WaveObject extends LayerObject {
  object: THREE.Group
  private line: THREE.Line
  private mirror: THREE.Line
  private mat: THREE.LineBasicMaterial
  private N = 256
  constructor() {
    super()
    this.mat = new THREE.LineBasicMaterial({ transparent: true, depthTest: false, depthWrite: false })
    const g1 = new THREE.BufferGeometry(); g1.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.N * 3), 3))
    const g2 = new THREE.BufferGeometry(); g2.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.N * 3), 3))
    this.line = new THREE.Line(g1, this.mat)
    this.mirror = new THREE.Line(g2, this.mat)
    this.object = new THREE.Group(); this.object.add(this.line); this.object.add(this.mirror)
    this.materials = [this.mat]
  }
  update(ctx: LayerCtx, layer: VizLayer) {
    const { P, frame, worldW, worldH } = ctx
    this.mat.color.set(P.s("color", "#f472b6"))
    const amp = P.n("amp", 0.4) * worldH * 0.5
    const cy = yFrac(P.n("y", 0.5), worldH)
    const data = frame.wave
    const showMirror = P.s("mode", "mirror") === "mirror"
    const p1 = (this.line.geometry.getAttribute("position") as THREE.BufferAttribute)
    const p2 = (this.mirror.geometry.getAttribute("position") as THREE.BufferAttribute)
    for (let i = 0; i < this.N; i++) {
      const u = i / (this.N - 1)
      const s = data[Math.floor(u * (data.length - 1))]
      const dy = ((s - 128) / 128) * amp
      const x = -worldW / 2 + u * worldW
      p1.setXYZ(i, x, cy + dy, 0)
      p2.setXYZ(i, x, cy - dy, 0)
    }
    p1.needsUpdate = true; p2.needsUpdate = true
    this.mirror.visible = showMirror
  }
}

// ── radial spectrum (line segments) ───────────────────────────────────────────
class RadialObject extends LayerObject {
  object: THREE.LineSegments
  private mat: THREE.LineBasicMaterial
  private MAX = 220
  constructor() {
    super()
    this.mat = new THREE.LineBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, vertexColors: true })
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.MAX * 2 * 3), 3))
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(this.MAX * 2 * 3), 3))
    this.object = new THREE.LineSegments(g, this.mat)
    this.materials = [this.mat]
  }
  update(ctx: LayerCtx, layer: VizLayer) {
    const { P, frame, worldH } = ctx
    const count = Math.min(this.MAX, Math.round(P.n("count", 96)))
    const base = worldH * 0.5
    const inner = P.n("radius", 0.18) * base * 2
    const len = P.n("length", 0.22) * base * 2
    const mirror = P.b("mirror", true)
    const half = mirror ? Math.ceil(count / 2) : count
    const vals = sampleSpectrum(frame.freq, half, { focus: P.n("focus", 0.3), spread: P.n("spread", 1) })
    const rot = frame.time * P.n("spin", 0.15)
    const c1 = C(P.s("color1", "#22d3ee")); const c2 = C(P.s("color2", "#a855f7"))
    const pos = this.object.geometry.getAttribute("position") as THREE.BufferAttribute
    const col = this.object.geometry.getAttribute("color") as THREE.BufferAttribute
    for (let i = 0; i < count; i++) {
      const vi = mirror ? (i < half ? i : count - i) : i
      const v = vals[Math.min(half - 1, vi)] ?? 0
      const a = rot + (i / count) * Math.PI * 2
      const r1 = inner + Math.max(worldH * 0.004, v * len + frame.level * len * 0.3)
      const cs = Math.cos(a), sn = Math.sin(a)
      pos.setXYZ(i * 2, cs * inner, sn * inner, 0)
      pos.setXYZ(i * 2 + 1, cs * r1, sn * r1, 0)
      col.setXYZ(i * 2, c1.r, c1.g, c1.b)
      col.setXYZ(i * 2 + 1, c2.r, c2.g, c2.b)
    }
    pos.needsUpdate = true; col.needsUpdate = true
    this.object.geometry.setDrawRange(0, count * 2)
  }
}

// ── particles (points) ────────────────────────────────────────────────────────
class ParticlesObject extends LayerObject {
  object: THREE.Points
  private mat: THREE.PointsMaterial
  private MAX = 2000
  constructor() {
    super()
    this.mat = new THREE.PointsMaterial({ size: 0.03, map: discTexture(), transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending })
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.MAX * 3), 3))
    this.object = new THREE.Points(g, this.mat)
    this.materials = [this.mat]
  }
  update(ctx: LayerCtx, layer: VizLayer) {
    const { P, frame, worldW, worldH, time } = ctx
    const count = Math.min(this.MAX, Math.round(P.n("count", 300)))
    this.mat.size = P.n("size", 3) * 0.006
    this.mat.color.set(P.s("color", "#ffffff"))
    const speed = P.n("speed", 0.4)
    const react = P.n("react", 0.6)
    const dir = P.s("direction", "up")
    const burst = 1 + frame.level * react
    const pos = this.object.geometry.getAttribute("position") as THREE.BufferAttribute
    for (let i = 0; i < count; i++) {
      const seed = i * 12.9898
      const bx = frac(Math.sin(seed) * 43758.5453)
      const by = frac(Math.cos(seed * 1.7) * 24634.6345)
      let x: number, y: number
      if (dir === "out") {
        const ang = bx * Math.PI * 2
        const rad = frac(by + time * speed * 0.1) * worldH * 0.6 * (0.5 + burst * 0.3)
        x = Math.cos(ang) * rad; y = Math.sin(ang) * rad
      } else {
        const drift = (time * speed * (0.3 + bx * 0.7)) % 1
        x = (((bx + drift * 0.3) % 1) - 0.5) * worldW
        const prog = dir === "up" ? 1 - ((by + time * speed * 0.1) % 1) : (by + time * speed * 0.1) % 1
        y = (0.5 - prog) * worldH
      }
      pos.setXYZ(i, x, y, 0)
    }
    pos.needsUpdate = true
    this.object.geometry.setDrawRange(0, count)
  }
}

// ── image / cover (textured plane) ────────────────────────────────────────────
class ImageObject extends LayerObject {
  object: THREE.Mesh
  private mat: THREE.MeshBasicMaterial
  private lastSrc: string | undefined = undefined
  private tex: THREE.Texture | null = null
  private texAspect = 1
  constructor() {
    super()
    this.mat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false })
    this.object = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat)
    this.object.visible = false
    this.materials = [this.mat]
  }
  update(ctx: LayerCtx, layer: VizLayer) {
    const { P, frame, worldW, worldH } = ctx
    if (layer.src !== this.lastSrc) {
      this.lastSrc = layer.src
      this.tex?.dispose()
      if (layer.src) {
        this.tex = new THREE.TextureLoader().load(layer.src, (t) => { this.texAspect = (t.image?.width || 1) / (t.image?.height || 1) })
        this.tex.colorSpace = THREE.SRGBColorSpace
        this.mat.map = this.tex
        this.mat.needsUpdate = true
      } else {
        this.mat.map = null; this.mat.needsUpdate = true
      }
    }
    this.object.visible = !!this.mat.map
    if (!this.mat.map) return
    const fit = P.s("fit", "cover")
    const reactive = weightedBand(frame.freq, P.n("focus", 0.05), 0.08)
    const scale = P.n("scale", 0.5) * (1 + reactive * P.n("beatZoom", 0.06))
    // fit a (texAspect) image into the frame box
    const frameAspect = worldW / worldH
    let w = worldW, h = worldH
    if (this.texAspect > frameAspect) { // wider than frame
      if (fit === "cover") { w = worldH * this.texAspect; h = worldH } else { w = worldW; h = worldW / this.texAspect }
    } else {
      if (fit === "cover") { w = worldW; h = worldW / this.texAspect } else { w = worldH * this.texAspect; h = worldH }
    }
    this.object.scale.set(w * scale, h * scale, 1)
    this.object.rotation.z = -frame.time * P.n("spin", 0)
  }
  dispose() { this.tex?.dispose(); super.dispose() }
}

// ── canvas-texture base (text + VU) ──────────────────────────────────────────
abstract class CanvasObject extends LayerObject {
  object: THREE.Mesh
  protected mat: THREE.MeshBasicMaterial
  protected canvas: HTMLCanvasElement
  protected cctx: CanvasRenderingContext2D
  protected tex: THREE.CanvasTexture
  constructor(w = 1024, h = 512) {
    super()
    this.canvas = document.createElement("canvas")
    this.canvas.width = w; this.canvas.height = h
    this.cctx = this.canvas.getContext("2d")!
    this.tex = new THREE.CanvasTexture(this.canvas)
    this.tex.colorSpace = THREE.SRGBColorSpace
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false })
    this.object = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat)
    this.materials = [this.mat]
  }
}

class TextObject extends CanvasObject {
  private sig = ""
  update(ctx: LayerCtx, layer: VizLayer) {
    const { P, frame, worldH, worldW } = ctx
    const value = P.s("text", "")
    const weight = P.n("weight", 800)
    const color = P.s("color", "#ffffff")
    const align = P.s("align", "center")
    const sig = `${value}|${weight}|${color}|${align}`
    if (sig !== this.sig) {
      this.sig = sig
      const c = this.canvas, x = this.cctx
      x.clearRect(0, 0, c.width, c.height)
      x.fillStyle = color
      x.textBaseline = "middle"
      x.textAlign = "center"
      let fs = 200
      x.font = `${weight} ${fs}px ui-sans-serif, system-ui, sans-serif`
      const w = x.measureText(value || " ").width
      if (w > c.width - 40) fs = Math.max(20, fs * (c.width - 40) / w)
      x.font = `${weight} ${fs}px ui-sans-serif, system-ui, sans-serif`
      x.fillStyle = color
      x.fillText(value || "", c.width / 2, c.height / 2)
      this.tex.needsUpdate = true
    }
    const size = P.n("size", 0.12) * (1 + frame.level * P.n("beatScale", 0.05))
    const h = size * worldH
    this.object.scale.set(h * (this.canvas.width / this.canvas.height), h, 1)
    this.object.position.set((P.n("x", 0.5) - 0.5) * worldW, yFrac(P.n("y", 0.82), worldH), 0)
  }
}

class VuMeterObject extends CanvasObject {
  constructor() { super(512, 512) }
  update(ctx: LayerCtx, layer: VizLayer) {
    const { P, frame, worldH, worldW } = ctx
    const c = this.canvas, x = this.cctx
    const W = c.width, H = c.height
    x.clearRect(0, 0, W, H)
    const seg = Math.round(P.n("segments", 20))
    const low = P.s("low", "#22c55e"); const high = P.s("high", "#ef4444")
    const barW = W * 0.32, gap = W * 0.06
    const segH = H / seg
    const drawCol = (bx: number, rms: number) => {
      const lit = Math.round(clamp01(rms) * seg)
      for (let i = 0; i < seg; i++) {
        const t = i / (seg - 1)
        x.fillStyle = i < lit ? (t > 0.8 ? high : t > 0.6 ? "#eab308" : low) : "rgba(255,255,255,0.08)"
        const y = H - (i + 1) * segH + segH * 0.1
        x.fillRect(bx, y, barW, segH * 0.8)
      }
    }
    drawCol(W / 2 - barW - gap / 2, frame.rmsL)
    drawCol(W / 2 + gap / 2, frame.rmsR)
    this.tex.needsUpdate = true
    const size = P.n("size", 0.5) * worldH
    this.object.scale.set(size, size, 1)
    this.object.position.set((P.n("x", 0.5) - 0.5) * worldW, yFrac(P.n("y", 0.5), worldH), 0)
  }
}

// ── stereo scope (line) ───────────────────────────────────────────────────────
class StereoScopeObject extends LayerObject {
  object: THREE.Group
  private a: THREE.Line; private b: THREE.Line
  private mat: THREE.LineBasicMaterial; private mat2: THREE.LineBasicMaterial
  private N = 512
  constructor() {
    super()
    this.mat = new THREE.LineBasicMaterial({ transparent: true, depthTest: false, depthWrite: false })
    this.mat2 = new THREE.LineBasicMaterial({ transparent: true, depthTest: false, depthWrite: false })
    const g1 = new THREE.BufferGeometry(); g1.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.N * 3), 3))
    const g2 = new THREE.BufferGeometry(); g2.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.N * 3), 3))
    this.a = new THREE.Line(g1, this.mat); this.b = new THREE.Line(g2, this.mat2)
    this.object = new THREE.Group(); this.object.add(this.a); this.object.add(this.b)
    this.materials = [this.mat, this.mat2]
  }
  update(ctx: LayerCtx, layer: VizLayer) {
    const { P, frame, worldH, worldW } = ctx
    this.mat.color.set(P.s("color1", "#22d3ee")); this.mat2.color.set(P.s("color2", "#f472b6"))
    const s = (worldH / 2) * P.n("scale", 0.6)
    const L = frame.waveL, R = frame.waveR
    const pa = this.a.geometry.getAttribute("position") as THREE.BufferAttribute
    const pb = this.b.geometry.getAttribute("position") as THREE.BufferAttribute
    const dual = P.s("mode", "lissajous") === "dual"
    const n = Math.min(this.N, L.length, R.length)
    if (dual) {
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1)
        const x = -worldW / 2 + u * worldW
        pa.setXYZ(i, x, worldH * 0.22 + ((L[i] - 128) / 128) * s, 0)
        pb.setXYZ(i, x, -worldH * 0.22 + ((R[i] - 128) / 128) * s, 0)
      }
      this.b.visible = true
    } else {
      const cos = Math.cos(Math.PI / 4), sin = Math.sin(Math.PI / 4)
      for (let i = 0; i < n; i++) {
        const lx = ((L[i] - 128) / 128) * s, ry = ((R[i] - 128) / 128) * s
        pa.setXYZ(i, lx * cos - ry * sin, lx * sin + ry * cos, 0)
      }
      this.b.visible = false
    }
    pa.needsUpdate = true; pb.needsUpdate = true
    this.a.geometry.setDrawRange(0, n); this.b.geometry.setDrawRange(0, n)
  }
}

// ── orbit light (sprites circling) ────────────────────────────────────────────
class OrbitObject extends LayerObject {
  object: THREE.Group
  private mat: THREE.SpriteMaterial
  private imgMat: THREE.SpriteMaterial
  private lastSrc: string | undefined
  private tex: THREE.Texture | null = null
  private MAX = 12
  private glows: THREE.Sprite[] = []
  private imgs: THREE.Sprite[] = []
  constructor() {
    super()
    this.mat = new THREE.SpriteMaterial({ map: discTexture(), transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })
    this.imgMat = new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false })
    this.object = new THREE.Group()
    for (let i = 0; i < this.MAX; i++) {
      const glow = new THREE.Sprite(this.mat); const img = new THREE.Sprite(this.imgMat)
      glow.visible = false; img.visible = false
      this.glows.push(glow); this.imgs.push(img)
      this.object.add(glow); this.object.add(img)
    }
    this.materials = [this.mat, this.imgMat]
  }
  update(ctx: LayerCtx, layer: VizLayer) {
    const { P, frame, worldH } = ctx
    if (layer.src !== this.lastSrc) {
      this.lastSrc = layer.src
      this.tex?.dispose()
      if (layer.src) { this.tex = new THREE.TextureLoader().load(layer.src); this.tex.colorSpace = THREE.SRGBColorSpace; this.imgMat.map = this.tex; this.imgMat.needsUpdate = true }
      else { this.imgMat.map = null; this.imgMat.needsUpdate = true }
    }
    const count = Math.min(this.MAX, Math.round(P.n("count", 1)))
    const rad = (P.n("radius", 0.28) + frame.bass * P.n("beatRadius", 0.06)) * worldH
    const objSize = P.n("size", 0.06) * worldH
    const speed = P.n("speed", 0.6)
    this.mat.color.set(P.s("color", "#ffffff"))
    const useImg = !!this.imgMat.map
    for (let i = 0; i < this.MAX; i++) {
      const on = i < count
      this.glows[i].visible = on && !useImg
      this.imgs[i].visible = on && useImg
      if (!on) continue
      const a = frame.time * speed + (i / count) * Math.PI * 2
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad
      this.glows[i].position.set(x, y, 0); this.glows[i].scale.setScalar(objSize * 3)
      this.imgs[i].position.set(x, y, 0); this.imgs[i].scale.setScalar(objSize * 2)
    }
  }
  dispose() { this.tex?.dispose(); super.dispose() }
}

// ── audio-reactive sphere (point cloud) ───────────────────────────────────────
const SNOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;
vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}`
const SPH_VERT = /* glsl */ `
uniform float uTime,uBass,uLevel,uDisplace,uFreq,uPointSize; varying float vD;
${SNOISE}
void main(){ vec3 n=normalize(position); float ns=snoise(n*uFreq+uTime*0.25);
float disp=(ns*0.5+0.5)*uDisplace*(0.35+uBass*1.4)+uLevel*0.12; vec3 p=position+n*disp; vD=disp;
vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=uPointSize*(300.0/-mv.z); gl_Position=projectionMatrix*mv; }`
const SPH_FRAG = /* glsl */ `
precision highp float; uniform vec3 uColorA,uColorB; uniform float uPoints; varying float vD;
void main(){ if(uPoints>0.5){ vec2 c=gl_PointCoord-0.5; if(dot(c,c)>0.25) discard; }
gl_FragColor=vec4(mix(uColorA,uColorB,clamp(vD*2.2,0.0,1.0)),1.0); }`

class SphereObject extends LayerObject {
  object: THREE.Group
  private points: THREE.Points
  private wire: THREE.Mesh
  private mat: THREE.ShaderMaterial
  private wmat: THREE.ShaderMaterial
  private geo: THREE.IcosahedronGeometry
  private detail = 4
  constructor() {
    super()
    const uniforms = {
      uTime: { value: 0 }, uBass: { value: 0 }, uLevel: { value: 0 }, uDisplace: { value: 0.5 },
      uFreq: { value: 1.8 }, uPointSize: { value: 6 }, uColorA: { value: C("#22d3ee") }, uColorB: { value: C("#7c3aed") }, uPoints: { value: 1 },
    }
    this.mat = new THREE.ShaderMaterial({ vertexShader: SPH_VERT, fragmentShader: SPH_FRAG, uniforms, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })
    this.wmat = new THREE.ShaderMaterial({ vertexShader: SPH_VERT, fragmentShader: SPH_FRAG, uniforms: { ...uniforms, uPoints: { value: 0 } }, wireframe: true, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })
    this.geo = new THREE.IcosahedronGeometry(0.55, this.detail)
    this.points = new THREE.Points(this.geo, this.mat)
    this.wire = new THREE.Mesh(this.geo, this.wmat)
    this.object = new THREE.Group(); this.object.add(this.points); this.object.add(this.wire)
    this.materials = [this.mat, this.wmat]
  }
  update(ctx: LayerCtx, layer: VizLayer) {
    const { P, frame, worldH } = ctx
    const detail = Math.round(P.n("detail", 4))
    if (detail !== this.detail) {
      this.detail = detail
      this.geo.dispose()
      this.geo = new THREE.IcosahedronGeometry(0.55, detail)
      this.points.geometry = this.geo; this.wire.geometry = this.geo
    }
    const u = this.mat.uniforms
    const radius = P.n("radius", 0.55) * worldH
    this.object.scale.setScalar(radius / 0.55)
    u.uTime.value = frame.time; u.uBass.value = frame.bass; u.uLevel.value = frame.level
    u.uDisplace.value = P.n("displace", 0.5); u.uFreq.value = P.n("noiseScale", 1.8); u.uPointSize.value = P.n("dot", 6)
    ;(u.uColorA.value as THREE.Color).set(P.s("color1", "#22d3ee"))
    ;(u.uColorB.value as THREE.Color).set(P.s("color2", "#7c3aed"))
    // wireframe material shares uniform objects (uTime etc.) except uPoints
    const wire = P.b("wire", false)
    this.points.visible = !wire; this.wire.visible = wire
    this.object.rotation.y += 0.0
    this.object.rotation.y = frame.time * P.n("spin", 0.25)
    this.object.rotation.x = Math.sin(frame.time * 0.2) * 0.3
  }
}

// ── factory ───────────────────────────────────────────────────────────────────
export function createLayerObject(type: LayerType): LayerObject {
  switch (type) {
    case "background": return new BackgroundObject()
    case "bars": return new BarsObject()
    case "wave": return new WaveObject()
    case "radial": return new RadialObject()
    case "particles": return new ParticlesObject()
    case "image": return new ImageObject()
    case "text": return new TextObject()
    case "vuMeter": return new VuMeterObject()
    case "stereoScope": return new StereoScopeObject()
    case "orbit": return new OrbitObject()
    case "sphere": return new SphereObject()
  }
}
