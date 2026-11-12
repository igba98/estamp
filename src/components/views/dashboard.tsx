"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo } from "react"
import { ArrowRight, ClipboardCheck, Plus, ShieldCheck, Stamp } from "lucide-react"
import { Page, PageHeader, Panel, PanelHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { DropZone } from "@/components/drop-zone"
import { DashboardSkeleton } from "@/components/skeletons"
import { StampFolder } from "@/components/stamp/stamp-tiles"
import { DocIcon, Fade } from "@/components/docs/doc-bits"
import { isAdmin, setPendingFile, useAppState } from "@/lib/store"
import { greeting, timeAgo } from "@/lib/format"
import { formatBytes } from "@/lib/documents"
import { OnboardingCard } from "@/components/views/onboarding-card"

export function Dashboard() {
  const router = useRouter()
  const ready = useAppState((s) => s.ready)
  const stamps = useAppState((s) => s.stamps)
  const docs = useAppState((s) => s.docs)
  const settings = useAppState((s) => s.settings)
  const admin = useAppState(isAdmin)
  const stats = useAppState((s) => s.stats)
  const members = useAppState((s) => s.members)
  // Admins: requests waiting for them. Members: approvals ready to use.
  const attention = useAppState((s) => s.approvals.filter((a) => a.status === (admin ? "pending" : "approved")).length)

  const quick = useMemo(
    () => [...stamps].sort((a, b) => b.uses - a.uses || a.createdAt - b.createdAt).slice(0, 4),
    [stamps],
  )

  if (!ready) return <DashboardSkeleton />

  return (
    <Fade>
      <Page>
        <PageHeader
          title={greeting()}
          description={`Stamp documents for ${settings.orgName}. Drop a file to begin, or start from one of your stamps.`}
          actions={
            <>
              {admin && (
                <Button variant="outline" nativeButton={false} render={<Link href="/stamps/new" />}>
                  <Plus /> New stamp
                </Button>
              )}
              <Button nativeButton={false} render={<Link href="/stamp" />}>
                <Stamp /> Stamp a document
              </Button>
            </>
          }
        />

        {attention > 0 && (
          <Link
            href="/approvals"
            className="press mt-8 flex items-center gap-3 rounded-2xl border border-warn/25 bg-warn/10 p-4 transition-[background-color] duration-150 hover:bg-warn/15"
          >
            <ClipboardCheck className="size-5 shrink-0 text-warn" />
            <span className="min-w-0 flex-1 text-[14px]">
              <span className="font-semibold">
                {attention} {admin ? (attention === 1 ? "request is" : "requests are") : attention === 1 ? "approval is" : "approvals are"}{" "}
                {admin ? "waiting for your approval" : "ready: you can stamp now"}
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        )}

        {admin && !settings.onboarded && <OnboardingCard className="mt-8" />}

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <DropZone
            className="h-full lg:col-span-2"
            onFile={(f) => {
              setPendingFile(f)
              router.push("/stamp")
            }}
          />
          <Panel className="flex flex-col">
            <PanelHeader title="Your organisation" />
            <dl className="flex-1 divide-y divide-white/[0.05] px-5">
              <Stat label="Documents stamped" value={stats.total} />
              <Stat label="Stamped this week" value={stats.week} />
              <Stat label="Pages stamped" value={stats.pages} />
              <Stat label="Stamps in library" value={stamps.length} />
            </dl>
            {members.length > 1 && stats.team.length > 0 && (
              <div className="mx-5 border-t border-white/[0.05] pt-3 pb-1">
                <p className="text-[12.5px] font-medium text-faint">This month</p>
                <ul className="mt-1.5 space-y-1.5">
                  {stats.team.slice(0, 5).map((t) => {
                    const m = members.find((x) => x.userId === t.userId)
                    return (
                      <li key={t.userId ?? "gone"} className="flex items-center gap-3 text-[13px]">
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{m ? m.name || m.email : "Former member"}</span>
                        <span className="tnum font-semibold">{t.count.toLocaleString()}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            <div className="mx-5 mt-1 mb-5 flex items-start gap-2.5 border-t border-white/[0.05] pt-4 text-[12.5px] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" />
              <span>
                Every stamp carries a QR code. Scanning it opens the stamp&apos;s details on the{" "}
                <Link href="/verify" className="font-semibold text-foreground underline decoration-white/25 hover:decoration-white/60">
                  verify page
                </Link>
                .
              </span>
            </div>
          </Panel>
        </div>

        <section className="mt-12" aria-labelledby="quick-h">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="quick-h" className="text-[17px] font-semibold">
              Stamp with
            </h2>
            <Link href="/stamps" className="press inline-flex items-center gap-1 rounded-md text-[13.5px] font-semibold text-muted-foreground hover:text-foreground">
              Stamp library <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
            {quick.map((s) => (
              <StampFolder key={s.id} design={s} href={`/stamp?with=${s.id}`} />
            ))}
            {admin && (
            <Link
              href="/stamps/new"
              className="press group flex flex-col items-center gap-3 rounded-2xl p-2"
            >
              <div className="grid aspect-[1.18] w-full place-items-center rounded-[14px] border border-dashed border-white/[0.12] transition-colors duration-150 group-hover:border-white/25 group-hover:bg-white/[0.02]">
                <span className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/[0.04]">
                  <Plus className="size-5 text-muted-foreground" />
                </span>
              </div>
              <div className="text-center">
                <p className="text-[14px] font-semibold leading-tight">New stamp</p>
                <p className="mt-0.5 text-[12.5px] text-faint">Design your own</p>
              </div>
            </Link>
            )}
          </div>
        </section>

        <Panel className="mt-12">
          <PanelHeader
            title="Recently stamped"
            action={
              docs.length > 0 && (
                <Link href="/documents" className="press inline-flex items-center gap-1 rounded-md text-[13.5px] font-semibold text-muted-foreground hover:text-foreground">
                  View all <ArrowRight className="size-3.5" />
                </Link>
              )
            }
          />
          {docs.length === 0 ? (
            <div className="flex flex-col items-center px-6 pt-6 pb-10 text-center">
              <p className="text-[15px] font-semibold">Nothing stamped yet</p>
              <p className="mt-1 max-w-[44ch] text-[13.5px] text-muted-foreground">
                Documents you stamp show up here with their reference number, so you can find them and share their verify links later.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.05] pb-2">
              {docs.slice(0, 5).map((d) => (
                <li key={d.id}>
                  <Link href={`/documents?open=${d.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-white/[0.025]">
                    <DocIcon kind={d.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{d.fileName}</p>
                      <p className="mt-0.5 truncate text-[12.5px] text-faint">
                        {d.stampNames.join(", ")} · {d.pages} {d.pages === 1 ? "page" : "pages"} · {formatBytes(d.outputBytes)}
                      </p>
                    </div>
                    <span className="tnum hidden rounded-md border border-white/[0.07] px-2 py-0.5 text-[12px] font-semibold text-muted-foreground sm:inline">
                      {d.ref}
                    </span>
                    <span className="tnum w-24 shrink-0 text-right text-[12.5px] text-faint">{timeAgo(d.stampedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </Page>
    </Fade>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between py-3">
      <dt className="text-[13.5px] text-muted-foreground">{label}</dt>
      <dd className="tnum text-[17px] font-semibold">{value.toLocaleString()}</dd>
    </div>
  )
}
