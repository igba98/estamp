import { test } from "node:test"
import assert from "node:assert/strict"
import { createHmac, randomBytes } from "node:crypto"
import { parseWebhook } from "./webhook.ts"

const secret = `whsec_${randomBytes(24).toString("base64")}`
function sign(body: string, id: string, ts: number, key = secret) {
  const sig = createHmac("sha256", Buffer.from(key.slice(6), "base64")).update(`${id}.${ts}.${body}`).digest("base64")
  return new Headers({ "svix-id": id, "svix-timestamp": String(ts), "svix-signature": `v1,${sig}` })
}
const body = JSON.stringify({ type: "inbox.email.received", created_at: "2026-11-12T08:00:00Z", data: { email_id: "e1" } })
const now = () => Math.floor(Date.now() / 1000)

test("valid signature is accepted once, then flagged as a duplicate", () => {
  const seen = new Set<string>()
  const first = parseWebhook(body, sign(body, "msg_1", now()), secret, seen)
  assert(first.ok && !first.duplicate && first.event.type === "inbox.email.received")
  const again = parseWebhook(body, sign(body, "msg_1", now()), secret, seen)
  assert(again.ok && again.duplicate)
})

test("invalid signature, tampered body and wrong secret are rejected", () => {
  const seen = new Set<string>()
  assert.equal(parseWebhook(body, sign(body, "msg_2", now(), `whsec_${randomBytes(24).toString("base64")}`), secret, seen).ok, false)
  assert.equal(parseWebhook(body.replace("e1", "e2"), sign(body, "msg_2", now()), secret, seen).ok, false)
  assert.equal(parseWebhook(body, new Headers(), secret, seen).ok, false)
  assert.equal(seen.size, 0, "rejected events aren't remembered")
})

test("replayed old delivery (timestamp > 5 minutes off) is rejected", () => {
  assert.equal(parseWebhook(body, sign(body, "msg_3", now() - 10 * 60), secret, new Set()).ok, false)
  assert.equal(parseWebhook(body, sign(body, "msg_4", now() + 10 * 60), secret, new Set()).ok, false)
})
