import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const defaultElectronWorkerApiUrl = 'https://moxzk-api.sathidpong01.workers.dev'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '')
  const configuredWorkerApiTarget = env.VITE_CLOUDFLARE_API_URL?.trim().replace(/\/+$/, '')
  const workerApiTarget = configuredWorkerApiTarget || defaultElectronWorkerApiUrl

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      define: {
        __MOXZK_WORKER_API_BASE__: JSON.stringify(workerApiTarget),
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
          output: {
            format: 'cjs',
            entryFileNames: '[name].cjs',
          },
        },
      },
    },
    renderer: {
      root: '.',
      envPrefix: ['VITE_'],
      define: {
        'import.meta.env.VITE_CLOUDFLARE_API_URL': JSON.stringify(workerApiTarget),
      },
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
      base: './',
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
