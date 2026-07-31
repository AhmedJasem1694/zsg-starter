import { useQuery } from "@tanstack/react-query";
import {
  X, Upload, Play, ShieldCheck, Tag, AlertTriangle, CheckCircle, XCircle,
  MessageSquare, GraduationCap, Flag, FileCheck, GitBranch, Loader2, ClipboardList,
} from "lucide-react";
import { getContractAudit, type ContractAuditEvent } from "../lib/api";
import { formatDateTime } from "../lib/dateUtils";
import { CLAUSE_LABELS, type ClauseCategory } from "../lib/types";

// ── Per-contract audit history modal ──────────────────────────────────────────
// Chronological timeline of everything that happened to one agreement: what
// Zane recommended, RAG assignments, human decisions and captured reasons,
// escalations, outcome capture, and version movement. Read-only view over the
// per-contract audit endpoint; the system-wide Audit Trail is separate.

function clauseLabel(cat: string | null): string | null {
  if (!cat) return null;
  return CLAUSE_LABELS[cat as ClauseCategory] ?? cat.replace(/_/g, " ");
}

const RAG_PILL: Record<string, string> = {
  RED:   "bg-[#FCEBEB] text-[#A32D2D]",
  AMBER: "bg-[#FAEEDA] text-[#854F0B]",
  GREEN: "bg-[#E7F6EE] text-[#1B7A4B]",
  GREY:  "bg-[#F1F5F9] text-[#64748B]",
};

interface EventPresentation {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  lines: string[];
}

