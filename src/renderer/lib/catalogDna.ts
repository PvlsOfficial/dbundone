// Catalog DNA search ─ search a producer's whole project catalog by *anything*:
// plugins, samples, channel/mixer FX, key, tempo, tags, genre, DAW, status — plus
// "find projects like X" similarity over the combined fingerprint.
//
// Everything runs client-side over data the app already extracts:
//   • Project metadata        (title, bpm, key, tags, genre, artists, status, daw, rating)
//   • Cached DAW analyses      (FlpAnalysis: plugins, samples, channels, mixerTracks, patterns)
//   • Live plugin sessions     (pluginName, trackName linked to a project)

import type { Project, FlpAnalysis, PluginSession } from "@shared/types"

// ── DNA document ──────────────────────────────────────────────────────────────

/** A project distilled into a searchable fingerprint. */
export interface DnaDoc {
  project: Project
  /** Everything, lowercased & joined — the haystack for free-text terms. */
  text: string
  plugins: Set<string> // lowercased unique plugin names (instruments + FX)
  samples: Set<string> // lowercased sample basenames
  parts: Set<string>   // channel / mixer / pattern names + track names
  tags: Set<string>    // tags + genre, lowercased
  daw: string
  status: string
  keyRoot: string | null            // "c#", "a", "bb" …
  keyQuality: "minor" | "major" | null
  bpm: number
  rating: number
  timeSpent: number // minutes logged on the project
}

const basename = (p: string): string => {
  const cut = p.split(/[\\/]/).pop() || p
  return cut.replace(/\.[a-z0-9]+$/i, "") // strip extension
}

const norm = (s: string | null | undefined): string => (s || "").trim().toLowerCase()

const titleCase = (s: string): string =>
  s.replace(/\b\w/g, (c) => c.toUpperCase())

// ── Concepts (vibe / technique words) ──────────────────────────────────────────
// A producer thinks in techniques ("sidechain", "saturation"), not plugin strings.
// Each concept maps a set of trigger words the user might type to the *plugins* and
// *channel/track names* that signal that technique is present in a project. We have
// no explicit routing data in the analysis, so this is detection-by-tooling: if the
// project loaded Kickstart / LFOTool / ShaperBox … it's almost certainly sidechained.

export interface Concept {
  id: string
  /** Human label for the matched technique (used in result badges). */
  label: string
  /** Single-token words the user can type to trigger this concept. */
  aliases: string[]
  /** Substrings to look for in plugin names — a hit here is high-confidence. */
  plugins: string[]
  /** Substrings to look for in channel / mixer / pattern / tag names. */
  nameHints: string[]
}

export const CONCEPTS: Concept[] = [
  {
    id: "sidechain",
    label: "sidechain",
    aliases: [
      "sidechain", "sidechained", "sidechaining", "side-chain", "sidechainer",
      "pump", "pumping", "pumped", "duck", "ducking", "ducked",
    ],
    plugins: [
      "kickstart",            // Nicky Romero Kickstart / Kickstart 2
      "lfotool",              // Xfer LFOTool (the classic Xfer sidechain shaper)
      "shaperbox", "volumeshaper", "cableguys", // Cableguys ShaperBox / VolumeShaper
      "kilohearts", "khs", "snap heap", "snapheap", // kiloHearts (Snap Heap + Ducker)
      "trackspacer",          // Wavesfactory Trackspacer
      "gross beat", "grossbeat", // Gross Beat volume-gate sidechaining
      "duck",                 // Devious Machines Duck
    ],
    nameHints: ["sidechain", "side chain", "side-chain", "pump", "ducking", "ghost kick"],
  },
  {
    id: "saturation",
    label: "saturation",
    aliases: ["saturation", "saturate", "saturated", "distortion", "distort", "distorted", "overdrive", "fuzz", "grit", "warmth"],
    plugins: [
      "saturn", "decapitator", "rbass", "trash", "camelcrusher", "ohmicide",
      "blood overdrive", "fast dist", "softube saturation", "saturation knob",
      "thermal", "fresh air", "wavefolder", "redux",
    ],
    nameHints: ["saturation", "distort", "overdrive", "fuzz", "drive"],
  },
  {
    id: "reverb",
    label: "reverb",
    aliases: ["reverb", "verb", "reverbs"],
    plugins: [
      "valhalla", "pro-r", "reeverb", "raum", "blackhole", "shimmer",
      "fruity reverb", "supermassive", "h-reverb", "spaces",
    ],
    nameHints: ["reverb", "verb", "ambience", "hall"],
  },
  {
    id: "delay",
    label: "delay",
    aliases: ["delay", "echo", "delays"],
    plugins: [
      "echoboy", "timeless", "replika", "h-delay", "fruity delay",
      "valhalladelay", "valhalla delay", "ping pong", "pingpong",
    ],
    nameHints: ["delay", "echo", "ping pong"],
  },
  {
    id: "autotune",
    label: "pitch / tune",
    aliases: ["autotune", "auto-tune", "tune", "tuned", "pitch", "pitched", "vocaltune"],
    plugins: [
      "auto-tune", "autotune", "melodyne", "graillon", "metatune",
      "waves tune", "nectar", "pitcher", "newtone", "little alterboy",
    ],
    nameHints: ["autotune", "auto tune", "tuned", "pitch"],
  },
]

