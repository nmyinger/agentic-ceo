'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage, type TextUIPart } from 'ai'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

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
  const [input, setInput] = useState('')
  const [vision, setVision] = useState(initialVision)
  const [parkingLot, setParkingLot] = useState(initialParkingLot)
  const [activeTab, setActiveTab] = useState<'vision' | 'parking'>('vision')
  const bottomRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  const { messages, sendMessage, status } = useChat({
    id: sessionId,
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    messages: toUIMessages(initialMessages),
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  // Auto-trigger opening question on fresh sessions
  useEffect(() => {
    if (initialMessages.length === 0 && !started.current) {
      started.current = true
      sendMessage({ text: TRIGGER })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time artifact updates via Supabase
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

  // Auto-scroll
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
      // v6 tool parts use type: 'tool-{toolName}'
      if (part.type === 'tool-emit_vision') {
        return (
          <p key={i} className="text-xs font-mono text-emerald-500">
            ↑ vision updated
          </p>
        )
      }
      if (part.type === 'tool-park_idea') {
        const idea = (part as { type: string; input?: { idea?: string } }).input?.idea
        return (
          <p key={i} className="text-xs font-mono text-amber-500">
            → parked: {idea}
          </p>
        )
      }
      return null
    })
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="shrink-0 border-b border-zinc-800 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold tracking-tight">Кора</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400 text-sm">Gate 1 — Vision Architect</span>
        </div>
        {parkedCount > 0 && (
          <button
            onClick={() => setActiveTab('parking')}
            className="text-xs text-amber-400 border border-amber-400/30 rounded px-2 py-1 hover:border-amber-400/60 transition-colors"
          >
            {parkedCount} parked
          </button>
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Chat column */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
            {visibleMessages.length === 0 && (
              <p className="text-zinc-600 text-sm italic">Starting session…</p>
            )}

            {visibleMessages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <span className="text-[10px] font-mono text-zinc-600 mt-1 shrink-0 select-none">К</span>
                )}
                <div
                  className={`max-w-[78%] space-y-1.5 ${
                    message.role === 'user'
                      ? 'bg-zinc-800 text-zinc-100 rounded-lg px-4 py-3'
                      : 'text-zinc-200'
                  }`}
                >
                  {renderMessage(message)}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <span className="text-[10px] font-mono text-zinc-600 mt-1 select-none">К</span>
                <p className="text-zinc-500 text-sm animate-pulse">…</p>
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
                placeholder="Your answer…"
                rows={3}
                disabled={isLoading}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-500 disabled:opacity-50 transition-colors"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-4 py-3 bg-zinc-100 text-zinc-900 rounded-lg text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white transition-colors"
              >
                Send
              </button>
            </form>
            <p className="text-[11px] text-zinc-700 mt-2">Shift+Enter for new line</p>
          </div>
        </div>

        {/* Artifacts panel — hidden below lg */}
        <aside className="hidden lg:flex flex-col w-[380px] border-l border-zinc-800">
          <div className="shrink-0 flex border-b border-zinc-800">
            <button
              onClick={() => setActiveTab('vision')}
              className={`flex-1 py-3 text-xs font-medium transition-colors ${
                activeTab === 'vision'
                  ? 'text-zinc-100 border-b-2 border-zinc-100 -mb-px'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              vision.md
            </button>
            <button
              onClick={() => setActiveTab('parking')}
              className={`flex-1 py-3 text-xs font-medium transition-colors ${
                activeTab === 'parking'
                  ? 'text-amber-400 border-b-2 border-amber-400 -mb-px'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              parking_lot.md{parkedCount > 0 ? ` (${parkedCount})` : ''}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'vision' ? (
              vision ? (
                <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {vision}
                </pre>
              ) : (
                <p className="text-zinc-600 text-xs italic leading-relaxed">
                  Not drafted yet. Кора generates vision.md once there is enough signal.
                </p>
              )
            ) : parkingLot ? (
              <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {parkingLot}
              </pre>
            ) : (
              <p className="text-zinc-600 text-xs italic leading-relaxed">No ideas parked yet.</p>
            )}
          </div>

          {(vision || parkingLot) && (
            <div className="shrink-0 border-t border-zinc-800 px-4 py-3 flex gap-4">
              {vision && (
                <button
                  onClick={() => download('vision.md', vision)}
                  className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  ↓ vision.md
                </button>
              )}
              {parkingLot && (
                <button
                  onClick={() => download('parking_lot.md', parkingLot)}
                  className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  ↓ parking_lot.md
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
