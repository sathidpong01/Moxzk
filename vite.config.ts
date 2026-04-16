import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  envPrefix: ['VITE_'],
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('konva')) return 'vendor-konva'
            if (id.includes('lucide-react')) return 'vendor-lucide'
            return 'vendor-core'
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
