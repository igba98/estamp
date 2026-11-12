import { createHash } from "node:crypto"
import { createElement } from "react"
import ContactReceived, { meta } from "@/emails/contact-received"
import NewInboundNotification, { meta as noticeMeta } from "@/emails/new-inbound-notification"
import { contactSchema, type SendResult } from "@/lib/email-input"
import { clientIp, json } from "@/lib/server/api"
import { env, fromAddress } from "@/lib/server/env"
import { mailConfigured, sendEmail } from "@/lib/server/mail"
import { retryText, sendLimiter } from "@/lib/server/rate-limit"
import { verifyTurnstile } from "@/lib/server/turnstile"

const fail = (status: number, code: string, message: string) => json({ ok: false, code, message } satisfies SendResult, status)

/**
 * POST /api/contact — public contact form. The message goes into the estamp inbox (replies to it reach the sender),
 * and the sender gets one auto-reply. Turnstile + per-IP limit + one fixed recipient keep it from being a spam relay.
 */
export async function POST(req: Request) {
  if (!mailConfigured || !env.TURNSTILE_SECRET_KEY) return fail(503, "not_configured", "The contact form isn't set up yet. Email estamp@workwithignas.com instead.")
  const parsed = contactSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail(400, "invalid", parsed.error.issues[0]?.message ?? "Check the form and try again.")
  const { name, email, subject, message, token } = parsed.data

  const ip = clientIp(req)
  if (!(await verifyTurnstile(token, ip))) return fail(403, "challenge_failed", "The security check didn't pass. Try it again.")
  const limit = await sendLimiter.take(`contact:${ip ?? "unknown"}`)
  if (!limit.ok) return fail(429, "rate_limited", `Too many messages from your network. Try again ${retryText(limit.retryAfterSec)}.`)

  // Each Turnstile token is single-use, so it identifies this submission: a retried request can't send twice.
  const key = createHash("sha256").update(token).digest("hex").slice(0, 32)
  const text = `${message}\n\n— ${name} <${email}>, sent with the eStamp contact form`
  const inbound = await sendEmail({
    to: fromAddress,
    replyTo: email,
    subject: `Contact: ${subject}`,
    email: { subject: `Contact: ${subject}`, text, html: `<pre style="font:15px/1.5 Helvetica,Arial,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>` },
    headers: { "X-Estamp-Source": "contact-form" },
    idempotencyKey: `contact/${key}`,
  })
  if (!inbound.ok) return json(inbound, 502)

  const props = { name, subject, message }
  const notice = { inbox: fromAddress, from: `${name} <${email}>`, subject, receivedAt: new Date().toISOString(), preview: message, attachments: 0, viaContactForm: true, openUrl: "https://resend.com/inboxes" }
  // The auto-reply goes once per submission (= per thread). Failures here don't lose the message, so still report success.
  await Promise.all([
    sendEmail({ to: email, subject: meta(props).subject, react: createElement(ContactReceived, props), idempotencyKey: `contact-ack/${key}` }),
    env.EMAIL_ADMIN_NOTIFY &&
      sendEmail({ to: env.EMAIL_ADMIN_NOTIFY, replyTo: email, subject: noticeMeta(notice).subject, react: createElement(NewInboundNotification, notice), idempotencyKey: `contact-notify/${key}` }),
  ])
  return json({ ok: true, id: inbound.id } satisfies SendResult)
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)
