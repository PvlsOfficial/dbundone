// ThreeEngine — owns the renderer, scene, perspective camera and the global
// post-processing composer. Reconciles the layer stack into Three objects and
// drives a global FX chain (bloom, chromatic aberration, …), all audio-reactive.

import * as THREE from "three"
import { EffectComposer, EffectPass, RenderPass, type Effect } from "postprocessing"
import { makeResolver, resolveNumber } from "../audioMath"
import { layerParamRanges } from "../layers"
import type { AudioFrame, EffectInstance, VizLayer, VizScene } from "../types"
import { createLayerObject, type LayerCtx, type LayerObject } from "./layerObjects"
import { effectParamRanges, getPostFXDef } from "./postfx"

const FOV = 45
const CAM_DIST = 1 / Math.tan((FOV / 2) * (Math.PI / 180)) // so visible half-height at z=0 is 1

const BLEND: Record<VizLayer["blend"], THREE.Blending> = {
  normal: THREE.NormalBlending,
  add: THREE.AdditiveBlending,
  screen: THREE.AdditiveBlending,
  multiply: THREE.MultiplyBlending,
}

interface FxEntry { def: ReturnType<typeof getPostFXDef>; effect: Effect }

export class ThreeEngine {
  readonly renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private composer: EffectComposer
  private renderPass: RenderPass
  private effectPass: EffectPass | null = null
  private objects = new Map<string, { obj: LayerObject; group: THREE.Group }>()
  private fx = new Map<string, FxEntry>()
  private fxSig = ""

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor(0x000000, 1)
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100)
    this.camera.position.z = CAM_DIST
    this.composer = new EffectComposer(this.renderer)
    this.renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(this.renderPass)
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement
  }

  setSize(w: number, h: number) {
    this.renderer.setSize(w, h, false)
    this.composer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  /** Reconcile the layer stack and global FX chain with the scene. */
  sync(scene: VizScene) {
    const seen = new Set<string>()
    scene.layers.forEach((layer, i) => {
      seen.add(layer.id)
      let entry = this.objects.get(layer.id)
      if (!entry) {
        const obj = createLayerObject(layer.type)
        const group = new THREE.Group()
        group.add(obj.object)
        this.scene.add(group)
        entry = { obj, group }
        this.objects.set(layer.id, entry)
      }
      entry.group.traverse((o) => { o.renderOrder = i })
    })
    for (const [id, entry] of [...this.objects]) {
      if (seen.has(id)) continue
      this.scene.remove(entry.group)
      entry.obj.dispose()
      this.objects.delete(id)
    }
    this.syncEffects(scene.effects)
  }

  private syncEffects(effects: EffectInstance[]) {
    const enabled = effects.filter((e) => e.enabled)
    const sig = enabled.map((e) => e.type).join(",") + "|" + effects.map((e) => e.id + e.enabled).join(",")
    if (sig === this.fxSig) return
    this.fxSig = sig
    if (this.effectPass) {
      this.composer.removePass(this.effectPass)
      this.effectPass.dispose()
      this.effectPass = null
    }
    this.fx.clear()
    if (enabled.length > 0) {
      const built: Effect[] = []
      for (const inst of enabled) {
        const def = getPostFXDef(inst.type)
        const effect = def.create()
        this.fx.set(inst.id, { def, effect })
        built.push(effect)
      }
      this.effectPass = new EffectPass(this.camera, ...built)
      this.composer.addPass(this.effectPass)
    }
  }

  /** Update every object + effect for this frame and render. */
  render(scene: VizScene, frame: AudioFrame) {
    const size = new THREE.Vector2()
    this.renderer.getSize(size)
    const aspect = size.x / Math.max(1, size.y)
    const worldH = 2
    const worldW = 2 * aspect
    const ctx: LayerCtx = { worldW, worldH, aspect, frame, P: makeResolver({}, undefined, frame), time: frame.time }

    for (const layer of scene.layers) {
      const entry = this.objects.get(layer.id)
      if (!entry) continue
      entry.group.visible = layer.visible && layer.opacity > 0
      if (!entry.group.visible) continue
      const P = makeResolver(layer.params, layer.mod, frame, layerParamRanges(layer.type))
      ctx.P = P
      // transform on the wrapper group (additive over the object's own layout)
      const posX = mn(layer, "posX", 0, frame), posY = mn(layer, "posY", 0, frame)
      const zoom = mn(layer, "zoom", 1, frame), rot = mn(layer, "rot", 0, frame)
      entry.group.position.set(posX * worldW / 2, -posY * worldH / 2, 0)
      entry.group.scale.setScalar(zoom)
      entry.group.rotation.z = -rot * (Math.PI / 180)
      // common material props
      const blend = BLEND[layer.blend] ?? THREE.NormalBlending
      for (const m of entry.obj.materials) {
        m.transparent = true
        m.opacity = layer.opacity
        m.blending = blend
        m.depthTest = false
        m.depthWrite = false
      }
      try {
        entry.obj.update(ctx, layer)
      } catch {
        /* one bad layer shouldn't kill the frame */
      }
    }

    // global FX params (modulatable)
    for (const inst of scene.effects) {
      const e = this.fx.get(inst.id)
      if (!e) continue
      const P = makeResolver(inst.params, inst.mod, frame, effectParamRanges(inst.type))
      try { e.def.update(e.effect, P, frame) } catch { /* ignore */ }
    }

    this.composer.render()
  }

  dispose() {
    for (const { obj, group } of this.objects.values()) { this.scene.remove(group); obj.dispose() }
    this.objects.clear()
    this.effectPass?.dispose()
    this.composer.dispose()
    this.renderer.dispose()
  }
}

/** Resolve a transform key with its modulation (transform values live on layer.transform). */
function mn(layer: VizLayer, key: string, fallback: number, frame: AudioFrame): number {
  const tf = layer.transform as Record<string, number> | undefined
  const base = tf && typeof tf[key] === "number" ? tf[key] : fallback
  return resolveNumber(base, layer.mod?.[key], frame)
}
