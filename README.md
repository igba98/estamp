# eStamp

Create electronic stamps and put them on PDF, Word (.docx) and image files. Stamping runs in the browser. Accounts, stamps, issued-stamp records, the mail register, approvals and the stamped files live in Supabase. Original files never leave the device: only their SHA-256 fingerprint is stored.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) · Motion · Urbanist · Supabase (Auth, Postgres, Storage) · pdf-lib · pdf.js · docx-preview · JSZip · qrcode

## Set up Supabase (once per project)

1. **Keys.** Copy `.env.example` to `.env.local` and fill in the project URL, the publishable key and the secret key from *Project Settings → API*. The secret key is server-only (API and billing routes); never give it a `NEXT_PUBLIC_` prefix.
2. **Database.** Apply every file in `supabase/migrations/` in order (`supabase db push`, or paste each into the *SQL Editor*). They create the tables, access rules (row-level security), functions, and the two private Storage buckets (`stamped`, `approvals`).
3. **Auth → URL Configuration.** Set *Site URL* to your production domain. Add `http://localhost:3000/**` and your domain with `/**` to *Redirect URLs*. The sign-in link returns to the page you signed in from.
4. **Auth → Email Templates → Magic Link and Confirm signup** (needs custom SMTP on the free plan). Add the code so people can type it when the link opens in another browser (common with phone mail apps):
   ```html
   <p>Your eStamp sign-in code: <strong>{{ .Token }}</strong></p>
   <p><a href="{{ .ConfirmationURL }}">Or tap here to sign in</a></p>
   ```
