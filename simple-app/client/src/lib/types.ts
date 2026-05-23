export type RiskAppetite = "CONSERVATIVE" | "MODERATE" | "COMMERCIAL";
export type DeltaOutcome = "PREFERRED" | "FALLBACK" | "BELOW_FALLBACK" | "NO_CHANGE" | "REMOVED";
export type CompanyRuleStatus = "PENDING" | "ACTIVE" | "REJECTED";
export type WorkflowType = "COMMERCIAL_CONTRACT" | "INSURANCE_LITIGATION" | "LOGISTICS_CONTRACT";
export type CompanyRole = "BUYER" | "SUPPLIER" | "BOTH" | "INSURER_INHOUSE" | "PANEL_FIRM" | "TPA" | "CLAIMANT_FIRM" | "DEFENDANT_FIRM";
export type ApprovalRole = "LEGAL" | "GC" | "CFO" | "BOARD";
export type RagStatus = "RED" | "AMBER" | "GREEN" | "GREY";
export type DocumentStatus = "UPLOADED" | "PARSING" | "ANONYMISING" | "CLASSIFYING" | "COMPARING" | "PROCESSING" | "COMPLETE" | "FAILED";
export type FeedbackAction = "ACCEPTED" | "EDITED" | "ESCALATED" | "DISMISSED";
export type FeedbackType = "STANDARD" | "TEACH_ZANE" | "FALSE_POSITIVE";
export type ConfidenceLabel = "HIGH" | "MEDIUM" | "LOW";

export interface RegulatoryCitation {
  article: string;
  regulation: string;
  relevance: string;
}

export type ClauseCategory =
  | "LIABILITY_CAP"
  | "INDEMNITY"
  | "IP_OWNERSHIP"
  | "CONFIDENTIALITY"
  | "DATA_PRIVACY"
  | "TERMINATION"
  | "PAYMENT_TERMS"
  | "AUTO_RENEWAL"
  | "GOVERNING_LAW"
  | "AUDIT_RIGHTS"
  | "FORCE_MAJEURE"
  | "WARRANTIES"
  | "DISPUTE_RESOLUTION"
  | "ASSIGNMENT"
  | "INSURANCE"
  | "NON_SOLICITATION"
  | "EXCLUSIVITY"
  | "CHANGE_OF_CONTROL"
  | "RENT_REVIEW"
  | "BREAK_CLAUSE"
  | "REPAIR_OBLIGATIONS"
  | "SERVICE_CHARGE"
  | "ENTIRE_AGREEMENT"
  | "VARIATION"
  | "WAIVER"
  | "SEVERABILITY"
  | "NOTICES"
  | "THIRD_PARTY_RIGHTS"
  | "SET_OFF"
  | "LIQUIDATED_DAMAGES"
  | "MOST_FAVOURED_NATION"
  | "BENCHMARKING"
  | "STEP_IN_RIGHTS"
  | "SUBCONTRACTING"
  | "BUSINESS_CONTINUITY"
  | "SERVICE_LEVELS"
  | "SOURCE_CODE_ESCROW"
  | "MARKETING_RIGHTS"
  | "ANTI_BRIBERY"
  | "SANCTIONS_COMPLIANCE"
  | "MODERN_SLAVERY"
  | "ENVIRONMENTAL_OBLIGATIONS"
  | "TUPE"
  | "RESTRICTIVE_COVENANTS"
  | "ACCEPTANCE_TESTING"
  | "REGULATORY_CHANGE"
  | "CONTENT_MODERATION"
  | "VIRTUAL_ITEMS"
  | "PLATFORM_REVENUE_SHARE"
  | "LOOT_BOX_MECHANICS"
  // Investment document clauses (Founder / PE persona)
  | "LIQUIDATION_PREFERENCE"
  | "ANTI_DILUTION"
  | "PRO_RATA_RIGHTS"
  | "DRAG_ALONG"
  | "INFORMATION_RIGHTS"
  | "BOARD_COMPOSITION"
  | "VESTING_LEAVER"
  | "OPTION_POOL_SHUFFLE"
  | "PAY_TO_PLAY"
  | "REDEMPTION_RIGHTS"
  // Insurance litigation categories
  | "INS_COVERAGE_RESPONSE"
  | "INS_EXCLUSIONS_ANALYSIS"
  | "INS_NOTIFICATION_COMPLIANCE"
  | "INS_QUANTUM_ASSESSMENT"
  | "INS_DEFENCE_PROSPECTS"
  | "INS_SETTLEMENT_AUTHORITY"
  | "INS_REGULATORY_OBLIGATIONS"
  | "INS_SUBROGATION_POTENTIAL"
  | "INS_PANEL_FIRM_INSTRUCTIONS"
  | "INS_RESERVE_ADEQUACY"
  // Insurance litigation - extended
  | "INS_FRAUD_INDICATORS"
  | "INS_REHABILITATION"
  | "INS_EXPERT_EVIDENCE"
  | "INS_PART36_CPR"
  | "INS_COSTS_BUDGETING"
  | "INS_THIRD_PARTY_CAPTURE"
  | "INS_CLAIMS_TIMEFRAMES"
  | "INS_CONDITIONS_PRECEDENT"
  | "INS_CONTRIBUTION"
  | "INS_REINSTATEMENT"
  // Logistics contract categories
  | "LOG_LIABILITY_CAP_CMR"
  | "LOG_CARGO_LIABILITY"
  | "LOG_INDEMNITY"
  | "LOG_SERVICE_LEVELS"
  | "LOG_SUBCONTRACTING"
  | "LOG_DATA_GDPR"
  | "LOG_GOVERNING_LAW"
  | "LOG_TERMINATION"
  | "LOG_TRADE_COMPLIANCE"
  | "LOG_AUDIT_REPORTING"
  // Logistics contract - extended
  | "LOG_CARRIER_PAYMENT"
  | "LOG_DANGEROUS_GOODS"
  | "LOG_CUSTOMS_CLEARANCE"
  | "LOG_PACKAGING_LABELING"
  | "LOG_COLD_CHAIN"
  | "LOG_TRACK_TRACE"
  | "LOG_FORCE_MAJEURE"
  | "LOG_INSURANCE_CERT"
  | "LOG_INTERNATIONAL_CONVENTIONS"
  | "LOG_DRIVER_COMPLIANCE"
  // Technology & SaaS
  | "TECH_API_TERMS"
  | "TECH_UPTIME_SLA"
  | "TECH_DATA_PORTABILITY"
  | "TECH_OPEN_SOURCE"
  | "TECH_SECURITY_STANDARDS"
  | "TECH_CHANGE_MANAGEMENT"
  // Financial Services
  | "FIN_REGULATORY_PERMISSIONS"
  | "FIN_CLIENT_MONEY"
  | "FIN_BEST_EXECUTION"
  | "FIN_FINANCIAL_PROMOTION"
  | "FIN_MARGIN_COLLATERAL"
  | "FIN_BENCHMARK_RATES"
  // Healthcare & Life Sciences
  | "HEALTH_PATIENT_DATA"
  | "HEALTH_REGULATORY_APPROVAL"
  | "HEALTH_PHARMACOVIGILANCE"
  | "HEALTH_CLINICAL_PROTOCOL"
  | "HEALTH_NHS_TERMS"
  | "HEALTH_PRODUCT_LIABILITY"
  // Manufacturing & Supply Chain
  | "MFG_INCOTERMS"
  | "MFG_QUALITY_STANDARDS"
  | "MFG_PRODUCT_LIABILITY"
  | "MFG_TOOLING_OWNERSHIP"
  | "MFG_SUPPLY_CHAIN_RESILIENCE"
  // Retail & eCommerce
  | "RET_DISTANCE_SELLING"
  | "RET_CONSUMER_RETURNS"
  | "RET_MARKETPLACE_TERMS"
  | "RET_AGE_VERIFICATION"
  | "RET_CONSUMER_CREDIT"
  // Media & Entertainment
  | "MEDIA_RIGHTS_CLEARANCE"
  | "MEDIA_RESIDUALS_ROYALTIES"
  | "MEDIA_TALENT_OBLIGATIONS"
  | "MEDIA_FORMAT_RIGHTS"
  | "MEDIA_SYNC_LICENSE"
  // Energy & CleanTech
  | "ENERGY_OFFTAKE"
  | "ENERGY_GRID_CONNECTION"
  | "ENERGY_SUBSIDY_REGIME"
  | "ENERGY_ENVIRONMENTAL_PERMITS"
  | "ENERGY_BALANCING_IMBALANCE"
  // Education & EdTech
  | "EDU_SAFEGUARDING"
  | "EDU_STUDENT_DATA"
  | "EDU_CURRICULUM_RIGHTS"
  | "EDU_ACCREDITATION"
  // Professional Services
  | "PS_ENGAGEMENT_SCOPE"
  | "PS_FEE_BILLING"
  | "PS_CONFLICTS_INTEREST"
  | "PS_PROFESSIONAL_LIABILITY";

export const CLAUSE_CATEGORIES: ClauseCategory[] = [
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
];

export const CLAUSE_LABELS: Record<ClauseCategory, string> = {
  LIABILITY_CAP: "Limitation of Liability",
  INDEMNITY: "Indemnity",
  IP_OWNERSHIP: "IP Ownership",
  CONFIDENTIALITY: "Confidentiality",
  DATA_PRIVACY: "Data & Privacy",
  TERMINATION: "Termination",
  PAYMENT_TERMS: "Payment Terms",
  AUTO_RENEWAL: "Auto-Renewal",
  GOVERNING_LAW: "Governing Law",
  AUDIT_RIGHTS: "Audit Rights",
  FORCE_MAJEURE: "Force Majeure",
  WARRANTIES: "Warranties & Representations",
  DISPUTE_RESOLUTION: "Dispute Resolution",
  ASSIGNMENT: "Assignment & Novation",
  INSURANCE: "Insurance",
  NON_SOLICITATION: "Non-Solicitation",
  EXCLUSIVITY: "Exclusivity",
  CHANGE_OF_CONTROL: "Change of Control",
  RENT_REVIEW: "Rent Review",
  BREAK_CLAUSE: "Break Clause",
  REPAIR_OBLIGATIONS: "Repair & Maintenance",
  SERVICE_CHARGE: "Service Charge",
  ENTIRE_AGREEMENT: "Entire Agreement / Merger Clause",
  VARIATION: "Variation & Amendment",
  WAIVER: "Waiver",
  SEVERABILITY: "Severability",
  NOTICES: "Notices & Communications",
  THIRD_PARTY_RIGHTS: "Third Party Rights",
  SET_OFF: "Set-Off & Deduction",
  LIQUIDATED_DAMAGES: "Liquidated Damages & Penalties",
  MOST_FAVOURED_NATION: "Most Favoured Nation (MFN) Pricing",
  BENCHMARKING: "Benchmarking & Price Review",
  STEP_IN_RIGHTS: "Step-In Rights",
  SUBCONTRACTING: "Subcontracting & Outsourcing",
  BUSINESS_CONTINUITY: "Business Continuity & Disaster Recovery",
  SERVICE_LEVELS: "Service Levels & SLAs",
  SOURCE_CODE_ESCROW: "Source Code Escrow",
  MARKETING_RIGHTS: "Reference Rights & Marketing Use",
  ANTI_BRIBERY: "Anti-Bribery & Corruption",
  SANCTIONS_COMPLIANCE: "Sanctions & Export Controls",
  MODERN_SLAVERY: "Modern Slavery & Human Trafficking",
  ENVIRONMENTAL_OBLIGATIONS: "Environmental & ESG Obligations",
  TUPE: "TUPE / Employment Transfer",
  RESTRICTIVE_COVENANTS: "Non-Compete / Restrictive Covenants",
  ACCEPTANCE_TESTING: "Acceptance Testing & Sign-Off",
  REGULATORY_CHANGE: "Regulatory Change & Compliance",
  CONTENT_MODERATION: "Content Moderation & User-Generated Content",
  VIRTUAL_ITEMS: "Virtual Items, In-Game Currency & Digital Goods",
  PLATFORM_REVENUE_SHARE: "Platform Revenue Share & Store Fees",
  LOOT_BOX_MECHANICS: "Loot Box & Randomised Reward Mechanics",
  // Insurance litigation categories
  INS_COVERAGE_RESPONSE: "Coverage Response",
  INS_EXCLUSIONS_ANALYSIS: "Exclusions Analysis",
  INS_NOTIFICATION_COMPLIANCE: "Notification Compliance",
  INS_QUANTUM_ASSESSMENT: "Quantum Assessment",
  INS_DEFENCE_PROSPECTS: "Defence Prospects",
  INS_SETTLEMENT_AUTHORITY: "Settlement Authority",
  INS_REGULATORY_OBLIGATIONS: "Regulatory Obligations",
  INS_SUBROGATION_POTENTIAL: "Subrogation Potential",
  INS_PANEL_FIRM_INSTRUCTIONS: "Panel Firm Instructions",
  INS_RESERVE_ADEQUACY: "Reserve Adequacy",
  // Insurance litigation - extended
  INS_FRAUD_INDICATORS: "Fraud Indicators & Anti-Fraud Obligations",
  INS_REHABILITATION: "Rehabilitation & Care Management",
  INS_EXPERT_EVIDENCE: "Expert Evidence & Medical Reports",
  INS_PART36_CPR: "Part 36 Offers & CPR Compliance",
  INS_COSTS_BUDGETING: "Costs Management & Budgeting",
  INS_THIRD_PARTY_CAPTURE: "Third Party Capture Risk",
  INS_CLAIMS_TIMEFRAMES: "Claims Handling Timeframes & SLAs",
  INS_CONDITIONS_PRECEDENT: "Conditions Precedent to Coverage",
  INS_CONTRIBUTION: "Contribution Between Insurers",
  INS_REINSTATEMENT: "Reinstatement vs Indemnity Basis",
  // Logistics contract categories
  LOG_LIABILITY_CAP_CMR: "Liability Cap & CMR Limits",
  LOG_CARGO_LIABILITY: "Cargo Liability & Insurance",
  LOG_INDEMNITY: "Indemnity & Cross-Indemnity",
  LOG_SERVICE_LEVELS: "Service Levels & Performance",
  LOG_SUBCONTRACTING: "Subcontracting Rights",
  LOG_DATA_GDPR: "Data & GDPR",
  LOG_GOVERNING_LAW: "Governing Law & Jurisdiction",
  LOG_TERMINATION: "Termination & Transition",
  LOG_TRADE_COMPLIANCE: "Trade Compliance & Sanctions",
  LOG_AUDIT_REPORTING: "Audit & Reporting",
  // Logistics contract - extended
  LOG_CARRIER_PAYMENT: "Carrier Payment Terms & Fuel Surcharges",
  LOG_DANGEROUS_GOODS: "Dangerous Goods & ADR Compliance",
  LOG_CUSTOMS_CLEARANCE: "Customs Clearance & Broker Responsibilities",
  LOG_PACKAGING_LABELING: "Packaging, Labelling & Marking Obligations",
  LOG_COLD_CHAIN: "Temperature-Controlled & Cold Chain Requirements",
  LOG_TRACK_TRACE: "Track, Trace & Data Rights",
  LOG_FORCE_MAJEURE: "Logistics Force Majeure & Disruption",
  LOG_INSURANCE_CERT: "Insurance Certificate Requirements",
  LOG_INTERNATIONAL_CONVENTIONS: "International Transport Conventions (CMR/Hague-Visby/Montreal)",
  LOG_DRIVER_COMPLIANCE: "Driver Compliance & DVSA Requirements",
  // Investment document clauses
  LIQUIDATION_PREFERENCE: "Liquidation Preference",
  ANTI_DILUTION: "Anti-Dilution Provisions",
  PRO_RATA_RIGHTS: "Pro-Rata Rights",
  DRAG_ALONG: "Drag-Along Provisions",
  INFORMATION_RIGHTS: "Information Rights",
  BOARD_COMPOSITION: "Board Composition & Control",
  VESTING_LEAVER: "Vesting & Good/Bad Leaver Provisions",
  OPTION_POOL_SHUFFLE: "Option Pool Shuffle",
  PAY_TO_PLAY: "Pay-to-Play Provisions",
  REDEMPTION_RIGHTS: "Redemption Rights",
  // Technology & SaaS
  TECH_API_TERMS: "API Access & Rate Limits",
  TECH_UPTIME_SLA: "Uptime Commitments & SLA Credits",
  TECH_DATA_PORTABILITY: "Data Portability & Export Rights",
  TECH_OPEN_SOURCE: "Open Source Components & Licensing",
  TECH_SECURITY_STANDARDS: "Security Standards & Certifications",
  TECH_CHANGE_MANAGEMENT: "Change Management & Backward Compatibility",
  // Financial Services
  FIN_REGULATORY_PERMISSIONS: "Regulatory Permissions & Authorisations",
  FIN_CLIENT_MONEY: "Client Money & CASS Compliance",
  FIN_BEST_EXECUTION: "Best Execution & Order Handling",
  FIN_FINANCIAL_PROMOTION: "Financial Promotion Compliance",
  FIN_MARGIN_COLLATERAL: "Margin, Collateral & Credit Support",
  FIN_BENCHMARK_RATES: "Reference Rates & Benchmark Provisions",
  // Healthcare & Life Sciences
  HEALTH_PATIENT_DATA: "Patient Data & Clinical Information Governance",
  HEALTH_REGULATORY_APPROVAL: "Regulatory Approval Conditions",
  HEALTH_PHARMACOVIGILANCE: "Pharmacovigilance & Adverse Event Reporting",
  HEALTH_CLINICAL_PROTOCOL: "Clinical Trial Protocol & Amendments",
  HEALTH_NHS_TERMS: "NHS Standard Contract Terms",
  HEALTH_PRODUCT_LIABILITY: "Medical Device & Pharmaceutical Liability",
  // Manufacturing & Supply Chain
  MFG_INCOTERMS: "Delivery Terms & Risk Transfer (Incoterms)",
  MFG_QUALITY_STANDARDS: "Quality Management & Standards Compliance",
  MFG_PRODUCT_LIABILITY: "Product Liability & Recall Obligations",
  MFG_TOOLING_OWNERSHIP: "Tooling, Moulds & Equipment Ownership",
  MFG_SUPPLY_CHAIN_RESILIENCE: "Supply Chain Resilience & Dual Sourcing",
  // Retail & eCommerce
  RET_DISTANCE_SELLING: "Distance Selling & Cooling-Off Rights",
  RET_CONSUMER_RETURNS: "Returns, Refunds & Exchange Obligations",
  RET_MARKETPLACE_TERMS: "Marketplace Platform Terms & Fees",
  RET_AGE_VERIFICATION: "Age Verification Requirements",
  RET_CONSUMER_CREDIT: "Consumer Credit & BNPL Compliance",
  // Media & Entertainment
  MEDIA_RIGHTS_CLEARANCE: "Rights Clearance & Chain of Title",
  MEDIA_RESIDUALS_ROYALTIES: "Residuals, Royalties & Profit Participation",
  MEDIA_TALENT_OBLIGATIONS: "Talent, Performer & Writer Obligations",
  MEDIA_FORMAT_RIGHTS: "Format Rights, Adaptations & Sequel Rights",
  MEDIA_SYNC_LICENSE: "Synchronisation & Music Licensing",
  // Energy & CleanTech
  ENERGY_OFFTAKE: "Offtake Agreement & Power Purchase Terms",
  ENERGY_GRID_CONNECTION: "Grid Connection & DNO Obligations",
  ENERGY_SUBSIDY_REGIME: "Subsidy & Incentive Scheme Conditions",
  ENERGY_ENVIRONMENTAL_PERMITS: "Environmental Permits & Planning Conditions",
  ENERGY_BALANCING_IMBALANCE: "Balancing & Imbalance Settlement",
  // Education & EdTech
  EDU_SAFEGUARDING: "Safeguarding & Child Protection",
  EDU_STUDENT_DATA: "Student Data & Parental Consent",
  EDU_CURRICULUM_RIGHTS: "Curriculum Content Rights & IP",
  EDU_ACCREDITATION: "Awarding Body & Accreditation Requirements",
  // Professional Services
  PS_ENGAGEMENT_SCOPE: "Scope of Engagement & Change Control",
  PS_FEE_BILLING: "Fee Arrangements & Billing Practices",
  PS_CONFLICTS_INTEREST: "Conflicts of Interest & Independence",
  PS_PROFESSIONAL_LIABILITY: "Professional Liability & PI Insurance",
};

// Property-specific clause types (shown only for real estate / property contracts)
export const PROPERTY_CLAUSE_CATEGORIES: ClauseCategory[] = [
  "RENT_REVIEW",
  "BREAK_CLAUSE",
  "REPAIR_OBLIGATIONS",
  "SERVICE_CHARGE",
];

// Gaming-specific clause types (shown for gaming / interactive entertainment contracts)
export const GAMING_CLAUSE_CATEGORIES: ClauseCategory[] = [
  "CONTENT_MODERATION",
  "VIRTUAL_ITEMS",
  "PLATFORM_REVENUE_SHARE",
  "LOOT_BOX_MECHANICS",
];

// Investment document clause types (shown for FOUNDER persona)
export const INVESTMENT_CLAUSE_CATEGORIES: ClauseCategory[] = [
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
];

export const INSURANCE_CLAUSE_CATEGORIES: ClauseCategory[] = [
  "INS_COVERAGE_RESPONSE",
  "INS_EXCLUSIONS_ANALYSIS",
  "INS_NOTIFICATION_COMPLIANCE",
  "INS_QUANTUM_ASSESSMENT",
  "INS_DEFENCE_PROSPECTS",
  "INS_SETTLEMENT_AUTHORITY",
  "INS_REGULATORY_OBLIGATIONS",
  "INS_SUBROGATION_POTENTIAL",
  "INS_PANEL_FIRM_INSTRUCTIONS",
  "INS_RESERVE_ADEQUACY",
  "INS_FRAUD_INDICATORS",
  "INS_REHABILITATION",
  "INS_EXPERT_EVIDENCE",
  "INS_PART36_CPR",
  "INS_COSTS_BUDGETING",
  "INS_THIRD_PARTY_CAPTURE",
  "INS_CLAIMS_TIMEFRAMES",
  "INS_CONDITIONS_PRECEDENT",
  "INS_CONTRIBUTION",
  "INS_REINSTATEMENT",
];

export const LOGISTICS_CLAUSE_CATEGORIES: ClauseCategory[] = [
  "LOG_LIABILITY_CAP_CMR",
  "LOG_CARGO_LIABILITY",
  "LOG_INDEMNITY",
  "LOG_SERVICE_LEVELS",
  "LOG_SUBCONTRACTING",
  "LOG_DATA_GDPR",
  "LOG_GOVERNING_LAW",
  "LOG_TERMINATION",
  "LOG_TRADE_COMPLIANCE",
  "LOG_AUDIT_REPORTING",
  "LOG_CARRIER_PAYMENT",
  "LOG_DANGEROUS_GOODS",
  "LOG_CUSTOMS_CLEARANCE",
  "LOG_PACKAGING_LABELING",
  "LOG_COLD_CHAIN",
  "LOG_TRACK_TRACE",
  "LOG_FORCE_MAJEURE",
  "LOG_INSURANCE_CERT",
  "LOG_INTERNATIONAL_CONVENTIONS",
  "LOG_DRIVER_COMPLIANCE",
];

export const TECHNOLOGY_SAAS_CLAUSE_CATEGORIES: ClauseCategory[] = [
  "TECH_API_TERMS", "TECH_UPTIME_SLA", "TECH_DATA_PORTABILITY",
  "TECH_OPEN_SOURCE", "TECH_SECURITY_STANDARDS", "TECH_CHANGE_MANAGEMENT",
];

export const FINANCIAL_SERVICES_CLAUSE_CATEGORIES: ClauseCategory[] = [
  "FIN_REGULATORY_PERMISSIONS", "FIN_CLIENT_MONEY", "FIN_BEST_EXECUTION",
  "FIN_FINANCIAL_PROMOTION", "FIN_MARGIN_COLLATERAL", "FIN_BENCHMARK_RATES",
];

export const HEALTHCARE_CLAUSE_CATEGORIES: ClauseCategory[] = [
  "HEALTH_PATIENT_DATA", "HEALTH_REGULATORY_APPROVAL", "HEALTH_PHARMACOVIGILANCE",
  "HEALTH_CLINICAL_PROTOCOL", "HEALTH_NHS_TERMS", "HEALTH_PRODUCT_LIABILITY",
];

export const MANUFACTURING_CLAUSE_CATEGORIES: ClauseCategory[] = [
  "MFG_INCOTERMS", "MFG_QUALITY_STANDARDS", "MFG_PRODUCT_LIABILITY",
  "MFG_TOOLING_OWNERSHIP", "MFG_SUPPLY_CHAIN_RESILIENCE",
];

export const RETAIL_ECOMMERCE_CLAUSE_CATEGORIES: ClauseCategory[] = [
  "RET_DISTANCE_SELLING", "RET_CONSUMER_RETURNS", "RET_MARKETPLACE_TERMS",
  "RET_AGE_VERIFICATION", "RET_CONSUMER_CREDIT",
];

export const MEDIA_ENTERTAINMENT_CLAUSE_CATEGORIES: ClauseCategory[] = [
  "MEDIA_RIGHTS_CLEARANCE", "MEDIA_RESIDUALS_ROYALTIES", "MEDIA_TALENT_OBLIGATIONS",
  "MEDIA_FORMAT_RIGHTS", "MEDIA_SYNC_LICENSE",
];

export const ENERGY_CLEANTECH_CLAUSE_CATEGORIES: ClauseCategory[] = [
  "ENERGY_OFFTAKE", "ENERGY_GRID_CONNECTION", "ENERGY_SUBSIDY_REGIME",
  "ENERGY_ENVIRONMENTAL_PERMITS", "ENERGY_BALANCING_IMBALANCE",
];

export const EDUCATION_EDTECH_CLAUSE_CATEGORIES: ClauseCategory[] = [
  "EDU_SAFEGUARDING", "EDU_STUDENT_DATA", "EDU_CURRICULUM_RIGHTS", "EDU_ACCREDITATION",
];

export const PROFESSIONAL_SERVICES_CLAUSE_CATEGORIES: ClauseCategory[] = [
  "PS_ENGAGEMENT_SCOPE", "PS_FEE_BILLING", "PS_CONFLICTS_INTEREST", "PS_PROFESSIONAL_LIABILITY",
];

export function getIndustryClauseCategories(industry: Industry): ClauseCategory[] {
  const map: Partial<Record<Industry, ClauseCategory[]>> = {
    TECHNOLOGY_SAAS:         TECHNOLOGY_SAAS_CLAUSE_CATEGORIES,
    FINANCIAL_SERVICES:      FINANCIAL_SERVICES_CLAUSE_CATEGORIES,
    HEALTHCARE_LIFESCIENCES: HEALTHCARE_CLAUSE_CATEGORIES,
    GAMING_INTERACTIVE:      GAMING_CLAUSE_CATEGORIES,
    PROPERTY_REAL_ESTATE:    PROPERTY_CLAUSE_CATEGORIES,
    MANUFACTURING_SUPPLY:    MANUFACTURING_CLAUSE_CATEGORIES,
    LOGISTICS_SUPPLY:        LOGISTICS_CLAUSE_CATEGORIES,
    RETAIL_ECOMMERCE:        RETAIL_ECOMMERCE_CLAUSE_CATEGORIES,
    MEDIA_ENTERTAINMENT:     MEDIA_ENTERTAINMENT_CLAUSE_CATEGORIES,
    ENERGY_CLEANTECH:        ENERGY_CLEANTECH_CLAUSE_CATEGORIES,
    EDUCATION_EDTECH:        EDUCATION_EDTECH_CLAUSE_CATEGORIES,
    PROFESSIONAL_SERVICES:   PROFESSIONAL_SERVICES_CLAUSE_CATEGORIES,
  };
  return map[industry] ?? [];
}

// Persona - determines onboarding flow and Zane output framing
export type Persona = "CORPORATE" | "FOUNDER";

export const PERSONA_LABELS: Record<Persona, string> = {
  CORPORATE: "In-house / Corporate",
  FOUNDER:   "Founder / Startup",
};

export const PERSONA_DESCRIPTIONS: Record<Persona, string> = {
  CORPORATE: "Review counterparty paper against your playbook. Flag deviations, produce fallback language, route escalations.",
  FOUNDER:   "All commercial contracts plus investment documents - term sheets, SHA, liquidation preferences. Plain-English output for sophisticated non-lawyers.",
};

