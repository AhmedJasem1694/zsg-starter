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
  | "AUDIT_RIGHTS";

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
};

export interface Company {
  id: string;
  name: string;
  sector: string;
  jurisdiction: string;
  role: CompanyRole;
  riskAppetite: RiskAppetite;
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
  },
};
