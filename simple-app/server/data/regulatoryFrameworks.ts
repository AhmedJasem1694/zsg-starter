export type Jurisdiction = "GB" | "EU" | "US" | "SG" | "AE";

export interface RegulatoryFramework {
  code: string;
  jurisdiction: Jurisdiction;
  regulator: string;
  frameworkName: string;
  description: string;
  contractRelevance: string;
  sectorTags: string[];
  keyObligations: string[];
}

export const REGULATORY_FRAMEWORKS: RegulatoryFramework[] = [
  // ─── UK (GB) ────────────────────────────────────────────────────────────────
  {
    code: "GB_FCA_FSMA",
    jurisdiction: "GB",
    regulator: "FCA",
    frameworkName: "Financial Services and Markets Act 2000 (FSMA)",
    description: "Primary UK financial services legislation requiring FCA authorisation for regulated activities including accepting deposits, dealing in investments, and arranging financial transactions.",
    contractRelevance: "Contracts for financial services, payment processing, lending, investment management, or insurance must include appropriate regulatory permissions and client categorisation clauses.",
    sectorTags: ["fintech", "financial services", "banking", "insurance", "investment", "payments", "lending", "wealth management"],
    keyObligations: [
      "Contracting party must hold appropriate FCA authorisation or be exempt",
      "Client classification (retail, professional, eligible counterparty) must be documented",
      "Contracts must include FCA-compliant risk warnings where applicable",
      "Financial promotions must be approved by an authorised person",
      "Regulatory change clauses required to address evolving FCA rules",
    ],
  },
  {
    code: "GB_FCA_CONSUMER_DUTY",
    jurisdiction: "GB",
    regulator: "FCA",
    frameworkName: "FCA Consumer Duty (PS22/9)",
    description: "FCA principle requiring firms to deliver good outcomes for retail customers across products, price/value, consumer understanding, and consumer support. In force from July 2023.",
    contractRelevance: "B2C contracts and contracts with firms serving retail customers must reflect Consumer Duty obligations, particularly around fair value, clear communications, and adequate support.",
    sectorTags: ["fintech", "financial services", "banking", "insurance", "retail", "consumer", "lending", "payments"],
    keyObligations: [
      "Products and services must deliver fair value to retail customers",
      "Communications must be clear, fair, and not misleading",
      "Firms must provide adequate support to help customers achieve their financial objectives",
      "Contracts must not contain terms that create foreseeable harm",
      "Annual Consumer Duty board reporting obligations must be reflected in supply chain contracts",
    ],
  },
  {
    code: "GB_ICO_UK_GDPR",
    jurisdiction: "GB",
    regulator: "ICO",
    frameworkName: "UK GDPR & Data Protection Act 2018",
    description: "UK data protection law governing the collection, processing, and transfer of personal data. Post-Brexit equivalent of EU GDPR, enforced by the Information Commissioner's Office.",
    contractRelevance: "Any contract involving processing of personal data of UK residents requires a Data Processing Agreement (DPA), lawful basis documentation, and international transfer mechanisms.",
    sectorTags: ["all", "data", "technology", "saas", "healthcare", "fintech", "hr", "marketing", "research"],
    keyObligations: [
      "Data Processing Agreement required when processor handles personal data on controller's behalf",
      "UK Standard Contractual Clauses (UK SCCs) required for international data transfers",
      "Data subject rights (access, erasure, portability) must be contractually supported",
      "Breach notification obligations (72 hours to ICO) must be reflected in supply agreements",
      "Data retention and deletion schedules must be contractually specified",
    ],
  },
  {
    code: "GB_ICO_PECR",
    jurisdiction: "GB",
    regulator: "ICO",
    frameworkName: "Privacy and Electronic Communications Regulations (PECR)",
    description: "UK regulations governing electronic marketing, cookies, and communications data. Applies to all organisations sending marketing emails, texts, or using tracking technologies.",
    contractRelevance: "Contracts with marketing technology providers, analytics vendors, or email platforms must include PECR compliance obligations and consent management requirements.",
    sectorTags: ["marketing", "technology", "saas", "retail", "ecommerce", "advertising", "analytics"],
    keyObligations: [
      "Consent must be obtained before sending unsolicited electronic marketing",
      "Cookie consent mechanisms must be technically compliant",
      "Marketing platforms must provide suppression list management",
      "Vendors must not use communications data for purposes beyond the original collection",
    ],
  },
  {
    code: "GB_CMA",
    jurisdiction: "GB",
    regulator: "CMA",
    frameworkName: "Competition Act 1998 / Enterprise Act 2002",
    description: "UK competition law prohibiting anti-competitive agreements, abuse of dominance, and requiring merger control notifications above thresholds.",
    contractRelevance: "Commercial contracts must not contain anti-competitive clauses such as price-fixing, market-sharing, or exclusivity arrangements that restrict competition.",
    sectorTags: ["all", "distribution", "technology", "retail", "manufacturing", "financial services"],
    keyObligations: [
      "Exclusivity clauses must be assessed for anti-competitive effect",
      "Most Favoured Nation (MFN) clauses require careful drafting to avoid CMA scrutiny",
      "Non-compete clauses must be proportionate in scope and duration",
      "Information sharing provisions must not facilitate price coordination",
    ],
  },
  {
    code: "GB_MHRA",
    jurisdiction: "GB",
    regulator: "MHRA",
    frameworkName: "UK Medical Devices Regulations 2002 (SI 2002/618)",
    description: "UK regulations governing the design, manufacture, and commercialisation of medical devices. MHRA is the post-Brexit UK regulatory authority replacing CE marking with UKCA marking.",
    contractRelevance: "Contracts for medical device supply, distribution, or clinical trials must include regulatory compliance obligations, adverse event reporting, and recall procedures.",
    sectorTags: ["healthcare", "medtech", "medical devices", "pharma", "biotech", "diagnostics"],
    keyObligations: [
      "UKCA marking requirements must be contractually allocated between parties",
      "Adverse event and vigilance reporting obligations must be clearly assigned",
      "Quality management system requirements (ISO 13485) must flow down to suppliers",
      "Post-market surveillance obligations must be reflected in ongoing contracts",
    ],
  },
  {
    code: "GB_PRA",
    jurisdiction: "GB",
    regulator: "PRA",
    frameworkName: "Prudential Regulation Authority (PRA) Rules",
    description: "Prudential regulation for banks, insurers, and systemically important financial institutions in the UK, focusing on financial soundness and operational resilience.",
    contractRelevance: "Material outsourcing arrangements by PRA-regulated firms require PRA notification, exit plans, and specific contractual provisions under SS2/21.",
    sectorTags: ["banking", "insurance", "financial services", "fintech"],
    keyObligations: [
      "Material outsourcing contracts must include right of access and audit for PRA",
      "Exit strategies and termination rights must be included in critical outsourcing",
      "Sub-outsourcing restrictions must be clearly addressed",
      "Business continuity and operational resilience obligations must flow down",
    ],
  },

  // ─── EU ─────────────────────────────────────────────────────────────────────
  {
    code: "EU_GDPR",
    jurisdiction: "EU",
    regulator: "Data Protection Authorities",
    frameworkName: "EU General Data Protection Regulation (GDPR) 2016/679",
    description: "EU data protection regulation applying to all organisations processing personal data of EU residents. Maximum fines of €20M or 4% of global annual turnover.",
    contractRelevance: "All contracts involving processing of EU residents' personal data require a compliant DPA, Standard Contractual Clauses for international transfers, and comprehensive data rights provisions.",
    sectorTags: ["all", "data", "technology", "saas", "healthcare", "fintech", "hr", "marketing", "research", "ecommerce"],
    keyObligations: [
      "Data Processing Agreement (Article 28) required for all processor relationships",
      "Standard Contractual Clauses (SCCs) required for data transfers outside EEA",
      "Records of processing activities must be maintained",
      "Data breach notification (72 hours) obligations must be contractually allocated",
      "Data Protection Impact Assessments required for high-risk processing",
    ],
  },
  {
    code: "EU_MIFID2",
    jurisdiction: "EU",
    regulator: "ESMA / National NCAs",
    frameworkName: "Markets in Financial Instruments Directive II (MiFID II)",
    description: "EU legislation regulating investment services, trading, and market transparency. Applies to investment firms, trading venues, and data reporting services.",
    contractRelevance: "Contracts for investment services, order execution, and financial data must include MiFID II client classification, best execution policies, and inducement restrictions.",
    sectorTags: ["fintech", "financial services", "investment", "trading", "asset management", "wealth management"],
    keyObligations: [
      "Client categorisation (retail, professional, eligible counterparty) must be documented",
      "Best execution obligations must be contractually reflected",
      "Research unbundling requirements must be addressed in investment agreements",
      "Transaction reporting obligations must be allocated between parties",
      "Inducement restrictions must be reflected in distribution agreements",
    ],
  },
  {
    code: "EU_AI_ACT",
    jurisdiction: "EU",
    regulator: "National Market Surveillance Authorities",
    frameworkName: "EU Artificial Intelligence Act (Regulation 2024/1689)",
    description: "World's first comprehensive AI regulation, classifying AI systems by risk level. Prohibits certain AI applications and imposes strict obligations on high-risk AI systems. In phased implementation from 2024-2027.",
    contractRelevance: "Contracts involving AI systems must address risk classification, conformity assessments, technical documentation, human oversight, and transparency obligations.",
    sectorTags: ["technology", "ai", "saas", "healthcare", "fintech", "hr", "law enforcement", "education", "recruitment"],
    keyObligations: [
      "AI system risk classification must be contractually documented",
      "High-risk AI systems require conformity assessment before deployment",
      "Technical documentation and logging requirements must be maintained",
      "Human oversight mechanisms must be contractually specified",
      "Transparency obligations to end users must be contractually allocated",
    ],
  },
  {
    code: "EU_MDR",
    jurisdiction: "EU",
    regulator: "EMA / National Competent Authorities",
    frameworkName: "EU Medical Device Regulation (MDR) 2017/745",
    description: "EU regulation governing medical devices, requiring CE marking, clinical evaluation, and post-market surveillance. Stricter than predecessor MDD.",
    contractRelevance: "Contracts for EU medical device manufacture, distribution, or clinical investigation must include MDR compliance obligations, notified body requirements, and vigilance reporting.",
    sectorTags: ["healthcare", "medtech", "medical devices", "pharma", "biotech", "diagnostics"],
    keyObligations: [
      "CE marking obligations must be clearly allocated between manufacturer and authorised representative",
      "Unique Device Identification (UDI) requirements must be addressed",
      "Post-market clinical follow-up obligations must be contractually specified",
      "Serious incident reporting timelines must be contractually allocated",
    ],
  },
  {
    code: "EU_DORA",
    jurisdiction: "EU",
    regulator: "ESAs (EBA, EIOPA, ESMA)",
    frameworkName: "Digital Operational Resilience Act (DORA) 2022/2554",
    description: "EU regulation requiring financial entities to manage ICT risks and third-party technology risks. Applies to banks, insurers, investment firms, and their critical ICT providers from January 2025.",
    contractRelevance: "ICT service contracts with EU financial entities must include DORA-compliant provisions on service levels, exit plans, audit rights, sub-contracting, and incident reporting.",
    sectorTags: ["technology", "saas", "cloud", "fintech", "financial services", "banking", "insurance", "cybersecurity"],
    keyObligations: [
      "ICT contracts must include full service description, SLAs, and data location",
      "Audit rights and right of access for financial entity and regulators must be included",
      "Incident reporting and notification timelines must be contractually specified",
      "Exit strategy and termination assistance provisions are mandatory",
      "Sub-outsourcing chains must be transparent and contractually controlled",
    ],
  },
  {
    code: "EU_NIS2",
    jurisdiction: "EU",
    regulator: "National Cybersecurity Authorities",
    frameworkName: "Network and Information Security Directive 2 (NIS2) 2022/2555",
    description: "EU cybersecurity directive requiring essential and important entities to implement security measures and report incidents. Significantly expanded scope from NIS1.",
    contractRelevance: "Supply chain security obligations under NIS2 require entities to contractually address cybersecurity measures with suppliers and service providers.",
    sectorTags: ["technology", "saas", "cloud", "critical infrastructure", "healthcare", "energy", "transport", "financial services"],
    keyObligations: [
      "Cybersecurity risk management measures must flow down to supply chain contracts",
      "Incident notification timelines (24h early warning, 72h incident report) must be contractually allocated",
      "Business continuity and crisis management requirements must be addressed",
      "Security of ICT products and services in supply chain must be contractually assured",
    ],
  },
  {
    code: "EU_EPRIVACY",
    jurisdiction: "EU",
    regulator: "National Data Protection Authorities",
    frameworkName: "ePrivacy Directive 2002/58/EC (Cookie Law)",
    description: "EU directive governing electronic communications privacy, cookies, and direct marketing. Currently being replaced by the proposed ePrivacy Regulation.",
    contractRelevance: "Marketing technology, analytics, and communications contracts must include ePrivacy-compliant consent management and cookie handling obligations.",
    sectorTags: ["marketing", "technology", "saas", "retail", "ecommerce", "advertising", "analytics", "telecommunications"],
    keyObligations: [
      "Prior informed consent required for cookies and tracking technologies",
      "Electronic marketing opt-in requirements must be contractually supported",
      "Vendor contracts must include data minimisation for analytics",
    ],
  },

  // ─── US ─────────────────────────────────────────────────────────────────────
  {
    code: "US_SEC",
    jurisdiction: "US",
    regulator: "SEC",
    frameworkName: "Securities Exchange Act 1934 / Advisers Act 1940",
    description: "Federal securities laws governing public company disclosure, investment adviser registration, and securities trading. SEC enforcement carries civil and criminal penalties.",
    contractRelevance: "Contracts with investment advisers, broker-dealers, or involving securities must comply with SEC registration requirements, fiduciary obligations, and disclosure rules.",
    sectorTags: ["financial services", "investment", "fintech", "asset management", "private equity", "venture capital", "crypto"],
    keyObligations: [
      "Investment adviser agreements must reflect fiduciary duty and Form ADV disclosures",
      "Performance fee arrangements must comply with qualified client requirements",
      "Custody arrangements must meet SEC Rule 206(4)-2 requirements",
      "Solicitation agreements must comply with pay-to-play rules",
    ],
  },
  {
    code: "US_FTC",
    jurisdiction: "US",
    regulator: "FTC",
    frameworkName: "FTC Act Section 5 / Unfair or Deceptive Acts and Practices (UDAP)",
    description: "Federal prohibition on unfair or deceptive business practices. FTC actively enforces against data privacy violations, misleading AI claims, and anti-competitive conduct.",
    contractRelevance: "Contracts must not include deceptive terms, misleading AI capability claims, or data practices inconsistent with consumer-facing privacy representations.",
    sectorTags: ["all", "technology", "retail", "ecommerce", "marketing", "consumer", "financial services", "ai"],
    keyObligations: [
      "Contract terms must be consistent with consumer-facing representations",
      "Data practices must match privacy policy representations",
      "AI capability claims must be accurate and not misleading",
      "Non-compete and exclusivity provisions face increased FTC scrutiny",
    ],
  },
  {
    code: "US_HIPAA",
    jurisdiction: "US",
    regulator: "HHS Office for Civil Rights",
    frameworkName: "Health Insurance Portability and Accountability Act (HIPAA)",
    description: "Federal law protecting health information privacy and security. Requires Business Associate Agreements with any vendor handling Protected Health Information (PHI).",
    contractRelevance: "Any vendor, technology provider, or service partner handling PHI must execute a Business Associate Agreement (BAA) with specific HIPAA-compliant provisions.",
    sectorTags: ["healthcare", "medtech", "health insurance", "pharma", "technology", "saas", "hr"],
    keyObligations: [
      "Business Associate Agreement (BAA) required before accessing any PHI",
      "Minimum necessary standard for PHI access must be contractually implemented",
      "Breach notification obligations (60 days) must be contractually allocated",
      "PHI must not be used for marketing without patient authorisation",
      "Return or destruction of PHI on contract termination must be addressed",
    ],
  },
  {
    code: "US_CCPA_CPRA",
    jurisdiction: "US",
    regulator: "California Privacy Protection Agency (CPPA)",
    frameworkName: "California Consumer Privacy Act / California Privacy Rights Act (CCPA/CPRA)",
    description: "California's comprehensive privacy law giving consumers rights over personal information. CPRA amendments effective January 2023 created the CPPA and added sensitive personal information protections.",
    contractRelevance: "Contracts involving personal information of California residents must include CCPA/CPRA service provider agreements, data deletion rights, and opt-out of sale provisions.",
    sectorTags: ["all", "technology", "saas", "retail", "ecommerce", "marketing", "healthcare", "fintech"],
    keyObligations: [
      "Service Provider Agreement required to avoid being classified as a 'sale' of personal information",
      "Consumer rights (deletion, portability, opt-out) must be technically supportable",
      "Sensitive personal information use restrictions must be contractually specified",
      "Annual cybersecurity audits required for high-risk processing activities",
      "Data retention limits must be contractually addressed",
    ],
  },
  {
    code: "US_CFPB",
    jurisdiction: "US",
    regulator: "CFPB",
    frameworkName: "Consumer Financial Protection Bureau (CFPB) Regulations",
    description: "Federal consumer financial protection rules covering lending, payments, debt collection, and credit reporting. Enforces TILA, FCRA, ECOA, and related statutes.",
    contractRelevance: "Contracts for consumer lending, payment services, credit reporting, or debt collection must comply with CFPB regulations and include compliant disclosure obligations.",
    sectorTags: ["fintech", "lending", "payments", "financial services", "banking", "consumer"],
    keyObligations: [
      "Truth in Lending Act (TILA) disclosure requirements must be contractually supported",
      "Fair Credit Reporting Act obligations must flow down to credit data handlers",
      "Equal Credit Opportunity Act requirements must be addressed in lending agreements",
      "Unfair, Deceptive, or Abusive Acts or Practices (UDAAP) compliance must be warranted",
    ],
  },
  {
    code: "US_SOX",
    jurisdiction: "US",
    regulator: "SEC / PCAOB",
    frameworkName: "Sarbanes-Oxley Act (SOX)",
    description: "Federal law imposing financial reporting and internal control requirements on US public companies. Section 302 and 404 certifications are mandatory for SEC reporting companies.",
    contractRelevance: "Contracts with audit firms, financial technology providers, and outsourced finance functions must address SOX compliance obligations and audit access rights.",
    sectorTags: ["financial services", "technology", "saas", "accounting", "audit"],
    keyObligations: [
      "Audit trail and record retention requirements must be contractually specified (7 years)",
      "Access controls and segregation of duties requirements must flow down",
      "Whistleblower protection provisions must be contractually reflected",
      "Right of auditor access must be included in relevant service agreements",
    ],
  },
  {
    code: "US_EXPORT_CONTROLS",
    jurisdiction: "US",
    regulator: "BIS / OFAC / State Dept",
    frameworkName: "Export Controls (EAR, ITAR) & OFAC Sanctions",
    description: "US export control laws governing the transfer of technology, software, and services to foreign nationals and jurisdictions. OFAC administers sanctions programmes.",
    contractRelevance: "Technology licensing, SaaS, and international supply contracts must include export control compliance warranties, end-user certifications, and sanctions screening obligations.",
    sectorTags: ["technology", "saas", "defence", "aerospace", "manufacturing", "ai", "semiconductor"],
    keyObligations: [
      "Export control compliance representations and warranties must be included",
      "End-user and end-use certificates required for controlled technology",
      "OFAC sanctions screening obligations must be contractually allocated",
      "Deemed export restrictions on sharing technology with foreign nationals must be addressed",
    ],
  },

  // ─── Singapore (SG) ─────────────────────────────────────────────────────────
  {
    code: "SG_MAS_LICENSING",
    jurisdiction: "SG",
    regulator: "MAS",
    frameworkName: "Monetary Authority of Singapore Act / Payment Services Act 2019",
    description: "MAS regulates financial services in Singapore including banking, capital markets, insurance, and payment services. Payment Services Act 2019 regulates digital payment token services.",
    contractRelevance: "Contracts for financial services, payment processing, or digital assets in Singapore must address MAS licensing requirements and regulatory obligations.",
    sectorTags: ["fintech", "financial services", "banking", "payments", "crypto", "investment", "insurance"],
    keyObligations: [
      "Contracting party must hold appropriate MAS licence or exemption",
      "Anti-money laundering (AML) and counter-terrorism financing (CTF) obligations must flow down",
      "Technology risk management requirements per MAS TRM Guidelines must be addressed",
      "Outsourcing notification requirements to MAS must be reflected in agreements",
    ],
  },
  {
    code: "SG_PDPA",
    jurisdiction: "SG",
    regulator: "Personal Data Protection Commission (PDPC)",
    frameworkName: "Personal Data Protection Act 2012 (PDPA)",
    description: "Singapore's primary data protection law governing collection, use, and disclosure of personal data. Mandatory data breach notification introduced in 2021 amendments.",
    contractRelevance: "Contracts processing personal data of Singapore residents require data protection clauses, processor obligations, and breach notification provisions.",
    sectorTags: ["all", "technology", "saas", "healthcare", "fintech", "hr", "retail", "marketing"],
    keyObligations: [
      "Data Protection Officer (DPO) designation and contact details must be addressable",
      "Mandatory breach notification (3 business days for significant breaches) must be contractually allocated",
      "Data portability obligation must be technically supportable",
      "Accountability obligations require vendors to implement appropriate data protection measures",
      "Do Not Call Registry compliance required for direct marketing",
    ],
  },
  {
    code: "SG_MAS_TRM",
    jurisdiction: "SG",
    regulator: "MAS",
    frameworkName: "MAS Technology Risk Management Guidelines (TRM 2021)",
    description: "MAS guidelines requiring financial institutions to establish robust technology risk governance, cybersecurity, and IT resilience frameworks. Compliance expected for all MAS-regulated entities.",
    contractRelevance: "Technology outsourcing contracts with MAS-regulated entities must include TRM-compliant provisions on security standards, incident reporting, audit rights, and concentration risk.",
    sectorTags: ["technology", "saas", "cloud", "fintech", "financial services", "banking", "cybersecurity"],
    keyObligations: [
      "Technology service providers must implement MAS-aligned security standards",
      "Incident reporting obligations and timelines must be contractually specified",
      "Right of access and audit for MAS and regulated entity must be included",
      "Data residency and localisation requirements must be addressed",
      "Concentration risk from single vendor dependency must be contractually managed",
    ],
  },
  {
    code: "SG_COMPETITION",
    jurisdiction: "SG",
    regulator: "Competition and Consumer Commission of Singapore (CCCS)",
    frameworkName: "Competition Act 2004",
    description: "Singapore competition law prohibiting anti-competitive agreements, abuse of dominance, and providing for merger regulation.",
    contractRelevance: "Distribution, licensing, and commercial agreements must not contain clauses that prevent, restrict, or distort competition in Singapore markets.",
    sectorTags: ["all", "distribution", "technology", "retail", "manufacturing", "financial services"],
    keyObligations: [
      "Price-fixing, market-sharing, and bid-rigging provisions are prohibited",
      "Exclusive dealing arrangements must be assessed for competitive effects",
      "Non-compete clauses must be proportionate and ancillary to a legitimate transaction",
    ],
  },

  // ─── UAE (AE) ───────────────────────────────────────────────────────────────
  {
    code: "AE_DIFC",
    jurisdiction: "AE",
    regulator: "DFSA",
    frameworkName: "DIFC Laws and DFSA Rulebook",
    description: "Dubai International Financial Centre operates as a separate jurisdiction with English common law and its own financial regulator (DFSA). Common incorporation jurisdiction for funds, financial services, and regional holding companies.",
    contractRelevance: "Contracts governed by DIFC law or involving DFSA-regulated activities must comply with DFSA rules on client assets, conduct of business, and financial promotions.",
    sectorTags: ["fintech", "financial services", "investment", "private equity", "venture capital", "banking", "insurance", "funds"],
    keyObligations: [
      "DFSA authorisation required for financial services activities in or from DIFC",
      "Client classification (retail, professional) must be documented per DFSA COB Rules",
      "Financial promotions must comply with DFSA marketing restrictions",
      "DIFC data protection law (DIFC DP Law 5 of 2020) applies alongside DFSA rules",
      "Dispute resolution through DIFC Courts or DIAC arbitration is commonly specified",
    ],
  },
  {
    code: "AE_ADGM",
    jurisdiction: "AE",
    regulator: "FSRA",
    frameworkName: "Abu Dhabi Global Market (ADGM) / FSRA Regulations",
    description: "Abu Dhabi's international financial centre with English common law jurisdiction. FSRA regulates financial services. Growing hub for asset management, fintech, and digital assets.",
    contractRelevance: "Contracts within ADGM jurisdiction or with FSRA-regulated entities must comply with FSRA conduct rules, capital requirements, and client protection obligations.",
    sectorTags: ["fintech", "financial services", "investment", "asset management", "crypto", "banking", "funds"],
    keyObligations: [
      "FSRA authorisation required for regulated activities in ADGM",
      "ADGM Data Protection Regulations 2021 apply to personal data processing",
      "Virtual asset activities require specific FSRA permissions",
      "Market conduct rules including anti-market manipulation must be contractually reflected",
    ],
  },
  {
    code: "AE_PDPL",
    jurisdiction: "AE",
    regulator: "UAE Data Office",
    frameworkName: "UAE Personal Data Protection Law (PDPL) Federal Law No. 45 of 2021",
    description: "UAE's first comprehensive federal data protection law, modelled partially on GDPR. Applies to processing of personal data in the UAE (excluding DIFC and ADGM which have their own laws).",
    contractRelevance: "Contracts processing personal data of UAE residents or involving data processing in the UAE mainland must include PDPL-compliant data processing and transfer provisions.",
    sectorTags: ["all", "technology", "saas", "healthcare", "fintech", "retail", "hr", "marketing"],
    keyObligations: [
      "Lawful basis for processing personal data must be documented",
      "Cross-border data transfer restrictions require adequate protection determination",
      "Data subject rights (access, correction, erasure, portability) must be technically supportable",
      "Data breach notification to UAE Data Office within 72 hours of discovery",
      "Data Protection Officer required for certain processing activities",
    ],
  },
  {
    code: "AE_VARA",
    jurisdiction: "AE",
    regulator: "VARA",
    frameworkName: "Virtual Assets Regulatory Authority (VARA) Regulations",
    description: "Dubai's VARA regulates virtual asset activities in the Emirate of Dubai (outside DIFC). One of the world's first dedicated virtual asset regulatory frameworks.",
    contractRelevance: "Contracts for crypto, digital asset, DeFi, NFT, or blockchain services involving Dubai entities must address VARA licensing, AML, and conduct requirements.",
    sectorTags: ["crypto", "blockchain", "web3", "fintech", "digital assets", "nft", "defi"],
    keyObligations: [
      "VARA licence or registration required for virtual asset activities in Dubai",
      "AML/CFT compliance obligations must be contractually reflected",
      "Consumer protection and market conduct requirements must be addressed",
      "Custody and asset segregation requirements for virtual assets must be specified",
    ],
  },
  {
    code: "AE_CBUAE",
    jurisdiction: "AE",
    regulator: "Central Bank of UAE (CBUAE)",
    frameworkName: "CBUAE Regulations / UAE Banking Law",
    description: "CBUAE regulates banks, finance companies, payment service providers, and insurance companies in the UAE mainland. Payment token services regulated under Retail Payment Services and Card Schemes Regulation.",
    contractRelevance: "Contracts for UAE banking, payment processing, or financial services on the mainland require CBUAE-compliant provisions on licensing, AML, and consumer protection.",
    sectorTags: ["banking", "fintech", "payments", "financial services", "insurance", "lending"],
    keyObligations: [
      "CBUAE licence required for regulated financial activities on UAE mainland",
      "AML/CFT compliance with UAE Federal AML Law must be contractually warranted",
      "Consumer protection obligations under CBUAE Consumer Protection Regulation apply",
      "Outsourcing to third parties requires CBUAE notification for material arrangements",
    ],
  },
  {
    code: "AE_SCA",
    jurisdiction: "AE",
    regulator: "Securities and Commodities Authority (SCA)",
    frameworkName: "UAE Securities and Commodities Authority Regulations",
    description: "SCA regulates securities markets and investment activities in the UAE outside DIFC and ADGM. Oversees UAE financial markets including ADX and DFM.",
    contractRelevance: "Contracts involving investment advisory, brokerage, or fund management activities in UAE mainland require SCA authorisation and conduct compliance.",
    sectorTags: ["investment", "financial services", "asset management", "venture capital", "private equity", "trading"],
    keyObligations: [
      "SCA licence required for regulated investment activities outside DIFC/ADGM",
      "Investment promotion and marketing restrictions must be contractually reflected",
      "Client categorisation and suitability obligations must be documented",
    ],
  },
];

