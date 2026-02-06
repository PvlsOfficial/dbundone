import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
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
} from "@/components/ui"
import { Waveform } from "@/components/Waveform"
import { Project, AudioVersion, Annotation, AudioPlayerState, Tag } from "@shared/types"

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

const STATUS_CONFIG: Record<string, { title: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  'idea': { title: 'Idea', icon: <Lightbulb className="w-3.5 h-3.5" />, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
  'in-progress': { title: 'In Progress', icon: <Music className="w-3.5 h-3.5" />, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  'mixing': { title: 'Mixing', icon: <Headphones className="w-3.5 h-3.5" />, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  'mastering': { title: 'Mastering', icon: <Disc3 className="w-3.5 h-3.5" />, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
  'completed': { title: 'Completed', icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'text-green-400', bgColor: 'bg-green-500/10' },
  'released': { title: 'Released', icon: <PartyPopper className="w-3.5 h-3.5" />, color: 'text-pink-400', bgColor: 'bg-pink-500/10' },
  'archived': { title: 'Archived', icon: <Archive className="w-3.5 h-3.5" />, color: 'text-gray-400', bgColor: 'bg-gray-500/10' },
}

const isElectron = () => typeof window !== 'undefined' && typeof window.electron !== 'undefined'

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
}) => {
  console.log('ProjectDetail render, project:', project)
  console.log('Project tags:', project?.tags)

  // Helper to get tag color from tags list
  const getTagColor = (tagName: string) => {
    const tag = tags.find(t => t.name === tagName)
    return tag?.color || '#6366f1'
  }

  // Get theme accent color (must be before any conditional returns)
  const { accentColor } = useTheme()

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
  const [newTag, setNewTag] = useState("")
  const [newTagColor, setNewTagColor] = useState("#6366f1")

  // Color presets for tag creation
  const colorPresets = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#78716c', '#64748b', '#71717a'
  ]

  // Computed project with optimistic updates
  const displayProject = optimisticProject ? {
    ...optimisticProject,
    artworkPath: optimisticArtworkPath !== undefined ? optimisticArtworkPath : optimisticProject.artworkPath
  } : {
    ...project,
    artworkPath: optimisticArtworkPath !== undefined ? optimisticArtworkPath : project.artworkPath
  }

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
  const blobUrlRef = useRef<string | null>(null)

  // Load versions
  useEffect(() => {
    if (project?.id) {
      loadVersions()
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

  // Initialize audio when version changes
  useLayoutEffect(() => {
    console.log('useLayoutEffect triggered, selectedVersion:', selectedVersion)
    if (!selectedVersion) {
      console.log('useLayoutEffect: No selected version, returning')
      return
    }

    let isMounted = true // Track if component is still mounted

    // Reset audio state immediately when version changes
    setIsReady(false)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)

    // Clean up previous audio element
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }

    // Clean up previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }

    // Load audio
    const loadAudio = async () => {
      try {
        const arrayBuffer = await window.electron?.loadAudioFile(selectedVersion.filePath)
        if (!arrayBuffer) {
          throw new Error("Failed to load audio file")
        }

        // Determine MIME type based on file extension
        const filePath = selectedVersion.filePath.toLowerCase()
        let mimeType = 'audio/mpeg' // default
        if (filePath.endsWith('.wav')) {
          mimeType = '' // Let browser detect for WAV
        } else if (filePath.endsWith('.flac')) {
          mimeType = 'audio/flac'
        } else if (filePath.endsWith('.ogg')) {
          mimeType = 'audio/ogg'
        } else if (filePath.endsWith('.m4a') || filePath.endsWith('.aac')) {
          mimeType = 'audio/mp4'
        }
        
        const blob = new Blob([arrayBuffer], mimeType ? { type: mimeType } : {})
        const blobUrl = URL.createObjectURL(blob)
        blobUrlRef.current = blobUrl

        // Create new HTML5 audio element
        const audio = new Audio(blobUrl)
        audioRef.current = audio
        
        audio.addEventListener('loadedmetadata', () => {
          if (isMounted) {
            setIsReady(true)
            setDuration(audio.duration || 0)
          }
        })
        audio.addEventListener('timeupdate', () => {
          if (isMounted) {
            setCurrentTime(audio.currentTime)
          }
        })
        audio.addEventListener('ended', () => {
          if (isMounted) {
            setIsPlaying(false)
            setCurrentTime(0)
          }
        })
        audio.addEventListener('play', () => {
          if (isMounted) setIsPlaying(true)
        })
        audio.addEventListener('pause', () => {
          if (isMounted) setIsPlaying(false)
        })
        audio.addEventListener('error', (error) => {
          console.error("HTML5 Audio error:", error)
          if (isMounted) setIsReady(false)
        })
        
      } catch (error) {
        console.error("CRITICAL ERROR in loadAudio:", error)
        console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace')
        setIsReady(false)
      }
    }

    loadAudio()

    return () => {
      isMounted = false // Mark as unmounted
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
    }
  }, [selectedVersion?.id])

  // Add error boundary debugging
  useEffect(() => {
    return () => {
      // Component unmounting cleanup
    }
  })

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  const loadVersions = async (skipAutoSelect: boolean = false): Promise<AudioVersion[] | undefined> => {
    console.log('loadVersions called, project:', project, 'isElectron:', isElectron())
    if (!isElectron() || !project?.id) {
      console.log('loadVersions: Skipping due to missing electron or project id')
      return
    }
    setIsLoading(true)
    try {
      console.log('loadVersions: Calling getVersionsByProject for project:', project.id)
      const data = await window.electron?.getVersionsByProject(project.id)
      console.log('loadVersions: Received data:', data)
      setVersions(data || [])
      
      if (skipAutoSelect) {
        return data
      }
      
      // If project has an audio preview, create a "Main" version entry if none exists
      if (data?.length === 0 && project.audioPreviewPath) {
        console.log('loadVersions: Creating main preview version')
        // Select the project's main audio as default
        setSelectedVersion({
          id: "main",
          projectId: project.id,
          name: "Main Preview",
          filePath: project.audioPreviewPath,
          notes: null,
          versionNumber: 0,
          createdAt: project.createdAt,
        })
      } else if (data && data.length > 0) {
        console.log('loadVersions: Setting selected version to first version:', data[0])
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
      // Open file picker in the project's DAW folder if available
      const defaultPath = project.dawProjectPath || undefined
      const filePath = await window.electron?.selectAudio(defaultPath || undefined)
      if (filePath) {
        // Check if this will be auto-starred (first version or no favorite set)
        const willAutoStar = versions.length === 0 || !project.favoriteVersionId
        
        // Extract filename without extension for the version name
        const filename = filePath.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, '') || `Version ${versions.length + 1}`
        const version = await window.electron?.createVersion({
          projectId: project.id,
          name: filename,
          filePath,
          notes: null,
        })
        if (version) {
          await loadVersions()
          setSelectedVersion(version)
          
          // Optimistically set favorite if auto-starred
          if (willAutoStar) {
            setOptimisticFavoriteId(version.id)
          }
          
          // Refresh project data to sync with database
          onRefresh()
        }
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

  const handleDeleteVersion = async (versionId: string) => {
    if (!isElectron() || versionId === "main") return
    if (!confirm("Delete this version and all its annotations?")) return
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
            versionNumber: 0,
            createdAt: project.createdAt,
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
                onClick={handleChangeArtwork}
                title="Click to change artwork"
              >
                {(() => {
                  const currentArtworkPath = optimisticArtworkPath !== undefined ? optimisticArtworkPath : project.artworkPath
                  return currentArtworkPath ? (
                    <img
                      src={`appfile://${currentArtworkPath.replace(/\\/g, "/")}`}
                      alt={project.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <Music className="w-8 h-8 text-primary" />
                    </div>
                  )
                })()}
                {/* Overlay with change/remove icons */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
                  {(() => {
                    const currentArtworkPath = optimisticArtworkPath !== undefined ? optimisticArtworkPath : project.artworkPath
                    return currentArtworkPath && (
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleRemoveArtwork()
                          return false
                        }}
                        className="p-1.5 bg-destructive/80 hover:bg-destructive rounded-full text-white transition-colors z-10"
                        title="Remove artwork"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )
                  })()}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleChangeArtwork()
                      return false
                    }}
                    className="p-1.5 bg-primary/80 hover:bg-primary rounded-full text-white transition-colors z-10"
                    title="Change artwork"
                  >
                    <Image className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Project Info */}
              <div className="flex-1 min-w-0">
                {isEditingProject ? (
                  <div className="space-y-6 p-4 bg-muted/30 rounded-lg border">
                    {/* Project Title */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Project Title</label>
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="text-xl font-bold"
                        placeholder="Enter project title"
                      />
                    </div>

                    {/* Musical Properties */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Musical Properties</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* BPM - Only show for Ableton projects */}
                        {project.dawType?.toLowerCase().includes('ableton') && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">BPM</label>
                            <Input
                              type="number"
                              value={editBpm || ""}
                              onChange={(e) => setEditBpm(parseInt(e.target.value) || 0)}
                              placeholder="120"
                              className="w-full"
                            />
                          </div>
                        )}

                        {/* Musical Key Root */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">Key Root</label>
                          <Select value={editKeyRoot} onValueChange={setEditKeyRoot}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select key" />
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

                        {/* Musical Key Mode */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">Key Mode</label>
                          <Select value={editKeyMode} onValueChange={setEditKeyMode} disabled={editKeyRoot === "None"}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select mode" />
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
                    </div>

                    {/* Tags */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-foreground uppercase tracking-wide">Tags</label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {editTags.map((tag) => {
                          const tagColor = getTagColor(tag)
                          return (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="gap-1 border-0"
                              style={{
                                backgroundColor: `${tagColor}20`,
                                color: tagColor
                              }}
                            >
                              {tag}
                              <X
                                className="w-3 h-3 cursor-pointer hover:opacity-70"
                                onClick={() => removeTag(tag)}
                              />
                            </Badge>
                          )
                        })}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          placeholder="Add a tag..."
                          onKeyPress={(e) => e.key === 'Enter' && addTag()}
                          className="flex-1"
                        />
                        <Button type="button" variant="outline" onClick={addTag} disabled={!newTag.trim()}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-3">
                        {tags.filter(tag => !editTags.includes(tag.name)).slice(0, 6).map((tag) => (
                          <Button
                            key={tag.id}
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs border-0"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color
                            }}
                            onClick={() => {
                              setEditTags([...editTags, tag.name])
                              setNewTag("")
                            }}
                          >
                            + {tag.name}
                          </Button>
                        ))}
                        {/* Create new tag button when typing */}
                        {newTag.trim() && !tags.some(t => t.name.toLowerCase() === newTag.trim().toLowerCase()) && (
                          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border mt-2">
                            <div className="flex flex-wrap gap-1">
                              {colorPresets.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  title={`Select color ${color}`}
                                  className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                                    newTagColor === color ? 'border-white ring-2 ring-offset-1 ring-offset-background ring-primary' : 'border-transparent'
                                  }`}
                                  style={{ backgroundColor: color }}
                                  onClick={() => setNewTagColor(color)}
                                />
                              ))}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs hover:bg-primary/30"
                              style={{
                                backgroundColor: `${newTagColor}20`,
                                color: newTagColor
                              }}
                              onClick={async () => {
                                const tagName = newTag.trim();
                                await onCreateTag(tagName, newTagColor);
                                setEditTags([...editTags, tagName]);
                                setNewTag("");
                                setNewTagColor("#6366f1");
                              }}
                            >
                              Create "{newTag.trim()}"
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* DAW Project File */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-foreground uppercase tracking-wide">DAW Project File</label>
                      <div className="flex gap-2">
                        <Input
                          value={editDawProjectPath || ""}
                          readOnly
                          placeholder="No file selected"
                          className="flex-1"
                        />
                        <Button variant="outline" onClick={handleSelectProject}>
                          <Folder className="w-4 h-4 mr-2" />
                          Browse
                        </Button>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4 border-t">
                      <Button onClick={handleSaveProject} className="flex-1">
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditingProject(false)}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold truncate">{displayProject.title}</h1>
                      {displayProject.status && STATUS_CONFIG[displayProject.status] && (
                        <Badge 
                          variant="secondary" 
                          className={`${STATUS_CONFIG[displayProject.status].bgColor} ${STATUS_CONFIG[displayProject.status].color} border-0 gap-1`}
                        >
                          {STATUS_CONFIG[displayProject.status].icon}
                          {STATUS_CONFIG[displayProject.status].title}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {displayProject.bpm > 0 && (
                        <span>{displayProject.bpm} BPM</span>
                      )}
                      {displayProject.timeSpent && displayProject.timeSpent > 0 && (
                        <span>{displayProject.timeSpent}m</span>
                      )}
                      {displayProject.musicalKey !== "None" && (
                        <span>• {displayProject.musicalKey}</span>
                      )}
                      {displayProject.collectionName && (
                        <Badge variant="outline">{displayProject.collectionName}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>Created: {new Date(displayProject.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>Updated: {new Date(displayProject.updatedAt).toLocaleDateString()}</span>
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
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {!isEditingProject && (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingProject(true)}>
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                )}
                {project.dawProjectPath && (
                  <Button variant="outline" size="sm" onClick={() => onOpenDaw(project)}>
                    <Folder className="w-4 h-4 mr-1" />
                    Open in DAW
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Version Selector & Add Version */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileAudio className="w-5 h-5 text-primary" />
                Audio Versions
                <Badge variant="secondary">{versions.length + (project.audioPreviewPath ? 1 : 0)}</Badge>
              </h2>
              <Button onClick={handleAddVersion} size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Version
              </Button>
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
                    versionNumber: 0,
                    createdAt: project.createdAt,
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
                    versionNumber: 0,
                    createdAt: project.createdAt,
                  })}
                  onToggleExpand={() => toggleVersionExpanded("main")}
                  onDelete={() => {}}
                  onUpdateName={() => {}}
                  onSetFavorite={() => handleSetFavorite("main")}
                  isFavorite={effectiveFavoriteId === "main"}
                  formatTime={formatTime}
                  isMain
                />
              )}

              {/* Other Versions */}
              {versions.map((version) => (
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
                  isFavorite={effectiveFavoriteId === version.id}
                  formatTime={formatTime}
                />
              ))}

              {versions.length === 0 && !project.audioPreviewPath && (
                <div className="text-center py-12 text-muted-foreground">
                  <FileAudio className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No audio versions yet</p>
                  <p className="text-sm">Add your first version to start tracking changes</p>
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
                    <motion.div
                      key={annotation.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "p-4 rounded-lg bg-card/50 border border-border/30",
                        "hover:bg-card/80 transition-colors group"
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
                          <p className="flex-1 text-sm leading-relaxed">{annotation.text}</p>
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
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
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
  isFavorite: boolean
  formatTime: (seconds: number) => string
  isMain?: boolean
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
  isFavorite,
  formatTime,
  isMain,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(version.name)

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
              <h4 className="font-medium truncate">
                {version.filePath ? version.filePath.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, '') || version.name : version.name}
              </h4>
              <p className="text-xs text-muted-foreground truncate">
                {isMain ? "Original preview" : `v${version.versionNumber}`}
                {version.name && version.name !== version.filePath?.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, '') && ` • ${version.name}`}
                {version.notes && ` • ${version.notes}`}
              </p>
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
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
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
