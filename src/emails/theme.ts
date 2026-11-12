/** "eStamp Dark" email tokens. Colours mirror src/app/globals.css (ink = brand accent), converted to hex for email clients. */
export const c = {
  canvas: "#0A0A0A",
  surface: "#141414",
  surface2: "#1C1C1C",
  border: "#262626",
  text: "#FAFAFA",
  muted: "#A1A1A1",
  subtle: "#8A8A8A", // brief said #737373, which is 4.2:1 on the canvas; this passes AA for 12px text
  accent: "#427FF7", // --ink; links, badges, numerals (4.9:1 on cards)
  button: "#2F6BEA", // --ink a step darker so the white label passes AA (4.8:1)
  ok: "#43C07A",
  warn: "#EDB345",
  error: "#F75D5C",
  infoTint: "#111826",
  infoBorder: "#182745",
  okTint: "#112017",
  okBorder: "#183826",
} as const

export const font = "Urbanist, Helvetica, Arial, sans-serif"
export const tnum = { fontVariantNumeric: "tabular-nums" } as const
/** Long file names, emails and URLs wrap instead of overflowing. */
export const wrap = {
  overflowWrap: "anywhere",
  wordBreak: "break-word",
} as const

export const type = {
  display: {
    fontSize: 40,
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
    fontWeight: 700,
  },
  h1: {
    fontSize: 26,
    lineHeight: 1.2,
    letterSpacing: "-0.01em",
    fontWeight: 700,
  },
  h2: {
    fontSize: 18,
    lineHeight: 1.3,
    letterSpacing: "-0.01em",
    fontWeight: 700,
  },
  section: {
    fontSize: 13,
    lineHeight: 1.4,
    letterSpacing: "0.04em",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  body: { fontSize: 15, lineHeight: 1.5, letterSpacing: 0, fontWeight: 400 },
  small: { fontSize: 13, lineHeight: 1.5, letterSpacing: 0, fontWeight: 400 },
} as const

/** Images live in public/email (served at <app>/email/…). The React Email preview serves the same files at /static. */
export function asset(name: string) {
  const app = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  return app ? `${app}/email/${name}.png` : `/static/${name}.png`
}

const TZ = "Africa/Dar_es_Salaam"
export const fmtDateTime = (iso: string) =>
  `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso))} EAT`
export const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(new Date(iso))
export const fmtNum = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const fmtTzs = (n: number) => `TZS ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
export const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s)
export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`
