'use client'

import Link from 'next/link'
import { useState } from 'react'

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ShareView({
  sessionId,
  idea,
  createdAt,
  vision,
  parkingLot,
}: {
  sessionId: string
  idea: string | null
  createdAt: string
  vision: string
  parkingLot: string
}) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'vision' | 'parking'>('vision')

  const hasContent = !!(vision || parkingLot)

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
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
      <nav className="sticky top-0 z-10 border-b border-zinc-800/60 px-8 py-4 flex items-center justify-between bg-zinc-950/95 backdrop-blur-sm">
        <Link
          href="/"
          className="text-sm font-semibold tracking-widest text-zinc-300 uppercase hover:text-zinc-100 transition-colors"
        >
          Kora
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={copyLink}
            className="text-xs font-mono text-zinc-500 border border-zinc-800 rounded-md px-2.5 py-1 hover:border-zinc-700 hover:text-zinc-300 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          {hasContent && (
            <button
              onClick={downloadAll}
              className="text-xs font-mono text-zinc-500 border border-zinc-800 rounded-md px-2.5 py-1 hover:border-zinc-700 hover:text-zinc-300 transition-colors"
            >
              Export all
            </button>
          )}
          <Link
            href={`/session/${sessionId}`}
            className="text-xs text-zinc-500 border border-zinc-800 rounded-md px-2.5 py-1 hover:border-zinc-700 hover:text-zinc-300 transition-colors"
          >
            Open session →
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        {/* Header */}
        <div className="space-y-2 pb-2">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
            Vision Architect · {new Date(createdAt).toLocaleDateString()} · {sessionId.slice(0, 8)}
          </p>
          {idea ? (
            <h1 className="text-2xl font-bold text-zinc-100">{idea}</h1>
          ) : (
            <h1 className="text-xl font-bold text-zinc-500">Session {sessionId.slice(0, 8)}</h1>
          )}
        </div>

        {!hasContent ? (
          <div className="border border-zinc-800 rounded-xl p-10 text-center space-y-3">
            <p className="text-sm text-zinc-500">No artifacts yet.</p>
            <p className="text-xs text-zinc-600 leading-relaxed max-w-xs mx-auto">
              The vision document appears after ~6 exchanges with Kora.{' '}
              <Link href={`/session/${sessionId}`} className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2">
                Continue the session →
              </Link>
            </p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            {parkingLot && (
              <div className="flex items-center gap-0 border-b border-zinc-800">
                <button
                  onClick={() => setActiveTab('vision')}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === 'vision'
                      ? 'text-zinc-100 border-zinc-400'
                      : 'text-zinc-500 border-transparent hover:text-zinc-300'
                  }`}
                >
                  Vision Document
                </button>
                <button
                  onClick={() => setActiveTab('parking')}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
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
                <pre className="text-sm font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                  {vision}
                </pre>
              ) : (
                <p className="text-sm text-zinc-600 py-4">Vision document not yet generated.</p>
              )
            ) : (
              <pre className="text-sm font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                {parkingLot}
              </pre>
            )}

            {/* Individual downloads */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-zinc-600">Download:</span>
              {vision && (
                <button
                  onClick={() => download('vision.md', vision)}
                  className="text-[11px] font-mono text-zinc-500 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 rounded px-2.5 py-1 transition-colors"
                >
                  vision.md
                </button>
              )}
              {parkingLot && (
                <button
                  onClick={() => download('parking_lot.md', parkingLot)}
                  className="text-[11px] font-mono text-zinc-500 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 rounded px-2.5 py-1 transition-colors"
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
        <div className="border-t border-zinc-800/60 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
            Built with Kora — turn your idea into a focused one-page vision in 90 minutes.
          </p>
          <Link
            href="/"
            className="shrink-0 inline-flex items-center gap-2 bg-white text-zinc-900 font-semibold px-5 py-2.5 rounded-lg hover:bg-zinc-100 transition-colors text-sm"
          >
            Start your session →
          </Link>
        </div>
      </div>
    </main>
  )
}
