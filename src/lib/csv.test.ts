import { test } from "node:test"
import assert from "node:assert/strict"
import { toCsv } from "./csv.ts"

test("quotes cells, escapes quotes, defuses formulas", () => {
  assert.equal(toCsv([["a", 'say "hi"'], ["=SUM(A1)", "-1", "@x", "plain, comma"]]),
    '"a","say ""hi"""\r\n"\'=SUM(A1)","\'-1","\'@x","plain, comma"')
})
