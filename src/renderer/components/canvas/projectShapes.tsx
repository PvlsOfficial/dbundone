/* eslint-disable react/forbid-dom-props */
/**
 * Project canvas shapes — 4 music-production-specific cards.
 *   project-lyrics    — editable lyrics sheet with section label
 *   song-structure    — visual arrangement blocks (like a DAW arrange view)
 *   project-chords    — chord progression display
 *   project-snapshot  — live project stats from context
 */
import React, { useContext, useState } from "react"
import {
  ShapeUtil,
  TLShape,
  Rectangle2d,
  HTMLContainer,
  resizeBox,
  TLResizeInfo,
} from "@tldraw/tldraw"
import { ProjectCanvasContext } from "./CanvasContext"

// ─── Prop types ───────────────────────────────────────────────────────────────

type LyricsProps = {
  w: number; h: number
  section: string  // e.g. "Verse 1"
  text: string
  color: string
}

type StructureProps = {
  w: number; h: number
  sections: string // JSON: [{name,bars,color}]
}

type ChordsProps = {
  w: number; h: number
  chords: string   // JSON: ChordDef[]
  keyLabel: string
}

type SnapshotProps = { w: number; h: number }

// ─── Register shapes with tldraw's type system ────────────────────────────────

declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap {
    "project-lyrics":   LyricsProps
    "song-structure":   StructureProps
    "project-chords":   ChordsProps
    "project-snapshot": SnapshotProps
  }
}

// ─── Shape types ──────────────────────────────────────────────────────────────

type LyricsShape    = TLShape<"project-lyrics">
type StructureShape = TLShape<"song-structure">
type ChordsShape    = TLShape<"project-chords">
type SnapshotShape  = TLShape<"project-snapshot">

// ─── Constants ────────────────────────────────────────────────────────────────

interface ChordDef { name: string; beats: number; color: string }

const CHORD_PROGRESSIONS: { name: string; key: string; chords: ChordDef[] }[] = [
  { name: "Am – F – C – G",     key: "A minor", chords: [{ name: "Am", beats: 4, color: "#a78bfa" }, { name: "F", beats: 4, color: "#38bdf8" }, { name: "C", beats: 4, color: "#f97316" }, { name: "G", beats: 4, color: "#10b981" }] },
  { name: "C – G – Am – F",     key: "C major", chords: [{ name: "C", beats: 4, color: "#f97316" }, { name: "G", beats: 4, color: "#10b981" }, { name: "Am", beats: 4, color: "#a78bfa" }, { name: "F", beats: 4, color: "#38bdf8" }] },
  { name: "Dm – Bb – F – C",    key: "D minor", chords: [{ name: "Dm", beats: 4, color: "#818cf8" }, { name: "Bb", beats: 4, color: "#f472b6" }, { name: "F", beats: 4, color: "#38bdf8" }, { name: "C", beats: 4, color: "#f97316" }] },
  { name: "Em – C – G – D",     key: "E minor", chords: [{ name: "Em", beats: 4, color: "#6366f1" }, { name: "C", beats: 4, color: "#f97316" }, { name: "G", beats: 4, color: "#10b981" }, { name: "D", beats: 4, color: "#eab308" }] },
  { name: "ii – V – I",         key: "C major", chords: [{ name: "Dm7", beats: 4, color: "#818cf8" }, { name: "G7", beats: 4, color: "#10b981" }, { name: "Cmaj7", beats: 8, color: "#f97316" }] },
  { name: "50s Progression",    key: "C major", chords: [{ name: "C", beats: 4, color: "#f97316" }, { name: "Am", beats: 4, color: "#a78bfa" }, { name: "F", beats: 4, color: "#38bdf8" }, { name: "G", beats: 4, color: "#10b981" }] },
  { name: "Andalusian Cadence", key: "A minor", chords: [{ name: "Am", beats: 4, color: "#a78bfa" }, { name: "G", beats: 4, color: "#10b981" }, { name: "F", beats: 4, color: "#38bdf8" }, { name: "E", beats: 4, color: "#eab308" }] },
  { name: "I – IV – V (Blues)", key: "A major", chords: [{ name: "A", beats: 4, color: "#38bdf8" }, { name: "D", beats: 4, color: "#a78bfa" }, { name: "E", beats: 4, color: "#f97316" }] },
]

export { CHORD_PROGRESSIONS }

