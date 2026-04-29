'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  REACTIONS,
  type ReactionCounts,
  type ReactionType,
  getLocalReactions,
  saveLocalReaction,
  removeLocalReaction,
  recordView,
} from '@/lib/reactions'
import { ReactionPill } from '@/components/reaction-pill'

type FeedJourney = {
  id: string
  title: string | null
  createdAt: string
  viewCount: number
  currentGate: number
  status: string
  wedge: string
  persona: string
  reactionCounts: ReactionCounts
}

type PlatformStats = {
  ideasKilled: number
  completedSessions: number
  visionsFormed: number
  killRate: number | null
}

const BATCH = 6

function GateProgress({ current, total = 5 }: { current: number; total?: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }, (_, i) => i + 1).map((g) => (
        <span
          key={g}
          className={`w-1.5 h-1.5 rounded-full ${
            g < current ? 'bg-emerald-500' :
            g === current ? 'bg-violet-500' :
            'bg-zinc-800'
          }`}
        />
      ))}
    </div>
  )
}

function JourneyCard({
  journey,
  index,
  total,
  onView,
}: {
  journey: FeedJourney
  index: number
  total: number
  onView: (id: string) => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const hasTracked = useRef(false)
  const [counts, setCounts] = useState<ReactionCounts>(journey.reactionCounts)
  const [myReactions, setMyReactions] = useState<string[]>([])

  useEffect(() => {
    setMyReactions(getLocalReactions(journey.id))
  }, [journey.id])

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTracked.current) {
          hasTracked.current = true
          onView(journey.id)
        }
      },
      { threshold: 0.8 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [journey.id, onView])

  async function react(type: ReactionType) {
    if (myReactions.includes(type)) {
      removeLocalReaction(journey.id, type)
      setMyReactions((prev) => prev.filter((t) => t !== type))
      setCounts((prev) => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }))
      try {
        const res = await fetch(`/api/journey/${journey.id}/react`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type }),
        })
        const { counts: updated } = await res.json()
        if (updated) setCounts(updated)
      } catch {}
      return
    }
    saveLocalReaction(journey.id, type)
    setMyReactions((prev) => [...prev, type])
    setCounts((prev) => ({ ...prev, [type]: prev[type] + 1 }))
    try {
      const res = await fetch(`/api/journey/${journey.id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const { counts: updated } = await res.json()
      if (updated) setCounts(updated)
    } catch {
      removeLocalReaction(journey.id, type)
      setMyReactions((prev) => prev.filter((t) => t !== type))
      setCounts((prev) => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }))
    }
  }

  const totalReactions = counts.user + counts.investor + counts.builder

  return (
    <div
      ref={cardRef}
      className="h-[100dvh] scroll-snap-start shrink-0 flex flex-col bg-zinc-950 border-b border-zinc-800/40"
    >
      {/* Top bar */}
      <div
        className="shrink-0 flex items-center justify-between px-5 border-b border-zinc-800/40"
        style={{ paddingTop: 'max(16px, calc(16px + var(--safe-top)))', paddingBottom: '14px' }}
      >
        <Link href="/" className="text-sm font-semibold tracking-widest text-zinc-200 uppercase hover:text-white transition-colors">
          Kora
        </Link>
        <span className="text-[10px] font-mono text-zinc-600">{index + 1} / {total}</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 py-8 space-y-6 min-h-0 overflow-hidden">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <GateProgress current={journey.currentGate} />
            <span className="text-[10px] font-mono text-zinc-600">Gate {journey.currentGate}/5</span>
          </div>
          <p className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest">
            {new Date(journey.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 leading-snug">
            {journey.title ?? `Journey ${journey.id.slice(0, 8)}`}
          </h2>
        </div>

        {journey.wedge && (
          <blockquote className="text-base sm:text-lg text-zinc-300 leading-relaxed border-l-2 border-violet-700/60 pl-4">
            {journey.wedge}
          </blockquote>
        )}

        {journey.persona && (
          <p className="text-xs text-zinc-600 leading-relaxed">
            <span className="text-zinc-700 uppercase tracking-widest font-mono text-[9px] mr-2">For</span>
            {journey.persona}
          </p>
        )}

        <Link
          href={`/journey/${journey.id}`}
          className="self-start text-xs text-violet-400 hover:text-violet-300 transition-colors font-medium"
        >
          View full journey ↗
        </Link>
      </div>

      {/* Reaction bar */}
      <div
        className="shrink-0 border-t border-zinc-800/40 px-5"
        style={{ paddingBottom: 'max(20px, calc(20px + var(--safe-bottom)))', paddingTop: '14px' }}
      >
        <div className="flex items-center gap-1 flex-wrap">
          {REACTIONS.map(({ type, icon, label }) => (
            <ReactionPill
              key={type}
              icon={icon}
              label={label}
              count={counts[type]}
              reacted={myReactions.includes(type)}
              onReact={() => react(type)}
            />
          ))}
          <div className="ml-auto flex items-center gap-3">
            {totalReactions > 0 && (
              <span className="text-[11px] font-mono text-zinc-700">{totalReactions} signal{totalReactions !== 1 ? 's' : ''}</span>
            )}
            {journey.viewCount > 0 && (
              <span className="text-[11px] font-mono text-zinc-700">{journey.viewCount.toLocaleString()} view{journey.viewCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function EndCard({ stats }: { stats: PlatformStats | null }) {
  return (
    <div className="h-[100dvh] scroll-snap-start shrink-0 flex flex-col bg-zinc-950">
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center space-y-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold tracking-widest text-zinc-200 uppercase">Kora</p>
          <p className="text-xs text-zinc-600 max-w-xs leading-relaxed">
            You&apos;ve seen every public journey. Build yours.
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-6">
            {[
              { label: 'visions formed', value: stats.visionsFormed },
              { label: 'ideas killed', value: stats.ideasKilled },
              { label: 'filter rate', value: stats.killRate != null ? `${Math.round(stats.killRate)}%` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-1">
                <p className="text-xl font-bold text-zinc-100">{value}</p>
                <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest leading-snug">{label}</p>
              </div>
            ))}
          </div>
        )}

        <Link
          href="/"
          className="inline-flex items-center gap-2 min-h-[48px] bg-violet-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-violet-500 active:bg-violet-700 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] text-sm"
        >
          Start your journey →
        </Link>
      </div>

      <div
        className="shrink-0 px-6 flex items-center justify-between border-t border-zinc-800/40"
        style={{ paddingBottom: 'max(20px, calc(20px + var(--safe-bottom)))', paddingTop: '14px' }}
      >
        <p className="text-[10px] font-mono text-zinc-700">Built with Kora</p>
        <Link href="/my-journeys" className="text-[10px] font-mono text-zinc-700 hover:text-zinc-500 transition-colors">
          My Journeys →
        </Link>
      </div>
    </div>
  )
}

export default function ExplorePage() {
  const [journeys, setJourneys] = useState<FeedJourney[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const offsetRef = useRef(0)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/explore?offset=${offsetRef.current}&limit=${BATCH}`)
      const data = await res.json() as { journeys: FeedJourney[]; hasMore: boolean }
      setJourneys((prev) => [...prev, ...data.journeys])
      setHasMore(data.hasMore)
      offsetRef.current += data.journeys.length
    } catch {}
    setLoadingMore(false)
  }, [loadingMore])

  useEffect(() => {
    async function init() {
      await loadMore()
      setLoading(false)
      fetch('/api/stats').then((r) => r.json()).then(setStats).catch(() => {})
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore) loadMore()
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loadMore])

  function handleView(id: string) {
    if (recordView(id)) {
      fetch(`/api/journey/${id}/view`, { method: 'POST' }).catch(() => {})
    }
  }

  if (loading) {
    return (
      <div className="h-[100dvh] bg-zinc-950 flex items-center justify-center gap-2 text-zinc-600">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 animate-pulse" />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  if (journeys.length === 0) {
    return (
      <div className="h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center px-8 text-center space-y-5">
        <p className="text-sm font-semibold tracking-widest text-zinc-200 uppercase">Kora</p>
        <p className="text-sm text-zinc-500">No public journeys yet.</p>
        <p className="text-xs text-zinc-700 max-w-xs leading-relaxed">
          Complete a journey and enable public sharing to appear here.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 min-h-[48px] bg-violet-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-violet-500 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] text-sm"
        >
          Start your journey →
        </Link>
      </div>
    )
  }

  return (
    <div
      className="h-[100dvh] overflow-y-scroll scroll-smooth"
      style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      {journeys.map((journey, i) => (
        <JourneyCard
          key={journey.id}
          journey={journey}
          index={i}
          total={journeys.length}
          onView={handleView}
        />
      ))}

      {hasMore && (
        <div ref={sentinelRef} className="h-[100dvh] scroll-snap-start shrink-0 flex items-center justify-center bg-zinc-950">
          {loadingMore && <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 animate-pulse" />}
        </div>
      )}

      {!hasMore && <EndCard stats={stats} />}
    </div>
  )
}
