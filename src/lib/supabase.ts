import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigured = Boolean(url && key)

/**
 * Browser client. All access is guarded by row-level security in
 * supabase/migrations, so the publishable key is safe to ship.
 * PKCE: the magic link returns ?code=…, exchanged on load.
 */
export const supabase = createClient(url || "http://localhost:54321", key || "not-configured", {
  auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Turn database / network errors into one plain sentence for a toast. */
export function friendlyError(e: unknown): string {
  const msg = typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e)
  if (msg.includes("approval_required")) return "This stamp needs a manager's approval for this file. Request it under Approvals."
  if (msg.includes("admins_only")) return "Only admins can do that."
  if (msg.includes("not_pending")) return "That request has already been decided."
  if (/row-level security|permission denied/i.test(msg)) return "You don't have permission to do that."
  if (/failed to fetch|network|load failed/i.test(msg)) return "Can't reach eStamp. Check your internet connection and try again."
  return msg || "Something went wrong. Try again."
}
