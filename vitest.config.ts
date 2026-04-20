import path from "path"
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/utils/**', 'src/hooks/**'],
      thresholds: {
        statements: 100,
        functions: 100,
        lines: 100,
        branches: 90,
      },
    },
  },
})
