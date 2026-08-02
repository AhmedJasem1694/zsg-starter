// ── Verified regulatory source registry ───────────────────────────────────────
// Verifiable source data for regulatory frameworks. A framework may only be
// surfaced as review context or displayed to a user if it has a complete entry
// here: official instrument name, reference number, issuing body, and an
// official citation URL. Frameworks without a source entry are treated as
// unsourced and never displayed, keeping the regulatory layer safe for
// regulated buyers. Nothing here is generated; every entry is curated from the
// official instrument.

export interface RegulatorySource {
  /** Official instrument name as published by the issuing body. */
  officialName: string;
  /** Official reference or citation number (act chapter, regulation number, policy statement id). */
  referenceNumber: string;
  /** Issuing body responsible for the instrument. */
  issuingBody: string;
  /** Link to the official published source. */
  citationUrl: string;
}

export const REGULATORY_SOURCES: Record<string, RegulatorySource> = {
  GB_FCA_FSMA: {
    officialName: "Financial Services and Markets Act 2000",
    referenceNumber: "2000 c.8",
    issuingBody: "UK Parliament (administered by the Financial Conduct Authority)",
    citationUrl: "https://www.legislation.gov.uk/ukpga/2000/8/contents",
  },
  GB_FCA_CONSUMER_DUTY: {
    officialName: "A new Consumer Duty (Feedback to CP21/36 and final rules)",
    referenceNumber: "FCA Policy Statement PS22/9",
    issuingBody: "Financial Conduct Authority",
    citationUrl: "https://www.fca.org.uk/publications/policy-statements/ps22-9-new-consumer-duty",
  },
  GB_UK_GDPR: {
    officialName: "Regulation (EU) 2016/679 as it forms part of assimilated law (UK GDPR)",
    referenceNumber: "Regulation (EU) 2016/679 (assimilated)",
    issuingBody: "UK Parliament, assimilated law (enforced by the Information Commissioner's Office)",
    citationUrl: "https://www.legislation.gov.uk/eur/2016/679/contents",
  },
  // Key retained for continuity. The instrument is the Data Protection Act
  // 2018, which sits alongside the UK GDPR rather than restating it.
  GB_ICO_UK_GDPR: {
    officialName: "Data Protection Act 2018",
    referenceNumber: "2018 c.12",
    issuingBody: "UK Parliament (enforced by the Information Commissioner's Office)",
    citationUrl: "https://www.legislation.gov.uk/ukpga/2018/12/contents",
  },
  GB_PRA: {
    officialName: "PRA Rulebook",
    referenceNumber: "FSMA 2000, Part 9A (PRA rules)",
    issuingBody: "Prudential Regulation Authority",
    citationUrl: "https://www.prarulebook.co.uk/",
  },
  GB_CMA: {
    officialName: "Competition Act 1998",
    referenceNumber: "1998 c.41",
    issuingBody: "Competition and Markets Authority",
    citationUrl: "https://www.legislation.gov.uk/ukpga/1998/41/contents",
  },
  GB_COMPANIES_ACT_2006: {
    officialName: "Companies Act 2006",
    referenceNumber: "2006 c.46",
    issuingBody: "UK Parliament (Companies House)",
    citationUrl: "https://www.legislation.gov.uk/ukpga/2006/46/contents",
  },
  GB_BRIBERY_ACT_2010: {
    officialName: "Bribery Act 2010",
    referenceNumber: "2010 c.23",
    issuingBody: "UK Parliament (Serious Fraud Office)",
    citationUrl: "https://www.legislation.gov.uk/ukpga/2010/23/contents",
  },
  GB_MODERN_SLAVERY_ACT_2015: {
    officialName: "Modern Slavery Act 2015, section 54 (Transparency in supply chains etc)",
    referenceNumber: "2015 c.30, s.54",
    issuingBody: "UK Parliament (Home Office)",
    citationUrl: "https://www.legislation.gov.uk/ukpga/2015/30/section/54",
  },
  GB_EMPLOYMENT_RIGHTS_ACT_1996: {
    officialName: "Employment Rights Act 1996",
    referenceNumber: "1996 c.18",
    issuingBody: "UK Parliament (Employment Tribunals)",
    citationUrl: "https://www.legislation.gov.uk/ukpga/1996/18/contents",
  },
  GB_EQUALITY_ACT_2010: {
    officialName: "Equality Act 2010",
    referenceNumber: "2010 c.15",
    issuingBody: "UK Parliament (Equality and Human Rights Commission)",
    citationUrl: "https://www.legislation.gov.uk/ukpga/2010/15/contents",
  },
  GB_CONSUMER_RIGHTS_ACT_2015: {
    officialName: "Consumer Rights Act 2015",
    referenceNumber: "2015 c.15",
    issuingBody: "UK Parliament (Competition and Markets Authority)",
    citationUrl: "https://www.legislation.gov.uk/ukpga/2015/15/contents",
  },
  GB_ECOMMERCE_REGS_2002: {
    officialName: "The Electronic Commerce (EC Directive) Regulations 2002",
    referenceNumber: "SI 2002/2013",
    issuingBody: "UK Parliament (Department for Science, Innovation and Technology)",
    citationUrl: "https://www.legislation.gov.uk/uksi/2002/2013/contents/made",
  },
  GB_FCA_SYSC8: {
    officialName: "Senior Management Arrangements, Systems and Controls sourcebook, Chapter 8: Outsourcing",
    referenceNumber: "FCA Handbook SYSC 8",
    issuingBody: "Financial Conduct Authority",
    citationUrl: "https://www.handbook.fca.org.uk/handbook/SYSC/8/",
  },
  GB_LATE_PAYMENT_1998: {
    officialName: "Late Payment of Commercial Debts (Interest) Act 1998",
    referenceNumber: "1998 c.20",
    issuingBody: "UK Parliament (Department for Business and Trade)",
    citationUrl: "https://www.legislation.gov.uk/ukpga/1998/20/contents",
  },
  EU_GDPR: {
    officialName: "General Data Protection Regulation",
    referenceNumber: "Regulation (EU) 2016/679",
    issuingBody: "European Parliament and Council (European Data Protection Board)",
    citationUrl: "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
  },
  EU_DORA: {
    officialName: "Digital Operational Resilience Act",
    referenceNumber: "Regulation (EU) 2022/2554",
    issuingBody: "European Parliament and Council (EBA, EIOPA, ESMA)",
    citationUrl: "https://eur-lex.europa.eu/eli/reg/2022/2554/oj",
  },
  EU_AI_ACT: {
    officialName: "Artificial Intelligence Act",
    referenceNumber: "Regulation (EU) 2024/1689",
    issuingBody: "European Parliament and Council",
    citationUrl: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
  },
};

export function getRegulatorySource(code: string): RegulatorySource | null {
  return REGULATORY_SOURCES[code] ?? null;
}

export function hasRegulatorySource(code: string | undefined | null): boolean {
  if (!code) return false;
  const s = REGULATORY_SOURCES[code];
  return !!(s && s.officialName && s.referenceNumber && s.issuingBody && s.citationUrl);
}
