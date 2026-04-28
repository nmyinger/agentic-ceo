import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabaseServer = () =>
  createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? anon)

export const supabaseBrowser = () =>
  createClient(url, anon)
