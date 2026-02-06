import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Calendar, 
  GripVertical,
  Trash2,
  CheckCircle2,
  Circle,
  Loader2,
  Lightbulb,
  Music,
  Headphones,
  Disc3,
  PartyPopper,
  Layers,
  ListTodo,
  ChevronDown,
  Music2,
  Filter,
  SlidersHorizontal,
  // Pro features icons
  AlertTriangle,
  Clock,
  User,
  Tag,
  Paperclip,
  MessageSquare,
  ArrowRight,
  CheckSquare,
  Square,
  Star,
  Flag,
  Users,
  Timer,
  Link,
  Search,
  SortAsc,
  SortDesc,
  X,
  MoreHorizontal,
  Edit3,
  Copy,
  Archive,
  Zap,
  Target,
  TrendingUp,
  BarChart3,
  Settings,
  Keyboard,
  MousePointer2,
  FolderOpen
} from 'lucide-react';
import { Project, ProjectStatus, AppSettings, Tag as TagType } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn, formatTimeSpent } from '@/lib/utils';

interface ProjectColumn {
  id: ProjectStatus;
  title: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const PROJECT_COLUMNS: ProjectColumn[] = [
  { id: 'idea', title: 'Ideas', icon: <Lightbulb className="w-4 h-4" />, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
  { id: 'in-progress', title: 'In Progress', icon: <Music className="w-4 h-4" />, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  { id: 'mixing', title: 'Mixing', icon: <Headphones className="w-4 h-4" />, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  { id: 'mastering', title: 'Mastering', icon: <Disc3 className="w-4 h-4" />, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
  { id: 'completed', title: 'Completed', icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-green-400', bgColor: 'bg-green-500/10' },
  { id: 'released', title: 'Released', icon: <PartyPopper className="w-4 h-4" />, color: 'text-pink-400', bgColor: 'bg-pink-500/10' },
  { id: 'archived', title: 'Archived', icon: <Archive className="w-4 h-4" />, color: 'text-gray-400', bgColor: 'bg-gray-500/10' },
];

// Pro features constants
const PRIORITY_CONFIG = {
  low: { label: 'Low', color: 'text-gray-500', bgColor: 'bg-gray-500/10', icon: <Flag className="w-3 h-3" /> },
  medium: { label: 'Medium', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', icon: <Flag className="w-3 h-3" /> },
  high: { label: 'High', color: 'text-orange-500', bgColor: 'bg-orange-500/10', icon: <Flag className="w-3 h-3" /> },
  urgent: { label: 'Urgent', color: 'text-red-500', bgColor: 'bg-red-500/10', icon: <AlertTriangle className="w-3 h-3" /> },
};

const DEFAULT_ASSIGNEES = ['You', 'Producer', 'Engineer', 'Artist', 'Manager'];

interface SchedulerProps {
  projects: Project[];
  onRefresh: () => void;
  settings: AppSettings;
  tags: TagType[];
  onCreateTag: (name: string) => Promise<TagType | null>;
  onOpenProject: (project: Project) => void;
}

export const Scheduler: React.FC<SchedulerProps> = ({ projects, onRefresh, settings, tags, onCreateTag, onOpenProject }) => {
  // Get all unique tags from projects
  const getAllProjectTags = (): string[] => {
    const tagSet = new Set<string>();
    projects.forEach(project => {
      project.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  };
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // Project filters
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [projectDawFilter, setProjectDawFilter] = useState<string[]>([]);
  const [projectTagFilter, setProjectTagFilter] = useState<string[]>([]);
  const [projectStatusFilter, setProjectStatusFilter] = useState<ProjectStatus[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [projectSortBy, setProjectSortBy] = useState<'title' | 'created' | 'updated' | 'bpm' | 'status' | 'time-spent'>('created');
  const [projectSortOrder, setProjectSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showArchivedProjects, setShowArchivedProjects] = useState(false);
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ProjectStatus | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    project?: Project;
  } | null>(null);

  // Kanban board ref for auto-scroll
  const kanbanBoardRef = useRef<HTMLDivElement>(null);
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  // Project editing state
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Project form data
  const [projectFormData, setProjectFormData] = useState({
    title: '',
    bpm: 120,
    musicalKey: '',
    dawType: '',
    tags: [] as string[],
    newTag: '',
  });

  // Projects grouped by status
  const projectsByStatus = useMemo(() => {
    // First filter projects
    let filteredProjects = [...projects];

    // No need to filter archived projects here since archived is now a status column

    // Search filter
    if (projectSearchQuery) {
      const query = projectSearchQuery.toLowerCase();
      filteredProjects = filteredProjects.filter(project =>
        project.title.toLowerCase().includes(query) ||
        project.collectionName?.toLowerCase().includes(query) ||
        project.tags?.some(tag => tag.toLowerCase().includes(query)) ||
        project.dawType?.toLowerCase().includes(query) ||
        project.musicalKey.toLowerCase().includes(query) ||
        project.status.toLowerCase().includes(query) ||
        project.bpm.toString().includes(query)
      );
    }

    // DAW filter
    if (projectDawFilter.length > 0) {
      filteredProjects = filteredProjects.filter(project =>
        project.dawType && projectDawFilter.includes(project.dawType)
      );
    }

    // Tag filter
    if (projectTagFilter.length > 0) {
      filteredProjects = filteredProjects.filter(project =>
        project.tags?.some(tag => projectTagFilter.includes(tag))
      );
    }

    // Status filter
    if (projectStatusFilter.length > 0) {
      filteredProjects = filteredProjects.filter(project =>
        projectStatusFilter.includes(project.status || 'idea')
      );
    }

    // Sorting
    filteredProjects.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (projectSortBy) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'created':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'updated':
          aValue = new Date(a.updatedAt).getTime();
          bValue = new Date(b.updatedAt).getTime();
          break;
        case 'bpm':
          aValue = a.bpm || 0;
          bValue = b.bpm || 0;
          break;
        case 'time-spent':
          aValue = a.timeSpent || 0;
          bValue = b.timeSpent || 0;
          break;
        case 'status':
          const statusOrder = { 'idea': 1, 'in-progress': 2, 'mixing': 3, 'mastering': 4, 'completed': 5, 'released': 6, 'archived': 7 };
          aValue = statusOrder[a.status || 'idea'] || 1;
          bValue = statusOrder[b.status || 'idea'] || 1;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return projectSortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return projectSortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Then group by status
    const grouped: Record<ProjectStatus, Project[]> = {
      'idea': [],
      'in-progress': [],
      'mixing': [],
      'mastering': [],
      'completed': [],
      'released': [],
      'archived': [],
    };
    
    filteredProjects.forEach(project => {
      const status = project.status || 'idea';
      if (grouped[status]) {
        grouped[status].push(project);
      }
    });
    
    return grouped;
  }, [projects, projectSearchQuery, projectDawFilter, projectTagFilter, projectStatusFilter, showArchivedProjects, projectSortBy, projectSortOrder]);

  // Project handlers
  const handleCreateProject = () => {
    setIsCreatingProject(true);
    setProjectFormData({
      title: '',
      bpm: 120,
      musicalKey: '',
      dawType: '',
      tags: [],
      newTag: '',
    });
  };

  const handleEditProject = (project: Project) => {
    // Open full project detail page for editing
    onOpenProject(project);
  };

  const handleSaveProject = async () => {
    if (!projectFormData.title.trim()) return;

    try {
      const projectData = {
        title: projectFormData.title.trim(),
        bpm: projectFormData.bpm,
        musicalKey: projectFormData.musicalKey.trim() || 'None',
        dawType: projectFormData.dawType.trim() || null,
        tags: projectFormData.tags,
        status: editingProject ? editingProject.status : 'idea' as ProjectStatus,
        artworkPath: editingProject?.artworkPath || null,
        audioPreviewPath: editingProject?.audioPreviewPath || null,
        dawProjectPath: editingProject?.dawProjectPath || null,
        collectionName: editingProject?.collectionName || null,
        favoriteVersionId: editingProject?.favoriteVersionId || null,
        fileModifiedAt: editingProject?.fileModifiedAt || null,
        archived: false,
        createdAt: editingProject?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (editingProject) {
        await window.electron?.updateProject(editingProject.id, {
          title: projectData.title,
          bpm: projectData.bpm,
          musicalKey: projectData.musicalKey,
          dawType: projectData.dawType,
          tags: projectData.tags,
        });
      } else {
        await window.electron?.createProject(projectData);
      }
      await onRefresh();
      handleCancelProjectEdit();
    } catch (error) {
      console.error('Failed to save project:', error);
    }
  };

  const handleCancelProjectEdit = () => {
    setEditingProject(null);
    setIsCreatingProject(false);
    setProjectFormData({
      title: '',
      bpm: 120,
      musicalKey: '',
      dawType: '',
      tags: [],
      newTag: '',
    });
  };

  // Track dragging state for visual feedback
  const [isDragging, setIsDragging] = useState(false);
  const [draggedProjectIds, setDraggedProjectIds] = useState<Set<string>>(new Set());

  // Auto-scroll during drag
  const startAutoScroll = useCallback((direction: 'left' | 'right') => {
    if (autoScrollIntervalRef.current) return;
    
    const scrollSpeed = 15;
    autoScrollIntervalRef.current = setInterval(() => {
      if (kanbanBoardRef.current) {
        const scrollAmount = direction === 'right' ? scrollSpeed : -scrollSpeed;
        kanbanBoardRef.current.scrollLeft += scrollAmount;
      }
    }, 16); // ~60fps
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
  }, []);

  // Handle drag over for auto-scroll
  const handleKanbanDragOver = useCallback((e: React.DragEvent) => {
    if (!isDragging || !kanbanBoardRef.current) return;
    
    const rect = kanbanBoardRef.current.getBoundingClientRect();
    const edgeThreshold = 100; // pixels from edge to trigger scroll
    const mouseX = e.clientX;
    
    if (mouseX < rect.left + edgeThreshold) {
      startAutoScroll('left');
    } else if (mouseX > rect.right - edgeThreshold) {
      startAutoScroll('right');
    } else {
      stopAutoScroll();
    }
  }, [isDragging, startAutoScroll, stopAutoScroll]);

  // Clean up auto-scroll on drag end
  useEffect(() => {
    if (!isDragging) {
      stopAutoScroll();
    }
  }, [isDragging, stopAutoScroll]);

  // Project drag handlers
  const handleProjectDragStart = (project: Project, e: React.DragEvent) => {
    // If the dragged project is already selected, drag all selected items
    // Otherwise, just drag this single project
    if (selectedProjects.has(project.id) && selectedProjects.size > 1) {
      setDraggedProjectIds(new Set(selectedProjects));
    } else {
      setDraggedProjectIds(new Set([project.id]));
      // Also update selection to just this project if not already selected
      if (!selectedProjects.has(project.id)) {
        setSelectedProjects(new Set([project.id]));
      }
    }
    
    setIsDragging(true);
    
    // Create a custom drag image showing count
    const dragCount = selectedProjects.has(project.id) && selectedProjects.size > 1 
      ? selectedProjects.size 
      : 1;
    
    if (dragCount > 1) {
      // Create a custom drag preview element
      const dragPreview = document.createElement('div');
      dragPreview.className = 'fixed pointer-events-none z-[9999] px-3 py-2 bg-primary text-primary-foreground rounded-lg shadow-lg font-medium text-sm flex items-center gap-2';
      dragPreview.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> Moving ${dragCount} projects`;
      dragPreview.style.transform = 'translate(-50%, -50%)';
      document.body.appendChild(dragPreview);
      
      e.dataTransfer.setDragImage(dragPreview, 75, 20);
      
      // Remove the element after a short delay
      setTimeout(() => {
        document.body.removeChild(dragPreview);
      }, 0);
    }
    
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleProjectDragEnd = () => {
    setIsDragging(false);
    setDraggedProjectIds(new Set());
  };

  const handleProjectDragOver = (e: React.DragEvent, columnId: ProjectStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleProjectDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleProjectDrop = async (e: React.DragEvent, targetStatus: ProjectStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    setIsDragging(false);

    const projectsToMove = draggedProjectIds.size > 0 ? draggedProjectIds : selectedProjects;
    if (projectsToMove.size === 0) return;

    try {
      await Promise.all(Array.from(projectsToMove).map(id =>
        window.electron?.updateProject(id, { status: targetStatus })
      ));
      await onRefresh();
      setSelectedProjects(new Set());
      setDraggedProjectIds(new Set());
    } catch (error) {
      console.error('Failed to move projects:', error);
    }
  };

  const clearProjectSelection = () => {
    setSelectedProjects(new Set());
  };

  const bulkUpdateProjects = async (updates: Partial<Project>) => {
    try {
      for (const projectId of selectedProjects) {
        await window.electron?.updateProject(projectId, updates);
      }
      await onRefresh();
      clearProjectSelection();
      setBulkEditMode(false);
    } catch (error) {
      console.error('Failed to bulk update projects:', error);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Projects Kanban Board */}
        <div className="flex flex-col">
          {/* Projects Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-6 py-5 border-b border-border/30"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Layers className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Project Board</h1>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={showArchivedProjects ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowArchivedProjects(!showArchivedProjects)}
                  className="gap-2"
                >
                  <Archive className="w-4 h-4" />
                  {showArchivedProjects ? "Hide Archived" : "Show Archived"}
                </Button>
                <Button
                  onClick={handleCreateProject}
                  className="gap-2"
                >
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
                  value={projectSearchQuery}
                  onChange={(e) => setProjectSearchQuery(e.target.value)}
                  className="pl-9 bg-muted/30"
                />
                {projectSearchQuery && (
                  <button
                    onClick={() => setProjectSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <Select
                value={`${projectSortBy}-${projectSortOrder}`}
                onValueChange={(value) => {
                  const [sortBy, sortOrder] = value.split('-') as [typeof projectSortBy, typeof projectSortOrder];
                  setProjectSortBy(sortBy);
                  setProjectSortOrder(sortOrder);
                }}
              >
                <SelectTrigger className="w-44 bg-muted/30">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created-desc">Newest First</SelectItem>
                  <SelectItem value="created-asc">Oldest First</SelectItem>
                  <SelectItem value="title-asc">Name A-Z</SelectItem>
                  <SelectItem value="title-desc">Name Z-A</SelectItem>
                  <SelectItem value="bpm-asc">BPM Low-High</SelectItem>
                  <SelectItem value="bpm-desc">BPM High-Low</SelectItem>
                  <SelectItem value="time-spent-asc">Time Low-High</SelectItem>
                  <SelectItem value="time-spent-desc">Time High-Low</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant={showAdvancedFilters ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </Button>

              <div className="h-6 w-px bg-border" />

              {selectedProjects.size > 0 && !bulkEditMode && (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selectedProjects.size} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBulkEditMode(true)}
                    className="gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    Bulk Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearProjectSelection}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              )}
              {bulkEditMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBulkEditMode(false);
                    clearProjectSelection();
                  }}
                  className="gap-2"
                >
                  <X className="w-4 h-4" />
                  Exit Select
                </Button>
              )}
              {!bulkEditMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkEditMode(true)}
                  className="gap-2"
                >
                  <CheckSquare className="w-4 h-4" />
                  Select
                </Button>
              )}
            </div>

            {/* Filters Panel */}
            <AnimatePresence>
              {showAdvancedFilters && (
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
                        {PROJECT_COLUMNS.filter(col => col.id !== 'archived' || showArchivedProjects).map((column) => (
                          <button
                            key={column.id}
                            onClick={() => {
                              if (projectStatusFilter.includes(column.id)) {
                                setProjectStatusFilter(projectStatusFilter.filter(s => s !== column.id));
                              } else {
                                setProjectStatusFilter([...projectStatusFilter, column.id]);
                              }
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5",
                              projectStatusFilter.includes(column.id)
                                ? "bg-primary text-primary-foreground"
                                : `${column.bgColor} ${column.color} hover:opacity-80`
                            )}
                          >
                            <span className={projectStatusFilter.includes(column.id) ? "" : column.color}>{column.icon}</span>
                            {column.title}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tags Filter */}
                    {getAllProjectTags().length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Tags</label>
                        <div className="flex flex-wrap gap-2">
                          {getAllProjectTags().map((tag) => (
                            <button
                              key={tag}
                              onClick={() => {
                                if (projectTagFilter.includes(tag)) {
                                  setProjectTagFilter(projectTagFilter.filter(t => t !== tag));
                                } else {
                                  setProjectTagFilter([...projectTagFilter, tag]);
                                }
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                                projectTagFilter.includes(tag)
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

                    {/* DAW Filter */}
                    {settings.selectedDAWs.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">DAW</label>
                        <div className="flex flex-wrap gap-2">
                          {settings.selectedDAWs.map((daw) => (
                            <button
                              key={daw}
                              onClick={() => {
                                if (projectDawFilter.includes(daw)) {
                                  setProjectDawFilter(projectDawFilter.filter(d => d !== daw));
                                } else {
                                  setProjectDawFilter([...projectDawFilter, daw]);
                                }
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                                projectDawFilter.includes(daw)
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
                    {(projectStatusFilter.length > 0 || projectTagFilter.length > 0 || projectDawFilter.length > 0) && (
                      <div className="pt-2">
                        <button
                          onClick={() => {
                            setProjectStatusFilter([]);
                            setProjectTagFilter([]);
                            setProjectDawFilter([]);
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
          </motion.div>

          {/* Bulk Edit Bar for Projects */}
          {bulkEditMode && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-6 py-3 border-b border-border/30 bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {selectedProjects.size} project{selectedProjects.size !== 1 ? 's' : ''} selected - Click items to select/deselect
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const allVisibleProjects = projects.filter(project => {
                      // Apply current filters
                      if (projectSearchQuery && !project.title.toLowerCase().includes(projectSearchQuery.toLowerCase())) return false;
                      if (projectDawFilter.length > 0 && !projectDawFilter.includes(project.dawType || '')) return false;
                      return true;
                    });
                    setSelectedProjects(new Set(allVisibleProjects.map(p => p.id)));
                  }}
                  className="gap-2"
                >
                  <CheckSquare className="w-4 h-4" />
                  Select All
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-2">
                      <ArrowRight className="w-4 h-4" />
                      Move to
                      <ChevronDown className="w-4 h-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {PROJECT_COLUMNS.filter(column => column.id !== 'archived' || showArchivedProjects).map((column) => (
                      <DropdownMenuItem
                        key={column.id}
                        onClick={() => bulkUpdateProjects({ status: column.id })}
                        className="gap-2"
                      >
                        <span className={column.color}>{column.icon}</span>
                        {column.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulkUpdateProjects({ status: 'archived' })}
                  className="gap-2"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm(`Delete ${selectedProjects.size} project${selectedProjects.size > 1 ? 's' : ''}?`)) {
                      selectedProjects.forEach(async (projectId) => {
                        await window.electron?.deleteProject(projectId);
                      });
                      onRefresh();
                      clearProjectSelection();
                      setBulkEditMode(false);
                    }
                  }}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setBulkEditMode(false)}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}

          {/* Project Columns */}
            <div 
              ref={kanbanBoardRef}
              className="flex-1 p-6 overflow-x-auto overflow-y-auto" 
              onClick={() => setSelectedProjects(new Set())}
              onDragOver={handleKanbanDragOver}
              onDragLeave={stopAutoScroll}
              onDrop={stopAutoScroll}
            >
              <div className="flex gap-4 min-w-max pb-4">
                {PROJECT_COLUMNS.filter(column => column.id !== 'archived' || showArchivedProjects).map((column) => (
                  <div
                    key={column.id}
                    className={cn(
                      "w-[320px] flex flex-col rounded-xl border transition-all duration-200",
                      dragOverColumn === column.id
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/30 bg-card/30"
                    )}
                    style={{
                      touchAction: 'pan-y'
                    }}
                    onDragOver={(e) => handleProjectDragOver(e, column.id)}
                    onDragLeave={handleProjectDragLeave}
                    onDrop={(e) => handleProjectDrop(e, column.id)}
                  >
                    {/* Column Header */}
                    <div className={cn("p-4 border-b border-border/30", column.bgColor)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={column.color}>{column.icon}</span>
                          <h3 className="font-medium text-sm">{column.title}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {projectsByStatus[column.id].length}
                          </Badge>
                          {bulkEditMode && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                              onClick={() => {
                                const columnProjects = projectsByStatus[column.id];
                                setSelectedProjects(prev => {
                                  const newSet = new Set(prev);
                                  columnProjects.forEach(project => newSet.add(project.id));
                                  return newSet;
                                });
                              }}
                              title={`Select all ${column.title} projects`}
                            >
                              <CheckSquare className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Project Cards */}
                    <div 
                      className="flex-1"
                    >
                      <div className="p-2 space-y-2">
                        <AnimatePresence>
                          {projectsByStatus[column.id].map((project) => {
                            const isBeingDragged = isDragging && draggedProjectIds.has(project.id);
                            const isPartOfDragGroup = isDragging && selectedProjects.has(project.id) && draggedProjectIds.size > 1;
                            
                            return (
                              <motion.div
                                key={project.id}
                                exit={{ opacity: 0, scale: 0.95 }}
                                draggable={true}
                                onClick={(e) => {
                                  // Ctrl+click to toggle selection
                                  if (e.ctrlKey) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Enter bulk mode if not already
                                    if (!bulkEditMode) {
                                      setBulkEditMode(true);
                                    }
                                    // Toggle this project's selection
                                    setSelectedProjects(prev => {
                                      const newSet = new Set(prev);
                                      if (newSet.has(project.id)) {
                                        newSet.delete(project.id);
                                      } else {
                                        newSet.add(project.id);
                                      }
                                      return newSet;
                                    });
                                    return;
                                  }
                                  // In bulk edit mode, regular click toggles selection
                                  if (bulkEditMode) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedProjects(prev => {
                                      const newSet = new Set(prev);
                                      if (newSet.has(project.id)) {
                                        newSet.delete(project.id);
                                      } else {
                                        newSet.add(project.id);
                                      }
                                      return newSet;
                                    });
                                  }
                                }}
                                onDragStart={(e) => handleProjectDragStart(project, e as unknown as React.DragEvent)}
                                onDragEnd={handleProjectDragEnd}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setContextMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    project: project,
                                  });
                                }}
                                className={cn(
                                  "group relative p-4 rounded-lg border border-border/30 bg-card/80 cursor-grab active:cursor-grabbing transition-all hover:border-primary/40 hover:bg-card/90 hover:shadow-md w-full select-none",
                                  selectedProjects.has(project.id) && "ring-2 ring-primary/50 bg-primary/5",
                                  isBeingDragged && "opacity-50 scale-95",
                                  isPartOfDragGroup && !isBeingDragged && "opacity-60 ring-2 ring-primary/30"
                                )}
                              >
                                {/* Multi-drag indicator badge */}
                                {selectedProjects.has(project.id) && selectedProjects.size > 1 && !isDragging && (
                                  <div className="absolute -top-2 -right-2 z-10 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
                                    {selectedProjects.size}
                                  </div>
                                )}
                                <div className="flex items-start gap-3">
                                  {/* Artwork */}
                                  <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex-shrink-0 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                                    {project.artworkPath ? (
                                      <img
                                        src={`appfile://${project.artworkPath.replace(/\\/g, "/")}`}
                                        alt={project.title}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                                        <Music2 className="w-6 h-6 text-muted-foreground" />
                                      </div>
                                    )}
                                  </div>

                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                                        {project.title}
                                      </h4>
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditProject(project);
                                          }}
                                        >
                                          <Edit3 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Project Meta */}
                                    <div className="flex items-center gap-2 mt-1">
                                      {project.bpm > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                          {project.bpm} BPM
                                        </span>
                                      )}
                                      {project.musicalKey && (
                                        <>
                                          <span className="text-muted-foreground">•</span>
                                          <span className="text-xs text-muted-foreground">
                                            {project.musicalKey}
                                          </span>
                                        </>
                                      )}
                                      {(project.timeSpent ?? 0) > 0 && (
                                        <>
                                          <span className="text-muted-foreground">•</span>
                                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {formatTimeSpent(project.timeSpent || 0)}
                                          </span>
                                        </>
                                      )}
                                    </div>

                                    {/* Progress Bar */}

                                    {/* Tags and DAW */}
                                    <div className="flex items-center gap-1 mt-2">
                                      {project.dawType && (
                                        <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                                          {project.dawType}
                                        </Badge>
                                      )}
                                      {project.tags && project.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                          {project.tags.slice(0, 2).map((tag) => (
                                            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0.5">
                                              {tag}
                                            </Badge>
                                          ))}
                                          {project.tags.length > 2 && (
                                            <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                                              +{project.tags.length - 2}
                                            </Badge>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>

                        {projectsByStatus[column.id].length === 0 && (
                          <div className="h-[100px] flex items-center justify-center text-muted-foreground text-xs">
                            Drag projects here
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
        </div>
      </div>

      {/* Create/Edit Project Dialog */}
      <Dialog open={isCreatingProject || editingProject !== null} onOpenChange={(open) => {
        if (!open) handleCancelProjectEdit();
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingProject ? 'Edit Project' : 'Create New Project'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={projectFormData.title}
                onChange={(e) => setProjectFormData({ ...projectFormData, title: e.target.value })}
                placeholder="Project title"
                autoFocus
              />
            </div>

            {/* BPM and Key Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">BPM</label>
                <Input
                  type="number"
                  min={0}
                  max={999}
                  value={projectFormData.bpm || ''}
                  onChange={(e) => setProjectFormData({ ...projectFormData, bpm: parseInt(e.target.value) || 0 })}
                  placeholder="120"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Key</label>
                <Select
                  value={projectFormData.musicalKey || 'None'}
                  onValueChange={(value) => setProjectFormData({ ...projectFormData, musicalKey: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select key" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">No key</SelectItem>
                    {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((key) => (
                      <SelectItem key={`${key} Major`} value={`${key} Major`}>{key} Major</SelectItem>
                    ))}
                    {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((key) => (
                      <SelectItem key={`${key} Minor`} value={`${key} Minor`}>{key} Minor</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* DAW Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">DAW</label>
              <Select
                value={projectFormData.dawType || 'none'}
                onValueChange={(value) => setProjectFormData({ ...projectFormData, dawType: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select DAW" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {settings.selectedDAWs?.map((daw) => (
                    <SelectItem key={daw} value={daw}>{daw}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tags</label>
              <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-muted/30 border border-input min-h-[48px]">
                {projectFormData.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 pr-1.5">
                    {tag}
                    <button
                      onClick={() => setProjectFormData({
                        ...projectFormData,
                        tags: projectFormData.tags.filter((t) => t !== tag)
                      })}
                      className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                <input
                  type="text"
                  value={projectFormData.newTag}
                  onChange={(e) => setProjectFormData({ ...projectFormData, newTag: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && projectFormData.newTag.trim()) {
                      e.preventDefault();
                      if (!projectFormData.tags.includes(projectFormData.newTag.trim())) {
                        setProjectFormData({
                          ...projectFormData,
                          tags: [...projectFormData.tags, projectFormData.newTag.trim()],
                          newTag: ''
                        });
                      }
                    }
                  }}
                  placeholder={projectFormData.tags.length === 0 ? "Add tags..." : ""}
                  className="flex-1 min-w-[100px] bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
                />
              </div>
              {/* Global Tags - user created */}
              <div className="flex flex-wrap gap-1">
                {tags.filter(tag => !projectFormData.tags.includes(tag.name)).slice(0, 8).map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setProjectFormData({
                      ...projectFormData,
                      tags: [...projectFormData.tags, tag.name]
                    })}
                    className="px-2 py-0.5 text-xs rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    + {tag.name}
                  </button>
                ))}
                {/* Create new tag button when typing */}
                {projectFormData.newTag.trim() && !tags.some(t => t.name.toLowerCase() === projectFormData.newTag.trim().toLowerCase()) && (
                  <button
                    type="button"
                    onClick={async () => {
                      const newTagName = projectFormData.newTag.trim();
                      await onCreateTag(newTagName);
                      setProjectFormData({
                        ...projectFormData,
                        tags: [...projectFormData.tags, newTagName],
                        newTag: ''
                      });
                    }}
                    className="px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                  >
                    Create "{projectFormData.newTag.trim()}"
                  </button>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleCancelProjectEdit}>
                Cancel
              </Button>
              <Button onClick={handleSaveProject} disabled={!projectFormData.title.trim()}>
                {editingProject ? 'Save Changes' : 'Create Project'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Context Menu */}
      {contextMenu && contextMenu.project && (
        <div
          className="fixed z-50 min-w-[200px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => {
              handleEditProject(contextMenu.project!);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <Edit3 className="w-4 h-4" />
            Edit Project
          </button>
          <button
            onClick={() => {
              if (contextMenu.project?.dawProjectPath) {
                window.electron?.openInDaw(contextMenu.project.dawProjectPath);
              }
              setContextMenu(null);
            }}
            disabled={!contextMenu.project?.dawProjectPath}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FolderOpen className="w-4 h-4" />
            Open in DAW
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.project!.title);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <Copy className="w-4 h-4" />
            Copy Title
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            onClick={() => {
              setBulkEditMode(true);
              setSelectedProjects(new Set([contextMenu.project!.id]));
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <MousePointer2 className="w-4 h-4" />
            Select Multiple
          </button>
          <div className="my-1 h-px bg-border" />
          {/* Quick Status Change */}
          <div className="px-2 py-1 text-xs text-muted-foreground font-medium">Move to</div>
          {PROJECT_COLUMNS.filter(col => col.id !== contextMenu.project?.status).slice(0, 4).map((column) => (
            <button
              key={column.id}
              onClick={async () => {
                await window.electron?.updateProject(contextMenu.project!.id, { status: column.id });
                onRefresh();
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <span className={column.color}>{column.icon}</span>
              {column.title}
            </button>
          ))}
          <div className="my-1 h-px bg-border" />
          <button
            onClick={async () => {
              await window.electron?.updateProject(contextMenu.project!.id, { status: 'archived' });
              onRefresh();
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <Archive className="w-4 h-4" />
            Archive
          </button>
          <button
            onClick={async () => {
              if (confirm(`Delete "${contextMenu.project!.title}"?`)) {
                await window.electron?.deleteProject(contextMenu.project!.id);
                onRefresh();
              }
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4" />
            Delete Project
          </button>
        </div>
      )}
    </div>
  );

};

export default Scheduler;
