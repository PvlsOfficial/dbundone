/**
 * Custom tldraw shapes for the Global Canvas.
 * Shapes: project-card | task-card | chord-chart
 *
 * Pointer-event contract:
 *  - Outer container: pointerEvents 'all' always (tldraw needs this for hit-testing)
 *  - Interactive elements: onPointerDown e.stopPropagation() so tldraw doesn't
 *    intercept the click and start a drag/select instead
 */
import React, { useContext } from "react"
import {
  ShapeUtil,
  TLShape,
  Rectangle2d,
  HTMLContainer,
  resizeBox,
  TLResizeInfo,
} from "@tldraw/tldraw"
import { GlobalCanvasContext } from "./CanvasContext"

// ─── Register custom shape props with tldraw's type system ───────────────────
type ProjectCardProps = {
  w: number; h: number; projectId: string; title: string; bpm: number
  musicalKey: string; status: string; genre: string; artworkUrl: string
}
type TaskCardProps = {
  w: number; h: number; title: string; notes: string
  priority: string; done: boolean; dueDate: string; tags: string
}
type ChordChartProps = { w: number; h: number; root: string; scale: string }

declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap {
    "project-card": ProjectCardProps
    "task-card": TaskCardProps
    "chord-chart": ChordChartProps
  }
}

// ─────────────────── Design tokens ───────────────────
const S = {
  bg: "#161616",
  border: "1px solid rgba(255,255,255,0.07)",
  radius: 12,
  text: "rgba(255,255,255,0.9)",
  textSub: "rgba(255,255,255,0.45)",
  textMuted: "rgba(255,255,255,0.22)",
  accent: "#6366f1",
  accentBg: "rgba(99,102,241,0.14)",
  accentBorder: "rgba(99,102,241,0.3)",
  font: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
}

const STATUS_COLOR: Record<string, string> = {
  idea: "#a78bfa", "in-progress": "#60a5fa", mixing: "#34d399",
  mastering: "#fbbf24", completed: "#10b981", released: "#6366f1", archived: "#6b7280",
}
const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e",
}

// Prevent tldraw from handling pointer events on interactive sub-elements
const stop = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation()

// ═══════════════════════════════════════════════════════
// 1. PROJECT CARD
// ═══════════════════════════════════════════════════════

export type ProjectCardShape = TLShape<"project-card">

export class ProjectCardShapeUtil extends ShapeUtil<ProjectCardShape> {
  static override type = "project-card" as const
  override canResize() { return true }
  override isAspectRatioLocked() { return false }

  getDefaultProps(): ProjectCardShape["props"] {
    return { w: 220, h: 290, projectId: "", title: "Untitled", bpm: 0, musicalKey: "", status: "idea", genre: "", artworkUrl: "" }
  }

  getGeometry(shape: ProjectCardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: ProjectCardShape) {
    const ctx = useContext(GlobalCanvasContext)
    const { title, bpm, musicalKey, status, genre, artworkUrl, w, h, projectId } = shape.props
    const statusColor = STATUS_COLOR[status] ?? S.accent

    return (
      <HTMLContainer>
        <div
          style={{ width: w, height: h, background: S.bg, border: S.border, borderRadius: S.radius, overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: S.font, boxShadow: "0 4px 24px rgba(0,0,0,0.5)", pointerEvents: "all", cursor: "default", userSelect: "none" }}
          onDoubleClick={(e) => { e.stopPropagation(); if (projectId && ctx.onOpenProject) ctx.onOpenProject(projectId) }}
        >
          {/* Artwork */}
          <div style={{ height: 140, flexShrink: 0, position: "relative", background: artworkUrl ? `url("${artworkUrl}") center/cover` : "linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)" }}>
            {!artworkUrl && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, opacity: 0.2 }}>♪</div>}
            <div style={{ position: "absolute", top: 8, right: 8, background: statusColor + "cc", borderRadius: 20, padding: "2px 9px", fontSize: 10, color: "#fff", fontWeight: 700, textTransform: "capitalize", backdropFilter: "blur(8px)" }}>
              {status.replace("-", " ")}
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ color: S.text, fontWeight: 600, fontSize: 14, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</div>
            {genre && <div style={{ color: S.textSub, fontSize: 11 }}>{genre}</div>}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 2 }}>
              {bpm > 0 && <span style={{ background: S.accentBg, border: `1px solid ${S.accentBorder}`, borderRadius: 6, padding: "2px 7px", fontSize: 11, color: "#a5b4fc" }}>{bpm} BPM</span>}
              {musicalKey && musicalKey !== "None" && <span style={{ background: S.accentBg, border: `1px solid ${S.accentBorder}`, borderRadius: 6, padding: "2px 7px", fontSize: 11, color: "#a5b4fc" }}>{musicalKey}</span>}
            </div>
            <div style={{ marginTop: "auto", color: S.textMuted, fontSize: 10 }}>Double-click to open</div>
          </div>
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: ProjectCardShape) { return <rect width={shape.props.w} height={shape.props.h} rx={12} /> }
  override onResize(shape: ProjectCardShape, info: TLResizeInfo<ProjectCardShape>) { return resizeBox(shape, info) }
}

