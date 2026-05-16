import type {
  Company,
  PlaybookRule,
  ApprovalContact,
  UploadedDocument,
  CompanyRegulation,
  LitigationIntakeData,
  AncillaryDocumentData,
} from "./types";

async function req<T>(
  method: string,
  url: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
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
export const register = (data: { name: string; email: string; password: string }) =>
  req<{ userId: string; email: string; name: string }>("POST", "/api/auth/register", data);
export const login = (data: { email: string; password: string }) =>
  req<{ userId: string; email: string; name: string }>("POST", "/api/auth/login", data);
export const logout = () => req<{ ok: boolean }>("POST", "/api/auth/logout");
export const getMe = () => req<{ userId: string; email: string }>("GET", "/api/auth/me");

// Portfolio
export const getPortfolio = () => req<{
  groups: { label: string; icon: string; red: number; amber: number; green: number }[];
  topRedCategories: { category: string; count: number; pct: number }[];
  byContractType: { type: string; red: number; amber: number; total: number }[];
  insight: string;
  totalDocuments: number;
  totalClauses: number;
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
 * Teach Zane — lawyer provides what Zane got wrong and the correct analysis.
 * Stored as feedbackType: TEACH_MIKE and routed to the knowledge layer.
 */
export const teachMike = (
  resultId: string,
  data: { incorrectOutput: string; correctOutput: string; notes?: string }
) => req("POST", `/api/feedback/teach-mike/${resultId}`, data);

/**
 * False Positive — marks the clause extraction as incorrect (clause wasn't
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

export interface MikePattern {
  type: string;
  message: string;
  severity: "info" | "warn" | "good";
}

export const getFeedbackPatterns = () =>
  req<{ patterns: MikePattern[]; clauseOutcomes: ClauseOutcome[] }>(
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

export const getAuditLog = (page = 1, limit = 50) =>
  req<{ entries: AuditEntry[]; totalPages: number; totalItems: number; page: number }>(
    "GET",
    `/api/audit?page=${page}&limit=${limit}`
  );

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
