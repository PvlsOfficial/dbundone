import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Project, ProjectGroup, Task, Tag, AppSettings, AudioPlayerState } from '@shared/types';

// Category 6: Frontend page integration tests (15 tests)

// ---- Shared Fixtures ----
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

const mockProjects: Project[] = [
  {
    id: 'p1', title: 'Beat One', artworkPath: null, audioPreviewPath: null,
    dawProjectPath: '/p/beat.flp', dawType: 'FL Studio', bpm: 140,
    musicalKey: 'C minor', tags: ['trap'], collectionName: 'Album',
    status: 'in-progress', favoriteVersionId: null,
    createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-06-01T00:00:00Z',
    fileModifiedAt: null, archived: false, timeSpent: 60,
  },
  {
    id: 'p2', title: 'Chill Vibes', artworkPath: null, audioPreviewPath: null,
    dawProjectPath: '/p/chill.als', dawType: 'Ableton Live', bpm: 90,
    musicalKey: 'G major', tags: ['chill'], collectionName: 'EP',
    status: 'completed', favoriteVersionId: null,
    createdAt: '2025-02-01T00:00:00Z', updatedAt: '2025-07-01T00:00:00Z',
    fileModifiedAt: null, archived: false, timeSpent: 180,
  },
];

const mockGroups: ProjectGroup[] = [
  {
    id: 'g1', name: 'My Album', artworkPath: null, description: 'First album',
    projectIds: ['p1'], createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
  },
];

const mockTags: Tag[] = [
  { id: 't1', name: 'trap', color: '#ff0000' },
  { id: 't2', name: 'chill', color: '#00ff00' },
];

const mockPlayerState: AudioPlayerState = {
  isPlaying: false,
  currentTrack: null,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
};

// ---- Statistics Page ----
describe('Statistics Page', () => {
  it('renders without crashing', async () => {
    const { Statistics } = await import('@/pages/Statistics');
    const { container } = render(
      <Statistics projects={mockProjects} settings={mockSettings} />
    );
    expect(container).toBeInTheDocument();
  });

  it('displays project count', async () => {
    const { Statistics } = await import('@/pages/Statistics');
    render(<Statistics projects={mockProjects} settings={mockSettings} />);
    const elements = screen.getAllByText(/2/);
    expect(elements.length).toBeGreaterThan(0);
  });

  it('renders with empty projects', async () => {
    const { Statistics } = await import('@/pages/Statistics');
    const { container } = render(
      <Statistics projects={[]} settings={mockSettings} />
    );
    expect(container).toBeInTheDocument();
  });
});

// ---- Settings Page ----
describe('Settings Page', () => {
  it('renders without crashing', async () => {
    const { Settings } = await import('@/pages/Settings');
    const { container } = render(
      <Settings settings={mockSettings} onSettingsChange={vi.fn()} />
    );
    expect(container).toBeInTheDocument();
  });

  it('displays DAW section', async () => {
    const { Settings } = await import('@/pages/Settings');
    render(<Settings settings={mockSettings} onSettingsChange={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /DAW Configuration/i })).toBeInTheDocument();
  });

  it('displays theme section', async () => {
    const { Settings } = await import('@/pages/Settings');
    render(<Settings settings={mockSettings} onSettingsChange={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /Appearance/i })).toBeInTheDocument();
  });

  it('displays AI section', async () => {
    const { Settings } = await import('@/pages/Settings');
    render(<Settings settings={mockSettings} onSettingsChange={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /AI Artwork Generation/i })).toBeInTheDocument();
  });
});

