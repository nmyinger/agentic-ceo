import type { Metadata } from 'next'
import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase'
import { parseWedge } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Public Visions — Kora',
  description: 'Explore one-page visions built with Kora.',
}

export const dynamic = 'force-dynamic'

type ReactionRow = { type: string }
type ArtifactRow = { session_id: string; content: string }

export default async function VisionsPage() {
  const sb = supabaseServer()

  const { data: sessions } = await sb
    .from('sessions')
    .select('id, idea, created_at, view_count')
    .eq('listed', true)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(50)

  if (!sessions?.length) {
    return (
      <main className="bg-zinc-950 text-zinc-100 min-h-screen">
        <nav
          className="sticky top-0 z-10 border-b border-zinc-800/50 px-4 sm:px-8 py-4 flex items-center justify-between bg-zinc-950/90 backdrop-blur-md"
          style={{ paddingTop: 'max(16px, calc(16px + var(--safe-top)))' }}
        >
          <Link href="/" className="text-sm font-semibold tracking-widest text-zinc-200 uppercase hover:text-white transition-colors">
            Kora
          </Link>
          <span className="text-xs font-mono text-zinc-600">Public Visions</span>
        </nav>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center space-y-4">
          <p className="text-sm text-zinc-500">No public visions yet.</p>
          <p className="text-xs text-zinc-700">Complete a Gate 1 session and toggle &quot;Public gallery&quot; on your vision to be listed here.</p>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition-colors mt-2">
            Start a session →
          </Link>
        </div>
      </main>
    )
  }

  const ids = sessions.map((s) => s.id as string)

  const [{ data: artifacts }, { data: reactionRows }] = await Promise.all([
    sb.from('artifacts').select('session_id, content').eq('type', 'vision').in('session_id', ids),
    sb.from('reactions').select('session_id, type').in('session_id', ids),
  ])

  const visionMap = new Map<string, string>()
  for (const a of (artifacts as ArtifactRow[] | null) ?? []) {
    visionMap.set(a.session_id, a.content)
  }

  const reactionMap = new Map<string, number>()
  for (const r of (reactionRows as (ReactionRow & { session_id: string })[] | null) ?? []) {
    reactionMap.set(r.session_id, (reactionMap.get(r.session_id) ?? 0) + 1)
  }

  return (
    <main className="bg-zinc-950 text-zinc-100 min-h-screen">
      <nav
        className="sticky top-0 z-10 border-b border-zinc-800/50 px-4 sm:px-8 py-4 flex items-center justify-between bg-zinc-950/90 backdrop-blur-md"
        style={{ paddingTop: 'max(16px, calc(16px + var(--safe-top)))' }}
      >
        <Link href="/" className="text-sm font-semibold tracking-widest text-zinc-200 uppercase hover:text-white transition-colors">
          Kora
        </Link>
        <span className="text-xs font-mono text-zinc-600">Public Visions</span>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-zinc-100">Public Visions</h1>
          <p className="text-sm text-zinc-500">{sessions.length} {sessions.length === 1 ? 'vision' : 'visions'} shared by founders using Kora.</p>
        </div>

        <div className="space-y-4">
          {sessions.map((session) => {
            const vision = visionMap.get(session.id as string) ?? ''
            const wedge = parseWedge(vision)
            const totalReactions = reactionMap.get(session.id as string) ?? 0
            const views = (session.view_count as number) ?? 0

            return (
              <Link
                key={session.id as string}
                href={`/session/${session.id}/view`}
                className="block border border-zinc-800/60 hover:border-zinc-700/80 bg-zinc-900/20 hover:bg-zinc-900/40 rounded-xl p-5 sm:p-6 space-y-3 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                      {new Date(session.created_at as string).toLocaleDateString()}
                    </p>
                    <h2 className="text-base font-semibold text-zinc-100 group-hover:text-white transition-colors truncate">
                      {(session.idea as string | null) ?? `Session ${(session.id as string).slice(0, 8)}`}
                    </h2>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors mt-1">↗</span>
                </div>

                {wedge && (
                  <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2">{wedge}</p>
                )}

                <div className="flex items-center gap-3 pt-1">
                  {views > 0 && (
                    <span className="text-[11px] font-mono text-zinc-700">{views.toLocaleString()} views</span>
                  )}
                  {totalReactions > 0 && (
                    <span className="text-[11px] font-mono text-zinc-700">{totalReactions} signals</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        <div className="border-t border-zinc-800/50 pt-8 flex items-center justify-between">
          <p className="text-xs text-zinc-600">Built with Kora</p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            Start your session →
          </Link>
        </div>
      </div>
    </main>
  )
}
