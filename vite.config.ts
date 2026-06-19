import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so a static build runs from any path: GitHub Pages project
// sites, a subfolder, or straight off the filesystem (file://).
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: {
    format: 'es',
  },
  build: {
    // deck.gl and MapLibre are large by nature; this is the map engine, not bloat.
    chunkSizeWarningLimit: 2500,
  },
})
