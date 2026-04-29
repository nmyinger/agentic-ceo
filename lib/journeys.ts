const STORAGE_KEY = 'kora_journeys'
const LEGACY_KEY = 'kora_sessions'
const MAX_JOURNEYS = 50

export type StoredJourney = {
  id: string
  savedAt: string
}

export function saveJourney(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const existing = loadJourneys().filter((j) => j.id !== id)
    existing.unshift({ id, savedAt: new Date().toISOString() })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, MAX_JOURNEYS)))
  } catch {}
}

export function loadJourneys(): StoredJourney[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
    // Backward compat: migrate legacy kora_sessions on first load
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '[]') as StoredJourney[]
    return legacy
  } catch {
    return []
  }
}

export function removeJourney(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const journeys = loadJourneys().filter((j) => j.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(journeys))
  } catch {}
}
