'use client'

import { useState } from 'react'

export function ReactionPill({
  icon,
  label,
  count,
  reacted,
  onReact,
}: {
  icon: string
  label: string
  count: number
  reacted: boolean
  onReact: () => void
}) {
  const [bubble, setBubble] = useState<number | null>(null)

  function handleClick() {
    if (!reacted) {
      const id = Date.now()
      setBubble(id)
      setTimeout(() => setBubble((b) => (b === id ? null : b)), 1100)
    }
    onReact()
  }

  return (
    <div className="relative">
      {bubble !== null && (
        <div
          key={bubble}
          className="absolute bottom-full left-1/2 mb-3 px-3 py-1.5 bg-white text-zinc-900 rounded-full text-xs font-semibold whitespace-nowrap shadow-lg animate-reaction-bubble"
        >
          {label}!
        </div>
      )}
      <button
        onClick={handleClick}
        title={label}
        className={[
          'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 active:scale-95',
          reacted
            ? 'bg-violet-600 text-white'
            : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
        ].join(' ')}
      >
        <span className="text-sm leading-none">{icon}</span>
        {count > 0 && (
          <span className={reacted ? 'text-violet-200' : 'text-zinc-600'}>{count}</span>
        )}
      </button>
    </div>
  )
}
