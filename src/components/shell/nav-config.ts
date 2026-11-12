import {
  ClipboardCheck,
  FolderClosed,
  Inbox,
  LayoutGrid,
  Layers,
  Smartphone,
  type LucideIcon,
  Settings,
  ShieldCheck,
  Stamp,
  FileStack,
} from "lucide-react"

export type NavItem = { href: string; label: string; icon: LucideIcon; soon?: boolean }

export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/stamp", label: "Stamp a document", icon: Stamp },
  { href: "/bulk", label: "Bulk stamping", icon: Layers },
  { href: "/stamps", label: "Stamp library", icon: FolderClosed },
  { href: "/documents", label: "Stamped documents", icon: FileStack },
  { href: "/register", label: "Mail register", icon: Inbox },
  { href: "/approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/verify", label: "Verify a stamp", icon: ShieldCheck },
]

export const PRO_NAV: NavItem[] = [{ href: "#", label: "Mobile-money billing", icon: Smartphone, soon: true }]

export const SETTINGS_NAV: NavItem = { href: "/settings", label: "Settings", icon: Settings }

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(href + "/")
}
