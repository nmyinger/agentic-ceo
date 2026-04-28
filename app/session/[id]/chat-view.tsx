'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage, type TextUIPart } from 'ai'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { saveSession } from '@/lib/sessions'

const TRIGGER = '<<begin>>'

type Tab = 'vision' | 'actions' | 'parking'
type DbMessage = { id: string; role: 'user' | 'assistant'; content: string }

function toUIMessages(dbMessages: DbMessage[]): UIMessage[] {
  return dbMessages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: [{ type: 'text' as const, text: m.content }],
  }))
}

function getTextContent(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is TextUIPart => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function countParkingItems(content: string): number {
  return content
    .split('\n')
    .filter((l) => l.startsWith('|') && !l.includes('Date') && !l.includes('----')).length
}

function countCompletedActions(content: string): { done: number; total: number } {
  const lines = content.split('\n')
  const checkboxes = lines.filter((l) => l.match(/^- \[[ xX]\]/))
  const done = checkboxes.filter((l) => l.match(/^- \[[xX]\]/)).length
  return { done, total: checkboxes.length }
}

function ActionPlan({ content }: { content: string }) {
  return (
    <div className="space-y-1">
      {content.split('\n').map((line, i) => {
        if (line.startsWith('# ')) {
          return (
            <p key={i} className="text-xs font-semibold text-zinc-400 uppercase tracking-wider pb-2">
              {line.slice(2)}
            </p>
          )
        }
        if (line.startsWith('## ')) {
          return (
            <p key={i} className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider pt-4 pb-1 first:pt-0">
              {line.slice(3)}
            </p>
          )
        }
        if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
          return (
            <div key={i} className="flex items-start gap-2.5 py-0.5">
              <span className="mt-0.5 w-3.5 h-3.5 rounded border border-emerald-700/60 bg-emerald-950/50 shrink-0 flex items-center justify-center">
                <span className="text-[8px] leading-none text-emerald-400">✓</span>
              </span>
              <span className="text-xs text-zinc-600 leading-snug line-through">{line.slice(6)}</span>
            </div>
          )
        }
        if (line.startsWith('- [ ] ')) {
          return (
            <div key={i} className="flex items-start gap-2.5 py-0.5">
              <span className="mt-0.5 w-3.5 h-3.5 rounded border border-zinc-700 shrink-0 bg-zinc-900/80" />
              <span className="text-xs text-zinc-300 leading-snug">{line.slice(6)}</span>
            </div>
          )
        }
        if (line.startsWith('- ')) {
          return (
            <div key={i} className="flex items-start gap-2.5 py-0.5">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-zinc-700 shrink-0" />
              <span className="text-xs text-zinc-400 leading-snug">{line.slice(2)}</span>
            </div>
          )
        }
        if (line.trim() === '' || line === '---') {
          return <div key={i} className="h-1" />
        }
        return (
          <p key={i} className="text-xs text-zinc-500 leading-relaxed">
            {line}
          </p>
        )
      })}
    </div>
  )
}

