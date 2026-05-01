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

type Persona = "CORPORATE" | "FOUNDER" | "PE_FUND";

function personaContext(persona: Persona, companyName: string, sector: string): { role: string; audienceNote: string; actionStyle: string } {
  switch (persona) {
    case "FOUNDER":
      return {
        role: `You are MIKE, a legal intelligence layer for ${companyName}, a ${sector} startup. You are helping the founder understand contract and investment document risk.`,
        audienceNote: "The reader is a commercially savvy founder, not a lawyer. Be direct and founder-focused: what does this mean for your equity, your control, your ability to run the company?",
        actionStyle: "Frame negotiation points as founder leverage. Flag investor-friendly traps plainly. If a clause is standard market practice, say so - founders should know what is and isn't worth fighting.",
      };
    case "PE_FUND":
      return {
        role: `You are MIKE, a legal intelligence layer for ${companyName}, a ${sector} fund. You are reviewing contracts in a deal or due diligence context.`,
        audienceNote: "The reader is an investment professional. Focus on deal risk, valuation impact, post-acquisition integration issues, and anything that would affect the investment thesis.",
        actionStyle: "Flag issues that require price adjustment, reps & warranties coverage, or deal restructuring. Note regulatory exposure that could affect hold period or exit.",
      };
    case "CORPORATE":
    default:
      return {
        role: `You are MIKE, a legal risk decision engine for ${companyName} (${sector}).`,
        audienceNote: "The reader is an in-house legal team or business stakeholder. Be direct, specific, and commercially pragmatic.",
        actionStyle: "Frame output as actionable instructions for a contract negotiation: what to accept, what to push back on, and who needs to approve exceptions.",
      };
  }
}

export async function compareClauseToPlaybook(
  clauseText: string,
  rule: PlaybookRule,
  companyName: string,
  sector: string,
  regulatoryContext: string = "",
  persona: Persona = "CORPORATE"
): Promise<ComparisonResult> {
  const ctx = personaContext(persona, companyName, sector);

  const systemPrompt = `${ctx.role}
${ctx.audienceNote}
${ctx.actionStyle}

Playbook Rule for ${rule.clauseCategory}:
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
  "whyItMatters": "Why this matters for ${companyName} specifically - tied to the playbook and any applicable regulations",
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
  rule: PlaybookRule,
  persona: Persona = "CORPORATE"
): ComparisonResult {
  const label = category.replace(/_/g, " ").toLowerCase();
  const businessSummaries: Record<Persona, string> = {
    CORPORATE: `The contract doesn't include a ${label} clause. This gap needs to be filled before signing - ask the counterparty to add one.`,
    FOUNDER: `This document is silent on ${label}. That silence typically works in the counterparty's favour. Before signing, request that a clause is added reflecting your position.`,
    PE_FUND: `No ${label} provision found in this document. In a deal context, an absent ${label} clause is a risk item - flag for legal and ensure it is addressed in the final transaction documents.`,
  };
  return {
    ragStatus: "GREY",
    clauseSummary: `No ${label} clause found in the counterparty paper.`,
    whyItMatters: `The absence of this clause leaves your position unprotected. Counterparty paper that is silent on ${label} typically defaults to the counterparty's favour.`,
    recommendedAction: `Request insertion of a ${label} clause reflecting your preferred position.`,
    suggestedFallback: rule.fallbackTemplate ?? rule.preferredPosition,
    escalationRequired: false,
    escalationTrigger: "",
    businessSummary: businessSummaries[persona],
    confidence: 1,
  };
}
