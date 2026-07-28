import React, { useState } from "react"
import {
  Plus,
  Trash2,
  Power,
  ChevronRight,
  GripVertical,
  Dices,
  Paintbrush,
  X,
} from "lucide-react"
import { Button } from "@/components/ui"
import { cn } from "@/lib/utils"
import { EffectOps } from "../effectOps"
import { effectUsesMask, getEffectDef } from "../engine/effects"
import { EffectInstance } from "../engine/types"
import { ParamControl } from "./ParamControl"
import { EffectPicker } from "./EffectPicker"

// A colour per effect category so stacked effects read apart at a glance.
const CATEGORY_COLORS: Record<string, { bar: string; dot: string; text: string }> = {
  Cyberpunk: { bar: "border-l-fuchsia-500", dot: "bg-fuchsia-500", text: "text-fuchsia-400" },
  Distort: { bar: "border-l-violet-500", dot: "bg-violet-500", text: "text-violet-400" },
  Retro: { bar: "border-l-amber-500", dot: "bg-amber-500", text: "text-amber-400" },
  Texture: { bar: "border-l-stone-400", dot: "bg-stone-400", text: "text-stone-400" },
  Light: { bar: "border-l-yellow-400", dot: "bg-yellow-400", text: "text-yellow-400" },
  Color: { bar: "border-l-pink-500", dot: "bg-pink-500", text: "text-pink-400" },
  Blur: { bar: "border-l-sky-500", dot: "bg-sky-500", text: "text-sky-400" },
  Stylize: { bar: "border-l-emerald-500", dot: "bg-emerald-500", text: "text-emerald-400" },
  Custom: { bar: "border-l-slate-400", dot: "bg-slate-400", text: "text-slate-400" },
}

interface EffectStackPanelProps {
  ops: EffectOps
  errors: Map<string, string>
  /** Heading shown above the stack (e.g. "Whole cover" or a layer name). */
  title: string
  /** Optional one-line context shown under the title. */
  subtitle?: string
  /** Enter mask-painting mode for a mask-aware effect instance (Live Motion, Blob Tracker). */
  onPaintMask?: (instId: string) => void
  /** Clear a per-instance mask. */
  onClearMask?: (instId: string) => void
  /** Instance whose mask is currently being painted, highlighted in the row. */
  activeMaskInstId?: string | null
}

export const EffectStackPanel: React.FC<EffectStackPanelProps> = ({
  ops,
  errors,
  title,
  subtitle,
  onPaintMask,
  onClearMask,
  activeMaskInstId,
}) => {
  // Effects are expanded by default; we only track the ones the user collapses.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const toggleExpanded = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const onDrop = (to: number) => {
    if (dragIndex !== null && dragIndex !== to) ops.reorder(dragIndex, to)
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/30">
        <div className="mr-auto min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block truncate">{title}</span>
          {subtitle && <span className="text-[10px] text-muted-foreground/70 block truncate">{subtitle}</span>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1"
          title="Randomize this effect stack"
          onClick={ops.randomize}
        >
          <Dices className="w-3.5 h-3.5" /> Random
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setPickerOpen(true)}>
          <Plus className="w-3.5 h-3.5" /> Add
        </Button>
      </div>

      <EffectPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={(id) => ops.add(id)} />

      <div>
        {ops.effects.length === 0 && (
          <p className="text-xs text-muted-foreground p-3">
            No effects yet. <span className="text-foreground">Add</span> one or hit <span className="text-foreground">Random</span>.
          </p>
        )}
        {ops.effects.map((inst, index) => (
          <EffectRow
            key={inst.id}
            ops={ops}
            inst={inst}
            expanded={!collapsed.has(inst.id)}
            onToggleExpand={() => toggleExpanded(inst.id)}
            error={errors.get(inst.id)}
            onPaintMask={onPaintMask}
            onClearMask={onClearMask}
            maskActive={activeMaskInstId === inst.id}
            dragging={dragIndex === index}
            isOver={overIndex === index && dragIndex !== null && dragIndex !== index}
            onDragStart={() => setDragIndex(index)}
            onDragOver={() => setOverIndex(index)}
            onDropRow={() => onDrop(index)}
            onDragEnd={() => {
              setDragIndex(null)
              setOverIndex(null)
            }}
          />
        ))}
      </div>
    </div>
  )
}

interface EffectRowProps {
  ops: EffectOps
  inst: EffectInstance
  expanded: boolean
  onToggleExpand: () => void
  error?: string
  onPaintMask?: (instId: string) => void
  onClearMask?: (instId: string) => void
  maskActive: boolean
  dragging: boolean
  isOver: boolean
  onDragStart: () => void
  onDragOver: () => void
  onDropRow: () => void
  onDragEnd: () => void
}

