/**
 * Delta Comparison Service - Section 18, Step 1
 *
 * Compares an original reviewed document against a final signed version,
 * classifying each negotiated clause outcome as:
 * PREFERRED / FALLBACK / BELOW_FALLBACK / NO_CHANGE / REMOVED
 */

import { pb } from "../pb.js";
import { chatComplete } from "./openrouter.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

export type DeltaOutcome =
  | "PREFERRED"
  | "FALLBACK"
  | "BELOW_FALLBACK"
  | "NO_CHANGE"
  | "REMOVED";

export async function runDeltaComparison(
  originalDocId: string,
  finalDocId: string,
  companyId: string
): Promise<void> {
  try {
    // Load review results for the original document (RED and AMBER only)
    const flaggedResults = await pb.collection("review_results").getFullList({
      filter: `document = "${originalDocId}" && (ragStatus = "RED" || ragStatus = "AMBER")`,
    }).catch(() => [] as PBRecord[]);

    if (flaggedResults.length === 0) {
      console.log(`[deltaComparison] No RED/AMBER results for ${originalDocId} - nothing to compare`);
      return;
    }

    // Load extracted clauses for both documents
    const [origClauses, finalClauses] = await Promise.all([
      pb.collection("extracted_clauses").getFullList({
        filter: `document = "${originalDocId}"`,
      }).catch(() => [] as PBRecord[]),
      pb.collection("extracted_clauses").getFullList({
        filter: `document = "${finalDocId}"`,
      }).catch(() => [] as PBRecord[]),
    ]);

    const origByCategory = new Map<string, string>();
    for (const c of origClauses) {
      origByCategory.set(c["clauseCategory"] as string, c["rawText"] as string);
    }

    const finalByCategory = new Map<string, string>();
    for (const c of finalClauses) {
      finalByCategory.set(c["clauseCategory"] as string, c["rawText"] as string);
    }

    // Load playbook rules for context
    const playbookRules = await pb.collection("playbook_rules").getFullList({
      filter: `company = "${companyId}"`,
    }).catch(() => [] as PBRecord[]);

    const ruleByCategory = new Map<string, PBRecord>();
    for (const r of playbookRules) {
      ruleByCategory.set(r["clauseCategory"] as string, r);
    }

    // Process each flagged clause
    for (const result of flaggedResults) {
      const category = result["clauseCategory"] as string;
      const originalText = origByCategory.get(category) ?? result["clauseSummary"] as string ?? "";
      const finalText = finalByCategory.get(category);
      const rule = ruleByCategory.get(category);

      try {
        let llmOutcome: DeltaOutcome = "NO_CHANGE";
        let confidence = 0.5;
        let reasoning = "No final clause text found - assuming no change.";

        if (!finalText) {
          // Clause was removed in final version
          llmOutcome = "REMOVED";
          confidence = 0.9;
          reasoning = "This clause category was not found in the final signed document.";
        } else if (originalText) {
          // Call LLM to classify
          const prompt = `You are comparing two versions of a contract clause to determine how a negotiation resolved.

Original clause: ${originalText}

Final clause: ${finalText}

${rule ? `The company's playbook preferred position is: ${rule["preferredPosition"] as string}
Fallback is: ${rule["acceptableFallback"] as string}
Red line is: ${rule["hardRedLine"] as string}` : "No playbook rule available for this clause category."}

Classify the outcome as exactly one of:
- PREFERRED (final matches or is better than preferred position)
- FALLBACK (final matches acceptable fallback - an acceptable compromise)
- BELOW_FALLBACK (final is worse than fallback - below or near the red line)
- NO_CHANGE (no meaningful change from original)
- REMOVED (clause was removed entirely)

Return ONLY valid JSON:
{"outcome": "PREFERRED|FALLBACK|BELOW_FALLBACK|NO_CHANGE|REMOVED", "confidence": 0.0-1.0, "reasoning": "one sentence explanation"}`;

          const raw = await chatComplete([{ role: "user", content: prompt }], 300);
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]) as { outcome: DeltaOutcome; confidence: number; reasoning: string };
            llmOutcome = parsed.outcome;
            confidence = parsed.confidence;
            reasoning = parsed.reasoning;
          }
        }

        // Create the outcome_delta record
        await pb.collection("outcome_deltas").create({
          company: companyId,
          document: originalDocId,
          finalDocument: finalDocId,
          clauseCategory: category,
          originalStatus: result["ragStatus"] as string,
          originalClauseText: originalText,
          finalClauseText: finalText ?? "",
          llmOutcome,
          confirmedOutcome: "",
          confirmedBy: "",
          confirmedAt: null,
          notes: reasoning,
          llmConfidence: String(confidence),
        });
      } catch (err) {
        console.error(`[deltaComparison] Error processing clause ${category}:`, err);
        // Continue with next clause
      }
    }

    console.log(`[deltaComparison] Completed for ${originalDocId} → ${finalDocId}`);
  } catch (err) {
    console.error("[deltaComparison] runDeltaComparison failed:", err);
    // Never throws - fire-and-forget safe
  }
}
