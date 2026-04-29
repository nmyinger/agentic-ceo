import { supabaseServer } from '@/lib/supabase'

export async function POST() {
  const sb = supabaseServer()

  const { data: journey, error: journeyError } = await sb
    .from('journeys')
    .insert({})
    .select('id')
    .single()

  if (journeyError || !journey) {
    return Response.json({ error: 'Failed to create journey' }, { status: 500 })
  }

  const { data: session, error: sessionError } = await sb
    .from('sessions')
    .insert({ gate: 1, journey_id: journey.id })
    .select('id')
    .single()

  if (sessionError || !session) {
    await sb.from('journeys').delete().eq('id', journey.id)
    return Response.json({ error: 'Failed to create session' }, { status: 500 })
  }

  return Response.json({ journeyId: journey.id, sessionId: session.id })
}
