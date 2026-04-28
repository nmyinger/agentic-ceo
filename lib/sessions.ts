const STORAGE_KEY = 'kora_sessions'
const MAX_SESSIONS = 50

export type StoredSession = {
  id: string
  savedAt: string
}

export function saveSession(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const existing = loadSessions().filter((s) => s.id !== id)
    existing.unshift({ id, savedAt: new Date().toISOString() })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, MAX_SESSIONS)))
  } catch {}
}

export function loadSessions(): StoredSession[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function removeSession(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const sessions = loadSessions().filter((s) => s.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {}
}
