import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Image, Music, FileAudio, Folder, Plus, Loader2, Sparkles } from "lucide-react"
import { Project } from "@shared/types"
import { cn } from "@/lib/utils"
import {
  Button,
  Input,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/ui"

interface ProjectModalProps {
  project?: Project | null
  isOpen: boolean
  onClose: () => void
  tags?: Tag[]
  onCreateTag?: (name: string, color?: string) => Promise<Tag | null>
}

const MUSICAL_KEY_ROOTS = [
  "None", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
]

const MUSICAL_KEY_MODES = [
  "Major", "Minor", "Mixolydian", "Dorian", "Phrygian", "Lydian", "Locrian",
  "Aeolian", "Ionian", "Pentatonic Major", "Pentatonic Minor", "Blues"
]

export const ProjectModal: React.FC<ProjectModalProps> = ({ project, isOpen, onClose, tags = [], onCreateTag }) => {
  const [title, setTitle] = useState("")
  const [artworkPath, setArtworkPath] = useState<string | null>(null)
  const [audioPreviewPath, setAudioPreviewPath] = useState<string | null>(null)
  const [dawProjectPath, setDawProjectPath] = useState<string | null>(null)
  const [dawType, setDawType] = useState<string | null>(null)
  const [bpm, setBpm] = useState(0)
  const [musicalKeyRoot, setMusicalKeyRoot] = useState("None")
  const [musicalKeyMode, setMusicalKeyMode] = useState("Major")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [collectionName, setCollectionName] = useState<string | null>(null)
  const [newTag, setNewTag] = useState("")
  const [newTagColor, setNewTagColor] = useState("#6366f1")
  const [isSaving, setIsSaving] = useState(false)
  const [imageError, setImageError] = useState(false)

  // Color presets for tag creation
  const colorPresets = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#78716c', '#64748b', '#71717a'
  ]

  // Helper to get tag color from tags list
  const getTagColor = (tagName: string) => {
    const tag = tags.find(t => t.name === tagName)
    return tag?.color || '#6366f1'
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

  useEffect(() => {
    if (project) {
      setTitle(project.title)
      setArtworkPath(project.artworkPath)
      setAudioPreviewPath(project.audioPreviewPath)
      setDawProjectPath(project.dawProjectPath)
      setDawType(project.dawType)
      setBpm(project.bpm)
      const { root, mode } = parseMusicalKey(project.musicalKey)
      setMusicalKeyRoot(root)
      setMusicalKeyMode(mode)
      setSelectedTags(project.tags || [])
      setCollectionName(project.collectionName)
    } else {
      resetForm()
    }
    setImageError(false)
  }, [project, isOpen])

  const resetForm = () => {
    setTitle("")
    setArtworkPath(null)
    setAudioPreviewPath(null)
    setDawProjectPath(null)
    setDawType(null)
    setBpm(0)
    setMusicalKeyRoot("None")
    setMusicalKeyMode("Major")
    setSelectedTags([])
    setCollectionName(null)
    setNewTag("")
  }

  const handleRemoveArtwork = () => {
    setArtworkPath(null)
    setImageError(false)
  }

  const handleSelectArtwork = async () => {
    const path = await window.electron?.selectImage()
    if (path) {
      setArtworkPath(path)
      setImageError(false)
    }
  }

  const handleSelectAudio = async () => {
    const path = await window.electron?.selectAudio()
    if (path) setAudioPreviewPath(path)
  }

  const handleSelectProject = async () => {
    const path = await window.electron?.selectProject()
    if (path) {
      setDawProjectPath(path)
      const ext = path.split(".").pop()?.toLowerCase()
      if (ext === "als") setDawType("Ableton Live")
      else if (ext === "flp") setDawType("FL Studio")
      else if (ext === "logic") setDawType("Logic Pro")
      else if (ext === "ptx") setDawType("Pro Tools")
      else if (ext === "cpr") setDawType("Cubase")
      else if (ext === "rpp") setDawType("Reaper")
    }
  }

  const addTag = () => {
    if (newTag.trim() && !selectedTags.includes(newTag.trim())) {
      setSelectedTags([...selectedTags, newTag.trim()])
      setNewTag("")
    }
  }

  const handleRemoveTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag))
  }

  const handleSave = async () => {
    if (!title.trim()) return

    setIsSaving(true)
    try {
      const projectData = {
        title: title.trim(),
        artworkPath,
        audioPreviewPath,
        dawProjectPath,
        dawType,
        bpm,
        musicalKey: musicalKeyRoot === "None" ? "None" : `${musicalKeyRoot} ${musicalKeyMode}`,
        tags: selectedTags,
        collectionName: collectionName?.trim() || null,
        status: project?.status || "idea" as const,
        favoriteVersionId: null,
        fileModifiedAt: null,
        archived: false,
        timeSpent: project?.timeSpent || null,
      }

      if (project) {
        await window.electron?.updateProject(project.id, projectData)
      } else {
        await window.electron?.createProject(projectData)
      }

      onClose()
    } catch (error) {
      console.error("Failed to save project:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!project) return

    if (confirm("Are you sure you want to delete this project?")) {
      try {
        await window.electron?.deleteProject(project.id)
        onClose()
      } catch (error) {
        console.error("Failed to delete project:", error)
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {project ? "Edit Project" : "New Project"}
          </DialogTitle>
          <DialogDescription>
            {project
              ? "Update your project details below"
              : "Add a new music project to your library"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Artwork and Title Row */}
          <div className="flex gap-4">
            {/* Artwork Picker */}
            <button
              onClick={handleSelectArtwork}
              className={cn(
                "relative w-32 h-32 rounded-xl overflow-hidden flex-shrink-0",
                "bg-muted/50 border-2 border-dashed border-muted-foreground/30",
                "hover:border-primary/50 hover:bg-muted/70 transition-all duration-200",
                "group"
              )}
            >
              {artworkPath && !imageError ? (
                <>
                  <img
                    src={`appfile://${artworkPath.replace(/\\/g, "/")}`}
                    alt="Artwork"
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleRemoveArtwork()
                        return false
                      }}
                      className="p-1.5 bg-destructive/80 hover:bg-destructive rounded-full text-white transition-colors z-10"
                      title="Remove artwork"
                      aria-label="Remove artwork"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleSelectArtwork()
                        return false
                      }}
                      className="p-1.5 bg-primary/80 hover:bg-primary rounded-full text-white transition-colors z-10"
                      title="Change artwork"
                      aria-label="Change artwork"
                    >
                      <Image className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                  <Image className="w-8 h-8 mb-2 opacity-50" />
                  <span className="text-xs">Add Artwork</span>
                </div>
              )}
            </button>

            {/* Title and Collection */}
            <div className="flex-1 space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Title *
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Project title"
                  className="bg-muted/30"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Collection
                </label>
                <Input
                  value={collectionName || ""}
                  onChange={(e) => setCollectionName(e.target.value)}
                  placeholder="e.g., Album name, EP"
                  className="bg-muted/30"
                />
              </div>
            </div>
          </div>

          {/* BPM and Key Row */}
          <div className="grid grid-cols-3 gap-4">
            {project && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  BPM
                </label>
                <Input
                  type="number"
                  min={0}
                  max={999}
                  value={bpm || ""}
                  onChange={(e) => setBpm(parseInt(e.target.value) || 0)}
                  placeholder="120"
                  className="bg-muted/30"
                />
              </div>
            )}
            <div className={project ? "" : "col-span-2"}>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Key
              </label>
              <Select value={musicalKeyRoot} onValueChange={setMusicalKeyRoot}>
                <SelectTrigger className="bg-muted/30">
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
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Mode
              </label>
              <Select value={musicalKeyMode} onValueChange={setMusicalKeyMode} disabled={musicalKeyRoot === "None"}>
                <SelectTrigger className="bg-muted/30">
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

          {/* Tags */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Tags
            </label>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedTags.map((tag) => {
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
                      <button
                        aria-label={`Remove tag ${tag}`}
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 p-0.5 rounded-full hover:opacity-80"
                      >
                        <X className="w-3 h-3" />
                      </button>
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
                <Button type="button" variant="outline" onClick={addTag} disabled={!newTag.trim()} aria-label="Add tag">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.filter(tag => !selectedTags.includes(tag.name)).slice(0, 6).map((tag) => (
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
                      setSelectedTags([...selectedTags, tag.name])
                      setNewTag("")
                    }}
                  >
                    + {tag.name}
                  </Button>
                ))}
                {/* Create new tag button when typing */}
                {newTag.trim() && !tags.some(t => t.name.toLowerCase() === newTag.trim().toLowerCase()) && (
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md border">
                    <span className="text-xs text-muted-foreground">Create new tag:</span>
                    <div className="flex gap-1">
                        {colorPresets.slice(0, 8).map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-label={`Select color ${color}`}
                          className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 ${
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
                        if (onCreateTag) {
                          const tagName = newTag.trim();
                          await onCreateTag(tagName, newTagColor);
                          setSelectedTags([...selectedTags, tagName]);
                          setNewTag("");
                        }
                      }}
                    >
                      Create "{newTag.trim()}"
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* File Pickers */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Audio Preview
              </label>
              <div className="flex gap-2">
                <Input
                  value={audioPreviewPath || ""}
                  readOnly
                  placeholder="No file selected"
                  className="bg-muted/30 flex-1"
                />
                <Button variant="secondary" onClick={handleSelectAudio}>
                  <FileAudio className="w-4 h-4 mr-2" />
                  Browse
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                DAW Project File
              </label>
              <div className="flex gap-2">
                <Input
                  value={dawProjectPath || ""}
                  readOnly
                  placeholder="No file selected"
                  className="bg-muted/30 flex-1"
                />
                <Button variant="secondary" onClick={handleSelectProject}>
                  <Folder className="w-4 h-4 mr-2" />
                  Browse
                </Button>
              </div>
              {dawType && (
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                  <Music className="w-3 h-3" />
                  Detected: {dawType}
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          {project && (
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!title.trim() || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Project"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ProjectModal
