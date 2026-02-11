import React from 'react';
import { List, Grid } from 'react-window';
import { Project, Tag, AudioPlayerState, ProjectStatus } from '@shared/types';
import { ProjectCard } from './ProjectCard';

interface VirtualizedProjectListProps {
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
  unsplashEnabled?: boolean;
  aiArtworkEnabled?: boolean;
  onOpenArtworkManager?: (project: Project) => void;
}

const ITEM_SIZES = {
  list: 120, // Height for list view items (reduced gap)
  small: 260, // Height for small grid items (good spacing)
  medium: 320, // Height for medium grid items (good spacing)
  large: 400, // Height for large grid items (increased vertical gap)
};

const COLUMN_COUNTS = {
  small: 4, // Reduced columns to prevent horizontal scroll
  medium: 3, // Reduced columns to prevent horizontal scroll
  large: 2, // Reduced columns to prevent horizontal scroll
};

const RowComponent = ({ index, style, ...props }: any) => {
  const { projects, ...restProps } = props;
  const project = projects[index];
  if (!project) return null;
  
  return (
    <div style={{ ...style, marginBottom: '0.125rem' }} key={project.id}>
      <ProjectCard
        project={project}
        tags={props.tags}
        onEdit={props.onEdit}
        onOpenProject={props.onOpenProject}
        onPlay={props.onPlay}
        onOpenDaw={props.onOpenDaw}
        onGenerateArtwork={props.onGenerateArtwork}
        onChangeArtwork={props.onChangeArtwork}
        onRemoveArtwork={props.onRemoveArtwork}
        onFetchUnsplashPhoto={props.onFetchUnsplashPhoto}
        onDelete={props.onDelete}
        isSelected={props.selectedProjects.has(project.id)}
        isPlaying={props.playerState.currentTrack?.id === project.id && props.playerState.isPlaying}
        onSelect={props.onProjectSelect}
        selectionMode={props.selectionMode}
        viewMode={props.viewMode}
        gridSize={props.gridSize}
        unsplashEnabled={props.unsplashEnabled}
        aiArtworkEnabled={props.aiArtworkEnabled}
        onOpenArtworkManager={props.onOpenArtworkManager}
      />
    </div>
  );
};

const CellComponent = ({ columnIndex, rowIndex, style, ...props }: any) => {
  const { projects, gridSize, ...restProps } = props;
  const columnCount = COLUMN_COUNTS[gridSize as 'small' | 'medium' | 'large'];
  const index = rowIndex * columnCount + columnIndex;
  if (index >= projects.length) return null;
  
  const project = projects[index];
  if (!project) return null;
  
  return (
    <div style={{ ...style, padding: '0.5rem' }} key={project.id}>
      <ProjectCard
        project={project}
        tags={restProps.tags}
        onEdit={restProps.onEdit}
        onOpenProject={restProps.onOpenProject}
        onPlay={restProps.onPlay}
        onOpenDaw={restProps.onOpenDaw}
        onGenerateArtwork={restProps.onGenerateArtwork}
        onChangeArtwork={restProps.onChangeArtwork}
        onRemoveArtwork={restProps.onRemoveArtwork}
        onFetchUnsplashPhoto={restProps.onFetchUnsplashPhoto}
        onDelete={restProps.onDelete}
        isSelected={restProps.selectedProjects.has(project.id)}
        isPlaying={restProps.playerState.currentTrack?.id === project.id && restProps.playerState.isPlaying}
        onSelect={restProps.onProjectSelect}
        selectionMode={restProps.selectionMode}
        viewMode={restProps.viewMode}
        gridSize={gridSize}
        unsplashEnabled={restProps.unsplashEnabled}
        aiArtworkEnabled={restProps.aiArtworkEnabled}
        onOpenArtworkManager={restProps.onOpenArtworkManager}
      />
    </div>
  );
};

export const VirtualizedProjectList: React.FC<VirtualizedProjectListProps> = ({
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
  unsplashEnabled,
  aiArtworkEnabled,
  onOpenArtworkManager,
}) => {
  const commonProps = {
    projects,
    tags,
    playerState,
    selectedProjects,
    selectionMode,
    viewMode,
    gridSize,
    onProjectSelect,
    onEdit: onProjectClick,
    onOpenProject: onProjectClick,
    onPlay,
    onOpenDaw,
    onGenerateArtwork,
    onChangeArtwork,
    onRemoveArtwork,
    onFetchUnsplashPhoto,
    onDelete,
    unsplashEnabled,
    aiArtworkEnabled,
    onOpenArtworkManager,
  };

  // Calculate available height considering window dimensions and UI elements
  const availableHeight = 600; // Reduced height to prevent overflow

  if (viewMode === 'list') {
    return (
      <List
        style={{ height: `${availableHeight}px` }}
        rowCount={projects.length}
        rowHeight={ITEM_SIZES.list}
        rowComponent={RowComponent}
        rowProps={commonProps}
      />
    );
  }

  // Grid view
  const columnCount = COLUMN_COUNTS[gridSize];
  const rowCount = Math.ceil(projects.length / columnCount);
  const columnWidth = Math.floor(900 / columnCount); // Fixed width to prevent overflow

  return (
    <Grid
      style={{ height: `${availableHeight}px`, margin: '0 auto', width: `${columnCount * columnWidth + 20}px` }}
      columnCount={columnCount}
      columnWidth={columnWidth}
      rowCount={rowCount}
      rowHeight={ITEM_SIZES[gridSize]}
      cellComponent={CellComponent}
      cellProps={commonProps}
    />
  );
};

export default VirtualizedProjectList;
