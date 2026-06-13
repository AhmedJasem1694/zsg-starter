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
  /** Qualitative confidence - LOW triggers mandatory lawyer review flag in the UI */
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
  // ── IRAC framework fields ──
  iracIssue: string;        // One sentence: the exact legal question this clause raises
  iracRule: string;         // What the contract says + applicable legal principle
  iracApplication: string;  // How the rule applies to this clause; strongest counterargument addressed
  iracConclusion: string;   // Three-level: legal answer, risk probability/materiality, specific recommendation
  // ── Classification ──
  urgencyLevel: "IMMEDIATE" | "MATERIAL" | "BACKGROUND";
  errorCategory: "SUBSTANTIVE_RISK" | "DRAFTING_ERROR" | "MECHANICAL_ERROR";
}

type Persona = "CORPORATE" | "FOUNDER";
type WorkflowType = "COMMERCIAL_CONTRACT" | "INSURANCE_LITIGATION" | "LOGISTICS_CONTRACT" | "HEALTHCARE_PROCUREMENT";

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
    case "HEALTHCARE_PROCUREMENT":
      return {
        role: "You are Zane, a legal risk analyser specialising in NHS and healthcare procurement. You assess healthcare supplier contracts and NHS body agreements against regulatory obligations including the Public Contracts Regulations 2015, Procurement Act 2023, NHS Standard Contract requirements, CQC registration obligations, UK GDPR Article 9 (special category health data), the ABPI Code, and NHS Counter Fraud Authority guidance.",
        audienceNote: "The reader is in-house legal counsel or a procurement professional at an NHS body, healthcare provider, or NHS supplier. Be precise on regulatory compliance: reference the PCR 2015 regulation numbers, CQC fundamental standards, NHS Standard Contract clause numbers, and Article 9 lawful bases. Patient safety and data protection are never tradeable for commercial convenience.",
        actionStyle: "Frame output as procurement and contractual risk instructions: whether the procurement basis is legally sound, whether patient data protections meet Article 9 standards, whether clinical negligence indemnity is uncapped, whether CQC registration obligations are present, and what immediate escalation is required for non-compliant provisions. Always flag provisions that would expose the NHS body to judicial review or ICO enforcement.",
      };
    default:
      return null;
  }
}

// ─── Shared prompt fragments (single + batched comparison) ───────────────────

/** The per-clause result JSON schema. extraFirstLine lets the batched call add a clauseCategory discriminator. */
function resultJsonSchema(companyName: string, extraFirstLine: string = ""): string {
  return `{${extraFirstLine ? `\n  ${extraFirstLine}` : ""}
  "ragStatus": "RED" | "AMBER" | "GREEN",
  "comparisonStatement": "EXACT format: 'Your playbook requires [X]. This clause provides [Y]. The following protections are missing: [Z].' Be specific - name the actual words, caps, carve-outs, or conditions that differ.",
  "clauseSummary": "1-2 sentence plain English summary of what the clause actually says",
  "whyItMatters": "Why this matters for ${companyName} specifically - tied to the playbook and any applicable regulations",
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
  "founderPlainEnglish": "1-2 sentences a founder would understand, what THIS specific clause (as written above) actually means. Base it only on the clause text provided. Do not invent implications not in the text.",
  "founderBusinessImpact": "Commercial impact if this clause is accepted as written - what it costs, what it prevents, what it exposes",
  "founderAskFor": "Specific and direct ask - the exact change to request from the counterparty",
  "founderCopyPaste": "A short professional email the founder can paste and send to request the change. Rules: (1) Address to 'Dear [Counterparty Name]', using that exact placeholder, never invent a name. (2) Reference ONLY specific terms, caps, or numbers that appear verbatim in the clause text above, never invent figures. (3) State the specific change being requested. (4) Sign off as '[Your Name]'. (5) Maximum 150 words. (6) No legal jargon. Example format: 'Dear [Counterparty Name], Thanks for sending across the agreement. One clause needs changing before we can sign: [clause name]. Currently it says [quote or paraphrase from actual clause]. We need it changed to [specific request]. Please confirm you can make this amendment. Thanks, [Your Name]'",
  "founderFundraisingRelevance": "How this clause affects fundraising, investor diligence, or future deal terms - or 'Not relevant to fundraising' if it does not",
  "founderIfIgnored": "Specific commercial consequence of signing this clause AS WRITTEN. Use only figures and terms from the clause text. If the clause caps liability at £X, say £X. If no specific figure is in the clause, say 'whatever the default position is under the governing law' rather than inventing a number.",
  "iracIssue": "One precise sentence stating the exact legal question this clause raises - not a summary of the clause but the specific legal question to be answered",
  "iracRule": "What the contract says PLUS the applicable legal principle in 1-2 sentences. Quote or paraphrase the relevant clause. Cite the regulatory provision where applicable.",
  "iracApplication": "How the rule applies to this specific clause against the company's playbook position. Go through each element systematically. Acknowledge the strongest counterargument and explain why it does not change the conclusion. Identify genuine uncertainty.",
  "iracConclusion": "Three-level conclusion: (1) Legal answer - what the position is. (2) Risk assessment - probability and materiality of the risk. (3) Specific recommendation - what to do, in what order, before what deadline.",
  "urgencyLevel": "IMMEDIATE" | "MATERIAL" | "BACKGROUND",
  "errorCategory": "SUBSTANTIVE_RISK" | "DRAFTING_ERROR" | "MECHANICAL_ERROR"
}`;
}

