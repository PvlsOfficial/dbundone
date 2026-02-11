import { vi } from 'vitest';

const mockWindow = {
  minimize: vi.fn().mockResolvedValue(undefined),
  toggleMaximize: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
};

export const getCurrentWindow = vi.fn(() => mockWindow);
