import { test } from "node:test"
import assert from "node:assert/strict"
import { cornerPlacement } from "./placement.ts"

const base = { id: "p", stampId: "s", page: 0, widthMm: 40, aspect: 1, image: false, showQR: false }
const A4 = { widthPt: 595, heightPt: 842 }

test("40 mm stamp on A4 sits inside the bottom-right corner at real size", () => {
  const p = cornerPlacement({ ...base, info: A4, corner: "br" })
  assert.ok(Math.abs(p.w - 40 / 210) < 0.002)
  assert.ok(p.x + p.w / 2 <= 1 && p.x > 0.5)
  const h = p.w * (595 / 842)
  assert.ok(p.y + h / 2 <= 1 && p.y > 0.5)
})

test("top-left mirrors bottom-right", () => {
  const br = cornerPlacement({ ...base, info: A4, corner: "br" })
  const tl = cornerPlacement({ ...base, info: A4, corner: "tl" })
  assert.ok(Math.abs(tl.x - (1 - br.x)) < 1e-9 && Math.abs(tl.y - (1 - br.y)) < 1e-9)
})

test("a very wide stamp on a tiny landscape page stays on the page", () => {
  const p = cornerPlacement({ ...base, info: { widthPt: 100, heightPt: 40 }, widthMm: 90, aspect: 0.5, corner: "bl" })
  assert.ok(p.w <= 0.75 && p.x - p.w / 2 >= 0 && p.y >= 0 && p.y <= 1)
})
