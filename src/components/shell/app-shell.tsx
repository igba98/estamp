"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { ChevronsLeft, ChevronsRight, LogOut, Menu, ShieldCheck, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo, LogoMark } from "@/components/brand/logo"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { ProDialog } from "@/components/shell/pro-dialog"
import { MAIN_NAV, PRO_NAV, SETTINGS_NAV, isActive, type NavItem } from "./nav-config"
import { isAdmin, refreshIfStale, signOut, useAppState } from "@/lib/store"
import { LoadFailed, SignIn } from "./sign-in"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [proOpen, setProOpen] = useState(false)
  const ready = useAppState((s) => s.ready)
  const signedIn = useAppState((s) => !!s.user)
  const loadError = useAppState((s) => s.loadError)

  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && refreshIfStale()
    document.addEventListener("visibilitychange", onShow)
    return () => document.removeEventListener("visibilitychange", onShow)
  }, [])

  // Before the session check finishes, pages show their own skeletons inside the shell.
  if (ready && !signedIn) return <SignIn />
  if (ready && loadError) return <LoadFailed message={loadError} />

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 border-r border-border bg-sidebar md:flex md:flex-col",
          collapsed ? "w-[76px]" : "w-[260px]",
        )}
      >
        <SidebarBody collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} onPro={() => setProOpen(true)} />
      </aside>

      {/* Mobile */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-[284px] max-w-[85vw] border-border bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody collapsed={false} onNavigate={() => setMobileOpen(false)} onPro={() => setProOpen(true)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl backdrop-saturate-150 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="press -ml-1.5 grid size-10 place-items-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <Link href="/" className="flex items-center">
            <Logo />
          </Link>
        </header>
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>

      <ProDialog open={proOpen} onOpenChange={setProOpen} />
    </div>
  )
}

