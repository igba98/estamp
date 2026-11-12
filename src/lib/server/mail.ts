import "server-only"
import { ServerClient } from "postmark"
import type { Email } from "@/lib/emails"

const token = process.env.POSTMARK_SERVER_TOKEN
const from = process.env.POSTMARK_FROM
const stream = process.env.POSTMARK_STREAM || "outbound"
const client = token ? new ServerClient(token) : null

export const mailConfigured = Boolean(client && from)

/** Send one email to each recipient (separately, so addresses aren't shared). Returns how many were accepted. */
export async function sendMail(to: string[], email: Email) {
  if (!client || !from || !to.length) return 0
  const res = await client.sendEmailBatch(
    to.map((To) => ({ From: from, To, Subject: email.subject, HtmlBody: email.html, TextBody: email.text, MessageStream: stream })),
  )
  return res.filter((r) => r.ErrorCode === 0).length
}
