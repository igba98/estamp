import { Card, Footer, Heading, Layout, Spacer, Text, Lines } from "./components"
import { c, type, truncate } from "./theme"

export type ContactReceivedProps = {
  name: string
  subject: string
  message: string
  replyTime?: string
}

export const meta = (p: ContactReceivedProps) => ({
  subject: `We got your message: ${p.subject}`,
  preheader: `Thanks, ${p.name}. We'll reply to this address ${p.replyTime ?? "within one working day"}.`,
})

export default function ContactReceived(p: ContactReceivedProps) {
  return (
    <Layout preheader={meta(p).preheader} footer={<Footer reason="You sent a message through the contact form on eStamp. Reply to this email to add to it." />}>
      <Heading center>We got your message</Heading>
      <Spacer h={12} />
      <Text muted style={{ textAlign: "center" }}>
        Thanks for writing, {p.name}. A person reads every message, and we&apos;ll reply to this address {p.replyTime ?? "within one working day"}.
      </Text>
      <Spacer h={24} />
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
          Your message
        </p>
        <Text style={{ fontWeight: 700, marginTop: 10 }}>{p.subject}</Text>
        <Text muted style={{ marginTop: 6 }}>
          <Lines text={truncate(p.message, 600)} />
        </Text>
      </Card>
      <Spacer h={16} />
      <Text small muted style={{ textAlign: "center" }}>
        Something to add? Reply to this email and it joins the same conversation.
      </Text>
    </Layout>
  )
}

ContactReceived.PreviewProps = {
  name: "Neema Kileo",
  subject: "Stamping 40 delivery notes a day",
  message:
    "Hello, we receive about 40 delivery notes a day at our Dar es Salaam warehouse and stamp each one by hand.\n\nCan eStamp put our RECEIVED stamp with the date on all of them at once? We'd also like the register number on each copy.",
} satisfies ContactReceivedProps

export const variants: Record<string, ContactReceivedProps> = {
  long: {
    name: "Bwana Abdulrahman Mohamedali Kassim-Mwinyimvua",
    subject: "Swali kuhusu mkataba: Mkataba_wa_Ukodishaji_wa_Ofisi_Kariakoo_Toleo_la_Mwisho_IMESAINIWA_v12_FINAL(3).pdf",
    message: `${"Tunahitaji kuweka mihuri kwenye nyaraka nyingi kwa siku. ".repeat(30)}https://drive.google.com/file/d/1A2b3C4d5E6f7G8h9I0jKlMnOpQrStUvWxYz/view?usp=sharing_and_more_parameters`,
  },
  minimal: { name: "Jo", subject: "Hi", message: "?" },
}
