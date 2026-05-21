import { llmJsonCall } from "./llmJsonParse.js";
import { buildContextBlock } from "./contextInjector.js";

// Minimal shape of a playbook rule record needed by this module
interface PlaybookRule {
  clauseCategory: string;
  preferredPosition: string;
  acceptableFallback: string;
  hardRedLine: string;
  approvalRequired?: string | null;
  fallbackTemplate?: string | null;
  [key: string]: unknown;
}

export type RagStatus = "RED" | "AMBER" | "GREEN" | "GREY";
export type ConfidenceLabel = "HIGH" | "MEDIUM" | "LOW";

export interface RegulatoryCitation {
  /** Specific article, section or rule number */
  article: string;
  /** Name of the regulation or framework */
  regulation: string;
  /** One-sentence relevance note */
  relevance: string;
}

export type FounderStatus = "SAFE" | "CAUTION" | "DO NOT SIGN YET";

export interface ComparisonResult {
  ragStatus: RagStatus;
  /** Explicit comparison: "Your playbook says X, this clause says Y, these carve-outs are missing." */
  comparisonStatement: string;
  clauseSummary: string;
  whyItMatters: string;
  recommendedAction: string;
  suggestedFallback: string;
  escalationRequired: boolean;
  escalationTrigger: string;
  businessSummary: string;
  /** Qualitative confidence — LOW triggers mandatory lawyer review flag in the UI */
  confidenceLabel: ConfidenceLabel;
  /** Specific regulatory references (article numbers, regulation names) cited in this analysis */
  regulatoryCitations: RegulatoryCitation[];
  // ── Founder-specific fields (always generated; founder interface renders these) ──
  founderStatus: FounderStatus;
  founderPlainEnglish: string;
  founderBusinessImpact: string;
  founderAskFor: string;
  founderCopyPaste: string;
  founderFundraisingRelevance: string;
  founderIfIgnored: string;
}

type Persona = "CORPORATE" | "FOUNDER";
type WorkflowType = "COMMERCIAL_CONTRACT" | "INSURANCE_LITIGATION" | "LOGISTICS_CONTRACT";

function personaContext(persona: Persona, companyName: string, sector: string): { role: string; audienceNote: string; actionStyle: string } {
  switch (persona) {
    case "FOUNDER":
      return {
        role: `You are Zane, a legal intelligence layer for ${companyName}, a ${sector} startup. You are helping the founder understand contract and investment document risk.`,
        audienceNote: "The reader is a commercially savvy founder, not a lawyer. Be direct and founder-focused: what does this mean for your equity, your control, your ability to run the company?",
        actionStyle: "Frame negotiation points as founder leverage. Flag investor-friendly traps plainly. If a clause is standard market practice, say so - founders should know what is and isn't worth fighting.",
      };
    case "CORPORATE":
    default:
      return {
        role: `You are Zane, a legal risk decision engine for ${companyName} (${sector}).`,
        audienceNote: "The reader is an in-house legal team or business stakeholder. Be direct, specific, and commercially pragmatic.",
        actionStyle: "Frame output as actionable instructions for a contract negotiation: what to accept, what to push back on, and who needs to approve exceptions.",
      };
  }
}

function workflowContext(workflowType: WorkflowType): { role: string; audienceNote: string; actionStyle: string } | null {
  switch (workflowType) {
    case "INSURANCE_LITIGATION":
      return {
        role: "You are Zane, a legal intelligence layer for insurance litigation teams. You assess claims and coverage positions against regulatory obligations and settlement authority frameworks.",
        audienceNote: "The reader is in-house litigation counsel. Be precise on coverage analysis, quantum, and FCA regulatory obligations. Cite FCA Handbook (ICOBS, DISP) and FOS decisions where relevant.",
        actionStyle: "Frame output as litigation management instructions: coverage position, defence prospects, reserve adequacy, settlement authority level, and any regulatory flags requiring immediate action.",
      };
    case "LOGISTICS_CONTRACT":
      return {
        role: "You are Zane, a legal risk analyser for logistics and supply chain legal teams. You assess carrier, customer, and warehouse contracts against company positions and logistics-specific regulatory obligations including CMR Convention, BIFA standard trading conditions, and trade compliance requirements.",
        audienceNote: "The reader is Head of Legal at a logistics business. Speak logistics language: cargo, consignments, hauliers, SLAs, CMR limits. Commercial and operational impact matters more than abstract legal risk.",
        actionStyle: "Frame output as contract negotiation instructions for a logistics business: what CMR limits apply, whether subcontracting rights are adequate, whether liability exposure exceeds insurance cover.",
      };
    default:
      return null;
  }
}

