'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Prose } from '@/components/prose'
import { LevelMap, GATE_DEFS, type GateInfo, type GateState } from '@/components/level-map'
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
import { loadJourneys } from '@/lib/journeys'

type GateSession = {
  id: string
  gate: number
  status: string | null
  idea: string | null
  artifacts: Record<string, string>
}

type Journey = {
  id: string
  title: string | null
  status: string
  current_gate: number
  listed: boolean
  view_count: number
  created_at: string
}

export function JourneyMap({
  journey,
  sessions,
  initialReactionCounts,
}: {
  journey: Journey
  sessions: GateSession[]
  initialReactionCounts: ReactionCounts
}) {
  const [expandedGate, setExpandedGate] = useState<number | null>(() => {
    const active = sessions.find((s) => s.status === 'active')
    return active?.gate ?? null
  })
  const [counts, setCounts] = useState<ReactionCounts>(initialReactionCounts)
  const [myReactions, setMyReactions] = useState<string[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [listed, setListed] = useState(journey.listed)
  const [listingLoading, setListingLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setMyReactions(getLocalReactions(journey.id))
    setIsOwner(loadJourneys().some((j) => j.id === journey.id))
    if (recordView(journey.id)) {
      fetch(`/api/journey/${journey.id}/view`, { method: 'POST' }).catch(() => {})
    }
  }, [journey.id])

  function buildGates(): GateInfo[] {
    return GATE_DEFS.map((def) => {
      const session = sessions.find((s) => s.gate === def.gate)
      let state: GateState = 'locked'
      if (session) {
        state = session.status === 'completed' ? 'complete' : 'active'
      }
      return { ...def, state }
    })
  }

  function handleGateClick(g: GateInfo) {
    setExpandedGate(expandedGate === g.gate ? null : g.gate)
  }

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

  async function toggleListed() {
    setListingLoading(true)
    const next = !listed
    try {
      await fetch(`/api/journey/${journey.id}/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listed: next }),
      })
      setListed(next)
    } catch {}
    setListingLoading(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const gates = buildGates()
  const title = journey.title ?? 'Untitled Journey'

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen">
      {/* Nav */}
      <nav
        className="sticky top-0 z-10 border-b border-zinc-800/50 px-4 sm:px-8 py-4 flex items-center justify-between bg-zinc-950/90 backdrop-blur-md"
        style={{ paddingTop: 'max(16px, calc(16px + var(--safe-top)))' }}
      >
        <Link href="/" className="text-sm font-semibold tracking-widest text-zinc-200 uppercase hover:text-white transition-colors">
          Kora
        </Link>
        <div className="flex items-center gap-3">
          {isOwner && (
            <div className="flex items-center gap-2">
              <button
                onClick={toggleListed}
                disabled={listingLoading}
                className={`relative inline-flex h-4 w-8 rounded-full transition-colors duration-200 shrink-0 ${listed ? 'bg-violet-600' : 'bg-zinc-800'} ${listingLoading ? 'opacity-50 cursor-wait' : ''}`}
                role="switch"
                aria-checked={listed}
              >
                <span className={`inline-block h-3 w-3 mt-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${listed ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className={`text-xs ${listed ? 'text-violet-400' : 'text-zinc-600'}`}>
                {listed ? 'Public' : 'Private'}
              </span>
            </div>
          )}
          <button
            onClick={copyLink}
            className="text-xs font-mono text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {copied ? 'Copied!' : 'Share ↗'}
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
        {/* Header */}
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Journey</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-50 leading-tight">{title}</h1>
          <p className="text-xs font-mono text-zinc-600">
            {new Date(journey.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {journey.view_count > 0 && ` · ${journey.view_count.toLocaleString()} views`}
          </p>
        </div>

        {/* Reaction bar */}
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
        </div>

        {/* Level Map */}
        <div className="border border-zinc-800/60 rounded-xl p-5 sm:p-6">
          <LevelMap gates={gates} onGateClick={handleGateClick} />
        </div>

        {/* Expanded gate panel */}
        {expandedGate !== null && (() => {
          const gateDef = GATE_DEFS.find((d) => d.gate === expandedGate)!
          const session = sessions.find((s) => s.gate === expandedGate)
          const gateInfo = gates.find((g) => g.gate === expandedGate)!

          return (
            <div className="border border-zinc-800/60 rounded-xl overflow-hidden">
              {/* Panel header */}
              <div className="px-5 py-4 border-b border-zinc-800/40 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className={`text-[10px] font-mono uppercase tracking-widest ${
                    gateInfo.state === 'complete' ? 'text-emerald-600' :
                    gateInfo.state === 'active' ? 'text-violet-500' : 'text-zinc-700'
                  }`}>
                    Gate {expandedGate} · {
                      gateInfo.state === 'complete' ? 'Complete' :
                      gateInfo.state === 'active' ? 'Active' : 'Locked'
                    }
                  </p>
                  <p className="text-sm font-semibold text-zinc-200">{gateDef.label}</p>
                </div>
                <button
                  onClick={() => setExpandedGate(null)}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors text-lg leading-none"
                >
                  ✕
                </button>
              </div>

              {/* Panel body */}
              <div className="px-5 py-4 space-y-4">
                {gateInfo.state === 'locked' ? (
                  <div className="space-y-2">
                    <p className="text-sm text-zinc-500 leading-relaxed">{gateDef.description}</p>
                    <p className="text-xs text-zinc-700">
                      Unlock by completing Gate {expandedGate - 1}.
                    </p>
                  </div>
                ) : gateInfo.state === 'active' && session ? (
                  <div className="space-y-4">
                    <p className="text-sm text-zinc-400 leading-relaxed">{gateDef.description}</p>
                    {isOwner ? (
                      <Link
                        href={`/journey/${journey.id}/gate/${expandedGate}`}
                        className="inline-flex items-center gap-2 min-h-[44px] bg-violet-600 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-violet-500 active:bg-violet-700 transition-all shadow-[0_0_16px_rgba(139,92,246,0.3)] text-sm"
                      >
                        Open Gate {expandedGate} →
                      </Link>
                    ) : (
                      <Link
                        href="/"
                        className="inline-flex items-center gap-2 min-h-[44px] bg-violet-600 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-violet-500 transition-all shadow-[0_0_16px_rgba(139,92,246,0.3)] text-sm"
                      >
                        Start your own journey →
                      </Link>
                    )}
                  </div>
                ) : session ? (
                  <div className="space-y-4">
                    {/* Completed gate artifacts */}
                    {session.artifacts.vision ? (
                      <div>
                        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-3">Vision Document</p>
                        <div className="prose-compact">
                          <Prose variant="doc">{session.artifacts.vision}</Prose>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-600">No vision document yet.</p>
                    )}
                    {isOwner && (
                      <Link
                        href={`/journey/${journey.id}/gate/${expandedGate}`}
                        className="inline-flex items-center gap-2 text-xs text-zinc-400 border border-zinc-700 rounded-lg px-4 min-h-[40px] hover:border-zinc-500 hover:text-zinc-200 transition-colors"
                      >
                        Review Gate {expandedGate} →
                      </Link>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )
        })()}

        {/* Non-owner CTA */}
        {!isOwner && (
          <div className="border-t border-zinc-800/60 pt-8 text-center space-y-4">
            <p className="text-sm text-zinc-500">Inspired by this journey?</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 min-h-[48px] bg-violet-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-violet-500 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] text-sm"
            >
              Start your own journey →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
