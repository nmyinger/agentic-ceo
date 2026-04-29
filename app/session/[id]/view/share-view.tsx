'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Prose } from '@/components/prose'
import { parseWedge, parseUserPersona } from '@/lib/utils'
import { loadSessions } from '@/lib/sessions'
import {
  REACTIONS,
  ReactionCounts,
  ReactionType,
  getLocalReactions,
  saveLocalReaction,
  removeLocalReaction,
  recordView,
} from '@/lib/reactions'
import { ReactionPill } from '@/components/reaction-pill'

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function XIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.745l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

type PublicVision = {
  id: string
  idea: string | null
  createdAt: string
  viewCount: number
  wedge: string
  reactionCounts: ReactionCounts
}

export function ShareView({
  sessionId,
  idea,
  createdAt,
  vision,
  parkingLot,
  viewCount: initialViewCount,
  reactionCounts: initialCounts,
  listed: initialListed,
}: {
  sessionId: string
  idea: string | null
  createdAt: string
  vision: string
  parkingLot: string
  viewCount: number
  reactionCounts: ReactionCounts
  listed: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'vision' | 'parking'>('vision')
  const [viewCount, setViewCount] = useState(initialViewCount)
  const [counts, setCounts] = useState<ReactionCounts>(initialCounts)
  const [myReactions, setMyReactions] = useState<string[]>([])
  const [listed, setListed] = useState(initialListed)
  const [listingLoading, setListingLoading] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  // Community feed
  const [feed, setFeed] = useState<PublicVision[]>([])
  const [hasMore, setHasMore] = useState(true)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)
  const hasMoreRef = useRef(true)
  const feedLengthRef = useRef(0)

  const hasContent = !!(vision || parkingLot)
  const wedge = parseWedge(vision)
  const persona = parseUserPersona(vision)

  useEffect(() => {
    setIsOwner(loadSessions().some((s) => s.id === sessionId))
    setMyReactions(getLocalReactions(sessionId))
    const isNew = recordView(sessionId)
    if (!isNew) return
    fetch(`/api/session/${sessionId}/view`, { method: 'POST' })
      .then(() => setViewCount((c) => c + 1))
      .catch(() => {})
  }, [sessionId])

  // Infinite scroll — fires as sentinel enters the viewport
  useEffect(() => {
    async function loadMore() {
      if (loadingRef.current || !hasMoreRef.current) return
      loadingRef.current = true
      try {
        const offset = feedLengthRef.current
        const res = await fetch(`/api/visions?limit=6&offset=${offset}&exclude=${sessionId}`)
        const { visions: next = [] } = await res.json() as { visions: PublicVision[] }
        setFeed((prev) => {
          const combined = [...prev, ...next]
          feedLengthRef.current = combined.length
          return combined
        })
        if (next.length < 6) {
          hasMoreRef.current = false
          setHasMore(false)
        }
      } finally {
        loadingRef.current = false
      }
    }
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '300px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [sessionId])

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function shareOnX() {
    const text = wedge
      ? `${idea ? idea + ': ' : ''}${wedge} — built with @KoraAI`
      : `Check out this vision built with @KoraAI`
    const pageUrl = window.location.href
    const xUrl = `https://x.com/intent/post?text=${encodeURIComponent(text + '\n' + pageUrl)}`
    if (navigator.maxTouchPoints > 0 && typeof navigator.share === 'function') {
      navigator.share({ text, url: pageUrl }).catch((err) => {
        if ((err as Error).name !== 'AbortError') window.open(xUrl, '_blank', 'noopener,noreferrer')
      })
      return
    }
    window.open(xUrl, '_blank', 'noopener,noreferrer')
  }

  async function react(type: ReactionType) {
    if (myReactions.includes(type)) {
      // Unreact — trust server count as source of truth
      removeLocalReaction(sessionId, type)
      setMyReactions((prev) => prev.filter((t) => t !== type))
      setCounts((prev) => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }))
      try {
        const res = await fetch(`/api/session/${sessionId}/react`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type }),
        })
        const { counts: updated } = await res.json()
        if (updated) setCounts(updated)
      } catch {}
      return
    }
    // React — optimistic, then sync from server
    saveLocalReaction(sessionId, type)
    setMyReactions((prev) => [...prev, type])
    setCounts((prev) => ({ ...prev, [type]: prev[type] + 1 }))
    try {
      const res = await fetch(`/api/session/${sessionId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const { counts: updated } = await res.json()
      if (updated) setCounts(updated)
    } catch {
      // Revert optimistic update on network error
      removeLocalReaction(sessionId, type)
      setMyReactions((prev) => prev.filter((t) => t !== type))
      setCounts((prev) => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }))
    }
  }

  async function toggleListed() {
    setListingLoading(true)
    const next = !listed
    try {
      await fetch(`/api/session/${sessionId}/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listed: next }),
      })
      setListed(next)
    } catch {}
    setListingLoading(false)
  }

  function downloadAll() {
    const parts = [
      vision && `# Vision Document\n\n${vision}`,
      parkingLot && `\n---\n\n${parkingLot}`,
    ].filter(Boolean)
    if (parts.length) download('kora-session.md', parts.join(''))
  }

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen flex flex-col">

      {/* ── Minimal nav ─────────────────────────────────────────────── */}
      <nav className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-zinc-900">
        <Link href="/" className="text-sm font-bold tracking-widest text-white uppercase">
          Kora
        </Link>
        <Link
          href={`/session/${sessionId}`}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Open session →
        </Link>
      </nav>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-5 pt-8 pb-32 space-y-8">

        {/* Header */}
        <div className="space-y-3">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
            {new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            {viewCount > 0 && ` · ${viewCount.toLocaleString()} ${viewCount === 1 ? 'view' : 'views'}`}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-50 leading-tight">
            {idea ?? 'Vision Document'}
          </h1>

          {/* Gallery toggle — visible to owner immediately on load */}
          {isOwner && (
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={toggleListed}
                disabled={listingLoading}
                className={`relative inline-flex h-5 w-9 rounded-full transition-colors duration-200 shrink-0 ${listed ? 'bg-violet-600' : 'bg-zinc-800'} ${listingLoading ? 'opacity-50 cursor-wait' : ''}`}
                role="switch"
                aria-checked={listed}
              >
                <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${listed ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className={`text-xs ${listed ? 'text-violet-400' : 'text-zinc-600'}`}>
                {listed ? 'Listed in public gallery' : 'Add to public gallery'}
              </span>
              {listed && (
                <Link href="/visions" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Browse →</Link>
              )}
            </div>
          )}
        </div>

        {!hasContent ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-sm text-zinc-500">No vision yet.</p>
            <Link href={`/session/${sessionId}`} className="text-sm text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors">
              Continue the session →
            </Link>
          </div>
        ) : (
          <>
            {/* Tabs */}
            {parkingLot && (
              <div className="flex gap-1 border-b border-zinc-900">
                {(['vision', 'parking'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={[
                      'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                      activeTab === tab
                        ? tab === 'vision' ? 'text-white border-white' : 'text-amber-400 border-amber-400'
                        : 'text-zinc-600 border-transparent hover:text-zinc-400',
                    ].join(' ')}
                  >
                    {tab === 'vision' ? 'Vision' : 'Deferred Ideas'}
                  </button>
                ))}
              </div>
            )}

            {/* Document */}
            <div>
              {activeTab === 'vision' ? (
                vision
                  ? <Prose variant="doc">{vision}</Prose>
                  : <p className="text-sm text-zinc-600">Vision not yet generated.</p>
              ) : (
                <Prose variant="doc">{parkingLot}</Prose>
              )}
            </div>

            {activeTab === 'vision' && vision && (
              <>
                {/* Persona CTA */}
                {persona && (
                  <div className="border-t border-zinc-900 pt-6 space-y-3">
                    <p className="text-xs text-zinc-600 uppercase tracking-widest font-mono">This vision is built for</p>
                    <p className="text-base text-zinc-300 leading-relaxed">{persona}</p>
                    <Link
                      href="/"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      Does this sound like you? Start your own →
                    </Link>
                  </div>
                )}

                {/* Owner exports */}
                {isOwner && (
                  <div className="flex items-center gap-4 text-xs text-zinc-700 pt-1">
                    <span>Export:</span>
                    <button onClick={() => download('vision.md', vision)} className="hover:text-zinc-400 transition-colors">vision.md</button>
                    {parkingLot && <button onClick={() => download('parking_lot.md', parkingLot)} className="hover:text-zinc-400 transition-colors">parking_lot.md</button>}
                    {parkingLot && <button onClick={downloadAll} className="hover:text-zinc-400 transition-colors">all.md</button>}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Footer */}
        <div className="border-t border-zinc-900 pt-8">
          <Link
            href="/"
            className="block text-center py-3 px-6 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-semibold text-sm transition-all shadow-[0_0_24px_rgba(139,92,246,0.3)] hover:shadow-[0_0_32px_rgba(139,92,246,0.45)]"
          >
            Build your own vision with Kora →
          </Link>
        </div>

      </main>

      {/* ── Community feed (keep scrolling past the footer) ──────────── */}
      {(feed.length > 0 || hasMore) && (
        <section className="max-w-2xl w-full mx-auto px-5 pb-32">
          <div className="border-t border-zinc-900 pt-10 mb-2">
            <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">More from the community</p>
          </div>
          <div>
            {feed.map((v) => {
              const totalReactions = v.reactionCounts.user + v.reactionCounts.investor + v.reactionCounts.builder
              return (
                <Link
                  key={v.id}
                  href={`/session/${v.id}/view`}
                  className="block group py-5 border-b border-zinc-900 hover:bg-zinc-900/20 -mx-5 px-5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <p className="text-[10px] font-mono text-zinc-700">
                        {new Date(v.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {totalReactions > 0 && ` · ${totalReactions} signal${totalReactions === 1 ? '' : 's'}`}
                        {v.viewCount > 0 && ` · ${v.viewCount} view${v.viewCount === 1 ? '' : 's'}`}
                      </p>
                      <p className="text-base font-semibold text-zinc-100 group-hover:text-white transition-colors truncate">
                        {v.idea ?? 'Vision Document'}
                      </p>
                      {v.wedge && (
                        <p className="text-sm text-zinc-500 leading-relaxed line-clamp-2">{v.wedge}</p>
                      )}
                    </div>
                    <span className="text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0 mt-1 text-xs">→</span>
                  </div>
                </Link>
              )
            })}
          </div>
          <div ref={sentinelRef} className="pt-8 pb-4 flex justify-center">
            {hasMore ? (
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1 h-1 rounded-full bg-zinc-700 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-700">You&apos;ve seen it all.</p>
            )}
          </div>
        </section>
      )}

      {/* ── Sticky bottom action bar ─────────────────────────────────── */}
      <div
        className="fixed bottom-0 inset-x-0 z-20 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-900"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-2xl mx-auto px-5 pt-3 flex items-center justify-between">

          {/* Reaction pills */}
          <div className="flex items-center gap-1.5">
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
          </div>

          {/* Share actions */}
          <div className="flex items-center gap-2">
            {wedge && (
              <button
                onClick={shareOnX}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all active:scale-95"
              >
                <XIcon size={12} />
                <span>Share</span>
              </button>
            )}
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all active:scale-95"
            >
              <LinkIcon />
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

        </div>
      </div>

    </div>
  )
}
