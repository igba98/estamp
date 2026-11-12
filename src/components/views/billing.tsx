"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Smartphone } from "lucide-react"
import { Panel } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FREE_PLAN_NAME, PLANS, normalizeTzPhone } from "@/lib/plans"
import { isAdmin, refresh, startCheckout, useAppState } from "@/lib/store"
import { formatDate } from "@/lib/format"

/** Settings → Billing (admins): plan, usage, and mobile-money payment once a provider is set up. */
export function BillingPanel() {
  const admin = useAppState(isAdmin)
  const plan = useAppState((s) => s.plan)
  const thisMonth = useAppState((s) => s.stats.team.reduce((n, t) => n + t.count, 0))
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [phone, setPhone] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((b: { enabled?: boolean }) => setEnabled(!!b.enabled), () => setEnabled(false))
  }, [])

  if (!admin) return null
  const current = PLANS.find((p) => p.id === plan.id)
  const paidPlan = PLANS.find((p) => p.amountTzs)

  async function pay(e: React.FormEvent) {
    e.preventDefault()
    if (!paidPlan) return
    setBusy(true)
    const err = await startCheckout(paidPlan.id, phone)
    setBusy(false)
    if (err) return void toast.error(err)
    toast.success("Check your phone and enter your mobile-money PIN to confirm.")
    // The provider's webhook updates the plan; check back a few times.
    for (const wait of [10_000, 20_000, 40_000]) setTimeout(() => void refresh(), wait)
  }

  return (
    <Panel className="mt-6 p-5 sm:p-6">
      <h2 className="text-[15px] font-semibold">Plan and billing</h2>
      <dl className="mt-4 grid gap-3 text-[13.5px] sm:grid-cols-2">
        <div>
          <dt className="text-faint">Current plan</dt>
          <dd className="mt-0.5 font-semibold">
            {current?.name ?? FREE_PLAN_NAME}
            {plan.until && <span className="font-normal text-muted-foreground"> · paid until {formatDate(plan.until)}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-faint">Stamped this month</dt>
          <dd className="tnum mt-0.5 font-semibold">{thisMonth.toLocaleString()}</dd>
        </div>
      </dl>
      {enabled && paidPlan ? (
        <form onSubmit={pay} className="mt-5 flex flex-col gap-2 border-t border-white/[0.05] pt-5 sm:flex-row">
          <label htmlFor="bl-phone" className="sr-only">
            Mobile-money number
          </label>
          <Input
            id="bl-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="M-Pesa, Airtel or Mixx number, e.g. 0712 345 678"
            className="sm:flex-1"
            aria-invalid={!!phone && !normalizeTzPhone(phone)}
          />
          <Button type="submit" disabled={busy || !normalizeTzPhone(phone)}>
            <Smartphone /> {busy ? "Sending…" : `Pay TSh ${paidPlan.amountTzs!.toLocaleString()}`}
          </Button>
        </form>
      ) : (
        <p className="mt-5 border-t border-white/[0.05] pt-4 text-[13px] leading-relaxed text-muted-foreground">
          {enabled === null
            ? "Checking payment options…"
            : "Every feature is free during early access. Paying by M-Pesa, Airtel Money or Mixx by Yas opens here once plans are announced."}
        </p>
      )}
    </Panel>
  )
}
