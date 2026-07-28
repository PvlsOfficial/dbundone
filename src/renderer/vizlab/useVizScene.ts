// useVizScene — scene state with a small undo/redo history. Layers carry params,
// transform and modulation; the scene carries a global post-FX chain.

import { useCallback, useMemo, useRef, useState } from "react"
import { identityTransform, makeEffect, makeLayer } from "./presets"
import type { LayerType, ParamMod, ParamValue, PostFXType, Transform, VizLayer, VizScene } from "./types"

const HISTORY_LIMIT = 60

interface History {
  past: VizScene[]
  present: VizScene
  future: VizScene[]
}

export interface VizSceneApi {
  scene: VizScene
  selectedId: string | null
  select: (id: string | null) => void
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  replace: (scene: VizScene, commit?: boolean) => void
  patchScene: (patch: Partial<VizScene>, commit?: boolean) => void
  // layers
  addLayer: (type: LayerType, overrides?: Partial<VizLayer>) => void
  removeLayer: (id: string) => void
  updateLayer: (id: string, patch: Partial<VizLayer>, commit?: boolean) => void
  setParam: (id: string, key: string, value: ParamValue, commit?: boolean) => void
  moveLayer: (id: string, dir: -1 | 1) => void
  duplicateLayer: (id: string) => void
  setTransform: (id: string, patch: Partial<Transform>, commit?: boolean) => void
  setMod: (id: string, key: string, mod: ParamMod | undefined, commit?: boolean) => void
  // global effects
  addEffect: (type: PostFXType) => void
  removeEffect: (id: string) => void
  toggleEffect: (id: string) => void
  moveEffect: (id: string, dir: -1 | 1) => void
  setEffectParam: (id: string, key: string, value: ParamValue, commit?: boolean) => void
  setEffectMod: (id: string, key: string, mod: ParamMod | undefined, commit?: boolean) => void
}

