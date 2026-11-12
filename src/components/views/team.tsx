"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Panel } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Segmented } from "@/components/designer/segmented"
import { inviteMember, isAdmin, removeMember, revokeInvite, setMemberRole, useAppState } from "@/lib/store"
import type { Role } from "@/lib/types"

const ROLE_OPTIONS: { value: Exclude<Role, "owner">; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
]

/** Settings → Team: who's in the organisation, and who's invited. */
export function TeamPanel() {
  const admin = useAppState(isAdmin)
  const me = useAppState((s) => s.user?.id)
  const members = useAppState((s) => s.members)
  const invites = useAppState((s) => s.invites)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Exclude<Role, "owner">>("member")
  const [confirm, setConfirm] = useState<string | null>(null)

  function invite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    void inviteMember(email, role)
    setEmail("")
  }

  return (
    <Panel className="mt-10">
      <div className="p-5 pb-4 sm:p-6 sm:pb-4">
        <h2 className="text-[15px] font-semibold">Team</h2>
        <p className="mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-muted-foreground">
          Admins design stamps, approve requests and manage the team. Members stamp documents and keep the mail register.
        </p>
      </div>
      <ul className="divide-y divide-white/[0.05] border-t border-white/[0.05]">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">
                {m.name || m.email}
                {m.userId === me && <span className="font-normal text-faint"> (you)</span>}
              </p>
              {m.name && <p className="truncate text-[12.5px] text-faint">{m.email}</p>}
            </div>
            {m.role === "owner" || !admin || m.userId === me ? (
              <span className="text-[13px] text-muted-foreground capitalize">{m.role}</span>
            ) : (
              <div className="flex items-center gap-2">
                <Segmented label={`Role for ${m.email}`} value={m.role} onChange={(r) => void setMemberRole(m.userId, r)} options={ROLE_OPTIONS} className="w-[180px]" />
                <Button
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    if (confirm !== m.userId) return setConfirm(m.userId)
                    setConfirm(null)
                    void removeMember(m.userId)
                  }}
                  onBlur={() => setConfirm(null)}
                >
                  {confirm === m.userId ? "Confirm remove" : "Remove"}
                </Button>
              </div>
            )}
          </li>
        ))}
        {invites.map((i) => (
          <li key={i.email} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">{i.email}</p>
              <p className="text-[12.5px] text-faint">Invited as {i.role} · joins when they sign in with this email</p>
            </div>
            <button
              type="button"
              onClick={() => void revokeInvite(i.email)}
              className="press grid size-9 shrink-0 place-items-center rounded-lg text-faint hover:bg-white/5 hover:text-foreground"
              aria-label={`Cancel invite for ${i.email}`}
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      {admin && (
        <form onSubmit={invite} className="flex flex-col gap-2 border-t border-white/[0.05] p-5 sm:flex-row sm:items-center sm:p-6">
          <label htmlFor="tm-email" className="sr-only">
            Email to invite
          </label>
          <Input
            id="tm-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.co.tz"
            autoComplete="off"
            className="sm:flex-1"
          />
          <Segmented label="Role for the invite" value={role} onChange={setRole} options={ROLE_OPTIONS} className="sm:w-[180px]" />
          <Button type="submit" disabled={!email.trim()}>
            Invite
          </Button>
        </form>
      )}
    </Panel>
  )
}
