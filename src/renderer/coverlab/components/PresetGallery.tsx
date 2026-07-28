import React, { useState } from "react"
import { Trash2, Save, Sparkles } from "lucide-react"
import { Button } from "@/components/ui"
import { CoverDocApi } from "../useCoverDoc"
import { instantiateDoc, newId } from "../engine/doc"
import {
  BUILTIN_PRESETS,
  deleteUserPreset,
  loadUserPresets,
  Preset,
  saveUserPreset,
} from "../engine/presets"
import { GradientLayer } from "../engine/types"

interface PresetGalleryProps {
  api: CoverDocApi
}

/** A small CSS swatch hinting at the preset's palette (cheap, no GL render). */
function PresetSwatch({ preset }: { preset: Preset }) {
  const grad = preset.doc.layers.find((l) => l.type === "gradient") as GradientLayer | undefined
  const bg = grad
    ? `linear-gradient(135deg, ${grad.from}, ${grad.to})`
    : preset.doc.background
  return <div className="w-full aspect-square rounded-md" style={{ background: bg }} />
}

export const PresetGallery: React.FC<PresetGalleryProps> = ({ api }) => {
  const [userPresets, setUserPresets] = useState<Preset[]>(() => loadUserPresets())

  const apply = (preset: Preset) => api.replace(instantiateDoc(preset.doc))

  const saveCurrent = () => {
    const name = window.prompt("Template name", "My Template")
    if (!name) return
    const preset: Preset = { id: newId(), name, description: "Custom template", doc: api.doc }
    setUserPresets(saveUserPreset(preset))
  }

  return (
    <div className="p-3 space-y-4 overflow-y-auto h-full">
      <Button size="sm" variant="secondary" className="w-full gap-2" onClick={saveCurrent} title="Saves layers, fonts, effects, animation & size as a reusable template">
        <Save className="w-3.5 h-3.5" /> Save as template
      </Button>

      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Built-in
        </p>
        <div className="grid grid-cols-2 gap-2">
          {BUILTIN_PRESETS.map((p) => (
            <button key={p.id} onClick={() => apply(p)} className="text-left group" title={p.description} type="button">
              <PresetSwatch preset={p} />
              <span className="text-xs mt-1 block truncate group-hover:text-primary">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {userPresets.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">My Presets</p>
          <div className="grid grid-cols-2 gap-2">
            {userPresets.map((p) => (
              <div key={p.id} className="relative group">
                <button onClick={() => apply(p)} className="text-left w-full" type="button">
                  <PresetSwatch preset={p} />
                  <span className="text-xs mt-1 block truncate group-hover:text-primary">{p.name}</span>
                </button>
                <button
                  type="button"
                  className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white/80 hover:text-destructive opacity-0 group-hover:opacity-100"
                  title="Delete preset"
                  onClick={() => setUserPresets(deleteUserPreset(p.id))}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
