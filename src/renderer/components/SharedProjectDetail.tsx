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
  Download,
  ListTodo,
  Plug,
  Circle,
  CheckCircle,
  Flag,
  AlertTriangle,
  MoreHorizontal,
  Info,
  Edit3,
  Music2,
  Layers,
  SlidersHorizontal,
  Grid3X3,
  ChevronDown,
  ChevronRight,
  Copy,
  Search,
  Puzzle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/components/ThemeProvider"
import { getSupabase } from "@/lib/supabase"

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
  type SharedTask,
  addSharedAnnotation,
  updateSharedAnnotation,
  deleteSharedAnnotation,
  updateShareProjectStatus,
  addSharedTask,
  updateSharedTask,
  deleteSharedTask,
  reorderSharedTasks,
} from "@/lib/sharingService"
import type { FlpAnalysis } from "@shared/types"

// ── Status config ──────────────────────────────────────────────────────────

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

const KANBAN_COLUMNS: { id: SharedTask['status']; title: string; icon: React.ReactNode; color: string; bgColor: string }[] = [
  { id: "todo", title: "To Do", icon: <Circle className="w-4 h-4" />, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500/15 dark:bg-blue-500/10" },
  { id: "in-progress", title: "In Progress", icon: <Loader2 className="w-4 h-4" />, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-500/15 dark:bg-orange-500/10" },
  { id: "done", title: "Done", icon: <CheckCircle2 className="w-4 h-4" />, color: "text-green-600 dark:text-green-400", bgColor: "bg-green-500/15 dark:bg-green-500/10" },
]

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "text-gray-500", bgColor: "bg-gray-500/15", icon: <Flag className="w-3 h-3" /> },
  medium: { label: "Medium", color: "text-yellow-500", bgColor: "bg-yellow-500/15", icon: <Flag className="w-3 h-3" /> },
  high: { label: "High", color: "text-orange-500", bgColor: "bg-orange-500/15", icon: <Flag className="w-3 h-3" /> },
  urgent: { label: "Urgent", color: "text-red-500", bgColor: "bg-red-500/15", icon: <AlertTriangle className="w-3 h-3" /> },
}

type AnalysisTab = "plugins" | "channels" | "mixer" | "samples" | "patterns"

const CHANNEL_TYPE_ICONS: Record<string, React.ReactNode> = {
  sampler: <Volume2 className="w-3.5 h-3.5" />,
  generator: <Plug className="w-3.5 h-3.5" />,
  layer: <Layers className="w-3.5 h-3.5" />,
  audio_clip: <FileAudio className="w-3.5 h-3.5" />,
  unknown: <Music2 className="w-3.5 h-3.5" />,
}

const CHANNEL_TYPE_COLORS: Record<string, string> = {
  sampler: "text-yellow-500",
  generator: "text-blue-500",
  layer: "text-purple-500",
  audio_clip: "text-green-500",
  unknown: "text-gray-500",
}

// ── Props ──────────────────────────────────────────────────────────────────

interface SharedProjectDetailProps {
  share: CloudShare
  onBack: () => void
  onAccept?: () => void
  onDecline?: () => void
  onRefresh?: () => void
}

