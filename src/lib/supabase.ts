import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.MG_PUBLIC_SUPABASE_URL
const supabaseAnonKey = import.meta.env.MG_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] Missing env vars. Set MG_PUBLIC_SUPABASE_URL and MG_PUBLIC_SUPABASE_ANON_KEY in .env.local',
  )
}

export const supabase = createClient<Database>(
  supabaseUrl ?? '',
  supabaseAnonKey ?? '',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'mg-trans-auth',
    },
  },
)
