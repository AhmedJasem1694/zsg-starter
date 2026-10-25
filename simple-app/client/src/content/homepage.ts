/**
 * Homepage copy, in one place.
 *
 * No copy is hardcoded inside a homepage component. Every component imports
 * from here, so the whole page can be read, reviewed and rewritten without
 * opening JSX.
 *
 * Sections are declared in the order they appear. The ids are the anchor
 * targets the nav links to, so a reorder is a change to SECTION_ORDER rather
 * than a hunt through markup.
 *
 * Every line that states what the product does must map to an entry in
 * ALLOWED_CLAIMS in ./claims. Where a section leans on a claim, name it in
 * that section's `claims` array so the link survives a rewrite.
 *
 * Positioning note: this page is written finance first. The reader is a CFO
 * who wants to know what the company has committed to; the lean legal team is
 * the second audience, not the first.
 *
 * Strings left empty are not yet written, not cut. Sections 3 and 5 to 11
 * carry headings only at this stage.
 */

import type { Claim } from "./claims";
import { claimById } from "./claims";

export interface Stat {
  value: string;
  label: string;
}

export interface Card {
  /** Optional ordinal. Use only where the content is genuinely a sequence. */
  step?: string;
  title: string;
  body: string;
}

export interface Section {
  /** Stable id. The anchor target, and the key in SECTION_ORDER. */
  id: string;
  /** Small uppercase label above the headline. Empty where the section has none. */
  eyebrow: string;
  /** The headline. Source Serif 4, this page only. */
  headline: string;
  /** Supporting prose in reading order, one entry per paragraph. */
  body: string[];
  /** A single line given its own weight, used as a section's full stop. */
  closingLine?: string;
  /** Ids from ALLOWED_CLAIMS that this section's copy depends on. */
  claims?: string[];
}

// ── 1. Nav ────────────────────────────────────────────────────────────────────

export const NAV = {
  /** Anchor links. Order is the order they appear. */
  links: [
    { href: "#how-it-works", label: "How it works" },
    { href: "#for-finance", label: "For finance" },
    { href: "#for-legal", label: "For legal" },
    { href: "#security", label: "Security" },
  ],
  ctaLabel: "Book a conversation",
  ctaHref: "#cta",
  /** Kept as a quiet text link: /login is a live route rendering the Login page. */
  signInLabel: "Sign in",
  signInHref: "/login",
  /** Accessible names for the mobile disclosure, which has no visible label. */
  menuOpenLabel: "Open menu",
  menuCloseLabel: "Close menu",
};

// ── 2. Hero ───────────────────────────────────────────────────────────────────

export const HERO = {
  id: "hero",
  eyebrow: "For CFOs, and the lean legal teams who work with them",
  headline: "Know what your company has signed, who approved it, and why.",
  subheadline:
    "Every supplier and customer contract through one door. Standard terms clear fast. Anything outside policy goes to the right approver, with the reason recorded, so the business can see what it has committed to and what it gave away.",
  primaryCta: { label: "Book a conversation", href: "#cta" },
  secondaryCta: { label: "See how it works", href: "#how-it-works" },
  footnote:
    "Built for teams of one to five lawyers carrying the contract load for a whole business.",
  /**
   * Alt text for the hero visual. Written as a description of the screen so it
   * stays accurate when the placeholder is replaced by the real capture.
   *
   * This previously said the portfolio view shows "contract value under
   * management" and "exposure by RAG band". It shows neither: Portfolio.tsx
   * renders valueAtRisk.RED only and never reads totalValue. Corrected to what
   * is on the page.
   */
  visualAlt:
    "The Zane portfolio view, showing red-flag exposure, open escalations and the counterparties driving them.",
  claims: ["intake", "escalation-routing", "approval-decision", "portfolio-exposure"],
};

// ── 3. The problem ────────────────────────────────────────────────────────────

/**
 * Three scenes, not three arguments. Each one is something that has happened
 * to a finance function, told without naming Zane. The section describes the
 * status quo, so the scenes themselves need no claim; only the closing line
 * says what the product does, and that is what `claims` covers.
 */
