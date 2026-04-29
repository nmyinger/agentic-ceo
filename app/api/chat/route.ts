import { streamText, generateText, tool, stepCountIs, convertToModelMessages, type UIMessage } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase'
import { VISION_ARCHITECT_SYSTEM, CUSTOMER_INQUISITOR_SYSTEM } from '@/lib/prompts'

function getMessageText(msg: UIMessage): string {
  return (msg.parts ?? [])
    .filter((p) => p.type === 'text')
    .map((p) => (p as { type: 'text'; text: string }).text)
    .join('')
}

const GATE2_ARTIFACT_TOOL_TYPES = new Set(['tool-emit_icp', 'tool-emit_interview_script', 'tool-emit_outreach_list'])
const GATE1_ARTIFACT_TOOL_TYPES = new Set(['tool-emit_vision', 'tool-emit_actions'])

// Replace full markdown payloads in historical artifact tool calls with stubs.
// The current artifact is always injected fresh into the system prompt from the DB.
function stripArtifactInputs(msgs: UIMessage[]): UIMessage[] {
  return msgs.map((msg) => {
    if (msg.role !== 'assistant') return msg
    const hasBulky = msg.parts.some(
      (p) => GATE1_ARTIFACT_TOOL_TYPES.has(p.type) || GATE2_ARTIFACT_TOOL_TYPES.has(p.type)
    )
    if (!hasBulky) return msg
    return {
      ...msg,
      parts: msg.parts.map((p) => {
        if (GATE1_ARTIFACT_TOOL_TYPES.has(p.type) || GATE2_ARTIFACT_TOOL_TYPES.has(p.type)) {
          return { ...p, input: { content: '[see current version in system context]' } }
        }
        return p
      }),
    }
  })
}

function countBookings(icpContent: string): number {
  return icpContent
    .split('\n')
    .filter((l) => l.startsWith('|') && !l.includes('Date') && !l.includes('----')).length
}