5. **Auth → Providers.** Keep *Email* on. Leave the other providers off: invites trust the email address on the account.
6. **Email (Resend).** The domain `workwithignas.com` is verified in Resend and every email goes out from `estamp@workwithignas.com` (the estamp inbox). Fill the Resend values in `.env.local` (see `.env.example`; they're validated at boot by `src/lib/server/env.ts`). For sign-in emails, point Supabase *Auth → SMTP* at Resend: host `smtp.resend.com`, port `465`, user `resend`, password = the Resend API key, sender `estamp@workwithignas.com`, name `eStamp`.
7. **Receiving.** In Resend → Webhooks, add `https://<your domain>/api/webhooks/resend` with the event `inbox.email.received`, and put its signing secret in `RESEND_WEBHOOK_SECRET`.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # unit tests + database access-rule tests (needs Docker)
npm run test:remote  # end-to-end against the project in .env.local (+ the API if the dev server runs on :3001)
npm run build && npm start
npm run email             # preview every email template at http://localhost:3030
npm run email:assets      # rebuild public/email/*.png (logo + icons) after changing colours
npm run email:send-tests  # send every template (realistic + worst case) to EMAIL_ADMIN_NOTIFY
```

Needs a Node server for `/api/*`, so deploy to Vercel (or any Node host), not a static host. Add the Supabase and email variables from `.env.example` there. Deploy before printing real stamps: the QR points at `<your domain>/v?id=…`.

## Features

| Area | Route | Notes |
| --- | --- | --- |
| Sign in | any app page | Email link or 6-digit code. The first sign-in creates an organisation (you're the owner), unless an admin invited your email |
| Dashboard | `/` | Organisation setup, drop zone, quick-stamp folders, recent documents |
| Stamp a document | `/stamp` | PDF, images (PDF or PNG), DOCX. Each stamp gets a database record first, so the QR points at it |
| Stamp library | `/stamps` | Admins design stamps. Switches: *Log in mail register*, *Needs approval* |
| Bulk stamping | `/bulk` | Up to 50 PDFs or images with one stamp in one corner (first, last or every page). Each gets its own record; download all as a ZIP. Word files stay on the single-document screen |
| Stamped documents | `/documents` | Organisation-wide history. Email it to yourself, download the stamped file, copy the verify link, revoke (admins), delete (admins) |
| Mail register | `/register` | Numbered incoming mail (`IN/2026/0001`), automatic from register stamps or added by hand. CSV export |
| Approvals | `/approvals` | A member requests a gated stamp for one file; an admin approves or rejects; the member stamps that exact file once |
| Verify | `/verify`, public `/v?id=` | Looks up the record, shows revoked stamps, and checks whether a received file is the exact issued copy. Old `/v?d=` links still decode |
| Contact | public `/contact` | Contact form (Cloudflare Turnstile). The message lands in the estamp inbox; the sender gets one auto-reply |
| Settings | `/settings` | Organisation details, reference prefix, your name, team and invites, API keys, plan and billing |

## API (v1)

Admins create keys in *Settings → API keys*. A key is shown once; only its SHA-256 hash is stored. Send it as `Authorization: Bearer es_live_…`. Every call only sees the key's organisation.

| Call | What it does |
| --- | --- |
| `GET /api/v1/stamps?limit=50&before=<ISO date>` | Newest stamp records first; page with `next_before` |
| `GET /api/v1/stamps/{id or reference}` | One record, e.g. `/api/v1/stamps/ES-2026-0007` |
| `POST /api/v1/verify` `{"sha256": "…"}` | Is this file a stamped copy (or the original) of one of your stamps? |
| `GET /api/v1/register?limit=50&before=…` | Mail register entries |
| `POST /api/v1/register` `{"sender", "subject", "notes"}` | Adds an entry with the next number (201) |

Errors look like `{"error": {"code": "unauthorized", "message": "…"}}` with status 400, 401, 404, 500 or 503.

## Email (Resend)

Templates are React Email components in `src/emails/` ("eStamp Dark": black canvas, raised cards, brand ink accent). Each exports typed props, realistic `PreviewProps`, worst-case `variants` and `meta()` (subject + preheader). `src/emails/components/` holds the building blocks; images are PNGs in `public/email/` (Gmail blocks SVG). Every send has an HTML and a plain-text version.

| Email | Sent by | To |
| --- | --- | --- |
| Stamped document (file attached) | *Email it to me* in the success dialog and document details → `POST /api/email/document` | Only the signed-in person's own address. 5/hour, 20/day per person. Files over 28 MB are refused with a "download it instead" message (Resend's limit is 40 MB after encoding) |
| Contact received (auto-reply) | `/contact` → `POST /api/contact` | The sender, once per message |
| New inbound notification | `/api/contact`, and `POST /api/webhooks/resend` for anything else emailed to estamp@ | `EMAIL_ADMIN_NOTIFY`. Reply in your mail app to answer the sender |
| Invites, approval requested/decided | `POST /api/notify` (templates in `src/lib/emails.ts`) | The people concerned; the server picks recipients |
| Receipt, product update | Not sent yet (receipt waits for billing; product update is for Resend Broadcasts) | |

Abuse protection on the contact form: Turnstile checked on the server, 5 messages/hour and 20/day per IP, one fixed recipient, HTML stripped, 5,000-character messages. The webhook checks the Svix signature on the raw body, rejects timestamps more than 5 minutes off, ignores repeated event ids, answers 200 at once and does the work after (`after()`). Sends carry Resend idempotency keys, so a retry never emails twice.

**Test receiving locally:** run `npm run dev`, then `npx cloudflared tunnel --url http://localhost:3000` (or `ngrok http 3000`). In Resend → Webhooks, add `<tunnel URL>/api/webhooks/resend` with `inbox.email.received`, copy its signing secret into `RESEND_WEBHOOK_SECRET`, restart the dev server, and email estamp@workwithignas.com from another address. You should get a "New email" notification at `EMAIL_ADMIN_NOTIFY`.

## Billing

Plans live in `src/lib/plans.ts` (prices not set yet, so nothing is charged and nothing is limited). A mobile-money provider plugs in at `src/lib/server/payments.ts`: implement `startPayment` and `parseWebhook`, add it to `PROVIDERS`, set `PAYMENT_PROVIDER`. Checkout is `POST /api/billing/checkout`; the provider calls `POST /api/billing/webhook/{provider}`, and `mark_payment_paid()` extends the plan once per payment, only if the amount matches.

## How the data is protected

- Every table has row-level security: people only see their own organisation's rows. Members use stamps; admins and owners design stamps, approve, revoke and manage the team.
- Trusted steps run inside the database as functions, not in the browser: reference and register numbers (`issue_stamp`), the one-time file fingerprint (`complete_stamp`), approvals (`decide_approval`), revoking (`revoke_stamp`), roles (`set_member_role`, `remove_member`). Counters, roles and statuses can't be written directly.
- The public verify page can only call `verify_stamp(id)`. Record ids are 72-bit random strings.
- Storage paths start with the organisation id, and the bucket rules check it.
- `supabase/tests/run-tests.sh` runs the migration on a throwaway Postgres in Docker and checks these rules as real users.

## Key files

- `supabase/migrations/` holds the schema, access rules, functions and buckets
- `src/lib/supabase.ts` holds the browser client and the plain-English error messages
- `src/lib/store.ts` holds app state and every read/write to Supabase
- `src/lib/verify.ts` handles verify links, record lookup and the older QR payload format
- `src/components/workspace/export.ts` runs the stamping flow (issue, render, complete, or discard on failure); `src/components/views/bulk.tsx` runs it per file
- `src/lib/server/api.ts` and `src/app/api/` hold the API and billing routes (server-only, secret key)
- `src/lib/stamp-svg.ts` and `src/lib/documents.ts` draw stamps and write PDF, DOCX and images

## Known limits

- One organisation per user. An invite to someone who already has an organisation doesn't apply.
- Approvals compare the file fingerprint computed in the browser. They stop honest mistakes, not someone tampering through the browser's developer tools. Server-side stamping would close that gap.
- History loads the newest 60 documents and 500 register entries (dashboard totals are counted in the database).
- The API reads and verifies stamps; it doesn't stamp files yet (that needs server-side rendering).
- API calls aren't rate-limited. Keys are 256-bit random, so guessing isn't practical, but add a limit before opening the API widely.
- DOCX: stamps go on the first or last page because Word decides page breaks.
- Data stored in the browser by the earlier device-only version is not imported.
- Rate limits are kept in memory per server instance (`src/lib/server/rate-limit.ts`); move them to Upstash before heavy traffic.
- The new-inbound email links to the Resend inbox, not the exact thread.

## Design skills

Built with Emil Kowalski's design-engineering skills and Impeccable, installed in `.agents/` and `.claude/`. `PRODUCT.md` records the product context Impeccable uses.
