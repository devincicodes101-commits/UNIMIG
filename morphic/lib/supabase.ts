import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey

function getClient(url: string, key: string): SupabaseClient {
  if (!url || !key) {
    console.error('[SUPABASE] ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or key. Supabase calls will fail at runtime.')
    // Return a dummy client during build — it will never be called at build time
    return createClient('https://placeholder.supabase.co', 'placeholder')
  }
  console.log('[SUPABASE] Connecting to:', url)
  return createClient(url, key)
}

// Server-side admin client (service role key — more permissions)
export const supabaseAdmin = getClient(supabaseUrl, supabaseServiceKey)

// Client-side client (anon key)
export const supabase = getClient(supabaseUrl, supabaseAnonKey)
