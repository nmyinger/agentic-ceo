'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Prose } from '@/components/prose'
import { parseWedge, parseUserPersona } from '@/lib/utils'

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
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

const REACTIONS: { type: keyof ReactionCounts; label: string; emoji: string }[] = [
  { type: 'user',     label: "I'm the target user", emoji: '👤' },
  { type: 'investor', label: "I'd fund this",        emoji: '💰' },
  { type: 'builder',  label: "I'd build this",       emoji: '🔨' },
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

  const hasContent = !!(vision || parkingLot)
  const wedge = parseWedge(vision)
  const persona = parseUserPersona(vision)

  useEffect(() => {
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
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={copyLink}
            className="text-xs font-mono text-zinc-500 border border-zinc-800/70 rounded-md px-3 min-h-[36px] flex items-center hover:border-violet-800/50 hover:text-violet-300 transition-all"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          {wedge && (
            <button
              onClick={shareOnX}
              className="hidden sm:flex items-center text-xs font-mono text-zinc-500 border border-zinc-800/70 rounded-md px-3 min-h-[36px] hover:border-violet-800/50 hover:text-violet-300 transition-all"
            >
              Share on X
            </button>
          )}
          {hasContent && (
            <button
              onClick={downloadAll}
              className="hidden sm:flex items-center text-xs font-mono text-zinc-500 border border-zinc-800/70 rounded-md px-3 min-h-[36px] hover:border-violet-800/50 hover:text-violet-300 transition-all"
            >
              Export all
            </button>
          )}
          <Link
            href={`/session/${sessionId}`}
            className="text-xs text-zinc-500 border border-zinc-800/70 rounded-md px-3 min-h-[36px] flex items-center hover:border-violet-800/50 hover:text-violet-300 transition-all"
          >
            Open session →
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Header */}
        <div className="space-y-2 pb-2">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest flex items-center gap-2">
            <span>Vision Architect · {new Date(createdAt).toLocaleDateString()} · {sessionId.slice(0, 8)}</span>
            {viewCount > 0 && (
              <>
                <span className="text-zinc-800">·</span>
                <span className="text-zinc-700">{viewCount.toLocaleString()} {viewCount === 1 ? 'view' : 'views'}</span>
              </>
            )}
          </p>
          {idea ? (
            <h1 className="text-2xl font-bold text-zinc-100">{idea}</h1>
          ) : (
            <h1 className="text-xl font-bold text-zinc-500">Session {sessionId.slice(0, 8)}</h1>
          )}
        </div>

        {!hasContent ? (
          <div className="border border-zinc-800/60 rounded-xl p-10 text-center space-y-3">
            <p className="text-sm text-zinc-500">No artifacts yet.</p>
            <p className="text-xs text-zinc-600 leading-relaxed max-w-xs mx-auto">
              The vision document appears after ~6 exchanges with Kora.{' '}
              <Link href={`/session/${sessionId}`} className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors">
                Continue the session →
              </Link>
            </p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            {parkingLot && (
              <div className="flex items-center gap-0 border-b border-zinc-800/60">
                <button
                  onClick={() => setActiveTab('vision')}
                  className={`px-4 py-2.5 min-h-[44px] flex items-center text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === 'vision'
                      ? 'text-violet-300 border-violet-500'
                      : 'text-zinc-500 border-transparent hover:text-zinc-300'
                  }`}
                >
                  Vision Document
                </button>
                <button
                  onClick={() => setActiveTab('parking')}
                  className={`px-4 py-2.5 min-h-[44px] flex items-center text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === 'parking'
                      ? 'text-amber-400 border-amber-400'
                      : 'text-zinc-500 border-transparent hover:text-zinc-300'
                  }`}
                >
                  Deferred Ideas
                </button>
              </div>
            )}

            {/* Content */}
            {activeTab === 'vision' ? (
              vision ? (
                <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                  <Prose variant="doc">{vision}</Prose>
                </div>
              ) : (
                <p className="text-sm text-zinc-600 py-4">Vision document not yet generated.</p>
              )
            ) : (
              <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                <Prose variant="doc">{parkingLot}</Prose>
              </div>
            )}

            {/* Reactions */}
            {activeTab === 'vision' && vision && (
              <div className="space-y-3">
                <p className="text-[11px] font-mono text-zinc-600 uppercase tracking-widest">Signal</p>
                <div className="flex flex-wrap gap-2">
                  {REACTIONS.map(({ type, label, emoji }) => {
                    const reacted = myReactions.includes(type)
                    const count = counts[type]
                    return (
                      <button
                        key={type}
                        onClick={() => react(type)}
                        disabled={reacted}
                        className={[
                          'flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm transition-all',
                          reacted
                            ? 'border-violet-700/60 bg-violet-950/40 text-violet-300 cursor-default'
                            : 'border-zinc-800/70 text-zinc-400 hover:border-violet-800/50 hover:text-violet-300 hover:bg-violet-950/20',
                        ].join(' ')}
                      >
                        <span>{emoji}</span>
                        <span>{label}</span>
                        {count > 0 && (
                          <span className={`text-xs font-mono ${reacted ? 'text-violet-400' : 'text-zinc-600'}`}>
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* "I'm the user" CTA */}
            {persona && activeTab === 'vision' && (
              <div className="border border-violet-900/40 bg-violet-950/20 rounded-xl p-5 space-y-3">
                <p className="text-xs font-mono uppercase tracking-widest text-violet-500">The User</p>
                <p className="text-sm text-zinc-400 leading-relaxed">{persona}</p>
                <p className="text-sm text-zinc-500">Does this sound like you?</p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-sm font-medium text-violet-300 hover:text-violet-200 transition-colors"
                >
                  Talk to Kora about your own version →
                </Link>
              </div>
            )}

            {/* Share on X (mobile) */}
            {wedge && (
              <button
                onClick={shareOnX}
                className="sm:hidden w-full text-sm font-mono text-zinc-500 border border-zinc-800/70 rounded-lg px-4 min-h-[44px] flex items-center justify-center hover:border-violet-800/50 hover:text-violet-300 transition-all"
              >
                Share on X
              </button>
            )}

            {/* Gallery toggle */}
            {vision && (
              <div className="flex items-center justify-between border border-zinc-800/60 rounded-xl px-5 py-4">
                <div className="space-y-0.5">
                  <p className="text-sm text-zinc-300 font-medium">Public gallery</p>
                  <p className="text-xs text-zinc-600">
                    {listed
                      ? 'Listed on the public visions feed.'
                      : 'Add this vision to the public feed so others can discover it.'}
                  </p>
                </div>
                <button
                  onClick={toggleListed}
                  disabled={listingLoading}
                  className={[
                    'shrink-0 ml-4 relative inline-flex h-6 w-11 rounded-full border transition-colors duration-200',
                    listed
                      ? 'bg-violet-600 border-violet-500'
                      : 'bg-zinc-800 border-zinc-700',
                    listingLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer',
                  ].join(' ')}
                  role="switch"
                  aria-checked={listed}
                >
                  <span
                    className={[
                      'inline-block h-5 w-5 mt-px rounded-full bg-white shadow transition-transform duration-200',
                      listed ? 'translate-x-5' : 'translate-x-px',
                    ].join(' ')}
                  />
                </button>
              </div>
            )}

            {/* Individual downloads */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-zinc-600">Download:</span>
              {vision && (
                <button
                  onClick={() => download('vision.md', vision)}
                  className="text-[11px] font-mono text-zinc-500 hover:text-zinc-200 border border-zinc-800/70 hover:border-zinc-700 rounded px-2.5 py-1 transition-colors"
                >
                  vision.md
                </button>
              )}
              {parkingLot && (
                <button
                  onClick={() => download('parking_lot.md', parkingLot)}
                  className="text-[11px] font-mono text-zinc-500 hover:text-zinc-200 border border-zinc-800/70 hover:border-zinc-700 rounded px-2.5 py-1 transition-colors"
                >
                  parking_lot.md
                </button>
              )}
              {vision && parkingLot && (
                <button
                  onClick={downloadAll}
                  className="text-[11px] font-mono text-zinc-400 hover:text-zinc-100 border border-zinc-700 hover:border-zinc-500 rounded px-2.5 py-1 transition-colors"
                >
                  all.md
                </button>
              )}
            </div>
          </>
        )}

        {/* CTA */}
        <div className="border-t border-zinc-800/50 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
            Built with Kora — turn your idea into a focused one-page vision in 90 minutes.
          </p>
          <Link
            href="/"
            className="w-full sm:w-auto shrink-0 inline-flex justify-center items-center gap-2 min-h-[48px] bg-violet-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-violet-500 active:bg-violet-700 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_28px_rgba(139,92,246,0.45)] text-sm"
          >
            Start your session →
          </Link>
        </div>
      </div>
    </main>
  )
}
