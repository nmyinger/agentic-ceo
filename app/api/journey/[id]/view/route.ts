import { supabaseServer } from '@/lib/supabase'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = supabaseServer()
  await sb.rpc('increment_journey_view_count', { journey_id: id })
  return Response.json({ ok: true })
}
