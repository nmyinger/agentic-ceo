'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  REACTIONS,
  ReactionCounts,
  ReactionType,
  getLocalReactions,
  saveLocalReaction,
  recordView,
} from '@/lib/reactions'
import { ReactionPill } from '@/components/reaction-pill'

type FeedVision = {
  id: string
  idea: string | null
  createdAt: string
  viewCount: number
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

// ─── Single vision card ───────────────────────────────────────────────────────

function VisionCard({
  vision,
  index,
  total,
  onView,
}: {
  vision: FeedVision
  index: number
  total: number
  onView: (id: string) => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const hasTracked = useRef(false)
  const [counts, setCounts] = useState<ReactionCounts>(vision.reactionCounts)
  const [myReactions, setMyReactions] = useState<string[]>([])

  // Load persisted reactions on mount
  useEffect(() => {
    setMyReactions(getLocalReactions(vision.id))
  }, [vision.id])

  // Track view when card is ≥80% visible
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTracked.current) {
          hasTracked.current = true
          onView(vision.id)
        }
      },
      { threshold: 0.8 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [vision.id, onView])

  async function react(type: ReactionType) {
    if (myReactions.includes(type)) return
    // Optimistic update
    setCounts((prev) => ({ ...prev, [type]: prev[type] + 1 }))
    setMyReactions((prev) => [...prev, type])
    saveLocalReaction(vision.id, type)
    await fetch(`/api/session/${vision.id}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    }).catch(() => {})
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
        <Link
          href="/"
          className="text-sm font-semibold tracking-widest text-zinc-200 uppercase hover:text-white transition-colors"
        >
          Kora
        </Link>
        <span className="text-[10px] font-mono text-zinc-600">{index + 1} / {total}</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 py-8 space-y-6 min-h-0 overflow-hidden">
        {/* Title */}
        <div className="space-y-1">
          <p className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest">
            {new Date(vision.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 leading-snug">
            {vision.idea ?? `Vision ${vision.id.slice(0, 8)}`}
          </h2>
        </div>

        {/* Wedge — the hero */}
        {vision.wedge && (
          <blockquote className="text-base sm:text-lg text-zinc-300 leading-relaxed border-l-2 border-violet-700/60 pl-4">
            {vision.wedge}
          </blockquote>
        )}

        {/* Persona */}
        {vision.persona && (
          <p className="text-xs text-zinc-600 leading-relaxed">
            <span className="text-zinc-700 uppercase tracking-widest font-mono text-[9px] mr-2">For</span>
            {vision.persona}
          </p>
        )}

        {/* Full vision link */}
        <Link
          href={`/session/${vision.id}/view`}
          className="self-start text-xs text-violet-400 hover:text-violet-300 transition-colors font-medium"
        >
          View full vision ↗
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

          {/* Stats */}
          <div className="ml-auto flex items-center gap-3">
            {totalReactions > 0 && (
              <span className="text-[11px] font-mono text-zinc-700">{totalReactions} signal{totalReactions !== 1 ? 's' : ''}</span>
            )}
            {vision.viewCount > 0 && (
              <span className="text-[11px] font-mono text-zinc-700">{vision.viewCount.toLocaleString()} view{vision.viewCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── End-of-feed card ─────────────────────────────────────────────────────────

function EndCard({ stats }: { stats: PlatformStats | null }) {
  return (
    <div
      className="h-[100dvh] scroll-snap-start shrink-0 flex flex-col bg-zinc-950"
    >
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center space-y-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold tracking-widest text-zinc-200 uppercase">Kora</p>
          <p className="text-xs text-zinc-600 max-w-xs leading-relaxed">
            You&apos;ve seen every public vision. Build yours.
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
          className="inline-flex items-center gap-2 min-h-[48px] bg-violet-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-violet-500 active:bg-violet-700 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_28px_rgba(139,92,246,0.45)] text-sm"
        >
          Start your session →
        </Link>
      </div>

      <div
        className="shrink-0 px-6 flex items-center justify-between border-t border-zinc-800/40"
        style={{ paddingBottom: 'max(20px, calc(20px + var(--safe-bottom)))', paddingTop: '14px' }}
      >
        <p className="text-[10px] font-mono text-zinc-700">Built with Kora</p>
        <Link href="/sessions" className="text-[10px] font-mono text-zinc-700 hover:text-zinc-500 transition-colors">
          Your sessions →
        </Link>
      </div>
    </div>
  )
}

// ─── Main feed ────────────────────────────────────────────────────────────────

export default function VisionsPage() {
  const [visions, setVisions] = useState<FeedVision[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const offsetRef = useRef(0)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/visions?offset=${offsetRef.current}&limit=${BATCH}`)
      const data = await res.json() as { visions: FeedVision[]; hasMore: boolean }
      setVisions((prev) => [...prev, ...data.visions])
      setHasMore(data.hasMore)
      offsetRef.current += data.visions.length
    } catch {}
    setLoadingMore(false)
  }, [loadingMore])

  // Initial load
  useEffect(() => {
    async function init() {
      await loadMore()
      setLoading(false)
      // Fetch stats for end card
      fetch('/api/stats')
        .then((r) => r.json())
        .then(setStats)
        .catch(() => {})
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loadMore])

  function handleView(id: string) {
    if (recordView(id)) {
      fetch(`/api/session/${id}/view`, { method: 'POST' }).catch(() => {})
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

  if (visions.length === 0) {
    return (
      <div className="h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center px-8 text-center space-y-5">
        <p className="text-sm font-semibold tracking-widest text-zinc-200 uppercase">Kora</p>
        <p className="text-sm text-zinc-500">No public visions yet.</p>
        <p className="text-xs text-zinc-700 max-w-xs leading-relaxed">
          Complete a Gate 1 session and enable &quot;Public gallery&quot; on your vision to appear here.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 min-h-[48px] bg-violet-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-violet-500 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] text-sm"
        >
          Start your session →
        </Link>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="h-[100dvh] overflow-y-scroll scroll-smooth"
      style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      {visions.map((vision, i) => (
        <VisionCard
          key={vision.id}
          vision={vision}
          index={i}
          total={visions.length}
          onView={handleView}
        />
      ))}

      {/* Infinite scroll trigger — loads next batch when near visible */}
      {hasMore && (
        <div ref={sentinelRef} className="h-[100dvh] scroll-snap-start shrink-0 flex items-center justify-center bg-zinc-950">
          {loadingMore && (
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 animate-pulse" />
          )}
        </div>
      )}

      {/* End of feed */}
      {!hasMore && <EndCard stats={stats} />}
    </div>
  )
}
