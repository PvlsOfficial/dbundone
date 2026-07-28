// FxPanel — editor for the scene's global post-processing chain (bloom, chromatic
// aberration, noise, vignette, scanlines, pixelate). Each effect's params support
// LFO/audio modulation, so e.g. bloom can pump with the bass.

import React, { useState } from "react"
import { Plus, Trash2, ChevronUp, ChevronDown, Power } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VizSceneApi } from "../useVizScene"
import { ADDABLE_EFFECTS, getPostFXDef } from "../three/postfx"
import { ModField } from "./ModControls"
import { BasicParamRow } from "./Inspector"
import type { EffectInstance, PostFXType } from "../types"

export const FxPanel: React.FC<{ api: VizSceneApi }> = ({ api }) => {
  const [adding, setAdding] = useState(false)
  const effects = api.scene.effects
  return (
    <div className="p-3 space-y-2">
      <div className="relative">
        <button onClick={() => setAdding((v) => !v)} className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg border border-border/40 text-xs hover:bg-muted/40">
          <Plus className="w-4 h-4" /> Add effect
        </button>
        {adding && (
          <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg border border-border/50 bg-popover shadow-xl overflow-hidden">
            {ADDABLE_EFFECTS.map((e) => (
              <button key={e.type} className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60"
                onClick={() => { api.addEffect(e.type as PostFXType); setAdding(false) }}>
                {e.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {effects.length === 0 && (
        <p className="text-[11px] text-muted-foreground/70 text-center py-4">No effects. Add bloom, chromatic aberration, noise…</p>
      )}

      {effects.map((fx, i) => (
        <FxCard key={fx.id} api={api} fx={fx} first={i === 0} last={i === effects.length - 1} />
      ))}
    </div>
  )
}

const FxCard: React.FC<{ api: VizSceneApi; fx: EffectInstance; first: boolean; last: boolean }> = ({ api, fx, first, last }) => {
  const def = getPostFXDef(fx.type)
  const [open, setOpen] = useState(true)
  return (
    <div className={cn("rounded-lg border", fx.enabled ? "border-border/50" : "border-border/30 opacity-60")}>
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button onClick={() => api.toggleEffect(fx.id)} title={fx.enabled ? "Disable" : "Enable"} className={cn("p-0.5", fx.enabled ? "text-primary" : "text-muted-foreground")}>
          <Power className="w-3.5 h-3.5" />
        </button>
        <button className="flex-1 text-left text-xs font-medium" onClick={() => setOpen((v) => !v)}>{def.name}</button>
        <button title="Move up" disabled={last} onClick={() => api.moveEffect(fx.id, 1)} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
        <button title="Move down" disabled={first} onClick={() => api.moveEffect(fx.id, -1)} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
        <button title="Remove" onClick={() => api.removeEffect(fx.id)} className="p-0.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
      {open && (
        <div className="px-2.5 pb-2.5 space-y-3 border-t border-border/30 pt-2">
          {def.params.map((p) => {
            if (p.type === "range") {
              const v = fx.params[p.key]
              return (
                <ModField key={p.key} spec={p} value={typeof v === "number" ? v : p.default} mod={fx.mod?.[p.key]}
                  onValue={(val, commit) => api.setEffectParam(fx.id, p.key, val, commit)} onMod={(m) => api.setEffectMod(fx.id, p.key, m)} />
              )
            }
            return <BasicParamRow key={p.key} spec={p} value={fx.params[p.key]} onChange={(val, commit = true) => api.setEffectParam(fx.id, p.key, val, commit)} />
          })}
        </div>
      )}
    </div>
  )
}
