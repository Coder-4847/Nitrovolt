import { defineConfig } from 'vitest/config';

// `BASE_PATH` lets the GitHub Pages workflow build for /<repo>/ while local dev stays at "/".
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
  },
});
