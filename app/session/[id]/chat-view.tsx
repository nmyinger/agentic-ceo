'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage, type TextUIPart } from 'ai'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { saveSession } from '@/lib/sessions'

const TRIGGER = '<<begin>>'

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

export function ChatView({
  sessionId,
  initialMessages,
  initialVision,
  initialParkingLot,
}: {
  sessionId: string
  initialMessages: DbMessage[]
  initialVision: string
  initialParkingLot: string
}) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [vision, setVision] = useState(initialVision)
  const [parkingLot, setParkingLot] = useState(initialParkingLot)
  const [activeTab, setActiveTab] = useState<'vision' | 'parking'>('vision')
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

  function openMobileArtifacts(tab: 'vision' | 'parking') {
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
      vision && `# Vision Document\n\n${vision}`,
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
        }
      )
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const parkedCount = parkingLot ? countParkingItems(parkingLot) : 0
  const visibleMessages = messages.filter((m) => getTextContent(m) !== TRIGGER)

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
      return null
    })
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="shrink-0 border-b border-zinc-800 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm font-semibold tracking-widest text-zinc-300 uppercase hover:text-zinc-100 transition-colors"
          >
            Kora
          </Link>
          <span className="text-zinc-800">|</span>
          <span className="text-xs font-mono text-zinc-500 hidden sm:block">Gate 1 — Vision Architect</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile: open artifacts overlay */}
          <button
            onClick={() => openMobileArtifacts('vision')}
            className="lg:hidden text-xs text-zinc-500 border border-zinc-800 rounded-md px-2.5 py-1 hover:border-zinc-700 hover:text-zinc-300 transition-colors"
          >
            Artifacts
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
            className="hidden sm:block text-xs text-zinc-500 border border-zinc-800 rounded-md px-2.5 py-1 hover:border-zinc-700 hover:text-zinc-300 transition-colors font-mono"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <Link
            href={`/session/${sessionId}/view`}
            className="hidden sm:block text-xs text-zinc-500 border border-zinc-800 rounded-md px-2.5 py-1 hover:border-zinc-700 hover:text-zinc-300 transition-colors"
          >
            Share ↗
          </Link>
          <button
            onClick={startNewSession}
            disabled={newSessionLoading}
            className="text-xs text-zinc-500 border border-zinc-800 rounded-md px-2.5 py-1 hover:border-zinc-700 hover:text-zinc-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
          <div className="shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-zinc-800">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('vision')}
                className={`px-3 py-2 text-xs font-medium rounded-t transition-colors ${
                  activeTab === 'vision' ? 'text-zinc-100' : 'text-zinc-500'
                }`}
              >
                Vision Draft
              </button>
              <button
                onClick={() => setActiveTab('parking')}
                className={`px-3 py-2 text-xs font-medium rounded-t transition-colors ${
                  activeTab === 'parking' ? 'text-amber-400' : 'text-zinc-500'
                }`}
              >
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
          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === 'vision' ? (
              vision ? (
                <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">{vision}</pre>
              ) : (
                <div className="space-y-4 py-1">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Vision Document</p>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Not drafted yet. Kora will generate your vision document once there is enough signal from the conversation.
                  </p>
                  <div className="border border-dashed border-zinc-800 rounded-lg p-4 space-y-2">
                    {['Wedge sentence', 'Customer persona', 'Core pain', 'Why now', 'Why you'].map((item) => (
                      <div key={item} className="flex items-center gap-2.5">
                        <span className="w-3 h-px bg-zinc-800" />
                        <span className="text-[11px] text-zinc-700">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : parkingLot ? (
              <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">{parkingLot}</pre>
            ) : (
              <div className="space-y-4 py-1">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Deferred Ideas</p>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Out-of-scope ideas are saved here — not discarded, just deferred until the right gate.
                </p>
              </div>
            )}
          </div>
          {(vision || parkingLot) && (
            <div className="shrink-0 border-t border-zinc-800 px-5 py-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-zinc-600 mr-1">Export</span>
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
              <div className="flex items-center gap-3">
                <button
                  onClick={copyUrl}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors font-mono"
                >
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
                <Link
                  href={`/session/${sessionId}/view`}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Share view ↗
                </Link>
              </div>
            </div>
          )}
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
                  <div className="shrink-0 mt-0.5 w-5 h-5 rounded border border-zinc-700 bg-zinc-900 flex items-center justify-center">
                    <span className="text-[9px] font-bold font-mono text-zinc-500">K</span>
                  </div>
                )}
                <div
                  className={`max-w-[76%] space-y-1.5 ${
                    message.role === 'user'
                      ? 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-xl px-4 py-3'
                      : 'text-zinc-200'
                  }`}
                >
                  {renderMessage(message)}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-4">
                <div className="shrink-0 mt-0.5 w-5 h-5 rounded border border-zinc-700 bg-zinc-900 flex items-center justify-center">
                  <span className="text-[9px] font-bold font-mono text-zinc-500">K</span>
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
          <div className="shrink-0 border-t border-zinc-800 p-4">
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
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-700 disabled:opacity-50 transition-colors"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-5 py-3 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white active:bg-zinc-200 transition-colors"
              >
                Send
              </button>
            </form>
            <p className="text-[11px] text-zinc-700 mt-2 ml-0.5">
              Shift+Enter for a new line
            </p>
          </div>
        </div>

        {/* Artifacts panel — hidden below lg */}
        <aside className="hidden lg:flex flex-col w-[400px] border-l border-zinc-800">
          {/* Tabs */}
          <div className="shrink-0 flex items-center gap-1 border-b border-zinc-800 px-4 pt-3">
            <button
              onClick={() => setActiveTab('vision')}
              className={`px-3 py-2 text-xs font-medium rounded-t transition-colors ${
                activeTab === 'vision'
                  ? 'text-zinc-100 bg-zinc-900 border border-zinc-700 border-b-transparent -mb-px'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Vision Draft
            </button>
            <button
              onClick={() => setActiveTab('parking')}
              className={`px-3 py-2 text-xs font-medium rounded-t transition-colors ${
                activeTab === 'parking'
                  ? 'text-amber-400 bg-zinc-900 border border-zinc-700 border-b-transparent -mb-px'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Deferred{parkedCount > 0 ? ` (${parkedCount})` : ''}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === 'vision' ? (
              vision ? (
                <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {vision}
                </pre>
              ) : (
                <div className="space-y-4 py-1">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Vision Document
                  </p>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Not drafted yet. Kora will generate your vision document once
                    there is enough signal from the conversation.
                  </p>
                  <div className="border border-dashed border-zinc-800 rounded-lg p-4 space-y-2">
                    {['Wedge sentence', 'Customer persona', 'Core pain', 'Why now', 'Why you'].map(
                      (item) => (
                        <div key={item} className="flex items-center gap-2.5">
                          <span className="w-3 h-px bg-zinc-800" />
                          <span className="text-[11px] text-zinc-700">{item}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )
            ) : parkingLot ? (
              <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {parkingLot}
              </pre>
            ) : (
              <div className="space-y-4 py-1">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Deferred Ideas
                </p>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Out-of-scope ideas are saved here — not discarded, just deferred
                  until the right gate.
                </p>
              </div>
            )}
          </div>

          {/* Downloads */}
          {(vision || parkingLot) && (
            <div className="shrink-0 border-t border-zinc-800 px-5 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-600 mr-1">Export</span>
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
              <Link
                href={`/session/${sessionId}/view`}
                className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <span>Share read-only view</span>
                <span>↗</span>
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
