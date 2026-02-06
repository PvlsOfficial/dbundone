import React, { useState, useEffect, useRef, memo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play, Pause, Music, ExternalLink, Check, Sparkles, Loader2, Image, Trash2, FolderOpen, Shuffle, Clock, Lightbulb, Headphones, Disc3, CheckCircle2, PartyPopper, Archive } from "lucide-react"
import { Project, Tag } from "@shared/types"
import { cn, formatTimeSpent } from "@/lib/utils"
import { Badge, Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui"

interface ProjectCardProps {
  project: Project
  tags?: Tag[]
  onEdit: (project: Project) => void
  onPlay?: (project: Project) => Promise<void>
  onStop?: () => void
  onOpenDaw?: (project: Project) => void
  onGenerateArtwork?: (project: Project) => void
  onChangedArtwork?: (project: Project) => void
  onChangeArtwork?: (project: Project) => void
  onRemoveArtwork?: (project: Project) => void
  onFetchUnsplashPhoto?: (project: Project) => void
  onDelete?: (project: Project) => void
  onRemove?: (project: Project) => void
  onOpenProject?: (project: Project) => void
  isSelected?: boolean
  isPlaying?: boolean
  onSelect?: (project: Project) => void
  selectionMode?: boolean
  viewMode?: "grid" | "list"
  gridSize?: "small" | "medium" | "large"
}

export const ProjectCard = memo((props: ProjectCardProps) => {
  const {
    project,
    onEdit,
    onPlay,
    onOpenDaw,
    onGenerateArtwork,
    onChangeArtwork,
    onRemoveArtwork,
    onFetchUnsplashPhoto,
    onDelete,
    onRemove,
    onOpenProject,
    isSelected = false,
    isPlaying = false,
    onSelect,
    selectionMode,
    viewMode = "grid",
    gridSize = "medium",
  } = props
  const [isHovered, setIsHovered] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isGeneratingArt, setIsGeneratingArt] = useState(false)

  // Memoized tag color function to prevent recalculation
  const getTagColor = useCallback((tagName: string) => {
    const tag = props.tags?.find(t => t.name === tagName)
    return tag?.color || '#6366f1'
  }, [props.tags])

  const handlePlayClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if ((project.audioPreviewPath || project.favoriteVersionId) && onPlay) {
      await onPlay(project)
    }
  }

  const handleDawClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (project.dawProjectPath && onOpenDaw) {
      onOpenDaw(project)
    }
  }

  const handleCardClick = () => {
    if (selectionMode && onSelect) {
      onSelect(project)
    } else if (onOpenProject) {
      onOpenProject(project)
    } else {
      onEdit(project)
    }
  }

  const handleGenerateArt = async () => {
    if (onGenerateArtwork) {
      setIsGeneratingArt(true)
      await onGenerateArtwork(project)
      setIsGeneratingArt(false)
    }
  }

  const handleChangeArtwork = async () => {
    if (onChangeArtwork) {
      await onChangeArtwork(project)
    }
  }

  const handleRemoveArtwork = async () => {
    if (onRemoveArtwork) {
      await onRemoveArtwork(project)
    }
  }

  const handleFetchUnsplashPhoto = async () => {
    if (onFetchUnsplashPhoto) {
      setIsGeneratingArt(true)
      await onFetchUnsplashPhoto(project)
      setIsGeneratingArt(false)
    }
  }

  const handleOpenProjectFolder = async () => {
    if (project.dawProjectPath) {
      try {
        // Extract directory from the file path
        const folderPath = project.dawProjectPath.substring(0, project.dawProjectPath.lastIndexOf('\\')) || 
                          project.dawProjectPath.substring(0, project.dawProjectPath.lastIndexOf('/'))
        if (folderPath) {
          await window.electron?.openFolder(folderPath)
        }
      } catch (error) {
        console.error("Failed to open project folder:", error)
      }
    }
  }


  const getDawBadge = () => {
    const dawType = project.dawType?.toLowerCase() || ""
    if (dawType.includes("fl") || dawType.includes("fruity")) return "FL"
    if (dawType.includes("ableton") || dawType.includes("als")) return "Live"
    if (dawType.includes("logic")) return "Logic"
    return "DAW"
  }

  const STATUS_CONFIG: Record<string, { title: string; icon: React.ReactNode; color: string; bgColor: string }> = {
    'idea': { title: 'Idea', icon: <Lightbulb className="w-3 h-3" />, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
    'in-progress': { title: 'In Progress', icon: <Music className="w-3 h-3" />, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    'mixing': { title: 'Mixing', icon: <Headphones className="w-3 h-3" />, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
    'mastering': { title: 'Mastering', icon: <Disc3 className="w-3 h-3" />, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
    'completed': { title: 'Completed', icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-green-400', bgColor: 'bg-green-500/10' },
    'released': { title: 'Released', icon: <PartyPopper className="w-3 h-3" />, color: 'text-pink-400', bgColor: 'bg-pink-500/10' },
    'archived': { title: 'Archived', icon: <Archive className="w-3 h-3" />, color: 'text-gray-400', bgColor: 'bg-gray-500/10' },
  }

  return (
    <TooltipProvider>
      <ContextMenu>
        <ContextMenuTrigger>
          {viewMode === "list" ? (
            // List View Layout - Horizontal and Compact
            <motion.div
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              whileHover={{ x: 4 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "group relative rounded-xl overflow-hidden cursor-pointer",
                "bg-card/50 backdrop-blur-sm border border-border/30",
                "hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
                "transition-all duration-300 p-3",
                isSelected && "ring-2 ring-primary border-primary/50"
              )}
              onClick={handleCardClick}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <div className="flex items-center gap-4">
                {/* Selection Checkbox */}
                <AnimatePresence>
                  {selectionMode && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelect?.(project)
                        }}
                        aria-label={`Select project ${project.title}`}
                        className={cn(
                          "w-5 h-5 rounded-md flex items-center justify-center transition-all duration-200",
                          "border-2",
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "bg-background/80 border-muted-foreground/50 hover:border-primary"
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Playable Artwork */}
                <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 group/artwork">
                  {project.artworkPath && !imageError ? (
                    <img
                      src={`appfile://${project.artworkPath.replace(/\\/g, "/")}`}
                      alt={project.title}
                      className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
                      onLoad={() => setImageError(false)}
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
                      <Music className="w-6 h-6 text-muted-foreground/30" />
                    </div>
                  )}

                  {/* Play Button Overlay */}
                  {(project.audioPreviewPath || project.favoriteVersionId) && (
                    <div
                      className={cn(
                        "absolute inset-0 bg-black/40 flex items-center justify-center transition-all duration-300",
                        "opacity-0 group-hover/artwork:opacity-100",
                        isPlaying && "opacity-100"
                      )}
                    >
                      <button
                        onClick={handlePlayClick}
                        aria-label={isPlaying ? `Pause ${project.title}` : `Play ${project.title}`}
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          "bg-primary/90 backdrop-blur-sm text-primary-foreground",
                          "shadow-lg shadow-primary/30",
                          "hover:bg-primary hover:scale-105 active:scale-95",
                          "transition-all duration-200",
                          isPlaying && "animate-pulse"
                        )}
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5 ml-0.5" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* Remove Button Overlay */}
                  {onRemove && (
                    <div
                      className={cn(
                        "absolute top-2 right-2 transition-all duration-300",
                        "opacity-0 group-hover:opacity-100"
                      )}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemove(project)
                        }}
                        aria-label={`Remove ${project.title}`}
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center",
                          "bg-destructive/90 backdrop-blur-sm text-destructive-foreground",
                          "shadow-lg shadow-destructive/30",
                          "hover:bg-destructive hover:scale-105 active:scale-95",
                          "transition-all duration-200"
                        )}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Loading overlay for artwork generation */}
                  {isGeneratingArt && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                </div>

                {/* DAW Button - Right next to artwork */}
                {project.dawType && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleDawClick}
                        aria-label={`Open ${project.title} in DAW`}
                        className={cn(
                          "px-3 py-2 rounded-lg text-xs font-medium flex-shrink-0",
                          "bg-primary/10 hover:bg-primary hover:text-primary-foreground",
                          "transition-all duration-200"
                        )}
                      >
                        {getDawBadge()}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Open in DAW</TooltipContent>
                  </Tooltip>
                )}

                {/* Content - All Horizontal */}
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  {/* Left Side - Title and Basic Info */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {/* Project Number/ID */}
                    <div className="text-sm font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                      #{project.id.slice(-4).toUpperCase()}
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {project.title}
                    </h3>

                    {/* Status Badge */}
                    {STATUS_CONFIG[project.status] && (
                      <Badge
                        variant="secondary"
                        className={`text-xs capitalize gap-1 ${STATUS_CONFIG[project.status].bgColor} ${STATUS_CONFIG[project.status].color} border-0`}
                      >
                        {STATUS_CONFIG[project.status].icon}
                        {STATUS_CONFIG[project.status].title}
                      </Badge>
                    )}

                    {/* Collection */}
                    {project.collectionName && (
                      <span className="text-sm text-muted-foreground truncate max-w-32">
                        {project.collectionName}
                      </span>
                    )}
                  </div>

                  {/* Right Side - Technical Info */}
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    {/* BPM */}
                    {project.bpm > 0 && (
                      <span className="font-medium">{project.bpm} BPM</span>
                    )}

                    {/* Time Spent */}
                    {project.timeSpent && project.timeSpent > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimeSpent(project.timeSpent)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Time spent on this project</TooltipContent>
                      </Tooltip>
                    )}

                    {/* Key */}
                    {project.musicalKey && project.musicalKey !== "None" && (
                      <span className="font-medium">{project.musicalKey}</span>
                    )}

                    {/* Tags */}
                    {project.tags && project.tags.length > 0 && (
                      <div className="flex gap-1">
                        {project.tags.slice(0, 2).map((tag, index) => (
                          <Badge 
                            key={index} 
                            variant="secondary" 
                            className="text-xs px-2 py-0.5 border-0"
                            style={{
                              backgroundColor: `${getTagColor(tag)}20`,
                              color: getTagColor(tag)
                            }}
                          >
                            {tag}
                          </Badge>
                        ))}
                        {project.tags.length > 2 && (
                          <Badge variant="outline" className="text-xs px-2 py-0.5">
                            +{project.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Created/Updated Dates */}
                    <div className="text-xs text-muted-foreground/70">
                      <div>Created: {new Date(project.createdAt).toLocaleDateString()}</div>
                      <div>Updated: {new Date(project.updatedAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Generating Art Overlay */}
              <AnimatePresence>
                {isGeneratingArt && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl"
                  >
                    <Loader2 className="w-6 h-6 text-primary animate-spin mb-1" />
                    <p className="text-xs text-muted-foreground">Generating...</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            // Grid View Layout (existing code)
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "group relative rounded-2xl overflow-hidden cursor-pointer",
                "bg-card/50 backdrop-blur-sm border border-border/30",
                "hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5",
                "transition-all duration-300",
                isSelected && "ring-2 ring-primary border-primary/50"
              )}
              onClick={handleCardClick}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {/* Selection Checkbox */}
              <AnimatePresence>
                {selectionMode && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={cn(
                      "absolute z-20",
                      gridSize === "small" && "top-1.5 left-1.5",
                      gridSize === "medium" && "top-3 left-3",
                      gridSize === "large" && "top-4 left-4"
                    )}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelect?.(project)
                      }}
                      aria-label={`Select project ${project.title}`}
                      className={cn(
                        "rounded-md flex items-center justify-center transition-all duration-200",
                        "border-2",
                        gridSize === "small" && "w-4 h-4",
                        gridSize === "medium" && "w-6 h-6",
                        gridSize === "large" && "w-8 h-8",
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-background/80 border-muted-foreground/50 hover:border-primary"
                      )}
                    >
                      {isSelected && (
                        <Check className={cn(
                          gridSize === "small" && "w-2.5 h-2.5",
                          gridSize === "medium" && "w-4 h-4",
                          gridSize === "large" && "w-5 h-5"
                        )} />
                      )}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Artwork */}
              <div className="relative aspect-square overflow-hidden">
                {project.artworkPath && !imageError ? (
                  <img
                    src={`appfile://${project.artworkPath.replace(/\\/g, "/")}`}
                    alt={project.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onLoad={() => setImageError(false)}
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
                    <div className="relative">
                      <Music className="w-16 h-16 text-muted-foreground/30" />
                      <div className="absolute inset-0 blur-2xl bg-primary/10" />
                    </div>
                  </div>
                )}

                {/* Loading overlay for artwork generation */}
                {isGeneratingArt && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-300" />

                {/* Play Button */}
                <AnimatePresence>
                  {(isHovered || isPlaying) && (project.audioPreviewPath || project.favoriteVersionId) && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <button
                        onClick={handlePlayClick}
                        aria-label={isPlaying ? `Pause ${project.title}` : `Play ${project.title}`}
                        className={cn(
                          "w-14 h-14 rounded-full flex items-center justify-center",
                          "bg-primary/90 backdrop-blur-sm text-primary-foreground",
                          "shadow-xl shadow-primary/30",
                          "hover:bg-primary hover:scale-105 active:scale-95",
                          "transition-all duration-200",
                          isPlaying && "animate-pulse"
                        )}
                      >
                        {isPlaying ? (
                          <Pause className="w-6 h-6" />
                        ) : (
                          <Play className="w-6 h-6 ml-1" />
                        )}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* DAW Badge */}
                {project.dawProjectPath && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleDawClick}
                        aria-label={`Open ${project.title} in DAW`}
                        className={cn(
                          "absolute z-10 px-2 py-1 rounded-md font-medium",
                          "bg-background/80 backdrop-blur-sm border border-border/50",
                          "hover:bg-primary hover:text-primary-foreground hover:border-primary",
                          "transition-all duration-200",
                          gridSize === "small" && "top-1.5 right-1.5 text-[10px]",
                          gridSize === "medium" && "top-3 right-3 text-xs",
                          gridSize === "large" && "top-4 right-4 text-sm"
                        )}
                      >
                        {getDawBadge()}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Open in DAW</TooltipContent>
                  </Tooltip>
                )}

                {/* BPM & Key Pills */}
                <div className={cn(
                  "absolute left-3 right-3 flex items-center gap-2 z-10",
                  gridSize === "small" && "bottom-1.5",
                  gridSize === "medium" && "bottom-3",
                  gridSize === "large" && "bottom-4"
                )}>
                  {project.bpm > 0 && (
                    <div className={cn(
                      "px-2 py-1 rounded-md bg-background/70 backdrop-blur-sm font-medium",
                      gridSize === "small" && "text-[10px]",
                      gridSize === "medium" && "text-xs",
                      gridSize === "large" && "text-sm"
                    )}>
                      <span>{project.bpm} BPM</span>
                    </div>
                  )}
                  {project.timeSpent && project.timeSpent > 0 && (
                    <div className={cn(
                      "px-2 py-1 rounded-md bg-background/70 backdrop-blur-sm font-medium flex items-center gap-1",
                      gridSize === "small" && "text-[10px]",
                      gridSize === "medium" && "text-xs",
                      gridSize === "large" && "text-sm"
                    )}>
                      <Clock className={cn(
                        gridSize === "small" && "w-2.5 h-2.5",
                        gridSize === "medium" && "w-3 h-3",
                        gridSize === "large" && "w-4 h-4"
                      )} />
                      <span>{formatTimeSpent(project.timeSpent)}</span>
                    </div>
                  )}
                  {project.musicalKey && project.musicalKey !== "None" && (
                    <div className={cn(
                      "px-2 py-1 rounded-md bg-background/70 backdrop-blur-sm font-medium",
                      gridSize === "small" && "text-[10px]",
                      gridSize === "medium" && "text-xs",
                      gridSize === "large" && "text-sm"
                    )}>
                      <span>{project.musicalKey}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className={cn(
                "space-y-3",
                gridSize === "small" && "px-2 py-2",
                gridSize === "medium" && "px-4 py-4",
                gridSize === "large" && "px-6 py-6"
              )}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className={cn(
                    "font-semibold text-foreground truncate group-hover:text-primary transition-colors flex-1",
                    gridSize === "small" && "text-sm",
                    gridSize === "medium" && "text-base",
                    gridSize === "large" && "text-lg"
                  )}>
                    {project.title}
                  </h3>
                  {STATUS_CONFIG[project.status] && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "gap-1 flex-shrink-0 border-0",
                        STATUS_CONFIG[project.status].bgColor,
                        STATUS_CONFIG[project.status].color,
                        gridSize === "small" && "text-[8px] px-1.5 py-0.5",
                        gridSize === "medium" && "text-[10px] px-2 py-0.5",
                        gridSize === "large" && "text-xs px-3 py-1"
                      )}
                    >
                      {STATUS_CONFIG[project.status].icon}
                    </Badge>
                  )}
                </div>

                {/* Tags - Fixed height container for consistency */}
                <div className={cn(
                  "flex flex-wrap gap-1.5",
                  // Fixed height based on grid size to ensure all cards have the same height
                  gridSize === "small" && "h-5",
                  gridSize === "medium" && "h-6",
                  gridSize === "large" && "h-7"
                )}>
                  {project.tags && project.tags.length > 0 ? (
                    <>
                      {project.tags.slice(0, gridSize === "small" ? 2 : 3).map((tag: string, index: number) => (
                        <Badge 
                          key={index} 
                          variant="secondary" 
                          className={cn(
                            "px-2 py-0.5 border-0",
                            gridSize === "small" && "text-[10px]",
                            gridSize === "medium" && "text-[10px]",
                            gridSize === "large" && "text-xs"
                          )}
                          style={{
                            backgroundColor: `${getTagColor(tag)}20`,
                            color: getTagColor(tag)
                          }}
                        >
                          {tag}
                        </Badge>
                      ))}
                      {project.tags.length > (gridSize === "small" ? 2 : 3) && (
                        <Badge variant="outline" className={cn(
                          "px-2 py-0.5",
                          gridSize === "small" && "text-[10px]",
                          gridSize === "medium" && "text-[10px]",
                          gridSize === "large" && "text-xs"
                        )}>
                          +{project.tags.length - (gridSize === "small" ? 2 : 3)}
                        </Badge>
                      )}
                    </>
                  ) : (
                    // Empty placeholder to maintain consistent height when there are no tags
                    <div />
                  )}
                </div>

                {/* Collection */}
                {project.collectionName && (
                  <p className={cn(
                    "text-muted-foreground truncate",
                    gridSize === "small" && "text-[10px]",
                    gridSize === "medium" && "text-xs",
                    gridSize === "large" && "text-sm"
                  )}>
                    {project.collectionName}
                  </p>
                )}
              </div>

              {/* Generating Art Overlay */}
              <AnimatePresence>
                {isGeneratingArt && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center z-30"
                  >
                    <Loader2 className={cn(
                      "text-primary animate-spin mb-2",
                      gridSize === "small" && "w-4 h-4",
                      gridSize === "medium" && "w-6 h-6",
                      gridSize === "large" && "w-8 h-8"
                    )} />
                    <p className={cn(
                      "text-muted-foreground",
                      gridSize === "small" && "text-[10px]",
                      gridSize === "medium" && "text-sm",
                      gridSize === "large" && "text-base"
                    )}>Generating artwork...</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={() => onEdit(project)}>
            Edit Project
          </ContextMenuItem>
          {project.dawProjectPath && (
            <ContextMenuItem onClick={() => onOpenDaw?.(project)}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in DAW
            </ContextMenuItem>
          )}
          {project.dawProjectPath && (
            <ContextMenuItem onClick={handleOpenProjectFolder}>
              <FolderOpen className="w-4 h-4 mr-2" />
              Open Project Folder
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleChangeArtwork}>
            <Image className="w-4 h-4 mr-2" />
            Change Artwork
          </ContextMenuItem>
          <ContextMenuItem onClick={handleRemoveArtwork}>
            <Trash2 className="w-4 h-4 mr-2" />
            Remove Artwork
          </ContextMenuItem>
          <ContextMenuItem onClick={handleFetchUnsplashPhoto}>
            <Shuffle className="w-4 h-4 mr-2" />
            Random Unsplash Photo
          </ContextMenuItem>
          <ContextMenuItem onClick={handleGenerateArt}>
            <Sparkles className="w-4 h-4 mr-2" />
            Generate AI Artwork
          </ContextMenuItem>
          {onRemove && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => onRemove(project)}
                className="text-orange-600 focus:text-orange-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove from Group
              </ContextMenuItem>
            </>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => onDelete?.(project)}
            className="text-destructive focus:text-destructive"
          >
            Delete Project
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </TooltipProvider>
  )
})

export default ProjectCard