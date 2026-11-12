"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Check, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Page, PageHeader, Panel } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DesignerSkeleton } from "@/components/skeletons"
import { PaperSheet, StampView } from "@/components/stamp/stamp-view"
import { Segmented } from "./segmented"
import { Fade } from "@/components/docs/doc-bits"
import { deleteStamp, isAdmin, makeStamp, peekRef, saveStamp, useAppState } from "@/lib/store"
import { INKS, type InkKey, type StampDesign } from "@/lib/types"
import { cn } from "@/lib/utils"

const LABELS = ["RECEIVED", "APPROVED", "PAID", "CERTIFIED TRUE COPY", "ORIGINAL", "COPY", "CONFIDENTIAL", "OFFICIAL", "VERIFIED", "REJECTED"]

export function Designer({ mode }: { mode: "new" | "edit" }) {
  const params = useSearchParams()
  const id = params.get("id")
  const ready = useAppState((s) => s.ready)
  const stored = useAppState((s) => (id ? s.stamps.find((x) => x.id === id) : undefined))
  const settings = useAppState((s) => s.settings)
  const canEdit = useAppState(isAdmin)

  if (!ready) return <DesignerSkeleton />
  if (!canEdit) {
    return (
      <Page className="max-w-[640px]">
        <PageHeader title="Only admins can design stamps" description="You can use every stamp in your organisation's library. Ask an admin to add or change one." />
        <Button className="mt-6" nativeButton={false} render={<Link href="/stamps" />}>
          Back to the library
        </Button>
      </Page>
    )
  }
  if (mode === "edit" && !stored) {
    return (
      <Page className="max-w-[640px]">
        <PageHeader title="Stamp not found" description="It may have been deleted by someone in your organisation." />
        <Button className="mt-6" nativeButton={false} render={<Link href="/stamps" />}>
          Back to the library
        </Button>
      </Page>
    )
  }
  const initial = stored ?? makeStamp({ orgName: settings.orgName, subText: settings.subText, name: "" })
  return <DesignerForm key={initial.id} initial={initial} isNew={mode === "new"} />
}

