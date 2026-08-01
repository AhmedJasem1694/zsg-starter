import { llmJsonCall } from "./llmJsonParse.js";

export const CLAUSE_CATEGORIES = [
  "LIABILITY_CAP",
  "INDEMNITY",
  "IP_OWNERSHIP",
  "CONFIDENTIALITY",
  "DATA_PRIVACY",
  "TERMINATION",
  "PAYMENT_TERMS",
  "AUTO_RENEWAL",
  "GOVERNING_LAW",
  "AUDIT_RIGHTS",
  "FORCE_MAJEURE",
  "WARRANTIES",
  "DISPUTE_RESOLUTION",
  "ASSIGNMENT",
  "INSURANCE",
  "NON_SOLICITATION",
  "EXCLUSIVITY",
  "CHANGE_OF_CONTROL",
  "RENT_REVIEW",
  "BREAK_CLAUSE",
  "REPAIR_OBLIGATIONS",
  "SERVICE_CHARGE",
  "PROP_ALIENATION",
  "PROP_FORFEITURE",
  "PROP_PLANNING_USE",
  "PROP_BUILDING_SAFETY",
  "PROP_FM_SERVICES",
  "PROP_CONSTRUCTION",
  "ENTIRE_AGREEMENT",
  "VARIATION",
  "WAIVER",
  "SEVERABILITY",
  "NOTICES",
  "THIRD_PARTY_RIGHTS",
  "SET_OFF",
  "LIQUIDATED_DAMAGES",
  "MOST_FAVOURED_NATION",
  "BENCHMARKING",
  "STEP_IN_RIGHTS",
  "SUBCONTRACTING",
  "BUSINESS_CONTINUITY",
  "SERVICE_LEVELS",
  "SOURCE_CODE_ESCROW",
  "MARKETING_RIGHTS",
  "ANTI_BRIBERY",
  "SANCTIONS_COMPLIANCE",
  "MODERN_SLAVERY",
  "ENVIRONMENTAL_OBLIGATIONS",
  "TUPE",
  "RESTRICTIVE_COVENANTS",
  "ACCEPTANCE_TESTING",
  "REGULATORY_CHANGE",
  "CONTENT_MODERATION",
  "VIRTUAL_ITEMS",
  "PLATFORM_REVENUE_SHARE",
  "LOOT_BOX_MECHANICS",
  // Investment document clauses
  "LIQUIDATION_PREFERENCE",
  "ANTI_DILUTION",
  "PRO_RATA_RIGHTS",
  "DRAG_ALONG",
  "INFORMATION_RIGHTS",
  "BOARD_COMPOSITION",
  "VESTING_LEAVER",
  "OPTION_POOL_SHUFFLE",
  "PAY_TO_PLAY",
  "REDEMPTION_RIGHTS",
  // Technology & SaaS
  "TECH_API_TERMS",
  "TECH_UPTIME_SLA",
  "TECH_DATA_PORTABILITY",
  "TECH_OPEN_SOURCE",
  "TECH_SECURITY_STANDARDS",
  "TECH_CHANGE_MANAGEMENT",
  // Financial Services
  "FIN_REGULATORY_PERMISSIONS",
  "FIN_CLIENT_MONEY",
  "FIN_BEST_EXECUTION",
  "FIN_FINANCIAL_PROMOTION",
  "FIN_MARGIN_COLLATERAL",
  "FIN_BENCHMARK_RATES",
  // Healthcare & Life Sciences
  "HEALTH_PATIENT_DATA",
  "HEALTH_REGULATORY_APPROVAL",
  "HEALTH_PHARMACOVIGILANCE",
  "HEALTH_CLINICAL_PROTOCOL",
  "HEALTH_NHS_TERMS",
  "HEALTH_PRODUCT_LIABILITY",
  // Manufacturing & Supply Chain
  "MFG_INCOTERMS",
  "MFG_QUALITY_STANDARDS",
  "MFG_PRODUCT_LIABILITY",
  "MFG_TOOLING_OWNERSHIP",
  "MFG_SUPPLY_CHAIN_RESILIENCE",
  // Retail & eCommerce
  "RET_DISTANCE_SELLING",
  "RET_CONSUMER_RETURNS",
  "RET_MARKETPLACE_TERMS",
  "RET_AGE_VERIFICATION",
  "RET_CONSUMER_CREDIT",
  // Media & Entertainment
  "MEDIA_RIGHTS_CLEARANCE",
  "MEDIA_RESIDUALS_ROYALTIES",
  "MEDIA_TALENT_OBLIGATIONS",
  "MEDIA_FORMAT_RIGHTS",
  "MEDIA_SYNC_LICENSE",
  // Energy & CleanTech
  "ENERGY_OFFTAKE",
  "ENERGY_GRID_CONNECTION",
  "ENERGY_SUBSIDY_REGIME",
  "ENERGY_ENVIRONMENTAL_PERMITS",
  "ENERGY_BALANCING_IMBALANCE",
  // Education & EdTech
  "EDU_SAFEGUARDING",
  "EDU_STUDENT_DATA",
  "EDU_CURRICULUM_RIGHTS",
  "EDU_ACCREDITATION",
  // Professional Services
  "PS_ENGAGEMENT_SCOPE",
  "PS_FEE_BILLING",
  "PS_CONFLICTS_INTEREST",
  "PS_PROFESSIONAL_LIABILITY",
] as const;

