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

// ── SIC code descriptions (UK SIC 2007) ──────────────────────────────────────
// Common codes returned by Companies House. Used to show human-readable labels
// instead of raw SIC codes in the enriched company sector field.

const SIC_DESCRIPTIONS: Record<string, string> = {
  // Technology & Software
  "62011": "Ready-made interactive leisure and entertainment software development",
  "62012": "Business and domestic software development",
  "62020": "Information technology consultancy",
  "62090": "Other information technology service activities",
  "63110": "Data processing, hosting and related activities",
  "63120": "Web portals",
  "58210": "Publishing of computer games",
  "58290": "Other software publishing",
  "61100": "Wired telecommunications activities",
  "61200": "Wireless telecommunications activities",
  "61900": "Other telecommunications activities",
  // Financial Services
  "64110": "Central banking",
  "64191": "Banks",
  "64192": "Building societies",
  "64201": "Activities of agricultural holding companies",
  "64205": "Activities of financial services holding companies",
  "64209": "Activities of other holding companies",
  "64301": "Activities of investment trusts",
  "64302": "Activities of unit trusts",
  "64303": "Activities of venture and development capital companies",
  "64304": "Activities of open-ended investment companies",
  "64910": "Financial leasing",
  "64921": "Credit granting by non-deposit taking finance houses",
  "64922": "Activities of mortgage finance companies",
  "64929": "Other credit granting",
  "64991": "Security dealing on own account",
  "64992": "Factoring",
  "65110": "Life insurance",
  "65120": "Non-life insurance",
  "65201": "Life reinsurance",
  "65202": "Non-life reinsurance",
  "66110": "Administration of financial markets",
  "66120": "Security and commodity contracts dealing activities",
  "66190": "Other activities auxiliary to financial services",
  "66210": "Risk and damage evaluation",
  "66220": "Activities of insurance agents and brokers",
  "66290": "Other activities auxiliary to insurance and pension funding",
  "66300": "Fund management activities",
  // Healthcare & Life Sciences
  "86100": "Hospital activities",
  "86210": "General medical practice activities",
  "86220": "Specialist medical practice activities",
  "86230": "Dental practice activities",
  "86900": "Other human health activities",
  "87100": "Residential nursing care facilities",
  "87200": "Residential care activities for learning disabilities",
  "88100": "Social work activities without accommodation",
  "72110": "Research and experimental development on biotechnology",
  "72190": "Other research and experimental development on natural sciences",
  "21100": "Manufacture of basic pharmaceutical products",
  "21200": "Manufacture of pharmaceutical preparations",
  // Property & Real Estate
  "68100": "Buying and selling of own real estate",
  "68201": "Renting and operating of Housing Association real estate",
  "68202": "Letting and operating of conference and exhibition centres",
  "68209": "Other letting and operating of own or leased real estate",
  "68310": "Real estate agencies",
  "68320": "Management of real estate on a fee or contract basis",
  "41100": "Development of building projects",
  "41201": "Construction of commercial buildings",
  "41202": "Construction of domestic buildings",
  "43110": "Demolition",
  "43120": "Site preparation",
  "43210": "Electrical installation",
  "43220": "Plumbing, heat and air-conditioning installation",
  "43290": "Other construction installation",
  "43310": "Plastering",
  "43320": "Joinery installation",
  "43330": "Floor and wall covering",
  "43341": "Painting",
  "43342": "Glazing",
  "43390": "Other building completion and finishing",
  "43910": "Roofing activities",
  "43999": "Other specialised construction activities",
  // Logistics & Transport
  "49100": "Passenger rail transport, interurban",
  "49200": "Freight rail transport",
  "49310": "Urban and suburban passenger land transport",
  "49320": "Taxi operation",
  "49390": "Other passenger land transport",
  "49410": "Freight transport by road",
  "49420": "Removal services",
  "49500": "Transport via pipeline",
  "50100": "Sea and coastal passenger water transport",
  "50200": "Sea and coastal freight water transport",
  "50300": "Inland passenger water transport",
  "50400": "Inland freight water transport",
  "51101": "Scheduled passenger air transport",
  "51102": "Non-scheduled passenger air transport",
  "51210": "Freight air transport",
  "52101": "Operation of warehousing and storage facilities for water transport activities",
  "52102": "Operation of warehousing and storage facilities for air transport activities",
  "52103": "Operation of warehousing and storage facilities for land transport activities",
  "52211": "Operation of rail freight terminals",
  "52212": "Operation of rail passenger facilities at railway stations",
  "52213": "Operation of bus and coach passenger facilities at bus and coach stations",
  "52219": "Other service activities incidental to land transportation",
  "52220": "Service activities incidental to water transportation",
  "52230": "Service activities incidental to air transportation",
  "52241": "Cargo handling for water transport activities",
  "52242": "Cargo handling for air transport activities",
  "52243": "Cargo handling for land transport activities",
  "52290": "Other transportation support activities",
  "53100": "Postal activities under universal service obligation",
  "53201": "Licensed carriers",
  "53202": "Unlicensed carriers",
  // Retail & eCommerce
  "45111": "Sale of new cars and light motor vehicles",
  "45112": "Sale of used cars and light motor vehicles",
  "45190": "Sale of other motor vehicles",
  "45200": "Maintenance and repair of motor vehicles",
  "45310": "Wholesale trade of motor vehicle parts and accessories",
  "45320": "Retail trade of motor vehicle parts and accessories",
  "46100": "Agents involved in the sale of agricultural raw materials",
  "46190": "Agents involved in the sale of a variety of goods",
  "46900": "Non-specialised wholesale trade",
  "47110": "Retail sale in non-specialised stores with food, beverages or tobacco predominating",
  "47190": "Other retail sale in non-specialised stores",
  "47910": "Retail sale via mail order houses or via Internet",
  "47990": "Other retail sale not in stores, stalls or markets",
  // Professional Services
  "69101": "Barristers at law",
  "69102": "Solicitors",
  "69109": "Activities of patent and copyright agents",
  "70100": "Activities of head offices",
  "70210": "Public relations and communication activities",
  "70221": "Financial management",
  "70229": "Management consultancy activities",
  "71111": "Architectural activities",
  "71112": "Urban planning and landscape architectural activities",
  "71121": "Engineering design activities for industrial process and production",
  "71122": "Engineering related scientific and technical consulting activities",
  "71129": "Other engineering activities",
  "73110": "Advertising agencies",
  "73120": "Media representation services",
  "73200": "Market research and public opinion polling",
  "74100": "Specialised design activities",
  "74200": "Photographic activities",
  "74300": "Translation and interpretation activities",
  "74909": "Other professional, scientific and technical activities",
  "78100": "Activities of employment placement agencies",
  "78200": "Temporary employment agency activities",
  "78300": "Human resources provision and management of human resources functions",
  "82110": "Combined office administrative service activities",
  "82190": "Photocopying, document preparation and other specialised office support activities",
  "82200": "Activities of call centres",
  "82300": "Organisation of conventions and trade shows",
  "82910": "Activities of collection agencies and credit bureaus",
  "82990": "Other business support service activities",
  // Media & Entertainment
  "58110": "Book publishing",
  "58130": "Publishing of newspapers",
  "58141": "Publishing of learned journals",
  "58142": "Publishing of consumer and business journals and periodicals",
  "58190": "Other publishing activities",
  "59111": "Motion picture production activities",
  "59112": "Video production activities",
  "59113": "Television programme production activities",
  "59120": "Motion picture, video and television programme post-production activities",
  "59131": "Motion picture distribution activities",
  "59132": "Video distribution activities",
  "59133": "Television programme distribution activities",
  "59140": "Motion picture projection activities",
  "59200": "Sound recording and music publishing activities",
  "60100": "Radio broadcasting",
  "60200": "Television programming and broadcasting activities",
  "90010": "Performing arts",
  "90020": "Support activities to performing arts",
  "90030": "Artistic creation",
  "91011": "Library activities",
  "91012": "Archives activities",
  "92000": "Gambling and betting activities",
  // Energy & CleanTech
  "35110": "Production of electricity",
  "35120": "Transmission of electricity",
  "35130": "Distribution of electricity",
  "35140": "Trade of electricity",
  "35210": "Manufacture of gas",
  "35220": "Distribution of gaseous fuels through mains",
  "35230": "Trade of gas through mains",
  "35300": "Steam and air conditioning supply",
  "36000": "Water collection, treatment and supply",
  "37000": "Sewerage",
  "38110": "Collection of non-hazardous waste",
  "38120": "Collection of hazardous waste",
  "38210": "Treatment and disposal of non-hazardous waste",
  "38220": "Treatment and disposal of hazardous waste",
  "38310": "Dismantling of wrecks",
  "38320": "Recovery of sorted materials",
  "39000": "Remediation activities",
  // Education
  "85100": "Pre-primary education",
  "85200": "Primary education",
  "85310": "General secondary education",
  "85320": "Technical and vocational secondary education",
  "85410": "Post-secondary non-tertiary education",
  "85421": "First-degree level higher education",
  "85422": "Post-graduate level higher education",
  "85510": "Sports and recreation education",
  "85520": "Cultural education",
  "85590": "Other education",
  "85600": "Educational support services",
  // Manufacturing
  "10110": "Processing and preserving of meat",
  "10200": "Processing and preserving of fish, crustaceans and molluscs",
  "10310": "Processing and preserving of potatoes",
  "10320": "Manufacture of fruit and vegetable juice",
  "10390": "Other processing and preserving of fruit and vegetables",
  "10410": "Manufacture of oils and fats",
  "10511": "Liquid milk and cream production",
  "10512": "Butter and cheese production",
  "10519": "Manufacture of other dairy products",
  "10520": "Manufacture of ice cream",
  "10610": "Grain milling",
  "10620": "Manufacture of starches and starch products",
  "22110": "Manufacture of rubber tyres and tubes",
  "22190": "Manufacture of other rubber products",
  "22210": "Manufacture of plastic plates, sheets, tubes and profiles",
  "22220": "Manufacture of plastic packing goods",
  "22290": "Manufacture of other plastic products",
  "25110": "Manufacture of metal structures and parts of structures",
  "25120": "Manufacture of doors and windows of metal",
  "26110": "Manufacture of electronic components",
  "26120": "Manufacture of loaded electronic boards",
  "26200": "Manufacture of computers and peripheral equipment",
  "26300": "Manufacture of communication equipment",
  "26400": "Manufacture of consumer electronics",
  "26511": "Manufacture of electronic instruments and appliances for measuring",
  "26512": "Manufacture of electronic industrial process control equipment",
  "27110": "Manufacture of electric motors, generators and transformers",
  "27120": "Manufacture of electricity distribution and control apparatus",
  "27200": "Manufacture of batteries and accumulators",
  "27400": "Manufacture of electric lighting equipment",
  "27510": "Manufacture of electric domestic appliances",
  "27520": "Manufacture of non-electric domestic appliances",
  "28110": "Manufacture of engines and turbines",
  "28120": "Manufacture of fluid power equipment",
  "28130": "Manufacture of other pumps and compressors",
  "28140": "Manufacture of other taps and valves",
  "28150": "Manufacture of bearings, gears, gearing and driving elements",
  "29100": "Manufacture of motor vehicles",
  "29200": "Manufacture of bodies (coachwork) for motor vehicles",
  "30110": "Building of ships and floating structures",
  "30120": "Building of pleasure and sporting boats",
  "30300": "Manufacture of air and spacecraft and related machinery",
  "32500": "Manufacture of medical and dental instruments and supplies",
};