const EffectRow: React.FC<EffectRowProps> = ({
  ops,
  inst,
  expanded,
  onToggleExpand,
  error,
  onPaintMask,
  onClearMask,
  maskActive,
  dragging,
  isOver,
  onDragStart,
  onDragOver,
  onDropRow,
  onDragEnd,
}) => {
  const def = getEffectDef(inst.effectId)
  if (!def) return null
  const name = inst.effectId === "custom" ? "Custom Shader" : def.name
  const animCount = inst.anim ? Object.keys(inst.anim).length : 0
  const cat = CATEGORY_COLORS[def.category] || CATEGORY_COLORS.Custom
  const showMaskControl = !!onPaintMask && effectUsesMask(inst.effectId)
  const hasMask = !!inst.mask

  return (
    <div
      className={cn(
        "border-b border-l-[3px] border-border/20",
        cat.bar,
        !inst.enabled && "opacity-50 saturate-0",
        dragging && "opacity-40",
        isOver && "border-t-2 border-t-primary"
      )}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver()
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDropRow()
      }}
    >
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          type="button"
          className="p-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move"
            onDragStart()
          }}
          onDragEnd={onDragEnd}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="p-1 text-muted-foreground hover:text-foreground" onClick={onToggleExpand} title="Expand">
          <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-90")} />
        </button>
        <span className={cn("w-2 h-2 rounded-full shrink-0", cat.dot)} title={def.category} />
        <span className="text-sm truncate">{name}</span>
        <span className={cn("text-[9px] uppercase tracking-wider shrink-0 hidden sm:inline", cat.text)}>{def.category}</span>
        <span className="flex-1" />
        {animCount > 0 && (
          <span className="text-[9px] px-1 rounded bg-primary/15 text-primary" title={`${animCount} animated param(s)`}>
            anim
          </span>
        )}
        {showMaskControl && hasMask && (
          <span className="text-[9px] px-1 rounded bg-sky-500/20 text-sky-400" title="Has its own motion mask">
            mask
          </span>
        )}
        {error && <span className="text-[10px] text-destructive" title={error}>error</span>}
        <button
          type="button"
          className={cn("p-1 hover:text-foreground", inst.enabled ? "text-primary" : "text-muted-foreground")}
          title={inst.enabled ? "Disable" : "Enable"}
          onClick={() => ops.update(inst.id, { enabled: !inst.enabled })}
        >
          <Power className="w-3.5 h-3.5" />
        </button>
        <button type="button" className="p-1 text-muted-foreground hover:text-destructive" title="Remove" onClick={() => ops.remove(inst.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {showMaskControl && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={maskActive ? "secondary" : "ghost"}
                  className="h-7 px-2 text-xs gap-1 flex-1"
                  onClick={() => onPaintMask?.(inst.id)}
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                  {maskActive ? "Painting…" : hasMask ? "Edit Mask" : "Paint Mask"}
                </Button>
                {hasMask && onClearMask && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-destructive"
                    title="Clear this effect's mask"
                    onClick={() => onClearMask(inst.id)}
                  >
                    <X className="w-3.5 h-3.5" /> Clear
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground/80 leading-snug">
                {hasMask
                  ? "Only the painted area is affected by this effect."
                  : "Paint to confine this effect to one area; unpainted = uses the whole cover (or the global motion mask)."}
              </p>
            </div>
          )}
          {inst.effectId === "custom" && (
            <CustomShaderEditor ops={ops} inst={inst} error={error} />
          )}
          {def.params.map((p) => (
            <ParamControl
              key={p.key}
              spec={p}
              value={inst.params[p.key]}
              onChange={(v) => ops.setParam(inst.id, p.key, v)}
              anim={inst.anim?.[p.key]}
              onAnimChange={(a) => ops.setAnim(inst.id, p.key, a)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const CustomShaderEditor: React.FC<{ ops: EffectOps; inst: EffectInstance; error?: string }> = ({ ops, inst, error }) => {
  const [draft, setDraft] = useState(inst.customFrag || "")

  const isShadertoy = /\bmainImage\s*\(/.test(draft) && !/\bvoid\s+main\s*\(/.test(draft)

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted-foreground leading-snug">
        Write GLSL ES 3.00, or paste a{" "}
        <span className="text-foreground">Shadertoy</span> shader (a{" "}
        <code className="text-primary">mainImage</code> function) — it's converted
        automatically. The cover is on <code className="text-primary">iChannel0</code>.
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        rows={12}
        aria-label="Custom shader source"
        className="w-full rounded-md bg-black/50 border border-border/50 p-2 text-[11px] font-mono leading-relaxed resize-y text-green-300"
      />
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="secondary" className="h-7" onClick={() => ops.update(inst.id, { customFrag: draft })}>
          Compile & Apply
        </Button>
        {error ? (
          <span className="text-[10px] text-destructive">Compile error</span>
        ) : isShadertoy ? (
          <span className="text-[10px] text-fuchsia-400">Shadertoy mode</span>
        ) : (
          <span className="text-[10px] text-muted-foreground">GLSL ES 3.00</span>
        )}
      </div>
      {error && (
        <pre className="text-[10px] text-destructive whitespace-pre-wrap bg-destructive/10 rounded p-2 max-h-32 overflow-auto">
          {error}
        </pre>
      )}
    </div>
  )
}
