import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const configuredWorkerApiTarget = env.VITE_CLOUDFLARE_API_URL?.trim().replace(/\/+$/, '')
  const workerApiTarget = configuredWorkerApiTarget || 'http://localhost:8787'

  return {
    envPrefix: ['VITE_'],
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      proxy: {
        '/api': {
          target: workerApiTarget,
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
  }
})