export type ClauseCategory = (typeof CLAUSE_CATEGORIES)[number];

export const INSURANCE_CATEGORIES = [
  "INS_COVERAGE_RESPONSE", "INS_EXCLUSIONS_ANALYSIS", "INS_NOTIFICATION_COMPLIANCE",
  "INS_QUANTUM_ASSESSMENT", "INS_DEFENCE_PROSPECTS", "INS_SETTLEMENT_AUTHORITY",
  "INS_REGULATORY_OBLIGATIONS", "INS_SUBROGATION_POTENTIAL", "INS_PANEL_FIRM_INSTRUCTIONS",
  "INS_RESERVE_ADEQUACY",
  // Extended
  "INS_FRAUD_INDICATORS", "INS_REHABILITATION", "INS_EXPERT_EVIDENCE",
  "INS_PART36_CPR", "INS_COSTS_BUDGETING", "INS_THIRD_PARTY_CAPTURE",
  "INS_CLAIMS_TIMEFRAMES", "INS_CONDITIONS_PRECEDENT", "INS_CONTRIBUTION",
  "INS_REINSTATEMENT",
] as const;

export const LOGISTICS_CATEGORIES = [
  "LOG_LIABILITY_CAP_CMR", "LOG_CARGO_LIABILITY", "LOG_INDEMNITY", "LOG_SERVICE_LEVELS",
  "LOG_SUBCONTRACTING", "LOG_DATA_GDPR", "LOG_GOVERNING_LAW", "LOG_TERMINATION",
  "LOG_TRADE_COMPLIANCE", "LOG_AUDIT_REPORTING",
  // Extended
  "LOG_CARRIER_PAYMENT", "LOG_DANGEROUS_GOODS", "LOG_CUSTOMS_CLEARANCE",
  "LOG_PACKAGING_LABELING", "LOG_COLD_CHAIN", "LOG_TRACK_TRACE",
  "LOG_FORCE_MAJEURE", "LOG_INSURANCE_CERT", "LOG_INTERNATIONAL_CONVENTIONS",
  "LOG_DRIVER_COMPLIANCE",
] as const;

export const HEALTHCARE_PROCUREMENT_CATEGORIES = [
  "HC_NHS_CONTRACT_TERMS",
  "HC_PATIENT_DATA_ARTICLE9",
  "HC_CLINICAL_LIABILITY",
  "HC_CQC_COMPLIANCE",
  "HC_PROCUREMENT_LAW",
  "HC_NHS_PRICING",
  "HC_HEALTHCARE_ANTIBRIBERY",
  "HC_MODERN_SLAVERY_SUPPLY",
  "HC_REGULATORY_BREACH_TERM",
  "HC_HEALTHCARE_INSURANCE",
] as const;

