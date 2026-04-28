import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase'
import { VISION_ARCHITECT_SYSTEM } from '@/lib/prompts'

export async function POST(req: Request) {
  const { id: sessionId, messages }: { id: string; messages: UIMessage[] } = await req.json()

  if (!sessionId) return Response.json({ error: 'id required' }, { status: 400 })

  const sb = supabaseServer()

  // Fetch all current artifacts — agent needs to see every file it has written
  const { data: artifacts } = await sb
    .from('artifacts')
    .select('type, content')
    .eq('session_id', sessionId)

  const visionArtifact = artifacts?.find((a) => a.type === 'vision')
  const parkingArtifact = artifacts?.find((a) => a.type === 'parking_lot')
  const actionsArtifact = artifacts?.find((a) => a.type === 'actions')
  const messageCount = messages.filter((m) => m.role === 'user' || m.role === 'assistant').length

  // Inject full session state into system prompt so the agent has complete context
  const contextLines: string[] = ['\n---\n## Session context\n', `Messages so far: ${messageCount}`]

  if (visionArtifact) {
    contextLines.push(`Phase: 2 or 3 — vision draft exists.\n\nCurrent vision.md:\n${visionArtifact.content}`)
  } else {
    contextLines.push('Phase: 1 — no vision draft yet. Start with The User section.')
  }

  if (actionsArtifact) {
    contextLines.push(`\nCurrent actions.md:\n${actionsArtifact.content}`)
  } else {
    contextLines.push('\nNo actions.md yet — emit_actions immediately after the first user message.')
  }

  if (parkingArtifact) {
    contextLines.push(`\nCurrent parking_lot.md:\n${parkingArtifact.content}`)
  }

  const systemWithContext = VISION_ARCHITECT_SYSTEM + contextLines.join('\n')

  const modelMessages = await convertToModelMessages(messages)

  // Smarter trigger: tell the agent whether it is starting fresh or resuming
  let apiMessages = modelMessages
  if (modelMessages.length === 0 || modelMessages[0]?.role !== 'user') {
    const trigger = visionArtifact
      ? `<<resume>> Vision draft exists. Read session context, identify the weakest section, update actions.md if needed, and ask your next question.`
      : `<<begin>>`
    apiMessages = [{ role: 'user' as const, content: trigger }, ...modelMessages]
  }

  // Persist the newest user message (skip internal trigger messages)
  const lastMsg = messages[messages.length - 1]
  if (lastMsg?.role === 'user') {
    const text = lastMsg.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => (p as { type: 'text'; text: string }).text)
      .join('')
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

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemWithContext,
    messages: apiMessages,
    stopWhen: stepCountIs(15),
    tools: {
      emit_actions: tool({
        description:
          'Maintain the founder\'s action plan. Call immediately after the first user message with a starter checklist, then update after every meaningful answer — replacing generic placeholders with specific names, places, scripts, and numbers from the conversation. Every item must be executable tomorrow morning without asking anyone.',
        inputSchema: z.object({
          content: z.string().describe('Full markdown content of actions.md — always emit the complete file, not just changes'),
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
          'Publish or update vision.md. Call after ~6 exchanges with a first draft — use [TBD] for missing sections. Update whenever a section meaningfully sharpens. Always emit after the Wedge section is filled.',
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
    onFinish: async ({ text }) => {
      if (text.trim()) {
        await sb.from('messages').insert({
          session_id: sessionId,
          role: 'assistant',
          content: text,
        })
      }
    },
  })

  return result.toUIMessageStreamResponse()
}