// ── Component ──────────────────────────────────────────────────────────────

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

  // Build version list
  const allVersions: SharedVersion[] = share.sharedVersions.length > 0
    ? share.sharedVersions
    : share.audioUrl
      ? [{ id: 'legacy', name: share.audioName || 'Audio', fileUrl: share.audioUrl, fileName: share.audioName || 'audio.wav', versionNumber: 1, isFavorite: false, annotations: [] }]
      : []

  // ── Audio player state ─────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const waveContainerRef = useRef<HTMLDivElement>(null)
  const drawRef = useRef<() => void>()
  const rafIdRef = useRef(0)

  const [selectedVersion, setSelectedVersion] = useState<SharedVersion | null>(allVersions[0] || null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isAudioReady, setIsAudioReady] = useState(false)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [peaks, setPeaks] = useState<number[]>([])

  // ── Annotation state ───────────────────────────────────────────────────
  const [annotations, setAnnotations] = useState<SharedAnnotation[]>(selectedVersion?.annotations || [])
  const [showAddAnnotation, setShowAddAnnotation] = useState(false)
  const [newAnnotationText, setNewAnnotationText] = useState("")
  const [newAnnotationColor, setNewAnnotationColor] = useState(ANNOTATION_COLORS[0].value)
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null)
  const [editAnnotationText, setEditAnnotationText] = useState("")
  const [isSavingAnnotation, setIsSavingAnnotation] = useState(false)

  // ── Status state ───────────────────────────────────────────────────────
  const [projectStatus, setProjectStatus] = useState(share.projectStatus || '')

  // ── Tasks state ────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<SharedTask[]>(
    (share.sharedTasks || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  )
  const [newTaskColumn, setNewTaskColumn] = useState<SharedTask['status'] | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [dragOverColumn, setDragOverColumn] = useState<SharedTask['status'] | null>(null)
  // Edit dialog state
  const [editingTask, setEditingTask] = useState<SharedTask | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPriority, setEditPriority] = useState('medium')
  const [editDueDate, setEditDueDate] = useState('')

  // ── Plugins checked state ──────────────────────────────────────────────
  const [checkedPlugins, setCheckedPlugins] = useState<Set<number>>(new Set())

  // ── Analysis tab state ─────────────────────────────────────────────────
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>("plugins")
  const [analysisSearch, setAnalysisSearch] = useState("")
  const [expandedAnalysisChannels, setExpandedAnalysisChannels] = useState<Set<number>>(new Set())

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // ── Real-time Supabase subscription ───────────────────────────────────
  useEffect(() => {
    const sb = getSupabase()
    if (!sb) return

    const channel = sb
      .channel(`share-${share.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'project_shares', filter: `id=eq.${share.id}` },
        (payload: any) => {
          const updated = payload.new
          if (updated.shared_tasks) {
            setTasks((updated.shared_tasks as SharedTask[]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
          }
          if (updated.project_status !== undefined) {
            setProjectStatus(updated.project_status || '')
          }
          // Update annotations for the currently selected version
          if (updated.shared_versions && selectedVersion) {
            const versions: SharedVersion[] = updated.shared_versions || []
            const v = versions.find((v: SharedVersion) => v.id === selectedVersion.id)
            if (v) setAnnotations(v.annotations || [])
          }
        }
      )
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [share.id, selectedVersion?.id])

  // Update annotations when version changes
  useEffect(() => {
    setAnnotations(selectedVersion?.annotations || [])
  }, [selectedVersion?.id])

  // ── Audio element lifecycle ────────────────────────────────────────────
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

  useEffect(() => {
    if (!selectedVersion || !audioRef.current) return
    setIsAudioReady(false); setIsPlaying(false); setCurrentTime(0); setDuration(0); setIsLoadingAudio(true); setPeaks([])
    audioRef.current.src = selectedVersion.fileUrl
    audioRef.current.load()
  }, [selectedVersion?.id])

  useEffect(() => {
    if (!selectedVersion?.fileUrl) return
    let cancelled = false
    ;(async () => {
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
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [selectedVersion?.fileUrl])

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume }, [volume])

  // ── Waveform drawing ───────────────────────────────────────────────────
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
    ctx.fillStyle = hexToRgba(accentColor, 0.25)
    for (let i = 0; i < peaks.length; i++) {
      if ((i + 0.5) / peaks.length > progress) {
        const x = i * barWidth + barGap / 2
        const h = Math.max(2, peaks[i] * rect.height * 0.9)
        ctx.fillRect(x, centerY - h / 2, actualBarWidth, h)
      }
    }
    ctx.fillStyle = hexToRgba(accentColor, 1)
    for (let i = 0; i < peaks.length; i++) {
      if ((i + 0.5) / peaks.length <= progress) {
        const x = i * barWidth + barGap / 2
        const h = Math.max(2, peaks[i] * rect.height * 0.9)
        ctx.fillRect(x, centerY - h / 2, actualBarWidth, h)
      }
    }
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

  const handlePlayPause = () => {
    if (!audioRef.current || !isAudioReady) return
    if (isPlaying) audioRef.current.pause()
    else audioRef.current.play()
  }

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration
  }, [duration])

  const handleSeekTo = (time: number) => {
    if (!audioRef.current || !isAudioReady) return
    audioRef.current.currentTime = time
    setCurrentTime(time)
  }

  // ── Annotation handlers ────────────────────────────────────────────────
  const handleAddAnnotation = async () => {
    if (!selectedVersion || !newAnnotationText.trim() || !user || !canEdit) return
    setIsSavingAnnotation(true)
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
      setIsSavingAnnotation(false)
    }
  }

  const handleUpdateAnnotation = async (annotationId: string) => {
    if (!selectedVersion || !editAnnotationText.trim() || !canEdit) return
    setIsSavingAnnotation(true)
    try {
      await updateSharedAnnotation(share.id, selectedVersion.id, annotationId, { text: editAnnotationText.trim() })
      setAnnotations(prev => prev.map(a => a.id === annotationId ? { ...a, text: editAnnotationText.trim() } : a))
      setEditingAnnotation(null)
      onRefresh?.()
    } catch (e: any) {
      console.error('[SharedDetail] Failed to update annotation:', e.message)
    } finally {
      setIsSavingAnnotation(false)
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

  // ── Status handler ─────────────────────────────────────────────────────
  const handleStatusChange = async (newStatus: string) => {
    if (!canEdit || newStatus === projectStatus) return
    const oldStatus = projectStatus
    setProjectStatus(newStatus)
    try {
      await updateShareProjectStatus(share.id, newStatus)
      onRefresh?.()
    } catch (e: any) {
      setProjectStatus(oldStatus)
    }
  }

  // ── Task handlers ──────────────────────────────────────────────────────
  const handleCreateTask = async (status: SharedTask['status']) => {
    if (!newTaskTitle.trim() || !canEdit) return
    const colTasks = tasks.filter(t => t.status === status)
    try {
      const task = await addSharedTask(share.id, {
        title: newTaskTitle.trim(),
        description: null,
        status,
        priority: 'medium',
        order: colTasks.length,
      })
      setTasks(prev => [...prev, task])
      setNewTaskTitle('')
      setNewTaskColumn(null)
      onRefresh?.()
    } catch (e: any) {
      console.error('[SharedDetail] Failed to add task:', e.message)
    }
  }

  const handleUpdateTask = async (id: string, updates: Partial<Pick<SharedTask, 'status' | 'title' | 'description' | 'priority' | 'dueDate'>>) => {
    if (!canEdit) return
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    try {
      await updateSharedTask(share.id, id, updates)
      onRefresh?.()
    } catch (e: any) {
      console.error('[SharedDetail] Failed to update task:', e.message)
    }
  }

  const handleDrop = useCallback(async (e: React.DragEvent, targetStatus: SharedTask['status']) => {
    e.preventDefault()
    setDragOverColumn(null)
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"))
      if (data.type === "shared-task") {
        await handleUpdateTask(data.id, { status: targetStatus })
      }
    } catch {}
  }, [tasks])

  const handleDeleteTask = async (taskId: string) => {
    if (!canEdit) return
    setTasks(prev => prev.filter(t => t.id !== taskId))
    try {
      await deleteSharedTask(share.id, taskId)
      onRefresh?.()
    } catch (e: any) {
      console.error('[SharedDetail] Failed to delete task:', e.message)
    }
  }

  const openEditDialog = (task: SharedTask) => {
    setEditingTask(task)
    setEditTitle(task.title)
    setEditDescription(task.description || '')
    setEditPriority(task.priority || 'medium')
    setEditDueDate(task.dueDate || '')
  }

  const handleEditSave = async () => {
    if (!editingTask) return
    await handleUpdateTask(editingTask.id, {
      title: editTitle,
      description: editDescription || null,
      priority: editPriority as SharedTask['priority'],
      dueDate: editDueDate || null,
    })
    setEditingTask(null)
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  const formatDate = (d: string | null) => {
    if (!d) return null
    try { return new Date(d).toLocaleDateString() } catch { return null }
  }

  const formatMinutes = (m: number | null) => {
    if (!m || m <= 0) return null
    const hours = Math.floor(m / 60)
    const mins = Math.round(m % 60)
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  const doneTasks = tasks.filter(t => t.status === 'done').length

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="border-b border-border/30 bg-card/50 flex-shrink-0">
        <div className="p-5">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="mt-1 flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>

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

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">{share.projectTitle}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                {share.projectBpm && share.projectBpm > 0 && <span>{share.projectBpm} BPM</span>}
                {share.projectKey && share.projectKey !== "None" && <span>• {share.projectKey}</span>}
                {share.projectArtists && <span>• {share.projectArtists}</span>}
                {share.projectGenre && <span>• {share.projectGenre}</span>}
              </div>
              {share.projectTags && share.projectTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {share.projectTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs border-0 bg-primary/10 text-primary">{tag}</Badge>
                  ))}
                </div>
              )}
              {/* Status pipeline */}
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

            <div className="flex-shrink-0 flex flex-col items-end gap-2">
              <Badge variant="secondary" className={cn("text-xs border-0",
                share.status === 'accepted' && "bg-green-500/10 text-green-500",
                share.status === 'pending' && "bg-yellow-500/10 text-yellow-500",
                share.status === 'declined' && "bg-red-500/10 text-red-500"
              )}>
                {share.status}
              </Badge>
              <Badge variant="outline" className={cn("text-[10px]", canEdit ? "border-green-500/30 text-green-500" : "border-muted-foreground/30")}>
                {canEdit ? <><Edit2 className="w-2.5 h-2.5 mr-1" />Can Edit</> : <><Eye className="w-2.5 h-2.5 mr-1" />View Only</>}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="audio" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-4 pb-0 border-b border-border/30 bg-card/30 flex-shrink-0">
          <TabsList className="h-9 bg-transparent p-0 gap-1">
            <TabsTrigger value="audio" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary gap-1.5 text-xs px-3">
              <FileAudio className="w-3.5 h-3.5" />
              Audio
              {allVersions.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">{allVersions.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="tasks" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary gap-1.5 text-xs px-3">
              <ListTodo className="w-3.5 h-3.5" />
              Tasks
              {tasks.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">{doneTasks}/{tasks.length}</Badge>
              )}
            </TabsTrigger>
            {share.sharedPlugins && share.sharedPlugins.length > 0 && (
              <TabsTrigger value="plugins" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary gap-1.5 text-xs px-3">
                <Plug className="w-3.5 h-3.5" />
                Plugins
                <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">{share.sharedPlugins.length}</Badge>
              </TabsTrigger>
            )}
            {share.sharedAnalysis && (
              <TabsTrigger value="analysis" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary gap-1.5 text-xs px-3">
                <Puzzle className="w-3.5 h-3.5" />
                Analysis
              </TabsTrigger>
            )}
            <TabsTrigger value="info" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary gap-1.5 text-xs px-3">
              <Info className="w-3.5 h-3.5" />
              Info
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Audio Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="audio" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">

              {/* Sender card */}
              <div className="p-4 rounded-xl border border-border/30 bg-card/50">
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
              </div>

              {/* Audio player */}
              {allVersions.length > 0 ? (
                <div className="p-4 rounded-xl border border-border/30 bg-card/50">
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
                </div>
              ) : (
                <div className="p-8 rounded-xl border border-border/30 bg-card/50 text-center">
                  <FileAudio className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No audio files shared</p>
                </div>
              )}

              {/* Annotations */}
              {selectedVersion && (annotations.length > 0 || canEdit) && (
                <div className="p-4 rounded-xl border border-border/30 bg-card/50">
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

                  {canEdit && showAddAnnotation && (
                    <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">at {formatTime(currentTime)}</span>
                        <div className="flex gap-1 ml-auto">
                          {ANNOTATION_COLORS.map(c => (
                            <button
                              key={c.value}
                              type="button"
                              title={c.name}
                              onClick={() => setNewAnnotationColor(c.value)}
                              className={cn("w-4 h-4 rounded-full border-2 transition-all", newAnnotationColor === c.value ? "border-foreground scale-125" : "border-transparent")}
                              style={{ backgroundColor: c.value }}
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
                        <Button size="sm" onClick={handleAddAnnotation} disabled={!newAnnotationText.trim() || isSavingAnnotation} className="h-8 gap-1">
                          {isSavingAnnotation ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setShowAddAnnotation(false); setNewAnnotationText("") }} className="h-8">
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}

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
                        >
                          <div className="w-1 h-full min-h-[24px] rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: ann.color }} />
                          <span className="text-[10px] font-mono text-primary flex-shrink-0 mt-0.5">{formatTime(ann.timestamp)}</span>
                          <div className="flex-1 min-w-0">
                            {editingAnnotation === ann.id ? (
                              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                <Input value={editAnnotationText} onChange={(e) => setEditAnnotationText(e.target.value)} className="text-xs h-6" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleUpdateAnnotation(ann.id)} />
                                <Button size="sm" variant="ghost" onClick={() => handleUpdateAnnotation(ann.id)} className="h-6 w-6 p-0"><Check className="w-3 h-3" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingAnnotation(null)} className="h-6 w-6 p-0"><X className="w-3 h-3" /></Button>
                              </div>
                            ) : (
                              <p className="text-xs">{ann.text}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-0.5">{ann.createdByName}</p>
                          </div>
                          {canEdit && editingAnnotation !== ann.id && (
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditingAnnotation(ann.id); setEditAnnotationText(ann.text) }} className="h-6 w-6 p-0"><Edit2 className="w-2.5 h-2.5" /></Button>
                              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDeleteAnnotation(ann.id) }} className="h-6 w-6 p-0 text-destructive hover:text-destructive"><Trash2 className="w-2.5 h-2.5" /></Button>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {annotations.length === 0 && !showAddAnnotation && (
                      <p className="text-xs text-muted-foreground text-center py-4">No annotations yet{canEdit ? " — click Add to leave a comment" : ""}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Accept / Decline */}
              {share.status === 'pending' && (onAccept || onDecline) && (
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
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
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ── Tasks Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="tasks" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Tasks</span>
                  <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
                </div>
                {!canEdit && (
                  <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground">
                    <Eye className="w-2.5 h-2.5 mr-1" /> View only
                  </Badge>
                )}
              </div>

              {/* Kanban columns — identical layout to ProjectKanban */}
              <div className="grid grid-cols-3 gap-3">
                {KANBAN_COLUMNS.map(col => {
                  const colTasks = tasks
                    .filter(t => t.status === col.id)
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

                  return (
                    <div
                      key={col.id}
                      className={cn(
                        "flex flex-col rounded-xl border min-h-[200px] transition-all",
                        dragOverColumn === col.id && "ring-2 ring-primary/50 bg-primary/5"
                      )}
                      onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.id) }}
                      onDragLeave={() => setDragOverColumn(null)}
                      onDrop={(e) => handleDrop(e, col.id)}
                    >
                      {/* Column header */}
                      <div className={cn("flex items-center gap-2 p-3 rounded-t-xl", col.bgColor)}>
                        <span className={col.color}>{col.icon}</span>
                        <span className="text-sm font-medium">{col.title}</span>
                        <Badge variant="secondary" className="text-[10px] ml-auto">{colTasks.length}</Badge>
                      </div>

                      {/* Cards */}
                      <ScrollArea className="flex-1 p-2">
                        <div className="flex flex-col gap-2">
                          {colTasks.map(task => {
                            const priority = (task.priority || 'medium') as keyof typeof PRIORITY_CONFIG
                            const pc = PRIORITY_CONFIG[priority]
                            return (
                              <ContextMenu key={task.id}>
                                <ContextMenuTrigger>
                                  <div
                                    draggable={canEdit}
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData("text/plain", JSON.stringify({ type: "shared-task", id: task.id }))
                                    }}
                                    className={cn(
                                      "group p-3 rounded-lg border bg-card hover:bg-accent/30 transition-all",
                                      canEdit && "cursor-grab active:cursor-grabbing"
                                    )}
                                  >
                                    {/* Title + menu */}
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                      <span className="text-sm font-medium leading-tight flex-1">{task.title}</span>
                                      {canEdit && (
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <MoreHorizontal className="w-3.5 h-3.5" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => openEditDialog(task)}>
                                              <Edit3 className="w-3.5 h-3.5 mr-2" /> Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            {task.status !== 'todo' && (
                                              <DropdownMenuItem onClick={() => handleUpdateTask(task.id, { status: 'todo' })}>
                                                <Circle className="w-3.5 h-3.5 mr-2" /> Move to To Do
                                              </DropdownMenuItem>
                                            )}
                                            {task.status !== 'in-progress' && (
                                              <DropdownMenuItem onClick={() => handleUpdateTask(task.id, { status: 'in-progress' })}>
                                                <Loader2 className="w-3.5 h-3.5 mr-2" /> Move to In Progress
                                              </DropdownMenuItem>
                                            )}
                                            {task.status !== 'done' && (
                                              <DropdownMenuItem onClick={() => handleUpdateTask(task.id, { status: 'done' })}>
                                                <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Move to Done
                                              </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteTask(task.id)}>
                                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      )}
                                    </div>
                                    {/* Description */}
                                    {task.description && (
                                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
                                    )}
                                    {/* Footer: priority */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={cn("flex items-center gap-1 text-[10px]", pc.color, pc.bgColor, "px-1.5 py-0.5 rounded-full")}>
                                        {pc.icon}
                                        {pc.label}
                                      </span>
                                      {task.dueDate && (
                                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                          <Clock className="w-2.5 h-2.5" />
                                          {new Date(task.dueDate).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </ContextMenuTrigger>
                                {canEdit && (
                                  <ContextMenuContent>
                                    <ContextMenuItem onClick={() => openEditDialog(task)}>
                                      <Edit3 className="w-3.5 h-3.5 mr-2" /> Edit Task
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />
                                    {task.status !== 'todo' && (
                                      <ContextMenuItem onClick={() => handleUpdateTask(task.id, { status: 'todo' })}>
                                        <Circle className="w-3.5 h-3.5 mr-2" /> Move to To Do
                                      </ContextMenuItem>
                                    )}
                                    {task.status !== 'in-progress' && (
                                      <ContextMenuItem onClick={() => handleUpdateTask(task.id, { status: 'in-progress' })}>
                                        <Loader2 className="w-3.5 h-3.5 mr-2" /> Move to In Progress
                                      </ContextMenuItem>
                                    )}
                                    {task.status !== 'done' && (
                                      <ContextMenuItem onClick={() => handleUpdateTask(task.id, { status: 'done' })}>
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Move to Done
                                      </ContextMenuItem>
                                    )}
                                    <ContextMenuSeparator />
                                    <ContextMenuItem className="text-destructive" onClick={() => handleDeleteTask(task.id)}>
                                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                )}
                              </ContextMenu>
                            )
                          })}
                        </div>
                      </ScrollArea>

                      {/* Add task — bottom of column, same as ProjectKanban */}
                      {canEdit && (
                        <div className="p-2 border-t">
                          {newTaskColumn === col.id ? (
                            <div className="flex flex-col gap-2">
                              <Input
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                placeholder="Task title..."
                                className="h-8 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCreateTask(col.id)
                                  if (e.key === 'Escape') { setNewTaskColumn(null); setNewTaskTitle('') }
                                }}
                              />
                              <div className="flex items-center gap-1">
                                <Button size="sm" className="h-7 text-xs" onClick={() => handleCreateTask(col.id)}>Add</Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setNewTaskColumn(null); setNewTaskTitle('') }}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full h-8 text-xs text-muted-foreground"
                              onClick={() => { setNewTaskColumn(col.id); setNewTaskTitle('') }}
                            >
                              <Plus className="w-3.5 h-3.5 mr-1" /> Add Task
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </ScrollArea>

          {/* Edit Dialog — identical to ProjectKanban */}
          <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Task</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 pt-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">Title</label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Task title" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Description</label>
                  <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Optional description..." rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Priority</label>
                    <Select value={editPriority} onValueChange={setEditPriority}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Due Date</label>
                    <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="h-9" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setEditingTask(null)}>Cancel</Button>
                  <Button onClick={handleEditSave}>Save Changes</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── Plugins Tab ───────────────────────────────────────────────── */}
        {share.sharedPlugins && share.sharedPlugins.length > 0 && (
          <TabsContent value="plugins" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="p-6">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold flex items-center gap-2 mb-1">
                    <Plug className="w-4 h-4 text-primary" />
                    Plugin Checklist
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Check off the plugins you have installed. {checkedPlugins.size}/{share.sharedPlugins.length} ready.
                  </p>
                  {checkedPlugins.size > 0 && (
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all duration-500"
                        style={{ width: `${(checkedPlugins.size / share.sharedPlugins.length) * 100}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {/* Instruments */}
                  {share.sharedPlugins.filter(p => p.isInstrument || p.isSampler).length > 0 && (
                    <>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-4 mb-2">Instruments & Samplers</p>
                      {share.sharedPlugins
                        .map((p, i) => ({ p, i }))
                        .filter(({ p }) => p.isInstrument || p.isSampler)
                        .map(({ p, i }) => (
                          <button
                            key={i}
                            onClick={() => setCheckedPlugins(prev => {
                              const next = new Set(prev)
                              next.has(i) ? next.delete(i) : next.add(i)
                              return next
                            })}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                              checkedPlugins.has(i)
                                ? "border-green-500/30 bg-green-500/5"
                                : "border-border/30 bg-card/50 hover:bg-muted/30"
                            )}
                          >
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                              checkedPlugins.has(i) ? "bg-green-500/20" : "bg-primary/10"
                            )}>
                              {checkedPlugins.has(i)
                                ? <CheckCircle className="w-4 h-4 text-green-500" />
                                : <Music className="w-4 h-4 text-primary" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-medium truncate", checkedPlugins.has(i) && "line-through text-muted-foreground")}>{p.name}</p>
                              {p.presetName && <p className="text-[10px] text-muted-foreground truncate">Preset: {p.presetName}</p>}
                              {p.dllName && p.dllName !== p.name && <p className="text-[10px] text-muted-foreground/60 truncate">{p.dllName}</p>}
                            </div>
                            <Badge variant="secondary" className={cn("text-[9px] px-1.5 py-0 flex-shrink-0", checkedPlugins.has(i) && "bg-green-500/10 text-green-500")}>
                              {p.isSampler ? 'Sampler' : 'Instrument'}
                            </Badge>
                          </button>
                        ))}
                    </>
                  )}

                  {/* Effects */}
                  {share.sharedPlugins.filter(p => !p.isInstrument && !p.isSampler).length > 0 && (
                    <>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-4 mb-2">Effects</p>
                      {share.sharedPlugins
                        .map((p, i) => ({ p, i }))
                        .filter(({ p }) => !p.isInstrument && !p.isSampler)
                        .map(({ p, i }) => (
                          <button
                            key={i}
                            onClick={() => setCheckedPlugins(prev => {
                              const next = new Set(prev)
                              next.has(i) ? next.delete(i) : next.add(i)
                              return next
                            })}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                              checkedPlugins.has(i)
                                ? "border-green-500/30 bg-green-500/5"
                                : "border-border/30 bg-card/50 hover:bg-muted/30"
                            )}
                          >
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                              checkedPlugins.has(i) ? "bg-green-500/20" : "bg-primary/10"
                            )}>
                              {checkedPlugins.has(i)
                                ? <CheckCircle className="w-4 h-4 text-green-500" />
                                : <Sliders className="w-4 h-4 text-primary" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-medium truncate", checkedPlugins.has(i) && "line-through text-muted-foreground")}>{p.name}</p>
                              {p.dllName && p.dllName !== p.name && <p className="text-[10px] text-muted-foreground/60 truncate">{p.dllName}</p>}
                            </div>
                            <Badge variant="secondary" className={cn("text-[9px] px-1.5 py-0 flex-shrink-0", checkedPlugins.has(i) && "bg-green-500/10 text-green-500")}>
                              Effect
                            </Badge>
                          </button>
                        ))}
                    </>
                  )}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        )}

        {/* ── Analysis Tab ──────────────────────────────────────────────── */}
        {share.sharedAnalysis && (
          <TabsContent value="analysis" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="p-6 flex flex-col gap-4">
                {(() => {
                  const analysis = share.sharedAnalysis!
                  const plugins = analysis.plugins ?? []
                  const channels = analysis.channels ?? []
                  const mixerTracks = analysis.mixerTracks ?? []
                  const samples = analysis.samples ?? []
                  const patterns = analysis.patterns ?? []
                  const channelsWithMixerRouting = channels.filter(c => c.mixerTrack !== null && c.mixerTrack !== undefined).length

                  const analysisTabs: { id: AnalysisTab; label: string; icon: React.ReactNode; count: number }[] = [
                    { id: "plugins", label: "Plugins", icon: <Plug className="w-4 h-4" />, count: plugins.length },
                    { id: "channels", label: "Channels", icon: <SlidersHorizontal className="w-4 h-4" />, count: channels.length },
                    { id: "mixer", label: "Mixer", icon: <Headphones className="w-4 h-4" />, count: mixerTracks.length || channelsWithMixerRouting },
                    { id: "samples", label: "Samples", icon: <FileAudio className="w-4 h-4" />, count: samples.length },
                    { id: "patterns", label: "Patterns", icon: <Grid3X3 className="w-4 h-4" />, count: patterns.length },
                  ]

                  const q = analysisSearch.toLowerCase()
                  const filteredPlugins = plugins.filter(p =>
                    p.name.toLowerCase().includes(q) || (p.channelName?.toLowerCase().includes(q))
                  )
                  const filteredChannels = channels.filter(c =>
                    (c.name?.toLowerCase().includes(q)) || (c.pluginName?.toLowerCase().includes(q))
                  )
                  const filteredSamples = samples.filter(s => s.toLowerCase().includes(q))

                  return (
                    <>
                      {/* Header */}
                      <div className="flex items-center gap-2">
                        <Puzzle className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Project Analysis</span>
                        {analysis.flVersion && (
                          <Badge variant="secondary" className="text-xs">FL Studio {analysis.flVersion}</Badge>
                        )}
                      </div>

                      {/* Quick stats */}
                      <div className="grid grid-cols-5 gap-2">
                        {analysisTabs.map(tab => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setAnalysisTab(tab.id)}
                            className={cn(
                              "flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-xs",
                              "hover:bg-accent/50 border border-transparent",
                              analysisTab === tab.id && "bg-accent border-border shadow-sm"
                            )}
                          >
                            <span className={cn("text-muted-foreground", analysisTab === tab.id && "text-primary")}>{tab.icon}</span>
                            <span className="font-medium">{tab.count}</span>
                            <span className="text-muted-foreground">{tab.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          value={analysisSearch}
                          onChange={(e) => setAnalysisSearch(e.target.value)}
                          placeholder={`Search ${analysisTab}...`}
                          className="pl-8 h-8 text-sm"
                        />
                        {analysisSearch && (
                          <button
                            type="button"
                            onClick={() => setAnalysisSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <Separator />

                      {/* Tab content */}
                      <AnimatePresence mode="wait">
                        {analysisTab === "plugins" && (
                          <motion.div key="plugins" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-1.5">
                            {filteredPlugins.length === 0 ? (
                              <div className="text-sm text-muted-foreground text-center py-8">
                                {analysisSearch ? "No plugins match your search" : "No plugins detected"}
                              </div>
                            ) : filteredPlugins.map((plugin, i) => (
                              <ContextMenu key={i}>
                                <ContextMenuTrigger>
                                  <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-accent/50 transition-colors group">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                                        plugin.dllName === "Sampler" ? "bg-green-500/15 text-green-500"
                                          : plugin.isInstrument ? "bg-blue-500/15 text-blue-500"
                                          : "bg-orange-500/15 text-orange-500"
                                      )}>
                                        {plugin.dllName === "Sampler" ? <Volume2 className="w-4 h-4" /> : <Plug className="w-4 h-4" />}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-sm font-medium truncate">{plugin.name}</div>
                                        <div className="text-xs text-muted-foreground truncate">
                                          {plugin.channelName && plugin.dllName !== "Sampler" && <span>{plugin.channelName}</span>}
                                          {plugin.dllName && plugin.dllName !== "Sampler" && <span className="ml-1 opacity-60">({plugin.dllName})</span>}
                                        </div>
                                      </div>
                                    </div>
                                    <Badge variant="secondary" className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                                      {plugin.dllName === "Sampler" ? "Sampler" : plugin.isInstrument ? "Instrument" : "Effect"}
                                    </Badge>
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent>
                                  <ContextMenuItem onClick={() => navigator.clipboard.writeText(plugin.name)}>
                                    <Copy className="w-3.5 h-3.5 mr-2" /> Copy Plugin Name
                                  </ContextMenuItem>
                                  {plugin.dllName && (
                                    <ContextMenuItem onClick={() => navigator.clipboard.writeText(plugin.dllName!)}>
                                      <Copy className="w-3.5 h-3.5 mr-2" /> Copy DLL Name
                                    </ContextMenuItem>
                                  )}
                                </ContextMenuContent>
                              </ContextMenu>
                            ))}
                          </motion.div>
                        )}

                        {analysisTab === "channels" && (
                          <motion.div key="channels" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-1">
                            {filteredChannels.length === 0 ? (
                              <div className="text-sm text-muted-foreground text-center py-8">
                                {analysisSearch ? "No channels match your search" : "No channels detected"}
                              </div>
                            ) : filteredChannels.map((channel, i) => (
                              <ContextMenu key={i}>
                                <ContextMenuTrigger>
                                  <div
                                    className="rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                                    onClick={() => setExpandedAnalysisChannels(prev => {
                                      const next = new Set(prev)
                                      next.has(channel.index) ? next.delete(channel.index) : next.add(channel.index)
                                      return next
                                    })}
                                  >
                                    <div className="flex items-center gap-3 p-2.5">
                                      <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: channel.color || '#6366f1' }} />
                                      <div className={cn("flex-shrink-0", CHANNEL_TYPE_COLORS[channel.channelType] || "text-gray-500")}>
                                        {CHANNEL_TYPE_ICONS[channel.channelType] || CHANNEL_TYPE_ICONS.unknown}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">{channel.name || `Channel ${channel.index + 1}`}</div>
                                        <div className="text-xs text-muted-foreground truncate">
                                          {channel.channelType}{channel.pluginName && ` • ${channel.pluginName}`}
                                        </div>
                                      </div>
                                      {(channel.pluginName || channel.samplePath) && (
                                        expandedAnalysisChannels.has(channel.index)
                                          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                                      )}
                                    </div>
                                    <AnimatePresence>
                                      {expandedAnalysisChannels.has(channel.index) && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                          className="overflow-hidden"
                                        >
                                          <div className="px-2.5 pb-2.5 ml-8 flex flex-col gap-1 text-xs text-muted-foreground">
                                            {channel.pluginName && (
                                              <div className="flex items-center gap-2"><Plug className="w-3 h-3" /><span className="truncate">{channel.pluginName}</span></div>
                                            )}
                                            {channel.samplePath && (
                                              <div className="flex items-center gap-2"><FileAudio className="w-3 h-3" /><span className="truncate font-mono text-[11px]">{channel.samplePath}</span></div>
                                            )}
                                            {channel.mixerTrack !== null && channel.mixerTrack !== undefined && (
                                              <div className="flex items-center gap-2"><Headphones className="w-3 h-3" /><span>Mixer Track {channel.mixerTrack}</span></div>
                                            )}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent>
                                  {channel.name && <ContextMenuItem onClick={() => navigator.clipboard.writeText(channel.name!)}><Copy className="w-3.5 h-3.5 mr-2" />Copy Channel Name</ContextMenuItem>}
                                  {channel.pluginName && <ContextMenuItem onClick={() => navigator.clipboard.writeText(channel.pluginName!)}><Copy className="w-3.5 h-3.5 mr-2" />Copy Plugin Name</ContextMenuItem>}
                                  {channel.samplePath && <ContextMenuItem onClick={() => navigator.clipboard.writeText(channel.samplePath!)}><Copy className="w-3.5 h-3.5 mr-2" />Copy Sample Path</ContextMenuItem>}
                                </ContextMenuContent>
                              </ContextMenu>
                            ))}
                          </motion.div>
                        )}

                        {analysisTab === "mixer" && (
                          <motion.div key="mixer" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-1.5">
                            {mixerTracks.length === 0 ? (
                              <div className="flex flex-col items-center text-sm text-muted-foreground text-center py-8 gap-2">
                                <Headphones className="w-5 h-5 opacity-40" />
                                <span>No mixer inserts with content</span>
                                <span className="text-xs opacity-60">Only inserts with names or effect plugins appear here.</span>
                              </div>
                            ) : mixerTracks.map((track, i) => (
                              <ContextMenu key={i}>
                                <ContextMenuTrigger>
                                  <div className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors">
                                    <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 text-xs font-mono font-bold text-muted-foreground mt-0.5">
                                      {track.index}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium truncate">{track.name || `Insert ${track.index}`}</div>
                                      {track.plugins && track.plugins.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {track.plugins.map((plugin, j) => (
                                            <span key={j} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-accent/60 text-muted-foreground">
                                              <Plug className="w-2.5 h-2.5" />{plugin}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent>
                                  {track.name && <ContextMenuItem onClick={() => navigator.clipboard.writeText(track.name!)}><Copy className="w-3.5 h-3.5 mr-2" />Copy Track Name</ContextMenuItem>}
                                </ContextMenuContent>
                              </ContextMenu>
                            ))}
                          </motion.div>
                        )}

                        {analysisTab === "samples" && (
                          <motion.div key="samples" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-1.5">
                            {filteredSamples.length === 0 ? (
                              <div className="text-sm text-muted-foreground text-center py-8">
                                {analysisSearch ? "No samples match your search" : "No sample files detected"}
                              </div>
                            ) : filteredSamples.map((sample, i) => {
                              const filename = sample.split(/[/\\]/).pop() || sample
                              const folder = sample.substring(0, sample.length - filename.length - 1)
                              return (
                                <ContextMenu key={i}>
                                  <ContextMenuTrigger>
                                    <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors group">
                                      <FileAudio className="w-4 h-4 text-green-500 flex-shrink-0" />
                                      <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium truncate">{filename}</div>
                                        <div className="text-xs text-muted-foreground truncate font-mono">{folder}</div>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        title="Copy path"
                                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => navigator.clipboard.writeText(sample)}
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent>
                                    <ContextMenuItem onClick={() => navigator.clipboard.writeText(sample)}><Copy className="w-3.5 h-3.5 mr-2" />Copy Full Path</ContextMenuItem>
                                    <ContextMenuItem onClick={() => navigator.clipboard.writeText(filename)}><Copy className="w-3.5 h-3.5 mr-2" />Copy Filename</ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              )
                            })}
                          </motion.div>
                        )}

                        {analysisTab === "patterns" && (
                          <motion.div key="patterns" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-1.5">
                            {patterns.length === 0 ? (
                              <div className="text-sm text-muted-foreground text-center py-8">No patterns detected</div>
                            ) : patterns.map((pattern, i) => (
                              <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                                <div className="w-6 h-6 rounded flex items-center justify-center bg-accent text-xs font-mono text-muted-foreground">
                                  {pattern.index + 1}
                                </div>
                                <span className="text-sm">{pattern.name || `Pattern ${pattern.index + 1}`}</span>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )
                })()}
              </div>
            </ScrollArea>
          </TabsContent>
        )}

        {/* ── Info Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="info" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">

              {/* Project file download */}
              {share.projectFileUrl && (
                <div className="p-4 rounded-xl border border-border/30 bg-card/50">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Download className="w-3.5 h-3.5" /> Project File
                  </h3>
                  <a
                    href={share.projectFileUrl}
                    download={share.projectFileName || 'project'}
                    className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Download className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{share.projectFileName || 'Download project'}</p>
                      <p className="text-xs text-muted-foreground">Click to download</p>
                    </div>
                  </a>
                </div>
              )}

              {/* Metadata grid */}
              <div className="p-4 rounded-xl border border-border/30 bg-card/50">
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
              </div>

              {/* Shared by */}
              <div className="p-4 rounded-xl border border-border/30 bg-card/50">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Shared by</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{senderInitial}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{senderName}</p>
                    {sender?.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{sender.email}</p>}
                  </div>
                  <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(share.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Accept / Decline */}
              {share.status === 'pending' && (onAccept || onDecline) && (
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
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
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Meta item ──────────────────────────────────────────────────────────────

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