/** RAG / confidence / citation / urgency / error-category rules shared by both prompts. */
const OUTPUT_RULES_BLOCK = `RAG rules (CRITICAL, follow exactly):
- GREEN: clause meets preferred position or acceptable fallback
- AMBER: clause is below preferred but above red line; negotiation needed
- RED: clause breaches red line or is missing a required protection
- NEVER return GREY. GREY is reserved exclusively for absent clauses and is handled separately. If you are uncertain, return AMBER.

Confidence rules:
- HIGH: clause text is clear and your comparison is definitive
- MEDIUM: clause is ambiguous or partially overlapping - some interpretation required
- LOW: clause is unclear, heavily cross-referenced, or you cannot confirm the position from the text alone; flag for mandatory lawyer review

Regulatory citations: include only citations where you can name the specific article or rule number. If none apply, return an empty array.

Urgency rules:
- IMMEDIATE: requires action before the contract can proceed. A red line breach, a governance trigger requiring board sign-off, or a regulatory compliance issue that could invalidate the contract.
- MATERIAL: determines the commercial outcome. High-value clauses, IP ownership, liability exposure, key commercial terms.
- BACKGROUND: important but not blocking. Audit rights, notice periods, minor deviations from playbook.

Error category rules:
- SUBSTANTIVE_RISK: the clause creates a legal or commercial risk based on its content.
- DRAFTING_ERROR: the clause or document contains a structural error that could undermine legal effectiveness (undefined terms, broken cross-references, missing subjects).
- MECHANICAL_ERROR: typographical or transcription error that may be legally material (inconsistent numbers, ambiguous date formats, party name errors).`;

