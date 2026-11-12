import { test } from "node:test"
import assert from "node:assert/strict"
import { allCases, renderEmail } from "./index.ts"

for (const c of allCases()) {
  test(`${c.name} (${c.variant}) renders HTML + plain text with its preheader`, async () => {
    const { html, text } = await renderEmail(c.element)
    const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;")
    assert(html.includes(esc(c.meta.preheader.slice(0, 40))), "preheader in the hidden preview line")
    assert(c.meta.subject.length > 0 && !/undefined|NaN|null/.test(c.meta.subject), `subject: ${c.meta.subject}`)
    assert(text.length > 200 && !/<\/?(p|div|table|tr|td|span|a|img|br|h1|h2)\b/i.test(text), "plain-text version has content and no tags")
    assert(text.includes("eStamp by Work Ignas"), "footer in plain text")
    assert(html.includes('name="color-scheme" content="dark"'), "dark color-scheme meta")
    assert(!/<svg/i.test(html), "no SVG (Gmail blocks it)")
    assert(!/>(undefined|NaN|null)</.test(html), "no empty values printed")
    for (const img of html.match(/<img[^>]*>/g) ?? []) assert(/alt="/.test(img) && /width="\d+"/.test(img) && /height="\d+"/.test(img), `img needs alt + size: ${img}`)
  })
}

test("long values are never truncated", async () => {
  const c = allCases().find((x) => x.name === "stamped-document" && x.variant === "long")!
  const { text } = await renderEmail(c.element)
  assert(text.includes("Mkataba_wa_Ukodishaji_wa_Ofisi_Kariakoo_Toleo_la_Mwisho_IMESAINIWA_v12_FINAL(3).pdf"))
  const r = allCases().find((x) => x.name === "receipt" && x.variant === "big")!
  assert((await renderEmail(r.element)).text.includes("12,450,000.00"))
})
