import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Pages раздаёт проектный сайт под /airbase/; dev и тесты — с корня.
const PAGES_BASE = '/airbase/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? PAGES_BASE : '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      // Две HTML-точки входа: у Pages нет SPA-fallback, галерее нужен свой реальный файл.
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        gallery: resolve(import.meta.dirname, 'gallery/index.html'),
      },
    },
  },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
}));
