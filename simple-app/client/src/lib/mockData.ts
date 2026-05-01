// Mock data used when the real database is empty or unavailable.
// Swap these out by replacing MOCK_MODE = false once real data flows in.

export const MOCK_MODE = true;

export const MOCK_STATS = {
  totalReviews: 14,
  totalDocuments: 16,
  redFlagsOpen: 8,
  escalationsPending: 3,
  clausesAccepted: 37,
  estimatedHoursSaved: 21,
  ragBreakdown: { RED: 18, AMBER: 34, GREEN: 72, GREY: 12 },
  topIssues: [
    { category: "LIABILITY_CAP", count: 9 },
    { category: "DATA_PRIVACY", count: 6 },
    { category: "AUTO_RENEWAL", count: 4 },
  ],
};

export const MOCK_DOCUMENTS = [
  {
    id: "mock-1",
    originalName: "Acme Corp - Master Services Agreement.pdf",
    contractType: "MSA",
    status: "COMPLETE",
    uploadedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    reviewResults: [
      { ragStatus: "RED" }, { ragStatus: "RED" }, { ragStatus: "AMBER" },
      { ragStatus: "AMBER" }, { ragStatus: "AMBER" }, { ragStatus: "GREEN" },
      { ragStatus: "GREEN" }, { ragStatus: "GREEN" }, { ragStatus: "GREEN" },
      { ragStatus: "GREY" },
    ],
    escalationRequired: true,
    signReadiness: "not-ready",
  },
  {
    id: "mock-2",
    originalName: "CloudVendor SaaS Subscription Agreement.pdf",
    contractType: "SUPPLIER_AGREEMENT",
    status: "COMPLETE",
    uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    reviewResults: [
      { ragStatus: "RED" }, { ragStatus: "AMBER" }, { ragStatus: "AMBER" },
      { ragStatus: "GREEN" }, { ragStatus: "GREEN" }, { ragStatus: "GREEN" },
      { ragStatus: "GREEN" }, { ragStatus: "GREEN" }, { ragStatus: "GREEN" },
      { ragStatus: "GREEN" },
    ],
    escalationRequired: false,
    signReadiness: "negotiate",
  },
  {
    id: "mock-3",
    originalName: "TechPartners Data Processing Agreement.docx",
    contractType: "DPA",
    status: "COMPLETE",
    uploadedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    reviewResults: [
      { ragStatus: "AMBER" }, { ragStatus: "GREEN" }, { ragStatus: "GREEN" },
      { ragStatus: "GREEN" }, { ragStatus: "GREEN" }, { ragStatus: "GREEN" },
      { ragStatus: "GREEN" }, { ragStatus: "GREEN" }, { ragStatus: "GREEN" },
      { ragStatus: "GREY" },
    ],
    escalationRequired: false,
    signReadiness: "review",
  },
  {
    id: "mock-4",
    originalName: "GlobalSupply - Standard Vendor Contract.pdf",
    contractType: "SUPPLIER_AGREEMENT",
    status: "COMPLETE",
    uploadedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    reviewResults: [
      { ragStatus: "GREEN" }, { ragStatus: "GREEN" }, { ragStatus: "GREEN" },
      { ragStatus: "GREEN" }, { ragStatus: "GREEN" }, { ragStatus: "GREEN" },
      { ragStatus: "GREEN" }, { ragStatus: "GREEN" }, { ragStatus: "AMBER" },
      { ragStatus: "GREEN" },
    ],
    escalationRequired: false,
    signReadiness: "ready",
  },
  {
    id: "mock-5",
    originalName: "Series B Investor NDA - Term Sheet.pdf",
    contractType: "NDA",
    status: "PROCESSING",
    uploadedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    reviewResults: [],
    escalationRequired: false,
    signReadiness: "pending",
  },
  {
    id: "mock-6",
    originalName: "Enterprise Customer Agreement v3.docx",
    contractType: "CUSTOMER_AGREEMENT",
    status: "COMPLETE",
    uploadedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    reviewResults: [
      { ragStatus: "RED" }, { ragStatus: "RED" }, { ragStatus: "AMBER" },
      { ragStatus: "GREEN" }, { ragStatus: "GREEN" }, { ragStatus: "GREEN" },
      { ragStatus: "GREEN" }, { ragStatus: "GREY" }, { ragStatus: "GREY" },
      { ragStatus: "GREEN" },
    ],
    escalationRequired: true,
    signReadiness: "not-ready",
  },
];