/** Build a token → concept lookup once. */
const CONCEPT_BY_ALIAS: Map<string, Concept> = (() => {
  const m = new Map<string, Concept>()
  for (const c of CONCEPTS) for (const a of c.aliases) m.set(a, c)
  return m
})()

/** Resolve a single lowercase token to a concept, if it names a technique. */
function matchConceptToken(token: string): Concept | null {
  return CONCEPT_BY_ALIAS.get(token) || null
}

/**
 * Does a project exhibit this concept? Returns a badge reason + whether it was a
 * high-confidence plugin hit, or null if the project shows no sign of the technique.
 */
function conceptMatch(doc: DnaDoc, c: Concept): { reason: string; strong: boolean } | null {
  // Strong: a tool that does this technique is loaded in the project.
  for (const pat of c.plugins) {
    for (const pl of doc.plugins) if (pl.includes(pat)) return { reason: titleCase(pl), strong: true }
  }
  // Weak: a channel / mixer track / tag is literally named after the technique.
  const needles = [...c.nameHints, ...c.aliases]
  for (const n of needles) {
    for (const p of doc.parts) if (p.includes(n)) return { reason: c.label, strong: false }
    for (const tg of doc.tags) if (tg.includes(n)) return { reason: c.label, strong: false }
  }
  return null
}