function SidebarBody({
  collapsed,
  onToggle,
  onNavigate,
  onPro,
}: {
  collapsed: boolean
  onToggle?: () => void
  onNavigate?: () => void
  onPro: () => void
}) {
  const pathname = usePathname()
  const ready = useAppState((s) => s.ready)
  const org = useAppState((s) => s.settings.orgName)
  const docCount = useAppState((s) => s.docs.length)
  const stampCount = useAppState((s) => s.stamps.length)
  const admin = useAppState(isAdmin)
  const role = useAppState((s) => s.role)
  const email = useAppState((s) => s.user?.email ?? "")
  // Admins see requests waiting for them; members see approvals ready to use.
  const approvalCount = useAppState((s) => s.approvals.filter((a) => a.status === (admin ? "pending" : "approved")).length)

  const counts: Record<string, number | undefined> = {
    "/stamps": ready ? stampCount : undefined,
    "/documents": ready ? docCount : undefined,
    "/approvals": ready ? approvalCount : undefined,
  }

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-16 items-center gap-2 px-4", collapsed && "justify-center px-0")}>
        <Link href="/" onClick={onNavigate} className="press rounded-lg" aria-label="eStamp home">
          {collapsed ? <LogoMark /> : <Logo />}
        </Link>
        {onToggle && !collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="press ml-auto grid size-8 place-items-center rounded-lg text-faint hover:bg-white/5 hover:text-foreground"
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft className="size-4" />
          </button>
        )}
      </div>

      {/* Workspace card */}
      <div className={cn("px-3", collapsed && "px-2.5")}>
        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn(
            "press flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5 hover:bg-white/[0.05]",
            collapsed && "justify-center p-2",
          )}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-b from-white/15 to-white/5 text-[13px] font-bold">
            {ready ? initials(org) : ""}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1">
              {ready ? (
                <span className="block truncate text-[13.5px] font-semibold leading-tight">{org}</span>
              ) : (
                <Skeleton className="h-3.5 w-28" />
              )}
              <span className="mt-0.5 flex items-center gap-1 text-xs text-faint">
                <ShieldCheck className="size-3" /> {ready ? `${ROLE_NAME[role]} · synced` : "Connecting…"}
              </span>
            </span>
          )}
        </Link>
      </div>

      <nav className="mt-5 flex-1 overflow-y-auto px-3" aria-label="Main">
        {!collapsed && <GroupLabel>Workspace</GroupLabel>}
        <ul className="space-y-0.5">
          {MAIN_NAV.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActive(pathname, item.href)} collapsed={collapsed} count={counts[item.href]} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>

        {!collapsed && <GroupLabel className="mt-6">Coming soon</GroupLabel>}
        {collapsed && <div className="mx-3 my-4 h-px bg-border" />}
        <ul className="space-y-0.5">
          {PRO_NAV.map((item) => (
            <li key={item.label}>
              <NavLink item={item} collapsed={collapsed} onClick={onPro} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-2 px-3 pb-3">
        {!collapsed && (
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4">
            <div className="grid size-9 place-items-center rounded-xl border border-white/10 bg-black/30">
              <Sparkles className="size-4 text-ink" />
            </div>
            <p className="mt-3 text-[14px] font-semibold">Coming next</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
              Pay by M-Pesa, Airtel Money or Mixx by Yas.
            </p>
            <button
              type="button"
              onClick={onPro}
              className="press mt-3 h-9 w-full rounded-[10px] border border-white/10 bg-white/[0.06] text-[13px] font-semibold hover:bg-white/10"
            >
              See what&apos;s coming
            </button>
          </div>
        )}
        <NavLink item={SETTINGS_NAV} active={isActive(pathname, SETTINGS_NAV.href)} collapsed={collapsed} onNavigate={onNavigate} />
        <SignOutButton email={email} collapsed={collapsed} />
        {onToggle && collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="press mx-auto grid size-10 place-items-center rounded-lg text-faint hover:bg-white/5 hover:text-foreground"
            aria-label="Expand sidebar"
          >
            <ChevronsRight className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}

const ROLE_NAME = { owner: "Owner", admin: "Admin", member: "Member" } as const

function SignOutButton({ email, collapsed }: { email: string; collapsed: boolean }) {
  const btn = (
    <button
      type="button"
      onClick={() => void signOut()}
      className={cn(
        "press group flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-[13px] text-faint transition-[background-color,color] duration-150 hover:bg-white/[0.04] hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
      aria-label={`Sign out ${email}`}
    >
      <LogOut className="size-[18px] shrink-0" />
      {!collapsed && <span className="min-w-0 truncate">Sign out · {email}</span>}
    </button>
  )
  if (!collapsed) return btn
  return (
    <Tooltip>
      <TooltipTrigger render={btn} />
      <TooltipContent side="right">Sign out</TooltipContent>
    </Tooltip>
  )
}

function GroupLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("mb-1.5 px-3 text-[12px] font-medium text-faint", className)}>{children}</p>
}

function NavLink({
  item,
  active,
  collapsed,
  count,
  onNavigate,
  onClick,
}: {
  item: NavItem
  active?: boolean
  collapsed: boolean
  count?: number
  onNavigate?: () => void
  onClick?: () => void
}) {
  const Icon = item.icon
  const cls = cn(
    "group relative flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium",
    "transition-[background-color,color] duration-150",
    active
      ? "bg-white/[0.07] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
      : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
    item.soon && "text-faint",
    collapsed && "justify-center px-0",
  )
  const inner = (
    <>
      <Icon className={cn("size-[18px] shrink-0", active ? "text-foreground" : "text-faint group-hover:text-muted-foreground")} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && item.soon && (
        <span className="ml-auto rounded-md border border-white/[0.08] px-1.5 py-px text-[11px] font-semibold text-faint">Soon</span>
      )}
      {!collapsed && count !== undefined && count > 0 && (
        <span className="tnum ml-auto min-w-6 rounded-md bg-white/[0.06] px-1.5 py-px text-center text-[11.5px] font-semibold text-muted-foreground">
          {count}
        </span>
      )}
    </>
  )
  const el = item.soon ? (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <Link href={item.href} className={cls} onClick={onNavigate} aria-current={active ? "page" : undefined}>
      {inner}
    </Link>
  )
  if (!collapsed) return el
  return (
    <Tooltip>
      <TooltipTrigger render={el} />
      <TooltipContent side="right">{item.label}{item.soon ? " · soon" : ""}</TooltipContent>
    </Tooltip>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "E") + (parts[1]?.[0] ?? "")).toUpperCase()
}
