import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Extracts the text under the "## The Wedge" section of a vision document.
export function parseWedge(vision: string): string {
  const match = vision.match(/##\s+The Wedge\s*\n+([\s\S]*?)(?:\n##|\s*$)/)
  return match ? match[1].trim() : ''
}

// Extracts a short persona label from the "## The User" section.
export function parseUserPersona(vision: string): string {
  const match = vision.match(/##\s+The User\s*\n+([\s\S]*?)(?:\n##|\s*$)/)
  if (!match) return ''
  // Return the first sentence only
  const firstSentence = match[1].trim().split(/(?<=[.!?])\s+/)[0]
  return firstSentence ?? ''
}