// ═══════════════════════════════════════════════════════
// 2. TASK CARD
// ═══════════════════════════════════════════════════════

export type TaskCardShape = TLShape<"task-card">

export class TaskCardShapeUtil extends ShapeUtil<TaskCardShape> {
  static override type = "task-card" as const
  override canResize() { return true }
  override isAspectRatioLocked() { return false }

  getDefaultProps(): TaskCardShape["props"] {
    return { w: 240, h: 120, title: "New task", notes: "", priority: "medium", done: false, dueDate: "", tags: "" }
  }

  getGeometry(shape: TaskCardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: TaskCardShape) {
    const { title, notes, priority, done, dueDate, tags, w, h } = shape.props
    const prioColor = PRIORITY_COLOR[priority] ?? "#eab308"
    const tagList = tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : []

    const toggleDone = (e: React.MouseEvent) => {
      e.stopPropagation()
      this.editor.updateShape<TaskCardShape>({ id: shape.id, type: "task-card", props: { done: !done } })
    }

    return (
      <HTMLContainer>
        <div
          style={{ width: w, height: h, background: S.bg, border: S.border, borderLeft: `3px solid ${prioColor}`, borderRadius: S.radius, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6, fontFamily: S.font, boxShadow: "0 2px 12px rgba(0,0,0,0.4)", pointerEvents: "all", userSelect: "none" }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <button
              onClick={toggleDone}
              onPointerDown={stop}
              style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1, border: done ? "none" : "2px solid rgba(255,255,255,0.25)", borderRadius: 5, background: done ? S.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
            >
              {done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
            <div style={{ color: done ? S.textMuted : S.text, fontSize: 13, fontWeight: 500, lineHeight: 1.35, textDecoration: done ? "line-through" : "none", flex: 1, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {title}
            </div>
          </div>
          {notes && <div style={{ color: S.textSub, fontSize: 11, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{notes}</div>}
          <div style={{ marginTop: "auto", display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ background: prioColor + "22", border: `1px solid ${prioColor}44`, borderRadius: 5, padding: "1px 6px", fontSize: 10, color: prioColor, fontWeight: 600, textTransform: "capitalize" }}>{priority}</span>
            {dueDate && <span style={{ color: S.textMuted, fontSize: 10 }}>Due {dueDate}</span>}
            {tagList.map(tag => <span key={tag} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "1px 6px", fontSize: 10, color: S.textSub }}>#{tag}</span>)}
          </div>
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: TaskCardShape) { return <rect width={shape.props.w} height={shape.props.h} rx={12} /> }
  override onResize(shape: TaskCardShape, info: TLResizeInfo<TaskCardShape>) { return resizeBox(shape, info) }
}

// ═══════════════════════════════════════════════════════
// 3. CHORD CHART
// ═══════════════════════════════════════════════════════

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]
const SCALES: Record<string, { intervals: number[]; label: string }> = {
  major:      { intervals: [0,2,4,5,7,9,11], label: "Major" },
  minor:      { intervals: [0,2,3,5,7,8,10], label: "Minor" },
  dorian:     { intervals: [0,2,3,5,7,9,10], label: "Dorian" },
  mixolydian: { intervals: [0,2,4,5,7,9,10], label: "Mixolydian" },
  lydian:     { intervals: [0,2,4,6,7,9,11], label: "Lydian" },
  phrygian:   { intervals: [0,1,3,5,7,8,10], label: "Phrygian" },
  locrian:    { intervals: [0,1,3,5,6,8,10], label: "Locrian" },
}
const CHORD_QUALITY: Record<string, string[]> = {
  major: ["maj","min","min","maj","maj","min","dim"],
  minor: ["min","dim","maj","min","min","maj","maj"],
  dorian: ["min","min","maj","maj","min","dim","maj"],
  mixolydian: ["maj","min","dim","maj","min","min","maj"],
  lydian: ["maj","maj","min","dim","maj","min","min"],
  phrygian: ["min","maj","maj","min","dim","maj","min"],
  locrian: ["dim","maj","min","min","maj","maj","min"],
}
const ROMAN = ["I","ii","iii","IV","V","vi","vii°"]
const QUALITY_COLOR: Record<string, string> = { maj: "#6366f1", min: "#60a5fa", dim: "#f87171" }

function buildScale(root: string, scaleKey: string) {
  const rootIdx = NOTE_NAMES.indexOf(root)
  if (rootIdx < 0) return []
  const scale = SCALES[scaleKey] ?? SCALES.major
  const qualities = CHORD_QUALITY[scaleKey] ?? CHORD_QUALITY.major
  return scale.intervals.map((interval, i) => ({
    note: NOTE_NAMES[(rootIdx + interval) % 12],
    roman: ROMAN[i],
    quality: qualities[i],
  }))
}

export type ChordChartShape = TLShape<"chord-chart">

export class ChordChartShapeUtil extends ShapeUtil<ChordChartShape> {
  static override type = "chord-chart" as const
  override canResize() { return true }
  override isAspectRatioLocked() { return false }
  override canEdit() { return true }

  getDefaultProps(): ChordChartShape["props"] {
    return { w: 300, h: 240, root: "C", scale: "major" }
  }

  getGeometry(shape: ChordChartShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  component(shape: ChordChartShape) {
    const { root, scale, w, h } = shape.props
    const chords = buildScale(root, scale)
    const scaleLabel = SCALES[scale]?.label ?? scale
    const scaleNotes = chords.map(c => c.note).join("  ")

    const setRoot = (e: React.ChangeEvent<HTMLSelectElement>) => {
      e.stopPropagation()
      this.editor.updateShape<ChordChartShape>({ id: shape.id, type: "chord-chart", props: { root: e.target.value } })
    }
    const setScale = (e: React.ChangeEvent<HTMLSelectElement>) => {
      e.stopPropagation()
      this.editor.updateShape<ChordChartShape>({ id: shape.id, type: "chord-chart", props: { scale: e.target.value } })
    }

    const sel: React.CSSProperties = { background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: S.text, fontSize: 12, padding: "3px 7px", cursor: "pointer", outline: "none", fontFamily: S.font }

    return (
      <HTMLContainer>
        <div
          style={{ width: w, height: h, background: S.bg, border: S.border, borderRadius: S.radius, padding: "14px", display: "flex", flexDirection: "column", gap: 10, fontFamily: S.font, boxShadow: "0 4px 24px rgba(0,0,0,0.5)", pointerEvents: "all", overflow: "hidden", userSelect: "none" }}
        >
          {/* Header with interactive selects */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14, opacity: 0.5 }}>♩</span>
              <span style={{ color: S.text, fontWeight: 700, fontSize: 14 }}>{root} {scaleLabel}</span>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <select value={root} onChange={setRoot} onPointerDown={stop} style={sel}>
                {NOTE_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select value={scale} onChange={setScale} onPointerDown={stop} style={sel}>
                {Object.entries(SCALES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          {/* Scale notes */}
          <div style={{ color: S.textSub, fontSize: 11, letterSpacing: "0.06em", fontFamily: "monospace", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {scaleNotes}
          </div>

          {/* Diatonic chords */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", flex: 1, alignContent: "flex-start" }}>
            {chords.map((chord, i) => {
              const qColor = QUALITY_COLOR[chord.quality] ?? S.accent
              return (
                <div key={i} style={{ background: qColor + "18", border: `1px solid ${qColor}35`, borderRadius: 8, padding: "6px 10px", minWidth: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span style={{ color: S.textMuted, fontSize: 9, fontWeight: 600 }}>{chord.roman}</span>
                  <span style={{ color: S.text, fontSize: 13, fontWeight: 700 }}>{chord.note}</span>
                  <span style={{ color: qColor, fontSize: 9, fontWeight: 500 }}>{chord.quality}</span>
                </div>
              )
            })}
          </div>
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: ChordChartShape) { return <rect width={shape.props.w} height={shape.props.h} rx={12} /> }
  override onResize(shape: ChordChartShape, info: TLResizeInfo<ChordChartShape>) { return resizeBox(shape, info) }
}

export const GLOBAL_SHAPE_UTILS = [ProjectCardShapeUtil, TaskCardShapeUtil, ChordChartShapeUtil]
