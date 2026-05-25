/**
 * Compact market-standard playbook positions used when a document is reviewed
 * before the user completes full onboarding. Risk appetite defaults to MODERATE.
 * These cover the core commercial clauses that appear in most contracts.
 */

export interface PlaybookEntry {
  clauseCategory: string;
  preferredPosition: string;
  acceptableFallback: string;
  hardRedLine: string;
  riskWeight: number;
}

/** Core commercial clauses only — enough to give a meaningful first review. */
export const MARKET_STANDARD_PLAYBOOK: PlaybookEntry[] = [
  {
    clauseCategory: "LIABILITY_CAP",
    preferredPosition: "Aggregate liability capped at 12 months' fees paid. Fraud, death/personal injury, confidentiality breach, data breach, and IP infringement excluded from cap.",
    acceptableFallback: "Cap at 6 months' fees, provided confidentiality and data breach are carved out and uncapped.",
    hardRedLine: "Cap below 3 months' fees, or cap covers data breach/confidentiality without carve-outs.",
    riskWeight: 5,
  },
  {
    clauseCategory: "INDEMNITY",
    preferredPosition: "Mutual indemnity for third-party claims arising from each party's breach, negligence, or IP infringement.",
    acceptableFallback: "Counterparty indemnifies us for IP infringement and data breaches; our indemnity limited to misuse of their IP.",
    hardRedLine: "Unilateral unlimited indemnity with no cap or carve-out.",
    riskWeight: 5,
  },
  {
    clauseCategory: "IP_OWNERSHIP",
    preferredPosition: "All bespoke deliverables vest in us on creation. Counterparty retains background IP and grants us perpetual licence.",
    acceptableFallback: "Counterparty owns deliverables but grants us exclusive, perpetual, royalty-free licence.",
    hardRedLine: "Counterparty retains all IP with no licence back, or licence is revocable.",
    riskWeight: 4,
  },
  {
    clauseCategory: "CONFIDENTIALITY",
    preferredPosition: "Mutual, 3-year post-termination obligation covering all non-public information. No residuals carve-out.",
    acceptableFallback: "Mutual, 2-year post-termination. Residuals carve-out limited to non-patentable general know-how.",
    hardRedLine: "Confidentiality obligation shorter than 1 year post-termination, or no obligation at all.",
    riskWeight: 4,
  },
  {
    clauseCategory: "DATA_PRIVACY",
    preferredPosition: "Full DPA aligned with UK GDPR. Counterparty acts as processor; we are controller. Audit right included.",
    acceptableFallback: "DPA in place. Audit on 10 business days' notice, once per year.",
    hardRedLine: "No DPA where personal data is processed, or counterparty claims controller status over our data.",
    riskWeight: 5,
  },
  {
    clauseCategory: "TERMINATION",
    preferredPosition: "Either party may terminate for convenience on 30 days' notice. Immediate termination for material uncured breach (14-day cure period).",
    acceptableFallback: "60-day convenience termination; immediate for uncured breach.",
    hardRedLine: "No right to terminate for convenience; or cure period exceeding 45 days.",
    riskWeight: 4,
  },
  {
    clauseCategory: "PAYMENT_TERMS",
    preferredPosition: "Payment within 30 days of valid invoice. Late payment interest at Bank of England base + 4%. No automatic price escalation.",
    acceptableFallback: "Payment within 45 days. Annual price increases capped at CPI.",
    hardRedLine: "Payment terms shorter than 14 days; uncapped annual price increases; or set-off rights not addressed.",
    riskWeight: 3,
  },
  {
    clauseCategory: "AUTO_RENEWAL",
    preferredPosition: "No auto-renewal. Contract expires on end date unless renewed in writing.",
    acceptableFallback: "Auto-renewal with minimum 60 days' written notice before the renewal date.",
    hardRedLine: "Auto-renewal with less than 30 days' notice, or auto-renewal of multi-year terms.",
    riskWeight: 3,
  },
  {
    clauseCategory: "GOVERNING_LAW",
    preferredPosition: "English law. Exclusive jurisdiction of English courts.",
    acceptableFallback: "English law with non-exclusive jurisdiction, or agreed LCIA/ICC arbitration.",
    hardRedLine: "Foreign law in an unfamiliar jurisdiction with no arbitration option.",
    riskWeight: 3,
  },
  {
    clauseCategory: "FORCE_MAJEURE",
    preferredPosition: "Narrow force majeure for truly unforeseeable events. Excludes economic hardship. 30-day notice; 90-day long-stop triggers termination right.",
    acceptableFallback: "Standard force majeure with 14-day notice and 6-month long-stop.",
    hardRedLine: "Force majeure covering economic hardship, supply chain disruption, or events within the counterparty's control.",
    riskWeight: 3,
  },
  {
    clauseCategory: "WARRANTIES",
    preferredPosition: "Warranties of title, authority, fitness for purpose, and legal compliance. Survive termination.",
    acceptableFallback: "Warranties of authority and title; fitness for purpose implied by statute.",
    hardRedLine: "\"As-is\" disclaimer or blanket exclusion of implied terms covering material failures.",
    riskWeight: 4,
  },
  {
    clauseCategory: "DISPUTE_RESOLUTION",
    preferredPosition: "Tiered: commercial discussion (10 days) → executive escalation (20 days) → LCIA arbitration. Emergency relief through English courts.",
    acceptableFallback: "Direct LCIA or ICC arbitration. Expert determination for technical disputes.",
    hardRedLine: "Exclusive foreign court jurisdiction with no arbitration option; or clause preventing emergency injunctive relief.",
    riskWeight: 3,
  },
  {
    clauseCategory: "ASSIGNMENT",
    preferredPosition: "Neither party may assign without prior written consent. Group assignments permitted on 5 days' notice. Change of control triggers assignment consent requirement.",
    acceptableFallback: "Assignment with consent (not to be unreasonably withheld). Group companies exempt.",
    hardRedLine: "Counterparty may assign freely to competitors without consent.",
    riskWeight: 4,
  },
  {
    clauseCategory: "CHANGE_OF_CONTROL",
    preferredPosition: "Right to terminate on 30 days' notice on counterparty change of control, including asset sales.",
    acceptableFallback: "60-day notice period for termination. Right to re-negotiate terms post-change.",
    hardRedLine: "No change of control right; or right limited to share sales only.",
    riskWeight: 3,
  },
  {
    clauseCategory: "INSURANCE",
    preferredPosition: "Counterparty maintains: Professional Indemnity £2M+, Public Liability £5M+, Cyber Liability £2M+. Evidence on request.",
    acceptableFallback: "Professional Indemnity £1M+, Public Liability £2M+. Evidence within 5 business days.",
    hardRedLine: "No insurance obligations at all.",
    riskWeight: 3,
  },
  {
    clauseCategory: "NON_SOLICITATION",
    preferredPosition: "Mutual 12-month post-termination restriction on soliciting key personnel directly involved in the engagement.",
    acceptableFallback: "12-month restriction on active solicitation (not response to general advertising).",
    hardRedLine: "Restriction exceeding 24 months, or applying to all employees rather than those involved.",
    riskWeight: 2,
  },
];
