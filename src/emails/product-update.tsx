import { Badge, Button, Card, Divider, Footer, Heading, Layout, NumberedItem, SectionTitle, Spacer, Text, TwoColumn, type Social } from "./components"
import { c } from "./theme"

/** Newsletter for Resend Broadcasts. Resend fills {{{RESEND_UNSUBSCRIBE_URL}}} per contact. */
export type ProductUpdateProps = {
  edition: string
  hero: {
    badge: string
    title: string
    body: string
    cta: { label: string; href: string }
  }
  whatsNew: { title: string; body: string }[]
  quickFive: { title: string; body: string }[]
  tips: { title: string; body: string }[]
  social?: Social[]
  unsubscribeUrl?: string
}

export const meta = (p: ProductUpdateProps) => ({
  subject: `eStamp ${p.edition}: ${p.hero.title}`,
  preheader: `${p.hero.title}. Plus ${p.whatsNew.length} new things and ${p.tips.length} tips.`,
})

function Tip({ title, body }: { title: string; body: string }) {
  return (
    <Card color={c.surface2} pad={20}>
      <Text style={{ fontWeight: 700 }}>{title}</Text>
      <Text muted small style={{ marginTop: 6 }}>
        {body}
      </Text>
    </Card>
  )
}

export default function ProductUpdate(p: ProductUpdateProps) {
  const pairs = p.tips.reduce<[(typeof p.tips)[number], (typeof p.tips)[number] | undefined][]>((acc, t, i) => (i % 2 ? acc : [...acc, [t, p.tips[i + 1]]]), [])
  return (
    <Layout
      preheader={meta(p).preheader}
      footer={
        <Footer
          reason="You're on the eStamp updates list because you signed up for news about eStamp."
          social={p.social}
          unsubscribe={p.unsubscribeUrl ?? "{{{RESEND_UNSUBSCRIBE_URL}}}"}
        />
      }
    >
      <Card>
        <Badge>{p.hero.badge}</Badge>
        <Heading style={{ marginTop: 14 }}>{p.hero.title}</Heading>
        <Text muted style={{ marginTop: 10 }}>
          {p.hero.body}
        </Text>
        <Spacer h={24} />
        <Button href={p.hero.cta.href}>{p.hero.cta.label}</Button>
      </Card>
      {p.whatsNew.length ? (
        <>
          <Spacer h={16} />
          <Card>
            <SectionTitle>What&apos;s new</SectionTitle>
            {p.whatsNew.map((w, i) => (
              <div key={w.title}>
                {i > 0 && <Divider space={16} />}
                <Text style={{ fontWeight: 700 }}>{w.title}</Text>
                <Text muted small style={{ marginTop: 4 }}>
                  {w.body}
                </Text>
              </div>
            ))}
          </Card>
        </>
      ) : null}
      {p.quickFive.length ? (
        <>
          <Spacer h={16} />
          <Card>
            <SectionTitle>Quick five</SectionTitle>
            {p.quickFive.map((q, i) => (
              <NumberedItem key={q.title} first={i === 0} n={i + 1} title={q.title}>
                {q.body}
              </NumberedItem>
            ))}
          </Card>
        </>
      ) : null}
      {pairs.length ? (
        <>
          <Spacer h={28} />
          <Heading style={{ fontSize: 18, padding: "0 4px" }}>Tips</Heading>
          <Spacer h={12} />
          {pairs.map(([a, b], i) => (
            <div key={a.title}>
              {i > 0 && <Spacer h={12} />}
              <TwoColumn left={<Tip {...a} />} right={b ? <Tip {...b} /> : null} />
            </div>
          ))}
        </>
      ) : null}
    </Layout>
  )
}

const app = "https://estamp.workwithignas.com"

ProductUpdate.PreviewProps = {
  edition: "November 2026",
  hero: {
    badge: "New this month",
    title: "Stamp 50 documents in one go",
    body: "Bulk stamping is here. Drop a folder of PDFs or images, pick one stamp and a corner, and download every stamped copy as a single ZIP. Each file still gets its own reference and QR code.",
    cta: { label: "Try bulk stamping", href: `${app}/bulk` },
  },
  whatsNew: [
    {
      title: "Mail register",
      body: "Incoming mail gets a number like IN/2026/0087 the moment you stamp it RECEIVED. Export the register to CSV at month end.",
    },
    {
      title: "Approvals",
      body: "Mark a stamp as needing approval. Staff request it for one file, an admin approves, and the stamp works for that exact file once.",
    },
    {
      title: "API keys",
      body: "Look up any stamp by reference or check a file's fingerprint from your own system.",
    },
  ],
  quickFive: [
    {
      title: "Scan the QR",
      body: "Anyone can scan a stamp's QR to see who issued it and when.",
    },
    {
      title: "Check the exact copy",
      body: "Drop a received file on the verify page to see whether it's the copy you stamped.",
    },
    {
      title: "Revoke a stamp",
      body: "Issued by mistake? Revoke it and the verify page says so.",
    },
    {
      title: "Invite your team",
      body: "Members stamp; admins design stamps and approve.",
    },
    {
      title: "Set your prefix",
      body: "References use your prefix, like KT-2026-0142.",
    },
  ],
  tips: [
    {
      title: "Stamp on the last page",
      body: "Contracts usually need the stamp beside the signatures. Pick “Last page” in bulk stamping.",
    },
    {
      title: "Name stamps by purpose",
      body: "“Received”, “Paid”, “Approved” are easier to find than “Stamp 3”.",
    },
    {
      title: "Keep originals local",
      body: "eStamp only stores a fingerprint of your original file, never the file.",
    },
    {
      title: "Export the register",
      body: "Your auditor will thank you for the CSV.",
    },
  ],
  social: [
    {
      label: "eStamp on the web",
      href: "https://workwithignas.com",
      icon: "globe",
    },
  ],
} satisfies ProductUpdateProps

export const variants: Record<string, ProductUpdateProps> = {
  long: {
    ...ProductUpdate.PreviewProps,
    hero: {
      ...ProductUpdate.PreviewProps.hero,
      badge: "Builder spotlight: Tanzania Agricultural Cooperative Union",
      title: "How the Tanzania Agricultural Cooperative Union stamped 12,450 delivery notes in a single month without printing one",
    },
    tips: ProductUpdate.PreviewProps.tips.slice(0, 3),
  },
  minimal: {
    ...ProductUpdate.PreviewProps,
    whatsNew: [],
    quickFive: [],
    tips: [],
    social: [],
  },
}
