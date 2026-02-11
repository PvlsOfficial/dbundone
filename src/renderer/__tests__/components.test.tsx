import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Project, Tag, FilterOptions, AppSettings } from '@shared/types';

// Category 5: Frontend component tests (25 tests)

// ---- Test Fixtures ----
const mockProject: Project = {
  id: 'proj-1',
  title: 'Test Beat',
  artworkPath: null,
  audioPreviewPath: '/audio/preview.mp3',
  dawProjectPath: '/projects/beat.flp',
  dawType: 'FL Studio',
  bpm: 140,
  musicalKey: 'C minor',
  tags: ['trap', 'dark'],
  collectionName: 'Album 1',
  status: 'in-progress',
  favoriteVersionId: null,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-06-01T00:00:00Z',
  fileModifiedAt: '2025-06-01T00:00:00Z',
  archived: false,
  timeSpent: 120,
};

const mockTags: Tag[] = [
  { id: 'tag-1', name: 'trap', color: '#ff0000' },
  { id: 'tag-2', name: 'dark', color: '#0000ff' },
  { id: 'tag-3', name: 'chill', color: '#00ff00' },
];

const mockSettings: AppSettings = {
  flStudioPath: null,
  aiApiKey: '',
  aiApiUrl: null,
  aiProvider: 'local',
  theme: 'dark',
  accentColor: '#6366f1',
  autoGenerateArtwork: false,
  excludeAutosaves: true,
  selectedDAWs: ['FL Studio', 'Ableton Live'],
  dawFolders: {},
  viewMode: 'grid',
  gridSize: 'medium',
  unsplashEnabled: true,
};

const defaultFilters: FilterOptions = {
  searchQuery: '',
  sortBy: 'date-newest',
  selectedTags: [],
  collectionFilter: null,
  statusFilter: null,
  dawFilter: null,
};

// ---- Logo Component ----
describe('Logo', () => {
  it('renders SVG element', async () => {
    const { Logo } = await import('@/components/Logo');
    const { container } = render(<Logo />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('applies size classes', async () => {
    const { Logo } = await import('@/components/Logo');
    const { container } = render(<Logo size="lg" />);
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('w-12')).toBe(true);
  });

  it('applies custom className', async () => {
    const { Logo } = await import('@/components/Logo');
    const { container } = render(<Logo className="text-red-500" />);
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('text-red-500')).toBe(true);
  });

  it('defaults to md size', async () => {
    const { Logo } = await import('@/components/Logo');
    const { container } = render(<Logo />);
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('w-8')).toBe(true);
  });
});

