import { supabaseServer } from '@/lib/supabase'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = supabaseServer()

  const [{ data: journey }, { data: sessions }] = await Promise.all([
    sb.from('journeys').select('*').eq('id', id).single(),
    sb.from('sessions').select('id, gate, status, idea').eq('journey_id', id).order('gate'),
  ])

  if (!journey) return Response.json({ error: 'Not found' }, { status: 404 })

  const sessionIds = (sessions ?? []).map((s) => s.id as string)

  const [artifactsResult, gate1Session] = await Promise.all([
    sessionIds.length
      ? sb.from('artifacts').select('session_id, type, content').in('session_id', sessionIds)
      : Promise.resolve({ data: [] }),
    Promise.resolve((sessions ?? []).find((s) => (s.gate as number) === 1)),
  ])

  const reactionRows = gate1Session
    ? (await sb.from('reactions').select('type').eq('session_id', gate1Session.id)).data ?? []
    : []

  const reactionCounts = { user: 0, investor: 0, builder: 0 }
  for (const r of reactionRows) {
    const t = (r as { type: string }).type as keyof typeof reactionCounts
    if (t in reactionCounts) reactionCounts[t]++
  }

  const artifactMap = new Map<string, Record<string, string>>()
  for (const a of artifactsResult.data ?? []) {
    const sid = a.session_id as string
    const existing = artifactMap.get(sid) ?? {}
    artifactMap.set(sid, { ...existing, [a.type as string]: a.content as string })
  }

  return Response.json({
    journey,
    sessions: (sessions ?? []).map((s) => ({
      id: s.id,
      gate: s.gate,
      status: s.status,
      idea: s.idea,
      artifacts: artifactMap.get(s.id as string) ?? {},
    })),
    reactionCounts,
  })
}
