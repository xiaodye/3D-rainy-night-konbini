import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Plain .mjs config — Vite loads it directly without generating a
// temporary transpiled file (which sandboxed environments block).
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  server: {
    host: true,
  },
})
