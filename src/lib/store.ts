"use client"

import { useSyncExternalStore } from "react"
import { nanoid } from "nanoid"
import { toast } from "sonner"
import type { User } from "@supabase/supabase-js"
import { friendlyError, supabase, supabaseConfigured } from "./supabase"
import type {
  ApiKey,
  Approval,
  ApprovalStatus,
  DocKind,
  Invite,
  Member,
  RegisterEntry,
  Role,
  Settings,
  StampDesign,
  StampedDoc,
} from "./types"
import { sha256Hex, verifyUrlFor } from "./verify"
import { startOfWeek } from "./format"

type State = {
  /** Session checked and, when signed in, organisation data loaded. */
  ready: boolean
  user: { id: string; email: string } | null
  orgId: string | null
  role: Role
  loadError: string | null
  stamps: StampDesign[]
  docs: StampedDoc[]
  settings: Settings
  members: Member[]
  invites: Invite[]
  register: RegisterEntry[]
  approvals: Approval[]
  apiKeys: ApiKey[]
  /** Counted in the database: docs holds only the newest records. */
  stats: OrgStats
  plan: { id: string; until?: number }
}

export type OrgStats = { total: number; week: number; pages: number; team: { userId: string; count: number }[] }

const DEFAULT_SETTINGS: Settings = {
  orgName: "Your Company Ltd",
  subText: "Dar es Salaam",
  stampedBy: "",
  refPrefix: "ES",
  refCounter: 0,
  onboarded: false,
}

const EMPTY: Omit<State, "ready" | "user"> = {
  orgId: null,
  role: "member",
  loadError: null,
  stamps: [],
  docs: [],
  settings: DEFAULT_SETTINGS,
  members: [],
  invites: [],
  register: [],
  approvals: [],
  apiKeys: [],
  stats: { total: 0, week: 0, pages: 0, team: [] },
  plan: { id: "free" },
}

export function makeStamp(partial: Partial<StampDesign> = {}): StampDesign {
  const now = Date.now()
  return {
    id: nanoid(10),
    name: "New stamp",
    shape: "round",
    orgName: DEFAULT_SETTINGS.orgName,
    subText: DEFAULT_SETTINGS.subText,
    label: "RECEIVED",
    ink: "blue",
    showDate: true,
    showRef: false,
    showQR: true,
    showSignature: false,
    texture: true,
    sizeMm: 40,
    createdAt: now,
    updatedAt: now,
    uses: 0,
    ...partial,
  }
}

function starterStamps(s: Settings): StampDesign[] {
  const base = { orgName: s.orgName, subText: s.subText }
  const t = Date.now()
  return [
    makeStamp({ ...base, name: "Received", label: "RECEIVED", ink: "blue", shape: "round", register: true, createdAt: t - 4 }),
    makeStamp({ ...base, name: "Approved", label: "APPROVED", ink: "green", shape: "rect", showSignature: true, showRef: true, createdAt: t - 3 }),
    makeStamp({ ...base, name: "Paid", label: "PAID", ink: "red", shape: "rect", showRef: true, createdAt: t - 2 }),
    makeStamp({ ...base, name: "Company seal", label: "OFFICIAL", ink: "purple", shape: "oval", showDate: false, requiresApproval: true, createdAt: t - 1 }),
  ]
}

let state: State = { ready: false, user: null, ...EMPTY }
const SERVER_STATE = state
const listeners = new Set<() => void>()
let loading: Promise<void> | null = null

function emit() {
  listeners.forEach((l) => l())
}

function setState(patch: Partial<State>) {
  state = { ...state, ...patch }
  emit()
}

export function useAppState<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(SERVER_STATE),
  )
}

export function getState() {
  return state
}

export function isAdmin(s: Pick<State, "role"> = state) {
  return s.role === "owner" || s.role === "admin"
}

/* ---------- row mapping ---------- */

type Row = Record<string, unknown>
const t = (v: unknown) => (v ? Date.parse(String(v)) : undefined)

function stampFromRow(r: Row): StampDesign {
  return {
    ...makeStamp(),
    ...(r.design as Partial<StampDesign>),
    id: String(r.id),
    uses: Number(r.uses),
    createdAt: t(r.created_at)!,
    updatedAt: t(r.updated_at)!,
  }
}

function stampDesign(s: StampDesign) {
  // id, uses and timestamps live in their own columns.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, uses, createdAt, updatedAt, ...design } = s
  return design
}