// ---- Groups Page ----
describe('Groups Page', () => {
  it('renders without crashing', async () => {
    const { Groups } = await import('@/pages/Groups');
    const { container } = render(
      <Groups
        groups={mockGroups}
        projects={mockProjects}
        settings={mockSettings}
        onRefresh={vi.fn()}
        onOpenGroup={vi.fn()}
        onUpdateGroup={vi.fn()}
        onDeleteGroup={vi.fn()}
        onSettingsChange={vi.fn()}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('displays group name', async () => {
    const { Groups } = await import('@/pages/Groups');
    render(
      <Groups
        groups={mockGroups}
        projects={mockProjects}
        settings={mockSettings}
        onRefresh={vi.fn()}
        onOpenGroup={vi.fn()}
        onUpdateGroup={vi.fn()}
        onDeleteGroup={vi.fn()}
        onSettingsChange={vi.fn()}
      />
    );
    expect(screen.getAllByText('My Album').length).toBeGreaterThan(0);
  });

  it('renders with empty groups', async () => {
    const { Groups } = await import('@/pages/Groups');
    const { container } = render(
      <Groups
        groups={[]}
        projects={mockProjects}
        settings={mockSettings}
        onRefresh={vi.fn()}
        onOpenGroup={vi.fn()}
        onUpdateGroup={vi.fn()}
        onDeleteGroup={vi.fn()}
        onSettingsChange={vi.fn()}
      />
    );
    expect(container).toBeInTheDocument();
  });
});

// ---- Scheduler Page ----
describe('Scheduler Page', () => {
  it('renders without crashing', async () => {
    const { Scheduler } = await import('@/pages/Scheduler');
    const { container } = render(
      <Scheduler
        projects={mockProjects}
        onRefresh={vi.fn()}
        settings={mockSettings}
        tags={mockTags}
        onCreateTag={vi.fn().mockResolvedValue(null)}
        onOpenProject={vi.fn()}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('displays task board columns', async () => {
    const { Scheduler } = await import('@/pages/Scheduler');
    render(
      <Scheduler
        projects={mockProjects}
        onRefresh={vi.fn()}
        settings={mockSettings}
        tags={mockTags}
        onCreateTag={vi.fn().mockResolvedValue(null)}
        onOpenProject={vi.fn()}
      />
    );
    expect(screen.getByText(/in progress/i)).toBeInTheDocument();
  });
});

// ---- Dashboard Page ----
describe('Dashboard Page', () => {
  const dashboardProps = {
    projects: mockProjects,
    groups: mockGroups,
    tags: mockTags,
    playerState: mockPlayerState,
    settings: mockSettings,
    onPlay: vi.fn().mockResolvedValue(undefined),
    onOpenDaw: vi.fn(),
    onGenerateArtwork: vi.fn().mockResolvedValue(undefined),
    onChangeArtwork: vi.fn().mockResolvedValue(undefined),
    onRemoveArtwork: vi.fn().mockResolvedValue(undefined),
    onFetchUnsplashPhoto: vi.fn().mockResolvedValue(undefined),
    onFetchUnsplashPhotosForAll: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onRefresh: vi.fn(),
    onOpenProject: vi.fn(),
    onCreateGroup: vi.fn().mockResolvedValue(undefined),
    onUpdateGroup: vi.fn(),
    onSettingsChange: vi.fn(),
  };

  const renderDashboard = async (props = {}) => {
    const { Dashboard } = await import('@/pages/Dashboard');
    const { ToastProvider } = await import('@/components/ui/toast');
    const { TooltipProvider } = await import('@/components/ui/tooltip');
    return render(
      <ToastProvider>
        <TooltipProvider>
          <Dashboard {...dashboardProps} {...props} />
        </TooltipProvider>
      </ToastProvider>
    );
  };

  it('renders without crashing', async () => {
    const { container } = await renderDashboard();
    expect(container).toBeInTheDocument();
  });

  it('shows project titles', async () => {
    await renderDashboard();
    expect(screen.getByText('Beat One')).toBeInTheDocument();
    expect(screen.getByText('Chill Vibes')).toBeInTheDocument();
  });

  it('renders with empty projects', async () => {
    const { container } = await renderDashboard({ projects: [], groups: [], tags: [] });
    expect(container).toBeInTheDocument();
  });

  it('renders search input', async () => {
    await renderDashboard();
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });
});
