import { test } from "node:test"
import assert from "node:assert/strict"
import { contactSchema, documentEmailSchema, MAX_ATTACHMENT_BYTES, plainInput, tooBigMessage } from "./email-input.ts"

const ok = { name: "Neema Kileo", email: " Neema@PwaniLogistics.co.tz ", subject: "Bulk stamping", message: "Hello", token: "tok" }

test("contact form: valid input is trimmed and lower-cased", () => {
  const r = contactSchema.parse(ok)
  assert.equal(r.email, "neema@pwanilogistics.co.tz")
})

test("contact form: HTML is stripped, and a message of only tags is empty", () => {
  assert.equal(contactSchema.parse({ ...ok, message: "<b>Hi</b> <script>alert(1)</script>there" }).message, "Hi alert(1)there")
  assert.equal(contactSchema.safeParse({ ...ok, message: "<img src=x onerror=alert(1)>" }).success, false)
  assert.equal(plainInput("a\u0000b\u0007c"), "abc")
  assert.equal(plainInput("Price < 5000 TZS, more than 3 > 2?"), "Price < 5000 TZS, more than 3 > 2?", "a lone < doesn't swallow the rest")
  assert.equal(plainInput("a<!-- hidden -->b"), "ab")
})

test("contact form: length caps, required fields, own domain refused", () => {
  assert.equal(contactSchema.safeParse({ ...ok, message: "x".repeat(5001) }).success, false)
  assert.equal(contactSchema.safeParse({ ...ok, message: "x".repeat(5000) }).success, true)
  assert.equal(contactSchema.safeParse({ ...ok, subject: "x".repeat(151) }).success, false)
  assert.equal(contactSchema.safeParse({ ...ok, token: "" }).success, false)
  assert.equal(contactSchema.safeParse({ ...ok, email: "not-an-email" }).success, false)
  assert.equal(contactSchema.safeParse({ ...ok, email: "estamp@workwithignas.com" }).success, false)
  assert.equal(contactSchema.safeParse({ ...ok, email: "a@b.co, c@d.co" }).success, false, "one recipient only")
})

test("document email: only id-shaped values", () => {
  assert.equal(documentEmailSchema.safeParse({ id: "k3J9xQ2mT7pL" }).success, true)
  assert.equal(documentEmailSchema.safeParse({ id: "x,org_id.eq.1" }).success, false)
  assert.equal(documentEmailSchema.safeParse({}).success, false)
})

test("size message names both sizes", () => {
  assert.match(tooBigMessage(31 * 1024 * 1024), /^This file is 31 MB; email supports up to 28 MB\. Download it instead\.$/)
  assert(MAX_ATTACHMENT_BYTES * (4 / 3) < 40 * 1024 * 1024, "base64 attachment stays under Resend's 40 MB")
})
