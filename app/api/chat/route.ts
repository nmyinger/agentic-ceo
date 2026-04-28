import { streamText, generateText, tool, stepCountIs, convertToModelMessages, type UIMessage } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase'
import { VISION_ARCHITECT_SYSTEM } from '@/lib/prompts'

function getMessageText(msg: UIMessage): string {
  return (msg.parts ?? [])
    .filter((p) => p.type === 'text')
    .map((p) => (p as { type: 'text'; text: string }).text)
    .join('')
}

export async function POST(req: Request) {
  const { id: sessionId, messages }: { id: string; messages: UIMessage[] } = await req.json()

  if (!sessionId) return Response.json({ error: 'id required' }, { status: 400 })

  const sb = supabaseServer()

  // Fetch all current artifacts so the agent can see every file it has written
  const { data: artifacts } = await sb
    .from('artifacts')
    .select('type, content')
    .eq('session_id', sessionId)

  const visionArtifact = artifacts?.find((a) => a.type === 'vision')
  const parkingArtifact = artifacts?.find((a) => a.type === 'parking_lot')
  const actionsArtifact = artifacts?.find((a) => a.type === 'actions')

  // Count only real messages (exclude internal trigger messages)
  const realMessageCount = messages.filter((m) => {
    if (m.role !== 'user' && m.role !== 'assistant') return false
    if (m.role === 'assistant') return true
    return !getMessageText(m).startsWith('<<')
  }).length

  // Build session context injected into the system prompt
  const contextLines: string[] = ['\n---\n## Session context\n', `Real messages so far: ${realMessageCount}`]

  if (visionArtifact) {
    contextLines.push(`\nPhase: 2 or 3 — vision draft exists. Read it and identify the weakest section.\n\nCurrent vision.md:\n${visionArtifact.content}`)
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

  const systemWithContext = VISION_ARCHITECT_SYSTEM + contextLines.join('\n')

  const modelMessages = await convertToModelMessages(messages)

  // Add a <<begin>> trigger only if there are no messages at all
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
        sb
          .from('sessions')
          .update({ idea: text.slice(0, 150) })
          .eq('id', sessionId)
          .is('idea', null),
      ])
    }
  }

  // Accumulate text and flush partial response to live_streams every ~500ms
  // so passive viewers see the response as it streams.
  let accText = ''
  let lastFlush = 0
  const FLUSH_MS = 500

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemWithContext,
    messages: apiMessages,
    stopWhen: stepCountIs(10),
    onChunk: ({ chunk }) => {
      if (chunk.type === 'text-delta') {
        accText += (chunk as { type: 'text-delta'; text: string }).text
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
    },
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
          await sb.from('artifacts').upsert(
            { session_id: sessionId, type: 'vision', content, updated_at: new Date().toISOString() },
            { onConflict: 'session_id,type' }
          )
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
    onFinish: async () => {
      // Use accText (all steps) not the onFinish `text` param (final step only).
      // When a tool is called mid-response, onFinish.text omits the pre-tool text,
      // causing the Supabase realtime dedup check to fail and duplicate the reply.
      // Generate a short title once, after the very first exchange
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
    },
    onError: async () => {
      await sb.from('live_streams').delete().eq('session_id', sessionId)
    },
  })

  return result.toUIMessageStreamResponse()
}
