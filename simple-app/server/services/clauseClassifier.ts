import { chatComplete } from "./openrouter.js";

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

export interface ClassifiedChunk {
  category: ClauseCategory;
  rawText: string;
  confidence: number;
}

export async function classifyClauses(
  chunks: string[],
  workflowType: string = "COMMERCIAL_CONTRACT",
  categoriesOverride?: string[]
): Promise<ClassifiedChunk[]> {
  let activeCategories: readonly string[];
  if (categoriesOverride && categoriesOverride.length > 0) {
    activeCategories = categoriesOverride;
  } else if (workflowType === "INSURANCE_LITIGATION") {
    activeCategories = INSURANCE_CATEGORIES;
  } else if (workflowType === "LOGISTICS_CONTRACT") {
    activeCategories = LOGISTICS_CATEGORIES;
  } else {
    activeCategories = CLAUSE_CATEGORIES;
  }

  const categoriesDesc = activeCategories.join(" | ");

  const text = await chatComplete(
    [
      {
        role: "system",
        content: `You are a legal clause classifier. Classify contract text chunks into these categories: ${categoriesDesc}.
Return ONLY a JSON array. Each element: {"chunkIndex": number, "category": string, "confidence": number (0-1)}.
If a chunk clearly matches a category, set confidence >= 0.8. If uncertain, set confidence 0.5-0.79.
If a chunk does not match any category, omit it from results.`,
      },
      {
        role: "user",
        content: `Classify these contract text chunks:\n\n${chunks
          .map((c, i) => `[${i}] ${c}`)
          .join("\n\n---\n\n")}`,
      },
    ],
    2048
  );

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      chunkIndex: number;
      category: string;
      confidence: number;
    }>;

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
      }));
  } catch {
    return [];
  }
}
