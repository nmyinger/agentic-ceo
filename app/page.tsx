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
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-6">
      <div className="max-w-lg w-full space-y-10">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">Кора</h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            AI-CEO, который берёт идею с нуля и ведёт её до первых шагов.
          </p>
          <div className="border-t border-zinc-800 pt-4 space-y-2 text-sm text-zinc-500">
            <p>Gate 1 — Vision Architect</p>
            <p>
              Paste your idea. Answer hard questions. Get a one-page vision and
              a parking lot of everything we said NO to.
            </p>
          </div>
        </div>

        <button
          onClick={start}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-zinc-100 text-zinc-900 font-medium px-6 py-3 rounded-lg hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Starting...' : 'Start →'}
        </button>

        <div className="grid grid-cols-3 gap-6 text-xs text-zinc-600 border-t border-zinc-800 pt-8">
          <div>
            <p className="text-zinc-400 font-medium mb-1">vision.md</p>
            <p>One page. The wedge sentence. Who, what pain, why now.</p>
          </div>
          <div>
            <p className="text-zinc-400 font-medium mb-1">parking_lot.md</p>
            <p>Every idea Кора said NO to. Saved, not lost.</p>
          </div>
          <div>
            <p className="text-zinc-400 font-medium mb-1">Gate 1 only</p>
            <p>Model, MVP, and Launch gates follow. One thing at a time.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
