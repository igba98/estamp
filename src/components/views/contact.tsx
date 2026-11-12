"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Script from "next/script"
import { CircleAlert, MailCheck } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { Panel } from "@/components/page-header"
import { Fade } from "@/components/docs/doc-bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MAX_MESSAGE, MAX_SUBJECT, type SendResult } from "@/lib/email-input"

type Turnstile = {
  render: (el: HTMLElement, o: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

/** Public contact form. The server checks Turnstile, rate-limits by IP and only ever mails the estamp inbox + the sender. */
export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" })
  const [token, setToken] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle")
  const [error, setError] = useState<string | null>(null)
  const [scriptReady, setScriptReady] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const sent = state === "sent"

  useEffect(() => {
    if (sent || !scriptReady || !SITE_KEY || !box.current || !window.turnstile || widget.current) return
    widget.current = window.turnstile.render(box.current, {
      sitekey: SITE_KEY,
      theme: "dark",
      size: box.current.offsetWidth < 300 ? "compact" : "flexible", // flexible needs 300px
      callback: (t: string) => setToken(t),
      "expired-callback": () => setToken(""),
      "error-callback": () => setToken(""),
    })
    return () => {
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [scriptReady, sent])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState("sending")
    setError(null)
    let r: SendResult
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, token }) })
      r = ((await res.json().catch(() => null)) as SendResult | null) ?? { ok: false, code: "error", message: "Couldn't send. Try again." }
    } catch {
      r = { ok: false, code: "network", message: "You seem to be offline. Check your connection and try again." }
    }
    if (r.ok) return setState("sent")
    setState("idle")
    setError(r.message)
    // Tokens work once; get a fresh one for the retry.
    setToken("")
    if (widget.current) window.turnstile?.reset(widget.current)
  }

  const busy = state === "sending"
  return (
    <div className="min-h-dvh bg-background pb-[env(safe-area-inset-bottom)]">
      {SITE_KEY && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setScriptReady(true)} />}
      <header className="mx-auto flex max-w-[560px] items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
        <Link href="/" aria-label="eStamp home" className="press rounded-lg">
          <Logo />
        </Link>
        <span className="text-[13px] font-medium text-faint">Contact</span>
      </header>
      <Fade>
        <main className="mx-auto max-w-[560px] px-5 pt-4 pb-16">
          <Panel className="p-6">
            {state === "sent" ? (
              <div role="status">
                <span className="grid size-11 place-items-center rounded-xl bg-ok/12 text-ok">
                  <MailCheck className="size-5" />
                </span>
                <h1 className="mt-4 text-[19px] font-semibold tracking-[-0.01em]">Message sent</h1>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                  Thanks, {form.name.trim() || "there"}. We&apos;ve emailed a copy to <span className="font-semibold break-all text-foreground">{form.email.trim()}</span> and will reply
                  there within one working day.
                </p>
                <Button
                  variant="outline"
                  className="mt-5"
                  onClick={() => {
                    setForm((f) => ({ ...f, subject: "", message: "" }))
                    setToken("")
                    setState("idle")
                  }}
                >
                  Send another message
                </Button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <h1 className="text-[19px] font-semibold tracking-[-0.01em]">Contact eStamp</h1>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                  Questions, problems or ideas. A person reads every message and replies within one working day.
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ct-name">Your name</Label>
                    <Input id="ct-name" autoComplete="name" required maxLength={100} value={form.name} onChange={set("name")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ct-email">Your email</Label>
                    <Input id="ct-email" type="email" inputMode="email" autoComplete="email" required maxLength={254} value={form.email} onChange={set("email")} />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="ct-subject">Subject</Label>
                  <Input id="ct-subject" required maxLength={MAX_SUBJECT} value={form.subject} onChange={set("subject")} />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <Label htmlFor="ct-message">Message</Label>
                    <span className="tnum text-[12px] text-faint" aria-live="polite">
                      {form.message.length > MAX_MESSAGE * 0.8 ? `${form.message.length.toLocaleString()} / ${MAX_MESSAGE.toLocaleString()}` : ""}
                    </span>
                  </div>
                  <Textarea id="ct-message" required rows={6} maxLength={MAX_MESSAGE} value={form.message} onChange={set("message")} className="min-h-[140px]" />
                </div>
                {SITE_KEY ? (
                  <div ref={box} className="mt-4 min-h-[65px]" />
                ) : (
                  <p className="mt-4 text-[13px] text-muted-foreground">
                    The form isn&apos;t switched on yet. Email{" "}
                    <a className="font-semibold text-foreground underline decoration-white/20" href="mailto:estamp@workwithignas.com">
                      estamp@workwithignas.com
                    </a>{" "}
                    instead.
                  </p>
                )}
                {error && (
                  <p id="ct-err" role="alert" className="mt-3 flex items-start gap-2 text-[13px] text-destructive">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
                  </p>
                )}
                <Button type="submit" size="lg" className="mt-5 w-full" disabled={busy || !token || !SITE_KEY}>
                  {busy ? "Sending…" : error ? "Try again" : "Send message"}
                </Button>
              </form>
            )}
          </Panel>
        </main>
      </Fade>
    </div>
  )
}
