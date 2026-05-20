/**
 * Pattern Detector — Section 18, Step 4
 *
 * Detects two types of patterns from accumulated signals:
 * A) Below-fallback acceptance patterns (from outcome_deltas)
 * B) Override patterns (from override_signals)
 *
 * Creates company_rule records with status PENDING for GC approval.
 */

import { pb } from "../pb.js";
import { chatComplete } from "./openrouter.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

export async function runPatternDetection(companyId: string): Promise<void> {
  try {
    await Promise.all([
      detectBelowFallbackPattern(companyId),
      detectOverridePattern(companyId),
    ]);
  } catch (err) {
    console.error("[patternDetector] runPatternDetection failed:", err);
    // Never throws
  }
}

async function detectBelowFallbackPattern(companyId: string): Promise<void> {
  try {
    // Query confirmed BELOW_FALLBACK deltas in last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const since = sixMonthsAgo.toISOString().replace("T", " ");

    const deltas = await pb.collection("outcome_deltas").getFullList({
      filter: `company = "${companyId}" && confirmedOutcome = "BELOW_FALLBACK" && confirmedAt >= "${since}"`,
    }).catch(() => [] as PBRecord[]);

    // Group by clauseCategory
    const grouped: Record<string, PBRecord[]> = {};
    for (const d of deltas) {
      const cat = d["clauseCategory"] as string;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(d);
    }

    // For each category with 3+ occurrences, check if a rule already exists
    for (const [cat, items] of Object.entries(grouped)) {
      if (items.length < 3) continue;

      // Check for existing PENDING or ACTIVE rule
      const existing = await pb.collection("company_rules").getFullList({
        filter: `company = "${companyId}" && clauseCategory = "${cat}" && (status = "PENDING" || status = "ACTIVE") && generatedFrom = "OUTCOME_PATTERN"`,
      }).catch(() => [] as PBRecord[]);

      if (existing.length > 0) {
        console.log(`[patternDetector] Rule already exists for ${cat} OUTCOME_PATTERN — skipping`);
        continue;
      }

      // Generate rule suggestion via LLM
      const signedPositions = items
        .map((d) => d["finalClauseText"] as string)
        .filter(Boolean)
        .slice(0, 3)
        .join("\n---\n");

      try {
        const prompt = `This company has accepted below-fallback positions on "${cat.replace(/_/g, " ")}" in ${items.length} contracts. Based on the signed positions, suggest a company rule that reflects their actual practice.

Signed positions (samples):
${signedPositions || "No text samples available."}

Return ONLY valid JSON:
{"ruleText": "clear, specific rule text reflecting the company's actual practice", "riskAssessment": "one paragraph risk assessment of codifying this position"}`;

        const raw = await chatComplete([{ role: "user", content: prompt }], 400);
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) continue;

        const parsed = JSON.parse(match[0]) as { ruleText: string; riskAssessment: string };

        await pb.collection("company_rules").create({
          company: companyId,
          clauseCategory: cat,
          counterpartyType: "",
          contractType: "",
          ruleText: parsed.ruleText,
          status: "PENDING",
          approvedBy: "",
          approvedAt: null,
          evidenceCount: items.length,
          evidenceContracts: JSON.stringify(items.map((d) => d["document"] as string)),
          riskAssessment: parsed.riskAssessment,
          generatedFrom: "OUTCOME_PATTERN",
          editedRuleText: "",
        });

        console.log(`[patternDetector] Created PENDING rule for ${cat} (OUTCOME_PATTERN, ${items.length} contracts)`);
      } catch (err) {
        console.error(`[patternDetector] LLM error for ${cat}:`, err);
      }
    }
  } catch (err) {
    console.error("[patternDetector] detectBelowFallbackPattern failed:", err);
  }
}

async function detectOverridePattern(companyId: string): Promise<void> {
  try {
    const overrides = await pb.collection("override_signals").getFullList({
      filter: `company = "${companyId}"`,
    }).catch(() => [] as PBRecord[]);

    // Group by clauseCategory + correctedStatus + counterpartyType
    const grouped: Record<string, PBRecord[]> = {};
    for (const o of overrides) {
      const key = `${o["clauseCategory"] as string}||${o["correctedStatus"] as string}||${o["counterpartyType"] as string}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(o);
    }

    for (const [key, items] of Object.entries(grouped)) {
      if (items.length < 2) continue;

      const [cat, correctedStatus, counterpartyType] = key.split("||");

      // Check for existing rule
      const existing = await pb.collection("company_rules").getFullList({
        filter: `company = "${companyId}" && clauseCategory = "${cat}" && counterpartyType = "${counterpartyType}" && (status = "PENDING" || status = "ACTIVE") && generatedFrom = "OVERRIDE_PATTERN"`,
      }).catch(() => [] as PBRecord[]);

      if (existing.length > 0) continue;

      const reasons = items.map((o) => o["reason"] as string).filter(Boolean);
      const reasonText = reasons.slice(0, 5).join("; ");

      try {
        const prompt = `This company has overridden the RAG status to "${correctedStatus}" on "${cat.replace(/_/g, " ")}" ${items.length} times${counterpartyType ? ` with ${counterpartyType} counterparties` : ""}.

Override reasons: ${reasonText || "Not specified"}

Suggest a company rule that reflects this consistent override pattern.

Return ONLY valid JSON:
{"ruleText": "clear rule text that formalises this override pattern", "riskAssessment": "one paragraph risk assessment"}`;

        const raw = await chatComplete([{ role: "user", content: prompt }], 400);
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) continue;

        const parsed = JSON.parse(match[0]) as { ruleText: string; riskAssessment: string };

        await pb.collection("company_rules").create({
          company: companyId,
          clauseCategory: cat,
          counterpartyType: counterpartyType ?? "",
          contractType: items[0]?.["contractType"] as string ?? "",
          ruleText: parsed.ruleText,
          status: "PENDING",
          approvedBy: "",
          approvedAt: null,
          evidenceCount: items.length,
          evidenceContracts: JSON.stringify(items.map((o) => o["result"] as string)),
          riskAssessment: parsed.riskAssessment,
          generatedFrom: "OVERRIDE_PATTERN",
          editedRuleText: "",
        });

        console.log(`[patternDetector] Created PENDING rule for ${cat} (OVERRIDE_PATTERN, ${items.length} overrides)`);
      } catch (err) {
        console.error(`[patternDetector] LLM error for override pattern ${cat}:`, err);
      }
    }
  } catch (err) {
    console.error("[patternDetector] detectOverridePattern failed:", err);
  }
}
