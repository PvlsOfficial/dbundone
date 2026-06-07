/**
 * Project-specific canvas — lives in the Canvas tab of ProjectDetail.
 * Custom shapes: AudioVersionCard, ProjectTaskCard, AnnotationCard.
 * Custom panel: ProjectInsertPanel.
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
import { PROJECT_SHAPE_UTILS } from "./canvas/projectShapes"
import { ProjectInsertPanel } from "./canvas/ProjectInsertPanel"
import { ProjectCanvasContext, ProjectCanvasContextValue } from "./canvas/CanvasContext"
import { CanvasOverlay, type CanvasMode } from "./canvas/CanvasOverlay"
import type { Project, Task, AudioVersion, Annotation, DistributionLink } from "@shared/types"

function useDebounced<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback((...args: Parameters<T>) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => fn(...args), ms)
  }, [fn, ms]) as T
}

export interface ProjectCanvasProps {
  projectId: string
  project?: Project | null
  tasks?: Task[]
  versions?: AudioVersion[]
  annotations?: Annotation[]
  distributionLinks?: DistributionLink[]
  onOpenProject?: (projectId: string) => void
  mode?: CanvasMode
  onSetMode?: (m: CanvasMode) => void
}

export function ProjectCanvas({
  projectId,
  project = null,
  tasks = [],
  versions = [],
  annotations = [],
  distributionLinks = [],
  onOpenProject,
  mode = "normal",
  onSetMode,
}: ProjectCanvasProps) {
  const editorRef = useRef<Editor | null>(null)
  const [mountedEditor, setMountedEditor] = useState<Editor | null>(null)
  const [loading, setLoading] = useState(true)
  const [savedSnapshot, setSavedSnapshot] = useState<TLEditorSnapshot | null>(null)
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved")
  const isFirstLoad = useRef(true)
  const containerRef = useRef<HTMLDivElement>(null)

  // Prevent WebView2 from consuming trackpad pinch gestures as browser zoom.
  // A non-passive wheel listener that calls preventDefault() lets tldraw
  // receive the ctrl+wheel events and handle canvas zoom itself.
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
    setSavedSnapshot(null)
    window.electron?.getCanvasData(projectId).then(data => {
      if (data) {
        try { setSavedSnapshot(JSON.parse(data)) } catch { setSavedSnapshot(null) }
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [projectId])

  const doSave = useCallback((editor: Editor) => {
    setSaveStatus("saving")
    const json = JSON.stringify(getSnapshot(editor.store))
    window.electron?.saveCanvasData(projectId, json)
      .then(() => setSaveStatus("saved"))
      .catch(() => setSaveStatus("unsaved"))
  }, [projectId])

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

  const ctxValue: ProjectCanvasContextValue = {
    project, tasks, versions, annotations, distributionLinks, onOpenProject,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0a0a]">
        <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
      </div>
    )
  }

  return (
    <ProjectCanvasContext.Provider value={ctxValue}>
      <div className="flex flex-col w-full h-full bg-[#0a0a0a]">
        <CanvasOverlay saveStatus={saveStatus} mode={mode} onSetMode={onSetMode} />
        <div ref={containerRef} className="relative flex-1 min-h-0 touch-none">
          <Tldraw
            shapeUtils={PROJECT_SHAPE_UTILS}
            onMount={handleMount}
            inferDarkMode
          />
          {mountedEditor && <ProjectInsertPanel editor={mountedEditor} />}
        </div>
      </div>
    </ProjectCanvasContext.Provider>
  )
}