/** Parse a musical-key string ("C#m", "A minor", "F", "Bb Maj") into root + quality. */
export function parseKey(raw: string | null | undefined): {
  root: string | null
  quality: "minor" | "major" | null
} {
  const s = norm(raw)
  if (!s) return { root: null, quality: null }
  const rootMatch = s.match(/^([a-g])(#|b|♯|♭)?/)
  let root: string | null = null
  if (rootMatch) {
    const acc = rootMatch[2] === "♯" ? "#" : rootMatch[2] === "♭" ? "b" : rootMatch[2] || ""
    root = rootMatch[1] + acc
  }
  let quality: "minor" | "major" | null = null
  if (/maj/.test(s)) quality = "major"
  else if (/min/.test(s)) quality = "minor"
  else if (/^[a-g](#|b|♯|♭)?m\b/.test(s) || /^[a-g](#|b|♯|♭)?m$/.test(s)) quality = "minor"
  else if (root) quality = "major" // a bare note ("F", "C#") conventionally implies major
  return { root, quality }
}

/** Build a fingerprint for every project from metadata + analyses + plugin sessions. */
export function buildDnaDocs(
  projects: Project[],
  analyses: Record<string, FlpAnalysis>,
  sessions: PluginSession[],
): DnaDoc[] {
  // Group plugin sessions by the project they're linked to.
  const sessionsByProject = new Map<string, PluginSession[]>()
  for (const s of sessions) {
    const pid = s.linkedProjectId || s.lastProjectId
    if (!pid) continue
    const arr = sessionsByProject.get(pid) || []
    arr.push(s)
    sessionsByProject.set(pid, arr)
  }

  return projects.map((project) => {
    const plugins = new Set<string>()
    const samples = new Set<string>()
    const parts = new Set<string>()
    const tags = new Set<string>()

    for (const t of project.tags || []) tags.add(norm(t))
    if (project.genre) tags.add(norm(project.genre))

    const a = analyses[project.id]
    if (a) {
      for (const p of a.plugins || []) {
        if (p.name) plugins.add(norm(p.name))
        if (p.dllName) plugins.add(norm(basename(p.dllName)))
        if (p.presetName) parts.add(norm(p.presetName))
      }
      for (const c of a.channels || []) {
        if (c.pluginName) plugins.add(norm(c.pluginName))
        if (c.name) parts.add(norm(c.name))
        if (c.samplePath) samples.add(norm(basename(c.samplePath)))
      }
      for (const m of a.mixerTracks || []) {
        if (m.name) parts.add(norm(m.name))
        for (const p of m.plugins || []) plugins.add(norm(p))
      }
      for (const pat of a.patterns || []) if (pat.name) parts.add(norm(pat.name))
      for (const s of a.samples || []) samples.add(norm(basename(s)))
    }

    for (const s of sessionsByProject.get(project.id) || []) {
      if (s.pluginName) plugins.add(norm(s.pluginName))
      if (s.trackName) parts.add(norm(s.trackName))
    }

    plugins.delete("")
    samples.delete("")
    parts.delete("")
    tags.delete("")

    const { root: keyRoot, quality: keyQuality } = parseKey(project.musicalKey)

    const text = [
      norm(project.title),
      norm(project.artists),
      norm(project.collectionName),
      norm(project.status),
      norm(project.dawType),
      norm(project.musicalKey),
      project.bpm ? String(project.bpm) : "",
      [...tags].join(" "),
      [...plugins].join(" "),
      [...samples].join(" "),
      [...parts].join(" "),
    ].join(" ")

    return {
      project,
      text,
      plugins,
      samples,
      parts,
      tags,
      daw: norm(project.dawType),
      status: norm(project.status),
      keyRoot,
      keyQuality,
      bpm: project.bpm || 0,
      rating: project.rating || 0,
      timeSpent: project.timeSpent || 0,
    }
  })
}

// ── Query parsing ─────────────────────────────────────────────────────────────

type NumFilter = { op: ">" | "<" | ">=" | "<=" | "=" | "~"; value: number }

interface ParsedQuery {
  terms: { value: string; neg: boolean }[]
  concepts: { concept: Concept; neg: boolean }[]
  plugins: { value: string; neg: boolean }[]
  samples: { value: string; neg: boolean }[]
  tags: { value: string; neg: boolean }[]
  daw: string | null
  status: string | null
  artist: string | null
  bpm: NumFilter | null
  rating: NumFilter | null
  time: NumFilter | null // minutes
  key: { root: string | null; quality: "minor" | "major" | null } | null
  similarTo: string | null
}

const FIELD_ALIASES: Record<string, string> = {
  plugin: "plugin", plugins: "plugin", vst: "plugin", fx: "plugin", synth: "plugin",
  sample: "sample", samples: "sample", sound: "sample", sounds: "sample",
  tag: "tag", tags: "tag",
  genre: "tag",
  daw: "daw",
  status: "status",
  artist: "artist", artists: "artist",
  bpm: "bpm", tempo: "bpm",
  rating: "rating", stars: "rating",
  time: "time", timespent: "time", spent: "time", duration: "time", worked: "time", hours: "time",
  key: "key",
  like: "like", similar: "like",
}

/** Parse a duration like ">2h", "90m", "1.5h", "120" (bare = minutes) → minutes filter. */
function parseDuration(raw: string): NumFilter | null {
  const s = raw.trim().toLowerCase()
  const m = s.match(/^(>=|<=|>|<)?\s*(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minutes)?$/)
  if (!m) return null
  // No operator → ">=" reads naturally ("2h" = at least 2 hours).
  const op = (m[1] as NumFilter["op"]) || ">="
  const val = parseFloat(m[2])
  const isHours = (m[3] || "").startsWith("h")
  return { op, value: isHours ? val * 60 : val }
}

/** Parse a duration range like "1-3h" or "30-90m" → [min, max] in minutes. */
function parseDurationRange(raw: string): [number, number] | null {
  const m = raw.trim().toLowerCase().match(
    /^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minutes)?$/,
  )
  if (!m) return null
  const mult = (m[3] || "").startsWith("h") ? 60 : 1
  return [parseFloat(m[1]) * mult, parseFloat(m[2]) * mult]
}

/** Format minutes as a compact human label ("2h 30m", "45m"). */
function formatDuration(min: number): string {
  const m = Math.round(min)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem ? `${h}h ${rem}m` : `${h}h`
}

/** Split a query into tokens, keeping "quoted phrases" together. */
function tokenize(q: string): string[] {
  const out: string[] = []
  const re = /(-|!)?(\w+:)?"([^"]*)"|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(q))) {
    if (m[3] !== undefined) out.push(`${m[1] || ""}${m[2] || ""}${m[3]}`)
    else out.push(m[4])
  }
  return out
}

