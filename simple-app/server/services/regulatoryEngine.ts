/**
 * Regulatory Intelligence Engine
 *
 * Architecture: This service is designed to fetch, process and store regulatory
 * content from government sources (legislation.gov.uk, ICO, FCA Handbook, GOV.UK,
 * EUR-Lex, etc.) and make it searchable for clause analysis.
 *
 * V1 STATUS: Stubbed with static knowledge. Live fetching endpoints are wired
 * but return empty until API connections are configured.
 *
 * Live sources planned:
 * - UK: https://www.legislation.gov.uk/api/1 (free, structured JSON/XML)
 * - UK: https://ico.org.uk (guidance, enforcement notices)
 * - UK: https://handbook.fca.org.uk (FCA rulebook, continuously updated)
 * - UK: https://www.gov.uk/api/content (statutory guidance)
 * - EU: https://eur-lex.europa.eu/api (all EU regulations)
 * - CA: https://laws-lois.justice.gc.ca/eng/acts (Canadian statutes)
 * - KR: Korean Legislation Information Center
 */

export interface RegulatoryDocument {
  id: string;
  source: string;           // e.g. "legislation.gov.uk"
  jurisdiction: string;     // e.g. "GB", "EU", "SA", "KR"
  regulationName: string;   // e.g. "UK GDPR"
  provision: string;        // e.g. "Article 28 - Processor contracts"
  text: string;             // The actual regulatory text
  sectorTags: string[];     // e.g. ["all", "financial services"]
  clauseTags: string[];     // e.g. ["DATA_PRIVACY", "LIABILITY_CAP"]
  lastUpdated: Date;
  sourceUrl: string;
}