export async function compareClauseToPlaybook(
  clauseText: string,
  rule: PlaybookRule,
  companyName: string,
  sector: string,
  regulatoryContext: string = "",
  persona: Persona = "CORPORATE",
  workflowType: string = "COMMERCIAL_CONTRACT",
  companyId: string = "",
  counterpartyType: string = "",
  contractType: string = ""
): Promise<ComparisonResult> {
  const wfCtx = workflowContext(workflowType as WorkflowType);
  const ctx = wfCtx ?? personaContext(persona, companyName, sector);

  // ── Inject accumulated company signals ──────────────────────────────────────
  let accumulatedSignals = "";
  if (companyId) {
    try {
      accumulatedSignals = await buildContextBlock(
        companyId,
        rule.clauseCategory,
        counterpartyType,
        contractType
      );
    } catch {
      // Non-fatal — proceed without signals
    }
  }

  const signalsBlock = accumulatedSignals
    ? `\n\n--- ACCUMULATED COMPANY SIGNALS ---\n${accumulatedSignals}\n--- END SIGNALS ---`
    : "";

  const systemPrompt = `${ctx.role}
${ctx.audienceNote}
${ctx.actionStyle}

Playbook Rule for ${rule.clauseCategory}:
- Preferred position: ${rule.preferredPosition}
- Acceptable fallback: ${rule.acceptableFallback}
- Hard red line: ${rule.hardRedLine}
- Approval required for exceptions: ${rule.approvalRequired ?? "None specified"}
${rule.fallbackTemplate ? `- Preferred fallback wording: ${rule.fallbackTemplate}` : ""}${regulatoryContext}${signalsBlock}`;

  const userPrompt = `Review this clause and compare it against the playbook rule above.

CLAUSE TEXT:
${clauseText}

Return ONLY valid JSON with this exact structure:
{
  "ragStatus": "RED" | "AMBER" | "GREEN",
  "comparisonStatement": "EXACT format: 'Your playbook requires [X]. This clause provides [Y]. The following protections are missing: [Z].' Be specific — name the actual words, caps, carve-outs, or conditions that differ.",
  "clauseSummary": "1-2 sentence plain English summary of what the clause actually says",
  "whyItMatters": "Why this matters for ${companyName} specifically — tied to the playbook and any applicable regulations",
  "recommendedAction": "Specific action: accept / push back / push back strongly / escalate",
  "suggestedFallback": "Specific redraft or negotiation talking point",
  "escalationRequired": true | false,
  "escalationTrigger": "Condition under which escalation is mandatory (or empty string if none)",
  "businessSummary": "One paragraph in plain English for a non-lawyer stakeholder",
  "confidenceLabel": "HIGH" | "MEDIUM" | "LOW",
  "regulatoryCitations": [
    { "article": "Article 28", "regulation": "UK GDPR", "relevance": "One sentence on why this article applies" }
  ],
  "founderStatus": "SAFE" | "CAUTION" | "DO NOT SIGN YET",
  "founderPlainEnglish": "1-2 sentences a founder would understand — what this clause actually means for running the business",
  "founderBusinessImpact": "Commercial impact if this clause is accepted as written — what it costs, what it prevents, what it exposes",
  "founderAskFor": "Specific and direct ask — the exact change to request from the counterparty",
  "founderCopyPaste": "Exact wording a founder can paste into an email or negotiation — ready to send",
  "founderFundraisingRelevance": "How this clause affects fundraising, investor diligence, or future deal terms — or 'Not relevant to fundraising' if it does not",
  "founderIfIgnored": "What happens commercially and legally if the founder signs without negotiating this"
}

RAG rules:
- GREEN: clause meets preferred position or acceptable fallback
- AMBER: clause is below preferred but above red line; negotiation needed
- RED: clause breaches red line or is missing a required protection

Confidence rules:
- HIGH: clause text is clear and your comparison is definitive
- MEDIUM: clause is ambiguous or partially overlapping — some interpretation required
- LOW: clause is unclear, heavily cross-referenced, or you cannot confirm the position from the text alone; flag for mandatory lawyer review

Regulatory citations: include only citations where you can name the specific article or rule number. If none apply, return an empty array.`;

  return await llmJsonCall<ComparisonResult>({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt },
    ],
    maxTokens: 4000,
    description: `playbook comparison for ${rule.clauseCategory}`,
  });
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
  };
  return {
    ragStatus: "GREY",
    comparisonStatement: `Your playbook requires a ${label} clause. This contract contains no ${label} clause. All protections under this heading are absent.`,
    clauseSummary: `No ${label} clause found in the counterparty paper.`,
    whyItMatters: `The absence of this clause leaves your position unprotected. Counterparty paper that is silent on ${label} typically defaults to the counterparty's favour.`,
    recommendedAction: `Request insertion of a ${label} clause reflecting your preferred position.`,
    suggestedFallback: rule.fallbackTemplate ?? rule.preferredPosition,
    escalationRequired: false,
    escalationTrigger: "",
    businessSummary: businessSummaries[persona],
    confidenceLabel: "HIGH" as ConfidenceLabel,
    regulatoryCitations: [],
    founderStatus: "CAUTION",
    founderPlainEnglish: `This contract says nothing about ${label}. That's a gap you need to address before signing.`,
    founderBusinessImpact: `Without a ${label} clause, you have no contractual protection on this point. The counterparty's standard terms or common law defaults will apply — usually in their favour.`,
    founderAskFor: `Ask the counterparty to add a ${label} clause. Use the suggested wording below as a starting point.`,
    founderCopyPaste: rule.fallbackTemplate ?? rule.preferredPosition,
    founderFundraisingRelevance: `Investors will expect standard ${label} protections. A contract silent on this point may require renegotiation before a deal closes.`,
    founderIfIgnored: `If you sign without a ${label} clause, you accept whatever default applies under the governing law — typically the counterparty's interpretation. This could create liability or remove protection you assumed you had.`,
  };
}
