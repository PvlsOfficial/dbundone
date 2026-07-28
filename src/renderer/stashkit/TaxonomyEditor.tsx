import React, { useState } from "react"
import { Plus, Trash2, Wand2, Palette, Hash, RotateCcw, Save, ChevronDown, Eye, EyeOff } from "lucide-react"
import {
  Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Dialog, DialogContent, DialogHeader, DialogTitle, Switch,
} from "@/components/ui"
import { cn } from "@/lib/utils"
import type { ColorPreset, KitCategory, KitTemplate } from "@shared/types"
import { cloneTemplate, resetTemplateColors } from "./templates"
import { IconPicker } from "./IconPicker"

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0")
  return `#${c(r)}${c(g)}${c(b)}`
}
function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t)
}

interface Props {
  templates: KitTemplate[]
  activeId: string
  colorPresets: ColorPreset[]
  onSelectTemplate: (id: string) => void
  onChange: (template: KitTemplate) => void
  onAddTemplate: (template: KitTemplate) => void
  onSavePreset: (preset: ColorPreset) => void
  onApplyPreset: (preset: ColorPreset) => void
}

export const TaxonomyEditor: React.FC<Props> = ({
  templates, activeId, colorPresets, onSelectTemplate, onChange, onAddTemplate, onSavePreset, onApplyPreset,
}) => {
  const active = templates.find((t) => t.id === activeId) ?? templates[0]
  const [gradStart, setGradStart] = useState("#8b5cf6")
  const [gradEnd, setGradEnd] = useState("#ec4899")
  const [iconFor, setIconFor] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const editable = !active.builtin

  const ensureEditable = (): KitTemplate => {
    if (editable) return active
    const clone = cloneTemplate(active, `${active.name.replace(/\(.+\)/, "").trim()} (custom)`)
    onAddTemplate(clone)
    onSelectTemplate(clone.id)
    return clone
  }
  const patch = (catId: string, p: Partial<KitCategory>) => {
    const t = ensureEditable()
    onChange({ ...t, categories: t.categories.map((c) => (c.id === catId ? { ...c, ...p } : c)) })
  }
  const remove = (catId: string) => {
    const t = ensureEditable()
    onChange({ ...t, categories: t.categories.filter((c) => c.id !== catId) })
  }
  const add = () => {
    const t = ensureEditable()
    onChange({
      ...t,
      categories: [...t.categories, {
        id: `cat-${Date.now()}`, name: "New Folder", folderPath: "New Folder", keywords: [],
        color: "#94a3b8", iconIndex: null, tip: "New Folder", sortGroup: t.categories.length + 1,
        heightOfs: null, visible: true, splitBy: "none",
      }],
    })
  }
  const applyGradient = () => {
    const t = ensureEditable()
    const n = t.categories.length
    onChange({ ...t, categories: t.categories.map((c, i) => ({ ...c, color: lerpColor(gradStart, gradEnd, n <= 1 ? 0 : i / (n - 1)) })) })
  }
  const resetColors = () => onChange(resetTemplateColors(ensureEditable()))
  const savePreset = () => {
    const name = prompt("Preset name?")
    if (!name) return
    const colors: Record<string, string> = {}
    active.categories.forEach((c) => { if (c.color) colors[c.id] = c.color })
    onSavePreset({ id: `preset-${Date.now()}`, name, colors })
  }
  const toggleExpand = (id: string) =>
    setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  const iconCat = active.categories.find((c) => c.id === iconFor)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={active.id} onValueChange={onSelectTemplate}>
          <SelectTrigger className="h-8 text-xs w-56"><SelectValue /></SelectTrigger>
          <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => { const c = cloneTemplate(active, `${active.name} (copy)`); onAddTemplate(c); onSelectTemplate(c.id) }}>Clone</Button>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={resetColors}><RotateCcw className="w-3 h-3 mr-1" /> Reset colors</Button>
        {active.builtin && <span className="text-[11px] text-muted-foreground">Built-in — editing makes a custom copy</span>}
      </div>

      {/* Color styling tools */}
      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30 flex-wrap">
        <Palette className="w-4 h-4 text-muted-foreground" />
        <input type="color" value={gradStart} onChange={(e) => setGradStart(e.target.value)} className="w-7 h-7 rounded cursor-pointer bg-transparent" aria-label="Gradient start" />
        <input type="color" value={gradEnd} onChange={(e) => setGradEnd(e.target.value)} className="w-7 h-7 rounded cursor-pointer bg-transparent" aria-label="Gradient end" />
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={applyGradient}><Wand2 className="w-3 h-3 mr-1" /> Gradient</Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={savePreset}><Save className="w-3 h-3 mr-1" /> Save preset</Button>
        {colorPresets.length > 0 && (
          <Select onValueChange={(id) => { const p = colorPresets.find((x) => x.id === id); if (p) onApplyPreset(p) }}>
            <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Apply preset…" /></SelectTrigger>
            <SelectContent>{colorPresets.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <div className="flex-1" />
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={add}><Plus className="w-3 h-3 mr-1" /> Add folder</Button>
      </div>

      <div className="space-y-1.5 max-h-[440px] overflow-auto pr-1">
        {active.categories.map((c) => (
          <div key={c.id} className="rounded-lg bg-card border border-border/30">
            <div className="flex items-center gap-2 p-2">
              <input type="color" value={c.color ?? "#94a3b8"} onChange={(e) => patch(c.id, { color: e.target.value })} className="w-7 h-7 rounded cursor-pointer bg-transparent flex-shrink-0" aria-label="Folder color" />
              <Input value={c.name} onChange={(e) => patch(c.id, { name: e.target.value, tip: e.target.value })} className="h-8 text-xs w-32" placeholder="Name" />
              <Input value={c.folderPath} onChange={(e) => patch(c.id, { folderPath: e.target.value })} className="h-8 text-xs flex-1 font-mono" placeholder="Folder/Path" />
              <Input value={c.keywords.join(", ")} onChange={(e) => patch(c.id, { keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className="h-8 text-xs w-36" placeholder="extra keywords…" title="Extra filename keywords for this folder" />
              <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs flex-shrink-0" onClick={() => setIconFor(c.id)} title="Pick FL icon"><Hash className="w-3 h-3 mr-1" />{c.iconIndex ?? "icon"}</Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0" onClick={() => toggleExpand(c.id)} aria-label="Advanced"><ChevronDown className={cn("w-3.5 h-3.5 transition-transform", expanded.has(c.id) && "rotate-180")} /></Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => remove(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
            {expanded.has(c.id) && (
              <div className="flex items-center gap-3 px-2 pb-2 flex-wrap text-[11px] text-muted-foreground">
                <label className="flex items-center gap-1">Sort
                  <Input type="number" value={c.sortGroup ?? 0} onChange={(e) => patch(c.id, { sortGroup: parseInt(e.target.value) || 0 })} className="h-7 w-16 text-xs" />
                </label>
                <label className="flex items-center gap-1">Height ofs
                  <Input type="number" value={c.heightOfs ?? 0} onChange={(e) => patch(c.id, { heightOfs: parseInt(e.target.value) || 0 })} className="h-7 w-16 text-xs" />
                </label>
                <label className="flex items-center gap-1">
                  {c.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />} Visible
                  <Switch checked={c.visible} onCheckedChange={(v) => patch(c.id, { visible: v })} />
                </label>
                <label className="flex items-center gap-1">Split by
                  <Select value={c.splitBy ?? "none"} onValueChange={(v) => patch(c.id, { splitBy: v as KitCategory["splitBy"] })}>
                    <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No sub-folders</SelectItem>
                      <SelectItem value="key">By key</SelectItem>
                      <SelectItem value="length">By length</SelectItem>
                      <SelectItem value="distorted">Clean / Distorted</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!iconFor} onOpenChange={(o) => !o && setIconFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>FL icon for “{iconCat?.name}”</DialogTitle></DialogHeader>
          {iconCat && <IconPicker value={iconCat.iconIndex} onChange={(idx) => patch(iconCat.id, { iconIndex: idx })} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
