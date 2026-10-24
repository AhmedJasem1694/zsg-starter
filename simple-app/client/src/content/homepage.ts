/**
 * Homepage copy, in one place.
 *
 * After this commit no copy is hardcoded inside a homepage component. Every
 * component imports from here, so the whole page can be read, reviewed and
 * rewritten without opening JSX.
 *
 * Sections are declared in the order they appear on the page. The ids match
 * the in-file section markers in client/src/pages/Landing.tsx and the anchors
 * the nav links to, so a reorder is a change in one list rather than a hunt
 * through markup.
 *
 * Every line that states what the product does must map to an entry in
 * ALLOWED_CLAIMS in ./claims. Where a line leans on a claim, name it in the
 * `claims` array on that section so the link survives a rewrite.
 *
 * Strings are intentionally empty at this stage. Later prompts fill them.
 * Empty means not yet written; it does not mean the section is cut.
 */

import type { Claim } from "./claims";
import { claimById } from "./claims";

/** One stat in a stat row: a figure and the line that qualifies it. */
export interface Stat {
  value: string;
  label: string;
}

/** One card in a three-across group. */
export interface Card {
  /** Optional ordinal. Use only where the content is genuinely a sequence. */
  step?: string;
  title: string;
  body: string;
}

export interface Section {
  /** Stable id. Matches the section marker in Landing.tsx and any nav anchor. */
  id: string;
  /** Small uppercase label above the headline. Empty where the section has none. */
  eyebrow: string;
  /** The headline. Set in Source Serif 4 on this page only. */
  headline: string;
  /** Supporting prose, in reading order. One entry per paragraph. */
  body: string[];
  /** A single line given its own weight, used as a section's full stop. */
  closingLine?: string;
  /** Ids from ALLOWED_CLAIMS that this section's copy depends on. */
  claims?: string[];
}

// ── Nav ───────────────────────────────────────────────────────────────────────

export const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: "#why-zane", label: "" },
  { href: "#how-it-works", label: "" },
  { href: "#pricing", label: "" },
];

export const NAV_CTA = "";
export const NAV_SIGN_IN = "";

// ── 1. Hero ───────────────────────────────────────────────────────────────────

export const HERO = {
  id: "hero",
  /** Static first half of the headline. The cycling word completes it. */
  headlinePrefix: "",
  /** Rotating words that finish the headline. Keep them the same part of speech. */
  cyclingWords: [] as string[],
  subline: "",
  supportingLine: "",
  ctaLabel: "",
  /** Reassurance under the button. No time-to-value figure: see NOT_YET_CLAIMS. */
  ctaCaption: "",
  stats: [] as Stat[],
};

// ── 2. The problem ────────────────────────────────────────────────────────────

export const PROBLEM: Section = {
  id: "why-zane",
  eyebrow: "",
  headline: "",
  /** Three short beats, one idea each. */
  body: [],
  closingLine: "",
};

// ── 3. What it costs ──────────────────────────────────────────────────────────

export const COST: Section & { stats: Stat[] } = {
  id: "cost",
  eyebrow: "",
  headline: "",
  body: [],
  stats: [],
};

// ── 4. How Zane works ─────────────────────────────────────────────────────────

export const MECHANISM: Section & { steps: Card[] } = {
  id: "how-it-works",
  eyebrow: "",
  headline: "",
  body: [],
  /** A real sequence, so these are numbered. */
  steps: [],
  claims: ["intake", "rag-verdict", "anonymisation"],
};

// ── 5. What accumulates ───────────────────────────────────────────────────────

export const PROOF: Section = {
  id: "proof",
  eyebrow: "",
  headline: "",
  body: [],
  claims: ["negotiation-intelligence", "escalation-routing", "approval-decision"],
};

// ── 6. The difference ─────────────────────────────────────────────────────────

export const OBJECTION: Section & { cards: Card[] } = {
  id: "difference",
  eyebrow: "",
  headline: "",
  body: [],
  cards: [],
  claims: ["negotiation-intelligence", "portfolio-exposure", "audit-trail"],
};

// ── 7. Pricing ────────────────────────────────────────────────────────────────

export const PRICING: Section = {
  id: "pricing",
  eyebrow: "",
  headline: "",
  body: [],
};

// ── 8. Questions ──────────────────────────────────────────────────────────────

export interface Faq {
  q: string;
  a: string;
  /** Claim ids the answer depends on. Empty for answers that make no product claim. */
  claims?: string[];
}

export const FAQ: Section & { items: Faq[] } = {
  id: "faq",
  eyebrow: "",
  headline: "",
  body: [],
  items: [],
};

// ── 9. The ask ────────────────────────────────────────────────────────────────

export const ASK: Section & { ctaLabel: string; contactLine: string } = {
  id: "ask",
  eyebrow: "",
  headline: "",
  body: [],
  ctaLabel: "",
  contactLine: "",
};

// ── Footer ────────────────────────────────────────────────────────────────────

export const FOOTER_LINKS: Array<{ to: string; label: string }> = [
  { to: "/case-study", label: "" },
  { to: "/security", label: "" },
  { to: "/resources", label: "" },
];

export const FOOTER_NOTE = "";

// ── Request access modal ──────────────────────────────────────────────────────

export const REQUEST_ACCESS = {
  heading: "",
  body: "",
  fields: {
    name: "",
    email: "",
    company: "",
    role: "",
    contracts: "",
  },
  submitLabel: "",
  submittingLabel: "",
  successHeading: "",
  successBody: "",
};

// ── Page order ────────────────────────────────────────────────────────────────

/**
 * The page in order. Reordering here is the whole change: Landing.tsx renders
 * against these ids rather than fixing the sequence in markup.
 */
export const SECTION_ORDER = [
  "hero",
  "why-zane",
  "cost",
  "how-it-works",
  "proof",
  "difference",
  "pricing",
  "faq",
  "ask",
] as const;

export type SectionId = (typeof SECTION_ORDER)[number];

/**
 * Every claim id referenced by any section, resolved. Throws at module load if
 * a section names a claim that is not in the register, so a copy change that
 * outruns the product fails fast rather than shipping.
 */
export function referencedClaims(): Claim[] {
  const sections: Array<Section | (Section & object)> = [
    PROBLEM, COST, MECHANISM, PROOF, OBJECTION, PRICING, FAQ, ASK,
  ];
  const ids = new Set<string>();
  for (const s of sections) for (const id of s.claims ?? []) ids.add(id);
  for (const item of FAQ.items) for (const id of item.claims ?? []) ids.add(id);
  return Array.from(ids).map(claimById);
}
