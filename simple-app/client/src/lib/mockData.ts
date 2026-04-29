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
    originalName: "Acme Corp — Master Services Agreement.pdf",
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
    originalName: "GlobalSupply — Standard Vendor Contract.pdf",
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
    originalName: "Series B Investor NDA — Term Sheet.pdf",
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

export const MOCK_ACTIONS = [
  {
    id: "a1",
    docId: "mock-1",
    docName: "Acme Corp — Master Services Agreement",
    type: "escalation" as const,
    message: "Liability cap breaches red line — GC sign-off required",
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
    docName: "Acme Corp — Master Services Agreement",
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
