import type { NextRequest } from "next/server"
import { DOC_FIELDS, apiError, authenticate, db, json, stampOut } from "@/lib/server/api"

/** GET /api/v1/stamps/{id or reference} — e.g. /api/v1/stamps/ES-2026-0007 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/stamps/[id]">) {
  const auth = await authenticate(req)
  if (auth instanceof Response) return auth
  const key = (await ctx.params).id
  // Ids and references only use these characters; anything else can't match (and can't reach the filter).
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(key)) return apiError(404, "not_found", "No stamp with that id or reference in your organisation.")
  const { data, error } = await db
    .from("documents")
    .select(DOC_FIELDS)
    .eq("org_id", auth.orgId)
    .or(`id.eq.${key},ref.eq.${key}`)
    .maybeSingle()
  if (error) return apiError(500, "server_error", "Couldn't load the stamp.")
  if (!data) return apiError(404, "not_found", "No stamp with that id or reference in your organisation.")
  return json({ data: stampOut(data as unknown as Record<string, unknown>, req.nextUrl.origin) })
}
