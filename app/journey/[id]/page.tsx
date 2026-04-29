import type { Metadata } from 'next'
import { supabaseServer } from '@/lib/supabase'
import { JourneyMap } from './journey-map'
import { notFound } from 'next/navigation'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const sb = supabaseServer()
  const { data: journey } = await sb.from('journeys').select('title').eq('id', id).single()
  const title = journey?.title ?? 'Journey'
  return {
    title: `${title} — Kora Journey`,
    description: 'A founder journey built with Kora — five gates from idea to launch.',
  }
}

export default async function JourneyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = supabaseServer()

  const [{ data: journey }, { data: sessions }] = await Promise.all([
    sb.from('journeys').select('*').eq('id', id).single(),
    sb.from('sessions').select('id, gate, status, idea').eq('journey_id', id).order('gate'),
  ])

  if (!journey) notFound()

  const sessionIds = (sessions ?? []).map((s) => s.id as string)

  const [artifactsResult, gate1Session] = [
    sessionIds.length
      ? await sb.from('artifacts').select('session_id, type, content').in('session_id', sessionIds)
      : { data: [] },
    (sessions ?? []).find((s) => (s.gate as number) === 1),
  ]

  const reactionRows = gate1Session
    ? (await sb.from('reactions').select('type').eq('session_id', gate1Session.id)).data ?? []
    : []

  const reactionCounts = { user: 0, investor: 0, builder: 0 }
  for (const r of reactionRows) {
    const t = (r as { type: string }).type as keyof typeof reactionCounts
    if (t in reactionCounts) reactionCounts[t]++
  }

  const artifactMap = new Map<string, Record<string, string>>()
  for (const a of artifactsResult.data ?? []) {
    const sid = a.session_id as string
    const existing = artifactMap.get(sid) ?? {}
    artifactMap.set(sid, { ...existing, [a.type as string]: a.content as string })
  }

  const mappedSessions = (sessions ?? []).map((s) => ({
    id: s.id as string,
    gate: s.gate as number,
    status: s.status as string | null,
    idea: s.idea as string | null,
    artifacts: artifactMap.get(s.id as string) ?? {},
  }))

  return (
    <JourneyMap
      journey={{
        id: journey.id as string,
        title: journey.title as string | null,
        status: journey.status as string,
        current_gate: journey.current_gate as number,
        listed: journey.listed as boolean,
        view_count: journey.view_count as number,
        created_at: journey.created_at as string,
      }}
      sessions={mappedSessions}
      initialReactionCounts={reactionCounts}
    />
  )
}
