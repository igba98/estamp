import { test } from "node:test"
import assert from "node:assert/strict"
import { normalizeTzPhone } from "./plans.ts"

test("normalises Tanzanian mobile numbers", () => {
  assert.equal(normalizeTzPhone("0712 345 678"), "255712345678")
  assert.equal(normalizeTzPhone("+255 (712) 345-678"), "255712345678")
  assert.equal(normalizeTzPhone("255612345678"), "255612345678")
  assert.equal(normalizeTzPhone("712345678"), "255712345678")
  assert.equal(normalizeTzPhone("0222 123 456"), null) // landline
  assert.equal(normalizeTzPhone("07123"), null)
})
