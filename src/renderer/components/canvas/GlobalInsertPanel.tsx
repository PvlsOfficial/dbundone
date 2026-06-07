/**
 * Insert panel for the Global Canvas.
 * Floats on the right side of the canvas via tldraw's InFrontOfTheCanvas slot.
 * Shows lists of Projects, a Task creator, and music tools (Chord Chart).
 */
import React, { useState, useContext } from "react"
import type { Editor } from "@tldraw/tldraw"
import { GlobalCanvasContext } from "./CanvasContext"
import { getAssetUrl } from "@/lib/tauriApi"

const S = {
  panel: {
    background: "#111111",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "rgba(255,255,255,0.88)",
    overflow: "hidden",
  } as React.CSSProperties,
  section: {
    padding: "10px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
    marginBottom: 6,
  } as React.CSSProperties,
  item: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "6px 8px", borderRadius: 8,
    cursor: "pointer", transition: "background 0.1s",
    fontSize: 12, color: "rgba(255,255,255,0.78)",
  } as React.CSSProperties,
  addBtn: {
    marginLeft: "auto", flexShrink: 0,
    width: 20, height: 20, borderRadius: 5,
    background: "rgba(99,102,241,0.2)",
    border: "1px solid rgba(99,102,241,0.35)",
    color: "#a5b4fc", fontSize: 14,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
  } as React.CSSProperties,
}

const STATUS_COLOR: Record<string, string> = {
  idea: "#a78bfa", "in-progress": "#60a5fa",
  mixing: "#34d399", mastering: "#fbbf24",
  completed: "#10b981", released: "#6366f1", archived: "#6b7280",
}

export function GlobalInsertPanel({ editor }: { editor: Editor }) {
  const ctx = useContext(GlobalCanvasContext)
  const [open, setOpen] = useState(true)
  const [projectSearch, setProjectSearch] = useState("")

  const placeAt = (offsetX = 0, offsetY = 0) => {
    const c = editor.getViewportPageBounds().center
    return { x: c.x - offsetX, y: c.y - offsetY }
  }

  const addProjectCard = (project: typeof ctx.projects[0]) => {
    const artworkUrl = project.artworkPath ? getAssetUrl(project.artworkPath) : ""
    const pos = placeAt(110, 145)
    editor.createShape({
      type: "project-card",
      ...pos,
      props: {
        projectId: project.id,
        title: project.title,
        bpm: project.bpm ?? 0,
        musicalKey: project.musicalKey ?? "",
        status: project.status ?? "idea",
        genre: project.genre ?? "",
        artworkUrl,
      },
    })
  }

  const addTaskCard = () => {
    const pos = placeAt(120, 60)
    editor.createShape({
      type: "task-card",
      ...pos,
      props: { title: "New task", notes: "", priority: "medium", done: false, dueDate: "", tags: "" },
    })
  }

  const addChordChart = () => {
    const pos = placeAt(150, 120)
    editor.createShape({
      type: "chord-chart",
      ...pos,
      props: { root: "C", scale: "major" },
    })
  }

  const filteredProjects = ctx.projects.filter(p =>
    p.title.toLowerCase().includes(projectSearch.toLowerCase())
  ).slice(0, 12)

  if (!open) {
    return (
      <div style={{
        position: "absolute", right: 8, top: "50%",
        transform: "translateY(-50%)", zIndex: 300,
      }}>
        <button
          onClick={() => setOpen(true)}
          style={{
            width: 32, height: 56, borderRadius: 10,
            background: "#111", border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          }}
          title="Open insert panel"
        >‹</button>
      </div>
    )
  }

  return (
    <div style={{
      position: "absolute", right: 8, top: "50%",
      transform: "translateY(-50%)", zIndex: 300,
      width: 220, maxHeight: "80vh",
      display: "flex", flexDirection: "column",
      ...S.panel,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>Insert</span>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.3)",
            cursor: "pointer", fontSize: 16, padding: 0,
          }}
        >›</button>
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {/* ── Projects ── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Projects</div>
          <input
            placeholder="Search…"
            value={projectSearch}
            onChange={e => setProjectSearch(e.target.value)}
            style={{
              width: "100%", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 7, padding: "4px 8px", fontSize: 11,
              color: "rgba(255,255,255,0.7)", outline: "none",
              marginBottom: 6, boxSizing: "border-box",
            }}
          />
          {filteredProjects.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, textAlign: "center", padding: "8px 0" }}>
              No projects
            </div>
          )}
          {filteredProjects.map(p => (
            <div
              key={p.id}
              style={S.item}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              onClick={() => addProjectCard(p)}
            >
              <div style={{
                width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                background: STATUS_COLOR[p.status] ?? "#6366f1",
              }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.title}
              </span>
              <div style={S.addBtn}>+</div>
            </div>
          ))}
        </div>

        {/* ── Tasks ── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Task</div>
          <div
            style={{ ...S.item, background: "rgba(99,102,241,0.08)", borderRadius: 8 }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(99,102,241,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(99,102,241,0.08)")}
            onClick={addTaskCard}
          >
            <span style={{ fontSize: 14 }}>☑</span>
            <span>New Task Card</span>
            <div style={S.addBtn}>+</div>
          </div>
        </div>

        {/* ── Music ── */}
        <div style={{ ...S.section, borderBottom: "none" }}>
          <div style={S.sectionTitle}>Music Tools</div>
          <div
            style={S.item}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            onClick={addChordChart}
          >
            <span style={{ fontSize: 14 }}>♩</span>
            <span>Chord Chart</span>
            <div style={S.addBtn}>+</div>
          </div>
        </div>
      </div>
    </div>
  )
}
