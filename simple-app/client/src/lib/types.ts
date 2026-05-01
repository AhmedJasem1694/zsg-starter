export type RiskAppetite = "CONSERVATIVE" | "MODERATE" | "COMMERCIAL";
export type CompanyRole = "BUYER" | "SUPPLIER" | "BOTH";
export type ApprovalRole = "LEGAL" | "GC" | "CFO" | "BOARD";
export type RagStatus = "RED" | "AMBER" | "GREEN" | "GREY";
export type DocumentStatus = "UPLOADED" | "PROCESSING" | "COMPLETE" | "FAILED";
export type FeedbackAction = "ACCEPTED" | "EDITED" | "ESCALATED" | "DISMISSED";

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
  | "REDEMPTION_RIGHTS";

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

// Investment document clause types (shown for FOUNDER / PE_FUND personas)
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

// Persona - determines onboarding flow and MIKE output framing
export type Persona = "CORPORATE" | "FOUNDER" | "PE_FUND";

export const PERSONA_LABELS: Record<Persona, string> = {
  CORPORATE: "In-house / Corporate",
  FOUNDER:   "Founder / Startup",
  PE_FUND:   "PE / M&A Fund",
};

export const PERSONA_DESCRIPTIONS: Record<Persona, string> = {
  CORPORATE: "Review counterparty paper against your playbook. Flag deviations, produce fallback language, route escalations.",
  FOUNDER:   "All commercial contracts plus investment documents - term sheets, SHA, liquidation preferences. Plain-English output for sophisticated non-lawyers.",
  PE_FUND:   "Legal and regulatory DD on target companies. Portfolio risk analysis. Anticipated legislative changes mapped to your fund's risk appetite.",
};

export type Industry =
  | "TECHNOLOGY_SAAS"
  | "FINANCIAL_SERVICES"
  | "HEALTHCARE_LIFESCIENCES"
  | "GAMING_INTERACTIVE"
  | "PROPERTY_REAL_ESTATE"
  | "PROFESSIONAL_SERVICES"
  | "MANUFACTURING_SUPPLY"
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
  uploadedAt: string;
  reviewResults?: ReviewResult[];
}

export interface ReviewResult {
  id: string;
  documentId: string;
  clauseId?: string;
  ruleId?: string;
  clauseCategory: ClauseCategory;
  ragStatus: RagStatus;
  clauseSummary: string;
  whyItMatters: string;
  recommendedAction: string;
  suggestedFallback: string;
  escalationRequired: boolean;
  escalationTrigger?: string;
  businessSummary: string;
  confidence: number;
  isAbsent: boolean;
  createdAt: string;
  feedback?: UserFeedback;
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
  editedOutput?: string;
  finalClauseText?: string;
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
  },
};
