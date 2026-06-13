# Zane — Legal Intelligence Platform

The legal decision engine powered by organisational memory.

Zane reviews contracts against a company's specific playbook positions, captures the outcome of every negotiation, and applies accumulated institutional knowledge to every future review.

---

## Tech Stack

- **Frontend**: React 18, TypeScript, React Query, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express, TypeScript
- **Database**: PocketBase (self-hosted SQLite via Railway)
- **AI**: OpenRouter — Claude Sonnet (primary), Claude Opus (deep reasoning), GPT-4o (extraction), Gemini Flash (classification)
- **Deployment**: Railway (two services: App + PocketBase)

## Getting Started

### Prerequisites

- Node.js 18+
- A running PocketBase instance (see Railway deployment below)
- An OpenRouter API key from [openrouter.ai](https://openrouter.ai)

### Local Development

```bash
cd simple-app
cp .env.example .env   # fill in your values
npm install
npm run dev            # starts Express + Vite HMR on http://localhost:3000
```

### Environment Variables

All required and optional variables are documented in `simple-app/.env.example`.

Required: `POCKETBASE_URL`, `POCKETBASE_ADMIN_EMAIL`, `POCKETBASE_ADMIN_PASSWORD`, `OPENROUTER_API_KEY`, `JWT_SECRET`

### PocketBase Setup

After deploying PocketBase:

1. Visit `https://your-pb.railway.app/_/` and create an admin account
2. Run `npm run pb:setup` with the Railway PocketBase URL to create all collections
3. Set the environment variables on the app service

### Commands

```bash
npm run dev          # Start dev server (Express + Vite HMR) on port 3000
npm run build        # Build client (Vite) + server (esbuild)
npm start            # Run production build
npm run check        # TypeScript type-check (no emit)
npm test             # Vitest in watch mode
npm run pb:setup     # Create PocketBase collections (run once after deploy)
```

## Project Structure

```
simple-app/
  client/src/
    components/     Reusable UI components
    contexts/       React context providers (FeatureFlags, etc.)
    hooks/          Custom React hooks (useAuth, useLogout)
    lib/            API client, types, utilities
    pages/          Page-level components
  server/
    middleware/     Express middleware (auth, error handling)
    services/       Business logic (review pipeline, AI, email)
    data/           Static reference data (market standard playbook)
  scripts/          One-off setup and migration scripts
```

## Key Concepts

**Playbook**: Company-specific clause positions with preferred position, acceptable fallback, and hard red line for each of 22+ clause categories. RAG status (RED/AMBER/GREEN) is assigned by comparing extracted clause text against these positions.

**Escalation routing**: Three-tier governance system routing contracts to the correct approvers based on (1) clause risk flags, (2) contract value thresholds, and (3) governance triggers.

**Accumulation engine**: Every contract reviewed, every outcome logged, and every override recorded feeds back into future analysis — building institutional memory that compounds over time.

**Multi-model pipeline**: Document classification (Gemini Flash) → metadata extraction (GPT-4o) → clause extraction and comparison (Claude Sonnet) → contradiction detection and escalation analysis (Claude Opus) → low-confidence reanalysis (Claude Opus).

**Subscription tiers**: trial (5 reviews/14 days), starter (20 reviews/mo), team (unlimited + portfolio/patterns), growth (all features including board reporting and API).

## Demo Accounts

| Account | Password | Company |
|---------|----------|---------|
| demo@zanelegal.ai | ZaneDemo2026! | Meridian Financial Technologies Ltd (GC interface) |
| founder-demo@zanelegal.ai | ZaneDemo2026! | Sora Technologies Ltd (Founder interface) |

## Inbound Email (Email Zane)

Every company gets a dedicated address — `{company-slug}@inbox.zanelegal.ai` (e.g. `seko@inbox.zanelegal.ai`). Users CC, forward, or email contracts and requests there in plain English; Zane parses the intent, does the work, and replies by email with a link to the full result in the app. No portal, no upload.

Inbound mail is received via **Mailgun Inbound Routes**, which webhook into `POST /api/inbound-email`. Every request's signature is verified with `MAILGUN_SIGNING_KEY`, and only emails from a **registered user of the recipient company** are processed — anything else is logged silently to `inbound_rejections` and ignored (no reply, nothing revealing).

### Environment variables

```
MAILGUN_API_KEY=          # Mailgun API key (sending / management)
MAILGUN_SIGNING_KEY=      # HTTP webhook signing key — verifies every inbound POST
INBOUND_EMAIL_DOMAIN=inbox.zanelegal.ai
```

### Mailgun setup

1. In Mailgun, add the domain **`inbox.zanelegal.ai`** (Sending → Domains → Add New Domain).
2. Create an inbound **Route** (Receiving → Routes → Create Route):
   - **Expression type**: Match Recipient → `.*@inbox.zanelegal.ai`
   - **Action**: `forward("https://<your-app-url>/api/inbound-email")`, and tick **Store and notify** so attachments are included.
   - Priority `0`.
3. Copy the **HTTP webhook signing key** (Sending → Webhooks) into `MAILGUN_SIGNING_KEY`.

### DNS records to add at Namecheap (for the `inbox` subdomain)

Add these on the **zanelegal.ai** domain. Mailgun shows the exact values for your account on the domain's DNS page — the table below is the record *types and hosts* you need. **Namecheap's "Host" field is relative to `zanelegal.ai`, so use `inbox` (not `inbox.zanelegal.ai`).**

| Type  | Host (Namecheap)           | Value                                       | Priority | Purpose             |
|-------|----------------------------|---------------------------------------------|----------|---------------------|
| MX    | `inbox`                    | `mxa.mailgun.org`                           | 10       | Receive mail        |
| MX    | `inbox`                    | `mxb.mailgun.org`                           | 10       | Receive mail        |
| TXT   | `inbox`                    | `v=spf1 include:mailgun.org ~all`           | —        | SPF (anti-spoof)    |
| TXT   | `mailo._domainkey.inbox`   | `k=rsa; p=<DKIM public key from Mailgun>`   | —        | DKIM (signing)      |
| CNAME | `email.inbox`              | `mailgun.org`                               | —        | Open/click tracking (optional) |

> Use the exact DKIM `p=` value Mailgun generates for your domain — the one above is a placeholder. After adding the records, click **Verify DNS Settings** in Mailgun; propagation can take up to a few hours.

## Railway Deployment

Two Railway services:
1. **App service** — Node.js, runs `npm start`, auto-deploys on push to `master`
2. **PocketBase service** — Docker image `ghcr.io/muchobien/pocketbase:latest`, persistent volume at `/pb/pb_data`

## Contact

Ahmed Jasem — ahmed@zanelegal.ai

---

*Original scaffold notes below — kept for reference*

---

## First run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. You should see "Starter App". That's your blank canvas.

Stop the server with `Ctrl+C`. Re-run `npm run dev` whenever you want to work on the app.

## What's in here

| Folder | What it is |
| --- | --- |
| `client/` | The frontend (React + Tailwind). Pages and UI live here. |
| `server/` | The backend (Express). API routes live in `server/routes.ts`. |
| `test/` | Test setup. Tests live next to the code they test. |

Both the frontend and backend run on the same port (3000) when you're developing — you don't need to think about it.

## How to talk to Claude Code

The single biggest factor in good results is **how clearly you describe what you want**. A few rules of thumb:

### Be specific

Not great: *"add a login page"*

Better: *"Add a login page at `/login` with email and password fields. On submit, POST to `/api/login`. For now, the server can just log the email and return `{ ok: true }`."*

### Work in small steps

Ask for one thing at a time, run it, see it work, then ask for the next thing. Trying to do everything at once leads to messes that are hard to undo.

### Show, don't describe

If you have an example screenshot, paste it. If you have a CSV of data, paste a few rows. If something is broken, paste the exact error message. Claude is much better at responding to concrete inputs than vague descriptions.

### Ask Claude to read first

For changes to existing code: *"Read `server/routes.ts`, then add a new route…"* This is faster and more reliable than guessing.

### Use plan mode for big changes

Press `Shift+Tab` to toggle plan mode. Claude will describe what it's going to do before doing it. Approve the plan if it looks right; redirect if it doesn't.

## Useful slash commands

- `/clear` — Start a fresh conversation. Use this between unrelated tasks so context doesn't get muddled.
- `/init` — Once you've built some of your app, run this to generate a `CLAUDE.md` file. Claude will read that file at the start of every future session, so it remembers your project's shape.
- `/help` — Lists all built-in commands.

## Patterns that work well

- **Refer to files with `@`** — typing `@server/routes.ts` in the chat tells Claude to read that file.
- **Paste error messages verbatim** — copy the entire error from the terminal or browser console.
- **Ask Claude to verify** — *"Run the dev server and check that the new page actually loads."*
- **Commit often** — after each working step, run `git add -A && git commit -m "what changed"`. If a later change breaks something, you can roll back.

## Things to avoid

- **Don't paste secrets into chat.** API keys, passwords, etc., go in a `.env` file (which is gitignored). Tell Claude *"the secret lives in `.env` as `OPENAI_API_KEY`"* — don't paste the value.
- **Don't accept changes you don't understand.** Ask: *"Explain what you changed and why."* If the answer doesn't make sense, push back.
- **Don't ask for "the whole app" in one prompt.** Build it piece by piece.

## When something breaks

1. **Read the error.** Paste it to Claude verbatim.
2. **Check the dev server log** in the terminal where `npm run dev` is running.
3. **Check the browser console** (right-click → Inspect → Console tab).
4. **Restart the dev server** if hot-reload gets confused (`Ctrl+C`, then `npm run dev`).
5. **`git diff`** shows you exactly what changed since your last commit. Ask Claude to explain anything that looks suspicious.

## Common scripts

```bash
npm run dev      # Start the dev server on http://localhost:3000
npm run build    # Build for production
npm start        # Run the production build
npm test         # Run tests
npm run check    # Type-check the code
```

## When you outgrow this guide

Once your app has real shape, run `/init` to create a `CLAUDE.md`. Add anything Claude should know about your project — conventions, deploy targets, gotchas. That file becomes the long-term memory for the repo.
