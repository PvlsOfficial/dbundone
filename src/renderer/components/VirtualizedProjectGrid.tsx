import React from 'react';
import { Project, Tag, AudioPlayerState, ProjectStatus } from '@shared/types';
import { ProjectCard } from './ProjectCard';

interface VirtualizedProjectGridProps {
  projects: Project[];
  tags: Tag[];
  playerState: AudioPlayerState;
  viewMode: 'grid' | 'list';
  gridSize: 'small' | 'medium' | 'large';
  selectedProjects: Set<string>;
  selectionMode: boolean;
  onProjectSelect: (project: Project) => void;
  onProjectClick: (project: Project) => void;
  onPlay: (project: Project) => Promise<void>;
  onOpenDaw: (project: Project) => void;
  onGenerateArtwork: (project: Project) => Promise<void>;
  onChangeArtwork: (project: Project) => Promise<void>;
  onRemoveArtwork: (project: Project) => Promise<void>;
  onFetchUnsplashPhoto: (project: Project) => Promise<void>;
  onDelete: (project: Project) => Promise<void>;
}

// Grid column configuration based on grid size (matches Dashboard.tsx)
const gridColumns = {
  small: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8',
  medium: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
  large: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
};

export const VirtualizedProjectGrid: React.FC<VirtualizedProjectGridProps> = ({
  projects,
  tags,
  playerState,
  viewMode,
  gridSize,
  selectedProjects,
  selectionMode,
  onProjectSelect,
  onProjectClick,
  onPlay,
  onOpenDaw,
  onGenerateArtwork,
  onChangeArtwork,
  onRemoveArtwork,
  onFetchUnsplashPhoto,
  onDelete,
}) => {
  // For list view, use simple flex layout
  if (viewMode === 'list') {
    return (
      <div className="flex flex-col gap-3">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            tags={tags}
            onEdit={onProjectClick}
            onOpenProject={onProjectClick}
            onPlay={onPlay}
            onOpenDaw={onOpenDaw}
            onGenerateArtwork={onGenerateArtwork}
            onChangeArtwork={onChangeArtwork}
            onRemoveArtwork={onRemoveArtwork}
            onFetchUnsplashPhoto={onFetchUnsplashPhoto}
            onDelete={onDelete}
            isSelected={selectedProjects.has(project.id)}
            isPlaying={playerState.currentTrack?.id === project.id && playerState.isPlaying}
            onSelect={onProjectSelect}
            selectionMode={selectionMode}
            viewMode={viewMode}
            gridSize={gridSize}
          />
        ))}
      </div>
    );
  }

  // For grid views, use the original CSS grid for perfect layout
  return (
    <div className={`grid gap-4 ${gridColumns[gridSize]}`}>
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          tags={tags}
          onEdit={onProjectClick}
          onOpenProject={onProjectClick}
          onPlay={onPlay}
          onOpenDaw={onOpenDaw}
          onGenerateArtwork={onGenerateArtwork}
          onChangeArtwork={onChangeArtwork}
          onRemoveArtwork={onRemoveArtwork}
          onFetchUnsplashPhoto={onFetchUnsplashPhoto}
          onDelete={onDelete}
          isSelected={selectedProjects.has(project.id)}
          isPlaying={playerState.currentTrack?.id === project.id && playerState.isPlaying}
          onSelect={onProjectSelect}
          selectionMode={selectionMode}
          viewMode={viewMode}
          gridSize={gridSize}
        />
      ))}
    </div>
  );
};

export default VirtualizedProjectGrid;