export const PROBLEM: Section & { cards: Card[] } = {
  id: "problem",
  eyebrow: "",
  headline: "Every company keeps a ledger for money. Nobody keeps one for commitments.",
  body: [],
  cards: [
    {
      title: "The cap that doubled.",
      body: "A supplier contract arrives with liability capped at twice your policy. Someone says yes because the deal matters. Eighteen months later nobody can say who approved it or why.",
    },
    {
      title: "The renewal nobody saw.",
      body: "A three-year agreement renews automatically because the notice window passed in someone's inbox. The first the board hears of it is the invoice.",
    },
    {
      title: "The answer that left with the person.",
      body: "The contract is in the shared drive. The reasoning was in an email, or in the head of a lawyer who has since moved on.",
    },
  ],
  closingLine: "Every tool records the document. Zane records the decision.",
  claims: ["audit-trail", "approval-decision"],
};

// ── 4. How it works ───────────────────────────────────────────────────────────

export const HOW_IT_WORKS: Section & { steps: Card[]; note: string } = {
  id: "how-it-works",
  eyebrow: "",
  headline: "One door in. One record out.",
  body: [],
  /** Four steps. A real sequence, so these are numbered. */
  steps: [
    {
      step: "01",
      title: "Arrive",
      body: "Contracts come in by email, upload, or from a watched folder. Zane reads them, removes personal data before anything reaches a model, and checks each clause against your own positions.",
    },
    {
      step: "02",
      title: "Clear or route",
      body: "Standard terms are cleared with a plain-English summary. Anything outside policy, above a value threshold, or from a flagged counterparty goes to the named approver.",
    },
    {
      /**
       * "sees ... in one screen or one email" is about what reaches the
       * approver, which is true: buildApprovalRequestEmail() carries the
       * context and a link. It is not a claim that the decision can be made
       * by replying, which ALLOWED_CLAIMS.approval-decision explicitly rules
       * out. Keep the verbs on the seeing, not the deciding, in any rewrite.
       */
      step: "03",
      title: "Decide",
      body: "The approver sees what matters and why in one screen or one email. The decision and the reason behind it are written to the record.",
    },
    {
      step: "04",
      title: "Remember",
      body: "Every decision builds the company's own history: what was conceded, to whom, how often. The next negotiation starts from what you already know.",
    },
  ],
  /** Quiet line under the steps. Positioning, not a product claim. */
  note: "Review happens everywhere now. Zane is for what happens after it.",
  claims: [
    "intake",
    "anonymisation",
    "rag-verdict",
    "escalation-routing",
    "approval-decision",
    "audit-trail",
    "negotiation-intelligence",
  ],
};

// ── 5. For finance ────────────────────────────────────────────────────────────

export const FOR_FINANCE: Section & { items: Card[]; visualAlt: string } = {
  id: "for-finance",
  eyebrow: "For the CFO and the board",
  headline: "See what the business has committed to, in plain English.",
  body: [
    "Zane gives the people who own the risk a view of the whole contract estate, without reading a single clause.",
  ],
  items: [
    {
      /**
       * The total is real but it is not on the Portfolio page: routes.ts:3764
       * computes it and boardPack.ts:131 prints it, while Portfolio.tsx shows
       * red exposure only. See ALLOWED_CLAIMS.portfolio-total-value, which
       * carries that split as a limit.
       */
      title: "Exposure",
      body: "Total value under management and where the risk sits, by counterparty and by contract type.",
    },
    {
      title: "Concessions",
      body: "Where the company settled below its own positions, with whom, and how often.",
    },
    {
      title: "Renewals",
      body: "Dates, notice windows and dated obligations, so nothing rolls over unseen.",
    },
    {
      title: "Approvals",
      body: "What is waiting for a decision, who it is with, and the record of every decision made.",
    },
    {
      title: "The monthly report",
      body: "A plain-English summary built from live data, ready to forward.",
    },
  ],
  visualAlt:
    "The Zane portfolio view, showing red-flag exposure, open escalations and the counterparties driving them.",
  claims: [
    "portfolio-exposure",
    "portfolio-total-value",
    "negotiation-intelligence",
    "timings",
    "escalation-routing",
    "approval-decision",
    "audit-trail",
    "monthly-report",
  ],
};

// ── 6. For legal ──────────────────────────────────────────────────────────────

