'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Prose } from '@/components/prose'
import { parseWedge, parseUserPersona } from '@/lib/utils'
import { loadSessions } from '@/lib/sessions'

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.745l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

const VIEW_KEY = 'kora_viewed_sessions'
const REACT_KEY = 'kora_reactions'

function recordView(sessionId: string): boolean {
  try {
    const viewed: string[] = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '[]')
    if (viewed.includes(sessionId)) return false
    localStorage.setItem(VIEW_KEY, JSON.stringify([...viewed, sessionId]))
    return true
  } catch { return true }
}

function getLocalReactions(sessionId: string): string[] {
  try {
    const all: Record<string, string[]> = JSON.parse(localStorage.getItem(REACT_KEY) ?? '{}')
    return all[sessionId] ?? []
  } catch { return [] }
}

function saveLocalReaction(sessionId: string, type: string) {
  try {
    const all: Record<string, string[]> = JSON.parse(localStorage.getItem(REACT_KEY) ?? '{}')
    all[sessionId] = [...(all[sessionId] ?? []), type]
    localStorage.setItem(REACT_KEY, JSON.stringify(all))
  } catch {}
}

type ReactionCounts = { user: number; investor: number; builder: number }

const REACTIONS: { type: keyof ReactionCounts; label: string; icon: string }[] = [
  { type: 'user',     label: "I'm the target user", icon: '👤' },
  { type: 'investor', label: "I'd fund this",        icon: '💰' },
  { type: 'builder',  label: "I'd build this",       icon: '🔨' },
]

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

  const hasContent = !!(vision || parkingLot)
  const wedge = parseWedge(vision)
  const persona = parseUserPersona(vision)
  const totalReactions = counts.user + counts.investor + counts.builder

  useEffect(() => {
    setIsOwner(loadSessions().some((s) => s.id === sessionId))
    setMyReactions(getLocalReactions(sessionId))
    const isNew = recordView(sessionId)
    if (!isNew) return
    fetch(`/api/session/${sessionId}/view`, { method: 'POST' })
      .then(() => setViewCount((c) => c + 1))
      .catch(() => {})
  }, [sessionId])

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function shareOnX() {
    const text = wedge
      ? `${idea ? idea + ': ' : ''}${wedge} — built with @KoraAI`
      : `Check out this vision built with @KoraAI`
    const pageUrl = window.location.href
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text, url: pageUrl })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          window.open(`https://x.com/intent/post?text=${encodeURIComponent(text + '\n' + pageUrl)}`, '_blank', 'noopener,noreferrer')
        }
      }
      return
    }
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text + '\n' + pageUrl)}`, '_blank', 'noopener,noreferrer')
  }

  async function react(type: keyof ReactionCounts) {
    if (myReactions.includes(type)) return
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
    } catch {}
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
    <main className="bg-zinc-950 text-zinc-100 min-h-screen">

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-10 border-b border-zinc-800/50 px-4 sm:px-6 flex items-center justify-between bg-zinc-950/95 backdrop-blur-md"
        style={{ paddingTop: 'max(14px, calc(14px + var(--safe-top)))', paddingBottom: '14px' }}
      >
        <Link
          href="/"
          className="text-sm font-semibold tracking-widest text-zinc-200 uppercase hover:text-white transition-colors"
        >
          Kora
        </Link>
        <div className="flex items-center gap-2">
          {wedge && (
            <button
              onClick={shareOnX}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg px-3 min-h-[34px] transition-all"
            >
              <XIcon />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}
          <button
            onClick={copyLink}
            className="text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg px-3 min-h-[34px] transition-all"
          >
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
          <Link
            href={`/session/${sessionId}`}
            className="text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg px-3 min-h-[34px] flex items-center transition-all"
          >
            Open session
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
              Vision Architect · {new Date(createdAt).toLocaleDateString()}
            </span>
            {viewCount > 0 && (
              <span className="text-[10px] font-mono text-zinc-700">
                · {viewCount.toLocaleString()} {viewCount === 1 ? 'view' : 'views'}
              </span>
            )}
            {totalReactions > 0 && (
              <span className="text-[10px] font-mono text-zinc-700">
                · {totalReactions} {totalReactions === 1 ? 'signal' : 'signals'}
              </span>
            )}
          </div>
          {idea ? (
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-50 leading-tight">{idea}</h1>
          ) : (
            <h1 className="text-xl font-bold text-zinc-500">Session {sessionId.slice(0, 8)}</h1>
          )}
        </div>

        {!hasContent ? (
          <div className="border border-zinc-800/60 rounded-2xl p-10 text-center space-y-3">
            <p className="text-sm text-zinc-500">No vision yet.</p>
            <Link href={`/session/${sessionId}`} className="text-sm text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors">
              Continue the session →
            </Link>
          </div>
        ) : (
          <>
            {/* ── Tabs ──────────────────────────────────────────────────── */}
            {parkingLot && (
              <div className="flex items-center gap-1 border-b border-zinc-800/60">
                {(['vision', 'parking'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={[
                      'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                      activeTab === tab
                        ? tab === 'vision' ? 'text-zinc-100 border-zinc-100' : 'text-amber-400 border-amber-400'
                        : 'text-zinc-500 border-transparent hover:text-zinc-300',
                    ].join(' ')}
                  >
                    {tab === 'vision' ? 'Vision Document' : 'Deferred Ideas'}
                  </button>
                ))}
              </div>
            )}

            {/* ── Document ──────────────────────────────────────────────── */}
            {activeTab === 'vision' ? (
              vision ? (
                <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6 sm:p-8">
                  <Prose variant="doc">{vision}</Prose>
                </div>
              ) : (
                <p className="text-sm text-zinc-600 py-4">Vision document not yet generated.</p>
              )
            ) : (
              <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-6 sm:p-8">
                <Prose variant="doc">{parkingLot}</Prose>
              </div>
            )}

            {activeTab === 'vision' && vision && (
              <>
                {/* ── Reactions ─────────────────────────────────────────── */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-zinc-500">What&apos;s your take?</p>
                  <div className="flex flex-wrap gap-2">
                    {REACTIONS.map(({ type, label, icon }) => {
                      const reacted = myReactions.includes(type)
                      const count = counts[type]
                      return (
                        <button
                          key={type}
                          onClick={() => react(type)}
                          disabled={reacted}
                          className={[
                            'inline-flex items-center gap-2 pl-3 pr-4 py-2 rounded-full text-sm font-medium border transition-all duration-150',
                            reacted
                              ? 'bg-violet-600 border-violet-500 text-white shadow-[0_0_12px_rgba(139,92,246,0.25)] cursor-default'
                              : 'bg-transparent border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 hover:bg-zinc-900 active:scale-95',
                          ].join(' ')}
                        >
                          {reacted ? (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <span className="text-base leading-none">{icon}</span>
                          )}
                          <span>{label}</span>
                          {count > 0 && (
                            <span className={`text-xs font-mono ${reacted ? 'text-violet-200' : 'text-zinc-600'}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* ── "I'm the user" ─────────────────────────────────────── */}
                {persona && (
                  <div className="relative overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-6">
                    <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-violet-600/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    <div className="relative space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">This vision is for</p>
                        <p className="text-sm text-zinc-300 leading-relaxed">{persona}</p>
                      </div>
                      <div className="h-px bg-zinc-800/60" />
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-zinc-500">Does this sound like you?</p>
                        <Link
                          href="/"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors whitespace-nowrap"
                        >
                          Start your own →
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Share + Gallery ────────────────────────────────────── */}
                <div className="space-y-3">
                  {/* Share row */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={shareOnX}
                      className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800 text-sm font-medium transition-all"
                    >
                      <XIcon />
                      Share on X
                    </button>
                    <button
                      onClick={copyLink}
                      className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800 text-sm font-medium transition-all"
                    >
                      {copied ? (
                        <>
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                            <path d="M2 6.5l3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        'Copy link'
                      )}
                    </button>
                  </div>

                  {/* Gallery toggle — owner only */}
                  {isOwner && (
                    <button
                      onClick={toggleListed}
                      disabled={listingLoading}
                      className={[
                        'w-full flex items-center justify-between min-h-[52px] rounded-xl border px-4 transition-all',
                        listed
                          ? 'border-violet-800/50 bg-violet-950/30'
                          : 'border-zinc-800/60 bg-zinc-900/30 hover:border-zinc-700',
                        listingLoading ? 'opacity-50 cursor-wait' : '',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-3 text-left">
                        <span className={`text-sm font-medium ${listed ? 'text-violet-300' : 'text-zinc-300'}`}>
                          {listed ? 'Listed in public gallery' : 'Add to public gallery'}
                        </span>
                        {listed && (
                          <Link
                            href="/visions"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] font-mono text-violet-500 hover:text-violet-300 transition-colors"
                          >
                            Browse →
                          </Link>
                        )}
                      </div>
                      <div
                        className={[
                          'relative inline-flex h-5 w-9 rounded-full transition-colors duration-200 shrink-0',
                          listed ? 'bg-violet-600' : 'bg-zinc-700',
                        ].join(' ')}
                        role="switch"
                        aria-checked={listed}
                      >
                        <span
                          className={[
                            'inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow-sm transition-transform duration-200',
                            listed ? 'translate-x-4' : 'translate-x-0.5',
                          ].join(' ')}
                        />
                      </div>
                    </button>
                  )}
                </div>

                {/* ── Downloads ─────────────────────────────────────────── */}
                <div className="flex items-center gap-4 text-xs text-zinc-600 pt-1">
                  <span>Export:</span>
                  {vision && (
                    <button onClick={() => download('vision.md', vision)} className="hover:text-zinc-400 transition-colors">
                      vision.md
                    </button>
                  )}
                  {parkingLot && (
                    <button onClick={() => download('parking_lot.md', parkingLot)} className="hover:text-zinc-400 transition-colors">
                      parking_lot.md
                    </button>
                  )}
                  {vision && parkingLot && (
                    <button onClick={downloadAll} className="hover:text-zinc-400 transition-colors">
                      all.md
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ── Footer CTA ─────────────────────────────────────────────── */}
        <div className="border-t border-zinc-800/40 pt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-300">Build your own vision</p>
            <p className="text-xs text-zinc-600 leading-relaxed">
              60–90 minutes with Kora. Walk away with a one-page document you can act on today.
            </p>
          </div>
          <Link
            href="/"
            className="w-full sm:w-auto shrink-0 inline-flex justify-center items-center gap-2 min-h-[44px] bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-semibold px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_28px_rgba(139,92,246,0.45)] text-sm"
          >
            Start a session →
          </Link>
        </div>

      </div>
    </main>
  )
}
