/**
 * Contradiction Detector
 *
 * After clause extraction, runs a second LLM pass to identify internal
 * contradictions in the contract — e.g. one clause says liability is capped
 * at £500k while another implies unlimited exposure; or a confidentiality
 * clause is narrower than the NDA cross-referenced in the agreement.
 *
 * Returns an array of contradiction findings (empty if none detected).
 * These are stored as a JSON blob on the uploaded_document record and
 * surfaced in the review UI.
 */

import { chatComplete } from "./openrouter.js";

export interface ContradictionFinding {
  /** Short label for the conflict */
  title: string;
  /** The first clause category involved */
  clauseA: string;
  /** The second clause category involved */
  clauseB: string;
  /** Plain-English explanation of the contradiction */
  explanation: string;
  /** Severity: HIGH = potential trap / liability risk; MEDIUM = ambiguity; LOW = drafting inconsistency */
  severity: "HIGH" | "MEDIUM" | "LOW";
  /** Specific recommendation to resolve the contradiction */
  recommendation: string;
}

/**
 * Run contradiction detection across all extracted clauses for a document.
 *
 * @param extractedClauses  Map of category → raw clause text (already de-anonymised)
 * @param companyName       Used in the system prompt context
 * @param workflowType      COMMERCIAL_CONTRACT | INSURANCE_LITIGATION | LOGISTICS_CONTRACT
 */
export async function detectContradictions(
  extractedClauses: Map<string, string>,
  companyName: string,
  workflowType: string
): Promise<ContradictionFinding[]> {
  if (extractedClauses.size < 2) return []; // Need at least 2 clauses to compare

  // Build clause summary for the prompt
  const clauseLines = Array.from(extractedClauses.entries())
    .map(([cat, text]) => `[${cat}]\n${text.slice(0, 600)}`) // cap at 600 chars per clause
    .join("\n\n---\n\n");

  const systemPrompt = `You are a legal contract analyst for ${companyName}. Your task is to identify internal contradictions within a single contract — cases where two or more clauses conflict with each other, create ambiguity, or produce unexpected combined effects.

Workflow: ${workflowType.replace(/_/g, " ").toLowerCase()}

Focus on contradictions with real commercial or legal consequence. Ignore minor drafting inconsistencies. Return only findings that a lawyer would flag.`;

  const userPrompt = `Review the following extracted contract clauses for internal contradictions:

${clauseLines}

Return ONLY valid JSON:
{
  "contradictions": [
    {
      "title": "Short description of the conflict (max 10 words)",
      "clauseA": "CLAUSE_CATEGORY_1",
      "clauseB": "CLAUSE_CATEGORY_2",
      "explanation": "Plain-English explanation of how these clauses conflict",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "recommendation": "Specific advice on how to resolve the contradiction"
    }
  ]
}

If no contradictions are found, return: { "contradictions": [] }

Severity guide:
- HIGH: Creates material liability risk, regulatory exposure, or unenforceable terms
- MEDIUM: Creates ambiguity that could lead to disputes
- LOW: Drafting inconsistency that should be cleaned up`;

  try {
    const text = await chatComplete(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      2000
    );

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as { contradictions: ContradictionFinding[] };
    return parsed.contradictions ?? [];
  } catch (err) {
    console.error("[ContradictionDetector] Detection failed:", err);
    return [];
  }
}
