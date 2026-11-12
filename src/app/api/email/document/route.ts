import { createElement } from "react"
import type { NextRequest } from "next/server"
import StampedDocument from "@/emails/stamped-document"
import { MAX_ATTACHMENT_BYTES, documentEmailSchema, tooBigMessage, type SendResult } from "@/lib/email-input"
import { apiError, db, json, sessionMember } from "@/lib/server/api"
import { env } from "@/lib/server/env"
import { mailConfigured, sendEmail } from "@/lib/server/mail"
import { retryText, sendLimiter } from "@/lib/server/rate-limit"

const fail = (status: number, code: string, message: string) => json({ ok: false, code, message } satisfies SendResult, status)

/**
 * POST /api/email/document {id} — emails a stamped file to the signed-in person's own address.
 * The recipient is always the account email, so this can't be used to mail anyone else.
 */
export async function POST(req: NextRequest) {
  if (!mailConfigured) return fail(503, "mail_not_configured", "Email isn't set up on this server yet. Download the file instead.")
  const me = await sessionMember(req)
  if (me instanceof Response) return me
  const parsed = documentEmailSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError(400, "bad_request", "Unknown document.")

  const { data: doc } = await db
    .from("documents")
    .select("id, ref, stamp_names, stamped_at, pages, output_name, output_bytes, output_path")
    .eq("id", parsed.data.id)
    .eq("org_id", me.orgId)
    .maybeSingle()
  if (!doc) return fail(404, "not_found", "That document isn't in your organisation.")
  if (!doc.output_path || !doc.output_name) return fail(409, "not_stored", "This copy wasn't saved online, so it can't be emailed. Download it instead.")
  if ((doc.output_bytes ?? 0) > MAX_ATTACHMENT_BYTES) return fail(413, "too_large", tooBigMessage(doc.output_bytes))

  // Checked after the cheap refusals so a typo doesn't use up the hourly allowance.
  const limit = await sendLimiter.take(`doc:${me.userId}`)
  if (!limit.ok) return fail(429, "rate_limited", `You've emailed a lot of documents. Try again ${retryText(limit.retryAfterSec)}.`)

  const { data: file, error } = await db.storage.from("stamped").download(doc.output_path)
  if (error || !file) return fail(502, "storage_error", "Couldn't fetch the stamped file. Try again.")
  if (file.size > MAX_ATTACHMENT_BYTES) return fail(413, "too_large", tooBigMessage(file.size))

  const appUrl = env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const props = {
    recipient: me.email,
    fileName: doc.output_name,
    stampNames: doc.stamp_names,
    reference: doc.ref,
    appliedAt: doc.stamped_at,
    pages: doc.pages,
    sizeBytes: file.size,
    verifyUrl: `${appUrl}/v?id=${encodeURIComponent(doc.id)}`,
    appUrl,
  }
  const result = await sendEmail({
    to: me.email,
    subject: `Stamped: ${doc.output_name}`,
    react: createElement(StampedDocument, props),
    attachments: [{ filename: doc.output_name, content: Buffer.from(await file.arrayBuffer()), contentType: file.type || undefined }],
  })
  return result.ok ? json({ ...result, to: me.email }) : json(result, 502)
}