function parseNum(raw: string): NumFilter | null {
  const s = raw.trim()
  let m = s.match(/^(>=|<=|>|<)?\s*(\d+(?:\.\d+)?)$/)
  if (m) {
    const op = (m[1] as NumFilter["op"]) || "="
    return { op, value: parseFloat(m[2]) }
  }
  m = s.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/) // range a-b → handled by caller as ~
  if (m) return null // ranges handled separately
  return null
}

function parseRange(raw: string): [number, number] | null {
  const m = raw.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/)
  if (!m) return null
  return [parseFloat(m[1]), parseFloat(m[2])]
}

export function parseQuery(q: string): ParsedQuery {
  const parsed: ParsedQuery = {
    terms: [], concepts: [], plugins: [], samples: [], tags: [],
    daw: null, status: null, artist: null,
    bpm: null, rating: null, time: null, key: null, similarTo: null,
  }
  // bpm / time ranges stored separately on the object via symbol-free fields:
  ;(parsed as any).bpmRange = null
  ;(parsed as any).timeRange = null

  for (const tokRaw of tokenize(q)) {
    let tok = tokRaw
    let neg = false
    if (tok.startsWith("-") || tok.startsWith("!")) {
      neg = true
      tok = tok.slice(1)
    }
    const colon = tok.indexOf(":")
    if (colon > 0) {
      const rawField = tok.slice(0, colon).toLowerCase()
      const field = FIELD_ALIASES[rawField]
      const value = tok.slice(colon + 1).trim()
      if (field && value) {
        switch (field) {
          case "plugin": parsed.plugins.push({ value: norm(value), neg }); continue
          case "sample": parsed.samples.push({ value: norm(value), neg }); continue
          case "tag": parsed.tags.push({ value: norm(value), neg }); continue
          case "daw": parsed.daw = norm(value); continue
          case "status": parsed.status = norm(value); continue
          case "artist": parsed.artist = norm(value); continue
          case "like": parsed.similarTo = value; continue
          case "key": parsed.key = parseKey(value); continue
          case "bpm": {
            const range = parseRange(value)
            if (range) { (parsed as any).bpmRange = range }
            else parsed.bpm = parseNum(value)
            continue
          }
          case "rating": parsed.rating = parseNum(value); continue
          case "time": {
            const range = parseDurationRange(value)
            if (range) { (parsed as any).timeRange = range }
            else parsed.time = parseDuration(value)
            continue
          }
        }
      }
    }

    // ── Bare-word smart interpretation ──
    const low = tok.toLowerCase()
    // Technique words ("sidechain", "saturation" …) expand to known plugins + hints.
    const concept = matchConceptToken(low)
    if (concept) {
      parsed.concepts.push({ concept, neg })
      continue
    }
    if (!neg && (low === "minor" || low === "major")) {
      parsed.key = { root: null, quality: low as "minor" | "major" }
      continue
    }
    // Bare duration like ">2hrs", "90m", "1.5h" → time-spent filter (needs a unit
    // so plain numbers stay BPM). Ranges like "1-3h" too.
    if (!neg && /^(>=|<=|>|<)?\d+(?:\.\d+)?\s*(h|hr|hrs|hour|hours|m|min|mins|minutes)$/.test(low)) {
      const t = parseDuration(low)
      if (t) { parsed.time = t; continue }
    }
    if (!neg && /^\d+(?:\.\d+)?-\d+(?:\.\d+)?\s*(h|hr|hrs|hour|hours|m|min|mins|minutes)$/.test(low)) {
      const r = parseDurationRange(low)
      if (r) { (parsed as any).timeRange = r; continue }
    }
    if (!neg && /^\d{2,3}$/.test(tok)) {
      const n = parseInt(tok, 10)
      if (n >= 40 && n <= 300) { parsed.bpm = { op: "~", value: n }; continue }
    }
    parsed.terms.push({ value: low, neg })
  }
  return parsed
}

// ── Matching & scoring ────────────────────────────────────────────────────────

