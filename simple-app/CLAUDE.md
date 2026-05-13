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

This is a full-stack TypeScript monorepo — one `package.json`, one `tsconfig.json` covering both `server/**` and `client/src/**`.

**Dev server**: `tsx --watch server/index.ts` starts Express, which authenticates with PocketBase, registers API routes, then mounts Vite as middleware (via `server/vite.ts`). All requests not matching `/api/*` fall through to Vite, which serves the React SPA. In production, Vite's output in `dist/public/` is served as static files instead.

**Path alias**: `@/` resolves to `client/src/` in both Vite (runtime) and TypeScript (type-check).

### Server

- `server/index.ts` — entry point, calls `initPocketBase()`, wires Express + Vite
- `server/pb.ts` — PocketBase admin client singleton; `initPocketBase()` authenticates and schedules token refresh every 30 min
- `server/routes.ts` — all API routes registered here via `registerRoutes(app)`
- `server/upload.ts` — Multer config, saves uploads to `./uploads/` with nanoid filenames
- `server/services/reviewOrchestrator.ts` — main pipeline: parse → **anonymise** → classify → compare → **de-anonymise** → persist results. Called async (fire-and-forget) from the `POST /api/review/:id` route.
- `server/services/piiAnonymiser.ts` — PII detection and anonymisation. Replaces party names (company, counterparty) and regex-detected PII (emails, phones, postcodes, IBANs, etc.) with placeholders **before** any LLM call. Entity map stored in `pii_sessions`. Call `anonymise()` before LLM, `deanonymise()` after.
- `server/services/auditLogger.ts` — Structured audit trail writer. `audit()` and `auditSync()` write to `audit_log` collection. Never throws — logging failures are non-fatal.
- `server/services/documentParser.ts` — PDF via `pdf-parse` (loaded with `createRequire` because it's CJS), DOCX via `mammoth`. Chunks text into ~2000-char blocks.
- `server/services/clauseClassifier.ts` — single LLM call to classify all chunks into up to 10 clause categories; returns one best chunk per category.
- `server/services/playbookComparison.ts` — per-clause LLM call comparing extracted text against the company's playbook rule; returns structured RAG output.

### Client

- `client/src/main.tsx` — React root, wraps app in `QueryClientProvider`
- `client/src/App.tsx` — React Router setup; redirects `/` to `/onboarding` if no company exists, `/dashboard` otherwise
- `client/src/lib/types.ts` — all shared TypeScript types + `CLAUSE_LABELS` map + `PLAYBOOK_DEFAULTS`
- `client/src/lib/api.ts` — typed `fetch` wrappers for every API endpoint
- `client/src/pages/Onboarding.tsx` — 5-step wizard (company profile → contract type → playbook calibration → approvers → confirm)
- `client/src/pages/Dashboard.tsx` — upload widget + document list; auto-refetches every 3s while any document is `PROCESSING`
- `client/src/pages/ReviewDetail.tsx` — renders per-clause RAG cards with expand/collapse; calls `saveFeedback` on Accept/Escalate/Dismiss

### Database (PocketBase)

PocketBase runs as a **separate service** (Railway or local). The Express server communicates with it via the `pocketbase` JS SDK in admin mode.

**Single-company mode** — `POST /api/company` deletes all existing companies before creating a new one.

**Collections** (17 total):

| Collection | Purpose |
|---|---|
| `users` | Auth — email, passwordHash, name |
| `companies` | Company profile (sector, jurisdiction, workflow type, risk appetite) |
| `company_regulations` | Detected applicable regulations per company |
| `playbook_rules` | Clause positions per company (preferred, fallback, red line) |
| `approval_contacts` | Escalation email recipients |
| `uploaded_documents` | Contract documents with metadata |
| `extracted_clauses` | Individual clauses parsed from documents |
| `review_results` | RAG analysis output per clause |
| `litigation_intakes` | Multi-stage litigation intake form state |
| `ancillary_documents` | Supporting files (evidence, audio, etc.) |
| `user_feedback` | User actions on review results |
| `pii_sessions` | Reversible entity maps from PII anonymisation pipeline |
| `audit_log` | Immutable audit trail for all significant MIKE actions |
| `detected_patterns` | L2 outcome memory — persisted patterns from lawyer feedback |
| `regulatory_synthesis_pages` | L3 synthesis schema — regulatory knowledge pages (schema-only v1) |
| `company_knowledge_pages` | L3 synthesis schema — company negotiation knowledge (schema-only v1) |
| `playbook_synthesis_pages` | L3 synthesis schema — per-clause trend synthesis (schema-only v1) |

**Field name conventions**: PocketBase auto-provides `id`, `created`, `updated`. API responses alias `created` → `uploadedAt`/`createdAt` and relation ID fields to `*Id` names (e.g. `company` → `companyId`) via the mapper functions in `routes.ts`.

**Bootstrap**: Run `npm run pb:setup` once after deploying PocketBase to create all collections. Safe to re-run — existing collections are skipped.

**Dev setup**: Start PocketBase locally (`./pocketbase serve`), set up an admin account at `http://localhost:8090/_/`, then run `npm run pb:setup` to create collections.

### LLM (OpenRouter → Claude)

Set `OPENROUTER_API_KEY` in `.env`. The review pipeline makes two types of LLM calls:
1. **Classify** (`clauseClassifier.ts`): one call per document, returns JSON array mapping chunk indices to clause categories.
2. **Compare** (`playbookComparison.ts`): one call per clause category found, returns structured JSON with `ragStatus`, `clauseSummary`, `whyItMatters`, `recommendedAction`, `suggestedFallback`, `escalationRequired`, `escalationTrigger`, `businessSummary`, `confidence`.

Both calls expect the model to return JSON inside the response text; parsing uses a regex to extract the first `{...}` or `[...]` match.

### Environment

```
POCKETBASE_URL=http://localhost:8090          # or Railway URL in production
POCKETBASE_ADMIN_EMAIL=admin@mike.local
POCKETBASE_ADMIN_PASSWORD=changeme1234
OPENROUTER_API_KEY=sk-or-...
```

Optional:
```
OPENROUTER_MODEL=anthropic/claude-sonnet-4-5
JWT_SECRET=<random string>
SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT, SMTP_FROM, APP_URL
```

### Railway Deployment

Two services:
1. **App service** — Node.js, runs `npm start`
2. **PocketBase service** — Docker image `ghcr.io/muchobien/pocketbase:latest`, persistent volume at `/pb/pb_data`, port 8090

After deploying PocketBase:
1. Visit `https://your-pb.railway.app/_/` to set admin credentials
2. Run `npm run pb:setup` with the Railway PocketBase URL to create collections
3. Set `POCKETBASE_URL`, `POCKETBASE_ADMIN_EMAIL`, `POCKETBASE_ADMIN_PASSWORD` on the app service
