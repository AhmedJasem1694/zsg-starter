import type { Company, RegulatoryCitation } from "./types";

// ─── Contextual regulation layer ──────────────────────────────────────────────
// Regulatory citations are core for regulated sectors but noise for purely
// commercial / investment paper. Prominence is derived from company sector and
// contract type, with a company-level override saved in Settings.
//
// HIGH:   healthcare, charity, financial_services, energy, insurance
// MEDIUM: logistics, real_estate, technology (data protection only)
// LOW:    investment, professional_services, media, other commercial

export type RegulationProminence = "HIGH" | "MEDIUM" | "LOW";
export type RegulationAnalysisSetting = "FULL" | "RELEVANT" | "MINIMAL";

const HIGH_INDUSTRIES = new Set(["HEALTHCARE_LIFESCIENCES", "FINANCIAL_SERVICES", "ENERGY_CLEANTECH"]);
const MEDIUM_INDUSTRIES = new Set(["LOGISTICS_SUPPLY", "PROPERTY_REAL_ESTATE", "TECHNOLOGY_SAAS"]);
// Free-text sector entries (charity, insurance, …) have no Industry enum value,
// so the sector string is matched too.
const HIGH_SECTOR_RE = /charit|insur|health|pharma|clinic|financ|bank|fintech|energy|utilit/i;

// Contract-type signals override the sector default: investment paper is
// regulatory noise even for regulated sectors; clinical / lending paper is
// regulatory-core anywhere; a DPA is at least data-protection relevant.
const INVESTMENT_CONTRACT_TYPES = new Set([
  "TERM_SHEET", "SUBSCRIPTION_AGREEMENT", "SHA", "CONVERTIBLE_NOTE", "SAFE",
  "INVESTMENT_AGREEMENT", "SHARE_PURCHASE", "JV_AGREEMENT",
]);
const HIGH_CONTRACT_TYPES = new Set(["CLINICAL_TRIAL", "RESEARCH_COLLAB", "LOAN_AGREEMENT"]);
const DATA_CONTRACT_TYPES = new Set(["DPA"]);

type CompanyLike = Pick<Company, "industry" | "sector"> & { regulationProminence?: string };

function splitIndustries(company?: CompanyLike | null): string[] {
  return (company?.industry ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function deriveRegulationProminence(
  company?: CompanyLike | null,
  contractType?: string
): RegulationProminence {
  if (contractType) {
    if (HIGH_CONTRACT_TYPES.has(contractType)) return "HIGH";
    if (INVESTMENT_CONTRACT_TYPES.has(contractType)) return "LOW";
  }

  const industries = splitIndustries(company);
  const sector = company?.sector ?? "";

  let prominence: RegulationProminence = "LOW";
  if (industries.some((i) => HIGH_INDUSTRIES.has(i)) || HIGH_SECTOR_RE.test(sector)) {
    prominence = "HIGH";
  } else if (industries.some((i) => MEDIUM_INDUSTRIES.has(i))) {
    prominence = "MEDIUM";
  }

  if (prominence === "LOW" && contractType && DATA_CONTRACT_TYPES.has(contractType)) {
    prominence = "MEDIUM";
  }
  return prominence;
}

/** Company override (Settings → Regulatory analysis) wins over the sector mapping. */
export function resolveRegulationProminence(
  company?: CompanyLike | null,
  contractType?: string
): RegulationProminence {
  switch (company?.regulationProminence) {
    case "FULL":     return "HIGH";
    case "RELEVANT": return "MEDIUM";
    case "MINIMAL":  return "LOW";
    default:         return deriveRegulationProminence(company, contractType);
  }
}

export const PROMINENCE_TO_SETTING: Record<RegulationProminence, RegulationAnalysisSetting> = {
  HIGH: "FULL",
  MEDIUM: "RELEVANT",
  LOW: "MINIMAL",
};

export const SETTING_LABELS: Record<RegulationAnalysisSetting, string> = {
  FULL: "Full",
  RELEVANT: "Relevant only",
  MINIMAL: "Minimal",
};

// ─── MEDIUM-mode relevance filter ─────────────────────────────────────────────
// "Directly relevant" = data-protection citations appear only on data clauses
// (e.g. UK GDPR on a data clause, not on payment terms). Sector-specific
// citations (logistics, real estate) stay inline. Technology's MEDIUM rating is
// for data protection only, so for tech-only companies non-data citations are
// treated as noise as well.

const DATA_REG_RE = /gdpr|data protection|privacy|pecr/i;
const DATA_CLAUSE_RE = /DATA|PRIVACY|CONFIDENTIAL/;

export function isCitationDirectlyRelevant(
  citation: RegulatoryCitation,
  clauseCategory: string,
  companyIndustry?: string
): boolean {
  const regText = `${citation.regulation ?? ""} ${citation.article ?? ""} ${citation.relevance ?? ""}`;
  const isDataReg = DATA_REG_RE.test(regText);
  if (isDataReg) return DATA_CLAUSE_RE.test(clauseCategory);

  const industries = (companyIndustry ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const techOnly =
    industries.includes("TECHNOLOGY_SAAS") &&
    !industries.some((i) => i === "LOGISTICS_SUPPLY" || i === "PROPERTY_REAL_ESTATE");
  return !techOnly;
}
