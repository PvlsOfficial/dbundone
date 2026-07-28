import React, { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, X, Sparkles, Disc3, CornerDownLeft, Music2, Star, Database, Loader2 } from "lucide-react"
import type { Project, FlpAnalysis, PluginSession } from "@shared/types"
import { buildDnaDocs, searchCatalog, SearchResult } from "@/lib/catalogDna"
import { cn, assetUrl } from "@/lib/utils"

interface CatalogSearchProps {
  open: boolean
  onClose: () => void
  projects: Project[]
  analyses: Record<string, FlpAnalysis>
  sessions: PluginSession[]
  onOpenProject: (project: Project) => void
  /** Called after indexing so the parent re-pulls the analysis cache. */
  onReloadAnalyses?: () => void
  accentColor?: string
}

interface IndexProgress {
  current: number
  total: number
  analyzed: number
  file: string
  isRunning: boolean
}

const EXAMPLES: { label: string; query: string }[] = [
  { label: "Serum + 808", query: "serum 808" },
  { label: "Sidechain", query: "sidechain" },
  { label: "Spinz 808", query: "sample:spinz" },
  { label: "Trap in a minor key", query: "genre:trap minor" },
  { label: "Around 140 BPM", query: "bpm:130-150" },
  { label: "Over 2 hours spent", query: ">2h" },
  { label: "Saturation", query: "saturation" },
  { label: "Used Pro-Q 3", query: "plugin:\"pro-q\"" },
  { label: "Top-rated, mixing", query: "rating:>=4 status:mixing" },
]

