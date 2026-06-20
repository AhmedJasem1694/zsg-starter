/**
 * L3 synthesis engine.
 *
 * L1 is the raw review. L2 is outcome memory (signals fed back into the next
 * review). L3 is synthesis: periodically distilling all of a company's captured
 * data into reusable knowledge pages that say, in plain language, what the
 * company actually does, not what its written playbook claims.
 *
 * This brings the three previously schema-only collections to life:
 *   - playbook_synthesis_pages  : per-clause trend ("your real landing on X")
 *   - company_knowledge_pages   : the company's overall negotiation posture
 *   - regulatory_synthesis_pages: the regulatory frameworks that apply, grounded
 *                                 in the company's detected jurisdiction/sector
 *
 * Grounding: synthesis is built ONLY from the company's own captured data
 * (decisions, confirmed outcomes, negotiation moves) aggregated to clause-level
 * trends. Counterparty names are never sent to the model here, so no party PII
 * leaves the system. Regulatory pages list detected frameworks only and never
 * invent statutory provisions. Each page is versioned and carries a confidence
 * label derived from how many data points back it.
 *
 * The generated playbook synthesis is read back into the live review prompt via
 * contextInjector, closing the L3 loop.
 */

import { pb } from "../pb.js";
import { llmJsonCall } from "./llmJsonParse.js";
import { getModelForTask } from "./modelRouter.js";
import { getRegulationSummaryForLLM } from "./regulatoryDetection.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

