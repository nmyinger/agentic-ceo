import { supabaseServer } from '@/lib/supabase'

const VALID_TYPES = ['user', 'investor', 'builder'] as const
type ReactionType = (typeof VALID_TYPES)[number]

async function getGate1SessionId(journeyId: string): Promise<string | undefined> {
  const sb = supabaseServer()
  const { data } = await sb
    .from('sessions')
    .select('id')
    .eq('journey_id', journeyId)
    .eq('gate', 1)
    .limit(1)
    .single()
  return data?.id as string | undefined
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const type: ReactionType = body.type

  if (!VALID_TYPES.includes(type)) {
    return Response.json({ error: 'invalid type' }, { status: 400 })
  }

  const sessionId = await getGate1SessionId(id)
  if (!sessionId) return Response.json({ error: 'not found' }, { status: 404 })

  const sb = supabaseServer()
  await sb.from('reactions').insert({ session_id: sessionId, type })

  const { data } = await sb.from('reactions').select('type').eq('session_id', sessionId)
  const counts = { user: 0, investor: 0, builder: 0 }
  for (const r of data ?? []) counts[r.type as ReactionType]++

  return Response.json({ counts })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const type: ReactionType = body.type

  if (!VALID_TYPES.includes(type)) {
    return Response.json({ error: 'invalid type' }, { status: 400 })
  }

  const sessionId = await getGate1SessionId(id)
  if (!sessionId) return Response.json({ error: 'not found' }, { status: 404 })

  const sb = supabaseServer()
  const { data: row } = await sb
    .from('reactions')
    .select('id')
    .eq('session_id', sessionId)
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (row) await sb.from('reactions').delete().eq('id', row.id)

  const { data } = await sb.from('reactions').select('type').eq('session_id', sessionId)
  const counts = { user: 0, investor: 0, builder: 0 }
  for (const r of data ?? []) counts[r.type as ReactionType]++

  return Response.json({ counts })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessionId = await getGate1SessionId(id)
  if (!sessionId) return Response.json({ counts: { user: 0, investor: 0, builder: 0 } })

  const sb = supabaseServer()
  const { data } = await sb.from('reactions').select('type').eq('session_id', sessionId)
  const counts = { user: 0, investor: 0, builder: 0 }
  for (const r of data ?? []) counts[r.type as ReactionType]++

  return Response.json({ counts })
}
