import { connection } from "next/server"
import { json } from "@/lib/server/api"
import { paymentProvider } from "@/lib/server/payments"
import { PLANS } from "@/lib/plans"

/** GET /api/billing/status — can people pay yet? Read per request, not frozen at build. */
export async function GET() {
  await connection()
  const provider = paymentProvider()
  return json({ enabled: !!provider && PLANS.some((p) => p.amountTzs), provider: provider?.name ?? null })
}