const label = (c: string) =>
  (c ?? "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase());

const clip = (s: unknown, n: number): string => {
  const t = String(s ?? "").trim().replace(/\s+/g, " ");
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
};

function confidenceFor(dataPoints: number): Confidence {
  if (dataPoints >= 8) return "HIGH";
  if (dataPoints >= 4) return "MEDIUM";
  return "LOW";
}

async function nextVersion(collection: string, filter: string): Promise<number> {
  try {
    const rows = await pb.collection(collection).getFullList({ filter, sort: "-version" });
    const top = rows[0] as PBRecord | undefined;
    return (Number(top?.["version"]) || 0) + 1;
  } catch {
    return 1;
  }
}

// ─── Per-clause aggregation (deterministic, PII-free) ─────────────────────────

interface ClauseAggregate {
  dataPoints: number;
  stated: string;          // the playbook's stated position
  actionMix: string;       // human action distribution
  outcomeMix: string;      // confirmed signed-outcome distribution
  negotiationMix: string;  // negotiation outcome distribution
  reasons: string[];       // captured reasoning categories
}

async function aggregateClause(companyId: string, clauseCategory: string): Promise<ClauseAggregate> {
  const cat = clauseCategory.replace(/"/g, "");
  const [rules, decisions, outcomes, moves] = await Promise.all([
    pb.collection("playbook_rules").getFullList({ filter: `company = "${companyId}" && clauseCategory = "${cat}"` }).catch(() => [] as PBRecord[]),
    pb.collection("decision_events").getFullList({ filter: `company = "${companyId}" && clause_category = "${cat}"` }).catch(() => [] as PBRecord[]),
    pb.collection("outcome_deltas").getFullList({ filter: `company = "${companyId}" && clauseCategory = "${cat}" && confirmedOutcome != ""` }).catch(() => [] as PBRecord[]),
    pb.collection("negotiation_events").getFullList({ filter: `company = "${companyId}" && clause_category = "${cat}"` }).catch(() => [] as PBRecord[]),
  ]);

  const stated = rules[0]
    ? `Preferred: ${clip((rules[0] as PBRecord)["preferredPosition"], 160)}. Fallback: ${clip((rules[0] as PBRecord)["acceptableFallback"], 160)}.`
    : "No stated playbook position.";

  const dist = (rows: PBRecord[], field: string): string => {
    const m: Record<string, number> = {};
    for (const r of rows) {
      const v = String(r[field] ?? "").trim();
      if (v) m[v] = (m[v] ?? 0) + 1;
    }
    const entries = Object.entries(m).sort((a, b) => b[1] - a[1]);
    return entries.length ? entries.map(([k, n]) => `${k} ${n}x`).join(", ") : "none";
  };

  const reasons = Array.from(
    new Set(
      (decisions as PBRecord[])
        .map((d) => String(d["reasoning_category"] ?? "").trim())
        .filter(Boolean),
    ),
  );

  return {
    dataPoints: decisions.length + outcomes.length + moves.length,
    stated,
    actionMix: dist(decisions as PBRecord[], "human_action"),
    outcomeMix: dist(outcomes as PBRecord[], "confirmedOutcome"),
    negotiationMix: dist(moves as PBRecord[], "outcome"),
    reasons,
  };
}

// ─── Playbook synthesis (per clause) ──────────────────────────────────────────

/**
 * Synthesise the company's real trend on one clause category and persist a
 * playbook_synthesis_page. Returns null if there is too little captured data to
 * say anything grounded (fewer than 2 data points).
 */
export async function synthesisePlaybookClause(companyId: string, clauseCategory: string): Promise<PBRecord | null> {
  const agg = await aggregateClause(companyId, clauseCategory);
  if (agg.dataPoints < 2) return null;

  const lbl = label(clauseCategory);
  const dataSummary =
    `Clause: ${lbl}\n` +
    `Stated playbook: ${agg.stated}\n` +
    `Human decisions (action mix): ${agg.actionMix}\n` +
    `Confirmed signed outcomes: ${agg.outcomeMix}\n` +
    `Negotiation outcomes: ${agg.negotiationMix}\n` +
    `Reasons given for unusual calls: ${agg.reasons.join(", ") || "none recorded"}`;

  const system = `You write a short, factual internal knowledge note about how a company actually handles one contract clause, based ONLY on the aggregated data provided. Respond with JSON only.

HARD RULES:
1. Use ONLY the numbers and facts in the data. NEVER invent outcomes, counterparties, or figures not present.
2. Contrast what the playbook STATES with what the company ACTUALLY does, if the data shows a gap.
3. Be concise: 2 to 4 sentences. No preamble. Plain English.
4. If the data is thin, say the trend is not yet established.`;

  const user = `${dataSummary}

Return ONLY this JSON:
{ "content": "2 to 4 sentence synthesis of the real trend on this clause" }`;

  let content = "";
  try {
    const raw = await llmJsonCall<{ content?: string }>({
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      model: getModelForTask("pattern_intelligence"),
      maxTokens: 600,
      timeoutMs: 45_000,
      description: "playbook synthesis",
    });
    content = clip(raw?.content, 1200);
  } catch (err) {
    console.warn(`[synthesis] playbook clause ${clauseCategory} failed (non-fatal):`, (err as Error)?.message);
    return null;
  }
  if (!content) return null;

  try {
    const version = await nextVersion("playbook_synthesis_pages", `companyId = "${companyId}" && clauseCategory = "${clauseCategory}"`);
    return await pb.collection("playbook_synthesis_pages").create({
      companyId,
      clauseCategory,
      synthesisType: "clause_trend",
      content,
      dataPoints: agg.dataPoints,
      confidenceLabel: confidenceFor(agg.dataPoints),
      version,
    });
  } catch (err) {
    console.warn(`[synthesis] persist playbook page failed (non-fatal):`, (err as Error)?.message);
    return null;
  }
}

// ─── Company knowledge (overall posture) ──────────────────────────────────────

export async function synthesiseCompanyKnowledge(companyId: string): Promise<PBRecord | null> {
  // Aggregate decision action mix across all clauses.
  let decisions: PBRecord[] = [];
  try {
    decisions = await pb.collection("decision_events").getFullList({ filter: `company = "${companyId}"` });
  } catch { return null; }
  if (decisions.length < 4) return null;

  const byCat: Record<string, { total: number; conceded: number }> = {};
  const reasonCounts: Record<string, number> = {};
  for (const d of decisions) {
    const cat = String(d["clause_category"] ?? "").trim();
    if (!cat) continue;
    const zane = String(d["zane_recommendation"] ?? "");
    const action = String(d["human_action"] ?? "");
    const flagged = zane === "reject" || zane === "escalate" || zane === "negotiate";
    const conceded = action === "accepted" || action === "ignored";
    byCat[cat] = byCat[cat] ?? { total: 0, conceded: 0 };
    byCat[cat].total++;
    if (flagged && conceded) byCat[cat].conceded++;
    const rc = String(d["reasoning_category"] ?? "").trim();
    if (rc) reasonCounts[rc] = (reasonCounts[rc] ?? 0) + 1;
  }

  const concessionLines = Object.entries(byCat)
    .filter(([, v]) => v.conceded > 0)
    .sort((a, b) => b[1].conceded - a[1].conceded)
    .slice(0, 8)
    .map(([cat, v]) => `${label(cat)}: conceded ${v.conceded} of ${v.total}`);
  const topReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([r, n]) => `${r} (${n}x)`);

  const dataSummary =
    `Total captured decisions: ${decisions.length}\n` +
    `Concession by clause: ${concessionLines.join("; ") || "none"}\n` +
    `Most common reasons for unusual calls: ${topReasons.join(", ") || "none recorded"}`;

  const system = `You write a short internal note on a company's overall contract negotiation posture, based ONLY on the aggregated data. JSON only. Use only the facts provided, invent nothing. 3 to 5 sentences, plain English.`;
  const user = `${dataSummary}

Return ONLY: { "content": "3 to 5 sentence summary of how this company actually negotiates" }`;

  let content = "";
  try {
    const raw = await llmJsonCall<{ content?: string }>({
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      model: getModelForTask("pattern_intelligence"),
      maxTokens: 700,
      timeoutMs: 45_000,
      description: "company knowledge synthesis",
    });
    content = clip(raw?.content, 1600);
  } catch (err) {
    console.warn(`[synthesis] company knowledge failed (non-fatal):`, (err as Error)?.message);
    return null;
  }
  if (!content) return null;

  try {
    const version = await nextVersion("company_knowledge_pages", `companyId = "${companyId}" && topic = "negotiation_posture"`);
    return await pb.collection("company_knowledge_pages").create({
      companyId,
      pageType: "negotiation_posture",
      topic: "negotiation_posture",
      content,
      sourceResultIds: "",
      confidenceLabel: confidenceFor(decisions.length),
      version,
    });
  } catch (err) {
    console.warn(`[synthesis] persist company knowledge failed (non-fatal):`, (err as Error)?.message);
    return null;
  }
}

// ─── Regulatory synthesis (grounded in detected frameworks only) ──────────────

export async function synthesiseRegulatory(companyId: string): Promise<PBRecord | null> {
  let company: PBRecord;
  try {
    company = await pb.collection("companies").getOne(companyId);
  } catch { return null; }

  const jurisdiction = String(company["jurisdiction"] ?? "").trim() || "GB";
  const sector = String(company["sector"] ?? company["industry"] ?? "").trim();
  // Grounded summary of frameworks that apply, from the detection layer. We never
  // fetch or invent statutory provisions here.
  const summary = await getRegulationSummaryForLLM(companyId).catch(() => "");
  if (!summary.trim()) return null;

  try {
    const version = await nextVersion("regulatory_synthesis_pages", `companyId = "${companyId}" && jurisdiction = "${jurisdiction.replace(/"/g, "")}"`);
    return await pb.collection("regulatory_synthesis_pages").create({
      companyId,
      jurisdiction,
      sector,
      topic: "applicable_frameworks",
      content: clip(summary, 4000),
      citations: "",
      version,
    });
  } catch (err) {
    console.warn(`[synthesis] persist regulatory page failed (non-fatal):`, (err as Error)?.message);
    return null;
  }
}

// ─── Orchestration + reads ────────────────────────────────────────────────────

export interface SynthesisRunResult {
  playbookPages: number;
  companyKnowledge: boolean;
  regulatory: boolean;
}

/** Regenerate synthesis for a company across every clause that has captured data. */
export async function synthesiseCompany(companyId: string): Promise<SynthesisRunResult> {
  // Distinct clause categories the company has decisions on.
  let cats: string[] = [];
  try {
    const decisions = await pb.collection("decision_events").getFullList({
      filter: `company = "${companyId}"`,
      fields: "clause_category",
    });
    cats = Array.from(new Set((decisions as PBRecord[]).map((d) => String(d["clause_category"] ?? "").trim()).filter(Boolean)));
  } catch { /* none */ }

  let playbookPages = 0;
  for (const cat of cats) {
    const page = await synthesisePlaybookClause(companyId, cat);
    if (page) playbookPages++;
  }
  const companyKnowledge = !!(await synthesiseCompanyKnowledge(companyId));
  const regulatory = !!(await synthesiseRegulatory(companyId));
  return { playbookPages, companyKnowledge, regulatory };
}

async function latest(collection: string, filter: string): Promise<PBRecord | null> {
  try {
    const rows = await pb.collection(collection).getFullList({ filter, sort: "-version" });
    return (rows[0] as PBRecord) ?? null;
  } catch {
    return null;
  }
}

export async function getPlaybookSynthesis(companyId: string, clauseCategory: string): Promise<PBRecord | null> {
  return latest("playbook_synthesis_pages", `companyId = "${companyId}" && clauseCategory = "${clauseCategory.replace(/"/g, "")}"`);
}

export async function getCompanyKnowledge(companyId: string): Promise<PBRecord | null> {
  return latest("company_knowledge_pages", `companyId = "${companyId}" && topic = "negotiation_posture"`);
}

export async function getRegulatorySynthesis(companyId: string): Promise<PBRecord | null> {
  return latest("regulatory_synthesis_pages", `companyId = "${companyId}" && topic = "applicable_frameworks"`);
}

/**
 * A single high-signal synthesis line for the live review prompt (read by
 * contextInjector). Only returns content when a HIGH or MEDIUM confidence
 * playbook synthesis exists, so the review is never steered by thin data.
 */
export async function synthesisContextLine(companyId: string, clauseCategory: string): Promise<string> {
  const page = await getPlaybookSynthesis(companyId, clauseCategory);
  if (!page) return "";
  const conf = String(page["confidenceLabel"] ?? "");
  if (conf !== "HIGH" && conf !== "MEDIUM") return "";
  const content = clip(page["content"], 600);
  return content ? `Learned trend (${conf.toLowerCase()} confidence): ${content}` : "";
}
