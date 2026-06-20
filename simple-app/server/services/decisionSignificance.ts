/**
 * Decision significance detection (reasoning capture, Section 1).
 *
 * Not every decision is worth interrupting a lawyer for. Most are routine: Zane
 * said GREEN, the lawyer accepted, the work flows on. This module identifies the
 * small set of decisions that are unusual or material enough that the *reasoning*
 * behind them is worth capturing, so we only ever prompt at the right moments.
 *
 * A decision is flagged significant when any of these is true:
 *   1. The lawyer overrides a red line, or accepts a position Zane flagged as
 *      worse than the playbook fallback (RED, or an escalation requirement they
 *      did not escalate).
 *   2. The decision deviates materially from this company's own historical
 *      pattern on this clause type (they normally hold the line here, but here
 *      they conceded).
 *   3. The contract value is above the company's escalation threshold.
 *   4. The decision contradicts what they did on a recent similar contract.
 *   5. The clause is one the company treats as high importance (high risk weight,
 *      or one that requires senior approval).
 *
 * The result is a small structured verdict: a boolean, the machine-readable
 * reasons it fired, and a short human-readable description of what is unusual,
 * framed so a prompt built from it feels helpful rather than bureaucratic, e.g.
 *   "You are accepting a position Zane flagged RED on Liability Cap. Your
 *    playbook fallback is 12 months' fees, and you have held that line in 4 of
 *    your last 5 decisions on this clause."
 *
 * Everything here is best-effort and non-blocking: any lookup failure resolves to
 * "not significant" so the lawyer's workflow is never held up by this layer.
 */

import { pb } from "../pb.js";
import type { HumanAction } from "./decisionEvents.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

export type SignificanceReason =
  | "worse_than_fallback"        // accepted a RED / un-escalated escalation: worse than the fallback allows
  | "deviates_from_history"      // conceded where they normally hold the line on this clause
  | "above_escalation_threshold" // contract value over the company's escalation threshold
  | "contradicts_recent_similar" // opposite stance to the most recent decision on this clause
  | "high_importance_clause";    // a clause the company treats as high importance

export interface PlaybookRuleContext {
  preferredPosition?: string;
  acceptableFallback?: string;
  hardRedLine?: string;
  approvalRequired?: string;
  riskWeight?: number;
}

/** Aggregated prior decisions for one clause category, used to judge deviation. */
export interface ClauseHistoryStat {
  total: number;                              // prior flagged decisions with a clear stance
  held: number;                               // they pushed back (modified / overrode)
  conceded: number;                           // they accepted what Zane flagged
  mostRecentStance: "held" | "conceded" | null;
  mostRecentLabel: string;                    // e.g. "Acme Technologies Ltd" or a contract name
}

export interface SignificanceInput {
  clauseCategory: string;
  ragStatus?: string;                         // RED | AMBER | GREEN | GREY
  escalationRequired?: boolean;
  humanAction: HumanAction;                   // accepted | overridden | modified | ignored
  humanFinalPosition?: string;
  rule?: PlaybookRuleContext | null;
  contractValue?: number | null;
  currency?: string | null;
  escalationThreshold?: number | null;
  history?: ClauseHistoryStat | null;
}

export interface SignificanceResult {
  significant: boolean;
  reasons: SignificanceReason[];
  /** Short, plain-language description of what is unusual. Empty when not significant. */
  description: string;
  /** One short sentence suitable as a prompt headline, e.g. "This is more liability than you usually accept." */
  headline: string;
}

const NOT_SIGNIFICANT: SignificanceResult = { significant: false, reasons: [], description: "", headline: "" };

