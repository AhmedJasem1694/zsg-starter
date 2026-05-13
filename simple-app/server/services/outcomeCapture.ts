/**
 * Outcome Capture Service  (Priority 4 — v1)
 *
 * After each review completes, aggregates lawyer feedback outcomes and persists
 * them to the `detected_patterns` collection in PocketBase.
 *
 * This is the first step toward the v3 synthesis layer:
 *   - L1: raw review results (already stored)
 *   - L2: outcome patterns captured here (what lawyers accept / escalate)
 *   - L3: synthesis pages (future — built from L2 data)
 *
 * Patterns are UPSERTED (update existing row for same company+category+type, or
 * insert a new one) so re-running after multiple reviews stays idempotent.
 */

import { pb } from "../pb.js";

// ── Types ─────────────────────────────────────────────────────────────────────

type Severity = "info" | "warn" | "good";

interface PatternRecord {
  companyId: string;
  clauseCategory: string;
  patternType: string;
  message: string;
  severity: Severity;
  count: number;
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Aggregate all review + feedback data for a company and upsert into
 * `detected_patterns`. Called fire-and-forget after each completed review.
 */
export async function persistOutcomePatterns(companyId: string): Promise<void> {
  const [results, feedbacks] = await Promise.all([
    pb.collection("review_results").getFullList({
      filter: `document.company = "${companyId}"`,
      fields: "id,clauseCategory,ragStatus",
    }),
    pb.collection("user_feedback").getFullList({
      filter: `result.document.company = "${companyId}"`,
      fields: "result,userAction",
    }),
  ]);

  const fbMap = new Map<string, string>(); // resultId → userAction
  for (const f of feedbacks) fbMap.set(f["result"] as string, f["userAction"] as string);

  // Aggregate per clause category
  const catStats: Record<string, {
    total: number;
    accepted: number;
    escalated: number;
    dismissed: number;
    ragCounts: Record<string, number>;
  }> = {};

  for (const r of results) {
    const cat = r["clauseCategory"] as string;
    if (!catStats[cat]) {
      catStats[cat] = { total: 0, accepted: 0, escalated: 0, dismissed: 0, ragCounts: {} };
    }
    catStats[cat].total++;
    const rs = r["ragStatus"] as string;
    catStats[cat].ragCounts[rs] = (catStats[cat].ragCounts[rs] ?? 0) + 1;
    const action = fbMap.get(r.id as string);
    if (action === "ACCEPTED")  catStats[cat].accepted++;
    if (action === "ESCALATED") catStats[cat].escalated++;
    if (action === "DISMISSED") catStats[cat].dismissed++;
  }

  const patterns: PatternRecord[] = [];

  for (const [cat, stats] of Object.entries(catStats)) {
    const redCount = stats.ragCounts["RED"] ?? 0;

    // Pattern: red clauses consistently accepted → playbook may be too strict
    if (stats.accepted >= 3 && redCount > 0) {
      patterns.push({
        companyId,
        clauseCategory: cat,
        patternType: "repeated_acceptance",
        message: `${stats.accepted} red-flagged ${cat.replace(/_/g, " ")} clauses accepted — consider updating your playbook.`,
        severity: "warn",
        count: stats.accepted,
      });
    }

    // Pattern: repeatedly escalated → this clause type always needs legal
    if (stats.escalated >= 2) {
      patterns.push({
        companyId,
        clauseCategory: cat,
        patternType: "repeated_escalation",
        message: `${cat.replace(/_/g, " ")} has been escalated ${stats.escalated} times — consistently requires legal review.`,
        severity: "info",
        count: stats.escalated,
      });
    }

    // Pattern: frequently absent → worth requesting proactively
    const greyCount = stats.ragCounts["GREY"] ?? 0;
    if (greyCount >= 3) {
      patterns.push({
        companyId,
        clauseCategory: cat,
        patternType: "frequently_absent",
        message: `${cat.replace(/_/g, " ")} absent in ${greyCount} contracts — request this clause proactively.`,
        severity: "warn",
        count: greyCount,
      });
    }

    // Pattern: consistently green → playbook working
    const greenCount = stats.ragCounts["GREEN"] ?? 0;
    if (greenCount >= 5 && redCount === 0) {
      patterns.push({
        companyId,
        clauseCategory: cat,
        patternType: "consistently_green",
        message: `${cat.replace(/_/g, " ")} has been GREEN ${greenCount} times — your playbook position is holding well.`,
        severity: "good",
        count: greenCount,
      });
    }
  }

  // Upsert each pattern
  await Promise.all(patterns.map((p) => upsertPattern(p)));
}

async function upsertPattern(p: PatternRecord): Promise<void> {
  try {
    const existing = await pb
      .collection("detected_patterns")
      .getFirstListItem(
        `companyId = "${p.companyId}" && clauseCategory = "${p.clauseCategory}" && patternType = "${p.patternType}"`
      );
    await pb.collection("detected_patterns").update(existing.id, {
      message: p.message,
      severity: p.severity,
      count: p.count,
    });
  } catch {
    // 404 → create new
    await pb.collection("detected_patterns").create(p);
  }
}