// ── Companies House ───────────────────────────────────────────────────────────

async function searchCompaniesHouse(q: string): Promise<CompanyCandidate[]> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    console.warn("[CompanySearch] COMPANIES_HOUSE_API_KEY not set — skipping Companies House lookup");
    return [];
  }

  try {
    const url = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(q)}&items_per_page=8`;
    const res = await fetch(url, {
      headers: {
        Authorization: "Basic " + Buffer.from(apiKey + ":").toString("base64"),
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[CompanySearch] Companies House returned ${res.status} for query "${q}"`);
      return [];
    }
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
    const sicDescriptions = sicCodes.map((c) => SIC_DESCRIPTIONS[c] ?? `SIC ${c}`);
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
 * Search for a company.
 * Primary: Companies House (UK, requires COMPANIES_HOUSE_API_KEY).
 * Fallback: LLM best-effort (for non-UK companies or when API key is absent).
 * OpenCorporates is no longer used — their free unauthenticated tier was removed.
 */
export async function searchCompanies(q: string): Promise<CompanyCandidate[]> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];

  // Always try Companies House first
  const ch = await searchCompaniesHouse(trimmed);
  if (ch.length > 0) return ch.slice(0, 8);

  // No CH results — either no API key or a non-UK company. Try LLM.
  const llm = await searchLLM(trimmed);
  return llm;
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
