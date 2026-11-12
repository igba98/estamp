export type Window = { limit: number; ms: number }
export type Verdict = { ok: true } | { ok: false; retryAfterSec: number }

/** Swap the implementation (e.g. Upstash) without touching the routes. */
export interface RateLimiter {
  take(key: string): Promise<Verdict>
}

const HOUR = 60 * 60 * 1000

/**
 * Sliding-window limiter kept in memory. A call counts only when it's allowed.
 * shortcut: per server instance, so on Vercel each warm instance has its own count; move to Upstash before heavy traffic.
 */
export function memoryLimiter(windows: Window[], now = () => Date.now(), maxKeys = 10_000): RateLimiter {
  const hits = new Map<string, number[]>()
  const longest = Math.max(...windows.map((w) => w.ms))
  return {
    async take(key) {
      const t = now()
      const recent = (hits.get(key) ?? []).filter((at) => t - at < longest)
      for (const w of windows) {
        const inWindow = recent.filter((at) => t - at < w.ms)
        if (inWindow.length >= w.limit) {
          hits.set(key, recent)
          return { ok: false, retryAfterSec: Math.ceil((inWindow[0] + w.ms - t) / 1000) }
        }
      }
      recent.push(t)
      hits.delete(key) // re-insert so the Map's order is least-recently-used first
      hits.set(key, recent)
      if (hits.size > maxKeys) hits.delete(hits.keys().next().value!)
      return { ok: true }
    },
  }
}

/** 5 sends an hour and 20 a day, per key (IP for the contact form, user for document emails). */
export const sendLimiter: RateLimiter = memoryLimiter([
  { limit: 5, ms: HOUR },
  { limit: 20, ms: 24 * HOUR },
])

export function retryText(sec: number) {
  return sec < 90 ? `in ${sec} seconds` : sec < 90 * 60 ? `in ${Math.ceil(sec / 60)} minutes` : `in ${Math.ceil(sec / 3600)} hours`
}