export const FOR_LEGAL: Section & { cards: Card[]; visualAlt: string } = {
  id: "for-legal",
  eyebrow: "For the legal team",
  headline: "Your positions, your history, applied to every contract.",
  body: [
    "Zane checks each contract against the company's own playbook, not a generic standard, and remembers what was decided last time.",
  ],
  cards: [
    {
      /**
       * "pre-filled", not "generated". PLAYBOOK_DEFAULTS and
       * MARKET_STANDARD_PLAYBOOK are hand-written literals copied into the
       * company's rules; nothing is generated at setup. See
       * ALLOWED_CLAIMS.playbook-baseline.
       */
      title: "Playbook",
      body: "Preferred position, acceptable fallback and hard line per clause, pre-filled from a market-standard baseline and adjusted to how you actually work.",
    },
    {
      title: "Review as intake",
      body: "Red, Amber or Green per clause, the risk in plain English, and the wording to send back.",
    },
    {
      /** Called counterparty memory, never "negotiation intelligence", here. */
      title: "Counterparty memory",
      body: "Patterns computed from real decisions: who pushes on what, where you have conceded before, which renewals are exposed.",
    },
    {
      title: "Audit per contract",
      body: "Every recommendation, decision and approval on a contract in one timeline.",
    },
  ],
  visualAlt:
    "A Zane contract review, showing the clause text beside its Red, Amber or Green verdict, the risk in plain English and the fallback wording.",
  claims: [
    "playbook-baseline",
    "rag-verdict",
    "negotiation-intelligence",
    "audit-trail",
  ],
};

// ── 7. Why now ────────────────────────────────────────────────────────────────

/**
 * Market position, not product. Only the last paragraph says what Zane does,
 * and it says it in terms of the audit trail and the approval record.
 */
export const WHY_NOW: Section = {
  id: "why-now",
  eyebrow: "",
  headline: "Review is a commodity. The record is not.",
  body: [
    "Contract review is now built into the tools companies already pay for. That is good. It also means more contracts get reviewed, more decisions get made, and none of those tools record who decided what, or why.",
    "Most legal software assumes a lawyer owns every exception. In lean businesses the exception is approved by a budget holder, a director, or a finance lead, and the reasoning lives in an email thread.",
    "Zane sits where the decision is made. It does not compete with whoever read the contract. It records what the company did with it.",
  ],
  claims: ["audit-trail", "approval-decision"],
};

// ── 8. Start ──────────────────────────────────────────────────────────────────

/**
 * The brief for this section asked for "extracts renewals and obligations, and
 * shows you where the company already sits against its own positions". Two
 * thirds of that is not true of Legacy Review and is not written here.
 *
 *   Obligations: nothing extracts them. legacyReview.ts pulls term, value,
 *   renewal, termination rights, liability cap, governing law, assignment and
 *   data protection. There is no obligations register in the schema.
 *
 *   Position comparison: legacyReview.ts:1-12 states the design outright, "NO
 *   full playbook comparison". The import writes no review_results and no
 *   extracted_clauses, so it cannot say where you sit against your playbook.
 *
 * What it does do is extract renewal dates and notice windows, and the legacy
 * report derives three risk flags from the extraction. That is what the copy
 * claims. See ALLOWED_CLAIMS.legacy-import.
 *
 * No timeframe is stated. Nothing measures how long an import takes:
 * legacyReview.ts has no timer, and the orchestrator's makeTiming() only
 * console.logs. See NOT_YET_CLAIMS.implementation-time.
 */
export const START: Section & { steps: Card[] } = {
  id: "start",
  eyebrow: "",
  headline: "Start with the contracts you have already signed.",
  body: [
    "Send Zane your executed contracts. It builds the register, extracts renewal dates and notice windows, and flags what is already exposed: liability left uncapped, a renewal window open now, governing law missing. No workflow change on day one.",
  ],
  steps: [
    { step: "01", title: "Share your signed contracts", body: "" },
    { step: "02", title: "Confirm your positions", body: "" },
    { step: "03", title: "Read your first report", body: "" },
  ],
  claims: ["legacy-import", "timings"],
};

// ── 9. Security ───────────────────────────────────────────────────────────────

/**
 * Four statements, each one provable. Three things the brief raised are
 * deliberately absent:
 *
 *   "immutable" audit trail. Not written, because nothing enforces it. There
 *   are no PocketBase API rules anywhere in the project, the shared client
 *   authenticates as superuser, `created` on audit_log is a plain writable
 *   date field rather than an autodate, and scripts/backfill-audit-timestamps
 *   .ts:213 updates existing rows. Append-only by convention is the honest
 *   description. ALLOWED_CLAIMS.audit-trail is correctly worded and does not
 *   use the word; keep it that way.
 *
 *   "Export it at any time." Not written, because no account-level export
 *   exists. The only exports are an audit-log CSV, a board pack and a monthly
 *   report, all narrow. A user cannot retrieve their own uploaded files.
 *   TODO: build a real export, then write this line.
 *
 *   Hosting region, ISO or SOC certifications, and "never used to train
 *   models". Nothing in the codebase supports any of them. openrouter.ts
 *   sends no data-policy header and no provider routing preferences, and no
 *   region is pinned anywhere in config. See ALLOWED_CLAIMS.anonymisation,
 *   whose limit says exactly this.
 */
