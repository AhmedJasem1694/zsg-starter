import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ArrowLeft, AlertTriangle, Clock, CheckCircle, Download, ChevronDown, ChevronUp, Mail, Copy, Loader2, GraduationCap, XCircle, BookOpen, Scale, Zap, Info } from "lucide-react";
import { getReview, saveFeedback, generateReply, teachMike, markFalsePositive } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import type { ReviewResult, RagStatus, FeedbackAction, UploadedDocument, ConfidenceLabel, RegulatoryCitation } from "../lib/types";
import { CLAUSE_LABELS } from "../lib/types";

const RAG_BADGE: Record<RagStatus, string> = {
  RED:   "rag-red",
  AMBER: "rag-amber",
  GREEN: "rag-green",
  GREY:  "rag-grey",
};

const RAG_DOT: Record<RagStatus, string> = {
  RED:   "bg-[#FCA5A5]",
  AMBER: "bg-[#FCD34D]",
  GREEN: "bg-[#86EFAC]",
  GREY:  "bg-[#475569]",
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

  async function handleFeedback(resultId: string, action: FeedbackAction, finalClauseText?: string) {
    await saveFeedback(resultId, { userAction: action, finalClauseText });
    await queryClient.invalidateQueries({ queryKey: ["review", id] });
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-5xl mx-auto">
          <BackButton onClick={() => navigate("/app/legal/dashboard")} />
          <div className="text-sm text-muted-foreground mt-8">Loading review…</div>
        </div>
      </AppLayout>
    );
  }

  if (!doc) {
    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-5xl mx-auto">
          <BackButton onClick={() => navigate("/app/legal/dashboard")} />
          <div className="text-sm text-destructive mt-8">Document not found.</div>
        </div>
      </AppLayout>
    );
  }

  if (doc.status === "PROCESSING") {
    const elapsedSec = (Date.now() - new Date(doc.uploadedAt).getTime()) / 1000;
    const DETAIL_STAGES = [
      { label: "Parsing document",              maxSec: 15  },
      { label: "Anonymising sensitive data",    maxSec: 35  },
      { label: "Identifying clause categories", maxSec: 70  },
      { label: "Comparing against playbook",    maxSec: 130 },
      { label: "Applying regulatory context",   maxSec: 200 },
      { label: "Preparing review report",       maxSec: Infinity },
    ];
    const activeIdx = DETAIL_STAGES.findIndex((s) => elapsedSec < s.maxSec);
    const stageIdx  = activeIdx === -1 ? DETAIL_STAGES.length - 1 : activeIdx;

    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-5xl mx-auto space-y-4">
          <BackButton onClick={() => navigate("/app/legal/dashboard")} />
          <div className="card p-8 space-y-6 border-[#1C2A3A]" style={{ background: "#0D1B2A" }}>
            <div className="flex items-center gap-3">
              <Zap size={18} className="text-[#60A5FA]" />
              <div>
                <div className="font-semibold text-[#93C5FD]">Zane is reviewing this contract</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{doc.originalName}</div>
              </div>
            </div>
            <div className="space-y-2.5 max-w-sm">
              {DETAIL_STAGES.map((stage, i) => {
                const done    = i < stageIdx;
                const active  = i === stageIdx;
                const pending = i > stageIdx;
                return (
                  <div key={stage.label} className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                      ${done    ? "bg-[#14532D] border-[#166534]" : ""}
                      ${active  ? "bg-[#1C0F00] border-[#92400E] animate-pulse" : ""}
                      ${pending ? "bg-transparent border-[#1E293B]" : ""}`}>
                      {done && <CheckCircle size={10} className="text-[#86EFAC]" />}
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-[#FCD34D]" />}
                    </div>
                    <span className={`text-sm leading-none transition-all
                      ${done    ? "text-muted-foreground line-through" : ""}
                      ${active  ? "text-[#FCD34D] font-medium" : ""}
                      ${pending ? "text-muted-foreground/40" : ""}`}>
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-muted-foreground">Usually takes 1–3 minutes. This page auto-refreshes.</div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (doc.status === "FAILED") {
    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-5xl mx-auto space-y-4">
          <BackButton onClick={() => navigate("/app/legal/dashboard")} />
          <div className="card p-12 text-center space-y-3">
            <AlertTriangle size={32} className="text-destructive mx-auto" />
            <div className="font-semibold text-destructive">Review failed</div>
            <div className="text-sm text-muted-foreground">Go back to the dashboard and retry.</div>
          </div>
        </div>
      </AppLayout>
    );
  }

  function handleExport() {
    if (doc) exportReviewAsText(doc);
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
          <BackButton onClick={() => navigate("/app/legal/dashboard")} />
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
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{results.length} clauses reviewed</span>
            <button
              onClick={handleExport}
              className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5"
            >
              <Download size={12} /> Export
            </button>
          </div>
        </div>

        {/* Three-tier escalation summary */}
        <EscalationSummary doc={doc} results={results} />

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
                    ? "bg-[#2563EB] text-white border-[#2563EB]"
                    : "border-border hover:border-[#475569] text-foreground"
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
              onFeedback={(action, finalClauseText) => handleFeedback(result.id, action, finalClauseText)}
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

// Confidence badge config
const CONFIDENCE_CONFIG: Record<ConfidenceLabel, { label: string; classes: string; icon?: string }> = {
  HIGH:   { label: "High confidence",   classes: "bg-[#052E16] border-[#14532D] text-[#86EFAC]" },
  MEDIUM: { label: "Medium confidence", classes: "bg-[#1C0F00] border-[#431407] text-[#FCD34D]" },
  LOW:    { label: "Lawyer review required", classes: "bg-[#1F0A0A] border-[#450A0A] text-[#FCA5A5]" },
};

function ClauseCard({
  result,
  expanded,
  onToggle,
  onFeedback,
}: {
  result: ReviewResult;
  expanded: boolean;
  onToggle: () => void;
  onFeedback: (action: FeedbackAction, finalClauseText?: string) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState<FeedbackAction | null>(null);
  const [generatedReply, setGeneratedReply] = useState<string | null>(null);
  const [copiedReply, setCopiedReply] = useState(false);
  const [showWhatAgreed, setShowWhatAgreed] = useState(false);
  const [agreedText, setAgreedText] = useState("");

  // Teach Zane state
  const [showTeachMike, setShowTeachMike] = useState(false);
  const [incorrectOutput, setIncorrectOutput] = useState("");
  const [correctOutput, setCorrectOutput] = useState("");
  const [teachSubmitting, setTeachSubmitting] = useState(false);
  const [teachDone, setTeachDone] = useState(false);

  // False positive state
  const [fpSubmitting, setFpSubmitting] = useState(false);
  const [fpDone, setFpDone] = useState(
    result.feedback?.feedbackType === "FALSE_POSITIVE"
  );

  const feedback = result.feedback;
  const label = CLAUSE_LABELS[result.clauseCategory] ?? result.clauseCategory;

  const replyMutation = useMutation({
    mutationFn: () => generateReply(result.id, "professional"),
    onSuccess: (data) => setGeneratedReply(data.reply),
  });

  function copyReply() {
    if (!generatedReply) return;
    void navigator.clipboard.writeText(generatedReply).then(() => {
      setCopiedReply(true);
      setTimeout(() => setCopiedReply(false), 2000);
    });
  }

  async function handle(action: FeedbackAction, finalClauseText?: string) {
    setSubmitting(action);
    try { await onFeedback(action, finalClauseText); } finally { setSubmitting(null); }
  }

  async function handleTeachMike() {
    if (!incorrectOutput.trim() || !correctOutput.trim()) return;
    setTeachSubmitting(true);
    try {
      await teachMike(result.id, { incorrectOutput, correctOutput });
      setTeachDone(true);
      setShowTeachMike(false);
    } finally {
      setTeachSubmitting(false);
    }
  }

  async function handleFalsePositive() {
    setFpSubmitting(true);
    try {
      await markFalsePositive(result.id);
      setFpDone(true);
    } finally {
      setFpSubmitting(false);
    }
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
              <span className="text-[11px] bg-[#0F172A] text-[#94A3B8] border border-[#334155] rounded px-1.5 py-0.5">
                Clause absent
              </span>
            )}
            {result.escalationRequired && (
              <span className="text-[11px] bg-[#1F0A0A] text-[#FCA5A5] border border-[#450A0A] rounded px-1.5 py-0.5 flex items-center gap-1">
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

          {/* ── Decision summary — FIRST ──────────────────────────────────── */}
          <div className="rounded-xl border border-[#1E293B] bg-[#0F172A] p-4 space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Decision summary</div>
            {result.isAbsent && (
              <div className="flex items-start gap-2 rounded-lg bg-[#0F172A] border border-[#334155] px-3 py-2">
                <Info size={12} className="text-[#94A3B8] shrink-0 mt-0.5" />
                <span className="text-xs text-[#94A3B8]">
                  This clause was not identified in the contract. Review whether your playbook requires it to be present.
                </span>
              </div>
            )}

            {/* Recommended action — prominent */}
            <div className="text-sm font-semibold text-foreground leading-snug">{result.recommendedAction}</div>

            {/* Business summary */}
            <div className="text-xs text-muted-foreground leading-relaxed">{result.businessSummary}</div>

            {/* Escalation inline */}
            {result.escalationRequired && result.escalationTrigger && (
              <div className="flex items-start gap-2 rounded-lg bg-[#1F0A0A] border border-[#450A0A] px-3 py-2 mt-1">
                <AlertTriangle size={12} className="shrink-0 mt-0.5 text-[#FCA5A5]" />
                <span className="text-xs text-[#FCA5A5]">{result.escalationTrigger}</span>
              </div>
            )}
          </div>

          {/* Confidence label */}
          {result.confidenceLabel && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border w-fit ${CONFIDENCE_CONFIG[result.confidenceLabel].classes}`}>
              <Scale size={11} />
              {CONFIDENCE_CONFIG[result.confidenceLabel].label}
              {result.confidenceLabel === "LOW" && (
                <span className="ml-1 font-semibold">Zane is uncertain. Have a lawyer verify this clause before relying on this analysis.</span>
              )}
            </div>
          )}

          {/* Playbook comparison — verification-first */}
          {result.comparisonStatement && (
            <Detail title="Playbook comparison">
              <div className="bg-[#0F172A] border border-[#1E293B] rounded-lg px-4 py-3 text-sm leading-relaxed text-[#94A3B8] font-mono">
                {result.comparisonStatement}
              </div>
            </Detail>
          )}

          <Detail title="What this clause says">
            <p className="text-sm leading-relaxed">{result.clauseSummary}</p>
          </Detail>

          <Detail title="Why it matters">
            <p className="text-sm leading-relaxed">{result.whyItMatters}</p>
          </Detail>

          {/* Regulatory citations */}
          {result.regulatoryCitations && result.regulatoryCitations.length > 0 && (
            <Detail title="Regulatory references">
              <div className="space-y-2">
                {result.regulatoryCitations.map((c: RegulatoryCitation, i: number) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-lg bg-[#1E1B4B] border border-[#312E81] px-3 py-2">
                    <BookOpen size={11} className="text-[#A5B4FC] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#A5B4FC]">{c.regulation} — {c.article}</div>
                      <div className="text-[11px] text-[#A5B4FC] opacity-80 mt-0.5">{c.relevance}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Detail>
          )}

          {/* Suggested fallback with Copy button */}
          {result.suggestedFallback && (
            <Detail title="Suggested fallback language">
              <div className="space-y-2">
                <div className="clause-block text-sm leading-relaxed">
                  {result.suggestedFallback}
                </div>
                <FallbackCopyButton text={result.suggestedFallback} />
              </div>
            </Detail>
          )}

          {/* Generate reply (for RED/AMBER clauses) */}
          {(result.ragStatus === "RED" || result.ragStatus === "AMBER") && (
            <div>
              {!generatedReply ? (
                <button
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                  onClick={() => replyMutation.mutate()}
                  disabled={replyMutation.isPending}
                >
                  {replyMutation.isPending ? (
                    <><Loader2 size={11} className="animate-spin" /> Drafting response…</>
                  ) : (
                    <><Mail size={11} /> Draft negotiation response</>
                  )}
                </button>
              ) : (
                <Detail title="Negotiation reply">
                  <div className="space-y-2">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap bg-card border border-card-border rounded-lg px-4 py-3">
                      {generatedReply}
                    </p>
                    <div className="flex gap-2">
                      <button
                        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                        onClick={copyReply}
                      >
                        <Copy size={11} />
                        {copiedReply ? "Copied!" : "Copy text"}
                      </button>
                      <button
                        className="btn-ghost text-xs px-3 py-1.5 text-muted-foreground"
                        onClick={() => setGeneratedReply(null)}
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>
                </Detail>
              )}
            </div>
          )}

          {/* Feedback */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-card-border">
            <span className="text-xs text-muted-foreground">Record outcome:</span>
            {([
              { action: "ACCEPTED",  label: "Accept result",      icon: <CheckCircle size={12} /> },
              { action: "ESCALATED", label: "Escalate internally", icon: <AlertTriangle size={12} /> },
              { action: "DISMISSED", label: "Dismiss",             icon: <Clock size={12} /> },
            ] as { action: FeedbackAction; label: string; icon: React.ReactNode }[]).map(({ action, label, icon }) => (
              <button
                key={action}
                disabled={!!submitting}
                onClick={() => {
                  if (action === "ACCEPTED") { setShowWhatAgreed(true); return; }
                  void handle(action);
                }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors disabled:opacity-50 ${
                  feedback?.userAction === action
                    ? "bg-[#2563EB] text-white border-[#2563EB]"
                    : "border-border hover:border-[#475569]"
                }`}
              >
                {submitting === action ? "…" : <>{icon} {label}</>}
              </button>
            ))}
          </div>

          {/* Outcome capture modal — dedicated screen overlay */}
          {showWhatAgreed && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
              <div className="w-full max-w-md rounded-2xl border border-[#14532D] bg-[#030f08] shadow-2xl p-6 space-y-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-[#86EFAC]" />
                    <span className="text-sm font-semibold text-[#86EFAC]">Capture signed outcome</span>
                  </div>
                  <div className="text-xs text-[#86EFAC]/60 leading-relaxed">
                    Record the final agreed wording for <span className="font-medium">{label}</span>. This trains Zane on your actual negotiation outcomes.
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-[#86EFAC]/50">Final agreed clause text (optional)</label>
                  <textarea
                    className="w-full rounded-xl border border-[#14532D] bg-[#052E16] px-3.5 py-2.5 text-sm text-[#86EFAC] placeholder:text-[#86EFAC]/25 focus:outline-none focus:border-[#166534] min-h-[96px] resize-y font-mono"
                    placeholder="Paste the final clause text as executed…"
                    value={agreedText}
                    onChange={(e) => setAgreedText(e.target.value)}
                    autoFocus
                  />
                  <p className="text-[10px] text-[#86EFAC]/40 leading-relaxed">
                    Optional. Leave blank to record acceptance without clause text. Zane uses this to improve future recommendations for this clause type.
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    className="w-full px-4 py-2.5 bg-[#14532D] hover:bg-[#166534] text-[#86EFAC] text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                    onClick={() => { void handle("ACCEPTED", agreedText || undefined); setShowWhatAgreed(false); }}
                  >
                    <CheckCircle size={14} /> Save & mark accepted
                  </button>
                  <button
                    className="w-full px-4 py-2 text-xs text-[#86EFAC]/50 hover:text-[#86EFAC]/80 transition-colors"
                    onClick={() => { void handle("ACCEPTED"); setShowWhatAgreed(false); setAgreedText(""); }}
                  >
                    Accept without recording clause text
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Improve this analysis: Teach Zane + False Positive ── */}
          <div className="pt-2 border-t border-card-border space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Improve this analysis:</span>

              <button
                onClick={() => setShowTeachMike(!showTeachMike)}
                disabled={teachDone}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
                  teachDone
                    ? "bg-[#052E16] border-[#14532D] text-[#86EFAC]"
                    : "border-border hover:border-[#475569]"
                }`}
              >
                <GraduationCap size={11} />
                {teachDone ? "Saved. Zane will apply this in future reviews." : "Mark as incorrect"}
              </button>

              {!result.isAbsent && (
                <button
                  onClick={() => void handleFalsePositive()}
                  disabled={fpSubmitting || fpDone}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors disabled:opacity-50 ${
                    fpDone
                      ? "bg-[#1F0A0A] border-[#450A0A] text-[#FCA5A5]"
                      : "border-border hover:border-[#475569]"
                  }`}
                >
                  <XCircle size={11} />
                  {fpDone ? "Marked false positive" : fpSubmitting ? "…" : "False positive"}
                </button>
              )}
            </div>

            {showTeachMike && (
              <div className="rounded-lg border border-[#172B4D] bg-[#0B1020] p-4 space-y-3">
                <div className="text-xs font-semibold text-[#60A5FA]">
                  Correct this analysis
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">What Zane said (incorrect part)</label>
                  <textarea
                    className="input text-xs min-h-[56px] resize-none w-full"
                    placeholder="Paste or describe the part of Zane's analysis that was wrong…"
                    value={incorrectOutput}
                    onChange={(e) => setIncorrectOutput(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">What the correct analysis should say</label>
                  <textarea
                    className="input text-xs min-h-[56px] resize-none w-full"
                    placeholder="Describe the correct legal position or what Zane should have flagged…"
                    value={correctOutput}
                    onChange={(e) => setCorrectOutput(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                    onClick={() => void handleTeachMike()}
                    disabled={teachSubmitting || !incorrectOutput.trim() || !correctOutput.trim()}
                  >
                    {teachSubmitting ? <Loader2 size={11} className="animate-spin" /> : <GraduationCap size={11} />}
                    Save correction
                  </button>
                  <button
                    className="btn-ghost text-xs px-3 py-1.5"
                    onClick={() => setShowTeachMike(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

function exportReviewAsText(doc: UploadedDocument) {
  const results = doc.reviewResults ?? [];
  const counts = {
    RED:   results.filter((r) => r.ragStatus === "RED").length,
    AMBER: results.filter((r) => r.ragStatus === "AMBER").length,
    GREEN: results.filter((r) => r.ragStatus === "GREEN").length,
    GREY:  results.filter((r) => r.ragStatus === "GREY").length,
  };
  const overallRag = counts.RED > 0 ? "RED" : counts.AMBER > 0 ? "AMBER" : "GREEN";
  const date = new Date(doc.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const lines: string[] = [
    "ZANE REVIEW SUMMARY",
    "===================",
    "",
    `Contract:    ${doc.originalName}`,
    `Type:        ${doc.contractType.replace(/_/g, " ")}`,
    `Reviewed:    ${date}`,
    `Overall RAG: ${overallRag}`,
    `Clauses:     ${results.length} reviewed  |  ${counts.RED} Red  |  ${counts.AMBER} Amber  |  ${counts.GREEN} Green  |  ${counts.GREY} Missing`,
    "",
  ];

  const escalations = results.filter((r) => r.escalationRequired);
  if (escalations.length > 0) {
    lines.push("ESCALATIONS REQUIRED", "--------------------");
    for (const r of escalations) {
      lines.push(`- ${CLAUSE_LABELS[r.clauseCategory] ?? r.clauseCategory}: ${r.escalationTrigger ?? "Sign-off needed"}`);
    }
    lines.push("");
  }

  const order: RagStatus[] = ["RED", "AMBER", "GREEN", "GREY"];
  for (const status of order) {
    const group = results.filter((r) => r.ragStatus === status);
    if (group.length === 0) continue;
    lines.push(`${status} CLAUSES (${group.length})`, "-".repeat(40));
    for (const r of group) {
      const label = CLAUSE_LABELS[r.clauseCategory] ?? r.clauseCategory;
      lines.push(
        "",
        `[${status}] ${label}${r.isAbsent ? " (NOT FOUND IN CONTRACT)" : ""}`,
        "",
        "What it says:",
        r.clauseSummary,
        "",
        "Why it matters:",
        r.whyItMatters,
        "",
        "Recommended action:",
        r.recommendedAction,
      );
      if (r.suggestedFallback) {
        lines.push("", "Suggested fallback:", r.suggestedFallback);
      }
      if (r.escalationRequired && r.escalationTrigger) {
        lines.push("", "Escalation trigger:", r.escalationTrigger);
      }
      lines.push("", "Plain English summary:", r.businessSummary, "", "-".repeat(40));
    }
    lines.push("");
  }

  lines.push("", "Generated by Zane", "https://usezane.ai");

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `Zane-Review-${doc.originalName.replace(/\.[^.]+$/, "")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Three-tier Escalation Summary ───────────────────────────────────────────

const APPROVER_ORDER = ["Handler", "Legal", "GC", "CFO", "CEO", "Board"] as const;

function getValueTier(value: number): { label: string; approvers: string[] } | null {
  if (value < 10_000)   return null;
  if (value < 50_000)   return { label: "Legal sign-off required",  approvers: ["Legal"] };
  if (value < 250_000)  return { label: "GC sign-off required",     approvers: ["GC"] };
  if (value < 1_000_000) return { label: "CFO sign-off required",   approvers: ["CFO"] };
  return                        { label: "Board approval required",  approvers: ["Board"] };
}

function getGovernanceTriggers(
  counterpartyType?: string,
  contractType?: string,
): Array<{ label: string; approvers: string[] }> {
  const triggers: Array<{ label: string; approvers: string[] }> = [];

  switch (counterpartyType) {
    case "RELATED_PARTY":
      triggers.push({ label: "Related party / connected party: Board sign-off required", approvers: ["Board"] });
      break;
    case "REGULATOR":
      triggers.push({ label: "Regulator / government body: GC sign-off required", approvers: ["GC"] });
      break;
    case "INVESTOR":
      triggers.push({ label: "Investor / shareholder: GC and CFO required", approvers: ["GC", "CFO"] });
      break;
    case "COMPETITOR":
      triggers.push({ label: "Competitor: GC and CEO required", approvers: ["GC", "CEO"] });
      break;
  }

  if (contractType === "JV_AGREEMENT") {
    triggers.push({ label: "Joint venture: Board sign-off required", approvers: ["Board"] });
  }
  if (contractType && (contractType.includes("EXCLUSIV") || contractType === "EXCLUSIVITY")) {
    triggers.push({ label: "Exclusivity agreement: CEO minimum required", approvers: ["CEO"] });
  }

  return triggers;
}

function EscalationSummary({
  doc,
  results,
}: {
  doc: UploadedDocument;
  results: ReviewResult[];
}) {
  const [showExplainer, setShowExplainer] = useState(false);

  // Tier 1 — clause risk
  const tier1Clauses = results.filter((r) => r.escalationRequired);

  // Tier 2 — contract value
  const valueTier = doc.contractValue != null ? getValueTier(doc.contractValue) : null;

  // Tier 3 — governance
  const govTriggers = getGovernanceTriggers(doc.counterpartyType, doc.contractType);

  const tiersActive = [
    tier1Clauses.length > 0,
    valueTier !== null,
    govTriggers.length > 0,
  ].filter(Boolean).length;

  if (tiersActive === 0) return null;

  // Build recommended sign-off sequence
  const requiredApprovers = new Set<string>();
  if (tier1Clauses.length > 0) requiredApprovers.add("Legal");
  if (valueTier) valueTier.approvers.forEach((a) => requiredApprovers.add(a));
  govTriggers.forEach((t) => t.approvers.forEach((a) => requiredApprovers.add(a)));

  const signOffSequence = APPROVER_ORDER.filter((a) => requiredApprovers.has(a));

  return (
    <div className="card overflow-hidden border border-[#450A0A]">
      {/* Header */}
      <div className="bg-[#1F0A0A] px-5 py-3 flex items-center gap-3 border-b border-[#450A0A]">
        <AlertTriangle size={16} className="text-[#FCA5A5] shrink-0" />
        <span className="text-sm font-semibold text-[#FCA5A5] flex-1">
          Escalation required: {tiersActive} tier{tiersActive !== 1 ? "s" : ""} triggered
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Tier 1 — Clause Risk */}
        {tier1Clauses.length > 0 && (
          <div className="rounded-lg bg-[#1F0A0A] border border-[#450A0A] p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#FCA5A5]">
              Tier 1: Clause Risk
            </div>
            <ul className="space-y-1.5">
              {tier1Clauses.map((r) => (
                <li key={r.id} className="flex gap-2 text-sm text-[#FCA5A5]">
                  <span className="shrink-0 mt-0.5">•</span>
                  <span>
                    <span className="font-semibold">{CLAUSE_LABELS[r.clauseCategory] ?? r.clauseCategory}</span>
                    {r.escalationTrigger && (
                      <span className="opacity-80">: {r.escalationTrigger}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tier 2 — Contract Value */}
        {valueTier && (
          <div className="rounded-lg bg-[#1C0F00] border border-[#431407] p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#FCD34D]">
              Tier 2: Contract Value
            </div>
            <div className="text-sm text-[#FCD34D]">
              <span className="font-semibold">
                {doc.currency ?? "£"}{doc.contractValue!.toLocaleString("en-GB")}
              </span>{" "}
              : {valueTier.label}
            </div>
          </div>
        )}

        {/* Tier 3 — Governance */}
        {govTriggers.length > 0 && (
          <div className="rounded-lg bg-[#1E1B4B] border border-[#312E81] p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#A5B4FC]">
              Tier 3: Governance
            </div>
            <ul className="space-y-1.5">
              {govTriggers.map((t, i) => (
                <li key={i} className="flex gap-2 text-sm text-[#A5B4FC]">
                  <span className="shrink-0 mt-0.5">•</span>
                  <span>{t.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommended sign-off sequence */}
        {signOffSequence.length > 0 && (
          <div className="pt-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Recommended sign-off sequence
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {signOffSequence.map((approver, i) => (
                <span key={approver} className="flex items-center gap-1.5">
                  <span className="inline-flex items-center bg-[#2563EB] text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                    {approver}
                  </span>
                  {i < signOffSequence.length - 1 && (
                    <span className="text-muted-foreground text-xs">→</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* What is this? explainer */}
        <div className="pt-1 border-t border-border">
          <button
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowExplainer((v) => !v)}
          >
            {showExplainer ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            What is this?
          </button>
          {showExplainer && (
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Zane uses three escalation tiers. <strong>Tier 1</strong> fires when individual clauses
              contain terms that exceed your playbook thresholds and require sign-off.{" "}
              <strong>Tier 2</strong> fires when the total contract value crosses an authority threshold
              set by your organisation. <strong>Tier 3</strong> fires based on the nature of the
              counterparty or contract type. Certain relationships (regulators, investors, related
              parties) and structures (JVs, exclusivity) always require elevated sign-off regardless
              of clause content or value.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function FallbackCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:border-[#475569] transition-colors"
    >
      <Copy size={11} />
      {copied ? "Copied!" : "Copy fallback language"}
    </button>
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
