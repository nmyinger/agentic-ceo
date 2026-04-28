'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function start() {
    setLoading(true)
    const res = await fetch('/api/session', { method: 'POST' })
    const { id } = await res.json()
    router.push(`/session/${id}`)
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Nav */}
      <nav className="border-b border-zinc-800/60 px-8 py-4 flex items-center justify-between">
        <span className="text-sm font-semibold tracking-widest text-zinc-300 uppercase">
          Kora
        </span>
        <span className="text-xs font-mono text-zinc-600">Gate 1 — Vision Architect</span>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-24">
        <div className="max-w-xl w-full space-y-12">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 border border-zinc-800 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-zinc-400 font-mono">Vision Architect · Ready</span>
            </div>

            <h1 className="text-4xl font-bold tracking-tight leading-tight">
              Turn your idea into<br />a focused vision.
            </h1>

            <p className="text-zinc-400 text-base leading-relaxed max-w-md">
              Answer eight hard questions. Walk away with a one-page vision
              document and a clear record of every scope decision made along the way.
            </p>
          </div>

          <button
            onClick={start}
            disabled={loading}
            className="inline-flex items-center gap-2.5 bg-white text-zinc-900 font-semibold px-6 py-3 rounded-lg hover:bg-zinc-100 active:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-zinc-800 rounded-full animate-spin" />
                Starting session...
              </>
            ) : (
              <>
                Begin Session
                <span className="text-zinc-500">→</span>
              </>
            )}
          </button>

          <div className="grid grid-cols-3 gap-6 border-t border-zinc-800 pt-10">
            <div className="space-y-2">
              <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
                Output 1
              </p>
              <p className="text-sm font-semibold text-zinc-200">Vision Document</p>
              <p className="text-xs text-zinc-600 leading-relaxed">
                One page. Wedge sentence, customer, pain point, and why now.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
                Output 2
              </p>
              <p className="text-sm font-semibold text-zinc-200">Deferred Ideas</p>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Every out-of-scope request, logged and saved — not discarded.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
                Gate 1 of 5
              </p>
              <p className="text-sm font-semibold text-zinc-200">Focus First</p>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Business model, MVP scope, and launch planning follow in sequence.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
