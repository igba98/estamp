import type { NextRequest } from "next/server"
import { apiError, db, json } from "@/lib/server/api"
import { paymentProvider } from "@/lib/server/payments"
import { PLANS, normalizeTzPhone } from "@/lib/plans"

/**
 * POST /api/billing/checkout  { plan, phone, months? }
 * Called by the app with the admin's Supabase session token.
 */
export async function POST(req: NextRequest) {
  const provider = paymentProvider()
  if (!provider) return apiError(503, "payments_closed", "Payments aren't open yet.")

  const token = /^Bearer\s+(\S+)$/.exec(req.headers.get("authorization") ?? "")?.[1]
  if (!token) return apiError(401, "unauthorized", "Sign in first.")
  const { data: auth } = await db.auth.getUser(token)
  if (!auth.user) return apiError(401, "unauthorized", "Sign in first.")
  const { data: me } = await db.from("members").select("org_id, role").eq("user_id", auth.user.id).maybeSingle()
  if (!me || me.role === "member") return apiError(403, "admins_only", "Only admins can pay for the organisation.")

  const body = (await req.json().catch(() => null)) as { plan?: unknown; phone?: unknown; months?: unknown } | null
  const plan = PLANS.find((p) => p.id === body?.plan)
  const phone = typeof body?.phone === "string" ? normalizeTzPhone(body.phone) : null
  const months = Number.isInteger(body?.months) ? Math.min(12, Math.max(1, Number(body!.months))) : 1
  if (!plan?.amountTzs) return apiError(400, "bad_plan", "That plan can't be bought yet.")
  if (!phone) return apiError(400, "bad_phone", "Enter a Tanzanian mobile number, e.g. 0712 345 678.")

  const amountTzs = plan.amountTzs * months
  const { data: payment, error } = await db
    .from("payments")
    .insert({ org_id: me.org_id, created_by: auth.user.id, plan: plan.id, months, amount_tzs: amountTzs, phone, provider: provider.name })
    .select("id")
    .single()
  if (error || !payment) return apiError(500, "server_error", "Couldn't start the payment. Try again.")

  try {
    const { providerRef } = await provider.startPayment({
      paymentId: payment.id,
      amountTzs,
      phone,
      description: `eStamp ${plan.name} × ${months}`,
    })
    if (providerRef) await db.from("payments").update({ provider_ref: providerRef }).eq("id", payment.id)
  } catch {
    await db.rpc("mark_payment_failed", { p_id: payment.id })
    return apiError(502, "provider_error", "The payment service didn't respond. Nothing was charged; try again.")
  }
  return json({ data: { payment_id: payment.id, status: "pending" } }, 201)
}