export interface SearchResult {
  project: Project
  score: number
  reasons: string[]
}

const setHas = (set: Set<string>, needle: string): boolean => {
  if (set.has(needle)) return true
  for (const v of set) if (v.includes(needle)) return true
  return false
}

const numMatch = (f: NumFilter, v: number): boolean => {
  switch (f.op) {
    case ">": return v > f.value
    case "<": return v < f.value
    case ">=": return v >= f.value
    case "<=": return v <= f.value
    case "~": return Math.abs(v - f.value) <= 2
    default: return v === f.value
  }
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  const [small, large] = a.size < b.size ? [a, b] : [b, a]
  for (const v of small) if (large.has(v)) inter++
  return inter / (a.size + b.size - inter)
}

function shared(a: Set<string>, b: Set<string>, limit = 4): string[] {
  const out: string[] = []
  for (const v of a) {
    if (b.has(v)) out.push(v)
    if (out.length >= limit) break
  }
  return out
}

/** Compute a 0–1 "DNA similarity" between two projects + the reasons. */
function similarity(target: DnaDoc, doc: DnaDoc): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0

  const pj = jaccard(target.plugins, doc.plugins)
  if (pj > 0) {
    score += pj * 0.45
    const sp = shared(target.plugins, doc.plugins)
    if (sp.length) reasons.push(`shares ${sp.slice(0, 3).join(", ")}`)
  }
  const sj = jaccard(target.samples, doc.samples)
  if (sj > 0) {
    score += sj * 0.2
    if (!reasons.length) {
      const ss = shared(target.samples, doc.samples)
      if (ss.length) reasons.push(`shares ${ss.slice(0, 2).join(", ")}`)
    }
  }
  if (target.bpm && doc.bpm) {
    const diff = Math.abs(target.bpm - doc.bpm) / target.bpm
    if (diff <= 0.04) { score += 0.15; reasons.push(`~${doc.bpm} BPM`) }
    else if (diff <= 0.1) { score += 0.07 }
  }
  if (target.keyRoot && doc.keyRoot === target.keyRoot && doc.keyQuality === target.keyQuality) {
    score += 0.1
    reasons.push(doc.project.musicalKey)
  } else if (target.keyQuality && doc.keyQuality === target.keyQuality) {
    score += 0.04
  }
  const tj = jaccard(target.tags, doc.tags)
  if (tj > 0) {
    score += tj * 0.1
    const st = shared(target.tags, doc.tags)
    if (st.length && reasons.length < 3) reasons.push(st[0])
  }
  if (target.daw && doc.daw === target.daw) score += 0.03

  return { score, reasons }
}

const keyLabel = (q: { root: string | null; quality: "minor" | "major" | null }): string => {
  if (q.root) return `${q.root.toUpperCase()}${q.quality === "minor" ? "m" : ""}`
  return q.quality || "key"
}

/**
 * Run a catalog search. Returns ranked results, plus the resolved similarity
 * target (when using like:/similar:) and a flag for whether the query was empty.
 */
