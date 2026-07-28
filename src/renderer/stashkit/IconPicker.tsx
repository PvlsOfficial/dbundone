import React, { useEffect, useMemo, useState } from "react"
import { Search, RefreshCw, FolderOpen, X } from "lucide-react"
import { Button, Input } from "@/components/ui"
import { cn } from "@/lib/utils"
import { getFlIconFont } from "../lib/tauriApi"
import { open as openDialog } from "@tauri-apps/plugin-dialog"
import type { FlIconFont } from "@shared/types"

/**
 * FL Studio icon picker. Parses the user's real `ILGlyphsEx.ttf` (via the backend
 * cmap reader) and renders ONLY the codepoints that actually have a glyph, each
 * labelled with its true IconIndex (= codepoint − base). No blank boxes, correct
 * indices straight away.
 */

const FONT_FAMILY = "ILGlyphsEx-Stash"
let injected: string | null = null

function injectFont(dataUrl: string) {
  if (injected === dataUrl) return
  injected = dataUrl
  let style = document.getElementById("stash-iconfont") as HTMLStyleElement | null
  if (!style) {
    style = document.createElement("style")
    style.id = "stash-iconfont"
    document.head.appendChild(style)
  }
  style.textContent = `@font-face { font-family: "${FONT_FAMILY}"; src: url("${dataUrl}") format("truetype"); }`
}

interface IconPickerProps {
  value: number | null
  onChange: (index: number | null) => void
  onFontPath?: (path: string | null) => void
}

export const IconPicker: React.FC<IconPickerProps> = ({ value, onChange, onFontPath }) => {
  const [font, setFont] = useState<FlIconFont | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState("")

  const load = async (overridePath?: string) => {
    setLoading(true)
    try {
      const f = await getFlIconFont(overridePath)
      setFont(f)
      if (f.found && f.dataUrl) injectFont(f.dataUrl)
      onFontPath?.(f.path)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pickFont = async () => {
    const res = await openDialog({ multiple: false, filters: [{ name: "Fonts", extensions: ["ttf"] }] })
    if (typeof res === "string") load(res)
  }

  const glyphs = useMemo(() => {
    const base = font?.base ?? 0xe000
    const list = (font?.glyphs ?? []).map((cp) => ({ cp, index: cp - base }))
    if (!query.trim()) return list
    const q = query.trim()
    return list.filter((g) => String(g.index).includes(q))
  }, [font, query])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by IconIndex #" className="pl-7 h-8 text-xs" />
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => load()} disabled={loading} aria-label="Reload font">
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={pickFont} aria-label="Pick ILGlyphsEx.ttf">
          <FolderOpen className="w-3.5 h-3.5" />
        </Button>
      </div>

      {font && !font.found && (
        <p className="text-[11px] text-amber-500/90">
          FL icon font not found. Set your FL Studio path in Settings, or pick
          <span className="font-mono"> ILGlyphsEx.ttf</span> manually.
        </p>
      )}
      {font?.found && (
        <p className="text-[10px] text-muted-foreground">{font.glyphs.length} icons loaded from your FL install</p>
      )}

      <div className="grid grid-cols-8 gap-1 max-h-60 overflow-auto p-1 rounded-lg bg-muted/30 border border-border/30">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn("aspect-square rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted", value === null && "ring-2 ring-primary")}
          aria-label="No icon"
        >
          <X className="w-4 h-4" />
        </button>
        {glyphs.map(({ cp, index }) => (
          <button
            key={cp}
            type="button"
            onClick={() => onChange(index)}
            title={`IconIndex ${index}`}
            className={cn("aspect-square rounded-md flex items-center justify-center hover:bg-muted relative group", value === index && "ring-2 ring-primary bg-primary/10")}
          >
            <span style={{ fontFamily: `"${FONT_FAMILY}"`, fontSize: 18, lineHeight: 1 }}>{String.fromCodePoint(cp)}</span>
            <span className="absolute bottom-0 right-0.5 text-[8px] text-muted-foreground/60 group-hover:text-muted-foreground">{index}</span>
          </button>
        ))}
      </div>
      {value !== null && <p className="text-[11px] text-muted-foreground">Selected <span className="font-mono">IconIndex={value}</span></p>}
    </div>
  )
}