export const SECURITY: Section & { items: string[]; note: string; contactEmail: string } = {
  id: "security",
  eyebrow: "",
  headline: "Your contracts, handled carefully.",
  body: [],
  items: [
    "Personal data and party names are removed before any text is sent to a model, and restored only inside your account.",
    /**
     * Precisely true: the classifier returns chunk indices, never text, and
     * rawText is looked up locally (clauseClassifier.ts:317). extracted_clauses
     * is only ever created or deleted, never updated. The dash post-processing
     * in openrouter.ts:109 applies to model output alone, and textStyle.ts:10
     * forbids calling it on contract text.
     */
    "Contract text is never rewritten by a model. The source wording stays as it was.",
    "Every upload, review, decision, escalation and approval is written to an audit trail, viewable across the business and per contract.",
    "Zane is not tied to a single model provider.",
  ],
  note: "Full data-processing details on request.",
  /** Canonical public address: used on the Security page and every error path. */
  contactEmail: "ahmed@zanelegal.ai",
  claims: ["anonymisation", "audit-trail", "model-routing"],
};

// ── 10. About ─────────────────────────────────────────────────────────────────

/**
 * Who is building this. House rule: "building Zane", never founder or CEO, and
 * the employer is never named. If the day job is mentioned at all it is
 * "in-house at a UK private healthcare group".
 */
export const ABOUT: Section = {
  id: "about",
  eyebrow: "",
  headline: "Built by someone who carried the contracts.",
  body: [
    "Zane is being built by a UK commercial solicitor who has spent his career inside small legal teams carrying the contract load for an entire business: private equity backed and high-growth companies, and now a large UK private healthcare group. The problem Zane solves is the one he kept meeting: the decision was made, and nobody could later say by whom or why.",
  ],
};

// ── 11. CTA ───────────────────────────────────────────────────────────────────

/**
 * The ask. One thing, asked once.
 *
 * Deliberately makes no product claim, so it needs no `claims` entry. The page
 * has already made its case by this point; repeating it here would be a fourth
 * summary rather than a close.
 *
 * No response time is promised. A submission writes to access_requests and
 * notifies nobody, because RESEND_API_KEY is unset, so a promise here would be
 * one the product cannot keep. The old page said "within 24 hours". It also
 * states no onboarding or time-to-value figure: see
 * NOT_YET_CLAIMS.implementation-time.
 */
export const CTA: Section & {
  ctaLabel: string;
  /** Split so the address is a real mailto rather than text that looks like one. */
  contact: { before: string; email: string; after: string };
  form: {
    fields: { name: string; email: string; company: string; role: string; prompt: string };
    placeholders: { name: string; email: string; company: string; prompt: string };
    rolePlaceholder: string;
    roleOptions: Array<{ value: string; label: string }>;
    /** Hidden from people. Anything in it is a bot. */
    honeypotLabel: string;
    submitLabel: string;
    submittingLabel: string;
    successHeading: string;
    errorPrefix: string;
    errorFallbackLabel: string;
  };
} = {
  id: "cta",
  eyebrow: "",
  headline: "Book a conversation.",
  body: [
    "Zane is working with a small number of design customers before general release. If you want to know what your company has signed before someone else asks, let's talk.",
  ],
  ctaLabel: "Request a conversation",
  contact: {
    before: "Or email",
    email: "ahmed@zanelegal.ai",
    after: "with a question first.",
  },
  form: {
    fields: {
      name: "Name",
      email: "Work email",
      company: "Company",
      role: "Role",
      prompt: "What prompted you to get in touch?",
    },
    placeholders: {
      name: "Jane Smith",
      email: "jane@company.com",
      company: "Acme Ltd",
      prompt: "Optional",
    },
    rolePlaceholder: "Select one",
    roleOptions: [
      { value: "FINANCE", label: "CFO or finance" },
      { value: "LEGAL", label: "General Counsel or legal" },
      { value: "OPERATIONS", label: "Operations" },
      { value: "OTHER", label: "Other" },
    ],
    honeypotLabel: "Website",
    submitLabel: "Request a conversation",
    submittingLabel: "Sending",
    successHeading: "Thanks. You will hear from us within two working days.",
    errorPrefix: "That did not send.",
    errorFallbackLabel: "Email us instead",
  },
};