const STATIC_REGULATORY_DOCUMENTS: RegulatoryDocument[] = [
  // ── DATA_PRIVACY ────────────────────────────────────────────────────────────
  {
    id: "uk-gdpr-art28",
    source: "legislation.gov.uk",
    jurisdiction: "GB",
    regulationName: "UK GDPR",
    provision: "Article 28 - Processor contracts",
    text: `UK GDPR Article 28 requires that processing by a processor shall be governed by a contract or other legal act. The contract must stipulate that the processor: (a) processes personal data only on documented instructions from the controller; (b) ensures persons authorised to process the data are subject to confidentiality obligations; (c) takes all security measures required by Article 32; (d) respects conditions for sub-processing; (e) assists the controller with data subject rights; (f) deletes or returns data after the end of services; (g) provides all information necessary to demonstrate compliance. Failure to have an adequate Data Processing Agreement in place is a direct regulatory breach exposable to ICO enforcement action and fines up to £17.5m or 4% of global annual turnover under UK GDPR Article 83.`,
    sectorTags: ["all"],
    clauseTags: ["DATA_PRIVACY"],
    lastUpdated: new Date("2024-01-01"),
    sourceUrl: "https://www.legislation.gov.uk/eur/2016/679/article/28",
  },
  {
    id: "ico-processor-guidance",
    source: "ico.org.uk",
    jurisdiction: "GB",
    regulationName: "ICO Guidance - Controllers and Processors",
    provision: "Processor agreements - practical requirements",
    text: `The ICO requires that processor agreements must be in writing (which includes electronic format), must specify the subject matter, duration, nature and purpose of the processing, type of personal data, categories of data subjects, and the obligations and rights of the controller. The ICO has stated it will take enforcement action where organisations fail to have appropriate written processor contracts in place. The ICO's enforcement decisions have imposed fines on controllers who could not demonstrate their processors were contractually bound to appropriate data protection standards.`,
    sectorTags: ["all"],
    clauseTags: ["DATA_PRIVACY", "AUDIT_RIGHTS"],
    lastUpdated: new Date("2024-01-01"),
    sourceUrl: "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/guide-to-accountability-and-governance/accountability-framework/contracts-and-liabilities/",
  },
  {
    id: "uk-gdpr-art82",
    source: "legislation.gov.uk",
    jurisdiction: "GB",
    regulationName: "UK GDPR",
    provision: "Article 82 - Right to compensation and liability",
    text: `UK GDPR Article 82 establishes that any person who has suffered material or non-material damage as a result of an infringement of the Regulation shall have the right to receive compensation from the controller or processor. A processor shall be liable for damage caused by processing only where it has not complied with obligations of the Regulation specifically directed to processors or where it has acted outside or contrary to lawful instructions of the controller. Liability under Article 82 is joint and several where both controller and processor are involved. Contracts that seek to limit or exclude liability for data breaches may conflict with the non-derogable rights of data subjects under this provision.`,
    sectorTags: ["all"],
    clauseTags: ["LIABILITY_CAP", "DATA_PRIVACY", "INDEMNITY"],
    lastUpdated: new Date("2024-01-01"),
    sourceUrl: "https://www.legislation.gov.uk/eur/2016/679/article/82",
  },

  // ── LIABILITY_CAP ────────────────────────────────────────────────────────────
  {
    id: "fca-sysc8",
    source: "handbook.fca.org.uk",
    jurisdiction: "GB",
    regulationName: "FCA Handbook - SYSC 8",
    provision: "SYSC 8.1 - Outsourcing requirements",
    text: `FCA SYSC 8.1 requires that when a firm relies on a third party for the performance of operational functions critical or important to the performance of regulated activities, it must take all reasonable steps to avoid undue additional operational risk. Outsourcing arrangements must include contractual provisions ensuring: (i) the service provider has adequate financial resources, expertise and regulatory authorisation; (ii) the firm can effectively supervise the outsourced function; (iii) the service provider cooperates with the FCA and PRA; (iv) data security is maintained; (v) the firm can terminate the arrangement and ensure continuity of service. Liability caps that prevent a firm from recovering losses from critical operational failures may breach the firm's obligation to manage operational risk under SYSC.`,
    sectorTags: ["financial services"],
    clauseTags: ["LIABILITY_CAP", "BUSINESS_CONTINUITY", "AUDIT_RIGHTS"],
    lastUpdated: new Date("2024-01-01"),
    sourceUrl: "https://www.handbook.fca.org.uk/handbook/SYSC/8/",
  },

  // ── INDEMNITY ────────────────────────────────────────────────────────────────
  {
    id: "ucta-1977",
    source: "legislation.gov.uk",
    jurisdiction: "GB",
    regulationName: "Unfair Contract Terms Act 1977",
    provision: "Sections 2–4 - Restriction of liability",
    text: `The Unfair Contract Terms Act 1977 (UCTA) applies to indemnity clauses in business-to-business contracts. Section 4 provides that a person dealing on the other's written standard terms of business cannot by reference to any contract term be made to indemnify another person (whether a party to the contract or not) in respect of liability incurred by the other for negligence or breach of contract, except in so far as the contract term satisfies the requirement of reasonableness. The reasonableness test (Schedule 2, UCTA) considers: bargaining strength of parties, inducement to agree, knowledge of term, practicability of compliance, and custom and practice. One-sided indemnities in standard form contracts are at heightened risk of being struck down as unreasonable.`,
    sectorTags: ["all"],
    clauseTags: ["INDEMNITY", "LIABILITY_CAP"],
    lastUpdated: new Date("2024-01-01"),
    sourceUrl: "https://www.legislation.gov.uk/ukpga/1977/50/contents",
  },

  // ── PAYMENT_TERMS ────────────────────────────────────────────────────────────
  {
    id: "late-payment-act",
    source: "legislation.gov.uk",
    jurisdiction: "GB",
    regulationName: "Late Payment of Commercial Debts (Interest) Act 1998",
    provision: "Sections 1–8 - Statutory interest on late commercial debts",
    text: `The Late Payment of Commercial Debts (Interest) Act 1998 implies a term into commercial contracts for the supply of goods or services that unpaid contract debts carry statutory interest at 8% per annum above the Bank of England base rate from the date the debt becomes due. The Act also allows the creditor to claim a fixed sum as compensation for late payment (£40 for debts under £1,000; £70 for debts £1,000–£9,999; £100 for debts over £10,000) plus reasonable debt recovery costs. Contractual provisions that purport to oust or limit the Act's provisions are only valid where they provide a substantial contractual remedy for late payment. Payment terms shorter than 30 days may also conflict with the Prompt Payment Code and public sector supply chain requirements.`,
    sectorTags: ["all"],
    clauseTags: ["PAYMENT_TERMS"],
    lastUpdated: new Date("2024-01-01"),
    sourceUrl: "https://www.legislation.gov.uk/ukpga/1998/20/contents",
  },

  // ── ANTI_BRIBERY ────────────────────────────────────────────────────────────
  {
    id: "bribery-act-2010",
    source: "legislation.gov.uk",
    jurisdiction: "GB",
    regulationName: "Bribery Act 2010",
    provision: "Sections 1, 2, 6, 7 - Bribery offences and corporate liability",
    text: `The Bribery Act 2010 creates offences of: bribing another person (s.1); being bribed (s.2); bribing a foreign public official (s.6); and the corporate offence of failure by a commercial organisation to prevent bribery (s.7). The s.7 offence is strict liability - an organisation is liable if a person associated with it (including contractors and suppliers) pays a bribe to obtain or retain business for the organisation, unless the organisation can demonstrate it had 'adequate procedures' in place to prevent bribery. Adequate procedures (per MoJ Guidance) include: proportionate procedures; top-level commitment; risk assessment; due diligence; communication and training; monitoring and review. Contracts with third parties should include anti-bribery warranties and termination rights to support the adequate procedures defence. Maximum sentence: 10 years' imprisonment for individuals; unlimited fine for organisations.`,
    sectorTags: ["all"],
    clauseTags: ["ANTI_BRIBERY"],
    lastUpdated: new Date("2024-01-01"),
    sourceUrl: "https://www.legislation.gov.uk/ukpga/2010/23/contents",
  },

  // ── MODERN_SLAVERY ───────────────────────────────────────────────────────────
  {
    id: "modern-slavery-act-s54",
    source: "legislation.gov.uk",
    jurisdiction: "GB",
    regulationName: "Modern Slavery Act 2015",
    provision: "Section 54 - Transparency in supply chains",
    text: `Modern Slavery Act 2015 section 54 requires commercial organisations with an annual turnover of £36m or more that supply goods or services in the UK to publish an annual slavery and human trafficking statement. The statement must set out steps the organisation has taken during the financial year to ensure that slavery and human trafficking is not taking place in any of its supply chains or in any part of its own business. The Act does not impose a positive obligation on all organisations, but courts and regulators treat the absence of supply chain due diligence as an aggravating factor. Contracts with suppliers should include modern slavery compliance warranties, audit rights, and termination rights for breach to support due diligence obligations. The Home Office recommends modern slavery contractual provisions as best practice even for sub-threshold organisations.`,
    sectorTags: ["all"],
    clauseTags: ["MODERN_SLAVERY", "SUBCONTRACTING"],
    lastUpdated: new Date("2024-01-01"),
    sourceUrl: "https://www.legislation.gov.uk/ukpga/2015/30/section/54",
  },

  // ── LOOT_BOX_MECHANICS ───────────────────────────────────────────────────────
  {
    id: "ksa-gcam-gaming",
    source: "gcam.gov.sa",
    jurisdiction: "SA",
    regulationName: "Saudi Arabia GCAM Gaming Regulations",
    provision: "Loot box and probability disclosure requirements",
    text: `The Saudi Arabia General Commission for Audiovisual Media (GCAM) imposes requirements on games offered in the Kingdom regarding randomised reward mechanics. Games featuring paid randomised reward mechanisms (loot boxes) must disclose the probability rates for each item that can be obtained. Games must not target minors with loot box or gambling-adjacent mechanics. Publishers and platform operators operating in the KSA market should ensure their agreements address compliance with GCAM content standards, probability disclosure obligations, and age-gating requirements. Non-compliance can result in removal from the KSA market and reputational consequences.`,
    sectorTags: ["gaming", "interactive entertainment"],
    clauseTags: ["LOOT_BOX_MECHANICS", "CONTENT_MODERATION"],
    lastUpdated: new Date("2024-01-01"),
    sourceUrl: "https://gcam.gov.sa",
  },
  {
    id: "kr-game-industry-promotion-act",
    source: "law.go.kr",
    jurisdiction: "KR",
    regulationName: "South Korea Game Industry Promotion Act",
    provision: "Article 33 - Probability disclosure for paid randomised items",
    text: `South Korea's Game Industry Promotion Act (게임산업진흥에 관한 법률), as amended, requires game providers to disclose the probability rates of obtaining items through paid randomised mechanisms (loot boxes). Under the Act and the accompanying Game Industry Association self-regulatory code (reinforced by legislative amendment in 2022), game operators must: (i) disclose the probability of acquiring each type of item from a randomised reward system; (ii) display probability information clearly within the game and on official websites; (iii) maintain records of probability settings and ensure actual drop rates match disclosed rates. Failure to comply exposes operators and publishers to administrative penalties, removal from Korean app stores, and civil liability. Developer and publisher agreements should allocate compliance obligations clearly between the parties.`,
    sectorTags: ["gaming", "interactive entertainment"],
    clauseTags: ["LOOT_BOX_MECHANICS", "REGULATORY_CHANGE"],
    lastUpdated: new Date("2024-01-01"),
    sourceUrl: "https://www.law.go.kr/lsInfoP.do?lsiSeq=243948",
  },

  // ── VIRTUAL_ITEMS ────────────────────────────────────────────────────────────
  {
    id: "cma-virtual-goods-guidance",
    source: "gov.uk",
    jurisdiction: "GB",
    regulationName: "CMA Guidance - Consumer protection and online gaming",
    provision: "Virtual items, in-game currency and consumer rights",
    text: `The Competition and Markets Authority (CMA) has issued guidance on consumer protection law as applied to online gaming and virtual goods. Key positions: (i) in-game virtual currency sold to consumers is subject to the Consumer Rights Act 2015 and must be of satisfactory quality and fit for purpose; (ii) terms allowing game providers to alter, remove, or devalue virtual items or currency without reasonable notice or compensation may be unfair under the Consumer Rights Act 2015 Schedule 2; (iii) the practice of offering virtual items for sale that the provider has the unilateral right to discontinue may engage unfair terms provisions; (iv) where real money is exchanged for virtual currency which is then used to purchase randomised items, this may engage consumer protection obligations regarding transparency of value and pricing. Contracts between developers and publishers should clearly allocate responsibility for consumer-facing compliance obligations.`,
    sectorTags: ["gaming", "interactive entertainment", "media"],
    clauseTags: ["VIRTUAL_ITEMS", "LOOT_BOX_MECHANICS", "CONTENT_MODERATION"],
    lastUpdated: new Date("2024-01-01"),
    sourceUrl: "https://www.gov.uk/government/publications/online-gaming-consumer-protection-and-compliance",
  },
];

