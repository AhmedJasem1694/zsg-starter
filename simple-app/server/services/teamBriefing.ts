/**
 * New-joiner briefing (the inheritance layer).
 *
 * "When someone leaves, the knowledge stays. A new joiner inherits the playbook,
 * the decision history, and the counterparty patterns instead of starting from
 * zero." This service makes that literal: it assembles everything Zane has
 * captured for a company into a single briefing a new team member can read on
 * day one, and persists it to `team_briefing_documents`.
 *
 * Assembly is deterministic and strictly grounded: every line is drawn from data
 * the company actually captured (playbook rules, detected patterns, outcome
 * deltas, decision reasoning, counterparty profiles, the live portfolio, the
 * approval matrix). It never speculates. No LLM call is made, so the briefing is
 * cheap, fast, and faithful.
 */

import { pb } from "../pb.js";
import { buildCounterpartyProfile } from "./counterpartyProfile.js";
import { buildCounterpartyJudgmentMemory } from "./counterpartyJudgment.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

export interface BriefingSections {
  playbook_briefing: string;
  actual_vs_stated: string;
  counterparty_intel: string;
  significant_decisions: string;
  portfolio_snapshot: string;
  approval_matrix: string;
}

export interface TeamBriefing extends BriefingSections {
  id: string;
  companyId: string;
  generatedFor: string;
  generatedAt: string;
  validUntil: string;
}

