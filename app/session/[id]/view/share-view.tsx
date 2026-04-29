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

const VIEW_STORAGE_KEY = 'kora_viewed_sessions'

function recordView(sessionId: string) {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY)
    const viewed: string[] = raw ? JSON.parse(raw) : []
    if (viewed.includes(sessionId)) return false
    viewed.push(sessionId)
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(viewed))
    return true
  } catch {
    return true
  }
}

export function ShareView({
  sessionId,
  idea,
  createdAt,
  vision,
  parkingLot,
  viewCount: initialViewCount,
}: {
  sessionId: string
  idea: string | null
  createdAt: string
  vision: string
  parkingLot: string
  viewCount: number
}) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'vision' | 'parking'>('vision')
  const [viewCount, setViewCount] = useState(initialViewCount)

  const hasContent = !!(vision || parkingLot)
  const wedge = parseWedge(vision)
  const persona = parseUserPersona(vision)

  useEffect(() => {
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

  function shareOnX() {
    const text = wedge
      ? `${idea ? idea + ': ' : ''}${wedge} — built with @KoraAI`
      : `Check out this vision built with @KoraAI`
    const encoded = encodeURIComponent(text + '\n' + window.location.href)
    const webUrl = `https://x.com/intent/post?text=${encoded}`
    // twitter:// opens the X app on iOS/Android; fall back to web if app not installed
    window.location.href = `twitter://post?message=${encoded}`
    setTimeout(() => {
      if (!document.hidden) window.open(webUrl, '_blank', 'noopener,noreferrer')
    }, 500)
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

            {/* "I'm the user" CTA */}
            {persona && activeTab === 'vision' && (
              <div className="border border-violet-900/40 bg-violet-950/20 rounded-xl p-5 space-y-3">
                <p className="text-xs font-mono uppercase tracking-widest text-violet-500">The User</p>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {persona}
                </p>
                <p className="text-sm text-zinc-500">
                  Does this sound like you?
                </p>
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
