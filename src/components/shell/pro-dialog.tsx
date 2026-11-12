"use client"

import { Smartphone } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const FEATURES = [
  { icon: Smartphone, title: "Mobile money billing", body: "Pay monthly or by credit bundles with M-Pesa, Airtel Money or Mixx by Yas." },
]

export function ProDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] gap-0 border-white/[0.08] bg-popover p-0">
        <DialogHeader className="border-b border-border p-6 pb-5">
          <DialogTitle className="text-lg font-semibold tracking-[-0.01em]">Coming next to eStamp</DialogTitle>
          <DialogDescription className="text-[13.5px] leading-relaxed">
            Verified stamps, the mail register, approvals, bulk stamping and the API are live. This is next.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1 p-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-3 rounded-xl p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                <f.icon className="size-4 text-muted-foreground" />
              </span>
              <span>
                <span className="block text-[14px] font-semibold">{f.title}</span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">{f.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
