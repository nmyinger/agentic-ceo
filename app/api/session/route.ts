import { supabaseServer } from '@/lib/supabase'

export async function POST() {
  const sb = supabaseServer()
  const { data, error } = await sb.from('sessions').insert({}).select('id').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ id: data.id })
}