// ---- TitleBar Component ----
describe('TitleBar', () => {
  it('renders app title text', async () => {
    const { TitleBar } = await import('@/components/TitleBar');
    render(<TitleBar />);
    expect(screen.getByText('DBundone')).toBeInTheDocument();
  });

  it('renders minimize button', async () => {
    const { TitleBar } = await import('@/components/TitleBar');
    render(<TitleBar />);
    expect(screen.getByRole('button', { name: /minimize/i })).toBeInTheDocument();
  });

  it('renders maximize button', async () => {
    const { TitleBar } = await import('@/components/TitleBar');
    render(<TitleBar />);
    expect(screen.getByRole('button', { name: /maximize/i })).toBeInTheDocument();
  });

  it('renders close button', async () => {
    const { TitleBar } = await import('@/components/TitleBar');
    render(<TitleBar />);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('applies custom className', async () => {
    const { TitleBar } = await import('@/components/TitleBar');
    const { container } = render(<TitleBar className="custom-class" />);
    expect(container.firstElementChild?.classList.contains('custom-class')).toBe(true);
  });
});

// ---- Navigation Component ----
describe('Navigation', () => {
  const renderNav = async (props: Record<string, any> = {}) => {
    const { Navigation } = await import('@/components/Navigation');
    const { TooltipProvider } = await import('@/components/ui/tooltip');
    return render(
      <TooltipProvider>
        <Navigation currentPage="dashboard" onPageChange={vi.fn()} {...props} />
      </TooltipProvider>
    );
  };

  it('renders all nav items', async () => {
    await renderNav();
    expect(screen.getByRole('button', { name: /projects/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /groups/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /project board/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /statistics/i })).toBeInTheDocument();
  });

  it('renders settings button', async () => {
    await renderNav();
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
  });

  it('calls onPageChange when nav item clicked', async () => {
    const onPageChange = vi.fn();
    await renderNav({ onPageChange });
    fireEvent.click(screen.getByRole('button', { name: /groups/i }));
    expect(onPageChange).toHaveBeenCalledWith('groups');
  });

  it('renders scan button', async () => {
    await renderNav({ onScanFolder: vi.fn() });
    expect(screen.getByRole('button', { name: /scan project folders/i })).toBeInTheDocument();
  });

  it('calls onScanFolder when scan button clicked', async () => {
    const onScan = vi.fn();
    await renderNav({ onScanFolder: onScan });
    fireEvent.click(screen.getByRole('button', { name: /scan project folders/i }));
    expect(onScan).toHaveBeenCalled();
  });

  it('shows progress when scanning', async () => {
    await renderNav({
      scanProgress: { current: 5, total: 10, daw: 'FL Studio', file: 'test.flp', isScanning: true },
    });
    expect(screen.getByText('5/10')).toBeInTheDocument();
  });
});

// ---- SearchFilter Component ----
describe('SearchFilter', () => {
  it('renders search input', async () => {
    const { SearchFilter } = await import('@/components/SearchFilter');
    render(
      <SearchFilter filters={defaultFilters} onFilterChange={vi.fn()} availableTags={[]} />
    );
    expect(screen.getByPlaceholderText(/search projects/i)).toBeInTheDocument();
  });

  it('renders sort select', async () => {
    const { SearchFilter } = await import('@/components/SearchFilter');
    render(
      <SearchFilter filters={defaultFilters} onFilterChange={vi.fn()} availableTags={[]} />
    );
    expect(screen.getByDisplayValue('Newest first')).toBeInTheDocument();
  });

  it('calls onFilterChange on search input', async () => {
    const onChange = vi.fn();
    const { SearchFilter } = await import('@/components/SearchFilter');
    render(
      <SearchFilter filters={defaultFilters} onFilterChange={onChange} availableTags={[]} />
    );
    fireEvent.change(screen.getByPlaceholderText(/search projects/i), {
      target: { value: 'beat' },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ searchQuery: 'beat' }));
  });

  it('renders tag filter buttons', async () => {
    const { SearchFilter } = await import('@/components/SearchFilter');
    render(
      <SearchFilter filters={defaultFilters} onFilterChange={vi.fn()} availableTags={['trap', 'chill']} />
    );
    expect(screen.getByText('trap')).toBeInTheDocument();
    expect(screen.getByText('chill')).toBeInTheDocument();
  });

  it('calls onFilterChange when tag clicked', async () => {
    const onChange = vi.fn();
    const { SearchFilter } = await import('@/components/SearchFilter');
    render(
      <SearchFilter filters={defaultFilters} onFilterChange={onChange} availableTags={['trap']} />
    );
    fireEvent.click(screen.getByText('trap'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ selectedTags: ['trap'] }));
  });

  it('shows clear button when filters active', async () => {
    const filtersWithSearch = { ...defaultFilters, searchQuery: 'test' };
    const { SearchFilter } = await import('@/components/SearchFilter');
    render(
      <SearchFilter filters={filtersWithSearch} onFilterChange={vi.fn()} availableTags={[]} />
    );
    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
  });

  it('calls onFilterChange with sort change', async () => {
    const onChange = vi.fn();
    const { SearchFilter } = await import('@/components/SearchFilter');
    render(
      <SearchFilter filters={defaultFilters} onFilterChange={onChange} availableTags={[]} />
    );
    fireEvent.change(screen.getByDisplayValue('Newest first'), {
      target: { value: 'name-asc' },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sortBy: 'name-asc' }));
  });
});

// ---- UI Primitives ----
describe('UI Components', () => {
  it('Badge renders children', async () => {
    const { Badge } = await import('@/components/ui/badge');
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText('Test Badge')).toBeInTheDocument();
  });

  it('Button renders and is clickable', async () => {
    const { Button } = await import('@/components/ui/button');
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click Me</Button>);
    fireEvent.click(screen.getByText('Click Me'));
    expect(onClick).toHaveBeenCalled();
  });

  it('Input renders with placeholder', async () => {
    const { Input } = await import('@/components/ui/input');
    render(<Input placeholder="Type here..." />);
    expect(screen.getByPlaceholderText('Type here...')).toBeInTheDocument();
  });
});