export function CatalogSearch({
  open, onClose, projects, analyses, sessions, onOpenProject, onReloadAnalyses, accentColor = "#6366f1",
}: CatalogSearchProps) {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [indexing, setIndexing] = useState<IndexProgress | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // How much of the catalog has plugin/sample data (only those are deep-searchable).
  const indexedCount = useMemo(
    () => projects.reduce((n, p) => (analyses[p.id] ? n + 1 : n), 0),
    [projects, analyses],
  )
  const indexable = projects.length

  // Kick off a full-catalog index: analyze every project's DAW file & cache it.
  const startIndexing = useCallback(async () => {
    if (indexing) return
    setIndexing({ current: 0, total: 0, analyzed: 0, file: "Starting…", isRunning: true })
    let unlisten: (() => void) | null = null
    try {
      unlisten = (await window.electron?.onAnalyzeProgress?.((p: any) => {
        setIndexing({
          current: p.current, total: p.total, analyzed: p.analyzed,
          file: p.file, isRunning: p.isRunning,
        })
      })) || null
      await window.electron?.analyzeAllProjects?.(false)
    } catch (err) {
      console.error("Catalog indexing failed:", err)
    } finally {
      if (unlisten) unlisten()
      setIndexing(null)
      onReloadAnalyses?.()
    }
  }, [indexing, onReloadAnalyses])

  const stopIndexing = useCallback(() => {
    window.electron?.cancelAnalyzeAll?.()
  }, [])

  // Build fingerprints once per data change (cheap, fully client-side).
  const docs = useMemo(
    () => buildDnaDocs(projects, analyses, sessions),
    [projects, analyses, sessions],
  )

  const { results, similarTarget, empty } = useMemo(
    () => searchCatalog(docs, query),
    [docs, query],
  )

  useEffect(() => {
    if (open) {
      setQuery("")
      setActive(0)
      // focus after the open animation begins
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => setActive(0), [query])

  // Keep the active row scrolled into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [active])

  const choose = useCallback((p: Project) => {
    onClose()
    onOpenProject(p)
  }, [onClose, onOpenProject])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const r = results[active]
      if (r) choose(r.project)
    } else if (e.key === "Escape") {
      e.preventDefault()
      if (query) setQuery("")
      else onClose()
    }
  }, [results, active, choose, query, onClose])

  const findSimilar = useCallback((p: Project, e: React.MouseEvent) => {
    e.stopPropagation()
    setQuery(`like:"${p.title}"`)
    inputRef.current?.focus()
  }, [])

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        key="catalog-search"
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        role="dialog"
        aria-modal="true"
        onMouseDown={onClose}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div
          className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
            <Search className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search by anything — plugin, sample, key, BPM, vibe…"
              className="flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
              spellCheck={false}
              autoComplete="off"
            />
            {query && (
              <button
                onClick={() => { setQuery(""); inputRef.current?.focus() }}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Clear"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
              ESC
            </kbd>
          </div>

          {/* Catalog index status — plugin/sample search only covers indexed projects. */}
          {indexing ? (
            <div
              className="px-4 py-2 text-xs"
              style={{ background: `${accentColor}1a`, color: accentColor }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Indexing catalog… {indexing.current}/{indexing.total || "?"}
                  {indexing.analyzed ? ` · ${indexing.analyzed} done` : ""}
                </span>
                <button
                  type="button"
                  onClick={stopIndexing}
                  className="rounded px-2 py-0.5 font-medium hover:bg-black/10"
                >
                  Stop
                </button>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-black/10">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${indexing.total ? (indexing.current / indexing.total) * 100 : 0}%`,
                    background: accentColor,
                  }}
                />
              </div>
            </div>
          ) : indexedCount < indexable ? (
            <button
              type="button"
              onClick={startIndexing}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs transition-colors hover:bg-muted/60"
              style={{ color: accentColor }}
            >
              <Database className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                {indexedCount}/{indexable} projects indexed for plugin &amp; sample search —{" "}
                <strong>click to index the rest</strong>
              </span>
            </button>
          ) : null}

          {/* Similarity banner */}
          {similarTarget && (
            <div
              className="flex items-center gap-2 px-4 py-2 text-xs"
              style={{ background: `${accentColor}1a`, color: accentColor }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Projects with similar DNA to <strong>{similarTarget.title}</strong></span>
            </div>
          )}

          {/* Body */}
          <div ref={listRef} className="max-h-[52vh] overflow-y-auto">
            {empty ? (
              <div className="px-4 py-5">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Try
                </p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.query}
                      onClick={() => { setQuery(ex.query); inputRef.current?.focus() }}
                      className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  Filters: <code className="text-foreground">plugin:</code>{" "}
                  <code className="text-foreground">sample:</code>{" "}
                  <code className="text-foreground">key:</code>{" "}
                  <code className="text-foreground">bpm:</code>{" "}
                  <code className="text-foreground">tag:</code>{" "}
                  <code className="text-foreground">daw:</code>{" "}
                  <code className="text-foreground">status:</code>{" "}
                  <code className="text-foreground">rating:</code>{" "}
                  <code className="text-foreground">time:</code>{" "}
                  <code className="text-foreground">like:</code>
                  {" "}· combine freely · prefix <code className="text-foreground">-</code> to exclude
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Time spent: type <code className="text-foreground">&gt;2h</code>,{" "}
                  <code className="text-foreground">time:&lt;90m</code> or a range like{" "}
                  <code className="text-foreground">1-3h</code>.
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Technique words expand to the tools that make them —{" "}
                  <code className="text-foreground">sidechain</code> finds Kickstart / LFOTool / ShaperBox,{" "}
                  <code className="text-foreground">saturation</code>, <code className="text-foreground">reverb</code>,{" "}
                  <code className="text-foreground">delay</code>, <code className="text-foreground">autotune</code> too.
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
                <Disc3 className="h-6 w-6 opacity-50" />
                <p className="text-sm">No projects match that.</p>
              </div>
            ) : (
              <div className="py-1.5">
                {results.slice(0, 40).map((r, i) => (
                  <ResultRow
                    key={r.project.id}
                    result={r}
                    idx={i}
                    active={i === active}
                    accentColor={accentColor}
                    onHover={() => setActive(i)}
                    onClick={() => choose(r.project)}
                    onFindSimilar={(e) => findSimilar(r.project, e)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {!empty && results.length > 0 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              <span>{results.length} match{results.length === 1 ? "" : "es"}</span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> open</span>
                <span>↑↓ navigate</span>
              </span>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function ResultRow({
  result, idx, active, accentColor, onHover, onClick, onFindSimilar,
}: {
  result: SearchResult
  idx: number
  active: boolean
  accentColor: string
  onHover: () => void
  onClick: () => void
  onFindSimilar: (e: React.MouseEvent) => void
}) {
  const { project, reasons } = result
  const art = assetUrl(project.artworkPath)
  const sub = [
    project.dawType,
    project.bpm ? `${project.bpm} BPM` : null,
    project.musicalKey || null,
  ].filter(Boolean).join(" · ")

  return (
    <div
      data-idx={idx}
      onMouseMove={onHover}
      onClick={onClick}
      className={cn(
        "group mx-1.5 flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition-colors",
        active ? "bg-muted" : "hover:bg-muted/50",
      )}
    >
      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-muted">
        {art ? (
          <img src={art} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music2 className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{project.title}</span>
          {!!project.rating && (
            <span className="flex flex-shrink-0 items-center gap-0.5 text-[10px] text-amber-400">
              <Star className="h-3 w-3 fill-current" />{project.rating}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 truncate">
          {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
          {reasons.map((reason) => (
            <span
              key={reason}
              className="flex-shrink-0 truncate rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: `${accentColor}26`, color: accentColor }}
            >
              {reason}
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={onFindSimilar}
        title="Find similar projects"
        className={cn(
          "flex-shrink-0 rounded-md p-1.5 text-muted-foreground transition-all hover:bg-background hover:text-foreground",
          active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <Sparkles className="h-4 w-4" />
      </button>
    </div>
  )
}