const DOC_COLUMNS =
  "id,ref,labels,stamped_by,stamp_names,ink,file_name,kind,pages,size_bytes,original_hash,stamped_at,output_name,output_kind,output_bytes,output_hash,output_path,thumb,revoked_at,revoke_reason"

function docFromRow(r: Row): StampedDoc {
  const kind = r.kind as DocKind
  return {
    id: String(r.id),
    fileName: String(r.file_name),
    outputName: String(r.output_name ?? r.file_name),
    kind,
    outputKind: (r.output_kind as StampedDoc["outputKind"]) ?? (kind === "docx" ? "docx" : "pdf"),
    pages: Number(r.pages),
    stampNames: (r.stamp_names as string[]) ?? [],
    ink: r.ink as StampedDoc["ink"],
    ref: String(r.ref),
    stampedAt: t(r.stamped_at)!,
    sizeBytes: Number(r.size_bytes),
    outputBytes: Number(r.output_bytes ?? 0),
    originalHash: String(r.original_hash),
    verifyUrl: verifyUrlFor(String(r.id)),
    thumb: (r.thumb as string) ?? undefined,
    labels: String(r.labels ?? ""),
    stampedBy: String(r.stamped_by ?? ""),
    outputHash: (r.output_hash as string) ?? undefined,
    outputPath: (r.output_path as string) ?? undefined,
    revokedAt: t(r.revoked_at),
    revokeReason: String(r.revoke_reason ?? ""),
  }
}

function registerFromRow(r: Row): RegisterEntry {
  return {
    id: String(r.id),
    regNo: String(r.reg_no),
    receivedAt: t(r.received_at)!,
    sender: String(r.sender ?? ""),
    subject: String(r.subject ?? ""),
    notes: String(r.notes ?? ""),
    documentId: (r.document_id as string) ?? undefined,
    receivedByName: String(r.received_by_name ?? ""),
  }
}

function approvalFromRow(r: Row): Approval {
  return {
    id: String(r.id),
    stampId: String(r.stamp_id),
    requestedBy: String(r.requested_by),
    requesterName: String(r.requester_name ?? ""),
    fileName: String(r.file_name),
    originalHash: String(r.original_hash),
    filePath: (r.file_path as string) ?? undefined,
    sizeBytes: Number(r.size_bytes ?? 0),
    note: String(r.note ?? ""),
    status: r.status as ApprovalStatus,
    deciderName: String(r.decider_name ?? ""),
    decidedAt: t(r.decided_at),
    decisionNote: String(r.decision_note ?? ""),
    createdAt: t(r.created_at)!,
  }
}

/* ---------- loading ---------- */

async function q<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await p
  if (error) throw error
  return data
}

// One load per user at a time: sign-in fires SIGNED_IN while the first load is still running.
let hydrating: { id: string; p: Promise<void> } | null = null

function hydrate(user: User) {
  if (hydrating?.id !== user.id) {
    const p = loadOrg(user).finally(() => {
      if (hydrating?.p === p) hydrating = null
    })
    hydrating = { id: user.id, p }
  }
  return hydrating.p
}

