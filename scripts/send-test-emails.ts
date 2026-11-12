// Sends every template (realistic + worst-case props) to EMAIL_ADMIN_NOTIFY in one Resend batch.
// Run: npm run email:send-tests   (needs RESEND_API_KEY, EMAIL_ADMIN_NOTIFY and, for images, NEXT_PUBLIC_APP_URL in .env.local)
import { Resend } from "resend"
import { allCases, renderEmail } from "../src/emails/index.ts"

async function main() {
  const { RESEND_API_KEY: key, EMAIL_ADMIN_NOTIFY: to, EMAIL_FROM: from = "eStamp <estamp@workwithignas.com>" } = process.env
  if (!key?.startsWith("re_") || !to) throw new Error("Set RESEND_API_KEY and EMAIL_ADMIN_NOTIFY in .env.local")
  if (!process.env.NEXT_PUBLIC_APP_URL) console.warn("NEXT_PUBLIC_APP_URL is not set: images will be broken (alt text shows).")
  const emails = await Promise.all(
    allCases().map(async (c) => ({ from, to, subject: `[${c.name} · ${c.variant}] ${c.meta.subject}`, ...(await renderEmail(c.element)) })),
  )
  const { data, error } = await new Resend(key).batch.send(emails)
  if (error) throw new Error(`Resend refused the batch: ${error.message}`)
  console.log(`Sent ${data?.data.length ?? 0} test emails to ${to}`)
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
