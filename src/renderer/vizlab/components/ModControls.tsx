// Reusable parameter row with per-fader modulation (LFO + audio reactivity).
// Used for both layer params and effect params so every numeric knob can animate.

import React, { useState } from "react"
import { Activity, Waves } from "lucide-react"
import { Slider, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Label } from "@/components/ui"
import { cn } from "@/lib/utils"
import { hasMod } from "../audioMath"
import type { AudioBand, LFOShape, ParamMod } from "../types"

interface RangeLike {
  label: string
  min: number
  max: number
  step?: number
  unit?: string
}

export interface ModFieldProps {
  spec: RangeLike
  value: number
  mod: ParamMod | undefined
  onValue: (v: number, commit: boolean) => void
  onMod: (mod: ParamMod | undefined) => void
}

const LFO_SHAPES: LFOShape[] = ["sine", "triangle", "saw", "square", "noise"]
const BANDS: AudioBand[] = ["level", "bass", "mid", "treble", "custom"]

export const ModField: React.FC<ModFieldProps> = ({ spec, value, mod, onValue, onMod }) => {
  const [open, setOpen] = useState(false)
  const active = hasMod(mod)
  const display = spec.step && spec.step < 1 ? value.toFixed(2) : Math.round(value)
  // Swing of the modulation, used to size the inline range knobs.
  const half = (spec.max - spec.min)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">{spec.label}  ·  {display}{spec.unit ?? ""}</Label>
        <button
          onClick={() => setOpen((v) => !v)}
          title="Modulation (LFO / audio)"
          className={cn(
            "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors",
            active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
        >
          <Activity className="w-3 h-3" />
          {open ? "−" : "~"}
        </button>
      </div>
      <Slider
        value={[value]}
        min={spec.min}
        max={spec.max}
        step={spec.step ?? 1}
        onValueChange={([x]) => onValue(x, false)}
        onValueCommit={([x]) => onValue(x, true)}
      />

      {open && (
        <div className="rounded-md border border-border/40 bg-muted/20 p-2 space-y-2">
          {/* LFO */}
          <ModSection
            icon={<Waves className="w-3 h-3" />}
            label="LFO"
            enabled={!!mod?.lfo}
            onToggle={(on) =>
              onMod({ ...mod, lfo: on ? { shape: "sine", rate: 1, depth: half * 0.25 } : undefined })
            }
          >
            {mod?.lfo && (
              <div className="space-y-1.5">
                <Select value={mod.lfo.shape} onValueChange={(s) => onMod({ ...mod, lfo: { ...mod.lfo!, shape: s as LFOShape } })}>
                  <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{LFO_SHAPES.map((s) => <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
                <MiniSlider label={`Rate ${mod.lfo.rate.toFixed(2)} Hz`} value={mod.lfo.rate} min={0.02} max={8} step={0.02}
                  onChange={(v) => onMod({ ...mod, lfo: { ...mod.lfo!, rate: v } })} />
                <MiniSlider label={`Depth ${mod.lfo.depth.toFixed(2)}`} value={mod.lfo.depth} min={0} max={half} step={half / 100}
                  onChange={(v) => onMod({ ...mod, lfo: { ...mod.lfo!, depth: v } })} />
              </div>
            )}
          </ModSection>

          {/* Audio */}
          <ModSection
            icon={<Activity className="w-3 h-3" />}
            label="Audio"
            enabled={!!mod?.audio}
            onToggle={(on) =>
              onMod({ ...mod, audio: on ? { band: "bass", amount: half * 0.4, focus: 0.05, width: 0.1 } : undefined })
            }
          >
            {mod?.audio && (
              <div className="space-y-1.5">
                <Select value={mod.audio.band} onValueChange={(b) => onMod({ ...mod, audio: { ...mod.audio!, band: b as AudioBand } })}>
                  <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{BANDS.map((b) => <SelectItem key={b} value={b} className="text-xs capitalize">{b}</SelectItem>)}</SelectContent>
                </Select>
                <MiniSlider label={`Amount ${mod.audio.amount.toFixed(2)}`} value={mod.audio.amount} min={0} max={half} step={half / 100}
                  onChange={(v) => onMod({ ...mod, audio: { ...mod.audio!, amount: v } })} />
                {mod.audio.band === "custom" && (
                  <>
                    <MiniSlider label={`Focus ${(mod.audio.focus ?? 0).toFixed(2)} (low→high)`} value={mod.audio.focus ?? 0.05} min={0} max={1} step={0.01}
                      onChange={(v) => onMod({ ...mod, audio: { ...mod.audio!, focus: v } })} />
                    <MiniSlider label={`Width ${(mod.audio.width ?? 0.1).toFixed(2)}`} value={mod.audio.width ?? 0.1} min={0.02} max={0.5} step={0.01}
                      onChange={(v) => onMod({ ...mod, audio: { ...mod.audio!, width: v } })} />
                  </>
                )}
              </div>
            )}
          </ModSection>
        </div>
      )}
    </div>
  )
}

const ModSection: React.FC<{ icon: React.ReactNode; label: string; enabled: boolean; onToggle: (on: boolean) => void; children: React.ReactNode }> = ({ icon, label, enabled, onToggle, children }) => (
  <div>
    <button
      onClick={() => onToggle(!enabled)}
      className={cn(
        "w-full flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] transition-colors",
        enabled ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/40",
      )}
    >
      {icon}
      {label}
      <span className="ml-auto text-[10px]">{enabled ? "on" : "off"}</span>
    </button>
    {enabled && <div className="mt-1.5 pl-1">{children}</div>}
  </div>
)

const MiniSlider: React.FC<{ label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }> = ({ label, value, min, max, step, onChange }) => (
  <div className="space-y-1">
    <Label className="text-[10px] text-muted-foreground/80">{label}</Label>
    <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
  </div>
)
