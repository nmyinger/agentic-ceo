import { supabaseServer } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { parseWedge, parseUserPersona } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '6'), 20)
  const offset = Math.max(Number(searchParams.get('offset') ?? '0'), 0)
  const exclude = searchParams.get('exclude')

  const sb = supabaseServer()

  let query = sb
    .from('sessions')
    .select('id, idea, created_at, view_count')
    .eq('listed', true)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (exclude) query = query.neq('id', exclude)

  const { data: sessions } = await query

  if (!sessions?.length) return NextResponse.json({ visions: [], hasMore: false })

  const ids = sessions.map((s) => s.id as string)

  const [{ data: artifacts }, { data: reactionRows }] = await Promise.all([
    sb.from('artifacts').select('session_id, content').eq('type', 'vision').in('session_id', ids),
    sb.from('reactions').select('session_id, type').in('session_id', ids),
  ])

  const visionMap = new Map<string, string>()
  for (const a of artifacts ?? []) visionMap.set(a.session_id as string, a.content as string)

  // Build per-type reaction counts
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

  const visions = sessions.map((s) => {
    const vision = visionMap.get(s.id as string) ?? ''
    return {
      id: s.id,
      idea: s.idea,
      createdAt: s.created_at,
      viewCount: (s.view_count as number) ?? 0,
      wedge: parseWedge(vision),
      persona: parseUserPersona(vision),
      reactionCounts: reactionMap.get(s.id as string) ?? { user: 0, investor: 0, builder: 0 },
    }
  })

  return NextResponse.json({ visions, hasMore: sessions.length === limit })
}
