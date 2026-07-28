import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  ArrowLeft, FilePlus2, FolderPlus, Play, Pause, X, Scan, Sliders, Image as ImageIcon,
  FolderInput, Hammer, Sparkles, Loader2, Layers, Music2,
} from "lucide-react"
import {
  Button, Badge, Switch, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import { open as openDialog } from "@tauri-apps/plugin-dialog"
import type { KitConfig, SampleCandidate, SavedKit, KitFolderStyle, KitBuildItem } from "@shared/types"
import { FL_VERSIONS } from "@shared/types"
import {
  stashScanSources, stashBuildKit, selectFlpOrZipFiles, selectFolder, onStashProgress, openFolder, getAssetUrl,
} from "../lib/tauriApi"
import { TaxonomyEditor } from "./TaxonomyEditor"
import { RenameDialog } from "./RenameDialog"
import { MiniWave } from "./MiniWave"
import { SOUND_TYPES, soundColor, soundLabel } from "./soundTypes"
import { subfolderFor, generateCoverPng, defaultAgreement } from "./buildHelpers"

interface Props {
  config: KitConfig
  setConfig: React.Dispatch<React.SetStateAction<KitConfig>>
  update: (patch: Partial<KitConfig>) => void
  existing: SavedKit | null
  initialName: string
  onClose: () => void
}

interface Progress { current: number; total: number; file: string; phase: string; isScanning: boolean }

function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "").trim() || "Untitled Kit"
}

