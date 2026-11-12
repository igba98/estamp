"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Page, PageHeader, Panel } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Fade } from "@/components/docs/doc-bits"
import { FormSkeleton } from "@/components/skeletons"
import { getState, isAdmin, peekRef, saveStamp, updateSettings, useAppState } from "@/lib/store"
import { TeamPanel } from "./team"
import { ApiKeysPanel } from "./api-keys"
import { BillingPanel } from "./billing"
import type { Settings } from "@/lib/types"

export function SettingsView() {
  const ready = useAppState((s) => s.ready)
  const settings = useAppState((s) => s.settings)
  if (!ready) return <FormSkeleton />
  return <SettingsForm key={JSON.stringify(settings)} initial={settings} />
}

function SettingsForm({ initial }: { initial: Settings }) {
  const [s, setS] = useState(initial)
  const [applyToStamps, setApplyToStamps] = useState(true)
  const stamps = useAppState((x) => x.stamps)
  const admin = useAppState(isAdmin)
  const dirty = JSON.stringify(s) !== JSON.stringify(initial)
  const affected = stamps.filter((st) => st.orgName === initial.orgName || st.subText === initial.subText).length

  function save(e: React.FormEvent) {
    e.preventDefault()
    const orgName = s.orgName.trim() || initial.orgName
    if (admin && applyToStamps) {
      for (const st of getState().stamps) {
        if (st.orgName === initial.orgName || st.subText === initial.subText) {
          saveStamp({
            ...st,
            orgName: st.orgName === initial.orgName ? orgName : st.orgName,
            subText: st.subText === initial.subText ? s.subText.trim() : st.subText,
          })
        }
      }
    }
    updateSettings({
      orgName,
      subText: s.subText.trim(),
      stampedBy: s.stampedBy.trim(),
      refPrefix: s.refPrefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "ES",
      onboarded: true,
    })
    toast.success("Settings saved")
  }

  return (
    <Fade>
      <Page className="max-w-[860px]">
        <PageHeader
          title="Settings"
          description={admin ? "Details used on new stamps, reference numbers and the verify page." : "Your name, and your organisation's details. Only admins can change the organisation."}
        />
        <form onSubmit={save} className="mt-8 space-y-4">
          <Panel className="divide-y divide-white/[0.06]">
            <Group title="Organisation" desc="New stamps start with these details.">
              <Field id="s-org" label="Organisation name">
                <Input id="s-org" value={s.orgName} onChange={(e) => setS({ ...s, orgName: e.target.value })} maxLength={60} required disabled={!admin} />
              </Field>
              <Field id="s-sub" label="Town, P.O. Box or department">
                <Input id="s-sub" value={s.subText} onChange={(e) => setS({ ...s, subText: e.target.value })} maxLength={34} disabled={!admin} />
              </Field>
              <Field id="s-by" label="Your name" hint="Shown on the verify page as “Stamped by”, and in the register. Leave empty to hide it.">
                <Input id="s-by" value={s.stampedBy} onChange={(e) => setS({ ...s, stampedBy: e.target.value })} maxLength={50} />
              </Field>
              {admin && affected > 0 && (s.orgName !== initial.orgName || s.subText !== initial.subText) && (
                <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                  <span>
                    <span className="block text-[14px] font-medium">Update my existing stamps</span>
                    <span className="mt-0.5 block text-[12.5px] text-faint">
                      {affected} {affected === 1 ? "stamp uses" : "stamps use"} the current details.
                    </span>
                  </span>
                  <Switch checked={applyToStamps} onCheckedChange={setApplyToStamps} />
                </label>
              )}
            </Group>
            <Group title="Reference numbers" desc="Every stamped document gets the next number.">
              <Field id="s-pre" label="Prefix" hint={`Next reference: ${preview(s.refPrefix, initial.refCounter)}`}>
                <Input id="s-pre" value={s.refPrefix} onChange={(e) => setS({ ...s, refPrefix: e.target.value.toUpperCase() })} maxLength={6} className="tnum max-w-[180px] uppercase" disabled={!admin} />
              </Field>
            </Group>
          </Panel>

          <div className="flex items-center justify-end gap-3">
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={!dirty} onClick={() => setS(initial)}>
                Discard
              </Button>
              <Button type="submit" disabled={!dirty}>
                Save settings
              </Button>
            </div>
          </div>
        </form>

        <TeamPanel />
        <ApiKeysPanel />
        <BillingPanel />

        <Panel className="mt-6 p-5 sm:p-6">
          <h2 className="text-[15px] font-semibold">Your data</h2>
          <p className="mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-muted-foreground">
            Stamps, records, the mail register and stamped files are stored in your organisation&apos;s account, so they follow you to any device you sign in on. Original files stay on your device; only their fingerprint is kept.
          </p>
          <p className="tnum mt-3 text-[13px] text-faint">Next reference: {peekRef()}</p>
        </Panel>
      </Page>
    </Fade>
  )
}

function preview(prefix: string, counter: number) {
  const p = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "ES"
  return `${p}-${new Date().getFullYear()}-${String(counter + 1).padStart(4, "0")}`
}

function Group({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 p-5 sm:p-6 md:grid-cols-[220px_minmax(0,1fr)]">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="tnum text-[12.5px] text-faint">{hint}</p>}
    </div>
  )
}
