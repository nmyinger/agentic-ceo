import { supabaseServer } from '@/lib/supabase'

export async function GET() {
  const sb = supabaseServer()

  const [{ data: parkingLots }, { count: completedCount }, { count: visionsCount }] = await Promise.all([
    sb.from('artifacts').select('content').eq('type', 'parking_lot'),
    sb.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    sb.from('artifacts').select('*', { count: 'exact', head: true }).eq('type', 'vision'),
  ])

  let ideasKilled = 0
  for (const { content } of parkingLots ?? []) {
    const rows = (content as string).split('\n').filter((line) => {
      const t = line.trim()
      return t.startsWith('|') && !t.includes('Date') && !t.includes('---') && t.length > 3
    })
    ideasKilled += rows.length
  }

  const completedSessions = completedCount ?? 0
  const visionsFormed = visionsCount ?? 0
  // Each completed session surfaces ~6 ideas that survive into the vision
  const total = ideasKilled + completedSessions * 6
  const killRate = total > 0 ? Math.round((ideasKilled / total) * 100) : null

  return Response.json({ ideasKilled, completedSessions, killRate, visionsFormed })
}
