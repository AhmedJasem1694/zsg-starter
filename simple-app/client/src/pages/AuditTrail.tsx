import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
import AppLayout from "../components/layout/AppLayout";
import { getAuditLog } from "../lib/api";
import type { AuditEntry } from "../lib/api";

function actionLabel(action: string) {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function actionColor(action: string): string {
  if (action.includes("fail") || action.includes("error")) return "text-[#FCA5A5]";
  if (action.includes("rag_status") || action.includes("review_completed")) return "text-[#86EFAC]";
  if (action.includes("escalat") || action.includes("feedback")) return "text-[#FCD34D]";
  if (action.includes("pii")) return "text-[#A5B4FC]";
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
        <div className="text-[11px] text-muted-foreground/50 shrink-0 w-32 font-mono">
          {new Date(entry.createdAt).toLocaleString("en-GB", {
            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
          })}
        </div>
        <span className={`text-xs font-semibold shrink-0 ${actionColor(entry.action)}`}>
          {actionLabel(entry.action)}
        </span>
        <span className="text-xs text-muted-foreground/50 shrink-0">{entry.entityType}</span>
        {entry.entityId && (
          <span className="text-[11px] text-muted-foreground/30 font-mono truncate hidden sm:block">
            {entry.entityId.slice(0, 12)}…
          </span>
        )}
        {hasDetail && (
          <span className="ml-auto text-[10px] text-muted-foreground/40 shrink-0">
            {expanded ? "▲" : "▼"}
          </span>
        )}
      </div>
      {expanded && hasDetail && (
        <div className="mt-2 ml-32 pl-3 border-l border-[#1E293B]">
          <pre className="text-[11px] text-[#94A3B8] font-mono whitespace-pre-wrap leading-relaxed">
            {JSON.stringify(detail, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function AuditTrail() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", page],
    queryFn: () => getAuditLog(page, 50),
  });

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <ClipboardList size={22} className="text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Audit Trail</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Immutable log of all significant actions taken by Zane and your team.
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading audit log…</div>
        )}

        {!isLoading && (!data?.entries?.length) && (
          <div className="card p-12 text-center space-y-3">
            <ClipboardList size={32} className="text-muted-foreground/30 mx-auto" />
            <div className="font-medium text-muted-foreground">No audit entries yet</div>
            <p className="text-xs text-muted-foreground">
              Entries are written as actions are taken — upload a contract to start.
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
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50 w-32 shrink-0">Time</span>
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">Action</span>
                <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">Entity</span>
              </div>
              {data.entries.map((entry) => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:border-[#475569] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft size={12} /> Previous
                </button>
                <span className="text-xs text-muted-foreground">
                  {page} / {data.totalPages}
                </span>
                <button
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:border-[#475569] disabled:opacity-40 disabled:pointer-events-none transition-colors"
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