async function loadOrg(user: User) {
  const me = { id: user.id, email: user.email ?? "" }
  try {
    const orgId = await q(supabase.rpc("bootstrap"))
    // shortcut: newest 60 documents (thumbnails are ~30 KB each) / 500 register entries; add paging when an org outgrows that.
    const [org, members, stamps, docs, register, approvals, stats] = await Promise.all([
      q(supabase.from("orgs").select("*").eq("id", orgId).single()),
      q(supabase.from("members").select("*").order("created_at")),
      q(supabase.from("stamps").select("*").order("created_at", { ascending: false })),
      q(supabase.from("documents").select(DOC_COLUMNS).order("stamped_at", { ascending: false }).limit(60)),
      q(supabase.from("register_entries").select("*").order("received_at", { ascending: false }).limit(500)),
      q(supabase.from("approvals").select("*").order("created_at", { ascending: false }).limit(200)),
      fetchStats(),
    ])
    const mine = (members as Row[]).find((m) => m.user_id === me.id)
    const role = (mine?.role as Role) ?? "member"
    const settings: Settings = {
      orgName: String(org.name),
      subText: String(org.sub_text),
      refPrefix: String(org.ref_prefix),
      refCounter: Number(org.ref_counter),
      onboarded: Boolean(org.onboarded),
      stampedBy: String(mine?.display_name ?? ""),
    }
    let stampList = (stamps as Row[]).map(stampFromRow)
    if (!stampList.length && !settings.onboarded && (role === "owner" || role === "admin")) {
      stampList = starterStamps(settings)
      await q(supabase.from("stamps").insert(stampList.map((s) => ({ id: s.id, design: stampDesign(s) }))))
    }
    const [invites, keys] =
      role === "member"
        ? [[], []]
        : await Promise.all([
            q(supabase.from("invites").select("*").order("created_at")),
            q(supabase.from("api_keys").select("id,name,prefix,created_at,last_used_at,revoked_at").order("created_at", { ascending: false })),
          ])
    setState({
      ready: true,
      user: me,
      orgId: String(orgId),
      role,
      loadError: null,
      settings,
      stamps: stampList,
      docs: (docs as Row[]).map(docFromRow),
      register: (register as Row[]).map(registerFromRow),
      approvals: (approvals as Row[]).map(approvalFromRow),
      stats,
      plan: { id: String(org.plan ?? "free"), until: t(org.plan_until) },
      members: (members as Row[]).map((m) => ({
        userId: String(m.user_id),
        role: m.role as Role,
        name: String(m.display_name ?? ""),
        email: String(m.email ?? ""),
        createdAt: t(m.created_at)!,
      })),
      invites: (invites as Row[]).map((i) => ({ email: String(i.email), role: i.role as Role, createdAt: t(i.created_at)! })),
      apiKeys: (keys as Row[]).map((k) => ({
        id: String(k.id),
        name: String(k.name),
        prefix: String(k.prefix),
        createdAt: t(k.created_at)!,
        lastUsedAt: t(k.last_used_at),
        revokedAt: t(k.revoked_at),
      })),
    })
  } catch (e) {
    setState({ ready: true, user: me, loadError: friendlyError(e) })
  }
}

async function load() {
  if (!supabaseConfigured) {
    setState({ ready: true, user: null })
    return
  }
  supabase.auth.onAuthStateChange((event, session) => {
    // Supabase calls made inside this callback can deadlock the auth lock; defer them.
    setTimeout(() => {
      if (event === "SIGNED_OUT" || !session) setState({ ready: true, user: null, ...EMPTY })
      else if (event === "SIGNED_IN" && session.user.id !== state.user?.id) void hydrate(session.user)
    }, 0)
  })
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    const url = new URL(window.location.href)
    if (url.searchParams.has("code")) {
      url.searchParams.delete("code")
      window.history.replaceState(window.history.state, "", url)
    }
    lastRefresh = Date.now()
    await hydrate(data.session.user)
  } else setState({ ready: true, user: null })
}

function subscribe(l: () => void) {
  listeners.add(l)
  if (!loading) loading = load()
  return () => listeners.delete(l)
}

let lastRefresh = 0

/** Reload everything from Supabase (after another user's change, or a failed write). */
export async function refresh() {
  lastRefresh = Date.now()
  const { data } = await supabase.auth.getUser()
  if (data.user) await hydrate(data.user)
}

/** Teammates change things too: reload when the tab comes back into view, at most once a minute. */
export function refreshIfStale() {
  if (state.user && !state.loadError && Date.now() - lastRefresh > 60_000) void refresh()
}

/** Optimistic writes: the UI updates at once; if the server refuses, say why and reload. */
async function write(p: PromiseLike<{ error: unknown }>, success?: string) {
  try {
    const { error } = await p
    if (error) throw error
    if (success) toast.success(success)
  } catch (e) {
    toast.error(friendlyError(e))
    void refresh()
    throw e
  }
}

/* ---------- auth ---------- */

export async function sendSignInEmail(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  })
  if (error) throw new Error(error.message)
}

export async function verifySignInCode(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" })
  if (error) throw new Error(error.message)
}

export async function signOut() {
  await supabase.auth.signOut()
}

/* ---------- stamps ---------- */

export function saveStamp(stamp: StampDesign) {
  const exists = state.stamps.some((s) => s.id === stamp.id)
  const next = { ...stamp, updatedAt: Date.now() }
  setState({
    stamps: exists ? state.stamps.map((s) => (s.id === stamp.id ? next : s)) : [next, ...state.stamps],
  })
  return write(supabase.from("stamps").upsert({ id: next.id, design: stampDesign(next) })).catch(() => {})
}

