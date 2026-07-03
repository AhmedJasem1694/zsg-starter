import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, ChevronLeft, ChevronRight, Download, Search, X } from "lucide-react";
import AppLayout from "../components/layout/AppLayout";
import { getAuditLog, exportAuditLogCSV } from "../lib/api";
import type { AuditEntry } from "../lib/api";
import { formatDateTime } from "../lib/dateUtils";

const AUDIT_ACTION_OPTIONS = [
  "contract_uploaded",
  "review_started",
  "review_completed",
  "review_failed",
  "rag_status_assigned",
  "pii_anonymisation_started",
  "pii_anonymisation_completed",
  "escalation_triggered",
  "escalation_email_sent",
  "feedback_accepted",
  "feedback_edited",
  "feedback_escalated",
  "feedback_dismissed",
  "teach_zane_correction",
  "false_positive_marked",
  "playbook_updated",
  "playbook_rule_created",
  "playbook_rule_deleted",
  "playbook_suggestion_generated",
  "company_created",
  "user_registered",
  "user_login",
  "user_logout",
  "litigation_intake_started",
  "litigation_intake_completed",
  "governance_thresholds_saved",
  "governance_triggers_saved",
  "team_invite_sent",
  "regulatory_profile_updated",
  "contract_outcome_captured",
  "contradiction_detected",
  "audit_log_exported",
];

function actionLabel(action: string) {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function actionColor(action: string): string {
  if (action.includes("fail") || action.includes("error")) return "text-[#A32D2D]";
  if (action.includes("rag_status") || action.includes("review_completed")) return "text-[#1B7A4B]";
  if (action.includes("escalat") || action.includes("feedback")) return "text-[#854F0B]";
  if (action.includes("pii")) return "text-[#185FA5]";
  if (action.includes("export") || action.includes("login") || action.includes("logout")) return "text-[#64748B]";
  return "text-foreground/70";
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const detail = entry.detail ?? {};
  const hasDetail = Object.keys(detail).length > 0;

  return (
    <div
      className={`px-5 py-3 border-b border-card-border last:border-0 ${hasDetail ? "cursor-pointer hover:bg-muted/10 transition-colors" : ""}`}
      onClick={hasDetail ? () => setExpanded((v) => !v) : undefined}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="text-[11px] text-muted-foreground shrink-0 w-32 font-mono">
          {formatDateTime(entry.createdAt)}
        </div>
        <span className={`text-xs font-semibold shrink-0 ${actionColor(entry.action)}`}>
          {actionLabel(entry.action)}
        </span>
        <span className="text-xs text-muted-foreground shrink-0">{entry.entityType}</span>
        {entry.entityId && (
          <span className="text-[11px] text-muted-foreground font-mono truncate hidden sm:block">
            {entry.entityId.slice(0, 12)}…
          </span>
        )}
        {hasDetail && (
          <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
            {expanded ? "▲" : "▼"}
          </span>
        )}
      </div>
      {expanded && hasDetail && (
        <div className="mt-2 ml-32 pl-3 border-l border-[#E2E8F0]">
          <pre className="text-[11px] text-[#64748B] font-mono whitespace-pre-wrap leading-relaxed">
            {JSON.stringify(detail, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function AuditTrail() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filters = {
    action: actionFilter || undefined,
    from: fromDate ? fromDate + " 00:00:00" : undefined,
    to: toDate ? toDate + " 23:59:59" : undefined,
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit-log", page, filters],
    queryFn: () => getAuditLog(page, 50, filters),
  });

  function clearFilters() {
    setActionFilter("");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  const hasFilters = actionFilter || fromDate || toDate;

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <ClipboardList size={22} className="text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Audit Trail</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Immutable log of all significant actions taken by Zane and your team.
              </p>
            </div>
          </div>
          <button
            className="btn-secondary gap-2 text-sm shrink-0"
            onClick={() => exportAuditLogCSV(filters)}
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Search size={13} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Filter</span>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X size={11} /> Clear
              </button>
            )}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <select
              className="input text-sm py-1.5"
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            >
              <option value="">All actions</option>
              {AUDIT_ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>{actionLabel(a)}</option>
              ))}
            </select>
            <input
              type="date"
              className="input text-sm py-1.5"
              placeholder="From date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            />
            <input
              type="date"
              className="input text-sm py-1.5"
              placeholder="To date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {isLoading && (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading audit log…</div>
        )}

        {isError && (
          <div className="card p-8 text-center space-y-2">
            <div className="font-medium text-destructive">Failed to load audit log</div>
            <p className="text-xs text-muted-foreground">
              There was a problem fetching the audit entries. Please try refreshing the page.
            </p>
          </div>
        )}

        {!isLoading && !isError && (!data?.entries?.length) && (
          <div className="card p-12 text-center space-y-3">
            <ClipboardList size={32} className="text-muted-foreground mx-auto" />
            <div className="font-medium text-muted-foreground">
              {hasFilters ? "No entries match the current filters" : "No audit entries yet"}
            </div>
            <p className="text-xs text-muted-foreground">
              {hasFilters ? "Try adjusting the date range or action type." : "Entries are written as actions are taken - upload a contract to start."}
            </p>
          </div>
        )}

        {data?.entries && data.entries.length > 0 && (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{data.totalItems} total entries</span>
              <span>Page {data.page} of {data.totalPages}</span>
            </div>

            <div className="card overflow-hidden">
              {/* Column headers */}
              <div className="flex items-center gap-3 px-5 py-2.5 border-b border-card-border bg-muted/30">
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground w-32 shrink-0">Time</span>
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Action</span>
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Entity</span>
              </div>
              {data.entries.map((entry) => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:border-[#64748B] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft size={12} /> Previous
                </button>
                <span className="text-xs text-muted-foreground">
                  {page} / {data.totalPages}
                </span>
                <button
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:border-[#64748B] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= data.totalPages}
                >
                  Next <ChevronRight size={12} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
