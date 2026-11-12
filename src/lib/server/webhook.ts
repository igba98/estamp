import { Webhook } from "standardwebhooks"
import type { WebhookEventPayload } from "resend"

export type Parsed = { ok: true; event: WebhookEventPayload; id: string; duplicate: boolean } | { ok: false }

/**
 * Check a Resend (Svix) webhook against the raw body. Rejects bad signatures and
 * timestamps more than 5 minutes off (replays); flags event ids already seen.
 * shortcut: `seen` lives in memory, so a retry reaching another instance runs again; sends carry
 * Resend idempotency keys, so that can't double-email.
 */
export function parseWebhook(raw: string, headers: Headers, secret: string, seen: Set<string>): Parsed {
  const id = headers.get("svix-id") ?? ""
  try {
    const event = new Webhook(secret).verify(raw, {
      "webhook-id": id,
      "webhook-timestamp": headers.get("svix-timestamp") ?? "",
      "webhook-signature": headers.get("svix-signature") ?? "",
    }) as WebhookEventPayload
    const duplicate = seen.has(id)
    if (!duplicate) {
      seen.add(id)
      if (seen.size > 5000) seen.delete(seen.values().next().value!)
    }
    return { ok: true, event, id, duplicate }
  } catch {
    return { ok: false }
  }
}