const DEFAULT_CHORDS = JSON.stringify(CHORD_PROGRESSIONS[0].chords)
const DEFAULT_KEY    = CHORD_PROGRESSIONS[0].key

// ─── Music theory engine ──────────────────────────────────────────────────────

const CHROMATIC   = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const
const ENHARMONIC: Record<string,string> = { Db:'C#',Eb:'D#',Gb:'F#',Ab:'G#',Bb:'A#',Cb:'B',Fb:'E' }
const DIATONIC_COLORS = ['#a78bfa','#38bdf8','#f97316','#f472b6','#10b981','#eab308','#818cf8']

const ROOT_NOTES  = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B']
const SCALE_MODES = ['major','dorian','phrygian','lydian','mixolydian','minor','locrian'] as const
type ScaleMode    = typeof SCALE_MODES[number]

const MODE_DATA: Record<ScaleMode, { intervals: number[]; quals: string[]; nums: string[] }> = {
  major:      { intervals:[0,2,4,5,7,9,11], quals:['','m','m','','','m','dim'],   nums:['I','ii','iii','IV','V','vi','vii°'] },
  dorian:     { intervals:[0,2,3,5,7,9,10], quals:['m','m','','','m','dim',''],   nums:['i','ii','III','IV','v','vi°','VII'] },
  phrygian:   { intervals:[0,1,3,5,7,8,10], quals:['m','','','m','dim','','m'],   nums:['i','II','III','iv','v°','VI','vii'] },
  lydian:     { intervals:[0,2,4,6,7,9,11], quals:['','','m','dim','','m','m'],   nums:['I','II','iii','iv°','V','vi','vii'] },
  mixolydian: { intervals:[0,2,4,5,7,9,10], quals:['','m','dim','','m','m',''],   nums:['I','ii','iii°','IV','v','vi','VII'] },
  minor:      { intervals:[0,2,3,5,7,8,10], quals:['m','dim','','m','m','',''],   nums:['i','ii°','III','iv','v','VI','VII'] },
  locrian:    { intervals:[0,1,3,5,6,8,10], quals:['dim','','m','m','','','m'],   nums:['i°','II','iii','iv','V','VI','vii'] },
}

const GEN_PATTERNS = [
  [0,5,3,4],[0,3,4,0],[5,3,4,0],[0,4,5,3],[1,4,0],[0,3,5,4],[5,4,0,3],[0,2,5,4],
]

