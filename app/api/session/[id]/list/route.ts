import { supabaseServer } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const listed: boolean = !!body.listed

  const sb = supabaseServer()
  await sb.from('sessions').update({ listed }).eq('id', id)

  return NextResponse.json({ listed })
}
