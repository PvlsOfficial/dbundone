import React, { useEffect, useMemo, useState } from "react"
import {
  Copy,
  Check,
  FolderOpen,
  Music,
  Image as ImageIcon,
  Hash,
  Tag as TagIcon,
  GripVertical,
  MessageSquare,
  Youtube,
  Mail,
  Disc3,
  ClipboardCopy,
  Plus,
  Trash2,
} from "lucide-react"
import { Badge, Button, Input, Textarea } from "@/components/ui"
import { assetUrl, cn } from "@/lib/utils"
import { Project, AudioVersion } from "@shared/types"

const isElectron = () => typeof window !== "undefined" && typeof window.electron !== "undefined"

const dirOf = (p: string) => p.replace(/[\\/][^\\/]+$/, "")
const fileOf = (p: string) => p.split(/[\\/]/).pop() || p

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "b" + Date.now() + Math.random().toString(36).slice(2)

const imageMime = (p: string): string => {
  const e = p.toLowerCase()
  if (e.endsWith(".png")) return "image/png"
  if (e.endsWith(".gif")) return "image/gif"
  if (e.endsWith(".webp")) return "image/webp"
  return "image/jpeg"
}
const audioMime = (p: string): string => {
  const e = p.toLowerCase()
  if (e.endsWith(".wav")) return "audio/wav"
  if (e.endsWith(".flac")) return "audio/flac"
  if (e.endsWith(".ogg")) return "audio/ogg"
  if (e.endsWith(".m4a")) return "audio/mp4"
  return "audio/mpeg"
}

interface CustomBlock {
  id: string
  label: string
  text: string
}

interface ProjectShareKitProps {
  project: Project
  versions: AudioVersion[]
  artworkUrl: string | null
  artworkPath: string | null
}

/**
 * Share Kit — a per-project "grab and go" panel. Everything here is built to be
 * dragged or copied straight into Discord, a YouTube description, a BeatStars
 * upload, or a label email: the artwork, the audio files, the project facts,
 * ready-made blurbs and your own saved blocks.
 */