export function deleteStamp(id: string) {
  setState({ stamps: state.stamps.filter((s) => s.id !== id) })
  return write(supabase.from("stamps").delete().eq("id", id)).catch(() => {})
}

export function duplicateStamp(id: string) {
  const src = state.stamps.find((s) => s.id === id)
  if (!src) return
  const copy = makeStamp({ ...src, id: nanoid(10), name: `${src.name} copy`, uses: 0 })
  void saveStamp(copy)
  return copy
}

/* ---------- stamping (records made by the database, see issue_stamp) ---------- */

export type Issued = {
  id: string
  ref: string
  stamped_at: string
  org_name: string
  labels: string
  stamped_by: string
  register_no: string | null
}

export async function issueStamp(input: {
  stampIds: string[]
  fileName: string
  kind: DocKind
  pages: number
  sizeBytes: number
  originalHash: string
}): Promise<Issued> {
  return q(
    supabase.rpc("issue_stamp", {
      p_stamp_ids: input.stampIds,
      p_file_name: input.fileName.slice(0, 255),
      p_kind: input.kind,
      p_pages: input.pages,
      p_size_bytes: input.sizeBytes,
      p_original_hash: input.originalHash,
    }),
  )
}

export async function discardStamp(id: string) {
  await supabase.rpc("discard_stamp", { p_id: id })
}

/** Upload the stamped file and lock in its fingerprint. Returns what failed, if anything. */
export async function completeStamp(doc: StampedDoc, stampIds: string[], bytes: Uint8Array, mime: string, registered: boolean) {
  const path = `${state.orgId}/${doc.id}/${doc.outputName.replace(/[^\w.\- ]+/g, "_")}`
  const up = await supabase.storage.from("stamped").upload(path, new Blob([bytes as BlobPart], { type: mime }), { contentType: mime })
  const outputPath = up.error ? undefined : path
  const { error } = await supabase.rpc("complete_stamp", {
    p_id: doc.id,
    p_output_name: doc.outputName,
    p_output_kind: doc.outputKind,
    p_output_bytes: doc.outputBytes,
    p_output_hash: doc.outputHash,
    p_output_path: outputPath ?? null,
    p_thumb: doc.thumb ?? null,
  })
  const saved = { ...doc, outputPath, outputHash: error ? undefined : doc.outputHash }
  setState({
    docs: [saved, ...state.docs],
    stamps: state.stamps.map((s) => (stampIds.includes(s.id) ? { ...s, uses: s.uses + 1 } : s)),
    approvals: state.approvals.map((a) =>
      a.status === "approved" && a.originalHash === doc.originalHash ? { ...a, status: "used" } : a,
    ),
  })
  void refreshCounters(registered)
  return { uploaded: !up.error, fingerprinted: !error }
}

async function fetchStats(): Promise<OrgStats> {
  const now = new Date()
  const week = startOfWeek()
  const month = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const r = (await q(
    supabase.rpc("org_stats", { p_week_start: new Date(week).toISOString(), p_month_start: new Date(month).toISOString() }),
  )) as { total: number; week: number; pages: number; team: { user_id: string; count: number }[] }
  return { total: r.total, week: r.week, pages: r.pages, team: r.team.map((m) => ({ userId: m.user_id, count: m.count })) }
}

async function refreshCounters(registered: boolean) {
  const { data } = await supabase.from("orgs").select("ref_counter").eq("id", state.orgId!).single()
  if (data) setState({ settings: { ...state.settings, refCounter: Number(data.ref_counter) } })
  fetchStats().then((stats) => setState({ stats }), () => {})
  if (!registered) return
  const { data: reg } = await supabase.from("register_entries").select("*").order("received_at", { ascending: false }).limit(500)
  if (reg) setState({ register: reg.map(registerFromRow) })
}

/* ---------- documents ---------- */

export async function downloadStored(doc: StampedDoc) {
  if (!doc.outputPath) throw new Error("This file wasn't saved online. Stamp the document again to get a copy.")
  const blob = await q(supabase.storage.from("stamped").download(doc.outputPath))
  if (!blob) throw new Error("File not found")
  return blob
}

export function deleteDoc(id: string) {
  const doc = state.docs.find((d) => d.id === id)
  setState({ docs: state.docs.filter((d) => d.id !== id) })
  return write(supabase.from("documents").delete().eq("id", id))
    .then(() => {
      if (doc?.outputPath) void supabase.storage.from("stamped").remove([doc.outputPath])
    })
    .catch(() => {})
}