export const MOCK_PORTFOLIO_RISK = {
  categories: [
    { label: "Insurance & Indemnity", red: 5, amber: 8, green: 12, icon: "🛡️" },
    { label: "Liability & Warranties", red: 7, amber: 11, green: 9, icon: "⚖️" },
    { label: "Data & Privacy",         red: 3, amber: 6,  green: 16, icon: "🔐" },
    { label: "Termination & Renewal",  red: 2, amber: 9,  green: 14, icon: "📅" },
  ],
  topRedCategories: [
    { category: "LIABILITY_CAP",   count: 9, pct: 90 },
    { category: "INDEMNITY",       count: 7, pct: 70 },
    { category: "DATA_PRIVACY",    count: 5, pct: 50 },
    { category: "INSURANCE",       count: 4, pct: 40 },
    { category: "TERMINATION",     count: 3, pct: 30 },
  ],
  byContractType: [
    { type: "Master Services Agreement", red: 4, amber: 5, total: 3 },
    { type: "Supplier Agreement",        red: 6, amber: 9, total: 5 },
    { type: "Customer Agreement",        red: 3, amber: 4, total: 3 },
    { type: "NDA",                       red: 0, amber: 2, total: 2 },
    { type: "Data Processing Agreement", red: 1, amber: 3, total: 2 },
  ],
  insight: "Liability caps are your most contested issue - counterparties are pushing for 3-month fee caps vs your preferred 12-month minimum. Consider adjusting your commercial risk appetite for Supplier Agreements to reduce negotiation friction.",
};

export const MOCK_RENEWALS = {
  upcoming: [
    {
      id: "r1",
      contractName: "Acme Corp - Master Services Agreement",
      eventType: "Auto-renewal deadline",
      date: "15 May 2025",
      daysUntil: 15,
      noticePeriod: "60 days",
      actionRequired: true,
    },
    {
      id: "r2",
      contractName: "CloudVendor SaaS Subscription",
      eventType: "Contract expiry",
      date: "30 Jun 2025",
      daysUntil: 61,
      noticePeriod: "30 days",
      actionRequired: false,
    },
    {
      id: "r3",
      contractName: "GlobalSupply Vendor Contract",
      eventType: "Renewal notice deadline",
      date: "1 Aug 2025",
      daysUntil: 93,
      noticePeriod: "90 days",
      actionRequired: false,
    },
    {
      id: "r4",
      contractName: "Enterprise Customer Agreement v3",
      eventType: "Annual review date",
      date: "15 Sep 2025",
      daysUntil: 138,
      noticePeriod: "45 days",
      actionRequired: false,
    },
    {
      id: "r5",
      contractName: "TechPartners DPA",
      eventType: "Contract expiry",
      date: "31 Dec 2025",
      daysUntil: 245,
      noticePeriod: "60 days",
      actionRequired: false,
    },
  ],
  termOverview: [
    { label: "Expiring within 30 days",  count: 1,  pct: 10 },
    { label: "Expiring within 90 days",  count: 2,  pct: 20 },
    { label: "Expiring within 12 months", count: 5, pct: 50 },
    { label: "Long-term (12m+)",         count: 5,  pct: 50 },
  ],
};

export const MOCK_ACTIONS = [
  {
    id: "a1",
    docId: "mock-1",
    docName: "Acme Corp - Master Services Agreement",
    type: "escalation" as const,
    message: "Liability cap breaches red line - GC sign-off required",
    ragStatus: "RED",
  },
  {
    id: "a2",
    docId: "mock-6",
    docName: "Enterprise Customer Agreement v3",
    type: "escalation" as const,
    message: "Uncapped indemnity clause requires Board approval",
    ragStatus: "RED",
  },
  {
    id: "a3",
    docId: "mock-1",
    docName: "Acme Corp - Master Services Agreement",
    type: "review" as const,
    message: "3 AMBER clauses awaiting your decision",
    ragStatus: "AMBER",
  },
  {
    id: "a4",
    docId: "mock-2",
    docName: "CloudVendor SaaS Subscription Agreement",
    type: "review" as const,
    message: "Data privacy clause needs push-back before signing",
    ragStatus: "AMBER",
  },
];