export const ProjectShareKit: React.FC<ProjectShareKitProps> = ({ project, versions, artworkUrl, artworkPath }) => {
  const NOTES_KEY = `dbundone:project:notes:${project.id}`
  const BLOCKS_KEY = `dbundone:project:shareBlocks:${project.id}`
  const [notes, setNotes] = useState("")
  const [custom, setCustom] = useState<CustomBlock[]>([])
  const [copied, setCopied] = useState<string | null>(null)

  // Load persisted notes + custom blocks once per project.
  useEffect(() => {
    try {
      setNotes(localStorage.getItem(NOTES_KEY) || "")
    } catch {
      setNotes("")
    }
    try {
      const raw = localStorage.getItem(BLOCKS_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      setCustom(Array.isArray(parsed) ? parsed : [])
    } catch {
      setCustom([])
    }
  }, [NOTES_KEY, BLOCKS_KEY])

  // Persist notes (debounced).
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(NOTES_KEY, notes)
      } catch {
        /* ignore quota */
      }
    }, 400)
    return () => window.clearTimeout(id)
  }, [notes, NOTES_KEY])

  // Persist custom blocks (debounced).
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(BLOCKS_KEY, JSON.stringify(custom))
      } catch {
        /* ignore quota */
      }
    }, 400)
    return () => window.clearTimeout(id)
  }, [custom, BLOCKS_KEY])

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied((k) => (k === key ? null : k)), 1200)
    } catch {
      /* clipboard may be unavailable */
    }
  }

  const copyImage = async () => {
    if (!artworkPath) return
    try {
      const res = await fetch(assetUrl(artworkPath))
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      setCopied("image")
      window.setTimeout(() => setCopied((k) => (k === "image" ? null : k)), 1200)
    } catch {
      if (artworkPath) copy(artworkPath, "image")
    }
  }

  const openDir = (p: string) => {
    if (isElectron()) window.electron?.openFolder(dirOf(p))
  }

  const dragText = (e: React.DragEvent, text: string) => {
    e.dataTransfer.setData("text/plain", text)
    e.dataTransfer.effectAllowed = "copy"
  }

  // Drag the actual file out (Chromium DownloadURL — fetched & dropped as a real
  // file by the OS / Discord), with the path as a plain-text fallback.
  const dragFile = (e: React.DragEvent, path: string, mime: string) => {
    const url = assetUrl(path)
    const name = fileOf(path)
    try {
      e.dataTransfer.setData("DownloadURL", `${mime}:${name}:${url}`)
    } catch {
      /* some targets reject DownloadURL */
    }
    e.dataTransfer.setData("text/uri-list", url)
    e.dataTransfer.setData("text/plain", path)
    e.dataTransfer.effectAllowed = "copy"
  }

  // ── Facts ─────────────────────────────────────────────────────────────────
  const facts = useMemo(() => {
    const f: { label: string; value: string }[] = []
    if (project.title) f.push({ label: "Title", value: project.title })
    if (project.artists) f.push({ label: "Artist", value: project.artists })
    if (project.bpm && project.bpm > 0) f.push({ label: "BPM", value: String(project.bpm) })
    if (project.musicalKey && project.musicalKey !== "None") f.push({ label: "Key", value: project.musicalKey })
    if (project.genre) f.push({ label: "Genre", value: project.genre })
    return f
  }, [project.title, project.artists, project.bpm, project.musicalKey, project.genre])

  const factLine = facts.map((f) => `${f.label}: ${f.value}`).join("  •  ")
  const tagLine = (project.tags || []).map((t) => `#${t.replace(/\s+/g, "")}`).join(" ")
  const titleArtist = [project.artists, project.title].filter(Boolean).join(" - ") || project.title

  const blocks = useMemo(() => {
    const bpmKey = [
      project.bpm && project.bpm > 0 ? `${project.bpm} BPM` : null,
      project.musicalKey && project.musicalKey !== "None" ? project.musicalKey : null,
    ]
      .filter(Boolean)
      .join(" • ")

    const discord = [`🎵 **${titleArtist}**`, bpmKey, project.genre ? `Genre: ${project.genre}` : "", tagLine]
      .filter(Boolean)
      .join("\n")

    const youtube = [titleArtist, "", bpmKey, project.genre ? `Genre: ${project.genre}` : "", "", tagLine]
      .filter((l) => l !== undefined)
      .join("\n")
      .trim()

    const beatstars = [titleArtist, bpmKey, (project.tags || []).join(", ")].filter(Boolean).join(" | ")

    const email = [
      `Hi,`,
      ``,
      `Sharing my track "${project.title}"${project.artists ? ` by ${project.artists}` : ""}.`,
      factLine ? factLine : "",
      ``,
      `Let me know what you think!`,
    ]
      .filter((l) => l !== undefined)
      .join("\n")

    return { discord, youtube, beatstars, email }
  }, [titleArtist, project.bpm, project.musicalKey, project.genre, project.tags, project.title, project.artists, tagLine, factLine])

  const addBlock = () => setCustom((prev) => [...prev, { id: newId(), label: "My block", text: "" }])
  const updateBlock = (id: string, patch: Partial<CustomBlock>) =>
    setCustom((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  const removeBlock = (id: string) => setCustom((prev) => prev.filter((b) => b.id !== id))

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardCopy className="w-6 h-6 text-primary" />
          Share Kit
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Drag or copy anything into Discord, a description box or an email.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* ── Left column: assets ─────────────────────────────────────── */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Artwork */}
            <div className="rounded-xl border border-border/30 bg-card/50 p-3 space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <ImageIcon className="w-3.5 h-3.5" /> Artwork
              </div>
              {artworkUrl ? (
                <img
                  src={artworkUrl}
                  alt="Artwork"
                  draggable
                  onDragStart={(e) => (artworkPath ? dragFile(e, artworkPath, imageMime(artworkPath)) : undefined)}
                  className="w-full aspect-square object-cover rounded-lg cursor-grab active:cursor-grabbing"
                  title="Drag me straight into an app"
                />
              ) : (
                <div className="w-full aspect-square rounded-lg bg-muted/40 flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="w-8 h-8 opacity-40" />
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" size="sm" variant="secondary" className="h-7 text-[11px] gap-1" disabled={!artworkPath} onClick={copyImage}>
                  {copied === "image" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Copy image
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px] gap-1" disabled={!artworkPath} onClick={() => artworkPath && copy(artworkPath, "imgpath")}>
                  {copied === "imgpath" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Path
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px] gap-1" disabled={!artworkPath} onClick={() => artworkPath && openDir(artworkPath)}>
                  <FolderOpen className="w-3 h-3" /> Folder
                </Button>
              </div>
            </div>

            {/* Facts */}
            <div className="rounded-xl border border-border/30 bg-card/50 p-3 space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Disc3 className="w-3.5 h-3.5" /> Project info
              </div>
              {facts.length === 0 && <p className="text-xs text-muted-foreground">Add a title, artist, BPM or key.</p>}
              <div className="space-y-1.5">
                {facts.map((f) => (
                  <div
                    key={f.label}
                    draggable
                    onDragStart={(e) => dragText(e, f.value)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-grab active:cursor-grabbing group"
                    title="Drag or copy"
                  >
                    <GripVertical className="w-3 h-3 text-muted-foreground/40" />
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground w-12 shrink-0">{f.label}</span>
                    <span className="text-xs flex-1 truncate">{f.value}</span>
                    <button
                      type="button"
                      className="p-0.5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                      onClick={() => copy(f.value, `fact-${f.label}`)}
                      title="Copy"
                    >
                      {copied === `fact-${f.label}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                ))}
              </div>
              {(project.tags || []).length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <TagIcon className="w-3 h-3 text-muted-foreground" />
                  {(project.tags || []).map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                  <button type="button" className="ml-1 text-muted-foreground hover:text-foreground" onClick={() => copy(tagLine, "tags")} title="Copy hashtags">
                    {copied === "tags" ? <Check className="w-3 h-3" /> : <Hash className="w-3 h-3" />}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Audio files */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Music className="w-3.5 h-3.5" /> Audio files
            </div>
            {versions.length === 0 && <p className="text-xs text-muted-foreground">No audio versions yet.</p>}
            <div className="space-y-1.5">
              {versions.map((v) => (
                <div
                  key={v.id}
                  draggable
                  onDragStart={(e) => dragFile(e, v.filePath, audioMime(v.filePath))}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/30 bg-card/50 hover:bg-muted/30 cursor-grab active:cursor-grabbing group"
                  title="Drag the file straight into an app"
                >
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40" />
                  <Music className="w-3.5 h-3.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{v.name || fileOf(v.filePath)}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{fileOf(v.filePath)}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px] gap-1" onClick={() => copy(v.filePath, `v-${v.id}`)}>
                      {copied === `v-${v.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Path
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px] gap-1" onClick={() => openDir(v.filePath)}>
                      <FolderOpen className="w-3 h-3" /> Folder
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Distribution notes */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <MessageSquare className="w-3.5 h-3.5" /> Distribution notes
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Splits, release date, who you sent it to, credits, ISRC… (saved automatically)"
              className="min-h-[120px] text-sm"
            />
          </div>
        </div>

        {/* ── Right column: posts + your blocks ───────────────────────── */}
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <MessageSquare className="w-3.5 h-3.5" /> Ready-made posts
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ShareBlock icon={<MessageSquare className="w-3.5 h-3.5" />} label="Discord" text={blocks.discord} copied={copied === "b-discord"} onCopy={() => copy(blocks.discord, "b-discord")} onDrag={dragText} />
              <ShareBlock icon={<Youtube className="w-3.5 h-3.5" />} label="YouTube description" text={blocks.youtube} copied={copied === "b-youtube"} onCopy={() => copy(blocks.youtube, "b-youtube")} onDrag={dragText} />
              <ShareBlock icon={<Disc3 className="w-3.5 h-3.5" />} label="BeatStars" text={blocks.beatstars} copied={copied === "b-beatstars"} onCopy={() => copy(blocks.beatstars, "b-beatstars")} onDrag={dragText} />
              <ShareBlock icon={<Mail className="w-3.5 h-3.5" />} label="Label email" text={blocks.email} copied={copied === "b-email"} onCopy={() => copy(blocks.email, "b-email")} onDrag={dragText} />
            </div>
          </div>

          {/* Your own blocks */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ClipboardCopy className="w-3.5 h-3.5" /> Your blocks
              <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px] gap-1 ml-auto" onClick={addBlock}>
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
            {custom.length === 0 && (
              <p className="text-xs text-muted-foreground">Save your own reusable text — a bio, contact line, splits, anything.</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {custom.map((b) => (
                <div
                  key={b.id}
                  draggable
                  onDragStart={(e) => dragText(e, b.text)}
                  className="rounded-xl border border-border/30 bg-card/50 p-3 space-y-2 cursor-grab active:cursor-grabbing"
                  title="Drag into an app, or copy"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={b.label}
                      onChange={(e) => updateBlock(b.id, { label: e.target.value })}
                      onDragStart={(e) => e.stopPropagation()}
                      draggable={false}
                      className="h-6 text-xs flex-1 border-transparent bg-transparent px-1 focus-visible:bg-muted/40"
                      aria-label="Block label"
                    />
                    <button type="button" className="p-0.5 text-muted-foreground hover:text-foreground" onClick={() => copy(b.text, `c-${b.id}`)} title="Copy">
                      {copied === `c-${b.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button type="button" className="p-0.5 text-muted-foreground hover:text-destructive" onClick={() => removeBlock(b.id)} title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Textarea
                    value={b.text}
                    onChange={(e) => updateBlock(b.id, { text: e.target.value })}
                    onDragStart={(e) => e.stopPropagation()}
                    draggable={false}
                    placeholder="Type your text…"
                    className="min-h-[80px] text-[11px] font-sans"
                    aria-label="Block text"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const ShareBlock: React.FC<{
  icon: React.ReactNode
  label: string
  text: string
  copied: boolean
  onCopy: () => void
  onDrag: (e: React.DragEvent, text: string) => void
}> = ({ icon, label, text, copied, onCopy, onDrag }) => (
  <div
    draggable
    onDragStart={(e) => onDrag(e, text)}
    className="rounded-xl border border-border/30 bg-card/50 p-3 space-y-2 cursor-grab active:cursor-grabbing"
    title="Drag into an app, or copy"
  >
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-xs font-medium flex-1">{label}</span>
      <button type="button" className="p-0.5 text-muted-foreground hover:text-foreground" onClick={onCopy} title="Copy">
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
    <pre className={cn("text-[11px] whitespace-pre-wrap text-muted-foreground max-h-32 overflow-auto font-sans", !text && "italic")}>
      {text || "Add project info to generate this."}
    </pre>
  </div>
)
