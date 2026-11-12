import { test } from "node:test"
import assert from "node:assert/strict"
import { memoryLimiter } from "./rate-limit.ts"

const HOUR = 3_600_000
test("5 an hour, 20 a day, per key", async () => {
  let t = 0
  const lim = memoryLimiter([{ limit: 5, ms: HOUR }, { limit: 20, ms: 24 * HOUR }], () => t)
  for (let i = 0; i < 5; i++) assert.equal((await lim.take("ip:1")).ok, true)
  const sixth = await lim.take("ip:1")
  assert.equal(sixth.ok, false)
  assert.equal(!sixth.ok && sixth.retryAfterSec, 3600)
  assert.equal((await lim.take("ip:2")).ok, true, "other keys unaffected")

  // Refused calls don't count; after an hour the hourly window frees up.
  t = HOUR
  for (let i = 0; i < 5; i++) assert.equal((await lim.take("ip:1")).ok, true)
  for (const h of [2, 3]) {
    t = h * HOUR
    for (let i = 0; i < 5; i++) assert.equal((await lim.take("ip:1")).ok, true)
  }
  t = 4 * HOUR
  const daily = await lim.take("ip:1")
  assert.equal(daily.ok, false, "21st in a day refused")
  assert.equal(!daily.ok && daily.retryAfterSec, 20 * 3600)
  t = 24 * HOUR
  assert.equal((await lim.take("ip:1")).ok, true, "day window slides")
})

test("memory stays bounded", async () => {
  const lim = memoryLimiter([{ limit: 1, ms: HOUR }], () => 0, 3)
  for (const k of ["a", "b", "c", "d"]) await lim.take(k)
  assert.equal((await lim.take("a")).ok, true, "oldest key was evicted")
})