// Retrieve regulatory context relevant to a specific clause analysis
export async function getRegulatoryContext(params: {
  clauseCategory: string;
  jurisdiction: string;
  sector: string;
}): Promise<RegulatoryDocument[]> {
  // V1: Returns curated static regulatory snippets
  // V2: Will query pgvector database with semantic search
  return getStaticRegulatoryContext(params);
}

// Format regulatory documents for injection into an LLM prompt
export function formatRegulatoryContextForPrompt(docs: RegulatoryDocument[]): string {
  if (docs.length === 0) return "";

  const today = new Date().toISOString().split("T")[0];
  const snippets = docs.map((doc) =>
    `[${doc.regulationName} - ${doc.provision} (${doc.jurisdiction}, source: ${doc.source})]\n${doc.text}`
  );

  return `\n\nREGULATORY CONTEXT (current as of ${today}):\n${snippets.join("\n\n")}\n\nWhen assessing this clause, consider whether it conflicts with or is constrained by the above regulatory provisions. Cite specific provisions in your output where relevant.`;
}

// Fetch latest updates from live government APIs (V2)
export async function fetchLatestRegulations(jurisdiction: string): Promise<void> {
  // TODO V2: Implement live fetching from:
  // GB: GET https://www.legislation.gov.uk/api/1/search?text=...
  // EU: GET https://eur-lex.europa.eu/search.html?...
  // etc.
  console.log(`[RegEngine] Live fetching not yet configured for ${jurisdiction}`);
}

