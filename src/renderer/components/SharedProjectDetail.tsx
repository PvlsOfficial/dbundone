import React, { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  Music,
  Clock,
  Calendar,
  Tag,
  User,
  Mail,
  Disc3,
  Folder,
  Timer,
  Lightbulb,
  Pencil,
  AudioWaveform,
  Sliders,
  Sparkles,
  CheckCircle2,
  Archive,
  MessageSquare,
  Check,
  XCircle,
  Play,
  Pause,
  Volume2,
  VolumeX,
  FileAudio,
  Loader2,
  Star,
  Plus,
  Trash2,
  Save,
  X,
  Eye,
  Edit2,
  PartyPopper,
  Headphones,
  Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/components/ThemeProvider"

const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
import {
  type CloudShare,
  type SharedVersion,
  type SharedAnnotation,
  addSharedAnnotation,
  updateSharedAnnotation,
  deleteSharedAnnotation,
  updateShareProjectStatus,
} from "@/lib/sharingService"

// ── Status config (mirrors ProjectDetail) ──────────────────────────────────

const STATUS_CONFIG: Record<string, { title: string; hex: string; icon: React.ReactNode }> = {
  idea: { title: "Idea", hex: "#a855f7", icon: <Lightbulb className="w-3.5 h-3.5" /> },
  "in-progress": { title: "In Progress", hex: "#3b82f6", icon: <Pencil className="w-3.5 h-3.5" /> },
  mixing: { title: "Mixing", hex: "#f97316", icon: <Headphones className="w-3.5 h-3.5" /> },
  mastering: { title: "Mastering", hex: "#06b6d4", icon: <Disc3 className="w-3.5 h-3.5" /> },
  completed: { title: "Completed", hex: "#22c55e", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  released: { title: "Released", hex: "#ec4899", icon: <PartyPopper className="w-3.5 h-3.5" /> },
  archived: { title: "Archived", hex: "#9ca3af", icon: <Archive className="w-3.5 h-3.5" /> },
}

const STATUS_PIPELINE = ["idea", "in-progress", "mixing", "mastering", "completed", "released"] as const

const ANNOTATION_COLORS = [
  { name: "Purple", value: "#8b5cf6" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Yellow", value: "#eab308" },
  { name: "Orange", value: "#f97316" },
  { name: "Red", value: "#ef4444" },
  { name: "Pink", value: "#ec4899" },
]

interface SharedProjectDetailProps {
  share: CloudShare
  onBack: () => void
  onAccept?: () => void
  onDecline?: () => void
  onRefresh?: () => void
}

export const SharedProjectDetail: React.FC<SharedProjectDetailProps> = ({
  share,
  onBack,
  onAccept,
  onDecline,
  onRefresh,
}) => {
  const { user, profile } = useAuth()
  const { accentColor } = useTheme()
  const sender = share.fromUser
  const senderName = sender?.displayName || sender?.email || "Unknown"
  const senderInitial = senderName[0].toUpperCase()
  const canEdit = share.permission === 'edit'

  // Build version list: prefer sharedVersions, fall back to legacy audioUrl
  const allVersions: SharedVersion[] = share.sharedVersions.length > 0
    ? share.sharedVersions
    : share.audioUrl
      ? [{
          id: 'legacy',
          name: share.audioName || 'Audio',
          fileUrl: share.audioUrl,
          fileName: share.audioName || 'audio.wav',
          versionNumber: 1,
          isFavorite: false,
          annotations: [],
        }]
      : []

  // ── Audio player state ──────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const waveContainerRef = useRef<HTMLDivElement>(null)
  const [selectedVersion, setSelectedVersion] = useState<SharedVersion | null>(allVersions[0] || null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isAudioReady, setIsAudioReady] = useState(false)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [peaks, setPeaks] = useState<number[]>([])
  const drawRef = useRef<() => void>()
  const rafIdRef = useRef(0)

  // Annotation state
  const [annotations, setAnnotations] = useState<SharedAnnotation[]>([])
  const [showAddAnnotation, setShowAddAnnotation] = useState(false)
  const [newAnnotationText, setNewAnnotationText] = useState("")
  const [newAnnotationColor, setNewAnnotationColor] = useState(ANNOTATION_COLORS[0].value)
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Status state
  const [projectStatus, setProjectStatus] = useState(share.projectStatus || '')

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // Update annotations when version changes
  useEffect(() => {
    setAnnotations(selectedVersion?.annotations || [])
  }, [selectedVersion?.id])

  // Create audio element once
  useEffect(() => {
    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    audio.preload = 'auto'
    audioRef.current = audio

    audio.addEventListener('loadedmetadata', () => { setDuration(audio.duration || 0); setIsAudioReady(true); setIsLoadingAudio(false) })
    audio.addEventListener('canplay', () => { setIsAudioReady(true); setIsLoadingAudio(false) })
    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime))
    audio.addEventListener('ended', () => { setIsPlaying(false); setCurrentTime(0) })
    audio.addEventListener('play', () => setIsPlaying(true))
    audio.addEventListener('pause', () => setIsPlaying(false))
    audio.addEventListener('error', () => { setIsAudioReady(false); setIsLoadingAudio(false) })

    return () => { audio.pause(); audio.src = '' }
  }, [])

  // Swap audio source when version changes
  useEffect(() => {
    if (!selectedVersion || !audioRef.current) return
    setIsAudioReady(false)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setIsLoadingAudio(true)
    setPeaks([])
    audioRef.current.src = selectedVersion.fileUrl
    audioRef.current.load()
  }, [selectedVersion?.id])

  // Compute waveform peaks via Web Audio API
  useEffect(() => {
    if (!selectedVersion?.fileUrl) return
    let cancelled = false
    const computePeaks = async () => {
      try {
        const response = await fetch(selectedVersion.fileUrl)
        const arrayBuffer = await response.arrayBuffer()
        if (cancelled) return
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const decoded = await audioCtx.decodeAudioData(arrayBuffer)
        const channelData = decoded.getChannelData(0)
        const numPeaks = 200
        const samplesPerPeak = Math.floor(channelData.length / numPeaks)
        const newPeaks: number[] = []
        for (let i = 0; i < numPeaks; i++) {
          let max = 0
          for (let j = 0; j < samplesPerPeak; j++) {
            const abs = Math.abs(channelData[i * samplesPerPeak + j] || 0)
            if (abs > max) max = abs
          }
          newPeaks.push(max)
        }
        if (!cancelled) setPeaks(newPeaks)
        audioCtx.close()
      } catch (err) {
        console.warn('[SharedDetail] Could not compute waveform:', err)
      }
    }
    computePeaks()
    return () => { cancelled = true }
  }, [selectedVersion?.fileUrl])

  // Volume
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume }, [volume])

  const handlePlayPause = () => {
    if (!audioRef.current || !isAudioReady) return
    if (isPlaying) audioRef.current.pause()
    else audioRef.current.play()
  }

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    audioRef.current.currentTime = pos * duration
  }, [duration])

  const handleSeekTo = (time: number) => {
    if (!audioRef.current || !isAudioReady) return
    audioRef.current.currentTime = time
    setCurrentTime(time)
  }

  // Draw waveform on canvas
  drawRef.current = () => {
    const canvas = canvasRef.current
    const container = waveContainerRef.current
    if (!canvas || !container || peaks.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()
    const targetW = Math.round(rect.width * dpr)
    const targetH = Math.round(rect.height * dpr)
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW; canvas.height = targetH
      canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    ctx.clearRect(0, 0, rect.width, rect.height)
    const barWidth = rect.width / peaks.length
    const barGap = Math.max(1, barWidth * 0.2)
    const actualBarWidth = barWidth - barGap
    const centerY = rect.height / 2
    const progress = duration > 0 ? currentTime / duration : 0

    // Unplayed bars
    ctx.fillStyle = hexToRgba(accentColor, 0.25)
    for (let i = 0; i < peaks.length; i++) {
      if ((i + 0.5) / peaks.length > progress) {
        const x = i * barWidth + barGap / 2
        const h = Math.max(2, peaks[i] * rect.height * 0.9)
        ctx.fillRect(x, centerY - h / 2, actualBarWidth, h)
      }
    }
    // Played bars
    ctx.fillStyle = hexToRgba(accentColor, 1)
    for (let i = 0; i < peaks.length; i++) {
      if ((i + 0.5) / peaks.length <= progress) {
        const x = i * barWidth + barGap / 2
        const h = Math.max(2, peaks[i] * rect.height * 0.9)
        ctx.fillRect(x, centerY - h / 2, actualBarWidth, h)
      }
    }
    // Annotation markers
    if (duration > 0) {
      for (const ann of annotations) {
        const x = (ann.timestamp / duration) * rect.width
        ctx.fillStyle = ann.color
        ctx.beginPath()
        ctx.arc(x, 4, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillRect(x - 0.5, 4, 1, rect.height - 4)
      }
    }
  }

  useEffect(() => {
    if (peaks.length === 0 && annotations.length === 0) return
    cancelAnimationFrame(rafIdRef.current)
    rafIdRef.current = requestAnimationFrame(() => drawRef.current?.())
    return () => cancelAnimationFrame(rafIdRef.current)
  }, [peaks, currentTime, duration, annotations, accentColor])

  // ── Annotation handlers ──────────────────────────────────────────────────
  const handleAddAnnotation = async () => {
    if (!selectedVersion || !newAnnotationText.trim() || !user || !canEdit) return
    setIsSaving(true)
    try {
      const newAnn = await addSharedAnnotation(share.id, selectedVersion.id, {
        timestamp: currentTime,
        text: newAnnotationText.trim(),
        color: newAnnotationColor,
        isTask: false,
        taskStatus: null,
        createdBy: user.id,
        createdByName: profile?.displayName || user.email || 'Unknown',
        createdAt: new Date().toISOString(),
      })
      setAnnotations(prev => [...prev, newAnn].sort((a, b) => a.timestamp - b.timestamp))
      setNewAnnotationText("")
      setShowAddAnnotation(false)
      onRefresh?.()
    } catch (e: any) {
      console.error('[SharedDetail] Failed to add annotation:', e.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateAnnotation = async (annotationId: string) => {
    if (!selectedVersion || !editText.trim() || !canEdit) return
    setIsSaving(true)
    try {
      await updateSharedAnnotation(share.id, selectedVersion.id, annotationId, { text: editText.trim() })
      setAnnotations(prev => prev.map(a => a.id === annotationId ? { ...a, text: editText.trim() } : a))
      setEditingAnnotation(null)
      setEditText("")
      onRefresh?.()
    } catch (e: any) {
      console.error('[SharedDetail] Failed to update annotation:', e.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAnnotation = async (annotationId: string) => {
    if (!selectedVersion || !canEdit) return
    try {
      await deleteSharedAnnotation(share.id, selectedVersion.id, annotationId)
      setAnnotations(prev => prev.filter(a => a.id !== annotationId))
      onRefresh?.()
    } catch (e: any) {
      console.error('[SharedDetail] Failed to delete annotation:', e.message)
    }
  }

  // ── Status handler ────────────────────────────────────────────────────────
  const handleStatusChange = async (newStatus: string) => {
    if (!canEdit || newStatus === projectStatus) return
    const oldStatus = projectStatus
    setProjectStatus(newStatus)
    try {
      await updateShareProjectStatus(share.id, newStatus)
      onRefresh?.()
    } catch (e: any) {
      setProjectStatus(oldStatus)
      console.error('[SharedDetail] Failed to update status:', e.message)
    }
  }

  const formatDate = (d: string | null) => {
    if (!d) return null
    try { return new Date(d).toLocaleDateString() } catch { return null }
  }

  const formatMinutes = (m: number | null) => {
    if (!m || m <= 0) return null
    const hours = Math.floor(m / 60)
    const mins = Math.round(m % 60)
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border/30 bg-card/50">
        <div className="p-5">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="mt-1">
              <ArrowLeft className="w-5 h-5" />
            </Button>

            {/* Artwork */}
            {share.imageUrl ? (
              <img
                src={share.imageUrl}
                alt={share.projectTitle}
                className="w-24 h-24 rounded-xl border border-border/30 object-cover flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-border/30 flex items-center justify-center flex-shrink-0">
                <Music className="w-10 h-10 text-primary/40" />
              </div>
            )}

            {/* Project Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">{share.projectTitle}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                {share.projectBpm && share.projectBpm > 0 && <span>{share.projectBpm} BPM</span>}
                {share.projectKey && share.projectKey !== "None" && <span>• {share.projectKey}</span>}
                {share.projectArtists && <span>• {share.projectArtists}</span>}
                {share.projectGenre && <span>• {share.projectGenre}</span>}
              </div>

              {/* Tags */}
              {share.projectTags && share.projectTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {share.projectTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs border-0 bg-primary/10 text-primary">{tag}</Badge>
                  ))}
                </div>
              )}

              {/* Status Pipeline */}
              {projectStatus && (
                <div className="flex items-center gap-1 mt-3">
                  {STATUS_PIPELINE.map((statusKey, index) => {
                    const config = STATUS_CONFIG[statusKey]
                    if (!config) return null
                    const isActive = projectStatus === statusKey
                    const currentIndex = STATUS_PIPELINE.indexOf(projectStatus as typeof STATUS_PIPELINE[number])
                    const isPast = currentIndex >= 0 && index < currentIndex

                    return (
                      <React.Fragment key={statusKey}>
                        {index > 0 && (
                          <div className="h-[2px] w-4 flex-shrink-0 rounded-full" style={{ backgroundColor: isPast ? `${config.hex}40` : 'hsl(var(--border) / 0.3)' }} />
                        )}
                        <button
                          onClick={() => canEdit && handleStatusChange(statusKey)}
                          disabled={!canEdit}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                            isActive ? "shadow-sm" : isPast ? "opacity-50" : "opacity-30",
                            canEdit && "hover:opacity-80 cursor-pointer",
                            !canEdit && "cursor-default"
                          )}
                          style={isActive ? { backgroundColor: `${config.hex}20`, color: config.hex } : isPast ? { color: config.hex } : { color: 'hsl(var(--muted-foreground))' }}
                          title={canEdit ? `Set status to ${config.title}` : config.title}
                        >
                          {config.icon}
                          <span className="hidden sm:inline">{config.title}</span>
                        </button>
                      </React.Fragment>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Badges */}
            <div className="flex-shrink-0 flex flex-col items-end gap-2">
              <Badge variant="secondary" className={cn("text-xs border-0", share.status === 'accepted' && "bg-green-500/10 text-green-500", share.status === 'pending' && "bg-yellow-500/10 text-yellow-500", share.status === 'declined' && "bg-red-500/10 text-red-500")}>
                {share.status}
              </Badge>
              <Badge variant="outline" className={cn("text-[10px]", canEdit ? "border-green-500/30 text-green-500" : "border-muted-foreground/30")}>
                {canEdit ? <><Edit2 className="w-2.5 h-2.5 mr-1" />Can Edit</> : <><Eye className="w-2.5 h-2.5 mr-1" />View Only</>}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Sender card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl border border-border/30 bg-card/50 mb-6">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Shared by</h3>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">{senderInitial}</span>
            </div>
            <div>
              <p className="text-sm font-semibold">{senderName}</p>
              {sender?.email && (
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{sender.email}</p>
              )}
            </div>
            <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(share.createdAt).toLocaleDateString()} at {new Date(share.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          {share.message && (
            <div className="mt-3 p-3 rounded-lg bg-muted/30 flex items-start gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">{share.message}</p>
            </div>
          )}
        </motion.div>

        {/* Audio Player + Versions */}
        {allVersions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="p-4 rounded-xl border border-border/30 bg-card/50 mb-6">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileAudio className="w-3.5 h-3.5" /> Audio Versions
            </h3>

            {/* Version selector */}
            {allVersions.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {allVersions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVersion(v)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                      selectedVersion?.id === v.id
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {v.isFavorite && <Star className="w-3 h-3 fill-current" />}
                    {v.name}
                    {v.annotations.length > 0 && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5">{v.annotations.length}</Badge>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Waveform */}
            <div
              ref={waveContainerRef}
              onClick={handleSeek}
              className="w-full cursor-pointer rounded-lg overflow-hidden relative mb-4"
              style={{ height: 72 }}
            >
              {isLoadingAudio || peaks.length === 0 ? (
                <div className="absolute inset-0 rounded-lg animate-pulse bg-primary/10 flex items-center justify-center">
                  {isLoadingAudio && <Loader2 className="w-4 h-4 animate-spin text-primary/50" />}
                </div>
              ) : (
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              <button
                onClick={handlePlayPause}
                disabled={!isAudioReady}
                className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-full transition-all",
                  "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95",
                  "shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              <div className="flex-1 text-center">
                <span className="text-sm font-mono text-muted-foreground">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-2 w-28">
                <button onClick={() => setVolume(volume === 0 ? 0.8 : 0)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                  {volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <Slider value={[volume]} max={1} step={0.01} onValueChange={([v]) => setVolume(v)} className="w-16" />
              </div>
            </div>
          </motion.div>
        )}

        {/* Annotations */}
        {selectedVersion && (annotations.length > 0 || canEdit) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="p-4 rounded-xl border border-border/30 bg-card/50 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5" /> Annotations ({annotations.length})
              </h3>
              {canEdit && !showAddAnnotation && (
                <Button size="sm" variant="outline" onClick={() => setShowAddAnnotation(true)} className="h-7 gap-1 text-xs">
                  <Plus className="w-3 h-3" /> Add
                </Button>
              )}
            </div>

            {/* Add annotation form */}
            {canEdit && showAddAnnotation && (
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">at {formatTime(currentTime)}</span>
                  <div className="flex gap-1 ml-auto">
                    {ANNOTATION_COLORS.map(c => (
                      <button
                        key={c.value}
                        onClick={() => setNewAnnotationColor(c.value)}
                        className={cn("w-4 h-4 rounded-full border-2 transition-all", newAnnotationColor === c.value ? "border-foreground scale-125" : "border-transparent")}
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newAnnotationText}
                    onChange={(e) => setNewAnnotationText(e.target.value)}
                    placeholder="Add a comment at this timestamp..."
                    className="text-xs h-8"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAnnotation()}
                    autoFocus
                  />
                  <Button size="sm" onClick={handleAddAnnotation} disabled={!newAnnotationText.trim() || isSaving} className="h-8 gap-1">
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowAddAnnotation(false); setNewAnnotationText("") }} className="h-8">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* Annotation list */}
            <div className="space-y-1.5">
              <AnimatePresence>
                {annotations.sort((a, b) => a.timestamp - b.timestamp).map((ann) => (
                  <motion.div
                    key={ann.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => { if (editingAnnotation !== ann.id) handleSeekTo(ann.timestamp) }}
                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors group cursor-pointer"
                    title={`Jump to ${formatTime(ann.timestamp)}`}
                  >
                    <div className="w-1 h-full min-h-[24px] rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: ann.color }} />
                    <span
                      className="text-[10px] font-mono text-primary flex-shrink-0 mt-0.5"
                    >
                      {formatTime(ann.timestamp)}
                    </span>
                    <div className="flex-1 min-w-0">
                      {editingAnnotation === ann.id ? (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Input value={editText} onChange={(e) => setEditText(e.target.value)} className="text-xs h-6" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleUpdateAnnotation(ann.id)} />
                          <Button size="sm" variant="ghost" onClick={() => handleUpdateAnnotation(ann.id)} className="h-6 w-6 p-0"><Check className="w-3 h-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingAnnotation(null); setEditText("") }} className="h-6 w-6 p-0"><X className="w-3 h-3" /></Button>
                        </div>
                      ) : (
                        <p className="text-xs">{ann.text}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">{ann.createdByName}</p>
                    </div>
                    {canEdit && editingAnnotation !== ann.id && (
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" onClick={() => { setEditingAnnotation(ann.id); setEditText(ann.text) }} className="h-6 w-6 p-0"><Edit2 className="w-2.5 h-2.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteAnnotation(ann.id)} className="h-6 w-6 p-0 text-destructive hover:text-destructive"><Trash2 className="w-2.5 h-2.5" /></Button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {annotations.length === 0 && !showAddAnnotation && (
                <p className="text-xs text-muted-foreground text-center py-4">No annotations yet{canEdit ? " — click Add to leave a comment" : ""}</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Project metadata grid */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-4 rounded-xl border border-border/30 bg-card/50 mb-6">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Project Details</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <MetaItem icon={Disc3} label="DAW" value={share.projectDaw} />
            <MetaItem icon={AudioWaveform} label="BPM" value={share.projectBpm ? `${share.projectBpm}` : null} />
            <MetaItem icon={Music} label="Key" value={share.projectKey !== "None" ? share.projectKey : null} />
            <MetaItem icon={Tag} label="Genre" value={share.projectGenre} />
            <MetaItem icon={User} label="Artists" value={share.projectArtists} />
            <MetaItem icon={Folder} label="Collection" value={share.projectCollection} />
            <MetaItem icon={Timer} label="Time Spent" value={formatMinutes(share.projectTimeSpent)} />
            <MetaItem icon={Calendar} label="Created" value={formatDate(share.projectCreatedAt)} />
            <MetaItem icon={Calendar} label="Last Modified" value={formatDate(share.projectUpdatedAt)} />
          </div>
          {share.projectTags && share.projectTags.length > 0 && (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {share.projectTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs border-0 bg-primary/10 text-primary">{tag}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </motion.div>

        {/* Accept / Decline */}
        {share.status === 'pending' && (onAccept || onDecline) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="p-4 rounded-xl border border-primary/20 bg-primary/5">
            <p className="text-sm font-medium mb-3">{senderName} wants to share this project with you.</p>
            <div className="flex items-center gap-2">
              {onDecline && (
                <Button variant="outline" size="sm" onClick={onDecline} className="gap-1.5">
                  <XCircle className="w-3.5 h-3.5" /> Decline
                </Button>
              )}
              {onAccept && (
                <Button size="sm" onClick={onAccept} className="gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Accept
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ── Meta item ───────────────────────────────────────────────────────────────

function MetaItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null | undefined }) {
  if (!value) {
    return (
      <div className="flex items-start gap-2 opacity-30">
        <Icon className="w-3.5 h-3.5 mt-0.5 text-muted-foreground" />
        <div><p className="text-[10px] text-muted-foreground">{label}</p><p className="text-xs">—</p></div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 mt-0.5 text-primary" />
      <div><p className="text-[10px] text-muted-foreground">{label}</p><p className="text-xs font-medium">{value}</p></div>
    </div>
  )
}

export default SharedProjectDetail
