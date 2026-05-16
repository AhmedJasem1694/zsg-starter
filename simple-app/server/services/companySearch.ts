/**
 * Company search + enrichment service.
 *
 * Priority order:
 *  1. Companies House (UK — structured SIC codes, free with API key)
 *  2. OpenCorporates  (130+ jurisdictions, no API key required)
 *  3. LLM fallback    (OpenRouter — best-effort from training data)
 */

import { chatComplete } from "./openrouter.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CompanyCandidate {
  id: string; // unique within this result set
  source: "companies_house" | "opencorporates" | "llm";
  name: string;
  number?: string;
  jurisdiction: string;
  status?: string;
  incorporatedOn?: string;
  address?: string;
  sicCodes?: string[];
  sicDescriptions?: string[];
}

export type AppIndustry =
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

export interface EnrichedCompany {
  name: string;
  number?: string;
  jurisdiction: string;
  status?: string;
  incorporatedOn?: string;
  address?: string;
  sicCodes: string[];
  sicDescriptions: string[];
  mappedIndustries: AppIndustry[];
  customIndustries: string[]; // SIC descriptions that don't map to an app industry
  sector: string; // auto-derived human-readable sector string
}

// ── SIC → App industry mapping ────────────────────────────────────────────────
// UK SIC 2007 division codes (first 2 digits of 5-digit SIC)

const SIC_TO_INDUSTRY: [RegExp, AppIndustry][] = [
  // Technology & SaaS (IT, software, telecom)
  [/^6[123]/, "TECHNOLOGY_SAAS"],
  [/^582/, "TECHNOLOGY_SAAS"], // software publishing
  // Gaming — detect before generic media
  [/^58211|^58212|^58219|^77221|^59113/, "GAMING_INTERACTIVE"],
  // Media & Entertainment
  [/^59|^60|^90|^91|^92/, "MEDIA_ENTERTAINMENT"],
  [/^581/, "MEDIA_ENTERTAINMENT"], // book/periodical publishing
  // Financial Services
  [/^6[456]/, "FINANCIAL_SERVICES"],
  [/^66/, "FINANCIAL_SERVICES"],
  // Healthcare & Life Sciences
  [/^86|^87|^88|^75|^72[01]/, "HEALTHCARE_LIFESCIENCES"],
  [/^21/, "HEALTHCARE_LIFESCIENCES"], // pharma manufacturing
  // Property & Real Estate
  [/^68/, "PROPERTY_REAL_ESTATE"],
  [/^41|^43/, "PROPERTY_REAL_ESTATE"], // construction/development
  // Legal Services
  [/^6910/, "LEGAL_SERVICES"],
  // Professional Services
  [/^69|^70|^71|^73|^74|^78|^80|^81|^82/, "PROFESSIONAL_SERVICES"],
  // Logistics, Freight & Supply Chain
  [/^49|^50|^51|^52|^53/, "LOGISTICS_SUPPLY"],
  // Retail & eCommerce
  [/^45|^46|^47/, "RETAIL_ECOMMERCE"],
  // Manufacturing & Supply Chain
  [/^1[0-9]|^2[0-9]|^3[0-3]/, "MANUFACTURING_SUPPLY"],
  // Energy & CleanTech
  [/^35|^36|^37|^38|^39|^0[5-9]/, "ENERGY_CLEANTECH"],
  // Education & EdTech
  [/^85/, "EDUCATION_EDTECH"],
];

function sicToIndustry(sicCode: string): AppIndustry | null {
  const code = sicCode.replace(/\D/g, ""); // strip non-digits
  for (const [pattern, industry] of SIC_TO_INDUSTRY) {
    if (pattern.test(code)) return industry;
  }
  return null;
}

