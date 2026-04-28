import { supabaseServer } from '@/lib/supabase'
import { ShareView } from './share-view'
import { notFound } from 'next/navigation'

export default async function ViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = supabaseServer()

  const { data: session } = await sb
    .from('sessions')
    .select('id, idea, created_at')
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
    />
  )
}
