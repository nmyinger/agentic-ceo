import { NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { ids } = (await req.json()) as { ids: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ sessions: [] })
  }

  const sb = supabaseServer()
  const limitedIds = ids.slice(0, 50)

  const [{ data: sessions }, { data: artifacts }] = await Promise.all([
    sb.from('sessions').select('id, created_at, idea, status, gate').in('id', limitedIds),
    sb
      .from('artifacts')
      .select('session_id, content')
      .eq('type', 'vision')
      .in('session_id', limitedIds),
  ])

  const visionMap = new Map(
    (artifacts ?? []).map((a) => [a.session_id as string, a.content as string])
  )

  const idOrder = new Map(ids.map((id, i) => [id, i]))
  const result = (sessions ?? [])
    .map((s) => ({
      id: s.id as string,
      createdAt: s.created_at as string,
      idea: s.idea as string | null,
      status: s.status as string | null,
      gate: (s.gate as number | null) ?? 1,
      hasVision: visionMap.has(s.id as string),
      visionExcerpt:
        visionMap
          .get(s.id as string)
          ?.split('\n')
          .filter((l) => l.trim())
          .slice(0, 2)
          .join(' ')
          .slice(0, 160) ?? null,
    }))
    .sort((a, b) => (idOrder.get(a.id) ?? 999) - (idOrder.get(b.id) ?? 999))

  return Response.json({ sessions: result })
}
