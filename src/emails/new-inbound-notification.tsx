import { Badge, Button, Card, Footer, Heading, InfoRow, Layout, Spacer, Text, Lines } from "./components"
import { c, fmtDateTime, plural, truncate, type } from "./theme"

export type NewInboundProps = {
  inbox: string
  from: string
  subject: string | null
  receivedAt: string
  /** null = the message body couldn't be read (a sending-only API key can't read the inbox). */
  preview: string | null
  attachments: number
  viaContactForm?: boolean
  openUrl: string
}

export const meta = (p: NewInboundProps) => ({
  subject: `${p.viaContactForm ? "Contact form" : "New email"}: ${p.subject || "(no subject)"}`,
  preheader: p.preview ? `From ${p.from}: ${truncate(p.preview.replace(/\s+/g, " "), 90)}` : `From ${p.from}`,
})

export default function NewInboundNotification(p: NewInboundProps) {
  return (
    <Layout preheader={meta(p).preheader} footer={<Footer reason={`You get these because you look after the ${p.inbox} inbox.`} />}>
      {p.viaContactForm ? (
        <table role="presentation" align="center" style={{ margin: "0 auto 12px" }}>
          <tbody>
            <tr>
              <td>
                <Badge>Contact form</Badge>
              </td>
            </tr>
          </tbody>
        </table>
      ) : null}
      <Heading center>New message for {p.inbox}</Heading>
      <Spacer h={24} />
      <Card>
        <InfoRow first icon="user" value={p.from} label="From" />
        <InfoRow icon="mail" value={p.subject || "(no subject)"} label="Subject" />
        <InfoRow icon="clock" value={fmtDateTime(p.receivedAt)} label="Received" />
        <InfoRow icon="paperclip" value={p.attachments ? plural(p.attachments, "file") : "None"} label="Attachments" />
      </Card>
      <Spacer h={16} />
      <Card color={c.surface2} pad={24}>
        <p
          style={{
            margin: 0,
            fontFamily: "inherit",
            ...type.section,
            fontSize: 12,
            color: c.muted,
          }}
        >
          Preview
        </p>
        <Text muted style={{ marginTop: 10 }}>
          <Lines text={p.preview ? truncate(p.preview, 600) : p.preview === null ? "Open it in Resend to read the message." : "(This email has no text.)"} />
        </Text>
      </Card>
      <Spacer h={28} />
      <Button href={p.openUrl}>Open in Resend</Button>
    </Layout>
  )
}

NewInboundNotification.PreviewProps = {
  inbox: "estamp@workwithignas.com",
  from: "Neema Kileo <neema@pwanilogistics.co.tz>",
  subject: "Stamping 40 delivery notes a day",
  receivedAt: "2026-11-12T08:42:00Z",
  preview:
    "Hello, we receive about 40 delivery notes a day at our Dar es Salaam warehouse and stamp each one by hand. Can eStamp put our RECEIVED stamp on all of them at once?",
  attachments: 2,
  viaContactForm: true,
  openUrl: "https://resend.com/inboxes",
} satisfies NewInboundProps

export const variants: Record<string, NewInboundProps> = {
  long: {
    inbox: "estamp@workwithignas.com",
    from: "procurement.and.administration.department@tanzania-agricultural-cooperative-union.co.tz",
    subject: "Re: Re: Fwd: Mkataba_wa_Ukodishaji_wa_Ofisi_Kariakoo_Toleo_la_Mwisho_IMESAINIWA_v12_FINAL(3).pdf — please confirm the stamp",
    receivedAt: "2026-12-31T20:59:00Z",
    preview: `${"Habari, tafadhali angalia mkataba ulioambatishwa na uthibitishe muhuri. ".repeat(20)}https://drive.google.com/file/d/1A2b3C4d5E6f7G8h9I0jKlMnOpQrStUvWxYz/view`,
    attachments: 25,
    openUrl: "https://resend.com/inboxes",
  },
  minimal: {
    inbox: "estamp@workwithignas.com",
    from: "x@y.tz",
    subject: null,
    receivedAt: "2026-01-01T00:00:00Z",
    preview: "",
    attachments: 0,
    openUrl: "https://resend.com/inboxes",
  },
  unreadable: {
    inbox: "estamp@workwithignas.com",
    from: "Juma Mwinyi <juma@kariakoo-traders.co.tz>",
    subject: "Invoice stamp question",
    receivedAt: "2026-11-12T09:15:00Z",
    preview: null,
    attachments: 1,
    openUrl: "https://resend.com/inboxes",
  },
}
