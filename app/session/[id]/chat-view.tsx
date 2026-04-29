'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage, type TextUIPart } from 'ai'
import { useState, useEffect, useRef } from 'react'
import { createClient, type RealtimeChannel } from '@supabase/supabase-js'
import { saveSession, loadSessions } from '@/lib/sessions'
import { Prose } from '@/components/prose'

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
  const { done, total } = countCompletedActions(content)
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-sky-400/80 uppercase tracking-wider">Action Plan</span>
          {total > 0 && (
            <span className="text-[11px] font-mono text-sky-400/80">{done} / {total}</span>
          )}
        </div>
        {total > 0 && (
          <div className="h-[3px] w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.round((done / total) * 100)}%` }}
            />
          </div>
        )}
      </div>
      <div className="space-y-1">
        {content.split('\n').map((line, i) => {
          if (line.startsWith('# ')) {
            return (
              <p key={i} className="text-xs font-semibold text-sky-400/70 uppercase tracking-wider pb-2">
                {line.slice(2)}
              </p>
            )
          }
          if (line.startsWith('## ')) {
            return (
              <p key={i} className="text-[11px] font-semibold text-sky-600 uppercase tracking-wider pt-4 pb-1 first:pt-0">
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
                <span className="mt-0.5 w-3.5 h-3.5 rounded border border-sky-800/70 shrink-0 bg-zinc-900/80" />
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
    </div>
  )
}

function parseParkingLot(content: string) {
  return content
    .split('\n')
    .filter((l) => l.startsWith('|') && !l.includes('Date') && !l.includes('----'))
    .map((l) => {
      const cols = l.split('|').map((c) => c.trim()).filter(Boolean)
      return { date: cols[0] ?? '', idea: cols[1] ?? '', reason: cols[2] ?? '' }
    })
    .filter((item) => item.idea)
}

function DeferredList({ content }: { content: string }) {
  const items = parseParkingLot(content)
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-amber-500/80 uppercase tracking-wider">Deferred Ideas</span>
        <span className="text-[11px] font-mono text-amber-500/80">{items.length}</span>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="pl-3 border-l-2 border-amber-900/60 space-y-0.5 py-0.5">
            <p className="text-xs text-zinc-200 leading-snug">{item.idea}</p>
            <p className="text-[11px] text-zinc-500 leading-snug">{item.reason}</p>
            <p className="text-[10px] font-mono text-zinc-700">{item.date}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Vision progress tracker ─────────────────────────────────────────────────

const VISION_SECTIONS = [
  { key: 'wedge',   heading: 'The Wedge',  label: 'Wedge Sentence' },
  { key: 'user',    heading: 'The User',   label: 'Customer Persona' },
  { key: 'pain',    heading: 'The Pain',   label: 'Core Pain' },
  { key: 'change',  heading: 'The Change', label: 'The Change' },
  { key: 'whynow',  heading: 'Why Now',    label: 'Why Now' },
  { key: 'whyyou',  heading: 'Why You',    label: 'Why You' },
]

function parseVisionDocument(markdown: string) {
  const titleMatch = markdown.match(/^#\s+(.+)$/m)
  const title = titleMatch?.[1]?.trim() ?? ''

  // Locate all ## headings by position
  const headingRegex = /^##\s+(.+)$/gm
  const headings: { heading: string; contentStart: number; start: number }[] = []
  let m: RegExpExecArray | null
  while ((m = headingRegex.exec(markdown)) !== null) {
    headings.push({
      heading: m[1].trim(),
      start: m.index,
      contentStart: m.index + m[0].length + 1,
    })
  }

  const sectionMap: Record<string, string> = {}
  for (let i = 0; i < headings.length; i++) {
    const { heading, contentStart } = headings[i]
    const end = headings[i + 1]?.start ?? markdown.length
    sectionMap[heading] = markdown.slice(contentStart, end).trim()
  }

  const sections = VISION_SECTIONS.map((s) => {
    const content = sectionMap[s.heading] ?? ''
    const complete = content.length > 0 && !/^\[TBD\]$/i.test(content.trim())
    return { ...s, content, complete }
  })

  return { title, sections }
}

const PROGRESS_PHRASES = [
  'Listening…',
  'Working on it…',
  'Building the picture…',
  'Narrowing in…',
  'Almost there…',
]

function VisionProgress({ content, messageCount }: { content: string; messageCount: number }) {
  const { title, sections } = parseVisionDocument(content)
  const completedCount = sections.filter((s) => s.complete).length
  const nextIdx = sections.findIndex((s) => !s.complete)
  const hasStarted = content.length > 0
  const progressPhrase = PROGRESS_PHRASES[Math.min(Math.floor(messageCount / 4), PROGRESS_PHRASES.length - 1)]

  // Feature 2: Vision Velocity Pulse — briefly animate newly-completed section dots
  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(new Set())
  const prevCompletedRef = useRef<Set<string>>(new Set())
  const completedKeys = sections.filter((s) => s.complete).map((s) => s.key).join(',')

  useEffect(() => {
    const nowCompleted = new Set(sections.filter((s) => s.complete).map((s) => s.key))
    const newlyCompleted = [...nowCompleted].filter((key) => !prevCompletedRef.current.has(key))
    if (newlyCompleted.length > 0) {
      setRecentlyCompleted((prev) => {
        const next = new Set(prev)
        newlyCompleted.forEach((key) => next.add(key))
        return next
      })
      newlyCompleted.forEach((key) => {
        setTimeout(() => {
          setRecentlyCompleted((prev) => {
            const next = new Set(prev)
            next.delete(key)
            return next
          })
        }, 8000)
      })
    }
    prevCompletedRef.current = nowCompleted
  }, [completedKeys]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      {/* Progress header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-violet-400/80 uppercase tracking-wider">
            Vision Progress
          </span>
          <span className="text-[11px] font-mono text-violet-400/80">
            {completedCount} / {sections.length}
          </span>
        </div>

        {/* Segmented bar */}
        <div className="flex gap-1">
          {sections.map((s, i) => (
            <div
              key={s.key}
              className={[
                'h-[3px] flex-1 rounded-full transition-all duration-700',
                s.complete
                  ? 'bg-emerald-500'
                  : i === nextIdx && hasStarted
                  ? 'animate-shimmer'
                  : 'bg-zinc-800',
              ].join(' ')}
            />
          ))}
        </div>
      </div>

      {/* Title + draft sections */}
      <div className="space-y-1">
        {/* Document title */}
        {title ? (
          <p className="text-sm font-semibold text-zinc-200 leading-snug pb-3">{title}</p>
        ) : hasStarted ? (
          <p className="text-xs text-zinc-700 italic pb-3">Working title pending…</p>
        ) : (
          <p className="text-[11px] text-zinc-600 leading-relaxed pb-3">
            Kora will fill each section as you answer. Complete all six to pass Gate 1.
          </p>
        )}

        {sections.map((s, i) => {
          const isNext = i === nextIdx && hasStarted
          const isFuture = !s.complete && !isNext

          return (
            <div
              key={s.key}
              className={[
                'group transition-opacity duration-300',
                isFuture ? 'opacity-30' : '',
              ].join(' ')}
            >
              {/* Section row */}
              <div className="flex items-center gap-2.5 py-2">
                {/* Status dot */}
                <div className="shrink-0 w-4 h-4 flex items-center justify-center relative">
                  {s.complete ? (
                    <>
                      {recentlyCompleted.has(s.key) && (
                        <span className="absolute inset-0 rounded-full bg-emerald-400/25 animate-ping" />
                      )}
                      <span className="relative z-10 w-4 h-4 rounded-full bg-emerald-950/70 border border-emerald-600/60 flex items-center justify-center">
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3L3 5L7 1" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    </>
                  ) : isNext ? (
                    <span className="w-4 h-4 rounded-full border-2 border-violet-500/70 bg-violet-950/40 animate-pulse" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-zinc-700/60" />
                  )}
                </div>

                <p
                  className={[
                    'text-[11px] font-semibold uppercase tracking-wider',
                    s.complete ? 'text-zinc-400' : isNext ? 'text-violet-300' : 'text-zinc-600',
                  ].join(' ')}
                >
                  {s.label}
                </p>
              </div>

              {/* Full draft content — always visible when available */}
              {/* Feature 4: Wedge Sentence Spotlight — violet accent on the wedge, emerald on others */}
              {s.complete && s.content && (
                <div className={`ml-[26px] mb-3 pl-3 border-l-2 [&_p]:text-xs [&_p]:text-zinc-300 [&_p]:leading-relaxed [&_p]:mb-1 [&_strong]:text-zinc-200 ${s.key === 'wedge' ? 'border-violet-600/60' : 'border-emerald-900/50'}`}>
                  <Prose>{s.content}</Prose>
                </div>
              )}

              {/* Active section placeholder */}
              {isNext && (
                <div className="ml-[26px] mb-3 pl-3 border-l-2 border-violet-900/40">
                  <p className="text-[11px] text-violet-800 italic transition-all duration-500">{progressPhrase}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
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
  const draftKey = `kora-draft-${sessionId}`
  // Feature 10: Draft Continuity Cursor — restore unfinished draft from sessionStorage
  const [input, setInput] = useState(() =>
    typeof window !== 'undefined' ? (sessionStorage.getItem(draftKey) ?? '') : ''
  )
  const [vision, setVision] = useState(initialVision)
  const [parkingLot, setParkingLot] = useState(initialParkingLot)
  const [actions, setActions] = useState(initialActions)
  const [activeTab, setActiveTab] = useState<Tab>('actions')
  const [showMobileArtifacts, setShowMobileArtifacts] = useState(false)
  const [closingSheet, setClosingSheet] = useState(false)
  const [newSessionLoading, setNewSessionLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [liveStreamContent, setLiveStreamContent] = useState<string | null>(null)
  const [peerInput, setPeerInput] = useState('')
  const [peerCount, setPeerCount] = useState(0)
  const [showIdleHint, setShowIdleHint] = useState(false)
  const [parkingBadgePulse, setParkingBadgePulse] = useState(false)
  const peerIdRef = useRef(Math.random().toString(36).slice(2))
  const peerLastSeenRef = useRef<Map<string, number>>(new Map())
  const prevMessageCountRef = useRef(0)
  const [latestMessageId, setLatestMessageId] = useState<string | null>(null)
  // Feature 5: Return Visitor Greeting — shown briefly when returning to an existing session
  const isReturn = typeof window !== 'undefined'
    && loadSessions().some((s) => s.id === sessionId)
    && initialMessages.length > 0
    && initialVision !== ''
  const [showReturnGreet, setShowReturnGreet] = useState(isReturn)
  const bottomRef = useRef<HTMLDivElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const [showScrollPill, setShowScrollPill] = useState(false)
  const [flashProgress, setFlashProgress] = useState(false)
  const prevVisionProgressRef = useRef(0)
  const [shakeInput, setShakeInput] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const started = useRef(false)
  const typingChannelRef = useRef<RealtimeChannel | null>(null)
  const peerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollPillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Prevents realtime INSERT from duplicating the active sender's assistant reply (useChat already owns it)
  const waitingForResponseRef = useRef(false)

  const { messages, setMessages, sendMessage, status } = useChat({
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

  function closeSheet() {
    setClosingSheet(true)
    setTimeout(() => {
      setShowMobileArtifacts(false)
      setClosingSheet(false)
    }, 260)
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

  // Derived values — must be declared before useEffects that reference them
  const parkedCount = parkingLot ? countParkingItems(parkingLot) : 0
  const actionProgress = actions ? countCompletedActions(actions) : { done: 0, total: 0 }
  const visionProgress = vision.length > 0
    ? Math.round((parseVisionDocument(vision).sections.filter((s) => s.complete).length / 6) * 100)
    : 0
  const visibleMessages = messages.filter((m) => !getTextContent(m).startsWith('<<'))
  const isCompleted =
    initialStatus === 'completed' ||
    messages.some((m) => m.parts.some((p) => p.type === 'tool-mark_complete'))
  // Feature 7: Wedge Recitation Hint — changes placeholder when all 6 sections are complete
  const allSectionsComplete = vision.length > 0 && parseVisionDocument(vision).sections.every((s) => s.complete)

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

    // Layer 1 + 2: postgres_changes for artifacts, messages, and live streaming state
    const dbChannel = sb
      .channel(`session-db-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'artifacts', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as { type: string; content: string }
          if (row.type === 'vision') setVision(row.content)
          if (row.type === 'parking_lot') setParkingLot(row.content)
          if (row.type === 'actions') setActions(row.content)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as { id: string; role: 'user' | 'assistant'; content: string }
          setMessages((prev) => {
            // If this client sent the message, useChat already owns it — skip the realtime echo
            if (row.role === 'assistant' && waitingForResponseRef.current) {
              waitingForResponseRef.current = false
              return prev
            }
            // Skip if this client already has the message (text-based dedup for user messages)
            if (prev.some((m) => getTextContent(m) === row.content && m.role === row.role)) return prev
            return [...prev, { id: row.id, role: row.role, parts: [{ type: 'text' as const, text: row.content }] }]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_streams', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setLiveStreamContent(null)
          } else {
            const row = payload.new as { content: string }
            setLiveStreamContent(row.content)
          }
        }
      )
      .subscribe()

    // Layer 3: broadcast channel for live typing sync
    const typingChannel = sb.channel(`typing-${sessionId}`, {
      config: { broadcast: { self: false } },
    })
    typingChannel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const text = (payload as { text: string }).text ?? ''
        if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current)
        setPeerInput(text)
        if (text) {
          peerTypingTimerRef.current = setTimeout(() => setPeerInput(''), 3000)
        }
      })
      // Feature 8: Peer Presence Heartbeat — track other viewers via 30s pings
      .on('broadcast', { event: 'presence' }, ({ payload }) => {
        const id = (payload as { id: string }).id
        if (id && id !== peerIdRef.current) {
          peerLastSeenRef.current.set(id, Date.now())
        }
      })
      .subscribe()

    typingChannelRef.current = typingChannel

    // Send own heartbeat every 30s
    const heartbeatInterval = setInterval(() => {
      typingChannelRef.current?.send({
        type: 'broadcast',
        event: 'presence',
        payload: { id: peerIdRef.current },
      }).catch(() => {})
    }, 30_000)

    // Sweep stale peers every 15s (timeout = 45s)
    const sweepInterval = setInterval(() => {
      const cutoff = Date.now() - 45_000
      for (const [id, ts] of peerLastSeenRef.current) {
        if (ts < cutoff) peerLastSeenRef.current.delete(id)
      }
      setPeerCount(peerLastSeenRef.current.size)
    }, 15_000)

    return () => {
      if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current)
      clearInterval(heartbeatInterval)
      clearInterval(sweepInterval)
      sb.removeChannel(dbChannel)
      sb.removeChannel(typingChannel)
    }
  }, [sessionId])

  useEffect(() => {
    const chat = chatScrollRef.current
    if (!chat) return
    const nearBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 80
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Show scroll-to-bottom pill when bottomRef leaves the chat container's visible area.
  // Appearance is debounced so a brief scroll gesture doesn't flash the pill.
  useEffect(() => {
    const el = bottomRef.current
    const root = chatScrollRef.current
    if (!el || !root) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          scrollPillTimerRef.current = setTimeout(() => setShowScrollPill(true), 400)
        } else {
          if (scrollPillTimerRef.current) clearTimeout(scrollPillTimerRef.current)
          setShowScrollPill(false)
        }
      },
      { root, threshold: 0 }
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (scrollPillTimerRef.current) clearTimeout(scrollPillTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
    // Keep chat anchored to bottom while typing so textarea growth doesn't un-pin the user
    const chat = chatScrollRef.current
    if (chat && chat.scrollHeight - chat.scrollTop - chat.clientHeight < 100) {
      chat.scrollTop = chat.scrollHeight
    }
  }, [input])

  useEffect(() => {
    if (!isLoading) textareaRef.current?.focus()
  }, [isLoading])

  // Feature 5: auto-dismiss return greeting
  useEffect(() => {
    if (!isReturn) return
    const t = setTimeout(() => setShowReturnGreet(false), 2000)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Feature 3: Silence Timer — show a calm nudge after 90s of inactivity
  useEffect(() => {
    if (isLoading || isCompleted) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      setShowIdleHint(false)
      return
    }
    idleTimerRef.current = setTimeout(() => setShowIdleHint(true), 90_000)
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [isLoading, isCompleted])

  // Micro 3: Message slide-fade — animate only the newest incoming message
  useEffect(() => {
    if (visibleMessages.length > prevMessageCountRef.current) {
      const newest = visibleMessages[visibleMessages.length - 1]
      if (newest) {
        setLatestMessageId(newest.id)
        const t = setTimeout(() => setLatestMessageId(null), 400)
        prevMessageCountRef.current = visibleMessages.length
        return () => clearTimeout(t)
      }
    }
    prevMessageCountRef.current = visibleMessages.length
  }, [visibleMessages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Flash the header progress bar when a vision section completes
  useEffect(() => {
    if (visionProgress > prevVisionProgressRef.current && visionProgress > 0) {
      setFlashProgress(true)
      const t = setTimeout(() => setFlashProgress(false), 500)
      prevVisionProgressRef.current = visionProgress
      return () => clearTimeout(t)
    }
    prevVisionProgressRef.current = visionProgress
  }, [visionProgress])

  // Shake the input when an error appears
  useEffect(() => {
    if (!hasError) return
    navigator.vibrate?.([10, 50, 10])
    setShakeInput(true)
    const t = setTimeout(() => setShakeInput(false), 350)
    return () => clearTimeout(t)
  }, [hasError])

  // Lock body scroll when bottom sheet is open (prevents iOS bounce on backdrop)
  useEffect(() => {
    document.body.classList.toggle('sheet-open', showMobileArtifacts)
    return () => document.body.classList.remove('sheet-open')
  }, [showMobileArtifacts])

  // Feature 6: Deferred Badge Pulse — flash amber when parkedCount increases
  const prevParkedRef = useRef(parkedCount)
  useEffect(() => {
    if (parkedCount > prevParkedRef.current) {
      setParkingBadgePulse(true)
      const t = setTimeout(() => setParkingBadgePulse(false), 2000)
      prevParkedRef.current = parkedCount
      return () => clearTimeout(t)
    }
    prevParkedRef.current = parkedCount
  }, [parkedCount])

  // Feature 1: Live Tab Title
  useEffect(() => {
    const { title } = parseVisionDocument(vision)
    if (isLoading) {
      document.title = 'Kora is thinking…'
    } else if (isCompleted && title) {
      document.title = `${title} — Kora`
    } else if (title) {
      document.title = `${title} — Kora`
    } else {
      document.title = 'Kora — Vision Architect'
    }
    return () => { document.title = 'Kora — Vision Architect' }
  }, [vision, isLoading, isCompleted])

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value
    setInput(text)
    sessionStorage.setItem(draftKey, text)
    if (showIdleHint) setShowIdleHint(false)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    typingChannelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { text },
    }).catch(() => {})
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return
    navigator.vibrate?.(10)
    setInput('')
    sessionStorage.removeItem(draftKey)
    setShowIdleHint(false)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    // Clear peer typing display immediately on send
    typingChannelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { text: '' },
    }).catch(() => {})
    waitingForResponseRef.current = true
    sendMessage({ text })
    textareaRef.current?.focus()
  }

  function renderMessage(msg: UIMessage) {
    const textParts: TextUIPart[] = []
    const sideTools: { type: string; input?: Record<string, unknown> }[] = []
    let completePart: { wedge_sentence?: string } | null = null

    for (const part of msg.parts) {
      if (part.type === 'text') {
        textParts.push(part as TextUIPart)
      } else if (part.type === 'tool-mark_complete') {
        completePart = ((part as { type: string; input?: { wedge_sentence?: string } }).input) ?? {}
      } else {
        sideTools.push(part as { type: string; input?: Record<string, unknown> })
      }
    }

    return (
      <>
        {textParts.map((p, i) => p.text ? <div key={i}><Prose>{p.text}</Prose></div> : null)}
        {sideTools.length > 0 && (
          <div className="flex flex-wrap gap-x-4 mt-2 opacity-40">
            {sideTools.map((part, i) => {
              if (part.type === 'tool-emit_actions') {
                return <span key={i} className="text-[10px] font-mono text-sky-400 tracking-wide">↻ actions</span>
              }
              if (part.type === 'tool-emit_vision') {
                return <span key={i} className="text-[10px] font-mono text-emerald-400 tracking-wide">↻ vision</span>
              }
              if (part.type === 'tool-park_idea') {
                const idea = (part.input as { idea?: string } | undefined)?.idea
                return <span key={i} className="text-[10px] font-mono text-amber-400 tracking-wide">⊞{idea ? ` ${idea}` : ' parked'}</span>
              }
              return null
            })}
          </div>
        )}
        {completePart !== null && (
          <div className="mt-2 border border-emerald-800/40 bg-emerald-950/30 rounded-lg px-4 py-3 space-y-1 animate-in fade-in-0 duration-500">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-xs font-mono text-emerald-400 font-semibold">Gate 1 complete</span>
            </div>
            {completePart.wedge_sentence && (
              <p className="text-xs text-emerald-300/70 italic leading-relaxed">&ldquo;{completePart.wedge_sentence}&rdquo;</p>
            )}
          </div>
        )}
      </>
    )
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
      return <VisionProgress content={vision} messageCount={visibleMessages.length} />
    }

    if (activeTab === 'actions') {
      return actions ? (
        <ActionPlan content={actions} />
      ) : (
        <div className="space-y-4 py-1">
          <p className="text-xs font-semibold text-sky-400/70 uppercase tracking-wider">Action Plan</p>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Your action plan will appear here as the conversation starts — concrete steps you can take today.
          </p>
          <div className="border border-dashed border-zinc-800/80 rounded-lg p-4 space-y-2.5">
            {['Do Now', 'Complete This Week', 'Gate 1 Exit Checklist'].map((item) => (
              <div key={item} className="flex items-center gap-2.5">
                <span className="w-3.5 h-3.5 rounded border border-sky-900/60 shrink-0" />
                <span className="text-[11px] text-zinc-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (activeTab === 'parking') {
      return parkingLot ? (
        <DeferredList content={parkingLot} />
      ) : (
        <div className="space-y-4 py-1">
          <p className="text-xs font-semibold text-amber-500/70 uppercase tracking-wider">Deferred Ideas</p>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Out-of-scope ideas land here — not discarded, just deferred until the right gate.
          </p>
          <div className="border border-dashed border-zinc-800/80 rounded-lg p-4 space-y-2.5">
            {['Second persona or market', 'Extra features', 'Partnership ideas'].map((item) => (
              <div key={item} className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-900/60 shrink-0" />
                <span className="text-[11px] text-zinc-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }
  }

  // ─── Shared export footer ─────────────────────────────────────────────────
  function renderExportFooter(mobile = false) {
    const hasAny = vision || actions || parkingLot
    if (!hasAny) return null
    const btnClass = 'text-[11px] font-mono text-zinc-500 hover:text-zinc-200 border border-zinc-800/70 hover:border-zinc-700 rounded px-2.5 py-1 transition-colors'

    return (
      <div className="shrink-0 border-t border-zinc-800/60 px-5 py-4 space-y-3">
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
    <div className="flex flex-col h-[100dvh] bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header
        className="relative shrink-0 border-b border-zinc-800/60 px-4 sm:px-6 pb-3.5 flex items-center justify-between bg-zinc-950/90 backdrop-blur-md"
        style={{ paddingTop: 'max(14px, calc(14px + var(--safe-top)))' }}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/"
            className="text-sm font-semibold tracking-widest text-zinc-200 uppercase hover:text-white transition-colors"
          >
            Kora
          </Link>
          <span className="text-zinc-800 hidden sm:block">|</span>
          <span className="text-xs font-mono text-zinc-600 hidden sm:block">Gate 1 — Vision Architect</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mobile: Vision shortcut button */}
          <button
            onClick={() => openMobileArtifacts('vision')}
            className="lg:hidden min-h-[36px] flex items-center gap-1.5 text-xs text-violet-400/70 border border-violet-800/30 rounded-md px-3 py-2 hover:border-violet-600/50 hover:text-violet-300 transition-all"
          >
            Vision
            {visionProgress > 0 && (
              <span className={`w-1.5 h-1.5 rounded-full ${allSectionsComplete ? 'bg-emerald-500' : 'bg-violet-700'}`} />
            )}
          </button>
          {/* Mobile: Actions shortcut */}
          <button
            onClick={() => openMobileArtifacts('actions')}
            className="lg:hidden min-h-[36px] flex items-center text-xs text-zinc-500 border border-zinc-800/70 rounded-md px-3 py-2 hover:border-sky-800/50 hover:text-sky-300 transition-all"
          >
            Actions
          </button>
          {parkedCount > 0 && (
            <button
              onClick={() => openMobileArtifacts('parking')}
              className={`flex items-center gap-1.5 min-h-[36px] text-xs text-amber-400/80 border border-amber-400/20 rounded-md px-3 py-2 hover:border-amber-400/40 hover:text-amber-400 transition-colors ${parkingBadgePulse ? 'animate-badge-bounce' : ''}`}
            >
              {parkedCount} deferred
            </button>
          )}
          <button
            onClick={copyUrl}
            className="hidden sm:flex items-center text-xs text-zinc-500 border border-zinc-800/70 rounded-md px-3 py-2 min-h-[36px] hover:border-violet-800/50 hover:text-violet-300 transition-all font-mono"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <Link
            href={`/session/${sessionId}/view`}
            className="hidden sm:flex items-center text-xs text-zinc-500 border border-zinc-800/70 rounded-md px-3 py-2 min-h-[36px] hover:border-violet-800/50 hover:text-violet-300 transition-all"
          >
            Share ↗
          </Link>
          <button
            onClick={startNewSession}
            disabled={newSessionLoading}
            className="hidden sm:flex items-center text-xs text-zinc-500 border border-zinc-800/70 rounded-md px-3 py-2 min-h-[36px] hover:border-violet-800/50 hover:text-violet-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {newSessionLoading ? 'Starting…' : 'New session'}
          </button>
          {peerCount > 0 && (
            <span className="text-xs font-mono text-zinc-700 hidden sm:block">
              {peerCount} other viewer{peerCount > 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={copyUrl}
            className="hidden sm:block text-xs font-mono text-zinc-700 hover:text-violet-400 transition-colors duration-150"
            title="Copy share link"
          >
            {copied ? <span className="text-violet-400">copied</span> : sessionId.slice(0, 8)}
          </button>
        </div>
        {/* Mobile vision progress bar — thin indicator at bottom of header */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-800/40 lg:hidden">
          <div
            className={`h-full bg-violet-500/60 transition-all duration-700 ${flashProgress ? 'animate-progress-flash' : ''}`}
            style={{ width: `${visionProgress}%` }}
          />
        </div>
      </header>

      {/* Error banner */}
      {hasError && (
        <div className="shrink-0 flex items-center gap-3 bg-red-950/60 border-b border-red-800/40 px-6 py-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          <span className="text-xs text-red-300">Something went wrong. Please try sending your message again.</span>
        </div>
      )}

      {/* Mobile artifacts — bottom sheet */}
      {showMobileArtifacts && (
        <div
          className="lg:hidden fixed inset-0 z-50"
          onClick={closeSheet}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in-0 duration-200" />
          {/* Sheet */}
          <div
            className={`absolute bottom-0 left-0 right-0 flex flex-col bg-zinc-900 border-t border-zinc-800/60 rounded-t-2xl ${closingSheet ? 'animate-sheet-down' : 'animate-sheet-up'}`}
            style={{ maxHeight: '88dvh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="shrink-0 flex justify-center pt-3 pb-1 no-callout">
              <div className="animate-handle-hello h-1 rounded-full bg-zinc-600" />
            </div>
            {/* Tab row */}
            <div className="shrink-0 flex items-center gap-1 border-b border-zinc-800/60 px-4 pt-1 pb-0">
              <button
                onClick={() => setActiveTab('vision')}
                className={`${mobileTabClass('vision', 'violet')} min-h-[44px] inline-flex items-center gap-1.5`}
              >
                Vision
                {vision.length > 0 && (
                  <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-700 ${allSectionsComplete ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                )}
              </button>
              <button
                onClick={() => setActiveTab('actions')}
                className={`${mobileTabClass('actions', 'sky')} min-h-[44px]`}
              >
                Actions{actionProgress.total > 0 ? ` (${actionProgress.done}/${actionProgress.total})` : ''}
              </button>
              <button
                onClick={() => setActiveTab('parking')}
                className={`${mobileTabClass('parking', 'amber')} min-h-[44px]`}
              >
                Deferred{parkedCount > 0 ? <span className={parkingBadgePulse ? 'animate-pulse text-amber-300' : ''}> ({parkedCount})</span> : null}
              </button>
              <button
                onClick={closeSheet}
                className="ml-auto min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-5 overscroll-contain" data-scroll>
              {renderTabContent()}
            </div>
            {/* Export footer + home indicator clearance */}
            <div className="shrink-0 pb-safe-sheet">
              {renderExportFooter(true)}
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Chat column */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Scroll area wrapper — pill is scoped here so it never overlaps the input */}
          <div className="relative flex-1 min-h-0">
          <div ref={chatScrollRef} className="h-full overflow-y-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5 sm:space-y-6 overscroll-contain" data-scroll>
            {/* Feature 5: Return Visitor Greeting */}
            {showReturnGreet && (
              <p className="text-xs font-mono text-zinc-600">
                Resuming — {initialMessages.filter((m) => m.role === 'user').length} exchanges,{' '}
                {parseVisionDocument(initialVision).sections.filter((s) => s.complete).length} sections complete.
              </p>
            )}

            {visibleMessages.length === 0 && (
              <div className="flex items-center gap-2 text-zinc-600 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 animate-pulse" />
                <span>Initializing session...</span>
              </div>
            )}

            {visibleMessages.map((message, idx) => {
              const isStreamingThis =
                status === 'streaming' &&
                message.role === 'assistant' &&
                idx === visibleMessages.length - 1
              return (
                <div
                  key={message.id}
                  data-message
                  className={`flex gap-3 sm:gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'} ${message.id === latestMessageId ? (message.role === 'user' ? 'msg-enter-right' : 'msg-enter-left') : ''}`}
                >
                  {message.role === 'assistant' && (
                    <div className={`shrink-0 mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors duration-300 ${isStreamingThis ? 'border-violet-500 bg-violet-900/60' : 'border-violet-700/50 bg-violet-950/50'}`}>
                      <span className="text-[9px] font-bold font-mono text-violet-400">K</span>
                    </div>
                  )}
                  <div
                    className={`max-w-[88%] sm:max-w-[76%] space-y-1.5 ${
                      message.role === 'user'
                        ? 'bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 rounded-xl px-4 py-3'
                        : 'text-zinc-200'
                    }`}
                  >
                    {renderMessage(message)}
                    {/* Micro 1: streaming cursor */}
                    {isStreamingThis && (
                      <span className="inline-block w-px h-3.5 bg-zinc-400 animate-pulse align-middle ml-0.5" />
                    )}
                  </div>
                </div>
              )
            })}

            {/* Layer 2: live stream visible to passive viewers while active user's response streams */}
            {!isLoading && liveStreamContent && (
              <div className="flex gap-3 sm:gap-4">
                <div className="shrink-0 mt-0.5 w-5 h-5 rounded border border-violet-500 bg-violet-900/60 flex items-center justify-center transition-colors duration-300">
                  <span className="text-[9px] font-bold font-mono text-violet-400">K</span>
                </div>
                <div className="text-zinc-200 space-y-1.5 max-w-[88%] sm:max-w-[76%]">
                  <Prose>{liveStreamContent}</Prose>
                  {/* Micro 1: streaming cursor for passive viewer */}
                  <span className="inline-block w-px h-3.5 bg-zinc-400 animate-pulse align-middle ml-0.5" />
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex gap-3 sm:gap-4">
                <div className="shrink-0 mt-0.5 w-5 h-5 rounded border border-violet-500 bg-violet-900/60 flex items-center justify-center transition-colors duration-300">
                  <span className="text-[9px] font-bold font-mono text-violet-400">K</span>
                </div>
                <div className="flex items-center gap-1 pt-1.5">
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-500" />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-500" />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-500" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Scroll-to-bottom pill — pinned to bottom of scroll area, never overlaps input */}
          {showScrollPill && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <button
                onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="pointer-events-auto flex items-center bg-zinc-800/90 backdrop-blur-sm border border-zinc-700/60 text-zinc-300 text-xs font-mono px-3 py-1.5 rounded-full shadow-lg animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
              >
                ↓
              </button>
            </div>
          )}
          </div>{/* end scroll area wrapper */}

          {/* Input */}
          <div
            className="shrink-0 border-t border-zinc-800/60 px-4 pt-4"
            style={{ paddingBottom: 'max(16px, calc(16px + var(--safe-bottom)))' }}
          >
            {isCompleted ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-xs text-emerald-400 font-mono">Gate 1 complete. Start a new session for Gate 2.</span>
                  </div>
                  <button
                    onClick={startNewSession}
                    disabled={newSessionLoading}
                    className="text-xs text-zinc-400 border border-zinc-700 rounded-md px-3 min-h-[40px] flex items-center hover:border-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-40"
                  >
                    {newSessionLoading ? 'Starting…' : 'New session →'}
                  </button>
                </div>
                {/* Feature 9: Parking Lot on Completion */}
                {parkedCount > 0 && (
                  <button
                    onClick={() => setActiveTab('parking')}
                    className="text-xs font-mono text-amber-600/80 hover:text-amber-500 transition-colors ml-4"
                  >
                    {parkedCount} idea{parkedCount > 1 ? 's' : ''} deferred — none lost.
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Layer 3: peer typing ghost — shows other person's draft before they send */}
                {peerInput && (
                  <div className="mb-3 bg-zinc-900/40 border border-zinc-800/40 rounded-lg px-4 py-2.5">
                    <p className="text-[10px] font-mono text-zinc-600 mb-1.5">Co-founder typing…</p>
                    <p className="text-sm text-zinc-500 leading-relaxed whitespace-pre-wrap">{peerInput}</p>
                  </div>
                )}
                <form onSubmit={handleSubmit} className={`flex gap-3 items-end ${shakeInput ? 'animate-input-shake' : ''}`}>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSubmit(e as unknown as React.FormEvent)
                      }
                    }}
                    placeholder={allSectionsComplete ? 'State your wedge sentence without reading it.' : 'Type your response...'}
                    rows={1}
                    disabled={isLoading}
                    inputMode="text"
                    enterKeyHint="send"
                    autoComplete="off"
                    autoCorrect="on"
                    spellCheck={true}
                    className="flex-1 bg-zinc-900/80 border border-zinc-800/70 rounded-lg px-4 py-3 text-[16px] sm:text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:border-violet-600/50 focus:shadow-[0_0_12px_rgba(139,92,246,0.12)] disabled:opacity-50 transition-[height,border-color,box-shadow] duration-100 min-h-[48px] max-h-40 overflow-y-auto"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className={`min-h-[48px] min-w-[64px] px-5 py-3 bg-violet-600 text-white rounded-lg text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-violet-500 active:bg-violet-700 transition-all disabled:shadow-none ${input.trim() && !isLoading ? 'animate-send-breathe' : 'shadow-[0_0_16px_rgba(139,92,246,0.25)]'}`}
                  >
                    Send
                  </button>
                </form>
                {visibleMessages.length < 20 && (
                  <p className={`hidden sm:block text-[11px] mt-2 ml-0.5 transition-colors duration-1000 ${visibleMessages.length >= 8 ? 'text-zinc-800' : 'text-zinc-700'}`}>
                    Shift+Enter for a new line
                  </p>
                )}
                {showIdleHint && (
                  <p className="text-[11px] text-zinc-700 mt-0.5 ml-0.5">Still here. Take your time.</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Artifacts panel — hidden below lg */}
        <aside className="hidden lg:flex flex-col w-[400px] border-l border-zinc-800/60">
          {/* Tabs */}
          <div className="shrink-0 flex items-center gap-1 border-b border-zinc-800/60 px-4 pt-3">
            <button onClick={() => setActiveTab('vision')} className={`${tabClass('vision', 'violet')} inline-flex items-center gap-1.5`}>
              Vision
              {vision.length > 0 && (
                <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-700 ${allSectionsComplete ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
              )}
            </button>
            <button onClick={() => setActiveTab('actions')} className={tabClass('actions', 'sky')}>
              Actions{actionProgress.total > 0 ? ` (${actionProgress.done}/${actionProgress.total})` : ''}
            </button>
            <button onClick={() => setActiveTab('parking')} className={tabClass('parking', 'amber')}>
              Deferred{parkedCount > 0 ? <span className={parkingBadgePulse ? 'animate-pulse text-amber-300' : ''}> ({parkedCount})</span> : ''}
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