function DesignerForm({ initial, isNew }: { initial: StampDesign; isNew: boolean }) {
  const router = useRouter()
  const [d, setD] = useState<StampDesign>(initial)
  const [paper, setPaper] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dirty, setDirty] = useState(false)
  const set = <K extends keyof StampDesign>(k: K, v: StampDesign[K]) => {
    setDirty(true)
    setD((p) => ({ ...p, [k]: v }))
  }

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [dirty])

  const ctx = useMemo(() => ({ ref: peekRef() }), [])
  const nameFallback = d.label ? d.label.charAt(0) + d.label.slice(1).toLowerCase() : "Untitled stamp"

  function save() {
    if (!d.label.trim()) {
      toast.error("Add a centre label", { description: "It's the big word on the stamp, like RECEIVED or PAID." })
      return
    }
    saveStamp({ ...d, name: d.name.trim() || nameFallback, label: d.label.trim().toUpperCase() })
    setDirty(false)
    toast.success(isNew ? "Stamp created" : "Stamp saved")
    router.push("/stamps")
  }

  return (
    <Fade>
      <Page className="max-w-[1320px]">
        <Link href="/stamps" className="press mb-4 inline-flex items-center gap-1.5 rounded-md text-[13.5px] font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Stamp library
        </Link>
        <PageHeader
          title={isNew ? "Design a stamp" : `Edit “${initial.name}”`}
          description="What you see is exactly what lands on the document. The date and reference number are filled in when you stamp."
          actions={
            <>
              {!isNew && (
                <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Delete
                </Button>
              )}
              <Button variant="outline" nativeButton={false} render={<Link href="/stamps" />}>
                Cancel
              </Button>
              <Button onClick={save}>
                <Check /> {isNew ? "Create stamp" : "Save changes"}
              </Button>
            </>
          }
        />

        <div className="mt-8 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/* Preview */}
          <Panel className="lg:sticky lg:top-6">
            <div className="flex items-center justify-between px-5 pt-4">
              <p className="text-[13px] font-medium text-muted-foreground">Preview</p>
              <Segmented
                label="Preview background"
                className="w-[200px]"
                value={paper ? "paper" : "clear"}
                onChange={(v) => setPaper(v === "paper")}
                options={[
                  { value: "paper", label: "On paper" },
                  { value: "clear", label: "Transparent" },
                ]}
              />
            </div>
            <div className="p-4 sm:p-6">
              <div
                className={cn(
                  "relative flex min-h-[340px] items-center justify-center overflow-hidden rounded-xl p-6 sm:min-h-[460px] sm:p-12",
                  paper ? "bg-[oklch(0.2_0.004_270)]" : "checker",
                )}
              >
                {paper ? (
                  <PaperSheet className="w-full max-w-[560px]">
                    <div className="flex min-h-[300px] items-center justify-center p-8 sm:min-h-[380px] sm:p-12">
                      <StampView design={d} ctx={ctx} className="w-full max-w-[460px] mix-blend-multiply" />
                    </div>
                  </PaperSheet>
                ) : (
                  <StampView design={d} ctx={ctx} className="w-full max-w-[460px]" />
                )}
              </div>
              <p className="tnum mt-3 text-center text-[12.5px] text-faint">
                Prints at {d.sizeMm} mm wide{d.showQR ? " plus the QR panel" : ""} · sample reference {ctx.ref}
              </p>
            </div>
          </Panel>

          {/* Controls */}
          <Panel className="divide-y divide-white/[0.06]">
            <Section title="Basics">
              <Field label="Stamp name" htmlFor="st-name" hint="Only you see this.">
                <Input id="st-name" value={d.name} placeholder={nameFallback} onChange={(e) => set("name", e.target.value)} maxLength={40} />
              </Field>
              <Field label="Shape">
                <Segmented
                  label="Shape"
                  value={d.shape}
                  onChange={(v) => set("shape", v)}
                  options={[
                    { value: "round", label: "Round", icon: <ShapeIcon shape="round" /> },
                    { value: "oval", label: "Oval", icon: <ShapeIcon shape="oval" /> },
                    { value: "rect", label: "Box", icon: <ShapeIcon shape="rect" /> },
                  ]}
                />
              </Field>
            </Section>

            <Section title="Wording">
              <Field label="Centre label" htmlFor="st-label">
                <Input
                  id="st-label"
                  value={d.label}
                  onChange={(e) => set("label", e.target.value.toUpperCase())}
                  maxLength={24}
                  className="font-semibold tracking-wide uppercase"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {LABELS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => set("label", l)}
                      className={cn(
                        "press h-7 rounded-full border px-2.5 text-[11.5px] font-semibold tracking-wide transition-colors duration-150",
                        d.label === l ? "border-ink/60 bg-ink/15 text-foreground" : "border-white/[0.08] text-muted-foreground hover:border-white/20 hover:text-foreground",
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={d.shape === "rect" ? "Top line" : "Around the top"} htmlFor="st-org">
                <Input id="st-org" value={d.orgName} onChange={(e) => set("orgName", e.target.value)} maxLength={60} placeholder="Organisation name" />
              </Field>
              <Field label={d.shape === "rect" ? "Second line" : "Around the bottom"} htmlFor="st-sub" hint="Usually the town, P.O. Box or department.">
                <Input id="st-sub" value={d.subText} onChange={(e) => set("subText", e.target.value)} maxLength={34} placeholder="Dar es Salaam" />
              </Field>
            </Section>

            <Section title="Ink">
              <div role="radiogroup" aria-label="Ink colour" className="flex flex-wrap gap-2">
                {(Object.keys(INKS) as InkKey[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={d.ink === k}
                    onClick={() => set("ink", k)}
                    className={cn(
                      "press flex h-10 items-center gap-2 rounded-[10px] border pr-3 pl-2 text-[13px] font-semibold transition-colors duration-150",
                      d.ink === k ? "border-white/30 bg-white/[0.07]" : "border-white/[0.07] text-muted-foreground hover:border-white/15",
                    )}
                  >
                    <span className="grid size-6 place-items-center rounded-full ring-2 ring-white/15" style={{ background: INKS[k].hex }}>
                      {d.ink === k && <Check className="size-3.5 text-white" strokeWidth={3} />}
                    </span>
                    {INKS[k].name}
                  </button>
                ))}
              </div>
              <ToggleRow label="Rubber-stamp texture" hint="Adds the grain of real ink." checked={d.texture} onChange={(v) => set("texture", v)} />
            </Section>

            <Section title="Details">
              <ToggleRow label="Date" hint="Today's date at the moment you stamp." checked={d.showDate} onChange={(v) => set("showDate", v)} />
              <ToggleRow label="Reference number" hint="Numbered automatically, e.g. ES-2026-0001." checked={d.showRef} onChange={(v) => set("showRef", v)} />
              <ToggleRow label="Signature line" checked={d.showSignature} onChange={(v) => set("showSignature", v)} />
              <ToggleRow label="QR code to verify" hint="Anyone can scan it to check the stamp against your records." checked={d.showQR} onChange={(v) => set("showQR", v)} />
            </Section>

            <Section title="Office rules">
              <ToggleRow
                label="Log in mail register"
                hint="Each use adds a numbered entry, e.g. IN/2026/0001."
                checked={!!d.register}
                onChange={(v) => set("register", v)}
              />
              <ToggleRow
                label="Needs approval"
                hint="Members must get an admin's approval for each file before using it."
                checked={!!d.requiresApproval}
                onChange={(v) => set("requiresApproval", v)}
              />
            </Section>

            <Section title="Size">
              <div className="flex items-center gap-4">
                <Slider
                  value={[d.sizeMm]}
                  min={25}
                  max={70}
                  step={1}
                  onValueChange={(v) => set("sizeMm", Array.isArray(v) ? v[0] : v)}
                  aria-label="Stamp width in millimetres"
                />
                <span className="tnum w-14 shrink-0 text-right text-[14px] font-semibold">{d.sizeMm} mm</span>
              </div>
              <p className="text-[12.5px] text-faint">A typical office stamp is 38–45 mm. You can still resize it on each document.</p>
            </Section>
          </Panel>
        </div>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{initial.name}”?</AlertDialogTitle>
              <AlertDialogDescription>Documents already stamped keep their stamp. This only removes it from your library.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  deleteStamp(initial.id)
                  setDirty(false)
                  toast.success("Stamp deleted")
                  router.push("/stamps")
                }}
              >
                Delete stamp
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Page>
    </Fade>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 p-5">
      <h2 className="text-[14px] font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-[12.5px] text-faint">{hint}</p>}
    </div>
  )
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-[14px] font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[12.5px] text-faint">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </label>
  )
}

function ShapeIcon({ shape }: { shape: StampDesign["shape"] }) {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
      {shape === "round" && <circle cx="8" cy="8" r="6" />}
      {shape === "oval" && <ellipse cx="8" cy="8" rx="7" ry="4.6" />}
      {shape === "rect" && <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />}
    </svg>
  )
}
