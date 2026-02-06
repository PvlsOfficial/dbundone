import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FolderOpen, 
  Plus, 
  X, 
  Image, 
  ArrowLeft,
  Check,
  Trash2,
  Edit,
  Eye,
  Copy,
  Search,
  Grid3X3,
  List,
  MoreHorizontal,
  Calendar,
  Users,
  FolderPlus,
  ImageIcon
} from 'lucide-react';
import { ProjectGroup, Project, AppSettings } from '@shared/types';
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Motion component that forwards refs for ContextMenu compatibility
const MotionDiv = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof motion.div>
>((props, ref) => <motion.div ref={ref} {...props} />);

interface GroupsProps {
  groups: ProjectGroup[];
  projects: Project[];
  settings: AppSettings;
  onRefresh: () => void;
  onOpenGroup?: (group: ProjectGroup) => void;
  onUpdateGroup?: (groupId: string, updates: Partial<ProjectGroup>) => void;
  onDeleteGroup?: (groupId: string) => void;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
}

export const Groups: React.FC<GroupsProps> = ({ groups, projects, settings, onRefresh, onOpenGroup, onUpdateGroup, onDeleteGroup, onSettingsChange }) => {
  const [selectedGroup, setSelectedGroup] = useState<ProjectGroup | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSelectingProjects, setIsSelectingProjects] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());

  // New state for enhanced features
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'projects'>('name');
  
  // Use settings for viewMode with persistence
  const viewMode = settings.viewMode || 'grid';
  const setViewMode = (mode: 'grid' | 'list') => {
    onSettingsChange({ viewMode: mode });
  };

  // Filtered and sorted groups
  const filteredAndSortedGroups = useMemo(() => {
    let filtered = groups.filter(group =>
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (group.description && group.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'date':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'projects':
          aValue = a.projectIds.length;
          bValue = b.projectIds.length;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    });

    return filtered;
  }, [groups, searchQuery, sortBy]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    artworkPath: null as string | null,
  });

  const handleCreateGroup = () => {
    setIsCreating(true);
    setFormData({ name: '', description: '', artworkPath: null });
    setSelectedProjectIds(new Set());
  };

  const handleEditGroup = (group: ProjectGroup) => {
    setSelectedGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      artworkPath: group.artworkPath,
    });
    setSelectedProjectIds(new Set(group.projectIds));
  };

  const handleSelectArtwork = async () => {
    const path = await window.electron?.selectImage();
    if (path) setFormData({ ...formData, artworkPath: path });
  };

  const handleSaveGroup = async () => {
    if (!formData.name.trim()) return;

    try {
      const groupData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        artworkPath: formData.artworkPath,
        projectIds: Array.from(selectedProjectIds), // Only include selected projects if any were chosen
      };

      if (selectedGroup) {
        await window.electron?.updateGroup(selectedGroup.id, groupData);
      } else {
        await window.electron?.createGroup(groupData);
      }

      await onRefresh();
      handleCancelEdit();
    } catch (error) {
      console.error('Failed to save group:', error);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (confirm('Are you sure you want to delete this group? Projects will not be deleted.')) {
      try {
        await window.electron?.deleteGroup(groupId);
        await onRefresh();
        handleCancelEdit();
      } catch (error) {
        console.error('Failed to delete group:', error);
      }
    }
  };

  const handleCancelEdit = () => {
    setSelectedGroup(null);
    setIsCreating(false);
    setIsSelectingProjects(false);
    setSelectedProjectIds(new Set());
    setFormData({ name: '', description: '', artworkPath: null });
  };

  const toggleProjectSelection = (projectId: string) => {
    const newSelection = new Set(selectedProjectIds);
    if (newSelection.has(projectId)) {
      newSelection.delete(projectId);
    } else {
      newSelection.add(projectId);
    }
    setSelectedProjectIds(newSelection);
  };

  const getGroupProjects = (group: ProjectGroup): Project[] => {
    return projects.filter(p => group.projectIds.includes(p.id));
  };

  const getGroupArtwork = (group: ProjectGroup): string | null => {
    if (group.artworkPath) return group.artworkPath;
    const groupProjects = getGroupProjects(group);
    const projectWithArtwork = groupProjects.find(p => p.artworkPath);
    return projectWithArtwork?.artworkPath || null;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-6 py-5 border-b border-border/30"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl bg-primary/10">
              <FolderOpen className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Project Groups</h1>
            <Badge variant="secondary" className="text-sm">
              {filteredAndSortedGroups.length} {filteredAndSortedGroups.length === 1 ? 'group' : 'groups'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleCreateGroup} className="gap-2">
              <Plus className="w-4 h-4" />
              New Group
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/30"
            />
          </div>

          <Select value={sortBy} onValueChange={(value: 'name' | 'date' | 'projects') => setSortBy(value)}>
            <SelectTrigger className="w-44 bg-muted/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="date">Date Created</SelectItem>
              <SelectItem value="projects">Project Count</SelectItem>
            </SelectContent>
          </Select>

          <div className="h-6 w-px bg-border" />

          <div className="flex items-center bg-muted/30 rounded-lg p-1">
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
          </div>
        </div>
      </motion.div>

      {/* Groups Display */}
      {filteredAndSortedGroups.length > 0 ? (
        <motion.div 
          layout
          className={cn(
            "px-6 py-8",
            viewMode === 'grid' 
              ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
              : "flex flex-col gap-4"
          )}
        >
          <AnimatePresence mode="popLayout">
          {filteredAndSortedGroups.map((group) => {
            const groupProjects = getGroupProjects(group);
            const artwork = getGroupArtwork(group);

            return (
              <ContextMenu key={group.id}>
                <ContextMenuTrigger asChild>
                  <MotionDiv
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ y: -4 }}
                    className="group cursor-pointer"
                    onClick={() => onOpenGroup?.(group) || handleEditGroup(group)}
                  >
                    {viewMode === 'grid' ? (
                      // Grid view card
                      <div className="relative aspect-square rounded-2xl overflow-hidden bg-card border border-border/50 transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-xl group-hover:shadow-primary/5">
                        {artwork ? (
                          <img
                            src={`appfile://${artwork.replace(/\\/g, '/')}`}
                            alt={group.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                              <FolderOpen className="w-16 h-16 text-muted-foreground/30" />
                            </div>
                          )}
                          
                          {/* Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          
                          {/* Project count badge */}
                          <div className="absolute top-3 right-3">
                            <Badge variant="secondary" className="backdrop-blur-sm bg-background/60">
                              {groupProjects.length} {groupProjects.length === 1 ? 'project' : 'projects'}
                            </Badge>
                          </div>
                          
                          {/* Title overlay on hover */}
                          <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                            <h3 className="font-semibold text-white truncate">{group.name}</h3>
                            {group.description && (
                              <p className="text-sm text-white/70 truncate mt-1">{group.description}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        // List view card
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/50 transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-lg">
                          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                            {artwork ? (
                              <img
                                src={`appfile://${artwork.replace(/\\/g, '/')}`}
                                alt={group.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <FolderOpen className="w-8 h-8 text-muted-foreground/30" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                              {group.name}
                            </h3>
                            {group.description && (
                              <p className="text-sm text-muted-foreground truncate mt-0.5">
                                {group.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="text-xs">
                                {groupProjects.length} {groupProjects.length === 1 ? 'project' : 'projects'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Created {new Date(group.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Title below card (only for grid view) */}
                      {viewMode === 'grid' && (
                        <div className="mt-3 px-1">
                          <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                            {group.name}
                          </h3>
                          {group.description && (
                            <p className="text-sm text-muted-foreground truncate mt-0.5">
                              {group.description}
                            </p>
                          )}
                        </div>
                      )}
                  </MotionDiv>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => onOpenGroup?.(group) || handleEditGroup(group)}>
                      <Eye className="w-4 h-4 mr-2" />
                      Open Group
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleEditGroup(group)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Details
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => {
                      setSelectedGroup(group);
                      setSelectedProjectIds(new Set(group.projectIds));
                      setIsSelectingProjects(true);
                      setIsCreating(true);
                    }}>
                      <FolderPlus className="w-4 h-4 mr-2" />
                      Manage Projects
                    </ContextMenuItem>
                    <ContextMenuItem onClick={async () => {
                      const path = await window.electron?.selectImage();
                      if (path && onUpdateGroup) {
                        onUpdateGroup(group.id, { artworkPath: path });
                      }
                    }}>
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Change Artwork
                    </ContextMenuItem>
                    {group.artworkPath && (
                      <ContextMenuItem onClick={() => {
                        if (onUpdateGroup) {
                          onUpdateGroup(group.id, { artworkPath: null });
                        }
                      }}>
                        <X className="w-4 h-4 mr-2" />
                        Remove Artwork
                      </ContextMenuItem>
                    )}
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => {
                      navigator.clipboard.writeText(group.name);
                    }}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Name
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem 
                      onClick={() => handleDeleteGroup(group.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Group
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20"
        >
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
            <FolderOpen className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">No groups yet</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Create groups to organize your projects by album, genre, or any way you like
          </p>
          <Button onClick={handleCreateGroup} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Your First Group
          </Button>
        </motion.div>
      )}

      {/* Group Modal */}
      <Dialog open={isCreating || !!selectedGroup} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent className={cn(
          "transition-all duration-300",
          isSelectingProjects ? "sm:max-w-4xl" : "sm:max-w-lg"
        )}>
          <DialogHeader>
            <DialogTitle>{isSelectingProjects ? 'Select Projects' : (selectedGroup ? 'Edit Group' : 'New Group')}</DialogTitle>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {!isSelectingProjects ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex gap-4">
                  {/* Artwork picker */}
                  <button
                    type="button"
                    onClick={handleSelectArtwork}
                    className="w-32 h-32 rounded-xl overflow-hidden border-2 border-dashed border-border hover:border-primary/50 transition-colors flex-shrink-0 group"
                  >
                    {formData.artworkPath ? (
                      <img
                        src={`appfile://${formData.artworkPath.replace(/\\/g, '/')}`}
                        alt="Artwork"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                        <Image className="w-8 h-8" />
                        <span className="text-xs">Add artwork</span>
                      </div>
                    )}
                  </button>

                  <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Name</label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Group name"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Add a description..."
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                {/* Projects section - only show for editing existing groups */}
                {selectedGroup && (
                  <>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">
                        Projects ({selectedProjectIds.size} selected)
                      </label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSelectingProjects(true)}
                      >
                        Select Projects
                      </Button>
                    </div>

                    {selectedProjectIds.size > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {Array.from(selectedProjectIds).map((id) => {
                          const project = projects.find((p) => p.id === id);
                          if (!project) return null;
                          return (
                            <Badge
                              key={id}
                              variant="secondary"
                              className="gap-1 pr-1 py-1"
                            >
                              {project.artworkPath && (
                                <img
                                  src={`appfile://${project.artworkPath.replace(/\\/g, '/')}`}
                                  alt=""
                                  className="w-4 h-4 rounded object-cover"
                                />
                              )}
                              <span className="max-w-[120px] truncate">{project.title}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleProjectSelection(id);
                                }}
                                className="ml-1 rounded-full hover:bg-foreground/10 p-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* Footer */}
                <div className="flex items-center gap-3 pt-4 border-t">
                  {selectedGroup && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteGroup(selectedGroup.id)}
                      className="mr-auto"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleCancelEdit} className="ml-auto">
                    Cancel
                  </Button>
                  <Button onClick={handleSaveGroup} disabled={!formData.name.trim()}>
                    Save
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="selector"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col h-[500px]"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsSelectingProjects(false)}
                    className="gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                  <Badge variant="secondary">
                    {selectedProjectIds.size} selected
                  </Badge>
                </div>

                {/* Search and Controls */}
                <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by title, BPM, or key..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-10"
                    />
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setSearchQuery('')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedProjectIds(new Set(projects.map(p => p.id)))}
                      className="text-xs"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedProjectIds(new Set())}
                      disabled={selectedProjectIds.size === 0}
                      className="text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Projects Grid */}
                <ScrollArea className="flex-1 -mx-6 px-6">
                  {(() => {
                    const filteredProjects = projects.filter(p => {
                      if (!searchQuery) return true;
                      const query = searchQuery.toLowerCase();
                      return (
                        p.title.toLowerCase().includes(query) ||
                        p.bpm.toString().includes(query) ||
                        p.musicalKey.toLowerCase().includes(query) ||
                        p.tags?.some(tag => tag.toLowerCase().includes(query))
                      );
                    });

                    return filteredProjects.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-4">
                        {filteredProjects.map((project) => {
                          const isSelected = selectedProjectIds.has(project.id);
                          return (
                            <motion.div
                              key={project.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              onClick={() => toggleProjectSelection(project.id)}
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
                                    <FolderOpen className="w-8 h-8 text-muted-foreground" />
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
                                        <Check className="w-5 h-5 text-primary-foreground" />
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
                                  {project.bpm > 0 && <span>{project.bpm} BPM</span>}
                                  {project.bpm > 0 && project.musicalKey && project.musicalKey !== 'None' && <span>•</span>}
                                  {project.musicalKey && project.musicalKey !== 'None' && <span>{project.musicalKey}</span>}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                          <Search className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-medium text-foreground mb-1">No results found</h3>
                        <p className="text-sm text-muted-foreground">
                          Try adjusting your search
                        </p>
                      </div>
                    );
                  })()}
                </ScrollArea>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t flex-shrink-0">
                  <Button variant="outline" onClick={() => setIsSelectingProjects(false)}>
                    Back
                  </Button>
                  <Button onClick={async () => {
                    // Save the project selection and close the modal
                    if (selectedGroup && onUpdateGroup) {
                      await onUpdateGroup(selectedGroup.id, { projectIds: Array.from(selectedProjectIds) });
                    }
                    handleCancelEdit();
                  }}>
                    Save & Close
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  );
};
