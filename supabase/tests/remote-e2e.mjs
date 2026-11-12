// End-to-end check against the real Supabase project in .env.local:
// sign-in, org bootstrap, stamping, storage, public verify, approvals, isolation.
// Creates throwaway users (no emails are sent) and deletes everything it made.
// Run: npm run test:remote
import assert from "node:assert/strict"
import { createClient } from "@supabase/supabase-js"

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SECRET = process.env.SUPABASE_SECRET_KEY
assert(URL && PUB && SECRET, "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY")

const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(URL, SECRET, opts)
const run = Date.now().toString(36)
const made = { users: [], orgs: new Set(), files: [] }
const hex = (c) => c.repeat(64)

async function ok(p, label) {
  const { data, error } = await p
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function fails(p, expect, label) {
  const { error } = await p
  assert(error, `${label}: expected an error`)
  assert(error.message.includes(expect), `${label}: expected "${expect}", got "${error.message}"`)
}

async function signIn(role) {
  const email = `estamp-e2e-${role}-${run}@example.com`
  const { user } = await ok(admin.auth.admin.createUser({ email, email_confirm: true }), `create ${role}`)
  made.users.push(user.id)
  const link = await ok(admin.auth.admin.generateLink({ type: "magiclink", email }), `link ${role}`)
  const client = createClient(URL, PUB, opts)
  await ok(client.auth.verifyOtp({ email, token: link.properties.email_otp, type: "email" }), `code sign-in ${role}`)
  const org = await ok(client.rpc("bootstrap"), `bootstrap ${role}`)
  made.orgs.add(org)
  return { client, email, id: user.id, org }
}

try {
  const owner = await signIn("owner")
  await ok(owner.client.from("orgs").update({ name: "E2E Traders Ltd", ref_prefix: "EE" }).eq("id", owner.org), "rename org")
  await ok(
    owner.client.from("stamps").insert([
      { id: `rcv-${run}`, design: { name: "Received", label: "RECEIVED", orgName: "E2E Traders Ltd", ink: "blue", register: true } },
      { id: `seal-${run}`, design: { name: "Seal", label: "OFFICIAL", orgName: "E2E Traders Ltd", ink: "purple", requiresApproval: true } },
    ]),
    "create stamps",
  )

  // Stamp, store the file, lock the fingerprint.
  const issued = await ok(
    owner.client.rpc("issue_stamp", { p_stamp_ids: [`rcv-${run}`], p_file_name: "letter.pdf", p_kind: "pdf", p_pages: 1, p_size_bytes: 10, p_original_hash: hex("a") }),
    "issue",
  )
  assert.match(issued.ref, /^EE-\d{4}-0001$/)
  assert.match(issued.register_no, /^IN\/\d{4}\/0001$/)
  const path = `${owner.org}/${issued.id}/letter-stamped.pdf`
  await ok(owner.client.storage.from("stamped").upload(path, new Blob(["%PDF-1.4 e2e"], { type: "application/pdf" })), "upload")
  made.files.push(["stamped", path])
  await ok(
    owner.client.rpc("complete_stamp", { p_id: issued.id, p_output_name: "letter-stamped.pdf", p_output_kind: "pdf", p_output_bytes: 12, p_output_hash: hex("b"), p_output_path: path, p_thumb: null }),
    "complete",
  )
  await fails(
    owner.client.rpc("complete_stamp", { p_id: issued.id, p_output_name: "x", p_output_kind: "pdf", p_output_bytes: 1, p_output_hash: hex("c"), p_output_path: null, p_thumb: null }),
    "not_found",
    "fingerprint is write-once",
  )

  // Anyone can verify by id, and only that.
  const anon = createClient(URL, PUB, opts)
  const rec = await ok(anon.rpc("verify_stamp", { p_id: issued.id }), "public verify")
  assert.equal(rec.output_hash, hex("b"))
  assert.equal(rec.org_name, "E2E Traders Ltd")
  const anonDocs = await anon.from("documents").select("id")
  assert(anonDocs.error || anonDocs.data.length === 0, "anon must not list documents")

  // Invited staff joins as a member; approval gate.
  await ok(owner.client.from("invites").insert({ email: `estamp-e2e-staff-${run}@example.com`, role: "member" }), "invite")
  const staff = await signIn("staff")
  assert.equal(staff.org, owner.org, "invite puts staff in the owner's org")
  await fails(
    staff.client.rpc("issue_stamp", { p_stamp_ids: [`seal-${run}`], p_file_name: "inv.pdf", p_kind: "pdf", p_pages: 1, p_size_bytes: 10, p_original_hash: hex("e") }),
    "approval_required",
    "gate",
  )
  const apId = crypto.randomUUID()
  const apPath = `${owner.org}/${apId}/inv.pdf`
  await ok(staff.client.storage.from("approvals").upload(apPath, new Blob(["inv"])), "approval upload")
  made.files.push(["approvals", apPath])
  await ok(
    staff.client.from("approvals").insert({ id: apId, stamp_id: `seal-${run}`, file_name: "inv.pdf", original_hash: hex("e"), file_path: apPath, size_bytes: 3 }),
    "request approval",
  )
  await ok(owner.client.storage.from("approvals").download(apPath), "admin opens approval file")
  await fails(staff.client.rpc("decide_approval", { p_id: apId, p_approve: true, p_note: "" }), "admins_only", "member can't approve")
  await ok(owner.client.rpc("decide_approval", { p_id: apId, p_approve: true, p_note: "ok" }), "approve")
  const second = await ok(
    staff.client.rpc("issue_stamp", { p_stamp_ids: [`seal-${run}`], p_file_name: "inv.pdf", p_kind: "pdf", p_pages: 1, p_size_bytes: 10, p_original_hash: hex("e") }),
    "issue after approval",
  )
  await ok(
    staff.client.rpc("complete_stamp", { p_id: second.id, p_output_name: "inv-stamped.pdf", p_output_kind: "pdf", p_output_bytes: 1, p_output_hash: hex("f"), p_output_path: null, p_thumb: null }),
    "complete after approval",
  )
  const ap = await ok(owner.client.from("approvals").select("status").eq("id", apId).single(), "approval status")
  assert.equal(ap.status, "used")

  // API v1 through the running app (E2E_BASE_URL, default http://localhost:3001).
  const base = process.env.E2E_BASE_URL ?? "http://localhost:3001"
  const reachable = await fetch(`${base}/api/billing/status`).then((r) => r.ok, () => false)
  if (reachable) {
    const { createHash, randomBytes } = await import("node:crypto")
    const key = "es_live_" + randomBytes(32).toString("base64url")
    await ok(
      owner.client.from("api_keys").insert({ name: "e2e", prefix: key.slice(0, 16), key_hash: createHash("sha256").update(key).digest("hex") }),
      "create API key",
    )
    const call = (path, init = {}) =>
      fetch(`${base}${path}`, { ...init, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers } })
    assert.equal((await fetch(`${base}/api/v1/stamps`)).status, 401, "no key → 401")
    const list = await (await call("/api/v1/stamps")).json()
    assert.equal(list.data.length, 2, "API lists the org's stamps")
    const one = await (await call(`/api/v1/stamps/${issued.ref}`)).json()
    assert.equal(one.data.id, issued.id, "lookup by reference")
    assert.equal((await call("/api/v1/stamps/not-a-real-ref")).status, 404)
    const v = await (await call("/api/v1/verify", { method: "POST", body: JSON.stringify({ sha256: hex("b") }) })).json()
    assert.equal(v.data[0]?.match, "stamped_copy", "verify by fingerprint")
    const reg = await call("/api/v1/register", { method: "POST", body: JSON.stringify({ sender: "TRA", subject: "Notice" }) })
    assert.equal(reg.status, 201)
    assert.match((await reg.json()).data.number, /^IN\/\d{4}\/0002$/)
    const status = await (await fetch(`${base}/api/billing/status`)).json()
    assert.equal(status.enabled, false, "payments closed until a provider is set")
    assert.equal((await fetch(`${base}/api/billing/checkout`, { method: "POST" })).status, 503)
    // Notifications: only the right person can trigger each email (all of these are refused, so nothing is sent).
    const tokenOf = async (u) => (await u.client.auth.getSession()).data.session.access_token
    const notify = async (u, body) =>
      (await fetch(`${base}/api/notify`, { method: "POST", headers: { "Content-Type": "application/json", ...(u ? { Authorization: `Bearer ${await tokenOf(u)}` } : {}) }, body: JSON.stringify(body) })).status
    const mailOn = (await notify(null, { type: "invite", email: "x@example.com" })) !== 503
    if (mailOn) {
      assert.equal(await notify(null, { type: "invite", email: "x@example.com" }), 401, "notify needs a session")
      assert.equal(await notify(staff, { type: "invite", email: "x@example.com" }), 403, "members can't send invites")
      assert.equal(await notify(staff, { type: "approval_decided", id: apId }), 403, "members can't announce decisions")
      assert.equal(await notify(owner, { type: "approval_requested", id: apId }), 404, "only the requester announces a request")
      assert.equal(await notify(owner, { type: "invite", email: "nobody@example.com" }), 404, "no invite, no email")
      assert.equal(await notify(owner, { type: "spam" }), 400)
    }
    console.log(`API checks passed${mailOn ? " (incl. notification permissions)" : ""}`)
  } else console.log(`API checks skipped: ${base} not running`)

  // Another organisation sees none of it.
  const outsider = await signIn("outsider")
  assert.notEqual(outsider.org, owner.org)
  for (const t of ["stamps", "documents", "register_entries", "approvals", "members"]) {
    const rows = await ok(outsider.client.from(t).select("*"), `outsider ${t}`)
    assert(rows.every((r) => (r.org_id ?? outsider.org) === outsider.org), `outsider sees ${t} of another org`)
  }
  const peek = await outsider.client.storage.from("stamped").download(path)
  assert(peek.error, "outsider must not download another org's file")

  console.log("REMOTE E2E PASSED")
} finally {
  for (const [bucket, p] of made.files) await admin.storage.from(bucket).remove([p])
  for (const id of made.users) await admin.auth.admin.deleteUser(id)
  if (made.orgs.size) await admin.from("orgs").delete().in("id", [...made.orgs])
}
