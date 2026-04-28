import { supabaseServer } from '@/lib/supabase'
import { ChatView } from './chat-view'
import { notFound } from 'next/navigation'
export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = supabaseServer()

  const { data: session } = await sb.from('sessions').select('id').eq('id', id).single()
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

  const visionContent = artifacts?.find((a) => a.type === 'vision')?.content ?? ''
  const parkingContent = artifacts?.find((a) => a.type === 'parking_lot')?.content ?? ''

  return (
    <ChatView
      sessionId={id}
      initialMessages={initialMessages}
      initialVision={visionContent}
      initialParkingLot={parkingContent}
    />
  )
}
