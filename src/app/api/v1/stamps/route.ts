import type { NextRequest } from "next/server"
import { DOC_FIELDS, apiError, authenticate, db, json, paging, stampOut } from "@/lib/server/api"

/** GET /api/v1/stamps?limit=50&before=<ISO date> — newest first. */
export async function GET(req: NextRequest) {
  const auth = await authenticate(req)
  if (auth instanceof Response) return auth
  const { limit, before } = paging(req.nextUrl)
  let q = db.from("documents").select(DOC_FIELDS).eq("org_id", auth.orgId).order("stamped_at", { ascending: false }).limit(limit)
  if (before) q = q.lt("stamped_at", before)
  const { data, error } = await q
  if (error) return apiError(500, "server_error", "Couldn't load stamps.")
  const rows = data as unknown as Record<string, unknown>[]
  return json({
    data: rows.map((r) => stampOut(r, req.nextUrl.origin)),
    next_before: rows.length === limit ? rows[rows.length - 1].stamped_at : null,
  })
}
