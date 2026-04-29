import { supabaseServer } from '@/lib/supabase'
import { ChatView } from '@/app/session/[id]/chat-view'
import { notFound, redirect } from 'next/navigation'

export default async function GatePage({
  params,
}: {
  params: Promise<{ id: string; n: string }>
}) {
  const { id: journeyId, n } = await params
  const gate = parseInt(n, 10)
  if (isNaN(gate) || gate < 1 || gate > 5) notFound()

  const sb = supabaseServer()

  // Find the session for this gate within the journey
  const { data: session } = await sb
    .from('sessions')
    .select('id, status, gate, parent_session_id')
    .eq('journey_id', journeyId)
    .eq('gate', gate)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!session) {
    // Gate hasn't been started yet — redirect to journey page
    redirect(`/journey/${journeyId}`)
  }

  const sessionId = session.id as string

  const [{ data: dbMessages }, { data: artifacts }] = await Promise.all([
    sb.from('messages').select('id, role, content').eq('session_id', sessionId).order('created_at'),
    sb.from('artifacts').select('type, content').eq('session_id', sessionId),
  ])

  const initialMessages = (dbMessages ?? []).map((m) => ({
    id: m.id as string,
    role: m.role as 'user' | 'assistant',
    content: m.content as string,
  }))

  const parentSessionId = (session.parent_session_id as string | null) ?? null

  let visionContent = artifacts?.find((a) => a.type === 'vision')?.content ?? ''
  if (!visionContent && parentSessionId) {
    const { data: parentArtifacts } = await sb
      .from('artifacts')
      .select('type, content')
      .eq('session_id', parentSessionId)
    visionContent = parentArtifacts?.find((a) => a.type === 'vision')?.content ?? ''
  }

  return (
    <ChatView
      sessionId={sessionId}
      journeyId={journeyId}
      gate={gate}
      parentSessionId={parentSessionId}
      initialMessages={initialMessages}
      initialVision={visionContent}
      initialParkingLot={artifacts?.find((a) => a.type === 'parking_lot')?.content ?? ''}
      initialActions={artifacts?.find((a) => a.type === 'actions')?.content ?? ''}
      initialInterviews={artifacts?.find((a) => a.type === 'interviews')?.content ?? ''}
      initialStatus={(session.status as string) ?? 'active'}
    />
  )
}
