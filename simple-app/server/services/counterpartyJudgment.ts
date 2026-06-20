/**
 * Per-counterparty judgment memory (reasoning capture, Section 3).
 *
 * Section 1/2 capture the *reasoning* behind a lawyer's unusual or material
 * decisions. This module aggregates that reasoning per counterparty, so the
 * institutional judgment built up over many contracts can be resurfaced (Section
 * 4) the next time that counterparty appears.
 *
 * Where counterpartyProfile.ts answers "how does this counterparty negotiate"
 * (from negotiation_events), this answers the complementary question: "what have
 * WE decided with this counterparty, and why" (from decision_events). It returns
 * the unusual positions previously accepted and the reasons given, any pattern of
 * repeated concession, and anything explicitly flagged as a one-off exception so
 * it is not mistaken for precedent.
 *
 * Strictly grounded: it only ever reports decisions and reasons that were
 * actually captured. It never speculates about positions that were not recorded.
 */

import { pb } from "../pb.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

export interface JudgmentItem {
  clauseCategory: string;
  label: string;
  /** Short description of what was decided, grounded in the captured position. */
  what: string;
  reasonCategory: string;
  reasonText: string;
  /** Human label for the contract this happened on (counterparty + month). */
  contractLabel: string;
  when: string;              // e.g. "Mar 2026"
  oneOff: boolean;           // reasoning category marks it a one-off exception
}

export interface CounterpartyJudgmentMemory {
  counterparty: string;
  /** Significant decisions with captured reasons, newest first. */
  items: JudgmentItem[];
  /** Advisory "worth considering" lines, ready to render (Section 4). */
  considerations: string[];
  /** Patterns of repeated concession across this counterparty's contracts. */
  patterns: string[];
  /** Decisions explicitly flagged as one-off exceptions, not precedent. */
  oneOffExceptions: string[];
}