export function getFrameworksByJurisdiction(jurisdiction: Jurisdiction): RegulatoryFramework[] {
  return REGULATORY_FRAMEWORKS.filter((f) => f.jurisdiction === jurisdiction);
}

export function detectFrameworks(
  sector: string,
  jurisdictions: Jurisdiction[]
): RegulatoryFramework[] {
  const sectorLower = sector.toLowerCase();

  return REGULATORY_FRAMEWORKS.filter((framework) => {
    if (!jurisdictions.includes(framework.jurisdiction)) return false;

    return framework.sectorTags.some(
      (tag) =>
        tag === "all" ||
        sectorLower.includes(tag) ||
        tag.includes(sectorLower.split(" ")[0]) ||
        SECTOR_ALIASES[tag]?.some((alias) => sectorLower.includes(alias))
    );
  });
}

// Sector keyword aliases for better matching
const SECTOR_ALIASES: Record<string, string[]> = {
  fintech: ["financial technology", "finance", "payments", "neobank", "challenger bank"],
  "financial services": ["finance", "financial", "banking", "wealth"],
  technology: ["tech", "software", "saas", "platform", "digital"],
  healthcare: ["health", "medical", "clinical", "hospital", "care"],
  medtech: ["medical technology", "medical device", "diagnostics", "wearable"],
  insurance: ["insurtech", "insurer", "underwriting", "reinsurance"],
  crypto: ["cryptocurrency", "blockchain", "web3", "digital asset", "token", "defi", "nft"],
  retail: ["ecommerce", "e-commerce", "consumer", "marketplace"],
  "private equity": ["pe", "buyout", "fund"],
  "venture capital": ["vc", "venture", "startup investment"],
};