const RECOMMENDATION_DISCIPLINE = `RECOMMENDATION DISCIPLINE: Never give a conclusion that says it could go either way without providing a view. Always commit to a recommendation while noting material uncertainty. Structure every conclusion as: "My recommendation is [X] because [Y]. The risk of this being wrong is [Z]. If [Z] materialises, the consequence is [W]." Remove any hedging that does not add specific information. Phrases like "it may" or "it could" or "depending on the circumstances" are only acceptable if followed immediately by the specific condition that would change the recommendation.

HARD RULE: Never use em dashes or en dashes in any output. Use a comma or a full stop instead.`;

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
  contractType: string = "",
  isIndirectReference: boolean = false,
  indirectClauseRef: string = "",
  modelOverride?: string,
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
      // Non-fatal - proceed without signals
    }
  }

  const signalsBlock = accumulatedSignals
    ? `\n\n--- ACCUMULATED COMPANY SIGNALS ---\n${accumulatedSignals}\n--- END SIGNALS ---`
    : "";

  const indirectNote = isIndirectReference
    ? `\n\nNOTE: INDIRECT REFERENCE. The subject matter of ${rule.clauseCategory.replace(/_/g, " ")} is not present as a dedicated clause. It is addressed indirectly${indirectClauseRef ? ` at ${indirectClauseRef}` : " within another clause"}. Your analysis must:
1. Begin clauseSummary with "${rule.clauseCategory.replace(/_/g, " ")} (addressed indirectly${indirectClauseRef ? ` at ${indirectClauseRef}` : ""}): " then explain what the contract actually says
2. Begin comparisonStatement with "${rule.clauseCategory.replace(/_/g, " ")} (addressed indirectly): "
3. Assess whether this indirect treatment adequately meets, falls below, or breaches the playbook position
4. Set ragStatus based on that assessment (GREEN if adequate, AMBER if below preferred, RED if it breaches the red line or critical protections are missing)`
    : "";

  const systemPrompt = `${ctx.role}
${ctx.audienceNote}
${ctx.actionStyle}${indirectNote}

${RECOMMENDATION_DISCIPLINE}

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
${resultJsonSchema(companyName)}

${OUTPUT_RULES_BLOCK}`;

  return await llmJsonCall<ComparisonResult>({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt },
    ],
    maxTokens: 4000,
    description: `playbook comparison for ${rule.clauseCategory}`,
    model: modelOverride,
  });
}

// ─── Batched comparison (cost optimisation) ──────────────────────────────────
// All playbook comparisons for a contract run as ONE Sonnet request containing
// every present clause, with a structured JSON array output, instead of one
// request per clause. System prompt + persona + rules are paid for once.
// Callers fall back to compareClauseToPlaybook for any clause missing from the
// batch response (or if the whole batch call fails).

export interface BatchClauseInput {
  clauseText: string;
  rule: PlaybookRule;
  /** Per-clause regulatory context (company summary + clause-specific provisions) */
  regulatoryContext: string;
  isIndirectReference: boolean;
  indirectClauseRef: string;
}

