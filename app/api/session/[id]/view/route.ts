import { supabaseServer } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = supabaseServer()
  await sb.rpc('increment_view_count', { session_id: id })
  return NextResponse.json({ ok: true })
}