export function ChatView({
  sessionId,
  initialMessages,
  initialVision,
  initialParkingLot,
  initialActions,
  initialStatus,
}: {
  sessionId: string
  initialMessages: DbMessage[]
  initialVision: string
  initialParkingLot: string
  initialActions: string
  initialStatus: string
}) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [vision, setVision] = useState(initialVision)
  const [parkingLot, setParkingLot] = useState(initialParkingLot)
  const [actions, setActions] = useState(initialActions)
  const [activeTab, setActiveTab] = useState<Tab>('actions')
  const [showMobileArtifacts, setShowMobileArtifacts] = useState(false)
  const [newSessionLoading, setNewSessionLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  const { messages, sendMessage, status } = useChat({
    id: sessionId,
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    messages: toUIMessages(initialMessages),
  })

  const isLoading = status === 'streaming' || status === 'submitted'
  const hasError = status === 'error'

  async function startNewSession() {
    setNewSessionLoading(true)
    try {
      const res = await fetch('/api/session', { method: 'POST' })
      const { id } = await res.json()
      router.push(`/session/${id}`)
    } catch {
      setNewSessionLoading(false)
    }
  }

  function openMobileArtifacts(tab: Tab) {
    setActiveTab(tab)
    setShowMobileArtifacts(true)
  }

  function copyUrl() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function downloadAll() {
    const parts = [
      actions && `${actions}`,
      vision && `\n---\n\n# Vision Document\n\n${vision}`,
      parkingLot && `\n---\n\n${parkingLot}`,
    ].filter(Boolean)
    if (parts.length) download('kora-session.md', parts.join(''))
  }

  useEffect(() => {
    saveSession(sessionId)
  }, [sessionId])

  useEffect(() => {
    if (initialMessages.length === 0 && !started.current) {
      started.current = true
      sendMessage({ text: TRIGGER })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!
    )
    const channel = sb
      .channel(`artifacts-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'artifacts', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as { type: string; content: string }
          if (row.type === 'vision') setVision(row.content)
          if (row.type === 'parking_lot') setParkingLot(row.content)
          if (row.type === 'actions') {
            setActions(row.content)
            // Auto-switch to actions tab on first update so founder sees it immediately
            setActiveTab((prev) => (prev === 'actions' || !row.content ? prev : 'actions'))
          }
        }
      )
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const parkedCount = parkingLot ? countParkingItems(parkingLot) : 0
  const actionProgress = actions ? countCompletedActions(actions) : { done: 0, total: 0 }
  const visibleMessages = messages.filter((m) => !getTextContent(m).startsWith('<<'))
  const isCompleted =
    initialStatus === 'completed' ||
    messages.some((m) => m.parts.some((p) => p.type === 'tool-mark_complete'))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    sendMessage({ text })
  }

  function renderMessage(msg: UIMessage) {
    return msg.parts.map((part, i) => {
      if (part.type === 'text') {
        const text = (part as TextUIPart).text
        return text ? (
          <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap">
            {text}
          </p>
        ) : null
      }
      if (part.type === 'tool-emit_actions') {
        return (
          <div key={i} className="flex items-center gap-2 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
            <span className="text-xs font-mono text-sky-400">Action plan updated</span>
          </div>
        )
      }
      if (part.type === 'tool-emit_vision') {
        return (
          <div key={i} className="flex items-center gap-2 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-xs font-mono text-emerald-500">Vision document updated</span>
          </div>
        )
      }
      if (part.type === 'tool-park_idea') {
        const idea = (part as { type: string; input?: { idea?: string } }).input?.idea
        return (
          <div key={i} className="flex items-center gap-2 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <span className="text-xs font-mono text-amber-500">Deferred: {idea}</span>
          </div>
        )
      }
      if (part.type === 'tool-mark_complete') {
        const wedge = (part as { type: string; input?: { wedge_sentence?: string } }).input?.wedge_sentence
        return (
          <div key={i} className="mt-2 border border-emerald-800/40 bg-emerald-950/30 rounded-lg px-4 py-3 space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-xs font-mono text-emerald-400 font-semibold">Gate 1 complete</span>
            </div>
            {wedge && <p className="text-xs text-emerald-300/70 italic leading-relaxed">&ldquo;{wedge}&rdquo;</p>}
          </div>
        )
      }
      return null
    })
  }

  // ─── Tab button helpers ───────────────────────────────────────────────────
  function tabClass(tab: Tab, color: 'violet' | 'sky' | 'amber') {
    const active = activeTab === tab
    const colors = {
      violet: active
        ? 'text-violet-300 bg-zinc-900/50 border border-zinc-700/60 border-b-transparent -mb-px'
        : 'text-zinc-500 hover:text-zinc-300',
      sky: active
        ? 'text-sky-300 bg-zinc-900/50 border border-zinc-700/60 border-b-transparent -mb-px'
        : 'text-zinc-500 hover:text-zinc-300',
      amber: active
        ? 'text-amber-400 bg-zinc-900/50 border border-zinc-700/60 border-b-transparent -mb-px'
        : 'text-zinc-500 hover:text-zinc-300',
    }
    return `px-3 py-2 text-xs font-medium rounded-t transition-colors ${colors[color]}`
  }

  function mobileTabClass(tab: Tab, color: 'violet' | 'sky' | 'amber') {
    const active = activeTab === tab
    const colors = {
      violet: active ? 'text-violet-300' : 'text-zinc-500',
      sky: active ? 'text-sky-300' : 'text-zinc-500',
      amber: active ? 'text-amber-400' : 'text-zinc-500',
    }
    return `px-3 py-2 text-xs font-medium rounded-t transition-colors ${colors[color]}`
  }

  // ─── Shared artifact content renderer ────────────────────────────────────
  function renderTabContent() {
    if (activeTab === 'vision') {
      return vision ? (
        <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">{vision}</pre>
      ) : (
        <div className="space-y-4 py-1">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Vision Document</p>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Not drafted yet. Kora will generate your vision document once there is enough signal from the conversation.
          </p>
          <div className="border border-dashed border-zinc-800/80 rounded-lg p-4 space-y-2">
            {['Wedge sentence', 'Customer persona', 'Core pain', 'Why now', 'Why you'].map((item) => (
              <div key={item} className="flex items-center gap-2.5">
                <span className="w-3 h-px bg-zinc-800" />
                <span className="text-[11px] text-zinc-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (activeTab === 'actions') {
      return actions ? (
        <ActionPlan content={actions} />
      ) : (
        <div className="space-y-4 py-1">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Action Plan</p>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Your action plan will appear here as the conversation starts — concrete steps you can take today.
          </p>
          <div className="border border-dashed border-zinc-800/80 rounded-lg p-4 space-y-2.5">
            {['Do Now', 'Complete This Week', 'Gate 1 Exit Checklist'].map((item) => (
              <div key={item} className="flex items-center gap-2.5">
                <span className="w-3.5 h-3.5 rounded border border-zinc-800 shrink-0" />
                <span className="text-[11px] text-zinc-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (activeTab === 'parking') {
      return parkingLot ? (
        <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">{parkingLot}</pre>
      ) : (
        <div className="space-y-4 py-1">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Deferred Ideas</p>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Out-of-scope ideas are saved here — not discarded, just deferred until the right gate.
          </p>
        </div>
      )
    }
  }

  // ─── Shared export footer ─────────────────────────────────────────────────
  function renderExportFooter(mobile = false) {
    const hasAny = vision || actions || parkingLot
    if (!hasAny) return null
    const btnClass = mobile
      ? 'text-[11px] font-mono text-zinc-500 hover:text-zinc-200 border border-zinc-800/70 hover:border-zinc-700 rounded px-2.5 py-1 transition-colors'
      : 'text-[11px] font-mono text-zinc-500 hover:text-zinc-200 border border-zinc-800/70 hover:border-zinc-700 rounded px-2.5 py-1 transition-colors'

    return (
      <div className={`shrink-0 border-t border-zinc-800/60 px-5 py-4 space-y-3 ${mobile ? '' : ''}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-zinc-600 mr-1">Export</span>
          {actions && (
            <button onClick={() => download('actions.md', actions)} className={btnClass}>
              actions.md
            </button>
          )}
          {vision && (
            <button onClick={() => download('vision.md', vision)} className={btnClass}>
              vision.md
            </button>
          )}
          {parkingLot && (
            <button onClick={() => download('parking_lot.md', parkingLot)} className={btnClass}>
              parking_lot.md
            </button>
          )}
          {(actions || vision) && parkingLot && (
            <button
              onClick={downloadAll}
              className="text-[11px] font-mono text-zinc-400 hover:text-zinc-100 border border-zinc-700 hover:border-zinc-500 rounded px-2.5 py-1 transition-colors"
            >
              all.md
            </button>
          )}
        </div>
        {mobile ? (
          <div className="flex items-center gap-3">
            <button onClick={copyUrl} className="text-[11px] text-zinc-500 hover:text-violet-300 transition-colors font-mono">
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <Link href={`/session/${sessionId}/view`} className="text-[11px] text-zinc-500 hover:text-violet-300 transition-colors">
              Share view ↗
            </Link>
          </div>
        ) : (
          <Link
            href={`/session/${sessionId}/view`}
            className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-violet-300 transition-colors"
          >
            <span>Share read-only view</span>
            <span>↗</span>
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="shrink-0 border-b border-zinc-800/60 px-6 py-3.5 flex items-center justify-between bg-zinc-950/90 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm font-semibold tracking-widest text-zinc-200 uppercase hover:text-white transition-colors"
          >
            Kora
          </Link>
          <span className="text-zinc-800">|</span>
          <span className="text-xs font-mono text-zinc-600 hidden sm:block">Gate 1 — Vision Architect</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openMobileArtifacts('actions')}
            className="lg:hidden text-xs text-zinc-500 border border-zinc-800/70 rounded-md px-2.5 py-1 hover:border-sky-800/50 hover:text-sky-300 transition-all"
          >
            Actions
          </button>
          {parkedCount > 0 && (
            <button
              onClick={() => openMobileArtifacts('parking')}
              className="flex items-center gap-1.5 text-xs text-amber-400/80 border border-amber-400/20 rounded-md px-2.5 py-1 hover:border-amber-400/40 hover:text-amber-400 transition-colors"
            >
              {parkedCount} deferred
            </button>
          )}
          <button
            onClick={copyUrl}
            className="hidden sm:block text-xs text-zinc-500 border border-zinc-800/70 rounded-md px-2.5 py-1 hover:border-violet-800/50 hover:text-violet-300 transition-all font-mono"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <Link
            href={`/session/${sessionId}/view`}
            className="hidden sm:block text-xs text-zinc-500 border border-zinc-800/70 rounded-md px-2.5 py-1 hover:border-violet-800/50 hover:text-violet-300 transition-all"
          >
            Share ↗
          </Link>
          <button
            onClick={startNewSession}
            disabled={newSessionLoading}
            className="text-xs text-zinc-500 border border-zinc-800/70 rounded-md px-2.5 py-1 hover:border-violet-800/50 hover:text-violet-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {newSessionLoading ? 'Starting…' : 'New session'}
          </button>
          <span className="text-xs font-mono text-zinc-700 hidden sm:block">{sessionId.slice(0, 8)}</span>
        </div>
      </header>

      {/* Error banner */}
      {hasError && (
        <div className="shrink-0 flex items-center gap-3 bg-red-950/60 border-b border-red-800/40 px-6 py-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          <span className="text-xs text-red-300">Something went wrong. Please try sending your message again.</span>
        </div>
      )}

      {/* Mobile artifacts overlay */}
      {showMobileArtifacts && (
        <div className="lg:hidden fixed inset-0 z-50 bg-zinc-950 flex flex-col">
          <div className="shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-zinc-800/60">
            <div className="flex items-center gap-1">
              <button onClick={() => setActiveTab('vision')} className={mobileTabClass('vision', 'violet')}>
                Vision
              </button>
              <button onClick={() => setActiveTab('actions')} className={mobileTabClass('actions', 'sky')}>
                Actions{actionProgress.total > 0 ? ` (${actionProgress.done}/${actionProgress.total})` : ''}
              </button>
              <button onClick={() => setActiveTab('parking')} className={mobileTabClass('parking', 'amber')}>
                Deferred{parkedCount > 0 ? ` (${parkedCount})` : ''}
              </button>
            </div>
            <button
              onClick={() => setShowMobileArtifacts(false)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm px-2 py-1"
            >
              ✕ Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{renderTabContent()}</div>
          {renderExportFooter(true)}
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Chat column */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
            {visibleMessages.length === 0 && (
              <div className="flex items-center gap-2 text-zinc-600 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 animate-pulse" />
                <span>Initializing session...</span>
              </div>
            )}

            {visibleMessages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="shrink-0 mt-0.5 w-5 h-5 rounded border border-violet-700/50 bg-violet-950/50 flex items-center justify-center">
                    <span className="text-[9px] font-bold font-mono text-violet-400">K</span>
                  </div>
                )}
                <div
                  className={`max-w-[76%] space-y-1.5 ${
                    message.role === 'user'
                      ? 'bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 rounded-xl px-4 py-3'
                      : 'text-zinc-200'
                  }`}
                >
                  {renderMessage(message)}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-4">
                <div className="shrink-0 mt-0.5 w-5 h-5 rounded border border-violet-700/50 bg-violet-950/50 flex items-center justify-center">
                  <span className="text-[9px] font-bold font-mono text-violet-400">K</span>
                </div>
                <div className="flex items-center gap-1 pt-1.5">
                  <span className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-zinc-800/60 p-4">
            {isCompleted ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-xs text-emerald-400 font-mono">Gate 1 complete. Start a new session for Gate 2.</span>
                </div>
                <button
                  onClick={startNewSession}
                  disabled={newSessionLoading}
                  className="text-xs text-zinc-400 border border-zinc-700 rounded-md px-3 py-1.5 hover:border-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-40"
                >
                  {newSessionLoading ? 'Starting…' : 'New session →'}
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="flex gap-3 items-end">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSubmit(e as unknown as React.FormEvent)
                      }
                    }}
                    placeholder="Type your response..."
                    rows={3}
                    disabled={isLoading}
                    className="flex-1 bg-zinc-900/80 border border-zinc-800/70 rounded-lg px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:border-violet-600/50 focus:shadow-[0_0_12px_rgba(139,92,246,0.12)] disabled:opacity-50 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="px-5 py-3 bg-violet-600 text-white rounded-lg text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-violet-500 active:bg-violet-700 transition-all shadow-[0_0_16px_rgba(139,92,246,0.25)] hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] disabled:shadow-none"
                  >
                    Send
                  </button>
                </form>
                <p className="text-[11px] text-zinc-700 mt-2 ml-0.5">Shift+Enter for a new line</p>
              </>
            )}
          </div>
        </div>

        {/* Artifacts panel — hidden below lg */}
        <aside className="hidden lg:flex flex-col w-[400px] border-l border-zinc-800/60">
          {/* Tabs */}
          <div className="shrink-0 flex items-center gap-1 border-b border-zinc-800/60 px-4 pt-3">
            <button onClick={() => setActiveTab('vision')} className={tabClass('vision', 'violet')}>
              Vision
            </button>
            <button onClick={() => setActiveTab('actions')} className={tabClass('actions', 'sky')}>
              Actions{actionProgress.total > 0 ? ` (${actionProgress.done}/${actionProgress.total})` : ''}
            </button>
            <button onClick={() => setActiveTab('parking')} className={tabClass('parking', 'amber')}>
              Deferred{parkedCount > 0 ? ` (${parkedCount})` : ''}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">{renderTabContent()}</div>

          {/* Downloads */}
          {renderExportFooter(false)}
        </aside>
      </div>
    </div>
  )
}
