import { supabaseServer } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { parseWedge, parseUserPersona } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '6'), 20)
  const offset = Math.max(Number(searchParams.get('offset') ?? '0'), 0)

  const sb = supabaseServer()

  const { data: journeys } = await sb
    .from('journeys')
    .select('id, title, created_at, view_count, current_gate, status')
    .eq('listed', true)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (!journeys?.length) return NextResponse.json({ journeys: [], hasMore: false })

  const journeyIds = journeys.map((j) => j.id as string)

  // Get Gate 1 sessions for each journey (for artifact + reactions lookup)
  const { data: gate1Sessions } = await sb
    .from('sessions')
    .select('id, journey_id')
    .in('journey_id', journeyIds)
    .eq('gate', 1)

  const sessionIdByJourneyId = new Map<string, string>()
  for (const s of gate1Sessions ?? []) {
    sessionIdByJourneyId.set(s.journey_id as string, s.id as string)
  }

  const sessionIds = [...sessionIdByJourneyId.values()]

  const [{ data: artifacts }, { data: reactionRows }] = await Promise.all([
    sessionIds.length
      ? sb.from('artifacts').select('session_id, content').eq('type', 'vision').in('session_id', sessionIds)
      : Promise.resolve({ data: [] }),
    sessionIds.length
      ? sb.from('reactions').select('session_id, type').in('session_id', sessionIds)
      : Promise.resolve({ data: [] }),
  ])

  const visionBySessionId = new Map<string, string>()
  for (const a of artifacts ?? []) visionBySessionId.set(a.session_id as string, a.content as string)

  const reactionMap = new Map<string, { user: number; investor: number; builder: number }>()
  for (const r of reactionRows ?? []) {
    const sid = r.session_id as string
    const type = r.type as string
    const counts = reactionMap.get(sid) ?? { user: 0, investor: 0, builder: 0 }
    if (type === 'user') counts.user++
    else if (type === 'investor') counts.investor++
    else if (type === 'builder') counts.builder++
    reactionMap.set(sid, counts)
  }

  const result = journeys.map((j) => {
    const sessionId = sessionIdByJourneyId.get(j.id as string)
    const vision = sessionId ? (visionBySessionId.get(sessionId) ?? '') : ''
    const reactionCounts = sessionId ? (reactionMap.get(sessionId) ?? { user: 0, investor: 0, builder: 0 }) : { user: 0, investor: 0, builder: 0 }

    return {
      id: j.id,
      title: j.title ?? null,
      createdAt: j.created_at,
      viewCount: (j.view_count as number) ?? 0,
      currentGate: (j.current_gate as number) ?? 1,
      status: j.status,
      wedge: parseWedge(vision),
      persona: parseUserPersona(vision),
      reactionCounts,
    }
  })

  return NextResponse.json({ journeys: result, hasMore: journeys.length === limit })
}
