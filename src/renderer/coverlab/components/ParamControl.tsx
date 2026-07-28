import React from "react"
import { Activity } from "lucide-react"
import { Slider, Switch, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { cn } from "@/lib/utils"
import { ParamAnim, ParamSpec, ParamValue } from "../engine/types"
import { NumberInput } from "./NumberInput"

interface ParamControlProps {
  spec: ParamSpec
  value: ParamValue
  onChange: (value: ParamValue) => void
  /** Current per-param animation envelope (range params only). */
  anim?: ParamAnim
  /** When provided, a clock toggle exposes an "animate over time" envelope. */
  onAnimChange?: (anim: ParamAnim | undefined) => void
}

const SHAPES: { label: string; value: ParamAnim["shape"] }[] = [
  { label: "Sine", value: "sine" },
  { label: "Triangle", value: "triangle" },
  { label: "Pulse", value: "pulse" },
  { label: "Ramp ↑", value: "rampUp" },
  { label: "Ramp ↓", value: "rampDown" },
  { label: "Spin ⟳ (continuous)", value: "spin" },
]

const DEFAULT_ANIM: ParamAnim = { depth: 0.5, cycles: 1, shape: "sine" }

export const ParamControl: React.FC<ParamControlProps> = ({ spec, value, onChange, anim, onAnimChange }) => {
  const canAnimate = (spec.type === "range" || spec.type === "color") && !!onAnimChange
  const animating = !!anim

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs text-muted-foreground">{spec.label}</label>
        <div className="flex items-center gap-1.5">
          {spec.type === "range" && (
            <NumberInput
              value={Number(value ?? spec.default)}
              min={spec.min}
              max={spec.max}
              step={spec.step}
              onChange={(n) => onChange(n)}
              ariaLabel={spec.label}
            />
          )}
          {canAnimate && (
            <button
              type="button"
              title={animating ? "Animating over time — click to stop" : "Animate this over time"}
              onClick={() => onAnimChange!(animating ? undefined : DEFAULT_ANIM)}
              className={cn(
                "p-1 rounded transition-colors",
                animating ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {spec.type === "range" && (
        <Slider
          value={[Number(value ?? spec.default)]}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          onValueChange={(v) => onChange(v[0])}
        />
      )}

      {animating && anim && onAnimChange && (
        <div className="mt-1.5 rounded-md border border-primary/30 bg-primary/5 p-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground w-12">Shape</span>
            <Select value={anim.shape} onValueChange={(v) => onAnimChange({ ...anim, shape: v as ParamAnim["shape"] })}>
              <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SHAPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground w-12">Depth</span>
            <Slider value={[anim.depth]} min={0} max={1} step={0.01} onValueChange={(v) => onAnimChange({ ...anim, depth: v[0] })} className="flex-1" />
            <span className="text-[10px] font-mono text-muted-foreground w-7 text-right">{Math.round(anim.depth * 100)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground w-12">Cycles</span>
            <Slider value={[anim.cycles]} min={1} max={8} step={1} onValueChange={(v) => onAnimChange({ ...anim, cycles: v[0] })} className="flex-1" />
            <span className="text-[10px] font-mono text-muted-foreground w-7 text-right">{anim.cycles}×</span>
          </div>
        </div>
      )}

      {spec.type === "color" && (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={String(value ?? spec.default)}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-9 rounded border border-border/50 bg-transparent cursor-pointer"
            aria-label={spec.label}
          />
          <span className="text-[11px] font-mono text-muted-foreground uppercase">{String(value ?? spec.default)}</span>
        </div>
      )}

      {spec.type === "bool" && (
        <Switch checked={Boolean(value)} onCheckedChange={(c) => onChange(c)} />
      )}

      {spec.type === "select" && (
        <Select value={String(value ?? spec.default)} onValueChange={(v) => onChange(Number(v))}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {spec.options.map((o) => (
              <SelectItem key={o.value} value={String(o.value)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
