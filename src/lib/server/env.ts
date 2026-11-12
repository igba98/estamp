import "server-only"
import { z } from "zod"

// Empty values in .env files ("KEY=") count as "not set".
const opt = <T extends z.ZodType>(s: T) => z.preprocess((v) => (v === "" ? undefined : v), s.optional())

const schema = z.object({
  RESEND_API_KEY: opt(z.string().regex(/^re_[A-Za-z0-9_]{16,}$/, "must be a Resend API key (re_…)")),
  RESEND_WEBHOOK_SECRET: opt(z.string().regex(/^whsec_[A-Za-z0-9+/=]{16,}$/, "must be a webhook signing secret (whsec_…)")),
  RESEND_ESTAMP_INBOX_ID: opt(z.uuid()),
  EMAIL_FROM: z.string().regex(/^[^<>]*<[^@\s<>]+@[^@\s<>]+>$/, 'must look like "eStamp <estamp@example.com>"').default("eStamp <estamp@workwithignas.com>"),
  EMAIL_ADMIN_NOTIFY: opt(z.email()),
  NEXT_PUBLIC_APP_URL: opt(z.url({ protocol: /^https?$/ })),
  TURNSTILE_SECRET_KEY: opt(z.string().min(10)),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  // Fail loudly at boot (instrumentation.ts) instead of sending broken email later.
  throw new Error(`Invalid email settings in the environment:\n${z.prettifyError(parsed.error)}`)
}

/** Server-only settings. Missing optional values switch the matching feature off (routes answer 503). */
export const env = parsed.data
/** The bare address in EMAIL_FROM, e.g. estamp@workwithignas.com. */
export const fromAddress = /<([^>]+)>/.exec(env.EMAIL_FROM)![1].toLowerCase()
