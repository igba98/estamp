import type { NextRequest } from "next/server"
import { apiError, db, json } from "@/lib/server/api"
import { paymentProvider } from "@/lib/server/payments"

/** POST /api/billing/webhook/{provider} — the provider tells us a payment finished. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/billing/webhook/[provider]">) {
  const provider = paymentProvider()
  if (!provider || provider.name !== (await ctx.params).provider) return apiError(404, "not_found", "Unknown provider.")
  let result
  try {
    result = await provider.parseWebhook(req)
  } catch {
    return apiError(401, "bad_signature", "Webhook not authentic.")
  }
  const { error } =
    result.status === "paid"
      ? await db.rpc("mark_payment_paid", { p_id: result.paymentId, p_provider_ref: result.providerRef, p_amount_tzs: result.amountTzs })
      : await db.rpc("mark_payment_failed", { p_id: result.paymentId })
  // A repeated webhook returns false from the database and is still acknowledged.
  if (error) return apiError(500, "server_error", "Couldn't record the payment.")
  return json({ ok: true })
}