function mapSicCodesToIndustries(
  sicCodes: string[],
  sicDescriptions: string[]
): { mappedIndustries: AppIndustry[]; customIndustries: string[] } {
  const mapped = new Set<AppIndustry>();
  const custom: string[] = [];

  for (let i = 0; i < sicCodes.length; i++) {
    const industry = sicToIndustry(sicCodes[i]);
    if (industry) {
      mapped.add(industry);
    } else {
      // Use the human-readable description as a custom industry label
      const desc = sicDescriptions[i] ?? sicCodes[i];
      if (desc && !custom.includes(desc)) custom.push(desc);
    }
  }

  // Always include at least OTHER if nothing mapped
  const mappedArr = Array.from(mapped);
  return {
    mappedIndustries: mappedArr.length > 0 ? mappedArr : ["OTHER"],
    customIndustries: custom,
  };
}

// ── Companies House ───────────────────────────────────────────────────────────

async function searchCompaniesHouse(q: string): Promise<CompanyCandidate[]> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) return [];

  try {
    const url = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(q)}&items_per_page=8`;
    const res = await fetch(url, {
      headers: {
        Authorization: "Basic " + Buffer.from(apiKey + ":").toString("base64"),
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: {
        company_name: string;
        company_number: string;
        company_status?: string;
        date_of_creation?: string;
        registered_office_address?: { address_line_1?: string; locality?: string; postal_code?: string };
      }[];
    };
    return (data.items ?? []).map((item, i) => ({
      id: `ch_${item.company_number}`,
      source: "companies_house" as const,
      name: item.company_name,
      number: item.company_number,
      jurisdiction: "United Kingdom",
      status: item.company_status,
      incorporatedOn: item.date_of_creation,
      address: [
        item.registered_office_address?.address_line_1,
        item.registered_office_address?.locality,
        item.registered_office_address?.postal_code,
      ]
        .filter(Boolean)
        .join(", "),
    }));
  } catch {
    return [];
  }
}

async function enrichCompaniesHouse(companyNumber: string): Promise<Partial<EnrichedCompany>> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) return {};

  try {
    const url = `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: "Basic " + Buffer.from(apiKey + ":").toString("base64"),
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      company_name: string;
      company_number: string;
      company_status?: string;
      date_of_creation?: string;
      registered_office_address?: { address_line_1?: string; locality?: string; postal_code?: string };
      sic_codes?: string[];
    };

    const sicCodes = data.sic_codes ?? [];
    // CH doesn't return descriptions in this endpoint; use codes as descriptions for now
    // (we'd need a separate SIC lookup for full descriptions — use the code itself)
    const sicDescriptions = sicCodes.map((c) => `SIC ${c}`);
    const { mappedIndustries, customIndustries } = mapSicCodesToIndustries(sicCodes, sicDescriptions);

    return {
      name: data.company_name,
      number: data.company_number,
      jurisdiction: "United Kingdom",
      status: data.company_status,
      incorporatedOn: data.date_of_creation,
      address: [
        data.registered_office_address?.address_line_1,
        data.registered_office_address?.locality,
        data.registered_office_address?.postal_code,
      ]
        .filter(Boolean)
        .join(", "),
      sicCodes,
      sicDescriptions,
      mappedIndustries,
      customIndustries,
      sector: mappedIndustries.map((i) => INDUSTRY_LABELS[i]).join(", "),
    };
  } catch {
    return {};
  }
}

// ── OpenCorporates ────────────────────────────────────────────────────────────

interface OcCompany {
  name: string;
  company_number: string;
  jurisdiction_code: string;
  current_status?: string;
  incorporation_date?: string;
  registered_address_in_full?: string;
}

function ocJurisdictionLabel(code: string): string {
  const map: Record<string, string> = {
    gb: "United Kingdom", us: "United States", us_de: "United States (Delaware)",
    us_ca: "United States (California)", us_ny: "United States (New York)",
    au: "Australia", ca: "Canada", de: "Germany", fr: "France",
    nl: "Netherlands", sg: "Singapore", hk: "Hong Kong", ie: "Ireland",
    in: "India", ae: "UAE", sa: "Saudi Arabia", kr: "South Korea",
    jp: "Japan", br: "Brazil", ch: "Switzerland", es: "Spain",
    it: "Italy", be: "Belgium", se: "Sweden", no: "Norway", dk: "Denmark",
    nz: "New Zealand", za: "South Africa", mx: "Mexico",
  };
  const prefix = code.split("_")[0];
  return map[code] ?? map[prefix] ?? code.toUpperCase();
}

