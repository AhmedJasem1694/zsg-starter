import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, XCircle, Loader2, BookOpen, AlertTriangle } from "lucide-react";
import AppLayout from "../components/layout/AppLayout";
import { getApproval, decideApproval } from "../lib/api";
import { formatDateTime } from "../lib/dateUtils";
import { CLAUSE_LABELS, type ClauseCategory } from "../lib/types";

// ── Approval decision screen ──────────────────────────────────────────────────
// A focused, role-aware decision view for a busy approver: the contract facts,
// why this landed with them, the flagged risk in plain English, the playbook
// position, and an Approve / Reject decision that requires a typed reason.
// Deliberately not the full lawyer review.

const ROLE_LABELS: Record<string, string> = { CFO: "CFO", BOARD: "Board", GC: "GC", LEGAL: "Legal" };

const RAG_PILL: Record<string, string> = {
  RED:   "bg-[#FCEBEB] text-[#A32D2D]",
  AMBER: "bg-[#FAEEDA] text-[#854F0B]",
  GREEN: "bg-[#E7F6EE] text-[#1B7A4B]",
  GREY:  "bg-[#F1F5F9] text-[#64748B]",
};

function fmtValue(value: number | null, currency: string): string {
  if (value == null || value === 0) return "Not stated";
  const symbol = currency === "GBP" || !currency ? "£" : `${currency} `;
  return `${symbol}${value.toLocaleString("en-GB")}`;
}

export default function ApprovalDecision() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["approval", id],
    queryFn: () => getApproval(id!),
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const decideMutation = useMutation({
    mutationFn: ({ decision }: { decision: "APPROVED" | "REJECTED" }) =>
      decideApproval(id!, decision, reason.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["approval", id] });
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e) => {
      setError(e instanceof Error ? e.message : "The decision could not be saved. Try again.");
      // A 409 means someone else decided first: refetch so the decided card
      // replaces the stale pending form.
      void queryClient.invalidateQueries({ queryKey: ["approval", id] });
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
  });

  const decided = data && data.status !== "PENDING";
  const roleLabel = data ? (ROLE_LABELS[data.routedToRole] ?? data.routedToRole) : "";
  const clauseName = data?.clauseCategory
    ? (CLAUSE_LABELS[data.clauseCategory as ClauseCategory] ?? data.clauseCategory.replace(/_/g, " "))
    : null;

  return (
    <AppLayout>
      <div className="theme-light min-h-full bg-background">
        <div className="px-6 py-10 max-w-2xl mx-auto space-y-6">
          <button
            onClick={() => navigate("/app/legal/approvals")}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={13} /> Approvals queue
          </button>

          {isLoading && (
            <div className="card px-6 py-14 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          )}
          {isError && (
            <div className="card px-6 py-14 text-center text-sm text-[#A32D2D]">
              This approval request could not be loaded.
            </div>
          )}

          {data && (
            <>
              {/* What and who */}
              <div className="card p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">
                      {roleLabel} approval requested
                    </div>
                    <h1 className="text-lg font-semibold text-[#0B1020] mt-1 leading-snug">
                      {data.document?.name ?? "Contract no longer in the library"}
                    </h1>
                    <div className="text-sm text-[#64748B] mt-0.5">
                      {data.document?.counterpartyName || "Counterparty not identified"}
                      {" · "}{fmtValue(data.document?.contractValue ?? null, data.document?.currency ?? "GBP")}
                    </div>
                  </div>
                  {data.clause?.ragStatus && (
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded shrink-0 ${RAG_PILL[data.clause.ragStatus] ?? RAG_PILL.GREY}`}>
                      {data.clause.ragStatus}
                    </span>
                  )}
                </div>

                <div className="rounded-lg bg-[#FAEEDA] border border-amber-200/70 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#854F0B] mb-1">
                    Why this needs your approval
                  </div>
                  <p className="text-sm text-[#0B1020] leading-relaxed">{data.reason || "Routed for approval."}</p>
                </div>

                {data.clause?.plainEnglish && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                      {clauseName ? `The risk: ${clauseName}` : "The risk"}
                    </div>
                    <p className="text-sm text-[#0B1020] leading-relaxed">{data.clause.plainEnglish}</p>
                  </div>
                )}

                {data.playbookPosition?.preferred && (
                  <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#64748B] mb-1">
                      <BookOpen size={11} /> Your playbook position
                    </div>
                    <p className="text-xs text-[#475569] leading-relaxed">{data.playbookPosition.preferred}</p>
                    {data.playbookPosition.redLine && (
                      <p className="text-xs text-[#A32D2D] leading-relaxed mt-1.5">
                        <span className="font-semibold">Red line:</span> {data.playbookPosition.redLine}
                      </p>
                    )}
                  </div>
                )}

                <div className="text-[11px] text-[#94A3B8]">
                  Requested {formatDateTime(data.createdAt)}{data.requestedBy ? ` by ${data.requestedBy}` : ""}
                  {data.document && (
                    <>
                      {" · "}
                      <Link to={`/app/legal/review/${data.document.id}`} className="text-[#2563EB] hover:underline">
                        Open the full review
                      </Link>
                    </>
                  )}
                </div>
              </div>

              {/* Decision */}
              {decided ? (
                <div className={`card p-6 space-y-2 ${data.status === "APPROVED" ? "border-emerald-200/70" : "border-red-200/70"}`}>
                  <div className="flex items-center gap-2">
                    {data.status === "APPROVED"
                      ? <CheckCircle size={16} className="text-[#1B7A4B]" />
                      : <XCircle size={16} className="text-[#A32D2D]" />}
                    <span className="text-sm font-semibold text-[#0B1020]">
                      {data.status === "APPROVED" ? "Approved" : "Rejected"} by {data.decidedByName || "unknown"} ({ROLE_LABELS[data.deciderRole] ?? data.deciderRole})
                    </span>
                  </div>
                  <p className="text-sm text-[#64748B] leading-relaxed">{data.decisionReason}</p>
                  <div className="text-[11px] text-[#94A3B8] font-mono">{data.decidedAt ? formatDateTime(data.decidedAt) : ""}</div>
                </div>
              ) : (
                <div className="card p-6 space-y-4">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                      Your reason (recorded in the audit history)
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => { setReason(e.target.value); setError(null); }}
                      placeholder="Why you are approving or rejecting this…"
                      className="mt-1.5 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1020] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] min-h-[72px] resize-y"
                    />
                  </div>
                  {error && (
                    <div className="flex items-start gap-2 text-xs text-[#A32D2D]">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {error}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => decideMutation.mutate({ decision: "APPROVED" })}
                      disabled={!reason.trim() || decideMutation.isPending}
                      className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-[#1B7A4B] hover:bg-[#166339] text-white transition-colors disabled:opacity-40"
                    >
                      {decideMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                      Approve
                    </button>
                    <button
                      onClick={() => decideMutation.mutate({ decision: "REJECTED" })}
                      disabled={!reason.trim() || decideMutation.isPending}
                      className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-white border border-red-200 text-[#A32D2D] hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      <XCircle size={13} /> Reject
                    </button>
                    {!reason.trim() && (
                      <span className="text-[11px] text-[#94A3B8]">Type a reason to enable the decision.</span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