export function clearDocs() {
  const paths = state.docs.map((d) => d.outputPath).filter(Boolean) as string[]
  setState({ docs: [] })
  return write(supabase.from("documents").delete().eq("org_id", state.orgId!))
    .then(() => {
      if (paths.length) void supabase.storage.from("stamped").remove(paths)
    })
    .catch(() => {})
}

export function revokeDoc(id: string, reason: string) {
  setState({ docs: state.docs.map((d) => (d.id === id ? { ...d, revokedAt: Date.now(), revokeReason: reason } : d)) })
  return write(supabase.rpc("revoke_stamp", { p_id: id, p_reason: reason }), "Stamp revoked. Its QR code now shows it as revoked.").catch(() => {})
}

/* ---------- settings ---------- */

export function updateSettings(patch: Partial<Settings>) {
  setState({ settings: { ...state.settings, ...patch } })
  const org: Record<string, unknown> = {}
  if (patch.orgName !== undefined) org.name = patch.orgName
  if (patch.subText !== undefined) org.sub_text = patch.subText
  if (patch.refPrefix !== undefined) org.ref_prefix = patch.refPrefix
  if (patch.onboarded !== undefined) org.onboarded = patch.onboarded
  const jobs: PromiseLike<{ error: unknown }>[] = []
  if (Object.keys(org).length && isAdmin()) jobs.push(supabase.from("orgs").update(org).eq("id", state.orgId!))
  if (patch.stampedBy !== undefined) {
    jobs.push(supabase.from("members").update({ display_name: patch.stampedBy }).eq("user_id", state.user!.id))
  }
  return Promise.all(jobs.map((j) => write(j))).catch(() => {})
}

export function peekRef(): string {
  const n = state.settings.refCounter + 1
  const prefix = state.settings.refPrefix.trim() || "ES"
  return `${prefix}-${new Date().getFullYear()}-${String(n).padStart(4, "0")}`
}

/* ---------- mail register ---------- */

export async function addRegisterEntry(entry: { sender: string; subject: string; notes: string }) {
  try {
    const row = await q(
      supabase.rpc("add_register_entry", { p_sender: entry.sender, p_subject: entry.subject, p_notes: entry.notes }),
    )
    const e = registerFromRow(row as Row)
    setState({ register: [e, ...state.register] })
    return e
  } catch (e) {
    toast.error(friendlyError(e))
    return null
  }
}

export function updateRegisterEntry(id: string, patch: Partial<Pick<RegisterEntry, "sender" | "subject" | "notes">>) {
  setState({ register: state.register.map((r) => (r.id === id ? { ...r, ...patch } : r)) })
  return write(supabase.from("register_entries").update(patch).eq("id", id)).catch(() => {})
}

export function deleteRegisterEntry(id: string) {
  setState({ register: state.register.filter((r) => r.id !== id) })
  return write(supabase.from("register_entries").delete().eq("id", id)).catch(() => {})
}

/* ---------- approvals ---------- */

export async function requestApproval(stampId: string, file: File, note: string) {
  const id = crypto.randomUUID()
  const originalHash = await sha256Hex(await file.arrayBuffer())
  const path = `${state.orgId}/${id}/${file.name.replace(/[^\w.\- ]+/g, "_")}`
  try {
    await q(supabase.storage.from("approvals").upload(path, file, { contentType: file.type || undefined }))
    await q(
      supabase.from("approvals").insert({
        id,
        stamp_id: stampId,
        file_name: file.name.slice(0, 255),
        original_hash: originalHash,
        file_path: path,
        size_bytes: file.size,
        note,
      }),
    )
  } catch (e) {
    void supabase.storage.from("approvals").remove([path])
    toast.error(friendlyError(e))
    return false
  }
  void notify({ type: "approval_requested", id })
  await refresh()
  return true
}

export function decideApproval(id: string, approve: boolean, note: string) {
  setState({
    approvals: state.approvals.map((a) =>
      a.id === id ? { ...a, status: approve ? "approved" : "rejected", decidedAt: Date.now(), decisionNote: note } : a,
    ),
  })
  return write(
    supabase.rpc("decide_approval", { p_id: id, p_approve: approve, p_note: note }),
    approve ? "Approved. They can stamp the document now." : "Request rejected",
  )
    .then(() => void notify({ type: "approval_decided", id }))
    .catch(() => {})
}