function noteIdx(note: string): number {
  return CHROMATIC.indexOf((ENHARMONIC[note] ?? note) as typeof CHROMATIC[number])
}
function chromNote(root: string, semitones: number): string {
  return CHROMATIC[(noteIdx(root) + semitones + 12) % 12]
}
function parseKey(keyLabel: string): { root: string; mode: ScaleMode } {
  const pattern = SCALE_MODES.join('|')
  const m = keyLabel.match(new RegExp(`^([A-G][#b]?)\\s+(${pattern})$`, 'i'))
  return m ? { root: m[1], mode: m[2].toLowerCase() as ScaleMode } : { root: 'C', mode: 'major' }
}
function getDiatonicChords(keyLabel: string) {
  const { root, mode } = parseKey(keyLabel)
  const { intervals, quals, nums } = MODE_DATA[mode] ?? MODE_DATA.major
  return intervals.map((s, i) => ({ name: chromNote(root, s) + quals[i], numeral: nums[i], color: DIATONIC_COLORS[i] }))
}
function chordRoot(name: string): string {
  return name.match(/^([A-G][#b]?)/)?.[1] ?? name
}
function getNumeral(chordName: string, keyLabel: string): string {
  return getDiatonicChords(keyLabel).find(d => chordRoot(d.name) === chordRoot(chordName))?.numeral ?? ''
}
function generateProgression(keyLabel: string): ChordDef[] {
  const diatonic = getDiatonicChords(keyLabel)
  const pattern  = GEN_PATTERNS[Math.floor(Math.random() * GEN_PATTERNS.length)]
  return pattern.map(i => ({ name: diatonic[i].name, beats: 4, color: diatonic[i].color }))
}

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  "Not Started": { bg: "#1a1a1a",   fg: "#6b7280" },
  "In Progress": { bg: "#1e3a5f",   fg: "#60a5fa" },
  "Mixing":      { bg: "#2e1065",   fg: "#a78bfa" },
  "Mastering":   { bg: "#3b0764",   fg: "#c084fc" },
  "Done":        { bg: "#052e16",   fg: "#4ade80" },
  "Released":    { bg: "#052e16",   fg: "#22c55e" },
}

const SECTION_COLORS = [
  "#a78bfa", "#38bdf8", "#f97316", "#f472b6",
  "#10b981", "#eab308", "#818cf8", "#6b7280",
]

interface SectionDef { name: string; bars: number; color: string }

const STRUCTURE_PRESETS: { name: string; sections: SectionDef[] }[] = [
  {
    name: "Pop Standard",
    sections: [
      { name: "Intro",      bars: 4, color: "#38bdf8" },
      { name: "Verse",      bars: 8, color: "#a78bfa" },
      { name: "Pre-Chorus", bars: 4, color: "#f472b6" },
      { name: "Chorus",     bars: 8, color: "#f97316" },
      { name: "Verse",      bars: 8, color: "#a78bfa" },
      { name: "Pre-Chorus", bars: 4, color: "#f472b6" },
      { name: "Chorus",     bars: 8, color: "#f97316" },
      { name: "Bridge",     bars: 4, color: "#10b981" },
      { name: "Chorus",     bars: 8, color: "#f97316" },
      { name: "Outro",      bars: 4, color: "#6b7280" },
    ],
  },
  {
    name: "Verse–Chorus",
    sections: [
      { name: "Intro",  bars: 4, color: "#38bdf8" },
      { name: "Verse",  bars: 8, color: "#a78bfa" },
      { name: "Chorus", bars: 8, color: "#f97316" },
      { name: "Verse",  bars: 8, color: "#a78bfa" },
      { name: "Chorus", bars: 8, color: "#f97316" },
      { name: "Outro",  bars: 4, color: "#6b7280" },
    ],
  },
  {
    name: "Trap / Hip-Hop",
    sections: [
      { name: "Intro",   bars: 4,  color: "#38bdf8" },
      { name: "Verse 1", bars: 16, color: "#a78bfa" },
      { name: "Hook",    bars: 8,  color: "#f97316" },
      { name: "Verse 2", bars: 16, color: "#818cf8" },
      { name: "Hook",    bars: 8,  color: "#f97316" },
      { name: "Outro",   bars: 4,  color: "#6b7280" },
    ],
  },
  {
    name: "AABA (32-bar)",
    sections: [
      { name: "A", bars: 8, color: "#a78bfa" },
      { name: "A", bars: 8, color: "#a78bfa" },
      { name: "B", bars: 8, color: "#f97316" },
      { name: "A", bars: 8, color: "#a78bfa" },
    ],
  },
  {
    name: "12-Bar Blues",
    sections: [
      { name: "I",  bars: 4, color: "#38bdf8" },
      { name: "IV", bars: 2, color: "#a78bfa" },
      { name: "I",  bars: 2, color: "#38bdf8" },
      { name: "V",  bars: 1, color: "#f97316" },
      { name: "IV", bars: 1, color: "#a78bfa" },
      { name: "I",  bars: 1, color: "#38bdf8" },
      { name: "V",  bars: 1, color: "#f97316" },
    ],
  },
]

const DEFAULT_SECTIONS = JSON.stringify(STRUCTURE_PRESETS[0].sections)

// ─── Shared helpers ───────────────────────────────────────────────────────────

const stop = (e: React.PointerEvent) => e.stopPropagation()

const card: React.CSSProperties = {
  width: "100%", height: "100%",
  background: "#111",
  borderRadius: 10,
  display: "flex", flexDirection: "column",
  overflow: "hidden",
  fontFamily: "system-ui, -apple-system, sans-serif",
  pointerEvents: "all",
}

// ─── 1. Lyrics Card ───────────────────────────────────────────────────────────

export class LyricsCardShapeUtil extends ShapeUtil<LyricsShape> {
  static override type = "project-lyrics" as const

  getDefaultProps(): LyricsProps {
    return { w: 280, h: 280, section: "Verse 1", text: "", color: "#a78bfa" }
  }

  getGeometry(s: LyricsShape) {
    return new Rectangle2d({ width: s.props.w, height: s.props.h, isFilled: true })
  }

  component(s: LyricsShape) {
    const { section, text, color } = s.props
    return (
      <HTMLContainer>
        <div style={{ ...card, border: `1px solid ${color}22`, borderLeft: `3px solid ${color}` }}>
          {/* Section header */}
          <div style={{
            padding: "7px 12px",
            background: `${color}12`,
            display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
            <span style={{
              fontSize: 10, fontWeight: 700, color,
              letterSpacing: "0.07em", textTransform: "uppercase",
            }}>
              {section}
            </span>
          </div>
          {/* Editable text */}
          <textarea
            key={s.id}
            defaultValue={text}
            onPointerDown={stop}
            onChange={e => this.editor.updateShape<LyricsShape>({
              id: s.id, type: "project-lyrics", props: { text: e.target.value },
            })}
            placeholder="Write lyrics…"
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              padding: "10px 12px", resize: "none",
              fontSize: 13, lineHeight: 1.8,
              fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
              color: "rgba(255,255,255,0.82)",
              letterSpacing: "0.01em",
            }}
          />
        </div>
      </HTMLContainer>
    )
  }

  indicator(s: LyricsShape) {
    return <rect width={s.props.w} height={s.props.h} rx={10} />
  }

  override onResize(s: LyricsShape, i: TLResizeInfo<LyricsShape>) {
    return resizeBox(s, i)
  }
}

// ─── 2. Song Structure (interactive) ─────────────────────────────────────────

const iconBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 22, height: 22, borderRadius: 5, cursor: "pointer", flexShrink: 0,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.65)", fontSize: 14,
}

