import type { Metadata } from 'next'
import { supabaseServer } from '@/lib/supabase'
import { ShareView } from './share-view'
import { notFound, redirect } from 'next/navigation'
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
    openGraph: { title: idea, description, type: 'article' },
    twitter: { card: 'summary_large_image', title: idea, description },
  }
}

export default async function ViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = supabaseServer()

  // Redirect to journey page if this session has a journey_id
  const { data: sessionMeta } = await sb
    .from('sessions')
    .select('journey_id')
    .eq('id', id)
    .single()

  if (sessionMeta?.journey_id) {
    redirect(`/journey/${sessionMeta.journey_id}`)
  }

  const [{ data: session }, { data: artifacts }] = await Promise.all([
    sb.from('sessions').select('id, idea, created_at, view_count').eq('id', id).single(),
    sb.from('artifacts').select('type, content').eq('session_id', id),
  ])

  if (!session) notFound()

  // Fetch columns/tables added in later migrations gracefully
  const [listedResult, reactionsResult] = await Promise.allSettled([
    sb.from('sessions').select('listed').eq('id', id).single(),
    sb.from('reactions').select('type').eq('session_id', id),
  ])

  const listed =
    listedResult.status === 'fulfilled'
      ? ((listedResult.value.data as { listed?: boolean } | null)?.listed ?? false)
      : false

  const reactionRows =
    reactionsResult.status === 'fulfilled' ? reactionsResult.value.data : []

  const vision = artifacts?.find((a) => a.type === 'vision')?.content ?? ''
  const parkingLot = artifacts?.find((a) => a.type === 'parking_lot')?.content ?? ''

  const reactionCounts = { user: 0, investor: 0, builder: 0 }
  for (const r of reactionRows ?? []) {
    const t = (r as { type: string }).type as keyof typeof reactionCounts
    if (t in reactionCounts) reactionCounts[t]++
  }

  return (
    <ShareView
      sessionId={id}
      idea={(session.idea as string | null) ?? null}
      createdAt={session.created_at as string}
      vision={vision}
      parkingLot={parkingLot}
      viewCount={(session.view_count as number | null) ?? 0}
      reactionCounts={reactionCounts}
      listed={listed}
    />
  )
}
