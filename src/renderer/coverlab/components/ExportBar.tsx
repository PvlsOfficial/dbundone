import React, { useState } from "react"
import { Download, Film, ImageDown, Loader2, Check } from "lucide-react"
import {
  Button,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
} from "@/components/ui"
import { CoverEngine } from "../engine/CoverEngine"
import { CoverDocApi } from "../useCoverDoc"

const isElectron = () => typeof window !== "undefined" && typeof window.electron !== "undefined"

interface ExportBarProps {
  engine: CoverEngine | null
  api: CoverDocApi
  /** Called with the saved file path after a successful export. */
  onSaved: (path: string) => void
  /** If present, a project is bound — enables "Set as cover". */
  onSetCover?: (path: string) => void
  toast: (t: { title: string; description?: string; variant?: "success" | "destructive" }) => void
}

const SIZES = [512, 768, 1024, 2048]

export const ExportBar: React.FC<ExportBarProps> = ({ engine, api, onSaved, onSetCover, toast }) => {
  const [size, setSize] = useState(1024)
  const [busy, setBusy] = useState<null | "png" | "gif" | "cover">(null)
  const [progress, setProgress] = useState(0)
  // Whether "Set as cover" applies a still PNG or an animated GIF.
  const [coverFmt, setCoverFmt] = useState<"png" | "gif">("png")
  const { animation } = api.doc

  async function persist(bytes: Uint8Array, ext: "png" | "gif"): Promise<string | null> {
    if (isElectron()) {
      return (await window.electron?.saveCoverImage?.(Array.from(bytes), ext)) || null
    }
    // Browser dev fallback: trigger a download, no path to return.
    const blob = new Blob([bytes as BlobPart], { type: ext === "png" ? "image/png" : "image/gif" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cover.${ext}`
    a.click()
    URL.revokeObjectURL(url)
    return null
  }

  const exportPNG = async () => {
    if (!engine) return
    setBusy("png")
    try {
      const bytes = await engine.exportPNG(size)
      const path = await persist(bytes, "png")
      if (path) {
        onSaved(path)
        toast({ title: "Cover exported", description: "Saved to your cover library", variant: "success" })
      } else {
        toast({ title: "Exported PNG", description: "Downloaded (browser mode)" })
      }
    } catch (e) {
      toast({ title: "Export failed", description: String(e instanceof Error ? e.message : e), variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  // Apply the design as the project's cover — as a still PNG or an animated GIF,
  // matching the chosen format (so picking GIF actually produces an animated cover).
  const setAsCover = async () => {
    if (!engine || !onSetCover) return
    setBusy("cover")
    setProgress(0)
    try {
      const bytes =
        coverFmt === "gif"
          ? await engine.exportGIF({ size, fps: animation.fps, durationSec: animation.durationSec, onProgress: setProgress })
          : await engine.exportPNG(size)
      const path = await persist(bytes, coverFmt)
      if (path) {
        onSaved(path)
        onSetCover(path)
      } else {
        toast({ title: `Exported ${coverFmt.toUpperCase()}`, description: "Downloaded (browser mode)" })
      }
    } catch (e) {
      toast({ title: "Couldn't set cover", description: String(e instanceof Error ? e.message : e), variant: "destructive" })
    } finally {
      setBusy(null)
      setProgress(0)
    }
  }

  const exportGIF = async () => {
    if (!engine) return
    setBusy("gif")
    setProgress(0)
    try {
      const bytes = await engine.exportGIF({
        size,
        fps: animation.fps,
        durationSec: animation.durationSec,
        onProgress: setProgress,
      })
      const path = await persist(bytes, "gif")
      if (path) {
        onSaved(path)
        toast({ title: "GIF exported", description: "Saved to your cover library", variant: "success" })
      } else {
        toast({ title: "Exported GIF", description: "Downloaded (browser mode)" })
      }
    } catch (e) {
      toast({ title: "GIF export failed", description: String(e instanceof Error ? e.message : e), variant: "destructive" })
    } finally {
      setBusy(null)
      setProgress(0)
    }
  }

  return (
    <div className="border-t border-border/30 px-4 py-3 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Size</span>
        <Select value={String(size)} onValueChange={(v) => setSize(Number(v))}>
          <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}px</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 min-w-[140px]">
        <span className="text-xs text-muted-foreground whitespace-nowrap">FPS {animation.fps}</span>
        <Slider value={[animation.fps]} min={4} max={30} step={1} onValueChange={(v) => api.patchDoc({ animation: { ...animation, fps: v[0] } })} className="w-20" />
      </div>
      <div className="flex items-center gap-2 min-w-[160px]">
        <span className="text-xs text-muted-foreground whitespace-nowrap">{animation.durationSec.toFixed(1)}s</span>
        <Slider value={[animation.durationSec]} min={0.5} max={8} step={0.5} onValueChange={(v) => api.patchDoc({ animation: { ...animation, durationSec: v[0] } })} className="w-24" />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {(busy === "gif" || (busy === "cover" && coverFmt === "gif")) && (
          <div className="flex items-center gap-2 w-32">
            <Progress value={progress * 100} className="h-2" />
            <span className="text-[11px] font-mono text-muted-foreground">{Math.round(progress * 100)}%</span>
          </div>
        )}
        <Button variant="outline" size="sm" className="gap-1" disabled={!engine || !!busy} onClick={exportPNG}>
          {busy === "png" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageDown className="w-3.5 h-3.5" />}
          PNG
        </Button>
        <Button variant="outline" size="sm" className="gap-1" disabled={!engine || !!busy} onClick={exportGIF}>
          {busy === "gif" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Film className="w-3.5 h-3.5" />}
          GIF
        </Button>
        {onSetCover && (
          <div className="flex items-center gap-1.5">
            <Select value={coverFmt} onValueChange={(v) => setCoverFmt(v as "png" | "gif")}>
              <SelectTrigger className="h-8 w-[5.5rem] text-xs" title="Cover format"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="png">Still</SelectItem>
                <SelectItem value="gif">Animated</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="gap-1" disabled={!engine || !!busy} onClick={setAsCover}>
              {busy === "cover" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Set as cover
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
