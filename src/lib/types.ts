export type StampShape = "round" | "oval" | "rect"
export type InkKey = "blue" | "red" | "green" | "purple" | "black"

export type StampDesign = {
  id: string
  name: string
  shape: StampShape
  /** Text running around the top edge (round/oval) or across the top (rect). */
  orgName: string
  /** Text around the bottom edge, e.g. the town. */
  subText: string
  /** Big centre word: RECEIVED, APPROVED, PAID… */
  label: string
  ink: InkKey
  showDate: boolean
  showRef: boolean
  showQR: boolean
  showSignature: boolean
  /** Rubber-stamp grain on the ink. */
  texture: boolean
  /** Physical width of the seal in millimetres. */
  sizeMm: number
  /** Each use adds a numbered entry to the mail register. */
  register?: boolean
  /** Members need an admin's approval, per file, before using it. */
  requiresApproval?: boolean
  createdAt: number
  updatedAt: number
  uses: number
}

export type DocKind = "pdf" | "docx" | "image"

export type StampedDoc = {
  id: string
  fileName: string
  outputName: string
  kind: DocKind
  outputKind: "pdf" | "docx" | "png"
  pages: number
  stampNames: string[]
  ink: InkKey
  ref: string
  stampedAt: number
  sizeBytes: number
  outputBytes: number
  originalHash: string
  verifyUrl: string
  /** Small JPEG data URL of the first stamped page. */
  thumb?: string
  labels?: string
  stampedBy?: string
  /** SHA-256 of the stamped file, checked by the verify page. */
  outputHash?: string
  /** Stamped file in Supabase Storage ("stamped" bucket). */
  outputPath?: string
  revokedAt?: number
  revokeReason?: string
}

export type Settings = {
  orgName: string
  subText: string
  stampedBy: string
  refPrefix: string
  refCounter: number
  onboarded: boolean
}

export type Role = "owner" | "admin" | "member"

export type Member = {
  userId: string
  role: Role
  name: string
  email: string
  createdAt: number
}

export type ApiKey = {
  id: string
  name: string
  /** First characters of the key, to recognise it. The full key is shown once. */
  prefix: string
  createdAt: number
  lastUsedAt?: number
  revokedAt?: number
}

export type Invite = { email: string; role: Role; createdAt: number }

export type RegisterEntry = {
  id: string
  regNo: string
  receivedAt: number
  sender: string
  subject: string
  notes: string
  documentId?: string
  receivedByName: string
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "used"

export type Approval = {
  id: string
  stampId: string
  requestedBy: string
  requesterName: string
  fileName: string
  originalHash: string
  filePath?: string
  sizeBytes: number
  note: string
  status: ApprovalStatus
  deciderName: string
  decidedAt?: number
  decisionNote: string
  createdAt: number
}

export const INKS: Record<InkKey, { name: string; hex: string }> = {
  blue: { name: "Blue", hex: "#1F47C9" },
  red: { name: "Red", hex: "#C42222" },
  green: { name: "Green", hex: "#147A43" },
  purple: { name: "Purple", hex: "#5B33B8" },
  black: { name: "Black", hex: "#1C1C1E" },
}