export async function compareClausesBatch(
  clauses: BatchClauseInput[],
  companyName: string,
  sector: string,
  persona: Persona = "CORPORATE",
  workflowType: string = "COMMERCIAL_CONTRACT",
  companyId: string = "",
  counterpartyType: string = "",
  contractType: string = "",
  modelOverride?: string,
): Promise<Map<string, ComparisonResult>> {
  if (clauses.length === 0) return new Map();

  const wfCtx = workflowContext(workflowType as WorkflowType);
  const ctx = wfCtx ?? personaContext(persona, companyName, sector);

  // Per-clause accumulated company signals, fetched in parallel (non-fatal).
  // Capped per clause so signals can't blow up the batched prompt.
  const signalBlocks = await Promise.all(
    clauses.map(async (c) => {
      if (!companyId) return "";
      try {
        const block = await buildContextBlock(companyId, c.rule.clauseCategory, counterpartyType, contractType);
        return block ? block.slice(0, 1500) : "";
      } catch {
        return "";
      }
    })
  );

  const sections = clauses.map((c, i) => {
    const cat = c.rule.clauseCategory;
    const label = cat.replace(/_/g, " ");
    const indirectNote = c.isIndirectReference
      ? `\nNOTE: INDIRECT REFERENCE. ${label} is not a dedicated clause. It is addressed indirectly${c.indirectClauseRef ? ` at ${c.indirectClauseRef}` : " within another clause"}. Begin clauseSummary with "${label} (addressed indirectly${c.indirectClauseRef ? ` at ${c.indirectClauseRef}` : ""}): " and comparisonStatement with "${label} (addressed indirectly): ", then assess whether the indirect treatment meets, falls below, or breaches the playbook position.`
      : "";
    return `### CLAUSE ${i + 1} of ${clauses.length}: ${cat}
Playbook rule:
- Preferred position: ${c.rule.preferredPosition}
- Acceptable fallback: ${c.rule.acceptableFallback}
- Hard red line: ${c.rule.hardRedLine}
- Approval required for exceptions: ${c.rule.approvalRequired ?? "None specified"}
${c.rule.fallbackTemplate ? `- Preferred fallback wording: ${c.rule.fallbackTemplate}\n` : ""}${c.regulatoryContext ? `Regulatory context:\n${c.regulatoryContext}\n` : ""}${signalBlocks[i] ? `Accumulated company signals:\n${signalBlocks[i]}\n` : ""}${indirectNote}
CLAUSE TEXT:
${c.clauseText}`;
  }).join("\n\n────────────────────\n\n");

  const systemPrompt = `${ctx.role}
${ctx.audienceNote}
${ctx.actionStyle}

${RECOMMENDATION_DISCIPLINE}

You will be given ${clauses.length} clauses from one contract, each with its own playbook rule. Analyse EVERY clause independently and completely against its own rule. Do not let one clause's analysis bleed into another's.`;

  const userPrompt = `Review EACH of the ${clauses.length} clauses below against its own playbook rule.

${sections}

Return ONLY a valid JSON array with EXACTLY ${clauses.length} elements, one per clause, in the same order as presented. Each element must follow this exact structure (note the "clauseCategory" field identifying which clause it analyses):
${resultJsonSchema(companyName, `"clauseCategory": "THE_CLAUSE_CATEGORY_FROM_THE_HEADER",`)}

${OUTPUT_RULES_BLOCK}`;

  const raw = await llmJsonCall<Array<ComparisonResult & { clauseCategory: string }>>({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt },
    ],
    // Output scales with clause count (~1.2-1.7K tokens per full result)
    maxTokens: Math.min(24_000, 2_500 + 1_700 * clauses.length),
    timeoutMs: 240_000,
    description: `batched playbook comparison (${clauses.length} clauses)`,
    model: modelOverride,
  });

  const out = new Map<string, ComparisonResult>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === "object" && typeof item.clauseCategory === "string") {
        out.set(item.clauseCategory, item as ComparisonResult);
      }
    }
  }
  return out;
}

// ─── Favourable-when-absent logic ────────────────────────────────────────────
// Some clause categories are actually better for the reviewing party when absent.
// Example: no AUTO_RENEWAL clause = no lock-in without active renewal choice.

export const FAVOURABLE_WHEN_ABSENT = new Set([
  "AUTO_RENEWAL",       // no auto-renewal = cannot be locked in
  "NON_SOLICITATION",   // no restriction = free to hire counterparty staff
  "LIQUIDATED_DAMAGES", // no pre-set penalties = service provider not exposed to fixed damages
]);

const FAVOURABLE_ABSENT_REASONS: Record<string, string> = {
  AUTO_RENEWAL:       "No auto-renewal clause means the contract cannot renew without your active agreement. You cannot be locked in. This is favourable to the customer/buyer.",
  NON_SOLICITATION:   "No non-solicitation restriction means you are free to hire staff from the counterparty's team without penalty.",
  LIQUIDATED_DAMAGES: "No liquidated damages clause means you are not exposed to pre-set financial penalties for delay or breach. Liability is limited to proven actual loss.",
};

