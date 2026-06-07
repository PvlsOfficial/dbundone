/**
 * Global canvas — the free-form board page.
 * Persists under key "__global__" in the canvas_data table.
 * Custom shapes: ProjectCard, TaskCard, ChordChart.
 * Custom panel: GlobalInsertPanel.
 */
import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  Tldraw,
  Editor,
  getSnapshot,
  loadSnapshot,
  TLEditorSnapshot,
} from "@tldraw/tldraw"
import "@tldraw/tldraw/tldraw.css"
import { Loader2 } from "lucide-react"
import { GLOBAL_SHAPE_UTILS } from "./canvas/globalShapes"
import { GlobalInsertPanel } from "./canvas/GlobalInsertPanel"
import { GlobalCanvasContext, GlobalCanvasContextValue } from "./canvas/CanvasContext"
import { CanvasOverlay, type CanvasMode } from "./canvas/CanvasOverlay"
import type { Project, Task } from "@shared/types"

const CANVAS_ID = "__global__"

// debounce hook
function useDebounced<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback((...args: Parameters<T>) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => fn(...args), ms)
  }, [fn, ms]) as T
}

interface GlobalCanvasProps {
  projects: Project[]
  tasks: Task[]
  onOpenProject?: (projectId: string) => void
  mode?: CanvasMode
  onSetMode?: (m: CanvasMode) => void
}

export function GlobalCanvas({
  projects,
  tasks,
  onOpenProject,
  mode = "normal",
  onSetMode,
}: GlobalCanvasProps) {
  const editorRef = useRef<Editor | null>(null)
  const [mountedEditor, setMountedEditor] = useState<Editor | null>(null)
  const [loading, setLoading] = useState(true)
  const [savedSnapshot, setSavedSnapshot] = useState<TLEditorSnapshot | null>(null)
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved")
  const isFirstLoad = useRef(true)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => e.preventDefault()
    el.addEventListener("wheel", handler, { passive: false })
    return () => el.removeEventListener("wheel", handler)
  }, [])

  useEffect(() => {
    setLoading(true)
    isFirstLoad.current = true
    window.electron?.getCanvasData(CANVAS_ID).then(data => {
      if (data) {
        try { setSavedSnapshot(JSON.parse(data)) } catch { setSavedSnapshot(null) }
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const doSave = useCallback((editor: Editor) => {
    setSaveStatus("saving")
    const json = JSON.stringify(getSnapshot(editor.store))
    window.electron?.saveCanvasData(CANVAS_ID, json)
      .then(() => setSaveStatus("saved"))
      .catch(() => setSaveStatus("unsaved"))
  }, [])

  const debouncedSave = useDebounced(doSave, 800)

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor
    setMountedEditor(editor)
    editor.user.updateUserPreferences({ colorScheme: "dark" })
    if (savedSnapshot) {
      try { loadSnapshot(editor.store, savedSnapshot) } catch {}
    }
    const unsub = editor.store.listen(() => {
      if (isFirstLoad.current) { isFirstLoad.current = false; return }
      setSaveStatus("unsaved")
      debouncedSave(editor)
    }, { source: "user", scope: "document" })
    return () => unsub()
  }, [savedSnapshot, debouncedSave])

  const ctxValue: GlobalCanvasContextValue = { projects, tasks, onOpenProject }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0a0a]">
        <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
      </div>
    )
  }

  return (
    <GlobalCanvasContext.Provider value={ctxValue}>
      <div className="flex flex-col w-full h-full bg-[#0a0a0a]">
        <CanvasOverlay saveStatus={saveStatus} mode={mode} onSetMode={onSetMode} />
        <div ref={containerRef} className="relative flex-1 min-h-0 touch-none">
          <Tldraw
            shapeUtils={GLOBAL_SHAPE_UTILS}
            onMount={handleMount}
            inferDarkMode
          />
          {mountedEditor && <GlobalInsertPanel editor={mountedEditor} />}
        </div>
      </div>
    </GlobalCanvasContext.Provider>
  )
}