export async function POST(req: Request) {
  const { id: sessionId, messages }: { id: string; messages: UIMessage[] } = await req.json()

  if (!sessionId) return Response.json({ error: 'id required' }, { status: 400 })

  const sb = supabaseServer()

  // Fetch session metadata (gate, parent) and all artifacts in parallel
  const [{ data: sessionData }, { data: artifacts }] = await Promise.all([
    sb.from('sessions').select('gate, parent_session_id').eq('id', sessionId).single(),
    sb.from('artifacts').select('type, content').eq('session_id', sessionId),
  ])

  const gate = (sessionData?.gate as number) ?? 1

  // Count only real messages (exclude internal trigger messages)
  const realMessageCount = messages.filter((m) => {
    if (m.role !== 'user' && m.role !== 'assistant') return false
    if (m.role === 'assistant') return true
    return !getMessageText(m).startsWith('<<')
  }).length

  const modelMessages = await convertToModelMessages(stripArtifactInputs(messages))
  let apiMessages = modelMessages
  if (modelMessages.length === 0 || modelMessages[0]?.role !== 'user') {
    apiMessages = [{ role: 'user' as const, content: '<<begin>>' }, ...modelMessages]
  }

  // Persist the newest user message (skip internal trigger messages)
  const lastMsg = messages[messages.length - 1]
  if (lastMsg?.role === 'user') {
    const text = getMessageText(lastMsg)
    if (text && !text.startsWith('<<')) {
      await Promise.all([
        sb.from('messages').insert({ session_id: sessionId, role: 'user', content: text }),
        sb.from('sessions').update({ idea: text.slice(0, 150) }).eq('id', sessionId).is('idea', null),
      ])
    }
  }

  // Accumulate text and flush partial response to live_streams every ~500ms
  let accText = ''
  let lastFlush = 0
  const FLUSH_MS = 500

  const onChunk = ({ chunk }: { chunk: { type: string; text?: string } }) => {
    if (chunk.type === 'text-delta' && chunk.text) {
      accText += chunk.text
      const now = Date.now()
      if (now - lastFlush >= FLUSH_MS) {
        lastFlush = now
        void sb
          .from('live_streams')
          .upsert(
            { session_id: sessionId, content: accText, updated_at: new Date().toISOString() },
            { onConflict: 'session_id' }
          )
      }
    }
  }

  const onFinish = async () => {
    const titleOp =
      realMessageCount === 1 && lastMsg?.role === 'user'
        ? (() => {
            const firstUserText = getMessageText(lastMsg as UIMessage)
            if (!firstUserText || firstUserText.startsWith('<<')) return Promise.resolve()
            return generateText({
              model: anthropic('claude-haiku-4-5-20251001'),
              prompt: `5 words or fewer: title for this startup idea. Only the title, no quotes.\n\n${firstUserText.slice(0, 400)}`,
            })
              .then(({ text: title }) => {
                const clean = title.trim().replace(/^["\s]+|["\s.]+$/g, '')
                if (clean) return sb.from('sessions').update({ idea: clean }).eq('id', sessionId)
              })
              .catch(() => {})
          })()
        : Promise.resolve()

    await Promise.all([
      sb.from('live_streams').delete().eq('session_id', sessionId),
      accText.trim()
        ? sb.from('messages').insert({ session_id: sessionId, role: 'assistant', content: accText })
        : Promise.resolve(),
      titleOp,
    ])
  }

  const onError = async () => {
    await sb.from('live_streams').delete().eq('session_id', sessionId)
  }

  // ─── Gate 2 — Customer Inquisitor ──────────────────────────────────────────
  if (gate === 2) {
    const icpArtifact = artifacts?.find((a) => a.type === 'icp')
    const scriptArtifact = artifacts?.find((a) => a.type === 'interview_script')
    const outreachArtifact = artifacts?.find((a) => a.type === 'outreach_list')
    const bookingCount = icpArtifact ? countBookings(icpArtifact.content) : 0

    // Fetch the parent Gate 1 vision to inject as context
    let parentVision = ''
    const parentId = sessionData?.parent_session_id as string | null
    if (parentId) {
      const { data: parentArtifact } = await sb
        .from('artifacts')
        .select('content')
        .eq('session_id', parentId)
        .eq('type', 'vision')
        .maybeSingle()
      parentVision = (parentArtifact?.content as string) ?? ''
    }

    const contextLines: string[] = [
      '\n---\n## Session context\n',
      `Gate: 2 — Customer Inquisitor`,
      `Messages so far: ${realMessageCount}`,
      `Interviews booked: ${bookingCount} / 5`,
    ]

    if (parentVision) {
      contextLines.push(`\nVision from Gate 1:\n${parentVision}`)
    } else {
      contextLines.push('\nNo Gate 1 vision found — ask the founder to describe their idea and target user.')
    }

    if (icpArtifact) {
      contextLines.push(`\nCurrent icp.md:\n${icpArtifact.content}`)
    } else {
      contextLines.push('\nNo ICP yet. Start with Phase 1 — Persona Pressure.')
    }

    if (scriptArtifact) {
      contextLines.push(`\nCurrent interview_script.md:\n${scriptArtifact.content}`)
    }

    if (outreachArtifact) {
      contextLines.push(`\nCurrent outreach_list.md:\n${outreachArtifact.content}`)
    }

    const result = streamText({
      model: anthropic('claude-sonnet-4-6'),
      system: [
        {
          role: 'system' as const,
          content: CUSTOMER_INQUISITOR_SYSTEM,
          providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
        },
        {
          role: 'system' as const,
          content: contextLines.join('\n'),
        },
      ],
      messages: apiMessages,
      stopWhen: stepCountIs(10),
      onChunk,
      tools: {
        emit_icp: tool({
          description:
            'Publish or update icp.md. Call as soon as the founder gives you a first name and a specific context for the persona. Update whenever the ICP sharpens or a booking is added.',
          inputSchema: z.object({
            content: z.string().describe('Full markdown content of icp.md'),
          }),
          execute: async ({ content }) => {
            await sb.from('artifacts').upsert(
              { session_id: sessionId, type: 'icp', content, updated_at: new Date().toISOString() },
              { onConflict: 'session_id,type' }
            )
            return { updated: true }
          },
        }),
        emit_interview_script: tool({
          description:
            'Publish the 10-question discovery interview script. Call only after the ICP has a first name and concrete situation. Do not call until emit_icp has been called.',
          inputSchema: z.object({
            content: z.string().describe('Full markdown content of interview_script.md'),
          }),
          execute: async ({ content }) => {
            await sb.from('artifacts').upsert(
              { session_id: sessionId, type: 'interview_script', content, updated_at: new Date().toISOString() },
              { onConflict: 'session_id,type' }
            )
            return { updated: true }
          },
        }),
        emit_outreach_list: tool({
          description:
            'Publish the 20-community outreach list. Call only after the interview script has been emitted.',
          inputSchema: z.object({
            content: z.string().describe('Full markdown content of outreach_list.md'),
          }),
          execute: async ({ content }) => {
            await sb.from('artifacts').upsert(
              { session_id: sessionId, type: 'outreach_list', content, updated_at: new Date().toISOString() },
              { onConflict: 'session_id,type' }
            )
            return { updated: true }
          },
        }),
        record_booking: tool({
          description:
            'Record a confirmed interview booking. Call immediately when the founder reports they have booked an interview. Updates the booking table in icp.md.',
          inputSchema: z.object({
            name: z.string().describe('Name or identifier of the person booked'),
            context: z.string().describe('How they were found or one sentence about them'),
          }),
          execute: async ({ name, context }) => {
            const { data } = await sb
              .from('artifacts')
              .select('content')
              .eq('session_id', sessionId)
              .eq('type', 'icp')
              .maybeSingle()

            const existing = data?.content ?? '# ICP\n\n## Interview Bookings\n| Date | Name | Context |\n|------|------|----------|\n'
            const date = new Date().toISOString().split('T')[0]
            const updated = `${existing}| ${date} | ${name} | ${context} |\n`

            await sb.from('artifacts').upsert(
              { session_id: sessionId, type: 'icp', content: updated, updated_at: new Date().toISOString() },
              { onConflict: 'session_id,type' }
            )
            const newCount = countBookings(updated)
            return { booked: true, total: newCount }
          },
        }),
        mark_complete: tool({
          description:
            'Mark Gate 2 complete. Call only when 5 interviews are confirmed booked. After calling this, stop asking questions.',
          inputSchema: z.object({
            persona: z.string().describe('The final ICP first name and one-sentence description'),
            interviews_booked: z.number().describe('Total confirmed interviews booked'),
          }),
          execute: async ({ persona, interviews_booked }) => {
            await sb.from('sessions').update({ status: 'completed' }).eq('id', sessionId)
            return { completed: true, persona, interviews_booked }
          },
        }),
      },
      onFinish,
      onError,
    })

    return result.toUIMessageStreamResponse()
  }

  // ─── Gate 1 — Vision Architect (default) ──────────────────────────────────
  const visionArtifact = artifacts?.find((a) => a.type === 'vision')
  const parkingArtifact = artifacts?.find((a) => a.type === 'parking_lot')
  const actionsArtifact = artifacts?.find((a) => a.type === 'actions')

  const contextLines: string[] = ['\n---\n## Session context\n', `Real messages so far: ${realMessageCount}`]

  if (visionArtifact) {
    contextLines.push(`\nPhase: 2 or 3 — vision draft exists. Find the single vaguest element in the weakest section. Ask one question that makes it concrete. No preamble.\n\nCurrent vision.md:\n${visionArtifact.content}`)
  } else {
    contextLines.push('\nPhase: 1 — no vision draft yet. Start with The User section.')
  }

  if (actionsArtifact) {
    contextLines.push(`\nCurrent actions.md:\n${actionsArtifact.content}`)
  } else {
    contextLines.push('\nNo actions.md yet — emit_actions after the founder describes their idea.')
  }

  if (parkingArtifact) {
    contextLines.push(`\nCurrent parking_lot.md:\n${parkingArtifact.content}`)
  }

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: [
      {
        role: 'system' as const,
        content: VISION_ARCHITECT_SYSTEM,
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      },
      {
        role: 'system' as const,
        content: contextLines.join('\n'),
      },
    ],
    messages: apiMessages,
    stopWhen: stepCountIs(10),
    onChunk,
    tools: {
      emit_actions: tool({
        description:
          'Maintain the founder\'s action plan. Call it: (1) after the founder first describes their idea — emit a starter checklist with concrete placeholders; (2) when a section reaches DONE — update that section\'s items with the specific names, places, scripts learned; (3) when calling mark_complete — mark exit checklist items done. Do NOT call this after every exchange.',
        inputSchema: z.object({
          content: z.string().describe('Full markdown content of actions.md'),
        }),
        execute: async ({ content }) => {
          await sb.from('artifacts').upsert(
            { session_id: sessionId, type: 'actions', content, updated_at: new Date().toISOString() },
            { onConflict: 'session_id,type' }
          )
          return { updated: true }
        },
      }),
      emit_vision: tool({
        description:
          'Publish or update vision.md. Call after ~6 exchanges with a first draft — use [TBD] for missing sections. Update whenever a section meaningfully sharpens. Always emit after the Wedge is filled.',
        inputSchema: z.object({
          content: z.string().describe('Full markdown content of vision.md'),
        }),
        execute: async ({ content }) => {
          const titleLine = content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? ''
          const isRealTitle = titleLine && !titleLine.startsWith('[')
          await Promise.all([
            sb.from('artifacts').upsert(
              { session_id: sessionId, type: 'vision', content, updated_at: new Date().toISOString() },
              { onConflict: 'session_id,type' }
            ),
            isRealTitle
              ? sb.from('sessions').update({ idea: titleLine }).eq('id', sessionId)
              : Promise.resolve(),
          ])
          return { updated: true }
        },
      }),
      park_idea: tool({
        description:
          'Immediately park an out-of-scope idea when the founder introduces a second persona, extra feature, new market, or second channel not essential to the core wedge.',
        inputSchema: z.object({
          idea: z.string().describe('The idea being parked — concise label'),
          reason: z.string().describe('Why it is out of scope right now'),
        }),
        execute: async ({ idea, reason }) => {
          const { data } = await sb
            .from('artifacts')
            .select('content')
            .eq('session_id', sessionId)
            .eq('type', 'parking_lot')
            .maybeSingle()

          const header =
            '# Parking Lot\n\nItems we said NO to. Not forever. Not today.\n\n| Date | Idea | Why Parked |\n|------|------|------------|\n'
          const existing = data?.content ?? header
          const date = new Date().toISOString().split('T')[0]
          const updated = `${existing}| ${date} | ${idea} | ${reason} |\n`

          await sb.from('artifacts').upsert(
            { session_id: sessionId, type: 'parking_lot', content: updated, updated_at: new Date().toISOString() },
            { onConflict: 'session_id,type' }
          )
          return { parked: true }
        },
      }),
      mark_complete: tool({
        description:
          'Mark Gate 1 complete. Call only when: all six vision sections are specific (no [TBD]), the wedge sentence follows the formula exactly, and the founder has recited it unprompted. After calling this, stop asking questions.',
        inputSchema: z.object({
          wedge_sentence: z.string().describe('The final wedge sentence the founder stated'),
          summary: z.string().describe('One sentence on what sharpened most in this session'),
        }),
        execute: async ({ wedge_sentence, summary }) => {
          await sb.from('sessions').update({ status: 'completed' }).eq('id', sessionId)
          return { completed: true, wedge_sentence, summary }
        },
      }),
    },
    onFinish,
    onError,
  })

  return result.toUIMessageStreamResponse()
}
