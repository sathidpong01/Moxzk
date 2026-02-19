/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_TRANSLATOR_API_URL: string
  readonly MG_PUBLIC_SUPABASE_URL: string
  readonly MG_PUBLIC_SUPABASE_ANON_KEY: string
  readonly MG_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
