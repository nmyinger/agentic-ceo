import { supabaseServer } from '@/lib/supabase'

export async function POST(req: Request) {
  const sb = supabaseServer()
  const body = await req.json().catch(() => ({}))
  const { gate = 1, parentSessionId } = body as { gate?: number; parentSessionId?: string }

  const { data, error } = await sb
    .from('sessions')
    .insert({ gate, parent_session_id: parentSessionId ?? null })
    .select('id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ id: data.id })
}