export function buildFavourableAbsentResult(
  category: string,
  rule: PlaybookRule,
  persona: Persona = "CORPORATE"
): ComparisonResult {
  const label = category.replace(/_/g, " ").toLowerCase();
  const reason = FAVOURABLE_ABSENT_REASONS[category] ?? `The absence of a ${label} clause is favourable in this context.`;
  return {
    ragStatus: "GREEN",
    comparisonStatement: `${label}: Absent and favourable. ${reason}`,
    clauseSummary: `No ${label} clause found. Absence is favourable: ${reason}`,
    whyItMatters: reason,
    recommendedAction: "No action required. The absence of this clause works in your favour. Do not request it be added.",
    suggestedFallback: "",
    escalationRequired: false,
    escalationTrigger: "",
    businessSummary: reason,
    confidenceLabel: "HIGH" as ConfidenceLabel,
    regulatoryCitations: [],
    founderStatus: "SAFE" as FounderStatus,
    founderPlainEnglish: reason,
    founderBusinessImpact: `The absence of this clause benefits you. ${reason}`,
    founderAskFor: "No change needed. Leave this clause absent.",
    founderCopyPaste: "",
    founderFundraisingRelevance: "Not relevant to fundraising.",
    founderIfIgnored: "No action needed. You are protected by the absence of this clause.",
    iracIssue: `Whether the absence of a ${label} clause is favourable or unfavourable to the reviewing party.`,
    iracRule: `The contract contains no ${label} clause.`,
    iracApplication: reason,
    iracConclusion: `My recommendation is to leave this clause absent. The risk of requesting it is that you introduce an obligation that currently does not exist. ${reason}`,
    urgencyLevel: "BACKGROUND" as "IMMEDIATE" | "MATERIAL" | "BACKGROUND",
    errorCategory: "SUBSTANTIVE_RISK" as "SUBSTANTIVE_RISK" | "DRAFTING_ERROR" | "MECHANICAL_ERROR",
  };
}

const ABSENT_CLAUSE_CRITICAL_CATEGORIES = new Set([
  "LIABILITY_CAP",
  "DATA_PRIVACY",
  "GOVERNING_LAW",
  "TERMINATION",
  "CONFIDENTIALITY",
  "INDEMNITY",
]);

// Contract types that are SaaS or technology services: insurance is optional/standard absent
const SAAS_CONTRACT_TYPES = new Set([
  "SaaS_AGREEMENT", "SAAS_AGREEMENT", "TECH_AGREEMENT",
  "SOFTWARE_LICENSE", "IP_LICENSE_AGREEMENT", "PROFESSIONAL_SERVICES",
  "MSA",
]);

// Physical/industrial contract types where insurance IS typically required
const PHYSICAL_CONTRACT_TYPES = new Set([
  "COMMERCIAL_LEASE", "CONSTRUCTION", "LOGISTICS_CONTRACT", "DISTRIBUTION_AGREEMENT",
  "MANUFACTURING", "EMPLOYMENT", "CONTRACTOR_AGREEMENT",
]);

function isSaasContract(contractType: string): boolean {
  if (!contractType) return true;  // Unknown contract type → default to SaaS-style (most platform users)
  const upper = contractType.toUpperCase().replace(/[- ]/g, "_");
  if (PHYSICAL_CONTRACT_TYPES.has(contractType) || PHYSICAL_CONTRACT_TYPES.has(upper)) return false;
  return SAAS_CONTRACT_TYPES.has(contractType) || SAAS_CONTRACT_TYPES.has(upper) ||
    /saas|software.as.a.service|technology.service|tech.*service/i.test(contractType);
}

