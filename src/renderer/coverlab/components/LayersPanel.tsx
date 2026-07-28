import React, { useEffect, useRef, useState } from "react"
import {
  Eye,
  EyeOff,
  Trash2,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  Type,
  Square,
  Layers as LayersIcon,
  Upload,
  GripVertical,
} from "lucide-react"
import { Button, Input, Slider, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { cn } from "@/lib/utils"
import { CoverDocApi } from "../useCoverDoc"
import { BLEND_MODES, ImageLayer, Layer, ParamAnim, ParamSpec, TextLayer, SolidLayer, GradientLayer } from "../engine/types"
import { getAvailableFonts } from "../engine/fonts"
import { NumberInput } from "./NumberInput"
import { ParamControl } from "./ParamControl"

interface LayersPanelProps {
  api: CoverDocApi
  selectedId: string | null
  onSelect: (id: string | null) => void
}

const TYPE_ICON: Record<Layer["type"], React.ReactNode> = {
  image: <ImageIcon className="w-3.5 h-3.5" />,
  text: <Type className="w-3.5 h-3.5" />,
  solid: <Square className="w-3.5 h-3.5" />,
  gradient: <LayersIcon className="w-3.5 h-3.5" />,
}

export const LayersPanel: React.FC<LayersPanelProps> = ({ api, selectedId, onSelect }) => {
  const { doc } = api
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selected = doc.layers.find((l) => l.id === selectedId) || null

  // Layers are stored bottom-first; show top-first in the UI.
  const display = [...doc.layers].reverse()

  // Pointer-based reorder (Tauri's dragDropEnabled webview swallows HTML5 DnD).
  const [dragId, setDragId] = useState<string | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const displayRef = useRef(display)
  displayRef.current = display
  const dragIdRef = useRef<string | null>(null)
  const overIndexRef = useRef<number | null>(null)

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = String(reader.result)
      api.addLayer("image", { name: file.name.slice(0, 24), src })
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const startReorder = (e: React.PointerEvent, layerId: string) => {
    e.preventDefault()
    e.stopPropagation()
    dragIdRef.current = layerId
    setDragId(layerId)

    const onMove = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const row = el?.closest("[data-display-index]") as HTMLElement | null
      const idx = row ? Number(row.dataset.displayIndex) : null
      overIndexRef.current = idx
      setOverIndex(idx)
    }
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      const from = displayRef.current.findIndex((l) => l.id === dragIdRef.current)
      const to = overIndexRef.current
      if (from !== -1 && to != null && from !== to) {
        const reordered = [...displayRef.current]
        const [moved] = reordered.splice(from, 1)
        reordered.splice(to, 0, moved)
        // Convert top-first display order back to bottom-first storage order.
        api.patchDoc({ layers: [...reordered].reverse() }, true)
      }
      dragIdRef.current = null
      overIndexRef.current = null
      setDragId(null)
      setOverIndex(null)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/30">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mr-auto">Layers</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Add image / GIF" onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Add text" onClick={() => api.addLayer("text")}>
          <Type className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Add gradient" onClick={() => api.addLayer("gradient")}>
          <LayersIcon className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Add solid" onClick={() => api.addLayer("solid")}>
          <Square className="w-3.5 h-3.5" />
        </Button>
        <input ref={fileInputRef} type="file" accept="image/*,image/gif" className="hidden" onChange={handleUpload} aria-label="Upload image or GIF layer" />
      </div>

      <div className="overflow-y-auto max-h-[40%] border-b border-border/30">
        {display.length === 0 && <p className="text-xs text-muted-foreground p-3">No layers yet.</p>}
        {display.map((layer, displayIndex) => {
          const realIndex = doc.layers.findIndex((l) => l.id === layer.id)
          return (
            <div
              key={layer.id}
              data-display-index={displayIndex}
              onClick={() => onSelect(layer.id)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-2 cursor-pointer text-sm border-l-2 transition-colors",
                selectedId === layer.id ? "bg-primary/10 border-primary" : "border-transparent hover:bg-muted/40",
                dragId === layer.id && "opacity-40",
                dragId !== null && overIndex === displayIndex && dragId !== layer.id && "border-t-2 border-t-primary"
              )}
            >
              <span
                className="text-muted-foreground/50 cursor-grab active:cursor-grabbing touch-none"
                title="Drag to reorder"
                onPointerDown={(e) => startReorder(e, layer.id)}
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="w-3.5 h-3.5" />
              </span>
              <span className="text-muted-foreground">{TYPE_ICON[layer.type]}</span>
              <span className="truncate flex-1">{layer.name}</span>
              {layer.effects?.some((e) => e.enabled) && (
                <span className="text-[9px] px-1 rounded bg-primary/15 text-primary" title="This layer has its own effects">
                  fx
                </span>
              )}
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground p-0.5"
                title={layer.visible ? "Hide" : "Show"}
                onClick={(e) => { e.stopPropagation(); api.updateLayer(layer.id, { visible: !layer.visible }, true) }}
              >
                {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground p-0.5 disabled:opacity-30"
                title="Move up"
                disabled={realIndex >= doc.layers.length - 1}
                onClick={(e) => { e.stopPropagation(); api.reorderLayer(realIndex, realIndex + 1) }}
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground p-0.5 disabled:opacity-30"
                title="Move down"
                disabled={realIndex <= 0}
                onClick={(e) => { e.stopPropagation(); api.reorderLayer(realIndex, realIndex - 1) }}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive p-0.5"
                title="Delete"
                onClick={(e) => { e.stopPropagation(); if (selectedId === layer.id) onSelect(null); api.removeLayer(layer.id) }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {selected ? (
          <LayerEditor key={selected.id} api={api} layer={selected} />
        ) : (
          <p className="text-xs text-muted-foreground">Select a layer to edit its properties.</p>
        )}
      </div>
    </div>
  )
}

const RangeRow: React.FC<{ label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }> = ({ label, value, min, max, step, onChange }) => (
  <div className="space-y-1">
    <div className="flex justify-between items-center gap-2">
      <label className="text-xs text-muted-foreground">{label}</label>
      <NumberInput value={value} min={min} max={max} step={step} onChange={onChange} ariaLabel={label} />
    </div>
    <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
  </div>
)

/** Write/clear one animation envelope on a layer (continuous, no history flood). */
function setLayerAnim(api: CoverDocApi, layer: Layer, prop: string, anim: ParamAnim | undefined) {
  const next = { ...(layer.anim || {}) }
  if (anim) next[prop] = anim
  else delete next[prop]
  api.updateLayer(layer.id, { anim: Object.keys(next).length ? next : undefined }, false)
}

/** A numeric layer property with an inline "animate over time" envelope. */
const AnimRange: React.FC<{ api: CoverDocApi; layer: Layer; prop: string; label: string; min: number; max: number; step: number }> = ({ api, layer, prop, label, min, max, step }) => {
  const value = Number((layer as unknown as Record<string, unknown>)[prop] ?? 0)
  const spec: ParamSpec = { key: prop, label, type: "range", min, max, step, default: value }
  return (
    <ParamControl
      spec={spec}
      value={value}
      onChange={(v) => api.updateLayer(layer.id, { [prop]: Number(v) } as Partial<Layer>, false)}
      anim={layer.anim?.[prop]}
      onAnimChange={(a) => setLayerAnim(api, layer, prop, a)}
    />
  )
}

/** A colour layer property with an inline hue-cycle envelope. */
const AnimColor: React.FC<{ api: CoverDocApi; layer: Layer; prop: string; label: string }> = ({ api, layer, prop, label }) => {
  const value = String((layer as unknown as Record<string, unknown>)[prop] ?? "#ffffff")
  const spec: ParamSpec = { key: prop, label, type: "color", default: value }
  return (
    <ParamControl
      spec={spec}
      value={value}
      onChange={(v) => api.updateLayer(layer.id, { [prop]: String(v) } as Partial<Layer>, false)}
      anim={layer.anim?.[prop]}
      onAnimChange={(a) => setLayerAnim(api, layer, prop, a)}
    />
  )
}

const LayerEditor: React.FC<{ api: CoverDocApi; layer: Layer }> = ({ api, layer }) => {
  const u = (patch: Partial<Layer>, history = false) => api.updateLayer(layer.id, patch, history)

  return (
    <div className="space-y-3">
      <Input
        value={layer.name}
        onChange={(e) => u({ name: e.target.value })}
        className="h-8 text-sm"
        placeholder="Layer name"
      />

      {/* Type-specific controls */}
      {layer.type === "text" && <TextControls api={api} layer={layer as TextLayer} u={u} />}
      {layer.type === "solid" && <SolidControls api={api} layer={layer as SolidLayer} />}
      {layer.type === "gradient" && <GradientControls api={api} layer={layer as GradientLayer} u={u} />}
      {layer.type === "image" && <ImageControls layer={layer as ImageLayer} u={u} />}

      <div className="h-px bg-border/40" />

      {/* Transform — the clock icon on each animates it over the loop */}
      <AnimRange api={api} layer={layer} prop="x" label="X" min={-0.5} max={1.5} step={0.005} />
      <AnimRange api={api} layer={layer} prop="y" label="Y" min={-0.5} max={1.5} step={0.005} />
      <AnimRange api={api} layer={layer} prop="scale" label="Scale" min={0.05} max={4} step={0.01} />
      <AnimRange api={api} layer={layer} prop="rotation" label="Rotation" min={-180} max={180} step={1} />
      <AnimRange api={api} layer={layer} prop="opacity" label="Opacity" min={0} max={1} step={0.01} />

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Blend</label>
        <Select value={layer.blend} onValueChange={(v) => u({ blend: v as Layer["blend"] }, true)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {BLEND_MODES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

const ColorRow: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between">
    <label className="text-xs text-muted-foreground">{label}</label>
    <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 rounded border border-border/50 bg-transparent cursor-pointer" aria-label={label} />
  </div>
)

// Custom searchable font combobox — native <datalist> is unreliable in WebView2.
const FontPicker: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [fonts, setFonts] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState("")
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    getAvailableFonts().then((list) => { if (!cancelled) setFonts(list) })
    return () => { cancelled = true }
  }, [])

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener("mousedown", onDown)
    return () => window.removeEventListener("mousedown", onDown)
  }, [open])

  const filtered = filter
    ? fonts.filter((f) => f.toLowerCase().includes(filter.toLowerCase()))
    : fonts

  const pick = (f: string) => {
    onChange(f)
    setOpen(false)
    setFilter("")
  }

  return (
    <div className="space-y-1" ref={boxRef}>
      <label className="text-xs text-muted-foreground">Font ({fonts.length || "…"})</label>
      <div className="relative">
        <input
          value={open ? filter : value}
          onChange={(e) => { setFilter(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => { setOpen(true); setFilter("") }}
          placeholder="Search fonts…"
          aria-label="Font family"
          className="w-full h-8 px-2 rounded-md bg-muted/30 border border-border/50 text-sm"
          style={{ fontFamily: `"${value}"` }}
        />
        {open && (
          <div className="absolute z-50 mt-1 left-0 right-0 max-h-60 overflow-y-auto rounded-md border border-border/60 bg-popover shadow-xl">
            {filtered.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No matches</div>}
            {filtered.slice(0, 200).map((f) => (
              <button
                key={f}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(f) }}
                className={cn(
                  "block w-full text-left px-2 py-1.5 text-sm hover:bg-primary/10",
                  f === value && "bg-primary/15 text-primary"
                )}
                style={{ fontFamily: `"${f}"` }}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const TextControls: React.FC<{ api: CoverDocApi; layer: TextLayer; u: (p: Partial<Layer>, h?: boolean) => void }> = ({ api, layer, u }) => (
  <div className="space-y-2">
    <textarea
      value={layer.text}
      onChange={(e) => u({ text: e.target.value } as Partial<Layer>)}
      rows={2}
      aria-label="Layer text"
      className="w-full rounded-md bg-muted/30 border border-border/50 p-2 text-sm resize-none"
      placeholder="Text (Enter for new lines)"
    />
    <FontPicker value={layer.font} onChange={(v) => u({ font: v } as Partial<Layer>, true)} />
    <AnimColor api={api} layer={layer} prop="color" label="Color" />
    <AnimRange api={api} layer={layer} prop="size" label="Size" min={0.02} max={0.6} step={0.005} />
    <AnimRange api={api} layer={layer} prop="weight" label="Weight" min={100} max={900} step={100} />
    <AnimRange api={api} layer={layer} prop="letterSpacing" label="Letter Spacing" min={-0.1} max={0.5} step={0.005} />
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">Align</label>
      <Select value={layer.align} onValueChange={(v) => u({ align: v } as Partial<Layer>, true)}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="left">Left</SelectItem>
          <SelectItem value="center">Center</SelectItem>
          <SelectItem value="right">Right</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
)

const SolidControls: React.FC<{ api: CoverDocApi; layer: SolidLayer }> = ({ api, layer }) => (
  <AnimColor api={api} layer={layer} prop="color" label="Color" />
)

const GradientControls: React.FC<{ api: CoverDocApi; layer: GradientLayer; u: (p: Partial<Layer>, h?: boolean) => void }> = ({ api, layer }) => (
  <div className="space-y-2">
    <AnimColor api={api} layer={layer} prop="from" label="From" />
    <AnimColor api={api} layer={layer} prop="to" label="To" />
    <AnimRange api={api} layer={layer} prop="angle" label="Angle" min={0} max={360} step={1} />
  </div>
)

const ImageControls: React.FC<{ layer: ImageLayer; u: (p: Partial<Layer>, h?: boolean) => void }> = ({ layer, u }) => {
  const isGif = layer.src.startsWith("data:image/gif") || /\.gif($|\?)/i.test(layer.src)
  const replaceRef = useRef<HTMLInputElement>(null)
  const onReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => u({ src: String(reader.result) } as Partial<Layer>, true)
    reader.readAsDataURL(file)
    e.target.value = ""
  }
  return (
    <div className="space-y-2">
      <Button variant="secondary" size="sm" className="w-full gap-2 h-8" onClick={() => replaceRef.current?.click()}>
        <Upload className="w-3.5 h-3.5" /> {layer.src ? "Replace image" : "Choose image"}
      </Button>
      <input ref={replaceRef} type="file" accept="image/*,image/gif" className="hidden" onChange={onReplace} aria-label="Replace layer image" />
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Fit</label>
        <Select value={layer.fit} onValueChange={(v) => u({ fit: v } as Partial<Layer>, true)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cover">Cover</SelectItem>
            <SelectItem value="contain">Contain</SelectItem>
            <SelectItem value="stretch">Stretch</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isGif && (
        <RangeRow
          label="GIF Speed"
          value={layer.gifSpeed ?? 1}
          min={0.1}
          max={4}
          step={0.05}
          onChange={(v) => u({ gifSpeed: v } as Partial<Layer>)}
        />
      )}
    </div>
  )
}
