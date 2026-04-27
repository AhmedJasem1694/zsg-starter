import OpenAI from "openai";
import type { PlaybookRule } from "@prisma/client";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-5";

export type RagStatus = "RED" | "AMBER" | "GREEN" | "GREY";

export interface ComparisonResult {
  ragStatus: RagStatus;
  clauseSummary: string;
  whyItMatters: string;
  recommendedAction: string;
  suggestedFallback: string;
  escalationRequired: boolean;
  escalationTrigger: string;
  businessSummary: string;
  confidence: number;
}

export async function compareClauseToPlaybook(
  clauseText: string,
  rule: PlaybookRule,
  companyName: string,
  sector: string,
  regulatoryContext: string = ""
): Promise<ComparisonResult> {
  const systemPrompt = `You are MIKE, a legal risk decision engine for ${companyName} (${sector}).
Your job is to compare contract clauses against the company's legal playbook and produce structured risk assessments.
Be direct, specific, and commercially pragmatic — not a generic legal textbook.

Company Playbook Rule for ${rule.clauseCategory}:
- Preferred position: ${rule.preferredPosition}
- Acceptable fallback: ${rule.acceptableFallback}
- Hard red line: ${rule.hardRedLine}
- Approval required for exceptions: ${rule.approvalRequired ?? "None specified"}
${rule.fallbackTemplate ? `- Preferred fallback wording: ${rule.fallbackTemplate}` : ""}${regulatoryContext}`;

  const userPrompt = `Review this clause and compare it against the playbook rule above.

CLAUSE TEXT:
${clauseText}

Return ONLY valid JSON with this exact structure:
{
  "ragStatus": "RED" | "AMBER" | "GREEN",
  "clauseSummary": "1-2 sentence plain English summary of what the clause actually says",
  "whyItMatters": "Why this is a problem for ${companyName} specifically — tied to the playbook and any applicable regulations",
  "recommendedAction": "Specific action: accept / push back / push back strongly / escalate",
  "suggestedFallback": "Specific redraft or negotiation talking point",
  "escalationRequired": true | false,
  "escalationTrigger": "Condition under which escalation is mandatory (or empty string)",
  "businessSummary": "One paragraph in plain English for a non-lawyer stakeholder",
  "confidence": 0.0-1.0
}

RAG rules:
- GREEN: clause meets preferred position or acceptable fallback
- AMBER: clause is below preferred but above red line; negotiation needed
- RED: clause breaches red line or is missing a required protection`;

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");

  return JSON.parse(jsonMatch[0]) as ComparisonResult;
}

export function buildAbsentClauseResult(
  category: string,
  rule: PlaybookRule
): ComparisonResult {
  return {
    ragStatus: "GREY",
    clauseSummary: `No ${category.replace(/_/g, " ").toLowerCase()} clause found in the counterparty paper.`,
    whyItMatters: `The absence of this clause leaves your position unprotected. Counterparty paper that is silent on ${category.replace(/_/g, " ").toLowerCase()} typically defaults to the counterparty's favour.`,
    recommendedAction: `Request insertion of a ${category.replace(/_/g, " ").toLowerCase()} clause reflecting your preferred position.`,
    suggestedFallback: rule.fallbackTemplate ?? rule.preferredPosition,
    escalationRequired: false,
    escalationTrigger: "",
    businessSummary: `The contract doesn't include a ${category.replace(/_/g, " ").toLowerCase()} clause. This gap needs to be filled before signing — ask the counterparty to add one.`,
    confidence: 1,
  };
}
