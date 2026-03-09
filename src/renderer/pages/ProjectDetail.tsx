import React, { useState, useEffect, useRef, useCallback } from "react"
  import { motion, AnimatePresence } from "framer-motion"
  import { useTheme } from "@/components/ThemeProvider"
  import {
    ArrowLeft,
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
    Plus,
    Edit2,
    Trash2,
    Save,
    X,
    Music,
    FileAudio,
    MessageSquare,
    Folder,
    FolderOpen,
    Sparkles,
    ChevronDown,
    ChevronUp,
    Image,
    Loader2,
    Star,
    Lightbulb,
    Headphones,
    Disc3,
    CheckCircle2,
    PartyPopper,
    Archive,
    Share2,
    ListTodo,
    BarChart3,
    Plug,
    Link2,
    ExternalLink,
    Globe,
    Upload,
  } from "lucide-react"
  import { cn, assetUrl } from "@/lib/utils"
  import { open as openExternalUrl } from "@tauri-apps/plugin-shell"
  import { useImageUrl } from "@/hooks/useImageUrl"
  import {
    Button,
    Input,
    Badge,
    Slider,
    Textarea,
    ScrollArea,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TooltipProvider,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Separator,
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
  } from "@/components/ui"
  import { Waveform } from "@/components/Waveform"
  import PluginStatus, { PluginStatusIcon } from "@/components/PluginStatus"
  import { ProjectAnalysis } from "@/components/ProjectAnalysis"
  import { ProjectKanban } from "@/components/ProjectKanban"
  import { CollaborationPanel } from "@/components/CollaborationPanel"
  import { useAuth } from "@/contexts/AuthContext"
  import { syncVersionToShares } from "@/lib/sharingService"
  import { Project, ProjectStatus, AudioVersion, Annotation, AudioPlayerState, Tag, PluginSession, Task, DistributionLink } from "@shared/types"

  // Helper to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  interface ProjectDetailProps {
    project: Project
    onBack: () => void
    onPlay: (project: Project) => Promise<void>
    onOpenDaw: (project: Project) => void
    onRefresh: () => void
    playerState: AudioPlayerState
    setPlayerState: React.Dispatch<React.SetStateAction<AudioPlayerState>>
    tags: Tag[]
    onCreateTag: (name: string, color?: string) => Promise<Tag | null>
    onOpenArtworkManager?: (project: Project) => void
    // Plugin integration
    pluginSessions?: PluginSession[]
    projects?: Project[]
    onLinkPlugin?: (sessionId: string, projectId: string) => Promise<void>
    onUnlinkPlugin?: (sessionId: string) => Promise<void>
    onStartPluginRecording?: (sessionId: string) => Promise<void>
    onStopPluginRecording?: (sessionId: string) => Promise<void>
    onToggleOfflineCapture?: (sessionId: string, enabled: boolean) => void
  }

  const ANNOTATION_COLORS = [
    { name: "Purple", value: "#8b5cf6" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Cyan", value: "#06b6d4" },
    { name: "Green", value: "#22c55e" },
    { name: "Yellow", value: "#eab308" },
    { name: "Orange", value: "#f97316" },
    { name: "Red", value: "#ef4444" },
    { name: "Pink", value: "#ec4899" },
  ]

  const MUSICAL_KEY_ROOTS = [
    "None", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
  ]

  const MUSICAL_KEY_MODES = [
    "Major", "Minor", "Mixolydian", "Dorian", "Phrygian", "Lydian", "Locrian",
    "Aeolian", "Ionian", "Pentatonic Major", "Pentatonic Minor", "Blues"
  ]

  const STATUS_CONFIG: Record<string, { title: string; icon: React.ReactNode; color: string; bgColor: string; hex: string }> = {
    'idea': { title: 'Idea', icon: <Lightbulb className="w-3.5 h-3.5" />, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-500/15 dark:bg-purple-500/10', hex: '#a855f7' },
    'in-progress': { title: 'In Progress', icon: <Music className="w-3.5 h-3.5" />, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500/15 dark:bg-blue-500/10', hex: '#3b82f6' },
    'mixing': { title: 'Mixing', icon: <Headphones className="w-3.5 h-3.5" />, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-500/15 dark:bg-orange-500/10', hex: '#f97316' },
    'mastering': { title: 'Mastering', icon: <Disc3 className="w-3.5 h-3.5" />, color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-500/15 dark:bg-cyan-500/10', hex: '#06b6d4' },
    'completed': { title: 'Completed', icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-500/15 dark:bg-green-500/10', hex: '#22c55e' },
    'released': { title: 'Released', icon: <PartyPopper className="w-3.5 h-3.5" />, color: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-500/15 dark:bg-pink-500/10', hex: '#ec4899' },
    'archived': { title: 'Archived', icon: <Archive className="w-3.5 h-3.5" />, color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-500/15 dark:bg-gray-500/10', hex: '#9ca3af' },
  }

  // Ordered pipeline stages for the status stepper
  const STATUS_PIPELINE = ['idea', 'in-progress', 'mixing', 'mastering', 'completed', 'released'] as const
  const STATUS_ARCHIVED = 'archived'

  const DISTRIBUTION_PLATFORMS: { key: string; name: string; color: string }[] = [
    { key: "soundcloud",  name: "SoundCloud",   color: "#ff5500" },
    { key: "beatstars",   name: "Beatstars",    color: "#5865f2" },
    { key: "youtube",     name: "YouTube",      color: "#ff0000" },
    { key: "spotify",     name: "Spotify",      color: "#1db954" },
    { key: "apple_music", name: "Apple Music",  color: "#fc3c44" },
    { key: "tiktok",      name: "TikTok",       color: "#69c9d0" },
    { key: "instagram",   name: "Instagram",    color: "#e1306c" },
    { key: "twitter",     name: "X / Twitter",  color: "#1d9bf0" },
    { key: "audiomack",   name: "Audiomack",    color: "#ff8c00" },
    { key: "bandcamp",    name: "Bandcamp",     color: "#1da0c3" },
    { key: "other",       name: "Other",        color: "#6366f1" },
  ]

  const AUDIO_EXTENSIONS = ['wav', 'mp3', 'flac', 'ogg', 'aiff', 'aif', 'm4a', 'opus', 'wma']

  const isElectron = () => typeof window !== 'undefined' && typeof window.electron !== 'undefined'

  const normalizeDroppedPath = (rawPath: string): string | null => {
    const value = rawPath.trim()
    if (!value) return null

    if (value.startsWith('file://')) {
      try {
        // `text/uri-list` drops can include file:// URIs. Convert those to native paths.
        const url = new URL(value)
        if (url.protocol !== 'file:') return null
        let pathname = decodeURIComponent(url.pathname || '')
        // Windows URI form can be /C:/path..., so strip the first slash.
        if (/^\/[A-Za-z]:\//.test(pathname)) pathname = pathname.slice(1)
        return pathname.replace(/\//g, '\\\\')
      } catch {
        return null
      }
    }

    return value
  }

  const parseDroppedTextPaths = (text: string): string[] => {
    return text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'))
      .map(line => normalizeDroppedPath(line))
      .filter((path): path is string => !!path)
  }

  export const ProjectDetail: React.FC<ProjectDetailProps> = ({
    project,
    onBack,
    onPlay,
    onOpenDaw,
    onRefresh,
    playerState,
    setPlayerState,
    tags,
    onCreateTag,
    onOpenArtworkManager,
    pluginSessions = [],
    projects = [],
    onLinkPlugin,
    onUnlinkPlugin,
    onStartPluginRecording,
    onStopPluginRecording,
    onToggleOfflineCapture,
  }) => {


    // Helper to get tag color from tags list
    const getTagColor = (tagName: string) => {
      const tag = tags.find(t => t.name === tagName)
      return tag?.color || '#6366f1'
    }

    // Get theme accent color (must be before any conditional returns)
    const { accentColor } = useTheme()

    // Auth context for auto-syncing versions to shared projects
    const { isAuthenticated, user, profile } = useAuth()

    // Early return if project is not available
    if (!project) {
      console.log('ProjectDetail: No project provided, showing loading state')
      return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
          <div className="p-4 border-b border-border/30 bg-card/50">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-2xl font-bold">Loading...</h1>
            </div>
          </div>
        </div>
      )
    }
    
    const [versions, setVersions] = useState<AudioVersion[]>([])
    const [selectedVersion, setSelectedVersion] = useState<AudioVersion | null>(null)
    const [annotations, setAnnotations] = useState<Annotation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set())
    const [optimisticArtworkPath, setOptimisticArtworkPath] = useState<string | null | undefined>(undefined)
    const [optimisticFavoriteId, setOptimisticFavoriteId] = useState<string | null | undefined>(undefined)
    const [optimisticProject, setOptimisticProject] = useState<Project | null>(null)
    const [showDeleteAllVersionsConfirm, setShowDeleteAllVersionsConfirm] = useState(false)
    const [isDeletingAllVersions, setIsDeletingAllVersions] = useState(false)
    const [analyzingVersionId, setAnalyzingVersionId] = useState<string | null>(null)
    const [versionSourceFilter, setVersionSourceFilter] = useState<"all" | "manual" | "auto" | "offline" | "export">("all")
    
    // Editing states
    const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null)
    const [editText, setEditText] = useState("")
    const [newAnnotationText, setNewAnnotationText] = useState("")
    const [newAnnotationColor, setNewAnnotationColor] = useState(ANNOTATION_COLORS[0].value)
    const [showAddAnnotation, setShowAddAnnotation] = useState(false)
    
    // Project edit state
    const [isEditingProject, setIsEditingProject] = useState(false)
    const [editTitle, setEditTitle] = useState(project?.title || "")
    const [editBpm, setEditBpm] = useState(project?.bpm || 0)
    const [editTimeSpent, setEditTimeSpent] = useState(project?.timeSpent || 0)
    const [editKeyRoot, setEditKeyRoot] = useState("None")
    const [editKeyMode, setEditKeyMode] = useState("Major")
    const [editDawProjectPath, setEditDawProjectPath] = useState(project?.dawProjectPath || null)
    const [editDawType, setEditDawType] = useState(project?.dawType || null)
    const [editTags, setEditTags] = useState<string[]>(project?.tags || [])
    const [editGenre, setEditGenre] = useState(project?.genre || "")
    const [editArtists, setEditArtists] = useState(project?.artists || "")
    const [newTag, setNewTag] = useState("")
    const [newTagColor, setNewTagColor] = useState("#6366f1")

    // Color presets for tag creation
    const colorPresets = [
      '#ef4444', '#f97316', '#f59e0b', '#84cc16',
      '#22c55e', '#10b981', '#06b6d4', '#3b82f6',
      '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
    ]

    // Computed project with optimistic updates
    const displayProject = optimisticProject ? {
      ...optimisticProject,
      artworkPath: optimisticArtworkPath !== undefined ? optimisticArtworkPath : optimisticProject.artworkPath
    } : {
      ...project,
      artworkPath: optimisticArtworkPath !== undefined ? optimisticArtworkPath : project.artworkPath
    }

    // Compute current artwork path for the hook (must be at top level, not inside JSX)
    const currentArtworkPath = optimisticArtworkPath !== undefined ? optimisticArtworkPath : project.artworkPath
    const artworkUrl = useImageUrl(currentArtworkPath)

    // Helper function to parse musical key into root and mode
    const parseMusicalKey = (key: string) => {
      if (key === "None") return { root: "None", mode: "Major" }

      // Try to match patterns like "C Major", "F# Minor", "G Mixolydian"
      const match = key.match(/^([A-G]#?) (.+)$/)
      if (match) {
        return { root: match[1], mode: match[2] }
      }

      // Fallback: assume it's just a root note
      return { root: key, mode: "Major" }
    }
    
    // Audio state
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const [isReady, setIsReady] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [volume, setVolume] = useState(0.8)

    // Distribution links state
    const [distributionLinks, setDistributionLinks] = useState<DistributionLink[]>([])
    const [addingPlatform, setAddingPlatform] = useState<string | null>(null)
    const [newLinkUrl, setNewLinkUrl] = useState("")
    const [newLinkLabel, setNewLinkLabel] = useState("")

    // Drag-and-drop state for audio versions
    const [isDraggingOver, setIsDraggingOver] = useState(false)
    const dragCounterRef = useRef(0)

    // Settings: read confirmDestructiveActions once on mount
    const [confirmBeforeDelete, setConfirmBeforeDelete] = useState(true)
    useEffect(() => {
      if (!isElectron()) return
      window.electron?.getSettings().then(s => {
        setConfirmBeforeDelete(s?.confirmDestructiveActions ?? true)
      }).catch(() => {})
    }, [])

    // Task state for project kanban
    const [projectTasks, setProjectTasks] = useState<Task[]>([])
    const [taskAnnotations, setTaskAnnotations] = useState<Annotation[]>([])

    const loadDistributionLinks = useCallback(async () => {
      if (!isElectron() || !project?.id) return
      try {
        const links = await window.electron?.getDistributionLinks(project.id)
        setDistributionLinks(links || [])
      } catch (e) {
        console.error("Failed to load distribution links:", e)
      }
    }, [project?.id])

    useEffect(() => {
      loadDistributionLinks()
    }, [loadDistributionLinks])

    const handleAddDistributionLink = async () => {
      if (!isElectron() || !addingPlatform || !newLinkUrl.trim()) return
      try {
        const link = await window.electron?.createDistributionLink(
          project.id,
          addingPlatform,
          newLinkUrl.trim(),
          newLinkLabel.trim() || undefined,
        )
        if (link) {
          setDistributionLinks(prev => [...prev, link])
        }
        setAddingPlatform(null)
        setNewLinkUrl("")
        setNewLinkLabel("")
      } catch (e) {
        console.error("Failed to create distribution link:", e)
      }
    }

    const handleDeleteDistributionLink = async (id: string) => {
      if (!isElectron()) return
      try {
        await window.electron?.deleteDistributionLink(id)
        setDistributionLinks(prev => prev.filter(l => l.id !== id))
      } catch (e) {
        console.error("Failed to delete distribution link:", e)
      }
    }

    // Raw ref — set synchronously in drag handlers so the Tauri event always reads the correct value
    const isOverAudioRef = useRef(false)

    const handleDragEnter = (e: React.DragEvent) => {
      e.preventDefault()
      dragCounterRef.current++
      if (dragCounterRef.current === 1) {
        isOverAudioRef.current = true
        setIsDraggingOver(true)
      }
    }

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault()
      dragCounterRef.current--
      if (dragCounterRef.current === 0) {
        isOverAudioRef.current = false
        setIsDraggingOver(false)
      }
    }

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault()
    }

    const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = 0

      // In Electron, the drop event usually carries real file paths.
      // Prefer handling those directly and keep Tauri event handling as a fallback.
      const fileObjectPaths = Array.from(e.dataTransfer?.files || [])
        .map(file => normalizeDroppedPath((file as File & { path?: string }).path || ''))
        .filter((path): path is string => typeof path === 'string' && path.length > 0)
      const uriListPaths = parseDroppedTextPaths(e.dataTransfer?.getData('text/uri-list') || '')
      const textPaths = parseDroppedTextPaths(e.dataTransfer?.getData('text/plain') || '')
      const droppedPaths = [...new Set([...fileObjectPaths, ...uriListPaths, ...textPaths])]

      if (droppedPaths.length > 0) {
        isOverAudioRef.current = false
        setIsDraggingOver(false)
        await handleDroppedPaths(droppedPaths)
        return
      }

      console.warn('[ProjectDetail] Drop had no direct paths from DataTransfer; waiting for native drop event fallback')

      // Don't clear isOverAudioRef here — let the Tauri event read it first, then clear it
      setIsDraggingOver(false)
    }

    const versionsRef = useRef(versions)
    useEffect(() => { versionsRef.current = versions }, [versions])

    const projectFavRef = useRef(project.favoriteVersionId)
    useEffect(() => { projectFavRef.current = project.favoriteVersionId }, [project.favoriteVersionId])

    const lastDropSignatureRef = useRef<{ signature: string; timestamp: number } | null>(null)

    const addAudioVersionsFromPaths = useCallback(async (filePaths: string[]) => {
      if (!isElectron() || !project?.id) return

      const audioPaths = filePaths.filter(path => {
        const ext = path.split(/[./\\]/).pop()?.toLowerCase()
        return !!ext && AUDIO_EXTENSIONS.includes(ext)
      })

      if (audioPaths.length === 0) {
        console.warn('[ProjectDetail] Dropped paths contained no supported audio files', filePaths)
        return
      }

      const willAutoStar = versionsRef.current.length === 0 || !projectFavRef.current
      let firstVersion: AudioVersion | null = null

      for (const filePath of audioPaths) {
        const filename = filePath.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, '') || `Version ${versionsRef.current.length + 1}`
        const version = await window.electron?.createVersion({
          projectId: project.id,
          name: filename,
          filePath,
          notes: null,
          source: "manual",
        })

        if (!version) continue
        if (!firstVersion) firstVersion = version

        // Keep drag/drop behavior aligned with the Add Version button path.
        if (isAuthenticated && user) {
          syncVersionToShares(user.id, profile?.displayName || user.email || 'Unknown', project.id, {
            name: version.name || filename,
            filePath: version.filePath,
            versionNumber: version.versionNumber || 1,
            isFavorite: !!willAutoStar,
          }).then(count => {
            if (count > 0) console.log(`[Sync] Auto-synced new version to ${count} share(s)`)
          }).catch(e => console.warn('[Sync] Auto-sync failed:', e))
        }
      }

      if (!firstVersion) return

      await loadVersions()
      setSelectedVersion(firstVersion)
      setExpandedVersions(prev => {
        const next = new Set(prev)
        next.add(firstVersion.id)
        return next
      })

      if (willAutoStar) {
        setOptimisticFavoriteId(firstVersion.id)
        await window.electron?.updateProject(project.id, { favoriteVersionId: firstVersion.id })
      }

      // Refresh project data to sync with database and parent state.
      onRefresh()
    }, [isAuthenticated, onRefresh, profile?.displayName, project?.id, user])

    const handleDroppedPaths = useCallback(async (paths: string[]) => {
      const normalized = paths
        .map(path => normalizeDroppedPath(path))
        .filter((path): path is string => typeof path === 'string' && path.length > 0)

      if (normalized.length === 0) {
        console.warn('[ProjectDetail] Received drop payload but no usable file paths', paths)
        return
      }

      // Drop events can arrive through multiple channels for one gesture.
      // Deduplicate identical path sets within a short window.
      const signature = [...new Set(normalized)].sort().join('|')
      const now = Date.now()
      const last = lastDropSignatureRef.current
      if (last && last.signature === signature && now - last.timestamp < 1200) return
      lastDropSignatureRef.current = { signature, timestamp: now }

      await addAudioVersionsFromPaths(normalized)
    }, [addAudioVersionsFromPaths])

    useEffect(() => {
      if (!isElectron() || !project?.id) return
      const unlistenFns: Array<() => void> = []
      let cancelled = false

      import("@tauri-apps/api/event").then(({ listen }) => {
        if (cancelled) return

        listen<{ paths: string[] }>("tauri://drag-drop", async (event) => {
          const paths = event.payload?.paths || []
          console.log('[ProjectDetail] tauri://drag-drop event payload:', event.payload)
          if (!paths || paths.length === 0) {
            console.warn('[ProjectDetail] tauri://drag-drop event had no paths')
            return
          }
          isOverAudioRef.current = false
          dragCounterRef.current = 0
          setIsDraggingOver(false)
          await handleDroppedPaths(paths)
        }).then(fn => {
          if (cancelled) { fn(); return }
          unlistenFns.push(fn)
        })

        // Legacy/alternative event name used by some runtimes.
        listen<{ paths: string[] }>("tauri://file-drop", async (event) => {
          const paths = event.payload?.paths || []
          console.log('[ProjectDetail] tauri://file-drop event payload:', event.payload)
          if (!paths || paths.length === 0) {
            console.warn('[ProjectDetail] tauri://file-drop event had no paths')
            return
          }
          isOverAudioRef.current = false
          dragCounterRef.current = 0
          setIsDraggingOver(false)
          await handleDroppedPaths(paths)
        }).then(fn => {
          if (cancelled) { fn(); return }
          unlistenFns.push(fn)
        })
      }).catch(() => {})

      import("@tauri-apps/api/webviewWindow").then(({ getCurrentWebviewWindow }) => {
        if (cancelled) return
        getCurrentWebviewWindow().onDragDropEvent(async (event: any) => {
          const payload = event?.payload
          console.log('[ProjectDetail] WebviewWindow onDragDropEvent payload:', payload)
          if (!payload || payload.type !== 'drop') {
            console.warn('[ProjectDetail] WebviewWindow drop event missing payload or wrong type', payload)
            return
          }
          if (!Array.isArray(payload.paths) || payload.paths.length === 0) {
            console.warn('[ProjectDetail] WebviewWindow drop event had no paths', payload)
            return
          }

          isOverAudioRef.current = false
          dragCounterRef.current = 0
          setIsDraggingOver(false)
          await handleDroppedPaths(payload.paths)
        }).then(fn => {
          if (cancelled) { fn(); return }
          unlistenFns.push(fn)
        }).catch(() => {})
      }).catch(() => {})

      // Add global drag/drop listeners for debugging and fallback. We listen to
      // dragenter/dragover so we can inspect DataTransfer.types early and call
      // `preventDefault` to allow drops from the OS into the webview.
      const windowDragEnterListener = (e: DragEvent) => {
        if (!e.dataTransfer) return
        dragCounterRef.current++
        if (dragCounterRef.current === 1) {
          isOverAudioRef.current = true
          setIsDraggingOver(true)
        }
        const types = Array.from(e.dataTransfer.types || [])
        console.log('[ProjectDetail] window dragenter DataTransfer types:', types)
      }

      const windowDragOverListener = (e: DragEvent) => {
        if (!e.dataTransfer) return
        // Keep the overlay visible while dragging over the window
        if (!isOverAudioRef.current) {
          isOverAudioRef.current = true
          setIsDraggingOver(true)
        }
        const types = Array.from(e.dataTransfer.types || [])
        console.log('[ProjectDetail] window dragover DataTransfer types:', types)
        // Ensure the browser allows the drop — many environments require
        // `preventDefault` on dragover to enable the subsequent `drop`.
        e.preventDefault()
      }

      const windowDragLeaveListener = (e: DragEvent) => {
        if (!e.dataTransfer) return
        dragCounterRef.current--
        if (dragCounterRef.current <= 0) {
          dragCounterRef.current = 0
          isOverAudioRef.current = false
          setIsDraggingOver(false)
        }
        const types = Array.from(e.dataTransfer.types || [])
        console.log('[ProjectDetail] window dragleave DataTransfer types:', types)
      }

      const windowDropListener = (e: DragEvent) => {
        if (e.dataTransfer) {
          const fileObjectPaths = Array.from(e.dataTransfer.files || [])
            .map(file => (file as File & { path?: string }).path)
            .filter((path): path is string => typeof path === 'string' && path.length > 0)
          const uriListPaths = parseDroppedTextPaths(e.dataTransfer.getData('text/uri-list') || '')
          const textPaths = parseDroppedTextPaths(e.dataTransfer.getData('text/plain') || '')
          const droppedPaths = [...new Set([...fileObjectPaths, ...uriListPaths, ...textPaths])]
          console.log('[ProjectDetail] window drop DataTransfer:', { fileObjectPaths, uriListPaths, textPaths, droppedPaths })
          // Clear drag state immediately so UI feedback disappears
          dragCounterRef.current = 0
          isOverAudioRef.current = false
          setIsDraggingOver(false)
          if (droppedPaths.length > 0) {
            e.preventDefault()
            handleDroppedPaths(droppedPaths)
          }
        }
      }

      window.addEventListener('dragenter', windowDragEnterListener)
      window.addEventListener('dragover', windowDragOverListener)
      window.addEventListener('dragleave', windowDragLeaveListener)
      window.addEventListener('drop', windowDropListener)

      return () => {
        cancelled = true
        unlistenFns.forEach(fn => fn())
        window.removeEventListener('dragenter', windowDragEnterListener)
        window.removeEventListener('dragover', windowDragOverListener)
        window.removeEventListener('drop', windowDropListener)
      }
    }, [handleDroppedPaths, project?.id])

    const loadProjectTasks = useCallback(async () => {
      if (!isElectron() || !project?.id) return
      try {
        const tasks = await window.electron?.getTasks() || []
        setProjectTasks(tasks.filter((t: Task) => t.projectId === project.id))
        const annTasks = await window.electron?.getTaskAnnotationsByProject(project.id) || []
        setTaskAnnotations(annTasks)
      } catch (e) {
        console.error("Failed to load project tasks:", e)
      }
    }, [project?.id])

    useEffect(() => {
      loadProjectTasks()
    }, [loadProjectTasks])


    // Load versions
    useEffect(() => {
      if (project?.id) {
        loadVersions()
      }
    }, [project?.id])

    // Listen for plugin recording imports to reload versions
    useEffect(() => {
      if (!project?.id) return
      let cancelled = false
      let unlisten: (() => void) | null = null
      import("@tauri-apps/api/event").then(({ listen }) => {
        if (cancelled) return
        listen("plugin-event", (event: any) => {
          const pluginEvent = event.payload
          if (
            pluginEvent.type === "pluginRecordingComplete" &&
            pluginEvent.projectId === project.id
          ) {
            // A recording was completed for this project — wait briefly for the
            // import to finish in App.tsx, then reload versions
            setTimeout(() => {
              loadVersions()
            }, 1500)
          }
        }).then((fn) => {
          if (cancelled) { fn(); return }
          unlisten = fn
        })
      }).catch(() => {})
      return () => {
        cancelled = true
        unlisten?.()
      }
    }, [project?.id])

    // Update edit state when project changes
    useEffect(() => {
      if (project) {
        setEditTitle(project.title || "")
        setEditBpm(project.bpm || 0)
        setEditTimeSpent(project.timeSpent || 0)
        setEditDawProjectPath(project.dawProjectPath || null)
        setEditDawType(project.dawType || null)
        setEditTags(project.tags || [])
        setEditGenre(project.genre || "")
        setEditArtists(project.artists || "")
        const { root, mode } = parseMusicalKey(project.musicalKey)
        setEditKeyRoot(root)
        setEditKeyMode(mode)
      }
    }, [project])

    // Reset optimistic states when project changes
    useEffect(() => {
      // Only clear optimistic state if it matches the actual project state
      // This means the refresh has completed and the optimistic update was correct
      if (optimisticArtworkPath !== undefined && optimisticArtworkPath === project.artworkPath) {
        setOptimisticArtworkPath(undefined)
      }
      if (optimisticProject && 
          optimisticProject.title === project.title &&
          optimisticProject.bpm === project.bpm &&
          optimisticProject.status === project.status &&
          JSON.stringify(optimisticProject.tags) === JSON.stringify(project.tags)) {
        setOptimisticProject(null)
      }
    }, [project, optimisticArtworkPath, optimisticProject])

    // Load annotations when version changes
    useEffect(() => {
      if (selectedVersion) {
        loadAnnotations(selectedVersion.id)
      }
    }, [selectedVersion?.id])

    // Create a persistent audio element once (reuse across version switches)
    useEffect(() => {
      const audio = new Audio()
      audio.preload = 'auto'
      audioRef.current = audio

      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration || 0)
        setIsReady(true)
      })
      audio.addEventListener('canplay', () => {
        setIsReady(true)
      })
      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime)
      })
      audio.addEventListener('ended', () => {
        setIsPlaying(false)
        setCurrentTime(0)
      })
      audio.addEventListener('play', () => {
        setIsPlaying(true)
      })
      audio.addEventListener('pause', () => {
        setIsPlaying(false)
      })
      audio.addEventListener('error', (error) => {
        console.error("HTML5 Audio error:", error)
        setIsReady(false)
      })

      return () => {
        audio.pause()
        audio.src = ''
        audioRef.current = null
      }
    }, [])

    // Swap audio source when version changes (reuse existing element)
    useEffect(() => {
      if (!selectedVersion || !audioRef.current) return

      // Reset audio state immediately when version changes
      setIsReady(false)
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)

      try {
        const audioAssetUrl = assetUrl(selectedVersion.filePath)
        audioRef.current.src = audioAssetUrl
        audioRef.current.load()
      } catch (error) {
        console.error("Failed to load audio:", error)
        setIsReady(false)
      }
    }, [selectedVersion?.id])

    // Handle volume changes
    useEffect(() => {
      if (audioRef.current) {
        audioRef.current.volume = volume
      }
    }, [volume])

    const loadVersions = async (skipAutoSelect: boolean = false): Promise<AudioVersion[] | undefined> => {
      if (!isElectron() || !project?.id) return
      setIsLoading(true)
      try {
        const data = await window.electron?.getVersionsByProject(project.id)
        setVersions(data || [])
        
        if (skipAutoSelect) {
          return data
        }
        
        // If project has an audio preview, create a "Main" version entry if none exists
        if (data?.length === 0 && project.audioPreviewPath) {
          setSelectedVersion({
            id: "main",
            projectId: project.id,
            name: "Main Preview",
            filePath: project.audioPreviewPath,
            notes: null,
            source: "manual" as const,
            versionNumber: 0,
            createdAt: project.createdAt,
            peakDb: null,
            rmsDb: null,
            lufsIntegrated: null,
            analysisPath: null,
          })
        } else if (data && data.length > 0) {
          setSelectedVersion(data[0])
          setExpandedVersions(new Set([data[0].id]))
        }
        
        return data
      } catch (error) {
        console.error("Failed to load versions:", error)
      } finally {
        setIsLoading(false)
      }
    }

    const loadAnnotations = async (versionId: string) => {
      if (!isElectron() || versionId === "main") {
        setAnnotations([])
        return
      }
      try {
        const data = await window.electron?.getAnnotationsByVersion(versionId)
        setAnnotations(data || [])
      } catch (error) {
        console.error("Failed to load annotations:", error)
      }
    }

    const handlePlayPause = () => {
      if (!isReady || !audioRef.current) return
      
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
    }

    const handleSeekTo = (time: number) => {
      if (!isReady || !audioRef.current) return
      
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }

    const handleSkipBack = () => {
      handleSeekTo(Math.max(0, currentTime - 5))
    }

    const handleSkipForward = () => {
      handleSeekTo(Math.min(duration, currentTime + 5))
    }

    const formatTime = (seconds: number): string => {
      const mins = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${mins}:${secs.toString().padStart(2, "0")}`
    }

    // Version management
    const handleAddVersion = async () => {
      if (!isElectron()) return
      try {
        // Open file picker in the project's folder if available
        const projectDir = project.dawProjectPath
          ? project.dawProjectPath.replace(/[\\/][^\\/]+$/, '')
          : undefined
        const filePath = await window.electron?.selectAudio(projectDir)
        if (filePath) {
          await addAudioVersionsFromPaths([filePath])
        }
      } catch (error) {
        console.error("Failed to add version:", error)
      }
    }

    const handleSetFavorite = async (versionId: string) => {
      if (!isElectron()) return
      try {
        // Get current favorite (use optimistic if set, otherwise project value)
        const currentFavorite = optimisticFavoriteId !== undefined ? optimisticFavoriteId : project.favoriteVersionId
        // Toggle favorite: if already favorite, unset it; otherwise set it
        const newFavoriteId = currentFavorite === versionId ? null : versionId
        // Optimistic update
        setOptimisticFavoriteId(newFavoriteId)
        await window.electron?.updateProject(project.id, { favoriteVersionId: newFavoriteId })
        onRefresh() // Refresh to update the project data
      } catch (error) {
        console.error("Failed to set favorite version:", error)
        // Revert optimistic update on error
        setOptimisticFavoriteId(undefined)
      }
    }

    // Get effective favorite ID (optimistic or actual)
    const effectiveFavoriteId = optimisticFavoriteId !== undefined ? optimisticFavoriteId : project.favoriteVersionId

    // Reset optimistic state when project updates
    useEffect(() => {
      if (optimisticFavoriteId !== undefined && optimisticFavoriteId === project.favoriteVersionId) {
        setOptimisticFavoriteId(undefined)
      }
    }, [project.favoriteVersionId, optimisticFavoriteId])

    const handleAnalyzeVersion = async (versionId: string) => {
      if (!isElectron() || versionId === "main") return
      setAnalyzingVersionId(versionId)
      try {
        await window.electron?.analyzeAudioVersion(versionId)
        // Reload versions to get updated analysis data
        await loadVersions(true)
      } catch (error) {
        console.error("Failed to analyze version:", error)
      } finally {
        setAnalyzingVersionId(null)
      }
    }

    const handleDeleteVersion = async (versionId: string) => {
      if (!isElectron() || versionId === "main") return
      try {
        await window.electron?.deleteVersion(versionId)
        
        // Stop playback if the deleted version was playing
        if (selectedVersion?.id === versionId) {
          // Stop the audio player
          if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
          }
          setIsPlaying(false)
          setCurrentTime(0)
          setDuration(0)
        }
        
        // Reload versions without auto-selecting
        const updatedVersions = await loadVersions(true)
        
        if (selectedVersion?.id === versionId) {
          // Find next version to select (excluding the deleted one)
          const remainingVersions = (updatedVersions || []).filter(v => v.id !== versionId)
          if (remainingVersions.length > 0) {
            setSelectedVersion(remainingVersions[0])
          } else if (project.audioPreviewPath) {
            // Fall back to main preview if available
            setSelectedVersion({
              id: "main",
              projectId: project.id,
              name: "Main Preview",
              filePath: project.audioPreviewPath,
              notes: null,
              source: "manual" as const,
              versionNumber: 0,
              createdAt: project.createdAt,
              peakDb: null,
              rmsDb: null,
              lufsIntegrated: null,
              analysisPath: null,
            })
          } else {
            setSelectedVersion(null)
          }
        }
        
        // Refresh project to update favoriteVersionId if needed
        onRefresh()
      } catch (error) {
        console.error("Failed to delete version:", error)
      }
    }

    const handleDeleteAllVersions = async () => {
      if (!isElectron()) return
      setIsDeletingAllVersions(true)
      try {
        await window.electron?.deleteProjectRecordings(project.id)
        // Stop playback
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
        }
        setIsPlaying(false)
        setCurrentTime(0)
        setDuration(0)
        setSelectedVersion(project.audioPreviewPath ? {
          id: "main",
          projectId: project.id,
          name: "Main Preview",
          filePath: project.audioPreviewPath,
          notes: null,
          source: "manual" as const,
          versionNumber: 0,
          createdAt: project.createdAt,
          peakDb: null,
          rmsDb: null,
          lufsIntegrated: null,
          analysisPath: null,
        } : null)
        setAnnotations([])
        await loadVersions()
        onRefresh()
      } catch (error) {
        console.error("Failed to delete all recordings:", error)
      } finally {
        setIsDeletingAllVersions(false)
        setShowDeleteAllVersionsConfirm(false)
      }
    }

    const handleUpdateVersionName = async (versionId: string, name: string) => {
      if (!isElectron() || versionId === "main") return
      try {
        await window.electron?.updateVersion(versionId, { name })
        await loadVersions()
      } catch (error) {
        console.error("Failed to update version:", error)
      }
    }

    // Annotation management
    const handleAddAnnotation = async () => {
      if (!isElectron() || !selectedVersion || selectedVersion.id === "main") return
      if (!newAnnotationText.trim()) return
      try {
        await window.electron?.createAnnotation({
          versionId: selectedVersion.id,
          timestamp: currentTime,
          text: newAnnotationText.trim(),
          color: newAnnotationColor,
        })
        setNewAnnotationText("")
        setShowAddAnnotation(false)
        await loadAnnotations(selectedVersion.id)
      } catch (error) {
        console.error("Failed to add annotation:", error)
      }
    }

    const handleUpdateAnnotation = async (id: string) => {
      if (!isElectron() || !editText.trim()) return
      try {
        await window.electron?.updateAnnotation(id, { text: editText.trim() })
        setEditingAnnotation(null)
        setEditText("")
        if (selectedVersion) await loadAnnotations(selectedVersion.id)
      } catch (error) {
        console.error("Failed to update annotation:", error)
      }
    }

    const handleDeleteAnnotation = async (id: string) => {
      if (!isElectron()) return
      try {
        await window.electron?.deleteAnnotation(id)
        if (selectedVersion) await loadAnnotations(selectedVersion.id)
      } catch (error) {
        console.error("Failed to delete annotation:", error)
      }
    }

    const handleSaveProject = async () => {
      if (!isElectron()) return
      try {
        // Optimistic update
        const optimisticUpdate = {
          ...project,
          title: editTitle,
          bpm: editBpm,
          timeSpent: editTimeSpent,
          dawProjectPath: editDawProjectPath,
          dawType: editDawType,
          musicalKey: editKeyRoot === "None" ? "None" : `${editKeyRoot} ${editKeyMode}`,
          tags: editTags,
          genre: editGenre.trim() || null,
          artists: editArtists.trim() || null,
          updatedAt: new Date().toISOString(),
        }
        setOptimisticProject(optimisticUpdate)
        
        await window.electron?.updateProject(project.id, {
          title: editTitle,
          bpm: editBpm,
          timeSpent: editTimeSpent,
          dawProjectPath: editDawProjectPath,
          dawType: editDawType,
          musicalKey: editKeyRoot === "None" ? "None" : `${editKeyRoot} ${editKeyMode}`,
          tags: editTags,
          genre: editGenre.trim() || null,
          artists: editArtists.trim() || null,
        })
        setIsEditingProject(false)
        await onRefresh()
        
        // Clear optimistic state - let the useEffect handle it
      } catch (error) {
        console.error("Failed to update project:", error)
        // Revert optimistic update on error
        setOptimisticProject(null)
      }
    }

    const handleStatusChange = async (newStatus: string) => {
      if (!isElectron() || newStatus === displayProject.status) return
      try {
        setOptimisticProject({ ...project, status: newStatus as ProjectStatus, updatedAt: new Date().toISOString() })
        await window.electron?.updateProject(project.id, { status: newStatus as ProjectStatus })
        await onRefresh()
      } catch (error) {
        console.error("Failed to update status:", error)
        setOptimisticProject(null)
      }
    }

    const addTag = () => {
      if (!newTag.trim() || editTags.includes(newTag.trim())) return
      setEditTags([...editTags, newTag.trim()])
      setNewTag("")
    }

    const removeTag = (tagToRemove: string) => {
      setEditTags(editTags.filter(tag => tag !== tagToRemove))
    }

    const handleChangeArtwork = async () => {
      if (!isElectron()) return
      try {
        const imagePath = await window.electron?.selectImage()
        if (imagePath) {
          // Optimistic update
          setOptimisticArtworkPath(imagePath)
          
          await window.electron?.updateProject(project.id, { artworkPath: imagePath })
          await window.electron?.addArtworkHistoryEntry(project.id, imagePath, "file")
          await onRefresh()
          
          // Don't manually clear optimistic state - let the useEffect handle it
        }
      } catch (error) {
        console.error("Failed to change artwork:", error)
        // Revert optimistic update on error
        setOptimisticArtworkPath(undefined)
      }
    }

    const handleRemoveArtwork = async () => {
      if (!isElectron()) return
      try {
        // Optimistic update
        setOptimisticArtworkPath(null)
        
        await window.electron?.updateProject(project.id, { artworkPath: null })
        await onRefresh()
      } catch (error) {
        console.error("Failed to remove artwork:", error)
        // Revert optimistic update on error
        setOptimisticArtworkPath(undefined)
      }
    }

    const handleSelectProject = async () => {
      if (!isElectron()) return
      try {
        const path = await window.electron?.selectProject()
        if (path) {
          setEditDawProjectPath(path)
          const ext = path.split(".").pop()?.toLowerCase()
          if (ext === "als") setEditDawType("Ableton Live")
          else if (ext === "flp") setEditDawType("FL Studio")
          else if (ext === "logic") setEditDawType("Logic Pro")
          else if (ext === "ptx") setEditDawType("Pro Tools")
          else if (ext === "cpr") setEditDawType("Cubase")
          else if (ext === "rpp") setEditDawType("Reaper")
        }
      } catch (error) {
        console.error("Failed to select project file:", error)
      }
    }

    const toggleVersionExpanded = (versionId: string) => {
      const newExpanded = new Set(expandedVersions)
      if (newExpanded.has(versionId)) {
        newExpanded.delete(versionId)
      } else {
        newExpanded.add(versionId)
      }
      setExpandedVersions(newExpanded)
    }

    return (
      <TooltipProvider>
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
          {/* Header */}
          <div className="p-4 border-b border-border/30 bg-card/50">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              
              <div className="flex items-center gap-4 flex-1">
                {/* Artwork */}
                <div 
                  className="relative w-20 h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all group"
                  onClick={() => onOpenArtworkManager ? onOpenArtworkManager(project) : handleChangeArtwork()}
                  title={onOpenArtworkManager ? "Manage artwork" : "Click to change artwork"}
                >
                  {artworkUrl ? (
                      <img
                        src={artworkUrl}
                        alt={project.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                        <Music className="w-8 h-8 text-primary" />
                      </div>
                    )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Image className="w-5 h-5 text-white drop-shadow-md" />
                  </div>
                </div>

                {/* Project Info */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold truncate">{displayProject.title}</h1>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {displayProject.bpm > 0 && (
                      <span>{displayProject.bpm} BPM</span>
                    )}
                    {displayProject.timeSpent && displayProject.timeSpent > 0 && !displayProject.dawType?.toLowerCase().includes('ableton') && (
                      <span>{displayProject.timeSpent}m</span>
                    )}
                    {displayProject.musicalKey !== "None" && (
                      <span>• {displayProject.musicalKey}</span>
                    )}
                    {displayProject.collectionName && (
                      <Badge variant="outline">{displayProject.collectionName}</Badge>
                    )}
                    {displayProject.artists && (
                      <span>• {displayProject.artists}</span>
                    )}
                    {displayProject.genre && (
                      <span>• {displayProject.genre}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span>Created: {new Date(displayProject.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>Updated: {new Date(displayProject.updatedAt).toLocaleDateString()}</span>
                    {/* Plugin Bridge Icon — always visible */}
                    <span>•</span>
                    <PluginStatusIcon sessions={pluginSessions} currentProjectId={project.id} pluginLinked={project.pluginLinked} />
                  </div>
                  {displayProject.tags && displayProject.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {displayProject.tags.map((tag) => (
                        <Badge 
                          key={tag} 
                          variant="secondary" 
                          className="text-xs border-0"
                          style={{ 
                            backgroundColor: `${getTagColor(tag)}20`,
                            color: getTagColor(tag)
                          }}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Status Pipeline */}
                  <div className="flex items-center gap-1 mt-3 flex-wrap">
                    {STATUS_PIPELINE.map((statusKey, index) => {
                      const config = STATUS_CONFIG[statusKey]
                      const isActive = displayProject.status === statusKey
                      const currentIndex = STATUS_PIPELINE.indexOf(displayProject.status as typeof STATUS_PIPELINE[number])
                      const isPast = currentIndex >= 0 && index < currentIndex
                      const isArchived = displayProject.status === STATUS_ARCHIVED

                      return (
                        <React.Fragment key={statusKey}>
                          {/* Connector line */}
                          {index > 0 && (
                            <div
                              className="h-[2px] w-4 flex-shrink-0 rounded-full transition-colors duration-200"
                              style={{
                                backgroundColor: isPast && !isArchived
                                  ? `${config.hex}40`
                                  : 'hsl(var(--border) / 0.3)'
                              }}
                            />
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleStatusChange(statusKey)}
                                className={cn(
                                  "relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200",
                                  "outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                                  isActive
                                    ? "shadow-sm"
                                    : isPast && !isArchived
                                      ? "opacity-50 hover:opacity-80"
                                      : "opacity-30 hover:opacity-60"
                                )}
                                style={isActive ? {
                                  backgroundColor: `${config.hex}20`,
                                  color: config.hex,
                                  boxShadow: `0 0 12px ${config.hex}15`,
                                } : isPast && !isArchived ? {
                                  color: config.hex,
                                } : {
                                  color: 'hsl(var(--muted-foreground))',
                                }}
                              >
                                {/* Active indicator dot */}
                                {isActive && (
                                  <motion.div
                                    layoutId="statusIndicator"
                                    className="absolute inset-0 rounded-full border"
                                    style={{ borderColor: `${config.hex}40` }}
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                                  />
                                )}
                                <span className="relative z-10 flex items-center gap-1.5">
                                  {config.icon}
                                  <span className="hidden sm:inline">{config.title}</span>
                                </span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              {isActive ? `Current: ${config.title}` : `Set to ${config.title}`}
                            </TooltipContent>
                          </Tooltip>
                        </React.Fragment>
                      )
                    })}

                    {/* Archive - separated */}
                    <div className="h-4 w-[1px] bg-border/30 mx-1 flex-shrink-0" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleStatusChange(STATUS_ARCHIVED)}
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all duration-200",
                            "outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                            displayProject.status === STATUS_ARCHIVED
                              ? "shadow-sm"
                              : "opacity-30 hover:opacity-60"
                          )}
                          style={displayProject.status === STATUS_ARCHIVED ? {
                            backgroundColor: `${STATUS_CONFIG[STATUS_ARCHIVED].hex}20`,
                            color: STATUS_CONFIG[STATUS_ARCHIVED].hex,
                          } : {
                            color: 'hsl(var(--muted-foreground))',
                          }}
                        >
                          {STATUS_CONFIG[STATUS_ARCHIVED].icon}
                          <span className="hidden sm:inline">{STATUS_CONFIG[STATUS_ARCHIVED].title}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {displayProject.status === STATUS_ARCHIVED ? 'Currently archived' : 'Archive project'}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant={isEditingProject ? "secondary" : "ghost"} size="sm" className="h-8 px-2 text-xs gap-1.5" onClick={() => setIsEditingProject(!isEditingProject)}>
                    <Edit2 className="w-3.5 h-3.5" />
                    {isEditingProject ? "Close edit" : "Edit"}
                  </Button>
                  {project.dawProjectPath && (() => {
                    const dir = project.dawProjectPath!.replace(/[\\/][^\\/]+$/, '')
                    return dir ? (
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1.5" onClick={() => window.electron?.openFolder(dir)}>
                        <FolderOpen className="w-3.5 h-3.5" />
                        Open folder
                      </Button>
                    ) : null
                  })()}
                  {project.dawProjectPath && (
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1.5" onClick={() => onOpenDaw(project)}>
                      <Folder className="w-3.5 h-3.5" />
                      Open in DAW
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Edit Panel - slides down below header */}
          <AnimatePresence>
            {isEditingProject && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden border-b border-border/30 bg-card/30"
              >
                <div className="p-5 max-w-4xl mx-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Left column */}
                    <div className="space-y-4">
                      {/* Title */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Title</label>
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="h-9 font-semibold"
                          placeholder="Project title"
                        />
                      </div>

                      {/* Key & BPM row */}
                      <div className="flex gap-3">
                        {project.dawType?.toLowerCase().includes('ableton') && (
                          <div className="space-y-1.5 w-24">
                            <label className="text-xs font-medium text-muted-foreground">BPM</label>
                            <Input
                              type="number"
                              value={editBpm || ""}
                              onChange={(e) => setEditBpm(parseInt(e.target.value) || 0)}
                              placeholder="120"
                              className="h-9"
                            />
                          </div>
                        )}
                        <div className="space-y-1.5 flex-1">
                          <label className="text-xs font-medium text-muted-foreground">Key</label>
                          <Select value={editKeyRoot} onValueChange={setEditKeyRoot}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Key" />
                            </SelectTrigger>
                            <SelectContent>
                              {MUSICAL_KEY_ROOTS.map((key) => (
                                <SelectItem key={key} value={key}>
                                  {key === "None" ? "No key" : key}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5 flex-1">
                          <label className="text-xs font-medium text-muted-foreground">Scale</label>
                          <Select value={editKeyMode} onValueChange={setEditKeyMode} disabled={editKeyRoot === "None"}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Scale" />
                            </SelectTrigger>
                            <SelectContent>
                              {MUSICAL_KEY_MODES.map((mode) => (
                                <SelectItem key={mode} value={mode}>
                                  {mode}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Genre & Artists */}
                      <div className="flex gap-3">
                        <div className="space-y-1.5 flex-1">
                          <label className="text-xs font-medium text-muted-foreground">Genre</label>
                          <Input
                            value={editGenre}
                            onChange={(e) => setEditGenre(e.target.value)}
                            placeholder="e.g., Hip Hop, Electronic"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5 flex-1">
                          <label className="text-xs font-medium text-muted-foreground">Artists</label>
                          <Input
                            value={editArtists}
                            onChange={(e) => setEditArtists(e.target.value)}
                            placeholder="e.g., Artist name"
                            className="h-9"
                          />
                        </div>
                      </div>

                      {/* DAW Project File */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">DAW Project File</label>
                        <div className="flex gap-2">
                          <Input
                            value={editDawProjectPath || ""}
                            readOnly
                            placeholder="No file linked"
                            className="h-9 flex-1 text-xs"
                          />
                          <Button variant="outline" size="sm" onClick={handleSelectProject} className="h-9 px-3">
                            <Folder className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Right column - Tags */}
                    <div className="space-y-3">
                      <label className="text-xs font-medium text-muted-foreground">Tags</label>

                      {/* Current tags */}
                      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                        {editTags.map((tag) => {
                          const tagColor = getTagColor(tag)
                          return (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="gap-1 border-0 h-6 text-xs"
                              style={{ backgroundColor: `${tagColor}20`, color: tagColor }}
                            >
                              {tag}
                              <X
                                className="w-3 h-3 cursor-pointer opacity-60 hover:opacity-100"
                                onClick={() => removeTag(tag)}
                              />
                            </Badge>
                          )
                        })}
                        {editTags.length === 0 && (
                          <span className="text-xs text-muted-foreground/50 italic">No tags</span>
                        )}
                      </div>

                      {/* Add tag input */}
                      <div className="flex gap-2">
                        <Input
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          placeholder="Type to add or create..."
                          onKeyPress={(e) => e.key === 'Enter' && addTag()}
                          className="h-8 text-xs flex-1"
                        />
                        <Button type="button" variant="outline" size="sm" onClick={addTag} disabled={!newTag.trim()} className="h-8 px-2">
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      {/* Quick-add existing tags */}
                      <div className="flex flex-wrap gap-1">
                        {tags.filter(tag => !editTags.includes(tag.name)).slice(0, 8).map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            className="h-6 px-2 text-[11px] rounded-md transition-colors hover:opacity-80"
                            style={{ backgroundColor: `${tag.color}15`, color: tag.color }}
                            onClick={() => {
                              setEditTags([...editTags, tag.name])
                              setNewTag("")
                            }}
                          >
                            + {tag.name}
                          </button>
                        ))}
                      </div>

                      {/* Create new tag inline */}
                      {newTag.trim() && !tags.some(t => t.name.toLowerCase() === newTag.trim().toLowerCase()) && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
                          <div className="flex gap-0.5">
                            {colorPresets.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={cn(
                                  "w-4 h-4 rounded-full transition-all",
                                  newTagColor === color ? "ring-2 ring-offset-1 ring-offset-background ring-primary scale-110" : "hover:scale-110"
                                )}
                                style={{ backgroundColor: color }}
                                onClick={() => setNewTagColor(color)}
                              />
                            ))}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px] ml-auto"
                            style={{ backgroundColor: `${newTagColor}20`, color: newTagColor }}
                            onClick={async () => {
                              const tagName = newTag.trim()
                              await onCreateTag(tagName, newTagColor)
                              setEditTags([...editTags, tagName])
                              setNewTag("")
                              setNewTagColor("#6366f1")
                            }}
                          >
                            Create "{newTag.trim()}"
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Save bar */}
                  <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border/20">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingProject(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveProject}>
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      Save
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content — Tabbed */}
          <Tabs defaultValue="audio" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-4 pb-0 border-b border-border/30 bg-card/30">
              <TabsList className="h-9 bg-transparent p-0 gap-1">
                <TabsTrigger value="audio" data-tour-tab="pd-audio" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary gap-1.5 text-xs px-3">
                  <FileAudio className="w-3.5 h-3.5" />
                  Audio
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">{versions.length + (project.audioPreviewPath ? 1 : 0)}</Badge>
                </TabsTrigger>
                {project.dawType?.toLowerCase().includes("fl studio") && project.dawProjectPath && (
                  <TabsTrigger value="analysis" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary gap-1.5 text-xs px-3">
                    <BarChart3 className="w-3.5 h-3.5" />
                    Analysis
                  </TabsTrigger>
                )}
                <TabsTrigger value="tasks" data-tour-tab="pd-tasks" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary gap-1.5 text-xs px-3">
                  <ListTodo className="w-3.5 h-3.5" />
                  Tasks
                  {projectTasks.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">{projectTasks.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="collaboration" data-tour-tab="pd-collaboration" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary gap-1.5 text-xs px-3">
                  <Share2 className="w-3.5 h-3.5" />
                  Sharing
                </TabsTrigger>
                <TabsTrigger value="plugin" data-tour-tab="pd-plugin" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary gap-1.5 text-xs px-3">
                  <Plug className="w-3.5 h-3.5" />
                  VST Plugin
                  {pluginSessions.filter(s => s.linkedProjectId === project.id).length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">
                      {pluginSessions.filter(s => s.linkedProjectId === project.id).length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="distribution" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary gap-1.5 text-xs px-3">
                  <Link2 className="w-3.5 h-3.5" />
                  Distribution
                  {distributionLinks.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">{distributionLinks.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Audio Tab */}
            <TabsContent value="audio" className="flex-1 overflow-hidden mt-0 relative">
              {/* Drag-and-drop overlay */}
              {isDraggingOver && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary bg-primary/5 backdrop-blur-sm pointer-events-none">
                  <Upload className="w-10 h-10 text-primary" />
                  <p className="text-sm font-medium text-primary">Drop audio files to add as versions</p>
                </div>
              )}
              <ScrollArea className="h-full">
                <div
                  className="p-6 space-y-6"
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
              {/* Version Selector & Add Version */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <FileAudio className="w-5 h-5 text-primary" />
                    Audio Versions
                    <Badge variant="secondary">{versions.length + (project.audioPreviewPath ? 1 : 0)}</Badge>
                  </h2>
                  {/* Source filter tabs */}
                  {versions.length > 0 && (
                    <div className="flex items-center gap-0.5 bg-muted/30 rounded-lg p-0.5">
                      {([
                        { key: "all", label: "All" },
                        { key: "manual", label: "Manual" },
                        { key: "export", label: "Exports" },
                        { key: "auto", label: "Recordings" },
                        { key: "offline", label: "Renders" },
                      ] as const).map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setVersionSourceFilter(key)}
                          className={cn(
                            "px-2 py-0.5 text-[10px] font-medium rounded-md transition-all",
                            versionSourceFilter === key
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {versions.length > 0 && (
                    !showDeleteAllVersionsConfirm ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDeleteAllVersionsConfirm(true)}
                        className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete All
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDeleteAllVersionsConfirm(false)}
                          disabled={isDeletingAllVersions}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isDeletingAllVersions}
                          onClick={handleDeleteAllVersions}
                        >
                          {isDeletingAllVersions ? "Deleting..." : "Confirm"}
                        </Button>
                      </div>
                    )
                  )}
                  <Button onClick={handleAddVersion} size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Version
                  </Button>
                </div>
              </div>

              {/* Versions List */}
              <div className="space-y-4">
                {/* Main Preview (if exists) */}
                {project.audioPreviewPath && (
                  <VersionCard
                    version={{
                      id: "main",
                      projectId: project.id,
                      name: "Main Preview",
                      filePath: project.audioPreviewPath,
                      notes: null,
                      source: "manual" as const,
                      versionNumber: 0,
                      createdAt: project.createdAt,
                      peakDb: null,
                      rmsDb: null,
                      lufsIntegrated: null,
                      analysisPath: null,
                    }}
                    isSelected={selectedVersion?.id === "main"}
                    isExpanded={expandedVersions.has("main")}
                    annotations={[]}
                    currentTime={selectedVersion?.id === "main" ? currentTime : 0}
                    duration={selectedVersion?.id === "main" ? duration : 0}
                    isPlaying={selectedVersion?.id === "main" && isPlaying}
                    isReady={selectedVersion?.id === "main" && isReady}
                    onSelect={() => setSelectedVersion({
                      id: "main",
                      projectId: project.id,
                      name: "Main Preview",
                      filePath: project.audioPreviewPath!,
                      notes: null,
                      source: "manual" as const,
                      versionNumber: 0,
                      createdAt: project.createdAt,
                      peakDb: null,
                      rmsDb: null,
                      lufsIntegrated: null,
                      analysisPath: null,
                    })}
                    onToggleExpand={() => toggleVersionExpanded("main")}
                    onDelete={() => {}}
                    onUpdateName={() => {}}
                    onSetFavorite={() => handleSetFavorite("main")}
                    onAnalyze={() => {}}
                    isAnalyzing={false}
                    isFavorite={effectiveFavoriteId === "main"}
                    formatTime={formatTime}
                    confirmBeforeDelete={false}
                    isMain
                  />
                )}

                {/* Other Versions */}
                {versions.filter(v => versionSourceFilter === "all" || v.source === versionSourceFilter).map((version) => (
                  <VersionCard
                    key={version.id}
                    version={version}
                    isSelected={selectedVersion?.id === version.id}
                    isExpanded={expandedVersions.has(version.id)}
                    annotations={selectedVersion?.id === version.id ? annotations : []}
                    currentTime={selectedVersion?.id === version.id ? currentTime : 0}
                    duration={selectedVersion?.id === version.id ? duration : 0}
                    isPlaying={selectedVersion?.id === version.id && isPlaying}
                    isReady={selectedVersion?.id === version.id && isReady}
                    onSelect={() => setSelectedVersion(version)}
                    onToggleExpand={() => toggleVersionExpanded(version.id)}
                    onDelete={() => handleDeleteVersion(version.id)}
                    onUpdateName={(name) => handleUpdateVersionName(version.id, name)}
                    onSetFavorite={() => handleSetFavorite(version.id)}
                    onAnalyze={() => handleAnalyzeVersion(version.id)}
                    isAnalyzing={analyzingVersionId === version.id}
                    isFavorite={effectiveFavoriteId === version.id}
                    formatTime={formatTime}
                    confirmBeforeDelete={confirmBeforeDelete}
                  />
                ))}

                {versions.length === 0 && !project.audioPreviewPath && (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileAudio className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No audio versions yet</p>
                    <p className="text-sm">Add your first version to start tracking changes</p>
                  </div>
                )}
                {versions.length > 0 && versionSourceFilter !== "all" && versions.filter(v => v.source === versionSourceFilter).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No {versionSourceFilter === "auto" ? "recordings" : versionSourceFilter === "offline" ? "offline renders" : versionSourceFilter === "export" ? "exports" : "manual versions"} found</p>
                  </div>
                )}
              </div>

              {/* Selected Version Player */}
              {selectedVersion && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 rounded-xl bg-card/50 border border-border/30 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Music className="w-4 h-4 text-primary" />
                      Now Playing: {selectedVersion.name}
                    </h3>
                    <div className="text-sm text-muted-foreground">
                      Version {selectedVersion.versionNumber || "Preview"}
                    </div>
                  </div>

                  {/* SoundCloud-style Waveform */}
                  <Waveform
                    audioUrl={selectedVersion.filePath}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    duration={duration}
                    onSeek={handleSeekTo}
                    height={64}
                    waveColor={hexToRgba(accentColor, 0.3)}
                    progressColor={accentColor}
                    className="rounded-lg"
                  />

                  {/* Controls */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={handleSkipBack}
                            className="w-10 h-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                          >
                            <SkipBack className="w-5 h-5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>-5 seconds</TooltipContent>
                      </Tooltip>

                      <button
                        onClick={handlePlayPause}
                        disabled={!isReady}
                        className={cn(
                          "w-12 h-12 flex items-center justify-center rounded-full transition-all",
                          "bg-primary text-primary-foreground",
                          "hover:bg-primary/90 hover:scale-105 active:scale-95",
                          "shadow-lg shadow-primary/30",
                          "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5 ml-0.5" />
                        )}
                      </button>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={handleSkipForward}
                            className="w-10 h-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                          >
                            <SkipForward className="w-5 h-5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>+5 seconds</TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Time display */}
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-sm font-mono text-muted-foreground">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 w-32">
                      <button
                        onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {volume === 0 ? (
                          <VolumeX className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                      <Slider
                        value={[volume]}
                        max={1}
                        step={0.01}
                        onValueChange={([value]) => setVolume(value)}
                        className="w-20"
                      />
                    </div>
                  </div>

                  {/* Add Annotation */}
                  {selectedVersion.id !== "main" && (
                    <div className="pt-4 border-t border-border/30">
                      {showAddAnnotation ? (
                        <div className="flex items-start gap-3">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{formatTime(currentTime)}</Badge>
                              <div className="flex gap-1">
                                {ANNOTATION_COLORS.map((color) => (
                                  <button
                                    key={color.value}
                                    onClick={() => setNewAnnotationColor(color.value)}
                                    className={cn(
                                      "w-5 h-5 rounded-full transition-all",
                                      newAnnotationColor === color.value && "ring-2 ring-offset-2 ring-offset-background"
                                    )}
                                    style={{ backgroundColor: color.value, '--tw-ring-color': color.value } as React.CSSProperties}
                                  />
                                ))}
                              </div>
                            </div>
                            <Textarea
                              value={newAnnotationText}
                              onChange={(e) => setNewAnnotationText(e.target.value)}
                              placeholder="Add a note at this timestamp..."
                              className="min-h-[80px]"
                              autoFocus
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button size="sm" onClick={handleAddAnnotation} disabled={!newAnnotationText.trim()}>
                              <Save className="w-4 h-4 mr-1" />
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setShowAddAnnotation(false)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button variant="outline" onClick={() => setShowAddAnnotation(true)} className="w-full gap-2">
                          <Plus className="w-4 h-4" />
                          Add Annotation at {formatTime(currentTime)}
                        </Button>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Annotations List */}
              {selectedVersion && selectedVersion.id !== "main" && annotations.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    Annotations
                    <Badge variant="secondary">{annotations.length}</Badge>
                  </h3>
                  <div className="space-y-2">
                    {annotations.map((annotation) => (
                      <ContextMenu key={annotation.id}>
                        <ContextMenuTrigger>
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={cn(
                              "p-4 rounded-lg bg-card/50 border border-border/30",
                              "hover:bg-card/80 transition-colors group",
                              annotation.isTask && "border-primary/30 bg-primary/5"
                            )}
                          >
                            {editingAnnotation === annotation.id ? (
                              <div className="flex items-start gap-3">
                                <Textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  className="flex-1 min-h-[60px]"
                                  autoFocus
                                />
                                <div className="flex flex-col gap-2">
                                  <Button size="sm" onClick={() => handleUpdateAnnotation(annotation.id)}>
                                    <Save className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingAnnotation(null)}>
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-3">
                                <button
                                  onClick={() => handleSeekTo(annotation.timestamp)}
                                  className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors font-mono text-sm"
                                  style={{ borderLeft: `3px solid ${annotation.color}` }}
                                >
                                  {formatTime(annotation.timestamp)}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm leading-relaxed">{annotation.text}</p>
                                  {annotation.isTask && (
                                    <Badge variant="outline" className="text-[10px] mt-1 border-primary/30 text-primary">
                                      Task: {annotation.taskStatus || "todo"}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      setEditingAnnotation(annotation.id)
                                      setEditText(annotation.text)
                                    }}
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => handleDeleteAnnotation(annotation.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem onClick={() => handleSeekTo(annotation.timestamp)}>
                            Jump to {formatTime(annotation.timestamp)}
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => navigator.clipboard.writeText(annotation.text)}>
                            Copy text
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          {annotation.isTask ? (
                            <ContextMenuItem onClick={async () => {
                              if (isElectron()) {
                                await window.electron?.unconvertAnnotationFromTask(annotation.id)
                                await loadProjectTasks()
                                await loadVersions()
                              }
                            }}>
                              Remove from tasks
                            </ContextMenuItem>
                          ) : (
                            <ContextMenuItem onClick={async () => {
                              if (isElectron()) {
                                await window.electron?.convertAnnotationToTask(annotation.id)
                                await loadProjectTasks()
                                await loadVersions()
                              }
                            }}>
                              Convert to task
                            </ContextMenuItem>
                          )}
                          <ContextMenuSeparator />
                          <ContextMenuItem onClick={() => {
                            setEditingAnnotation(annotation.id)
                            setEditText(annotation.text)
                          }}>
                            Edit annotation
                          </ContextMenuItem>
                          <ContextMenuItem className="text-destructive" onClick={() => handleDeleteAnnotation(annotation.id)}>
                            Delete annotation
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ))}
                  </div>
                </div>
              )}

                </div>
              </ScrollArea>
            </TabsContent>

            {/* Analysis Tab */}
            {project.dawType?.toLowerCase().includes("fl studio") && project.dawProjectPath && (
              <TabsContent value="analysis" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full">
                  <div className="p-6">
                    <ProjectAnalysis project={project} />
                  </div>
                </ScrollArea>
              </TabsContent>
            )}

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-6">
                  <ProjectKanban
                    project={project}
                    tasks={projectTasks}
                    taskAnnotations={taskAnnotations}
                    onCreateTask={async (task) => {
                      if (!isElectron()) return
                      await window.electron?.createTask({
                        title: task.title || "Untitled Task",
                        status: task.status || "todo",
                        projectId: project.id,
                        priority: task.priority || "medium",
                        description: task.description || null,
                        dueDate: task.dueDate || null,
                        order: 0,
                        tags: [],
                        comments: [],
                        assignedTo: null,
                        completedAt: null,
                        column: null,
                        groupBy: null,
                      } as Omit<Task, 'id' | 'createdAt' | 'updatedAt'>)
                      await loadProjectTasks()
                      onRefresh()
                    }}
                    onUpdateTask={async (id, updates) => {
                      if (!isElectron()) return
                      await window.electron?.updateTask(id, updates)
                      await loadProjectTasks()
                      onRefresh()
                    }}
                    onDeleteTask={async (id) => {
                      if (!isElectron()) return
                      await window.electron?.deleteTask(id)
                      await loadProjectTasks()
                      onRefresh()
                    }}
                    onReorderTasks={async (items) => {
                      if (!isElectron()) return
                      await window.electron?.reorderTasks(items as { id: string; order: number; status: Task['status'] }[])
                      await loadProjectTasks()
                    }}
                    onConvertAnnotation={async (annotationId) => {
                      if (!isElectron()) return
                      await window.electron?.convertAnnotationToTask(annotationId)
                      await loadProjectTasks()
                    }}
                    onUnconvertAnnotation={async (annotationId) => {
                      if (!isElectron()) return
                      await window.electron?.unconvertAnnotationFromTask(annotationId)
                      await loadProjectTasks()
                    }}
                    onUpdateAnnotationTask={async (annotationId, data) => {
                      if (!isElectron()) return
                      await window.electron?.updateAnnotationTask(annotationId, data)
                      await loadProjectTasks()
                    }}
                    onRefresh={loadProjectTasks}
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Collaboration Tab */}
            <TabsContent value="collaboration" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-6">
                  <CollaborationPanel project={project} onRefresh={onRefresh} />
                </div>
              </ScrollArea>
            </TabsContent>

            {/* VST Plugin Tab */}
            <TabsContent value="plugin" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-6">
                  <PluginStatus
                    sessions={pluginSessions}
                    projects={projects || []}
                    currentProjectId={project.id}
                    onLinkPlugin={onLinkPlugin || (async () => {})}
                    onUnlinkPlugin={onUnlinkPlugin || (async () => {})}
                    onStartRecording={onStartPluginRecording || (async () => {})}
                    onStopRecording={onStopPluginRecording || (async () => {})}
                    onToggleOfflineCapture={onToggleOfflineCapture}
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Distribution Tab */}
            <TabsContent value="distribution" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">

                  {/* Existing links */}
                  {distributionLinks.length > 0 && (
                    <div className="space-y-3">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Link2 className="w-5 h-5 text-primary" />
                        Published Links
                      </h2>
                      <div className="space-y-2">
                        {distributionLinks.map(link => {
                          const platform = DISTRIBUTION_PLATFORMS.find(p => p.key === link.platform)
                          const color = platform?.color || "#6366f1"
                          const name = platform?.name || link.platform
                          return (
                            <motion.div
                              key={link.id}
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/50 group"
                            >
                              {/* Platform color dot */}
                              <div
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold" style={{ color }}>{name}</span>
                                  {link.label && (
                                    <span className="text-xs text-muted-foreground">— {link.label}</span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{link.url}</p>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                                      onClick={() => openExternalUrl(link.url)}
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>Open link</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                                      onClick={() => handleDeleteDistributionLink(link.id)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>Remove</TooltipContent>
                                </Tooltip>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add new link section */}
                  <div className="space-y-3">
                    <h2 className="text-sm font-medium text-muted-foreground">
                      {distributionLinks.length === 0 ? "Where did you publish this?" : "Add another platform"}
                    </h2>

                    {/* Inline input for selected platform */}
                    <AnimatePresence>
                      {addingPlatform && (() => {
                        const platform = DISTRIBUTION_PLATFORMS.find(p => p.key === addingPlatform)!
                        return (
                          <motion.div
                            key="link-input"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div
                              className="p-4 rounded-xl border space-y-3"
                              style={{ borderColor: `${platform.color}40`, backgroundColor: `${platform.color}08` }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold" style={{ color: platform.color }}>
                                  {platform.name}
                                </span>
                                <button
                                  onClick={() => { setAddingPlatform(null); setNewLinkUrl(""); setNewLinkLabel("") }}
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <Input
                                autoFocus
                                value={newLinkUrl}
                                onChange={e => setNewLinkUrl(e.target.value)}
                                placeholder={`Paste your ${platform.name} link`}
                                className="h-9 text-sm"
                                onKeyDown={e => { if (e.key === 'Enter') handleAddDistributionLink() }}
                              />
                              <Input
                                value={newLinkLabel}
                                onChange={e => setNewLinkLabel(e.target.value)}
                                placeholder="Label (optional, e.g. 'Exclusive Beat')"
                                className="h-9 text-sm"
                                onKeyDown={e => { if (e.key === 'Enter') handleAddDistributionLink() }}
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setAddingPlatform(null); setNewLinkUrl(""); setNewLinkLabel("") }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={!newLinkUrl.trim()}
                                  onClick={handleAddDistributionLink}
                                  style={{ backgroundColor: platform.color }}
                                  className="text-white border-0 hover:opacity-90"
                                >
                                  Add Link
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })()}
                    </AnimatePresence>

                    {/* Platform grid — hide already-added platforms */}
                    {(() => {
                      const addedKeys = new Set(distributionLinks.map(l => l.platform))
                      const available = DISTRIBUTION_PLATFORMS.filter(p => !addedKeys.has(p.key) || p.key === "other")
                      if (available.length === 0) return null
                      return (
                        <div className="flex flex-wrap gap-2">
                          {available.map(platform => (
                            <button
                              key={platform.key}
                              onClick={() => { setAddingPlatform(platform.key); setNewLinkUrl(""); setNewLinkLabel("") }}
                              disabled={addingPlatform === platform.key}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                                addingPlatform === platform.key
                                  ? "opacity-50 cursor-default"
                                  : "hover:opacity-100 opacity-70"
                              )}
                              style={{
                                borderColor: `${platform.color}50`,
                                color: platform.color,
                                backgroundColor: `${platform.color}10`,
                              }}
                            >
                              <Globe className="w-3 h-3" />
                              {platform.name}
                            </button>
                          ))}
                        </div>
                      )
                    })()}
                  </div>

                  {distributionLinks.length === 0 && !addingPlatform && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Link2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No distribution links yet</p>
                      <p className="text-xs mt-1 opacity-70">Pick a platform above to add your first link</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </TooltipProvider>
    )
  }

  // Version Card Component
  interface VersionCardProps {
    version: AudioVersion
    isSelected: boolean
    isExpanded: boolean
    annotations: Annotation[]
    currentTime: number
    duration: number
    isPlaying: boolean
    isReady: boolean
    onSelect: () => void
    onToggleExpand: () => void
    onDelete: () => void
    onUpdateName: (name: string) => void
    onSetFavorite: () => void
    onAnalyze: () => void
    isAnalyzing: boolean
    isFavorite: boolean
    formatTime: (seconds: number) => string
    isMain?: boolean
    confirmBeforeDelete?: boolean
  }

  const VersionCard: React.FC<VersionCardProps> = ({
    version,
    isSelected,
    isExpanded,
    annotations,
    currentTime,
    duration,
    isPlaying,
    isReady,
    onSelect,
    onToggleExpand,
    onDelete,
    onUpdateName,
    onSetFavorite,
    onAnalyze,
    isAnalyzing,
    isFavorite,
    formatTime,
    isMain,
    confirmBeforeDelete = true,
  }) => {
    const [isEditing, setIsEditing] = useState(false)
    const [editName, setEditName] = useState(version.name)
    const [pendingDelete, setPendingDelete] = useState(false)

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "group rounded-xl border transition-all overflow-hidden",
          isSelected
            ? "bg-primary/5 border-primary/30"
            : "bg-card/30 border-border/30 hover:bg-card/50"
        )}
      >
        <div 
          className="p-4 flex items-center gap-4 cursor-pointer"
          onClick={onSelect}
        >
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            {isPlaying ? (
              <div className="flex gap-0.5">
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 bg-current rounded-full"
                    animate={{ height: [6, 12, 6] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                  />
                ))}
              </div>
            ) : (
              <FileAudio className="w-5 h-5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            {isEditing && !isMain ? (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8"
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onUpdateName(editName)
                    setIsEditing(false)
                  }}
                >
                  <Save className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-medium truncate">
                    {version.name}
                  </h4>
                  {!isMain && version.source && version.source !== "manual" && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] px-1 py-0 flex-shrink-0",
                        version.source === "offline"
                          ? "border-cyan-500/30 text-cyan-400 bg-cyan-500/10"
                          : version.source === "export"
                            ? "border-green-500/30 text-green-400 bg-green-500/10"
                            : "border-yellow-500/30 text-yellow-400 bg-yellow-500/10"
                      )}
                    >
                      {version.source === "offline" ? "RENDER" : version.source === "export" ? "EXPORT" : "REC"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {isMain ? "Original preview" : `v${version.versionNumber}`}
                  {version.notes && ` • ${version.notes}`}
                </p>
                {/* Audio analysis info */}
                {(version.peakDb != null || version.lufsIntegrated != null) && (
                  <div className="flex items-center gap-2 mt-0.5">
                    {version.peakDb != null && (
                      <span className="text-[10px] font-mono text-muted-foreground/70">
                        Peak: {version.peakDb.toFixed(1)} dB
                      </span>
                    )}
                    {version.rmsDb != null && (
                      <span className="text-[10px] font-mono text-muted-foreground/70">
                        RMS: {version.rmsDb.toFixed(1)} dB
                      </span>
                    )}
                    {version.lufsIntegrated != null && (
                      <span className="text-[10px] font-mono text-primary/70">
                        {version.lufsIntegrated.toFixed(1)} LUFS
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isSelected && isReady && (
              <Badge variant="outline" className="font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </Badge>
            )}
            
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-8 w-8",
                isFavorite ? "text-primary hover:text-primary/80" : "opacity-0 group-hover:opacity-100"
              )}
              onClick={(e) => {
                e.stopPropagation()
                onSetFavorite()
              }}
            >
              <Star className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} />
            </Button>
            
            {!isMain && !isEditing && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                {version.lufsIntegrated == null && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={isAnalyzing}
                        onClick={(e) => {
                          e.stopPropagation()
                          onAnalyze()
                        }}
                      >
                        {isAnalyzing ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <BarChart3 className="w-4 h-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Analyze audio (dB/LUFS)</TooltipContent>
                  </Tooltip>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsEditing(true)
                  }}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                {pendingDelete ? (
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={(e) => { e.stopPropagation(); setPendingDelete(false) }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={(e) => { e.stopPropagation(); setPendingDelete(false); onDelete() }}
                    >
                      Delete
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirmBeforeDelete) setPendingDelete(true)
                      else onDelete()
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}

            {annotations.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                <MessageSquare className="w-3 h-3" />
                {annotations.length}
              </Badge>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  export default ProjectDetail
