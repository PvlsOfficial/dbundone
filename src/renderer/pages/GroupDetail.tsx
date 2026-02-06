import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Play,
  Pause,
  Music,
  Clock,
  Key,
  Search,
  Grid3X3,
  List,
  MoreHorizontal,
  Edit3,
  Trash2,
  Copy,
  FolderOpen,
  Disc,
  Plus,
  X,
  Image as ImageIcon,
  Tag as TagIcon,
  SkipBack,
  SkipForward,
  Download,
  CheckSquare,
  SlidersHorizontal,
  Sparkles,
  Lightbulb,
  Headphones,
  Disc3,
  CheckCircle2,
  PartyPopper,
  Archive,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ProjectCard } from '@/components/ProjectCard'
import { AudioPlayer } from '@/components/AudioPlayer'
import { Project, ProjectGroup, AudioPlayerState, AppSettings, ProjectStatus, Tag } from '@shared/types'

interface GroupDetailProps {
  group: ProjectGroup
  projects: Project[]
  tags: Tag[]
  settings: AppSettings
  onBack: () => void
  onUpdateGroup: (groupId: string, updates: Partial<ProjectGroup>) => void
  onDeleteGroup: (groupId: string) => void
  onRefresh: () => void
  playerState: AudioPlayerState
  onPlayProject: (project: Project) => Promise<void>
  onStopProject: () => void
  onPlayerStateChange: React.Dispatch<React.SetStateAction<AudioPlayerState>>
  onOpenProject: (project: Project) => void
  onOpenDaw: (project: Project) => Promise<void>
  onGenerateArtwork: (project: Project) => Promise<void>
  onChangeArtwork: (project: Project) => Promise<void>
  onRemoveArtwork: (project: Project) => Promise<void>
  onFetchUnsplashPhoto: (project: Project) => Promise<void>
  onDeleteProject: (project: Project) => Promise<void>
  onSettingsChange: (settings: Partial<AppSettings>) => void
}

type SortOption = 'name-asc' | 'name-desc' | 'date-newest' | 'date-oldest' | 'bpm-asc' | 'bpm-desc' | 'key' | 'time-spent-asc' | 'time-spent-desc' | 'tags-asc' | 'tags-desc'

