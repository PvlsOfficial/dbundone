import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  AudioWaveform, Undo2, Redo2, Plus, Eye, EyeOff, Trash2, Copy,
  ChevronUp, ChevronDown, Music, Sparkles, Layers as LayersIcon, Circle, Square, Video, Wand2, Play, Pause,
} from "lucide-react"
import {
  Button, ScrollArea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import { audioAnalyser } from "@/lib/audioAnalyser"
import { AudioPlayerState } from "@shared/types"
import { useVizScene } from "../vizlab/useVizScene"
import { Inspector } from "../vizlab/components/Inspector"
import { FxPanel } from "../vizlab/components/FxPanel"
import { ADDABLE_LAYERS, getLayerMeta } from "../vizlab/layers"
import { ASPECTS, PRESETS, blankScene } from "../vizlab/presets"
import { VizStage } from "../vizlab/three/VizStage"
import type { LayerType, VizScene } from "../vizlab/types"
import "./VizLab.css"

const isElectron = () => typeof window !== "undefined" && typeof window.electron !== "undefined"
const STATE_KEY = "dbundone:vizLab:scene.v2"

type LeftTab = "templates" | "layers" | "fx"

interface VizLabProps {
  playerState: AudioPlayerState
}

export const VizLab: React.FC<VizLabProps> = ({ playerState }) => {
  const { addToast } = useToast()
  const api = useVizScene(useMemo(restoreScene, []))
  const [leftTab, setLeftTab] = useState<LeftTab>("templates")
  const [recording, setRecording] = useState(false)

  const threeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const sceneRef = useRef<VizScene>(api.scene)
  sceneRef.current = api.scene
  const apiRef = useRef(api)
  apiRef.current = api

  const selectedLayer = api.scene.layers.find((l) => l.id === api.selectedId) || null
  const track = playerState.currentTrack
  const playing = playerState.isPlaying

  // ── persist the working scene (debounced) ───────────────────────────────────
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const json = JSON.stringify(api.scene)
        if (json.length < 3_000_000) localStorage.setItem(STATE_KEY, json)
      } catch { /* quota */ }
    }, 600)
    return () => window.clearTimeout(id)
  }, [api.scene])

  // ── auto-swap image layers flagged "Follow track cover" on song change ──────
  useEffect(() => {
    const path = track?.artworkPath
    if (!path) return
    let cancelled = false
    ;(async () => {
      const targets = apiRef.current.scene.layers.filter((l) => l.type === "image" && l.params.followCover === true)
      if (targets.length === 0) return
      let src = path
      try { if (isElectron()) src = await window.electron!.readImageBase64(path) } catch { return }
      if (cancelled) return
      for (const l of targets) apiRef.current.updateLayer(l.id, { src }, false)
    })()
    return () => { cancelled = true }
  }, [track?.id, track?.artworkPath])

  // ── keyboard undo/redo ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); api.undo() }
      else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") { e.preventDefault(); api.redo() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [api])

  // ── WebM export by recording the live canvas + the player's audio ───────────
  const stopRecording = useCallback(() => recRef.current?.stop(), [])
  const startRecording = useCallback(() => {
    const canvas = threeCanvasRef.current
    const audioStream = audioAnalyser.audioStream
    if (!canvas) return
    if (!audioStream || !audioAnalyser.attached) {
      addToast({ title: "Play a track first", description: "Start a track in the player below, then record." })
      return
    }
    audioAnalyser.resume()
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm"
    const stream = canvas.captureStream(60)
    for (const t of audioStream.getAudioTracks()) stream.addTrack(t)
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 16_000_000 })
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    rec.onstop = async () => { setRecording(false); await saveRecording(new Blob(chunks, { type: mime }), addToast) }
    recRef.current = rec
    rec.start()
    setRecording(true)
    addToast({ title: "Recording…", description: "Capturing the canvas + audio. Press Stop when done." })
  }, [addToast])

  const applyPreset = useCallback((build: (w: number, h: number) => VizScene) => {
    api.replace(build(api.scene.width, api.scene.height), true)
    setLeftTab("layers")
  }, [api])

  const currentAspect = ASPECTS.find((a) => a.w === api.scene.width && a.h === api.scene.height)

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        {/* Toolbar */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex items-center gap-4 px-6 py-5 border-b border-border/30">
          <div className="p-2 rounded-xl bg-primary/10"><AudioWaveform className="w-6 h-6 text-primary" /></div>
          <h1 className="text-2xl font-bold text-foreground mr-auto truncate">Visualizer</h1>
          <Select value={currentAspect ? currentAspect.label : "custom"} onValueChange={(label) => {
            const a = ASPECTS.find((x) => x.label === label)
            if (a) api.patchScene({ width: a.w, height: a.h }, true)
          }}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Aspect" /></SelectTrigger>
            <SelectContent>
              {ASPECTS.map((a) => <SelectItem key={a.label} value={a.label}>{a.label}</SelectItem>)}
              {!currentAspect && <SelectItem value="custom">Custom</SelectItem>}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <ToolbarBtn label="Undo" disabled={!api.canUndo} onClick={api.undo}><Undo2 className="w-4 h-4" /></ToolbarBtn>
            <ToolbarBtn label="Redo" disabled={!api.canRedo} onClick={api.redo}><Redo2 className="w-4 h-4" /></ToolbarBtn>
          </div>
        </motion.div>

        {/* Body */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left panel */}
          <div className="w-72 border-r border-border/30 flex flex-col min-h-0">
            <div className="flex border-b border-border/30">
              {([
                { id: "templates", label: "Templates", icon: <Sparkles className="w-3.5 h-3.5" /> },
                { id: "layers", label: "Layers", icon: <LayersIcon className="w-3.5 h-3.5" /> },
                { id: "fx", label: "Scene FX", icon: <Wand2 className="w-3.5 h-3.5" /> },
              ] as const).map((t) => (
                <button key={t.id} onClick={() => setLeftTab(t.id)}
                  className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition-colors",
                    leftTab === t.id ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>
            <ScrollArea className="flex-1 min-h-0">
              {leftTab === "templates" && (
                <div className="p-3 grid gap-2">
                  {PRESETS.map((p) => (
                    <button key={p.id} onClick={() => applyPreset(p.build)}
                      className="text-left rounded-lg border border-border/40 hover:border-primary/50 hover:bg-muted/40 transition-colors p-3">
                      <div className="text-sm font-medium text-foreground">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{p.description}</div>
                    </button>
                  ))}
                </div>
              )}
              {leftTab === "layers" && <LayersList api={api} />}
              {leftTab === "fx" && <FxPanel api={api} />}
            </ScrollArea>
          </div>

          {/* Canvas */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 viz-stage flex items-center justify-center p-6">
              <div className="max-w-full max-h-full" style={{ aspectRatio: `${api.scene.width} / ${api.scene.height}`, width: "100%", height: "100%" }}>
                <VizStage sceneRef={sceneRef} onCanvas={(c) => { threeCanvasRef.current = c }} />
              </div>
            </div>

            {/* Status bar */}
            <div className="flex items-center gap-3 px-5 py-3 border-t border-border/30">
              <div className={cn("flex items-center gap-2 text-xs", track ? "text-foreground" : "text-muted-foreground")}>
                {playing ? <Play className="w-3.5 h-3.5 text-primary fill-current" /> : <Pause className="w-3.5 h-3.5" />}
                <Music className="w-3.5 h-3.5 opacity-60" />
                {track ? <span className="max-w-[280px] truncate">{track.title || "Untitled"}</span> : <span>Play a track from the player to drive the visualizer</span>}
              </div>
              <div className="flex-1" />
              {recording ? (
                <Button variant="destructive" size="sm" className="h-9 gap-2" onClick={stopRecording}><Square className="w-3.5 h-3.5 fill-current" /> Stop</Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2" onClick={startRecording}><Video className="w-4 h-4" /> Record</Button>
                  </TooltipTrigger>
                  <TooltipContent>Render a WebM video of the live visuals + audio</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Right panel — inspector */}
          <div className="w-80 border-l border-border/30 flex flex-col min-h-0">
            <ScrollArea className="flex-1 min-h-0">
              {selectedLayer ? (
                <Inspector key={selectedLayer.id} api={api} layer={selectedLayer} coverPath={track?.artworkPath} />
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <Wand2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  Select a layer to edit it, or pick a template. Global effects live in the “Scene FX” tab.
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

// ── left-panel layer list ─────────────────────────────────────────────────────
const LayersList: React.FC<{ api: ReturnType<typeof useVizScene> }> = ({ api }) => {
  const [adding, setAdding] = useState(false)
  const ordered = [...api.scene.layers].reverse()
  return (
    <div className="p-3 space-y-2">
      <div className="relative">
        <Button variant="outline" size="sm" className="w-full gap-2 h-8" onClick={() => setAdding((v) => !v)}>
          <Plus className="w-4 h-4" /> Add layer
        </Button>
        {adding && (
          <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg border border-border/50 bg-popover shadow-xl overflow-hidden">
            {ADDABLE_LAYERS.map((l) => (
              <button key={l.type} className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60"
                onClick={() => { api.addLayer(l.type as LayerType); setAdding(false) }}>{l.name}</button>
            ))}
          </div>
        )}
      </div>
      {ordered.map((layer) => {
        const selected = layer.id === api.selectedId
        return (
          <div key={layer.id} onClick={() => api.select(layer.id)}
            className={cn("group rounded-lg border px-2.5 py-2 cursor-pointer transition-colors",
              selected ? "border-primary/60 bg-primary/10" : "border-border/40 hover:bg-muted/40")}>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); api.updateLayer(layer.id, { visible: !layer.visible }) }} className="text-muted-foreground hover:text-foreground">
                {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <span className="flex-1 text-xs truncate">{layer.name}</span>
              <span className="text-[10px] text-muted-foreground opacity-60">{getLayerMeta(layer.type).name}</span>
            </div>
            <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <IconBtn title="Up" onClick={(e) => { e.stopPropagation(); api.moveLayer(layer.id, 1) }}><ChevronUp className="w-3.5 h-3.5" /></IconBtn>
              <IconBtn title="Down" onClick={(e) => { e.stopPropagation(); api.moveLayer(layer.id, -1) }}><ChevronDown className="w-3.5 h-3.5" /></IconBtn>
              <IconBtn title="Duplicate" onClick={(e) => { e.stopPropagation(); api.duplicateLayer(layer.id) }}><Copy className="w-3.5 h-3.5" /></IconBtn>
              <IconBtn title="Delete" onClick={(e) => { e.stopPropagation(); api.removeLayer(layer.id) }}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
            </div>
          </div>
        )
      })}
      {ordered.length === 0 && (
        <div className="text-center text-[11px] text-muted-foreground py-6 flex flex-col items-center gap-2">
          <Circle className="w-6 h-6 opacity-30" /> No layers yet — add one above.
        </div>
      )}
    </div>
  )
}

const ToolbarBtn: React.FC<{ label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }> = ({ label, disabled, onClick, children }) => (
  <Tooltip>
    <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" disabled={disabled} onClick={onClick}>{children}</Button></TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)

const IconBtn: React.FC<{ title: string; onClick: (e: React.MouseEvent) => void; children: React.ReactNode }> = ({ title, onClick, children }) => (
  <button title={title} onClick={onClick} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60">{children}</button>
)

// ── helpers ───────────────────────────────────────────────────────────────────
function restoreScene(): VizScene {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      if (saved && Array.isArray(saved.layers) && Array.isArray(saved.effects) && saved.width && saved.height) return saved
    }
  } catch { /* fresh */ }
  return blankScene()
}

async function saveRecording(blob: Blob, addToast: (t: { title: string; description?: string; variant?: "destructive" | "success" }) => void) {
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    if (isElectron()) {
      const { save } = await import("@tauri-apps/plugin-dialog")
      const { writeFile } = await import("@tauri-apps/plugin-fs")
      const path = await save({ defaultPath: "visualizer.webm", filters: [{ name: "WebM Video", extensions: ["webm"] }] })
      if (!path) return
      await writeFile(path, bytes)
      addToast({ title: "Video saved", description: "Your visualizer was exported as WebM.", variant: "success" })
    } else {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = "visualizer.webm"; a.click()
      URL.revokeObjectURL(url)
    }
  } catch (e) {
    addToast({ title: "Export failed", description: String(e), variant: "destructive" })
  }
}

export default VizLab
