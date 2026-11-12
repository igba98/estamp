import "server-only"
import type { ReactElement } from "react"
import { Resend, type Attachment } from "resend"
import type { Email } from "@/lib/emails"
import type { SendResult } from "@/lib/email-input"
import { renderEmail } from "@/emails"
import { env } from "./env"

/** The one Resend client. Never import this from client code. */
export const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null
export const mailConfigured = Boolean(resend)

type Send = {
  to: string
  subject: string
  react?: ReactElement
  email?: Email
  attachments?: Attachment[]
  replyTo?: string
  headers?: Record<string, string>
  /** Resend drops a repeat with the same key for 24h, so retries can't double-send. */
  idempotencyKey?: string
}

/** One recipient per send, from EMAIL_FROM (the estamp inbox, so replies land in its threads). HTML + plain text always. */
export async function sendEmail(s: Send): Promise<SendResult> {
  if (!resend) return { ok: false, code: "mail_not_configured", message: "Email isn't set up on this server." }
  const body = s.react ? await renderEmail(s.react) : { html: s.email!.html, text: s.email!.text }
  const send = () =>
    resend!.emails.send(
      { from: env.EMAIL_FROM, to: s.to, subject: s.subject, ...body, attachments: s.attachments, replyTo: s.replyTo, headers: s.headers },
      s.idempotencyKey ? { idempotencyKey: s.idempotencyKey } : undefined,
    )
  let { data, error } = await send()
  // Resend allows ~2 requests/second; one retry after a pause covers bursts (idempotency keys make it safe).
  if (error?.name === "rate_limit_exceeded") ({ data, error } = await new Promise<Awaited<ReturnType<typeof send>>>((r) => setTimeout(() => r(send()), 1100)))
  if (error || !data) {
    console.error("resend send failed", error?.name, error?.message) // no addresses or content in logs
    return { ok: false, code: "send_failed", message: "The email didn't go out. Try again in a minute." }
  }
  return { ok: true, id: data.id }
}

/** Send one email to each recipient (separately, so addresses aren't shared). Returns how many were accepted. */
export async function sendMail(to: string[], email: Email) {
  if (!resend || !to.length) return 0
  // One batch request (up to 100), so a handful of admins doesn't trip the rate limit.
  const { data, error } = await resend.batch.send(to.slice(0, 100).map((addr) => ({ from: env.EMAIL_FROM, to: addr, subject: email.subject, html: email.html, text: email.text })))
  if (error) console.error("resend batch failed", error.name, error.message)
  return data?.data.length ?? 0
}

/** Reply inside an existing thread of the estamp inbox (goes out from the inbox address, threaded for the recipient). */
export async function replyInThread(threadId: string, emailId: string, react: ReactElement) {
  if (!resend || !env.RESEND_ESTAMP_INBOX_ID) return false
  const { html, text } = await renderEmail(react)
  const { error } = await resend.inboxes.threads.emails.reply({ inboxId: env.RESEND_ESTAMP_INBOX_ID, threadId, emailId, html, text })
  return !error
}