function present(e: ContractAuditEvent): EventPresentation {
  const d = e.detail ?? {};
  const clause = clauseLabel(e.clauseCategory);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  switch (e.action) {
    case "contract_uploaded":
      return {
        icon: <Upload size={13} className="text-[#185FA5]" />, iconBg: "bg-[#E6F1FB]",
        title: "Contract uploaded",
        lines: [str(d.originalName) ?? ""].filter(Boolean) as string[],
      };
    case "review_started":
      return { icon: <Play size={13} className="text-[#64748B]" />, iconBg: "bg-[#F1F5F9]", title: "Zane review started", lines: [] };
    case "pii_anonymisation_started":
      return { icon: <ShieldCheck size={13} className="text-[#64748B]" />, iconBg: "bg-[#F1F5F9]", title: "PII anonymisation started", lines: [] };
    case "pii_anonymisation_completed":
      return {
        icon: <ShieldCheck size={13} className="text-[#1B7A4B]" />, iconBg: "bg-[#E7F6EE]",
        title: "PII anonymisation completed",
        lines: [typeof d.entitiesDetected === "number" ? `${d.entitiesDetected} entities protected` : ""].filter(Boolean) as string[],
      };
    case "rag_status_assigned": {
      const from = str(d.overrideFrom);
      const to = str(d.overrideTo);
      if (from && to) {
        return {
          icon: <Tag size={13} className="text-[#854F0B]" />, iconBg: "bg-[#FAEEDA]",
          title: `${clause ?? "Clause"} status overridden: ${from} to ${to}`,
          lines: [str(d.reason) ? `Reason: ${str(d.reason)}` : ""].filter(Boolean) as string[],
        };
      }
      const rag = e.ragStatus ?? "GREY";
      return {
        icon: <Tag size={13} className={rag === "RED" ? "text-[#A32D2D]" : rag === "AMBER" ? "text-[#854F0B]" : rag === "GREEN" ? "text-[#1B7A4B]" : "text-[#64748B]"} />,
        iconBg: rag === "RED" ? "bg-[#FCEBEB]" : rag === "AMBER" ? "bg-[#FAEEDA]" : rag === "GREEN" ? "bg-[#E7F6EE]" : "bg-[#F1F5F9]",
        title: `Zane assessed ${clause ?? "a clause"}`,
        lines: [
          d.escalationRequired ? `Escalation required${e.escalationTrigger ? `: ${e.escalationTrigger}` : ""}` : "",
          str(d.confidenceLabel) ? `Confidence: ${str(d.confidenceLabel)}` : "",
        ].filter(Boolean) as string[],
      };
    }
    case "contradiction_detected":
      return {
        icon: <AlertTriangle size={13} className="text-[#854F0B]" />, iconBg: "bg-[#FAEEDA]",
        title: "Contradiction detected between clauses",
        lines: [str(d.description) ?? str(d.summary) ?? ""].filter(Boolean) as string[],
      };
    case "review_completed":
      return {
        icon: <CheckCircle size={13} className="text-[#1B7A4B]" />, iconBg: "bg-[#E7F6EE]",
        title: "Zane review completed",
        lines: [
          [typeof d.redCount === "number" ? `${d.redCount} red` : "", typeof d.amberCount === "number" ? `${d.amberCount} amber` : "", typeof d.greenCount === "number" ? `${d.greenCount} green` : ""].filter(Boolean).join(", "),
        ].filter(Boolean) as string[],
      };
    case "review_failed":
      return {
        icon: <XCircle size={13} className="text-[#A32D2D]" />, iconBg: "bg-[#FCEBEB]",
        title: "Review failed",
        lines: [str(d.error) ?? ""].filter(Boolean) as string[],
      };
    case "feedback_accepted":
      return { icon: <CheckCircle size={13} className="text-[#1B7A4B]" />, iconBg: "bg-[#E7F6EE]", title: `Accepted Zane's recommendation${clause ? ` on ${clause}` : ""}`, lines: [] };
    case "feedback_edited":
      return { icon: <MessageSquare size={13} className="text-[#185FA5]" />, iconBg: "bg-[#E6F1FB]", title: `Edited the suggested language${clause ? ` on ${clause}` : ""}`, lines: [] };
    case "feedback_escalated":
      return { icon: <AlertTriangle size={13} className="text-[#854F0B]" />, iconBg: "bg-[#FAEEDA]", title: `Escalated for approval${clause ? `: ${clause}` : ""}`, lines: [e.escalationTrigger ? `Trigger: ${e.escalationTrigger}` : ""].filter(Boolean) as string[] };
    case "feedback_dismissed":
      return { icon: <XCircle size={13} className="text-[#64748B]" />, iconBg: "bg-[#F1F5F9]", title: `Dismissed the flag${clause ? ` on ${clause}` : ""}`, lines: [] };
    case "teach_zane_correction":
      return { icon: <GraduationCap size={13} className="text-[#185FA5]" />, iconBg: "bg-[#E6F1FB]", title: `Analysis corrected via Teach Zane${clause ? ` on ${clause}` : ""}`, lines: [] };
    case "false_positive_marked":
      return { icon: <Flag size={13} className="text-[#64748B]" />, iconBg: "bg-[#F1F5F9]", title: `Marked as false positive${clause ? `: ${clause}` : ""}`, lines: [] };
    case "contract_outcome_captured":
      return {
        icon: <FileCheck size={13} className="text-[#1B7A4B]" />, iconBg: "bg-[#E7F6EE]",
        title: `Outcome recorded: ${str(d.outcome) ?? "signed"}`,
        lines: [],
      };
    case "decision_captured": {
      const action = str(d.humanAction);
      const reason = str(d.reasonText) ?? str(d.overrideReason);
      const reasonCat = str(d.reasonCategory);
      return {
        icon: <MessageSquare size={13} className="text-[#185FA5]" />, iconBg: "bg-[#E6F1FB]",
        title: `Decision${clause ? ` on ${clause}` : ""}: ${action ?? "recorded"}${str(d.zaneRecommendation) ? ` (Zane recommended ${str(d.zaneRecommendation)})` : ""}`,
        lines: [
          str(d.finalPosition) ? `Position: ${str(d.finalPosition)}` : "",
          reasonCat ? `Reason: ${reasonCat}${reason ? ` - ${reason}` : ""}` : reason ? `Reason: ${reason}` : "",
        ].filter(Boolean) as string[],
      };
    }
    case "escalation_triggered":
      return {
        icon: <AlertTriangle size={13} className="text-[#854F0B]" />, iconBg: "bg-[#FAEEDA]",
        title: `Routed to ${str(d.role) ?? "an approver"} for approval${clause ? `: ${clause}` : ""}`,
        lines: [str(d.reason) ?? ""].filter(Boolean) as string[],
      };
    case "escalation_email_sent":
      return {
        icon: <MessageSquare size={13} className="text-[#64748B]" />, iconBg: "bg-[#F1F5F9]",
        title: `Approval request sent to ${str(d.recipient) ?? "the approver"}`,
        lines: [],
      };
    case "approval_granted":
      return {
        icon: <CheckCircle size={13} className="text-[#1B7A4B]" />, iconBg: "bg-[#E7F6EE]",
        title: `Approved by ${str(d.approverName) ?? "approver"} (${str(d.role) ?? "approver"})${clause ? `: ${clause}` : ""}`,
        lines: [str(d.reason) ? `Reason: ${str(d.reason)}` : ""].filter(Boolean) as string[],
      };
    case "approval_rejected":
      return {
        icon: <XCircle size={13} className="text-[#A32D2D]" />, iconBg: "bg-[#FCEBEB]",
        title: `Rejected by ${str(d.approverName) ?? "approver"} (${str(d.role) ?? "approver"})${clause ? `: ${clause}` : ""}`,
        lines: [str(d.reason) ? `Reason: ${str(d.reason)}` : ""].filter(Boolean) as string[],
      };
    case "uploaded_as_new_version":
      return { icon: <GitBranch size={13} className="text-[#185FA5]" />, iconBg: "bg-[#E6F1FB]", title: `Uploaded as a new version of ${str(d.parentName) ?? "an earlier version"}`, lines: [] };
    case "new_version_uploaded":
      return { icon: <GitBranch size={13} className="text-[#185FA5]" />, iconBg: "bg-[#E6F1FB]", title: `New version uploaded: ${str(d.childName) ?? "a later version"}`, lines: [] };
    case "contract_deleted":
      return { icon: <XCircle size={13} className="text-[#64748B]" />, iconBg: "bg-[#F1F5F9]", title: "Contract deleted", lines: [] };
    default:
      return {
        icon: <ClipboardList size={13} className="text-[#64748B]" />, iconBg: "bg-[#F1F5F9]",
        title: e.action.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
        lines: [],
      };
  }
}

