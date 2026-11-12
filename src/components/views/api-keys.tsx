"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Copy, KeyRound } from "lucide-react"
import { Panel } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createApiKey, isAdmin, revokeApiKey, useAppState } from "@/lib/store"
import { formatDate, timeAgo } from "@/lib/format"

/** Settings → API keys (admins). Keys let your own systems read stamps and the register. */
export function ApiKeysPanel() {
  const admin = useAppState(isAdmin)
  const keys = useAppState((s) => s.apiKeys)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  if (!admin) return null

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const key = await createApiKey(name.trim())
    setBusy(false)
    if (key) {
      setName("")
      setCreated(key)
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : ""

  return (
    <Panel className="mt-6">
      <div className="p-5 pb-4 sm:p-6 sm:pb-4">
        <h2 className="text-[15px] font-semibold">API keys</h2>
        <p className="mt-1 max-w-[62ch] text-[13.5px] leading-relaxed text-muted-foreground">
          Let your accounting or document system look up stamps, check files and add mail to the register. Keep keys on your server; anyone with a key can read your organisation&apos;s stamp records.
        </p>
      </div>
      {keys.length > 0 && (
        <ul className="divide-y divide-white/[0.05] border-t border-white/[0.05]">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">
                  {k.name} {k.revokedAt && <span className="font-normal text-destructive">· revoked</span>}
                </p>
                <p className="truncate text-[12.5px] text-faint">
                  <span className="font-mono">{k.prefix}…</span> · created {formatDate(k.createdAt)} ·{" "}
                  {k.lastUsedAt ? `last used ${timeAgo(k.lastUsedAt)}` : "never used"}
                </p>
              </div>
              {!k.revokedAt && (
                <Button
                  variant="ghost"
                  className="self-start text-destructive hover:bg-destructive/10 hover:text-destructive sm:self-auto"
                  onClick={() => {
                    if (confirm !== k.id) return setConfirm(k.id)
                    setConfirm(null)
                    void revokeApiKey(k.id)
                  }}
                  onBlur={() => setConfirm(null)}
                >
                  {confirm === k.id ? "Confirm revoke" : "Revoke"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={create} className="flex flex-col gap-2 border-t border-white/[0.05] p-5 sm:flex-row sm:p-6">
        <label htmlFor="ak-name" className="sr-only">
          Key name
        </label>
        <Input id="ak-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Name, e.g. Accounting system" autoComplete="off" className="sm:flex-1" />
        <Button type="submit" disabled={busy || !name.trim()}>
          <KeyRound /> {busy ? "Creating…" : "Create key"}
        </Button>
      </form>
      <p className="border-t border-white/[0.05] px-5 py-4 text-[12.5px] leading-relaxed text-faint sm:px-6">
        Endpoints: <span className="font-mono">GET /api/v1/stamps</span>, <span className="font-mono">GET /api/v1/stamps/&#123;id or reference&#125;</span>,{" "}
        <span className="font-mono">POST /api/v1/verify</span>, <span className="font-mono">GET|POST /api/v1/register</span>. Details are in the README.
      </p>

      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Copy your API key now</DialogTitle>
            <DialogDescription>For your security it won&apos;t be shown again. If you lose it, revoke it and create a new one.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/30 p-3">
            <code className="block font-mono text-[12.5px] break-all select-all">{created}</code>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
            {`curl ${origin}/api/v1/stamps \\\n  -H "Authorization: Bearer ${created?.slice(0, 16)}…"`}
          </pre>
          <DialogFooter className="mt-5 gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(created ?? "")
                  toast.success("API key copied")
                } catch {
                  toast.error("Couldn't copy. Select the key and copy it by hand.")
                }
              }}
            >
              <Copy /> Copy key
            </Button>
            <Button onClick={() => setCreated(null)}>I&apos;ve saved it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  )
}