const label = (c: string) =>
  (c ?? "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase());

const GENERIC_POSITIONS = new Set([
  "accepted zane's recommendation as-is",
  "dismissed the flag",
  "escalated for approval per recommendation",
  "edited the suggested language",
]);

const clip = (s: unknown, n: number): string => {
  const t = String(s ?? "").trim().replace(/\s+/g, " ");
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
};

/** Format an ISO timestamp as a short "Mon YYYY" label. Empty on failure. */
function monthLabel(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** Is this reasoning category a one-off exception flag? */
function isOneOff(reasonCategory: string): boolean {
  return /one off|one-off/i.test(reasonCategory);
}

/**
 * Describe what was decided, grounded in the captured position. We never invent
 * specifics (e.g. "36 months") that were not recorded; when the stored position
 * is a generic marker we fall back to a faithful, non-specific phrasing.
 */
function describeWhat(clauseCategory: string, humanFinalPosition: string): string {
  const lbl = label(clauseCategory) || "this clause";
  const pos = String(humanFinalPosition ?? "").trim();
  if (!pos || GENERIC_POSITIONS.has(pos.toLowerCase())) {
    return `accepted a weaker ${lbl} position than your playbook`;
  }
  return `accepted on ${lbl}: "${clip(pos, 120)}"`;
}

/** Pull every decision_event for a counterparty within a company, newest first. */
async function loadDecisions(companyId: string, counterparty: string): Promise<PBRecord[]> {
  const cp = counterparty.trim().replace(/"/g, "");
  if (!cp) return [];
  try {
    return await pb.collection("decision_events").getFullList({
      filter: `company = "${companyId}" && counterparty = "${cp}"`,
      sort: "-created",
    });
  } catch {
    return []; // collection may not exist yet
  }
}

/**
 * Build the judgment memory for a counterparty, or null if there is nothing
 * meaningful captured yet (no reasoned decisions and no repeated concessions).
 */
export async function buildCounterpartyJudgmentMemory(
  companyId: string,
  counterparty: string,
): Promise<CounterpartyJudgmentMemory | null> {
  const decisions = await loadDecisions(companyId, counterparty);
  return aggregateJudgmentMemory(counterparty, decisions);
}

/**
 * Pure aggregation of a counterparty's decision_events into judgment memory.
 * Separated from the data load so it can be tested without a live database.
 */
export function aggregateJudgmentMemory(
  counterparty: string,
  decisions: PBRecord[],
): CounterpartyJudgmentMemory | null {
  if (decisions.length === 0) return null;

  const cpName = counterparty.trim();
  const items: JudgmentItem[] = [];
  // clause category -> distinct contracts where we conceded (zane flagged, we accepted)
  const concededContractsByCat = new Map<string, Set<string>>();

  for (const d of decisions) {
    const reasonCategory = String(d["reasoning_category"] ?? "").trim();
    const reasonText = String(d["reasoning_text"] ?? "").trim();
    const clauseCategory = String(d["clause_category"] ?? "").trim();
    const zane = String(d["zane_recommendation"] ?? "");
    const action = String(d["human_action"] ?? "");
    const contract = String(d["contract"] ?? "");
    const when = monthLabel(String(d["created"] ?? ""));

    // Captured reasoning => a significant decision worth remembering.
    if ((reasonCategory || reasonText) && clauseCategory) {
      items.push({
        clauseCategory,
        label: label(clauseCategory),
        what: describeWhat(clauseCategory, String(d["human_final_position"] ?? "")),
        reasonCategory,
        reasonText,
        contractLabel: when ? `${cpName} contract, ${when}` : `${cpName} contract`,
        when,
        oneOff: isOneOff(reasonCategory),
      });
    }

    // Track repeated concessions: Zane flagged it, we accepted anyway.
    const flagged = zane === "reject" || zane === "escalate" || zane === "negotiate";
    const conceded = action === "accepted" || action === "ignored";
    if (flagged && conceded && clauseCategory) {
      const set = concededContractsByCat.get(clauseCategory) ?? new Set<string>();
      set.add(contract || `${clauseCategory}:${when}`);
      concededContractsByCat.set(clauseCategory, set);
    }
  }

  // Patterns: clause categories conceded on across 2+ distinct contracts.
  const patterns: string[] = [];
  for (const [cat, contracts] of Array.from(concededContractsByCat.entries())) {
    if (contracts.size >= 2) {
      patterns.push(
        `You have given ${cpName} a weaker ${label(cat)} position than your standard in ${contracts.size} contracts.`,
      );
    }
  }

  // One-off exceptions: keep them visible so they are not treated as precedent.
  const oneOffExceptions = items
    .filter((it) => it.oneOff)
    .map((it) => `The ${it.label} concession (${it.contractLabel}) was logged as a one-off exception, not a precedent.`);

  // Advisory considerations, newest reasoned decisions first.
  const considerations: string[] = [];
  for (const it of items.slice(0, 4)) {
    const reason = it.reasonCategory
      ? ` because of ${it.reasonCategory.toLowerCase()}`
      : (it.reasonText ? ` (${clip(it.reasonText, 80)})` : "");
    considerations.push(`Last time with ${cpName} you ${it.what}${reason}.`);
  }
  for (const p of patterns) considerations.push(`${p} Consider whether that still applies here.`);
  for (const o of oneOffExceptions) considerations.push(o);

  if (items.length === 0 && patterns.length === 0) return null;

  return { counterparty: cpName, items, considerations, patterns, oneOffExceptions };
}

/**
 * Compact, advisory note for surfacing the judgment memory in plain text (used
 * by the email agent, Section 4). Empty string when there is nothing to say.
 * The tone raises what to consider; it never prescribes.
 */
export function judgmentReviewNote(memory: CounterpartyJudgmentMemory | null): string {
  if (!memory || memory.considerations.length === 0) return "";
  return `Worth considering with ${memory.counterparty}:\n` +
    memory.considerations.map((l) => `  • ${l}`).join("\n");
}
