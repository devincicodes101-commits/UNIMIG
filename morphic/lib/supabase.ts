import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey

if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
  console.error('[SUPABASE] ERROR: NEXT_PUBLIC_SUPABASE_URL is not set or is a placeholder in .env.local')
}
if (!supabaseAnonKey || supabaseAnonKey.includes('placeholder')) {
  console.error('[SUPABASE] ERROR: NEXT_PUBLIC_SUPABASE_ANON_KEY is not set or is a placeholder in .env.local')
}

console.log('[SUPABASE] Connecting to:', supabaseUrl)

// Server-side admin client (service role key — more permissions)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Client-side client (anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
