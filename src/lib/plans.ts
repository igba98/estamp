/**
 * Plans offered for mobile-money payment. Prices aren't decided yet:
 * set amountTzs (and a provider in src/lib/server/payments.ts) to open payments.
 * Nothing is limited by plan yet; add limits in issue_stamp() once pricing is set.
 */
export type Plan = { id: string; name: string; amountTzs: number | null; summary: string }

export const PLANS: Plan[] = [
  { id: "business", name: "Business", amountTzs: null, summary: "Your whole team, all features, per month." },
]

export const FREE_PLAN_NAME = "Free (early access)"

/** 0712 345 678 / +255 712 345 678 → 255712345678, or null. */
export function normalizeTzPhone(input: string): string | null {
  const d = input.replace(/[\s()-]/g, "").replace(/^\+/, "")
  const m = /^(?:255|0)?([67]\d{8})$/.exec(d)
  return m ? `255${m[1]}` : null
}
