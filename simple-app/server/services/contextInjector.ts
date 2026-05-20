/**
 * Context Injector — Section 18, Step 6
 *
 * Assembles a contextual block from 4 signal sources:
 * 1. Override signals
 * 2. Outcome deltas
 * 3. Active company rules
 * 4. False positive signals
 *
 * Injected into the playbook comparison LLM prompt before each clause analysis.
 */

import { pb } from "../pb.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

export async function buildContextBlock(
  companyId: string,
  clauseCategory: string,
  counterpartyType: string,
  contractType: string,
  maxTokens = 800
): Promise<string> {
  const maxChars = maxTokens * 4;

  try {
    // Fetch all 4 sources in parallel
    const [overrides, outcomes, rules, falsePositives] = await Promise.all([
      pb.collection("override_signals").getFullList({
        filter: `company = "${companyId}" && clauseCategory = "${clauseCategory}"`,
        sort: "-created",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).catch(() => [] as PBRecord[]),

      pb.collection("outcome_deltas").getFullList({
        filter: `company = "${companyId}" && clauseCategory = "${clauseCategory}" && confirmedOutcome != ""`,
        sort: "-created",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).catch(() => [] as PBRecord[]),

      pb.collection("company_rules").getFullList({
        filter: `company = "${companyId}" && clauseCategory = "${clauseCategory}" && status = "ACTIVE"`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).catch(() => [] as PBRecord[]),

      pb.collection("false_positive_signals").getFullList({
        filter: `company = "${companyId}" && clauseCategory = "${clauseCategory}"`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).catch(() => [] as PBRecord[]),
    ]);

    if (
      overrides.length === 0 &&
      outcomes.length === 0 &&
      rules.length === 0 &&
      falsePositives.length === 0
    ) {
      return ""; // No signals — don't inject empty context
    }

    const parts: string[] = [];

    // 1. Active company rules (highest priority)
    for (const rule of rules) {
      const ruleText = (rule["editedRuleText"] as string) || (rule["ruleText"] as string);
      if (ruleText) {
        parts.push(`COMPANY RULE ACTIVE: ${ruleText}`);
      }
    }

    // 2. Override signals
    if (overrides.length > 0) {
      const recentOverrides = overrides.slice(0, 20);
      const fromStatus = recentOverrides.map((o) => `${o["originalStatus"] as string}→${o["correctedStatus"] as string}`);
      const statusSummary: Record<string, number> = {};
      for (const s of fromStatus) {
        statusSummary[s] = (statusSummary[s] ?? 0) + 1;
      }
      const statusBreakdown = Object.entries(statusSummary)
        .map(([s, n]) => `${s} (${n}x)`)
        .join(", ");
      const reasons = recentOverrides
        .map((o) => o["reason"] as string)
        .filter(Boolean)
        .slice(0, 5);
      const cpFiltered = counterpartyType
        ? recentOverrides.filter((o) => o["counterpartyType"] === counterpartyType)
        : recentOverrides;

      let overrideSummary = `This company has overridden the RAG status on ${clauseCategory.replace(/_/g, " ")} ${overrides.length} time${overrides.length !== 1 ? "s" : ""}. Status changes: ${statusBreakdown}.`;
      if (reasons.length > 0) {
        overrideSummary += ` Common reasons: ${reasons.join("; ")}.`;
      }
      if (cpFiltered.length > 0 && counterpartyType) {
        overrideSummary += ` ${cpFiltered.length} override${cpFiltered.length !== 1 ? "s" : ""} specifically with ${counterpartyType} counterparties.`;
      }
      parts.push(overrideSummary);
    }

    // 3. Outcome deltas
    if (outcomes.length > 0) {
      const distribution: Record<string, number> = {};
      for (const o of outcomes) {
        const outcome = o["confirmedOutcome"] as string;
        distribution[outcome] = (distribution[outcome] ?? 0) + 1;
      }
      const total = outcomes.length;
      const belowFallbackCount = distribution["BELOW_FALLBACK"] ?? 0;
      const belowFallbackRate = total > 0 ? Math.round((belowFallbackCount / total) * 100) : 0;
      const distText = Object.entries(distribution)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");

      parts.push(
        `Average signed outcome over last ${total} contract${total !== 1 ? "s" : ""}: ${distText}. Below-fallback acceptance rate: ${belowFallbackRate}%.`
      );
    }

    // 4. False positive signals (lowest priority)
    if (falsePositives.length > 0) {
      const errorTypes = falsePositives
        .map((f) => f["errorType"] as string)
        .filter(Boolean);
      const uniqueTypes = Array.from(new Set(errorTypes));
      parts.push(
        `Note: ${falsePositives.length} previous false positive${falsePositives.length !== 1 ? "s" : ""} flagged on this clause type — error types: ${uniqueTypes.join(", ")}.`
      );
    }

    if (parts.length === 0) return "";

    let block = parts.join("\n");
    // Truncate if over budget
    if (block.length > maxChars) {
      block = block.slice(0, maxChars) + "...[truncated]";
    }

    return block;
  } catch (err) {
    console.error("[contextInjector] buildContextBlock failed:", err);
    return "";
  }
}
