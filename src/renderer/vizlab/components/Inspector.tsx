// Inspector — the right-hand editor for the selected layer: image source,
// opacity/blend, a modulatable Transform, and the layer's parameters (each with
// LFO/audio modulation). Global post effects are edited in the FX tab.

import React from "react"
import { ImageIcon, Upload, X } from "lucide-react"
import { Slider, Switch, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Input, Label, Button } from "@/components/ui"
import { useToast } from "@/components/ui/toast"
import type { VizSceneApi } from "../useVizScene"
import { getLayerMeta } from "../layers"
import { ModField } from "./ModControls"
import type { ParamSpec, VizLayer } from "../types"

const BLENDS: { value: VizLayer["blend"]; label: string }[] = [
  { value: "normal", label: "Normal" }, { value: "add", label: "Add (glow)" },
  { value: "screen", label: "Screen" }, { value: "multiply", label: "Multiply" },
]

const TRANSFORM_SPECS = [
  { key: "posX", label: "Position X", min: -1, max: 1, step: 0.01 },
  { key: "posY", label: "Position Y", min: -1, max: 1, step: 0.01 },
  { key: "zoom", label: "Zoom", min: 0.1, max: 4, step: 0.01 },
  { key: "rot", label: "Rotation", min: -180, max: 180, step: 1, unit: "°" },
] as const

const isElectron = () => typeof window !== "undefined" && typeof window.electron !== "undefined"