async function searchOpenCorporates(q: string): Promise<CompanyCandidate[]> {
  try {
    const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(q)}&per_page=8&fields=company_name,jurisdiction_code,company_number,current_status,incorporation_date,registered_address_in_full`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: { companies?: { company: OcCompany }[] };
    };
    return (data.results?.companies ?? []).map((entry) => {
      const c = entry.company;
      return {
        id: `oc_${c.jurisdiction_code}_${c.company_number}`,
        source: "opencorporates" as const,
        name: c.name,
        number: c.company_number,
        jurisdiction: ocJurisdictionLabel(c.jurisdiction_code),
        status: c.current_status,
        incorporatedOn: c.incorporation_date,
        address: c.registered_address_in_full,
      };
    });
  } catch {
    return [];
  }
}

async function enrichOpenCorporates(
  companyNumber: string,
  jurisdictionCode: string
): Promise<Partial<EnrichedCompany>> {
  try {
    const url = `https://api.opencorporates.com/v0.4/companies/${encodeURIComponent(jurisdictionCode)}/${encodeURIComponent(companyNumber)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      results?: {
        company?: OcCompany & {
          industry_codes?: { industry_code: { code: string; description: string; code_scheme_id: string } }[];
        };
      };
    };
    const company = data.results?.company;
    if (!company) return {};

    const sicCodes: string[] = [];
    const sicDescriptions: string[] = [];
    for (const entry of company.industry_codes ?? []) {
      sicCodes.push(entry.industry_code.code);
      sicDescriptions.push(entry.industry_code.description);
    }

    const { mappedIndustries, customIndustries } = mapSicCodesToIndustries(sicCodes, sicDescriptions);

    return {
      name: company.name,
      number: company.company_number,
      jurisdiction: ocJurisdictionLabel(company.jurisdiction_code),
      status: company.current_status,
      incorporatedOn: company.incorporation_date,
      address: company.registered_address_in_full,
      sicCodes,
      sicDescriptions,
      mappedIndustries,
      customIndustries,
      sector: sicDescriptions.length > 0
        ? sicDescriptions[0]
        : mappedIndustries.map((i) => INDUSTRY_LABELS[i]).join(", "),
    };
  } catch {
    return {};
  }
}

// ── LLM fallback ──────────────────────────────────────────────────────────────

async function searchLLM(q: string): Promise<CompanyCandidate[]> {
  const prompt = `You are a company intelligence assistant. The user is searching for a company named "${q}".

Return a JSON array of up to 5 matching companies you know about. For each company return:
{
  "name": "Full legal company name",
  "number": "Registration/company number if known, else null",
  "jurisdiction": "Country or state where incorporated (e.g. United Kingdom, United States, Singapore)",
  "status": "Active or Dissolved if known, else null",
  "incorporatedOn": "YYYY-MM-DD if known, else null",
  "address": "Registered address if known, else null",
  "sicCodes": ["list of SIC/industry codes if known, else empty array"],
  "sicDescriptions": ["human-readable industry descriptions - required, be specific e.g. 'B2B SaaS software development', 'Financial services - banking', 'Healthcare - medical devices'"]
}

If you don't recognise the company at all, return an empty array [].
Return ONLY the JSON array, no other text.`;

  try {
    const raw = await chatComplete([{ role: "user", content: prompt }], 800);
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as Array<{
      name: string;
      number?: string;
      jurisdiction: string;
      status?: string;
      incorporatedOn?: string;
      address?: string;
      sicCodes?: string[];
      sicDescriptions?: string[];
    }>;
    return parsed.map((c, i) => ({
      id: `llm_${i}`,
      source: "llm" as const,
      name: c.name,
      number: c.number ?? undefined,
      jurisdiction: c.jurisdiction,
      status: c.status ?? undefined,
      incorporatedOn: c.incorporatedOn ?? undefined,
      address: c.address ?? undefined,
      sicCodes: c.sicCodes ?? [],
      sicDescriptions: c.sicDescriptions ?? [],
    }));
  } catch {
    return [];
  }
}

