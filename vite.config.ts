import { defineConfig } from 'vitest/config';

// BASE_URL est fixé par le workflow GitHub Pages (ex. /abyss-legends/branches/ma-branche/).
export default defineConfig({
  base: process.env.BASE_URL ?? './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
