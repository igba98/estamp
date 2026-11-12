"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Panel } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StampView } from "@/components/stamp/stamp-view"
import { PaperSheet } from "@/components/stamp/stamp-view"
import { getState, saveStamp, updateSettings, useAppState } from "@/lib/store"
import { cn } from "@/lib/utils"

export function OnboardingCard({ className }: { className?: string }) {
  const settings = useAppState((s) => s.settings)
  const first = useAppState((s) => s.stamps[0])
  const [org, setOrg] = useState(settings.orgName === "Your Company Ltd" ? "" : settings.orgName)
  const [town, setTown] = useState(settings.subText)
  const [name, setName] = useState(settings.stampedBy)

  function save(e: React.FormEvent) {
    e.preventDefault()
    const orgName = org.trim()
    if (!orgName) return
    const old = getState().settings
    // Starter stamps still carrying the placeholder details get the real ones.
    for (const s of getState().stamps) {
      if (s.orgName === old.orgName || s.subText === old.subText) {
        saveStamp({
          ...s,
          orgName: s.orgName === old.orgName ? orgName : s.orgName,
          subText: s.subText === old.subText ? town.trim() : s.subText,
        })
      }
    }
    updateSettings({ orgName, subText: town.trim(), stampedBy: name.trim(), onboarded: true })
    toast.success("Your stamps now carry " + orgName)
  }

  const preview = first ? { ...first, orgName: org || "Your organisation", subText: town, showQR: false } : null

  return (
    <Panel className={cn("overflow-hidden", className)}>
      <div className="grid md:grid-cols-[1fr_280px]">
        <form onSubmit={save} className="p-5 sm:p-6">
          <h2 className="text-[17px] font-semibold">Put your organisation on your stamps</h2>
          <p className="mt-1 max-w-[56ch] text-[13.5px] leading-relaxed text-muted-foreground">
            Your four starter stamps use placeholder text. Add your details once and they update everywhere. You can change this later in Settings.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ob-org">Organisation name</Label>
              <Input id="ob-org" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="e.g. Kilimanjaro Traders Ltd" maxLength={60} autoComplete="organization" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-town">Town or city</Label>
              <Input id="ob-town" value={town} onChange={(e) => setTown(e.target.value)} placeholder="Dar es Salaam" maxLength={30} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-name">
                Your name <span className="font-normal text-faint">(optional)</span>
              </Label>
              <Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Shown on the verify page" maxLength={50} autoComplete="name" />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="submit" disabled={!org.trim()}>
              Save and update stamps
            </Button>
            <Button type="button" variant="ghost" onClick={() => updateSettings({ onboarded: true })}>
              Later
            </Button>
          </div>
        </form>
        <div className="hidden items-center justify-center border-l border-white/[0.06] bg-white/[0.015] p-6 md:flex">
          {preview && (
            <PaperSheet className="w-full">
              <div className="flex aspect-[4/3] items-center justify-center p-6">
                <StampView design={preview} className="w-[78%] mix-blend-multiply" />
              </div>
            </PaperSheet>
          )}
        </div>
      </div>
    </Panel>
  )
}
