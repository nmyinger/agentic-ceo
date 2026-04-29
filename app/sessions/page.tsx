'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { loadSessions, removeSession, saveSession } from '@/lib/sessions'

type SessionCard = {
  id: string
  createdAt: string
  idea: string | null
  hasVision: boolean
  visionExcerpt: string | null
  savedAt: string
}

export default function SessionsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionCard[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const stored = loadSessions()
    if (stored.length === 0) {
      setLoading(false)
      return
    }

    fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: stored.map((s) => s.id) }),
    })
      .then((r) => r.json())
      .then(({ sessions: fetched }: { sessions: Omit<SessionCard, 'savedAt'>[] }) => {
        const savedAtMap = new Map(stored.map((s) => [s.id, s.savedAt]))
        setSessions(
          fetched.map((s) => ({
            ...s,
            savedAt: savedAtMap.get(s.id) ?? s.createdAt,
          }))
        )
      })
      .catch(() => {
        setSessions(
          stored.map((s) => ({
            id: s.id,
            createdAt: s.savedAt,
            idea: null,
            hasVision: false,
            visionExcerpt: null,
            savedAt: s.savedAt,
          }))
        )
      })
      .finally(() => setLoading(false))
  }, [])

  async function startNew() {
    setStarting(true)
    try {
      const res = await fetch('/api/session', { method: 'POST' })
      if (!res.ok) throw new Error()
      const { id } = await res.json()
      saveSession(id)
      router.push(`/session/${id}`)
    } catch {
      setStarting(false)
    }
  }

  function forget(id: string) {
    removeSession(id)
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <main className="bg-zinc-950 text-zinc-100 min-h-screen">
      <nav
        className="sticky top-0 z-10 border-b border-zinc-800/50 px-4 sm:px-8 py-4 flex items-center justify-between bg-zinc-950/90 backdrop-blur-md"
        style={{ paddingTop: 'max(16px, calc(16px + var(--safe-top)))' }}
      >
        <Link
          href="/"
          className="text-sm font-semibold tracking-widest text-zinc-200 uppercase hover:text-white transition-colors"
        >
          Kora
        </Link>
        <span className="text-xs font-mono text-zinc-600">Session History</span>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-zinc-200">Your Sessions</h1>
            <p className="text-xs text-zinc-600">Saved in this browser — sessions persist by URL.</p>
          </div>
          <button
            onClick={startNew}
            disabled={starting}
            className="shrink-0 inline-flex items-center gap-2 min-h-[44px] bg-violet-600 text-white font-semibold px-4 py-2.5 rounded-lg hover:bg-violet-500 active:bg-violet-700 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_28px_rgba(139,92,246,0.45)] text-sm disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {starting ? 'Starting…' : 'New session →'}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-zinc-600 py-12">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 animate-pulse" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="border border-zinc-800/60 rounded-xl p-10 text-center space-y-5">
            <p className="text-sm text-zinc-500">No sessions in this browser yet.</p>
            <button
              onClick={startNew}
              disabled={starting}
              className="inline-flex items-center gap-2 min-h-[48px] bg-violet-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-violet-500 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_28px_rgba(139,92,246,0.45)] text-sm disabled:opacity-40 disabled:shadow-none"
            >
              Begin your first session →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="border border-zinc-800/60 hover:border-violet-800/50 hover:bg-violet-950/10 rounded-xl p-5 transition-all space-y-3 group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-zinc-600">{session.id.slice(0, 8)}</span>
                      {session.hasVision && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-600 border border-emerald-800/40 rounded-full px-2 py-0.5">
                          <span className="w-1 h-1 rounded-full bg-emerald-500" />
                          Vision ready
                        </span>
                      )}
                    </div>
                    {session.idea ? (
                      <p className="text-sm text-zinc-200 font-medium group-hover:text-white transition-colors">{session.idea}</p>
                    ) : (
                      <p className="text-sm text-zinc-600 italic">No title yet</p>
                    )}
                    {session.visionExcerpt && (
                      <p className="text-xs text-zinc-600 leading-relaxed line-clamp-2">
                        {session.visionExcerpt}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-[10px] font-mono text-zinc-700">
                    {new Date(session.savedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <Link
                    href={`/session/${session.id}`}
                    className="text-xs font-semibold text-violet-400 border border-violet-800/50 rounded-lg px-4 min-h-[44px] flex items-center hover:border-violet-600/60 hover:text-violet-300 hover:bg-violet-950/20 transition-all"
                  >
                    Continue →
                  </Link>
                  <Link
                    href={`/session/${session.id}/view`}
                    className="text-xs text-zinc-500 border border-zinc-800/70 rounded-lg px-4 min-h-[44px] flex items-center hover:border-zinc-700 hover:text-zinc-400 transition-colors"
                  >
                    View results ↗
                  </Link>
                  <button
                    onClick={() => forget(session.id)}
                    className="text-xs text-zinc-700 hover:text-zinc-500 px-3 min-h-[44px] flex items-center transition-colors ml-auto"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
