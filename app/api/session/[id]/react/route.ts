import { supabaseServer } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const VALID_TYPES = ['user', 'investor', 'builder'] as const
type ReactionType = (typeof VALID_TYPES)[number]

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const type: ReactionType = body.type

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'invalid type' }, { status: 400 })
  }

  const sb = supabaseServer()
  await sb.from('reactions').insert({ session_id: id, type })

  const { data } = await sb
    .from('reactions')
    .select('type')
    .eq('session_id', id)

  const counts = { user: 0, investor: 0, builder: 0 }
  for (const r of data ?? []) counts[r.type as ReactionType]++

  return NextResponse.json({ counts })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = supabaseServer()

  const { data } = await sb
    .from('reactions')
    .select('type')
    .eq('session_id', id)

  const counts = { user: 0, investor: 0, builder: 0 }
  for (const r of data ?? []) counts[r.type as ReactionType]++

  return NextResponse.json({ counts })
}
