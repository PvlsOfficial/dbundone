import React, { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Wand2, Undo2, Redo2, Play, Pause, Layers as LayersIcon, Sparkles, FolderOpen, Globe, Paintbrush } from "lucide-react"
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui"
import { cn, loadImageUrl } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import { useCoverDoc } from "../coverlab/useCoverDoc"
import { docEffectOps, layerEffectOps } from "../coverlab/effectOps"
import { makeLayer, newDoc } from "../coverlab/engine/doc"
import { getEffectDef } from "../coverlab/engine/effects"
import { CoverEngine } from "../coverlab/engine/CoverEngine"
import { CanvasStage } from "../coverlab/components/CanvasStage"
import { LayersPanel } from "../coverlab/components/LayersPanel"
import { EffectStackPanel } from "../coverlab/components/EffectStackPanel"
import { ExportBar } from "../coverlab/components/ExportBar"
import { PresetGallery } from "../coverlab/components/PresetGallery"
import { CoverLibrary } from "../coverlab/components/CoverLibrary"
import { StockPanel } from "../coverlab/components/StockPanel"
import { loadProjectDoc, saveProjectDoc } from "../coverlab/coverDocStore"
import "./CoverLab.css"

const isElectron = () => typeof window !== "undefined" && typeof window.electron !== "undefined"

export interface CoverLabTarget {
  projectId: string
  title: string
  coverPath: string | null
  /**
   * "edit" reopens the project's existing cover (restoring saved layers/effects
   * if it was made here, else loading the flattened image); "fresh" starts a new
   * blank design for this project. Defaults to "edit".
   */
  mode?: "edit" | "fresh"
}

interface CoverLabProps {
  target?: CoverLabTarget | null
  /** Bound when editing a specific project's cover. */
  onSetCover?: (path: string) => Promise<void> | void
}

const ASPECTS: { label: string; w: number; h: number }[] = [
  { label: "Square 1:1", w: 1024, h: 1024 },
  { label: "Portrait 4:5", w: 1024, h: 1280 },
  { label: "Story 9:16", w: 1080, h: 1920 },
  { label: "Wide 16:9", w: 1920, h: 1080 },
]

type LeftTab = "layers" | "stock" | "presets" | "library"

/**
 * What the mask-painting overlay is currently editing: the global doc-level motion
 * mask, or one mask-aware effect instance's own mask (on the doc stack or a layer's
 * stack). null = the overlay is closed.
 */
type MaskTarget =
  | { kind: "doc" }
  | { kind: "docEffect"; instId: string }
  | { kind: "layerEffect"; layerId: string; instId: string }

/** Persisted free-roam lab document (not used when editing a specific project's cover). */
const LAB_STATE_KEY = "dbundone:coverLab:lastDoc"

