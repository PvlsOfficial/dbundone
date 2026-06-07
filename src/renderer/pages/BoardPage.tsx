import React, { useMemo, useState } from "react"
import { GlobalCanvas } from "@/components/GlobalCanvas"
import type { CanvasMode } from "@/components/canvas/CanvasOverlay"
import type { Project, Task, AppSettings, ProjectStatus } from "@shared/types"
import { Lightbulb, Pencil, Headphones, Sliders, CheckCircle2, PartyPopper, Archive, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface BoardPageProps {
  projects: Project[]
  tasks: Task[]
  settings?: AppSettings
  onSettingsChange?: (settings: Partial<AppSettings>) => void
  onOpenProject: (projectId: string) => void
}

const STATUS_LIST: { key: ProjectStatus; label: string; icon: React.ReactNode; hex: string }[] = [
  { key: "idea",         label: "Idea",        icon: <Lightbulb     className="w-3 h-3" />, hex: "#a855f7" },
  { key: "in-progress",  label: "In Progress", icon: <Pencil        className="w-3 h-3" />, hex: "#3b82f6" },
  { key: "mixing",       label: "Mixing",      icon: <Headphones    className="w-3 h-3" />, hex: "#f97316" },
  { key: "mastering",    label: "Mastering",   icon: <Sliders       className="w-3 h-3" />, hex: "#14b8a6" },
  { key: "completed",    label: "Completed",   icon: <CheckCircle2  className="w-3 h-3" />, hex: "#22c55e" },
  { key: "released",     label: "Released",    icon: <PartyPopper   className="w-3 h-3" />, hex: "#eab308" },
  { key: "archived",     label: "Archived",    icon: <Archive       className="w-3 h-3" />, hex: "#6b7280" },
]

export function BoardPage({ projects, tasks, settings, onSettingsChange, onOpenProject }: BoardPageProps) {
  const [mode, setMode] = useState<CanvasMode>("normal")

  const hidden = settings?.boardHiddenStatuses ?? []
  const hiddenSet = useMemo(() => new Set(hidden), [hidden])

  const visibleProjects = useMemo(
    () => projects.filter(p => !hiddenSet.has(p.status)),
    [projects, hiddenSet]
  )

  const toggleStatus = (key: ProjectStatus) => {
    if (!onSettingsChange) return
    const next = hiddenSet.has(key)
      ? hidden.filter(k => k !== key)
      : [...hidden, key]
    onSettingsChange({ boardHiddenStatuses: next })
  }

  const allVisible = hidden.length === 0
  const showAll = () => onSettingsChange?.({ boardHiddenStatuses: [] })

  return (
    <div className="flex flex-col h-full">
      {/* Header — hidden in expanded/fullscreen */}
      {mode === "normal" && (
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/30 bg-card/30 shrink-0 gap-4">
          <div className="flex-shrink-0">
            <h1 className="text-lg font-semibold">Board</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Free-form canvas — drag projects, tasks &amp; music tools
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {STATUS_LIST.map(s => {
              const visible = !hiddenSet.has(s.key)
              const count = projects.filter(p => p.status === s.key).length
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggleStatus(s.key)}
                  title={visible ? `Hide ${s.label}` : `Show ${s.label}`}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-all border",
                    visible
                      ? "border-transparent text-foreground"
                      : "border-border/40 text-muted-foreground/50 line-through"
                  )}
                  style={visible ? { backgroundColor: `${s.hex}1a`, color: s.hex } : undefined}
                >
                  {visible ? s.icon : <EyeOff className="w-3 h-3" />}
                  <span>{s.label}</span>
                  {count > 0 && <span className="opacity-60 ml-0.5">{count}</span>}
                </button>
              )
            })}
            {!allVisible && (
              <button
                type="button"
                onClick={showAll}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
                title="Show all statuses"
              >
                <Eye className="w-3 h-3" />
                Show all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Canvas wrapper — repositions without remounting tldraw */}
      <div className={
        mode === "fullscreen" ? "fixed inset-0 z-[9999] bg-[#0a0a0a]" :
        "flex-1 min-h-0"
      }>
        <GlobalCanvas
          projects={visibleProjects}
          tasks={tasks}
          onOpenProject={onOpenProject}
          mode={mode}
          onSetMode={setMode}
        />
      </div>
    </div>
  )
}
