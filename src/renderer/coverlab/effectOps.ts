// A small abstraction over "a chain of effects" so the same UI can drive both the
// document-wide effect stack and a single layer's own effect chain.

import { CoverDocApi } from "./useCoverDoc"
import { makeEffect } from "./engine/doc"
import { randomEffects } from "./engine/randomize"
import { EffectInstance, Layer, ParamAnim, ParamValue } from "./engine/types"

export interface EffectOps {
  /** Owner label, e.g. "Whole cover" or a layer name. */
  effects: EffectInstance[]
  add: (effectId: string) => void
  remove: (instId: string) => void
  update: (instId: string, patch: Partial<EffectInstance>) => void
  setParam: (instId: string, key: string, value: ParamValue) => void
  setAnim: (instId: string, key: string, anim: ParamAnim | undefined) => void
  reorder: (from: number, to: number) => void
  randomize: () => void
}

function move<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

/** Effect ops bound to the document-wide effect chain. */
export function docEffectOps(api: CoverDocApi): EffectOps {
  return {
    effects: api.doc.effects,
    add: (id) => api.addEffect(id),
    remove: (id) => api.removeEffect(id),
    update: (id, patch) => api.updateEffect(id, patch),
    setParam: (id, key, value) => api.setEffectParam(id, key, value),
    setAnim: (id, key, anim) => api.setEffectAnim(id, key, anim),
    reorder: (from, to) => api.reorderEffect(from, to),
    randomize: () => api.patchDoc({ effects: randomEffects() }, true),
  }
}

/**
 * Effect ops bound to one layer's own effect chain. Each op recomputes the
 * layer's effects array and writes it back through updateLayer (continuous param
 * tweaks skip history, structural edits push it).
 */
export function layerEffectOps(api: CoverDocApi, layer: Layer): EffectOps {
  const effects = layer.effects ?? []
  const set = (next: EffectInstance[], history: boolean) =>
    api.updateLayer(layer.id, { effects: next }, history)
  return {
    effects,
    add: (id) => set([...effects, makeEffect(id)], true),
    remove: (iid) => set(effects.filter((e) => e.id !== iid), true),
    update: (iid, patch) => set(effects.map((e) => (e.id === iid ? { ...e, ...patch } : e)), true),
    setParam: (iid, key, value) =>
      set(effects.map((e) => (e.id === iid ? { ...e, params: { ...e.params, [key]: value } } : e)), false),
    setAnim: (iid, key, anim) =>
      set(
        effects.map((e) => {
          if (e.id !== iid) return e
          const a = { ...(e.anim || {}) }
          if (anim) a[key] = anim
          else delete a[key]
          return { ...e, anim: Object.keys(a).length ? a : undefined }
        }),
        false
      ),
    reorder: (from, to) => set(move(effects, from, to), true),
    randomize: () => set(randomEffects(), true),
  }
}
