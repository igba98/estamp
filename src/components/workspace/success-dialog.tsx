"use client"

import { useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { Check, Download, Link2, Mail, Stamp } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { download, formatBytes } from "@/lib/documents"
import { emailDocument } from "@/lib/store"
import type { ExportResult } from "./export"

export function SuccessDialog({
  result,
  onClose,
  onAnother,
}: {
  result: ExportResult | null
  onClose: () => void
  onAnother: () => void
}) {
  const reduce = useReducedMotion()
  const [mail, setMail] = useState<{ id: string; s: "sending" | "sent" } | null>(null)
  const mailState = mail?.id === result?.doc.id ? mail?.s : undefined
  return (
    <Dialog open={!!result} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden border-white/[0.08] p-0 sm:max-w-[440px]">
        {result && (
          <>
            <div className="flex flex-col items-center px-6 pt-8 pb-6 text-center">
              <div className="relative grid size-16 place-items-center">
                <motion.span
                  className="absolute inset-0 rounded-full bg-ok/15"
                  initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                />
                <svg viewBox="0 0 24 24" className="relative size-8 text-ok" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <motion.path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: 0.12, ease: [0.23, 1, 0.32, 1] }}
                  />
                </svg>
              </div>
              <DialogTitle className="mt-4 text-[19px] font-semibold tracking-[-0.01em]">Document stamped</DialogTitle>
              <DialogDescription className="mt-1.5 text-[13.5px] leading-relaxed">
                Your file is saved as <span className="font-semibold break-all text-foreground">{result.name}</span>
              </DialogDescription>
              {!result.synced && (
                <p role="status" className="mt-3 rounded-lg border border-warn/25 bg-warn/10 px-3 py-2 text-[12.5px] leading-relaxed text-muted-foreground">
                  The stamp is recorded, but the file didn&apos;t save online, so the verify page can&apos;t confirm this exact copy. Keep your download.
                </p>
              )}
            </div>
            <dl className="mx-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.07] text-[13px]">
              <div className="bg-popover p-3">
                <dt className="text-faint">Reference</dt>
                <dd className="tnum mt-0.5 font-semibold">{result.doc.ref}</dd>
              </div>
              {result.registerNo ? (
                <div className="bg-popover p-3">
                  <dt className="text-faint">Mail register</dt>
                  <dd className="tnum mt-0.5 font-semibold">{result.registerNo}</dd>
                </div>
              ) : (
                <div className="bg-popover p-3">
                  <dt className="text-faint">File size</dt>
                  <dd className="tnum mt-0.5 font-semibold">{formatBytes(result.bytes.byteLength)}</dd>
                </div>
              )}
            </dl>
            <div className="grid gap-2 p-6">
              <Button size="lg" onClick={() => void download(result.bytes, result.name, result.mime)}>
                <Download /> Download again
              </Button>
              <div className="grid grid-cols-2 gap-2">
                {result.synced && (
                  <Button
                    variant="outline"
                    disabled={!!mailState}
                    onClick={async () => {
                      const id = result.doc.id
                      setMail({ id, s: "sending" })
                      setMail((await emailDocument(id)) ? { id, s: "sent" } : null)
                    }}
                  >
                    {mailState === "sent" ? <Check /> : <Mail />} {mailState === "sending" ? "Emailing…" : mailState === "sent" ? "Emailed" : "Email to me"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(result.doc.verifyUrl)
                      toast.success("Verify link copied")
                    } catch {
                      toast.error("Couldn't copy. Open the document's details to copy the link.")
                    }
                  }}
                >
                  <Link2 /> Copy verify link
                </Button>
                <Button
                  variant="outline"
                  className={result.synced ? "col-span-2" : undefined}
                  onClick={() => {
                    onClose()
                    onAnother()
                  }}
                >
                  <Stamp /> Stamp another
                </Button>
              </div>
              <Link href={`/documents?open=${result.doc.id}`} className="press mx-auto mt-1 rounded-md text-[13px] font-semibold text-muted-foreground hover:text-foreground">
                See it in Stamped documents
              </Link>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