export type Industry =
  | "TECHNOLOGY_SAAS"
  | "FINANCIAL_SERVICES"
  | "HEALTHCARE_LIFESCIENCES"
  | "GAMING_INTERACTIVE"
  | "PROPERTY_REAL_ESTATE"
  | "PROFESSIONAL_SERVICES"
  | "MANUFACTURING_SUPPLY"
  | "LOGISTICS_SUPPLY"
  | "RETAIL_ECOMMERCE"
  | "MEDIA_ENTERTAINMENT"
  | "ENERGY_CLEANTECH"
  | "EDUCATION_EDTECH"
  | "LEGAL_SERVICES"
  | "OTHER";

export const INDUSTRY_LABELS: Record<Industry, string> = {
  TECHNOLOGY_SAAS: "Technology & SaaS",
  FINANCIAL_SERVICES: "Financial Services & FinTech",
  HEALTHCARE_LIFESCIENCES: "Healthcare & Life Sciences",
  GAMING_INTERACTIVE: "Gaming & Interactive Entertainment",
  PROPERTY_REAL_ESTATE: "Property & Real Estate",
  PROFESSIONAL_SERVICES: "Professional Services",
  MANUFACTURING_SUPPLY: "Manufacturing & Supply Chain",
  LOGISTICS_SUPPLY: "Logistics, Freight & Supply Chain",
  RETAIL_ECOMMERCE: "Retail & eCommerce",
  MEDIA_ENTERTAINMENT: "Media & Entertainment",
  ENERGY_CLEANTECH: "Energy & CleanTech",
  EDUCATION_EDTECH: "Education & EdTech",
  LEGAL_SERVICES: "Legal Services",
  OTHER: "Other",
};

export interface Company {
  id: string;
  name: string;
  sector: string;
  jurisdiction: string;
  role: CompanyRole;
  riskAppetite: RiskAppetite;
  industry: string;
  persona: Persona;
  workflowType?: WorkflowType;
  createdAt: string;
  playbookRules?: PlaybookRule[];
  approvalContacts?: ApprovalContact[];
}

export interface PlaybookRule {
  id: string;
  companyId: string;
  clauseCategory: ClauseCategory;
  preferredPosition: string;
  acceptableFallback: string;
  hardRedLine: string;
  approvalRequired?: ApprovalRole;
  fallbackTemplate?: string;
  riskWeight: number;
  workflowType?: string;
}

export interface ApprovalContact {
  id: string;
  companyId: string;
  role: ApprovalRole;
  name: string;
  email: string;
}

export interface UploadedDocument {
  id: string;
  companyId: string;
  filename: string;
  originalName: string;
  contractType: string;
  status: DocumentStatus;
  counterpartyName?: string;
  counterpartyType?: string;
  reviewType?: string;
  governingLaw?: string;
  jurisdiction?: string;
  contractValue?: number;
  currency?: string;
  contractTermMonths?: number;
  autoRenewal?: boolean;
  noticePeriodDays?: number;
  renewalDate?: string;
  contractTags?: string;
  folder?: string;
  parentDocumentId?: string;
  outcome?: "DRAFT" | "SIGNED" | "EXECUTED";
  signedAt?: string;
  outcomeNotes?: string;
  /** JSON array of contradiction findings from the second LLM pass */
  contradictions?: ContradictionFinding[];
  uploadedAt: string;
  reviewResults?: ReviewResult[];
}

export type FounderStatus = "SAFE" | "CAUTION" | "DO NOT SIGN YET";

export interface ContradictionFinding {
  title: string;
  clauseA: string;
  clauseB: string;
  explanation: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  recommendation: string;
}

export interface ReviewResult {
  id: string;
  documentId: string;
  clauseId?: string;
  ruleId?: string;
  clauseCategory: ClauseCategory;
  ragStatus: RagStatus;
  /** Explicit comparison: "Your playbook says X, this clause says Y, missing: Z" */
  comparisonStatement?: string;
  clauseSummary: string;
  whyItMatters: string;
  recommendedAction: string;
  suggestedFallback: string;
  escalationRequired: boolean;
  escalationTrigger?: string;
  businessSummary: string;
  /** Qualitative confidence - LOW = mandatory lawyer review */
  confidenceLabel?: ConfidenceLabel;
  /** Parsed regulatory citations with article numbers */
  regulatoryCitations?: RegulatoryCitation[];
  isAbsent: boolean;
  /** Only populated when ragStatus === "GREY" (clause absent from document) */
  missingSeverity?: "CRITICAL" | "OPTIONAL";
  createdAt: string;
  feedback?: UserFeedback;
  // ── Founder-specific fields ───────────────────────────────────────────────
  founderStatus?: FounderStatus;
  founderPlainEnglish?: string;
  founderBusinessImpact?: string;
  founderAskFor?: string;
  founderCopyPaste?: string;
  founderFundraisingRelevance?: string;
  founderIfIgnored?: string;
}

export interface CompanyRegulation {
  id: string;
  companyId: string;
  jurisdiction: string;
  regulator: string;
  frameworkName: string;
  description: string;
  appliesTo: string;
}

export interface AuthUser {
  userId: string;
  email: string;
  name?: string;
}

export interface UserFeedback {
  id: string;
  resultId: string;
  userAction: FeedbackAction;
  feedbackType?: FeedbackType;
  editedOutput?: string;
  finalClauseText?: string;
  correctOutput?: string;
  notes?: string;
  createdAt: string;
}

// Default playbook positions keyed by risk appetite
export const PLAYBOOK_DEFAULTS: Record<
  RiskAppetite,
  Record<ClauseCategory, { preferredPosition: string; acceptableFallback: string; hardRedLine: string; fallbackTemplate?: string }>