export default function ContractAuditModal({
  documentId,
  documentName,
  onClose,
}: {
  documentId: string;
  documentName?: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["contract-audit", documentId],
    queryFn: () => getContractAudit(documentId),
    // An audit view must reflect the action the user just took: always refetch
    // when the modal opens rather than serving the app-wide 30s stale cache.
    staleTime: 0,
    refetchOnMount: "always",
  });

  const events = data?.events ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-8" onClick={onClose}>
      <div
        className="theme-light bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl shadow-soft max-w-2xl w-full max-h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#0B1020]">Audit history</div>
            <div className="text-xs text-[#64748B] mt-0.5 truncate">{data?.documentName ?? documentName ?? ""}</div>
          </div>
          <button onClick={onClose} className="text-[#64748B] hover:text-[#64748B] transition-colors shrink-0" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Timeline */}
        <div className="px-6 py-5 overflow-y-auto">
          {isLoading && (
            <div className="py-10 text-center text-sm text-[#64748B] flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading history…
            </div>
          )}
          {isError && (
            <div className="py-10 text-center text-sm text-[#A32D2D]">Could not load the audit history. Try again.</div>
          )}
          {!isLoading && !isError && events.length === 0 && (
            <div className="py-10 text-center text-sm text-[#64748B]">No recorded history for this contract yet.</div>
          )}

          {events.length > 0 && (
            <ol className="relative border-l border-[#E2E8F0] ml-3 space-y-5">
              {events.map((e) => {
                const p = present(e);
                return (
                  <li key={e.id} className="relative pl-6">
                    <span className={`absolute -left-[13px] top-0 w-[26px] h-[26px] rounded-full border-2 border-white ${p.iconBg} flex items-center justify-center`}>
                      {p.icon}
                    </span>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-sm font-medium text-[#0B1020]">{p.title}</span>
                      {e.ragStatus && !String(e.action).startsWith("feedback") && (
                        <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${RAG_PILL[e.ragStatus] ?? RAG_PILL.GREY}`}>
                          {e.ragStatus}
                        </span>
                      )}
                    </div>
                    {p.lines.map((line, i) => (
                      <div key={i} className="text-xs text-[#64748B] mt-0.5 leading-relaxed">{line}</div>
                    ))}
                    <div className="text-[11px] text-[#64748B] font-mono mt-1">{formatDateTime(e.at)}</div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
