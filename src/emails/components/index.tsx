import type { CSSProperties, ReactNode } from "react"
import { Body, Button as REButton, Container, Font, Head, Html, Img, Link, Preview } from "@react-email/components"
import { asset, c, font, tnum, type, wrap } from "../theme"

/* Email building blocks. Tables, inline styles and bgcolor everywhere: Gmail and Outlook ignore most modern CSS. */

/** bgcolor attribute + inline background, so the colour survives clients that drop one or the other. */
const bg = (color: string) => ({ bgcolor: color }) as Record<string, string>
const table = {
  role: "presentation",
  width: "100%",
  cellPadding: 0,
  cellSpacing: 0,
  border: 0,
} as const
const p = (style: CSSProperties): CSSProperties => ({
  margin: 0,
  fontFamily: font,
  color: c.text,
  ...style,
})

const css = `
:root { color-scheme: dark; supported-color-schemes: dark; }
body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
a { color: ${c.accent}; }
@media (max-width: 480px) {
  .col { display: block !important; width: 100% !important; padding: 0 0 12px 0 !important; }
  .amount { font-size: 26px !important; }
  .qty { display: none !important; }
  .qty-m { display: inline !important; }
}
@media (max-width: 400px) {
  .px { padding-left: 16px !important; padding-right: 16px !important; }
  .card { padding: 20px !important; }
}`

/** Line breaks as <br> (Outlook ignores white-space: pre-line). */
export function Lines({ text }: { text: string }) {
  return text.split("\n").map((line, i) => (
    <span key={i}>
      {i > 0 && <br />}
      {line}
    </span>
  ))
}

export function Text({ children, style, muted, small }: { children: ReactNode; style?: CSSProperties; muted?: boolean; small?: boolean }) {
  return (
    <p
      style={p({
        ...(small ? type.small : type.body),
        color: muted ? c.muted : c.text,
        ...wrap,
        ...style,
      })}
    >
      {children}
    </p>
  )
}

