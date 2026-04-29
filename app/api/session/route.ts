import { supabaseServer } from '@/lib/supabase'

export async function POST(req: Request) {
  const sb = supabaseServer()
  const body = await req.json().catch(() => ({}))
  const gate = typeof body.gate === 'number' && body.gate > 0 ? body.gate : 1
  const parentSessionId = typeof body.parent_session_id === 'string' && body.parent_session_id ? body.parent_session_id : null
  const journeyId = typeof body.journey_id === 'string' && body.journey_id ? body.journey_id : null

  const insertData: Record<string, unknown> = { gate }
  if (parentSessionId) insertData.parent_session_id = parentSessionId
  if (journeyId) insertData.journey_id = journeyId

  const { data, error } = await sb.from('sessions').insert(insertData).select('id').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ id: data.id })
}
