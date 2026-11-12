import type { NextRequest } from "next/server"
import { apiError, authenticate, db, json, paging, registerOut } from "@/lib/server/api"

/** GET /api/v1/register?limit=50&before=<ISO date> — newest first. */
export async function GET(req: NextRequest) {
  const auth = await authenticate(req)
  if (auth instanceof Response) return auth
  const { limit, before } = paging(req.nextUrl)
  let q = db.from("register_entries").select("*").eq("org_id", auth.orgId).order("received_at", { ascending: false }).limit(limit)
  if (before) q = q.lt("received_at", before)
  const { data, error } = await q
  if (error) return apiError(500, "server_error", "Couldn't load the register.")
  return json({
    data: data.map(registerOut),
    next_before: data.length === limit ? data[data.length - 1].received_at : null,
  })
}

/** POST /api/v1/register  { "sender": "…", "subject": "…", "notes": "…" } — gets the next number. */
export async function POST(req: NextRequest) {
  const auth = await authenticate(req)
  if (auth instanceof Response) return auth
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
  const sender = str(body?.sender, 200)
  const subject = str(body?.subject, 300)
  if (!body || (!sender && !subject)) {
    return apiError(400, "bad_request", 'Send JSON with at least "sender" or "subject".')
  }
  const { data, error } = await db.rpc("api_add_register_entry", {
    p_org: auth.orgId,
    p_sender: sender,
    p_subject: subject,
    p_notes: str(body.notes, 2000),
  })
  if (error) return apiError(500, "server_error", "Couldn't add the entry.")
  return json({ data: registerOut(data as Record<string, unknown>) }, 201)
}