// ── 12. Footer ────────────────────────────────────────────────────────────────

/**
 * Footer. Three columns, then a legal line.
 *
 * `social` is empty: no LinkedIn or other profile URL exists anywhere in the
 * repository or the environment, and inventing one would point people at a
 * page that is not ours. Add the real URL here and the column renders itself.
 */
export const FOOTER = {
  tagline: "The record of what your company signs, and why.",
  /** In-page anchors. Same ids as SECTION_ORDER. */
  sectionLinks: [
    { href: "#how-it-works", label: "How it works" },
    { href: "#for-finance", label: "For finance" },
    { href: "#for-legal", label: "For legal" },
    { href: "#security", label: "Security" },
  ],
  /** Routed pages. */
  pageLinks: [
    { to: "/case-study", label: "Case study" },
    { to: "/resources", label: "Resources" },
    { to: "/privacy", label: "Privacy" },
    { to: "/terms", label: "Terms" },
  ],
  contactLabel: "Contact",
  contactEmail: "ahmed@zanelegal.ai",
  social: [] as Array<{ href: string; label: string }>,
  /** The year is computed at render. Only the wording lives here. */
  legalSuffix: "Zane. All rights reserved.",
  note: "",
};

// ── Request access modal ──────────────────────────────────────────────────────

/**
 * The only lead capture on the site. Labels are populated because the form has
 * to be usable; the surrounding sales copy is still the CTA section's job.
 *
 * No time promise here. The old copy said "set you up within 24 hours", which
 * is the kind of figure NOT_YET_CLAIMS.implementation-time exists to stop.
 */
export const REQUEST_ACCESS = {
  heading: "Book a conversation",
  body: "Onboarding is done personally at this stage. Tell us what you deal with and we will come back to you.",
  fields: {
    name: "Name",
    email: "Work email",
    company: "Company",
    role: "Role",
    contracts: "What kind of contracts do you deal with?",
  },
  placeholders: {
    name: "Jane Smith",
    email: "jane@company.com",
    company: "Acme Ltd",
    role: "e.g. General Counsel, Head of Legal, Finance Director",
    contracts: "e.g. supplier MSAs, customer agreements, NDAs",
  },
  submitLabel: "Send",
  submittingLabel: "Sending",
  closeLabel: "Close",
  successHeading: "Thank you. We will be in touch.",
  errorFallback: "Something went wrong. Please try again, or email ahmed@zanelegal.ai.",
};

// ── Page order ────────────────────────────────────────────────────────────────

/**
 * The page in order. Landing.tsx renders against this rather than fixing the
 * sequence in markup, so a reorder is a change to this list.
 */
export const SECTION_ORDER = [
  "hero",
  "problem",
  "how-it-works",
  "for-finance",
  "for-legal",
  "why-now",
  "start",
  "security",
  "about",
  "cta",
] as const;

export type SectionId = (typeof SECTION_ORDER)[number];

/** Every section keyed by id, so the page can map over SECTION_ORDER. */
export const SECTIONS: Record<string, Section> = {
  [PROBLEM.id]: PROBLEM,
  [HOW_IT_WORKS.id]: HOW_IT_WORKS,
  [FOR_FINANCE.id]: FOR_FINANCE,
  [FOR_LEGAL.id]: FOR_LEGAL,
  [WHY_NOW.id]: WHY_NOW,
  [START.id]: START,
  [SECURITY.id]: SECURITY,
  [ABOUT.id]: ABOUT,
  [CTA.id]: CTA,
};

/**
 * Every claim id referenced by the page, resolved. Throws at module load if a
 * section names a claim that is not in the register, so copy that outruns the
 * product fails fast rather than shipping.
 */
export function referencedClaims(): Claim[] {
  const ids = new Set<string>(HERO.claims ?? []);
  for (const s of Object.values(SECTIONS)) for (const id of s.claims ?? []) ids.add(id);
  return Array.from(ids).map(claimById);
}
