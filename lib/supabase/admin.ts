import { createClient } from '@supabase/supabase-js'

/**
 * Admin client with service role key - bypasses RLS
 * Use this for server-side operations that need to update data
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