// Detailed descriptions injected into the classifier prompt for healthcare procurement.
// These explain to the LLM what to look for in each HC_* category.
const HEALTHCARE_CATEGORY_DESCRIPTIONS: Record<string, string> = {
  HC_NHS_CONTRACT_TERMS: "NHS Contract Terms: whether this is an NHS standard contract or a contract with an NHS body; presence of performance monitoring, quality schedules, data sharing schedules, and standard NHS termination provisions; any deviation from NHS standard terms",
  HC_PATIENT_DATA_ARTICLE9: "Patient Data and Special Category Data: data protection provisions against the higher standard required for special category health data under UK GDPR Article 9; explicit consent mechanisms or alternative lawful bases; Data Protection Impact Assessment requirements; sub-processor restrictions appropriate for health data",
  HC_CLINICAL_LIABILITY: "Clinical Liability and Indemnity: indemnity provisions in the context of clinical risk; any attempt to limit liability for clinical negligence; NHS indemnity scheme interactions; CNST membership obligations",
  HC_CQC_COMPLIANCE: "CQC Compliance Obligations: contractual provisions interacting with CQC registration requirements or fundamental standards of care; supplier obligation to maintain relevant CQC registration; notification obligations on CQC enforcement",
  HC_PROCUREMENT_LAW: "Procurement Law Compliance: whether the contract value or nature suggests a procurement exercise was required under the Public Contracts Regulations 2015 or Procurement Act 2023; direct award provisions and their compliance basis",
  HC_NHS_PRICING: "NHS Pricing and Payment Mechanisms: whether payment terms reference national tariff, payment by results, block contract, or other NHS pricing mechanisms; deviations from standard NHS payment terms",
  HC_HEALTHCARE_ANTIBRIBERY: "Healthcare Anti-Bribery: anti-bribery provisions against the specific requirements for healthcare interactions including gifts, hospitality, interactions with healthcare professionals (HCPs), ABPI Code compliance, NHS Commercial Framework, NHS Counter Fraud Authority reporting",
  HC_MODERN_SLAVERY_SUPPLY: "Modern Slavery and Supply Chain: modern slavery obligations and supply chain audit rights appropriate for an NHS supplier relationship",
  HC_REGULATORY_BREACH_TERM: "Termination for Regulatory Breach: termination rights triggered by regulatory action including CQC enforcement, NHS contract breach, FCA action; convenience termination notice period",
  HC_HEALTHCARE_INSURANCE: "Insurance for Healthcare Activities: clinical negligence cover (CNST or equivalent), employers' liability for clinical staff, public liability appropriate for hospital or clinical operations, professional indemnity",
};

export interface ClassifiedChunk {
  category: ClauseCategory;
  rawText: string;
  confidence: number;
  /** Whether the category is a dedicated clause (PRESENT) or addressed within another clause (INDIRECT) */
  presenceState: "PRESENT" | "INDIRECT";
  /** Brief location reference, e.g. "clause 16", "general obligations section", "expressly excluded in clause 3" */
  clauseReference?: string;
  /**
   * Index of the source chunk. Ordering clauses by this gives document order,
   * which is what lets the offset scan resolve repeated boilerplate to the
   * right occurrence. Absent on clauses assembled outside the classifier.
   */
  chunkIndex?: number;
}

