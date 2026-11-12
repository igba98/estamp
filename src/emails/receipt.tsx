import { Card, Footer, LineItems, Layout, SplitActions, Spacer, Text, type LineGroup } from "./components"
import { c, fmtDay, fmtNum, fmtTzs, tnum, type, wrap } from "./theme"

/** Placeholder for the paid plans: nothing sends this yet (billing has no provider). */
export type ReceiptProps = {
  orgName: string
  amountTzs: number
  paidAt: string
  method: { brand: string; last4: string }
  receiptNo: string
  groups: {
    period: string
    items: { label: string; qty: number; amountTzs: number }[]
  }[]
  receiptUrl: string
  invoiceUrl: string
}

export const meta = (p: ReceiptProps) => ({
  subject: `Your eStamp receipt ${p.receiptNo}`,
  preheader: `${fmtTzs(p.amountTzs)} paid on ${fmtDay(p.paidAt)} with ${p.method.brand} •••• ${p.method.last4}.`,
})

export default function Receipt(p: ReceiptProps) {
  const groups: LineGroup[] = p.groups.map((g) => ({
    period: g.period,
    items: g.items.map((i) => ({
      label: i.label,
      qty: i.qty,
      amount: fmtNum(i.amountTzs),
    })),
  }))
  return (
    <Layout preheader={meta(p).preheader} footer={<Footer reason={`You're getting this receipt because ${p.orgName} pays for eStamp.`} />}>
      <Card pad={0}>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
          <tbody>
            <tr>
              <td className="card" style={{ padding: 28 }}>
                <Text muted small style={{ ...wrap }}>
                  Receipt from eStamp · {p.orgName}
                </Text>
                <p
                  className="amount"
                  style={{
                    margin: "10px 0 0",
                    fontFamily: "inherit",
                    color: c.text,
                    ...type.display,
                    ...tnum,
                    ...wrap,
                  }}
                >
                  <span style={{ fontSize: "0.5em", color: c.muted, letterSpacing: 0 }}>TZS</span>{" "}
                  <span style={{ whiteSpace: "nowrap" }}>{fmtNum(p.amountTzs)}</span>
                </p>
                <Text muted style={{ marginTop: 8, ...tnum }}>
                  Paid on {fmtDay(p.paidAt)} with {p.method.brand} •••• {p.method.last4}
                </Text>
                <Text muted small style={{ marginTop: 4, ...tnum }}>
                  Receipt number {p.receiptNo}
                </Text>
              </td>
            </tr>
          </tbody>
        </table>
        <SplitActions left={{ href: p.receiptUrl, label: "Download receipt" }} right={{ href: p.invoiceUrl, label: "Download invoice" }} />
      </Card>
      <Spacer h={16} />
      <Card>
        <LineItems groups={groups} total={fmtNum(p.amountTzs)} currency="TZS" />
      </Card>
      <Spacer h={16} />
      <Text small muted style={{ textAlign: "center" }}>
        Questions about this charge? Reply to this email.
      </Text>
    </Layout>
  )
}

const base = {
  orgName: "Kilimo Traders Ltd",
  paidAt: "2026-11-12T09:30:00Z",
  method: { brand: "M-Pesa", last4: "4821" },
  receiptUrl: "https://estamp.workwithignas.com/settings",
  invoiceUrl: "https://estamp.workwithignas.com/settings",
}

Receipt.PreviewProps = {
  ...base,
  amountTzs: 25_000,
  receiptNo: "2841-0193",
  groups: [
    {
      period: "12 Nov – 12 Dec 2026",
      items: [{ label: "eStamp Business, 1 organisation", qty: 1, amountTzs: 25_000 }],
    },
  ],
} satisfies ReceiptProps

export const variants: Record<string, ReceiptProps> = {
  big: {
    ...base,
    orgName: "Tanzania Agricultural Cooperative Union — Procurement and Administration Department",
    amountTzs: 12_450_000,
    receiptNo: "2841-0193-7765-2210",
    groups: [
      {
        period: "12 Nov 2026 – 12 Nov 2027",
        items: Array.from({ length: 25 }, (_, i) => ({
          label: i === 0 ? "eStamp Enterprise annual plan, unlimited stamps, API access and priority support" : `Additional seat ${i}`,
          qty: 1,
          amountTzs: i === 0 ? 10_050_000 : 100_000,
        })),
      },
    ],
  },
  empty: {
    ...base,
    amountTzs: 0,
    receiptNo: "0000-0001",
    groups: [{ period: "12 Nov – 12 Dec 2026", items: [] }],
  },
}
