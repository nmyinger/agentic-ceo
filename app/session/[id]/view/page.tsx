import type { Metadata } from 'next'
import { supabaseServer } from '@/lib/supabase'
import { ShareView } from './share-view'
import { notFound } from 'next/navigation'
import { parseWedge } from '@/lib/utils'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const sb = supabaseServer()

  const [{ data: session }, { data: artifacts }] = await Promise.all([
    sb.from('sessions').select('idea').eq('id', id).single(),
    sb.from('artifacts').select('type, content').eq('session_id', id),
  ])

  const idea = (session?.idea as string | null) ?? 'Vision Document'
  const vision = artifacts?.find((a) => a.type === 'vision')?.content ?? ''
  const wedge = parseWedge(vision)
  const description = wedge || 'A focused one-page vision — built with Kora'

  return {
    title: `${idea} — Kora Vision`,
    description,
    openGraph: {
      title: idea,
      description,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: idea,
      description,
    },
  }
}

export default async function ViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = supabaseServer()

  const { data: session } = await sb
    .from('sessions')
    .select('id, idea, created_at, view_count')
    .eq('id', id)
    .single()
  if (!session) notFound()

  const { data: artifacts } = await sb
    .from('artifacts')
    .select('type, content')
    .eq('session_id', id)

  const vision = artifacts?.find((a) => a.type === 'vision')?.content ?? ''
  const parkingLot = artifacts?.find((a) => a.type === 'parking_lot')?.content ?? ''

  return (
    <ShareView
      sessionId={id}
      idea={(session.idea as string | null) ?? null}
      createdAt={session.created_at as string}
      vision={vision}
      parkingLot={parkingLot}
      viewCount={(session.view_count as number | null) ?? 0}
    />
  )
}
