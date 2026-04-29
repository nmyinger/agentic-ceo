import { NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { ids } = (await req.json()) as { ids: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ journeys: [] })
  }

  const sb = supabaseServer()
  const limitedIds = ids.slice(0, 50)

  const { data: journeys } = await sb
    .from('journeys')
    .select('id, created_at, title, status, current_gate')
    .in('id', limitedIds)

  const idOrder = new Map(ids.map((id, i) => [id, i]))
  const result = (journeys ?? [])
    .map((j) => ({
      id: j.id as string,
      createdAt: j.created_at as string,
      title: j.title as string | null,
      status: j.status as string | null,
      currentGate: (j.current_gate as number | null) ?? 1,
    }))
    .sort((a, b) => (idOrder.get(a.id) ?? 999) - (idOrder.get(b.id) ?? 999))

  return Response.json({ journeys: result })
}
