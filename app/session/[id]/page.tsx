import { supabaseServer } from '@/lib/supabase'
import { ChatView } from './chat-view'
import { notFound } from 'next/navigation'

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = supabaseServer()

  const { data: session } = await sb
    .from('sessions')
    .select('id, status, gate, parent_session_id, journey_id')
    .eq('id', id)
    .single()
  if (!session) notFound()

  const { data: dbMessages } = await sb
    .from('messages')
    .select('id, role, content')
    .eq('session_id', id)
    .order('created_at')

  const { data: artifacts } = await sb
    .from('artifacts')
    .select('type, content')
    .eq('session_id', id)

  const initialMessages = (dbMessages ?? []).map((m) => ({
    id: m.id as string,
    role: m.role as 'user' | 'assistant',
    content: m.content as string,
  }))

  const gate = (session.gate as number | null) ?? 1
  const parentSessionId = (session.parent_session_id as string | null) ?? null
  const journeyId = (session.journey_id as string | null) ?? null

  // For Gate 2, populate the vision display from the parent session's locked vision
  // (Gate 2 never emits its own vision artifact)
  let visionContent = artifacts?.find((a) => a.type === 'vision')?.content ?? ''
  if (!visionContent && parentSessionId) {
    const { data: parentArtifacts } = await sb
      .from('artifacts')
      .select('type, content')
      .eq('session_id', parentSessionId)
    visionContent = parentArtifacts?.find((a) => a.type === 'vision')?.content ?? ''
  }

  const parkingContent = artifacts?.find((a) => a.type === 'parking_lot')?.content ?? ''
  const actionsContent = artifacts?.find((a) => a.type === 'actions')?.content ?? ''
  const interviewsContent = artifacts?.find((a) => a.type === 'interviews')?.content ?? ''

  return (
    <ChatView
      sessionId={id}
      journeyId={journeyId}
      gate={gate}
      parentSessionId={parentSessionId}
      initialMessages={initialMessages}
      initialVision={visionContent}
      initialParkingLot={parkingContent}
      initialActions={actionsContent}
      initialInterviews={interviewsContent}
      initialStatus={(session.status as string) ?? 'active'}
    />
  )
}
