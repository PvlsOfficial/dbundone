import React, { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Image,
  Sparkles,
  Shuffle,
  Trash2,
  Check,
  Clock,
  Upload,
  X,
  Loader2,
  Music,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn, invalidateImageCache } from "@/lib/utils"
import { useImageUrl } from "@/hooks/useImageUrl"
import { loadImageUrl } from "@/lib/utils"
import type { Project, ArtworkHistoryEntry, AppSettings } from "@shared/types"

interface ArtworkManagerProps {
  project: Project
  isOpen: boolean
  onClose: () => void
  settings: AppSettings
  onChangeArtwork: (project: Project) => Promise<void>
  onRemoveArtwork: (project: Project) => Promise<void>
  onGenerateArtwork: (project: Project) => Promise<void>
  onFetchUnsplashPhoto: (project: Project) => Promise<void>
  onRefresh: () => void
}

const SOURCE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  file: { label: "File", icon: <Upload className="w-3 h-3" /> },
  ai: { label: "AI Generated", icon: <Sparkles className="w-3 h-3" /> },
  unsplash: { label: "Unsplash", icon: <Shuffle className="w-3 h-3" /> },
}

function HistoryThumbnail({
  entry,
  isActive,
  onSelect,
  onDelete,
}: {
  entry: ArtworkHistoryEntry
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    loadImageUrl(entry.filePath).then((result) => {
      setUrl(result)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [entry.filePath])

  const sourceInfo = SOURCE_LABELS[entry.source] || SOURCE_LABELS.file
  const date = new Date(entry.createdAt)
  const timeStr = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative group rounded-lg overflow-hidden border-2 transition-all cursor-pointer",
        isActive
          ? "border-primary shadow-lg shadow-primary/20"
          : "border-border/30 hover:border-border/60"
      )}
      onClick={onSelect}
    >
      <div className="aspect-square bg-muted">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          </div>
        ) : url ? (
          <img src={url} alt="History" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="w-5 h-5 text-muted-foreground/50" />
          </div>
        )}
      </div>

      {/* Active indicator */}
      {isActive && (
        <div className="absolute top-1.5 left-1.5 p-1 rounded-full bg-primary text-primary-foreground">
          <Check className="w-3 h-3" />
        </div>
      )}

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-destructive transition-all"
        title="Remove from history"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Info overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center gap-1 text-[10px] text-white/80">
          {sourceInfo.icon}
          <span>{sourceInfo.label}</span>
        </div>
        <div className="text-[10px] text-white/60 mt-0.5">{timeStr}</div>
      </div>
    </motion.div>
  )
}

export const ArtworkManager: React.FC<ArtworkManagerProps> = ({
  project,
  isOpen,
  onClose,
  settings,
  onChangeArtwork,
  onRemoveArtwork,
  onGenerateArtwork,
  onFetchUnsplashPhoto,
  onRefresh,
}) => {
  const [history, setHistory] = useState<ArtworkHistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const artworkUrl = useImageUrl(project.artworkPath)

  const loadHistory = useCallback(async () => {
    setIsLoading(true)
    try {
      const entries = await window.electron?.getArtworkHistory(project.id)
      if (entries) setHistory(entries)
    } catch (error) {
      console.error("Failed to load artwork history:", error)
    } finally {
      setIsLoading(false)
    }
  }, [project.id])

  useEffect(() => {
    if (isOpen) {
      loadHistory()
    }
  }, [isOpen, loadHistory, project.artworkPath])

  // Helper: invalidate cache + refresh project + reload history
  const refreshAfterChange = async () => {
    invalidateImageCache()
    await onRefresh()
    await loadHistory()
  }

  const handleSelectFromFile = async () => {
    setActionLoading("file")
    try {
      await onChangeArtwork(project)
      await refreshAfterChange()
    } finally {
      setActionLoading(null)
    }
  }

  const handleGenerateAI = async () => {
    setActionLoading("ai")
    try {
      await onGenerateArtwork(project)
      await refreshAfterChange()
    } finally {
      setActionLoading(null)
    }
  }

  const handleFetchUnsplash = async () => {
    setActionLoading("unsplash")
    try {
      await onFetchUnsplashPhoto(project)
      await refreshAfterChange()
    } finally {
      setActionLoading(null)
    }
  }

  const handleRemove = async () => {
    setActionLoading("remove")
    try {
      await onRemoveArtwork(project)
      invalidateImageCache()
      await onRefresh()
    } finally {
      setActionLoading(null)
    }
  }

  const handleSelectFromHistory = async (entry: ArtworkHistoryEntry) => {
    if (entry.filePath === project.artworkPath) return
    try {
      await window.electron?.setArtworkFromHistory(project.id, entry.filePath)
      invalidateImageCache()
      await onRefresh()
    } catch (error) {
      console.error("Failed to set artwork from history:", error)
    }
  }

  const handleDeleteHistoryEntry = async (entry: ArtworkHistoryEntry) => {
    try {
      await window.electron?.deleteArtworkHistoryEntry(entry.id)
      setHistory((prev) => prev.filter((e) => e.id !== entry.id))
    } catch (error) {
      console.error("Failed to delete history entry:", error)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[680px] bg-card/95 backdrop-blur-xl border-border/50 max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="w-5 h-5 text-primary" />
            Artwork Manager
          </DialogTitle>
          <DialogDescription>
            Manage artwork for "{project.title}"
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* Current Artwork Preview */}
          <div className="flex gap-4 items-start">
            <div className="relative w-32 h-32 rounded-xl overflow-hidden bg-muted flex-shrink-0 border border-border/30">
              {artworkUrl ? (
                <img
                  src={artworkUrl}
                  alt={project.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                  <Music className="w-10 h-10 text-primary/40" />
                  <span className="text-[10px] text-muted-foreground mt-1">No artwork</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-foreground mb-2">Set artwork from:</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 justify-start"
                  onClick={handleSelectFromFile}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === "file" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Choose File
                </Button>

                {settings.autoGenerateArtwork && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 justify-start"
                    onClick={handleGenerateAI}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === "ai" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    AI Generate
                  </Button>
                )}

                {settings.unsplashEnabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 justify-start"
                    onClick={handleFetchUnsplash}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === "unsplash" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Shuffle className="w-4 h-4" />
                    )}
                    Random Photo
                  </Button>
                )}

                {project.artworkPath && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 justify-start text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={handleRemove}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === "remove" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* History Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Artwork History</h3>
              <span className="text-xs text-muted-foreground">
                ({history.length} {history.length === 1 ? "entry" : "entries"})
              </span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Image className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No artwork history yet</p>
                <p className="text-xs mt-1">
                  Past artwork will appear here when you change images
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                <AnimatePresence>
                  {history.map((entry) => (
                    <HistoryThumbnail
                      key={entry.id}
                      entry={entry}
                      isActive={entry.filePath === project.artworkPath}
                      onSelect={() => handleSelectFromHistory(entry)}
                      onDelete={() => handleDeleteHistoryEntry(entry)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ArtworkManager
