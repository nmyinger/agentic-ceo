import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase'
import { VISION_ARCHITECT_SYSTEM } from '@/lib/prompts'

export async function POST(req: Request) {
  const { id: sessionId, messages }: { id: string; messages: UIMessage[] } = await req.json()

  if (!sessionId) return Response.json({ error: 'id required' }, { status: 400 })

  const sb = supabaseServer()

  // Convert UIMessages to model messages and ensure Anthropic's user-first requirement
  const modelMessages = await convertToModelMessages(messages)
  const apiMessages =
    modelMessages.length === 0 || modelMessages[0]?.role !== 'user'
      ? [{ role: 'user' as const, content: '<<begin>>' }, ...modelMessages]
      : modelMessages

  // Persist the newest user message (skip the <<begin>> trigger)
  const lastMsg = messages[messages.length - 1]
  if (lastMsg?.role === 'user') {
    const text = lastMsg.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => (p as { type: 'text'; text: string }).text)
      .join('')
    if (text && text !== '<<begin>>') {
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
    system: VISION_ARCHITECT_SYSTEM,
    messages: apiMessages,
    stopWhen: stepCountIs(10),
    tools: {
      emit_vision: tool({
        description:
          'Publish or update vision.md. Call after ~6 exchanges when you have enough signal for a first draft. Update as answers sharpen.',
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
          'Park an out-of-scope idea immediately when the founder introduces a feature, market, or channel not essential to the core wedge.',
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
