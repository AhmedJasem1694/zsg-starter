# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Express + Vite HMR) on port 3000
npm run build        # Build client (Vite → dist/public) + server (esbuild → dist/index.js)
npm run start        # Run production build
npm run check        # TypeScript type-check (no emit)
npm test             # Vitest in watch mode
npm run test:run     # Vitest single run
npm run test:coverage
npm run pb:setup     # Create PocketBase collections (run once after first deploy)
```

## Architecture

This is a full-stack TypeScript monorepo: one `package.json`, one `tsconfig.json` covering both `server/**` and `client/src/**`.

**Dev server**: `tsx --watch server/index.ts` starts Express, which authenticates with PocketBase, registers API routes, then mounts Vite as middleware (via `server/vite.ts`). All requests not matching `/api/*` fall through to Vite, which serves the React SPA. In production, Vite's output in `dist/public/` is served as static files instead.

**Path alias**: `@/` resolves to `client/src/` in both Vite (runtime) and TypeScript (type-check).

### Server

- `server/index.ts`: entry point, calls `initPocketBase()`, wires Express + Vite
- `server/pb.ts`: PocketBase admin client singleton; `initPocketBase()` authenticates and schedules token refresh every 30 min
- `server/routes.ts`: all API routes registered here via `registerRoutes(app)`
- `server/upload.ts`: Multer config, saves uploads to `./uploads/` with nanoid filenames
- `server/services/reviewOrchestrator.ts`: main pipeline: parse → **anonymise** → classify → compare → **de-anonymise** → persist results. Called async (fire-and-forget) from the `POST /api/review/:id` route.
- `server/services/piiAnonymiser.ts`: PII detection and anonymisation. Replaces party names (company, counterparty) and regex-detected PII (emails, phones, postcodes, IBANs, etc.) with placeholders **before** any LLM call. Entity map stored in `pii_sessions`. Call `anonymise()` before LLM, `deanonymise()` after.
- `server/services/auditLogger.ts`: Structured audit trail writer. `audit()` and `auditSync()` write to `audit_log` collection. Never throws, logging failures are non-fatal.
- `server/services/documentParser.ts`: PDF via `pdf-parse` (loaded with `createRequire` because it's CJS), DOCX via `mammoth`. Chunks text into ~2000-char blocks.
- `server/services/clauseClassifier.ts`: single LLM call to classify all chunks into up to 10 clause categories; returns one best chunk per category.
- `server/services/playbookComparison.ts`: per-clause LLM call comparing extracted text against the company's playbook rule; returns structured RAG output.

### Integration Layer (Google Drive + SharePoint)

Watch folder integrations that auto-review contracts dropped into a connected folder.

- `server/services/googleDriveService.ts`: Google Drive OAuth2, push channel registration (`drive.changes.watch`), folder listing, file download (including Google Docs export to DOCX).
- `server/services/sharePointService.ts`: Microsoft Graph API OAuth2, Graph subscription (webhook) registration, SharePoint site/library listing, file download.
- `server/services/integrationProcessor.ts`: Shared post-download logic: pattern match against prior contracts, update `integration_sync_log` at each stage, fire `runReview()`.
- Routes under `/api/integrations/google-drive/*` and `/api/integrations/sharepoint/*`: OAuth callback routes (no auth required on callbacks/webhooks), CRUD for watching/disconnecting.
- `client/src/pages/Settings.tsx`: Settings page with Integrations tab: connect, folder picker, disconnect, live sync log.
- `client/src/components/IntegrationStatusBadge.tsx`: Reusable connected/disconnected/error badge.

### Client

- `client/src/main.tsx`: React root, wraps app in `QueryClientProvider`
- `client/src/App.tsx`: React Router setup; redirects `/` to `/onboarding` if no company exists, `/dashboard` otherwise
- `client/src/lib/types.ts`: all shared TypeScript types + `CLAUSE_LABELS` map + `PLAYBOOK_DEFAULTS`
- `client/src/lib/api.ts`: typed `fetch` wrappers for every API endpoint
- `client/src/pages/Onboarding.tsx`: 5-step wizard (company profile → contract type → playbook calibration → approvers → confirm)
- `client/src/pages/Dashboard.tsx`: upload widget + document list; auto-refetches every 3s while any document is `PROCESSING`
- `client/src/pages/ReviewDetail.tsx`: renders per-clause RAG cards with expand/collapse; calls `saveFeedback` on Accept/Escalate/Dismiss

### Database (PocketBase)

PocketBase runs as a **separate service** (Railway or local). The Express server communicates with it via the `pocketbase` JS SDK in admin mode.

**Collections**: `npm run pb:setup` creates **55** — 54 via `ensureCollection()` plus `users`, which takes a dedicated auth-collection path in `scripts/setup-pocketbase.ts`. **36 of those are referenced by code**; the remaining 19 are listed at the end of this section.

Recount after adding or removing a collection. The trailing quote matters: without it the function's own definition is counted too, which happens to give 55 today and would quietly drift.

```bash
grep -c 'ensureCollection("' scripts/setup-pocketbase.ts
```

That prints the `ensureCollection()` calls (54). Add 1 for `users` to get the total.

*Core*

| Collection | Purpose |
|---|---|
| `users` | Auth: email, passwordHash, name |
| `companies` | Company profile (sector, jurisdiction, workflow type, risk appetite) |
| `company_regulations` | Detected applicable regulations per company |
| `team_invites` | Pending invitations, consumed at registration |
| `access_requests` | Submissions from the public "Request access" form |

*Playbook and governance*

| Collection | Purpose |
|---|---|
| `playbook_rules` | Clause positions per company (preferred, fallback, red line) |
| `company_rules` | Proposed company rules awaiting approve/reject via `/api/company-rules` |
| `approval_thresholds` | Value thresholds that route a contract to an approver |
| `governance_triggers` | Non-value conditions that force escalation |
| `approval_contacts` | Escalation email recipients |

*Documents and review*

| Collection | Purpose |
|---|---|
| `uploaded_documents` | Contract documents with metadata |
| `extracted_clauses` | Individual clauses parsed from documents |
| `review_results` | RAG analysis output per clause |
| `ancillary_documents` | Supporting files (evidence, audio, etc.) |
| `litigation_intakes` | Multi-stage litigation intake form state |
| `pii_sessions` | Reversible entity maps from the PII anonymisation pipeline |

*Decisions and approvals*

| Collection | Purpose |
|---|---|
| `decision_events` | The moat layer: structured human-judgment capture |
| `approval_requests` | One record per routed escalation awaiting an approver's decision |
| `user_feedback` | User actions on review results |
| `override_signals` | Captured when a user overrides Zane's RAG verdict |
| `false_positive_signals` | Captured when a user marks a finding a false positive |
| `outcome_deltas` | Per-clause difference between what was advised and what was signed |

*Email intake*

| Collection | Purpose |
|---|---|
| `inbound_emails` | Accepted inbound mail, awaiting or after processing |
| `inbound_rejections` | Silent log of unverified or unauthorised inbound mail |
| `email_threads` | Thread persistence for contextual replies |
| `negotiation_events` | Structured negotiation moves parsed from email threads |

*Intelligence and synthesis*

| Collection | Purpose |
|---|---|
| `detected_patterns` | L2 outcome memory: persisted patterns from lawyer feedback |
| `playbook_synthesis_pages` | L3 synthesis: per-clause trend synthesis |
| `company_knowledge_pages` | L3 synthesis: company negotiation knowledge |
| `regulatory_synthesis_pages` | L3 synthesis: regulatory knowledge pages |
| `regulatory_framework_verifications` | Per-framework verification status; no row means unverified |

*Integrations, team, audit*

| Collection | Purpose |
|---|---|
| `integration_configs` | OAuth tokens + watch folder config per provider (Google Drive, SharePoint) |
| `integration_sync_log` | Per-file sync audit trail from watch integrations |
| `team_briefing_documents` | Generated briefings for incoming team members |
| `new_hire_context_periods` | Window during which a new joiner gets extra review context |
| `audit_log` | Append-only trail of significant Zane actions. **Not immutable**: see the Tenancy section, and `ALLOWED_CLAIMS.audit-trail` in `client/src/content/claims.ts` for why that word must not be used |

**Created but never referenced in code (19).** Schema that was provisioned ahead of features that did not land, or that moved elsewhere. Check before reusing a name, and do not assume a collection is wired up because `pb:setup` creates it:

`claim_assessments`, `clause_analyses`, `contract_versions`, `contracts`, `contradiction_findings`, `counterparties`, `escalation_contacts`, `escalation_records`, `integration_connections`, `integration_events`, `outcomes`, `panel_firms`, `playbook_clauses`, `playbook_templates`, `playbook_update_suggestions`, `playbooks`, `privilege_vault`, `regulatory_provisions`, `regulatory_sources`

**Field name conventions**: PocketBase auto-provides `id`, `created`, `updated`. API responses alias `created` → `uploadedAt`/`createdAt` and relation ID fields to `*Id` names (e.g. `company` → `companyId`) via the mapper functions in `routes.ts`.

**Bootstrap**: Run `npm run pb:setup` once after deploying PocketBase to create all collections. Safe to re-run, existing collections are skipped.

**Dev setup**: Start PocketBase locally (`./pocketbase serve`), set up an admin account at `http://localhost:8090/_/`, then run `npm run pb:setup` to create collections.

### Tenancy: Zane is single-tenant

**One company per deployment. This is the design, not a stage it is passing through.**

`getCompany(ownerEmail)` resolves a company by demo-account map, then by owner email (`role_in_contracts` stores the owner), and finally falls back to returning the only company when exactly one exists. That last fallback is the normal path in practice.

**The two onboarding routes do not agree with each other, and one of them contradicts this decision:**

| Route | Behaviour |
|---|---|
| `POST /api/quick-setup` | Collects **all** companies, creates the new one, then deletes every one it collected. Single-tenant. |
| `POST /api/company` | Deletes **only the caller's own** company, matched on `OWNER_FIELD`. Its inline comment says "Multi-tenant mode". |

`POST /api/company` was written for a multi-tenant model that the product is not pursuing. Treat it as the odd one out rather than as a signal of intent, and do not build on its per-owner behaviour. If it is ever reconciled, reconciling it toward single-tenant is the direction.

**What this means when you touch the code:**

- The `company` relation on most collections is a **scoping convention, not a security boundary**. It keeps queries correct and would be the foundation of real multi-tenancy, but nothing underneath it enforces separation.
- **No PocketBase API rules exist anywhere in this project.** `grep -rn "listRule\|viewRule\|createRule\|updateRule\|deleteRule" server scripts` returns nothing, and `scripts/setup-pocketbase.ts` passes only `{name, type, fields}` to `ensureCollection`. PocketBase defaults unset rules to superuser-only, and `server/pb.ts` authenticates the shared singleton as superuser for every server operation. So the one credential the app always holds can read, update or delete any row in any collection.
- Therefore **every tenancy guarantee is application-level**, living in route handlers and nowhere else. A route that forgets to scope its query has no second line of defence.

**Still scope new routes by company.** Not because a second tenant exists today, but because these are also correctness and blast-radius guards, and they are what would have to hold if the product ever goes multi-tenant. Use the existing helpers rather than hand-rolling:

- `assertOwnsDocument(userId, documentId, companyId)` — throws on mismatch.
- `requireDocumentAccess(req, res, documentId)` — resolves the caller's company, asserts ownership, and on failure sends the response and returns `null`, so the caller is `const company = await requireDocumentAccess(...); if (!company) return;`. It answers **403 for both a foreign document and a missing one**, deliberately: distinguishing them turns the id space into an existence oracle.
- Queries against `audit_log` go through `buildAuditFilter()` in `server/lib/auditFilter.ts`, which always emits the company predicate and validates caller-supplied values against strict patterns. PocketBase filters are plain strings, so **never interpolate a request value into one** — a value containing a double quote closes the literal and appends its own predicate. Validate against a pattern, as `buildAuditFilter` and the approvals route do.

**Known consequences of single-tenant mode, accepted deliberately:**

- Any authenticated user can wipe every company by calling `POST /api/quick-setup`. There is no admin gate on onboarding.
- `POST /api/quick-setup` adopts the `pendingDocumentId` from the request body with no ownership check. It cannot have one: at that point in onboarding the caller owns nothing yet, which is the purpose of the call.
- `user_registered` and `user_login` audit entries carry no company and so do not appear in the company audit view.

If this ever becomes multi-tenant, the above three are the first things that break, and PocketBase API rules are the fix to reach for before adding more per-route checks.

### LLM (OpenRouter → Claude)

Set `OPENROUTER_API_KEY` in `.env`. The review pipeline makes two types of LLM calls:
1. **Classify** (`clauseClassifier.ts`): one call per document, returns JSON array mapping chunk indices to clause categories.
2. **Compare** (`playbookComparison.ts`): one call per clause category found, returns structured JSON with `ragStatus`, `clauseSummary`, `whyItMatters`, `recommendedAction`, `suggestedFallback`, `escalationRequired`, `escalationTrigger`, `businessSummary`, `confidence`.

Both calls expect the model to return JSON inside the response text; parsing uses a regex to extract the first `{...}` or `[...]` match.

### Environment

```
POCKETBASE_URL=http://localhost:8090          # or Railway URL in production
POCKETBASE_ADMIN_EMAIL=admin@zane.local
POCKETBASE_ADMIN_PASSWORD=changeme1234
OPENROUTER_API_KEY=sk-or-...
JWT_SECRET=<48 random bytes>                  # REQUIRED in production, see below
```

**`JWT_SECRET` is required in production and the server refuses to start without it.** It signs every session token. `server/lib/jwtSecret.ts` resolves it and throws if `NODE_ENV=production` and the value is missing, or is the old committed default `zane-dev-secret-change-in-production`, which must be treated as public. In development it generates a secret and caches it in `.jwt-secret.local` (gitignored, mode 600) so watch-mode restarts do not sign you out. There is deliberately no fallback constant in the source.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Setting or changing it invalidates every existing session, which is the point when rotating.

The production guard keys off `NODE_ENV === "production"`, so confirm that variable is actually set on the host. Without it a deployment would silently take the development path and generate a fresh secret on each boot, signing everyone out on every deploy. That fails safe rather than open, but it is not what you want.

Optional:
```
OPENROUTER_MODEL=anthropic/claude-sonnet-4-5
SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT, SMTP_FROM, APP_URL
```

Integration (required for Drive/SharePoint watch folders):
```
APP_URL=https://yourapp.railway.app
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://yourapp.railway.app/api/integrations/google-drive/callback
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=...
MICROSOFT_REDIRECT_URI=https://yourapp.railway.app/api/integrations/sharepoint/callback
```

### Railway Deployment

Two services:
1. **App service**: Node.js, runs `npm start`
2. **PocketBase service**: Docker image `ghcr.io/muchobien/pocketbase:latest`, persistent volume at `/pb/pb_data`, port 8090

After deploying PocketBase:
1. Visit `https://your-pb.railway.app/_/` to set admin credentials
2. Run `npm run pb:setup` with the Railway PocketBase URL to create collections
3. Set `POCKETBASE_URL`, `POCKETBASE_ADMIN_EMAIL`, `POCKETBASE_ADMIN_PASSWORD` on the app service
