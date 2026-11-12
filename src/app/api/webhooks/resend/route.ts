import { createElement } from "react"
import { after } from "next/server"
import type { WebhookEventPayload } from "resend"
import NewInboundNotification, { meta } from "@/emails/new-inbound-notification"
import { apiError, json } from "@/lib/server/api"
import { env, fromAddress } from "@/lib/server/env"
import { resend, sendEmail } from "@/lib/server/mail"
import { parseWebhook } from "@/lib/server/webhook"

const seen = new Set<string>()

/** POST /api/webhooks/resend — signed Resend events. Acknowledges first, works after. */
export async function POST(req: Request) {
  if (!env.RESEND_WEBHOOK_SECRET) return apiError(503, "not_configured", "Webhook secret not set.")
  const parsed = parseWebhook(await req.text(), req.headers, env.RESEND_WEBHOOK_SECRET, seen)
  if (!parsed.ok) return apiError(401, "invalid_signature", "Signature check failed.")
  if (!parsed.duplicate) after(() => handle(parsed.event).catch((e) => console.error("resend webhook work failed", e instanceof Error ? e.message : e)))
  return json({ received: true })
}

async function handle(event: WebhookEventPayload) {
  if (event.type !== "inbox.email.received" || !resend || !env.EMAIL_ADMIN_NOTIFY) return
  const d = event.data
  if (env.RESEND_ESTAMP_INBOX_ID && d.inbox_id !== env.RESEND_ESTAMP_INBOX_ID) return
  if (d.email?.direction === "outbound") return

  // The event carries no body, so fetch the message itself.
  const { data: msg } = await resend.inboxes.threads.emails.get({ inboxId: d.inbox_id, threadId: d.thread_id, emailId: d.email_id })
  const from = msg?.from ?? d.email?.from ?? "unknown sender"
  const replyTo = msg?.reply_to?.[0] ?? d.email?.reply_to?.[0]
  // Contact-form copies are sent by us (visitor as Reply-To); /api/contact already notified about those.
  if (from.toLowerCase().includes(fromAddress) && replyTo) return
  const props = {
    inbox: fromAddress,
    from,
    subject: (msg?.subject ?? d.email?.subject ?? null)?.replace(/^Contact: /, "") ?? null,
    receivedAt: msg?.received_at ?? event.created_at,
    preview: msg ? (msg.text ?? "").trim() : null, // null: a sending-only key can't read the body
    attachments: (msg?.attachments ?? d.email?.attachments ?? []).length,
    // shortcut: links to the inbox, not the thread (Resend's thread URL format isn't documented); confirm and deep-link later.
    openUrl: "https://resend.com/inboxes",
  }
  await sendEmail({
    to: env.EMAIL_ADMIN_NOTIFY,
    replyTo: from.includes("@") ? (/<([^>]+)>/.exec(from)?.[1] ?? from) : undefined, // "Reply" in your mail app answers the sender
    subject: meta(props).subject,
    react: createElement(NewInboundNotification, props),
    idempotencyKey: `inbound/${d.email_id}`, // a retried webhook on another instance can't notify twice
  })
}