export const KitDetail: React.FC<Props> = ({ config, setConfig, update, existing, initialName, onClose }) => {
  const { addToast } = useToast()

  const [kitName, setKitName] = useState(initialName)
  const [sources, setSources] = useState<string[]>([])
  const [samples, setSamples] = useState<SampleCandidate[]>([])
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [renames, setRenames] = useState<Record<string, string>>({})
  const [renameOpen, setRenameOpen] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [baseDir, setBaseDir] = useState("")
  const [writeNfo, setWriteNfo] = useState(true)
  const [dedup, setDedup] = useState(true)
  const [addLicense, setAddLicense] = useState(true)
  const [addCover, setAddCover] = useState(true)
  const [onlySelected, setOnlySelected] = useState(false)
  const [building, setBuilding] = useState(false)
  const [showStyle, setShowStyle] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastClicked = useRef<string | null>(null)

  const activeTemplate = useMemo(
    () => config.templates.find((t) => t.id === config.activeTemplateId) ?? config.templates[0],
    [config.templates, config.activeTemplateId]
  )

  useEffect(() => {
    let un: (() => void) | undefined
    onStashProgress((p: Progress) => {
      setProgress(p)
      if (!p.isScanning && p.phase === "complete") setScanning(false)
    }).then((u) => (un = u))
    return () => un?.()
  }, [])

  const addPaths = (paths: string[]) => setSources((p) => Array.from(new Set([...p, ...paths])))
  const addFlpOrZip = async () => { const f = await selectFlpOrZipFiles(); if (f.length) addPaths(f) }
  const addFolder = async () => { const f = await selectFolder(); if (f) addPaths([f]) }

  const runScan = useCallback(async () => {
    if (!sources.length) {
      addToast({ title: "Add FL projects first", description: "Pick FLPs, zips, or a folder of projects", variant: "destructive" })
      return
    }
    setScanning(true)
    setProgress({ current: 0, total: 0, file: "Finding projects…", phase: "discovering", isScanning: true })
    try {
      const extra: Record<string, string[]> = {}
      for (const c of activeTemplate.categories) if (c.keywords.length) extra[c.id] = c.keywords
      const res = await stashScanSources(sources, extra)
      setSamples(res)
      setSelected(new Set())
      if (res.length === 0) {
        addToast({ title: "No samples found", description: "These projects don't reference any sample files on disk", variant: "destructive" })
      } else {
        addToast({ title: `Sorted ${res.length} samples`, variant: "success" })
      }
    } catch (e) {
      addToast({ title: "Scan failed", description: String(e), variant: "destructive" })
    } finally {
      setScanning(false)
    }
  }, [sources, activeTemplate, addToast])

  const effCat = useCallback((s: SampleCandidate) => config.categoryOverrides[s.id] ?? s.category, [config.categoryOverrides])
  const dispName = useCallback((s: SampleCandidate) => renames[s.id] ?? s.fileName, [renames])

  const grouped = useMemo(() => {
    const map = new Map<string, SampleCandidate[]>()
    for (const s of samples) {
      const c = effCat(s)
      if (!map.has(c)) map.set(c, [])
      map.get(c)!.push(s)
    }
    const order = SOUND_TYPES.map((s) => s.id) as string[]
    return Array.from(map.keys())
      .sort((a, b) => (order.indexOf(a) === -1 ? 999 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 999 : order.indexOf(b)))
      .map((k) => ({ category: k, items: map.get(k)! }))
  }, [samples, effCat])

  const flatOrder = useMemo(() => grouped.flatMap((g) => g.items.map((i) => i.id)), [grouped])

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (e.shiftKey && lastClicked.current) {
        const a = flatOrder.indexOf(lastClicked.current), b = flatOrder.indexOf(id)
        if (a !== -1 && b !== -1) { const [lo, hi] = a < b ? [a, b] : [b, a]; for (let i = lo; i <= hi; i++) next.add(flatOrder[i]) }
      } else if (e.ctrlKey || e.metaKey) {
        next.has(id) ? next.delete(id) : next.add(id)
      } else { next.clear(); next.add(id) }
      return next
    })
    lastClicked.current = id
  }
  const selectCategory = (catId: string) => {
    const ids = grouped.find((g) => g.category === catId)?.items.map((i) => i.id) ?? []
    setSelected((prev) => { const next = new Set(prev); const all = ids.every((i) => next.has(i)); ids.forEach((i) => (all ? next.delete(i) : next.add(i))); return next })
  }

  const reassign = (catId: string) =>
    update({ categoryOverrides: { ...config.categoryOverrides, ...Object.fromEntries([...selected].map((id) => [id, catId])) } })

  const attachImage = async () => {
    const res = await openDialog({ multiple: false, filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp"] }] })
    if (typeof res !== "string") return
    update({ imageAttachments: { ...config.imageAttachments, ...Object.fromEntries([...selected].map((id) => [id, res])) } })
    addToast({ title: "Image attached", description: `${selected.size} sounds` })
  }

  const selSamples = useMemo(() => samples.filter((s) => selected.has(s.id)), [samples, selected])
  const applyRenames = (newNames: string[]) => {
    const ids = selSamples.map((s) => s.id)
    setRenames((prev) => { const n = { ...prev }; ids.forEach((id, i) => (n[id] = newNames[i])); return n })
  }

  const playSample = (s: SampleCandidate) => {
    if (!audioRef.current) audioRef.current = new Audio()
    const a = audioRef.current
    if (playingId === s.id) { a.pause(); setPlayingId(null); return }
    a.src = getAssetUrl(s.sourcePath)
    a.play().then(() => setPlayingId(s.id)).catch(() => setPlayingId(null))
    a.onended = () => setPlayingId(null)
  }

  const pickBase = async () => { const f = await selectFolder(); if (f) setBaseDir(f) }

  const runBuild = async () => {
    if (!baseDir) { addToast({ title: "Choose where to save the kit", variant: "destructive" }); return }
    const pool = onlySelected && selected.size ? selSamples : samples
    if (!pool.length) { addToast({ title: "Nothing to build", variant: "destructive" }); return }

    const folderName = sanitize(kitName)
    const outputDir = `${baseDir}/${folderName}`
    const catById = new Map(activeTemplate.categories.map((c) => [c.id, c]))
    const usedFolders = new Map<string, KitFolderStyle>()
    const items: KitBuildItem[] = pool.map((s) => {
      const cat = catById.get(effCat(s))
      const baseFolder = cat?.folderPath ?? "Unsorted"
      const sub = subfolderFor(s, cat)
      const folder = sub ? `${baseFolder}/${sub}` : baseFolder
      if (!usedFolders.has(folder)) {
        usedFolders.set(folder, {
          relPath: folder, color: cat?.color ?? null, iconIndex: cat?.iconIndex ?? null,
          tip: cat?.tip ?? null, sortGroup: cat?.sortGroup ?? null, heightOfs: cat?.heightOfs ?? null,
          visible: cat?.visible ?? true,
        })
      }
      return { sourcePath: s.sourcePath, destRelPath: `${folder}/${dispName(s)}` }
    })

    const colors = activeTemplate.categories.map((c) => c.color).filter(Boolean) as string[]
    const cA = colors[0] ?? "#8b5cf6"
    const cB = colors[colors.length - 1] ?? "#ec4899"

    setBuilding(true)
    try {
      const coverPng = addCover ? await generateCoverPng(folderName, cA, cB, pool.length) : null
      const rootStyle: KitFolderStyle = { relPath: "", color: cA, iconIndex: null, tip: folderName, sortGroup: 0, heightOfs: null, visible: true }
      const res = await stashBuildKit(outputDir, items, Array.from(usedFolders.values()), {
        writeNfo, dedup,
        agreementText: addLicense ? defaultAgreement(folderName) : null,
        coverPng,
        rootStyle: writeNfo ? rootStyle : null,
      })

      // record / update the saved kit in the library
      const saved: SavedKit = {
        id: existing?.id ?? `kit-${Date.now()}`,
        name: folderName,
        outputDir,
        coverPath: res.coverPath,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        sampleCount: res.copied,
        templateId: activeTemplate.id,
        flVersion: config.flVersion,
      }
      setConfig((c) => ({
        ...c,
        savedKits: [saved, ...c.savedKits.filter((k) => k.id !== saved.id)],
      }))

      addToast({ title: "Kit built! 🔥", description: `${res.copied} copied, ${res.skipped} skipped${res.errors.length ? `, ${res.errors.length} errors` : ""}`, variant: "success" })
      openFolder(outputDir).catch(() => {})
      onClose()
    } catch (e) {
      addToast({ title: "Build failed", description: String(e), variant: "destructive" })
    } finally {
      setBuilding(false)
    }
  }

  const pct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border/30 flex-shrink-0">
        <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={onClose} aria-label="Back to kits">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Input
          value={kitName}
          onChange={(e) => setKitName(e.target.value)}
          placeholder="Name your drum kit…"
          className="h-10 text-lg font-semibold max-w-sm border-transparent hover:border-border focus:border-border bg-transparent"
        />
        <div className="flex-1" />
        <Select value={config.flVersion} onValueChange={(v) => update({ flVersion: v })}>
          <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{FL_VERSIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowStyle((v) => !v)}>
          <Layers className="w-4 h-4 mr-1.5" /> Folders &amp; styling
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* Step 1: sources */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground mr-1">1. Add FL projects</span>
            <Button size="sm" onClick={addFlpOrZip}><FilePlus2 className="w-4 h-4 mr-1.5" /> Add FLP / ZIP</Button>
            <Button size="sm" variant="outline" onClick={addFolder}><FolderPlus className="w-4 h-4 mr-1.5" /> Add projects folder</Button>
            <div className="flex-1" />
            <Button size="sm" onClick={runScan} disabled={scanning || !sources.length}>
              {scanning ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Scan className="w-4 h-4 mr-1.5" />}
              {scanning ? "Analyzing…" : "Scan & auto-sort"}
            </Button>
          </div>
          {sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sources.map((s) => (
                <div key={s} className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-md bg-muted/50 border border-border/30 text-xs">
                  <span className="max-w-[260px] truncate font-mono text-muted-foreground">{s}</span>
                  <button type="button" aria-label="Remove" onClick={() => setSources((p) => p.filter((x) => x !== s))} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button type="button" onClick={() => setSources([])} className="text-xs text-muted-foreground hover:text-destructive px-2">Clear</button>
            </div>
          )}
          {scanning && progress && (
            <div className="rounded-lg border border-border/40 bg-card p-3">
              <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                <motion.div className="h-full bg-primary" animate={{ width: `${pct}%` }} transition={{ duration: 0.2 }} />
              </div>
              <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                <span className="truncate">{progress.phase === "analyzing" ? "Listening to samples…" : progress.file}</span>
                <span className="font-mono tabular-nums ml-2">{progress.current}/{progress.total}</span>
              </div>
            </div>
          )}
        </section>

        {showStyle && (
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border/40 bg-card/50 p-4">
            <TaxonomyEditor
              templates={config.templates}
              activeId={config.activeTemplateId}
              colorPresets={config.colorPresets}
              onSelectTemplate={(id) => update({ activeTemplateId: id })}
              onChange={(tpl) => setConfig((c) => ({ ...c, templates: c.templates.map((t) => (t.id === tpl.id ? tpl : t)) }))}
              onAddTemplate={(tpl) => setConfig((c) => ({ ...c, templates: [...c.templates, tpl] }))}
              onSavePreset={(p) => update({ colorPresets: [...config.colorPresets, p] })}
              onApplyPreset={(p) => setConfig((c) => ({
                ...c,
                templates: c.templates.map((t) => t.id === c.activeTemplateId
                  ? { ...t, categories: t.categories.map((cat) => ({ ...cat, color: p.colors[cat.id] ?? cat.color })) }
                  : t),
              }))}
            />
          </motion.section>
        )}

        {/* selection toolbar */}
        {selected.size > 0 && (
          <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 backdrop-blur">
            <span className="text-xs font-medium">{selected.size} selected</span>
            <div className="flex-1" />
            <Select onValueChange={reassign}>
              <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="Move to folder…" /></SelectTrigger>
              <SelectContent>{activeTemplate.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setRenameOpen(true)}><Sliders className="w-3.5 h-3.5 mr-1.5" /> Rename</Button>
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={attachImage}><ImageIcon className="w-3.5 h-3.5 mr-1.5" /> Image</Button>
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}

        {samples.length === 0 && !scanning && (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <Sparkles className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">Add your FL projects and hit <span className="text-foreground font-medium">Scan &amp; auto-sort</span></p>
            <p className="text-xs mt-1 opacity-70">It listens to every sample your projects use and sorts kicks, 808s, snares, hats &amp; more — even weirdly-named ones.</p>
          </div>
        )}

        {grouped.map((g) => {
          const color = soundColor(g.category)
          const allIn = g.items.every((i) => selected.has(i.id))
          return (
            <section key={g.category}>
              <button type="button" onClick={() => selectCategory(g.category)} className="flex items-center gap-2 mb-2 group w-full text-left">
                <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
                <span className="text-sm font-semibold">{soundLabel(g.category)}</span>
                <Badge variant="secondary" className="text-[10px]">{g.items.length}</Badge>
                <span className={cn("text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100", allIn && "opacity-100 text-primary")}>{allIn ? "deselect all" : "select all"}</span>
              </button>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {g.items.map((s) => {
                  const isSel = selected.has(s.id)
                  const img = config.imageAttachments[s.id]
                  return (
                    <div
                      key={s.id}
                      onClick={(e) => toggleSelect(s.id, e)}
                      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 52px" }}
                      className={cn("flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors select-none",
                        isSel ? "border-primary bg-primary/10" : "border-border/30 bg-card hover:bg-muted/40")}
                    >
                      <button type="button" aria-label={playingId === s.id ? "Pause" : "Play"} onClick={(e) => { e.stopPropagation(); playSample(s) }} className="w-8 h-8 rounded-md bg-muted/60 flex items-center justify-center flex-shrink-0 hover:bg-muted">
                        {playingId === s.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      {img && <img src={getAssetUrl(img)} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate flex items-center gap-1.5">
                          {dispName(s)}
                          {s.key && <span className="text-[9px] px-1 py-0.5 rounded bg-violet-500/15 text-violet-400 font-mono">{s.key}</span>}
                          {s.distorted && <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500/15 text-orange-400">dist</span>}
                        </div>
                        <MiniWave peaks={s.peaks} color={soundColor(effCat(s))} height={16} />
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-mono flex-shrink-0",
                            s.confidence > 0.7 ? "bg-emerald-500/15 text-emerald-500" : s.confidence > 0.45 ? "bg-amber-500/15 text-amber-500" : "bg-rose-500/15 text-rose-500")}>
                            {Math.round(s.confidence * 100)}%
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs">
                          via {s.method}
                          {s.fromFlp ? <><br />from {s.fromFlp.split(/[\\/]/).pop()}</> : null}
                          {s.features ? <><br />{s.features.durationSecs.toFixed(2)}s · {Math.round(s.features.centroidHz)}Hz · flat {s.features.flatness.toFixed(2)}</> : null}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {/* Build bar */}
      {samples.length > 0 && (
        <div className="flex items-center gap-3 px-6 py-3 border-t border-border/30 bg-card/60 backdrop-blur flex-shrink-0 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground">Build</span>
          <Button type="button" variant="outline" size="sm" onClick={pickBase} className="max-w-[260px]">
            <FolderInput className="w-4 h-4 mr-1.5 flex-shrink-0" />
            <span className="truncate">{baseDir ? `${baseDir}\\${sanitize(kitName)}` : "Choose location"}</span>
          </Button>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer"><Switch checked={writeNfo} onCheckedChange={setWriteNfo} /> .nfo</label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer"><Switch checked={addCover} onCheckedChange={setAddCover} /> cover</label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer"><Switch checked={addLicense} onCheckedChange={setAddLicense} /> license</label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer"><Switch checked={dedup} onCheckedChange={setDedup} /> dedupe</label>
          {selected.size > 0 && <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer"><Switch checked={onlySelected} onCheckedChange={setOnlySelected} /> selected only</label>}
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Music2 className="w-3.5 h-3.5" /> {samples.length}</span>
          <Button type="button" size="sm" onClick={runBuild} disabled={building}>
            {building ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Hammer className="w-4 h-4 mr-1.5" />}
            Build kit
          </Button>
        </div>
      )}

      <RenameDialog open={renameOpen} names={selSamples.map((s) => dispName(s))} onClose={() => setRenameOpen(false)} onApply={applyRenames} />
    </div>
  )
}