const label = (c: string) =>
  (c ?? "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase());

const clip = (s: unknown, n: number): string => {
  const t = String(s ?? "").trim().replace(/\s+/g, " ");
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
};

const money = (v: unknown): string => {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return "";
  return "£" + Math.round(n).toLocaleString("en-GB");
};

/** Every distinct counterparty name on this company's documents. */
async function listCounterparties(companyId: string): Promise<string[]> {
  try {
    const docs = await pb.collection("uploaded_documents").getFullList({
      filter: `company = "${companyId}"`,
      fields: "counterpartyName",
    });
    const seen = new Map<string, string>();
    for (const d of docs as PBRecord[]) {
      const name = String(d["counterpartyName"] ?? "").trim();
      if (name) seen.set(name.toLowerCase(), name);
    }
    return Array.from(seen.values());
  } catch {
    return [];
  }
}

async function countResults(companyId: string, rag: string): Promise<number> {
  try {
    const res = await pb.collection("review_results").getList(1, 1, {
      filter: `document.company = "${companyId}" && ragStatus = "${rag}"`,
    });
    return res.totalItems;
  } catch {
    return 0;
  }
}

// ─── Section builders ─────────────────────────────────────────────────────────

async function buildPlaybookBriefing(companyId: string): Promise<string> {
  try {
    const rules = await pb.collection("playbook_rules").getFullList({
      filter: `company = "${companyId}"`,
      sort: "-riskWeight",
    });
    if (rules.length === 0) return "No playbook positions configured yet.";
    const lines = (rules as PBRecord[]).slice(0, 30).map((r) => {
      const parts = [
        `${label(String(r["clauseCategory"] ?? ""))}`,
        `  Preferred: ${clip(r["preferredPosition"], 220)}`,
        `  Fallback: ${clip(r["acceptableFallback"], 220)}`,
        `  Red line: ${clip(r["hardRedLine"], 220)}`,
      ];
      if (r["approvalRequired"]) parts.push(`  Approval: ${clip(r["approvalRequired"], 40)}`);
      return parts.join("\n");
    });
    return `Your company's positions on ${rules.length} clause type(s):\n\n` + lines.join("\n\n");
  } catch {
    return "Playbook could not be loaded.";
  }
}

async function buildActualVsStated(companyId: string): Promise<string> {
  const lines: string[] = [];
  try {
    const patterns = await pb.collection("detected_patterns").getFullList({
      filter: `companyId = "${companyId}"`,
      sort: "-count",
    });
    for (const p of (patterns as PBRecord[]).slice(0, 12)) {
      const msg = clip(p["message"], 240);
      if (msg) lines.push(`• ${label(String(p["clauseCategory"] ?? ""))}: ${msg}`);
    }
  } catch { /* non-fatal */ }
  try {
    const rules = await pb.collection("company_rules").getFullList({
      filter: `company = "${companyId}" && active = true`,
      sort: "-updated",
    });
    for (const r of (rules as PBRecord[]).slice(0, 10)) {
      const desc = clip(r["rule_description"] || r["ruleText"], 200);
      if (desc) lines.push(`• ${label(String(r["clause_category"] || r["clauseCategory"] || ""))}: ${desc}`);
    }
  } catch { /* non-fatal */ }
  if (lines.length === 0) return "No divergence between the written playbook and real practice has been detected yet.";
  return "Where the company's real risk tolerance differs from the written playbook:\n\n" + lines.join("\n");
}

async function buildCounterpartyIntel(companyId: string): Promise<string> {
  const names = await listCounterparties(companyId);
  if (names.length === 0) return "No counterparty history captured yet.";
  const blocks: string[] = [];
  for (const name of names.slice(0, 12)) {
    const [profile, judgment] = await Promise.all([
      buildCounterpartyProfile(companyId, name).catch(() => null),
      buildCounterpartyJudgmentMemory(companyId, name).catch(() => null),
    ]);
    const lines: string[] = [];
    if (profile) lines.push(...profile.summaryLines.map((l) => `  • ${l}`));
    if (judgment) lines.push(...judgment.considerations.slice(0, 3).map((l) => `  • ${l}`));
    if (lines.length) blocks.push(`${name}\n${lines.join("\n")}`);
  }
  if (blocks.length === 0) return "Counterparties on file, but not enough captured history to summarise patterns yet.";
  return "How the company has dealt with its counterparties:\n\n" + blocks.join("\n\n");
}

async function buildSignificantDecisions(companyId: string): Promise<string> {
  try {
    const decisions = await pb.collection("decision_events").getFullList({
      filter: `company = "${companyId}" && reasoning_category != ""`,
      sort: "-created",
    });
    const items = (decisions as PBRecord[]).slice(0, 20).map((d) => {
      const cp = String(d["counterparty"] ?? "").trim();
      const cat = label(String(d["clause_category"] ?? ""));
      const reason = String(d["reasoning_category"] ?? "").trim();
      const detail = clip(d["reasoning_text"], 160);
      const where = cp ? ` with ${cp}` : "";
      return `• ${cat}${where} — reason: ${reason}${detail ? `. ${detail}` : ""}`;
    });
    if (items.length === 0) return "No reasoned significant decisions have been captured yet.";
    return "The unusual calls the team has made, and why:\n\n" + items.join("\n");
  } catch {
    return "Significant decisions could not be loaded.";
  }
}

async function buildPortfolioSnapshot(companyId: string): Promise<string> {
  try {
    const docs = await pb.collection("uploaded_documents").getFullList({
      filter: `company = "${companyId}"`,
      fields: "contractValue,status",
    });
    const total = docs.length;
    const totalValue = (docs as PBRecord[]).reduce((a, d) => a + (Number(d["contractValue"]) || 0), 0);
    const [red, amber] = await Promise.all([countResults(companyId, "RED"), countResults(companyId, "AMBER")]);
    const lines = [
      `• ${total} contract(s) on file${money(totalValue) ? `, ${money(totalValue)} total value` : ""}.`,
      `• ${red} clause(s) currently flagged RED, ${amber} AMBER across the estate.`,
    ];
    return "The portfolio you are inheriting:\n\n" + lines.join("\n");
  } catch {
    return "Portfolio snapshot could not be loaded.";
  }
}

async function buildApprovalMatrix(companyId: string): Promise<string> {
  const lines: string[] = [];
  try {
    const thresholds = await pb.collection("approval_thresholds").getFullList({
      filter: `companyId = "${companyId}"`,
      sort: "minValue",
    });
    for (const t of thresholds as PBRecord[]) {
      const lo = money(t["minValue"]);
      const hi = money(t["maxValue"]);
      const band = lo && hi ? `${lo} to ${hi}` : lo ? `${lo} and above` : hi ? `up to ${hi}` : "any value";
      lines.push(`• ${band}: ${clip(t["requiredApprover"], 40)}${t["label"] ? ` (${clip(t["label"], 60)})` : ""}`);
    }
  } catch { /* non-fatal */ }
  try {
    const contacts = await pb.collection("approval_contacts").getFullList({
      filter: `company = "${companyId}"`,
    });
    const byRole = (contacts as PBRecord[])
      .map((c) => `${clip(c["role"], 30)}: ${clip(c["name"], 50)}`)
      .slice(0, 12);
    if (byRole.length) lines.push("", "Who approves what:", ...byRole.map((r) => `• ${r}`));
  } catch { /* non-fatal */ }
  if (lines.length === 0) return "No approval thresholds or escalation contacts configured yet.";
  return "When to escalate, and to whom:\n\n" + lines.join("\n");
}

/** Assemble all six briefing sections from captured company data. */
export async function assembleBriefing(companyId: string): Promise<BriefingSections> {
  const [
    playbook_briefing,
    actual_vs_stated,
    counterparty_intel,
    significant_decisions,
    portfolio_snapshot,
    approval_matrix,
  ] = await Promise.all([
    buildPlaybookBriefing(companyId),
    buildActualVsStated(companyId),
    buildCounterpartyIntel(companyId),
    buildSignificantDecisions(companyId),
    buildPortfolioSnapshot(companyId),
    buildApprovalMatrix(companyId),
  ]);
  return { playbook_briefing, actual_vs_stated, counterparty_intel, significant_decisions, portfolio_snapshot, approval_matrix };
}

function mapBriefing(r: PBRecord): TeamBriefing {
  return {
    id: r.id as string,
    companyId: r["company"] as string,
    generatedFor: r["generated_for"] as string,
    generatedAt: r["generated_at"] as string,
    validUntil: r["valid_until"] as string,
    playbook_briefing: r["playbook_briefing"] ?? "",
    actual_vs_stated: r["actual_vs_stated"] ?? "",
    counterparty_intel: r["counterparty_intel"] ?? "",
    significant_decisions: r["significant_decisions"] ?? "",
    portfolio_snapshot: r["portfolio_snapshot"] ?? "",
    approval_matrix: r["approval_matrix"] ?? "",
  };
}

/**
 * Generate and persist a fresh briefing for a company. `generatedFor` is the
 * joiner the briefing is for (defaults to the requesting user). Valid for 30 days.
 */
export async function generateBriefing(companyId: string, generatedForUserId: string): Promise<TeamBriefing> {
  const sections = await assembleBriefing(companyId);
  const now = new Date();
  const validUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  // The briefing fields are capped at 5000 chars in the collection schema, so a
  // large playbook would overflow. Keep each section comfortably under the limit.
  const FIELD_MAX = 4800;
  const capped = (s: string) => (s.length > FIELD_MAX ? s.slice(0, FIELD_MAX - 1).trimEnd() + "…" : s);
  const created = await pb.collection("team_briefing_documents").create({
    company: companyId,
    generated_for: generatedForUserId,
    playbook_briefing: capped(sections.playbook_briefing),
    actual_vs_stated: capped(sections.actual_vs_stated),
    counterparty_intel: capped(sections.counterparty_intel),
    significant_decisions: capped(sections.significant_decisions),
    portfolio_snapshot: capped(sections.portfolio_snapshot),
    approval_matrix: capped(sections.approval_matrix),
    generated_at: now.toISOString(),
    valid_until: validUntil.toISOString(),
  });
  return mapBriefing(created as PBRecord);
}

/** The most recent briefing for a company (optionally a specific joiner). Null if none. */
export async function getLatestBriefing(companyId: string, userId?: string): Promise<TeamBriefing | null> {
  try {
    let filter = `company = "${companyId}"`;
    if (userId) filter += ` && generated_for = "${userId}"`;
    const rows = await pb.collection("team_briefing_documents").getFullList({ filter, sort: "-generated_at" });
    const r = rows[0] as PBRecord | undefined;
    return r ? mapBriefing(r) : null;
  } catch {
    return null;
  }
}

/**
 * Open a new-hire context window for a user: a flag that they joined recently, so
 * the app can foreground the inherited briefing during onboarding. Idempotent-ish:
 * always writes a fresh active period. Silent on failure.
 */
export async function startNewHireContext(companyId: string, userId: string, days = 30): Promise<void> {
  try {
    const now = new Date();
    const ends = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    await pb.collection("new_hire_context_periods").create({
      user: userId,
      company: companyId,
      started_at: now.toISOString(),
      ends_at: ends.toISOString(),
      active: true,
    });
  } catch (err) {
    console.warn(`[teamBriefing] new-hire context create failed (non-fatal):`, (err as Error)?.message);
  }
}

/** Is the user currently inside an active new-hire context window? */
export async function isInNewHireContext(companyId: string, userId: string): Promise<boolean> {
  try {
    const rows = await pb.collection("new_hire_context_periods").getFullList({
      filter: `company = "${companyId}" && user = "${userId}" && active = true`,
      sort: "-started_at",
    });
    const r = rows[0] as PBRecord | undefined;
    if (!r) return false;
    return new Date(String(r["ends_at"])).getTime() > Date.now();
  } catch {
    return false;
  }
}
