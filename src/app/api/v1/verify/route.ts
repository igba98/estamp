import type { NextRequest } from "next/server"
import { DOC_FIELDS, apiError, authenticate, db, json, stampOut } from "@/lib/server/api"

/**
 * POST /api/v1/verify  { "sha256": "<64 hex>" }
 * Is this file one your organisation stamped (the stamped copy) or the original of one?
 */
export async function POST(req: NextRequest) {
  const auth = await authenticate(req)
  if (auth instanceof Response) return auth
  const body = (await req.json().catch(() => null)) as { sha256?: unknown } | null
  const hash = typeof body?.sha256 === "string" ? body.sha256.toLowerCase() : ""
  if (!/^[0-9a-f]{64}$/.test(hash)) return apiError(400, "bad_request", 'Send JSON: { "sha256": "<64 hex characters>" }')
  const { data, error } = await db
    .from("documents")
    .select(DOC_FIELDS)
    .eq("org_id", auth.orgId)
    .or(`output_hash.eq.${hash},original_hash.eq.${hash}`)
    .order("stamped_at", { ascending: false })
    .limit(20)
  if (error) return apiError(500, "server_error", "Couldn't check the file.")
  const rows = data as unknown as Record<string, unknown>[]
  return json({
    data: rows.map((r) => ({
      match: r.output_hash === hash ? "stamped_copy" : "original",
      stamp: stampOut(r, req.nextUrl.origin),
    })),
  })
}