export function cancelApproval(a: Approval) {
  setState({ approvals: state.approvals.filter((x) => x.id !== a.id) })
  return write(supabase.from("approvals").delete().eq("id", a.id))
    .then(() => {
      if (a.filePath) void supabase.storage.from("approvals").remove([a.filePath])
    })
    .catch(() => {})
}

export async function downloadApprovalFile(a: Approval) {
  if (!a.filePath) throw new Error("No file attached")
  const blob = await q(supabase.storage.from("approvals").download(a.filePath))
  if (!blob) throw new Error("File not found")
  return blob
}

/* ---------- team ---------- */

export function inviteMember(email: string, role: Role) {
  const e = email.trim().toLowerCase()
  setState({ invites: [...state.invites.filter((i) => i.email !== e), { email: e, role, createdAt: Date.now() }] })
  return write(supabase.from("invites").upsert({ org_id: state.orgId, email: e, role }))
    .then(async () => {
      if (await notify({ type: "invite", email: e })) toast.success(`Invite emailed to ${e}`)
      else toast.success(`Invite saved for ${e}`, { description: "The email didn't send. Ask them to sign in with this address." })
    })
    .catch(() => {})
}

export function revokeInvite(email: string) {
  setState({ invites: state.invites.filter((i) => i.email !== email) })
  return write(supabase.from("invites").delete().eq("email", email)).catch(() => {})
}

export function setMemberRole(userId: string, role: Role) {
  setState({ members: state.members.map((m) => (m.userId === userId ? { ...m, role } : m)) })
  return write(supabase.rpc("set_member_role", { p_user: userId, p_role: role })).catch(() => {})
}

export function removeMember(userId: string) {
  setState({ members: state.members.filter((m) => m.userId !== userId) })
  return write(supabase.rpc("remove_member", { p_user: userId }), "Removed from your organisation").catch(() => {})
}

/* ---------- email notifications (server: /api/notify) ---------- */

type Notice = { type: "invite"; email: string } | { type: "approval_requested" | "approval_decided"; id: string }

/** Ask the server to email the people concerned. Returns how many emails went out (0 on any failure). */
async function notify(n: Notice): Promise<number> {
  try {
    const { data } = await supabase.auth.getSession()
    const res = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify(n),
    })
    if (!res.ok) return 0
    return Number(((await res.json()) as { sent?: number }).sent ?? 0)
  } catch {
    return 0
  }
}

/* ---------- billing ---------- */

/** Start a mobile-money payment (server: /api/billing/checkout). Returns an error message, or null. */
export async function startCheckout(plan: string, phone: string): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  try {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ plan, phone }),
    })
    if (res.ok) return null
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    return body?.error?.message ?? "Couldn't start the payment. Try again."
  } catch (e) {
    return friendlyError(e)
  }
}

/* ---------- API keys ---------- */

/** Create a key; returns the full key, which is never shown again (only its hash is stored). */
export async function createApiKey(name: string) {
  const raw = crypto.getRandomValues(new Uint8Array(32))
  const key = "es_live_" + btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  const keyHash = await sha256Hex(new TextEncoder().encode(key).buffer as ArrayBuffer)
  const prefix = key.slice(0, 16)
  try {
    const row = await q(supabase.from("api_keys").insert({ name, prefix, key_hash: keyHash }).select("id,created_at").single())
    if (!row) throw new Error("The key wasn't saved. Try again.")
    setState({ apiKeys: [{ id: String(row.id), name, prefix, createdAt: t(row.created_at)! }, ...state.apiKeys] })
    return key
  } catch (e) {
    toast.error(friendlyError(e))
    return null
  }
}

export function revokeApiKey(id: string) {
  const at = new Date()
  setState({ apiKeys: state.apiKeys.map((k) => (k.id === id ? { ...k, revokedAt: at.getTime() } : k)) })
  return write(supabase.from("api_keys").update({ revoked_at: at.toISOString() }).eq("id", id), "Key revoked. Calls using it now fail.").catch(() => {})
}

/* ---------- hand-off of a dropped file between routes ---------- */

let pendingFile: File | null = null
export function setPendingFile(f: File | null) {
  pendingFile = f
}
export function takePendingFile() {
  const f = pendingFile
  pendingFile = null
  return f
}
