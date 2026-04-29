import { supabaseServer } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { parseWedge } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '6'), 20)

  const sb = supabaseServer()

  const { data: sessions } = await sb
    .from('sessions')
    .select('id, idea, created_at, view_count')
    .eq('listed', true)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!sessions?.length) return NextResponse.json({ visions: [] })

  const ids = sessions.map((s) => s.id as string)

  const [{ data: artifacts }, { data: reactionRows }] = await Promise.all([
    sb.from('artifacts').select('session_id, content').eq('type', 'vision').in('session_id', ids),
    sb.from('reactions').select('session_id').in('session_id', ids),
  ])

  const visionMap = new Map<string, string>()
  for (const a of artifacts ?? []) visionMap.set(a.session_id as string, a.content as string)

  const reactionMap = new Map<string, number>()
  for (const r of reactionRows ?? []) {
    const sid = r.session_id as string
    reactionMap.set(sid, (reactionMap.get(sid) ?? 0) + 1)
  }

  const visions = sessions.map((s) => {
    const vision = visionMap.get(s.id as string) ?? ''
    return {
      id: s.id,
      idea: s.idea,
      createdAt: s.created_at,
      viewCount: s.view_count ?? 0,
      wedge: parseWedge(vision),
      reactions: reactionMap.get(s.id as string) ?? 0,
    }
  })

  return NextResponse.json({ visions })
}
