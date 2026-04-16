/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TRANSLATOR_API_URL: string
  readonly VITE_CLOUDFLARE_API_URL: string
  readonly VITE_PANELCLEANER_BRIDGE_URL: string
  readonly VITE_OLLAMA_URL: string
  readonly VITE_OLLAMA_MODEL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
