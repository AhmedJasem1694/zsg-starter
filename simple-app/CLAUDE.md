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
```

After changing the Prisma schema:
```bash
npx prisma migrate dev --name <description>   # Apply migration + regenerate client
npx prisma studio                              # Browse the SQLite database
```

## Architecture

This is a full-stack TypeScript monorepo — one `package.json`, one `tsconfig.json` covering both `server/**` and `client/src/**`.

**Dev server**: `tsx --watch server/index.ts` starts Express, which registers API routes then mounts Vite as middleware (via `server/vite.ts`). All requests not matching `/api/*` fall through to Vite, which serves the React SPA. In production, Vite's output in `dist/public/` is served as static files instead.

**Path alias**: `@/` resolves to `client/src/` in both Vite (runtime) and TypeScript (type-check).

### Server

- `server/index.ts` — entry point, wires Express + Vite
- `server/routes.ts` — all API routes registered here via `registerRoutes(app)`
- `server/db.ts` — Prisma client singleton (safe for hot-reload)
- `server/upload.ts` — Multer config, saves uploads to `./uploads/` with nanoid filenames
- `server/services/reviewOrchestrator.ts` — main pipeline: parse → classify → compare → persist results. Called async (fire-and-forget) from the `POST /api/review/:id` route.
- `server/services/documentParser.ts` — PDF via `pdf-parse` (loaded with `createRequire` because it's CJS), DOCX via `mammoth`. Chunks text into ~2000-char blocks.
- `server/services/clauseClassifier.ts` — single LLM call to classify all chunks into up to 10 clause categories; returns one best chunk per category.
- `server/services/playbookComparison.ts` — per-clause LLM call comparing extracted text against the company's `PlaybookRule`; returns structured RAG output. Uses ephemeral prompt caching on the playbook context block.

### Client

- `client/src/main.tsx` — React root, wraps app in `QueryClientProvider`
- `client/src/App.tsx` — React Router setup; redirects `/` to `/onboarding` if no company exists, `/dashboard` otherwise
- `client/src/lib/types.ts` — all shared TypeScript types + `CLAUSE_LABELS` map + `PLAYBOOK_DEFAULTS` (pre-filled positions keyed by risk appetite × clause category)
- `client/src/lib/api.ts` — typed `fetch` wrappers for every API endpoint
- `client/src/pages/Onboarding.tsx` — 5-step wizard (company profile → contract type → playbook calibration → approvers → confirm). Calls `createCompany`, `savePlaybookRules`, `saveContacts` in sequence on finish.
- `client/src/pages/Dashboard.tsx` — upload widget + document list; auto-refetches every 3s while any document is `PROCESSING`
- `client/src/pages/ReviewDetail.tsx` — renders per-clause RAG cards with expand/collapse; calls `saveFeedback` on Accept/Escalate/Dismiss

### Database (SQLite + Prisma 5)

Single-company mode — `POST /api/company` deletes all existing records before creating a new one. Enums are stored as plain strings (SQLite doesn't support Prisma enums); valid values are documented in schema comments.

Key relationships: `Company → PlaybookRule[]`, `UploadedDocument → ReviewResult[]`, `ReviewResult → UserFeedback?` (1:1).

### LLM (Anthropic Claude)

Set `ANTHROPIC_API_KEY` in `.env`. The review pipeline makes two types of LLM calls:
1. **Classify** (`clauseClassifier.ts`): one call per document, returns JSON array mapping chunk indices to clause categories.
2. **Compare** (`playbookComparison.ts`): one call per clause category found, returns structured JSON with `ragStatus`, `clauseSummary`, `whyItMatters`, `recommendedAction`, `suggestedFallback`, `escalationRequired`, `escalationTrigger`, `businessSummary`, `confidence`. The playbook rule is injected as a cached system prompt block.

Both calls expect the model to return JSON inside the response text; parsing uses a regex to extract the first `{...}` or `[...]` match.

### Environment

```
DATABASE_URL="file:./dev.db"      # relative to prisma/ directory
ANTHROPIC_API_KEY="sk-ant-..."
```