export const Inspector: React.FC<{ api: VizSceneApi; layer: VizLayer; coverPath?: string | null }> = ({ api, layer, coverPath }) => {
  const meta = getLayerMeta(layer.type)
  const { addToast } = useToast()

  const setImageSrc = async (path: string | null | undefined) => {
    if (!path) return
    try {
      const src = isElectron() ? await window.electron!.readImageBase64(path) : path
      api.updateLayer(layer.id, { src }, true)
    } catch (e) {
      addToast({ title: "Couldn't load image", description: String(e), variant: "destructive" })
    }
  }
  const pickImage = async () => {
    if (!isElectron()) return
    const path = await window.electron!.selectImage()
    if (path) await setImageSrc(path)
  }

  const tf = layer.transform ?? { posX: 0, posY: 0, zoom: 1, rot: 0 }

  return (
    <div className="p-4 space-y-4">
      <div>
        <Input
          value={layer.name}
          onChange={(e) => api.updateLayer(layer.id, { name: e.target.value }, false)}
          onBlur={(e) => api.updateLayer(layer.id, { name: e.target.value }, true)}
          className="h-8 text-sm font-medium"
        />
        <p className="text-[11px] text-muted-foreground mt-1">{meta.name} layer</p>
      </div>

      {(layer.type === "image" || layer.type === "orbit") && (
        <div className="space-y-2">
          <Label className="text-[11px] text-muted-foreground">Source image</Label>
          {layer.src ? (
            <div className="relative">
              <img src={layer.src} alt="" className="w-full h-28 object-cover rounded-md border border-border/40" />
              <button onClick={() => api.updateLayer(layer.id, { src: undefined }, true)} title="Remove image"
                className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 text-white/90 hover:bg-black/80">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="w-full h-28 rounded-md border border-dashed border-border/50 flex items-center justify-center text-[11px] text-muted-foreground">
              {layer.type === "orbit" ? "Optional — glowing dot if empty" : "No image selected"}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-8 gap-1.5 text-xs" onClick={pickImage}>
              <Upload className="w-3.5 h-3.5" /> Choose photo
            </Button>
            <Button variant="outline" size="sm" className="flex-1 h-8 gap-1.5 text-xs" disabled={!coverPath} onClick={() => setImageSrc(coverPath)}>
              <ImageIcon className="w-3.5 h-3.5" /> Project cover
            </Button>
          </div>
          {layer.type === "image" && <p className="text-[10px] text-muted-foreground/70">Tip: enable “Follow track cover” to auto-swap on song change.</p>}
          <div className="h-px bg-border/40 my-1" />
        </div>
      )}

      <Row label={`Opacity ${Math.round(layer.opacity * 100)}%`}>
        <Slider value={[layer.opacity]} min={0} max={1} step={0.01}
          onValueChange={([v]) => api.updateLayer(layer.id, { opacity: v }, false)}
          onValueCommit={([v]) => api.updateLayer(layer.id, { opacity: v }, true)} />
      </Row>
      <Row label="Blend mode">
        <Select value={layer.blend} onValueChange={(v) => api.updateLayer(layer.id, { blend: v as VizLayer["blend"] })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{BLENDS.map((m) => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}</SelectContent>
        </Select>
      </Row>

      <Section title="Transform">
        {TRANSFORM_SPECS.map((s) => (
          <ModField key={s.key} spec={s}
            value={(tf as unknown as Record<string, number>)[s.key] ?? (s.key === "zoom" ? 1 : 0)}
            mod={layer.mod?.[s.key]}
            onValue={(v, commit) => api.setTransform(layer.id, { [s.key]: v }, commit)}
            onMod={(m) => api.setMod(layer.id, s.key, m)} />
        ))}
      </Section>

      <Section title="Properties">
        {meta.params.map((p) => <LayerParamRow key={p.key} spec={p} layer={layer} api={api} />)}
      </Section>
    </div>
  )
}

const LayerParamRow: React.FC<{ spec: ParamSpec; layer: VizLayer; api: VizSceneApi }> = ({ spec, layer, api }) => {
  const value = layer.params[spec.key]
  if (spec.type === "range") {
    return (
      <ModField spec={spec} value={typeof value === "number" ? value : spec.default} mod={layer.mod?.[spec.key]}
        onValue={(v, commit) => api.setParam(layer.id, spec.key, v, commit)} onMod={(m) => api.setMod(layer.id, spec.key, m)} />
    )
  }
  return <BasicParamRow spec={spec} value={value} onChange={(v, commit = true) => api.setParam(layer.id, spec.key, v, commit)} />
}

export const BasicParamRow: React.FC<{ spec: ParamSpec; value: unknown; onChange: (v: number | string | boolean, commit?: boolean) => void }> = ({ spec, value, onChange }) => {
  if (spec.type === "color") {
    const v = typeof value === "string" ? value : spec.default
    return (
      <Row label={spec.label}>
        <div className="flex items-center gap-2">
          <input type="color" value={v} onChange={(e) => onChange(e.target.value, false)} onBlur={(e) => onChange(e.target.value, true)}
            title={spec.label} className="h-8 w-10 rounded border border-border/40 bg-transparent cursor-pointer p-0.5" />
          <Input value={v} onChange={(e) => onChange(e.target.value, true)} className="h-8 text-xs font-mono flex-1" />
        </div>
      </Row>
    )
  }
  if (spec.type === "bool") {
    const v = typeof value === "boolean" ? value : spec.default
    return (
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">{spec.label}</Label>
        <Switch checked={v} onCheckedChange={(c) => onChange(c, true)} />
      </div>
    )
  }
  if (spec.type === "select") {
    const v = typeof value === "string" ? value : spec.default
    return (
      <Row label={spec.label}>
        <Select value={v} onValueChange={(x) => onChange(x, true)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{spec.options.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </Row>
    )
  }
  const v = typeof value === "string" ? value : spec.default
  return (
    <Row label={spec.label}>
      <Input value={v} onChange={(e) => onChange(e.target.value, false)} onBlur={(e) => onChange(e.target.value, true)} className="h-8 text-xs" />
    </Row>
  )
}

export const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-[11px] text-muted-foreground">{label}</Label>
    {children}
  </div>
)

export const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <div className="h-px bg-border/40" />
    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">{title}</span>
    {children}
  </div>
)
