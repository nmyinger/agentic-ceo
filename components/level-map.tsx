'use client'

export type GateState = 'complete' | 'active' | 'locked'

export type GateInfo = {
  gate: number
  label: string
  description: string
  state: GateState
}

export const GATE_DEFS = [
  { gate: 1, label: 'Vision Architect',    description: 'Define your wedge, customer, and why now.' },
  { gate: 2, label: 'Pattern Confirmation', description: 'Validate through real customer interviews.' },
  { gate: 3, label: 'Business Model',       description: 'Lock the revenue model and unit economics.' },
  { gate: 4, label: 'Go-to-Market',         description: 'First 100 customers — channel and message.' },
  { gate: 5, label: 'Launch',               description: 'Ship v1 and establish growth feedback loop.' },
]

export function LevelMap({
  gates,
  onGateClick,
}: {
  gates: GateInfo[]
  onGateClick?: (gate: GateInfo) => void
}) {
  return (
    <div className="w-full">
      {/* Mobile: vertical stack */}
      <div className="flex flex-col gap-0 sm:hidden">
        {gates.map((g, i) => (
          <div key={g.gate} className="relative flex items-start gap-3">
            {/* Vertical connector */}
            {i < gates.length - 1 && (
              <div className="absolute left-[13px] top-7 bottom-0 w-px bg-zinc-800/80" />
            )}
            {/* Node */}
            <button
              onClick={() => onGateClick?.(g)}
              className="shrink-0 relative z-10 flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all mt-1"
              style={nodeStyle(g.state)}
            >
              {g.state === 'complete' && (
                <span className="text-[10px] font-bold text-emerald-400">✓</span>
              )}
              {g.state === 'active' && (
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              )}
            </button>

            {/* Label */}
            <button
              onClick={() => onGateClick?.(g)}
              className="flex-1 pb-5 text-left"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-mono uppercase tracking-widest ${stateColor(g.state)}`}>
                  Gate {g.gate}
                </span>
                {g.state === 'complete' && (
                  <span className="text-[10px] font-mono text-emerald-600">complete</span>
                )}
                {g.state === 'active' && (
                  <span className="text-[10px] font-mono text-violet-500">active</span>
                )}
              </div>
              <p className={`text-sm font-semibold mt-0.5 ${g.state === 'locked' ? 'text-zinc-600' : 'text-zinc-200'}`}>
                {g.label}
              </p>
            </button>
          </div>
        ))}
      </div>

      {/* Desktop: horizontal row */}
      <div className="hidden sm:flex items-center gap-0">
        {gates.map((g, i) => (
          <div key={g.gate} className="flex items-center flex-1 min-w-0">
            {/* Gate node + label */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <button
                onClick={() => onGateClick?.(g)}
                className="flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all"
                style={nodeStyle(g.state)}
              >
                {g.state === 'complete' && (
                  <span className="text-[10px] font-bold text-emerald-400">✓</span>
                )}
                {g.state === 'active' && (
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-400 animate-pulse" />
                )}
              </button>
              <div className="text-center max-w-[80px]">
                <p className={`text-[9px] font-mono uppercase tracking-widest ${stateColor(g.state)}`}>
                  Gate {g.gate}
                </p>
                <p className={`text-[11px] font-semibold leading-snug mt-0.5 ${g.state === 'locked' ? 'text-zinc-600' : 'text-zinc-200'}`}>
                  {g.label}
                </p>
              </div>
            </div>

            {/* Connector line between nodes */}
            {i < gates.length - 1 && (
              <div
                className="h-px flex-1 max-w-[48px] mx-1"
                style={{ background: connectorColor(g.state) }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function nodeStyle(state: GateState): React.CSSProperties {
  if (state === 'complete') {
    return {
      borderColor: 'rgb(16 185 129 / 0.8)',
      backgroundColor: 'rgb(6 78 59 / 0.4)',
    }
  }
  if (state === 'active') {
    return {
      borderColor: 'rgb(139 92 246 / 0.9)',
      backgroundColor: 'rgb(46 16 101 / 0.6)',
      boxShadow: '0 0 12px rgba(139,92,246,0.4)',
    }
  }
  return {
    borderColor: 'rgb(63 63 70 / 0.8)',
    backgroundColor: 'rgb(24 24 27 / 0.4)',
  }
}

function connectorColor(state: GateState): string {
  if (state === 'complete') return 'rgb(16 185 129 / 0.5)'
  if (state === 'active') return 'rgb(63 63 70 / 0.6)'
  return 'rgb(39 39 42 / 0.6)'
}

function stateColor(state: GateState): string {
  if (state === 'complete') return 'text-emerald-600'
  if (state === 'active') return 'text-violet-500'
  return 'text-zinc-700'
}
