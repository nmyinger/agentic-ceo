export type ReactionCounts = { user: number; investor: number; builder: number }
export type ReactionType = keyof ReactionCounts

export const REACTIONS: { type: ReactionType; icon: string; label: string }[] = [
  { type: 'user',     icon: '👤', label: "I'm the user" },
  { type: 'investor', icon: '💰', label: "I'd fund this" },
  { type: 'builder',  icon: '🔨', label: "I'd build this" },
]

const REACT_KEY = 'kora_reactions'
const VIEW_KEY  = 'kora_viewed_sessions'

export function getLocalReactions(sessionId: string): ReactionType[] {
  if (typeof window === 'undefined') return []
  try {
    const all: Record<string, string[]> = JSON.parse(localStorage.getItem(REACT_KEY) ?? '{}')
    return (all[sessionId] ?? []) as ReactionType[]
  } catch { return [] }
}

export function saveLocalReaction(sessionId: string, type: ReactionType): void {
  if (typeof window === 'undefined') return
  try {
    const all: Record<string, string[]> = JSON.parse(localStorage.getItem(REACT_KEY) ?? '{}')
    all[sessionId] = [...(all[sessionId] ?? []), type]
    localStorage.setItem(REACT_KEY, JSON.stringify(all))
  } catch {}
}

export function removeLocalReaction(sessionId: string, type: ReactionType): void {
  if (typeof window === 'undefined') return
  try {
    const all: Record<string, string[]> = JSON.parse(localStorage.getItem(REACT_KEY) ?? '{}')
    all[sessionId] = (all[sessionId] ?? []).filter((t) => t !== type)
    localStorage.setItem(REACT_KEY, JSON.stringify(all))
  } catch {}
}

export function recordView(sessionId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const viewed: string[] = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '[]')
    if (viewed.includes(sessionId)) return false
    localStorage.setItem(VIEW_KEY, JSON.stringify([...viewed, sessionId]))
    return true
  } catch { return true }
}
