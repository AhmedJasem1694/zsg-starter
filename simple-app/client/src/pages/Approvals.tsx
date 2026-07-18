import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckSquare, CheckCircle, XCircle, ChevronRight, Clock } from "lucide-react";
import AppLayout from "../components/layout/AppLayout";
import { getApprovals, type ApprovalListItem } from "../lib/api";
import { formatDateTime } from "../lib/dateUtils";
import { CLAUSE_LABELS, type ClauseCategory } from "../lib/types";

// ── Approvals queue ───────────────────────────────────────────────────────────
// The receiving half of the escalation flow: contracts waiting on a decision,
// grouped by the approver role they were routed to.

const ROLE_LABELS: Record<string, string> = {
  CFO: "CFO",
  BOARD: "Board",
  GC: "GC",
  LEGAL: "Legal",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

function clauseLabel(cat: string | null): string | null {
  if (!cat) return null;
  return CLAUSE_LABELS[cat as ClauseCategory] ?? cat.replace(/_/g, " ");
}

function fmtValue(value: number | null, currency: string): string {
  if (value == null || value === 0) return "Value not stated";
  const symbol = currency === "GBP" || !currency ? "£" : `${currency} `;
  return `${symbol}${value.toLocaleString("en-GB")}`;
}

function PendingRow({ a }: { a: ApprovalListItem }) {
  return (
    <Link
      to={`/app/legal/approvals/${a.id}`}
      className="flex items-center gap-4 px-5 py-4 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] shadow-sm hover:border-[#94A3B8] transition-colors group"
    >
      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
        <Clock size={14} className="text-[#854F0B]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-bold text-[#0B1020] truncate">{a.counterpartyName || a.documentName}</span>
          <span className="text-xs text-[#64748B]">{fmtValue(a.contractValue, a.currency)}</span>
          {a.clauseCategory && (
            <span className="text-xs text-[#64748B]">· {clauseLabel(a.clauseCategory)}</span>
          )}
        </div>
        <div className="text-xs text-[#64748B] mt-0.5 truncate">{a.reason || "Routed for approval"}</div>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded bg-[#EEF2FF] text-[#3730A3] shrink-0">
        {roleLabel(a.routedToRole)}
      </span>
      <span className="text-xs font-semibold text-[#0B1020] shrink-0 group-hover:translate-x-0.5 transition-transform">
        Decide →
      </span>
    </Link>
  );
}

function ResolvedRow({ a }: { a: ApprovalListItem }) {
  const approved = a.status === "APPROVED";
  return (
    <Link
      to={`/app/legal/approvals/${a.id}`}
      className="flex items-center gap-4 px-5 py-3 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] hover:bg-[#F8FAFC] transition-colors"
    >
      {approved
        ? <CheckCircle size={14} className="text-[#1B7A4B] shrink-0" />
        : <XCircle size={14} className="text-[#A32D2D] shrink-0" />}
      <div className="flex-1 min-w-0 flex items-baseline gap-2">
        <span className="text-sm font-medium text-[#0B1020] truncate">{a.counterpartyName || a.documentName}</span>
        <span className="text-xs text-[#64748B] truncate">
          {approved ? "Approved" : "Rejected"} by {a.decidedByName || "unknown"} ({roleLabel(a.deciderRole || a.routedToRole)})
        </span>
      </div>
      <span className="text-[11px] text-[#94A3B8] font-mono shrink-0">{a.decidedAt ? formatDateTime(a.decidedAt) : ""}</span>
      <ChevronRight size={13} className="text-[#94A3B8] shrink-0" />
    </Link>
  );
}

export default function Approvals() {
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["approvals"],
    queryFn: () => getApprovals(),
    refetchInterval: 30000,
  });

  const all = data?.approvals ?? [];
  const roles = Array.from(new Set(all.map((a) => a.routedToRole)));
  const filtered = roleFilter === "ALL" ? all : all.filter((a) => a.routedToRole === roleFilter);
  const pending = filtered.filter((a) => a.status === "PENDING");
  const resolved = filtered.filter((a) => a.status !== "PENDING");

  return (
    <AppLayout>
      <div className="theme-light min-h-full bg-background">
        <div className="px-6 py-10 max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center gap-3">
            <CheckSquare size={22} className="text-[#2563EB]" />
            <div>
              <h1 className="text-2xl font-semibold">Approvals</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Contracts waiting on an approver's decision before they can proceed.
              </p>
            </div>
          </div>

          {/* Role filter */}
          <div className="flex items-center gap-1.5">
            {["ALL", ...roles].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  roleFilter === r
                    ? "border-[#2563EB] bg-[#2563EB] text-white"
                    : "border-[#E2E8F0] bg-white text-[#64748B] hover:text-[#0B1020]"
                }`}
              >
                {r === "ALL" ? "All roles" : roleLabel(r)}
              </button>
            ))}
          </div>

          {/* Pending */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Awaiting decision {pending.length > 0 && `(${pending.length})`}
            </h2>
            {isLoading && (
              <div className="card px-5 py-10 text-center text-sm text-muted-foreground">Loading approvals…</div>
            )}
            {isError && (
              <div className="card px-5 py-10 text-center text-sm text-[#A32D2D]">Could not load the approvals queue. Try again.</div>
            )}
            {!isLoading && !isError && pending.length === 0 && (
              <div className="card px-5 py-10 text-center space-y-2">
                <CheckCircle size={20} className="text-[#1B7A4B] mx-auto" />
                <div className="text-sm font-medium">Nothing waiting for approval.</div>
                <div className="text-xs text-muted-foreground">Escalated clauses appear here, routed to the right approver.</div>
              </div>
            )}
            <div className="space-y-2">
              {pending.map((a) => <PendingRow key={a.id} a={a} />)}
            </div>
          </div>

          {/* Resolved */}
          {resolved.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Decided</h2>
              <div className="space-y-2">
                {resolved.map((a) => <ResolvedRow key={a.id} a={a} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