// ── Internal lookup ────────────────────────────────────────────────────────────

function getStaticRegulatoryContext(params: {
  clauseCategory: string;
  jurisdiction: string;
  sector: string;
}): RegulatoryDocument[] {
  const { clauseCategory, jurisdiction, sector } = params;

  // Normalise inputs for matching
  const normSector = sector.toLowerCase();

  return STATIC_REGULATORY_DOCUMENTS.filter((doc) => {
    // Must match clause category
    if (!doc.clauseTags.includes(clauseCategory)) return false;

    // Jurisdiction filter: include if doc is "all jurisdictions" (GB docs apply broadly as baseline),
    // or if the doc's jurisdiction matches (loosely) the requested one
    const jurisdictionMatch =
      doc.jurisdiction === "GB" ||
      doc.jurisdiction === jurisdiction ||
      jurisdiction.toUpperCase().includes(doc.jurisdiction) ||
      doc.jurisdiction === "EU" && jurisdiction.toLowerCase().includes("eu");

    if (!jurisdictionMatch) {
      // Only include non-GB/EU docs if jurisdiction explicitly matches
      if (doc.jurisdiction !== "GB" && doc.jurisdiction !== "EU") {
        const explicitMatch =
          (doc.jurisdiction === "SA" && (jurisdiction.toUpperCase().includes("SA") || jurisdiction.toLowerCase().includes("saudi"))) ||
          (doc.jurisdiction === "KR" && (jurisdiction.toUpperCase().includes("KR") || jurisdiction.toLowerCase().includes("korea")));
        if (!explicitMatch) return false;
      }
    }

    // Sector filter: "all" tagged docs always match; sector-specific docs only match if sector overlaps
    const sectorMatch =
      doc.sectorTags.includes("all") ||
      doc.sectorTags.some((tag) => normSector.includes(tag) || tag.includes(normSector.split(" ")[0]));

    return sectorMatch;
  });
}