export class SongStructureShapeUtil extends ShapeUtil<StructureShape> {
  static override type = "song-structure" as const

  getDefaultProps(): StructureProps {
    return { w: 560, h: 160, sections: DEFAULT_SECTIONS }
  }

  getGeometry(s: StructureShape) {
    return new Rectangle2d({ width: s.props.w, height: s.props.h, isFilled: true })
  }

  component(s: StructureShape) {
    const [selected, setSelected] = useState<number | null>(null)
    const [showPresets, setShowPresets] = useState(false)

    const sections: SectionDef[] = (() => {
      try { return JSON.parse(s.props.sections) } catch { return [] }
    })()
    const total = sections.reduce((n, sec) => n + sec.bars, 0)
    const sel = selected !== null && selected < sections.length ? sections[selected] : null

    const sp = (e: React.PointerEvent) => e.stopPropagation()
    const sc = (e: React.MouseEvent) => e.stopPropagation()

    const save = (next: SectionDef[]) =>
      this.editor.updateShape<StructureShape>({
        id: s.id, type: "song-structure", props: { sections: JSON.stringify(next) },
      })

    const changeBar = (i: number, d: number) =>
      save(sections.map((sec, idx) => idx === i ? { ...sec, bars: Math.max(1, sec.bars + d) } : sec))

    const rename = (i: number, name: string) =>
      save(sections.map((sec, idx) => idx === i ? { ...sec, name } : sec))

    const del = (i: number) => { save(sections.filter((_, idx) => idx !== i)); setSelected(null) }

    const add = () => {
      const color = SECTION_COLORS[sections.length % SECTION_COLORS.length]
      save([...sections, { name: "New", bars: 4, color }])
      setSelected(sections.length)
    }

    const loadPreset = (preset: SectionDef[]) => {
      save(preset); setShowPresets(false); setSelected(null)
    }

    return (
      <HTMLContainer>
        <div style={{ ...card, border: "1px solid rgba(255,255,255,0.08)", position: "relative" }}>

          {/* ── Header ── */}
          <div style={{
            padding: "6px 10px", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
              Song Structure
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>{total}b</span>
              <button type="button" onPointerDown={sp} onClick={e => { sc(e); setShowPresets(v => !v); setSelected(null) }}
                style={{ ...iconBtn, width: "auto", padding: "2px 8px", fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
                Presets ▾
              </button>
              <button type="button" onPointerDown={sp} onClick={e => { sc(e); add() }}
                style={{ ...iconBtn, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}>
                +
              </button>
            </div>
          </div>

          {/* ── Preset dropdown ── */}
          {showPresets && (
            <div style={{
              position: "absolute", top: 33, right: 10, zIndex: 20,
              background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.7)",
              overflowX: "hidden", overflowY: "auto", maxHeight: 220, minWidth: 200,
            }}>
              {STRUCTURE_PRESETS.map((p, i) => (
                <button key={i} type="button" onPointerDown={sp}
                  onClick={e => { sc(e); loadPreset(p.sections) }}
                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontFamily: card.fontFamily }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.78)" }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", marginTop: 2 }}>
                    {p.sections.map(sec => sec.name).join(" · ")}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Blocks ── */}
          <div style={{ flex: 1, display: "flex", gap: 3, padding: "6px 10px", minHeight: 0, overflow: "hidden" }}>
            {sections.map((sec, i) => {
              const pct = total > 0 ? (sec.bars / total) * 100 : (100 / sections.length)
              const active = selected === i
              return (
                <div key={i} onPointerDown={sp}
                  onClick={e => { sc(e); setSelected(active ? null : i); setShowPresets(false) }}
                  style={{
                    flex: `0 0 calc(${pct}% - 3px)`,
                    borderRadius: 7,
                    background: active ? `${sec.color}2e` : `${sec.color}18`,
                    border: `1px solid ${active ? sec.color + "90" : sec.color + "42"}`,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    overflow: "hidden", minWidth: 0, gap: 2,
                    cursor: "pointer", transition: "all 0.1s",
                    outline: active ? `2px solid ${sec.color}45` : "none",
                    outlineOffset: 1,
                  }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: sec.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "92%", textAlign: "center" }}>
                    {sec.name}
                  </span>
                  <span style={{ fontSize: 8, color: "rgba(255,255,255,0.28)", fontFamily: "monospace" }}>
                    {sec.bars}b
                  </span>
                </div>
              )
            })}
          </div>

          {/* ── Edit bar ── */}
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.05)",
            padding: "5px 10px", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 7, minHeight: 38,
          }}>
            {sel === null ? (
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", fontStyle: "italic" }}>
                Click a section to edit
              </span>
            ) : (
              <>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: sel.color, flexShrink: 0 }} />
                <input
                  key={`name-${selected}`}
                  defaultValue={sel.name}
                  placeholder="Section name"
                  onPointerDown={sp}
                  onChange={e => rename(selected!, e.target.value)}
                  style={{
                    width: 80, background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5,
                    padding: "3px 7px", fontSize: 11,
                    color: "rgba(255,255,255,0.85)", outline: "none",
                    fontFamily: card.fontFamily,
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
                  <button type="button" onPointerDown={sp} onClick={e => { sc(e); changeBar(selected!, -1) }} style={iconBtn}>−</button>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "monospace", minWidth: 28, textAlign: "center" }}>
                    {sel.bars}b
                  </span>
                  <button type="button" onPointerDown={sp} onClick={e => { sc(e); changeBar(selected!, 1) }} style={iconBtn}>+</button>
                </div>
                <button type="button" onPointerDown={sp} onClick={e => { sc(e); del(selected!) }}
                  style={{ ...iconBtn, marginLeft: "auto", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
                  ×
                </button>
              </>
            )}
          </div>

        </div>
      </HTMLContainer>
    )
  }

