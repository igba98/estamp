import type { NextRequest } from "next/server"
import { apiError, db, json, sessionMember } from "@/lib/server/api"
import { mailConfigured, sendMail } from "@/lib/server/mail"
import { approvalDecidedEmail, approvalRequestedEmail, inviteEmail } from "@/lib/emails"

type Body =
  | { type: "invite"; email: string }
  | { type: "approval_requested"; id: string }
  | { type: "approval_decided"; id: string }

// Notifications only go out right after the action, so this can't be replayed to spam people.
const FRESH_MS = 10 * 60 * 1000
const fresh = (at: string | null) => !!at && Date.now() - Date.parse(at) < FRESH_MS

/**
 * POST /api/notify — emails people about something the caller just did.
 * The server re-reads the record and decides who gets what; the browser only says which event.
 */
export async function POST(req: NextRequest) {
  if (!mailConfigured) return apiError(503, "mail_not_configured", "Email isn't set up on this server.")
  const m = await sessionMember(req)
  if (m instanceof Response) return m
  const me = { org_id: m.orgId, role: m.role, display_name: m.displayName, email: m.email }
  const auth = { user: { id: m.userId } }
  const admin = me.role === "owner" || me.role === "admin"
  const body = (await req.json().catch(() => null)) as Body | null
  const origin = req.nextUrl.origin

  if (body?.type === "invite" && typeof body.email === "string") {
    if (!admin) return apiError(403, "admins_only", "Only admins invite people.")
    const email = body.email.trim().toLowerCase()
    const [{ data: inv }, { data: org }] = await Promise.all([
      db.from("invites").select("role, created_at").eq("org_id", me.org_id).eq("email", email).maybeSingle(),
      db.from("orgs").select("name").eq("id", me.org_id).single(),
    ])
    if (!inv || !org || !fresh(inv.created_at)) return apiError(404, "not_found", "No recent invite for that email.")
    const sent = await sendMail([email], inviteEmail({ orgName: org.name, inviter: me.display_name || me.email, role: inv.role, appUrl: `${origin}/`, email }))
    return json({ sent })
  }

  if ((body?.type === "approval_requested" || body?.type === "approval_decided") && typeof body.id === "string" && /^[0-9a-f-]{36}$/.test(body.id)) {
    const { data: a } = await db.from("approvals").select("*").eq("id", body.id).eq("org_id", me.org_id).maybeSingle()
    if (!a) return apiError(404, "not_found", "No such request.")
    const { data: stamp } = await db.from("stamps").select("design").eq("id", a.stamp_id).maybeSingle()
    const stampName = String((stamp?.design as { name?: string } | undefined)?.name ?? "a stamp")
    const url = `${origin}/approvals`

    if (body.type === "approval_requested") {
      if (a.requested_by !== auth.user.id || a.status !== "pending" || !fresh(a.created_at)) return apiError(404, "not_found", "No new request to announce.")
      const { data: admins } = await db.from("members").select("email").eq("org_id", me.org_id).in("role", ["owner", "admin"])
      const to = (admins ?? []).map((m) => m.email).filter((e) => e && e !== me.email)
      const sent = await sendMail(to, approvalRequestedEmail({ requester: a.requester_name || me.email, stamp: stampName, file: a.file_name, note: a.note, url }))
      return json({ sent })
    }

    if (!admin) return apiError(403, "admins_only", "Only admins decide requests.")
    if (!["approved", "rejected"].includes(a.status) || !fresh(a.decided_at)) return apiError(404, "not_found", "No new decision to announce.")
    const { data: requester } = await db.from("members").select("email").eq("user_id", a.requested_by).maybeSingle()
    const sent = await sendMail(requester?.email ? [requester.email] : [], approvalDecidedEmail({
      approved: a.status === "approved", decider: a.decider_name, stamp: stampName, file: a.file_name, note: a.decision_note, url,
    }))
    return json({ sent })
  }

  return apiError(400, "bad_request", "Unknown notification.")
}
