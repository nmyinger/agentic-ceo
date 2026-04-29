import { supabaseServer } from '@/lib/supabase'
import { ChatView } from './chat-view'
import { Gate2ChatView } from './gate2-chat-view'
import { notFound } from 'next/navigation'

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = supabaseServer()

  const { data: session } = await sb
    .from('sessions')
    .select('id, status, gate, parent_session_id')
    .eq('id', id)
    .single()
  if (!session) notFound()

  const gate = (session.gate as number) ?? 1

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

  if (gate === 2) {
    // Fetch the parent Gate 1 vision so the Customer Inquisitor can read it
    let parentVision = ''
    const parentId = session.parent_session_id as string | null
    if (parentId) {
      const { data: parentArtifact } = await sb
        .from('artifacts')
        .select('content')
        .eq('session_id', parentId)
        .eq('type', 'vision')
        .maybeSingle()
      parentVision = (parentArtifact?.content as string) ?? ''
    }

    const icpContent = artifacts?.find((a) => a.type === 'icp')?.content ?? ''
    const scriptContent = artifacts?.find((a) => a.type === 'interview_script')?.content ?? ''
    const outreachContent = artifacts?.find((a) => a.type === 'outreach_list')?.content ?? ''

    return (
      <Gate2ChatView
        sessionId={id}
        parentSessionId={parentId ?? ''}
        initialMessages={initialMessages}
        initialIcp={icpContent}
        initialScript={scriptContent}
        initialOutreach={outreachContent}
        initialStatus={(session.status as string) ?? 'active'}
        parentVision={parentVision}
      />
    )
  }

  const visionContent = artifacts?.find((a) => a.type === 'vision')?.content ?? ''
  const parkingContent = artifacts?.find((a) => a.type === 'parking_lot')?.content ?? ''
  const actionsContent = artifacts?.find((a) => a.type === 'actions')?.content ?? ''

  return (
    <ChatView
      sessionId={id}
      initialMessages={initialMessages}
      initialVision={visionContent}
      initialParkingLot={parkingContent}
      initialActions={actionsContent}
      initialStatus={(session.status as string) ?? 'active'}
    />
  )
}
