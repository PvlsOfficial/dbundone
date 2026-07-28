import React, { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Search, Code2, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
} from "@/components/ui"
import { cn } from "@/lib/utils"
import { EFFECTS } from "../engine/effects"
import { EffectDef } from "../engine/types"
import { getEffectPreviews } from "../engine/previews"

interface EffectPickerProps {
  open: boolean
  onClose: () => void
  onPick: (effectId: string) => void
}

// Display order for categories — roughly "shape → detail → era → light → colour".
const CATEGORY_ORDER = ["Cyberpunk", "Distort", "Blur", "Stylize", "Retro", "Texture", "Light", "Color"]

const CATEGORY_BLURB: Record<string, string> = {
  Cyberpunk: "Neon, holograms and high-tech chaos",
  Distort: "Bend, warp and displace the image",
  Blur: "Soften or smear detail",
  Stylize: "Turn it into something graphic",
  Retro: "Analog, CRT and lo-fi looks",
  Texture: "Grain and surface noise",
  Light: "Glow, rays and atmosphere",
  Color: "Grade, map and recolour",
}

function sortedCategories(): string[] {
  const present = Array.from(new Set(EFFECTS.map((e) => e.category)))
  const ordered = CATEGORY_ORDER.filter((c) => present.includes(c))
  const extras = present.filter((c) => !CATEGORY_ORDER.includes(c)).sort()
  return [...ordered, ...extras]
}

export const EffectPicker: React.FC<EffectPickerProps> = ({ open, onClose, onPick }) => {
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [search, setSearch] = useState("")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!open) return
    setReady(false)
    let cancelled = false
    getEffectPreviews(132, (id, url) => {
      if (!cancelled) setPreviews((prev) => (prev[id] ? prev : { ...prev, [id]: url }))
    }).then(() => {
      if (!cancelled) setReady(true)
    })
    return () => { cancelled = true }
  }, [open])

  const q = search.trim().toLowerCase()
  const matches = (def: EffectDef) => !q || def.name.toLowerCase().includes(q) || def.category.toLowerCase().includes(q)

  const grouped = useMemo(() => {
    return sortedCategories()
      .map((cat) => ({ cat, items: EFFECTS.filter((e) => e.category === cat && matches(e)) }))
      .filter((g) => g.items.length > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const pick = (id: string) => {
    onPick(id)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl bg-card/95 backdrop-blur-xl border-border/50 max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Add an effect
            {!ready && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </DialogTitle>
          <DialogDescription>Click an effect to add it to the stack. Previews are live.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search effects…"
            className="pl-9 bg-muted/30"
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-1 -mr-1 mt-1 space-y-5">
          {grouped.map(({ cat, items }) => (
            <section key={cat}>
              <div className="flex items-baseline gap-2 mb-2 sticky top-0 bg-card/95 backdrop-blur-sm py-1 z-10">
                <h3 className="text-sm font-semibold text-foreground">{cat}</h3>
                <span className="text-[11px] text-muted-foreground">{CATEGORY_BLURB[cat]}</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {items.map((def, i) => (
                  <EffectTile key={def.id} def={def} preview={previews[def.id]} index={i} onClick={() => pick(def.id)} />
                ))}
              </div>
            </section>
          ))}

          {/* Custom shader — always available, no fixed preview. */}
          {(!q || "custom shader".includes(q)) && (
            <section>
              <div className="flex items-baseline gap-2 mb-2">
                <h3 className="text-sm font-semibold text-foreground">Custom</h3>
                <span className="text-[11px] text-muted-foreground">Write your own GLSL</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                <button
                  type="button"
                  onClick={() => pick("custom")}
                  className="group rounded-lg overflow-hidden border border-border/40 hover:border-primary/60 transition-colors"
                >
                  <div className="aspect-square flex items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
                    <Code2 className="w-7 h-7 text-primary/70 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="px-1.5 py-1.5 text-center">
                    <span className="text-xs font-medium">Custom Shader</span>
                  </div>
                </button>
              </div>
            </section>
          )}

          {grouped.length === 0 && q && (
            <p className="text-sm text-muted-foreground py-8 text-center">No effects match “{search}”.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

const EffectTile: React.FC<{ def: EffectDef; preview?: string; index: number; onClick: () => void }> = ({ def, preview, index, onClick }) => (
  <motion.button
    type="button"
    onClick={onClick}
    initial={{ opacity: 0, scale: 0.96 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.18, delay: Math.min(index * 0.015, 0.2) }}
    whileHover={{ y: -2 }}
    title={def.name}
    className="group rounded-lg overflow-hidden border border-border/40 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10 transition-colors text-left"
  >
    <div className="aspect-square bg-muted/40 overflow-hidden">
      {preview ? (
        <img
          src={preview}
          alt={def.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />
        </div>
      )}
    </div>
    <div className="px-1.5 py-1.5 text-center">
      <span className="text-xs font-medium truncate block group-hover:text-primary transition-colors">{def.name}</span>
    </div>
  </motion.button>
)
