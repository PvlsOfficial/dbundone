/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@tauri-apps/api/core': path.resolve(__dirname, 'src/renderer/__mocks__/tauri-api.ts'),
      '@tauri-apps/api/event': path.resolve(__dirname, 'src/renderer/__mocks__/tauri-event.ts'),
      '@tauri-apps/api/window': path.resolve(__dirname, 'src/renderer/__mocks__/tauri-window.ts'),
      '@tauri-apps/plugin-dialog': path.resolve(__dirname, 'src/renderer/__mocks__/tauri-dialog.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/renderer/__tests__/setup.ts'],
    include: ['src/renderer/__tests__/**/*.test.{ts,tsx}'],
    css: false,
  },
});