const label = (c: string) =>
  (c ?? "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase());

const clip = (s: unknown, n: number): string => {
  const t = String(s ?? "").trim().replace(/\s+/g, " ");
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
};

function formatMoney(value?: number | null, currency?: string | null): string {
  if (value == null || !isFinite(value)) return "";
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" || !currency ? "£" : "";
  const n = Math.round(value);
  const grouped = n.toLocaleString("en-GB");
  return sym ? `${sym}${grouped}` : `${grouped}${currency ? " " + currency : ""}`;
}

/** Did the lawyer let a flagged position stand (concede) or push back on it (hold)? */
function stanceOf(humanAction: HumanAction, flagged: boolean): "held" | "conceded" | null {
  if (humanAction === "modified" || humanAction === "overridden") return "held";
  if (!flagged) return null; // a plain GREEN accept is routine, not a concession
  if (humanAction === "accepted" || humanAction === "ignored") return "conceded";
  return null;
}

/**
 * Pure significance assessment over a fully-resolved decision context. No I/O, so
 * it is trivially testable and deterministic.
 */
export function assessSignificance(input: SignificanceInput): SignificanceResult {
  const rag = String(input.ragStatus ?? "").toUpperCase();
  const flagged = rag === "RED" || rag === "AMBER" || input.escalationRequired === true;
  const stance = stanceOf(input.humanAction, flagged);
  const clauseLabel = label(input.clauseCategory) || "this clause";

  const reasons: SignificanceReason[] = [];
  const parts: string[] = [];

  // 1. Overriding a red line / accepting worse than the fallback allows.
  // Letting a RED or an un-escalated escalation stand is the clearest case.
  const acceptedFlag = input.humanAction === "accepted" || input.humanAction === "ignored";
  const redOrEscalation = rag === "RED" || input.escalationRequired === true;
  if (acceptedFlag && redOrEscalation) {
    reasons.push("worse_than_fallback");
    const fb = clip(input.rule?.acceptableFallback, 140);
    parts.push(
      `You are accepting a position Zane flagged ${rag === "RED" ? "RED" : "for escalation"} on ${clauseLabel}.` +
      (fb ? ` Your playbook fallback is "${fb}".` : ""),
    );
  }

  // 2. Deviating from their own established pattern on this clause.
  const h = input.history;
  if (
    stance === "conceded" &&
    h && h.held >= 2 && h.held > h.conceded
  ) {
    reasons.push("deviates_from_history");
    parts.push(`You have held that line in ${h.held} of your last ${h.total} decisions on ${clauseLabel}.`);
  }

  // 3. Contract value above the company's escalation threshold.
  if (
    input.contractValue != null && input.escalationThreshold != null &&
    isFinite(input.contractValue) && isFinite(input.escalationThreshold) &&
    input.escalationThreshold > 0 && input.contractValue >= input.escalationThreshold
  ) {
    reasons.push("above_escalation_threshold");
    parts.push(
      `This contract is worth ${formatMoney(input.contractValue, input.currency)}, above your ` +
      `${formatMoney(input.escalationThreshold, input.currency)} escalation threshold.`,
    );
  }

  // 4. Contradicting the most recent decision on the same clause.
  if (
    stance && h && h.mostRecentStance && h.mostRecentStance !== stance
  ) {
    reasons.push("contradicts_recent_similar");
    const where = h.mostRecentLabel ? ` on ${clip(h.mostRecentLabel, 60)}` : "";
    parts.push(
      h.mostRecentStance === "held"
        ? `Last time${where} you held this line; here you are conceding it.`
        : `Last time${where} you conceded here; this time you are holding the line.`,
    );
  }

  // 5. A clause the company treats as high importance. Only meaningful when there
  // was actually something to decide (not a clean GREEN accept), so it never nags.
  const highImportance =
    (typeof input.rule?.riskWeight === "number" && input.rule.riskWeight >= 8) ||
    ["GC", "CFO", "BOARD"].includes(String(input.rule?.approvalRequired ?? "").toUpperCase());
  if (highImportance && flagged && stance !== null) {
    reasons.push("high_importance_clause");
    parts.push(`${clauseLabel} is a clause you have marked as high importance.`);
  }

  if (reasons.length === 0) return NOT_SIGNIFICANT;

  // Build a calm, specific headline from the strongest reason.
  let headline: string;
  if (reasons.includes("worse_than_fallback")) {
    headline = `This is a weaker position than your playbook allows on ${clauseLabel}.`;
  } else if (reasons.includes("deviates_from_history")) {
    headline = `This is not how you usually decide ${clauseLabel}.`;
  } else if (reasons.includes("contradicts_recent_similar")) {
    headline = `This goes the other way from your last call on ${clauseLabel}.`;
  } else if (reasons.includes("above_escalation_threshold")) {
    headline = `This is a high-value contract for ${clauseLabel}.`;
  } else {
    headline = `${clauseLabel} is one of your high-importance clauses.`;
  }

  return {
    significant: true,
    reasons,
    description: parts.join(" "),
    headline,
  };
}

// ─── Context loaders ──────────────────────────────────────────────────────────
// These pull the surrounding facts a significance check needs. Each one swallows
// its own errors and degrades to a neutral value, so the assessment can never
// throw into a user-facing path.

/** The company's playbook position for a clause category, if one is configured. */
export async function loadPlaybookRuleContext(
  companyId: string,
  clauseCategory: string,
): Promise<PlaybookRuleContext | null> {
  try {
    const rows = await pb.collection("playbook_rules").getFullList({
      filter: `company = "${companyId}" && clauseCategory = "${clauseCategory.replace(/"/g, "")}"`,
      sort: "-updated",
    });
    const r = rows[0] as PBRecord | undefined;
    if (!r) return null;
    return {
      preferredPosition: r["preferredPosition"] as string,
      acceptableFallback: r["acceptableFallback"] as string,
      hardRedLine: r["hardRedLine"] as string,
      approvalRequired: r["approvalRequired"] as string,
      riskWeight: typeof r["riskWeight"] === "number" ? (r["riskWeight"] as number) : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * The value at which this company starts requiring senior sign-off: the lowest
 * boundary among approval thresholds that escalate above the default legal tier.
 * Null when the company has not configured any.
 */
export async function loadEscalationThreshold(companyId: string): Promise<number | null> {
  try {
    const rows = await pb.collection("approval_thresholds").getFullList({
      filter: `companyId = "${companyId}"`,
      sort: "minValue",
    });
    const boundaries = rows
      .map((r) => Number((r as PBRecord)["minValue"]))
      .filter((n) => isFinite(n) && n > 0);
    if (boundaries.length === 0) return null;
    return Math.min(...boundaries);
  } catch {
    return null;
  }
}

/**
 * Aggregate this company's prior decisions on a clause category into a stance
 * history. Optionally scoped to one user, and excluding the current contract so
 * the decision under assessment never counts as its own precedent.
 */
export async function loadClauseHistory(
  companyId: string,
  clauseCategory: string,
  opts: { userId?: string; excludeDocumentId?: string } = {},
): Promise<ClauseHistoryStat> {
  const empty: ClauseHistoryStat = { total: 0, held: 0, conceded: 0, mostRecentStance: null, mostRecentLabel: "" };
  try {
    const cat = clauseCategory.replace(/"/g, "");
    let filter = `company = "${companyId}" && clause_category = "${cat}"`;
    if (opts.userId) filter += ` && user = "${opts.userId}"`;
    const rows = await pb.collection("decision_events").getFullList({ filter, sort: "-created" });

    let held = 0, conceded = 0, total = 0;
    let mostRecentStance: "held" | "conceded" | null = null;
    let mostRecentLabel = "";

    for (const r of rows as PBRecord[]) {
      if (opts.excludeDocumentId && String(r["contract"] ?? "") === opts.excludeDocumentId) continue;
      const zane = String(r["zane_recommendation"] ?? "");
      const action = String(r["human_action"] ?? "") as HumanAction;
      const flagged = zane === "reject" || zane === "escalate" || zane === "negotiate";
      const stance = stanceOf(action, flagged);
      if (stance === null) continue;
      total++;
      if (stance === "held") held++; else conceded++;
      if (mostRecentStance === null) {
        mostRecentStance = stance; // rows are newest-first, so the first counted is the most recent
        mostRecentLabel = await contractLabel(String(r["contract"] ?? ""));
      }
    }
    return { total, held, conceded, mostRecentStance, mostRecentLabel };
  } catch {
    return empty;
  }
}

/** Best-effort human label for a contract: counterparty name, else original filename. */
async function contractLabel(documentId: string): Promise<string> {
  if (!documentId) return "";
  try {
    const doc = await pb.collection("uploaded_documents").getOne(documentId);
    return String(doc["counterpartyName"] ?? "") || String(doc["originalName"] ?? "");
  } catch {
    return "";
  }
}

/**
 * Convenience entry point: assess the significance of a decision identified only
 * by its review_results id and the action the lawyer took. Loads the clause's
 * playbook rule, the company escalation threshold, and the clause stance history
 * (excluding this contract), then runs the pure assessment.
 *
 * Returns NOT_SIGNIFICANT on any failure: this must never block feedback capture.
 */
export async function assessResultDecision(args: {
  resultId: string;
  userId?: string;
  humanAction: HumanAction;
  humanFinalPosition?: string;
}): Promise<SignificanceResult> {
  try {
    const result = await pb.collection("review_results").getOne(args.resultId);
    const doc = await pb.collection("uploaded_documents").getOne(result["document"] as string);
    const companyId = String(doc["company"] ?? "");
    const clauseCategory = String(result["clauseCategory"] ?? "");
    if (!companyId || !clauseCategory) return NOT_SIGNIFICANT;

    const [rule, escalationThreshold, history] = await Promise.all([
      loadPlaybookRuleContext(companyId, clauseCategory),
      loadEscalationThreshold(companyId),
      loadClauseHistory(companyId, clauseCategory, { userId: args.userId, excludeDocumentId: doc.id as string }),
    ]);

    return assessSignificance({
      clauseCategory,
      ragStatus: result["ragStatus"] as string,
      escalationRequired: Boolean(result["escalationRequired"]),
      humanAction: args.humanAction,
      humanFinalPosition: args.humanFinalPosition,
      rule,
      contractValue: typeof doc["contractValue"] === "number" ? (doc["contractValue"] as number) : null,
      currency: (doc["currency"] as string) ?? null,
      escalationThreshold,
      history,
    });
  } catch (err) {
    console.warn(`[decisionSignificance] assess for result ${args.resultId} failed (non-fatal):`, (err as Error)?.message);
    return NOT_SIGNIFICANT;
  }
}