export const CoverLab: React.FC<CoverLabProps> = ({ target, onSetCover }) => {
  const api = useCoverDoc()
  const { addToast } = useToast()
  const [engine, setEngine] = useState<CoverEngine | null>(null)
  const [errors, setErrors] = useState<Map<string, string>>(new Map())
  const [playing, setPlaying] = useState(true)
  const [maskTarget, setMaskTarget] = useState<MaskTarget | null>(null)
  const [leftTab, setLeftTab] = useState<LeftTab>("layers")
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [libraryRefresh, setLibraryRefresh] = useState(0)
  const loadedTargetRef = useRef<string | null>(null)
  const restoredRef = useRef(false)
  // Latest doc, read when saving the editable design behind a project's cover.
  const docRef = useRef(api.doc)
  docRef.current = api.doc

  // Free-roam lab: restore the last session once on mount. Skipped when editing a
  // specific project's cover (that path loads the project's current cover instead).
  useEffect(() => {
    if (target || restoredRef.current) return
    restoredRef.current = true
    try {
      const raw = localStorage.getItem(LAB_STATE_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved && Array.isArray(saved.layers)) api.replace(saved, false)
      }
    } catch {
      /* ignore corrupt/oversized state */
    }
  }, [target, api])

  // Persist the free-roam lab (debounced) so it's exactly where you left it.
  useEffect(() => {
    if (target || !restoredRef.current) return
    const id = window.setTimeout(() => {
      try {
        const json = JSON.stringify(api.doc)
        // Skip very large docs (embedded photos) to stay under the storage quota.
        if (json.length < 4_500_000) localStorage.setItem(LAB_STATE_KEY, json)
      } catch {
        /* ignore quota errors */
      }
    }, 600)
    return () => window.clearTimeout(id)
  }, [api.doc, target])

  // When opened for a specific project, pre-load its cover (saved design or the
  // flattened image). The target id is only recorded as "loaded" once the load
  // actually completes, so React StrictMode's mount→cleanup→mount cycle (which
  // cancels the first pass) doesn't block the second pass from loading anything.
  useEffect(() => {
    if (!target) return
    if (loadedTargetRef.current === target.projectId) return
    const projectId = target.projectId

    let cancelled = false
    ;(async () => {
      // Reopen the editable design (full layers/effects) if this cover was made here.
      if (target.mode !== "fresh") {
        const saved = await loadProjectDoc(target.projectId, target.coverPath)
        if (cancelled) return
        if (saved) {
          api.replace(saved, false)
          loadedTargetRef.current = projectId
          return
        }
      }

      // "fresh" always starts a new blank design; "edit" with no saved design
      // loads the flattened cover image as a single layer.
      let src = ""
      if (target.mode !== "fresh" && target.coverPath && isElectron()) {
        try {
          src = await window.electron!.readImageBase64(target.coverPath)
        } catch {
          src = ""
        }
        // Fall back to the asset URL so an image layer always appears even if the
        // base64 read fails for an unusual path.
        if (!src) {
          try {
            src = await loadImageUrl(target.coverPath)
          } catch {
            src = ""
          }
        }
      }
      if (cancelled) return
      const doc = newDoc()
      doc.layers = src
        ? [makeLayer("image", { name: target.title || "Cover", src, fit: "cover" })]
        : [
            makeLayer("gradient", { name: "Background" }),
            makeLayer("text", { text: (target.title || "TITLE").toUpperCase() }),
          ]
      api.replace(doc, false)
      loadedTargetRef.current = projectId
    })()
    return () => {
      cancelled = true
    }
  }, [target, api])

  const handleSetCover = useCallback(
    async (path: string) => {
      if (!onSetCover) return
      try {
        await onSetCover(path)
        // Remember the editable design so this cover can be tweaked again later.
        if (target) await saveProjectDoc(target.projectId, docRef.current, path)
        addToast({ title: "Cover updated", description: "The project cover was replaced", variant: "success" })
      } catch (e) {
        addToast({ title: "Couldn't set cover", description: String(e), variant: "destructive" })
      }
    },
    [onSetCover, addToast, target]
  )

  const loadAsLayer = useCallback(
    async (path: string) => {
      let src = path
      if (isElectron()) {
        try {
          src = await window.electron!.readImageBase64(path)
        } catch {
          /* fall back to raw path */
        }
      }
      api.addLayer("image", { name: "Library", src, fit: "cover" })
      setLeftTab("layers")
    },
    [api]
  )

  // Keyboard undo/redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault()
        api.undo()
      } else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") {
        e.preventDefault()
        api.redo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [api])

  const currentAspect = ASPECTS.find((a) => a.w === api.doc.width && a.h === api.doc.height)
  const selectedLayer = api.doc.layers.find((l) => l.id === selectedLayerId) || null

  // ── Mask painting: resolve the active target into what CanvasStage needs ──────
  const findEffectInst = useCallback(
    (t: MaskTarget) => {
      if (t.kind === "docEffect") return api.doc.effects.find((e) => e.id === t.instId)
      if (t.kind === "layerEffect")
        return api.doc.layers.find((l) => l.id === t.layerId)?.effects?.find((e) => e.id === t.instId)
      return undefined
    },
    [api.doc]
  )

  // A stable identity for the active mask so the overlay re-seeds only when the
  // *target* changes, not on every brush stroke (which mutates its data URL).
  const maskKey = !maskTarget
    ? undefined
    : maskTarget.kind === "doc"
      ? "doc"
      : `${maskTarget.kind}:${maskTarget.instId}`

  const maskSrc = !maskTarget
    ? undefined
    : maskTarget.kind === "doc"
      ? api.doc.motionMask
      : findEffectInst(maskTarget)?.mask

  const maskLabel = !maskTarget
    ? undefined
    : maskTarget.kind === "doc"
      ? "Global motion mask — paint where motion applies"
      : `${getEffectDef(findEffectInst(maskTarget)?.effectId ?? "")?.name ?? "Effect"} — paint where this effect applies`

  // Write a painted/cleared mask back to whatever the active target points at.
  const handleMaskChange = useCallback(
    (dataUrl: string | undefined) => {
      const t = maskTarget
      if (!t) return
      if (t.kind === "doc") {
        api.patchDoc({ motionMask: dataUrl }, true)
      } else if (t.kind === "docEffect") {
        api.updateEffect(t.instId, { mask: dataUrl })
      } else {
        const layer = api.doc.layers.find((l) => l.id === t.layerId)
        if (!layer) return
        const next = (layer.effects ?? []).map((e) => (e.id === t.instId ? { ...e, mask: dataUrl } : e))
        api.updateLayer(t.layerId, { effects: next }, true)
      }
    },
    [maskTarget, api]
  )

  // Clear a per-effect mask from its row (and close the overlay if it was active).
  const clearDocEffectMask = useCallback(
    (instId: string) => {
      api.updateEffect(instId, { mask: undefined })
      setMaskTarget((t) => (t?.kind === "docEffect" && t.instId === instId ? null : t))
    },
    [api]
  )
  const clearLayerEffectMask = useCallback(
    (layerId: string, instId: string) => {
      const layer = api.doc.layers.find((l) => l.id === layerId)
      if (!layer) return
      const next = (layer.effects ?? []).map((e) => (e.id === instId ? { ...e, mask: undefined } : e))
      api.updateLayer(layerId, { effects: next }, true)
      setMaskTarget((t) => (t?.kind === "layerEffect" && t.instId === instId ? null : t))
    },
    [api]
  )

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        {/* Toolbar — styled to match the other top-level pages */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex items-center gap-4 px-6 py-5 border-b border-border/30"
        >
          <div className="p-2 rounded-xl bg-primary/10">
            <Wand2 className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mr-auto truncate">
            {target ? target.title : "Cover Lab"}
          </h1>

          <Select
            value={currentAspect ? currentAspect.label : "custom"}
            onValueChange={(label) => {
              const a = ASPECTS.find((x) => x.label === label)
              if (a) api.patchDoc({ width: a.w, height: a.h }, true)
            }}
          >
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Aspect" /></SelectTrigger>
            <SelectContent>
              {ASPECTS.map((a) => <SelectItem key={a.label} value={a.label}>{a.label}</SelectItem>)}
              {!currentAspect && <SelectItem value="custom">Custom</SelectItem>}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!api.canUndo} onClick={api.undo}>
                  <Undo2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!api.canRedo} onClick={api.redo}>
                  <Redo2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={playing ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setPlaying((p) => !p)}>
                  {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{playing ? "Pause animation" : "Play animation"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={maskTarget?.kind === "doc" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setMaskTarget((t) => (t?.kind === "doc" ? null : { kind: "doc" }))}
                >
                  <Paintbrush className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Global motion mask</TooltipContent>
            </Tooltip>
          </div>
        </motion.div>

        {errors.has("__engine__") && (
          <div className="px-5 py-2 text-xs text-destructive bg-destructive/10">
            WebGL failed to initialize: {errors.get("__engine__")}
          </div>
        )}

        {/* Body: left panel | canvas | right panel */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left panel */}
          <div className="w-72 border-r border-border/30 flex flex-col min-h-0">
            <div className="flex border-b border-border/30">
              {([
                { id: "layers", label: "Layers", icon: <LayersIcon className="w-3.5 h-3.5" /> },
                { id: "stock", label: "Stock", icon: <Globe className="w-3.5 h-3.5" /> },
                { id: "presets", label: "Presets", icon: <Sparkles className="w-3.5 h-3.5" /> },
                { id: "library", label: "Library", icon: <FolderOpen className="w-3.5 h-3.5" /> },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setLeftTab(t.id)}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition-colors",
                    leftTab === t.id ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0">
              {leftTab === "layers" && <LayersPanel api={api} selectedId={selectedLayerId} onSelect={setSelectedLayerId} />}
              {leftTab === "stock" && (
                <StockPanel
                  onAdd={(src, name) => {
                    api.addLayer("image", { name, src, fit: "cover" })
                    addToast({ title: "Added to cover", description: name })
                  }}
                  onError={(msg) => addToast({ title: "Couldn't load image", description: msg, variant: "destructive" })}
                />
              )}
              {leftTab === "presets" && <PresetGallery api={api} />}
              {leftTab === "library" && (
                <CoverLibrary
                  refreshSignal={libraryRefresh}
                  onLoadAsLayer={loadAsLayer}
                  onSetCover={onSetCover ? handleSetCover : undefined}
                />
              )}
            </div>
          </div>

          {/* Canvas */}
          <CanvasStage
            doc={api.doc}
            playing={playing}
            onEngineReady={setEngine}
            onErrors={setErrors}
            maskMode={!!maskTarget}
            maskKey={maskKey}
            maskSrc={maskSrc}
            maskLabel={maskLabel}
            onMaskChange={handleMaskChange}
            onExitMaskMode={() => setMaskTarget(null)}
          />

          {/* Right panel — per-layer effects (when a layer is selected) + global stack */}
          <div className="w-80 border-l border-border/30 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto">
              {selectedLayer && (
                <EffectStackPanel
                  key={selectedLayer.id}
                  ops={layerEffectOps(api, selectedLayer)}
                  errors={errors}
                  title={`Layer · ${selectedLayer.name}`}
                  subtitle="Effects on just this layer"
                  onPaintMask={(instId) => setMaskTarget({ kind: "layerEffect", layerId: selectedLayer.id, instId })}
                  onClearMask={(instId) => clearLayerEffectMask(selectedLayer.id, instId)}
                  activeMaskInstId={
                    maskTarget?.kind === "layerEffect" && maskTarget.layerId === selectedLayer.id
                      ? maskTarget.instId
                      : null
                  }
                />
              )}
              <EffectStackPanel
                ops={docEffectOps(api)}
                errors={errors}
                title="Whole cover"
                subtitle={selectedLayer ? "Effects on the full composite" : "Select a layer to add layer-only effects"}
                onPaintMask={(instId) => setMaskTarget({ kind: "docEffect", instId })}
                onClearMask={clearDocEffectMask}
                activeMaskInstId={maskTarget?.kind === "docEffect" ? maskTarget.instId : null}
              />
            </div>
          </div>
        </div>

        {/* Export bar */}
        <ExportBar
          engine={engine}
          api={api}
          onSaved={() => setLibraryRefresh((n) => n + 1)}
          onSetCover={onSetCover ? handleSetCover : undefined}
          toast={addToast}
        />
      </div>
    </TooltipProvider>
  )
}

export default CoverLab
