// Builds the PNGs the email templates use (Gmail blocks SVG): node --import tsx scripts/email-assets.tsx
import { writeFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import sharp from "sharp"
import { CalendarDays, Clock, FileText, Globe, HardDrive, Hash, Info, Layers, Mail, Paperclip, ShieldCheck, Stamp, User, type LucideIcon } from "lucide-react"
import { c } from "../src/emails/theme"

const out = (name: string) => `public/email/${name}.png`
const png = (svg: string, px: number) => sharp(Buffer.from(svg), { density: 384 }).resize(px, px).png({ compressionLevel: 9 }).toBuffer()

const icons: [string, LucideIcon, string][] = [
  ["mail", Mail, c.muted],
  ["file", FileText, c.muted],
  ["stamp", Stamp, c.muted],
  ["hash", Hash, c.muted],
  ["calendar", CalendarDays, c.muted],
  ["layers", Layers, c.muted],
  ["size", HardDrive, c.muted],
  ["user", User, c.muted],
  ["clock", Clock, c.muted],
  ["paperclip", Paperclip, c.muted],
  ["globe", Globe, c.muted],
  ["paperclip-ink", Paperclip, c.accent],
  ["info-ink", Info, c.accent],
  ["shield-ok", ShieldCheck, c.ok],
]

// The app's LogoMark (src/components/brand/logo.tsx) on a solid canvas, so clients can't show a transparent hole.
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="${c.canvas}"/>
  <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="32"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
  <rect width="32" height="32" rx="9" fill="${c.accent}"/><rect width="32" height="32" rx="9" fill="url(#s)"/>
  <circle cx="16" cy="16" r="9.6" fill="none" stroke="#fff" stroke-width="2"/>
  <circle cx="16" cy="16" r="6.4" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="1"/>
  <path d="M12.6 16h6.8M12.6 13.4h6.8M12.6 18.6h4.4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
</svg>`

async function main() {
  writeFileSync(out("logo"), await png(logo, 72))
  for (const [name, Icon, color] of icons) {
    const svg = renderToStaticMarkup(<Icon color={color} size={24} strokeWidth={2} xmlns="http://www.w3.org/2000/svg" />)
    writeFileSync(out(name), await png(svg, 48))
  }
  console.log(`wrote ${icons.length + 1} images to public/email`)
}
void main()
