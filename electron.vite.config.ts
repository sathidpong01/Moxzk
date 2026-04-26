import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const projectRoot = dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '')
  const configuredWorkerApiTarget = env.VITE_CLOUDFLARE_API_URL?.trim().replace(/\/+$/, '')
  const workerApiTarget = configuredWorkerApiTarget || 'http://localhost:8787'

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      define: {
        __MG_WORKER_API_BASE__: JSON.stringify(configuredWorkerApiTarget || ''),
      },
      build: {
        outDir: 'out/main',
        rollupOptions: {
          external: ['electron'],
          input: {
            index: resolve(projectRoot, 'electron/main/index.ts'),
          },
        },
      },
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      build: {
        outDir: 'out/preload',
        rollupOptions: {
          external: ['electron'],
          input: {
            index: resolve(projectRoot, 'electron/preload/index.ts'),
          },
        },
      },
    },
    renderer: {
      root: '.',
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
        outDir: 'out/renderer',
        rollupOptions: {
          input: {
            index: resolve(projectRoot, 'index.html'),
          },
        },
      },
    },
  }
})
