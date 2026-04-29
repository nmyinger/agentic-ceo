'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { saveJourney, loadJourneys } from '@/lib/journeys'

type Stats = { ideasKilled: number; completedSessions: number; killRate: number | null; visionsFormed: number }

type PublicJourney = {
  id: string
  title: string | null
  createdAt: string
  viewCount: number
  currentGate: number
  wedge: string
  reactionCounts: { user: number; investor: number; builder: number }
}

const GATE_DEFS = [
  { gate: 1, label: 'Vision Architect',    locked: false },
  { gate: 2, label: 'Pattern Confirmation', locked: true  },
  { gate: 3, label: 'Business Model',       locked: true  },
  { gate: 4, label: 'Go-to-Market',         locked: true  },
  { gate: 5, label: 'Launch',               locked: true  },
]

function StaticGateMap() {
  return (
    <div className="w-full">
      {/* Desktop */}
      <div className="hidden sm:flex items-center gap-0">
        {GATE_DEFS.map((g, i) => (
          <div key={g.gate} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-2 flex-1">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
                  !g.locked
                    ? 'border-violet-600/80 bg-violet-950/50 shadow-[0_0_10px_rgba(139,92,246,0.3)]'
                    : 'border-zinc-800/80 bg-zinc-950/40'
                }`}
              >
                {!g.locked && <span className="w-2.5 h-2.5 rounded-full bg-violet-400" />}
              </div>
              <div className="text-center max-w-[80px]">
                <p className={`text-[9px] font-mono uppercase tracking-widest ${!g.locked ? 'text-violet-500' : 'text-zinc-700'}`}>
                  Gate {g.gate}
                </p>
                <p className={`text-[11px] font-semibold leading-snug mt-0.5 ${!g.locked ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  {g.label}
                </p>
              </div>
            </div>
            {i < GATE_DEFS.length - 1 && (
              <div className="h-px flex-1 max-w-[48px] mx-1 bg-zinc-800/60" />
            )}
          </div>
        ))}
      </div>

      {/* Mobile: compact row */}
      <div className="sm:hidden flex items-center justify-center gap-3">
        {GATE_DEFS.map((g, i) => (
          <div key={g.gate} className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-full border-2 ${
                  !g.locked
                    ? 'border-violet-600/80 bg-violet-950/50 shadow-[0_0_8px_rgba(139,92,246,0.3)]'
                    : 'border-zinc-800/80 bg-zinc-950/40'
                }`}
              >
                {!g.locked && <span className="w-2 h-2 rounded-full bg-violet-400" />}
              </div>
              <span className={`text-[9px] font-mono ${!g.locked ? 'text-violet-500' : 'text-zinc-700'}`}>G{g.gate}</span>
            </div>
            {i < GATE_DEFS.length - 1 && <div className="w-4 h-px bg-zinc-800/60" />}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [myJourneyCount, setMyJourneyCount] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [displayCount, setDisplayCount] = useState(0)
  const [displayVisions, setDisplayVisions] = useState(0)
  const [barWidth, setBarWidth] = useState(0)
  const [publicJourneys, setPublicJourneys] = useState<PublicJourney[]>([])

  useEffect(() => {
    setMyJourneyCount(loadJourneys().length)
    fetch('/api/stats').then((r) => r.json()).then((s: Stats) => setStats(s)).catch(() => {})
    fetch('/api/explore?limit=3')
      .then((r) => r.json())
      .then(({ journeys }: { journeys: PublicJourney[] }) => setPublicJourneys(journeys ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!stats) return
    const target = stats.ideasKilled
    if (target === 0) return
    const step = Math.max(1, Math.floor(target / 40))
    let current = 0
    const id = setInterval(() => {
      current = Math.min(current + step, target)
      setDisplayCount(current)
      if (current >= target) clearInterval(id)
    }, 30)
    return () => clearInterval(id)
  }, [stats])

  useEffect(() => {
    if (!stats) return
    const target = stats.visionsFormed
    if (target === 0) return
    const step = Math.max(1, Math.floor(target / 40))
    let current = 0
    const id = setInterval(() => {
      current = Math.min(current + step, target)
      setDisplayVisions(current)
      if (current >= target) clearInterval(id)
    }, 30)
    return () => clearInterval(id)
  }, [stats])

  useEffect(() => {
    if (stats?.killRate != null) {
      const t = setTimeout(() => setBarWidth(stats.killRate!), 80)
      return () => clearTimeout(t)
    }
  }, [stats])

  async function start() {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/journey', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to create journey')
      const { journeyId, sessionId } = await res.json()
      saveJourney(journeyId)
      // Also save session for backward compat with session-level features
      try {
        const sessions = JSON.parse(localStorage.getItem('kora_sessions') ?? '[]')
        sessions.unshift({ id: sessionId, savedAt: new Date().toISOString() })
        localStorage.setItem('kora_sessions', JSON.stringify(sessions.slice(0, 50)))
      } catch {}
      router.push(`/journey/${journeyId}/gate/1`)
    } catch {
      setError(true)
      setLoading(false)
    }
  }

  return (
    <main className="bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav
        className="sticky top-0 z-10 border-b border-zinc-800/50 px-4 sm:px-8 py-4 flex items-center justify-between bg-zinc-950/90 backdrop-blur-md"
        style={{ paddingTop: 'max(16px, calc(16px + var(--safe-top)))' }}
      >
        <span className="text-sm font-semibold tracking-widest text-zinc-200 uppercase">Kora</span>
        <div className="flex items-center gap-4">
          {myJourneyCount > 0 && (
            <Link href="/my-journeys" className="text-xs font-mono text-zinc-600 hover:text-zinc-400 transition-colors">
              My Journeys ({myJourneyCount})
            </Link>
          )}
          <Link href="/explore" className="text-xs font-mono text-zinc-700 hover:text-zinc-500 transition-colors">
            Explore →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="min-h-[calc(100dvh-57px)] flex flex-col items-center justify-center px-4 sm:px-6 py-16 sm:py-24"
        style={{
          background: 'radial-gradient(ellipse 80% 55% at 50% -5%, rgba(139,92,246,0.13) 0%, transparent 65%)',
        }}
      >
        <div className="max-w-xl w-full space-y-10 sm:space-y-12">
          <div className="space-y-5 sm:space-y-6">
            <div className="inline-flex items-center gap-2 border border-violet-800/50 bg-violet-950/20 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-zinc-400 font-mono">5 gates · idea to launch</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.08] text-gradient-hero">
              Turn your idea into<br />a shipped product.
            </h1>

            <p className="text-zinc-400 text-base leading-relaxed max-w-md">
              Five gates. No detours. From raw idea to launch-ready product — with every decision documented along the way.
            </p>
          </div>

          {/* Gate roadmap — static preview */}
          <div className="border border-zinc-800/60 rounded-xl p-5 sm:p-6">
            <StaticGateMap />
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <button
              onClick={start}
              disabled={loading}
              className="w-full sm:w-auto inline-flex justify-center items-center gap-2.5 min-h-[52px] bg-violet-600 text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-violet-500 active:bg-violet-700 transition-all shadow-[0_0_24px_rgba(139,92,246,0.35)] hover:shadow-[0_0_32px_rgba(139,92,246,0.5)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none text-sm"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-violet-300/50 border-t-white rounded-full animate-spin" />
                  Starting journey...
                </>
              ) : (
                <>
                  Start journey
                  <span className="text-violet-300">→</span>
                </>
              )}
            </button>
            {error && (
              <p className="text-xs text-red-400 font-mono">
                Couldn&apos;t start journey — please try again.
              </p>
            )}
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-zinc-800/40 rounded-xl overflow-hidden border border-zinc-800/60">
            <div className="bg-zinc-950 px-5 py-4 sm:px-6 sm:py-5 space-y-1.5 sm:space-y-2">
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Ideas killed</p>
              <p className="text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-zinc-100">
                {stats ? (stats.ideasKilled === 0 ? '0' : displayCount.toLocaleString()) : '—'}
              </p>
              <p className="text-sm text-zinc-500 leading-snug">distractions buried before they could ship</p>
            </div>

            <div className="bg-zinc-950 px-5 py-4 sm:px-6 sm:py-5 space-y-1.5 sm:space-y-2">
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Journeys completed</p>
              <p className="text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-emerald-400">
                {stats ? (stats.visionsFormed === 0 ? '0' : displayVisions.toLocaleString()) : '—'}
              </p>
              <p className="text-sm text-zinc-500 leading-snug">full vision documents completed</p>
            </div>

            <div className="bg-zinc-950 px-5 py-4 sm:px-6 sm:py-5 space-y-2 sm:space-y-3">
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Filter rate</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-zinc-100">
                  {stats ? (stats.killRate != null ? `${stats.killRate}%` : '—') : '—'}
                </p>
                <p className="text-xs font-mono text-zinc-500">of ideas raised</p>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(139,92,246,0.6)]"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <p className="text-sm text-zinc-500 leading-snug">cleared in-session before becoming scope</p>
            </div>
          </div>

          {/* Journey previews */}
          {publicJourneys.length > 0 && (
            <div className="border-t border-zinc-800/60 pt-8 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">From the community</p>
                <Link href="/explore" className="text-[10px] font-mono text-zinc-700 hover:text-violet-400 transition-colors">
                  See all journeys →
                </Link>
              </div>
              <div className="space-y-2">
                {publicJourneys.map((j) => (
                  <Link
                    key={j.id}
                    href={`/journey/${j.id}`}
                    className="flex items-start justify-between gap-4 border border-zinc-800/60 hover:border-zinc-700/80 bg-zinc-900/20 hover:bg-zinc-900/40 rounded-xl px-4 py-4 transition-all group"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        {Array.from({ length: 5 }, (_, i) => i + 1).map((g) => (
                          <span
                            key={g}
                            className={`w-1.5 h-1.5 rounded-full ${g < j.currentGate ? 'bg-emerald-500' : g === j.currentGate ? 'bg-violet-500' : 'bg-zinc-800'}`}
                          />
                        ))}
                      </div>
                      <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
                        {j.title ?? `Journey ${j.id.slice(0, 8)}`}
                      </p>
                      {j.wedge && (
                        <p className="text-xs text-zinc-500 leading-relaxed line-clamp-1">{j.wedge}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-zinc-700 group-hover:text-zinc-500 transition-colors mt-0.5">↗</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
