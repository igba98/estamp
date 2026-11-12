# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (latest, App Router), TypeScript, Tailwind CSS v4, shadcn/ui, Framer Motion (`motion` package), Urbanist font. Chosen by the owner (Ignas Bangi).

## Users

Staff in any office (reception, admin, finance, management) in Tanzania and East Africa who today stamp paper with a rubber stamp and ink pad, then scan it to send. Their job: put the right official stamp (Received, Approved, Paid, company seal) on a document quickly and send it on.

## Product Purpose

eStamp generates electronic stamps and applies them to PDF, DOCX and image documents, replacing print → stamp → scan. Success: a user designs their stamp once, then stamps a document in under a minute and downloads a ready-to-send file.

## Positioning

A stamp tool built around how East African offices actually stamp (Received / Approved / Paid / Certified true copy / company seals), with a QR code on every stamp that opens a verification page.

## Operating Context

Daily office work on laptops, sometimes phones. Documents arrive as PDF, Word (DOCX) or photographed/scanned images. Stamped files are emailed or sent over WhatsApp.

## Capabilities and Constraints

- Accounts (email link or code via Supabase Auth), one organisation per user, roles owner / admin / member. Stamps, records, the mail register, approvals and the stamped output files are stored in Supabase. Original files stay on the device; only their SHA-256 fingerprint is stored (approval requests upload the file so an admin can review it).
- Stamp designer: round, oval and rectangle shapes; organisation name, centre label, date, reference number, optional QR code; ink colours.
- Stamping: PDF and images (exported as PDF) on any page; DOCX gets a floating stamp image on the first or last page and stays DOCX.
- Verification: the QR opens /v?id=<record id>; the page checks the record in the database (revoked or not) and can confirm a received file is the exact issued copy. Older QR links (/v?d=…) still decode.
- Mail register: stamps marked "Log in mail register" add numbered entries (IN/2026/0001); paper mail can be added by hand; CSV export.
- Team approvals: stamps marked "Needs approval" require an admin to approve each file before a member can stamp it.
- Coming later: bulk stamping, API, mobile-money billing.
- English interface only for now.

## Brand Commitments

- Name: eStamp.
- Font: Urbanist.
- Look and feel pinned by the owner from reference shots: dark, near-black app UI with a left icon rail + navigation sidebar, soft dark cards, folder-style tiles, file lists with detail panels, a muted "Upgrade" card in the sidebar.
- Never use decorative short accent bars/dashes before headings, eyebrows or labels.

## Evidence on Hand

No customers, testimonials or usage numbers exist. Do not invent any. Dashboard figures come only from the user's own local data.

## Product Principles

1. Stamp in under a minute: the common path (pick stamp, drop file, place, download) is always one screen.
2. Files stay on the device in the free version, and the UI says so plainly.
3. Every stamp should be checkable: QR verification is on by default.
4. Honest tiers: free features work fully; paid features are labelled "coming soon", never faked.
