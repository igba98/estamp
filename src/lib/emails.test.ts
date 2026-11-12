import { test } from "node:test"
import assert from "node:assert/strict"
import { approvalRequestedEmail, inviteEmail } from "./emails.ts"

test("user input can't inject HTML into emails", () => {
  const e = approvalRequestedEmail({ requester: "<script>x</script>", stamp: "Seal", file: 'a"><img src=x>.pdf', note: "ok & done", url: "https://e.co/approvals" })
  assert.ok(!e.html.includes("<script>") && !e.html.includes("<img"))
  assert.ok(e.html.includes("&lt;script&gt;") && e.html.includes("ok &amp; done"))
})

test("invite names the org, the email to use and the link", () => {
  const e = inviteEmail({ orgName: "Kilimanjaro Traders Ltd", inviter: "Asha", role: "member", appUrl: "https://e.co/", email: "juma@k.co.tz" })
  assert.equal(e.subject, "Asha invited you to Kilimanjaro Traders Ltd on eStamp")
  assert.ok(e.text.includes("juma@k.co.tz") && e.html.includes("https://e.co/"))
})
