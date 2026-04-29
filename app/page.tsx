'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { saveSession, loadSessions, type StoredSession } from '@/lib/sessions'

type Stats = { ideasKilled: number; completedSessions: number; killRate: number | null; visionsFormed: number }
type RecentSession = StoredSession & { title?: string }

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [displayCount, setDisplayCount] = useState(0)
  const [displayVisions, setDisplayVisions] = useState(0)
  const [barWidth, setBarWidth] = useState(0)
  const storyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = loadSessions().slice(0, 3)
    setRecentSessions(stored)
    if (stored.length > 0) {
      fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: stored.map((s) => s.id) }),
      })
        .then((r) => r.json())
        .then(({ sessions }: { sessions: { id: string; idea: string | null }[] }) => {
          setRecentSessions(stored.map((s) => ({
            ...s,
            title: sessions.find((ss) => ss.id === s.id)?.idea ?? undefined,
          })))
        })
        .catch(() => {})
    }
    fetch('/api/stats')
      .then((r) => r.json())
      .then((s: Stats) => setStats(s))
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
      const res = await fetch('/api/session', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to create session')
      const { id } = await res.json()
      saveSession(id)
      router.push(`/session/${id}`)
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
        <span className="text-sm font-semibold tracking-widest text-zinc-200 uppercase">
          Kora
        </span>
        <div className="flex items-center gap-4">
          {recentSessions.length > 0 && (
            <Link
              href="/sessions"
              className="text-xs font-mono text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              History ({recentSessions.length})
            </Link>
          )}
          <span className="hidden sm:block text-xs font-mono text-zinc-700">Gate 1 — Vision Architect</span>
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
              <span className="text-xs text-zinc-400 font-mono">Vision Architect · Ready</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.08] text-gradient-hero">
              Turn your idea into<br />a focused vision.
            </h1>

            <p className="text-zinc-400 text-base leading-relaxed max-w-md">
              Answer eight hard questions. Walk away with a one-page vision
              document and a clear record of every scope decision made along the way.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={start}
              disabled={loading}
              className="w-full sm:w-auto inline-flex justify-center items-center gap-2.5 min-h-[52px] bg-violet-600 text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-violet-500 active:bg-violet-700 transition-all shadow-[0_0_24px_rgba(139,92,246,0.35)] hover:shadow-[0_0_32px_rgba(139,92,246,0.5)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none text-sm"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-violet-300/50 border-t-white rounded-full animate-spin" />
                  Starting session...
                </>
              ) : (
                <>
                  Begin Session
                  <span className="text-violet-300">→</span>
                </>
              )}
            </button>
            {error && (
              <p className="text-xs text-red-400 font-mono">
                Couldn&apos;t start session — please try again.
              </p>
            )}
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-zinc-800/40 rounded-xl overflow-hidden border border-zinc-800/60">
            {/* A: Kill counter */}
            <div className="bg-zinc-950 px-5 py-4 sm:px-6 sm:py-5 space-y-1.5 sm:space-y-2">
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Ideas killed</p>
              <p className="text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-zinc-100">
                {stats
                  ? stats.ideasKilled === 0
                    ? '0'
                    : displayCount.toLocaleString()
                  : '—'}
              </p>
              <p className="text-sm text-zinc-500 leading-snug">
                distractions buried before they could ship
              </p>
            </div>

            {/* B: Visions formed */}
            <div className="bg-zinc-950 px-5 py-4 sm:px-6 sm:py-5 space-y-1.5 sm:space-y-2">
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Visions formed</p>
              <p className="text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-emerald-400">
                {stats
                  ? stats.visionsFormed === 0
                    ? '0'
                    : displayVisions.toLocaleString()
                  : '—'}
              </p>
              <p className="text-sm text-zinc-500 leading-snug">
                full vision documents completed
              </p>
            </div>

            {/* C: Signal-to-noise bar */}
            <div className="bg-zinc-950 px-5 py-4 sm:px-6 sm:py-5 space-y-2 sm:space-y-3">
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Filter rate</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-zinc-100">
                  {stats
                    ? stats.killRate != null
                      ? `${stats.killRate}%`
                      : '—'
                    : '—'}
                </p>
                <p className="text-xs font-mono text-zinc-500">of ideas raised</p>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(139,92,246,0.6)]"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <p className="text-sm text-zinc-500 leading-snug">
                cleared in-session before becoming scope
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 border-t border-zinc-800/60 pt-8 sm:pt-10">
            {[
              {
                label: 'Output 1',
                title: 'Vision Document',
                desc: 'One page. Wedge sentence, customer, pain point, and why now.',
              },
              {
                label: 'Output 2',
                title: 'Deferred Ideas',
                desc: 'Every out-of-scope request, logged and saved — not discarded.',
              },
              {
                label: 'Gate 1 of 5',
                title: 'Focus First',
                desc: 'Business model, MVP scope, and launch planning follow in sequence.',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="space-y-2 p-3 -mx-3 rounded-lg hover:bg-violet-950/20 hover:border hover:border-violet-800/30 transition-all group"
              >
                <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
                  {item.label}
                </p>
                <p className="text-sm font-semibold text-zinc-200 group-hover:text-violet-200 transition-colors">
                  {item.title}
                </p>
                <p className="text-xs text-zinc-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Recent sessions */}
          {recentSessions.length > 0 && (
            <div className="border-t border-zinc-800/60 pt-8 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Recent sessions</p>
                <Link href="/sessions" className="text-[10px] font-mono text-zinc-700 hover:text-violet-400 transition-colors">
                  View all →
                </Link>
              </div>
              <div className="space-y-2">
                {recentSessions.map((s) => (
                  <Link
                    key={s.id}
                    href={`/session/${s.id}`}
                    className="flex items-center justify-between min-h-[44px] group border border-zinc-800/60 hover:border-violet-800/50 hover:bg-violet-950/15 rounded-lg px-3.5 py-2.5 transition-all"
                  >
                    <span className="text-xs text-zinc-300 group-hover:text-violet-200 transition-colors truncate">
                      {s.title ?? s.id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] text-zinc-700 shrink-0">
                      {new Date(s.savedAt).toLocaleDateString()}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Scroll indicator */}
          <div className="flex justify-center pt-2">
            <button
              onClick={() => storyRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="flex flex-col items-center gap-1.5 min-h-[44px] justify-center text-zinc-700 hover:text-zinc-500 transition-colors"
            >
              <span className="text-[10px] font-mono uppercase tracking-widest">See why it matters</span>
              <span className="text-base animate-bounce">↓</span>
            </button>
          </div>
        </div>
      </section>

      {/* Story section */}
      <section ref={storyRef} className="border-t border-zinc-800/50 px-4 sm:px-6 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto space-y-16 sm:space-y-24">

          {/* Without KORA */}
          <div className="space-y-8 sm:space-y-10">
            <div className="space-y-3">
              <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">The usual story</p>
              <h2 className="text-xl sm:text-2xl font-bold text-zinc-200 leading-snug">
                Ideas don&apos;t die from bad execution.<br />
                They die from entropy.
              </h2>
              <p className="text-sm text-zinc-500 max-w-lg leading-relaxed">
                Every founder starts with a clear idea. Within weeks it&apos;s everywhere — feature requests, pivots, what-ifs. By month three the original insight is buried under scope you never needed.
              </p>
            </div>

            {/* Time axis labels */}
            <div>
              <div className="flex justify-between text-[9px] font-mono text-zinc-700 uppercase tracking-wider mb-2 pl-[6%] pr-[4%]">
                <span>Week 1</span>
                <span>Week 3</span>
                <span>Month 2</span>
                <span>Month 4+</span>
              </div>

              {/* Entropy SVG */}
              <svg viewBox="0 0 560 210" className="w-full" xmlns="http://www.w3.org/2000/svg">
                <circle cx="32" cy="105" r="5" fill="#a1a1aa" />
                <text x="32" y="93" fill="#a1a1aa" fontSize="8.5" fontFamily="monospace" textAnchor="middle">Idea</text>

                <path d="M 37 105 L 135 105" stroke="#71717a" strokeWidth="2" fill="none" />

                <circle cx="135" cy="105" r="3" fill="#52525b" />

                <path d="M 138 105 L 240 52" stroke="#52525b" strokeWidth="1.5" fill="none" />
                <path d="M 138 105 L 240 105" stroke="#52525b" strokeWidth="1.5" fill="none" />
                <path d="M 138 105 L 240 158" stroke="#52525b" strokeWidth="1.5" fill="none" />

                <text x="148" y="62" fill="#52525b" fontSize="8" fontFamily="monospace">&ldquo;What about mobile?&rdquo;</text>
                <text x="148" y="100" fill="#52525b" fontSize="8" fontFamily="monospace">&ldquo;We need analytics&rdquo;</text>
                <text x="148" y="168" fill="#52525b" fontSize="8" fontFamily="monospace">&ldquo;Maybe pivot to B2B&rdquo;</text>

                <path d="M 240 52 L 355 25" stroke="#3f3f46" strokeWidth="1" fill="none" strokeDasharray="4,3" />
                <path d="M 240 52 L 355 65" stroke="#3f3f46" strokeWidth="1" fill="none" strokeDasharray="4,3" />
                <path d="M 240 105 L 355 88" stroke="#3f3f46" strokeWidth="1" fill="none" strokeDasharray="4,3" />
                <path d="M 240 105 L 355 118" stroke="#3f3f46" strokeWidth="1" fill="none" strokeDasharray="4,3" />
                <path d="M 240 158 L 355 140" stroke="#3f3f46" strokeWidth="1" fill="none" strokeDasharray="4,3" />
                <path d="M 240 158 L 355 175" stroke="#3f3f46" strokeWidth="1" fill="none" strokeDasharray="4,3" />

                <path d="M 355 25 L 455 14" stroke="#27272a" strokeWidth="0.8" fill="none" strokeDasharray="3,4" />
                <path d="M 355 25 L 455 34" stroke="#27272a" strokeWidth="0.8" fill="none" strokeDasharray="3,4" />
                <path d="M 355 65 L 455 54" stroke="#27272a" strokeWidth="0.8" fill="none" strokeDasharray="3,4" />
                <path d="M 355 65 L 455 74" stroke="#27272a" strokeWidth="0.8" fill="none" strokeDasharray="3,4" />
                <path d="M 355 88 L 455 80" stroke="#27272a" strokeWidth="0.8" fill="none" strokeDasharray="3,4" />
                <path d="M 355 88 L 455 95" stroke="#27272a" strokeWidth="0.8" fill="none" strokeDasharray="3,4" />
                <path d="M 355 118 L 455 110" stroke="#27272a" strokeWidth="0.8" fill="none" strokeDasharray="3,4" />
                <path d="M 355 118 L 455 125" stroke="#27272a" strokeWidth="0.8" fill="none" strokeDasharray="3,4" />
                <path d="M 355 140 L 455 133" stroke="#27272a" strokeWidth="0.8" fill="none" strokeDasharray="3,4" />
                <path d="M 355 140 L 455 148" stroke="#27272a" strokeWidth="0.8" fill="none" strokeDasharray="3,4" />
                <path d="M 355 175 L 455 166" stroke="#27272a" strokeWidth="0.8" fill="none" strokeDasharray="3,4" />
                <path d="M 355 175 L 455 182" stroke="#27272a" strokeWidth="0.8" fill="none" strokeDasharray="3,4" />

                {[14, 34, 54, 74, 80, 95, 110, 125, 133, 148, 166, 182].map((y, i) => (
                  <g key={i}>
                    <line x1="451" y1={y - 3.5} x2="459" y2={y + 3.5} stroke="#27272a" strokeWidth="0.9" />
                    <line x1="459" y1={y - 3.5} x2="451" y2={y + 3.5} stroke="#27272a" strokeWidth="0.9" />
                  </g>
                ))}
              </svg>

              {/* Stage callouts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                {[
                  { label: 'The spark', desc: 'One clear insight', dim: false },
                  { label: 'Scope creep', desc: '"But what if we also…"', dim: true },
                  { label: 'Multiple pivots', desc: 'Direction lost', dim: true },
                  { label: 'Stalled', desc: 'Buried in a doc', dim: true },
                ].map((s, i) => (
                  <div key={i} className="space-y-0.5">
                    <p className={`text-[10px] font-semibold ${i === 0 ? 'text-zinc-400' : i === 1 ? 'text-zinc-600' : 'text-zinc-700'}`}>{s.label}</p>
                    <p className={`text-[10px] ${i === 0 ? 'text-zinc-600' : 'text-zinc-800'} leading-relaxed`}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-5">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-zinc-800" />
            <div className="flex items-center gap-2 border border-violet-800/50 bg-violet-950/20 rounded-full px-4 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              <span className="text-[11px] font-mono text-violet-300">KORA changes this</span>
            </div>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-zinc-800" />
          </div>

          {/* With KORA */}
          <div className="space-y-8 sm:space-y-10">
            <div className="space-y-3">
              <p className="text-[10px] font-mono text-violet-500 uppercase tracking-widest">With KORA</p>
              <h2 className="text-xl sm:text-2xl font-bold text-zinc-200 leading-snug">
                Same idea. Eight questions.<br />
                One page you can act on.
              </h2>
              <p className="text-sm text-zinc-500 max-w-lg leading-relaxed">
                KORA doesn&apos;t stop you from thinking — it captures everything and decides what belongs in v1. Out-of-scope ideas are saved, not lost. What emerges is a single, defensible vision.
              </p>
            </div>

            {/* KORA convergence SVG */}
            <div>
              <div className="flex justify-between text-[9px] font-mono text-zinc-700 uppercase tracking-wider mb-2">
                <span>Everything you&apos;re thinking</span>
                <span>The session</span>
                <span>The output</span>
              </div>

              <svg viewBox="0 0 560 190" className="w-full" xmlns="http://www.w3.org/2000/svg">
                {[28, 62, 95, 128, 162].map((y, i) => (
                  <circle key={i} cx="14" cy={y} r="3" fill="#52525b" />
                ))}

                <path d="M 17 28 L 225 95" stroke="#3f3f46" strokeWidth="1.2" fill="none" strokeDasharray="4,3" />
                <path d="M 17 62 L 225 95" stroke="#3f3f46" strokeWidth="1.2" fill="none" strokeDasharray="4,3" />
                <path d="M 17 95 L 225 95" stroke="#52525b" strokeWidth="1.5" fill="none" strokeDasharray="4,3" />
                <path d="M 17 128 L 225 95" stroke="#3f3f46" strokeWidth="1.2" fill="none" strokeDasharray="4,3" />
                <path d="M 17 162 L 225 95" stroke="#3f3f46" strokeWidth="1.2" fill="none" strokeDasharray="4,3" />

                <text x="22" y="31" fill="#71717a" fontSize="8" fontFamily="monospace">Raw idea</text>
                <text x="22" y="65" fill="#71717a" fontSize="8" fontFamily="monospace">Feature wish list</text>
                <text x="22" y="98" fill="#71717a" fontSize="8" fontFamily="monospace">Scope questions</text>
                <text x="22" y="131" fill="#71717a" fontSize="8" fontFamily="monospace">Customer hunches</text>
                <text x="22" y="165" fill="#71717a" fontSize="8" fontFamily="monospace">Market intuitions</text>

                {/* KORA box — violet */}
                <rect x="215" y="73" width="48" height="44" rx="5" fill="#1e1035" stroke="#7c3aed" strokeWidth="1.5" />
                <text x="239" y="91" textAnchor="middle" fill="#a78bfa" fontSize="8.5" fontFamily="monospace" fontWeight="600">KORA</text>
                <text x="239" y="106" textAnchor="middle" fill="#6d28d9" fontSize="7.5" fontFamily="monospace">8 questions</text>

                {/* Vision doc output — bold, solid */}
                <path d="M 263 88 L 505 55" stroke="#e4e4e7" strokeWidth="2.5" fill="none" />
                <circle cx="508" cy="55" r="6" fill="#e4e4e7" />
                <text x="520" y="59" fill="#e4e4e7" fontSize="9" fontFamily="monospace">Vision doc</text>

                {/* Deferred output — muted, dashed */}
                <path d="M 263 102 L 390 138 L 505 138" stroke="#3f3f46" strokeWidth="1.2" fill="none" strokeDasharray="4,3" />
                <circle cx="505" cy="138" r="4" fill="#3f3f46" />
                <text x="515" y="141" fill="#52525b" fontSize="9" fontFamily="monospace">Deferred ideas</text>
              </svg>

              {/* Result cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div className="border border-violet-800/30 bg-violet-950/10 rounded-lg p-4 space-y-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-200 block" />
                  <p className="text-xs font-semibold text-zinc-200">Vision Document</p>
                  <p className="text-[11px] text-zinc-600 leading-relaxed">
                    One page. Wedge sentence, target customer, pain point, and why now. Ready to share in 90 minutes.
                  </p>
                </div>
                <div className="border border-zinc-800/60 rounded-lg p-4 space-y-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 block" />
                  <p className="text-xs font-semibold text-zinc-500">Deferred Ideas</p>
                  <p className="text-[11px] text-zinc-700 leading-relaxed">
                    Every out-of-scope thought saved and logged. Nothing lost — just sequenced for later gates.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="flex flex-col items-center gap-5 pt-4 pb-2">
            <div className="h-px w-full bg-zinc-800/60" />
            <p className="text-center text-sm text-zinc-500 max-w-sm">
              The session takes 60–90 minutes. You&apos;ll leave with a document you can act on today.
            </p>
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={start}
                disabled={loading}
                className="w-full sm:w-auto inline-flex justify-center items-center gap-2.5 min-h-[52px] bg-violet-600 text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-violet-500 active:bg-violet-700 transition-all shadow-[0_0_24px_rgba(139,92,246,0.35)] hover:shadow-[0_0_32px_rgba(139,92,246,0.5)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none text-sm"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-violet-300/50 border-t-white rounded-full animate-spin" />
                    Starting session...
                  </>
                ) : (
                  <>
                    Begin Session
                    <span className="text-violet-300">→</span>
                  </>
                )}
              </button>
              {error && (
                <p className="text-xs text-red-400 font-mono">
                  Couldn&apos;t start session — please try again.
                </p>
              )}
            </div>
          </div>

        </div>
      </section>
    </main>
  )
}
