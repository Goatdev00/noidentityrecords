/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_BOLD_IDENTITY_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
