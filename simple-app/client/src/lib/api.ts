import type {
  Company,
  PlaybookRule,
  ApprovalContact,
  UploadedDocument,
  CompanyRegulation,
  LitigationIntakeData,
  AncillaryDocumentData,
} from "./types";

// In-memory token store — populated by register/login responses.
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

async function req<T>(
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
    throw new Error((err as { error?: string }).error ?? res.statusText);
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
}> {
  const res = await fetch("/api/documents/stats", { credentials: "include" });
  if (!res.ok) return { totalContracts: 0, totalValue: 0, redContracts: 0, renewalsDue: 0 };
  return res.json() as Promise<{ totalContracts: number; totalValue: number; redContracts: number; renewalsDue: number }>;
}

// Review
export const startReview = (documentId: string) =>
  req<{ status: string; documentId: string }>("POST", `/api/review/${documentId}`);
export const getReview = (documentId: string) =>
  req<UploadedDocument>("GET", `/api/review/${documentId}`);

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
export const login = async (data: { email: string; password: string }) => {
  const res = await req<{ userId: string; email: string; name: string; token?: string }>(
    "POST", "/api/auth/login", data
  );
  if (res.token) storeAuthToken(res.token);
  return res;
};
export const logout = () => {
  storeAuthToken(null);
  return req<{ ok: boolean }>("POST", "/api/auth/logout");
};
export const getMe = async (): Promise<{ userId: string; email: string }> => {
  const data = await req<{ userId: string; email: string; token?: string }>("GET", "/api/auth/me");
  // Bootstrap the in-memory token from the /me response so Bearer auth works
  // even when httpOnly cookies aren't forwarded by a reverse proxy.
  if (data.token) storeAuthToken(data.token);
  return data;
};

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
  const res = await fetch(`/api/litigation/intake/${documentId}`, { credentials: "include" });
  if (!res.ok) return null;
  return res.json() as Promise<LitigationIntakeData | null>;
}

export async function saveLitigationIntake(documentId: string, data: Partial<LitigationIntakeData>) {
  const res = await fetch(`/api/litigation/intake/${documentId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save intake");
  return res.json() as Promise<LitigationIntakeData>;
}

// Ancillary documents
export async function getAncillaryDocuments(documentId: string) {
  const res = await fetch(`/api/ancillary/${documentId}`, { credentials: "include" });
  if (!res.ok) return [];
  return res.json() as Promise<AncillaryDocumentData[]>;
}

export async function uploadAncillaryDocument(
  documentId: string,
  file: File,
  privilegeFlag: boolean
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("privilegeFlag", String(privilegeFlag));
  const res = await fetch(`/api/ancillary/${documentId}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to upload ancillary document");
  return res.json() as Promise<AncillaryDocumentData>;
}

export async function deleteAncillaryDocument(ancillaryId: string) {
  await fetch(`/api/ancillary/${ancillaryId}`, { method: "DELETE", credentials: "include" });
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
) => req("POST", `/api/feedback/${resultId}`, data);

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

export const getFeedbackPatterns = () =>
  req<{
    patterns: ZanePattern[];
    clauseOutcomes: ClauseOutcome[];
    counterpartyPatterns: CounterpartyPattern[];
    negotiationDrift: NegotiationDrift[];
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
