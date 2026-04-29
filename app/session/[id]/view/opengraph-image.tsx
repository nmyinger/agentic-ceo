import { ImageResponse } from 'next/og'
import { supabaseServer } from '@/lib/supabase'
import { parseWedge } from '@/lib/utils'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = supabaseServer()

  const [{ data: session }, { data: artifacts }] = await Promise.all([
    sb.from('sessions').select('idea').eq('id', id).single(),
    sb.from('artifacts').select('type, content').eq('session_id', id),
  ])

  const vision = artifacts?.find((a) => a.type === 'vision')?.content ?? ''
  const idea = (session?.idea as string | null) ?? null
  const wedge = parseWedge(vision)

  const title = idea ?? 'Vision Document'
  const subtitle = wedge || 'A focused one-page vision — built with Kora'

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#09090b',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle purple glow */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            right: '-120px',
            width: '480px',
            height: '480px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)',
          }}
        />

        {/* Top: label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontSize: '13px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#71717a',
              fontWeight: 500,
            }}
          >
            Vision Architect
          </span>
          <span style={{ color: '#3f3f46', fontSize: '13px' }}>·</span>
          <span
            style={{
              fontSize: '13px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#52525b',
              fontFamily: 'monospace',
            }}
          >
            {id.slice(0, 8)}
          </span>
        </div>

        {/* Middle: product name + wedge */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', flex: 1, justifyContent: 'center' }}>
          <div
            style={{
              fontSize: '72px',
              fontWeight: 700,
              color: '#fafafa',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: '28px',
              color: '#a1a1aa',
              lineHeight: 1.5,
              maxWidth: '900px',
              fontWeight: 400,
            }}
          >
            {subtitle.length > 180 ? subtitle.slice(0, 180) + '…' : subtitle}
          </div>
        </div>

        {/* Bottom: Kora branding */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#8b5cf6',
              }}
            />
            <span style={{ fontSize: '15px', color: '#71717a', letterSpacing: '0.08em' }}>
              Built with
            </span>
            <span
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#a78bfa',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              Kora
            </span>
          </div>
          <span style={{ fontSize: '14px', color: '#3f3f46', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
            agentic-ceo.vercel.app
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
