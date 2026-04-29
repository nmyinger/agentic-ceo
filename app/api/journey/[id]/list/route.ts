import { supabaseServer } from '@/lib/supabase'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const listed: boolean = !!body.listed

  const sb = supabaseServer()
  await sb.from('journeys').update({ listed }).eq('id', id)

  return Response.json({ listed })
}
