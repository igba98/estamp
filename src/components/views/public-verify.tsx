"use client"

import Link from "next/link"
import { CircleAlert } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { Fade } from "@/components/docs/doc-bits"
import { LookupView, useLookup } from "@/components/views/verify"

/** What someone sees after scanning a stamp's QR code. No app chrome. */
export function PublicVerify() {
  const lookup = useLookup()

  return (
    <div className="min-h-dvh bg-background pb-[env(safe-area-inset-bottom)]">
      <header className="mx-auto flex max-w-[720px] items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
        <Logo />
        <span className="text-[13px] font-medium text-faint">Stamp verification</span>
      </header>
      <Fade>
        <main className="mx-auto max-w-[720px] px-5 pb-16">
          {lookup.s === "none" ? (
            <div role="alert" className="mt-8 flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 p-5">
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div>
                <p className="text-[15px] font-semibold">No stamp to check</p>
                <p className="mt-1 text-[14px] text-muted-foreground">Open this page by scanning the QR code printed beside an eStamp.</p>
              </div>
            </div>
          ) : (
            <LookupView lookup={lookup} />
          )}
          <p className="mt-10 text-center text-[13px] text-faint">
            Stamps made with eStamp.{" "}
            <Link href="/" className="font-semibold text-muted-foreground underline decoration-white/20 hover:text-foreground">
              Create your own
            </Link>
          </p>
        </main>
      </Fade>
    </div>
  )
}