export function searchCatalog(
  docs: DnaDoc[],
  rawQuery: string,
): { results: SearchResult[]; similarTarget: Project | null; empty: boolean } {
  const q = parseQuery(rawQuery)
  const bpmRange: [number, number] | null = (q as any).bpmRange || null
  const timeRange: [number, number] | null = (q as any).timeRange || null

  const hasFilters =
    q.terms.length > 0 || q.concepts.length > 0 || q.plugins.length > 0 ||
    q.samples.length > 0 || q.tags.length > 0 || q.daw || q.status || q.artist ||
    q.bpm || bpmRange || q.rating || q.time || timeRange || q.key || q.similarTo

  if (!hasFilters) return { results: [], similarTarget: null, empty: true }

  // Resolve similarity target by best title match.
  let target: DnaDoc | null = null
  if (q.similarTo) {
    const needle = norm(q.similarTo)
    target =
      docs.find((d) => norm(d.project.title) === needle) ||
      docs.find((d) => norm(d.project.title).includes(needle)) ||
      null
  }

  const passesFilters = (d: DnaDoc): { ok: boolean; reasons: string[]; strong: boolean } => {
    const reasons: string[] = []
    let strong = false // a high-confidence (plugin-based) concept hit on this doc

    for (const t of q.terms) {
      const found = d.text.includes(t.value)
      if (t.neg && found) return { ok: false, reasons, strong }
      if (!t.neg && !found) return { ok: false, reasons, strong }
    }
    // Technique concepts: match by known plugin (strong) or channel/tag name (weak).
    for (const c of q.concepts) {
      const hit = conceptMatch(d, c.concept)
      const found = hit !== null
      if (c.neg && found) return { ok: false, reasons, strong }
      if (!c.neg && !found) return { ok: false, reasons, strong }
      if (!c.neg && hit) {
        reasons.push(hit.reason)
        if (hit.strong) strong = true
      }
    }
    // plugin:/sample: also search channel / track / preset names (d.parts), since a
    // sound like "Spinz 808" or "Serum Lead" often lives in a channel name, not the
    // sample path — this catches it across the project's whole metadata.
    for (const p of q.plugins) {
      const found = setHas(d.plugins, p.value) || setHas(d.parts, p.value)
      if (p.neg && found) return { ok: false, reasons, strong }
      if (!p.neg && !found) return { ok: false, reasons, strong }
      if (!p.neg && found) reasons.push(p.value)
    }
    for (const s of q.samples) {
      const found = setHas(d.samples, s.value) || setHas(d.parts, s.value)
      if (s.neg && found) return { ok: false, reasons, strong }
      if (!s.neg && !found) return { ok: false, reasons, strong }
      if (!s.neg && found) reasons.push(s.value)
    }
    for (const t of q.tags) {
      const found = setHas(d.tags, t.value)
      if (t.neg && found) return { ok: false, reasons, strong }
      if (!t.neg && !found) return { ok: false, reasons, strong }
      if (!t.neg && found) reasons.push(t.value)
    }
    if (q.daw && !d.daw.includes(q.daw)) return { ok: false, reasons, strong }
    if (q.status && !d.status.includes(q.status)) return { ok: false, reasons, strong }
    if (q.artist && !norm(d.project.artists).includes(q.artist)) return { ok: false, reasons, strong }
    if (q.bpm) {
      if (!numMatch(q.bpm, d.bpm)) return { ok: false, reasons, strong }
      reasons.push(`${d.bpm} BPM`)
    }
    if (bpmRange) {
      if (d.bpm < bpmRange[0] || d.bpm > bpmRange[1]) return { ok: false, reasons, strong }
      reasons.push(`${d.bpm} BPM`)
    }
    if (q.rating && !numMatch(q.rating, d.rating)) return { ok: false, reasons, strong }
    if (q.time) {
      if (!numMatch(q.time, d.timeSpent)) return { ok: false, reasons, strong }
      if (d.timeSpent) reasons.push(formatDuration(d.timeSpent))
    }
    if (timeRange) {
      if (d.timeSpent < timeRange[0] || d.timeSpent > timeRange[1]) return { ok: false, reasons, strong }
      reasons.push(formatDuration(d.timeSpent))
    }
    if (q.key) {
      if (q.key.root && d.keyRoot !== q.key.root) return { ok: false, reasons, strong }
      if (q.key.quality && d.keyQuality !== q.key.quality) return { ok: false, reasons, strong }
      if (d.project.musicalKey) reasons.push(d.project.musicalKey)
      else reasons.push(keyLabel(q.key))
    }
    return { ok: true, reasons, strong }
  }

  const results: SearchResult[] = []

  for (const d of docs) {
    if (target && d === target) continue // don't return the seed project itself
    const f = passesFilters(d)
    if (!f.ok) continue

    let score = 1
    let reasons = f.reasons

    if (target) {
      const sim = similarity(target, d)
      if (sim.score <= 0.001) continue // not actually similar
      score = sim.score
      reasons = [...sim.reasons, ...f.reasons]
    } else {
      // Relevance boosts when not in similarity mode.
      for (const t of q.terms) {
        if (norm(d.project.title).includes(t.value)) score += 3
      }
      // Rank projects that actually loaded the technique's plugin above name-only hits.
      if (f.strong) score += 0.5
      if (d.rating) score += d.rating * 0.05
    }

    // De-dup reasons, cap length.
    const seen = new Set<string>()
    reasons = reasons.filter((r) => r && !seen.has(r) && seen.add(r)).slice(0, 4)

    results.push({ project: d.project, score, reasons })
  }

  results.sort((a, b) => b.score - a.score)
  return { results, similarTarget: target?.project ?? null, empty: false }
}