export function buildAbsentClauseResult(
  category: string,
  rule: PlaybookRule,
  persona: Persona = "CORPORATE",
  contractType: string = "",
  companyName: string = "Your company"
): ComparisonResult {
  const label = category.replace(/_/g, " ").toLowerCase();

  // ── Context-aware: INSURANCE in SaaS/tech contracts ───────────────────────
  if (category === "INSURANCE" && isSaasContract(contractType)) {
    const saasInsuranceNote = `No insurance requirements are specified in this contract. This is standard for SaaS agreements. Most SaaS providers do not include insurance clauses unless the customer specifically requires them. If ${companyName} requires the counterparty to maintain specific insurance levels (such as cyber liability or professional indemnity), request insertion of a clause specifying minimum coverage amounts and evidence requirements.`;
    return {
      ragStatus: "GREY",
      comparisonStatement: `INSURANCE: Missing Optional. No insurance requirements specified. Standard for SaaS agreements.`,
      clauseSummary: `No insurance clause found. This is standard for SaaS contracts.`,
      whyItMatters: saasInsuranceNote,
      recommendedAction: `Optional: if ${companyName} requires minimum insurance coverage from the counterparty, request insertion of an insurance clause specifying coverage types and minimum amounts. No action required if insurance is not a requirement.`,
      suggestedFallback: rule.fallbackTemplate ?? rule.preferredPosition,
      escalationRequired: false,
      escalationTrigger: "",
      businessSummary: saasInsuranceNote,
      confidenceLabel: "HIGH" as ConfidenceLabel,
      regulatoryCitations: [],
      founderStatus: "SAFE" as FounderStatus,
      founderPlainEnglish: `This contract doesn't specify any insurance requirements. That's normal for a SaaS agreement. Don't worry about it unless you specifically need them to carry cyber or professional indemnity insurance.`,
      founderBusinessImpact: `No immediate impact. If the counterparty causes you loss through a cyber incident or professional error, you would need to rely on general legal remedies rather than their insurance. For a typical SaaS tool, this is an acceptable risk.`,
      founderAskFor: `Only request this if you have a specific reason to require the counterparty to hold insurance, for example if your own clients require you to ensure your suppliers are insured.`,
      founderCopyPaste: rule.fallbackTemplate ?? rule.preferredPosition,
      founderFundraisingRelevance: `Not relevant to fundraising.`,
      founderIfIgnored: `No action needed. The absence of an insurance clause in a SaaS agreement is market standard.`,
      iracIssue: `Whether the absence of an insurance clause in this SaaS agreement creates an unacceptable risk for ${companyName}.`,
      iracRule: `The contract contains no insurance clause. For SaaS agreements, this is standard market practice. Most SaaS providers do not accept mandatory insurance requirements unless negotiated by enterprise customers.`,
      iracApplication: `The absence is standard for the contract type. The risk is limited to scenarios where the counterparty causes loss through a cyber incident or professional error and lacks insurance to cover that loss. For most SaaS relationships, this risk is accepted as part of standard terms.`,
      iracConclusion: `My recommendation is to treat this as Missing Optional. No action is required unless ${companyName} has a specific policy requiring counterparty insurance.`,
      urgencyLevel: "BACKGROUND" as "IMMEDIATE" | "MATERIAL" | "BACKGROUND",
      errorCategory: "SUBSTANTIVE_RISK" as "SUBSTANTIVE_RISK" | "DRAFTING_ERROR" | "MECHANICAL_ERROR",
    };
  }

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
    founderBusinessImpact: `Without a ${label} clause, you have no contractual protection on this point. The counterparty's standard terms or common law defaults will apply - usually in their favour.`,
    founderAskFor: `Ask the counterparty to add a ${label} clause. Use the suggested wording below as a starting point.`,
    founderCopyPaste: rule.fallbackTemplate ?? rule.preferredPosition,
    founderFundraisingRelevance: `Investors will expect standard ${label} protections. A contract silent on this point may require renegotiation before a deal closes.`,
    founderIfIgnored: `If you sign without a ${label} clause, you accept whatever default applies under the governing law - typically the counterparty's interpretation. This could create liability or remove protection you assumed you had.`,
    iracIssue: `Whether the contract's silence on ${label} creates a legal gap that defaults to the counterparty's favour.`,
    iracRule: `The contract contains no ${label} clause. Under English law, the absence of an express provision leaves the parties subject to common law defaults or implied terms, typically those that favour the party that drafted the agreement.`,
    iracApplication: `Without an express ${label} clause, the counterparty's position becomes the default. The strongest counterargument is that common law provides some implied terms, but these are narrower than express contractual protection and vary by jurisdiction.`,
    iracConclusion: `My recommendation is to request insertion of a ${label} clause before signing. The risk of proceeding without one is that the counterparty's interpretation prevails. If this materialises, the company has no contractual basis to enforce its preferred position.`,
    urgencyLevel: (ABSENT_CLAUSE_CRITICAL_CATEGORIES.has(category) ? "IMMEDIATE" : "BACKGROUND") as "IMMEDIATE" | "MATERIAL" | "BACKGROUND",
    errorCategory: "SUBSTANTIVE_RISK" as "SUBSTANTIVE_RISK" | "DRAFTING_ERROR" | "MECHANICAL_ERROR",
  };
}
