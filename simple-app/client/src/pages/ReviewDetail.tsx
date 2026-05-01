import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { getReview, saveFeedback } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import type { ReviewResult, RagStatus, FeedbackAction } from "../lib/types";
import { CLAUSE_LABELS } from "../lib/types";

const RAG_BADGE: Record<RagStatus, string> = {
  RED:   "rag-red",
  AMBER: "rag-amber",
  GREEN: "rag-green",
  GREY:  "rag-grey",
};

const RAG_DOT: Record<RagStatus, string> = {
  RED:   "bg-red-500",
  AMBER: "bg-amber-500",
  GREEN: "bg-emerald-500",
  GREY:  "bg-slate-400",
};

const RAG_LABEL: Record<RagStatus, string> = {
  RED:   "Red",
  AMBER: "Amber",
  GREEN: "Green",
  GREY:  "Missing",
};

export default function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<RagStatus | "ALL">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: doc, isLoading } = useQuery({
    queryKey: ["review", id],
    queryFn: () => getReview(id!),
    refetchInterval: (query) => {
      const d = query.state.data;
      return d?.status === "PROCESSING" ? 3000 : false;
    },
  });

  async function handleFeedback(resultId: string, action: FeedbackAction) {
    await saveFeedback(resultId, { userAction: action });
    await queryClient.invalidateQueries({ queryKey: ["review", id] });
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-5xl mx-auto">
          <BackButton onClick={() => navigate("/dashboard")} />
          <div className="text-sm text-muted-foreground mt-8">Loading review…</div>
        </div>
      </AppLayout>
    );
  }

  if (!doc) {
    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-5xl mx-auto">
          <BackButton onClick={() => navigate("/dashboard")} />
          <div className="text-sm text-destructive mt-8">Document not found.</div>
        </div>
      </AppLayout>
    );
  }

  if (doc.status === "PROCESSING") {
    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-5xl mx-auto space-y-4">
          <BackButton onClick={() => navigate("/dashboard")} />
          <div className="card p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
            <div className="font-semibold">MIKE is reviewing this contract</div>
            <div className="text-sm text-muted-foreground max-w-sm mx-auto">
              Classifying clauses, comparing against your playbook and regulatory frameworks.
              Usually takes 1–3 minutes.
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (doc.status === "FAILED") {
    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-5xl mx-auto space-y-4">
          <BackButton onClick={() => navigate("/dashboard")} />
          <div className="card p-12 text-center space-y-3">
            <AlertTriangle size={32} className="text-destructive mx-auto" />
            <div className="font-semibold text-destructive">Review failed</div>
            <div className="text-sm text-muted-foreground">Go back to the dashboard and retry.</div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const results = doc.reviewResults ?? [];
  const counts = {
    RED:   results.filter((r) => r.ragStatus === "RED").length,
    AMBER: results.filter((r) => r.ragStatus === "AMBER").length,
    GREEN: results.filter((r) => r.ragStatus === "GREEN").length,
    GREY:  results.filter((r) => r.ragStatus === "GREY").length,
  };
  const overallRag: RagStatus = counts.RED > 0 ? "RED" : counts.AMBER > 0 ? "AMBER" : "GREEN";
  const filtered = filter === "ALL" ? results : results.filter((r) => r.ragStatus === filter);

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-5xl mx-auto space-y-6">
        {/* Back + title */}
        <div className="space-y-1">
          <BackButton onClick={() => navigate("/dashboard")} />
          <h1 className="text-xl font-semibold truncate">{doc.originalName}</h1>
          <div className="text-sm text-muted-foreground">
            {doc.contractType.replace(/_/g, " ")} ·{" "}
            {new Date(doc.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>

        {/* Summary bar */}
        <div className="card p-5 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${RAG_DOT[overallRag]}`} />
            <span className="font-semibold text-sm">Overall: {RAG_LABEL[overallRag]}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["RED", "AMBER", "GREEN", "GREY"] as RagStatus[]).map((s) =>
              counts[s] > 0 ? (
                <span key={s} className={RAG_BADGE[s]}>
                  {counts[s]} {RAG_LABEL[s]}
                </span>
              ) : null
            )}
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {results.length} clauses reviewed
          </div>
        </div>

        {/* Escalations callout */}
        {results.some((r) => r.escalationRequired) && (
          <div className="card border-red-200 bg-red-50 p-4 flex gap-3">
            <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <span className="font-semibold">Escalation required</span> -{" "}
              {results.filter((r) => r.escalationRequired).length} clause
              {results.filter((r) => r.escalationRequired).length !== 1 ? "s need" : " needs"} sign-off
              before proceeding.
            </div>
          </div>
        )}

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {(["ALL", "RED", "AMBER", "GREEN", "GREY"] as const).map((f) => {
            const count = f === "ALL" ? results.length : counts[f];
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filter === f
                    ? "bg-foreground text-background border-foreground"
                    : "border-border hover:border-foreground/50 text-foreground"
                }`}
              >
                {f === "ALL" ? `All (${count})` : `${RAG_LABEL[f as RagStatus]} (${count})`}
              </button>
            );
          })}
        </div>

        {/* Clause cards */}
        <div className="space-y-3">
          {filtered.map((result) => (
            <ClauseCard
              key={result.id}
              result={result}
              expanded={expandedId === result.id}
              onToggle={() => setExpandedId(expandedId === result.id ? null : result.id)}
              onFeedback={(action) => handleFeedback(result.id, action)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-sm text-muted-foreground py-10 text-center">
              No clauses in this category.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Clause Card ──────────────────────────────────────────────────────────────

function ClauseCard({
  result,
  expanded,
  onToggle,
  onFeedback,
}: {
  result: ReviewResult;
  expanded: boolean;
  onToggle: () => void;
  onFeedback: (action: FeedbackAction) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState<FeedbackAction | null>(null);
  const feedback = result.feedback;
  const label = CLAUSE_LABELS[result.clauseCategory] ?? result.clauseCategory;

  async function handle(action: FeedbackAction) {
    setSubmitting(action);
    try { await onFeedback(action); } finally { setSubmitting(null); }
  }

  return (
    <div className={`card overflow-hidden ${expanded ? "shadow-md" : ""}`}>
      {/* Header row */}
      <button
        className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-muted/20 transition-colors"
        onClick={onToggle}
      >
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${RAG_DOT[result.ragStatus]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{label}</span>
            {result.isAbsent && (
              <span className="text-[11px] bg-slate-100 text-slate-600 border border-slate-200 rounded px-1.5 py-0.5">
                Not found in contract
              </span>
            )}
            {result.escalationRequired && (
              <span className="text-[11px] bg-red-100 text-red-700 border border-red-200 rounded px-1.5 py-0.5 flex items-center gap-1">
                <AlertTriangle size={10} /> Escalate
              </span>
            )}
            {feedback && (
              <span className="text-[11px] bg-muted text-muted-foreground border border-border rounded px-1.5 py-0.5 capitalize">
                {feedback.userAction.toLowerCase()}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {result.clauseSummary}
          </div>
        </div>
        <span className={RAG_BADGE[result.ragStatus]}>{RAG_LABEL[result.ragStatus]}</span>
        <span className="text-muted-foreground text-xs ml-1 shrink-0">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-card-border px-5 py-5 space-y-5 bg-muted/10">
          <Detail title="What this clause says">
            <p className="text-sm leading-relaxed">{result.clauseSummary}</p>
          </Detail>

          <Detail title="Why it matters">
            <p className="text-sm leading-relaxed">{result.whyItMatters}</p>
          </Detail>

          <Detail title="Recommended action">
            <div className="text-sm font-semibold text-foreground bg-card border border-card-border rounded-lg px-4 py-3">
              {result.recommendedAction}
            </div>
          </Detail>

          {result.suggestedFallback && (
            <Detail title="Suggested fallback language">
              <blockquote className="text-sm leading-relaxed border-l-2 border-primary/50 pl-4 text-muted-foreground italic">
                {result.suggestedFallback}
              </blockquote>
            </Detail>
          )}

          {result.escalationRequired && result.escalationTrigger && (
            <Detail title="Escalation trigger">
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800 flex gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                {result.escalationTrigger}
              </div>
            </Detail>
          )}

          <Detail title="Plain English summary - for stakeholders">
            <div className="bg-card border border-card-border rounded-lg px-4 py-3 text-sm leading-relaxed">
              {result.businessSummary}
            </div>
          </Detail>

          {/* Feedback */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-card-border">
            <span className="text-xs text-muted-foreground">Outcome:</span>
            {(["ACCEPTED", "ESCALATED", "DISMISSED"] as FeedbackAction[]).map((action) => {
              const icons: Record<string, React.ReactNode> = {
                ACCEPTED: <CheckCircle size={12} />,
                ESCALATED: <AlertTriangle size={12} />,
                DISMISSED: <Clock size={12} />,
              };
              return (
                <button
                  key={action}
                  disabled={!!submitting}
                  onClick={() => handle(action)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors disabled:opacity-50 ${
                    feedback?.userAction === action
                      ? "bg-foreground text-background border-foreground"
                      : "border-border hover:border-foreground/50"
                  }`}
                >
                  {submitting === action ? "…" : <>{icons[action]} {action.charAt(0) + action.slice(1).toLowerCase()}</>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft size={14} /> Dashboard
    </button>
  );
}
