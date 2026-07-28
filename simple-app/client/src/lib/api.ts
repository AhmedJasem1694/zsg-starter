import type {
  Company,
  PlaybookRule,
  ApprovalContact,
  UploadedDocument,
  CompanyRegulation,
  LitigationIntakeData,
  AncillaryDocumentData,
} from "./types";

// ── ApiError: carries HTTP status so callers can distinguish 401 from 500 ───

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// In-memory token store: populated by register/login responses.
// Used as Authorization: Bearer fallback when httpOnly cookies don't reach the server
// (e.g. certain reverse-proxy or browser configurations in production).
let _authToken: string | null = (() => {
  try { return sessionStorage.getItem("_zt"); } catch { return null; }
})();

export function storeAuthToken(token: string | null) {
  _authToken = token;
  try {
    if (token) sessionStorage.setItem("_zt", token);
    else sessionStorage.removeItem("_zt");
  } catch { /* sessionStorage unavailable */ }
}

export async function req<T>(
  method: string,
  url: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {};
  if (!(body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (_authToken) headers["Authorization"] = `Bearer ${_authToken}`;

  const res = await fetch(url, {
    method,
    credentials: "include",
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const message = (err as { error?: string }).error ?? res.statusText;
    // Session expired: redirect to login (only for non-auth, non-background endpoints).
    // /api/features is intentionally excluded, it is polled by FeatureFlagsProvider
    // on every page including /login. Redirecting on a 401 there creates a reload loop.
    const isBackgroundEndpoint = url.includes("/api/auth/") || url.includes("/api/features");
    if (res.status === 401 && !isBackgroundEndpoint) {
      const returnPath = typeof window !== "undefined" ? window.location.pathname : "/";
      // Don't redirect if we are already on the login page, that would loop.
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = `/login?return=${encodeURIComponent(returnPath)}`;
      }
    }
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

// Company search
export interface CompanyCandidate {
  id: string;
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
export interface EnrichedCompany {
  name: string;
  number?: string;
  jurisdiction: string;
  status?: string;
  incorporatedOn?: string;
  address?: string;
  sicCodes: string[];
  sicDescriptions: string[];
  mappedIndustries: string[];
  customIndustries: string[];
  sector: string;
}
// ── Document-first onboarding ─────────────────────────────────────────────────

export interface ExtractedDocumentMetadata {
  contract_type?: string | null;
  counterparty_name?: string | null;
  governing_law?: string | null;
  contract_value?: number | null;
  currency?: string | null;
  renewal_date?: string | null;
  auto_renewal?: boolean | null;
  contract_term_months?: number | null;
}

/** Run LLM metadata extraction on an already-uploaded document. Best-effort. */
export const extractDocumentMetadata = (documentId: string) =>
  req<ExtractedDocumentMetadata>("POST", `/api/documents/${documentId}/extract-metadata`);

/** Create a company from minimal fields and associate a pending document. */
export const quickSetup = (data: {
  companyName: string;
  sector: string;
  riskAppetite: string;
  persona: string;
  pendingDocumentId: string;
}) =>
  req<{ company: import("./types").Company; documentId: string | null }>(
    "POST",
    "/api/quick-setup",
    data
  );

export const searchCompany = (q: string) =>
  req<{ candidates: CompanyCandidate[] }>("GET", `/api/company/search?q=${encodeURIComponent(q)}`);
export const enrichCompanyData = (candidate: CompanyCandidate) =>
  req<EnrichedCompany>("POST", "/api/company/enrich", candidate);

// Company
export const getCompany = () => req<Company>("GET", "/api/company");
export const createCompany = (data: {
  name: string;
  sector: string;
  jurisdiction: string;
  role: string;
  riskAppetite: string;
  industry?: string;
  persona?: string;
  workflowType?: string;
}) => req<Company>("POST", "/api/company", data);

// Playbook
export const getPlaybookRules = () => req<{ rules: PlaybookRule[]; playbookVersion: number }>("GET", "/api/playbook/rules");
export const savePlaybookRules = (rules: Omit<PlaybookRule, "id" | "companyId">[]) =>
  req<PlaybookRule[]>("POST", "/api/playbook/rules", { rules });
export const updatePlaybookRule = (id: string, data: Partial<PlaybookRule>) =>
  req<PlaybookRule>("PUT", `/api/playbook/rule/${id}`, data);

// Contacts
export const saveContacts = (
  contacts: Omit<ApprovalContact, "id" | "companyId">[]
) => req<ApprovalContact[]>("POST", "/api/company/contacts", { contacts });

// Documents
export const getDocuments = (params?: { search?: string; ragStatus?: string; contractType?: string }) => {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.ragStatus) qs.set("ragStatus", params.ragStatus);
  if (params?.contractType) qs.set("contractType", params.contractType);
  const url = `/api/documents${qs.toString() ? `?${qs.toString()}` : ""}`;
  return req<UploadedDocument[]>("GET", url);
};
export const getDocument = (id: string) =>
  req<UploadedDocument>("GET", `/api/documents/${id}`);

export const uploadDocument = async (
  file: File,
  contractType: string,
  meta?: {
    counterpartyName?: string;
    counterpartyType?: string;
    reviewType?: string;
    governingLaw?: string;
    jurisdiction?: string;
    contractValue?: number;
    currency?: string;
    contractTermMonths?: number;
    autoRenewal?: boolean;
    noticePeriodDays?: number;
    renewalDate?: string;
    contractTags?: string;
  }
): Promise<UploadedDocument> => {
  const form = new FormData();
  form.append("contract", file);
  form.append("contractType", contractType);
  if (meta) {
    if (meta.counterpartyName !== undefined) form.append("counterpartyName", meta.counterpartyName);
    if (meta.counterpartyType !== undefined) form.append("counterpartyType", meta.counterpartyType);
    if (meta.reviewType !== undefined) form.append("reviewType", meta.reviewType);
    if (meta.governingLaw !== undefined) form.append("governingLaw", meta.governingLaw);
    if (meta.jurisdiction !== undefined) form.append("jurisdiction", meta.jurisdiction);
    if (meta.contractValue !== undefined) form.append("contractValue", String(meta.contractValue));
    if (meta.currency !== undefined) form.append("currency", meta.currency);
    if (meta.contractTermMonths !== undefined) form.append("contractTermMonths", String(meta.contractTermMonths));
    if (meta.autoRenewal !== undefined) form.append("autoRenewal", String(meta.autoRenewal));
    if (meta.noticePeriodDays !== undefined) form.append("noticePeriodDays", String(meta.noticePeriodDays));
    if (meta.renewalDate !== undefined) form.append("renewalDate", meta.renewalDate);
    if (meta.contractTags !== undefined) form.append("contractTags", meta.contractTags);
  }
  return req<UploadedDocument>("POST", "/api/documents/upload", form);
};

export async function getDocumentStats(): Promise<{
  totalContracts: number;
  totalValue: number;
  redContracts: number;
  renewalsDue: number;
  reviewedThisMonth: number;
}> {
  return req<{ totalContracts: number; totalValue: number; redContracts: number; renewalsDue: number; reviewedThisMonth: number }>(
    "GET", "/api/documents/stats"
  ).catch(() => ({ totalContracts: 0, totalValue: 0, redContracts: 0, renewalsDue: 0, reviewedThisMonth: 0 }));
}

export const deleteDocument = (id: string) =>
  req<{ ok: boolean }>("DELETE", `/api/documents/${id}`);

export const deleteDocuments = (ids: string[]) =>
  req<{ ok: boolean; deleted: number }>("DELETE", `/api/documents`, { ids });

export const clearAllContracts = () =>
  req<{ ok: boolean; deleted: number }>("DELETE", `/api/company/contracts`);

// Review
export const startReview = (documentId: string) =>
  req<{ status: string; documentId: string }>("POST", `/api/review/${documentId}`);
export const getReview = (documentId: string) =>
  req<UploadedDocument>("GET", `/api/review/${documentId}`);

// Founder negotiation
export const generateNegotiationEmail = (documentId: string, resultIds?: string[]) =>
  req<{ subject: string; body: string }>("POST", `/api/review/${documentId}/negotiation-email`, { resultIds });
export const generateAmendedClause = (resultId: string) =>
  req<{ original: string; revised: string; explanation: string }>("POST", `/api/review/result/${resultId}/amended-clause`);
export const suggestMissingClause = (resultId: string) =>
  req<{ clauseText: string; explanation: string }>("POST", `/api/review/result/${resultId}/suggest-clause`);

// Stats
export const getStats = () => req<{
  totalReviews: number;
  totalDocuments: number;
  redFlagsOpen: number;
  escalationsPending: number;
  clausesAccepted: number;
  estimatedHoursSaved: number;
  ragBreakdown: { RED: number; AMBER: number; GREEN: number; GREY: number };
  topIssues: { category: string; count: number }[];
}>("GET", "/api/stats");

// Auth
export const register = async (data: { name: string; email: string; password: string }) => {
  const res = await req<{ userId: string; email: string; name: string; token?: string }>(
    "POST", "/api/auth/register", data
  );
  if (res.token) storeAuthToken(res.token);
  return res;
};
// Legacy contract review (cost-controlled estate mapping)
export const startLegacyReview = (documentId: string) =>
  req<{ ok: boolean; documentId: string }>("POST", `/api/legacy/review/${documentId}`);

export interface LegacyReportRow {
  id: string;
  name: string;
  status: string;
  counterparty: string;
  contractType: string;
  value: number | null;
  currency: string;
  governingLaw: string;
  autoRenewal: boolean;
  renewalDate: string | null;
  noticePeriodDays: number | null;
  endDate: string | null;
  termSummary: string;
  liabilityCap: string;
  terminationRights: string;
  assignment: string;
  dataProtection: string;
  riskFlags: string[];
  created: string;
}
export interface LegacyRenewalEntry {
  id: string;
  name: string;
  counterparty: string;
  date: string;
  kind: string;
  autoRenewal: boolean;
  noticePeriodDays: number | null;
}
export interface LegacyReportSummary {
  total: number;
  complete: number;
  processing: number;
  failed: number;
  totalValue: number;
  flaggedValue: number;
  flaggedCount: number;
  uncappedLiability: number;
  autoRenewalsInWindow: number;
  missingGoverningLaw: number;
  renewalsNext12mo: number;
}
export const getLegacyReport = () =>
  req<{ rows: LegacyReportRow[]; renewals: LegacyRenewalEntry[]; summary: LegacyReportSummary | null }>(
    "GET", "/api/legacy/report"
  );

// Admin-only: internal indicative quote for legacy review (sales helper, not customer-facing).
export interface LegacyQuote { contracts: number; perContract: number; total: number; band: string }
export const getLegacyQuote = (contracts: number) =>
  req<LegacyQuote>("GET", `/api/admin/legacy-quote?contracts=${encodeURIComponent(contracts)}`);

// Admin-only: compounding metrics dashboard
export interface AdminMetrics {
  contractsReviewed: number;
  reviewsByMonth: Record<string, number>;
  clausesAnalysed: number;
  ragBreakdown: { RED: number; AMBER: number; GREEN: number; GREY: number };
  deviationRate: number;
  decisionEvents: number;
  outcomeCaptureRate: number;
  outcomesLogged: number;
  counterpartiesTracked: number;
  hoursSaved: number;
  reviewCost: number;
  estMonthlyRevenue: number;
  legacyProcessed: number;
}
export interface AdminMetricsCompanyRow extends AdminMetrics {
  companyId: string;
  name: string;
  tier: string;
}
export const getAdminMetrics = () =>
  req<{ aggregate: AdminMetrics; companies: AdminMetricsCompanyRow[]; months: string[] }>(
    "GET", "/api/admin/metrics"
  );

// Admin-only: monthly review cost per company (unit economics)
export interface ReviewCostReport {
  months: string[];
  companies: Array<{ companyId: string; name: string; monthly: Record<string, number>; total: number; reviews: number }>;
  grandTotal: number;
  currency: string;
}
export const getReviewCosts = () =>
  req<ReviewCostReport>("GET", "/api/admin/review-costs");

// Company-level settings (currently: regulatory analysis prominence override)
export const updateCompanySettings = (data: { regulationProminence: string }) =>
  req<{ id: string; regulationProminence?: string }>("PATCH", "/api/company", data);

// Manual onboarding: landing-page "Request access" form (no auth required)
export const requestAccess = (data: {
  name: string;
  email: string;
  company: string;
  role: string;
  contractsDescription: string;
}) => req<{ ok: boolean }>("POST", "/api/access-request", data);

export const login = async (data: { email: string; password: string }) => {
  const res = await req<{ userId: string; email: string; name: string; token?: string }>(
    "POST", "/api/auth/login", data
  );
  if (res.token) storeAuthToken(res.token);
  return res;
};
export const getFeatureFlags = () =>
  req<{ tier: string; flags: Record<string, unknown>; trialDaysRemaining: number | null; reviewsThisMonth: number }>("GET", "/api/features");

export const logout = () => {
  storeAuthToken(null);
  return req<{ ok: boolean }>("POST", "/api/auth/logout");
};
export const getMe = async (): Promise<{ userId: string; email: string; isAdmin?: boolean }> => {
  try {
    const data = await req<{ userId: string; email: string; token?: string; isAdmin?: boolean }>("GET", "/api/auth/me");
    // Bootstrap the in-memory token from the /me response so Bearer auth works
    // even when httpOnly cookies aren't forwarded by a reverse proxy.
    if (data.token) storeAuthToken(data.token);
    return data;
  } catch (err) {
    // Only clear the in-memory token when the server EXPLICITLY rejected it (401).
    // For transient failures (network error, 5xx) we must NOT wipe _authToken.
    // clearing it on a temporary glitch breaks subsequent authenticated calls
    // because the Bearer header disappears and httpOnly cookies may not be
    // forwarded by the reverse proxy (Railway, etc.).
    // Without this guard, a background refetchOnWindowFocus that momentarily
    // fails would silently log the user out mid-onboarding.
    if (err instanceof ApiError && err.status === 401) {
      storeAuthToken(null);
    }
    throw err;
  }
};

// Document text (split review view)
export interface DocumentTextBlock {
  id: string;
  text: string;
  clauseCategories: string[];
}
export const getDocumentText = (documentId: string) =>
  req<{ documentId: string; documentName: string; source: "parsed" | "clauses" | "empty"; blocks: DocumentTextBlock[] }>(
    "GET", `/api/documents/${documentId}/text`
  );

// Per-contract audit history
export interface ContractAuditEvent {
  id: string;
  at: string;
  kind: "audit" | "decision" | "version";
  action: string;
  detail: Record<string, unknown>;
  clauseCategory: string | null;
  ragStatus: string | null;
  escalationTrigger: string | null;
}
export const getContractAudit = (documentId: string) =>
  req<{ documentId: string; documentName: string; events: ContractAuditEvent[] }>(
    "GET", `/api/documents/${documentId}/audit`
  );

// Approvals (end-to-end approval flow)
export interface ApprovalListItem {
  id: string;
  documentId: string;
  documentName: string;
  counterpartyName: string;
  contractValue: number | null;
  currency: string;
  contractType: string;
  clauseCategory: string | null;
  routedToRole: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedBy: string;
  createdAt: string;
  decidedAt: string | null;
  decidedByName: string;
  deciderRole: string;
  decisionReason: string;
}
export interface ApprovalDetail {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  routedToRole: string;
  reason: string;
  clauseCategory: string | null;
  requestedBy: string;
  createdAt: string;
  decidedAt: string | null;
  decidedByName: string;
  deciderRole: string;
  decisionReason: string;
  document: { id: string; name: string; counterpartyName: string; contractValue: number | null; currency: string; contractType: string } | null;
  clause: { ragStatus: string; plainEnglish: string; recommendedAction: string; escalationTrigger: string } | null;
  playbookPosition: { preferred: string; redLine: string } | null;
}
export const getApprovals = (opts?: { role?: string; status?: string }) => {
  const params = new URLSearchParams();
  if (opts?.role) params.set("role", opts.role);
  if (opts?.status) params.set("status", opts.status);
  const qs = params.toString();
  return req<{ approvals: ApprovalListItem[] }>("GET", `/api/approvals${qs ? `?${qs}` : ""}`);
};
export const getApproval = (id: string) => req<ApprovalDetail>("GET", `/api/approvals/${id}`);
export const decideApproval = (id: string, decision: "APPROVED" | "REJECTED", reason: string) =>
  req<{ id: string; status: string; decidedAt: string }>("POST", `/api/approvals/${id}/decide`, { decision, reason });

// Portfolio
export const getPortfolio = () => req<{
  groups: { label: string; icon: string; red: number; amber: number; green: number }[];
  topRedCategories: { category: string; count: number; pct: number }[];
  byContractType: { type: string; red: number; amber: number; total: number }[];
  byCounterparty: { name: string; red: number; amber: number; green: number; total: number; value: number }[];
  valueAtRisk: { RED: number; AMBER: number; GREEN: number; total: number };
  insight: string;
  totalDocuments: number;
  totalClauses: number;
  totalRedResults: number;
  escalationsOpen: number;
  totalValue: number;
  signedDocs: number;
} | null>("GET", "/api/portfolio");

// Timings
export const getTimings = () => req<{
  flagged: { id: string; contractName: string; contractType: string; clauseCategory: string; ragStatus: string; summary: string; uploadedAt: string }[];
  overview: { label: string; count: number; pct: number }[];
  totalDocuments: number;
} | null>("GET", "/api/timings");

// Regulatory
export const getRegulations = () => req<CompanyRegulation[]>("GET", "/api/regulatory");
export const detectRegulations = () => req<CompanyRegulation[]>("POST", "/api/regulatory/detect");

// Litigation intake
export async function getLitigationIntake(documentId: string) {
  return req<LitigationIntakeData | null>("GET", `/api/litigation/intake/${documentId}`).catch(() => null);
}

export async function saveLitigationIntake(documentId: string, data: Partial<LitigationIntakeData>) {
  return req<LitigationIntakeData>("POST", `/api/litigation/intake/${documentId}`, data);
}

// Ancillary documents
export async function getAncillaryDocuments(documentId: string) {
  return req<AncillaryDocumentData[]>("GET", `/api/ancillary/${documentId}`).catch(() => [] as AncillaryDocumentData[]);
}

export async function uploadAncillaryDocument(
  documentId: string,
  file: File,
  privilegeFlag: boolean
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("privilegeFlag", String(privilegeFlag));
  return req<AncillaryDocumentData>("POST", `/api/ancillary/${documentId}`, formData);
}

export async function deleteAncillaryDocument(ancillaryId: string) {
  await req("DELETE", `/api/ancillary/${ancillaryId}`);
}

// Feedback
export const saveFeedback = (
  resultId: string,
  data: {
    userAction: string;
    editedOutput?: string;
    finalClauseText?: string;
    notes?: string;
  }
): Promise<import("./types").FeedbackResponse> => req("POST", `/api/feedback/${resultId}`, data);

/**
 * Attach the lawyer's reasoning to a significant decision they just made
 * (reasoning capture, Section 2). Non-blocking: the decision is already recorded.
 */
export const saveDecisionReasoning = (
  decisionEventId: string,
  data: { category?: string; text?: string }
): Promise<{ ok: boolean }> => req("POST", `/api/decisions/${decisionEventId}/reasoning`, data);

/**
 * Teach Zane - lawyer provides what Zane got wrong and the correct analysis.
 * Stored as feedbackType: TEACH_ZANE and routed to the knowledge layer.
 */
export const teachZane = (
  resultId: string,
  data: { incorrectOutput: string; correctOutput: string; notes?: string }
) => req("POST", `/api/feedback/teach-zane/${resultId}`, data);

/**
 * False Positive - marks the clause extraction as incorrect (clause wasn't
 * really present or was misclassified). Logged to improve the classifier.
 */
export const markFalsePositive = (
  resultId: string,
  notes?: string
) => req("POST", `/api/feedback/false-positive/${resultId}`, { notes });

// Memory / patterns
export interface ClauseOutcome {
  clauseCategory: string;
  total: number;
  accepted: number;
  escalated: number;
  dismissed: number;
  redCount: number;
  amberCount: number;
  greenCount: number;
}

export interface ZanePattern {
  type: string;
  message: string;
  severity: "info" | "warn" | "good";
}

export interface CounterpartyPattern {
  counterparty: string;
  clauseCategory: string;
  redCount: number;
  amberCount: number;
  acceptedRed: number;
}

export interface NegotiationDrift {
  clauseCategory: string;
  totalRed: number;
  acceptedRed: number;
  driftPct: number;
}

// Decision events (structured human-judgment capture, the moat layer)
export interface DecisionSummary {
  total: number;
  byAction: Record<string, number>;
  agreementRate: number;
  overrideRate: number;
  mostOverriddenCategories: Array<{ clauseCategory: string; overridden: number; total: number }>;
  recent: Array<{
    clauseCategory: string;
    zaneRecommendation: string;
    humanAction: string;
    humanFinalPosition: string;
    overrideReason: string;
    created: string;
  }>;
}

export const getFeedbackPatterns = () =>
  req<{
    patterns: ZanePattern[];
    clauseOutcomes: ClauseOutcome[];
    counterpartyPatterns: CounterpartyPattern[];
    negotiationDrift: NegotiationDrift[];
    decisionSummary: DecisionSummary | null;
  }>(
    "GET",
    "/api/feedback/patterns"
  );

// Generate negotiation reply
export const generateReply = (resultId: string, tone?: string) =>
  req<{ reply: string }>("POST", `/api/review/generate-reply/${resultId}`, { tone: tone ?? "professional" });

// Missing documents
export interface MissingDoc {
  contractType: string;
  label: string;
  reason: string;
  priority: "high" | "medium";
}

export const getMissingDocuments = () =>
  req<{ missing: MissingDoc[] }>("GET", "/api/documents/missing");

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  companyId: string;
  userId: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export const getAuditLog = (
  page = 1,
  limit = 50,
  filters?: { action?: string; from?: string; to?: string; entityId?: string }
) => {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters?.action)   qs.set("action", filters.action);
  if (filters?.from)     qs.set("from", filters.from);
  if (filters?.to)       qs.set("to", filters.to);
  if (filters?.entityId) qs.set("entityId", filters.entityId);
  return req<{ entries: AuditEntry[]; totalPages: number; totalItems: number; page: number }>(
    "GET",
    `/api/audit?${qs.toString()}`
  );
};

export const exportAuditLogCSV = (filters?: { action?: string; from?: string; to?: string }) => {
  const qs = new URLSearchParams({ format: "csv" });
  if (filters?.action) qs.set("action", filters.action);
  if (filters?.from)   qs.set("from", filters.from);
  if (filters?.to)     qs.set("to", filters.to);
  // Trigger browser download
  window.location.href = `/api/audit?${qs.toString()}`;
};

export const createPlaybookRule = (data: {
  clauseCategory: string;
  preferredPosition?: string;
  acceptableFallback?: string;
  hardRedLine?: string;
  fallbackTemplate?: string;
  approvalRequired?: string;
  workflowType?: string;
}) => req<{ id: string; clauseCategory: string }>("POST", "/api/playbook/rule", data);

export const generatePlaybookSuggestion = (clauseCategory: string, workflowType?: string) =>
  req<{ preferredPosition: string; acceptableFallback: string; hardRedLine: string }>(
    "POST",
    "/api/playbook/generate-suggestion",
    { clauseCategory, workflowType }
  );

export interface PlaybookDriftSuggestion {
  clauseCategory: string;
  ruleId: string | null;
  driftPct: number;
  totalRed: number;
  acceptedRed: number;
  reasoning: string;
  updatedPreferredPosition: string;
  updatedRedLine: string;
  recommendation: string;
}

export const getPlaybookDriftSuggestions = () =>
  req<{ suggestions: PlaybookDriftSuggestion[] }>("GET", "/api/playbook/drift-suggestions");

// ── Governance thresholds & triggers ─────────────────────────────────────────

export const getGovernanceThresholds = () =>
  req<Array<{ id: string; companyId: string; minValue: number; maxValue: number | null; requiredApprover: string; label: string }>>(
    "GET", "/api/governance/thresholds"
  );

export const saveGovernanceThresholds = (thresholds: Array<{ minValue: number; maxValue: number | null; requiredApprover: string; label: string }>) =>
  req("POST", "/api/governance/thresholds", thresholds);

export const getGovernanceTriggers = () =>
  req<Array<{ id: string; companyId: string; clauseCategory: string; escalateTo: string; reason: string }>>(
    "GET", "/api/governance/triggers"
  );

export const saveGovernanceTriggers = (triggers: Array<{ clauseCategory: string; escalateTo: string; reason: string }>) =>
  req("POST", "/api/governance/triggers", triggers);

// ── Team invites ──────────────────────────────────────────────────────────────

export const sendTeamInvites = (emails: string[], role?: string) =>
  req<{ invited: number }>("POST", "/api/team/invite", { emails, role });

export const getTeamInvites = () =>
  req<Array<{ id: string; email: string; role: string; status: string; created: string }>>("GET", "/api/team/invites");

export const cancelTeamInvite = (id: string) =>
  req<{ ok: boolean }>("DELETE", `/api/team/invites/${id}`);

export const updateTeamInviteStatus = (id: string, status: string) =>
  req<{ id: string; status: string }>("PATCH", `/api/team/invites/${id}`, { status });

// ── New-joiner briefing (the inheritance layer) ─────────────────────────────────
export interface TeamBriefing {
  id: string;
  companyId: string;
  generatedFor: string;
  generatedAt: string;
  validUntil: string;
  playbook_briefing: string;
  actual_vs_stated: string;
  counterparty_intel: string;
  significant_decisions: string;
  portfolio_snapshot: string;
  approval_matrix: string;
}
export const getTeamBriefing = () =>
  req<{ briefing: TeamBriefing | null }>("GET", "/api/team/briefing");
export const generateTeamBriefing = () =>
  req<{ briefing: TeamBriefing }>("POST", "/api/team/briefing/generate");

// ── L3 synthesis ────────────────────────────────────────────────────────────────
export interface SynthesisPage {
  content?: string;
  confidenceLabel?: string;
  version?: number;
  clauseCategory?: string;
  topic?: string;
  jurisdiction?: string;
  dataPoints?: number;
}
export const getSynthesis = (clause?: string) =>
  req<{ companyKnowledge: SynthesisPage | null; regulatory: SynthesisPage | null; playbook: SynthesisPage | null }>(
    "GET",
    `/api/synthesis${clause ? `?clause=${encodeURIComponent(clause)}` : ""}`,
  );
export const generateSynthesis = () =>
  req<{ playbookPages: number; companyKnowledge: boolean; regulatory: boolean }>("POST", "/api/synthesis/generate");

// ── Outcome capture ────────────────────────────────────────────────────────────

export const captureOutcome = (documentId: string, outcome: "SIGNED" | "EXECUTED", outcomeNotes?: string) =>
  req<{ id: string }>("POST", `/api/documents/${documentId}/outcome`, { outcome, outcomeNotes });

// ── Regulatory intelligence ───────────────────────────────────────────────────

export interface RegulatoryUpdate {
  framework: string;
  jurisdiction: string;
  title: string;
  summary: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  date: string;
  actionRequired: boolean;
}

export const getRegulatoryUpdates = () =>
  req<{ updates: RegulatoryUpdate[]; cached?: boolean }>("GET", "/api/regulatory/updates");

export const synthesiseRegulation = (regulationId: string) =>
  req<{ synthesis: string; cached: boolean; createdAt: string }>(
    "POST", `/api/regulatory/synthesise/${regulationId}`
  );

// ── Contract library ───────────────────────────────────────────────────────────

export interface LibraryFolder {
  name: string;
  count: number;
  documents: UploadedDocument[];
}

export const getLibrary = (search?: string) => {
  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  return req<{ folders: LibraryFolder[]; total: number }>(
    "GET",
    `/api/library${qs.toString() ? `?${qs.toString()}` : ""}`
  );
};

export const setDocumentFolder = (documentId: string, folder: string) =>
  req<{ id: string }>("PATCH", `/api/documents/${documentId}/folder`, { folder });

export const linkDocumentVersion = (documentId: string, parentDocumentId: string) =>
  req<{ id: string }>("PATCH", `/api/documents/${documentId}/version`, { parentDocumentId });

// ── Section 18 - Behavioural Accumulation Engine ──────────────────────────────

// Step 1 - Outcome delta capture
export type DeltaOutcome = "PREFERRED" | "FALLBACK" | "BELOW_FALLBACK" | "NO_CHANGE" | "REMOVED";

export interface OutcomeDelta {
  id: string;
  company: string;
  document: string;
  finalDocument: string;
  clauseCategory: string;
  originalStatus: string;
  originalClauseText: string;
  finalClauseText: string;
  llmOutcome: DeltaOutcome;
  llmConfidence: string;
  confirmedOutcome: DeltaOutcome | "";
  confirmedBy: string;
  confirmedAt: string;
  notes: string;
  // enriched by server
  playbookPreferred: string | null;
  playbookFallback: string | null;
  playbookRedLine: string | null;
}

export const uploadFinalVersion = async (documentId: string, file: File): Promise<{ finalDocumentId: string; message: string }> => {
  const form = new FormData();
  form.append("contract", file);
  return req("POST", `/api/documents/${documentId}/upload-final`, form);
};

export const getOutcomeDeltas = (documentId: string) =>
  req<{ deltas: OutcomeDelta[]; allConfirmed: boolean; hasUnconfirmed: boolean }>(
    "GET",
    `/api/documents/${documentId}/outcome-delta`
  );

export const confirmOutcomeDeltas = (
  documentId: string,
  confirmations: Array<{ deltaId: string; confirmedOutcome: DeltaOutcome; notes?: string }>
) =>
  req<{ ok: boolean }>(
    "POST",
    `/api/documents/${documentId}/outcome-delta/confirm`,
    { confirmations }
  );

// Step 2 - Override signal capture
export const overrideRagStatus = (
  resultId: string,
  data: { correctedStatus: string; reason: string }
) => req<{ ok: boolean }>("POST", `/api/review/${resultId}/override`, data);

// Step 3 - False positive capture
export const markFalsePositiveSignal = (
  resultId: string,
  data: { errorType: string; correctInterpretation?: string }
) => req<{ ok: boolean }>("POST", `/api/review/${resultId}/false-positive`, data);

// Step 5 - Company rules engine
export interface CompanyRule {
  id: string;
  company: string;
  clauseCategory: string;
  counterpartyType: string;
  contractType: string;
  ruleText: string;
  status: "PENDING" | "ACTIVE" | "REJECTED";
  approvedBy: string;
  approvedAt: string;
  evidenceCount: number;
  evidenceContracts: string; // JSON array
  riskAssessment: string;
  generatedFrom: "OUTCOME_PATTERN" | "OVERRIDE_PATTERN";
  editedRuleText: string;
  created: string;
}

export const getCompanyRules = () =>
  req<{ PENDING: CompanyRule[]; ACTIVE: CompanyRule[]; REJECTED: CompanyRule[] }>(
    "GET", "/api/company-rules"
  );

export const approveCompanyRule = (id: string) =>
  req<CompanyRule>("POST", `/api/company-rules/${id}/approve`);

export const rejectCompanyRule = (id: string) =>
  req<CompanyRule>("POST", `/api/company-rules/${id}/reject`);

export const updateCompanyRuleText = (id: string, editedRuleText: string) =>
  req<CompanyRule>("PATCH", `/api/company-rules/${id}`, { editedRuleText });

// Step 7 - Visibility layer
export const getSignalsSummary = (clauseCategory: string) =>
  req<{ overrideCount: number; outcomeCount: number; ruleCount: number; fpCount: number }>(
    "GET", `/api/accumulation/signals-summary?clauseCategory=${encodeURIComponent(clauseCategory)}`
  );

export const getAccumulationProgress = () =>
  req<{
    contractsReviewed: number;
    outcomesLogged: number;
    patternsDetected: number;
    rulesActive: number;
    overrideRate: number;
    overrideRatePrev: number;
    insight: string;
  }>("GET", "/api/accumulation/progress");

export interface ExtendedClauseOutcome {
  clauseCategory: string;
  total: number;
  redCount: number;
  accepted: number;
  escalated: number;
  avgSignedOutcome: string;
  belowFallbackRate: number;
  outcomeCounts: Record<string, number>;
}

export const getClauseOutcomesExtended = () =>
  req<ExtendedClauseOutcome[]>("GET", "/api/accumulation/clause-outcomes-extended");

export interface OverrideTrendEntry {
  month: string;
  overrideRate: number;
  totalResults: number;
  overrideCount: number;
}

export const getOverrideTrend = () =>
  req<OverrideTrendEntry[]>("GET", "/api/accumulation/override-trend");

// Counterparty intelligence
export interface CounterpartyIntelligenceEntry {
  counterpartyName: string;
  total: number;
  accepted: number;
  pushedBack: number;
  typicalOutcome: string;
}

// Section 3c: vendor-specific negotiation profile, built from captured email-thread moves.
export interface CounterpartyProfile {
  counterparty: string;
  contracts: number;
  threads: number;
  totalMoves: number;
  avgRoundsToClose: number | null;
  alwaysPushOn: string[];
  neverConcede: string[];
  typicalMovement: string;
  summaryLines: string[];
}

export const getCounterpartyIntelligence = () =>
  req<{ intelligence: Record<string, CounterpartyIntelligenceEntry[]>; profiles: Record<string, CounterpartyProfile> }>(
    "GET",
    "/api/playbook/counterparty-intelligence"
  );

export const getContractCounterpartyProfile = (contractId: string) =>
  req<{ profile: CounterpartyProfile | null }>(
    "GET",
    `/api/contracts/${contractId}/counterparty-profile`
  );

// Reasoning capture, Section 4: per-counterparty judgment memory for a contract.
export interface CounterpartyJudgmentItem {
  clauseCategory: string;
  label: string;
  what: string;
  reasonCategory: string;
  reasonText: string;
  contractLabel: string;
  when: string;
  oneOff: boolean;
}
export interface CounterpartyJudgmentMemory {
  counterparty: string;
  items: CounterpartyJudgmentItem[];
  considerations: string[];
  patterns: string[];
  oneOffExceptions: string[];
}
export const getContractCounterpartyJudgment = (contractId: string) =>
  req<{ judgment: CounterpartyJudgmentMemory | null }>(
    "GET",
    `/api/contracts/${contractId}/counterparty-judgment`
  );

// Cross-document reference checking.
export interface CrossRefReference {
  parentName: string;
  date: string;
  counterparty: string;
  clauseRefs: string[];
  definedTerms: string[];
  found: boolean;
  foundDocumentId: string;
  foundName: string;
}
export interface CrossRefResult {
  checkedAt: string;
  references: CrossRefReference[];
}
export const getCrossReferences = (contractId: string) =>
  req<{ crossRef: CrossRefResult | null }>("GET", `/api/contracts/${contractId}/cross-references`);
export const relinkCrossReferences = (contractId: string) =>
  req<{ crossRef: CrossRefResult | null }>("POST", `/api/contracts/${contractId}/cross-references/relink`);

// Section 3: consolidated per-vendor intelligence (documents + profile + captured reasoning).
export interface VendorDocument {
  id: string; originalName: string; contractType: string; status: string;
  outcome: string; contractValue: number | null; currency: string; uploadedAt: string;
}
export interface VendorDecision {
  clauseCategory: string; humanAction: string; finalPosition: string;
  reason: string; zaneRecommendation: string; contractName: string; created: string;
}
export interface VendorIntelligence {
  counterparty: string;
  documents: VendorDocument[];
  profile: CounterpartyProfile | null;
  decisions: VendorDecision[];
  notes: string[];
}
export const getVendorIntelligence = (name: string) =>
  req<VendorIntelligence>("GET", `/api/counterparty/vendor-intelligence?name=${encodeURIComponent(name)}`);

// New hire briefing
export async function generateBriefing(): Promise<{ briefing: string }> {
  return req<{ briefing: string }>("POST", "/api/playbook/briefing");
}
