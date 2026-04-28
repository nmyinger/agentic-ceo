import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
// Supports both the new publishable key format and the legacy anon key
const publicKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)!

export const supabaseServer = () =>
  createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? publicKey)

export const supabaseBrowser = () =>
  createClient(url, publicKey)
