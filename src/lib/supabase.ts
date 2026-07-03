import { createClient } from '@supabase/supabase-js'

// Fallbacks are the PUBLISHABLE values (safe in a public repo by design —
// the brief's security model is RLS, not key secrecy). Env vars override
// them locally and in CI.
const url =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://ztzgnorjnffpgytnwnvy.supabase.co'
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'sb_publishable_eScEZXS_8OyryL3_xvudVA_1yKkinmt'

export const supabase = createClient(url, anonKey)

export type Role = 'student' | 'teacher' | 'admin'

export type Profile = {
  id: string
  role: Role
  display_name: string | null
  avatar_url: string | null
}
