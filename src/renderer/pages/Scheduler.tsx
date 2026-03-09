import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Calendar, 
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
import { useImageUrl } from '@/hooks/useImageUrl';
import { useI18n } from '@/i18n';

function ArtworkImage({ filePath, alt, className, isVisible = true }: { filePath: string | null | undefined, alt: string, className?: string, isVisible?: boolean }) {
  // Only trigger Tauri IPC image load when the card is visible
  const url = useImageUrl(isVisible ? filePath : null)
  if (!url) return null
  return <img src={url} alt={alt} className={className} loading="lazy" decoding="async" draggable={false} />
}

interface ProjectColumn {
  id: ProjectStatus;
  title: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const PROJECT_COLUMNS: ProjectColumn[] = [
  { id: 'idea', title: 'Ideas', icon: <Lightbulb className="w-4 h-4" />, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-500/15 dark:bg-purple-500/10' },
  { id: 'in-progress', title: 'In Progress', icon: <Music className="w-4 h-4" />, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500/15 dark:bg-blue-500/10' },
  { id: 'mixing', title: 'Mixing', icon: <Headphones className="w-4 h-4" />, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-500/15 dark:bg-orange-500/10' },
  { id: 'mastering', title: 'Mastering', icon: <Disc3 className="w-4 h-4" />, color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-500/15 dark:bg-cyan-500/10' },
  { id: 'completed', title: 'Completed', icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-500/15 dark:bg-green-500/10' },
  { id: 'released', title: 'Released', icon: <PartyPopper className="w-4 h-4" />, color: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-500/15 dark:bg-pink-500/10' },
  { id: 'archived', title: 'Archived', icon: <Archive className="w-4 h-4" />, color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-500/15 dark:bg-gray-500/10' },
];

// Pro features constants
const PRIORITY_CONFIG = {
  low: { label: 'Low', color: 'text-gray-600 dark:text-gray-500', bgColor: 'bg-gray-500/15 dark:bg-gray-500/10', icon: <Flag className="w-3 h-3" /> },
  medium: { label: 'Medium', color: 'text-yellow-600 dark:text-yellow-500', bgColor: 'bg-yellow-500/15 dark:bg-yellow-500/10', icon: <Flag className="w-3 h-3" /> },
  high: { label: 'High', color: 'text-orange-600 dark:text-orange-500', bgColor: 'bg-orange-500/15 dark:bg-orange-500/10', icon: <Flag className="w-3 h-3" /> },
  urgent: { label: 'Urgent', color: 'text-red-600 dark:text-red-500', bgColor: 'bg-red-500/15 dark:bg-red-500/10', icon: <AlertTriangle className="w-3 h-3" /> },
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

const DRAG_THRESHOLD = 5;

/**
 * Shared refs that BoardCard reads via ref instead of props.
 * This avoids passing fast-changing global state as props to every card,
 * which would defeat React.memo for all 2500 cards.
 */
interface BoardSharedState {
  selectedProjects: Set<string>;
  isDragging: boolean;
  draggedProjectIds: Set<string>;
  bulkEditMode: boolean;
  onMouseDown: (project: Project, e: React.MouseEvent, cardEl: HTMLElement) => void;
  onClick: (project: Project, e: React.MouseEvent) => void;
  onContextMenu: (project: Project, e: React.MouseEvent) => void;
  onEdit: (project: Project) => void;
}

/**
 * Memoized board card. Only re-renders when project data or its own
 * selection state changes. Global drag/selection state is read from
 * a shared ref so it doesn't cause re-renders.
 */
interface BoardCardProps {
  project: Project;
  isSelected: boolean;
  observer: IntersectionObserver | null;
  sharedRef: React.RefObject<BoardSharedState>;
}

/**
 * Windowed column renderer. Only mounts BoardCard components that are
 * visible in the scroll viewport + overscan. This is the key to making
 * 2500 projects load instantly — we only ever mount ~20-30 cards at a time
 * per column instead of hundreds.
 */
const VirtualizedColumn = memo(({
  projects,
  selectedProjects,
  observer,
  sharedRef,
  itemHeight,
  overscan,
}: {
  projects: Project[];
  selectedProjects: Set<string>;
  observer: IntersectionObserver | null;
  sharedRef: React.RefObject<BoardSharedState>;
  itemHeight: number;
  overscan: number;
}) => {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Measure container height once and on resize
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setContainerHeight(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const totalHeight = projects.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    projects.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  const topPad = startIndex * itemHeight;
  const bottomPad = Math.max(0, totalHeight - endIndex * itemHeight);

  const visibleProjects = projects.slice(startIndex, endIndex);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto overflow-x-hidden p-2"
      onScroll={handleScroll}
    >
      {projects.length === 0 ? (
        <div className="h-[100px] flex items-center justify-center text-muted-foreground text-xs">
          {t('scheduler.dragHere')}
        </div>
      ) : (
        <>
          {topPad > 0 && <div style={{ height: topPad }} aria-hidden />}
          <div className="space-y-2">
            {visibleProjects.map((project) => (
              <BoardCard
                key={project.id}
                project={project}
                isSelected={selectedProjects.has(project.id)}
                observer={observer}
                sharedRef={sharedRef}
              />
            ))}
          </div>
          {bottomPad > 0 && <div style={{ height: bottomPad }} aria-hidden />}
        </>
      )}
    </div>
  );
});

const BoardCard = memo(({ project, isSelected, observer, sharedRef }: BoardCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !observer) return;
    (el as any).__setVisible = setIsVisible;
    observer.observe(el);
    return () => {
      observer.unobserve(el);
      delete (el as any).__setVisible;
    };
  }, [observer]);

  // Read shared state from ref (doesn't trigger re-renders)
  const shared = sharedRef.current!;

  return (
    <div
      ref={ref}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest('button, a, input, textarea, [role="menuitem"]')) return;
        shared.onMouseDown(project, e, ref.current!);
      }}
      onClick={(e) => shared.onClick(project, e)}
      onContextMenu={(e) => shared.onContextMenu(project, e)}
      className={cn(
        "group relative p-4 rounded-lg border-2 bg-card/80 cursor-grab active:cursor-grabbing w-full select-none",
        "transition-all duration-150 ease-out",
        isSelected
          ? "border-primary/60 bg-primary/5"
          : "border-transparent hover:border-primary/30 hover:bg-card/90 hover:shadow-md",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Artwork */}
        <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex-shrink-0 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
          {project.artworkPath ? (
            <ArtworkImage
              filePath={project.artworkPath}
              alt={project.title}
              className="w-full h-full object-cover"
              isVisible={isVisible}
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
                  shared.onEdit(project);
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

          {/* Genre & Artist */}
          {(project.genre || project.artists) && (
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground truncate">
              {project.artists && (
                <span className="truncate">{project.artists}</span>
              )}
              {project.artists && project.genre && (
                <span className="text-muted-foreground/50">|</span>
              )}
              {project.genre && (
                <span className="truncate">{project.genre}</span>
              )}
            </div>
          )}

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
    </div>
  );
}, (prev, next) => {
  // Only re-render when project data or selection state changes.
  // Shared ref, observer, and callbacks never cause re-renders.
  return (
    prev.project === next.project &&
    prev.isSelected === next.isSelected &&
    prev.observer === next.observer
  );
});

export const Scheduler: React.FC<SchedulerProps> = ({ projects, onRefresh, settings, tags, onCreateTag, onOpenProject }) => {
  const { t } = useI18n();
  const statusLabel = (id: ProjectStatus): string => {
    const map: Record<ProjectStatus, string> = {
      'idea': t('status.idea'),
      'in-progress': t('status.inProgress'),
      'mixing': t('status.mixing'),
      'mastering': t('status.mastering'),
      'completed': t('status.completed'),
      'released': t('status.released'),
      'archived': t('status.archived'),
    };
    return map[id] || id;
  };

  // Memoized unique values from projects
  const allProjectTags = useMemo(() => {
    const tagSet = new Set<string>();
    projects.forEach(project => {
      project.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [projects]);

  const allProjectGenres = useMemo(() => {
    const genreSet = new Set<string>();
    projects.forEach(project => {
      if (project.genre) genreSet.add(project.genre);
    });
    return Array.from(genreSet).sort();
  }, [projects]);

  const allProjectArtists = useMemo(() => {
    const artistSet = new Set<string>();
    projects.forEach(project => {
      if (project.artists) artistSet.add(project.artists);
    });
    return Array.from(artistSet).sort();
  }, [projects]);

  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // Project filters — debounced search
  const [searchInput, setSearchInput] = useState('');
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setProjectSearchQuery(value);
    }, 200);
  }, []);

  useEffect(() => {
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, []);
  // Shared IntersectionObserver for lazy image loading on board cards
  const [boardObserver, setBoardObserver] = useState<IntersectionObserver | null>(null);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const setVisible = (entry.target as any).__setVisible as
            | React.Dispatch<React.SetStateAction<boolean>>
            | undefined;
          if (setVisible) {
            setVisible(entry.isIntersecting);
          }
        }
      },
      { rootMargin: '600px 0px', threshold: 0 }
    );
    setBoardObserver(io);
    return () => io.disconnect();
  }, []);

  const [projectDawFilter, setProjectDawFilter] = useState<string[]>([]);
  const [projectTagFilter, setProjectTagFilter] = useState<string[]>([]);
  const [projectStatusFilter, setProjectStatusFilter] = useState<ProjectStatus[]>([]);
  const [projectGenreFilter, setProjectGenreFilter] = useState<string[]>([]);
  const [projectArtistFilter, setProjectArtistFilter] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [projectSortBy, setProjectSortBy] = useState<'title' | 'created' | 'updated' | 'bpm' | 'status' | 'time-spent' | 'custom'>('created');
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

    // Genre filter
    if (projectGenreFilter.length > 0) {
      filteredProjects = filteredProjects.filter(project =>
        project.genre && projectGenreFilter.includes(project.genre)
      );
    }

    // Artist filter
    if (projectArtistFilter.length > 0) {
      filteredProjects = filteredProjects.filter(project =>
        project.artists && projectArtistFilter.includes(project.artists)
      );
    }

    // Sorting
    filteredProjects.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (projectSortBy) {
        case 'custom':
          aValue = a.sortOrder || 0;
          bValue = b.sortOrder || 0;
          break;
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

      // Custom sort is always ascending (lower sortOrder = higher in list)
      if (projectSortBy === 'custom') {
        return aValue - bValue;
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
  }, [projects, projectSearchQuery, projectDawFilter, projectTagFilter, projectStatusFilter, projectGenreFilter, projectArtistFilter, showArchivedProjects, projectSortBy, projectSortOrder]);

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

  const handleEditProject = useCallback((project: Project) => {
    onOpenProject(project);
  }, [onOpenProject]);

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
        sortOrder: editingProject?.sortOrder || 0,
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

  // Mouse-based drag system refs
  const dragRef = useRef<{
    projectIds: Set<string>;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    cardEl: HTMLElement;
    ghost: HTMLElement | null;
    activated: boolean;
  } | null>(null);
  const columnRefs = useRef<Map<ProjectStatus, HTMLElement>>(new Map());

  const setColumnRef = useCallback((status: ProjectStatus, el: HTMLDivElement | null) => {
    if (el) columnRefs.current.set(status, el);
    else columnRefs.current.delete(status);
  }, []);

  const getColumnAtPoint = useCallback((x: number, y: number): ProjectStatus | null => {
    for (const [status, el] of columnRefs.current.entries()) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return status;
      }
    }
    return null;
  }, []);

  // Stable refs for callbacks used in global listeners
  const onRefreshRef = useRef(onRefresh);
  const projectSortByRef = useRef(projectSortBy);
  const projectsByStatusRef = useRef(projectsByStatus);
  onRefreshRef.current = onRefresh;
  projectSortByRef.current = projectSortBy;
  projectsByStatusRef.current = projectsByStatus;

  // Global mousemove + mouseup for drag
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (!drag.activated) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;

        // Activate drag: create ghost
        drag.activated = true;
        const rect = drag.cardEl.getBoundingClientRect();
        const ghost = drag.cardEl.cloneNode(true) as HTMLElement;
        ghost.style.position = 'fixed';
        ghost.style.left = `${rect.left}px`;
        ghost.style.top = `${rect.top}px`;
        ghost.style.width = `${rect.width}px`;
        ghost.style.zIndex = '9999';
        ghost.style.pointerEvents = 'none';
        ghost.style.opacity = '0.92';
        ghost.style.transform = 'rotate(2deg) scale(1.03)';
        ghost.style.boxShadow = '0 12px 28px rgba(0,0,0,0.2)';
        ghost.style.transition = 'transform 0.15s ease, box-shadow 0.15s ease';
        ghost.style.borderRadius = '0.5rem';

        // For multi-drag, add a badge showing count
        if (drag.projectIds.size > 1) {
          const badge = document.createElement('div');
          badge.style.cssText = 'position:absolute;top:-8px;right:-8px;background:hsl(var(--primary));color:hsl(var(--primary-foreground));border-radius:9999px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;box-shadow:0 2px 6px rgba(0,0,0,0.2);';
          badge.textContent = String(drag.projectIds.size);
          ghost.style.position = 'fixed';
          ghost.appendChild(badge);
        }

        document.body.appendChild(ghost);
        drag.ghost = ghost;

        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
        setIsDragging(true);
        setDraggedProjectIds(drag.projectIds);
      }

      // Move ghost
      if (drag.ghost) {
        drag.ghost.style.left = `${e.clientX - drag.offsetX}px`;
        drag.ghost.style.top = `${e.clientY - drag.offsetY}px`;
      }

      // Detect column hover
      setDragOverColumn(getColumnAtPoint(e.clientX, e.clientY));

      // Auto-scroll horizontally near edges
      if (kanbanBoardRef.current) {
        const rect = kanbanBoardRef.current.getBoundingClientRect();
        const edgeThreshold = 100;
        if (e.clientX < rect.left + edgeThreshold) {
          kanbanBoardRef.current.scrollLeft -= 8;
        } else if (e.clientX > rect.right - edgeThreshold) {
          kanbanBoardRef.current.scrollLeft += 8;
        }
      }
    };

    const onMouseUp = async (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;

      if (drag.ghost) drag.ghost.remove();
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      if (!drag.activated) {
        setIsDragging(false);
        setDragOverColumn(null);
        setDraggedProjectIds(new Set());
        return;
      }

      const targetColumn = getColumnAtPoint(e.clientX, e.clientY);
      setIsDragging(false);
      setDragOverColumn(null);
      setDraggedProjectIds(new Set());

      if (targetColumn && drag.projectIds.size > 0) {
        try {
          const targetColumnLen = projectsByStatusRef.current[targetColumn]?.length || 0;
          await Promise.all(Array.from(drag.projectIds).map((id, i) =>
            window.electron?.updateProject(id, {
              status: targetColumn,
              ...(projectSortByRef.current === 'custom' ? { sortOrder: targetColumnLen + i } : {}),
            })
          ));
          await onRefreshRef.current();
          setSelectedProjects(new Set());
        } catch (error) {
          console.error('Failed to move projects:', error);
        }
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (dragRef.current?.ghost) {
        dragRef.current.ghost.remove();
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
    };
  }, [getColumnAtPoint]);

  // Shared ref for BoardCard — holds fast-changing state and callbacks.
  // Cards read from this ref at event time, so changes never trigger re-renders.
  const boardSharedRef = useRef<BoardSharedState>(null!) as React.MutableRefObject<BoardSharedState>;
  if (!boardSharedRef.current) {
    boardSharedRef.current = {
      selectedProjects, isDragging, draggedProjectIds, bulkEditMode,
      onMouseDown: () => {},
      onClick: () => {}, onContextMenu: () => {}, onEdit: () => {},
    };
  }
  // Sync ref on every render (cheap, no state change)
  boardSharedRef.current.selectedProjects = selectedProjects;
  boardSharedRef.current.isDragging = isDragging;
  boardSharedRef.current.draggedProjectIds = draggedProjectIds;
  boardSharedRef.current.bulkEditMode = bulkEditMode;
  boardSharedRef.current.onEdit = handleEditProject;
  boardSharedRef.current.onClick = (project: Project, e: React.MouseEvent) => {
    // Ctrl+click = toggle selection (multi-select)
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      if (!bulkEditMode) setBulkEditMode(true);
      setSelectedProjects(prev => {
        const newSet = new Set(prev);
        if (newSet.has(project.id)) newSet.delete(project.id);
        else newSet.add(project.id);
        return newSet;
      });
      return;
    }
    if (bulkEditMode) {
      e.preventDefault();
      e.stopPropagation();
      setSelectedProjects(prev => {
        const newSet = new Set(prev);
        if (newSet.has(project.id)) newSet.delete(project.id);
        else newSet.add(project.id);
        return newSet;
      });
    }
  };
  boardSharedRef.current.onContextMenu = (project: Project, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, project });
  };
  boardSharedRef.current.onMouseDown = (project: Project, e: React.MouseEvent, cardEl: HTMLElement) => {
    // Ctrl+click is for multi-select, not drag
    if (e.ctrlKey || e.metaKey) return;
    // In bulk edit mode, clicks are for selection
    if (bulkEditMode) return;

    const rect = cardEl.getBoundingClientRect();

    // If this card is part of a multi-selection, drag all selected
    const projectIds = selectedProjects.has(project.id) && selectedProjects.size > 1
      ? new Set(selectedProjects)
      : new Set([project.id]);

    dragRef.current = {
      projectIds,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      cardEl,
      ghost: null,
      activated: false,
    };
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Projects Kanban Board */}
        <div className="flex-1 flex flex-col overflow-hidden">
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
                <h1 className="text-2xl font-bold text-foreground">{t('scheduler.title')}</h1>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={showArchivedProjects ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowArchivedProjects(!showArchivedProjects)}
                  className="gap-2"
                >
                  <Archive className="w-4 h-4" />
                  {showArchivedProjects ? t('scheduler.hideArchived') : t('scheduler.showArchived')}
                </Button>
                <Button
                  onClick={handleCreateProject}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {t('scheduler.newProject')}
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
                      setSearchInput('');
                      setProjectSearchQuery('');
                      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <Select
                value={projectSortBy === 'custom' ? 'custom-asc' : `${projectSortBy}-${projectSortOrder}`}
                onValueChange={(value) => {
                  if (value === 'custom-asc') {
                    setProjectSortBy('custom');
                    setProjectSortOrder('asc');
                  } else {
                    const [sortBy, sortOrder] = value.split('-') as [typeof projectSortBy, typeof projectSortOrder];
                    setProjectSortBy(sortBy);
                    setProjectSortOrder(sortOrder);
                  }
                }}
              >
                <SelectTrigger className="w-44 bg-muted/30">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom-asc">Custom Order</SelectItem>
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
                    {t('scheduler.bulkEdit')}
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
                  {t('scheduler.exitSelect')}
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
                            {statusLabel(column.id)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tags Filter */}
                    {allProjectTags.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">{t('form.tags')}</label>
                        <div className="flex flex-wrap gap-2">
                          {allProjectTags.map((tag) => (
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

                    {/* Genre Filter */}
                    {allProjectGenres.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">{t('form.genre')}</label>
                        <div className="flex flex-wrap gap-2">
                          {allProjectGenres.map((genre) => (
                            <button
                              key={genre}
                              onClick={() => {
                                if (projectGenreFilter.includes(genre)) {
                                  setProjectGenreFilter(projectGenreFilter.filter(g => g !== genre));
                                } else {
                                  setProjectGenreFilter([...projectGenreFilter, genre]);
                                }
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                                projectGenreFilter.includes(genre)
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
                    {allProjectArtists.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">{t('form.artists')}</label>
                        <div className="flex flex-wrap gap-2">
                          {allProjectArtists.map((artist) => (
                            <button
                              key={artist}
                              onClick={() => {
                                if (projectArtistFilter.includes(artist)) {
                                  setProjectArtistFilter(projectArtistFilter.filter(a => a !== artist));
                                } else {
                                  setProjectArtistFilter([...projectArtistFilter, artist]);
                                }
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                                projectArtistFilter.includes(artist)
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
                    {(projectStatusFilter.length > 0 || projectTagFilter.length > 0 || projectDawFilter.length > 0 || projectGenreFilter.length > 0 || projectArtistFilter.length > 0) && (
                      <div className="pt-2">
                        <button
                          onClick={() => {
                            setProjectStatusFilter([]);
                            setProjectTagFilter([]);
                            setProjectDawFilter([]);
                            setProjectGenreFilter([]);
                            setProjectArtistFilter([]);
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

          {/* Bulk Edit Bar — inline with smooth animation */}
          <AnimatePresence>
            {bulkEditMode && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="px-6 py-2.5 border-b border-border/30 bg-muted/50 flex items-center gap-3">
                  <span className="text-sm font-medium whitespace-nowrap">
                    {t('scheduler.selectedBulk', { count: String(selectedProjects.size) })}
                  </span>
                  <div className="h-5 w-px bg-border" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      const allVisibleProjects = projects.filter(project => {
                        if (projectSearchQuery && !project.title.toLowerCase().includes(projectSearchQuery.toLowerCase())) return false;
                        if (projectDawFilter.length > 0 && !projectDawFilter.includes(project.dawType || '')) return false;
                        return true;
                      });
                      setSelectedProjects(new Set(allVisibleProjects.map(p => p.id)));
                    }}
                    className="gap-1.5 h-7 text-xs"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    Select All
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs">
                        <ArrowRight className="w-3.5 h-3.5" />
                        {t('scheduler.moveTo')}
                        <ChevronDown className="w-3.5 h-3.5 opacity-50" />
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
                          {statusLabel(column.id)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); bulkUpdateProjects({ status: 'archived' }); }}
                    className="gap-1.5 h-7 text-xs"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    {t('scheduler.archive')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete ${selectedProjects.size} project${selectedProjects.size > 1 ? 's' : ''}?`)) {
                        selectedProjects.forEach(async (projectId) => {
                          await window.electron?.deleteProject(projectId);
                        });
                        onRefresh();
                        clearProjectSelection();
                        setBulkEditMode(false);
                      }
                    }}
                    className="gap-1.5 h-7 text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('common.delete')}
                  </Button>
                  <div className="h-5 w-px bg-border" />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); setBulkEditMode(false); clearProjectSelection(); }}
                    className="h-7 w-7 p-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Project Columns */}
            <div className="flex-1 overflow-hidden">
              <div
                ref={kanbanBoardRef}
                className={cn("h-full p-6 overflow-x-auto overflow-y-hidden", isDragging && "select-none")}
                onClick={() => setSelectedProjects(new Set())}
              >
                <div className="flex gap-4 min-w-max pb-4 h-full">
                  {PROJECT_COLUMNS.filter(column => column.id !== 'archived' || showArchivedProjects).map((column) => {
                    const colProjects = projectsByStatus[column.id];
                    const allSelected = colProjects.length > 0 && colProjects.every(p => selectedProjects.has(p.id));

                    return (
                      <div
                        key={column.id}
                        ref={(el) => setColumnRef(column.id, el)}
                        className={cn(
                          "w-[320px] flex flex-col rounded-xl border transition-all duration-200 h-full",
                          dragOverColumn === column.id
                            ? "border-primary/50 bg-primary/5 ring-2 ring-primary/50"
                            : "border-border/30 bg-card/30"
                        )}
                      >
                        {/* Column Header */}
                        <div className={cn("p-4 border-b border-border/30", column.bgColor)}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={column.color}>{column.icon}</span>
                              <h3 className="font-medium text-sm">{statusLabel(column.id)}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                              {bulkEditMode && colProjects.length > 0 && (
                                <Button
                                  variant={allSelected ? "default" : "outline"}
                                  size="sm"
                                  className="h-6 px-2 text-[10px] gap-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedProjects(prev => {
                                      const newSet = new Set(prev);
                                      if (allSelected) {
                                        colProjects.forEach(p => newSet.delete(p.id));
                                      } else {
                                        colProjects.forEach(p => newSet.add(p.id));
                                      }
                                      return newSet;
                                    });
                                  }}
                                >
                                  <CheckSquare className="w-3 h-3" />
                                  {allSelected ? 'Deselect' : 'Select'} All
                                </Button>
                              )}
                              <Badge variant="secondary" className="text-xs">
                                {colProjects.length}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Project Cards — virtualized */}
                        <VirtualizedColumn
                          projects={colProjects}
                          selectedProjects={selectedProjects}
                          observer={boardObserver}
                          sharedRef={boardSharedRef}
                          itemHeight={108}
                          overscan={5}
                        />
                      </div>
                    );
                  })}
                </div>
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
              {editingProject ? t('scheduler.editProject') : t('scheduler.createProject')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('form.titleRequired')}</label>
              <Input
                value={projectFormData.title}
                onChange={(e) => setProjectFormData({ ...projectFormData, title: e.target.value })}
                placeholder={t('form.placeholder.title')}
                autoFocus
              />
            </div>

            {/* BPM and Key Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('form.bpm')}</label>
                <Input
                  type="number"
                  min={0}
                  max={999}
                  value={projectFormData.bpm || ''}
                  onChange={(e) => setProjectFormData({ ...projectFormData, bpm: parseInt(e.target.value) || 0 })}
                  placeholder={t('form.placeholder.bpm')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('form.key')}</label>
                <Select
                  value={projectFormData.musicalKey || 'None'}
                  onValueChange={(value) => setProjectFormData({ ...projectFormData, musicalKey: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('form.placeholder.key')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">No key</SelectItem>
                    {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((key) => (
                      <SelectItem key={`${key} Major`} value={`${key} Major`}>{key} {t('modal.modeMajor')}</SelectItem>
                    ))}
                    {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((key) => (
                      <SelectItem key={`${key} Minor`} value={`${key} Minor`}>{key} {t('modal.modeMinor')}</SelectItem>
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
                  <SelectItem value="none">{t('scheduler.notSpecified')}</SelectItem>
                  {settings.selectedDAWs?.map((daw) => (
                    <SelectItem key={daw} value={daw}>{daw}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('form.tags')}</label>
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
                  placeholder={projectFormData.tags.length === 0 ? t('form.placeholder.tags') : ""}
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
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSaveProject} disabled={!projectFormData.title.trim()}>
                {editingProject ? t('scheduler.saveChanges') : t('scheduler.createProject')}
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
            {t('scheduler.editProject')}
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
            {t('scheduler.openInDaw')}
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.project!.title);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <Copy className="w-4 h-4" />
            {t('scheduler.copyTitle')}
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
            {t('scheduler.selectMultiple')}
          </button>
          <div className="my-1 h-px bg-border" />
          {/* Quick Status Change */}
          <div className="px-2 py-1 text-xs text-muted-foreground font-medium">{t('scheduler.moveTo')}</div>
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
              {statusLabel(column.id)}
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
            {t('scheduler.archive')}
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
            {t('scheduler.deleteProject')}
          </button>
        </div>
      )}

    </div>
  );

};

export default Scheduler;