  indicator(s: StructureShape) { return <rect width={s.props.w} height={s.props.h} rx={10} /> }
  override onResize(s: StructureShape, i: TLResizeInfo<StructureShape>) { return resizeBox(s, i) }
}

// ─── 3. Chord Chart (interactive) ────────────────────────────────────────────

export class ChordsShapeUtil extends ShapeUtil<ChordsShape> {
  static override type = "project-chords" as const

  getDefaultProps(): ChordsProps {
    return { w: 460, h: 210, chords: DEFAULT_CHORDS, keyLabel: DEFAULT_KEY }
  }

  getGeometry(s: ChordsShape) {
    return new Rectangle2d({ width: s.props.w, height: s.props.h, isFilled: true })
  }

  component(s: ChordsShape) {
    const [selected, setSelected] = useState<number | null>(null)
    const [showPresets, setShowPresets] = useState(false)
    const [openDD, setOpenDD] = useState<'root'|'scale'|null>(null)

    const chords: ChordDef[] = (() => {
      try { return JSON.parse(s.props.chords) } catch {
        return s.props.chords.split(",").map((c, i) => ({
          name: c.trim(), beats: 4, color: SECTION_COLORS[i % SECTION_COLORS.length],
        }))
      }
    })()

    const { root: currentRoot, mode: currentMode } = parseKey(s.props.keyLabel)
    const diatonic = getDiatonicChords(s.props.keyLabel)
    const total    = chords.reduce((n, c) => n + c.beats, 0)
    const sel      = selected !== null && selected < chords.length ? chords[selected] : null

    const sp = (e: React.PointerEvent) => e.stopPropagation()
    const sc = (e: React.MouseEvent)   => e.stopPropagation()

    const save = (next: ChordDef[], key?: string) =>
      this.editor.updateShape<ChordsShape>({
        id: s.id, type: "project-chords",
        props: { chords: JSON.stringify(next), ...(key !== undefined ? { keyLabel: key } : {}) },
      })

    const changeBeats = (i: number, d: number) =>
      save(chords.map((c, idx) => idx === i ? { ...c, beats: Math.max(1, c.beats + d) } : c))
    const rename = (i: number, name: string) =>
      save(chords.map((c, idx) => idx === i ? { ...c, name } : c))
    const del = (i: number) => { save(chords.filter((_, idx) => idx !== i)); setSelected(null) }

    const addFromDiatonic = (d: typeof diatonic[0]) => {
      save([...chords, { name: d.name, beats: 4, color: d.color }])
      setSelected(chords.length)
    }
    const addBlank = () => {
      const color = SECTION_COLORS[chords.length % SECTION_COLORS.length]
      save([...chords, { name: "C", beats: 4, color }])
      setSelected(chords.length)
    }
    const generate = () => {
      save(generateProgression(s.props.keyLabel)); setShowPresets(false); setSelected(null)
    }
    const loadPreset = (p: typeof CHORD_PROGRESSIONS[0]) => {
      save(p.chords, p.key); setShowPresets(false); setSelected(null)
    }
    const updateKey = (root: string, mode: string) =>
      this.editor.updateShape<ChordsShape>({ id: s.id, type: "project-chords", props: { keyLabel: `${root} ${mode}` } })

    return (
      <HTMLContainer>
        <div style={{ ...card, border: "1px solid rgba(99,102,241,0.2)", position: "relative" }}>

          {/* ── Header ── */}
          <div style={{
            padding: "6px 10px", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
              Chord Progression
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {/* Key root custom dropdown */}
              <div style={{ position: "relative" }} onPointerDown={sp} onClick={sc}>
                <button type="button"
                  onClick={e => { sc(e); setOpenDD(openDD === 'root' ? null : 'root'); setShowPresets(false) }}
                  style={{ fontSize: 9, fontWeight: 700, color: "#818cf8", background: openDD === 'root' ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.12)", padding: "2px 8px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: card.fontFamily }}>
                  {currentRoot} ▾
                </button>
                {openDD === 'root' && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 30, background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.7)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: 4, minWidth: 108 }}>
                    {ROOT_NOTES.map(r => (
                      <button key={r} type="button"
                        onClick={e => { sc(e); updateKey(r, currentMode); setOpenDD(null) }}
                        style={{ padding: "5px 4px", background: currentRoot === r ? "rgba(99,102,241,0.2)" : "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, borderRadius: 5, textAlign: "center" as const, color: currentRoot === r ? "#a5b4fc" : "rgba(255,255,255,0.65)", fontFamily: card.fontFamily }}
                        onMouseEnter={e => { if (currentRoot !== r) e.currentTarget.style.background = "rgba(255,255,255,0.05)" }}
                        onMouseLeave={e => { if (currentRoot !== r) e.currentTarget.style.background = "none" }}>
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Scale custom dropdown */}
              <div style={{ position: "relative" }} onPointerDown={sp} onClick={sc}>
                <button type="button"
                  onClick={e => { sc(e); setOpenDD(openDD === 'scale' ? null : 'scale'); setShowPresets(false) }}
                  style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.5)", background: openDD === 'scale' ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: card.fontFamily }}>
                  {currentMode} ▾
                </button>
                {openDD === 'scale' && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 30, background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.7)", minWidth: 120, padding: 4 }}>
                    {SCALE_MODES.map(m => (
                      <button key={m} type="button"
                        onClick={e => { sc(e); updateKey(currentRoot, m); setOpenDD(null) }}
                        style={{ width: "100%", textAlign: "left" as const, padding: "5px 10px", background: currentMode === m ? "rgba(99,102,241,0.2)" : "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, borderRadius: 5, color: currentMode === m ? "#a5b4fc" : "rgba(255,255,255,0.65)", fontFamily: card.fontFamily }}
                        onMouseEnter={e => { if (currentMode !== m) e.currentTarget.style.background = "rgba(255,255,255,0.05)" }}
                        onMouseLeave={e => { if (currentMode !== m) e.currentTarget.style.background = "none" }}>
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Presets */}
              <button type="button" onPointerDown={sp}
                onClick={e => { sc(e); setShowPresets(v => !v); setOpenDD(null) }}
                style={{ ...iconBtn, width: "auto", padding: "2px 8px", fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
                Presets ▾
              </button>
              {/* Generate */}
              <button type="button" onPointerDown={sp}
                onClick={e => { sc(e); generate() }}
                title="Generate progression"
                style={{ ...iconBtn, color: "#a5b4fc", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", fontSize: 12 }}>
                ✦
              </button>
              {/* Add blank */}
              <button type="button" onPointerDown={sp}
                onClick={e => { sc(e); addBlank() }}
                style={{ ...iconBtn, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}>
                +
              </button>
            </div>
          </div>

          {/* ── Presets dropdown ── */}
          {showPresets && (
            <div style={{
              position: "absolute", top: 33, right: 10, zIndex: 25,
              background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.7)",
              overflowX: "hidden", overflowY: "auto", maxHeight: 220, minWidth: 220,
            }}>
              {CHORD_PROGRESSIONS.map((p, i) => (
                <button key={i} type="button" onPointerDown={sp}
                  onClick={e => { sc(e); loadPreset(p) }}
                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontFamily: card.fontFamily }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.78)" }}>{p.name}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", marginTop: 1 }}>{p.key}</div>
                </button>
              ))}
            </div>
          )}

          {/* ── Chord blocks ── */}
          <div style={{ flex: 1, display: "flex", gap: 3, padding: "6px 10px", minHeight: 0, overflow: "hidden" }}>
            {chords.map((chord, i) => {
              const pct     = total > 0 ? (chord.beats / total) * 100 : (100 / chords.length)
              const active  = selected === i
              const numeral = getNumeral(chord.name, s.props.keyLabel)
              return (
                <div key={i} onPointerDown={sp}
                  onClick={e => { sc(e); setSelected(active ? null : i); setShowPresets(false); setOpenDD(null) }}
                  style={{
                    flex: `0 0 calc(${pct}% - 3px)`,
                    borderRadius: 7,
                    background: active ? `${chord.color}2e` : `${chord.color}18`,
                    border: `1px solid ${active ? chord.color + "90" : chord.color + "42"}`,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    overflow: "hidden", minWidth: 0, gap: 1,
                    cursor: "pointer", transition: "all 0.1s",
                    outline: active ? `2px solid ${chord.color}45` : "none", outlineOffset: 1,
                  }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: chord.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "92%", textAlign: "center", letterSpacing: "-0.02em" }}>
                    {chord.name}
                  </span>
                  {numeral && (
                    <span style={{ fontSize: 7, color: `${chord.color}90`, fontStyle: "italic", fontFamily: "Georgia, serif" }}>
                      {numeral}
                    </span>
                  )}
                  <span style={{ fontSize: 7, color: "rgba(255,255,255,0.22)", fontFamily: "monospace" }}>
                    {chord.beats}b
                  </span>
                </div>
              )
            })}
          </div>

          {/* ── Diatonic scale palette ── */}
          <div style={{
            padding: "3px 10px 4px", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 3,
            borderTop: "1px solid rgba(255,255,255,0.04)", overflowX: "auto",
          }}>
            <span style={{ fontSize: 7, fontWeight: 700, color: "rgba(255,255,255,0.18)", letterSpacing: "0.07em", textTransform: "uppercase" as const, flexShrink: 0, marginRight: 3 }}>
              Scale
            </span>
            {diatonic.map((d, i) => (
              <button key={i} type="button" onPointerDown={sp}
                onClick={e => { sc(e); addFromDiatonic(d) }}
                title={`Add ${d.name} (${d.numeral})`}
                style={{
                  padding: "2px 7px", borderRadius: 5, flexShrink: 0,
                  background: `${d.color}14`, border: `1px solid ${d.color}30`,
                  color: d.color, fontSize: 10, fontWeight: 700,
                  cursor: "pointer", fontFamily: card.fontFamily, letterSpacing: "-0.01em",
                  transition: "background 0.08s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = `${d.color}28`)}
                onMouseLeave={e => (e.currentTarget.style.background = `${d.color}14`)}>
                {d.name}
              </button>
            ))}
          </div>

          {/* ── Edit bar ── */}
          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.05)",
            padding: "5px 10px", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 7, minHeight: 36,
          }}>
            {sel === null ? (
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", fontStyle: "italic" }}>
                Click a chord to edit
              </span>
            ) : (
              <>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: sel.color, flexShrink: 0 }} />
                <input
                  key={`chord-${selected}`}
                  defaultValue={sel.name}
                  placeholder="Chord"
                  onPointerDown={sp}
                  onChange={e => rename(selected!, e.target.value)}
                  style={{
                    width: 68, background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5,
                    padding: "3px 7px", fontSize: 13, fontWeight: 700,
                    color: "rgba(255,255,255,0.85)", outline: "none",
                    fontFamily: card.fontFamily, letterSpacing: "-0.01em",
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
                  <button type="button" onPointerDown={sp} onClick={e => { sc(e); changeBeats(selected!, -1) }} style={iconBtn}>−</button>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "monospace", minWidth: 28, textAlign: "center" }}>
                    {sel.beats}b
                  </span>
                  <button type="button" onPointerDown={sp} onClick={e => { sc(e); changeBeats(selected!, 1) }} style={iconBtn}>+</button>
                </div>
                <button type="button" onPointerDown={sp} onClick={e => { sc(e); del(selected!) }}
                  style={{ ...iconBtn, marginLeft: "auto", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
                  ×
                </button>
              </>
            )}
          </div>

        </div>
      </HTMLContainer>
    )
  }

  indicator(s: ChordsShape) { return <rect width={s.props.w} height={s.props.h} rx={10} /> }
  override onResize(s: ChordsShape, i: TLResizeInfo<ChordsShape>) { return resizeBox(s, i) }
}

// ─── 4. Project Snapshot ──────────────────────────────────────────────────────

export class ProjectSnapshotShapeUtil extends ShapeUtil<SnapshotShape> {
  static override type = "project-snapshot" as const

  getDefaultProps(): SnapshotProps { return { w: 240, h: 170 } }

  getGeometry(s: SnapshotShape) {
    return new Rectangle2d({ width: s.props.w, height: s.props.h, isFilled: true })
  }

  component(_s: SnapshotShape) {
    const ctx = useContext(ProjectCanvasContext)
    const { project, versions, tasks } = ctx
    const st = STATUS_STYLE[project?.status ?? ""] ?? { bg: "#1a1a1a", fg: "#6b7280" }
    const doneTasks = tasks.filter(t => t.status === "done").length

    const rows: { label: string; value: string }[] = [
      { label: "BPM",      value: project?.bpm ? `${project.bpm}` : "—" },
      { label: "Key",      value: (project?.musicalKey && project.musicalKey !== "None") ? project.musicalKey : "—" },
      { label: "Genre",    value: project?.genre || "—" },
      { label: "Versions", value: `${versions.length}` },
      { label: "Tasks",    value: tasks.length ? `${doneTasks} / ${tasks.length}` : "—" },
    ]

    return (
      <HTMLContainer>
        <div style={{ ...card, border: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Title + status */}
          <div style={{
            padding: "8px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
          }}>
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: "rgba(255,255,255,0.82)",
              overflow: "hidden", textOverflow: "ellipsis",
              whiteSpace: "nowrap", flex: 1,
            }}>
              {project?.title ?? "Project"}
            </span>
            <span style={{
              fontSize: 9, fontWeight: 600,
              padding: "2px 7px", borderRadius: 20,
              background: st.bg, color: st.fg,
              flexShrink: 0,
            }}>
              {project?.status ?? "—"}
            </span>
          </div>
          {/* Data rows */}
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            justifyContent: "center", gap: 5, padding: "8px 12px",
          }}>
            {rows.map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: "rgba(255,255,255,0.28)",
                  letterSpacing: "0.05em", textTransform: "uppercase",
                }}>
                  {r.label}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: "rgba(255,255,255,0.72)",
                  fontFamily: "'SF Mono', monospace",
                }}>
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </HTMLContainer>
    )
  }

  indicator(s: SnapshotShape) {
    return <rect width={s.props.w} height={s.props.h} rx={10} />
  }

  override onResize(s: SnapshotShape, i: TLResizeInfo<SnapshotShape>) {
    return resizeBox(s, i)
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const PROJECT_SHAPE_UTILS = [
  LyricsCardShapeUtil,
  SongStructureShapeUtil,
  ChordsShapeUtil,
  ProjectSnapshotShapeUtil,
]
