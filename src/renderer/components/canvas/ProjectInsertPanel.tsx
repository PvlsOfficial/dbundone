/* eslint-disable react/forbid-dom-props */
import React, { useState, useContext } from "react"
import type { Editor } from "@tldraw/tldraw"
import { ProjectCanvasContext } from "./CanvasContext"
import { CHORD_PROGRESSIONS } from "./projectShapes"

// ─── Data ─────────────────────────────────────────────────────────────────────

const LYRICS_SECTIONS = [
  { name: "Intro",      color: "#38bdf8" },
  { name: "Verse 1",    color: "#a78bfa" },
  { name: "Verse 2",    color: "#818cf8" },
  { name: "Pre-Chorus", color: "#f472b6" },
  { name: "Chorus",     color: "#f97316" },
  { name: "Bridge",     color: "#10b981" },
  { name: "Hook",       color: "#eab308" },
  { name: "Outro",      color: "#6b7280" },
]

// ─── Styles matching tldraw's dark theme ──────────────────────────────────────

const T = {
  bg:           "#1c1c1c",
  border:       "1px solid rgba(144,144,144,0.18)",
  shadow:       "0 4px 24px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.3)",
  radius:       10,
  rowRadius:    6,
  text:         "rgba(255,255,255,0.82)",
  textMuted:    "rgba(255,255,255,0.32)",
  textDim:      "rgba(255,255,255,0.18)",
  rowHover:     "rgba(255,255,255,0.06)",
  divider:      "1px solid rgba(144,144,144,0.1)",
  font:         "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  accentBg:     "rgba(99,102,241,0.15)",
  accentBorder: "rgba(99,102,241,0.35)",
  accentText:   "#a5b4fc",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pos(editor: Editor, ox = 0, oy = 0) {
  const c = editor.getViewportPageBounds().center
  return { x: c.x - ox, y: c.y - oy }
}

// ─── Row component ────────────────────────────────────────────────────────────

function Row({
  dot, label, right, onClick, indent = false,
}: {
  dot?: string
  label: string
  right?: React.ReactNode
  onClick: () => void
  indent?: boolean
}) {
  const [hov, setHov] = useState(false)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === "Enter" && onClick()}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: indent ? "4px 8px 4px 22px" : "4px 8px",
        borderRadius: T.rowRadius,
        background: hov ? T.rowHover : "transparent",
        cursor: "pointer",
        transition: "background 0.08s",
        userSelect: "none",
      }}
    >
      {dot && (
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: dot, flexShrink: 0,
        }} />
      )}
      <span style={{ flex: 1, fontSize: 13, color: T.text, fontFamily: T.font, lineHeight: 1.2 }}>
        {label}
      </span>
      {right && (
        <span style={{ fontSize: 10, color: T.textMuted, fontFamily: "'SF Mono', monospace", flexShrink: 0 }}>
          {right}
        </span>
      )}
    </div>
  )
}

// ─── Group label ──────────────────────────────────────────────────────────────

function Group({ label }: { label: string }) {
  return (
    <div style={{
      padding: "8px 8px 2px",
      fontSize: 10, fontWeight: 700,
      color: T.textDim,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      fontFamily: T.font,
    }}>
      {label}
    </div>
  )
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ margin: "4px 0", borderTop: T.divider }} />
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ProjectInsertPanel({ editor }: { editor: Editor }) {
  const ctx = useContext(ProjectCanvasContext)
  const [open, setOpen] = useState(true)

  const addLyrics = (section: string, color: string) =>
    editor.createShape({ type: "project-lyrics", ...pos(editor, 140, 140), props: { section, text: "", color } })

  const addStructure = () =>
    editor.createShape({ type: "song-structure", ...pos(editor, 260, 44), props: {} })

  const addChords = (chords: string, key: string) =>
    editor.createShape({ type: "project-chords", ...pos(editor, 210, 80), props: { chords, keyLabel: key } })

  const addSnapshot = () =>
    editor.createShape({ type: "project-snapshot", ...pos(editor, 120, 85), props: {} })

  if (!open) {
    return (
      <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", zIndex: 300 }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            width: 32, height: 48, borderRadius: T.rowRadius,
            background: T.bg, border: T.border,
            color: T.textMuted, cursor: "pointer", fontSize: 15,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: T.shadow,
          }}
        >‹</button>
      </div>
    )
  }

  return (
    <div style={{
      position: "absolute", right: 8, top: "50%",
      transform: "translateY(-50%)", zIndex: 300,
      width: 210,
      maxHeight: "calc(100vh - 48px)",
      background: T.bg,
      border: T.border,
      borderRadius: T.radius,
      boxShadow: T.shadow,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 10px 8px 12px",
        borderBottom: T.divider,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 12, fontWeight: 600,
          color: T.text, fontFamily: T.font,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {ctx.project?.title ?? "Canvas"}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            background: "none", border: "none",
            color: T.textMuted, cursor: "pointer",
            fontSize: 18, padding: "0 0 0 8px", lineHeight: 1,
            display: "flex", alignItems: "center",
          }}
        >×</button>
      </div>

      {/* Scrollable body */}
      <div style={{ overflowY: "auto", flex: 1, padding: "4px 4px 8px" }}>

        {/* ── Lyrics ── */}
        <Group label="Lyrics" />
        {LYRICS_SECTIONS.map(s => (
          <Row
            key={s.name}
            dot={s.color}
            label={s.name}
            onClick={() => addLyrics(s.name, s.color)}
          />
        ))}

        <Divider />

        {/* ── Arrangement ── */}
        <Group label="Arrangement" />
        <Row
          label="Song Structure"
          right="▬▬▬"
          onClick={addStructure}
        />

        <Divider />

        {/* ── Harmony ── */}
        <Group label="Harmony" />
        <Row
          label="Chord Progression"
          right="✦"
          onClick={() => addChords(JSON.stringify(CHORD_PROGRESSIONS[0].chords), CHORD_PROGRESSIONS[0].key)}
        />

        <Divider />

        {/* ── Project ── */}
        <Group label="Project" />
        <Row
          label="Project Snapshot"
          right="live"
          onClick={addSnapshot}
        />

      </div>
    </div>
  )
}
