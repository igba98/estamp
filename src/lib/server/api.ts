import "server-only"
import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

/*
 * /api/v1 helpers. The secret key bypasses row-level security, so every
 * query made with `db` must filter by the organisation from authenticate().
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY

export const db = createClient(url || "http://localhost:54321", secret || "missing", {
  auth: { persistSession: false, autoRefreshToken: false },
})

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

export function apiError(status: number, code: string, message: string) {
  return json({ error: { code, message } }, status)
}

const KEY_RE = /^Bearer\s+(es_live_[A-Za-z0-9_-]{40,60})$/

/** Resolve "Authorization: Bearer es_live_…" to an organisation id, or an error response. */
export async function authenticate(req: Request): Promise<{ orgId: string } | Response> {
  if (!url || !secret) return apiError(503, "not_configured", "The API isn't configured on this server.")
  const m = KEY_RE.exec(req.headers.get("authorization") ?? "")
  if (!m) return apiError(401, "unauthorized", "Send your API key as: Authorization: Bearer es_live_…")
  const hash = createHash("sha256").update(m[1]).digest("hex")
  const { data, error } = await db.rpc("api_org", { p_key_hash: hash })
  if (error) return apiError(500, "server_error", "Couldn't check the API key. Try again.")
  if (!data) return apiError(401, "unauthorized", "This API key is not valid or was revoked.")
  return { orgId: String(data) }
}

export const DOC_FIELDS =
  "id,ref,labels,org_name,stamped_by,stamp_names,file_name,kind,pages,size_bytes,original_hash,stamped_at,output_name,output_kind,output_bytes,output_hash,revoked_at,revoke_reason"

/** The public shape of a stamp record. */
export function stampOut(r: Record<string, unknown>, origin: string) {
  return {
    id: r.id,
    reference: r.ref,
    stamp: r.labels,
    organisation: r.org_name,
    stamped_by: r.stamped_by || null,
    stamps: r.stamp_names,
    stamped_at: r.stamped_at,
    file: { name: r.file_name, kind: r.kind, pages: r.pages, bytes: r.size_bytes, sha256: r.original_hash },
    output: r.output_hash
      ? { name: r.output_name, kind: r.output_kind, bytes: r.output_bytes, sha256: r.output_hash }
      : null,
    revoked: r.revoked_at ? { at: r.revoked_at, reason: r.revoke_reason || null } : null,
    verify_url: `${origin}/v?id=${r.id}`,
  }
}

export function registerOut(r: Record<string, unknown>) {
  return {
    id: r.id,
    number: r.reg_no,
    received_at: r.received_at,
    sender: r.sender,
    subject: r.subject,
    notes: r.notes,
    stamp_id: r.document_id ?? null,
    received_by: r.received_by_name || null,
  }
}

/** ?limit= clamped to 1..100 (default 50); ?before= an ISO date for paging. */
export function paging(u: URL) {
  const limit = Math.min(100, Math.max(1, Number(u.searchParams.get("limit")) || 50))
  const raw = u.searchParams.get("before")
  const before = raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw).toISOString() : null
  return { limit, before }
}

export type Member = { userId: string; email: string; orgId: string; role: string; displayName: string }

/** Resolve "Authorization: Bearer <Supabase session token>" to the caller's membership, or an error response. */
export async function sessionMember(req: Request): Promise<Member | Response> {
  const token = /^Bearer\s+(\S+)$/.exec(req.headers.get("authorization") ?? "")?.[1]
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } }
  if (!auth.user) return apiError(401, "unauthorized", "Sign in first.")
  const { data: me } = await db.from("members").select("org_id, role, display_name, email").eq("user_id", auth.user.id).maybeSingle()
  if (!me) return apiError(403, "not_member", "Not in an organisation.")
  return { userId: auth.user.id, email: auth.user.email ?? me.email, orgId: me.org_id, role: me.role, displayName: me.display_name }
}

/** Caller's IP as set by the host (Vercel overwrites x-forwarded-for, so it can't be spoofed there). */
export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null
}