export function Heading({ children, center, style }: { children: ReactNode; center?: boolean; style?: CSSProperties }) {
  return (
    <h1
      style={p({
        ...type.h1,
        textAlign: center ? "center" : "left",
        ...wrap,
        ...style,
      })}
    >
      {children}
    </h1>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 style={p({ ...type.section, color: c.text, margin: "0 0 16px" })}>{children}</h2>
}

export function Spacer({ h = 16 }: { h?: number }) {
  return (
    <table {...table}>
      <tbody>
        <tr>
          <td height={h} style={{ height: h, fontSize: 0, lineHeight: 0 }}>
            &nbsp;
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export function Card({ children, color = c.surface, pad = 28, style }: { children: ReactNode; color?: string; pad?: number; style?: CSSProperties }) {
  return (
    <table {...table} style={{ borderCollapse: "separate" }}>
      <tbody>
        <tr>
          <td
            className={pad ? "card" : undefined}
            {...bg(color)}
            style={{
              backgroundColor: color,
              border: `1px solid ${c.border}`,
              borderRadius: 16,
              padding: pad,
              ...style,
            }}
          >
            {children}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

const tones = {
  info: { tint: c.infoTint, border: c.infoBorder, icon: "info-ink" },
  ok: { tint: c.okTint, border: c.okBorder, icon: "shield-ok" },
} as const

/** Tinted note with an icon (Google-style info callout). */
export function Callout({ children, tone = "info", icon, alt }: { children: ReactNode; tone?: keyof typeof tones; icon?: string; alt: string }) {
  const t = tones[tone]
  return (
    <table {...table} style={{ borderCollapse: "separate" }}>
      <tbody>
        <tr>
          <td
            {...bg(t.tint)}
            style={{
              backgroundColor: t.tint,
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              padding: "16px 18px",
            }}
          >
            <table {...table}>
              <tbody>
                <tr>
                  <td width={32} valign="top" style={{ width: 32, paddingTop: 2 }}>
                    <Img src={asset(icon ?? t.icon)} width={20} height={20} alt={alt} style={{ display: "block" }} />
                  </td>
                  <td valign="top">{children}</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

/** Icon + value + small label (Google "info you shared" row). */
export function InfoRow({ icon, value, label, first }: { icon: string; value: ReactNode; label: string; first?: boolean }) {
  return (
    <table {...table} style={{ marginTop: first ? 0 : 18 }}>
      <tbody>
        <tr>
          <td width={40} valign="top" style={{ width: 40, paddingTop: 1 }}>
            <Img src={asset(icon)} width={20} height={20} alt="" style={{ display: "block" }} />
          </td>
          <td valign="top">
            <p
              style={p({
                fontSize: 15,
                lineHeight: 1.4,
                fontWeight: 600,
                ...wrap,
                ...tnum,
              })}
            >
              {value}
            </p>
            <p style={p({ ...type.small, color: c.muted, marginTop: 2 })}>{label}</p>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

/** The one primary action. Pill, 48px tall, 16px label; React Email's Button pads correctly in Outlook. */
export function Button({ href, children }: { href: string; children: ReactNode }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0} align="center" style={{ margin: "0 auto" }}>
      <tbody>
        <tr>
          <td align="center" {...bg(c.button)} style={{ backgroundColor: c.button, borderRadius: 999 }}>
            <REButton
              href={href}
              style={{
                backgroundColor: c.button,
                borderRadius: 999,
                color: "#FFFFFF",
                fontFamily: font,
                fontSize: 16,
                fontWeight: 700,
                lineHeight: "20px",
                padding: "14px 28px",
                textDecoration: "none",
              }}
            >
              {children}
            </REButton>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

/** Two equal actions split by a hairline (receipt pattern). */
export function SplitActions({ left, right }: { left: { href: string; label: string }; right: { href: string; label: string } }) {
  const cell = (a: { href: string; label: string }, divider: boolean) => (
    <td
      width="50%"
      align="center"
      {...bg(c.surface)}
      style={{
        width: "50%",
        backgroundColor: c.surface,
        padding: 18,
        borderLeft: divider ? `1px solid ${c.border}` : undefined,
      }}
    >
      <Link
        href={a.href}
        style={{
          fontFamily: font,
          fontSize: 15,
          fontWeight: 600,
          color: c.accent,
          textDecoration: "none",
        }}
      >
        {a.label}
      </Link>
    </td>
  )
  return (
    <table {...table} style={{ borderTop: `1px solid ${c.border}` }}>
      <tbody>
        <tr>
          {cell(left, false)}
          {cell(right, true)}
        </tr>
      </tbody>
    </table>
  )
}

export type LineItem = { label: string; qty: number; amount: string }
export type LineGroup = { period: string; items: LineItem[] }

/** Label / qty / amount rows grouped by period, right-aligned tabular figures, total row. */
/** Amounts are plain figures; the currency sits in the header so long amounts fit on phones (Qty folds into the label there). */
export function LineItems({ groups, total, currency }: { groups: LineGroup[]; total: string; currency: string }) {
  const head: CSSProperties = p({
    fontSize: 12,
    lineHeight: 1.4,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: c.muted,
    paddingBottom: 10,
  })
  const cell: CSSProperties = p({
    ...type.body,
    padding: "10px 0",
    borderTop: `1px solid ${c.border}`,
    verticalAlign: "top",
  })
  const empty = groups.every((g) => g.items.length === 0)
  return (
    <table {...table}>
      <tbody>
        <tr>
          <td style={head}>Description</td>
          <td className="qty" style={{ ...head, textAlign: "center", width: 48 }}>
            Qty
          </td>
          <td style={{ ...head, textAlign: "right", whiteSpace: "nowrap" }}>Amount ({currency})</td>
        </tr>
        {empty ? (
          <tr>
            <td colSpan={3} style={{ ...cell, color: c.muted }}>
              No charges in this period.
            </td>
          </tr>
        ) : (
          groups.map((g) => [
            <tr key={`${g.period}-h`}>
              <td
                colSpan={3}
                style={p({
                  ...type.small,
                  color: c.muted,
                  padding: "14px 0 6px",
                  ...tnum,
                })}
              >
                {g.period}
              </td>
            </tr>,
            ...g.items.map((it, i) => (
              <tr key={`${g.period}-${i}`}>
                <td style={{ ...cell, ...wrap, paddingRight: 12 }}>
                  {it.label}
                  <span className="qty-m" style={{ display: "none", color: c.muted, ...tnum }}>
                    {" "}
                    × {it.qty}
                  </span>
                </td>
                <td
                  className="qty"
                  style={{
                    ...cell,
                    ...tnum,
                    textAlign: "center",
                    color: c.muted,
                  }}
                >
                  {it.qty}
                </td>
                <td
                  style={{
                    ...cell,
                    ...tnum,
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  {it.amount}
                </td>
              </tr>
            )),
          ])
        )}
        <tr>
          <td style={{ ...cell, fontWeight: 700, paddingTop: 14, borderTop: `1px solid ${c.muted}` }}>Total</td>
          <td className="qty" style={{ ...cell, paddingTop: 14, borderTop: `1px solid ${c.muted}` }} />
          <td
            style={{
              ...cell,
              ...tnum,
              fontWeight: 700,
              textAlign: "right",
              whiteSpace: "nowrap",
              paddingTop: 14,
              borderTop: `1px solid ${c.muted}`,
            }}
          >
            {total}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export function Badge({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "ok" }) {
  const [fg, tint] = tone === "ok" ? [c.ok, c.okTint] : [c.accent, c.infoTint]
  return (
    <span
      style={{
        display: "inline-block",
        backgroundColor: tint,
        border: `1px solid ${tone === "ok" ? c.okBorder : c.infoBorder}`,
        borderRadius: 999,
        padding: "4px 10px",
        fontFamily: font,
        fontSize: 11,
        lineHeight: "16px",
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: fg,
      }}
    >
      {children}
    </span>
  )
}

/** Account identity chip: icon + address, centred. */
export function Chip({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      align="center"
      style={{ margin: "0 auto", borderCollapse: "separate", maxWidth: "100%" }}
    >
      <tbody>
        <tr>
          <td
            {...bg(c.surface2)}
            style={{
              backgroundColor: c.surface2,
              border: `1px solid ${c.border}`,
              borderRadius: 999,
              padding: "6px 14px 6px 8px",
            }}
          >
            <table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
              <tbody>
                <tr>
                  <td width={26} valign="middle" style={{ width: 26 }}>
                    <Img src={asset(icon)} width={18} height={18} alt="" style={{ display: "block" }} />
                  </td>
                  <td
                    valign="middle"
                    style={p({
                      fontSize: 14,
                      lineHeight: 1.4,
                      fontWeight: 600,
                      ...wrap,
                    })}
                  >
                    {children}
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

/** Big numeral + title + body (newsletter list). */
export function NumberedItem({ n, title, children, first }: { n: number; title: string; children: ReactNode; first?: boolean }) {
  return (
    <table {...table} style={{ marginTop: first ? 0 : 20 }}>
      <tbody>
        <tr>
          <td
            width={52}
            valign="top"
            style={p({
              width: 52,
              fontSize: 32,
              lineHeight: 1,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: c.accent,
              ...tnum,
            })}
          >
            {String(n).padStart(2, "0")}
          </td>
          <td valign="top">
            <p
              style={p({
                fontSize: 16,
                lineHeight: 1.35,
                fontWeight: 700,
                ...wrap,
              })}
            >
              {title}
            </p>
            <Text muted small style={{ marginTop: 4 }}>
              {children}
            </Text>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

/** Two cards side by side; stacks under 480px. */
export function TwoColumn({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <table {...table}>
      <tbody>
        <tr>
          <td className="col" width="50%" valign="top" style={{ width: "50%", paddingRight: 6 }}>
            {left}
          </td>
          <td className="col" width="50%" valign="top" style={{ width: "50%", paddingLeft: 6 }}>
            {right}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export function Divider({ space = 20 }: { space?: number }) {
  return (
    <hr
      style={{
        border: "none",
        borderTop: `1px solid ${c.border}`,
        margin: `${space}px 0`,
        width: "100%",
      }}
    />
  )
}

export type Social = { label: string; href: string; icon: string }

export function Footer({ reason, social, unsubscribe }: { reason: string; social?: Social[]; unsubscribe?: string }) {
  const line = (style: CSSProperties) => p({ ...type.small, textAlign: "center", ...style })
  return (
    <table {...table} style={{ marginTop: 32 }}>
      <tbody>
        {social?.length ? (
          <tr>
            <td align="center" style={{ paddingBottom: 20 }}>
              {social.map((s) => (
                <Link key={s.href} href={s.href} style={{ display: "inline-block", margin: "0 8px" }}>
                  <Img src={asset(s.icon)} width={24} height={24} alt={s.label} style={{ display: "block" }} />
                </Link>
              ))}
            </td>
          </tr>
        ) : null}
        <tr>
          <td style={{ padding: "0 8px" }}>
            <p style={line({ fontWeight: 600, color: c.muted })}>eStamp by Work Ignas</p>
            <p style={line({ marginTop: 2 })}>
              <Link href="https://workwithignas.com" style={{ color: c.accent, textDecoration: "none" }}>
                workwithignas.com
              </Link>
            </p>
            <p
              style={line({
                fontSize: 12,
                color: c.subtle,
                marginTop: 14,
                ...wrap,
              })}
            >
              {reason}
            </p>
            {unsubscribe && (
              <p style={line({ fontSize: 12, color: c.subtle, marginTop: 4 })}>
                <Link href={unsubscribe} style={{ color: c.subtle, textDecoration: "underline" }}>
                  Unsubscribe
                </Link>
              </p>
            )}
            <p style={line({ fontSize: 12, color: c.subtle, marginTop: 4 })}>© {new Date().getFullYear()} Work Ignas. All rights reserved.</p>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

/** html/head/meta/preheader, black canvas, centred logo, footer. */
export function Layout({ preheader, children, footer }: { preheader: string; children: ReactNode; footer: ReactNode }) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
        <Font
          fontFamily="Urbanist"
          fallbackFontFamily={["Helvetica", "Arial", "sans-serif"]}
          webFont={{
            url: "https://cdn.jsdelivr.net/fontsource/fonts/urbanist:vf@latest/latin-wght-normal.woff2",
            format: "woff2",
          }}
          fontWeight="400 700"
          fontStyle="normal"
        />
        <style>{css}</style>
      </Head>
      <Preview>{preheader}</Preview>
      <Body
        {...bg(c.canvas)}
        style={{
          backgroundColor: c.canvas,
          margin: 0,
          padding: 0,
          fontFamily: font,
        }}
      >
        <table {...table} {...bg(c.canvas)} style={{ backgroundColor: c.canvas }}>
          <tbody>
            <tr>
              <td align="center" {...bg(c.canvas)} style={{ backgroundColor: c.canvas, padding: "32px 0 40px" }}>
                <Container
                  className="px"
                  style={{
                    maxWidth: 600,
                    width: "100%",
                    padding: "0 24px",
                    boxSizing: "border-box",
                  }}
                >
                  <table role="presentation" cellPadding={0} cellSpacing={0} border={0} align="center" style={{ margin: "0 auto 28px" }}>
                    <tbody>
                      <tr>
                        <td valign="middle" style={{ paddingRight: 10 }}>
                          <Img src={asset("logo")} width={36} height={36} alt="eStamp seal" style={{ display: "block", borderRadius: 10 }} />
                        </td>
                        <td
                          valign="middle"
                          style={p({
                            fontSize: 20,
                            lineHeight: 1,
                            fontWeight: 700,
                            letterSpacing: "-0.02em",
                          })}
                        >
                          eStamp
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {children}
                  {footer}
                </Container>
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  )
}