export async function classifyClauses(
  chunks: string[],
  workflowType: string = "COMMERCIAL_CONTRACT",
  categoriesOverride?: string[],
  modelOverride?: string,
): Promise<ClassifiedChunk[]> {
  let activeCategories: readonly string[];
  if (categoriesOverride && categoriesOverride.length > 0) {
    activeCategories = categoriesOverride;
  } else if (workflowType === "INSURANCE_LITIGATION") {
    activeCategories = INSURANCE_CATEGORIES;
  } else if (workflowType === "LOGISTICS_CONTRACT") {
    activeCategories = LOGISTICS_CATEGORIES;
  } else if (workflowType === "HEALTHCARE_PROCUREMENT") {
    activeCategories = HEALTHCARE_PROCUREMENT_CATEGORIES;
  } else {
    activeCategories = CLAUSE_CATEGORIES;
  }

  // For healthcare procurement, inject per-category descriptions into the prompt
  // so the LLM knows what NHS/CQC/procurement-specific signals to look for.
  const healthcareDescriptionBlock = workflowType === "HEALTHCARE_PROCUREMENT" && !categoriesOverride
    ? "\n\nHealthcare Procurement clause definitions:\n" +
      Object.entries(HEALTHCARE_CATEGORY_DESCRIPTIONS)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")
    : "";

  const categoriesDesc = activeCategories.join(" | ");

  type ClassifyItem = {
    chunkIndex: number;
    category: string;
    confidence: number;
    presenceState?: "PRESENT" | "INDIRECT";
    clauseReference?: string;
  };

  // If there are no chunks (empty/unreadable document), return empty without an LLM call
  if (chunks.length === 0) {
    console.warn("[classifyClauses] No chunks to classify - document may be empty or unreadable");
    return [];
  }

  // Send up to 1500 chars of each chunk, enough to capture headings buried mid-paragraph
  // and indirect references that only become apparent from the full clause text.
  const CLASSIFY_SNIPPET_CHARS = 1500;
  const snippets = chunks.map((c, i) => `[${i}] ${c.slice(0, CLASSIFY_SNIPPET_CHARS)}`);

  // Propagate errors: callers must handle failure explicitly so the pipeline
  // sets FAILED status rather than silently completing with empty results
  const rawParsed = await llmJsonCall<ClassifyItem[] | Record<string, unknown>>({
    messages: [
      {
        role: "system",
        content: `You are a legal clause classifier. Classify contract text chunks into these categories: ${categoriesDesc}.${healthcareDescriptionBlock}

For each match, determine the presence state:
- "PRESENT": a dedicated clause with matching heading or primary subject matter
- "INDIRECT": the subject matter is addressed within another clause (not the primary focus), or is expressly excluded/negated

When checking each category, look for ALL of the following:
1. Dedicated clauses with matching headings (PRESENT)
2. Subject matter addressed within other clauses (INDIRECT)
3. Clauses that expressly exclude or negate the subject matter: mark as INDIRECT, not absent
4. Defined terms or recitals that address the subject matter (INDIRECT)

Category-specific detection rules (apply these strictly):
- AUTO_RENEWAL: if a clause states the agreement does NOT auto-renew or requires active renewal, mark INDIRECT with clauseReference noting "expressly excluded"
- FORCE_MAJEURE: any provision giving relief for events outside a party's control is PRESENT even without that exact heading (e.g. "Act of God", "circumstances beyond control")
- CHANGE_OF_CONTROL: an assignment restriction prohibiting transfer without consent is INDIRECT for CHANGE_OF_CONTROL even if the heading says "Assignment"
- CONFIDENTIALITY: confidentiality obligations embedded within a general obligations clause are INDIRECT
- GOVERNING_LAW: a choice of law or jurisdiction clause anywhere in the document is PRESENT

Return ONLY a JSON array. Each element must have these exact fields:
{
  "chunkIndex": number,
  "category": string,
  "confidence": number (0-1),
  "presenceState": "PRESENT" | "INDIRECT",
  "clauseReference": string (brief location, e.g. "clause 16", "section 18.6", "general obligations clause", "expressly excluded in clause 3")
}

Confidence rules: >= 0.8 = clear match, 0.5-0.79 = uncertain. Omit chunks with no match.
NEVER mark a category as absent. Simply omit it if genuinely not found anywhere.`,
      },
      {
        role: "user",
        content: `Classify these contract text chunks:\n\n${snippets.join("\n\n---\n\n")}`,
      },
    ],
    maxTokens: 3072,
    description: "clause classification",
    model: modelOverride,
  });

  // LLMs occasionally wrap arrays in an object like {"items": [...]}. Extract the array.
  let parsed: ClassifyItem[];
  if (Array.isArray(rawParsed)) {
    parsed = rawParsed;
  } else {
    // Try to find an array value inside the returned object
    const nestedArray = Object.values(rawParsed).find(Array.isArray) as ClassifyItem[] | undefined;
    if (nestedArray) {
      console.warn("[classifyClauses] LLM returned wrapped array. Extracting nested array.");
      parsed = nestedArray;
    } else {
      console.warn("[classifyClauses] LLM returned non-array, cannot classify:", JSON.stringify(rawParsed).slice(0, 200));
      return [];
    }
  }

  return parsed
    .filter(
      (item) =>
        item.chunkIndex < chunks.length &&
        (activeCategories as readonly string[]).includes(item.category)
    )
    .map((item) => ({
      category: item.category as ClauseCategory,
      rawText: chunks[item.chunkIndex],
      confidence: item.confidence,
      presenceState: item.presenceState === "INDIRECT" ? "INDIRECT" as const : "PRESENT" as const,
      clauseReference: item.clauseReference,
      // Kept so clauses can be ordered by position in the document, which is
      // what makes the offset scan resolve repeated boilerplate correctly.
      chunkIndex: item.chunkIndex,
    }));
}
