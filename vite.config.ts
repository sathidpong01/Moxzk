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
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { test: /node_modules\/konva/, name: 'vendor-konva' },
              { test: /node_modules\/lucide-react/, name: 'vendor-lucide' },
              { test: /node_modules/, name: 'vendor-core' },
            ],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
  }
})
