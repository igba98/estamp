import "server-only"
import { env } from "./env"

/** Cloudflare Turnstile check, done on the server. Each token works once. */
export async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return false
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token })
  if (ip) body.set("remoteip", ip)
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(8000) })
    return Boolean(((await res.json()) as { success?: boolean }).success)
  } catch {
    return false
  }
}