// ── Industry labels (mirrors client/src/lib/types.ts) ─────────────────────────

const INDUSTRY_LABELS: Record<AppIndustry, string> = {
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

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Search for a company across all sources.
 * Deduplicates by name (case-insensitive) — Companies House results take priority.
 */
export async function searchCompanies(q: string): Promise<CompanyCandidate[]> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];

  // Run all three in parallel, cap total time at 12s
  const [ch, oc, llmResults] = await Promise.all([
    searchCompaniesHouse(trimmed),
    searchOpenCorporates(trimmed),
    Promise.resolve([] as CompanyCandidate[]), // LLM only used in enrich/fallback path
  ]);

  // Merge: CH first, then OC — dedupe by normalised name
  const seen = new Set<string>();
  const merged: CompanyCandidate[] = [];
  for (const candidate of [...ch, ...oc]) {
    const key = candidate.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(candidate);
    }
  }

  // If no results at all, try LLM
  if (merged.length === 0) {
    const llm = await searchLLM(trimmed);
    return llm;
  }

  return merged.slice(0, 8);
}

/**
 * Enrich a selected candidate with full SIC/industry data.
 */
export async function enrichCompany(candidate: CompanyCandidate): Promise<EnrichedCompany> {
  let partial: Partial<EnrichedCompany> = {};

  if (candidate.source === "companies_house" && candidate.number) {
    partial = await enrichCompaniesHouse(candidate.number);
  } else if (candidate.source === "opencorporates" && candidate.number) {
    // Extract jurisdiction code from the candidate id: oc_{jcode}_{number}
    const parts = candidate.id.split("_");
    const jCode = parts.length >= 3 ? parts.slice(1, -1).join("_") : "gb";
    partial = await enrichOpenCorporates(candidate.number, jCode);
  } else if (candidate.source === "llm") {
    // LLM candidate already has sic descriptions — just map them
    const sicCodes = candidate.sicCodes ?? [];
    const sicDescs = candidate.sicDescriptions ?? [];
    const { mappedIndustries, customIndustries } = mapSicCodesToIndustries(sicCodes, sicDescs);
    partial = {
      sicCodes,
      sicDescriptions: sicDescs,
      mappedIndustries,
      customIndustries,
      sector: sicDescs.length > 0 ? sicDescs[0] : mappedIndustries.map((i) => INDUSTRY_LABELS[i]).join(", "),
    };
  }

  // Fallback: if we still have no industry data, run LLM enrichment
  if (!partial.mappedIndustries?.length) {
    const llmFallback = await searchLLM(candidate.name);
    const match = llmFallback.find(
      (c) => c.name.toLowerCase().replace(/[^a-z0-9]/g, "") ===
             candidate.name.toLowerCase().replace(/[^a-z0-9]/g, "")
    ) ?? llmFallback[0];
    if (match) {
      const sicCodes = match.sicCodes ?? [];
      const sicDescs = match.sicDescriptions ?? [];
      const { mappedIndustries, customIndustries } = mapSicCodesToIndustries(sicCodes, sicDescs);
      partial = {
        ...partial,
        sicCodes,
        sicDescriptions: sicDescs,
        mappedIndustries: mappedIndustries.length > 0 ? mappedIndustries : ["OTHER"],
        customIndustries,
        sector: sicDescs.length > 0 ? sicDescs[0] : mappedIndustries.map((i) => INDUSTRY_LABELS[i]).join(", "),
      };
    }
  }

  return {
    name: partial.name ?? candidate.name,
    number: partial.number ?? candidate.number,
    jurisdiction: partial.jurisdiction ?? candidate.jurisdiction,
    status: partial.status ?? candidate.status,
    incorporatedOn: partial.incorporatedOn ?? candidate.incorporatedOn,
    address: partial.address ?? candidate.address,
    sicCodes: partial.sicCodes ?? [],
    sicDescriptions: partial.sicDescriptions ?? [],
    mappedIndustries: partial.mappedIndustries ?? ["OTHER"],
    customIndustries: partial.customIndustries ?? [],
    sector: partial.sector ?? candidate.jurisdiction,
  };
}
