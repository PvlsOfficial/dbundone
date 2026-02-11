import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
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
  onStop?: () => void;
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

// Grid column configuration based on grid size (matches Dashboard.tsx)
const gridColumns = {
  small: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8',
  medium: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
  large: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
};

// Estimated row heights (card + gap) per grid size for initial render
const ROW_HEIGHT_ESTIMATES: Record<string, Record<string, number>> = {
  grid: { small: 230, medium: 310, large: 400 },
  list: { small: 90, medium: 90, large: 90 },
};

const OVERSCAN_ROWS = 3;

/**
 * Finds the nearest scrollable ancestor, including Radix ScrollArea viewports.
 */
function getScrollParent(el: HTMLElement): HTMLElement {
  let parent = el.parentElement;
  while (parent) {
    if (parent.hasAttribute('data-radix-scroll-area-viewport')) {
      return parent;
    }
    const style = getComputedStyle(parent);
    if (/(auto|scroll)/.test(style.overflow + style.overflowY + style.overflowX)) {
      return parent;
    }
    parent = parent.parentElement;
  }
  // Fallback: document element
  return document.documentElement;
}

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
  onStop,
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [colCount, setColCount] = useState(4);
  const [rowHeight, setRowHeight] = useState(
    ROW_HEIGHT_ESTIMATES[viewMode]?.[gridSize] ?? 310
  );
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(800);
  const [offsetTop, setOffsetTop] = useState(0);

  // Detect actual column count from the rendered grid
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const detect = () => {
      if (viewMode === 'list') {
        setColCount(1);
        return;
      }
      const style = getComputedStyle(el);
      const cols = style.gridTemplateColumns.split(' ').filter(s => s.trim()).length;
      if (cols > 0) setColCount(cols);
    };

    detect();
    const ro = new ResizeObserver(detect);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewMode, gridSize]);

  // Measure actual row height from the first rendered card
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const measure = () => {
      const firstChild = el.firstElementChild as HTMLElement | null;
      if (firstChild) {
        const h = firstChild.offsetHeight;
        const gap = viewMode === 'list' ? 12 : 16;
        if (h > 20) setRowHeight(h + gap);
      }
    };

    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [viewMode, gridSize, projects.length > 0]);

  // Track scroll position and compute our offset within the scroll parent
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const scrollParent = getScrollParent(wrapper);

    const update = () => {
      const sp = scrollParent;
      const st = sp.scrollTop;
      const vh = sp.clientHeight;
      setScrollTop(st);
      setViewportHeight(vh);

      // Our offset: how far the wrapper's top is from the scroll parent's
      // content start. This accounts for headers/filters above us.
      // Use getBoundingClientRect relative to scroll parent's rect.
      const spRect = sp.getBoundingClientRect();
      const wRect = wrapper.getBoundingClientRect();
      setOffsetTop(wRect.top - spRect.top + st);
    };

    update();
    scrollParent.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(scrollParent);
    ro.observe(wrapper);

    return () => {
      scrollParent.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);

  // Calculate visible window
  const totalRows = Math.ceil(projects.length / colCount);
  const totalHeight = totalRows * rowHeight;

  const relativeScroll = Math.max(0, scrollTop - offsetTop);
  const firstVisibleRow = Math.floor(relativeScroll / rowHeight);
  const lastVisibleRow = Math.ceil((relativeScroll + viewportHeight) / rowHeight);

  const startRow = Math.max(0, firstVisibleRow - OVERSCAN_ROWS);
  const endRow = Math.min(totalRows, lastVisibleRow + OVERSCAN_ROWS);

  const startIndex = startRow * colCount;
  const endIndex = Math.min(projects.length, endRow * colCount);

  const topPad = startRow * rowHeight;
  const bottomPad = Math.max(0, (totalRows - endRow) * rowHeight);

  const visibleProjects = projects.slice(startIndex, endIndex);

  const containerClass = viewMode === 'list'
    ? 'flex flex-col gap-3'
    : `grid gap-4 ${gridColumns[gridSize]}`;

  return (
    <div ref={wrapperRef} style={{ minHeight: totalHeight }}>
      {/* Top spacer */}
      {topPad > 0 && <div style={{ height: topPad }} aria-hidden />}

      {/* The actual grid — only visible cards are mounted */}
      <div ref={gridRef} className={containerClass}>
        {visibleProjects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            tags={tags}
            onEdit={onProjectClick}
            onOpenProject={onProjectClick}
            onPlay={onPlay}
            onStop={onStop}
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
            isVisible={true}
            unsplashEnabled={unsplashEnabled}
            aiArtworkEnabled={aiArtworkEnabled}
            onOpenArtworkManager={onOpenArtworkManager}
          />
        ))}
      </div>

      {/* Bottom spacer */}
      {bottomPad > 0 && <div style={{ height: bottomPad }} aria-hidden />}
    </div>
  );
};

export default VirtualizedProjectGrid;
