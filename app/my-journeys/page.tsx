'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { loadJourneys, removeJourney, saveJourney } from '@/lib/journeys'

type JourneyCard = {
  id: string
  createdAt: string
  title: string | null
  status: string | null
  currentGate: number
  savedAt: string
}

const GATE_LABELS: Record<number, string> = {
  1: 'Vision Architect',
  2: 'Pattern Confirmation',
  3: 'Business Model',
  4: 'Go-to-Market',
  5: 'Launch',
}

function GateProgress({ current, total = 5 }: { current: number; total?: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }, (_, i) => i + 1).map((g) => (
        <span
          key={g}
          className={`w-2 h-2 rounded-full ${
            g < current ? 'bg-emerald-500' :
            g === current ? 'bg-violet-500' :
            'bg-zinc-800'
          }`}
        />
      ))}
      <span className="text-[10px] font-mono text-zinc-600 ml-1">Gate {current}/5</span>
    </div>
  )
}

export default function MyJourneysPage() {
  const router = useRouter()
  const [journeys, setJourneys] = useState<JourneyCard[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const stored = loadJourneys()
    if (stored.length === 0) {
      setLoading(false)
      return
    }

    // Fetch journey data from the journeys table
    const ids = stored.map((j) => j.id)
    fetch('/api/journeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
      .then((r) => r.json())
      .then(({ journeys: fetched }: { journeys: Omit<JourneyCard, 'savedAt'>[] }) => {
        const savedAtMap = new Map(stored.map((j) => [j.id, j.savedAt]))
        setJourneys(
          fetched.map((j) => ({
            ...j,
            savedAt: savedAtMap.get(j.id) ?? j.createdAt,
          }))
        )
      })
      .catch(() => {
        setJourneys(
          stored.map((j) => ({
            id: j.id,
            createdAt: j.savedAt,
            title: null,
            status: null,
            currentGate: 1,
            savedAt: j.savedAt,
          }))
        )
      })
      .finally(() => setLoading(false))
  }, [])

  async function startNew() {
    setStarting(true)
    try {
      const res = await fetch('/api/journey', { method: 'POST' })
      if (!res.ok) throw new Error()
      const { journeyId, sessionId } = await res.json()
      saveJourney(journeyId)
      // Also save session for backward compat
      try {
        const sessions = JSON.parse(localStorage.getItem('kora_sessions') ?? '[]')
        sessions.unshift({ id: sessionId, savedAt: new Date().toISOString() })
        localStorage.setItem('kora_sessions', JSON.stringify(sessions.slice(0, 50)))
      } catch {}
      router.push(`/journey/${journeyId}/gate/1`)
    } catch {
      setStarting(false)
    }
  }

  function forget(id: string) {
    removeJourney(id)
    setJourneys((prev) => prev.filter((j) => j.id !== id))
  }

  const sorted = [...journeys].sort((a, b) => (a.savedAt > b.savedAt ? -1 : 1))

  return (
    <main className="bg-zinc-950 text-zinc-100 min-h-screen">
      <nav
        className="sticky top-0 z-10 border-b border-zinc-800/50 px-4 sm:px-8 py-4 flex items-center justify-between bg-zinc-950/90 backdrop-blur-md"
        style={{ paddingTop: 'max(16px, calc(16px + var(--safe-top)))' }}
      >
        <Link href="/" className="text-sm font-semibold tracking-widest text-zinc-200 uppercase hover:text-white transition-colors">
          Kora
        </Link>
        <span className="text-xs font-mono text-zinc-600">My Journeys</span>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-zinc-200">My Journeys</h1>
            <p className="text-xs text-zinc-600">Saved in this browser — journeys persist by URL.</p>
          </div>
          <button
            onClick={startNew}
            disabled={starting}
            className="shrink-0 inline-flex items-center gap-2 min-h-[44px] bg-violet-600 text-white font-semibold px-4 py-2.5 rounded-lg hover:bg-violet-500 active:bg-violet-700 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_28px_rgba(139,92,246,0.45)] text-sm disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {starting ? 'Starting…' : 'Start journey →'}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-zinc-600 py-12">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 animate-pulse" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="border border-zinc-800/60 rounded-xl p-10 text-center space-y-5">
            <p className="text-sm text-zinc-500">No journeys in this browser yet.</p>
            <button
              onClick={startNew}
              disabled={starting}
              className="inline-flex items-center gap-2 min-h-[48px] bg-violet-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-violet-500 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] text-sm disabled:opacity-40"
            >
              Start your first journey →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((j) => {
              const isCompleted = j.status === 'completed'
              const label = GATE_LABELS[j.currentGate] ?? `Gate ${j.currentGate}`

              return (
                <div
                  key={j.id}
                  className="group border border-zinc-800/60 hover:border-violet-800/50 hover:bg-violet-950/10 rounded-xl p-5 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 min-w-0 flex-1">
                      <GateProgress current={j.currentGate} />
                      {j.title ? (
                        <p className="text-sm text-zinc-200 font-medium group-hover:text-white transition-colors">
                          {j.title}
                        </p>
                      ) : (
                        <p className="text-sm text-zinc-600 italic">No title yet</p>
                      )}
                      <p className="text-xs text-zinc-600">
                        {isCompleted ? 'Completed' : `Active · ${label}`}
                      </p>
                    </div>
                    <p className="shrink-0 text-[10px] font-mono text-zinc-700 mt-0.5">
                      {new Date(j.savedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <Link
                      href={`/journey/${j.id}`}
                      className="text-xs font-semibold border border-violet-800/50 text-violet-400 rounded-lg px-4 min-h-[44px] flex items-center hover:border-violet-600/60 hover:text-violet-300 hover:bg-violet-950/20 transition-all"
                    >
                      {isCompleted ? 'View journey →' : 'Continue journey →'}
                    </Link>
                    <button
                      onClick={() => forget(j.id)}
                      className="text-xs text-zinc-700 hover:text-zinc-500 px-3 min-h-[44px] flex items-center transition-colors ml-auto"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
