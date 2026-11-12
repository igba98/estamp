import { Button, Callout, Card, Chip, Footer, Heading, InfoRow, Layout, Spacer, Text } from "./components"
import { c, fmtBytes, fmtDateTime, plural } from "./theme"

export type StampedDocumentProps = {
  recipient: string
  fileName: string
  stampNames: string[]
  reference: string
  appliedAt: string
  pages?: number | null
  sizeBytes: number
  registerNo?: string | null
  verifyUrl?: string | null
  appUrl: string
}

export const meta = (p: StampedDocumentProps) => ({
  subject: `Stamped: ${p.fileName}`,
  preheader: `${p.reference} · ${p.stampNames.join(", ")} · the stamped file is attached.`,
})

export default function StampedDocument(p: StampedDocumentProps) {
  return (
    <Layout preheader={meta(p).preheader} footer={<Footer reason={`You asked eStamp to email this document to ${p.recipient}.`} />}>
      <Heading center>Your stamped document is ready</Heading>
      <Spacer h={16} />
      <Chip icon="mail">{p.recipient}</Chip>
      <Spacer h={24} />
      <Card>
        <InfoRow first icon="file" value={p.fileName} label="File" />
        <InfoRow icon="stamp" value={p.stampNames.join(", ")} label={p.stampNames.length === 1 ? "Stamp" : "Stamps"} />
        <InfoRow
          icon="hash"
          value={p.registerNo ? `${p.reference} · ${p.registerNo}` : p.reference}
          label={p.registerNo ? "Reference · mail register" : "Reference"}
        />
        <InfoRow icon="calendar" value={fmtDateTime(p.appliedAt)} label="Date applied" />
        {p.pages ? <InfoRow icon="layers" value={plural(p.pages, "page")} label="Page count" /> : null}
        <InfoRow icon="size" value={fmtBytes(p.sizeBytes)} label="File size" />
      </Card>
      <Spacer h={16} />
      <Callout icon="paperclip-ink" alt="Attachment">
        <Text style={{ fontWeight: 600 }}>Attached to this email.</Text>
        <Text muted small style={{ marginTop: 4 }}>
          Stamps were applied in your browser. Your original file never left your device; eStamp keeps the stamped copy so the QR code can be checked.
        </Text>
      </Callout>
      <Spacer h={28} />
      <Button href={`${p.appUrl.replace(/\/$/, "")}/stamp`}>Stamp another document</Button>
      {p.verifyUrl ? (
        <Text small muted style={{ textAlign: "center", marginTop: 16 }}>
          Anyone can check this stamp at{" "}
          <a href={p.verifyUrl} style={{ color: c.accent, textDecoration: "none" }}>
            {p.verifyUrl.replace(/^https?:\/\//, "")}
          </a>
        </Text>
      ) : null}
    </Layout>
  )
}

StampedDocument.PreviewProps = {
  recipient: "asha.mwakyusa@kilimotraders.co.tz",
  fileName: "Mkataba_wa_Ukodishaji_Kariakoo-stamped.pdf",
  stampNames: ["Received"],
  reference: "KT-2026-0142",
  appliedAt: "2026-11-12T11:05:00Z",
  pages: 4,
  sizeBytes: 1_284_000,
  registerNo: "IN/2026/0087",
  verifyUrl: "https://estamp.workwithignas.com/v?id=k3J9xQ2mT7pL",
  appUrl: "https://estamp.workwithignas.com",
} satisfies StampedDocumentProps

/** Worst cases checked by tests and scripts/send-test-emails.ts. */
export const variants: Record<string, StampedDocumentProps> = {
  long: {
    recipient: "procurement.and.administration.department@tanzania-agricultural-cooperative-union.co.tz",
    fileName: "Mkataba_wa_Ukodishaji_wa_Ofisi_Kariakoo_Toleo_la_Mwisho_IMESAINIWA_v12_FINAL(3).pdf",
    stampNames: ["Received", "Approved for payment by the Finance and Administration Committee", "Paid"],
    reference: "KILIMOTRADERS-2026-0142",
    appliedAt: "2026-12-31T20:59:00Z",
    pages: 1240,
    sizeBytes: 27_900_000,
    registerNo: "IN/2026/12450",
    verifyUrl: "https://estamp.workwithignas.com/v?id=k3J9xQ2mT7pLk3J9xQ2mT7pLk3J9xQ2mT7pL",
    appUrl: "https://estamp.workwithignas.com",
  },
  minimal: {
    recipient: "a@b.tz",
    fileName: "x.png",
    stampNames: ["Paid"],
    reference: "ES-2026-0001",
    appliedAt: "2026-01-01T00:00:00Z",
    pages: null,
    sizeBytes: 812,
    appUrl: "https://estamp.workwithignas.com",
  },
}