export const GroupDetail: React.FC<GroupDetailProps> = ({
  group,
  projects,
  tags,
  settings,
  onBack,
  onUpdateGroup,
  onDeleteGroup,
  onRefresh,
  playerState,
  onPlayProject,
  onStopProject,
  onPlayerStateChange,
  onOpenProject,
  onOpenDaw,
  onGenerateArtwork,
  onChangeArtwork,
  onRemoveArtwork,
  onFetchUnsplashPhoto,
  onDeleteProject,
  onSettingsChange,
}) => {
  const [viewMode, setViewModeState] = useState<'grid' | 'list'>(settings.viewMode || 'grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('date-newest')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<ProjectStatus[]>([])
  const [dawFilter, setDawFilter] = useState<string[]>([])
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: group.name,
    description: group.description || '',
  })
  const [showAddProjectsModal, setShowAddProjectsModal] = useState(false)
  const [addProjectsSearchQuery, setAddProjectsSearchQuery] = useState('')
  const [addProjectsSelectedIds, setAddProjectsSelectedIds] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)

  // Update viewMode and persist to settings
  const setViewMode = (mode: 'grid' | 'list') => {
    setViewModeState(mode)
    onSettingsChange({ viewMode: mode })
  }
  
  // Playback state
  const [isPlayingGroup, setIsPlayingGroup] = useState(false)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)

  // Get projects in this group
  const groupProjects = useMemo(() => 
    projects.filter(p => group.projectIds.includes(p.id)),
    [projects, group.projectIds]
  )

  // Get all unique tags from group projects
  const availableTags = useMemo(() => 
    Array.from(new Set(groupProjects.flatMap(p => p.tags))).sort(),
    [groupProjects]
  )

  // Get available DAW types from settings
  const availableDaws = useMemo(() => {
    return settings.selectedDAWs
  }, [settings.selectedDAWs])

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let result = [...groupProjects]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(project =>
        project.title.toLowerCase().includes(query) ||
        project.collectionName?.toLowerCase().includes(query) ||
        project.tags.some(tag => tag.toLowerCase().includes(query)) ||
        project.dawType?.toLowerCase().includes(query) ||
        project.musicalKey.toLowerCase().includes(query) ||
        project.status.toLowerCase().includes(query) ||
        project.bpm.toString().includes(query)
      )
    }

    // Tags filter
    if (selectedTags.length > 0) {
      result = result.filter(project =>
        selectedTags.some(tag => project.tags.includes(tag))
      )
    }

    // Status filter
    if (statusFilter.length > 0) {
      result = result.filter(project =>
        statusFilter.includes(project.status)
      )
    }

    // DAW filter
    if (dawFilter.length > 0) {
      result = result.filter(project =>
        project.dawType && dawFilter.includes(project.dawType)
      )
    }

    // Sort
    switch (sortBy) {
      case 'name-asc':
        result.sort((a, b) => a.title.localeCompare(b.title))
        break
      case 'name-desc':
        result.sort((a, b) => b.title.localeCompare(a.title))
        break
      case 'date-newest':
        result.sort((a, b) => {
          const aDate = a.fileModifiedAt ? new Date(a.fileModifiedAt).getTime() : new Date(a.updatedAt).getTime()
          const bDate = b.fileModifiedAt ? new Date(b.fileModifiedAt).getTime() : new Date(b.updatedAt).getTime()
          return bDate - aDate
        })
        break
      case 'date-oldest':
        result.sort((a, b) => {
          const aDate = a.fileModifiedAt ? new Date(a.fileModifiedAt).getTime() : new Date(a.updatedAt).getTime()
          const bDate = b.fileModifiedAt ? new Date(b.fileModifiedAt).getTime() : new Date(b.updatedAt).getTime()
          return aDate - bDate
        })
        break
      case 'bpm-asc':
        result.sort((a, b) => a.bpm - b.bpm)
        break
      case 'bpm-desc':
        result.sort((a, b) => b.bpm - a.bpm)
        break
      case 'key':
        result.sort((a, b) => a.musicalKey.localeCompare(b.musicalKey))
        break
      case 'tags-asc':
        result.sort((a, b) => a.tags.join(',').localeCompare(b.tags.join(',')))
        break
      case 'tags-desc':
        result.sort((a, b) => b.tags.join(',').localeCompare(a.tags.join(',')))
        break
      case 'time-spent-asc':
        result.sort((a, b) => (a.timeSpent || 0) - (b.timeSpent || 0))
        break
      case 'time-spent-desc':
        result.sort((a, b) => (b.timeSpent || 0) - (a.timeSpent || 0))
        break
    }

    return result
  }, [groupProjects, searchQuery, selectedTags, statusFilter, dawFilter, sortBy])

  // Group statistics
  const stats = useMemo(() => ({
    totalProjects: groupProjects.length,
    avgBPM: groupProjects.length > 0 
      ? Math.round(groupProjects.reduce((sum, p) => sum + p.bpm, 0) / groupProjects.length) 
      : 0,
    uniqueKeys: [...new Set(groupProjects.map(p => p.musicalKey))].length,
  }), [groupProjects])

  const handleEditGroup = async () => {
    try {
      await onUpdateGroup(group.id, editForm)
      setIsEditing(false)
      onRefresh()
    } catch (error) {
      console.error('Failed to update group:', error)
    }
  }

  const handleDeleteGroup = () => {
    if (confirm(`Are you sure you want to delete "${group.name}"? This will not delete the projects.`)) {
      onDeleteGroup(group.id)
      onBack()
    }
  }

  const handlePlayGroup = () => {
    if (groupProjects.length === 0) return

    if (isPlayingGroup) {
      setIsPlayingGroup(false)
      onPlayerStateChange(prev => ({ ...prev, isPlaying: false }))
    } else {
      setIsPlayingGroup(true)
      onPlayProject(groupProjects[currentTrackIndex])
    }
  }

  const handleNextTrack = () => {
    if (groupProjects.length === 0) return
    const nextIndex = (currentTrackIndex + 1) % groupProjects.length
    setCurrentTrackIndex(nextIndex)
    if (isPlayingGroup) {
      onPlayProject(groupProjects[nextIndex])
    }
  }

  const handlePrevTrack = () => {
    if (groupProjects.length === 0) return
    const prevIndex = currentTrackIndex === 0 ? groupProjects.length - 1 : currentTrackIndex - 1
    setCurrentTrackIndex(prevIndex)
    if (isPlayingGroup) {
      onPlayProject(groupProjects[prevIndex])
    }
  }

  const handleProjectSelect = (project: Project) => {
    const newSelection = new Set(selectedProjects)
    if (newSelection.has(project.id)) {
      newSelection.delete(project.id)
    } else {
      newSelection.add(project.id)
    }
    setSelectedProjects(newSelection)
  }

  const handleRemoveSelected = async () => {
    const newProjectIds = group.projectIds.filter(id => !selectedProjects.has(id))
    await onUpdateGroup(group.id, { projectIds: newProjectIds })
    setSelectedProjects(new Set())
    setSelectionMode(false)
  }

  const handleSelectAll = () => {
    if (selectedProjects.size === filteredProjects.length) {
      setSelectedProjects(new Set())
    } else {
      setSelectedProjects(new Set(filteredProjects.map(p => p.id)))
    }
  }

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const handleStatusToggle = (status: ProjectStatus) => {
    setStatusFilter(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    )
  }

  const handleDawToggle = (daw: string) => {
    setDawFilter(prev =>
      prev.includes(daw)
        ? prev.filter(d => d !== daw)
        : [...prev, daw]
    )
  }

  const exportGroup = async () => {
    const exportData = {
      group: { ...group, exportedAt: new Date().toISOString() },
      projects: groupProjects,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${group.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getGroupArtwork = () => {
    if (group.artworkPath) return group.artworkPath
    return groupProjects.find(p => p.artworkPath)?.artworkPath || null
  }

  const handleAddProjects = async () => {
    if (addProjectsSelectedIds.size > 0) {
      const updatedProjectIds = [...group.projectIds, ...Array.from(addProjectsSelectedIds)]
      await onUpdateGroup(group.id, { projectIds: updatedProjectIds })
      setAddProjectsSelectedIds(new Set())
      setShowAddProjectsModal(false)
      setAddProjectsSearchQuery('')
      onRefresh()
    }
  }

  const handleChangeGroupArtwork = async () => {
    const path = await window.electron?.selectImage()
    if (path) {
      onUpdateGroup(group.id, { artworkPath: path })
    }
  }

  const handleRemoveGroupArtwork = () => {
    onUpdateGroup(group.id, { artworkPath: null })
  }

  // Projects available to add (not already in group)
  const availableProjects = useMemo(() => {
    return projects
      .filter(p => !group.projectIds.includes(p.id))
      .filter(p => {
        if (!addProjectsSearchQuery) return true
        const query = addProjectsSearchQuery.toLowerCase()
        return p.title.toLowerCase().includes(query) ||
          p.collectionName?.toLowerCase().includes(query) ||
          p.tags.some(tag => tag.toLowerCase().includes(query))
      })
  }, [projects, group.projectIds, addProjectsSearchQuery])

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-6 py-5 border-b border-border/30"
        >
          {/* Top Row: Back button and actions */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-2 -ml-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Groups
            </Button>

            <div className="flex items-center gap-2">
              {/* Playback Controls */}
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePrevTrack}
                      disabled={groupProjects.length === 0}
                      className="h-8 w-8 p-0"
                    >
                      <SkipBack className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Previous Track</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isPlayingGroup ? "default" : "ghost"}
                      size="sm"
                      onClick={handlePlayGroup}
                      disabled={groupProjects.length === 0}
                      className="h-8 w-8 p-0"
                    >
                      {isPlayingGroup ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isPlayingGroup ? 'Pause' : 'Play Group'}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNextTrack}
                      disabled={groupProjects.length === 0}
                      className="h-8 w-8 p-0"
                    >
                      <SkipForward className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Next Track</TooltipContent>
                </Tooltip>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleChangeGroupArtwork}>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Change Artwork
                  </DropdownMenuItem>
                  {group.artworkPath && (
                    <DropdownMenuItem onClick={handleRemoveGroupArtwork} className="text-destructive focus:text-destructive">
                      <X className="w-4 h-4 mr-2" />
                      Remove Artwork
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigator.clipboard.writeText(group.name)}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Name
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportGroup}>
                    <Download className="w-4 h-4 mr-2" />
                    Export Group
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDeleteGroup}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Group
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Group Info Row */}
          <div className="flex items-center gap-4">
            {/* Artwork */}
            <div 
              className="relative w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 border border-border/50 flex-shrink-0 cursor-pointer group"
              onClick={handleChangeGroupArtwork}
            >
              {getGroupArtwork() ? (
                <img
                  src={`appfile://${getGroupArtwork()?.replace(/\\/g, '/')}`}
                  alt={group.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FolderOpen className="w-8 h-8 text-primary/50" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {getGroupArtwork() && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveGroupArtwork()
                    }}
                    className="p-1.5 bg-destructive/80 hover:bg-destructive rounded-full text-white transition-colors"
                    title="Remove artwork"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleChangeGroupArtwork()
                  }}
                  className="p-1.5 bg-primary/80 hover:bg-primary rounded-full text-white transition-colors"
                  title="Change artwork"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Title & Stats */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground truncate">{group.name}</h1>
              {group.description && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">{group.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="secondary" className="gap-1.5">
                  <Disc className="w-3 h-3" />
                  {stats.totalProjects} project{stats.totalProjects !== 1 ? 's' : ''}
                </Badge>
                {stats.avgBPM > 0 && (
                  <Badge variant="outline" className="gap-1.5">
                    <Clock className="w-3 h-3" />
                    {stats.avgBPM} BPM avg
                  </Badge>
                )}
                {stats.uniqueKeys > 0 && (
                  <Badge variant="outline" className="gap-1.5">
                    <Key className="w-3 h-3" />
                    {stats.uniqueKeys} key{stats.uniqueKeys !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-border/30">
          {/* Search & Filters Row */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/30"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
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

            {/* Filters Toggle */}
            <Button
              variant={showFilters ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </Button>

            <div className="h-6 w-px bg-border" />

            {/* View Mode Toggle */}
            <div className="flex items-center bg-muted/30 rounded-lg p-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      viewMode === 'grid'
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Grid View</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      viewMode === 'list'
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>List View</TooltipContent>
              </Tooltip>
            </div>

            {/* Spacer to push buttons to the right */}
            <div className="flex-1" />

            {/* Selection Mode */}
            {selectionMode && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2"
              >
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  {selectedProjects.size === filteredProjects.length ? 'Deselect All' : 'Select All'}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedProjects.size} selected
                </span>
                {selectedProjects.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRemoveSelected}
                    className="gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </Button>
                )}
              </motion.div>
            )}

            <Button
              variant={selectionMode ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setSelectionMode(!selectionMode)
                setSelectedProjects(new Set())
              }}
            >
              <CheckSquare className="w-4 h-4 mr-2" />
              {selectionMode ? "Done" : "Select"}
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => setShowAddProjectsModal(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Projects
            </Button>
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
                  {/* Status Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Status</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: "idea", title: "Idea", icon: <Lightbulb className="w-3.5 h-3.5" />, color: "text-purple-400", bgColor: "bg-purple-500/10" },
                        { id: "in-progress", title: "In Progress", icon: <Music className="w-3.5 h-3.5" />, color: "text-blue-400", bgColor: "bg-blue-500/10" },
                        { id: "mixing", title: "Mixing", icon: <Headphones className="w-3.5 h-3.5" />, color: "text-orange-400", bgColor: "bg-orange-500/10" },
                        { id: "mastering", title: "Mastering", icon: <Disc3 className="w-3.5 h-3.5" />, color: "text-cyan-400", bgColor: "bg-cyan-500/10" },
                        { id: "completed", title: "Completed", icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-green-400", bgColor: "bg-green-500/10" },
                        { id: "released", title: "Released", icon: <PartyPopper className="w-3.5 h-3.5" />, color: "text-pink-400", bgColor: "bg-pink-500/10" },
                      ].map((status) => (
                        <button
                          key={status.id}
                          onClick={() => handleStatusToggle(status.id as ProjectStatus)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5",
                            statusFilter.includes(status.id as ProjectStatus)
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

                  {/* Tags Filter */}
                  {availableTags.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Tags</label>
                      <div className="flex flex-wrap gap-2">
                        {availableTags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => handleTagToggle(tag)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                              selectedTags.includes(tag)
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            {tag}
                          </button>
                        ))}
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
                              dawFilter.includes(daw)
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

                  {/* Clear All Filters */}
                  {(selectedTags.length > 0 || statusFilter.length > 0 || dawFilter.length > 0) && (
                    <div className="pt-2">
                      <button
                        onClick={() => {
                          setSelectedTags([])
                          setStatusFilter([])
                          setDawFilter([])
                        }}
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
        </div>

        {/* Projects Grid/List */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {filteredProjects.length > 0 ? (
              <motion.div
                layout
                className={cn(
                  viewMode === 'grid'
                    ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4"
                    : "space-y-3"
                )}
              >
                <AnimatePresence mode="popLayout">
                  {filteredProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      tags={tags}
                      viewMode={viewMode}
                      isSelected={selectedProjects.has(project.id)}
                      onSelect={() => handleProjectSelect(project)}
                      selectionMode={selectionMode}
                      onPlay={onPlayProject}
                      onStop={onStopProject}
                      onOpenProject={onOpenProject}
                      onOpenDaw={onOpenDaw}
                      onGenerateArtwork={onGenerateArtwork}
                      onChangeArtwork={onChangeArtwork}
                      onRemoveArtwork={onRemoveArtwork}
                      onFetchUnsplashPhoto={onFetchUnsplashPhoto}
                      onRemove={async (project) => {
                        const newProjectIds = group.projectIds.filter(id => id !== project.id)
                        await onUpdateGroup(group.id, { projectIds: newProjectIds })
                      }}
                      onEdit={onOpenProject}
                      onDelete={onDeleteProject}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  {searchQuery || selectedTags.length > 0 ? (
                    <Search className="w-8 h-8 text-muted-foreground" />
                  ) : (
                    <Music className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {searchQuery || selectedTags.length > 0 ? 'No projects found' : 'No projects in this group'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || selectedTags.length > 0
                    ? 'Try adjusting your search or filters'
                    : 'Add some projects to get started'}
                </p>
                {!searchQuery && selectedTags.length === 0 && (
                  <Button onClick={() => setShowAddProjectsModal(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Projects
                  </Button>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Edit Group Dialog */}
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Group</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="group-name">Name</Label>
                <Input
                  id="group-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Group name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-description">Description</Label>
                <Textarea
                  id="group-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Add a description..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEditGroup} disabled={!editForm.name.trim()}>
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Projects Modal */}
        <Dialog open={showAddProjectsModal} onOpenChange={setShowAddProjectsModal}>
          <DialogContent className="sm:max-w-5xl h-[85vh] flex flex-col p-0 gap-0">
            <div className="p-6 pb-0 flex-shrink-0">
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-xl">Add Projects to Group</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Select projects to add to "{group.name}". Projects already in this group are not shown.
                </p>
              </DialogHeader>
            </div>
            
            <div className="flex-1 flex flex-col min-h-0 p-6 pt-4">
              {/* Toolbar */}
              <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by title, BPM, or key..."
                    value={addProjectsSearchQuery}
                    onChange={(e) => setAddProjectsSearchQuery(e.target.value)}
                    className="pl-9 h-10"
                  />
                  {addProjectsSearchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setAddProjectsSearchQuery('')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                
                {availableProjects.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAddProjectsSelectedIds(new Set(availableProjects.map(p => p.id)))}
                      className="text-xs"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAddProjectsSelectedIds(new Set())}
                      disabled={addProjectsSelectedIds.size === 0}
                      className="text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>

              {/* Projects Grid */}
              <ScrollArea className="flex-1 -mx-6 px-6">
                {availableProjects.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pb-4">
                    {availableProjects.map((project) => {
                      const isSelected = addProjectsSelectedIds.has(project.id)
                      return (
                        <motion.div
                          key={project.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          onClick={() => {
                            const newSelection = new Set(addProjectsSelectedIds)
                            if (newSelection.has(project.id)) {
                              newSelection.delete(project.id)
                            } else {
                              newSelection.add(project.id)
                            }
                            setAddProjectsSelectedIds(newSelection)
                          }}
                          className={cn(
                            "group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200",
                            "bg-card border",
                            isSelected
                              ? "border-primary ring-2 ring-primary/30 shadow-lg shadow-primary/10"
                              : "border-border/50 hover:border-border hover:shadow-md"
                          )}
                        >
                          {/* Artwork */}
                          <div className="aspect-square bg-muted relative overflow-hidden">
                            {project.artworkPath ? (
                              <img
                                src={`appfile://${project.artworkPath.replace(/\\/g, '/')}`}
                                alt={project.title}
                                className={cn(
                                  "w-full h-full object-cover transition-transform duration-200",
                                  "group-hover:scale-105"
                                )}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                                <Music className="w-8 h-8 text-muted-foreground" />
                              </div>
                            )}
                            
                            {/* Selection overlay */}
                            <AnimatePresence>
                              {isSelected && (
                                <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="absolute inset-0 bg-primary/20 flex items-center justify-center"
                                >
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    exit={{ scale: 0 }}
                                    className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg"
                                  >
                                    <CheckSquare className="w-5 h-5 text-primary-foreground" />
                                  </motion.div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                            
                            {/* Status badge */}
                            <div className="absolute bottom-2 left-2">
                              <Badge 
                                variant="secondary" 
                                className={cn(
                                  "text-[10px] px-1.5 py-0 backdrop-blur-sm",
                                  project.status === 'completed' && "bg-emerald-500/80 text-white",
                                  project.status === 'in-progress' && "bg-amber-500/80 text-white",
                                  project.status === 'mixing' && "bg-purple-500/80 text-white",
                                  project.status === 'mastering' && "bg-blue-500/80 text-white",
                                  project.status === 'idea' && "bg-gray-500/80 text-white",
                                  project.status === 'released' && "bg-green-500/80 text-white",
                                  project.status === 'archived' && "bg-stone-500/80 text-white"
                                )}
                              >
                                {project.status}
                              </Badge>
                            </div>
                          </div>
                          
                          {/* Info */}
                          <div className="p-2.5 space-y-1">
                            <p className="font-medium text-sm truncate">{project.title}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{project.bpm} BPM</span>
                              <span>•</span>
                              <span>{project.musicalKey}</span>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <Sparkles className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium text-foreground mb-1">
                      {addProjectsSearchQuery ? 'No results found' : 'No available projects'}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      {addProjectsSearchQuery 
                        ? `No projects match "${addProjectsSearchQuery}". Try a different search term.`
                        : 'All your projects are already in this group, or you have no projects yet.'}
                    </p>
                    {addProjectsSearchQuery && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAddProjectsSearchQuery('')}
                        className="mt-4"
                      >
                        Clear Search
                      </Button>
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center px-6 py-4 border-t bg-muted/30">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {addProjectsSelectedIds.size} selected
                </span>
                {availableProjects.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    of {availableProjects.length} available
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddProjectsModal(false)
                    setAddProjectsSearchQuery('')
                    setAddProjectsSelectedIds(new Set())
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddProjects}
                  disabled={addProjectsSelectedIds.size === 0}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add {addProjectsSelectedIds.size > 0 ? `${addProjectsSelectedIds.size} ` : ''}Project{addProjectsSelectedIds.size !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Audio Player */}
        <AudioPlayer
          playerState={playerState}
          setPlayerState={onPlayerStateChange}
          projects={projects}
        />
      </div>
    </TooltipProvider>
  )
}

export default GroupDetail
