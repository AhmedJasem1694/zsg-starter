import type {
  Company,
  PlaybookRule,
  ApprovalContact,
  UploadedDocument,
  CompanyRegulation,
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

// Company
export const getCompany = () => req<Company>("GET", "/api/company");
export const createCompany = (data: {
  name: string;
  sector: string;
  jurisdiction: string;
  role: string;
  riskAppetite: string;
}) => req<Company>("POST", "/api/company", data);

// Playbook
export const getPlaybookRules = () => req<PlaybookRule[]>("GET", "/api/playbook/rules");
export const savePlaybookRules = (rules: Omit<PlaybookRule, "id" | "companyId">[]) =>
  req<PlaybookRule[]>("POST", "/api/playbook/rules", { rules });
export const updatePlaybookRule = (id: string, data: Partial<PlaybookRule>) =>
  req<PlaybookRule>("PUT", `/api/playbook/rule/${id}`, data);

// Contacts
export const saveContacts = (
  contacts: Omit<ApprovalContact, "id" | "companyId">[]
) => req<ApprovalContact[]>("POST", "/api/company/contacts", { contacts });

// Documents
export const getDocuments = () => req<UploadedDocument[]>("GET", "/api/documents");
export const getDocument = (id: string) =>
  req<UploadedDocument>("GET", `/api/documents/${id}`);

export const uploadDocument = async (
  file: File,
  contractType: string
): Promise<UploadedDocument> => {
  const form = new FormData();
  form.append("contract", file);
  form.append("contractType", contractType);
  return req<UploadedDocument>("POST", "/api/documents/upload", form);
};

// Review
export const startReview = (documentId: string) =>
  req<{ status: string; documentId: string }>("POST", `/api/review/${documentId}`);
export const getReview = (documentId: string) =>
  req<UploadedDocument>("GET", `/api/review/${documentId}`);

// Auth
export const register = (data: { name: string; email: string; password: string }) =>
  req<{ userId: string; email: string; name: string }>("POST", "/api/auth/register", data);
export const login = (data: { email: string; password: string }) =>
  req<{ userId: string; email: string; name: string }>("POST", "/api/auth/login", data);
export const logout = () => req<{ ok: boolean }>("POST", "/api/auth/logout");
export const getMe = () => req<{ userId: string; email: string }>("GET", "/api/auth/me");

// Regulatory
export const getRegulations = () => req<CompanyRegulation[]>("GET", "/api/regulatory");
export const detectRegulations = () => req<CompanyRegulation[]>("POST", "/api/regulatory/detect");

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
