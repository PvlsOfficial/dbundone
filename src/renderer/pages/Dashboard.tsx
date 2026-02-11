import React, { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  Search,
  SlidersHorizontal,
  Grid2X2,
  List,
  CheckSquare,
  X,
  Music,
  Sparkles,
  FolderPlus,
  Folder,
  Shuffle,
  Lightbulb,
  Headphones,
  Disc3,
  CheckCircle2,
  PartyPopper,
  Archive,
} from "lucide-react"
import { ProjectModal } from "../components/ProjectModal"
import { Project, FilterOptions, AudioPlayerState, ProjectStatus, ProjectGroup, AppSettings, Tag } from "@shared/types"
import { cn } from "@/lib/utils"
import { useToast } from "../components/ui/toast"
import {
  Button,
  Input,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui"
import { VirtualizedProjectGrid } from "../components/VirtualizedProjectGrid"

interface DashboardProps {
  projects: Project[]
  groups: ProjectGroup[]
  tags: Tag[]
  playerState: AudioPlayerState
  settings: AppSettings
  onPlay: (project: Project) => Promise<void>
  onStop: () => void
  onOpenDaw: (project: Project) => void
  onGenerateArtwork: (project: Project) => Promise<void>
  onChangeArtwork: (project: Project) => Promise<void>
  onRemoveArtwork: (project: Project) => Promise<void>
  onFetchUnsplashPhoto: (project: Project) => Promise<void>
  onFetchUnsplashPhotosForAll: () => Promise<void>
  onCancelBatchPhotos: () => Promise<void>
  photoProgress?: {
    current: number;
    total: number;
    added: number;
    file: string;
    isRunning: boolean;
    cancelled: boolean;
  } | null
  onDelete: (project: Project) => Promise<void>
  onRefresh: () => void
  onOpenProject: (project: Project) => void
  onCreateGroup: (name: string, description?: string, projectIds?: string[]) => Promise<void>
  onUpdateGroup: (groupId: string, updates: Partial<ProjectGroup>) => void
  onSettingsChange: (settings: Partial<AppSettings>) => void
  onOpenArtworkManager?: (project: Project) => void
}

export const Dashboard: React.FC<DashboardProps> = ({
  projects,
  groups,
  tags,
  playerState,
  settings,
  onPlay,
  onStop,
  onOpenDaw,
  onGenerateArtwork,
  onChangeArtwork,
  onRemoveArtwork,
  onFetchUnsplashPhoto,
  onFetchUnsplashPhotosForAll,
  onCancelBatchPhotos,
  photoProgress,
  onDelete,
  onRefresh,
  onOpenProject,
  onCreateGroup,
  onUpdateGroup,
  onSettingsChange,
  onOpenArtworkManager,
}) => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filters, setFilters] = useState<FilterOptions>({
    searchQuery: "",
    sortBy: "date-newest",
    selectedTags: [],
    collectionFilter: null,
    statusFilter: null,
    dawFilter: null,
    genreFilter: null,
    artistFilter: null,
  })
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const viewMode = settings.viewMode || "grid"
  const gridSize = settings.gridSize || "medium"
  const [showFilters, setShowFilters] = useState(false)
  const [showGroupDropdown, setShowGroupDropdown] = useState(false)
  const [searchInput, setSearchInput] = useState("")
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { addToast } = useToast()

  // Debounced search: update actual filter after 200ms of idle typing
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, searchQuery: value }))
    }, 200)
  }, [])

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  // Update viewMode and persist to settings
  const setViewMode = (mode: "grid" | "list") => {
    onSettingsChange({ viewMode: mode })
  }

  // Update gridSize and persist to settings
  const setGridSize = (size: "small" | "medium" | "large") => {
    onSettingsChange({ gridSize: size })
  }

  // Get all unique tags from projects
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    projects.forEach((project) => {
      project.tags?.forEach((tag) => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [projects])

  // Get available DAW types from settings
  const availableDaws = useMemo(() => {
    return settings.selectedDAWs
  }, [settings.selectedDAWs])

  // Get all unique genres from projects
  const availableGenres = useMemo(() => {
    const genreSet = new Set<string>()
    projects.forEach((project) => {
      if (project.genre) genreSet.add(project.genre)
    })
    return Array.from(genreSet).sort()
  }, [projects])

  // Get all unique artists from projects
  const availableArtists = useMemo(() => {
    const artistSet = new Set<string>()
    projects.forEach((project) => {
      if (project.artists) artistSet.add(project.artists)
    })
    return Array.from(artistSet).sort()
  }, [projects])

  // Filter and sort projects - Highly optimized version
  const filteredProjects = useMemo(() => {
    // Early return if no projects
    if (projects.length === 0) return []

    // Create a copy to avoid mutating original array
    let result = [...projects]

    // Search filter - Optimized
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      result = result.filter((project) => {
        const { title, collectionName, tags, dawType, musicalKey, status, bpm } = project
        return (
          title.toLowerCase().includes(query) ||
          (collectionName && collectionName.toLowerCase().includes(query)) ||
          (tags && tags.some((tag) => tag.toLowerCase().includes(query))) ||
          (dawType && dawType.toLowerCase().includes(query)) ||
          musicalKey.toLowerCase().includes(query) ||
          status.toLowerCase().includes(query) ||
          bpm.toString().includes(query)
        )
      })
    }

    // Tag filter - Optimized using Set for faster lookups
    if (filters.selectedTags.length > 0) {
      const tagSet = new Set(filters.selectedTags)
      result = result.filter((project) =>
        project.tags && project.tags.some((tag) => tagSet.has(tag))
      )
    }

    // Status filter - Optimized using Set for faster lookups
    if (filters.statusFilter && filters.statusFilter.length > 0) {
      const statusSet = new Set(filters.statusFilter)
      result = result.filter((project) => statusSet.has(project.status))
    }

    // DAW filter - Optimized using Set for faster lookups
    if (filters.dawFilter && filters.dawFilter.length > 0) {
      const dawSet = new Set(filters.dawFilter)
      result = result.filter((project) =>
        project.dawType && dawSet.has(project.dawType)
      )
    }

    // Genre filter
    if (filters.genreFilter && filters.genreFilter.length > 0) {
      const genreSet = new Set(filters.genreFilter)
      result = result.filter((project) =>
        project.genre && genreSet.has(project.genre)
      )
    }

    // Artist filter
    if (filters.artistFilter && filters.artistFilter.length > 0) {
      const artistSet = new Set(filters.artistFilter)
      result = result.filter((project) =>
        project.artists && artistSet.has(project.artists)
      )
    }

    // Sort - Optimized with precomputed values
    switch (filters.sortBy) {
      case "name-asc":
        result.sort((a, b) => a.title.localeCompare(b.title))
        break
      case "name-desc":
        result.sort((a, b) => b.title.localeCompare(a.title))
        break
      case "date-newest":
        result.sort((a, b) => {
          const aDate = a.fileModifiedAt ? new Date(a.fileModifiedAt).getTime() : new Date(a.updatedAt).getTime()
          const bDate = b.fileModifiedAt ? new Date(b.fileModifiedAt).getTime() : new Date(b.updatedAt).getTime()
          return bDate - aDate
        })
        break
      case "date-oldest":
        result.sort((a, b) => {
          const aDate = a.fileModifiedAt ? new Date(a.fileModifiedAt).getTime() : new Date(a.updatedAt).getTime()
          const bDate = b.fileModifiedAt ? new Date(b.fileModifiedAt).getTime() : new Date(b.updatedAt).getTime()
          return aDate - bDate
        })
        break
      case "bpm-asc":
        result.sort((a, b) => a.bpm - b.bpm)
        break
      case "bpm-desc":
        result.sort((a, b) => b.bpm - a.bpm)
        break
      case "key":
        result.sort((a, b) => a.musicalKey.localeCompare(b.musicalKey))
        break
      case "tags-asc":
        result.sort((a, b) => (a.tags.join(',') || '').localeCompare(b.tags.join(',') || ''))
        break
      case "tags-desc":
        result.sort((a, b) => (b.tags.join(',') || '').localeCompare(a.tags.join(',') || ''))
        break
      case "time-spent-asc":
        result.sort((a, b) => (a.timeSpent || 0) - (b.timeSpent || 0))
        break
      case "time-spent-desc":
        result.sort((a, b) => (b.timeSpent || 0) - (a.timeSpent || 0))
        break
    }

    return result
  }, [projects, filters])

  // Memoize handlers to prevent unnecessary re-renders
  const handleProjectSelect = useCallback((project: Project) => {
    setSelectedProjects(prev => {
      const newSelection = new Set(prev)
      if (newSelection.has(project.id)) {
        newSelection.delete(project.id)
      } else {
        newSelection.add(project.id)
      }
      return newSelection
    })
  }, [])

  const handleTagToggle = useCallback((tag: string) => {
    setFilters(prev => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tag)
        ? prev.selectedTags.filter(t => t !== tag)
        : [...prev.selectedTags, tag]
    }))
  }, [])

  const handleStatusToggle = useCallback((status: ProjectStatus) => {
    setFilters(prev => {
      const currentStatuses = prev.statusFilter || []
      const newStatuses = currentStatuses.includes(status)
        ? currentStatuses.filter(s => s !== status)
        : [...currentStatuses, status]
      return {
        ...prev,
        statusFilter: newStatuses.length > 0 ? newStatuses : null
      }
    })
  }, [])

  const handleDawToggle = useCallback((daw: string) => {
    setFilters(prev => {
      const currentDaws = prev.dawFilter || []
      const newDaws = currentDaws.includes(daw)
        ? currentDaws.filter(d => d !== daw)
        : [...currentDaws, daw]
      return {
        ...prev,
        dawFilter: newDaws.length > 0 ? newDaws : null
      }
    })
  }, [])

  const handleGenreToggle = useCallback((genre: string) => {
    setFilters(prev => {
      const current = prev.genreFilter || []
      const updated = current.includes(genre)
        ? current.filter(g => g !== genre)
        : [...current, genre]
      return {
        ...prev,
        genreFilter: updated.length > 0 ? updated : null
      }
    })
  }, [])

  const handleArtistToggle = useCallback((artist: string) => {
    setFilters(prev => {
      const current = prev.artistFilter || []
      const updated = current.includes(artist)
        ? current.filter(a => a !== artist)
        : [...current, artist]
      return {
        ...prev,
        artistFilter: updated.length > 0 ? updated : null
      }
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedProjects(prev => {
      if (prev.size === filteredProjects.length) {
        return new Set()
      } else {
        return new Set(filteredProjects.map(p => p.id))
      }
    })
  }, [filteredProjects.length])

  const handleEditProject = (project: Project) => {
    // Open full detail page instead of modal
    onOpenProject(project)
  }

  const handleNewProject = () => {
    setSelectedProject(null)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedProject(null)
    onRefresh()
  }

  const handleToggleSelectionMode = () => {
    setSelectionMode(!selectionMode)
    setSelectedProjects(new Set())
  }

  // Grid column configuration based on grid size
  const gridColumns = {
    small: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8",
    medium: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
    large: "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
  }

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="px-6 py-5 border-b border-border/30"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-xl bg-primary/10">
                <Music className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Projects</h1>
              <Badge variant="secondary" className="text-sm">
                {filteredProjects.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {selectionMode && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 mr-2"
                >
                  <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                    {selectedProjects.size === filteredProjects.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {selectedProjects.size} selected
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={selectedProjects.size === 0}>
                        <FolderPlus className="w-4 h-4 mr-2" />
                        Add to Group
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {groups.map((group) => (
                        <DropdownMenuItem
                          key={group.id}
                          onClick={async () => {
                            const updatedProjectIds = [...group.projectIds, ...Array.from(selectedProjects)]
                            await onUpdateGroup(group.id, { projectIds: updatedProjectIds })
                            setSelectedProjects(new Set())
                            setSelectionMode(false)
                            onRefresh()
                          }}
                        >
                          <Folder className="w-4 h-4 mr-2" />
                          {group.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const groupName = `Group ${groups.length + 1}`
                      await onCreateGroup(groupName, '', Array.from(selectedProjects))
                      setSelectedProjects(new Set())
                      setSelectionMode(false)
                      onRefresh()
                    }}
                    disabled={selectedProjects.size === 0}
                  >
                    <FolderPlus className="w-4 h-4 mr-2" />
                    Create Group
                  </Button>
                </motion.div>
              )}
              {settings.unsplashEnabled && (
                photoProgress?.isRunning ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCancelBatchPhotos}
                    className="gap-2 border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                  >
                    <X className="w-4 h-4" />
                    Stop ({photoProgress.added}/{photoProgress.total})
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onFetchUnsplashPhotosForAll}
                    className="gap-2"
                  >
                    <Shuffle className="w-4 h-4" />
                    Add Photos to All
                  </Button>
                )
              )}
              <Button
                variant={selectionMode ? "secondary" : "ghost"}
                size="sm"
                onClick={handleToggleSelectionMode}
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                {selectionMode ? "Done" : "Select"}
              </Button>
              <Button onClick={handleNewProject} className="gap-2">
                <Plus className="w-4 h-4" />
                New Project
              </Button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 bg-muted/30"
              />
              {searchInput && (
                <button
                  onClick={() => {
                    setSearchInput("")
                    setFilters(prev => ({ ...prev, searchQuery: "" }))
                    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <Select
              value={filters.sortBy}
              onValueChange={(value) =>
                setFilters({ ...filters, sortBy: value as FilterOptions["sortBy"] })
              }
            >
              <SelectTrigger className="w-44 bg-muted/30">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-newest">Newest First</SelectItem>
                <SelectItem value="date-oldest">Oldest First</SelectItem>
                <SelectItem value="name-asc">Name A-Z</SelectItem>
                <SelectItem value="name-desc">Name Z-A</SelectItem>
                <SelectItem value="bpm-asc">BPM Low-High</SelectItem>
                <SelectItem value="bpm-desc">BPM High-Low</SelectItem>
                <SelectItem value="time-spent-asc">Time Spent Low-High</SelectItem>
                <SelectItem value="time-spent-desc">Time Spent High-Low</SelectItem>
                <SelectItem value="key">Musical Key</SelectItem>
                <SelectItem value="tags-asc">Tags A-Z</SelectItem>
                <SelectItem value="tags-desc">Tags Z-A</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={showFilters ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              aria-label="Toggle filters"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </Button>

            <div className="h-6 w-px bg-border" />

            <div className="flex items-center bg-muted/30 rounded-lg p-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onSettingsChange({ viewMode: "grid", gridSize: "medium" })}
                    aria-label="Grid view"
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      viewMode === "grid"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Grid2X2 className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Grid View</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode("list")}
                    aria-label="List view"
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      viewMode === "list"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>List View</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Filters Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t border-border/30 space-y-4">
                  {/* Status Filter - Always show, especially important for Kanban */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Status</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: "idea", title: "Idea", icon: <Lightbulb className="w-3.5 h-3.5" />, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-500/15 dark:bg-purple-500/10" },
                        { id: "in-progress", title: "In Progress", icon: <Music className="w-3.5 h-3.5" />, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500/15 dark:bg-blue-500/10" },
                        { id: "mixing", title: "Mixing", icon: <Headphones className="w-3.5 h-3.5" />, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-500/15 dark:bg-orange-500/10" },
                        { id: "mastering", title: "Mastering", icon: <Disc3 className="w-3.5 h-3.5" />, color: "text-cyan-600 dark:text-cyan-400", bgColor: "bg-cyan-500/15 dark:bg-cyan-500/10" },
                        { id: "completed", title: "Completed", icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-green-600 dark:text-green-400", bgColor: "bg-green-500/15 dark:bg-green-500/10" },
                        { id: "released", title: "Released", icon: <PartyPopper className="w-3.5 h-3.5" />, color: "text-pink-600 dark:text-pink-400", bgColor: "bg-pink-500/15 dark:bg-pink-500/10" },
                      ].map((status) => (
                        <button
                          key={status.id}
                          onClick={() => handleStatusToggle(status.id as ProjectStatus)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5",
                            filters.statusFilter?.includes(status.id as ProjectStatus)
                              ? "bg-primary text-primary-foreground"
                              : `${status.bgColor} ${status.color} hover:opacity-80`
                          )}
                        >
                          {status.icon}
                          {status.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tags Filter - Show for all views */}
                  {availableTags.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Tags</label>
                      <div className="flex flex-wrap gap-2">
                        {availableTags.map((tag) => {
                          const tagInfo = tags.find(t => t.name === tag);
                          const tagColor = tagInfo?.color || '#6366f1';
                          return (
                            <button
                              key={tag}
                              onClick={() => handleTagToggle(tag)}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                                filters.selectedTags.includes(tag)
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:opacity-80"
                              )}
                              style={!filters.selectedTags.includes(tag) ? {
                                backgroundColor: `${tagColor}20`,
                                color: tagColor
                              } : undefined}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* DAW Type Filter */}
                  {availableDaws.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">DAW</label>
                      <div className="flex flex-wrap gap-2">
                        {availableDaws.map((daw) => (
                          <button
                            key={daw}
                            onClick={() => handleDawToggle(daw)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                              filters.dawFilter?.includes(daw)
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            {daw}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Genre Filter */}
                  {availableGenres.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Genre</label>
                      <div className="flex flex-wrap gap-2">
                        {availableGenres.map((genre) => (
                          <button
                            key={genre}
                            onClick={() => handleGenreToggle(genre)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                              filters.genreFilter?.includes(genre)
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            {genre}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Artist Filter */}
                  {availableArtists.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Artist</label>
                      <div className="flex flex-wrap gap-2">
                        {availableArtists.map((artist) => (
                          <button
                            key={artist}
                            onClick={() => handleArtistToggle(artist)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                              filters.artistFilter?.includes(artist)
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            {artist}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clear All Filters */}
                  {(filters.selectedTags.length > 0 || filters.statusFilter?.length || filters.dawFilter?.length || filters.genreFilter?.length || filters.artistFilter?.length) && (
                    <div className="pt-2">
                      <button
                        onClick={() => setFilters({
                          ...filters,
                          selectedTags: [],
                          statusFilter: null,
                          dawFilter: null,
                          genreFilter: null,
                          artistFilter: null,
                        })}
                        className="px-3 py-1.5 rounded-full text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        Clear all filters
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {filteredProjects.length > 0 ? (
              <VirtualizedProjectGrid
                projects={filteredProjects}
                tags={tags}
                playerState={playerState}
                viewMode={viewMode}
                gridSize={gridSize}
                selectedProjects={selectedProjects}
                selectionMode={selectionMode}
                onProjectSelect={handleProjectSelect}
                onProjectClick={handleEditProject}
                onPlay={onPlay}
                onStop={onStop}
                onOpenDaw={onOpenDaw}
                onGenerateArtwork={onGenerateArtwork}
                onChangeArtwork={onChangeArtwork}
                onRemoveArtwork={onRemoveArtwork}
                onFetchUnsplashPhoto={onFetchUnsplashPhoto}
                onDelete={onDelete}
                unsplashEnabled={settings.unsplashEnabled}
                aiArtworkEnabled={settings.autoGenerateArtwork}
                onOpenArtworkManager={onOpenArtworkManager}
              />
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <Music className="w-12 h-12 text-primary/50" />
                  </div>
                  <div className="absolute -right-2 -top-2">
                    <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                  </div>
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {filters.searchQuery ? "No projects found" : "No projects yet"}
                </h2>
                <p className="text-muted-foreground mb-6 text-center max-w-md">
                  {filters.searchQuery
                    ? "Try adjusting your search or filters"
                    : "Create your first project or scan your DAW project folders to get started"}
                </p>
                <div className="flex items-center gap-3">
                  <Button onClick={handleNewProject} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Create Project
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        {/* Modal */}
        <ProjectModal
          project={selectedProject}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      </div>
    </TooltipProvider>
  )
}

export default Dashboard