export function useVizScene(initial: VizScene): VizSceneApi {
  const [history, setHistory] = useState<History>({ past: [], present: initial, future: [] })
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.layers.find((l) => l.type !== "background")?.id ?? initial.layers[0]?.id ?? null,
  )
  const historyRef = useRef(history)
  historyRef.current = history

  const apply = useCallback((next: VizScene, commit: boolean) => {
    setHistory((h) => {
      if (!commit) return { ...h, present: next }
      const past = [...h.past, h.present].slice(-HISTORY_LIMIT)
      return { past, present: next, future: [] }
    })
  }, [])

  const replace = useCallback((scene: VizScene, commit = true) => apply(scene, commit), [apply])
  const patchScene = useCallback(
    (patch: Partial<VizScene>, commit = true) => apply({ ...historyRef.current.present, ...patch }, commit),
    [apply],
  )

  const mutateLayers = useCallback(
    (fn: (layers: VizLayer[]) => VizLayer[], commit: boolean) => {
      const cur = historyRef.current.present
      apply({ ...cur, layers: fn(cur.layers) }, commit)
    },
    [apply],
  )

  const addLayer = useCallback((type: LayerType, overrides?: Partial<VizLayer>) => {
    const layer = makeLayer(type, overrides)
    mutateLayers((ls) => [...ls, layer], true)
    setSelectedId(layer.id)
  }, [mutateLayers])

  const removeLayer = useCallback((id: string) => {
    mutateLayers((ls) => ls.filter((l) => l.id !== id), true)
    setSelectedId((sel) => (sel === id ? null : sel))
  }, [mutateLayers])

  const updateLayer = useCallback((id: string, patch: Partial<VizLayer>, commit = true) =>
    mutateLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)), commit), [mutateLayers])

  const setParam = useCallback((id: string, key: string, value: ParamValue, commit = true) =>
    mutateLayers((ls) => ls.map((l) => (l.id === id ? { ...l, params: { ...l.params, [key]: value } } : l)), commit), [mutateLayers])

  const moveLayer = useCallback((id: string, dir: -1 | 1) =>
    mutateLayers((ls) => {
      const i = ls.findIndex((l) => l.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= ls.length) return ls
      const next = [...ls]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    }, true), [mutateLayers])

  const duplicateLayer = useCallback((id: string) =>
    mutateLayers((ls) => {
      const i = ls.findIndex((l) => l.id === id)
      if (i < 0) return ls
      const src = ls[i]
      const copy = makeLayer(src.type, {
        name: `${src.name} copy`, opacity: src.opacity, blend: src.blend, visible: src.visible, src: src.src,
        params: { ...src.params }, transform: { ...(src.transform ?? identityTransform()) }, mod: { ...(src.mod ?? {}) },
      })
      const next = [...ls]
      next.splice(i + 1, 0, copy)
      return next
    }, true), [mutateLayers])

  const setTransform = useCallback((id: string, patch: Partial<Transform>, commit = true) =>
    mutateLayers((ls) => ls.map((l) => (l.id === id ? { ...l, transform: { ...identityTransform(), ...l.transform, ...patch } } : l)), commit), [mutateLayers])

  const setMod = useCallback((id: string, key: string, mod: ParamMod | undefined, commit = true) =>
    mutateLayers((ls) => ls.map((l) => {
      if (l.id !== id) return l
      const next = { ...(l.mod || {}) }
      if (mod) next[key] = mod; else delete next[key]
      return { ...l, mod: next }
    }), commit), [mutateLayers])

  // ── global effects ──────────────────────────────────────────────────────────
  const mutateEffects = useCallback((fn: (fx: VizScene["effects"]) => VizScene["effects"], commit: boolean) => {
    const cur = historyRef.current.present
    apply({ ...cur, effects: fn(cur.effects) }, commit)
  }, [apply])

  const addEffect = useCallback((type: PostFXType) => mutateEffects((fx) => [...fx, makeEffect(type)], true), [mutateEffects])
  const removeEffect = useCallback((id: string) => mutateEffects((fx) => fx.filter((e) => e.id !== id), true), [mutateEffects])
  const toggleEffect = useCallback((id: string) => mutateEffects((fx) => fx.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e)), true), [mutateEffects])
  const moveEffect = useCallback((id: string, dir: -1 | 1) => mutateEffects((fx) => {
    const arr = [...fx]
    const i = arr.findIndex((e) => e.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= arr.length) return arr
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    return arr
  }, true), [mutateEffects])
  const setEffectParam = useCallback((id: string, key: string, value: ParamValue, commit = true) =>
    mutateEffects((fx) => fx.map((e) => (e.id === id ? { ...e, params: { ...e.params, [key]: value } } : e)), commit), [mutateEffects])
  const setEffectMod = useCallback((id: string, key: string, mod: ParamMod | undefined, commit = true) =>
    mutateEffects((fx) => fx.map((e) => {
      if (e.id !== id) return e
      const next = { ...(e.mod || {}) }
      if (mod) next[key] = mod; else delete next[key]
      return { ...e, mod: next }
    }), commit), [mutateEffects])

  const undo = useCallback(() => setHistory((h) => {
    if (h.past.length === 0) return h
    const prev = h.past[h.past.length - 1]
    return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] }
  }), [])
  const redo = useCallback(() => setHistory((h) => {
    if (h.future.length === 0) return h
    const next = h.future[0]
    return { past: [...h.past, h.present], present: next, future: h.future.slice(1) }
  }), [])

  return useMemo(() => ({
    scene: history.present, selectedId, select: setSelectedId,
    canUndo: history.past.length > 0, canRedo: history.future.length > 0, undo, redo,
    replace, patchScene,
    addLayer, removeLayer, updateLayer, setParam, moveLayer, duplicateLayer, setTransform, setMod,
    addEffect, removeEffect, toggleEffect, moveEffect, setEffectParam, setEffectMod,
  }), [history, selectedId, undo, redo, replace, patchScene, addLayer, removeLayer, updateLayer, setParam, moveLayer,
    duplicateLayer, setTransform, setMod, addEffect, removeEffect, toggleEffect, moveEffect, setEffectParam, setEffectMod])
}
