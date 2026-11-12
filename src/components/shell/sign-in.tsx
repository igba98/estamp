"use client"

import { useState } from "react"
import { CircleAlert, MailCheck, RotateCw } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { Panel } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Fade } from "@/components/docs/doc-bits"
import { refresh, sendSignInEmail, signOut, verifySignInCode } from "@/lib/store"
import { supabaseConfigured } from "@/lib/supabase"

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <Fade className="w-full max-w-[400px]">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        {children}
      </Fade>
    </div>
  )
}

/** Email sign-in: the email carries a link and a 6-digit code (the code works when the link opens in another browser). */
export function SignIn() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!supabaseConfigured) {
    return (
      <Frame>
        <Panel className="p-6">
          <h1 className="text-[18px] font-semibold">Connect Supabase</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
            Add <code className="font-mono text-[12.5px]">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-mono text-[12.5px]">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to <code className="font-mono text-[12.5px]">.env.local</code>, then restart the dev server.
          </p>
        </Panel>
      </Frame>
    )
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await sendSignInEmail(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the email. Try again.")
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await verifySignInCode(email.trim(), code.trim())
    } catch {
      setError("That code didn't work. Check the latest email, or send a new one.")
      setBusy(false)
    }
  }

  return (
    <Frame>
      <Panel className="p-6">
        {!sent ? (
          <form onSubmit={send}>
            <h1 className="text-[19px] font-semibold tracking-[-0.01em]">Sign in to eStamp</h1>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
              We&apos;ll email you a 6-digit code. New here? The same code creates your account.
            </p>
            <div className="mt-5 space-y-2">
              <Label htmlFor="si-email">Work email</Label>
              <Input
                id="si-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.co.tz"
                aria-invalid={!!error}
                aria-describedby={error ? "si-err" : undefined}
              />
            </div>
            {error && <ErrorLine id="si-err">{error}</ErrorLine>}
            <Button type="submit" size="lg" className="mt-5 w-full" disabled={busy || !email.trim()}>
              {busy ? "Sending…" : "Email me a code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <span className="grid size-11 place-items-center rounded-xl bg-ok/12 text-ok">
              <MailCheck className="size-5" />
            </span>
            <h1 className="mt-4 text-[19px] font-semibold tracking-[-0.01em]">Check your email</h1>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
              We sent a 6-digit code to <span className="font-semibold break-all text-foreground">{email}</span>. Type it below, or tap the link in the email on this device.
            </p>
            <div className="mt-5 space-y-2">
              <Label htmlFor="si-code">6-digit code</Label>
              <Input
                id="si-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="tnum text-center text-[18px] tracking-[0.3em]"
                aria-invalid={!!error}
                aria-describedby={error ? "si-err" : undefined}
              />
            </div>
            {error && <ErrorLine id="si-err">{error}</ErrorLine>}
            <Button type="submit" size="lg" className="mt-5 w-full" disabled={busy || code.length < 6}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <div className="mt-3 flex justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSent(false)
                  setCode("")
                  setError(null)
                }}
              >
                Use another email
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={(e) => void send(e)}>
                <RotateCw /> Send again
              </Button>
            </div>
          </form>
        )}
      </Panel>
    </Frame>
  )
}

/** Signed in, but the organisation data didn't load (offline, or the database isn't set up). */
export function LoadFailed({ message }: { message: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <Frame>
      <Panel className="p-6">
        <div role="alert" className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <h1 className="text-[16px] font-semibold">Couldn&apos;t load your workspace</h1>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await refresh()
              setBusy(false)
            }}
          >
            {busy ? "Trying…" : "Try again"}
          </Button>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Panel>
    </Frame>
  )
}

function ErrorLine({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-2 text-[13px] text-destructive">
      {children}
    </p>
  )
}
