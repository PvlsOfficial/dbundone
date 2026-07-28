// Factory helpers for building Cover Lab documents, layers and effect instances.

import { getEffectDef, CUSTOM_FRAG_DEFAULT } from "./effects"
import {
  CoverDoc,
  EffectInstance,
  GradientLayer,
  ImageLayer,
  Layer,
  LayerType,
  ParamValue,
  SolidLayer,
  TextLayer,
} from "./types"

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function defaultParams(effectId: string): Record<string, ParamValue> {
  const def = getEffectDef(effectId)
  const out: Record<string, ParamValue> = {}
  if (!def) return out
  for (const p of def.params) out[p.key] = p.default
  return out
}

export function makeEffect(effectId: string): EffectInstance {
  const inst: EffectInstance = {
    id: newId(),
    effectId,
    enabled: true,
    params: defaultParams(effectId),
  }
  if (effectId === "custom") inst.customFrag = CUSTOM_FRAG_DEFAULT
  return inst
}

const baseTransform = { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1, blend: "source-over" as const, visible: true }

export function makeLayer(type: LayerType, opts: Partial<Layer> = {}): Layer {
  const id = newId()
  switch (type) {
    case "image":
      return {
        id,
        name: "Image",
        type: "image",
        src: "",
        fit: "cover",
        gifSpeed: 1,
        ...baseTransform,
        ...opts,
      } as ImageLayer
    case "text":
      return {
        id,
        name: "Text",
        type: "text",
        text: "TITLE",
        font: "Geist, sans-serif",
        weight: 700,
        size: 0.16,
        color: "#ffffff",
        align: "center",
        letterSpacing: 0,
        ...baseTransform,
        ...opts,
      } as TextLayer
    case "gradient":
      return {
        id,
        name: "Gradient",
        type: "gradient",
        from: "#1a0033",
        to: "#ff0066",
        angle: 45,
        ...baseTransform,
        ...opts,
      } as GradientLayer
    case "solid":
    default:
      return {
        id,
        name: "Solid",
        type: "solid",
        color: "#101014",
        ...baseTransform,
        ...opts,
      } as SolidLayer
  }
}

/** A blank canvas — a single neutral backdrop, no effects. The lab opens on this. */
export function newDoc(): CoverDoc {
  return {
    width: 1024,
    height: 1024,
    background: "#000000",
    layers: [makeLayer("solid", { name: "Background", color: "#0b0b0f" })],
    effects: [],
    animation: { fps: 16, durationSec: 3 },
  }
}

/** Deep-clone a doc but assign fresh ids (used when applying a preset). */
export function instantiateDoc(doc: CoverDoc): CoverDoc {
  const cloneEffect = (e: EffectInstance): EffectInstance => ({
    ...e,
    id: newId(),
    params: { ...e.params },
    anim: e.anim ? { ...e.anim } : undefined,
  })
  return {
    ...doc,
    layers: doc.layers.map((l) => ({
      ...l,
      id: newId(),
      effects: l.effects?.map(cloneEffect),
      anim: l.anim ? { ...l.anim } : undefined,
    })),
    effects: doc.effects.map(cloneEffect),
    animation: { ...doc.animation },
  }
}