> = {
  CONSERVATIVE: {
    LIABILITY_CAP: {
      preferredPosition: "Liability capped at 24 months' fees. Fraud, wilful misconduct, confidentiality breach, data breach, IP infringement, and payment obligations are uncapped.",
      acceptableFallback: "Liability capped at 12 months' fees, provided confidentiality, data breach, and IP infringement are carved out.",
      hardRedLine: "Cap below 6 months' fees, or any cap covering data breach or confidentiality without carve-outs.",
      fallbackTemplate: `Nothing in this agreement shall limit or exclude liability for fraud, wilful misconduct, breach of confidentiality, data protection obligations, IP infringement, or payment obligations. Subject to the foregoing, aggregate liability shall not exceed 24 months' fees.`,
    },
    INDEMNITY: {
      preferredPosition: "Mutual indemnity for third-party IP infringement claims and data breaches caused by the indemnifying party.",
      acceptableFallback: "Supplier indemnifies us for IP infringement and data breaches; our indemnity limited to misuse of their IP.",
      hardRedLine: "One-sided indemnity that exposes us to unlimited liability for the supplier's acts.",
    },
    IP_OWNERSHIP: {
      preferredPosition: "All bespoke work product and custom deliverables vest in us on creation. Supplier retains pre-existing IP; grants us perpetual licence.",
      acceptableFallback: "Supplier owns deliverables but grants us an exclusive, perpetual, royalty-free licence.",
      hardRedLine: "Supplier owns all deliverables with no perpetual licence back to us.",
    },
    CONFIDENTIALITY: {
      preferredPosition: "Mutual, 5-year post-termination obligation. Includes employees and advisors. No carve-out for residuals.",
      acceptableFallback: "Mutual, 3-year post-termination. Residuals carve-out acceptable only for non-patentable know-how.",
      hardRedLine: "Obligation shorter than 2 years, or residuals carve-out covering specific confidential information.",
    },
    DATA_PRIVACY: {
      preferredPosition: "Full DPA in place. Supplier is processor; we are controller. Standard contractual clauses for any international transfers. Right to audit.",
      acceptableFallback: "DPA in place; audit rights exercisable on 10 business days' notice.",
      hardRedLine: "No DPA, or supplier claims controller status over our personal data.",
    },
    TERMINATION: {
      preferredPosition: "Either party may terminate for convenience on 30 days' notice. Immediate termination for material breach (10-day cure period).",
      acceptableFallback: "90-day convenience termination notice; immediate for uncured breach.",
      hardRedLine: "No right to terminate for convenience, or cure period longer than 30 days.",
    },
    PAYMENT_TERMS: {
      preferredPosition: "Payment within 30 days of invoice. No automatic price escalation.",
      acceptableFallback: "Payment within 45 days. Annual price increases capped at CPI.",
      hardRedLine: "Payment shorter than 14 days, or uncapped annual price increases.",
    },
    AUTO_RENEWAL: {
      preferredPosition: "No auto-renewal. Contract expires on the end date unless renewed in writing.",
      acceptableFallback: "Auto-renewal acceptable if we receive 60 days' written notice before renewal date.",
      hardRedLine: "Auto-renewal with less than 30 days' notice, or auto-renewal of multi-year terms.",
    },
    GOVERNING_LAW: {
      preferredPosition: "English law. Exclusive jurisdiction of English courts.",
      acceptableFallback: "English law. Non-exclusive jurisdiction or agreed arbitration (LCIA/ICC).",
      hardRedLine: "Supplier's home jurisdiction if materially different from ours without reciprocal arrangements.",
    },
    AUDIT_RIGHTS: {
      preferredPosition: "Right to audit supplier's compliance with this agreement on 5 business days' notice, no more than twice per year.",
      acceptableFallback: "Audit right on 10 business days' notice, once per year.",
      hardRedLine: "No audit right, or audit costs fully borne by us without cause.",
    },
    FORCE_MAJEURE: {
      preferredPosition: "Narrow force majeure limited to unforeseeable events beyond both parties' control. Excludes economic hardship, price increases, or foreseeable supply chain disruption. 30-day notice required; 90-day long-stop triggers termination right.",
      acceptableFallback: "Standard force majeure with 14-day notice requirement and 6-month long-stop.",
      hardRedLine: "Force majeure clause covering economic hardship, pandemics (where risk is already known), or events within the supplier's control.",
    },
    WARRANTIES: {
      preferredPosition: "Full warranties of title, authority, fitness for purpose, and compliance with applicable law. All warranties survive termination. Remedy period of 30 days for breach.",
      acceptableFallback: "Warranties of authority and title only; fitness for purpose implied by statute.",
      hardRedLine: "No warranties or 'as-is' disclaimer covering material service failures or regulatory non-compliance.",
    },
    DISPUTE_RESOLUTION: {
      preferredPosition: "Tiered escalation: commercial discussion (10 days) → executive escalation (20 days) → binding arbitration (LCIA, London, English law). Emergency relief available through English courts.",
      acceptableFallback: "Direct escalation to LCIA or ICC arbitration. Expert determination for technical disputes.",
      hardRedLine: "Exclusive jurisdiction of foreign courts; no arbitration option; dispute resolution clause that prevents emergency injunctive relief.",
    },
    ASSIGNMENT: {
      preferredPosition: "Neither party may assign without prior written consent. Change of control deemed assignment requiring consent. We may assign freely within our group on notice.",
      acceptableFallback: "Assignment with consent (not to be unreasonably withheld). Group assignments permitted on 5-day notice.",
      hardRedLine: "Supplier may assign freely without our consent, including to competitors.",
    },
    INSURANCE: {
      preferredPosition: "Supplier maintains: Professional Indemnity £5M+, Public Liability £10M+, Cyber Liability £5M+, Employers' Liability (statutory minimum). Evidence of cover on request. 30-day notice of material change.",
      acceptableFallback: "Professional Indemnity £2M+, Public Liability £5M+. Evidence on 5-day notice.",
      hardRedLine: "No insurance obligations, or supplier unilaterally reduces coverage below minimums without notice.",
    },
    NON_SOLICITATION: {
      preferredPosition: "Mutual 12-month post-termination restriction on soliciting key personnel directly involved in the engagement.",
      acceptableFallback: "12-month restriction on active solicitation (not response to general advertising).",
      hardRedLine: "Restriction of more than 18 months, or restriction covering general hiring not limited to personnel directly involved.",
    },
    EXCLUSIVITY: {
      preferredPosition: "No exclusivity unless compensated. If exclusivity granted, full market rate premium applies. Exit right if exclusivity prevents us from meeting regulatory or group requirements.",
      acceptableFallback: "Limited exclusivity in defined market segment only, with performance benchmarks and exit right on 90 days' notice.",
      hardRedLine: "Absolute exclusivity with no exit right and no minimum performance obligations on the supplier.",
    },
    CHANGE_OF_CONTROL: {
      preferredPosition: "We have right to terminate without penalty on 30 days' notice following change of control of supplier. 'Change of control' defined broadly to include asset sales.",
      acceptableFallback: "60-day notice period for termination following change of control. Right to re-paper terms post-change.",
      hardRedLine: "No change of control right; or change of control clause that only covers share sales (not asset sales or management change).",
    },
    RENT_REVIEW: {
      preferredPosition: "Open market rent review every 5 years, upward/downward. Assumptions on vacant possession, willing landlord and tenant. Dispute resolved by independent surveyor (RICS).",
      acceptableFallback: "Upward-only rent review, but capped at RPI + 1% per annum compound.",
      hardRedLine: "Uncapped upward-only rent review with no RPI/CPI cap; or landlord has unilateral right to set review figure.",
    },
    BREAK_CLAUSE: {
      preferredPosition: "Tenant break at years 3, 5, and 10. Conditions: vacant possession, no material rent arrears. 6 months' prior written notice. No other pre-conditions.",
      acceptableFallback: "Tenant break at year 5. Conditions: vacant possession and no arrears. 6 months' notice.",
      hardRedLine: "Break clause with conditions beyond vacant possession and rent arrears (e.g., compliance with all covenants, reinstatement obligations at break).",
    },
    REPAIR_OBLIGATIONS: {
      preferredPosition: "Tenant responsible for internal non-structural repairs. Landlord responsible for structural, external, and common parts. Schedule of Condition limits dilapidations liability.",
      acceptableFallback: "FRI lease but with Schedule of Condition cap on dilapidations. Landlord to notify dilapidations within 3 months of termination.",
      hardRedLine: "Full repairing and insuring (FRI) without Schedule of Condition; or clause requiring tenant to put premises into better condition than at lease commencement.",
    },
    SERVICE_CHARGE: {
      preferredPosition: "Service charge capped at 105% of previous year. Detailed budget provided 3 months before year start. Audited accounts within 3 months of year end. Tenant has right to challenge.",
      acceptableFallback: "Service charge with annual cap increase of RPI + 2%. Audited accounts within 6 months of year end.",
      hardRedLine: "Uncapped service charge with no obligation to provide accounts; or landlord may include capital expenditure in service charge without tenant consent.",
    },
    ENTIRE_AGREEMENT: {
      preferredPosition: "Entire agreement clause confirming the contract constitutes the whole agreement and supersedes all prior representations, negotiations, and agreements. Express carve-out for fraud.",
      acceptableFallback: "Entire agreement clause with acknowledgement of reliance on written representations made in the agreement itself.",
      hardRedLine: "No entire agreement clause where pre-contractual representations were made that the counterparty might rely on.",
    },
    VARIATION: {
      preferredPosition: "All variations must be in writing and signed by authorised representatives of both parties. No variation by email unless expressly authorised.",
      acceptableFallback: "Variations in writing; email exchange from authorised email domains constitutes 'writing' for operational amendments only.",
      hardRedLine: "Oral variations binding on us; or counterparty has unilateral right to amend terms by notice.",
    },
    WAIVER: {
      preferredPosition: "Waiver of any right or breach must be in writing and does not waive other or future rights. No waiver by course of dealing or acquiescence.",
      acceptableFallback: "Waiver must be in writing. Partial exercise of rights does not preclude further exercise.",
      hardRedLine: "Waiver clause that allows counterparty to argue course of dealing creates binding waivers of material rights.",
    },
    SEVERABILITY: {
      preferredPosition: "Invalid provisions are severable without affecting the remaining terms. Court is authorised to modify an invalid provision to the minimum extent necessary to make it valid.",
      acceptableFallback: "Standard severability with deletion of invalid provisions and saving of remainder.",
      hardRedLine: "No severability clause where contract contains provisions of questionable enforceability.",
    },
    NOTICES: {
      preferredPosition: "Formal notices in writing, delivered by: (i) hand; (ii) next-day courier; or (iii) email with read receipt, in each case to named contacts. Notice effective on actual receipt.",
      acceptableFallback: "Notices by email with 24-hour deemed receipt; or post with 2-business-day deemed receipt.",
      hardRedLine: "No notices clause, or notices clause requiring physical delivery only with no email alternative for urgent matters.",
    },
    THIRD_PARTY_RIGHTS: {
      preferredPosition: "No third parties acquire rights under this agreement. Contracts (Rights of Third Parties) Act 1999 is expressly excluded.",
      acceptableFallback: "Third party rights excluded except for named group companies or named beneficiaries.",
      hardRedLine: "Open-ended third party rights without identified beneficiaries; or clause that prevents us from amending the contract without third party consent.",
    },
    SET_OFF: {
      preferredPosition: "We retain the right to set off any undisputed amounts owed to us against payments due under this agreement. Counterparty's right to set off is excluded.",
      acceptableFallback: "Mutual right of set-off limited to undisputed, quantified debts arising under this agreement.",
      hardRedLine: "Our right to set off is excluded entirely, or counterparty has unconstrained right to set off unrelated debts.",
    },
    LIQUIDATED_DAMAGES: {
      preferredPosition: "Liquidated damages must represent a genuine pre-estimate of loss. Rate must be proportionate to breach. Cap on total LD exposure equal to 100% of annual contract value.",
      acceptableFallback: "LDs capped at 50% of total contract value. LDs are sole remedy for the specific breach they address unless fraud is involved.",
      hardRedLine: "Uncapped liquidated damages; or LDs framed as penalties without reference to genuine loss; or LDs accumulate without cap alongside damages at large.",
    },
    MOST_FAVOURED_NATION: {
      preferredPosition: "MFN clause requiring supplier to offer us pricing no less favourable than any other customer in a comparable volume and commitment tier. Automatic price reduction on trigger. 6-month lookback.",
      acceptableFallback: "MFN on pricing for substantially similar volumes; triggered by notification; we have 30 days to claim adjusted pricing.",
      hardRedLine: "No MFN protection where we are a significant customer; or MFN clause with so many exceptions as to be unenforceable in practice.",
    },
    BENCHMARKING: {
      preferredPosition: "Annual benchmarking right against market comparators. Supplier must match market pricing within 60 days or we may terminate on 90 days' notice without penalty.",
      acceptableFallback: "Benchmarking every 2 years; 90-day supplier cure period; termination right if pricing not adjusted within cure period.",
      hardRedLine: "No benchmarking right on contracts of 2 years or more; or benchmarking right that only triggers a right to negotiate rather than a right to terminate.",
    },
    STEP_IN_RIGHTS: {
      preferredPosition: "We may step in to perform or procure performance of the supplier's obligations if supplier is in material breach, insolvent, or causes a regulatory compliance risk. Step-in at supplier's cost.",
      acceptableFallback: "Step-in rights on 5 business days' notice for material breach not remedied within cure period. Reasonable step-in costs borne by supplier.",
      hardRedLine: "No step-in rights for critical services; or step-in restricted to circumstances that are practically impossible to trigger.",
    },
    SUBCONTRACTING: {
      preferredPosition: "Supplier may not subcontract critical obligations without our prior written consent. We must approve named subcontractors. Supplier remains liable for all subcontractor acts and omissions.",
      acceptableFallback: "Supplier may subcontract operational tasks (not core deliverables) on 10 business days' notice. Supplier remains fully liable.",
      hardRedLine: "Supplier may subcontract freely without consent or liability for subcontractor performance, particularly for obligations involving our personal data.",
    },
    BUSINESS_CONTINUITY: {
      preferredPosition: "Supplier must maintain a tested Business Continuity Plan and Disaster Recovery plan with RTO of 4 hours and RPO of 1 hour for critical systems. Evidence of testing on annual basis.",
      acceptableFallback: "Supplier maintains BCP/DR plan. Evidence on request. RTO/RPO targets aligned to agreed SLAs.",
      hardRedLine: "No BCP/DR obligations for services critical to our operations; or no obligation to test or evidence the plan.",
    },
    SERVICE_LEVELS: {
      preferredPosition: "SLAs defined for uptime (99.9%+), response times, and resolution times. Service credits automatically applied for breach. Persistent failure (3+ months below SLA) triggers termination right without penalty.",
      acceptableFallback: "SLAs with service credits as sole remedy. 12-month rolling assessment window. Termination right after 6 months of material underperformance.",
      hardRedLine: "No SLAs; or SLAs with no credits or remedies; or service credits that act as a cap on all liability for performance failure.",
    },
    SOURCE_CODE_ESCROW: {
      preferredPosition: "Source code and documentation deposited with independent escrow agent (e.g. NCC Group). Release triggers include supplier insolvency, material breach uncured after 30 days, cessation of product support.",
      acceptableFallback: "Escrow arrangement with release on insolvency and end-of-life of the product. Annual verification deposit.",
      hardRedLine: "No escrow obligation for bespoke software on which we are operationally dependent; or escrow with release triggers that require court order.",
    },
    MARKETING_RIGHTS: {
      preferredPosition: "Counterparty may not use our name, logo, or describe us as a customer in any marketing, press release, or case study without our prior written consent on each occasion.",
      acceptableFallback: "Counterparty may list us as a customer in their general customer list only. All other uses require written consent.",
      hardRedLine: "Blanket consent to use our name in any marketing material; or press release rights that cannot be revoked.",
    },
    ANTI_BRIBERY: {
      preferredPosition: "Supplier warrants compliance with UK Bribery Act 2010 (and all applicable anti-corruption laws). Adequate procedures in place. Immediate termination right for breach without liability.",
      acceptableFallback: "Compliance warranty with Bribery Act and applicable anti-corruption law. Right to terminate on reasonable grounds of breach.",
      hardRedLine: "No anti-bribery representations; or clause that limits our termination right for demonstrated corruption.",
    },
    SANCTIONS_COMPLIANCE: {
      preferredPosition: "Supplier warrants no dealings with sanctioned persons or jurisdictions (UN, UK, EU, US OFAC). Immediate notification of any sanctions risk. Termination right without penalty if sanctions conflict arises.",
      acceptableFallback: "Sanctions compliance warranty. Obligation to notify within 5 business days of any sanctions exposure. Termination right on notice.",
      hardRedLine: "No sanctions clause; or clause that requires us to continue performance if counterparty becomes subject to sanctions.",
    },
    MODERN_SLAVERY: {
      preferredPosition: "Supplier warrants compliance with Modern Slavery Act 2015. Annual transparency statement provided. Right to audit supply chain. Immediate termination right for breach.",
      acceptableFallback: "Compliance with Modern Slavery Act. Notification of any known or suspected breach in supply chain. Remediation plan required within 30 days.",
      hardRedLine: "No modern slavery obligations in contracts with significant supply chain exposure; or no audit right.",
    },
    ENVIRONMENTAL_OBLIGATIONS: {
      preferredPosition: "Supplier must comply with all applicable environmental law and our published ESG policy (updated annually). Net zero commitments and Scope 3 emission data on request. Green obligations flow down to subcontractors.",
      acceptableFallback: "Compliance with applicable environmental law. Good faith cooperation with our sustainability reporting requirements.",
      hardRedLine: "No environmental compliance warranty; or resistance to providing Scope 3 data for contracts where we have regulatory reporting obligations.",
    },
    TUPE: {
      preferredPosition: "Supplier warrants it has complied with all TUPE obligations. Full indemnity for any pre-transfer employment liabilities. Employee liability information provided 28 days before transfer.",
      acceptableFallback: "TUPE compliance warranty with indemnity for liabilities arising from pre-transfer employment matters. Employee information on reasonable notice.",
      hardRedLine: "No TUPE indemnity; or clause that shifts pre-transfer employment liabilities to us without corresponding price adjustment.",
    },
    RESTRICTIVE_COVENANTS: {
      preferredPosition: "Non-compete restricted to 12 months post-termination in the specific market segment and geography covered by the agreement. Non-solicitation of customers limited to named accounts.",
      acceptableFallback: "Non-compete of up to 12 months; non-solicitation of customers we have introduced for 12 months. Garden leave applies for executive departures.",
      hardRedLine: "Non-compete exceeding 12 months or broader than the specific competitive activity undertaken; or unrestricted geographic scope.",
    },
    ACCEPTANCE_TESTING: {
      preferredPosition: "Formal acceptance testing process. Acceptance criteria agreed in writing before commencement. 20-business-day testing window. Failure to respond to acceptance certificate deemed rejection.",
      acceptableFallback: "Acceptance testing with 15-business-day window. Supplier remediation period of 10 days after failure. Deemed acceptance after two failed test cycles if we do not object.",
      hardRedLine: "No acceptance testing for bespoke deliverables; or deemed acceptance if we do not respond within an unreasonably short period.",
    },
    REGULATORY_CHANGE: {
      preferredPosition: "If a regulatory change materially affects a party's obligations, the affected party may request renegotiation. If no agreement within 30 days, either party may terminate on 60 days' notice without penalty.",
      acceptableFallback: "Obligation to notify of material regulatory change. Good faith renegotiation obligation. Termination right if compliance becomes legally impossible.",
      hardRedLine: "No regulatory change mechanism; or clause that requires us to bear the cost of regulatory changes that materially increase the supplier's cost of performance.",
    },
    CONTENT_MODERATION: {
      preferredPosition: "Publisher/platform must maintain a published content moderation policy compliant with all applicable laws (DSA, AVMSD, Children's Code, COPPA). Platform indemnifies us for removal of our content that is compliant with the agreed content standards. We retain the right to audit takedown decisions affecting our titles. Disputes escalated to named senior contacts within 48 hours.",
      acceptableFallback: "Platform's content moderation policy applies. Platform must give 48-hour notice before removing our content except where required by law or for clear illegal content. Dispute escalation process agreed.",
      hardRedLine: "Platform has unilateral right to remove or restrict our content with no notice, no dispute mechanism, and no liability - particularly where this could affect revenue-generating live service titles.",
    },
    VIRTUAL_ITEMS: {
      preferredPosition: "All virtual items, in-game currency, and digital goods are licensed (not sold) to end users. We retain full IP ownership in all virtual items. Supplier/platform must not allow unauthorised trading, resale, or secondary market activity without our written consent. Real-money value of virtual currency must be disclosed transparently in-game and in store listings. Odds for randomised items disclosed prominently before purchase. Unused currency refund policy aligns with applicable consumer rights law.",
      acceptableFallback: "Virtual items licensed to end users on our published terms. Platform follows our pricing and disclosure instructions for virtual currency. Secondary market activity (outside our approved model) prohibited. Probability disclosure for randomised items to comply with applicable law.",
      hardRedLine: "Platform claims ownership of any virtual items or currency we develop; or platform enables secondary market trading or cashing-out of our virtual currency without our consent; or no mechanism to update odds disclosure to meet new legal requirements.",
    },
    PLATFORM_REVENUE_SHARE: {
      preferredPosition: "Platform revenue share fixed at the rates set out in Schedule [X] for the initial term. Any changes to store fees require 180-day notice and our written consent. Net revenue calculated after applicable taxes and chargebacks only - no deduction of platform marketing or promotional costs without our approval. Monthly reconciliation reports within 10 business days of month-end. We retain right to audit platform's revenue calculation methodology.",
      acceptableFallback: "Revenue share at agreed rates. Platform may adjust standard store rates with 90-day notice; if new rates materially disadvantage us, we have the right to terminate distribution on that platform within 6 months without penalty. Monthly revenue reports. Audit right on 15 days' notice.",
      hardRedLine: "Platform may unilaterally change revenue share rates with less than 30 days' notice; or revenue calculations are not transparent; or no audit right; or platform deducts promotional spend or platform-level costs from our revenue share without our prior consent.",
    },
    LOOT_BOX_MECHANICS: {
      preferredPosition: "All randomised reward systems (loot boxes, gacha, battle pass, card packs) are designed to comply with applicable gambling law in each launch jurisdiction. Probability/odds of all obtainable items disclosed prominently before purchase and within the UI. Hard cap on daily and monthly spend per account implemented in the game client. Age verification gates restrict access for minors (under-18 or jurisdiction-specific minimum). No pay-to-win mechanics that create a significant competitive disadvantage for non-spending players. Publisher warrants that loot box design has been reviewed by legal counsel in each relevant jurisdiction prior to launch.",
      acceptableFallback: "Randomised reward mechanics designed to comply with applicable law. Probability disclosure provided before purchase. Spend controls implemented for minor accounts. Legal review conducted for major launch jurisdictions (UK, Germany, Netherlands, Belgium, South Korea, US). Launch in markets with gambling classification risk (Belgium, Netherlands) requires joint legal sign-off.",
      hardRedLine: "No probability disclosure obligation; or loot box mechanics not reviewed for gambling classification before launch; or no spend controls for minors; or we bear sole liability for regulatory action arising from loot box mechanics that the publisher/platform approved or required.",
    },
    // ── Investment document clauses ──────────────────────────────────────────
    LIQUIDATION_PREFERENCE: {
      preferredPosition: "1x non-participating preferred only. Investor recoups investment first, then converts to ordinary and participates pro-rata with no further preference.",
      acceptableFallback: "1x participating preferred with a hard cap at 2x total return, after which the preference falls away entirely.",
      hardRedLine: "2x or higher participating preferred, or uncapped participating preferred that allows the investor to double-dip without limit at exit.",
    },
    ANTI_DILUTION: {
      preferredPosition: "Broad-based weighted average anti-dilution only. Provides meaningful down-round protection without disproportionately punishing the founding team.",
      acceptableFallback: "Narrow-based weighted average anti-dilution, subject to a 24-month sunset.",
      hardRedLine: "Full ratchet anti-dilution under any circumstances - retroactively re-prices all prior investor shares to the new lower price and severely dilutes founders.",
    },
    PRO_RATA_RIGHTS: {
      preferredPosition: "Meaningful pro-rata rights for all investors above a defined threshold, allowing them to maintain their ownership percentage in future rounds.",
      acceptableFallback: "Pro-rata rights restricted to lead investors or investors holding above 5% of shares.",
      hardRedLine: "Wholesale waiver of existing investor pro-rata rights without their individual consent.",
    },
    DRAG_ALONG: {
      preferredPosition: "Drag-along requires majority of ordinary shareholders and majority of preference holders. No drag below a board-approved minimum valuation. Founders have a personal veto below book value.",
      acceptableFallback: "75% threshold of all issued shares (fully diluted) required to trigger drag. Valuation floor provisions apply.",
      hardRedLine: "Investors may drag ordinary shareholders to a sale without a majority of ordinary shares consenting, or drag at any valuation including below par.",
    },
    INFORMATION_RIGHTS: {
      preferredPosition: "Monthly management accounts, annual audited accounts, board observer rights for lead investor. Annual budget presented to and approved by the board. Material event notification within 5 business days.",
      acceptableFallback: "Quarterly management accounts, annual audited accounts, and observer rights for investors above 5% ownership.",
      hardRedLine: "No information rights beyond the statutory minimum under the Companies Act, or active contractual restriction on sharing financial performance with investors.",
    },
    BOARD_COMPOSITION: {
      preferredPosition: "Founders retain majority board control at all times. Investor board appointees limited to one seat regardless of ownership. Independent director appointed by and removable by founders.",
      acceptableFallback: "Equal founder and investor board representation, with an independent chair appointed by mutual agreement acting as tiebreaker.",
      hardRedLine: "Investors hold majority board control at Series A or earlier, or founders can be removed from the board by investor vote alone without cause.",
    },
    VESTING_LEAVER: {
      preferredPosition: "4-year vesting, 1-year cliff. Good leaver defined to include resignation after 24 months. Bad leaver provisions strictly limited to fraud, gross misconduct, and material unremedied breach. Full acceleration on change of control for good leavers.",
      acceptableFallback: "Standard 4-year vesting, 1-year cliff. Clear and objective good/bad leaver definitions based on conduct, not performance. Partial acceleration (at least 50%) on good leaver exit.",
      hardRedLine: "All unvested shares forfeited on any resignation irrespective of service length, or provisions that treat constructive dismissal as a bad leaver event.",
    },
    OPTION_POOL_SHUFFLE: {
      preferredPosition: "Option pool created or expanded post-closing on a fully diluted basis inclusive of the new investment. All shareholders, including the incoming investor, dilute pro-rata for the pool.",
      acceptableFallback: "Pre-money option pool acceptable only if sized at a maximum of 10% and transparently reflected in the headline pre-money valuation.",
      hardRedLine: "Oversized pre-money option pool (above 15%) used to artificially reduce the effective pre-money valuation paid by the investor without transparent disclosure.",
    },
    PAY_TO_PLAY: {
      preferredPosition: "No pay-to-play provisions. Non-participating investors retain all existing rights including preference and anti-dilution.",
      acceptableFallback: "Soft pay-to-play converting preference shares to ordinary only, with a minimum 30-day cure period and written notice.",
      hardRedLine: "Hard pay-to-play that automatically strips anti-dilution rights and liquidation preference without a cure period or board discretion.",
    },
    REDEMPTION_RIGHTS: {
      preferredPosition: "No redemption rights under any circumstances. Preference shares are equity instruments, not debt.",
      acceptableFallback: "Redemption as a long-stop only after 7+ years if no liquidity event has occurred, subject to 12-month written notice and board approval.",
      hardRedLine: "Redemption rights exercisable within 5 years, at investor discretion, or without requiring a formal liquidity event trigger.",
    },
    // ── Insurance litigation clauses ─────────────────────────────────────────
    INS_COVERAGE_RESPONSE: {
      preferredPosition: "Policy clearly responds: all coverage triggers met, no exclusions apply, insured has complied with all conditions.",
      acceptableFallback: "Coverage arguable: primary position responds but one or more conditions or exclusions require analysis before confirming.",
      hardRedLine: "Coverage does not respond, a clear exclusion applies, or a material condition precedent has been breached.",
    },
    INS_EXCLUSIONS_ANALYSIS: {
      preferredPosition: "No applicable exclusion identified. Policy wording unambiguous and insured's conduct does not trigger any exclusion.",
      acceptableFallback: "One exclusion potentially applicable but arguments available on both sides. Requires senior review before position is taken.",
      hardRedLine: "A clear and unambiguous exclusion applies. Coverage denial is legally defensible.",
    },
    INS_NOTIFICATION_COMPLIANCE: {
      preferredPosition: "Notification received within the required timeframe, in the correct form, and to the correct party. No condition precedent issues.",
      acceptableFallback: "Notification technically late but arguments available that condition was not a condition precedent, or that the insurer has not been prejudiced.",
      hardRedLine: "Notification clearly non-compliant: materially out of time, wrong form, or missing information that cannot be excused.",
    },
    INS_QUANTUM_ASSESSMENT: {
      preferredPosition: "Current reserve is adequate and reflects a realistic assessment of exposure. No reserve movement required.",
      acceptableFallback: "Reserve requires review. Realistic range is above current reserve but within acceptable parameters for claims committee reporting.",
      hardRedLine: "Current reserve is materially inadequate. Exposure significantly exceeds reserve. Immediate reserve uplift and committee reporting required.",
    },
    INS_DEFENCE_PROSPECTS: {
      preferredPosition: "Strong defence prospects. Claim is defensible on liability and/or quantum. Recommend defend.",
      acceptableFallback: "Reasonable defence prospects but outcome uncertain. Consider commercial settlement to manage costs and litigation risk.",
      hardRedLine: "Weak or indefensible. Liability likely established. Settlement is the commercially rational outcome.",
    },
    INS_SETTLEMENT_AUTHORITY: {
      preferredPosition: "Recommended settlement within litigation handler authority. No escalation required.",
      acceptableFallback: "Recommended settlement within senior litigation counsel authority. Single-level escalation required.",
      hardRedLine: "Recommended settlement exceeds claims committee or board authority. Full escalation required before any settlement discussions.",
    },
    INS_REGULATORY_OBLIGATIONS: {
      preferredPosition: "All FCA claims handling obligations met. TCF requirements satisfied. All timeframes and reporting duties complied with.",
      acceptableFallback: "One or more regulatory obligations at risk of breach. Remediation steps underway. FCA notification not yet required.",
      hardRedLine: "Regulatory breach identified. FCA notification obligation triggered or imminent. Immediate compliance action required.",
    },
    INS_SUBROGATION_POTENTIAL: {
      preferredPosition: "Strong subrogation prospects against an identifiable and solvent third party. Recovery action should be pursued.",
      acceptableFallback: "Subrogation possible but uncertain. Third party identified; prospects require further investigation before committing to recovery action.",
      hardRedLine: "Subrogation unlikely. Third party unidentified, insolvent, or defence of primary claim takes priority.",
    },
    INS_PANEL_FIRM_INSTRUCTIONS: {
      preferredPosition: "Panel firm spend and strategy within approved guidelines. Budget forecast within approved parameters.",
      acceptableFallback: "Panel spend approaching approved threshold. Budget review and approval required before further instruction.",
      hardRedLine: "Panel spend exceeds approved threshold or strategy materially deviates from instructions. Immediate review and re-approval required.",
    },
    INS_RESERVE_ADEQUACY: {
      preferredPosition: "Reserve is adequate and reflects current best estimate of ultimate exposure. No movement required at this stage.",
      acceptableFallback: "Reserve requires upward review. Exposure development warrants adjustment before next reporting period.",
      hardRedLine: "Reserve is materially inadequate. Immediate uplift required. Board or claims committee reporting obligation triggered.",
    },
    // ── Insurance litigation - extended ─────────────────────────────────────
    INS_FRAUD_INDICATORS: {
      preferredPosition: "Mandatory fraud indicator checks on all new instructions. Insurer to conduct independent investigation before any interim payment. All suspected fraud referred to SIU within 5 business days.",
      acceptableFallback: "Fraud indicators reviewed at case inception. SIU referral protocol in place.",
      hardRedLine: "No anti-fraud protocol or SIU referral procedure.",
    },
    INS_REHABILITATION: {
      preferredPosition: "Early intervention rehabilitation programme mandated for all injury claims. Case manager appointed within 10 days of notification. Regular progress reporting to reserve team.",
      acceptableFallback: "Rehabilitation offered at claimant's election within 20 days of notification.",
      hardRedLine: "No rehabilitation obligation or protocol.",
    },
    INS_EXPERT_EVIDENCE: {
      preferredPosition: "Single joint expert appointed by agreement except where liability is contested. Expert instructions reviewed by legal panel before issue. Expert reports disclosed within 28 days of receipt.",
      acceptableFallback: "Party-appointed experts permitted for contested liability. Costs subject to court direction.",
      hardRedLine: "Unrestricted use of multiple experts without cost control.",
    },
    INS_PART36_CPR: {
      preferredPosition: "All Part 36 offers reviewed within 5 business days of receipt. Counter-offers formulated within 10 business days. Compliance with CPR Part 36 evidenced in writing for each offer made.",
      acceptableFallback: "Part 36 review within 10 business days. Counter-offer within 15 business days.",
      hardRedLine: "No CPR Part 36 compliance protocol or response timeframes.",
    },
    INS_COSTS_BUDGETING: {
      preferredPosition: "Costs budget filed at CCMC. Proportionality applied to all phases. Budget challenged where phases exceed 120% of comparable cases. Regular costs monitoring throughout litigation.",
      acceptableFallback: "Costs budget reviewed at CCMC. Challenge disproportionate phases.",
      hardRedLine: "No costs budget oversight or challenge procedure.",
    },
    INS_THIRD_PARTY_CAPTURE: {
      preferredPosition: "Proactive third-party capture programme for all fault claims. Initial contact within 5 days of FNOL. Independent medical assessment before admission of liability. Capture confirmed in writing.",
      acceptableFallback: "Third-party capture offered on all fault claims. Contact within 10 days.",
      hardRedLine: "No third-party capture programme.",
    },
    INS_CLAIMS_TIMEFRAMES: {
      preferredPosition: "Acknowledgement within 24 hours of FNOL. Coverage decision within 10 business days. All interim payments processed within 5 business days of authority. SLA reporting monthly to insured.",
      acceptableFallback: "Acknowledgement within 48 hours. Coverage decision within 15 business days.",
      hardRedLine: "No defined claims handling SLAs or reporting obligations.",
    },
    INS_CONDITIONS_PRECEDENT: {
      preferredPosition: "All conditions precedent strictly monitored. Breach of any condition precedent documented in writing within 5 business days. Waiver of condition only by written endorsement.",
      acceptableFallback: "Conditions precedent monitored. Non-compliance notified within 10 business days.",
      hardRedLine: "Conditions precedent treated as conditions subsequent or waived without endorsement.",
    },
    INS_CONTRIBUTION: {
      preferredPosition: "Contribution sought from all co-insurers and other policy layers as a matter of course. Reservation of contribution rights in all coverage communications. Recovery within 90 days of settlement.",
      acceptableFallback: "Contribution rights reserved. Recovery pursued on claims above agreed threshold.",
      hardRedLine: "No contribution rights or contribution waived without commercial justification.",
    },
    INS_REINSTATEMENT: {
      preferredPosition: "Reinstatement basis applies to all property claims unless manifestly uneconomical. Reinstatement cost assessed by independent loss adjuster. Election of basis by insured within 28 days of loss.",
      acceptableFallback: "Reinstatement offered unless cost exceeds 115% of market value. Insured election within 42 days.",
      hardRedLine: "Indemnity basis applied without offering reinstatement election.",
    },
    // ── Logistics contract clauses ───────────────────────────────────────────
    LOG_LIABILITY_CAP_CMR: {
      preferredPosition: "Liability limited to CMR Convention limits for international road freight (8.33 SDR per kg). All attempts to exclude CMR limits rejected.",
      acceptableFallback: "Enhanced liability cap agreed at a defined per-consignment limit with corresponding insurance in place. CMR limits as backstop.",
      hardRedLine: "Customer paper excludes CMR limits entirely and imposes uncapped liability for cargo loss or damage beyond insurance cover.",
    },
    LOG_CARGO_LIABILITY: {
      preferredPosition: "Cargo liability limited to insured values. Customer has arranged own cargo insurance. Our liability capped at CMR or agreed per-consignment limit.",
      acceptableFallback: "Liability for cargo loss or damage capped at a defined limit commensurate with our insurance cover. Enhanced limit with additional premium.",
      hardRedLine: "Liability for cargo loss or damage exceeds our insurance cover. Uncapped exposure creates uninsurable risk.",
    },
    LOG_INDEMNITY: {
      preferredPosition: "Indemnities are proportionate and fault-based. We indemnify for our own negligence only. Customer indemnifies for their acts, omissions, and misdescription of cargo.",
      acceptableFallback: "Mutual indemnities limited to gross negligence and wilful misconduct. Each party responsible for losses caused by their own breach.",
      hardRedLine: "We are required to indemnify the customer for their own negligence, misdescription of cargo, or inadequate packaging.",
    },
    LOG_SERVICE_LEVELS: {
      preferredPosition: "SLAs are achievable and reflect operational reality. Force majeure covers customs delays, port congestion, industrial action, and weather events. Service credits proportionate and capped.",
      acceptableFallback: "Reasonable SLAs with force majeure for material disruption events. Service credits as sole remedy for SLA breach capped at 10% of monthly fees.",
      hardRedLine: "Punitive SLAs without force majeure for logistics-specific disruption. Service credits uncapped or structured as penalties.",
    },
    LOG_SUBCONTRACTING: {
      preferredPosition: "Unrestricted right to subcontract to approved hauliers and logistics partners. Pass-through liability. No prior approval required for routine subcontracting.",
      acceptableFallback: "Subcontracting permitted on notification. We remain liable for subcontractor performance. Named approved subcontractors list maintained.",
      hardRedLine: "Prior written approval required for every subcontract engagement. Approval cannot be unreasonably withheld but creates operational bottleneck.",
    },
    LOG_DATA_GDPR: {
      preferredPosition: "Controller/processor split clearly defined. DPA in place. Shipment data, customer data, and driver data obligations clearly allocated. Cross-border transfer mechanisms in place.",
      acceptableFallback: "DPA in place with standard processing obligations. Data sharing with customs authorities covered by legitimate interest or legal obligation basis.",
      hardRedLine: "No DPA where personal data is being processed. Ambiguous data ownership for tracking data or driver data.",
    },
    LOG_GOVERNING_LAW: {
      preferredPosition: "English law governing the contract. English courts have exclusive jurisdiction. Consistent with our standard trading conditions.",
      acceptableFallback: "English law with non-exclusive jurisdiction or agreed arbitration. Jurisdiction reflects major operational territory.",
      hardRedLine: "Foreign jurisdiction with no local legal resource. Governing law clause that would determine outcome of a major cargo claim in an unfamiliar court.",
    },
    LOG_TERMINATION: {
      preferredPosition: "Either party may terminate on 90 days written notice. No transition obligations beyond standard handover. Exit at any time on convenience without penalty.",
      acceptableFallback: "120-day convenience termination. Standard data return and handover obligations. No punitive exit costs.",
      hardRedLine: "Lock-in beyond 12 months with punitive exit costs. Transition obligations that create open-ended liability on exit.",
    },
    LOG_TRADE_COMPLIANCE: {
      preferredPosition: "Each party responsible for their own trade compliance and sanctions screening. Customer warrants cargo does not breach sanctions. Immediate suspension right if sanctions risk identified.",
      acceptableFallback: "Shared trade compliance obligations. Mutual notification of any sanctions exposure. Suspension right on reasonable grounds.",
      hardRedLine: "We are required to take on the customer's sanctions screening and export control compliance obligations without corresponding indemnity.",
    },
    LOG_AUDIT_REPORTING: {
      preferredPosition: "Annual audit right on 30 days written notice. Reporting obligations limited to agreed KPI metrics. Audit costs borne by auditing party unless material breach found.",
      acceptableFallback: "Audit on 15 days notice, once per year. Standard operational reporting. Reasonable audit costs.",
      hardRedLine: "Continuous access right or real-time reporting obligations without a data security framework. Audit costs borne by us regardless of outcome.",
    },
    // ── Logistics contract - extended ────────────────────────────────────────
    LOG_CARRIER_PAYMENT: {
      preferredPosition: "Payment terms: 30 days from correct invoice. Fuel surcharges indexed to published HMRC/BIFA fuel index. Any surcharge above 10% requires 30 days' prior written notice.",
      acceptableFallback: "45-day payment terms. Fuel surcharges capped at BIFA index + 5%. 14-day notice for increases.",
      hardRedLine: "Payment below 14 days or uncapped fuel surcharges with no index linkage.",
    },
    LOG_DANGEROUS_GOODS: {
      preferredPosition: "Full ADR compliance for all dangerous goods. Carrier must hold valid ADR certificate. Training records available on request. UN-approved packaging certificates provided per shipment. Incident reporting within 2 hours.",
      acceptableFallback: "ADR compliance required. Certificate on request. Incident reporting within 4 hours.",
      hardRedLine: "No ADR compliance obligation or incident reporting requirement.",
    },
    LOG_CUSTOMS_CLEARANCE: {
      preferredPosition: "Carrier responsible for customs broker appointment unless otherwise agreed in writing. Full commodity codes and tariff classifications provided by shipper 5 business days before shipment. Customs duties and VAT liability agreed in writing per Incoterm.",
      acceptableFallback: "Customs responsibilities agreed per Incoterms. Broker identity confirmed pre-shipment.",
      hardRedLine: "Customs liability unallocated or carrier assumes full import duty without cap.",
    },
    LOG_PACKAGING_LABELING: {
      preferredPosition: "All packaging to IATA/IMDG/ADR standards as applicable. Shipper provides compliant labels, marks, and documentation. Carrier entitled to refuse non-compliant consignments without liability. Labelling audit rights retained.",
      acceptableFallback: "Packaging compliance with applicable regulations. Carrier may refuse manifestly non-compliant goods.",
      hardRedLine: "No packaging or labelling compliance obligation on shipper.",
    },
    LOG_COLD_CHAIN: {
      preferredPosition: "Temperature-controlled transport to specified range throughout journey. Pre-trip inspection records retained. Real-time temperature monitoring with automatic alert at 0.5 degrees Celsius deviation. Data logger records provided within 2 hours of delivery.",
      acceptableFallback: "Temperature monitoring throughout transit. Records provided within 4 hours of delivery. Immediate alert on deviation.",
      hardRedLine: "No temperature monitoring obligation or data records.",
    },
    LOG_TRACK_TRACE: {
      preferredPosition: "Real-time GPS tracking throughout transit. Customer portal access to live shipment status. Estimated time of arrival updated every 30 minutes. Full audit trail retained for 7 years.",
      acceptableFallback: "Tracking with customer access. ETA updates on material change. Records retained 3 years.",
      hardRedLine: "No tracking or shipment visibility obligation.",
    },
    LOG_FORCE_MAJEURE: {
      preferredPosition: "Logistics force majeure limited to: natural disasters, port closures by competent authority, government-imposed border closures. Excludes: labour disputes, fuel shortages, customs delays, capacity constraints. 24-hour notice required. 5-day long-stop triggers customer routing right.",
      acceptableFallback: "Force majeure covering unforeseeable transport disruptions. 48-hour notice. 7-day long-stop triggers alternative carrier right.",
      hardRedLine: "Force majeure covering routine operational issues such as capacity constraints, fuel price increases, or driver shortages.",
    },
    LOG_INSURANCE_CERT: {
      preferredPosition: "Carrier must hold and evidence: CMR liability insurance minimum SDR 8.33/kg, cargo all-risks, public liability £10M+, goods-in-transit cover. Certificates provided before first shipment and annually. 30-day notice of material change or cancellation.",
      acceptableFallback: "CMR insurance and goods-in-transit cover required. Certificates on request. 14-day notice of change.",
      hardRedLine: "No insurance certificate obligation or coverage minimums.",
    },
    LOG_INTERNATIONAL_CONVENTIONS: {
      preferredPosition: "CMR Convention applies to all international road freight. Carrier liability at CMR rates unless special declaration made and accepted. Hague-Visby Rules apply to sea legs. Montreal Convention applies to air legs. No convention exclusion or limitation of liability below convention minima.",
      acceptableFallback: "Applicable transport convention governs each leg. Convention liability minimum preserved in all circumstances.",
      hardRedLine: "Convention liability excluded or reduced below statutory minimums.",
    },
    LOG_DRIVER_COMPLIANCE: {
      preferredPosition: "All drivers to hold valid vocational licence, CPC qualification, and digital tachograph card. Carrier to maintain records of driver hours in compliance with EU/UK drivers' hours rules. DVSA compliance checks evidenced annually. No driver with 3+ endorsements in 36 months.",
      acceptableFallback: "Driver qualification records maintained. Tachograph compliance evidenced on request. DVSA check evidence on annual basis.",
      hardRedLine: "No driver compliance obligations or records.",
    },
    // ── Technology & SaaS clauses ────────────────────────────────────────────
    TECH_API_TERMS: {
      preferredPosition: "API access governed by documented SLA. Rate limits disclosed upfront and not unilaterally reduced during term. Versioning policy guarantees minimum 12-month deprecation notice. Breaking changes require 6-month advance notice. We retain right to access our data via API for full term plus 90-day extraction period post-termination.",
      acceptableFallback: "API access on published terms. 6-month deprecation notice. Data extraction rights on termination for 60 days.",
      hardRedLine: "No guaranteed API availability, no deprecation notice, or no data extraction right on termination.",
    },
    TECH_UPTIME_SLA: {
      preferredPosition: "99.9% monthly uptime (excluding scheduled maintenance). Scheduled maintenance windows in non-peak hours with 48-hour notice. Service credits of 10% monthly fee per 0.1% below SLA, capped at 30% monthly fee. Persistent breach (3 consecutive months below SLA) triggers termination right without penalty.",
      acceptableFallback: "99.5% uptime. Service credits as sole remedy for SLA breach. Termination right after 6 months of persistent underperformance.",
      hardRedLine: "No uptime SLA, no service credits, or credits that cap all liability for downtime causing material business disruption.",
    },
    TECH_DATA_PORTABILITY: {
      preferredPosition: "Full data export in machine-readable format (CSV, JSON, or API) at any time during the term and for 90 days post-termination at no additional charge. Supplier must not degrade data quality or completeness on export. Deletion certification provided on request after extraction period.",
      acceptableFallback: "Data export in standard format available on request with 10 business days' notice. 60-day post-termination extraction period.",
      hardRedLine: "No data export right, export in proprietary non-portable format only, or export charged at rates that make it economically prohibitive.",
    },
    TECH_OPEN_SOURCE: {
      preferredPosition: "Supplier discloses all open source components used in the service. No copyleft (GPL/AGPL) components that could affect our IP in deliverables. SBOM (Software Bill of Materials) provided on request. CVE notifications within 24 hours for critical vulnerabilities in disclosed components.",
      acceptableFallback: "Open source disclosure on request. No GPL-licensed components in deliverables. CVE notification for critical vulnerabilities within 5 business days.",
      hardRedLine: "No open source disclosure obligation where deliverables may incorporate copyleft-licensed components affecting our IP.",
    },
    TECH_SECURITY_STANDARDS: {
      preferredPosition: "Supplier holds current ISO 27001 certification or SOC 2 Type II attestation. Annual penetration testing by approved third party. Security patches applied within 72 hours of critical CVE disclosure. Security incident notification within 4 hours of confirmed breach.",
      acceptableFallback: "ISO 27001 or SOC 2 Type II. Annual pen testing. Critical patches within 5 business days. Security incident notification within 24 hours.",
      hardRedLine: "No security certification, no pen testing obligation, or incident notification period exceeding 72 hours for critical breaches.",
    },
    TECH_CHANGE_MANAGEMENT: {
      preferredPosition: "All material changes to the service (new features affecting existing workflows, UI changes, deprecations) communicated 30 days in advance. Release notes provided. Backward compatibility maintained for minimum 12 months on APIs and data schemas. Emergency hotfixes documented and notified within 24 hours.",
      acceptableFallback: "Material changes notified with 14 days' advance notice. API backward compatibility for 6 months minimum.",
      hardRedLine: "No advance change notice; or supplier may make breaking changes to APIs or data schemas without notice.",
    },
    // ── Financial Services clauses ───────────────────────────────────────────
    FIN_REGULATORY_PERMISSIONS: {
      preferredPosition: "Counterparty warrants it holds all required FCA/PRA authorisations for the regulated activities performed under this agreement. Obligation to notify us within 24 hours of any restriction, variation, or withdrawal of permissions. Immediate suspension right if permissions lapse. Contract voids automatically if counterparty loses required permissions.",
      acceptableFallback: "Permissions warranty. Notification of material regulatory action within 5 business days. Termination right on permissions lapse.",
      hardRedLine: "No regulatory permissions warranty where counterparty performs regulated activities; or no notification obligation on permissions change.",
    },
    FIN_CLIENT_MONEY: {
      preferredPosition: "Client money held in segregated accounts in accordance with FCA CASS rules. Statutory trust acknowledged in contract. Daily reconciliation. Immediate notification of any CASS breach. We are named as beneficiary on segregated accounts.",
      acceptableFallback: "CASS-compliant segregation. Reconciliation within 2 business days. Notification of breaches within 24 hours.",
      hardRedLine: "No CASS segregation commitment for contracts involving client money; or commingling of client and firm money.",
    },
    FIN_BEST_EXECUTION: {
      preferredPosition: "Best execution policy maintained and applied to all orders. Policy reviewed annually and on material change in market structure. Order execution data available on request. Top 5 execution venues disclosed as required by MiFID II/UK MiFIR.",
      acceptableFallback: "Best execution policy maintained. Annual review. Execution data on request.",
      hardRedLine: "No best execution obligation where MiFID II/UK MiFIR applies to the services.",
    },
    FIN_FINANCIAL_PROMOTION: {
      preferredPosition: "All financial promotions produced by or on behalf of us are approved by an FCA-authorised person before communication. Supplier warrants that any content it produces under this agreement complies with COBS 4 and relevant FCA guidance. Liability for unapproved financial promotions remains with the communicating party.",
      acceptableFallback: "Financial promotions approval process agreed. Compliance with applicable FCA financial promotion rules warranted.",
      hardRedLine: "No financial promotion compliance framework for contracts involving consumer-facing regulated content.",
    },
    FIN_MARGIN_COLLATERAL: {
      preferredPosition: "Credit support documentation (CSA or equivalent) executed alongside master agreement. Collateral threshold and minimum transfer amounts agreed. Eligible collateral specified. Dispute resolution for margin calls within 1 business day. Close-out netting enforceability confirmed in applicable jurisdictions.",
      acceptableFallback: "Margin and collateral terms documented. Close-out netting provisions included. Dispute process agreed.",
      hardRedLine: "No credit support documentation for derivative or leveraged transactions; or close-out netting not contractually confirmed.",
    },
    FIN_BENCHMARK_RATES: {
      preferredPosition: "All reference rates use current SONIA/SOFR (or applicable ARR) with agreed credit adjustment spread. Legacy LIBOR references replaced. Fallback provisions compliant with ISDA 2020 IBOR Fallbacks Protocol. Rate screen page, fallback hierarchy, and interpolation methodology specified in the contract.",
      acceptableFallback: "Current ARR-based rates used. ISDA-compliant fallback provisions. Fallback hierarchy specified.",
      hardRedLine: "Reference to discontinued benchmark rates with no fallback provision; or fallback mechanism creates unilateral rate-setting by one party.",
    },
    // ── Healthcare & Life Sciences clauses ───────────────────────────────────
    HEALTH_PATIENT_DATA: {
      preferredPosition: "Patient data processed only under explicit consent or Schedule 3 DPA 2018 condition. Separate Data Security and Protection Toolkit (DSPT) compliance warranted. NHS data security standards applied. No patient data shared with third parties without individual consent. Data flows documented and DPIA completed.",
      acceptableFallback: "Patient data processing under lawful basis with DSPT compliance. DPIA completed. Third-party sharing restricted.",
      hardRedLine: "Patient data processed without lawful basis; or no DSPT compliance obligation for contracts involving NHS patient data.",
    },
    HEALTH_REGULATORY_APPROVAL: {
      preferredPosition: "Supplier warrants that all products and services covered by this agreement hold required MHRA, CE, or UKCA certification for their intended use. Obligation to notify us within 48 hours of any regulatory action (safety alert, recall, CE certificate withdrawal). Our use of the product does not constitute off-label use without our prior written consent.",
      acceptableFallback: "Regulatory approvals warranted. Notification of safety alerts and recalls within 5 business days.",
      hardRedLine: "No regulatory approval warranty for medical devices or in-vitro diagnostics; or no obligation to notify of safety alerts or recalls.",
    },
    HEALTH_PHARMACOVIGILANCE: {
      preferredPosition: "Safety data exchange agreement (SDEA) executed alongside commercial agreement. Adverse event reports exchanged within required regulatory timeframes (15 calendar days for serious unexpected, 7 days for fatal/life-threatening). Each party maintains pharmacovigilance system to ICH E2E standard. Regulatory authority reportable events notified immediately.",
      acceptableFallback: "SDEA executed. Adverse event reporting within required timeframes. Regulatory notification obligations allocated.",
      hardRedLine: "No SDEA for agreements involving pharmacovigilance obligations; or adverse event reporting timelines that do not meet regulatory requirements.",
    },
    HEALTH_CLINICAL_PROTOCOL: {
      preferredPosition: "Protocol deviations require sponsor approval. Material amendments require regulatory authority and ethics committee re-approval before implementation. Protocol holds triggered by safety signal implemented within 24 hours. We retain right to audit site compliance with protocol.",
      acceptableFallback: "Material protocol amendments subject to approval process. Safety holds implemented promptly. Audit rights retained.",
      hardRedLine: "Unilateral protocol amendments by site without sponsor notification; or no mechanism for immediate safety hold.",
    },
    HEALTH_NHS_TERMS: {
      preferredPosition: "NHS Standard Contract (or equivalent NHS England terms) incorporated by reference where required. Data processing under Data Security and Protection Toolkit obligations. NHS Protect anti-fraud obligations warranted. NHS branding and identity guidelines complied with.",
      acceptableFallback: "NHS contract requirements complied with. DSPT and data security obligations met.",
      hardRedLine: "Non-compliance with NHS Standard Contract mandatory provisions; or failure to incorporate required NHS data security terms.",
    },
    HEALTH_PRODUCT_LIABILITY: {
      preferredPosition: "Supplier maintains product liability insurance of minimum £10M per occurrence. Recall costs indemnified by supplier for defects attributable to supplier. We retain termination right without liability on any MHRA safety alert or recall affecting the product. Strict liability for product defects under CPA 1987 acknowledged.",
      acceptableFallback: "Product liability insurance £5M+. Recall cost indemnity for supplier-caused defects. Termination right on safety alert.",
      hardRedLine: "No product liability insurance requirement; or exclusion of strict liability for medical device defects.",
    },
    // ── Manufacturing & Supply Chain clauses ─────────────────────────────────
    MFG_INCOTERMS: {
      preferredPosition: "Delivery terms specify Incoterms 2020 rule, named place or port, and whether CIF/CIP insurance obligation uses Institute Cargo Clauses (A). Risk transfers at named point. Export licences and customs clearance responsibilities clearly allocated. Delivery documentation (commercial invoice, packing list, bill of lading or CMR) specified.",
      acceptableFallback: "Incoterms 2020 specified with named place. Export and import responsibilities allocated. Required documentation listed.",
      hardRedLine: "No Incoterms reference with ambiguous risk transfer; or delivery terms that leave export licensing obligations unallocated.",
    },
    MFG_QUALITY_STANDARDS: {
      preferredPosition: "Products must meet ISO 9001 (or industry-equivalent: GMP, IATF 16949, AS9100) requirements. Certificate of Conformance provided with each delivery. We have right of inspection and rejection at delivery. Non-conforming goods returned at supplier's cost. CAPA (Corrective and Preventive Action) required for recurring defects.",
      acceptableFallback: "Applicable quality standard compliance warranted. Certificate of Conformance on request. Inspection and rejection rights retained. CAPA process for recurring issues.",
      hardRedLine: "No quality standard compliance obligation; or no right to inspect and reject non-conforming goods.",
    },
    MFG_PRODUCT_LIABILITY: {
      preferredPosition: "Supplier indemnifies against all third-party product liability claims arising from defects in supplier-manufactured components. Product liability insurance minimum £5M per occurrence. Immediate notification and cooperation on product liability claims. Recall costs indemnified by the party whose defect caused the recall.",
      acceptableFallback: "Product liability indemnity for defective components. Insurance £2M+. Notification and cooperation on claims.",
      hardRedLine: "No product liability indemnity for supplier components; or exclusion of liability for defects in goods supplied.",
    },
    MFG_TOOLING_OWNERSHIP: {
      preferredPosition: "All tooling, moulds, jigs, and fixtures paid for by us vest in us on creation. Tooling held by supplier is clearly identified as our property. Supplier maintains tooling at their cost. Tooling returned on demand within 30 days. No lien on our tooling for unpaid invoices.",
      acceptableFallback: "Tooling paid for by us is our property. Identification and maintenance obligations. Return on 60 days' notice. No lien.",
      hardRedLine: "Supplier claims ownership of tooling we paid for; or right to hold our tooling as security for unpaid invoices.",
    },
    MFG_SUPPLY_CHAIN_RESILIENCE: {
      preferredPosition: "Supplier maintains minimum 8-week buffer stock for critical components. Alternative approved sources identified for sole-sourced materials. Business continuity plan maintained and tested annually. Immediate notification of any supply risk affecting our orders. Priority supply rights in shortage situations.",
      acceptableFallback: "Buffer stock for critical items. BCP maintained. Supply risk notification within 48 hours. Reasonable priority allocation in shortage.",
      hardRedLine: "No buffer stock obligation for critical components; no BCP; or supplier has no obligation to prioritise our supply in shortage.",
    },
    // ── Retail & eCommerce clauses ───────────────────────────────────────────
    RET_DISTANCE_SELLING: {
      preferredPosition: "All distance selling obligations under Consumer Rights Act 2015 and Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 complied with. 14-day cooling-off right clearly communicated. Pre-contract information provided in durable medium. Return shipping costs borne by supplier for defective goods.",
      acceptableFallback: "Distance selling regulations compliance warranted. Cooling-off rights clearly stated. Pre-contract information obligations met.",
      hardRedLine: "No cooling-off right for distance-sold contracts; or attempt to contractually limit statutory consumer rights.",
    },
    RET_CONSUMER_RETURNS: {
      preferredPosition: "30-day returns policy for change of mind (exceeding statutory minimum). Defective goods returned at our cost within 24 months. Refund processed within 5 business days of return receipt. Exchange or refund at consumer's option for defective items. No restocking fees.",
      acceptableFallback: "Statutory returns rights complied with. Defective goods policy clearly stated. Refund within 14 days of return.",
      hardRedLine: "Returns policy that restricts statutory rights; or refund timeframes that exceed statutory maximums.",
    },
    RET_MARKETPLACE_TERMS: {
      preferredPosition: "Platform seller terms fixed for minimum 12 months. Fee changes notified 90 days in advance with right to delist. Commission and fee structure transparent. Platform may not use our sales data to compete against us. Dispute resolution process for order issues available with 48-hour response.",
      acceptableFallback: "Seller terms with 60-day change notice. Transparent fee structure. Sales data not used against us. Dispute process available.",
      hardRedLine: "Platform may change fees with less than 30 days' notice; or use our seller data to develop competing products.",
    },
    RET_AGE_VERIFICATION: {
      preferredPosition: "Age verification system compliant with applicable law and Ofcom/BBFC guidance for age-restricted products. Verification records retained in compliance with data protection law. We accept no liability for third-party age verification system failures if we have complied with contractual specifications.",
      acceptableFallback: "Age verification compliant with applicable requirements. Liability for failure allocated to the party responsible for the verification system.",
      hardRedLine: "No age verification obligation for age-restricted products; or we bear sole liability for failures in a third-party age verification system.",
    },
    RET_CONSUMER_CREDIT: {
      preferredPosition: "BNPL and consumer credit products comply with Consumer Credit Act 1974 and FCA CONC rules. Clear disclosure of total cost of credit, APR, and repayment terms. FCA authorisation verified for credit broking or lending. No incentivised sales of unsuitable credit products.",
      acceptableFallback: "Consumer credit compliance warranted. FCA authorisation confirmed. Transparent credit terms.",
      hardRedLine: "Consumer credit products offered without FCA authorisation; or credit terms that do not comply with Consumer Credit Act disclosure requirements.",
    },
    // ── Media & Entertainment clauses ────────────────────────────────────────
    MEDIA_RIGHTS_CLEARANCE: {
      preferredPosition: "Supplier warrants full chain of title and all necessary rights clearances for all materials delivered. Underlying rights (music, archive footage, literary rights, personality rights, synchronisation) fully cleared for the specified media, territories, and term. E&O insurance minimum £1M per occurrence. Indemnity for third-party IP claims arising from defective title.",
      acceptableFallback: "Chain of title warranty. E&O insurance. Indemnity for IP claims from undisclosed underlying rights encumbrances.",
      hardRedLine: "No chain of title warranty; or delivery of materials without confirmation that underlying rights are cleared for our intended use.",
    },
    MEDIA_RESIDUALS_ROYALTIES: {
      preferredPosition: "All residual obligations to guilds, unions, and collecting societies fully disclosed and allocated. Royalty accounting statements provided quarterly within 30 days of quarter end. Audit right on royalty calculations on 15 days' notice annually. No cross-collateralisation across separate titles or projects without consent.",
      acceptableFallback: "Residual obligations disclosed and allocated. Semi-annual royalty accounting. Audit right annually.",
      hardRedLine: "Undisclosed residual obligations falling on us; or cross-collateralisation of royalties across projects without consent.",
    },
    MEDIA_TALENT_OBLIGATIONS: {
      preferredPosition: "All talent agreements (on-screen, voice, music performance) fully executed before production commences. Talent clearances cover all intended media, territories, and term. Likeness rights and approval rights clearly defined. Re-use fees and residuals pre-agreed. No talent approval rights that could prevent delivery.",
      acceptableFallback: "Talent agreements in place before production. Clearances for primary media and territory. Re-use fee schedule agreed.",
      hardRedLine: "Talent not contracted before production; or talent approval rights that give veto over editorial decisions without compensation.",
    },
    MEDIA_FORMAT_RIGHTS: {
      preferredPosition: "Format rights, adaptation rights, and sequel/prequel rights clearly defined and allocated. Option periods and exercise prices specified. All languages and territories covered for primary distribution. Underlying literary or IP rights licensed for all intended adaptations. Moral rights waivers obtained where applicable.",
      acceptableFallback: "Format and adaptation rights documented. Option terms and exercise prices clear. Primary territories and languages covered.",
      hardRedLine: "Format rights that include unexpected sequel or franchise obligations we did not agree to; or adaptation rights that infringe underlying IP we cannot clear.",
    },
    MEDIA_SYNC_LICENSE: {
      preferredPosition: "Synchronisation licence covers all intended uses: linear, on-demand, streaming, social, theatrical, and promotional. Territory, term, and media clearly specified. Master and publisher licences both obtained. No most-favoured-nation obligations that trigger additional payments without notice. Festival use covered.",
      acceptableFallback: "Sync licence covers primary distribution media and territory. Both master and sync rights cleared. MFN obligations disclosed.",
      hardRedLine: "Sync licence that does not cover all distribution platforms we use; or undisclosed MFN obligations that create unexpected payment obligations.",
    },
    // ── Energy & CleanTech clauses ───────────────────────────────────────────
    ENERGY_OFFTAKE: {
      preferredPosition: "Offtake volume, price, and indexation mechanism agreed for the full contract term. Curtailment rights clearly defined with compensation mechanism. Balancing responsibility allocated. Floor price protection included. Change in law provisions covering subsidy regime changes. Bankable contract terms accepted by project finance lenders.",
      acceptableFallback: "Offtake terms agreed. Curtailment with compensation. Balancing allocation clear. Change in law provisions included.",
      hardRedLine: "No curtailment compensation; or change in law provisions that place subsidy regime risk entirely on the generator without price adjustment.",
    },
    ENERGY_GRID_CONNECTION: {
      preferredPosition: "Grid connection agreement with DNO/TO in place or conditions precedent to this contract. Connection capacity confirmed in writing. Rights of way and land access secured. Metering obligations and data access rights specified. Reinforcement cost allocation agreed.",
      acceptableFallback: "Grid connection terms agreed or conditions precedent documented. Metering and data access specified.",
      hardRedLine: "No confirmed grid connection capacity before financial close; or reinforcement costs that are uncapped and fall on us without contractual ceiling.",
    },
    ENERGY_SUBSIDY_REGIME: {
      preferredPosition: "Applicable subsidy (CfD, ROC, FIT, REGO, BM) registration conditions confirmed. Compliance with scheme rules warranted. Change in scheme rules triggers renegotiation mechanism. Revenue waterfall clearly specifies subsidy payment priority. Clawback risk allocated.",
      acceptableFallback: "Subsidy eligibility confirmed. Scheme rule compliance warranted. Change in law renegotiation mechanism included.",
      hardRedLine: "Subsidy eligibility not confirmed; or change in subsidy scheme risk allocated entirely to us without pricing adjustment mechanism.",
    },
    ENERGY_ENVIRONMENTAL_PERMITS: {
      preferredPosition: "All required environmental permits (Environmental Permit, planning consent, EIA, habitat survey) obtained or conditions precedent to financial close. Ongoing permit compliance warranted. We are notified within 48 hours of any permit breach or enforcement action. Decommissioning and remediation obligations clearly allocated.",
      acceptableFallback: "Required permits in place or conditions precedent. Permit compliance warranted. Notification of enforcement within 5 days. Decommissioning obligations allocated.",
      hardRedLine: "Financial close before required environmental permits obtained; or decommissioning liability unallocated.",
    },
    ENERGY_BALANCING_IMBALANCE: {
      preferredPosition: "Balancing and imbalance risk clearly allocated between parties. Gate closure notification obligations specified. Imbalance settlement charges allocated to the party responsible for the imbalance. Forecasting obligations and accuracy requirements defined.",
      acceptableFallback: "Balancing responsibility allocated. Gate closure obligations specified. Imbalance charges follow allocation of balancing responsibility.",
      hardRedLine: "Imbalance risk allocated to us for generation dispatch decisions we do not control.",
    },
    // ── Education & EdTech clauses ───────────────────────────────────────────
    EDU_SAFEGUARDING: {
      preferredPosition: "All personnel with access to children or vulnerable adults hold enhanced DBS clearance updated within 3 years. Safeguarding policy compliant with Keeping Children Safe in Education 2024 and Working Together 2023. Designated Safeguarding Lead identified. Obligation to report safeguarding concerns immediately and cooperate with statutory investigations.",
      acceptableFallback: "Enhanced DBS clearance for all relevant personnel. Safeguarding policy maintained and shared. Reporting obligations accepted.",
      hardRedLine: "No DBS clearance requirement for personnel with unsupervised child access; or no safeguarding policy.",
    },
    EDU_STUDENT_DATA: {
      preferredPosition: "Student personal data processed only for agreed educational purposes. Parental or guardian consent obtained for under-13 data processing. No student data used for advertising or profiling. Data minimisation applied. FERPA (US) or UK GDPR compliance warranted. Student records returned on contract termination.",
      acceptableFallback: "Student data processing limited to educational purposes. Parental consent for under-13s. No profiling or advertising use. Records returned on termination.",
      hardRedLine: "Student data used for commercial profiling; or no parental consent mechanism for children's data.",
    },
    EDU_CURRICULUM_RIGHTS: {
      preferredPosition: "All curriculum content and course materials developed under this agreement vest in us on creation. Supplier retains pre-existing IP with broad licence. We may adapt, update, and republish content without restriction. No lock-in to supplier's LMS or content platform after contract ends. SCORM/xAPI compliance required for interoperability.",
      acceptableFallback: "Curriculum content IP vests in us. Supplier background IP licensed perpetually. Platform interoperability (SCORM/xAPI) required.",
      hardRedLine: "Supplier owns curriculum content we commissioned and paid for; or content locked into proprietary format preventing use on other platforms.",
    },
    EDU_ACCREDITATION: {
      preferredPosition: "Accreditation body approval obtained before programme launch. Awarding body agreement executed and in force. Qualification specifications and assessment requirements complied with. We are notified within 24 hours of any accreditation risk or compliance concern. No material programme changes without awarding body approval.",
      acceptableFallback: "Accreditation in place. Qualification compliance warranted. Notification of accreditation issues within 5 days.",
      hardRedLine: "Programme launched before accreditation obtained; or material programme changes without awarding body approval risking students' qualifications.",
    },
    // ── Professional Services clauses ────────────────────────────────────────
    PS_ENGAGEMENT_SCOPE: {
      preferredPosition: "Scope of services defined in a detailed Statement of Work. Change request process agreed: written change order required; no additional charges without signed change order. Out-of-scope activities expressly identified. Scope creep not billable without our prior written approval.",
      acceptableFallback: "Scope documented. Written change orders required for additional work. Out-of-scope items identified.",
      hardRedLine: "Vague scope definition with no change control process; or supplier may expand scope and charge for it without our approval.",
    },
    PS_FEE_BILLING: {
      preferredPosition: "Fixed fees or agreed hourly rates for the engagement term. Rate card locked for minimum 12 months. Expenses pre-approved and capped at cost only (no mark-up). Invoices itemised by task and time recorded. Payment within 30 days. No success fees or contingency arrangements without separate written agreement.",
      acceptableFallback: "Agreed rates fixed for the term. Expenses at cost with pre-approval. Itemised invoices. 30-day payment.",
      hardRedLine: "Unilateral rate increases during engagement; or expense mark-up without disclosure; or invoices without sufficient detail to verify.",
    },
    PS_CONFLICTS_INTEREST: {
      preferredPosition: "Supplier confirms no actual or potential conflict of interest at engagement commencement and warrants to notify us immediately of any conflict arising during the engagement. Conflicts policy shared on request. We have right to terminate if conflict is not resolved to our satisfaction. No concurrent engagements with direct competitors without our consent.",
      acceptableFallback: "Conflict disclosure at engagement commencement. Ongoing notification obligation. Termination right for unresolvable conflicts.",
      hardRedLine: "No conflict of interest disclosure; or supplier may simultaneously advise direct competitors on related matters without consent.",
    },
    PS_PROFESSIONAL_LIABILITY: {
      preferredPosition: "Supplier maintains professional indemnity insurance appropriate to the risk of the engagement: minimum £2M per claim for regulated professional services. PI policy maintained for minimum 6 years post-engagement (run-off cover). Certificate of insurance provided annually on request. No exclusion of liability for professional negligence causing financial loss.",
      acceptableFallback: "PI insurance minimum £1M per claim. Run-off cover confirmed. Certificate on request. No exclusion of professional negligence liability.",
      hardRedLine: "No PI insurance for regulated professional services; or exclusion of liability for professional negligence.",
    },
  },
  MODERATE: {
    LIABILITY_CAP: {
      preferredPosition: "Liability capped at 12 months' fees. Confidentiality, data breach, IP infringement uncapped.",
      acceptableFallback: "6 months' fees with confidentiality and data breach carved out.",
      hardRedLine: "Cap covering data breach or IP infringement liability.",
      fallbackTemplate: `Nothing in this agreement shall limit liability for fraud, wilful misconduct, breach of confidentiality, data protection breaches, IP infringement, or payment obligations. Otherwise, aggregate liability shall not exceed 12 months' fees.`,
    },
    INDEMNITY: {
      preferredPosition: "Mutual indemnity for IP infringement and data breaches.",
      acceptableFallback: "Supplier indemnifies for its own IP and data breach; our exposure limited to misuse.",
      hardRedLine: "Uncapped unilateral indemnity against us.",
    },
    IP_OWNERSHIP: {
      preferredPosition: "Bespoke deliverables vest in us. Supplier retains background IP with licence.",
      acceptableFallback: "Joint ownership of bespoke deliverables with unrestricted licence to both parties.",
      hardRedLine: "Supplier owns all deliverables with no licence back.",
    },
    CONFIDENTIALITY: {
      preferredPosition: "Mutual, 3-year post-termination confidentiality obligation.",
      acceptableFallback: "2-year obligation with standard residuals carve-out.",
      hardRedLine: "Less than 1 year post-termination.",
    },
    DATA_PRIVACY: {
      preferredPosition: "DPA in place. Supplier is processor. Audit rights included.",
      acceptableFallback: "DPA in place with reasonable audit notice requirements.",
      hardRedLine: "No DPA where personal data is being processed.",
    },
    TERMINATION: {
      preferredPosition: "60-day convenience termination. Immediate for material uncured breach.",
      acceptableFallback: "90-day convenience. 20-day cure period for breach.",
      hardRedLine: "No convenience termination right.",
    },
    PAYMENT_TERMS: {
      preferredPosition: "30-day payment terms.",
      acceptableFallback: "45-day payment terms. Indexed price increases.",
      hardRedLine: "Payment within 7 days.",
    },
    AUTO_RENEWAL: {
      preferredPosition: "No auto-renewal or 60 days' notice required.",
      acceptableFallback: "Auto-renewal with 30 days' notice.",
      hardRedLine: "Auto-renewal with less than 14 days' notice.",
    },
    GOVERNING_LAW: {
      preferredPosition: "English law. English courts.",
      acceptableFallback: "English law. Arbitration acceptable.",
      hardRedLine: "Foreign law without agreed dispute resolution.",
    },
    AUDIT_RIGHTS: {
      preferredPosition: "Annual audit right on 10 days' notice.",
      acceptableFallback: "Audit right on 15 days' notice, once per year.",
      hardRedLine: "No audit right.",
    },
    FORCE_MAJEURE: {
      preferredPosition: "Force majeure limited to events beyond reasonable control. 14-day notice; 6-month long-stop triggers mutual termination right.",
      acceptableFallback: "Standard force majeure covering Acts of God, government action, labour disputes. 30-day long-stop.",
      hardRedLine: "Force majeure covering economic hardship or events within the supplier's ordinary business risk.",
    },
    WARRANTIES: {
      preferredPosition: "Warranties of title, authority, and material compliance with applicable law. 12-month survival post-termination.",
      acceptableFallback: "Warranties of authority and title only.",
      hardRedLine: "No warranties or 'as-is' disclaimer for services with material legal or financial impact.",
    },
    DISPUTE_RESOLUTION: {
      preferredPosition: "Escalation: senior management (15 days) → mediation (30 days) → LCIA arbitration. Courts for emergency relief.",
      acceptableFallback: "Direct arbitration under LCIA or ICC rules. English courts for injunctive relief.",
      hardRedLine: "Exclusive foreign court jurisdiction with no arbitration option.",
    },
    ASSIGNMENT: {
      preferredPosition: "Assignment requires consent; not to be unreasonably withheld. Group assignments on notice.",
      acceptableFallback: "Free assignment within group. Third-party assignment with 10-day notice and consent.",
      hardRedLine: "Supplier may assign to competitors without our consent.",
    },
    INSURANCE: {
      preferredPosition: "Professional Indemnity £2M+, Public Liability £5M+, Cyber Liability £2M+. Evidence on request.",
      acceptableFallback: "Professional Indemnity £1M+, Public Liability £2M+.",
      hardRedLine: "No insurance requirement for services involving personal data or material financial exposure.",
    },
    NON_SOLICITATION: {
      preferredPosition: "Mutual 12-month post-termination restriction on active solicitation of key personnel.",
      acceptableFallback: "12-month restriction, excluding response to general advertising.",
      hardRedLine: "Restriction exceeding 24 months or covering all hiring not just direct solicitation.",
    },
    EXCLUSIVITY: {
      preferredPosition: "No exclusivity without compensation and performance benchmarks.",
      acceptableFallback: "Limited exclusivity in specific territory/segment with quarterly performance reviews.",
      hardRedLine: "Open-ended exclusivity with no performance obligations or exit right.",
    },
    CHANGE_OF_CONTROL: {
      preferredPosition: "Termination right on 60 days' notice following supplier change of control.",
      acceptableFallback: "Right to renegotiate terms within 90 days of change of control.",
      hardRedLine: "No change of control protections.",
    },
    RENT_REVIEW: {
      preferredPosition: "Rent review every 5 years, upward/downward to open market rent. RICS arbitration for disputes.",
      acceptableFallback: "Upward-only review capped at CPI annually compounded.",
      hardRedLine: "Uncapped upward-only review with no independent review mechanism.",
    },
    BREAK_CLAUSE: {
      preferredPosition: "Tenant break at year 5. Conditions: vacant possession and no rent arrears. 6 months' notice.",
      acceptableFallback: "Tenant break at year 7. Reasonable conditions. 6 months' notice.",
      hardRedLine: "Break clause conditional on full compliance with all lease covenants.",
    },
    REPAIR_OBLIGATIONS: {
      preferredPosition: "Internal non-structural repairs for tenant; landlord takes structural and external. Schedule of Condition attached.",
      acceptableFallback: "FRI with Schedule of Condition limiting dilapidations on exit.",
      hardRedLine: "FRI without Schedule of Condition or put and keep in repair obligation.",
    },
    SERVICE_CHARGE: {
      preferredPosition: "Service charge capped; detailed accounts within 6 months of year end.",
      acceptableFallback: "Service charge with RPI+2% annual cap. Accounts within 9 months.",
      hardRedLine: "Uncapped service charge; no accounts or audit rights.",
    },
    ENTIRE_AGREEMENT: {
      preferredPosition: "Entire agreement clause superseding all prior representations and discussions. Carve-out for fraud.",
      acceptableFallback: "Entire agreement clause with acknowledgement of written representations in the agreement.",
      hardRedLine: "No entire agreement clause where pre-contractual representations have been made.",
    },
    VARIATION: {
      preferredPosition: "Variations in writing, signed by authorised representatives.",
      acceptableFallback: "Email from designated authorised accounts constitutes a valid variation for operational matters.",
      hardRedLine: "Counterparty has unilateral right to vary terms by notice.",
    },
    WAIVER: {
      preferredPosition: "Waiver must be in writing. No waiver by course of dealing.",
      acceptableFallback: "Written waiver required. Partial exercise does not waive further rights.",
      hardRedLine: "Course of dealing may constitute a waiver of material rights.",
    },
    SEVERABILITY: {
      preferredPosition: "Invalid provisions severable; remainder of contract survives.",
      acceptableFallback: "Standard severability; court may modify to minimum extent to achieve validity.",
      hardRedLine: "No severability where contract has provisions of doubtful enforceability.",
    },
    NOTICES: {
      preferredPosition: "Notices in writing by courier or email with read receipt. Effective on actual receipt.",
      acceptableFallback: "Email deemed received after 24 hours; post deemed received after 2 business days.",
      hardRedLine: "No notices clause for formal communications.",
    },
    THIRD_PARTY_RIGHTS: {
      preferredPosition: "Third party rights excluded. Contracts (Rights of Third Parties) Act 1999 excluded.",
      acceptableFallback: "Third party rights limited to named group companies.",
      hardRedLine: "Open-ended third party rights without identified beneficiaries.",
    },
    SET_OFF: {
      preferredPosition: "We retain right to set off undisputed amounts. Counterparty's right to set off excluded.",
      acceptableFallback: "Mutual set-off limited to undisputed sums under this agreement.",
      hardRedLine: "Our right to set off is excluded entirely.",
    },
    LIQUIDATED_DAMAGES: {
      preferredPosition: "LDs capped at 100% of annual contract value. Genuine pre-estimate of loss required.",
      acceptableFallback: "LDs capped at 50% of contract value. Sole remedy for specified breach.",
      hardRedLine: "Uncapped LDs without reference to genuine pre-estimate of loss.",
    },
    MOST_FAVOURED_NATION: {
      preferredPosition: "MFN on comparable volume tiers. Automatic price reduction on trigger.",
      acceptableFallback: "MFN notification-based; we may claim adjusted pricing within 30 days of notification.",
      hardRedLine: "No MFN where we are a significant customer.",
    },
    BENCHMARKING: {
      preferredPosition: "Benchmarking every 2 years. Supplier must match market pricing within 60 days or face termination right.",
      acceptableFallback: "Benchmarking right every 3 years. Right to renegotiate on unfavourable result.",
      hardRedLine: "No benchmarking right on contracts of 2 years or more.",
    },
    STEP_IN_RIGHTS: {
      preferredPosition: "Step-in rights on material breach or insolvency. 5 business days' notice. Supplier's cost.",
      acceptableFallback: "Step-in on extended uncured breach. Reasonable costs shared initially, claimed back on resolution.",
      hardRedLine: "No step-in for critical services.",
    },
    SUBCONTRACTING: {
      preferredPosition: "Written consent required for subcontracting core deliverables. Supplier remains liable.",
      acceptableFallback: "Operational subcontracting on 10 days' notice. Supplier liable for subcontractor acts.",
      hardRedLine: "Supplier may subcontract freely with no liability for subcontractor failures.",
    },
    BUSINESS_CONTINUITY: {
      preferredPosition: "BCP/DR maintained and tested annually. RTO/RPO agreed in writing.",
      acceptableFallback: "BCP/DR plan maintained. Evidence on reasonable request.",
      hardRedLine: "No BCP/DR obligations for critical services.",
    },
    SERVICE_LEVELS: {
      preferredPosition: "Agreed SLAs with service credits for breach. Persistent failure triggers termination right.",
      acceptableFallback: "SLAs with credits as sole remedy. Termination right after 6 months of material underperformance.",
      hardRedLine: "No SLAs; or credits cap all liability for service failure.",
    },
    SOURCE_CODE_ESCROW: {
      preferredPosition: "Escrow for bespoke software. Release on insolvency or material breach. Annual verification.",
      acceptableFallback: "Escrow with release on insolvency. Deposit and verification every 2 years.",
      hardRedLine: "No escrow for operationally critical bespoke software.",
    },
    MARKETING_RIGHTS: {
      preferredPosition: "No marketing use without prior written consent on each occasion.",
      acceptableFallback: "Customer list inclusion only. All other uses require consent.",
      hardRedLine: "Blanket consent to use our name and brand in marketing.",
    },
    ANTI_BRIBERY: {
      preferredPosition: "Bribery Act compliance warranted. Adequate procedures maintained. Immediate termination for breach.",
      acceptableFallback: "Anti-corruption warranty. Termination right on reasonable grounds of breach.",
      hardRedLine: "No anti-bribery provisions in contracts with material corruption risk.",
    },
    SANCTIONS_COMPLIANCE: {
      preferredPosition: "Sanctions compliance warranty. Immediate notification of risk. Termination right without penalty.",
      acceptableFallback: "Sanctions warranty. 5-day notification obligation. Termination right on notice.",
      hardRedLine: "No sanctions clause.",
    },
    MODERN_SLAVERY: {
      preferredPosition: "Modern Slavery Act compliance warranted. Transparency statement on request. Audit right.",
      acceptableFallback: "MSA compliance warranty. Notification of known supply chain breaches.",
      hardRedLine: "No modern slavery obligations in supply chain-exposed contracts.",
    },
    ENVIRONMENTAL_OBLIGATIONS: {
      preferredPosition: "Environmental law compliance warranted. Cooperation with our ESG reporting requirements.",
      acceptableFallback: "Compliance with applicable environmental law. Good faith cooperation on sustainability data.",
      hardRedLine: "No environmental obligations in contracts with significant environmental footprint.",
    },
    TUPE: {
      preferredPosition: "TUPE compliance warranted. Indemnity for pre-transfer employment liabilities. Employee information on 28 days' notice.",
      acceptableFallback: "TUPE warranty with indemnity for pre-transfer liabilities. Reasonable notice for employee information.",
      hardRedLine: "No TUPE indemnity where transfer is likely.",
    },
    RESTRICTIVE_COVENANTS: {
      preferredPosition: "Non-compete 12 months post-termination in specific market segment only. Non-solicitation of key accounts.",
      acceptableFallback: "Non-compete up to 12 months in directly competed business area. Non-solicitation of introduced customers.",
      hardRedLine: "Non-compete exceeding 12 months or broader than specific competitive activity.",
    },
    ACCEPTANCE_TESTING: {
      preferredPosition: "Written acceptance criteria. 20-business-day testing window. Rejection requires written notice.",
      acceptableFallback: "15-day testing window. Supplier cure period after failure. Deemed acceptance if no objection after two cycles.",
      hardRedLine: "No acceptance testing for bespoke deliverables.",
    },
    REGULATORY_CHANGE: {
      preferredPosition: "Notification of regulatory change. 30-day renegotiation window. Termination right if no agreement.",
      acceptableFallback: "Obligation to notify. Good faith renegotiation. Termination if compliance becomes impossible.",
      hardRedLine: "No regulatory change mechanism for regulated services.",
    },
    CONTENT_MODERATION: {
      preferredPosition: "Platform content moderation policy applies. 48-hour notice before removing our content unless illegal content. Dispute escalation to senior contacts agreed. Platform indemnifies for wrongful removal.",
      acceptableFallback: "Platform may remove content per its policies with reasonable notice. Dispute process available for contested takedowns.",
      hardRedLine: "Unilateral removal with no notice and no dispute process where commercial impact is significant.",
    },
    VIRTUAL_ITEMS: {
      preferredPosition: "Virtual items licensed to end users; we retain IP. Platform follows our disclosure instructions. Probability disclosure for randomised items compliant with applicable law. No unauthorised secondary market facilitation.",
      acceptableFallback: "Virtual items on our terms. Platform implements our pricing and disclosure instructions. Secondary market activity outside approved model prohibited.",
      hardRedLine: "Platform claims ownership in our virtual items; or no mechanism to update probability disclosures as laws change.",
    },
    PLATFORM_REVENUE_SHARE: {
      preferredPosition: "Revenue share at agreed rates for the term. 90-day notice for any rate changes. Net revenue after taxes and chargebacks only. Monthly reports within 10 days of month-end.",
      acceptableFallback: "Agreed revenue share rates. Platform may adjust standard rates with 90-day notice; we have option to terminate distribution on 6 months' notice if materially disadvantageous. Monthly reports.",
      hardRedLine: "Unilateral rate changes with less than 30 days' notice; no reporting; or unexplained deductions from our revenue.",
    },
    LOOT_BOX_MECHANICS: {
      preferredPosition: "Randomised reward mechanics legally reviewed in major launch jurisdictions. Probability disclosure before purchase. Spend controls for minor accounts. Compliance with South Korea (GRAC), Belgium, Netherlands, UK requirements.",
      acceptableFallback: "Probability disclosure implemented. Legal review for primary markets. Minor spend controls active. Joint sign-off for high-risk jurisdictions (Belgium, Netherlands).",
      hardRedLine: "No probability disclosure; no minor spend controls; sole liability on us for gambling classification without publisher/platform sign-off on the mechanics.",
    },
    // ── Investment document clauses ──────────────────────────────────────────
    LIQUIDATION_PREFERENCE: {
      preferredPosition: "1x non-participating preferred only. Investor recoups their investment first, then converts to ordinary shares and participates pro-rata with no further preference.",
      acceptableFallback: "1x participating preferred capped at 2x total return, after which the preference falls away entirely.",
      hardRedLine: "2x or higher participating preferred, or uncapped participating preferred that allows the investor to double-dip at exit without limit.",
    },
    ANTI_DILUTION: {
      preferredPosition: "Broad-based weighted average anti-dilution only. Protects against down-rounds without disproportionately punishing founders.",
      acceptableFallback: "Narrow-based weighted average anti-dilution with a 24-month sunset clause.",
      hardRedLine: "Full ratchet anti-dilution under any circumstances.",
    },
    PRO_RATA_RIGHTS: {
      preferredPosition: "Pro-rata participation rights for all investors above a minimum ownership threshold, allowing them to maintain percentage in future rounds.",
      acceptableFallback: "Pro-rata rights for lead investors or those above a 5% ownership threshold.",
      hardRedLine: "Waiver of existing investor pro-rata rights in a future round without their consent.",
    },
    DRAG_ALONG: {
      preferredPosition: "Drag-along requires consent of majority of ordinary shareholders and majority of preference shareholders. Minimum valuation floor applies.",
      acceptableFallback: "75% drag threshold on a fully diluted basis. Valuation floor provisions for founder protection.",
      hardRedLine: "Investors can drag ordinary shareholders to a sale without ordinary shareholder majority consent, or at any valuation.",
    },
    INFORMATION_RIGHTS: {
      preferredPosition: "Monthly management accounts, annual audited accounts, and board observer rights for lead investor.",
      acceptableFallback: "Quarterly management accounts, annual audited accounts, and observer rights for investors above 5%.",
      hardRedLine: "No information rights beyond statutory minimum.",
    },
    BOARD_COMPOSITION: {
      preferredPosition: "Founders retain majority board seats. Investor board appointments require founder consent. Independent director by mutual agreement.",
      acceptableFallback: "Equal founder/investor board representation with an independent chair appointed by founders as tiebreaker.",
      hardRedLine: "Investors hold majority board control at Series A or earlier without founder veto.",
    },
    VESTING_LEAVER: {
      preferredPosition: "4-year vesting, 1-year cliff. Good leaver includes resignation after 24 months. Bad leaver limited to fraud or gross misconduct. Full acceleration on change of control.",
      acceptableFallback: "4-year vesting, 1-year cliff. Clear good/bad leaver definitions. Partial acceleration on good leaver exit.",
      hardRedLine: "All unvested shares forfeited on any resignation regardless of tenure, or no distinction between good and bad leaver treatment.",
    },
    OPTION_POOL_SHUFFLE: {
      preferredPosition: "Option pool created or expanded post-closing so all shareholders, including the incoming investor, dilute pro-rata.",
      acceptableFallback: "Pre-money option pool of up to 10% if transparently disclosed in headline valuation.",
      hardRedLine: "Oversized pre-money option pool used to reduce the effective pre-money valuation without transparent disclosure.",
    },
    PAY_TO_PLAY: {
      preferredPosition: "No pay-to-play provisions. Investors who cannot follow on retain their existing rights.",
      acceptableFallback: "Soft pay-to-play converting preference shares to ordinary only, with a minimum 30-day cure period and notice.",
      hardRedLine: "Hard pay-to-play stripping anti-dilution rights and preference automatically without a cure period.",
    },
    REDEMPTION_RIGHTS: {
      preferredPosition: "No redemption rights. Preference shares are equity, not debt.",
      acceptableFallback: "Redemption as a long-stop only after 7+ years if no liquidity event has occurred, subject to 12-month notice and board approval.",
      hardRedLine: "Redemption rights exercisable within 5 years, at investor discretion, or without requiring a formal liquidity event.",
    },
    // ── Insurance litigation clauses ─────────────────────────────────────────
    INS_COVERAGE_RESPONSE: {
      preferredPosition: "Policy clearly responds: all coverage triggers met, no exclusions apply, insured has complied with all conditions.",
      acceptableFallback: "Coverage arguable: primary position responds but one or more conditions or exclusions require analysis before confirming.",
      hardRedLine: "Coverage does not respond, a clear exclusion applies, or a material condition precedent has been breached.",
    },
    INS_EXCLUSIONS_ANALYSIS: {
      preferredPosition: "No applicable exclusion identified. Policy wording unambiguous and insured's conduct does not trigger any exclusion.",
      acceptableFallback: "One exclusion potentially applicable but arguments available on both sides. Requires senior review before position is taken.",
      hardRedLine: "A clear and unambiguous exclusion applies. Coverage denial is legally defensible.",
    },
    INS_NOTIFICATION_COMPLIANCE: {
      preferredPosition: "Notification received within the required timeframe, in the correct form, and to the correct party. No condition precedent issues.",
      acceptableFallback: "Notification technically late but arguments available that condition was not a condition precedent, or that the insurer has not been prejudiced.",
      hardRedLine: "Notification clearly non-compliant: materially out of time, wrong form, or missing information that cannot be excused.",
    },
    INS_QUANTUM_ASSESSMENT: {
      preferredPosition: "Current reserve is adequate and reflects a realistic assessment of exposure. No reserve movement required.",
      acceptableFallback: "Reserve requires review. Realistic range is above current reserve but within acceptable parameters for claims committee reporting.",
      hardRedLine: "Current reserve is materially inadequate. Exposure significantly exceeds reserve. Immediate reserve uplift and committee reporting required.",
    },
    INS_DEFENCE_PROSPECTS: {
      preferredPosition: "Strong defence prospects. Claim is defensible on liability and/or quantum. Recommend defend.",
      acceptableFallback: "Reasonable defence prospects but outcome uncertain. Consider commercial settlement to manage costs and litigation risk.",
      hardRedLine: "Weak or indefensible. Liability likely established. Settlement is the commercially rational outcome.",
    },
    INS_SETTLEMENT_AUTHORITY: {
      preferredPosition: "Recommended settlement within litigation handler authority. No escalation required.",
      acceptableFallback: "Recommended settlement within senior litigation counsel authority. Single-level escalation required.",
      hardRedLine: "Recommended settlement exceeds claims committee or board authority. Full escalation required before any settlement discussions.",
    },
    INS_REGULATORY_OBLIGATIONS: {
      preferredPosition: "All FCA claims handling obligations met. TCF requirements satisfied. All timeframes and reporting duties complied with.",
      acceptableFallback: "One or more regulatory obligations at risk of breach. Remediation steps underway. FCA notification not yet required.",
      hardRedLine: "Regulatory breach identified. FCA notification obligation triggered or imminent. Immediate compliance action required.",
    },
    INS_SUBROGATION_POTENTIAL: {
      preferredPosition: "Strong subrogation prospects against an identifiable and solvent third party. Recovery action should be pursued.",
      acceptableFallback: "Subrogation possible but uncertain. Third party identified; prospects require further investigation before committing to recovery action.",
      hardRedLine: "Subrogation unlikely. Third party unidentified, insolvent, or defence of primary claim takes priority.",
    },
    INS_PANEL_FIRM_INSTRUCTIONS: {
      preferredPosition: "Panel firm spend and strategy within approved guidelines. Budget forecast within approved parameters.",
      acceptableFallback: "Panel spend approaching approved threshold. Budget review and approval required before further instruction.",
      hardRedLine: "Panel spend exceeds approved threshold or strategy materially deviates from instructions. Immediate review and re-approval required.",
    },
    INS_RESERVE_ADEQUACY: {
      preferredPosition: "Reserve is adequate and reflects current best estimate of ultimate exposure. No movement required at this stage.",
      acceptableFallback: "Reserve requires upward review. Exposure development warrants adjustment before next reporting period.",
      hardRedLine: "Reserve is materially inadequate. Immediate uplift required. Board or claims committee reporting obligation triggered.",
    },
    // ── Insurance litigation - extended ─────────────────────────────────────
    INS_FRAUD_INDICATORS: {
      preferredPosition: "Fraud screening at inception and quantum stage. SIU referral for high-value or flagged claims.",
      acceptableFallback: "Ad-hoc fraud review where indicators present. Documentation retained.",
      hardRedLine: "No fraud screening process or ability to refer to SIU.",
    },
    INS_REHABILITATION: {
      preferredPosition: "Rehabilitation offered on injury claims above agreed threshold. Case manager appointed within 15 days.",
      acceptableFallback: "Rehabilitation on request. Reasonable costs met by insurer.",
      hardRedLine: "Rehabilitation excluded or capped at nominal amount.",
    },
    INS_EXPERT_EVIDENCE: {
      preferredPosition: "SJE preferred for quantum. Party expert permitted for liability. Instructions agreed between parties.",
      acceptableFallback: "Expert appointment by agreement failing which court direction.",
      hardRedLine: "Insurer has no input into expert instruction scope.",
    },
    INS_PART36_CPR: {
      preferredPosition: "Part 36 offer review within 7 business days. Counter-offer within 14 business days where appropriate.",
      acceptableFallback: "Reasonable response to Part 36 offers within CPR deadline periods.",
      hardRedLine: "Part 36 offers routinely ignored without documented rationale.",
    },
    INS_COSTS_BUDGETING: {
      preferredPosition: "Costs budget filed as required. Material excess challenged. Phase-by-phase monitoring.",
      acceptableFallback: "Costs reviewed at key milestones. Disproportionate spend challenged.",
      hardRedLine: "Claimant costs accepted without challenge regardless of proportionality.",
    },
    INS_THIRD_PARTY_CAPTURE: {
      preferredPosition: "Third-party capture on claims above agreed threshold. Initial contact within 10 days.",
      acceptableFallback: "Capture offered where third party is unrepresented.",
      hardRedLine: "No capture protocol or capture without independent medical assessment.",
    },
    INS_CLAIMS_TIMEFRAMES: {
      preferredPosition: "Acknowledgement within 48 hours. Coverage position within 15 business days. Regular updates to insured.",
      acceptableFallback: "Acknowledgement within 5 business days. Coverage decision within 21 business days.",
      hardRedLine: "No acknowledgement or coverage decision timeframe obligation.",
    },
    INS_CONDITIONS_PRECEDENT: {
      preferredPosition: "Material conditions precedent enforced. Minor procedural breaches waived where no prejudice to insurer.",
      acceptableFallback: "Conditions precedent reviewed at inception and annually. Non-compliance documented.",
      hardRedLine: "All conditions precedent treated as waived.",
    },
    INS_CONTRIBUTION: {
      preferredPosition: "Contribution rights reserved in coverage letters. Pursued where recovery cost-effective.",
      acceptableFallback: "Contribution considered at settlement. Reservation in correspondence.",
      hardRedLine: "Contribution rights routinely waived.",
    },
    INS_REINSTATEMENT: {
      preferredPosition: "Reinstatement offered where economically viable. Independent assessment of both bases. Insured election within 42 days.",
      acceptableFallback: "Reinstatement on properties where rebuild cost is proportionate.",
      hardRedLine: "No reinstatement option offered to insured.",
    },
    // ── Logistics contract clauses ───────────────────────────────────────────
    LOG_LIABILITY_CAP_CMR: {
      preferredPosition: "Liability limited to CMR Convention limits for international road freight (8.33 SDR per kg). All attempts to exclude CMR limits rejected.",
      acceptableFallback: "Enhanced liability cap agreed at a defined per-consignment limit with corresponding insurance in place. CMR limits as backstop.",
      hardRedLine: "Customer paper excludes CMR limits entirely and imposes uncapped liability for cargo loss or damage beyond insurance cover.",
    },
    LOG_CARGO_LIABILITY: {
      preferredPosition: "Cargo liability limited to insured values. Customer has arranged own cargo insurance. Our liability capped at CMR or agreed per-consignment limit.",
      acceptableFallback: "Liability for cargo loss or damage capped at a defined limit commensurate with our insurance cover. Enhanced limit with additional premium.",
      hardRedLine: "Liability for cargo loss or damage exceeds our insurance cover. Uncapped exposure creates uninsurable risk.",
    },
    LOG_INDEMNITY: {
      preferredPosition: "Indemnities are proportionate and fault-based. We indemnify for our own negligence only. Customer indemnifies for their acts, omissions, and misdescription of cargo.",
      acceptableFallback: "Mutual indemnities limited to gross negligence and wilful misconduct. Each party responsible for losses caused by their own breach.",
      hardRedLine: "We are required to indemnify the customer for their own negligence, misdescription of cargo, or inadequate packaging.",
    },
    LOG_SERVICE_LEVELS: {
      preferredPosition: "SLAs are achievable and reflect operational reality. Force majeure covers customs delays, port congestion, industrial action, and weather events. Service credits proportionate and capped.",
      acceptableFallback: "Reasonable SLAs with force majeure for material disruption events. Service credits as sole remedy for SLA breach capped at 10% of monthly fees.",
      hardRedLine: "Punitive SLAs without force majeure for logistics-specific disruption. Service credits uncapped or structured as penalties.",
    },
    LOG_SUBCONTRACTING: {
      preferredPosition: "Unrestricted right to subcontract to approved hauliers and logistics partners. Pass-through liability. No prior approval required for routine subcontracting.",
      acceptableFallback: "Subcontracting permitted on notification. We remain liable for subcontractor performance. Named approved subcontractors list maintained.",
      hardRedLine: "Prior written approval required for every subcontract engagement. Approval cannot be unreasonably withheld but creates operational bottleneck.",
    },
    LOG_DATA_GDPR: {
      preferredPosition: "Controller/processor split clearly defined. DPA in place. Shipment data, customer data, and driver data obligations clearly allocated. Cross-border transfer mechanisms in place.",
      acceptableFallback: "DPA in place with standard processing obligations. Data sharing with customs authorities covered by legitimate interest or legal obligation basis.",
      hardRedLine: "No DPA where personal data is being processed. Ambiguous data ownership for tracking data or driver data.",
    },
    LOG_GOVERNING_LAW: {
      preferredPosition: "English law governing the contract. English courts have exclusive jurisdiction. Consistent with our standard trading conditions.",
      acceptableFallback: "English law with non-exclusive jurisdiction or agreed arbitration. Jurisdiction reflects major operational territory.",
      hardRedLine: "Foreign jurisdiction with no local legal resource. Governing law clause that would determine outcome of a major cargo claim in an unfamiliar court.",
    },
    LOG_TERMINATION: {
      preferredPosition: "Either party may terminate on 90 days written notice. No transition obligations beyond standard handover. Exit at any time on convenience without penalty.",
      acceptableFallback: "120-day convenience termination. Standard data return and handover obligations. No punitive exit costs.",
      hardRedLine: "Lock-in beyond 12 months with punitive exit costs. Transition obligations that create open-ended liability on exit.",
    },
    LOG_TRADE_COMPLIANCE: {
      preferredPosition: "Each party responsible for their own trade compliance and sanctions screening. Customer warrants cargo does not breach sanctions. Immediate suspension right if sanctions risk identified.",
      acceptableFallback: "Shared trade compliance obligations. Mutual notification of any sanctions exposure. Suspension right on reasonable grounds.",
      hardRedLine: "We are required to take on the customer's sanctions screening and export control compliance obligations without corresponding indemnity.",
    },
    LOG_AUDIT_REPORTING: {
      preferredPosition: "Annual audit right on 30 days written notice. Reporting obligations limited to agreed KPI metrics. Audit costs borne by auditing party unless material breach found.",
      acceptableFallback: "Audit on 15 days notice, once per year. Standard operational reporting. Reasonable audit costs.",
      hardRedLine: "Continuous access right or real-time reporting obligations without a data security framework. Audit costs borne by us regardless of outcome.",
    },
    // ── Logistics contract - extended ────────────────────────────────────────
    LOG_CARRIER_PAYMENT: {
      preferredPosition: "Payment within 30 days. Fuel surcharges linked to published index. 14-day notice of material increases.",
      acceptableFallback: "45-day payment. Fuel surcharges with index reference. Reasonable notice of increases.",
      hardRedLine: "Uncapped or non-indexed fuel surcharges; payment terms below 14 days.",
    },
    LOG_DANGEROUS_GOODS: {
      preferredPosition: "ADR compliance mandatory. Valid certificate held. Incident reporting within 4 hours of occurrence.",
      acceptableFallback: "ADR compliance required. Documentation provided on request.",
      hardRedLine: "No ADR compliance or training obligation.",
    },
    LOG_CUSTOMS_CLEARANCE: {
      preferredPosition: "Customs clearance responsibilities allocated per agreed Incoterms. Full trade data provided by shipper on time.",
      acceptableFallback: "Carrier arranges customs on request. Shipper provides accurate commodity codes.",
      hardRedLine: "No customs responsibility allocation.",
    },
    LOG_PACKAGING_LABELING: {
      preferredPosition: "Packaging to applicable transport standards. Shipper warrants compliance. Non-compliant consignments refused at shipper's risk.",
      acceptableFallback: "Reasonable packaging obligations. Carrier notifies shipper of deficiencies.",
      hardRedLine: "No packaging compliance warranty or refusal right.",
    },
    LOG_COLD_CHAIN: {
      preferredPosition: "Temperature maintained to agreed range. Monitoring data provided on delivery. Alert if range exceeded.",
      acceptableFallback: "Temperature monitoring in place. Records available on request.",
      hardRedLine: "No cold chain monitoring or data retention.",
    },
    LOG_TRACK_TRACE: {
      preferredPosition: "Shipment tracking available to customer. ETA updates on significant change. Records retained 2 years.",
      acceptableFallback: "Tracking data available on request. Reasonable updates during transit.",
      hardRedLine: "No tracking capability or shipment visibility.",
    },
    LOG_FORCE_MAJEURE: {
      preferredPosition: "Force majeure for genuine unforeseeable transport disruptions. 48-hour notice. 10-day long-stop.",
      acceptableFallback: "Force majeure with reasonable notice and customer right to alternative routing after 14 days.",
      hardRedLine: "Force majeure clause covering foreseeable operational risk.",
    },
    LOG_INSURANCE_CERT: {
      preferredPosition: "CMR and goods-in-transit insurance required. Evidence provided at contract commencement and on renewal.",
      acceptableFallback: "Insurance in place. Certificate provided on request within 5 business days.",
      hardRedLine: "No insurance requirements or evidence obligation.",
    },
    LOG_INTERNATIONAL_CONVENTIONS: {
      preferredPosition: "CMR/Hague-Visby/Montreal apply as relevant to each transport mode. Parties acknowledge convention liability limits.",
      acceptableFallback: "Applicable convention governs. Special declaration for high-value cargo.",
      hardRedLine: "Convention liability excluded or undermined by contract terms.",
    },
    LOG_DRIVER_COMPLIANCE: {
      preferredPosition: "Drivers hold valid licences and CPC. Tachograph records maintained. Compliance evidence on request.",
      acceptableFallback: "Carrier warrants driver compliance with applicable regulations. Evidence on request.",
      hardRedLine: "No driver qualification obligation.",
    },
    // ── Technology & SaaS clauses ────────────────────────────────────────────
    TECH_API_TERMS: {
      preferredPosition: "API access governed by documented SLA. Rate limits disclosed upfront and not unilaterally reduced during term. Versioning policy guarantees minimum 12-month deprecation notice. Breaking changes require 6-month advance notice. We retain right to access our data via API for full term plus 90-day extraction period post-termination.",
      acceptableFallback: "API access on published terms. 6-month deprecation notice. Data extraction rights on termination for 60 days.",
      hardRedLine: "No guaranteed API availability, no deprecation notice, or no data extraction right on termination.",
    },
    TECH_UPTIME_SLA: {
      preferredPosition: "99.9% monthly uptime (excluding scheduled maintenance). Scheduled maintenance windows in non-peak hours with 48-hour notice. Service credits of 10% monthly fee per 0.1% below SLA, capped at 30% monthly fee. Persistent breach (3 consecutive months below SLA) triggers termination right without penalty.",
      acceptableFallback: "99.5% uptime. Service credits as sole remedy for SLA breach. Termination right after 6 months of persistent underperformance.",
      hardRedLine: "No uptime SLA, no service credits, or credits that cap all liability for downtime causing material business disruption.",
    },
    TECH_DATA_PORTABILITY: {
      preferredPosition: "Full data export in machine-readable format (CSV, JSON, or API) at any time during the term and for 90 days post-termination at no additional charge. Supplier must not degrade data quality or completeness on export. Deletion certification provided on request after extraction period.",
      acceptableFallback: "Data export in standard format available on request with 10 business days' notice. 60-day post-termination extraction period.",
      hardRedLine: "No data export right, export in proprietary non-portable format only, or export charged at rates that make it economically prohibitive.",
    },
    TECH_OPEN_SOURCE: {
      preferredPosition: "Supplier discloses all open source components used in the service. No copyleft (GPL/AGPL) components that could affect our IP in deliverables. SBOM (Software Bill of Materials) provided on request. CVE notifications within 24 hours for critical vulnerabilities in disclosed components.",
      acceptableFallback: "Open source disclosure on request. No GPL-licensed components in deliverables. CVE notification for critical vulnerabilities within 5 business days.",
      hardRedLine: "No open source disclosure obligation where deliverables may incorporate copyleft-licensed components affecting our IP.",
    },
    TECH_SECURITY_STANDARDS: {
      preferredPosition: "Supplier holds current ISO 27001 certification or SOC 2 Type II attestation. Annual penetration testing by approved third party. Security patches applied within 72 hours of critical CVE disclosure. Security incident notification within 4 hours of confirmed breach.",
      acceptableFallback: "ISO 27001 or SOC 2 Type II. Annual pen testing. Critical patches within 5 business days. Security incident notification within 24 hours.",
      hardRedLine: "No security certification, no pen testing obligation, or incident notification period exceeding 72 hours for critical breaches.",
    },
    TECH_CHANGE_MANAGEMENT: {
      preferredPosition: "All material changes to the service (new features affecting existing workflows, UI changes, deprecations) communicated 30 days in advance. Release notes provided. Backward compatibility maintained for minimum 12 months on APIs and data schemas. Emergency hotfixes documented and notified within 24 hours.",
      acceptableFallback: "Material changes notified with 14 days' advance notice. API backward compatibility for 6 months minimum.",
      hardRedLine: "No advance change notice; or supplier may make breaking changes to APIs or data schemas without notice.",
    },
    // ── Financial Services clauses ───────────────────────────────────────────
    FIN_REGULATORY_PERMISSIONS: {
      preferredPosition: "Counterparty warrants it holds all required FCA/PRA authorisations for the regulated activities performed under this agreement. Obligation to notify us within 24 hours of any restriction, variation, or withdrawal of permissions. Immediate suspension right if permissions lapse. Contract voids automatically if counterparty loses required permissions.",
      acceptableFallback: "Permissions warranty. Notification of material regulatory action within 5 business days. Termination right on permissions lapse.",
      hardRedLine: "No regulatory permissions warranty where counterparty performs regulated activities; or no notification obligation on permissions change.",
    },
    FIN_CLIENT_MONEY: {
      preferredPosition: "Client money held in segregated accounts in accordance with FCA CASS rules. Statutory trust acknowledged in contract. Daily reconciliation. Immediate notification of any CASS breach. We are named as beneficiary on segregated accounts.",
      acceptableFallback: "CASS-compliant segregation. Reconciliation within 2 business days. Notification of breaches within 24 hours.",
      hardRedLine: "No CASS segregation commitment for contracts involving client money; or commingling of client and firm money.",
    },
    FIN_BEST_EXECUTION: {
      preferredPosition: "Best execution policy maintained and applied to all orders. Policy reviewed annually and on material change in market structure. Order execution data available on request. Top 5 execution venues disclosed as required by MiFID II/UK MiFIR.",
      acceptableFallback: "Best execution policy maintained. Annual review. Execution data on request.",
      hardRedLine: "No best execution obligation where MiFID II/UK MiFIR applies to the services.",
    },
    FIN_FINANCIAL_PROMOTION: {
      preferredPosition: "All financial promotions produced by or on behalf of us are approved by an FCA-authorised person before communication. Supplier warrants that any content it produces under this agreement complies with COBS 4 and relevant FCA guidance. Liability for unapproved financial promotions remains with the communicating party.",
      acceptableFallback: "Financial promotions approval process agreed. Compliance with applicable FCA financial promotion rules warranted.",
      hardRedLine: "No financial promotion compliance framework for contracts involving consumer-facing regulated content.",
    },
    FIN_MARGIN_COLLATERAL: {
      preferredPosition: "Credit support documentation (CSA or equivalent) executed alongside master agreement. Collateral threshold and minimum transfer amounts agreed. Eligible collateral specified. Dispute resolution for margin calls within 1 business day. Close-out netting enforceability confirmed in applicable jurisdictions.",
      acceptableFallback: "Margin and collateral terms documented. Close-out netting provisions included. Dispute process agreed.",
      hardRedLine: "No credit support documentation for derivative or leveraged transactions; or close-out netting not contractually confirmed.",
    },
    FIN_BENCHMARK_RATES: {
      preferredPosition: "All reference rates use current SONIA/SOFR (or applicable ARR) with agreed credit adjustment spread. Legacy LIBOR references replaced. Fallback provisions compliant with ISDA 2020 IBOR Fallbacks Protocol. Rate screen page, fallback hierarchy, and interpolation methodology specified in the contract.",
      acceptableFallback: "Current ARR-based rates used. ISDA-compliant fallback provisions. Fallback hierarchy specified.",
      hardRedLine: "Reference to discontinued benchmark rates with no fallback provision; or fallback mechanism creates unilateral rate-setting by one party.",
    },
    // ── Healthcare & Life Sciences clauses ───────────────────────────────────
    HEALTH_PATIENT_DATA: {
      preferredPosition: "Patient data processed only under explicit consent or Schedule 3 DPA 2018 condition. Separate Data Security and Protection Toolkit (DSPT) compliance warranted. NHS data security standards applied. No patient data shared with third parties without individual consent. Data flows documented and DPIA completed.",
      acceptableFallback: "Patient data processing under lawful basis with DSPT compliance. DPIA completed. Third-party sharing restricted.",
      hardRedLine: "Patient data processed without lawful basis; or no DSPT compliance obligation for contracts involving NHS patient data.",
    },
    HEALTH_REGULATORY_APPROVAL: {
      preferredPosition: "Supplier warrants that all products and services covered by this agreement hold required MHRA, CE, or UKCA certification for their intended use. Obligation to notify us within 48 hours of any regulatory action (safety alert, recall, CE certificate withdrawal). Our use of the product does not constitute off-label use without our prior written consent.",
      acceptableFallback: "Regulatory approvals warranted. Notification of safety alerts and recalls within 5 business days.",
      hardRedLine: "No regulatory approval warranty for medical devices or in-vitro diagnostics; or no obligation to notify of safety alerts or recalls.",
    },
    HEALTH_PHARMACOVIGILANCE: {
      preferredPosition: "Safety data exchange agreement (SDEA) executed alongside commercial agreement. Adverse event reports exchanged within required regulatory timeframes (15 calendar days for serious unexpected, 7 days for fatal/life-threatening). Each party maintains pharmacovigilance system to ICH E2E standard. Regulatory authority reportable events notified immediately.",
      acceptableFallback: "SDEA executed. Adverse event reporting within required timeframes. Regulatory notification obligations allocated.",
      hardRedLine: "No SDEA for agreements involving pharmacovigilance obligations; or adverse event reporting timelines that do not meet regulatory requirements.",
    },
    HEALTH_CLINICAL_PROTOCOL: {
      preferredPosition: "Protocol deviations require sponsor approval. Material amendments require regulatory authority and ethics committee re-approval before implementation. Protocol holds triggered by safety signal implemented within 24 hours. We retain right to audit site compliance with protocol.",
      acceptableFallback: "Material protocol amendments subject to approval process. Safety holds implemented promptly. Audit rights retained.",
      hardRedLine: "Unilateral protocol amendments by site without sponsor notification; or no mechanism for immediate safety hold.",
    },
    HEALTH_NHS_TERMS: {
      preferredPosition: "NHS Standard Contract (or equivalent NHS England terms) incorporated by reference where required. Data processing under Data Security and Protection Toolkit obligations. NHS Protect anti-fraud obligations warranted. NHS branding and identity guidelines complied with.",
      acceptableFallback: "NHS contract requirements complied with. DSPT and data security obligations met.",
      hardRedLine: "Non-compliance with NHS Standard Contract mandatory provisions; or failure to incorporate required NHS data security terms.",
    },
    HEALTH_PRODUCT_LIABILITY: {
      preferredPosition: "Supplier maintains product liability insurance of minimum £10M per occurrence. Recall costs indemnified by supplier for defects attributable to supplier. We retain termination right without liability on any MHRA safety alert or recall affecting the product. Strict liability for product defects under CPA 1987 acknowledged.",
      acceptableFallback: "Product liability insurance £5M+. Recall cost indemnity for supplier-caused defects. Termination right on safety alert.",
      hardRedLine: "No product liability insurance requirement; or exclusion of strict liability for medical device defects.",
    },
    // ── Manufacturing & Supply Chain clauses ─────────────────────────────────
    MFG_INCOTERMS: {
      preferredPosition: "Delivery terms specify Incoterms 2020 rule, named place or port, and whether CIF/CIP insurance obligation uses Institute Cargo Clauses (A). Risk transfers at named point. Export licences and customs clearance responsibilities clearly allocated. Delivery documentation (commercial invoice, packing list, bill of lading or CMR) specified.",
      acceptableFallback: "Incoterms 2020 specified with named place. Export and import responsibilities allocated. Required documentation listed.",
      hardRedLine: "No Incoterms reference with ambiguous risk transfer; or delivery terms that leave export licensing obligations unallocated.",
    },
    MFG_QUALITY_STANDARDS: {
      preferredPosition: "Products must meet ISO 9001 (or industry-equivalent: GMP, IATF 16949, AS9100) requirements. Certificate of Conformance provided with each delivery. We have right of inspection and rejection at delivery. Non-conforming goods returned at supplier's cost. CAPA (Corrective and Preventive Action) required for recurring defects.",
      acceptableFallback: "Applicable quality standard compliance warranted. Certificate of Conformance on request. Inspection and rejection rights retained. CAPA process for recurring issues.",
      hardRedLine: "No quality standard compliance obligation; or no right to inspect and reject non-conforming goods.",
    },
    MFG_PRODUCT_LIABILITY: {
      preferredPosition: "Supplier indemnifies against all third-party product liability claims arising from defects in supplier-manufactured components. Product liability insurance minimum £5M per occurrence. Immediate notification and cooperation on product liability claims. Recall costs indemnified by the party whose defect caused the recall.",
      acceptableFallback: "Product liability indemnity for defective components. Insurance £2M+. Notification and cooperation on claims.",
      hardRedLine: "No product liability indemnity for supplier components; or exclusion of liability for defects in goods supplied.",
    },
    MFG_TOOLING_OWNERSHIP: {
      preferredPosition: "All tooling, moulds, jigs, and fixtures paid for by us vest in us on creation. Tooling held by supplier is clearly identified as our property. Supplier maintains tooling at their cost. Tooling returned on demand within 30 days. No lien on our tooling for unpaid invoices.",
      acceptableFallback: "Tooling paid for by us is our property. Identification and maintenance obligations. Return on 60 days' notice. No lien.",
      hardRedLine: "Supplier claims ownership of tooling we paid for; or right to hold our tooling as security for unpaid invoices.",
    },
    MFG_SUPPLY_CHAIN_RESILIENCE: {
      preferredPosition: "Supplier maintains minimum 8-week buffer stock for critical components. Alternative approved sources identified for sole-sourced materials. Business continuity plan maintained and tested annually. Immediate notification of any supply risk affecting our orders. Priority supply rights in shortage situations.",
      acceptableFallback: "Buffer stock for critical items. BCP maintained. Supply risk notification within 48 hours. Reasonable priority allocation in shortage.",
      hardRedLine: "No buffer stock obligation for critical components; no BCP; or supplier has no obligation to prioritise our supply in shortage.",
    },
    // ── Retail & eCommerce clauses ───────────────────────────────────────────
    RET_DISTANCE_SELLING: {
      preferredPosition: "All distance selling obligations under Consumer Rights Act 2015 and Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 complied with. 14-day cooling-off right clearly communicated. Pre-contract information provided in durable medium. Return shipping costs borne by supplier for defective goods.",
      acceptableFallback: "Distance selling regulations compliance warranted. Cooling-off rights clearly stated. Pre-contract information obligations met.",
      hardRedLine: "No cooling-off right for distance-sold contracts; or attempt to contractually limit statutory consumer rights.",
    },
    RET_CONSUMER_RETURNS: {
      preferredPosition: "30-day returns policy for change of mind (exceeding statutory minimum). Defective goods returned at our cost within 24 months. Refund processed within 5 business days of return receipt. Exchange or refund at consumer's option for defective items. No restocking fees.",
      acceptableFallback: "Statutory returns rights complied with. Defective goods policy clearly stated. Refund within 14 days of return.",
      hardRedLine: "Returns policy that restricts statutory rights; or refund timeframes that exceed statutory maximums.",
    },
    RET_MARKETPLACE_TERMS: {
      preferredPosition: "Platform seller terms fixed for minimum 12 months. Fee changes notified 90 days in advance with right to delist. Commission and fee structure transparent. Platform may not use our sales data to compete against us. Dispute resolution process for order issues available with 48-hour response.",
      acceptableFallback: "Seller terms with 60-day change notice. Transparent fee structure. Sales data not used against us. Dispute process available.",
      hardRedLine: "Platform may change fees with less than 30 days' notice; or use our seller data to develop competing products.",
    },
    RET_AGE_VERIFICATION: {
      preferredPosition: "Age verification system compliant with applicable law and Ofcom/BBFC guidance for age-restricted products. Verification records retained in compliance with data protection law. We accept no liability for third-party age verification system failures if we have complied with contractual specifications.",
      acceptableFallback: "Age verification compliant with applicable requirements. Liability for failure allocated to the party responsible for the verification system.",
      hardRedLine: "No age verification obligation for age-restricted products; or we bear sole liability for failures in a third-party age verification system.",
    },
    RET_CONSUMER_CREDIT: {
      preferredPosition: "BNPL and consumer credit products comply with Consumer Credit Act 1974 and FCA CONC rules. Clear disclosure of total cost of credit, APR, and repayment terms. FCA authorisation verified for credit broking or lending. No incentivised sales of unsuitable credit products.",
      acceptableFallback: "Consumer credit compliance warranted. FCA authorisation confirmed. Transparent credit terms.",
      hardRedLine: "Consumer credit products offered without FCA authorisation; or credit terms that do not comply with Consumer Credit Act disclosure requirements.",
    },
    // ── Media & Entertainment clauses ────────────────────────────────────────
    MEDIA_RIGHTS_CLEARANCE: {
      preferredPosition: "Supplier warrants full chain of title and all necessary rights clearances for all materials delivered. Underlying rights (music, archive footage, literary rights, personality rights, synchronisation) fully cleared for the specified media, territories, and term. E&O insurance minimum £1M per occurrence. Indemnity for third-party IP claims arising from defective title.",
      acceptableFallback: "Chain of title warranty. E&O insurance. Indemnity for IP claims from undisclosed underlying rights encumbrances.",
      hardRedLine: "No chain of title warranty; or delivery of materials without confirmation that underlying rights are cleared for our intended use.",
    },
    MEDIA_RESIDUALS_ROYALTIES: {
      preferredPosition: "All residual obligations to guilds, unions, and collecting societies fully disclosed and allocated. Royalty accounting statements provided quarterly within 30 days of quarter end. Audit right on royalty calculations on 15 days' notice annually. No cross-collateralisation across separate titles or projects without consent.",
      acceptableFallback: "Residual obligations disclosed and allocated. Semi-annual royalty accounting. Audit right annually.",
      hardRedLine: "Undisclosed residual obligations falling on us; or cross-collateralisation of royalties across projects without consent.",
    },
    MEDIA_TALENT_OBLIGATIONS: {
      preferredPosition: "All talent agreements (on-screen, voice, music performance) fully executed before production commences. Talent clearances cover all intended media, territories, and term. Likeness rights and approval rights clearly defined. Re-use fees and residuals pre-agreed. No talent approval rights that could prevent delivery.",
      acceptableFallback: "Talent agreements in place before production. Clearances for primary media and territory. Re-use fee schedule agreed.",
      hardRedLine: "Talent not contracted before production; or talent approval rights that give veto over editorial decisions without compensation.",
    },
    MEDIA_FORMAT_RIGHTS: {
      preferredPosition: "Format rights, adaptation rights, and sequel/prequel rights clearly defined and allocated. Option periods and exercise prices specified. All languages and territories covered for primary distribution. Underlying literary or IP rights licensed for all intended adaptations. Moral rights waivers obtained where applicable.",
      acceptableFallback: "Format and adaptation rights documented. Option terms and exercise prices clear. Primary territories and languages covered.",
      hardRedLine: "Format rights that include unexpected sequel or franchise obligations we did not agree to; or adaptation rights that infringe underlying IP we cannot clear.",
    },
    MEDIA_SYNC_LICENSE: {
      preferredPosition: "Synchronisation licence covers all intended uses: linear, on-demand, streaming, social, theatrical, and promotional. Territory, term, and media clearly specified. Master and publisher licences both obtained. No most-favoured-nation obligations that trigger additional payments without notice. Festival use covered.",
      acceptableFallback: "Sync licence covers primary distribution media and territory. Both master and sync rights cleared. MFN obligations disclosed.",
      hardRedLine: "Sync licence that does not cover all distribution platforms we use; or undisclosed MFN obligations that create unexpected payment obligations.",
    },
    // ── Energy & CleanTech clauses ───────────────────────────────────────────
    ENERGY_OFFTAKE: {
      preferredPosition: "Offtake volume, price, and indexation mechanism agreed for the full contract term. Curtailment rights clearly defined with compensation mechanism. Balancing responsibility allocated. Floor price protection included. Change in law provisions covering subsidy regime changes. Bankable contract terms accepted by project finance lenders.",
      acceptableFallback: "Offtake terms agreed. Curtailment with compensation. Balancing allocation clear. Change in law provisions included.",
      hardRedLine: "No curtailment compensation; or change in law provisions that place subsidy regime risk entirely on the generator without price adjustment.",
    },
    ENERGY_GRID_CONNECTION: {
      preferredPosition: "Grid connection agreement with DNO/TO in place or conditions precedent to this contract. Connection capacity confirmed in writing. Rights of way and land access secured. Metering obligations and data access rights specified. Reinforcement cost allocation agreed.",
      acceptableFallback: "Grid connection terms agreed or conditions precedent documented. Metering and data access specified.",
      hardRedLine: "No confirmed grid connection capacity before financial close; or reinforcement costs that are uncapped and fall on us without contractual ceiling.",
    },
    ENERGY_SUBSIDY_REGIME: {
      preferredPosition: "Applicable subsidy (CfD, ROC, FIT, REGO, BM) registration conditions confirmed. Compliance with scheme rules warranted. Change in scheme rules triggers renegotiation mechanism. Revenue waterfall clearly specifies subsidy payment priority. Clawback risk allocated.",
      acceptableFallback: "Subsidy eligibility confirmed. Scheme rule compliance warranted. Change in law renegotiation mechanism included.",
      hardRedLine: "Subsidy eligibility not confirmed; or change in subsidy scheme risk allocated entirely to us without pricing adjustment mechanism.",
    },
    ENERGY_ENVIRONMENTAL_PERMITS: {
      preferredPosition: "All required environmental permits (Environmental Permit, planning consent, EIA, habitat survey) obtained or conditions precedent to financial close. Ongoing permit compliance warranted. We are notified within 48 hours of any permit breach or enforcement action. Decommissioning and remediation obligations clearly allocated.",
      acceptableFallback: "Required permits in place or conditions precedent. Permit compliance warranted. Notification of enforcement within 5 days. Decommissioning obligations allocated.",
      hardRedLine: "Financial close before required environmental permits obtained; or decommissioning liability unallocated.",
    },
    ENERGY_BALANCING_IMBALANCE: {
      preferredPosition: "Balancing and imbalance risk clearly allocated between parties. Gate closure notification obligations specified. Imbalance settlement charges allocated to the party responsible for the imbalance. Forecasting obligations and accuracy requirements defined.",
      acceptableFallback: "Balancing responsibility allocated. Gate closure obligations specified. Imbalance charges follow allocation of balancing responsibility.",
      hardRedLine: "Imbalance risk allocated to us for generation dispatch decisions we do not control.",
    },
    // ── Education & EdTech clauses ───────────────────────────────────────────
    EDU_SAFEGUARDING: {
      preferredPosition: "All personnel with access to children or vulnerable adults hold enhanced DBS clearance updated within 3 years. Safeguarding policy compliant with Keeping Children Safe in Education 2024 and Working Together 2023. Designated Safeguarding Lead identified. Obligation to report safeguarding concerns immediately and cooperate with statutory investigations.",
      acceptableFallback: "Enhanced DBS clearance for all relevant personnel. Safeguarding policy maintained and shared. Reporting obligations accepted.",
      hardRedLine: "No DBS clearance requirement for personnel with unsupervised child access; or no safeguarding policy.",
    },
    EDU_STUDENT_DATA: {
      preferredPosition: "Student personal data processed only for agreed educational purposes. Parental or guardian consent obtained for under-13 data processing. No student data used for advertising or profiling. Data minimisation applied. FERPA (US) or UK GDPR compliance warranted. Student records returned on contract termination.",
      acceptableFallback: "Student data processing limited to educational purposes. Parental consent for under-13s. No profiling or advertising use. Records returned on termination.",
      hardRedLine: "Student data used for commercial profiling; or no parental consent mechanism for children's data.",
    },
    EDU_CURRICULUM_RIGHTS: {
      preferredPosition: "All curriculum content and course materials developed under this agreement vest in us on creation. Supplier retains pre-existing IP with broad licence. We may adapt, update, and republish content without restriction. No lock-in to supplier's LMS or content platform after contract ends. SCORM/xAPI compliance required for interoperability.",
      acceptableFallback: "Curriculum content IP vests in us. Supplier background IP licensed perpetually. Platform interoperability (SCORM/xAPI) required.",
      hardRedLine: "Supplier owns curriculum content we commissioned and paid for; or content locked into proprietary format preventing use on other platforms.",
    },
    EDU_ACCREDITATION: {
      preferredPosition: "Accreditation body approval obtained before programme launch. Awarding body agreement executed and in force. Qualification specifications and assessment requirements complied with. We are notified within 24 hours of any accreditation risk or compliance concern. No material programme changes without awarding body approval.",
      acceptableFallback: "Accreditation in place. Qualification compliance warranted. Notification of accreditation issues within 5 days.",
      hardRedLine: "Programme launched before accreditation obtained; or material programme changes without awarding body approval risking students' qualifications.",
    },
    // ── Professional Services clauses ────────────────────────────────────────
    PS_ENGAGEMENT_SCOPE: {
      preferredPosition: "Scope of services defined in a detailed Statement of Work. Change request process agreed: written change order required; no additional charges without signed change order. Out-of-scope activities expressly identified. Scope creep not billable without our prior written approval.",
      acceptableFallback: "Scope documented. Written change orders required for additional work. Out-of-scope items identified.",
      hardRedLine: "Vague scope definition with no change control process; or supplier may expand scope and charge for it without our approval.",
    },
    PS_FEE_BILLING: {
      preferredPosition: "Fixed fees or agreed hourly rates for the engagement term. Rate card locked for minimum 12 months. Expenses pre-approved and capped at cost only (no mark-up). Invoices itemised by task and time recorded. Payment within 30 days. No success fees or contingency arrangements without separate written agreement.",
      acceptableFallback: "Agreed rates fixed for the term. Expenses at cost with pre-approval. Itemised invoices. 30-day payment.",
      hardRedLine: "Unilateral rate increases during engagement; or expense mark-up without disclosure; or invoices without sufficient detail to verify.",
    },
    PS_CONFLICTS_INTEREST: {
      preferredPosition: "Supplier confirms no actual or potential conflict of interest at engagement commencement and warrants to notify us immediately of any conflict arising during the engagement. Conflicts policy shared on request. We have right to terminate if conflict is not resolved to our satisfaction. No concurrent engagements with direct competitors without our consent.",
      acceptableFallback: "Conflict disclosure at engagement commencement. Ongoing notification obligation. Termination right for unresolvable conflicts.",
      hardRedLine: "No conflict of interest disclosure; or supplier may simultaneously advise direct competitors on related matters without consent.",
    },
    PS_PROFESSIONAL_LIABILITY: {
      preferredPosition: "Supplier maintains professional indemnity insurance appropriate to the risk of the engagement: minimum £2M per claim for regulated professional services. PI policy maintained for minimum 6 years post-engagement (run-off cover). Certificate of insurance provided annually on request. No exclusion of liability for professional negligence causing financial loss.",
      acceptableFallback: "PI insurance minimum £1M per claim. Run-off cover confirmed. Certificate on request. No exclusion of professional negligence liability.",
      hardRedLine: "No PI insurance for regulated professional services; or exclusion of liability for professional negligence.",
    },
  },
  COMMERCIAL: {
    LIABILITY_CAP: {
      preferredPosition: "Liability capped at 6 months' fees. Data breach and fraud uncapped.",
      acceptableFallback: "3 months' fees if fraud and data breach are carved out.",
      hardRedLine: "No cap or cap covering fraud.",
    },
    INDEMNITY: {
      preferredPosition: "Limited mutual indemnity for wilful misconduct and fraud.",
      acceptableFallback: "Indemnity for gross negligence and wilful misconduct.",
      hardRedLine: "Uncapped indemnity for ordinary negligence.",
    },
    IP_OWNERSHIP: {
      preferredPosition: "Supplier retains IP with broad licence to us.",
      acceptableFallback: "Non-exclusive perpetual licence.",
      hardRedLine: "No licence at all.",
    },
    CONFIDENTIALITY: {
      preferredPosition: "Mutual, 2-year confidentiality.",
      acceptableFallback: "1-year with standard carve-outs.",
      hardRedLine: "No confidentiality obligation.",
    },
    DATA_PRIVACY: {
      preferredPosition: "DPA in place.",
      acceptableFallback: "Reasonable data protection obligations in contract body.",
      hardRedLine: "No data protection provisions where personal data is involved.",
    },
    TERMINATION: {
      preferredPosition: "90-day convenience termination.",
      acceptableFallback: "120-day notice period.",
      hardRedLine: "No termination for convenience.",
    },
    PAYMENT_TERMS: {
      preferredPosition: "30-day payment.",
      acceptableFallback: "45-day with agreed milestone triggers.",
      hardRedLine: "Upfront full payment.",
    },
    AUTO_RENEWAL: {
      preferredPosition: "Auto-renewal fine with 30 days' notice.",
      acceptableFallback: "Auto-renewal with 15 days' notice.",
      hardRedLine: "Auto-renewal with no notice provision.",
    },
    GOVERNING_LAW: {
      preferredPosition: "English law preferred.",
      acceptableFallback: "Counterparty jurisdiction acceptable for strategic deals.",
      hardRedLine: "No governing law clause.",
    },
    AUDIT_RIGHTS: {
      preferredPosition: "Audit right on reasonable notice.",
      acceptableFallback: "Third-party audit acceptable.",
      hardRedLine: "No audit right for data processing.",
    },
    FORCE_MAJEURE: {
      preferredPosition: "Broad force majeure acceptable. Notify within 30 days; either party may terminate after 3 months.",
      acceptableFallback: "Force majeure with 3-month long-stop and mutual termination right.",
      hardRedLine: "Force majeure with no long-stop and no termination right.",
    },
    WARRANTIES: {
      preferredPosition: "Authority and title warranties. Fitness for purpose to be implied.",
      acceptableFallback: "Authority warranty only. Fit for purpose to be negotiated case-by-case.",
      hardRedLine: "No warranties whatsoever on services with regulated outputs.",
    },
    DISPUTE_RESOLUTION: {
      preferredPosition: "Direct escalation to arbitration or courts. English law preferred.",
      acceptableFallback: "Mediation then arbitration. Any major international arbitral institution acceptable.",
      hardRedLine: "Clauses that prevent access to courts for emergency relief.",
    },
    ASSIGNMENT: {
      preferredPosition: "Assignment permitted within group. Third-party assignment with reasonable consent.",
      acceptableFallback: "Assignment permitted on notice. Counterparty consent not required for group restructuring.",
      hardRedLine: "No assignment permitted even within group companies.",
    },
    INSURANCE: {
      preferredPosition: "Reasonable insurance appropriate to the risk profile of the contract.",
      acceptableFallback: "Professional Indemnity £500k+. Evidence annually.",
      hardRedLine: "No insurance for contracts involving personal data, financial outputs, or physical risk.",
    },
    NON_SOLICITATION: {
      preferredPosition: "6-month mutual restriction on direct solicitation of involved personnel only.",
      acceptableFallback: "12-month restriction on active solicitation; general advertising exempted.",
      hardRedLine: "Restriction exceeding 12 months or covering all hiring.",
    },
    EXCLUSIVITY: {
      preferredPosition: "Exclusivity acceptable if commercially justified. Exit right on 6 months' notice.",
      acceptableFallback: "Exclusivity with annual review and benchmarking right.",
      hardRedLine: "Perpetual exclusivity with no exit or performance benchmarks.",
    },
    CHANGE_OF_CONTROL: {
      preferredPosition: "Notification obligation on change of control. Termination right on 90 days' notice.",
      acceptableFallback: "Right to review and renegotiate terms following material change of control.",
      hardRedLine: "No notification requirement and no termination right on change of control.",
    },
    RENT_REVIEW: {
      preferredPosition: "CPI-linked review or open market review every 5 years.",
      acceptableFallback: "Upward-only review at open market value with RICS arbitration.",
      hardRedLine: "Uncapped review with no dispute mechanism.",
    },
    BREAK_CLAUSE: {
      preferredPosition: "Tenant break at midpoint of lease. Conditions: vacant possession only.",
      acceptableFallback: "Tenant break at year 5 with reasonable conditions.",
      hardRedLine: "No break clause on lease exceeding 5 years.",
    },
    REPAIR_OBLIGATIONS: {
      preferredPosition: "Internal repairs only. Landlord takes structure and exterior.",
      acceptableFallback: "FRI with Schedule of Condition.",
      hardRedLine: "FRI without Schedule of Condition on premises over 5 years old.",
    },
    SERVICE_CHARGE: {
      preferredPosition: "Service charge with annual budget and accounts.",
      acceptableFallback: "Reasonable service charge with accounts within 12 months.",
      hardRedLine: "Uncapped service charge including capital expenditure without consent.",
    },
    ENTIRE_AGREEMENT: {
      preferredPosition: "Entire agreement clause standard in our contracts. Carve-out for fraud.",
      acceptableFallback: "Entire agreement clause accepted. Written representations may be carved in where agreed.",
      hardRedLine: "No entire agreement clause where verbal commitments were made.",
    },
    VARIATION: {
      preferredPosition: "Email variation acceptable between designated contacts for operational matters. Formal amendment for material changes.",
      acceptableFallback: "Written variation via email or signed amendment.",
      hardRedLine: "Counterparty has unilateral right to vary material terms by notice alone.",
    },
    WAIVER: {
      preferredPosition: "Standard waiver clause. Written requirement. No course of dealing waivers.",
      acceptableFallback: "Waiver by written communication from authorised representative.",
      hardRedLine: "Blanket waiver of material rights by implication.",
    },
    SEVERABILITY: {
      preferredPosition: "Standard severability. Remainder of agreement unaffected by invalid provision.",
      acceptableFallback: "Severability with judicial modification power.",
      hardRedLine: "No severability on agreements with potentially unenforceable provisions.",
    },
    NOTICES: {
      preferredPosition: "Email notices acceptable with 24-hour deemed receipt.",
      acceptableFallback: "Email or post. Standard deemed receipt periods.",
      hardRedLine: "No notices provision.",
    },
    THIRD_PARTY_RIGHTS: {
      preferredPosition: "Third party rights excluded or limited to group companies.",
      acceptableFallback: "Third party rights for named group entities acceptable.",
      hardRedLine: "Third party rights creating obligations on us to unknown parties.",
    },
    SET_OFF: {
      preferredPosition: "Mutual set-off of undisputed amounts under this agreement.",
      acceptableFallback: "Reasonable set-off rights limited to clear, undisputed debts.",
      hardRedLine: "Counterparty has unlimited set-off rights including unrelated contracts.",
    },
    LIQUIDATED_DAMAGES: {
      preferredPosition: "LDs acceptable if capped and representing genuine pre-estimate. Total cap 50% of contract value.",
      acceptableFallback: "LDs with 100% cap and sole remedy status for specified breach.",
      hardRedLine: "Uncapped LDs that function as penalties.",
    },
    MOST_FAVOURED_NATION: {
      preferredPosition: "MFN acceptable for strategic relationships. Notification-based. 30-day claim window.",
      acceptableFallback: "MFN on pricing for comparable volume tiers; 60-day claim window.",
      hardRedLine: "Automatic MFN pricing changes without notice or commercial rationale.",
    },
    BENCHMARKING: {
      preferredPosition: "Benchmarking acceptable every 3 years. Right to renegotiate on unfavourable result.",
      acceptableFallback: "Benchmarking every 2 years with good faith pricing discussion.",
      hardRedLine: "Benchmarking with automatic price reduction regardless of market comparison methodology.",
    },
    STEP_IN_RIGHTS: {
      preferredPosition: "Step-in acceptable on insolvency or regulatory breach. Reasonable costs.",
      acceptableFallback: "Step-in on material extended breach. Shared cost during step-in period.",
      hardRedLine: "Broad step-in rights on minor performance failures.",
    },
    SUBCONTRACTING: {
      preferredPosition: "Subcontracting on notice for non-core activities. Supplier liable for subcontractors.",
      acceptableFallback: "Subcontracting with written notification. Supplier remains liable.",
      hardRedLine: "Subcontracting with no liability for subcontractor acts involving our data.",
    },
    BUSINESS_CONTINUITY: {
      preferredPosition: "BCP/DR plan maintained. Key metrics aligned to service agreement.",
      acceptableFallback: "BCP maintained. Evidence on reasonable request annually.",
      hardRedLine: "No BCP/DR for services critical to our operations.",
    },
    SERVICE_LEVELS: {
      preferredPosition: "Agreed SLAs with service credits. Termination right on persistent failure.",
      acceptableFallback: "Best-efforts SLAs with escalation process. Service credits for material failure.",
      hardRedLine: "No SLAs on operationally critical services.",
    },
    SOURCE_CODE_ESCROW: {
      preferredPosition: "Escrow for bespoke software on reasonable commercial terms.",
      acceptableFallback: "Escrow deposit on insolvency trigger. No ongoing verification obligation.",
      hardRedLine: "No escrow where entire business process depends on proprietary software.",
    },
    MARKETING_RIGHTS: {
      preferredPosition: "Customer list inclusion acceptable. Case study requires consent.",
      acceptableFallback: "Logo and name usage in generic marketing materials on approval.",
      hardRedLine: "Unilateral press releases or product endorsements without consent.",
    },
    ANTI_BRIBERY: {
      preferredPosition: "Anti-bribery warranty. Termination right for material breach.",
      acceptableFallback: "Compliance with applicable anti-corruption law warranted.",
      hardRedLine: "No anti-bribery provisions.",
    },
    SANCTIONS_COMPLIANCE: {
      preferredPosition: "Sanctions warranty. Notification on risk. Termination right.",
      acceptableFallback: "Compliance warranty with applicable sanctions regimes.",
      hardRedLine: "No sanctions clause.",
    },
    MODERN_SLAVERY: {
      preferredPosition: "Modern Slavery Act compliance warranted.",
      acceptableFallback: "MSA compliance. Notification of identified supply chain issues.",
      hardRedLine: "No modern slavery provisions for supply chain-exposed contracts.",
    },
    ENVIRONMENTAL_OBLIGATIONS: {
      preferredPosition: "Environmental law compliance. Cooperation with our sustainability reporting.",
      acceptableFallback: "Compliance warranted. Good faith sustainability data sharing.",
      hardRedLine: "No environmental provisions on contracts with material environmental impact.",
    },
    TUPE: {
      preferredPosition: "TUPE compliance warranted. Indemnity for pre-transfer liabilities.",
      acceptableFallback: "TUPE warranty. Reasonable employee information sharing.",
      hardRedLine: "No TUPE provisions where transfer is foreseeable.",
    },
    RESTRICTIVE_COVENANTS: {
      preferredPosition: "Non-compete 6–12 months, specific market only. Non-solicitation of key accounts.",
      acceptableFallback: "Non-compete up to 12 months in directly competed area.",
      hardRedLine: "Non-compete exceeding 12 months or covering entire industry.",
    },
    ACCEPTANCE_TESTING: {
      preferredPosition: "Acceptance criteria agreed upfront. Reasonable testing window.",
      acceptableFallback: "10–15 day testing window. Cure period after failure.",
      hardRedLine: "No acceptance testing on bespoke deliverables above £50k.",
    },
    REGULATORY_CHANGE: {
      preferredPosition: "Notification of regulatory change. Good faith renegotiation.",
      acceptableFallback: "Compliance obligation. Termination if performance becomes illegal.",
      hardRedLine: "No regulatory change clause for regulated sectors.",
    },
    CONTENT_MODERATION: {
      preferredPosition: "Platform content moderation policy applies. Reasonable notice before removing our content. Dispute escalation available.",
      acceptableFallback: "Standard platform moderation policies apply. Good faith escalation for contested decisions affecting significant revenue.",
      hardRedLine: "No notice or dispute process for content removal decisions that materially impact our title's commercial performance.",
    },
    VIRTUAL_ITEMS: {
      preferredPosition: "Virtual items on our published terms. Probability disclosure for randomised items compliant with applicable law. IP in virtual items retained by us.",
      acceptableFallback: "Platform implements our virtual item terms. Reasonable probability disclosure per applicable law.",
      hardRedLine: "Platform claims rights in our virtual items or prevents us from updating probability disclosures to meet new legal requirements.",
    },
    PLATFORM_REVENUE_SHARE: {
      preferredPosition: "Revenue share at agreed rates. 90-day notice for changes. Monthly revenue reports.",
      acceptableFallback: "Standard platform revenue share applicable. Rate changes with reasonable notice. Periodic reporting.",
      hardRedLine: "No reporting obligation; arbitrary deductions; or unilateral changes with no notice period.",
    },
    LOOT_BOX_MECHANICS: {
      preferredPosition: "Probability disclosure implemented before purchase. Legal review for primary markets. Spend controls for minors. Compliance with applicable law in each market.",
      acceptableFallback: "Good faith compliance with applicable loot box regulations. Probability disclosure implemented in major markets. Spend controls for minor accounts.",
      hardRedLine: "No probability disclosure; no spend controls for minors; we bear sole legal risk for mechanics that were jointly designed or approved by the platform.",
    },
    // ── Investment document clauses ──────────────────────────────────────────
    LIQUIDATION_PREFERENCE: {
      preferredPosition: "1x non-participating preferred only. Investor receives their investment back first, then converts to ordinary shares to participate in remaining proceeds on a pro-rata basis.",
      acceptableFallback: "1x participating preferred with a cap at 2x total return, after which the preference falls away.",
      hardRedLine: "2x or higher participating preferred, or uncapped participating preferred - allows investor to double-dip at exit.",
    },
    ANTI_DILUTION: {
      preferredPosition: "Broad-based weighted average anti-dilution only. Protects investor against down-rounds without punishing founders disproportionately.",
      acceptableFallback: "Narrow-based weighted average anti-dilution with a time limit of 24 months.",
      hardRedLine: "Full ratchet anti-dilution under any circumstances - converts all prior shares at new lower price, severely diluting founders.",
    },
    PRO_RATA_RIGHTS: {
      preferredPosition: "Meaningful pro-rata rights for all investors above a minimum threshold, allowing them to maintain their percentage in future rounds.",
      acceptableFallback: "Pro-rata rights limited to lead investors or investors above 5% ownership threshold.",
      hardRedLine: "Wholesale waiver of existing investor pro-rata rights without their consent.",
    },
    DRAG_ALONG: {
      preferredPosition: "Drag-along requires consent of majority of ordinary shareholders plus majority of preference shareholders. Founders cannot be dragged below a board-approved minimum valuation.",
      acceptableFallback: "Drag threshold of 75% of all shares on a fully diluted basis. Valuation floor provisions.",
      hardRedLine: "Investors can drag ordinary shareholders to a sale without ordinary shareholder majority consent, or drag at any valuation.",
    },
    INFORMATION_RIGHTS: {
      preferredPosition: "Monthly management accounts, annual audited accounts, board observer rights for lead investor, annual budget presented to and approved by board.",
      acceptableFallback: "Quarterly management accounts, annual audited accounts, and observer rights for investors above 5% threshold.",
      hardRedLine: "No information rights beyond statutory minimum, or active restriction on sharing financial information with investors.",
    },
    BOARD_COMPOSITION: {
      preferredPosition: "Founders retain majority board seats. Any investor board appointment requires founder consent. Independent director appointed by mutual agreement.",
      acceptableFallback: "Equal founder and investor board representation with an independent chair appointed by the founders as tiebreaker.",
      hardRedLine: "Investors hold majority board control at Series A or earlier without founder veto or protection mechanism.",
    },
    VESTING_LEAVER: {
      preferredPosition: "4-year vesting schedule, 1-year cliff. Good leaver includes resignation after 24 months of service. Bad leaver provisions limited to fraud, gross misconduct, and material breach. Full acceleration on change of control.",
      acceptableFallback: "4-year vesting, 1-year cliff. Clear and objective good/bad leaver definitions based on conduct. Partial acceleration on good leaver exit.",
      hardRedLine: "All unvested shares forfeited on any resignation regardless of length of service, or no distinction between good and bad leaver treatment.",
    },
    OPTION_POOL_SHUFFLE: {
      preferredPosition: "Option pool created or expanded post-closing on a fully diluted basis that includes the new investment. All shareholders, including the incoming investor, dilute pro-rata.",
      acceptableFallback: "Modest pre-money option pool (maximum 10%) if sized appropriately and transparently disclosed in headline valuation.",
      hardRedLine: "Oversized pre-money option pool used to reduce the effective pre-money valuation without transparent disclosure - allows investor to pay less than the stated valuation.",
    },
    PAY_TO_PLAY: {
      preferredPosition: "No pay-to-play provisions. Investors who cannot follow on in a future round retain their existing rights.",
      acceptableFallback: "Soft pay-to-play converting preference to ordinary shares only, with a minimum 30-day cure period and notice.",
      hardRedLine: "Hard pay-to-play stripping anti-dilution rights and preference automatically without a cure period.",
    },
    REDEMPTION_RIGHTS: {
      preferredPosition: "No redemption rights under any circumstances. Company capital should not be a de facto debt instrument.",
      acceptableFallback: "Redemption only as a long-stop after 7+ years if no liquidity event has occurred, with 12-month written notice and board approval.",
      hardRedLine: "Redemption rights exercisable within 5 years, or at investor discretion, or without requiring a formal liquidity event.",
    },
    // ── Insurance litigation clauses ─────────────────────────────────────────
    INS_COVERAGE_RESPONSE: {
      preferredPosition: "Policy clearly responds: all coverage triggers met, no exclusions apply, insured has complied with all conditions.",
      acceptableFallback: "Coverage arguable: primary position responds but one or more conditions or exclusions require analysis before confirming.",
      hardRedLine: "Coverage does not respond, a clear exclusion applies, or a material condition precedent has been breached.",
    },
    INS_EXCLUSIONS_ANALYSIS: {
      preferredPosition: "No applicable exclusion identified. Policy wording unambiguous and insured's conduct does not trigger any exclusion.",
      acceptableFallback: "One exclusion potentially applicable but arguments available on both sides. Requires senior review before position is taken.",
      hardRedLine: "A clear and unambiguous exclusion applies. Coverage denial is legally defensible.",
    },
    INS_NOTIFICATION_COMPLIANCE: {
      preferredPosition: "Notification received within the required timeframe, in the correct form, and to the correct party. No condition precedent issues.",
      acceptableFallback: "Notification technically late but arguments available that condition was not a condition precedent, or that the insurer has not been prejudiced.",
      hardRedLine: "Notification clearly non-compliant: materially out of time, wrong form, or missing information that cannot be excused.",
    },
    INS_QUANTUM_ASSESSMENT: {
      preferredPosition: "Current reserve is adequate and reflects a realistic assessment of exposure. No reserve movement required.",
      acceptableFallback: "Reserve requires review. Realistic range is above current reserve but within acceptable parameters for claims committee reporting.",
      hardRedLine: "Current reserve is materially inadequate. Exposure significantly exceeds reserve. Immediate reserve uplift and committee reporting required.",
    },
    INS_DEFENCE_PROSPECTS: {
      preferredPosition: "Strong defence prospects. Claim is defensible on liability and/or quantum. Recommend defend.",
      acceptableFallback: "Reasonable defence prospects but outcome uncertain. Consider commercial settlement to manage costs and litigation risk.",
      hardRedLine: "Weak or indefensible. Liability likely established. Settlement is the commercially rational outcome.",
    },
    INS_SETTLEMENT_AUTHORITY: {
      preferredPosition: "Recommended settlement within litigation handler authority. No escalation required.",
      acceptableFallback: "Recommended settlement within senior litigation counsel authority. Single-level escalation required.",
      hardRedLine: "Recommended settlement exceeds claims committee or board authority. Full escalation required before any settlement discussions.",
    },
    INS_REGULATORY_OBLIGATIONS: {
      preferredPosition: "All FCA claims handling obligations met. TCF requirements satisfied. All timeframes and reporting duties complied with.",
      acceptableFallback: "One or more regulatory obligations at risk of breach. Remediation steps underway. FCA notification not yet required.",
      hardRedLine: "Regulatory breach identified. FCA notification obligation triggered or imminent. Immediate compliance action required.",
    },
    INS_SUBROGATION_POTENTIAL: {
      preferredPosition: "Strong subrogation prospects against an identifiable and solvent third party. Recovery action should be pursued.",
      acceptableFallback: "Subrogation possible but uncertain. Third party identified; prospects require further investigation before committing to recovery action.",
      hardRedLine: "Subrogation unlikely. Third party unidentified, insolvent, or defence of primary claim takes priority.",
    },
    INS_PANEL_FIRM_INSTRUCTIONS: {
      preferredPosition: "Panel firm spend and strategy within approved guidelines. Budget forecast within approved parameters.",
      acceptableFallback: "Panel spend approaching approved threshold. Budget review and approval required before further instruction.",
      hardRedLine: "Panel spend exceeds approved threshold or strategy materially deviates from instructions. Immediate review and re-approval required.",
    },
    INS_RESERVE_ADEQUACY: {
      preferredPosition: "Reserve is adequate and reflects current best estimate of ultimate exposure. No movement required at this stage.",
      acceptableFallback: "Reserve requires upward review. Exposure development warrants adjustment before next reporting period.",
      hardRedLine: "Reserve is materially inadequate. Immediate uplift required. Board or claims committee reporting obligation triggered.",
    },
    // ── Insurance litigation - extended ─────────────────────────────────────
    INS_FRAUD_INDICATORS: {
      preferredPosition: "Proportionate fraud screening on high-value claims. Referral to SIU where indicators warrant.",
      acceptableFallback: "Fraud review on request. Reasonable investigation timelines.",
      hardRedLine: "Blanket refusal to engage with fraud investigation.",
    },
    INS_REHABILITATION: {
      preferredPosition: "Rehabilitation considered where cost-effective versus quantum reduction potential.",
      acceptableFallback: "Ad-hoc rehabilitation offers where claimant requests.",
      hardRedLine: "Rehabilitation entirely excluded.",
    },
    INS_EXPERT_EVIDENCE: {
      preferredPosition: "Pragmatic expert use. SJE on medical causation where both parties agree.",
      acceptableFallback: "Party expert where SJE not agreed. Reasonable costs.",
      hardRedLine: "No right to challenge expert evidence or instructions.",
    },
    INS_PART36_CPR: {
      preferredPosition: "Part 36 offers considered on merits. Response within CPR timeframes.",
      acceptableFallback: "Respond to Part 36 offers where commercially justified.",
      hardRedLine: "No engagement with Part 36 process.",
    },
    INS_COSTS_BUDGETING: {
      preferredPosition: "Costs budget filed where required. Proportionality challenge on clearly excessive phases only.",
      acceptableFallback: "Costs reviewed at settlement. Negotiate where disproportionate.",
      hardRedLine: "No mechanism to challenge costs.",
    },
    INS_THIRD_PARTY_CAPTURE: {
      preferredPosition: "Third-party capture where commercially justified. Contact within 14 days.",
      acceptableFallback: "Capture on higher-value unrepresented claims.",
      hardRedLine: "Capture without proper independent assessment.",
    },
    INS_CLAIMS_TIMEFRAMES: {
      preferredPosition: "Acknowledgement within 5 business days. Coverage decision within 21 business days where possible.",
      acceptableFallback: "Reasonable response times. Updates on material developments.",
      hardRedLine: "No claims handling timeframe obligations.",
    },
    INS_CONDITIONS_PRECEDENT: {
      preferredPosition: "Conditions precedent enforced where breach causes actual prejudice to insurer.",
      acceptableFallback: "Proportionate approach to conditions precedent enforcement.",
      hardRedLine: "Conditions precedent unenforceable regardless of breach.",
    },
    INS_CONTRIBUTION: {
      preferredPosition: "Contribution pursued where net recovery justifies cost. Proportional share agreed by negotiation.",
      acceptableFallback: "Contribution rights reserved. Pursued on high-value claims.",
      hardRedLine: "No mechanism to pursue contribution.",
    },
    INS_REINSTATEMENT: {
      preferredPosition: "Reinstatement or indemnity elected by insured. Cost comparison provided within 21 days of loss.",
      acceptableFallback: "Reinstatement where insured requests and cost is not disproportionate.",
      hardRedLine: "Insured has no election right between reinstatement and indemnity.",
    },
    // ── Logistics contract clauses ───────────────────────────────────────────
    LOG_LIABILITY_CAP_CMR: {
      preferredPosition: "Liability limited to CMR Convention limits for international road freight (8.33 SDR per kg). All attempts to exclude CMR limits rejected.",
      acceptableFallback: "Enhanced liability cap agreed at a defined per-consignment limit with corresponding insurance in place. CMR limits as backstop.",
      hardRedLine: "Customer paper excludes CMR limits entirely and imposes uncapped liability for cargo loss or damage beyond insurance cover.",
    },
    LOG_CARGO_LIABILITY: {
      preferredPosition: "Cargo liability limited to insured values. Customer has arranged own cargo insurance. Our liability capped at CMR or agreed per-consignment limit.",
      acceptableFallback: "Liability for cargo loss or damage capped at a defined limit commensurate with our insurance cover. Enhanced limit with additional premium.",
      hardRedLine: "Liability for cargo loss or damage exceeds our insurance cover. Uncapped exposure creates uninsurable risk.",
    },
    LOG_INDEMNITY: {
      preferredPosition: "Indemnities are proportionate and fault-based. We indemnify for our own negligence only. Customer indemnifies for their acts, omissions, and misdescription of cargo.",
      acceptableFallback: "Mutual indemnities limited to gross negligence and wilful misconduct. Each party responsible for losses caused by their own breach.",
      hardRedLine: "We are required to indemnify the customer for their own negligence, misdescription of cargo, or inadequate packaging.",
    },
    LOG_SERVICE_LEVELS: {
      preferredPosition: "SLAs are achievable and reflect operational reality. Force majeure covers customs delays, port congestion, industrial action, and weather events. Service credits proportionate and capped.",
      acceptableFallback: "Reasonable SLAs with force majeure for material disruption events. Service credits as sole remedy for SLA breach capped at 10% of monthly fees.",
      hardRedLine: "Punitive SLAs without force majeure for logistics-specific disruption. Service credits uncapped or structured as penalties.",
    },
    LOG_SUBCONTRACTING: {
      preferredPosition: "Unrestricted right to subcontract to approved hauliers and logistics partners. Pass-through liability. No prior approval required for routine subcontracting.",
      acceptableFallback: "Subcontracting permitted on notification. We remain liable for subcontractor performance. Named approved subcontractors list maintained.",
      hardRedLine: "Prior written approval required for every subcontract engagement. Approval cannot be unreasonably withheld but creates operational bottleneck.",
    },
    LOG_DATA_GDPR: {
      preferredPosition: "Controller/processor split clearly defined. DPA in place. Shipment data, customer data, and driver data obligations clearly allocated. Cross-border transfer mechanisms in place.",
      acceptableFallback: "DPA in place with standard processing obligations. Data sharing with customs authorities covered by legitimate interest or legal obligation basis.",
      hardRedLine: "No DPA where personal data is being processed. Ambiguous data ownership for tracking data or driver data.",
    },
    LOG_GOVERNING_LAW: {
      preferredPosition: "English law governing the contract. English courts have exclusive jurisdiction. Consistent with our standard trading conditions.",
      acceptableFallback: "English law with non-exclusive jurisdiction or agreed arbitration. Jurisdiction reflects major operational territory.",
      hardRedLine: "Foreign jurisdiction with no local legal resource. Governing law clause that would determine outcome of a major cargo claim in an unfamiliar court.",
    },
    LOG_TERMINATION: {
      preferredPosition: "Either party may terminate on 90 days written notice. No transition obligations beyond standard handover. Exit at any time on convenience without penalty.",
      acceptableFallback: "120-day convenience termination. Standard data return and handover obligations. No punitive exit costs.",
      hardRedLine: "Lock-in beyond 12 months with punitive exit costs. Transition obligations that create open-ended liability on exit.",
    },
    LOG_TRADE_COMPLIANCE: {
      preferredPosition: "Each party responsible for their own trade compliance and sanctions screening. Customer warrants cargo does not breach sanctions. Immediate suspension right if sanctions risk identified.",
      acceptableFallback: "Shared trade compliance obligations. Mutual notification of any sanctions exposure. Suspension right on reasonable grounds.",
      hardRedLine: "We are required to take on the customer's sanctions screening and export control compliance obligations without corresponding indemnity.",
    },
    LOG_AUDIT_REPORTING: {
      preferredPosition: "Annual audit right on 30 days written notice. Reporting obligations limited to agreed KPI metrics. Audit costs borne by auditing party unless material breach found.",
      acceptableFallback: "Audit on 15 days notice, once per year. Standard operational reporting. Reasonable audit costs.",
      hardRedLine: "Continuous access right or real-time reporting obligations without a data security framework. Audit costs borne by us regardless of outcome.",
    },
    // ── Logistics contract - extended ────────────────────────────────────────
    LOG_CARRIER_PAYMENT: {
      preferredPosition: "Payment within 45 days. Fuel surcharges based on market rates with quarterly review.",
      acceptableFallback: "60-day payment acceptable where carrier provides credit. Surcharges reviewed quarterly.",
      hardRedLine: "No fuel surcharge mechanism or uncapped surcharges.",
    },
    LOG_DANGEROUS_GOODS: {
      preferredPosition: "ADR compliance where applicable. Carrier warrants compliance with relevant dangerous goods regulations.",
      acceptableFallback: "Reasonable compliance with dangerous goods regulations. Incident notification promptly.",
      hardRedLine: "No dangerous goods compliance warranty.",
    },
    LOG_CUSTOMS_CLEARANCE: {
      preferredPosition: "Customs cleared per Incoterms. Reasonable cooperation between parties on documentation.",
      acceptableFallback: "Carrier arranges clearance where agreed. Shipper liability for incorrect data.",
      hardRedLine: "No customs documentation obligations.",
    },
    LOG_PACKAGING_LABELING: {
      preferredPosition: "Packaging to applicable standards. Shipper responsible for compliance. Carrier not liable for damage arising from inadequate packaging.",
      acceptableFallback: "Shipper warrants adequate packaging. Carrier's liability excluded for packaging failures.",
      hardRedLine: "Carrier liable for damage regardless of packaging condition.",
    },
    LOG_COLD_CHAIN: {
      preferredPosition: "Temperature-controlled transport where specified. Data provided on delivery. Liability limited to agreed temperature excursion.",
      acceptableFallback: "Reasonable temperature maintenance. Records on request.",
      hardRedLine: "No cold chain obligation or records.",
    },
    LOG_TRACK_TRACE: {
      preferredPosition: "Tracking available where carrier systems permit. Status updates on request.",
      acceptableFallback: "Best efforts tracking. Customer notified of material delays.",
      hardRedLine: "No visibility into shipment status.",
    },
    LOG_FORCE_MAJEURE: {
      preferredPosition: "Force majeure for events genuinely beyond carrier's control. Reasonable notice. Good faith efforts to mitigate.",
      acceptableFallback: "Carrier notifies and mitigates. Customer may seek alternative routing after reasonable period.",
      hardRedLine: "Force majeure excusing foreseeable capacity or commercial issues.",
    },
    LOG_INSURANCE_CERT: {
      preferredPosition: "Carrier maintains adequate insurance for cargo carried. Certificate available on request.",
      acceptableFallback: "Insurance evidence on reasonable request. Minimum CMR limits.",
      hardRedLine: "No insurance obligation on carrier.",
    },
    LOG_INTERNATIONAL_CONVENTIONS: {
      preferredPosition: "Applicable convention applies to each mode of transport. Liability in accordance with convention limits unless special declaration agreed.",
      acceptableFallback: "Convention limits apply. Higher value cargo specially declared at additional premium.",
      hardRedLine: "Convention liability excluded.",
    },
    LOG_DRIVER_COMPLIANCE: {
      preferredPosition: "Carrier warrants all drivers are legally compliant. Records available on reasonable request.",
      acceptableFallback: "Carrier maintains driver records. Compliance certificate on annual request.",
      hardRedLine: "No driver compliance warranty.",
    },
    // ── Technology & SaaS clauses ────────────────────────────────────────────
    TECH_API_TERMS: {
      preferredPosition: "API access governed by documented SLA. Rate limits disclosed upfront and not unilaterally reduced during term. Versioning policy guarantees minimum 12-month deprecation notice. Breaking changes require 6-month advance notice. We retain right to access our data via API for full term plus 90-day extraction period post-termination.",
      acceptableFallback: "API access on published terms. 6-month deprecation notice. Data extraction rights on termination for 60 days.",
      hardRedLine: "No guaranteed API availability, no deprecation notice, or no data extraction right on termination.",
    },
    TECH_UPTIME_SLA: {
      preferredPosition: "99.9% monthly uptime (excluding scheduled maintenance). Scheduled maintenance windows in non-peak hours with 48-hour notice. Service credits of 10% monthly fee per 0.1% below SLA, capped at 30% monthly fee. Persistent breach (3 consecutive months below SLA) triggers termination right without penalty.",
      acceptableFallback: "99.5% uptime. Service credits as sole remedy for SLA breach. Termination right after 6 months of persistent underperformance.",
      hardRedLine: "No uptime SLA, no service credits, or credits that cap all liability for downtime causing material business disruption.",
    },
    TECH_DATA_PORTABILITY: {
      preferredPosition: "Full data export in machine-readable format (CSV, JSON, or API) at any time during the term and for 90 days post-termination at no additional charge. Supplier must not degrade data quality or completeness on export. Deletion certification provided on request after extraction period.",
      acceptableFallback: "Data export in standard format available on request with 10 business days' notice. 60-day post-termination extraction period.",
      hardRedLine: "No data export right, export in proprietary non-portable format only, or export charged at rates that make it economically prohibitive.",
    },
    TECH_OPEN_SOURCE: {
      preferredPosition: "Supplier discloses all open source components used in the service. No copyleft (GPL/AGPL) components that could affect our IP in deliverables. SBOM (Software Bill of Materials) provided on request. CVE notifications within 24 hours for critical vulnerabilities in disclosed components.",
      acceptableFallback: "Open source disclosure on request. No GPL-licensed components in deliverables. CVE notification for critical vulnerabilities within 5 business days.",
      hardRedLine: "No open source disclosure obligation where deliverables may incorporate copyleft-licensed components affecting our IP.",
    },
    TECH_SECURITY_STANDARDS: {
      preferredPosition: "Supplier holds current ISO 27001 certification or SOC 2 Type II attestation. Annual penetration testing by approved third party. Security patches applied within 72 hours of critical CVE disclosure. Security incident notification within 4 hours of confirmed breach.",
      acceptableFallback: "ISO 27001 or SOC 2 Type II. Annual pen testing. Critical patches within 5 business days. Security incident notification within 24 hours.",
      hardRedLine: "No security certification, no pen testing obligation, or incident notification period exceeding 72 hours for critical breaches.",
    },
    TECH_CHANGE_MANAGEMENT: {
      preferredPosition: "All material changes to the service (new features affecting existing workflows, UI changes, deprecations) communicated 30 days in advance. Release notes provided. Backward compatibility maintained for minimum 12 months on APIs and data schemas. Emergency hotfixes documented and notified within 24 hours.",
      acceptableFallback: "Material changes notified with 14 days' advance notice. API backward compatibility for 6 months minimum.",
      hardRedLine: "No advance change notice; or supplier may make breaking changes to APIs or data schemas without notice.",
    },
    // ── Financial Services clauses ───────────────────────────────────────────
    FIN_REGULATORY_PERMISSIONS: {
      preferredPosition: "Counterparty warrants it holds all required FCA/PRA authorisations for the regulated activities performed under this agreement. Obligation to notify us within 24 hours of any restriction, variation, or withdrawal of permissions. Immediate suspension right if permissions lapse. Contract voids automatically if counterparty loses required permissions.",
      acceptableFallback: "Permissions warranty. Notification of material regulatory action within 5 business days. Termination right on permissions lapse.",
      hardRedLine: "No regulatory permissions warranty where counterparty performs regulated activities; or no notification obligation on permissions change.",
    },
    FIN_CLIENT_MONEY: {
      preferredPosition: "Client money held in segregated accounts in accordance with FCA CASS rules. Statutory trust acknowledged in contract. Daily reconciliation. Immediate notification of any CASS breach. We are named as beneficiary on segregated accounts.",
      acceptableFallback: "CASS-compliant segregation. Reconciliation within 2 business days. Notification of breaches within 24 hours.",
      hardRedLine: "No CASS segregation commitment for contracts involving client money; or commingling of client and firm money.",
    },
    FIN_BEST_EXECUTION: {
      preferredPosition: "Best execution policy maintained and applied to all orders. Policy reviewed annually and on material change in market structure. Order execution data available on request. Top 5 execution venues disclosed as required by MiFID II/UK MiFIR.",
      acceptableFallback: "Best execution policy maintained. Annual review. Execution data on request.",
      hardRedLine: "No best execution obligation where MiFID II/UK MiFIR applies to the services.",
    },
    FIN_FINANCIAL_PROMOTION: {
      preferredPosition: "All financial promotions produced by or on behalf of us are approved by an FCA-authorised person before communication. Supplier warrants that any content it produces under this agreement complies with COBS 4 and relevant FCA guidance. Liability for unapproved financial promotions remains with the communicating party.",
      acceptableFallback: "Financial promotions approval process agreed. Compliance with applicable FCA financial promotion rules warranted.",
      hardRedLine: "No financial promotion compliance framework for contracts involving consumer-facing regulated content.",
    },
    FIN_MARGIN_COLLATERAL: {
      preferredPosition: "Credit support documentation (CSA or equivalent) executed alongside master agreement. Collateral threshold and minimum transfer amounts agreed. Eligible collateral specified. Dispute resolution for margin calls within 1 business day. Close-out netting enforceability confirmed in applicable jurisdictions.",
      acceptableFallback: "Margin and collateral terms documented. Close-out netting provisions included. Dispute process agreed.",
      hardRedLine: "No credit support documentation for derivative or leveraged transactions; or close-out netting not contractually confirmed.",
    },
    FIN_BENCHMARK_RATES: {
      preferredPosition: "All reference rates use current SONIA/SOFR (or applicable ARR) with agreed credit adjustment spread. Legacy LIBOR references replaced. Fallback provisions compliant with ISDA 2020 IBOR Fallbacks Protocol. Rate screen page, fallback hierarchy, and interpolation methodology specified in the contract.",
      acceptableFallback: "Current ARR-based rates used. ISDA-compliant fallback provisions. Fallback hierarchy specified.",
      hardRedLine: "Reference to discontinued benchmark rates with no fallback provision; or fallback mechanism creates unilateral rate-setting by one party.",
    },
    // ── Healthcare & Life Sciences clauses ───────────────────────────────────
    HEALTH_PATIENT_DATA: {
      preferredPosition: "Patient data processed only under explicit consent or Schedule 3 DPA 2018 condition. Separate Data Security and Protection Toolkit (DSPT) compliance warranted. NHS data security standards applied. No patient data shared with third parties without individual consent. Data flows documented and DPIA completed.",
      acceptableFallback: "Patient data processing under lawful basis with DSPT compliance. DPIA completed. Third-party sharing restricted.",
      hardRedLine: "Patient data processed without lawful basis; or no DSPT compliance obligation for contracts involving NHS patient data.",
    },
    HEALTH_REGULATORY_APPROVAL: {
      preferredPosition: "Supplier warrants that all products and services covered by this agreement hold required MHRA, CE, or UKCA certification for their intended use. Obligation to notify us within 48 hours of any regulatory action (safety alert, recall, CE certificate withdrawal). Our use of the product does not constitute off-label use without our prior written consent.",
      acceptableFallback: "Regulatory approvals warranted. Notification of safety alerts and recalls within 5 business days.",
      hardRedLine: "No regulatory approval warranty for medical devices or in-vitro diagnostics; or no obligation to notify of safety alerts or recalls.",
    },
    HEALTH_PHARMACOVIGILANCE: {
      preferredPosition: "Safety data exchange agreement (SDEA) executed alongside commercial agreement. Adverse event reports exchanged within required regulatory timeframes (15 calendar days for serious unexpected, 7 days for fatal/life-threatening). Each party maintains pharmacovigilance system to ICH E2E standard. Regulatory authority reportable events notified immediately.",
      acceptableFallback: "SDEA executed. Adverse event reporting within required timeframes. Regulatory notification obligations allocated.",
      hardRedLine: "No SDEA for agreements involving pharmacovigilance obligations; or adverse event reporting timelines that do not meet regulatory requirements.",
    },
    HEALTH_CLINICAL_PROTOCOL: {
      preferredPosition: "Protocol deviations require sponsor approval. Material amendments require regulatory authority and ethics committee re-approval before implementation. Protocol holds triggered by safety signal implemented within 24 hours. We retain right to audit site compliance with protocol.",
      acceptableFallback: "Material protocol amendments subject to approval process. Safety holds implemented promptly. Audit rights retained.",
      hardRedLine: "Unilateral protocol amendments by site without sponsor notification; or no mechanism for immediate safety hold.",
    },
    HEALTH_NHS_TERMS: {
      preferredPosition: "NHS Standard Contract (or equivalent NHS England terms) incorporated by reference where required. Data processing under Data Security and Protection Toolkit obligations. NHS Protect anti-fraud obligations warranted. NHS branding and identity guidelines complied with.",
      acceptableFallback: "NHS contract requirements complied with. DSPT and data security obligations met.",
      hardRedLine: "Non-compliance with NHS Standard Contract mandatory provisions; or failure to incorporate required NHS data security terms.",
    },
    HEALTH_PRODUCT_LIABILITY: {
      preferredPosition: "Supplier maintains product liability insurance of minimum £10M per occurrence. Recall costs indemnified by supplier for defects attributable to supplier. We retain termination right without liability on any MHRA safety alert or recall affecting the product. Strict liability for product defects under CPA 1987 acknowledged.",
      acceptableFallback: "Product liability insurance £5M+. Recall cost indemnity for supplier-caused defects. Termination right on safety alert.",
      hardRedLine: "No product liability insurance requirement; or exclusion of strict liability for medical device defects.",
    },
    // ── Manufacturing & Supply Chain clauses ─────────────────────────────────
    MFG_INCOTERMS: {
      preferredPosition: "Delivery terms specify Incoterms 2020 rule, named place or port, and whether CIF/CIP insurance obligation uses Institute Cargo Clauses (A). Risk transfers at named point. Export licences and customs clearance responsibilities clearly allocated. Delivery documentation (commercial invoice, packing list, bill of lading or CMR) specified.",
      acceptableFallback: "Incoterms 2020 specified with named place. Export and import responsibilities allocated. Required documentation listed.",
      hardRedLine: "No Incoterms reference with ambiguous risk transfer; or delivery terms that leave export licensing obligations unallocated.",
    },
    MFG_QUALITY_STANDARDS: {
      preferredPosition: "Products must meet ISO 9001 (or industry-equivalent: GMP, IATF 16949, AS9100) requirements. Certificate of Conformance provided with each delivery. We have right of inspection and rejection at delivery. Non-conforming goods returned at supplier's cost. CAPA (Corrective and Preventive Action) required for recurring defects.",
      acceptableFallback: "Applicable quality standard compliance warranted. Certificate of Conformance on request. Inspection and rejection rights retained. CAPA process for recurring issues.",
      hardRedLine: "No quality standard compliance obligation; or no right to inspect and reject non-conforming goods.",
    },
    MFG_PRODUCT_LIABILITY: {
      preferredPosition: "Supplier indemnifies against all third-party product liability claims arising from defects in supplier-manufactured components. Product liability insurance minimum £5M per occurrence. Immediate notification and cooperation on product liability claims. Recall costs indemnified by the party whose defect caused the recall.",
      acceptableFallback: "Product liability indemnity for defective components. Insurance £2M+. Notification and cooperation on claims.",
      hardRedLine: "No product liability indemnity for supplier components; or exclusion of liability for defects in goods supplied.",
    },
    MFG_TOOLING_OWNERSHIP: {
      preferredPosition: "All tooling, moulds, jigs, and fixtures paid for by us vest in us on creation. Tooling held by supplier is clearly identified as our property. Supplier maintains tooling at their cost. Tooling returned on demand within 30 days. No lien on our tooling for unpaid invoices.",
      acceptableFallback: "Tooling paid for by us is our property. Identification and maintenance obligations. Return on 60 days' notice. No lien.",
      hardRedLine: "Supplier claims ownership of tooling we paid for; or right to hold our tooling as security for unpaid invoices.",
    },
    MFG_SUPPLY_CHAIN_RESILIENCE: {
      preferredPosition: "Supplier maintains minimum 8-week buffer stock for critical components. Alternative approved sources identified for sole-sourced materials. Business continuity plan maintained and tested annually. Immediate notification of any supply risk affecting our orders. Priority supply rights in shortage situations.",
      acceptableFallback: "Buffer stock for critical items. BCP maintained. Supply risk notification within 48 hours. Reasonable priority allocation in shortage.",
      hardRedLine: "No buffer stock obligation for critical components; no BCP; or supplier has no obligation to prioritise our supply in shortage.",
    },
    // ── Retail & eCommerce clauses ───────────────────────────────────────────
    RET_DISTANCE_SELLING: {
      preferredPosition: "All distance selling obligations under Consumer Rights Act 2015 and Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 complied with. 14-day cooling-off right clearly communicated. Pre-contract information provided in durable medium. Return shipping costs borne by supplier for defective goods.",
      acceptableFallback: "Distance selling regulations compliance warranted. Cooling-off rights clearly stated. Pre-contract information obligations met.",
      hardRedLine: "No cooling-off right for distance-sold contracts; or attempt to contractually limit statutory consumer rights.",
    },
    RET_CONSUMER_RETURNS: {
      preferredPosition: "30-day returns policy for change of mind (exceeding statutory minimum). Defective goods returned at our cost within 24 months. Refund processed within 5 business days of return receipt. Exchange or refund at consumer's option for defective items. No restocking fees.",
      acceptableFallback: "Statutory returns rights complied with. Defective goods policy clearly stated. Refund within 14 days of return.",
      hardRedLine: "Returns policy that restricts statutory rights; or refund timeframes that exceed statutory maximums.",
    },
    RET_MARKETPLACE_TERMS: {
      preferredPosition: "Platform seller terms fixed for minimum 12 months. Fee changes notified 90 days in advance with right to delist. Commission and fee structure transparent. Platform may not use our sales data to compete against us. Dispute resolution process for order issues available with 48-hour response.",
      acceptableFallback: "Seller terms with 60-day change notice. Transparent fee structure. Sales data not used against us. Dispute process available.",
      hardRedLine: "Platform may change fees with less than 30 days' notice; or use our seller data to develop competing products.",
    },
    RET_AGE_VERIFICATION: {
      preferredPosition: "Age verification system compliant with applicable law and Ofcom/BBFC guidance for age-restricted products. Verification records retained in compliance with data protection law. We accept no liability for third-party age verification system failures if we have complied with contractual specifications.",
      acceptableFallback: "Age verification compliant with applicable requirements. Liability for failure allocated to the party responsible for the verification system.",
      hardRedLine: "No age verification obligation for age-restricted products; or we bear sole liability for failures in a third-party age verification system.",
    },
    RET_CONSUMER_CREDIT: {
      preferredPosition: "BNPL and consumer credit products comply with Consumer Credit Act 1974 and FCA CONC rules. Clear disclosure of total cost of credit, APR, and repayment terms. FCA authorisation verified for credit broking or lending. No incentivised sales of unsuitable credit products.",
      acceptableFallback: "Consumer credit compliance warranted. FCA authorisation confirmed. Transparent credit terms.",
      hardRedLine: "Consumer credit products offered without FCA authorisation; or credit terms that do not comply with Consumer Credit Act disclosure requirements.",
    },
    // ── Media & Entertainment clauses ────────────────────────────────────────
    MEDIA_RIGHTS_CLEARANCE: {
      preferredPosition: "Supplier warrants full chain of title and all necessary rights clearances for all materials delivered. Underlying rights (music, archive footage, literary rights, personality rights, synchronisation) fully cleared for the specified media, territories, and term. E&O insurance minimum £1M per occurrence. Indemnity for third-party IP claims arising from defective title.",
      acceptableFallback: "Chain of title warranty. E&O insurance. Indemnity for IP claims from undisclosed underlying rights encumbrances.",
      hardRedLine: "No chain of title warranty; or delivery of materials without confirmation that underlying rights are cleared for our intended use.",
    },
    MEDIA_RESIDUALS_ROYALTIES: {
      preferredPosition: "All residual obligations to guilds, unions, and collecting societies fully disclosed and allocated. Royalty accounting statements provided quarterly within 30 days of quarter end. Audit right on royalty calculations on 15 days' notice annually. No cross-collateralisation across separate titles or projects without consent.",
      acceptableFallback: "Residual obligations disclosed and allocated. Semi-annual royalty accounting. Audit right annually.",
      hardRedLine: "Undisclosed residual obligations falling on us; or cross-collateralisation of royalties across projects without consent.",
    },
    MEDIA_TALENT_OBLIGATIONS: {
      preferredPosition: "All talent agreements (on-screen, voice, music performance) fully executed before production commences. Talent clearances cover all intended media, territories, and term. Likeness rights and approval rights clearly defined. Re-use fees and residuals pre-agreed. No talent approval rights that could prevent delivery.",
      acceptableFallback: "Talent agreements in place before production. Clearances for primary media and territory. Re-use fee schedule agreed.",
      hardRedLine: "Talent not contracted before production; or talent approval rights that give veto over editorial decisions without compensation.",
    },
    MEDIA_FORMAT_RIGHTS: {
      preferredPosition: "Format rights, adaptation rights, and sequel/prequel rights clearly defined and allocated. Option periods and exercise prices specified. All languages and territories covered for primary distribution. Underlying literary or IP rights licensed for all intended adaptations. Moral rights waivers obtained where applicable.",
      acceptableFallback: "Format and adaptation rights documented. Option terms and exercise prices clear. Primary territories and languages covered.",
      hardRedLine: "Format rights that include unexpected sequel or franchise obligations we did not agree to; or adaptation rights that infringe underlying IP we cannot clear.",
    },
    MEDIA_SYNC_LICENSE: {
      preferredPosition: "Synchronisation licence covers all intended uses: linear, on-demand, streaming, social, theatrical, and promotional. Territory, term, and media clearly specified. Master and publisher licences both obtained. No most-favoured-nation obligations that trigger additional payments without notice. Festival use covered.",
      acceptableFallback: "Sync licence covers primary distribution media and territory. Both master and sync rights cleared. MFN obligations disclosed.",
      hardRedLine: "Sync licence that does not cover all distribution platforms we use; or undisclosed MFN obligations that create unexpected payment obligations.",
    },
    // ── Energy & CleanTech clauses ───────────────────────────────────────────
    ENERGY_OFFTAKE: {
      preferredPosition: "Offtake volume, price, and indexation mechanism agreed for the full contract term. Curtailment rights clearly defined with compensation mechanism. Balancing responsibility allocated. Floor price protection included. Change in law provisions covering subsidy regime changes. Bankable contract terms accepted by project finance lenders.",
      acceptableFallback: "Offtake terms agreed. Curtailment with compensation. Balancing allocation clear. Change in law provisions included.",
      hardRedLine: "No curtailment compensation; or change in law provisions that place subsidy regime risk entirely on the generator without price adjustment.",
    },
    ENERGY_GRID_CONNECTION: {
      preferredPosition: "Grid connection agreement with DNO/TO in place or conditions precedent to this contract. Connection capacity confirmed in writing. Rights of way and land access secured. Metering obligations and data access rights specified. Reinforcement cost allocation agreed.",
      acceptableFallback: "Grid connection terms agreed or conditions precedent documented. Metering and data access specified.",
      hardRedLine: "No confirmed grid connection capacity before financial close; or reinforcement costs that are uncapped and fall on us without contractual ceiling.",
    },
    ENERGY_SUBSIDY_REGIME: {
      preferredPosition: "Applicable subsidy (CfD, ROC, FIT, REGO, BM) registration conditions confirmed. Compliance with scheme rules warranted. Change in scheme rules triggers renegotiation mechanism. Revenue waterfall clearly specifies subsidy payment priority. Clawback risk allocated.",
      acceptableFallback: "Subsidy eligibility confirmed. Scheme rule compliance warranted. Change in law renegotiation mechanism included.",
      hardRedLine: "Subsidy eligibility not confirmed; or change in subsidy scheme risk allocated entirely to us without pricing adjustment mechanism.",
    },
    ENERGY_ENVIRONMENTAL_PERMITS: {
      preferredPosition: "All required environmental permits (Environmental Permit, planning consent, EIA, habitat survey) obtained or conditions precedent to financial close. Ongoing permit compliance warranted. We are notified within 48 hours of any permit breach or enforcement action. Decommissioning and remediation obligations clearly allocated.",
      acceptableFallback: "Required permits in place or conditions precedent. Permit compliance warranted. Notification of enforcement within 5 days. Decommissioning obligations allocated.",
      hardRedLine: "Financial close before required environmental permits obtained; or decommissioning liability unallocated.",
    },
    ENERGY_BALANCING_IMBALANCE: {
      preferredPosition: "Balancing and imbalance risk clearly allocated between parties. Gate closure notification obligations specified. Imbalance settlement charges allocated to the party responsible for the imbalance. Forecasting obligations and accuracy requirements defined.",
      acceptableFallback: "Balancing responsibility allocated. Gate closure obligations specified. Imbalance charges follow allocation of balancing responsibility.",
      hardRedLine: "Imbalance risk allocated to us for generation dispatch decisions we do not control.",
    },
    // ── Education & EdTech clauses ───────────────────────────────────────────
    EDU_SAFEGUARDING: {
      preferredPosition: "All personnel with access to children or vulnerable adults hold enhanced DBS clearance updated within 3 years. Safeguarding policy compliant with Keeping Children Safe in Education 2024 and Working Together 2023. Designated Safeguarding Lead identified. Obligation to report safeguarding concerns immediately and cooperate with statutory investigations.",
      acceptableFallback: "Enhanced DBS clearance for all relevant personnel. Safeguarding policy maintained and shared. Reporting obligations accepted.",
      hardRedLine: "No DBS clearance requirement for personnel with unsupervised child access; or no safeguarding policy.",
    },
    EDU_STUDENT_DATA: {
      preferredPosition: "Student personal data processed only for agreed educational purposes. Parental or guardian consent obtained for under-13 data processing. No student data used for advertising or profiling. Data minimisation applied. FERPA (US) or UK GDPR compliance warranted. Student records returned on contract termination.",
      acceptableFallback: "Student data processing limited to educational purposes. Parental consent for under-13s. No profiling or advertising use. Records returned on termination.",
      hardRedLine: "Student data used for commercial profiling; or no parental consent mechanism for children's data.",
    },
    EDU_CURRICULUM_RIGHTS: {
      preferredPosition: "All curriculum content and course materials developed under this agreement vest in us on creation. Supplier retains pre-existing IP with broad licence. We may adapt, update, and republish content without restriction. No lock-in to supplier's LMS or content platform after contract ends. SCORM/xAPI compliance required for interoperability.",
      acceptableFallback: "Curriculum content IP vests in us. Supplier background IP licensed perpetually. Platform interoperability (SCORM/xAPI) required.",
      hardRedLine: "Supplier owns curriculum content we commissioned and paid for; or content locked into proprietary format preventing use on other platforms.",
    },
    EDU_ACCREDITATION: {
      preferredPosition: "Accreditation body approval obtained before programme launch. Awarding body agreement executed and in force. Qualification specifications and assessment requirements complied with. We are notified within 24 hours of any accreditation risk or compliance concern. No material programme changes without awarding body approval.",
      acceptableFallback: "Accreditation in place. Qualification compliance warranted. Notification of accreditation issues within 5 days.",
      hardRedLine: "Programme launched before accreditation obtained; or material programme changes without awarding body approval risking students' qualifications.",
    },
    // ── Professional Services clauses ────────────────────────────────────────
    PS_ENGAGEMENT_SCOPE: {
      preferredPosition: "Scope of services defined in a detailed Statement of Work. Change request process agreed: written change order required; no additional charges without signed change order. Out-of-scope activities expressly identified. Scope creep not billable without our prior written approval.",
      acceptableFallback: "Scope documented. Written change orders required for additional work. Out-of-scope items identified.",
      hardRedLine: "Vague scope definition with no change control process; or supplier may expand scope and charge for it without our approval.",
    },
    PS_FEE_BILLING: {
      preferredPosition: "Fixed fees or agreed hourly rates for the engagement term. Rate card locked for minimum 12 months. Expenses pre-approved and capped at cost only (no mark-up). Invoices itemised by task and time recorded. Payment within 30 days. No success fees or contingency arrangements without separate written agreement.",
      acceptableFallback: "Agreed rates fixed for the term. Expenses at cost with pre-approval. Itemised invoices. 30-day payment.",
      hardRedLine: "Unilateral rate increases during engagement; or expense mark-up without disclosure; or invoices without sufficient detail to verify.",
    },
    PS_CONFLICTS_INTEREST: {
      preferredPosition: "Supplier confirms no actual or potential conflict of interest at engagement commencement and warrants to notify us immediately of any conflict arising during the engagement. Conflicts policy shared on request. We have right to terminate if conflict is not resolved to our satisfaction. No concurrent engagements with direct competitors without our consent.",
      acceptableFallback: "Conflict disclosure at engagement commencement. Ongoing notification obligation. Termination right for unresolvable conflicts.",
      hardRedLine: "No conflict of interest disclosure; or supplier may simultaneously advise direct competitors on related matters without consent.",
    },
    PS_PROFESSIONAL_LIABILITY: {
      preferredPosition: "Supplier maintains professional indemnity insurance appropriate to the risk of the engagement: minimum £2M per claim for regulated professional services. PI policy maintained for minimum 6 years post-engagement (run-off cover). Certificate of insurance provided annually on request. No exclusion of liability for professional negligence causing financial loss.",
      acceptableFallback: "PI insurance minimum £1M per claim. Run-off cover confirmed. Certificate on request. No exclusion of professional negligence liability.",
      hardRedLine: "No PI insurance for regulated professional services; or exclusion of liability for professional negligence.",
    },
  },
};

export interface LitigationIntakeData {
  id: string;
  documentId: string;
  stage: number;
  hardStopData: string; // JSON
  defenceData: string;  // JSON
  fraudFlag: boolean;
  fcaBreach: boolean;
  vulnerableCustomer: boolean;
  hardStopPassed: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Client-only flag sent to trigger completedAt on the server
  complete?: boolean;
}

export interface AncillaryDocumentData {
  id: string;
  documentId: string;
  originalName: string;
  filename: string;
  fileType: string;
  privilegeFlag: boolean;
  transcription?: string;
  transcriptionConfirmed: boolean;
  uploadedAt: string;
}
