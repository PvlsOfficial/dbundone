// Reducer + undo/redo for a Cover Lab document.
//
// History strategy: structural edits (add/remove/reorder/toggle/preset) push an
// undo snapshot. Continuous field/param tweaks (slider drags, colour pickers)
// replace the current doc WITHOUT flooding history, so undo jumps back to the
// last structural change.

import { useCallback, useReducer } from "react"
import { instantiateDoc, makeEffect, makeLayer, newDoc } from "./engine/doc"
import {
  CoverDoc,
  EffectInstance,
  Layer,
  LayerType,
  ParamAnim,
  ParamValue,
} from "./engine/types"

interface HistoryState {
  doc: CoverDoc
  past: CoverDoc[]
  future: CoverDoc[]
}

type Action =
  | { type: "replace"; doc: CoverDoc; history?: boolean }
  | { type: "patchDoc"; patch: Partial<CoverDoc>; history?: boolean }
  | { type: "addLayer"; layerType: LayerType; opts?: Partial<Layer> }
  | { type: "updateLayer"; id: string; patch: Partial<Layer>; history?: boolean }
  | { type: "removeLayer"; id: string }
  | { type: "reorderLayer"; from: number; to: number }
  | { type: "addEffect"; effectId: string }
  | { type: "updateEffect"; id: string; patch: Partial<EffectInstance>; history?: boolean }
  | { type: "setEffectParam"; id: string; key: string; value: ParamValue }
  | { type: "setEffectAnim"; id: string; key: string; anim: ParamAnim | undefined }
  | { type: "removeEffect"; id: string }
  | { type: "reorderEffect"; from: number; to: number }
  | { type: "undo" }
  | { type: "redo" }

const MAX_HISTORY = 60

function withHistory(state: HistoryState, doc: CoverDoc, history: boolean): HistoryState {
  if (!history) return { ...state, doc }
  const past = [...state.past, state.doc].slice(-MAX_HISTORY)
  return { doc, past, future: [] }
}

function move<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

function reducer(state: HistoryState, action: Action): HistoryState {
  const { doc } = state
  switch (action.type) {
    case "replace":
      return withHistory(state, action.doc, action.history ?? true)
    case "patchDoc":
      return withHistory(state, { ...doc, ...action.patch }, action.history ?? false)
    case "addLayer": {
      const layer = makeLayer(action.layerType, action.opts)
      return withHistory(state, { ...doc, layers: [...doc.layers, layer] }, true)
    }
    case "updateLayer": {
      const layers = doc.layers.map((l) => (l.id === action.id ? ({ ...l, ...action.patch } as Layer) : l))
      return withHistory(state, { ...doc, layers }, action.history ?? false)
    }
    case "removeLayer":
      return withHistory(state, { ...doc, layers: doc.layers.filter((l) => l.id !== action.id) }, true)
    case "reorderLayer":
      return withHistory(state, { ...doc, layers: move(doc.layers, action.from, action.to) }, true)
    case "addEffect":
      return withHistory(state, { ...doc, effects: [...doc.effects, makeEffect(action.effectId)] }, true)
    case "updateEffect": {
      const effects = doc.effects.map((e) => (e.id === action.id ? { ...e, ...action.patch } : e))
      return withHistory(state, { ...doc, effects }, action.history ?? true)
    }
    case "setEffectParam": {
      const effects = doc.effects.map((e) =>
        e.id === action.id ? { ...e, params: { ...e.params, [action.key]: action.value } } : e
      )
      return withHistory(state, { ...doc, effects }, false)
    }
    case "setEffectAnim": {
      const effects = doc.effects.map((e) => {
        if (e.id !== action.id) return e
        const anim = { ...(e.anim || {}) }
        if (action.anim) anim[action.key] = action.anim
        else delete anim[action.key]
        return { ...e, anim: Object.keys(anim).length ? anim : undefined }
      })
      return withHistory(state, { ...doc, effects }, false)
    }
    case "removeEffect":
      return withHistory(state, { ...doc, effects: doc.effects.filter((e) => e.id !== action.id) }, true)
    case "reorderEffect":
      return withHistory(state, { ...doc, effects: move(doc.effects, action.from, action.to) }, true)
    case "undo": {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      return {
        doc: previous,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future].slice(0, MAX_HISTORY),
      }
    }
    case "redo": {
      if (state.future.length === 0) return state
      const next = state.future[0]
      return {
        doc: next,
        past: [...state.past, state.doc].slice(-MAX_HISTORY),
        future: state.future.slice(1),
      }
    }
    default:
      return state
  }
}

export function useCoverDoc(initial?: CoverDoc) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    doc: initial ? instantiateDoc(initial) : newDoc(),
    past: [],
    future: [],
  }))

  const api = {
    doc: state.doc,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    replace: useCallback((d: CoverDoc, history = true) => dispatch({ type: "replace", doc: d, history }), []),
    patchDoc: useCallback((patch: Partial<CoverDoc>, history = false) => dispatch({ type: "patchDoc", patch, history }), []),
    addLayer: useCallback((layerType: LayerType, opts?: Partial<Layer>) => dispatch({ type: "addLayer", layerType, opts }), []),
    updateLayer: useCallback((id: string, patch: Partial<Layer>, history = false) => dispatch({ type: "updateLayer", id, patch, history }), []),
    removeLayer: useCallback((id: string) => dispatch({ type: "removeLayer", id }), []),
    reorderLayer: useCallback((from: number, to: number) => dispatch({ type: "reorderLayer", from, to }), []),
    addEffect: useCallback((effectId: string) => dispatch({ type: "addEffect", effectId }), []),
    updateEffect: useCallback((id: string, patch: Partial<EffectInstance>, history = true) => dispatch({ type: "updateEffect", id, patch, history }), []),
    setEffectParam: useCallback((id: string, key: string, value: ParamValue) => dispatch({ type: "setEffectParam", id, key, value }), []),
    setEffectAnim: useCallback((id: string, key: string, anim: ParamAnim | undefined) => dispatch({ type: "setEffectAnim", id, key, anim }), []),
    removeEffect: useCallback((id: string) => dispatch({ type: "removeEffect", id }), []),
    reorderEffect: useCallback((from: number, to: number) => dispatch({ type: "reorderEffect", from, to }), []),
    undo: useCallback(() => dispatch({ type: "undo" }), []),
    redo: useCallback(() => dispatch({ type: "redo" }), []),
  }
  return api
}

export type CoverDocApi = ReturnType<typeof useCoverDoc>
