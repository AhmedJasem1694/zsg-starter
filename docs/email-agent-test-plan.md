# Email-Native Agent — Status, Manual Test Plan & Go-Live Setup

Zane's email agent: every company gets `{slug}@inbox.zanelegal.ai`. Users CC, forward,
or email contracts and requests in plain English; Zane parses the intent, does the work
(review / first draft / grounded Q&A), and replies in-thread with a link to the full
result in the app. No portal, no upload.

This document is the **manual test plan** (the agent can't be end-to-end tested without
live DNS + Mailgun), the **section-by-section build status**, the **exact Namecheap DNS
records**, and the **Mailgun actions** that need a human.

---

## 1. Section-by-section status

All seven sections are built, type-checked (`npm run check` clean), committed, and pushed.

| # | Section | Status | Commit |
|---|---------|--------|--------|
| 1 | Inbound email infrastructure — per-company addresses, signature + sender verification | ✅ Built & pushed | `dd9d764` |
| 2 | Intent parsing — Gemini 3.5 Flash, intents + extracted parameters | ✅ Built & pushed | `d11ffea` |
| 3 | Review via email — full pipeline, in-thread ack + result, founder framing | ✅ Built & pushed | `41cb13f` |
| 4 | First-draft generation (scoped: NDA / services / variation) — DOCX + TO CONFIRM | ✅ Built & pushed | `39bce7e` |
| 5 | Questions via email — grounded ONLY in the company's own Zane data | ✅ Built & pushed | `b9f0562` |
| 6 | Thread awareness — persistence, contextual replies, negotiation-event groundwork | ✅ Built & pushed | `705f686` |
| 7 | Surfaced in app (Settings + Dashboard empty state) and on the landing page | ✅ Built & pushed | `ac09426` |

