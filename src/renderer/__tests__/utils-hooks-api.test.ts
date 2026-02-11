import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';

// Category 4: Frontend utils + hooks + API bridge (20 tests)

// ---- Utils: cn() ----
describe('cn utility', () => {
  it('merges class names', async () => {
    const { cn } = await import('@/lib/utils');
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', async () => {
    const { cn } = await import('@/lib/utils');
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('merges tailwind conflicts', async () => {
    const { cn } = await import('@/lib/utils');
    const result = cn('px-4', 'px-8');
    expect(result).toBe('px-8');
  });
});

// ---- Utils: assetUrl() ----
describe('assetUrl', () => {
  it('returns empty string for null', async () => {
    const { assetUrl } = await import('@/lib/utils');
    expect(assetUrl(null)).toBe('');
  });

  it('returns empty string for undefined', async () => {
    const { assetUrl } = await import('@/lib/utils');
    expect(assetUrl(undefined)).toBe('');
  });

  it('calls convertFileSrc for valid path', async () => {
    const { assetUrl } = await import('@/lib/utils');
    const result = assetUrl('/path/to/file.png');
    expect(convertFileSrc).toHaveBeenCalledWith('/path/to/file.png');
    expect(result).toContain('asset.localhost');
  });
});

// ---- Utils: formatTimeSpent() ----
describe('formatTimeSpent', () => {
  it('returns 0m for null', async () => {
    const { formatTimeSpent } = await import('@/lib/utils');
    expect(formatTimeSpent(null)).toBe('0m');
  });

  it('returns 0m for zero', async () => {
    const { formatTimeSpent } = await import('@/lib/utils');
    expect(formatTimeSpent(0)).toBe('0m');
  });

  it('formats seconds for < 1 min', async () => {
    const { formatTimeSpent } = await import('@/lib/utils');
    expect(formatTimeSpent(0.5)).toBe('30s');
  });

  it('formats minutes only', async () => {
    const { formatTimeSpent } = await import('@/lib/utils');
    expect(formatTimeSpent(45)).toBe('45m');
  });

  it('formats hours and minutes', async () => {
    const { formatTimeSpent } = await import('@/lib/utils');
    expect(formatTimeSpent(150)).toBe('2h 30m');
  });

  it('formats hours only when no remainder', async () => {
    const { formatTimeSpent } = await import('@/lib/utils');
    expect(formatTimeSpent(120)).toBe('2h');
  });
});

// ---- Utils: formatTimeSpentFull() ----
describe('formatTimeSpentFull', () => {
  it('returns 0 minutes for null', async () => {
    const { formatTimeSpentFull } = await import('@/lib/utils');
    expect(formatTimeSpentFull(null)).toBe('0 minutes');
  });

  it('formats singular minute', async () => {
    const { formatTimeSpentFull } = await import('@/lib/utils');
    expect(formatTimeSpentFull(1)).toBe('1 minute');
  });

  it('formats hours with plural labels', async () => {
    const { formatTimeSpentFull } = await import('@/lib/utils');
    expect(formatTimeSpentFull(150)).toBe('2 hours 30 minutes');
  });

  it('formats singular hour', async () => {
    const { formatTimeSpentFull } = await import('@/lib/utils');
    expect(formatTimeSpentFull(60)).toBe('1 hour');
  });
});

// ---- API Bridge: tauriApi invoke wrappers ----
describe('tauriApi bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getProjects calls invoke with correct command', async () => {
    vi.mocked(invoke).mockResolvedValue([]);
    const { getProjects } = await import('@/lib/tauriApi');
    await getProjects();
    expect(invoke).toHaveBeenCalledWith('get_projects');
  });

  it('createProject passes project data to invoke', async () => {
    vi.mocked(invoke).mockResolvedValue({ id: '1', title: 'Test' });
    const { createProject } = await import('@/lib/tauriApi');
    const data = { title: 'Test', bpm: 140 } as any;
    await createProject(data);
    expect(invoke).toHaveBeenCalledWith('create_project', { project: data });
  });

  it('deleteProject passes id to invoke', async () => {
    vi.mocked(invoke).mockResolvedValue(true);
    const { deleteProject } = await import('@/lib/tauriApi');
    await deleteProject('abc-123');
    expect(invoke).toHaveBeenCalledWith('delete_project', { id: 'abc-123' });
  });

  it('getSettings calls invoke with correct command', async () => {
    vi.mocked(invoke).mockResolvedValue({ theme: 'dark' });
    const { getSettings } = await import('@/lib/tauriApi');
    await getSettings();
    expect(invoke).toHaveBeenCalledWith('get_settings');
  });
});

// ---- Shared Types ----
describe('shared types and constants', () => {
  it('exports SUPPORTED_DAWS', async () => {
    const { SUPPORTED_DAWS } = await import('@shared/types');
    expect(SUPPORTED_DAWS).toContain('FL Studio');
    expect(SUPPORTED_DAWS).toContain('Ableton Live');
  });

  it('exports DEFAULT_SETTINGS with expected shape', async () => {
    const { DEFAULT_SETTINGS } = await import('@shared/types');
    expect(DEFAULT_SETTINGS.theme).toBe('dark');
    expect(DEFAULT_SETTINGS.viewMode).toBe('grid');
    expect(DEFAULT_SETTINGS.excludeAutosaves).toBe(true);
    expect(DEFAULT_SETTINGS.accentColor).toBe('#6366f1');
  });

  it('IPC_CHANNELS has project channels', async () => {
    const { IPC_CHANNELS } = await import('@shared/types');
    expect(IPC_CHANNELS.DB_GET_PROJECTS).toBeDefined();
    expect(IPC_CHANNELS.DB_CREATE_PROJECT).toBeDefined();
    expect(IPC_CHANNELS.DB_DELETE_PROJECT).toBeDefined();
  });
});
