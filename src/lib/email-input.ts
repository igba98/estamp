import { z } from "zod"

/** Resend accepts 40 MB per email after base64 (which adds a third), so this leaves room for the message itself. */
export const MAX_ATTACHMENT_BYTES = 28 * 1024 * 1024
export const MAX_MESSAGE = 5000
export const MAX_SUBJECT = 150

/** Drop HTML tags and control characters from text people type; templates escape the rest. */
export function plainInput(s: string) {
  return s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?[a-z][^<>]*>/gi, "") // real tags only, so "price < 5000" survives
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
}

const text = (max: number, label: string) =>
  z
    .string()
    .transform(plainInput)
    .pipe(z.string().min(1, `${label} is required.`).max(max, `${label} can be up to ${max.toLocaleString("en")} characters.`))

export const contactSchema = z.object({
  name: text(100, "Your name"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.").max(254))
    .refine((e) => !e.endsWith("@workwithignas.com"), "Use your own email address."),
  subject: text(MAX_SUBJECT, "Subject"),
  message: text(MAX_MESSAGE, "Message"),
  token: z.string().min(1, "Complete the security check.").max(4096),
})
export type ContactInput = z.infer<typeof contactSchema>

export const documentEmailSchema = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, "Unknown document.") })

/** Typed result every send route returns. */
export type SendResult = { ok: true; id: string; to?: string } | { ok: false; code: string; message: string }

export function tooBigMessage(bytes: number) {
  const mb = (n: number) => `${Math.round((n / 1024 / 1024) * 10) / 10} MB`
  return `This file is ${mb(bytes)}; email supports up to ${mb(MAX_ATTACHMENT_BYTES)}. Download it instead.`
}