**Verification done in-build (no live DNS required):**
- TypeScript type-checks clean across all sections.
- Section 6 thread plumbing verified in-process against production PocketBase (schema
  self-heal, thread-id derivation, forwarded-detection, persistence/linking/back-fill,
  contextual Q&A grounding against the thread's contract, outbound logging) — all test
  data cleaned up afterward.
- Section 7 UI validated via `tsc` + a full production `vite build`.

**What still requires live email to test:** everything that depends on Mailgun actually
delivering a message to the webhook and on a real inbox rendering the reply — that is the
manual test plan below.

---

## 2. What did NOT change (regression safety)

The entire sprint is **additive**: 2,162 insertions against **4 deletions**, and all four
deletions are benign — three are existing `import { … }` lines that had a symbol added,
and one extends the Settings page `Tab` type union with `"email"`. **Zero** deletions
occurred inside any existing route handler or pipeline function.

Confirmed **UNCHANGED** (never touched this sprint):

- **Upload flow** — `server/upload.ts` is additive only (new `inboundUpload` multer
  config); the existing `upload` / `uploadAncillary` / `classifyFileType` exports and the
  `POST /api/documents` upload route handler are untouched.
- **Review pipeline** — `reviewOrchestrator.ts`, `clauseClassifier.ts`,
  `playbookComparison.ts`, `piiAnonymiser.ts`, `documentParser.ts`: all UNCHANGED. The
  email path **reuses** the existing `runReview()` exactly as the UI upload does.
- **Playbook** — `playbook_rules` schema and logic UNCHANGED; the draft generator and
  Q&A only *read* playbook rows.
- **Onboarding** — `client/src/pages/Onboarding.tsx` UNCHANGED.
- **Existing API routes** — no existing handler body modified; all email routes are new
  additions to `routes.ts`.

UI files that changed did so additively: `ContractLibrary.tsx` (new "Email"/"Draft"
badges), `Dashboard.tsx` (empty-state email card), `Settings.tsx` ("Email Zane" tab),
`Landing.tsx` (new section), `types.ts` (new optional fields).

---

## 3. Manual test plan

**Prerequisites for the full run:**
1. DNS records added at Namecheap and verified in Mailgun (Section 4 below).
2. Mailgun inbound Route pointing at `https://<your-app-url>/api/inbound-email`.
3. App env set: `MAILGUN_SIGNING_KEY`, `INBOUND_EMAIL_DOMAIN=inbox.zanelegal.ai`, and
   **SMTP_* set** (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_FROM`) so
   replies actually send — without SMTP, sends are skipped-and-logged (fine for the
   webhook-side tests T1–T3, but T4+ need real delivery to inspect the reply).
4. At least one test company with a known `inbound_email` (visible in Settings → Email
   Zane), a populated playbook, and ≥1 registered user whose email you control.
5. `APP_URL` set so "View full review" / library links resolve.

> Tip for T1/T2 you can drive the webhook directly without a real inbox by POSTing a
> multipart form to `/api/inbound-email` with Mailgun's fields (`timestamp`, `token`,
> `signature`, `recipient`, `sender`, `subject`, `body-plain`, attachments). The signature
> is `HMAC-SHA256(MAILGUN_SIGNING_KEY, timestamp + token)`.

### T1 — Webhook rejects a bad signature
- **Do:** POST to `/api/inbound-email` with a `signature` that doesn't match
  `timestamp+token`.
- **Expect:** Request rejected (401), pipeline never runs, **no** reply sent, **no**
  `inbound_emails` row created. Optionally a silent note; nothing revealing returned.
- **Pass:** rejection + zero side effects.

### T2 — Unknown sender silently rejected
- **Do:** Send (valid signature) from an address that is **not** a registered user of the
  recipient company.
- **Expect:** No processing, **no reply of any kind** (nothing that reveals the address
  exists or how it behaves), and a row appended to **`inbound_rejections`** with reason
  `unknown_sender`. No `inbound_emails` row, no document created.
- **Pass:** silent drop + `inbound_rejections` entry only.

### T3 — Known sender + PDF triggers the pipeline and a Library entry tagged "email"
- **Do:** From a registered user, email the company address with a contract **PDF**
  attached and a plain-English "please review this" body.
- **Expect:**
  - A `uploaded_documents` row created with **`source: "email"`** (shows the blue **Email**
    badge in Library / Dashboard).
  - The **existing** `runReview()` pipeline runs (parse → anonymise → classify → compare →
    de-anonymise → persist) — identical to a UI upload.
  - Attachment text is anonymised **before** any model call (inherited from the existing
    pipeline).
  - `review_results` populated; document reaches `COMPLETE`.
- **Pass:** Library entry present with Email source + full review results.

### T4 — Acknowledgement and result emails render in Gmail and Outlook
- **Do:** Continue T3. Open both the **ack** email ("On it. Reviewing `<file>`…") and the
  **result** email in **Gmail (web)** and **Outlook (desktop/web)**.
- **Expect:** Result email renders cleanly in both — navy header, RAG verdict, top issues,
  escalations, and a working **"View full review"** button/link. No broken layout in
  Outlook (table-based, inline-styled HTML). Both arrive **in the same thread** as the
  original (subject `Re: …`, `In-Reply-To` set).
- **Pass:** Legible, on-brand rendering in Gmail **and** Outlook; threaded correctly.

### T5 — Founder account gets founder framing
- **Do:** Repeat the review from a company whose `persona = "FOUNDER"` (or
  `interface_type = "founder"`).
- **Expect:** Result email uses founder framing — overall **SAFE TO SIGN / NEGOTIATE
  FIRST / DO NOT SIGN YET** verdict, plain-English "why it matters", and **"Ask for:"**
  phrasing (vs "Recommended:" for non-founder companies).
- **Pass:** founder verdict + "Ask for:" language present.

### T6 — NDA draft request returns a DOCX with TO CONFIRM markers
- **Do:** From a registered user, email "Draft a mutual NDA with Acme" (no attachment).
- **Expect:** Reply with a **.docx attached**, a summary body (≤3 bullets built from the
  playbook's PREFERRED positions), and business decisions flagged as **`[TO CONFIRM: …]`**.
  No invented commercial terms (prices/dates/quantities). Footer: *"First draft generated
  by Zane from `<Company>`'s playbook. For review before use — not legal advice."* The
  draft is saved to the Library with **`draft: true, source: "email"`** (amber **Draft**
  badge).
- **Pass:** DOCX attached + TO CONFIRM markers + library entry + footer.

### T7 — Out-of-scope draft request gets the scoped reply
- **Do:** Email "Draft a 30-page commercial lease" (or any type outside NDA / services /
  variation).
- **Expect:** A short reply explaining first drafts are currently available for NDAs,
  services agreements, and variation letters, and offering to **review** a counterparty
  draft instead. **No DOCX generated**, no library entry. Status `OUT_OF_SCOPE`.
- **Pass:** scoped decline, no draft produced.

### T8 — Question about a reviewed contract answers with a link
- **Do:** After T3 completes, email a question, e.g. "What's the liability cap on the Acme
  contract?"
- **Expect:** A short, in-thread answer **grounded only in the company's own Zane data**
  (playbook / reviewed contracts / counterparty history) plus a **link** to that contract
  in the app. If it's not in their data: *"I do not have that in your contract records."*
  A general legal question gets the standard refusal (Zane answers about *your* contracts/
  positions only) — **never** a general legal answer.
- **Pass:** grounded answer + correct contract link; refusals behave as specified.

### T9 — Thread reply resolves context
- **Do:** Reply **in the same thread** as T3/T8 with a follow-up that omits the contract,
  e.g. "And what about the indemnity clause?" — **no re-attachment**.
- **Expect:** Zane resolves the question against the **contract already linked to that
  thread** (via `email_threads` thread-id) and answers about that contract without asking
  you to re-send anything. Both the inbound follow-up and Zane's reply are logged to
  `email_threads`.
- **Pass:** correct contextual answer with no re-attachment.

### T10 — Forwarded counterparty response logs a negotiation event (groundwork)
- **Do:** In a contract-linked thread, **forward** a counterparty's response email to the
  company address.
- **Expect:** A negotiation event is recorded against that contract (feeds
  `decision_events` / counterparty intelligence). Normal intent handling still runs.
- **Pass:** `decision_events` row appears with the forwarded body captured.

### Regression spot-checks (no email needed)
- **R1:** Upload a contract through the **UI** (Dashboard/Library) → reviews exactly as
  before; no Email badge.
- **R2:** Run **onboarding** end-to-end → unchanged.
- **R3:** Open an existing review detail page → RAG cards, Accept/Escalate/Dismiss
  unchanged.

---

## 4. DNS records to add at Namecheap

Add these on **zanelegal.ai** (Advanced DNS). **Namecheap's "Host" field is relative to
the domain, so use `inbox`, not `inbox.zanelegal.ai`.** Mailgun shows the exact values for
your account on the domain's DNS page — match them; the DKIM `p=` value in particular is
account-specific.

| Type  | Host (Namecheap)         | Value                                     | Priority | Purpose                         |
|-------|--------------------------|-------------------------------------------|----------|---------------------------------|
| MX    | `inbox`                  | `mxa.mailgun.org`                         | 10       | Receive mail                    |
| MX    | `inbox`                  | `mxb.mailgun.org`                         | 10       | Receive mail                    |
| TXT   | `inbox`                  | `v=spf1 include:mailgun.org ~all`         | —        | SPF (anti-spoof)                |
| TXT   | `mailo._domainkey.inbox` | `k=rsa; p=<DKIM public key from Mailgun>` | —        | DKIM (signing)                  |
| CNAME | `email.inbox`            | `mailgun.org`                             | —        | Open/click tracking (optional)  |

After adding them, click **Verify DNS Settings** in Mailgun. Propagation can take a few
hours. (TTL: Namecheap's "Automatic" is fine.)

---

## 5. Mailgun actions (need you)

1. **Add the domain** `inbox.zanelegal.ai` — Sending → Domains → Add New Domain.
2. **Add the DNS records** above at Namecheap, then **Verify DNS Settings** in Mailgun.
3. **Create an inbound Route** — Receiving → Routes → Create Route:
   - **Expression type:** Match Recipient → `.*@inbox.zanelegal.ai`
   - **Action:** `forward("https://<your-app-url>/api/inbound-email")`
   - Tick **Store and notify** (so attachments are included in the POST).
   - **Priority:** `0`.
4. **Copy the HTTP webhook signing key** — Sending → Webhooks → "HTTP webhook signing
   key" — into the app env as **`MAILGUN_SIGNING_KEY`**. This is what T1's signature check
   validates; if it's wrong, *all* inbound mail is rejected.
5. **Set app env** on the deploy: `MAILGUN_API_KEY`, `MAILGUN_SIGNING_KEY`,
   `INBOUND_EMAIL_DOMAIN=inbox.zanelegal.ai`, and the **`SMTP_*`** vars + `APP_URL` so
   Zane can send the replies and links resolve.
6. **Sending reputation (recommended):** so Zane's *outbound* replies land in inboxes
   (not spam), make sure the sending domain Zane uses for SMTP is itself SPF/DKIM-aligned
   in Mailgun. If you send replies from `@inbox.zanelegal.ai`, the records above cover it;
   if you send from a different domain, that domain needs its own Mailgun sending setup.

Once DNS verifies and the Route is live, run the manual test plan in Section 3 starting
with T1.
