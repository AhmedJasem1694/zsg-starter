import { useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft, AlertTriangle, Clock, CheckCircle, Download, ChevronDown, ChevronUp,
  Mail, Copy, Loader2, GraduationCap, XCircle, BookOpen, Scale, Zap, Info,
  TrendingDown, Layers, CalendarClock, FileCheck, Users, BarChart2, ChevronRight,
  MessageSquare, Shield, Edit2, Flag, Upload, Brain, Dot,
} from "lucide-react";
import { getReview, saveFeedback, generateReply, teachZane, markFalsePositive, captureOutcome, uploadFinalVersion, getOutcomeDeltas, overrideRagStatus, markFalsePositiveSignal, getSignalsSummary, getCompany } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import type { ReviewResult, RagStatus, FeedbackAction, UploadedDocument, ConfidenceLabel, RegulatoryCitation } from "../lib/types";
import { CLAUSE_LABELS } from "../lib/types";
import { MOCK_REVIEW_DETAIL } from "../lib/mockData";
import React from "react";
import { formatContractDate, formatDateShort } from "../lib/dateUtils";

// ─── Data sanitisation ────────────────────────────────────────────────────────
// Defensive normalisation applied to every ReviewResult before rendering.
// Guards against null/undefined fields that would crash component renders.

function sanitiseResult(r: ReviewResult): ReviewResult {
  return {
    ...r,
    ragStatus:            (r.ragStatus as string) in { RED:1, AMBER:1, GREEN:1, GREY:1 }
                            ? r.ragStatus : "GREY",
    clauseSummary:        r.clauseSummary        ?? "",
    whyItMatters:         r.whyItMatters         ?? "",
    recommendedAction:    r.recommendedAction     ?? "",
    suggestedFallback:    r.suggestedFallback     ?? "",
    businessSummary:      r.businessSummary       ?? "",
    escalationRequired:   r.escalationRequired    ?? false,
    isAbsent:             r.isAbsent              ?? false,
    regulatoryCitations:  Array.isArray(r.regulatoryCitations)
                            ? r.regulatoryCitations
                            : [],
  };
}

// ─── Per-clause error boundary ────────────────────────────────────────────────
// Wraps each ClauseCard so a single bad result cannot crash the entire page.

class ClauseErrorBoundary extends React.Component<
  { children: React.ReactNode; label?: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; label?: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error("[ClauseErrorBoundary] Clause render error:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-[#450A0A] bg-[#1F0A0A] px-4 py-3 text-xs text-[#FCA5A5]/70">
          Could not render clause{this.props.label ? ` "${this.props.label}"` : ""}. This clause may have unexpected data. Other clauses are unaffected.
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Format lastError for display ────────────────────────────────────────────

function formatLastError(raw: string): string {
  if (raw.includes("timed out") || raw.includes("timeout")) {
    return "This document took too long to process. Try again or split it into smaller sections.";
  }
  if (raw.includes("Could not extract text") || raw.includes("mammoth") || raw.includes("docx")) {
    return "Zane could not read this Word document. Try saving it as a PDF and uploading again.";
  }
  if (raw.includes("pdf-parse") || raw.includes("scanned") || raw.includes("no text")) {
    return "This looks like a scanned document. Please try a text-based PDF or Word document.";
  }
  if (raw.includes("LLM returned invalid JSON") || raw.includes("OpenRouter")) {
    return "Zane could not complete the analysis. Please retry. This is usually a temporary issue.";
  }
  if (raw.includes("not found on disk") || raw.includes("uploads directory")) {
    return "The uploaded file could not be found. Please upload the document again.";
  }
  return "Review failed. Please retry or contact support@zanelegal.ai if this persists.";
}

// ─── RAG styling ─────────────────────────────────────────────────────────────

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

const RAG_BORDER_LEFT: Record<RagStatus, string> = {
  RED:   "border-l-[#F87171]",
  AMBER: "border-l-[#FBBF24]",
  GREEN: "border-l-[#4ADE80]",
  GREY:  "border-l-[#475569]",
};

// ─── Confidence badge config ──────────────────────────────────────────────────

const CONFIDENCE_CONFIG: Record<ConfidenceLabel, { label: string; classes: string }> = {
  HIGH:   { label: "High confidence",          classes: "bg-[#052E16] border-[#14532D] text-[#86EFAC]" },
  MEDIUM: { label: "Medium confidence",        classes: "bg-[#1C0F00] border-[#431407] text-[#FCD34D]" },
  LOW:    { label: "Lawyer review required",   classes: "bg-[#1F0A0A] border-[#450A0A] text-[#FCA5A5]" },
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<RagStatus | "ALL" | "GREY_CRITICAL" | "GREY_OPTIONAL">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Demo mode - mock-1 served from local data, no API call needed
  const isMock = id === "mock-1";

  const ACTIVE_STATUSES = ["PROCESSING", "PARSING", "ANONYMISING", "CLASSIFYING", "COMPARING"];

  const { data: realDoc, isLoading } = useQuery({
    queryKey: ["review", id],
    queryFn: () => getReview(id!),
    enabled: !isMock,
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d?.status) return false;
      // Poll faster during clause comparison so results stream in quickly.
      if (d.status === "COMPARING") return 2000;
      if (ACTIVE_STATUSES.includes(d.status)) return 3000;
      return false;
    },
  });

  const doc: UploadedDocument | undefined = isMock ? MOCK_REVIEW_DETAIL : realDoc;
  const loading = isMock ? false : isLoading;

  // ── ALL hooks must be declared here, before any early returns ─────────────
  // (React requires hooks to be called the same number of times on every render)

  const finalFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFinal, setUploadingFinal] = useState(false);

  const { data: companyData } = useQuery({
    queryKey: ["company"],
    queryFn:  getCompany,
    staleTime: 300_000,
  });

  const { data: outcomeDeltaData } = useQuery({
    queryKey: ["outcome-deltas-check", id],
    queryFn:  () => getOutcomeDeltas(id!),
    enabled:  !isMock && !!id && !!doc && doc.status === "COMPLETE",
    staleTime: 60_000,
  });

  const [outcomeDismissed,  setOutcomeDismissed]  = useState(false);
  const [outcomeCaptured,   setOutcomeCaptured]   = useState(false);
  const [outcomeNotes,      setOutcomeNotes]      = useState("");
  const [showOutcomeNotes,  setShowOutcomeNotes]  = useState(false);

  const outcomeMutation = useMutation({
    mutationFn: (outcome: "SIGNED" | "EXECUTED") =>
      captureOutcome(doc!.id, outcome, outcomeNotes),
    onSuccess: () => {
      setOutcomeCaptured(true);
      void queryClient.invalidateQueries({ queryKey: ["review", id] });
    },
  });

  // Sync outcomeCaptured with doc.outcome on first load
  const docOutcomeRef = useRef<string | undefined>(undefined);
  if (doc?.outcome && doc.outcome !== docOutcomeRef.current) {
    docOutcomeRef.current = doc.outcome;
    // Use a ref-based approach: setting state during render is intentionally
    // avoided; outcomeCaptured just defaults to false and updates via query invalidation.
  }

  async function handleFeedback(resultId: string, action: FeedbackAction, finalClauseText?: string) {
    if (isMock) return; // no-op in demo
    await saveFeedback(resultId, { userAction: action, finalClauseText });
    await queryClient.invalidateQueries({ queryKey: ["review", id] });
  }

  async function handleUploadFinalVersion(file: File) {
    if (!id || isMock) return;
    setUploadingFinal(true);
    try {
      const result = await uploadFinalVersion(id, file);
      navigate(`/app/legal/${id}/outcome`);
      void result;
    } catch (err) {
      console.error("Failed to upload final version:", err);
    } finally {
      setUploadingFinal(false);
    }
  }

  function handleGoBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate("/app/legal/dashboard");
    }
  }

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-6xl mx-auto">
          <BackButton onClick={() => navigate("/app/legal/dashboard")} />
          <div className="text-sm text-muted-foreground mt-8">Loading review…</div>
        </div>
      </AppLayout>
    );
  }

  if (!doc) {
    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-6xl mx-auto space-y-4">
          <BackButton onClick={() => navigate("/app/legal/dashboard")} />
          <div className="card p-8 text-center space-y-4">
            <AlertTriangle size={24} className="text-[#FCA5A5] mx-auto" />
            <div className="font-semibold text-[#FCA5A5]">Document not found</div>
            <div className="flex items-center justify-center gap-3">
              <button className="btn-secondary text-sm px-4 py-2" onClick={handleGoBack}>
                Go back
              </button>
              <button className="btn-primary text-sm px-4 py-2" onClick={() => navigate("/app/legal/dashboard")}>
                Back to dashboard
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Processing state ──────────────────────────────────────────────────────

  // Stage list driven by actual doc.status, more accurate than elapsed time.
  const PIPELINE_STAGES: Array<{ label: string; status: string; detail?: string }> = [
    { label: "Parsing document",              status: "PARSING"     },
    { label: "Anonymising sensitive data",    status: "ANONYMISING" },
    { label: "Identifying clause categories", status: "CLASSIFYING" },
    { label: "Comparing against playbook",    status: "COMPARING"   },
  ];
  const STATUS_TO_STAGE: Record<string, number> = {
    PROCESSING: 0, PARSING: 0, ANONYMISING: 1, CLASSIFYING: 2, COMPARING: 3,
  };

  const isActiveStatus = ACTIVE_STATUSES.includes(doc.status);
  const isComparing    = doc.status === "COMPARING";
  const partialResults = doc.reviewResults ?? [];
  const hasPartial     = partialResults.length > 0;

  // Stuck review detection: if processing for more than 10 minutes, show a warning
  const processingTooLong = isActiveStatus && doc.uploadedAt &&
    (Date.now() - new Date(doc.uploadedAt).getTime()) > 10 * 60 * 1000;

  if (processingTooLong) {
    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-6xl mx-auto space-y-4">
          <BackButton onClick={() => navigate("/app/legal/dashboard")} />
          <div className="card p-12 text-center space-y-4">
            <AlertTriangle size={28} className="text-[#FCA5A5] mx-auto" />
            <div className="space-y-2">
              <div className="font-semibold text-[#FCA5A5]">This review has been processing longer than expected</div>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Something may have gone wrong. You can retry the review or contact support if this keeps happening.
              </p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <button
                  className="btn-secondary text-sm px-4 py-2"
                  onClick={handleGoBack}
                >
                  Go back
                </button>
                <button
                  className="btn-primary text-sm px-4 py-2"
                  onClick={() => navigate("/app/legal/dashboard")}
                >
                  Back to dashboard
                </button>
              </div>
              <a href="mailto:support@zanelegal.ai" className="text-xs text-muted-foreground underline">
                Contact support
              </a>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Show full-page loading screen while pre-comparison stages run, or during
  // COMPARING before the first result arrives (so the page is never empty).
  if (isActiveStatus && !(isComparing && hasPartial)) {
    const stageIdx = STATUS_TO_STAGE[doc.status] ?? 0;
    const completedCount = isComparing ? 0 : undefined;
    const totalCount = isComparing ? (doc.clausesTotal ?? undefined) : undefined;

    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-6xl mx-auto space-y-4">
          <BackButton onClick={() => navigate("/app/legal/dashboard")} />
          <div className="card p-8 space-y-6 border-[#1C2A3A]" style={{ background: "#0D1B2A" }}>
            <div className="flex items-center gap-3">
              <Zap size={18} className="text-[#60A5FA]" />
              <div>
                <div className="font-semibold text-[#93C5FD]">Zane is reviewing this contract</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{doc.originalName}</div>
              </div>
            </div>
            <div className="space-y-3 max-w-sm">
              {PIPELINE_STAGES.map((stage, i) => {
                const done    = i < stageIdx;
                const active  = i === stageIdx;
                const pending = i > stageIdx;
                const label   = (active && isComparing && totalCount != null)
                  ? `Analysing clauses ${completedCount ?? 0} of ${totalCount}`
                  : stage.label;
                return (
                  <div key={stage.status} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-500
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
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-muted-foreground">Results appear as each clause is analysed. This page auto-refreshes.</div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (doc.status === "FAILED") {
    const lastError = (doc as UploadedDocument & { lastError?: string }).lastError;
    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-6xl mx-auto space-y-4">
          <BackButton onClick={() => navigate("/app/legal/dashboard")} />
          <div className="card border-[#450A0A] p-8 space-y-4" style={{ background: "#120404" }}>
            <AlertTriangle size={28} className="text-[#FCA5A5] mx-auto" />
            <div className="text-center space-y-2">
              <div className="font-semibold text-[#FCA5A5]">Review failed</div>
              <p className="text-sm text-[#FCA5A5]/80 max-w-sm mx-auto">
                {lastError ? formatLastError(lastError) : "Zane could not complete the analysis for this document."}
              </p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <button
                  className="btn-secondary text-sm px-4 py-2"
                  onClick={handleGoBack}
                >
                  Go back
                </button>
                <button
                  className="btn-primary text-sm px-4 py-2"
                  onClick={() => navigate("/app/legal/dashboard")}
                >
                  Back to dashboard
                </button>
              </div>
              <a href="mailto:support@zanelegal.ai" className="text-xs text-muted-foreground underline">
                Contact support@zanelegal.ai
              </a>
              <p className="text-xs text-muted-foreground">Include the document name: "{doc.originalName}"</p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Complete state ────────────────────────────────────────────────────────

  function handleExport() {
    if (doc) exportReviewAsText(doc);
  }

  const hasUnconfirmedOutcomes = outcomeDeltaData?.hasUnconfirmed ?? false;

  // Auto-detect "final signed" from filename
  const looksLikeSigned = !isMock && doc?.originalName
    ? /\b(signed|executed|final|countersigned|esigned|e-signed)\b/i.test(doc.originalName)
    : false;

  const results = (doc.reviewResults ?? []).map(sanitiseResult);
  const counts = {
    RED:           results.filter((r) => r.ragStatus === "RED").length,
    AMBER:         results.filter((r) => r.ragStatus === "AMBER").length,
    GREEN:         results.filter((r) => r.ragStatus === "GREEN").length,
    GREY:          results.filter((r) => r.ragStatus === "GREY").length,
    GREY_CRITICAL: results.filter((r) => r.ragStatus === "GREY" && r.missingSeverity === "CRITICAL").length,
    GREY_OPTIONAL: results.filter((r) => r.ragStatus === "GREY" && r.missingSeverity !== "CRITICAL").length,
  };
  const overallRag: RagStatus = counts.RED > 0 ? "RED" : counts.AMBER > 0 ? "AMBER" : "GREEN";
  const URGENCY_ORDER: Record<string, number> = { IMMEDIATE: 0, MATERIAL: 1, BACKGROUND: 2 };

  const filtered = (() => {
    const base =
      filter === "ALL"           ? results :
      filter === "GREY_CRITICAL" ? results.filter((r) => r.ragStatus === "GREY" && r.missingSeverity === "CRITICAL") :
      filter === "GREY_OPTIONAL" ? results.filter((r) => r.ragStatus === "GREY" && r.missingSeverity !== "CRITICAL") :
                                   results.filter((r) => r.ragStatus === filter);
    // Sort by urgency (IMMEDIATE first), then by RAG severity (RED > AMBER > GREY > GREEN)
    const RAG_ORDER: Record<string, number> = { RED: 0, AMBER: 1, GREY: 2, GREEN: 3 };
    return [...base].sort((a, b) => {
      const ua = URGENCY_ORDER[a.urgencyLevel ?? "BACKGROUND"] ?? 2;
      const ub = URGENCY_ORDER[b.urgencyLevel ?? "BACKGROUND"] ?? 2;
      if (ua !== ub) return ua - ub;
      return (RAG_ORDER[a.ragStatus] ?? 3) - (RAG_ORDER[b.ragStatus] ?? 3);
    });
  })();

  const renewalDaysUntil = doc.renewalDate
    ? Math.ceil((new Date(doc.renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <AppLayout>
      <div className="px-6 py-6 max-w-6xl mx-auto space-y-5">

        {/* Back */}
        <BackButton onClick={() => navigate("/app/legal/dashboard")} />

        {/* ── Live analysis progress banner (during COMPARING with partial results) */}
        {isComparing && hasPartial && (
          <div className="flex items-center gap-3 rounded-xl border border-[#1E3A5F] bg-[#0D1B2A] px-4 py-3">
            <Loader2 size={14} className="text-[#60A5FA] shrink-0 animate-spin" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-[#93C5FD]">
                {doc.clausesTotal != null
                  ? `Analysing clauses: ${partialResults.length} of ${doc.clausesTotal} complete`
                  : "Analysing clauses…"}
              </span>
              {doc.clausesTotal != null && (
                <div className="mt-1.5 h-1 bg-[#1E293B] rounded-full overflow-hidden w-48">
                  <div
                    className="h-full bg-[#3B82F6] rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, (partialResults.length / doc.clausesTotal) * 100)}%` }}
                  />
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">Results appear as they complete</span>
          </div>
        )}

        {/* ── Contract Intelligence Header ─────────────────────────────── */}
        <ContractHeader
          doc={doc}
          overallRag={overallRag}
          counts={counts}
          renewalDaysUntil={renewalDaysUntil}
          onExport={handleExport}
          isMock={isMock}
        />

        {/* ── Urgency strip (RED only) ─────────────────────────────────── */}
        {counts.RED > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-[#450A0A] bg-[#1A0404] px-4 py-3">
            <AlertTriangle size={14} className="text-[#FCA5A5] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-[#FCA5A5]">
                {counts.RED} clause{counts.RED !== 1 ? "s" : ""} require immediate attention before signing.
              </span>
              <span className="text-xs text-[#FCA5A5]/60 ml-2">
                {results.filter(r => r.ragStatus === "RED").map(r => CLAUSE_LABELS[r.clauseCategory] ?? r.clauseCategory).join(" · ")}
              </span>
            </div>
          </div>
        )}

        {/* ── Outcome capture banner ───────────────────────────────────── */}
        {!outcomeDismissed && !outcomeCaptured && (looksLikeSigned || doc?.outcome === undefined) && !isMock && (
          <div className="rounded-xl border border-[#14532D] bg-[#052E16] px-4 py-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileCheck size={14} className="text-[#86EFAC] shrink-0" />
                <span className="text-sm font-semibold text-[#86EFAC]">
                  {looksLikeSigned ? "Is this the final signed contract?" : "Mark this contract as signed"}
                </span>
              </div>
              <button onClick={() => setOutcomeDismissed(true)} className="text-[#86EFAC]/40 hover:text-[#86EFAC]/80 text-xs">✕</button>
            </div>
            {looksLikeSigned && (
              <p className="text-xs text-[#86EFAC]/70">
                The filename suggests this may be an executed version. Marking it helps Zane track what was actually negotiated.
              </p>
            )}
            {showOutcomeNotes && (
              <textarea
                className="w-full rounded-lg border border-[#14532D] bg-[#030f08] px-3 py-2 text-xs text-[#86EFAC] placeholder:text-[#86EFAC]/30 focus:outline-none min-h-[64px] resize-y"
                placeholder="Optional: note what was negotiated or changed from the draft…"
                value={outcomeNotes}
                onChange={(e) => setOutcomeNotes(e.target.value)}
              />
            )}
            <div className="flex flex-wrap gap-2">
              <button
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#14532D] text-[#86EFAC] hover:bg-[#166534] transition-colors disabled:opacity-60"
                disabled={outcomeMutation.isPending}
                onClick={() => outcomeMutation.mutate("SIGNED")}
              >
                <CheckCircle size={11} /> Mark as signed
              </button>
              <button
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#14532D] text-[#86EFAC] hover:bg-[#166534] transition-colors disabled:opacity-60"
                disabled={outcomeMutation.isPending}
                onClick={() => outcomeMutation.mutate("EXECUTED")}
              >
                <CheckCircle size={11} /> Mark as executed
              </button>
              <button
                className="text-xs px-2 py-1.5 text-[#86EFAC]/50 hover:text-[#86EFAC]/80"
                onClick={() => setShowOutcomeNotes((v) => !v)}
              >
                {showOutcomeNotes ? "Hide notes" : "Add note"}
              </button>
            </div>
          </div>
        )}
        {outcomeCaptured && !isMock && (
          <div className="flex items-center gap-2 rounded-xl border border-[#14532D] bg-[#052E16] px-4 py-2.5">
            <CheckCircle size={13} className="text-[#86EFAC] shrink-0" />
            <span className="text-xs text-[#86EFAC]">
              Marked as {doc?.outcome?.toLowerCase() ?? "signed"} - outcome captured for negotiation intelligence.
            </span>
          </div>
        )}

        {/* ── Unconfirmed outcomes banner ────────────────────────────────── */}
        {hasUnconfirmedOutcomes && !isMock && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#1D4ED8] bg-[#0E1E3A] px-4 py-3">
            <div className="flex items-center gap-2">
              <Brain size={13} className="text-[#60A5FA] shrink-0" />
              <span className="text-xs font-semibold text-[#93C5FD]">
                Final version uploaded - confirm outcomes to update Zane's learning
              </span>
            </div>
            <Link
              to={`/app/legal/${id}/outcome`}
              className="text-xs text-[#60A5FA] hover:text-[#93C5FD] whitespace-nowrap font-medium"
            >
              Confirm now →
            </Link>
          </div>
        )}

        {/* ── Upload final version banner (not yet uploaded) ────────────── */}
        {!hasUnconfirmedOutcomes && !isMock && !outcomeDeltaData?.allConfirmed && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#1E293B] bg-[#0B1118] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Upload size={12} className="text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">
                Have the final signed version? Upload it so Zane can learn from the negotiation.
              </span>
            </div>
            <div>
              <input
                ref={finalFileInputRef}
                type="file"
                accept=".pdf,.docx,.doc"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUploadFinalVersion(file);
                }}
              />
              <button
                className="text-xs text-[#60A5FA] hover:text-[#93C5FD] font-medium disabled:opacity-60 flex items-center gap-1"
                disabled={uploadingFinal}
                onClick={() => finalFileInputRef.current?.click()}
              >
                {uploadingFinal ? <Loader2 size={10} className="animate-spin" /> : null}
                Upload signed version
              </button>
            </div>
          </div>
        )}

        {/* ── Two-column layout ────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-[1fr_300px] gap-5 items-start">

          {/* Left - main content */}
          <div className="space-y-4 min-w-0">

            {/* Escalation summary */}
            <EscalationSummary doc={doc} results={results} />

            {/* Contradiction findings */}
            {doc.contradictions && doc.contradictions.length > 0 && (
              <div className="rounded-xl border border-[#431407] bg-[#1C0F00] px-4 py-3 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-[#FCD34D] shrink-0" />
                  <span className="text-xs font-semibold text-[#FCD34D]">
                    {doc.contradictions.length} internal contradiction{doc.contradictions.length !== 1 ? "s" : ""} detected
                  </span>
                </div>
                <div className="space-y-2">
                  {doc.contradictions.map((c, i) => {
                    const finding = c as import("../lib/types").ContradictionFinding;
                    const sev = finding.severity ?? "LOW";
                    const severityColor = sev === "HIGH"
                      ? "text-[#FCA5A5] bg-[#1F0A0A] border-[#450A0A]"
                      : sev === "MEDIUM"
                      ? "text-[#FCD34D] bg-[#1C0F00] border-[#431407]"
                      : "text-[#94A3B8] bg-[#0F172A] border-[#334155]";
                    return (
                      <div key={i} className={`rounded-lg border px-3 py-2 space-y-1 ${severityColor}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${severityColor}`}>
                            {sev}
                          </span>
                          <span className="text-xs font-semibold">{finding.title ?? "Contradiction"}</span>
                        </div>
                        {finding.explanation && <p className="text-xs opacity-80">{finding.explanation}</p>}
                        {finding.recommendation && <p className="text-xs font-medium opacity-90 pt-0.5">→ {finding.recommendation}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Document audit findings (passes 2-5) */}
            {doc.auditFindings && doc.auditFindings.totalFindings > 0 && (
              <DocumentAuditPanel audit={doc.auditFindings} />
            )}

            {/* Filter pills */}
            <div className="flex flex-wrap gap-2">
              {/* All */}
              <button
                onClick={() => setFilter("ALL")}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filter === "ALL"
                    ? "bg-[#1E3A5F] text-[#93C5FD] border-[#2563EB]"
                    : "border-border text-muted-foreground hover:border-[#475569] hover:text-foreground"
                }`}
              >
                All ({results.length})
              </button>

              {/* RED / AMBER / GREEN */}
              {(["RED", "AMBER", "GREEN"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    filter === f
                      ? "bg-[#1E3A5F] text-[#93C5FD] border-[#2563EB]"
                      : "border-border text-muted-foreground hover:border-[#475569] hover:text-foreground"
                  }`}
                >
                  {RAG_LABEL[f]} ({counts[f]})
                </button>
              ))}

              {/* Missing: Critical (red badge style) */}
              <button
                onClick={() => setFilter("GREY_CRITICAL")}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filter === "GREY_CRITICAL"
                    ? "bg-[#1E3A5F] text-[#93C5FD] border-[#2563EB]"
                    : "border-border text-muted-foreground hover:border-[#475569] hover:text-foreground"
                }`}
              >
                Missing: Critical{" "}
                <span className="inline-flex items-center justify-center ml-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1F0A0A] border border-[#450A0A] text-[#FCA5A5]">
                  {counts.GREY_CRITICAL}
                </span>
              </button>

              {/* Missing: Optional (slate badge style) */}
              <button
                onClick={() => setFilter("GREY_OPTIONAL")}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filter === "GREY_OPTIONAL"
                    ? "bg-[#1E3A5F] text-[#93C5FD] border-[#2563EB]"
                    : "border-border text-muted-foreground hover:border-[#475569] hover:text-foreground"
                }`}
              >
                Missing: Optional{" "}
                <span className="inline-flex items-center justify-center ml-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0F172A] border border-[#334155] text-[#94A3B8]">
                  {counts.GREY_OPTIONAL}
                </span>
              </button>

              {/* Immediate urgency filter */}
              {results.some(r => r.urgencyLevel === "IMMEDIATE") && (
                <button
                  onClick={() => setFilter("ALL")}
                  className="px-3 py-1 rounded-full text-xs font-medium border border-[#450A0A] bg-[#1F0A0A] text-[#FCA5A5] hover:bg-[#2A0808]"
                >
                  ⚡ {results.filter(r => r.urgencyLevel === "IMMEDIATE").length} Immediate
                </button>
              )}
            </div>

            {/* Clause cards */}
            <div className="space-y-2 card-enter-stagger">
              {results.length === 0 && doc.status === "COMPLETE" ? (
                <div className="card p-8 text-center space-y-2">
                  <AlertTriangle size={24} className="text-[#FCA5A5] mx-auto" />
                  <div className="font-semibold text-[#FCA5A5]">No clauses were analysed</div>
                  <p className="text-sm text-muted-foreground">
                    Zane could not find any relevant clauses in this document. Try uploading a clearer version or a different format.
                  </p>
                </div>
              ) : (
                <>
                  {filtered.map((result, i) => (
                    <ClauseErrorBoundary key={result.id} label={CLAUSE_LABELS[result.clauseCategory] ?? result.clauseCategory}>
                      <ClauseCard
                        result={result}
                        index={i}
                        expanded={expandedId === result.id}
                        onToggle={() => setExpandedId(expandedId === result.id ? null : result.id)}
                        onFeedback={(action, finalClauseText) => handleFeedback(result.id, action, finalClauseText)}
                        isMock={isMock}
                      />
                    </ClauseErrorBoundary>
                  ))}
                  {filtered.length === 0 && (
                    <div className="text-sm text-muted-foreground py-10 text-center">
                      No clauses in this category.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right - sticky sidebar */}
          <div className="space-y-4 lg:sticky lg:top-4 slide-in-left">
            <SignOffTracker doc={doc} results={results} />
            <IntelligenceSignals doc={doc} results={results} isMock={isMock} companyName={companyData?.name} />
            <RiskDistribution counts={counts} total={results.length} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Contract Intelligence Header ─────────────────────────────────────────────

function ContractHeader({
  doc,
  overallRag,
  counts,
  renewalDaysUntil,
  onExport,
  isMock,
}: {
  doc: UploadedDocument;
  overallRag: RagStatus;
  counts: ExtendedCounts;
  renewalDaysUntil: number | null;
  onExport: () => void;
  isMock: boolean;
}) {
  const RISK_CONFIG = {
    RED:   { label: "High Risk",      bg: "bg-[#1F0A0A] border-[#450A0A]", text: "text-[#FCA5A5]" },
    AMBER: { label: "Moderate Risk",  bg: "bg-[#1C0F00] border-[#431407]", text: "text-[#FCD34D]" },
    GREEN: { label: "Low Risk",       bg: "bg-[#052E16] border-[#14532D]", text: "text-[#86EFAC]" },
    GREY:  { label: "Pending",        bg: "bg-muted border-border",         text: "text-muted-foreground" },
  };
  const riskCfg = RISK_CONFIG[overallRag];

  const READINESS_CONFIG = {
    "not-ready": { label: "Do not sign yet",   color: "text-[#FCA5A5]", bg: "bg-[#1F0A0A] border-[#450A0A]" },
    "negotiate":  { label: "Negotiate first",   color: "text-[#FCD34D]", bg: "bg-[#1C0F00] border-[#431407]" },
    "review":     { label: "Review needed",     color: "text-[#FCD34D]", bg: "bg-[#1C0F00] border-[#431407]" },
    "ready":      { label: "Ready to sign",     color: "text-[#86EFAC]", bg: "bg-[#052E16] border-[#14532D]" },
  };
  const readiness: "not-ready" | "negotiate" | "review" | "ready" =
    counts.RED >= 2 ? "not-ready" :
    counts.RED === 1 ? "negotiate" :
    counts.AMBER >= 2 ? "review" : "ready";
  const readinessCfg = READINESS_CONFIG[readiness];

  const date = formatDateShort(doc.uploadedAt);

  return (
    <div className="rounded-xl border border-[#1E293B] bg-[#0B1521] px-6 py-5 space-y-4">
      {/* Top row: name + risk badge + actions */}
      <div className="flex items-start gap-4 justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold truncate">{doc.originalName}</h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-sm text-muted-foreground">
            {doc.counterpartyName && (
              <span className="font-medium text-foreground/80">{doc.counterpartyName}</span>
            )}
            {doc.counterpartyName && <span className="text-muted-foreground/40">·</span>}
            <span>{(doc.contractType ?? "").replace(/_/g, " ")}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>Reviewed {date}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${riskCfg.bg} ${riskCfg.text}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${RAG_DOT[overallRag]}`} />
            {riskCfg.label}
          </div>
          <button
            onClick={onExport}
            className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5"
            title={isMock ? "Demo - export disabled" : undefined}
          >
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {/* Bottom row: contract metadata pills */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {doc.contractValue && (
          <MetaPill icon={<BarChart2 size={11} />} label={`£${doc.contractValue.toLocaleString("en-GB")} contract value`} />
        )}
        {doc.contractTermMonths && (
          <MetaPill icon={<Clock size={11} />} label={`${doc.contractTermMonths}-month term`} />
        )}
        {renewalDaysUntil !== null && renewalDaysUntil <= 90 && (
          <MetaPill
            icon={<CalendarClock size={11} />}
            label={`Renewal notice in ${renewalDaysUntil} days`}
            urgent={renewalDaysUntil <= 30}
          />
        )}
        {doc.autoRenewal && (
          <MetaPill icon={<ChevronRight size={11} />} label="Auto-renewal active" />
        )}
        <div className={`flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-md border ${readinessCfg.bg} ${readinessCfg.color}`}>
          <FileCheck size={11} />
          {readinessCfg.label}
        </div>
      </div>
    </div>
  );
}

function MetaPill({
  icon,
  label,
  urgent = false,
}: {
  icon: React.ReactNode;
  label: string;
  urgent?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium
      ${urgent
        ? "border-[#431407] bg-[#1C0F00] text-[#FCD34D]"
        : "border-[#1E293B] bg-[#0D1521] text-muted-foreground"
      }`}
    >
      {icon}
      {label}
    </div>
  );
}

// ─── Sign-off Workflow Tracker ────────────────────────────────────────────────

const APPROVER_ORDER = ["Handler", "Legal", "GC", "CFO", "CEO", "Board"] as const;

function getValueTier(value: number): string[] {
  if (value < 10_000)    return [];
  if (value < 50_000)    return ["Legal"];
  if (value < 250_000)   return ["Legal", "GC"];
  if (value < 1_000_000) return ["Legal", "GC", "CFO"];
  return                        ["Legal", "GC", "CFO", "Board"];
}

function SignOffTracker({ doc, results }: { doc: UploadedDocument; results: ReviewResult[] }) {
  const escalationRequired = results.some((r) => r.escalationRequired);
  const required = new Set<string>();

  if (escalationRequired) required.add("Legal");
  if (doc.contractValue) {
    getValueTier(doc.contractValue).forEach((a) => required.add(a));
  }
  if (doc.counterpartyType === "RELATED_PARTY") { required.add("GC"); required.add("Board"); }
  if (doc.counterpartyType === "INVESTOR")       { required.add("GC"); required.add("CFO"); }
  if (doc.counterpartyType === "COMPETITOR")     { required.add("GC"); required.add("CEO"); }

  type StepStatus = "done" | "required" | "skipped";

  const steps: Array<{ label: string; status: StepStatus; detail?: string }> = [
    {
      label: "Zane analysis complete",
      status: "done",
      detail: `${results.length} clauses reviewed`,
    },
    {
      label: "Legal review",
      status: required.has("Legal") ? "required" : "skipped",
      detail: required.has("Legal") ? "Required - clause risk flags raised" : undefined,
    },
    {
      label: "GC sign-off",
      status: required.has("GC") ? "required" : "skipped",
      detail: required.has("GC") ? (doc.contractValue ? `Required - value threshold (£${doc.contractValue.toLocaleString("en-GB")})` : "Required") : undefined,
    },
    {
      label: "CFO approval",
      status: required.has("CFO") ? "required" : "skipped",
    },
    {
      label: "Board approval",
      status: required.has("Board") ? "required" : "skipped",
    },
  ];

  const hasEscalation = steps.some((s) => s.status === "required");

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users size={13} className="text-muted-foreground/60 shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Sign-off workflow
        </span>
      </div>
      <div className="space-y-2.5">
        {steps.map((step) => (
          <div key={step.label} className="flex items-start gap-2.5">
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all
              ${step.status === "done"     ? "bg-[#14532D] border-[#166534]" : ""}
              ${step.status === "required" ? "bg-[#1C0F00] border-[#92400E]" : ""}
              ${step.status === "skipped"  ? "bg-transparent border-[#1E293B]" : ""}`}
            >
              {step.status === "done"     && <CheckCircle size={9} className="text-[#86EFAC]" />}
              {step.status === "required" && <span className="w-1.5 h-1.5 rounded-full bg-[#FCD34D]" />}
            </div>
            <div className="min-w-0">
              <div className={`text-xs font-medium leading-none
                ${step.status === "done"     ? "text-[#86EFAC]" : ""}
                ${step.status === "required" ? "text-[#FCD34D]" : ""}
                ${step.status === "skipped"  ? "text-muted-foreground/35" : ""}`}
              >
                {step.label}
              </div>
              {step.detail && (
                <div className={`text-[10px] mt-1 leading-tight
                  ${step.status === "done"     ? "text-muted-foreground/60" : ""}
                  ${step.status === "required" ? "text-[#FCD34D]/55" : ""}
                  ${step.status === "skipped"  ? "text-muted-foreground/25" : ""}`}
                >
                  {step.detail}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {!hasEscalation && (
        <div className="text-[10px] text-muted-foreground/40 pt-1 border-t border-border">
          No sign-off required based on current flags and contract value.
        </div>
      )}
    </div>
  );
}

// ─── Intelligence Signals ─────────────────────────────────────────────────────

function IntelligenceSignals({
  doc,
  results,
  isMock,
  companyName,
}: {
  doc: UploadedDocument;
  results: ReviewResult[];
  isMock: boolean;
  companyName?: string;
}) {
  const signals: Array<{
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    text: string;
  }> = [];

  const redResults = results.filter((r) => r.ragStatus === "RED");
  const renewalDaysUntil = doc.renewalDate
    ? Math.ceil((new Date(doc.renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // Derive highest approver role from escalation triggers
  function getHighestApprover(): string {
    const escalatingResults = results.filter((r) => r.escalationRequired && r.escalationTrigger);
    if (!escalatingResults.length) return "GC";
    const trigger = escalatingResults[0].escalationTrigger?.toUpperCase() ?? "";
    if (trigger.includes("BOARD")) return "Board";
    if (trigger.includes("CFO")) return "CFO";
    if (trigger.includes("CEO")) return "CEO";
    if (trigger.includes("GC") || trigger.includes("GENERAL")) return "GC";
    return "Legal";
  }

  // Pattern signal from red clauses
  if (redResults.length > 0) {
    const approverRole = getHighestApprover();
    const co = companyName ?? "your organisation";
    signals.push({
      icon: TrendingDown,
      color: "#FCA5A5",
      bgColor: "#1A0404",
      borderColor: "#450A0A",
      text: isMock
        ? `${redResults.length} clauses flagged RED across all prior Acme Corp reviews - consistent counterparty negotiation posture.`
        : `These ${redResults.length} clause${redResults.length !== 1 ? "s" : ""} exceed ${co}'s accepted risk thresholds and trigger mandatory ${approverRole} approval before this contract can proceed.`,
    });
  }

  // Renewal signal
  if (renewalDaysUntil !== null && renewalDaysUntil <= 90) {
    signals.push({
      icon: CalendarClock,
      color: "#FCD34D",
      bgColor: "#130D00",
      borderColor: "#431407",
      text: `Auto-renewal notice window closes in ${renewalDaysUntil} days. ${
        doc.contractValue ? `Failure to act locks £${doc.contractValue.toLocaleString("en-GB")} for another year.` : ""
      }`,
    });
  }

  // Memory / pattern signal
  if (isMock) {
    signals.push({
      icon: Layers,
      color: "#A5B4FC",
      bgColor: "#0F0E1A",
      borderColor: "#312E81",
      text: "Zane has processed 2 prior agreements with this counterparty. Liability cap position unchanged across all 3 reviews - systemic pattern flagged.",
    });
  } else if (results.length > 0) {
    const absentCount = results.filter((r) => r.isAbsent).length;
    if (absentCount > 0) {
      signals.push({
        icon: Layers,
        color: "#A5B4FC",
        bgColor: "#0F0E1A",
        borderColor: "#312E81",
        text: `${absentCount} clause${absentCount !== 1 ? "s" : ""} absent from this contract. Your playbook requires ${absentCount !== 1 ? "them" : "it"} to be present - request insertion before signing.`,
      });
    }
  }

  if (signals.length === 0) return null;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Layers size={13} className="text-muted-foreground/60 shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Intelligence
        </span>
      </div>
      <div className="space-y-2">
        {signals.map((sig, i) => {
          const Icon = sig.icon;
          return (
            <div
              key={i}
              className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5"
              style={{ background: sig.bgColor, borderColor: sig.borderColor }}
            >
              <Icon size={12} className="shrink-0 mt-0.5" style={{ color: sig.color }} />
              <p className="text-[11px] leading-relaxed" style={{ color: sig.color, opacity: 0.85 }}>
                {sig.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Document Audit Panel ─────────────────────────────────────────────────────

function DocumentAuditPanel({ audit }: { audit: import("../lib/types").DocumentAuditResult }) {
  const [expanded, setExpanded] = useState(false);
  const allFindings = [
    ...(audit.definedTerms ?? []),
    ...(audit.crossReferences ?? []),
    ...(audit.numbersDates ?? []),
    ...(audit.internalConsistency ?? []),
  ];
  if (allFindings.length === 0) return null;

  const PASS_LABELS: Record<string, string> = {
    DEFINED_TERMS: "Defined Terms",
    CROSS_REFERENCES: "Cross-References",
    NUMBERS_DATES: "Numbers & Dates",
    INTERNAL_CONSISTENCY: "Internal Consistency",
  };

  const SEVERITY_CONFIG = {
    HIGH:   { classes: "bg-[#1F0A0A] border-[#450A0A] text-[#FCA5A5]", label: "High" },
    MEDIUM: { classes: "bg-[#1C0F00] border-[#431407] text-[#FCD34D]", label: "Medium" },
    LOW:    { classes: "bg-[#0F172A] border-[#334155] text-[#94A3B8]", label: "Low" },
  };

  return (
    <div className="rounded-xl border border-[#1E3A5F] bg-[#0C1929] overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#0E1E3A] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <Scale size={13} className="text-[#60A5FA] shrink-0" />
          <span className="text-sm font-semibold text-[#93C5FD]">Document Audit</span>
          <span className="text-[10px] bg-[#1D4ED8]/30 text-[#60A5FA] border border-[#1D4ED8]/40 rounded-full px-2 py-0.5 font-semibold">
            {allFindings.length} finding{allFindings.length !== 1 ? "s" : ""}
          </span>
          {audit.highSeverityCount > 0 && (
            <span className="text-[10px] bg-[#1F0A0A] text-[#FCA5A5] border border-[#450A0A] rounded-full px-2 py-0.5 font-semibold">
              {audit.highSeverityCount} high
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
          <span>Passes 2–5: defined terms · cross-refs · numbers · consistency</span>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-[#1E293B] px-4 py-4 space-y-4">
          {[
            { key: "definedTerms",        findings: audit.definedTerms ?? [] },
            { key: "crossReferences",     findings: audit.crossReferences ?? [] },
            { key: "numbersDates",        findings: audit.numbersDates ?? [] },
            { key: "internalConsistency", findings: audit.internalConsistency ?? [] },
          ].filter(g => g.findings.length > 0).map(({ key, findings }) => (
            <div key={key} className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                {PASS_LABELS[findings[0].pass] ?? key}
              </div>
              {findings.map((f, i) => {
                const sev = SEVERITY_CONFIG[f.severity] ?? SEVERITY_CONFIG.LOW;
                return (
                  <div key={i} className={`rounded-lg border px-3 py-2.5 space-y-1.5 ${sev.classes}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${sev.classes}`}>
                        {sev.label}
                      </span>
                      <span className="text-xs font-semibold">{f.type}</span>
                      {f.location && (
                        <span className="text-[10px] opacity-60 ml-auto">{f.location}</span>
                      )}
                    </div>
                    <p className="text-xs opacity-85">{f.description}</p>
                    <p className="text-xs font-medium opacity-75">→ {f.recommendation}</p>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Risk Distribution ────────────────────────────────────────────────────────

type ExtendedCounts = Record<RagStatus, number> & { GREY_CRITICAL: number; GREY_OPTIONAL: number };

function RiskDistribution({ counts, total }: { counts: ExtendedCounts; total: number }) {
  if (total === 0) return null;

  const bars: Array<{ label: string; count: number; color: string; bg: string }> = [
    { label: "Red",               count: counts.RED,           color: "#FCA5A5", bg: "bg-[#FCA5A5]" },
    { label: "Amber",             count: counts.AMBER,         color: "#FCD34D", bg: "bg-[#FCD34D]" },
    { label: "Green",             count: counts.GREEN,         color: "#86EFAC", bg: "bg-[#86EFAC]" },
    { label: "Missing (critical)", count: counts.GREY_CRITICAL, color: "#FCA5A5", bg: "bg-[#FCA5A5]/60" },
    { label: "Missing (optional)", count: counts.GREY_OPTIONAL, color: "#475569", bg: "bg-[#475569]" },
  ].filter((b) => b.count > 0);

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart2 size={13} className="text-muted-foreground/60 shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Risk distribution
        </span>
      </div>
      <div className="space-y-2">
        {bars.map((bar) => (
          <div key={bar.label} className="flex items-center gap-2.5">
            <div className="w-14 text-[11px] text-muted-foreground/60 shrink-0">{bar.label}</div>
            <div className="flex-1 h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${bar.bg} transition-all duration-700`}
                style={{ width: `${(bar.count / total) * 100}%` }}
              />
            </div>
            <div className="w-4 text-[11px] font-semibold text-right shrink-0" style={{ color: bar.color }}>
              {bar.count}
            </div>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-muted-foreground/40 pt-1 border-t border-border">
        {total} clauses reviewed
      </div>
    </div>
  );
}

// ─── Clause Card ──────────────────────────────────────────────────────────────

// ── Learning indicator (per-clause) ──────────────────────────────────────────

function LearningIndicator({ clauseCategory }: { clauseCategory: string }) {
  const { data } = useQuery({
    queryKey: ["signals-summary", clauseCategory],
    queryFn: () => getSignalsSummary(clauseCategory),
    staleTime: 5 * 60 * 1000,
  });

  const hasSignals = data && (data.overrideCount + data.outcomeCount + data.ruleCount + data.fpCount) > 0;

  const tooltip = hasSignals && data
    ? [
        data.overrideCount > 0 ? `${data.overrideCount} override${data.overrideCount !== 1 ? "s" : ""}` : null,
        data.ruleCount > 0     ? `${data.ruleCount} active rule${data.ruleCount !== 1 ? "s" : ""}` : null,
        data.outcomeCount > 0  ? `${data.outcomeCount} outcome pattern${data.outcomeCount !== 1 ? "s" : ""}` : null,
      ].filter(Boolean).join(" · ")
    : "Standard analysis";

  return (
    <div className="group relative flex items-center gap-1" title={tooltip}>
      <div className={`w-1.5 h-1.5 rounded-full ${hasSignals ? "bg-[#60A5FA]" : "bg-[#334155]"}`} />
      <span className="text-[10px] text-foreground/30 group-hover:text-foreground/60 transition-colors">
        {hasSignals ? "Personalised" : "Standard"}
      </span>
    </div>
  );
}

// ── Override panel (inline) ───────────────────────────────────────────────────

const OVERRIDE_REASON_CHIPS = [
  "Strategic relationship",
  "Below threshold",
  "Contractual right exists",
  "Market standard",
  "Previous agreement",
];

function OverridePanel({
  result,
  onClose,
  onDone,
}: {
  result: ReviewResult;
  onClose: () => void;
  onDone: () => void;
}) {
  const [correctedStatus, setCorrectedStatus] = useState<string>("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!correctedStatus || !reason.trim()) { setError("Please select a status and provide a reason."); return; }
    setSubmitting(true);
    setError("");
    try {
      await overrideRagStatus(result.id, { correctedStatus, reason: reason.trim() });
      onDone();
    } catch {
      setError("Failed to save override. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const statuses: Array<{ value: string; label: string; color: string; bg: string; border: string }> = [
    { value: "RED",   label: "Red",   color: "#FCA5A5", bg: "#1F0A0A", border: "#450A0A" },
    { value: "AMBER", label: "Amber", color: "#FCD34D", bg: "#1C0F00", border: "#431407" },
    { value: "GREEN", label: "Green", color: "#86EFAC", bg: "#052E16", border: "#14532D" },
  ];

  return (
    <div className="rounded-xl border border-[#1D4ED8] bg-[#0E1E3A] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Edit2 size={12} className="text-[#60A5FA]" />
          <span className="text-xs font-semibold text-[#93C5FD]">Override RAG status</span>
        </div>
        <button onClick={onClose} className="text-[#60A5FA]/40 hover:text-[#60A5FA] text-xs">✕</button>
      </div>

      {/* Status chips */}
      <div className="flex gap-2">
        {statuses.map((s) => (
          <button
            key={s.value}
            onClick={() => setCorrectedStatus(s.value)}
            className="flex-1 text-xs py-1.5 rounded-lg border font-medium transition-all"
            style={{
              background: correctedStatus === s.value ? s.bg : "transparent",
              borderColor: correctedStatus === s.value ? s.border : "#1E293B",
              color: correctedStatus === s.value ? s.color : "#64748B",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Reason chips */}
      <div>
        <div className="text-[10px] text-muted-foreground/50 mb-1.5">Reason (required)</div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {OVERRIDE_REASON_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setReason(chip)}
              className="text-[11px] px-2.5 py-1 rounded-md border transition-colors"
              style={{
                borderColor: reason === chip ? "#2563EB" : "#1E293B",
                background: reason === chip ? "#1D4ED8" : "transparent",
                color: reason === chip ? "#fff" : "#64748B",
              }}
            >
              {chip}
            </button>
          ))}
        </div>
        <input
          className="w-full rounded-lg border border-[#1E293B] bg-[#0B1118] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-[#2563EB]"
          placeholder="Or type a reason…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      {error && <div className="text-xs text-destructive">{error}</div>}

      <button
        className="w-full text-xs py-2 rounded-lg bg-[#1D4ED8] text-white font-semibold disabled:opacity-50 transition-colors hover:bg-[#2563EB]"
        disabled={!correctedStatus || !reason.trim() || submitting}
        onClick={() => void handleSubmit()}
      >
        {submitting ? "Saving…" : "Save override"}
      </button>
    </div>
  );
}

// ── False positive panel ──────────────────────────────────────────────────────

const FP_ERROR_TYPES: Array<{ value: string; label: string; desc: string }> = [
  { value: "extraction",     label: "Wrong extraction",            desc: "The clause wasn't really present or was truncated" },
  { value: "classification", label: "Wrong classification",        desc: "Identified as the wrong clause category" },
  { value: "regulatory",     label: "Wrong regulation applied",    desc: "Incorrect regulatory framework cited" },
  { value: "fallback",       label: "Wrong fallback template",     desc: "Fallback suggestion doesn't apply here" },
];

function FalsePositivePanel({
  result,
  onClose,
  onDone,
}: {
  result: ReviewResult;
  onClose: () => void;
  onDone: () => void;
}) {
  const [errorType, setErrorType] = useState("");
  const [correctInterpretation, setCorrectInterpretation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!errorType) return;
    setSubmitting(true);
    try {
      await markFalsePositiveSignal(result.id, { errorType, correctInterpretation: correctInterpretation.trim() || undefined });
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#431407] bg-[#1C0F00] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag size={12} className="text-[#FCD34D]" />
          <span className="text-xs font-semibold text-[#FCD34D]">Mark as false positive</span>
        </div>
        <button onClick={onClose} className="text-[#FCD34D]/40 hover:text-[#FCD34D] text-xs">✕</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {FP_ERROR_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setErrorType(t.value)}
            className="text-left p-3 rounded-lg border transition-all"
            style={{
              borderColor: errorType === t.value ? "#431407" : "#1E293B",
              background: errorType === t.value ? "#1C0F00" : "transparent",
            }}
          >
            <div className={`text-[11px] font-semibold ${errorType === t.value ? "text-[#FCD34D]" : "text-muted-foreground"}`}>
              {t.label}
            </div>
            <div className="text-[10px] text-muted-foreground/50 mt-0.5">{t.desc}</div>
          </button>
        ))}
      </div>

      <textarea
        className="w-full rounded-lg border border-[#1E293B] bg-[#0B1118] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none min-h-[60px] resize-y"
        placeholder="Optional: what is the correct interpretation?"
        value={correctInterpretation}
        onChange={(e) => setCorrectInterpretation(e.target.value)}
      />

      <button
        className="w-full text-xs py-2 rounded-lg bg-[#431407] text-[#FCD34D] font-semibold disabled:opacity-50 transition-colors hover:bg-[#7C2D12]"
        disabled={!errorType || submitting}
        onClick={() => void handleSubmit()}
      >
        {submitting ? "Submitting…" : "Submit false positive"}
      </button>
    </div>
  );
}

// ── Main clause card ──────────────────────────────────────────────────────────

function ClauseCard({
  result,
  index,
  expanded,
  onToggle,
  onFeedback,
  isMock,
}: {
  result: ReviewResult;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onFeedback: (action: FeedbackAction, finalClauseText?: string) => Promise<void>;
  isMock: boolean;
}) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState<FeedbackAction | null>(null);
  const [generatedReply, setGeneratedReply] = useState<string | null>(null);
  const [copiedReply, setCopiedReply] = useState(false);
  const [showWhatAgreed, setShowWhatAgreed] = useState(false);
  const [agreedText, setAgreedText] = useState("");
  const [showTeachZane, setShowTeachZane] = useState(false);
  const [incorrectOutput, setIncorrectOutput] = useState("");
  const [correctOutput, setCorrectOutput] = useState("");
  const [teachSubmitting, setTeachSubmitting] = useState(false);
  const [teachDone, setTeachDone] = useState(false);
  const [fpSubmitting, setFpSubmitting] = useState(false);
  const [fpDone, setFpDone] = useState(result.feedback?.feedbackType === "FALSE_POSITIVE");
  // Section 18 - override + FP signal panels
  const [showOverridePanel, setShowOverridePanel] = useState(false);
  const [showFpSignalPanel, setShowFpSignalPanel] = useState(false);
  const [overrideDone, setOverrideDone] = useState(false);
  const [fpSignalDone, setFpSignalDone] = useState(false);

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
    if (isMock) return;
    setSubmitting(action);
    try { await onFeedback(action, finalClauseText); } finally { setSubmitting(null); }
  }

  async function handleTeachZane() {
    if (!incorrectOutput.trim() || !correctOutput.trim()) return;
    setTeachSubmitting(true);
    try {
      await teachZane(result.id, { incorrectOutput, correctOutput });
      setTeachDone(true);
      setShowTeachZane(false);
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
    <div
      className={`overflow-hidden rounded-xl border border-[#1E293B] border-l-[3px] ${RAG_BORDER_LEFT[result.ragStatus]} bg-card transition-all duration-200 ${expanded ? "shadow-lg shadow-black/20" : ""}`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* ── Collapsed header ──────────────────────────────────────────── */}
      <button
        className="w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-muted/10 transition-colors"
        onClick={onToggle}
      >
        <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${RAG_DOT[result.ragStatus]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{label}</span>
            {result.isAbsent && (
              <span className="text-[11px] bg-[#0F172A] text-[#94A3B8] border border-[#334155] rounded px-1.5 py-0.5">
                Absent
              </span>
            )}
            {result.escalationRequired && (
              <span className="text-[11px] bg-[#1F0A0A] text-[#FCA5A5] border border-[#450A0A] rounded px-1.5 py-0.5 flex items-center gap-1">
                <AlertTriangle size={9} /> Escalate
              </span>
            )}
            {feedback && (
              <span className="text-[11px] bg-muted text-muted-foreground border border-border rounded px-1.5 py-0.5 capitalize">
                {feedback.userAction.toLowerCase()}
              </span>
            )}
          </div>
          {/* Business summary - only shown when expanded (RED/AMBER show a hint) */}
          {(result.ragStatus === "RED" || result.ragStatus === "AMBER") && !expanded && (
            <div className="text-xs text-muted-foreground/70 mt-1 line-clamp-1 leading-relaxed">
              {result.businessSummary || result.clauseSummary}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          {!isMock && <LearningIndicator clauseCategory={result.clauseCategory} />}
          {/* Urgency badge */}
          {result.urgencyLevel && result.urgencyLevel !== "BACKGROUND" && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
              result.urgencyLevel === "IMMEDIATE"
                ? "bg-[#1F0A0A] text-[#FCA5A5] border-[#450A0A]"
                : "bg-[#1C0F00] text-[#FCD34D] border-[#431407]"
            }`}>
              {result.urgencyLevel === "IMMEDIATE" ? "⚡ Immediate" : "Material"}
            </span>
          )}
          {/* Error category badge */}
          {result.errorCategory && result.errorCategory !== "SUBSTANTIVE_RISK" && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-[#0F172A] text-[#94A3B8] border-[#334155]">
              {result.errorCategory === "DRAFTING_ERROR" ? "Drafting" : "Mechanical"}
            </span>
          )}
          {result.ragStatus === "GREY" ? (
            <span className={result.missingSeverity === "CRITICAL" ? "rag-red" : "rag-grey"}>
              {result.missingSeverity === "CRITICAL" ? "Missing: Critical" : "Missing: Optional"}
            </span>
          ) : (
            <span className={RAG_BADGE[result.ragStatus]}>{RAG_LABEL[result.ragStatus]}</span>
          )}
          <span className="text-muted-foreground/50 text-xs">{expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
        </div>
      </button>

      {/* ── Expanded detail ───────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-[#1E293B] px-5 py-5 space-y-5 bg-[#080F18]">

          {/* IRAC Analysis */}
          {(result.iracIssue || result.iracConclusion) ? (
            <div className="rounded-xl border border-[#1E293B] bg-[#0D1521] p-4 space-y-4">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Legal Analysis (IRAC)
              </div>

              {result.isAbsent && (
                <div className="flex items-start gap-2 rounded-lg border border-[#334155] bg-[#0F172A] px-3 py-2">
                  <Info size={12} className="text-[#94A3B8] shrink-0 mt-0.5" />
                  <span className="text-xs text-[#94A3B8]">
                    This clause was not identified in the contract. Review whether your playbook requires it to be present.
                  </span>
                </div>
              )}

              {result.iracIssue && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#60A5FA]/70">Issue</div>
                  <p className="text-sm font-semibold text-foreground leading-snug">{result.iracIssue}</p>
                </div>
              )}

              {result.iracRule && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#60A5FA]/70">Rule</div>
                  <div className="rounded-lg border border-[#1E293B] bg-[#050A10] px-3 py-2.5 text-xs leading-relaxed text-[#94A3B8]">
                    {result.iracRule}
                  </div>
                </div>
              )}

              {result.iracApplication && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#60A5FA]/70">Application</div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{result.iracApplication}</p>
                </div>
              )}

              {result.iracConclusion && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#A78BFA]/70">Conclusion</div>
                  <div className="rounded-lg border border-[#312E81] bg-[#1E1B4B]/50 px-3 py-2.5 text-sm font-medium text-[#C4B5FD] leading-relaxed">
                    {result.iracConclusion}
                  </div>
                </div>
              )}

              {result.escalationRequired && result.escalationTrigger && (
                <div className="flex items-start gap-2 rounded-lg border border-[#450A0A] bg-[#1F0A0A] px-3 py-2">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5 text-[#FCA5A5]" />
                  <span className="text-xs text-[#FCA5A5]">{result.escalationTrigger}</span>
                </div>
              )}
            </div>
          ) : (
            /* Legacy fallback: show old decision summary for results without IRAC */
            <div className="rounded-xl border border-[#1E293B] bg-[#0D1521] p-4 space-y-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Decision summary
              </div>
              {result.isAbsent && (
                <div className="flex items-start gap-2 rounded-lg border border-[#334155] bg-[#0F172A] px-3 py-2">
                  <Info size={12} className="text-[#94A3B8] shrink-0 mt-0.5" />
                  <span className="text-xs text-[#94A3B8]">
                    This clause was not identified in the contract. Review whether your playbook requires it to be present.
                  </span>
                </div>
              )}
              <div className="text-sm font-semibold text-foreground leading-snug">
                {result.recommendedAction}
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                {result.businessSummary}
              </div>
              {result.escalationRequired && result.escalationTrigger && (
                <div className="flex items-start gap-2 rounded-lg border border-[#450A0A] bg-[#1F0A0A] px-3 py-2">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5 text-[#FCA5A5]" />
                  <span className="text-xs text-[#FCA5A5]">{result.escalationTrigger}</span>
                </div>
              )}
            </div>
          )}

          {/* Confidence */}
          {result.confidenceLabel && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border w-fit ${CONFIDENCE_CONFIG[result.confidenceLabel].classes}`}>
              <Scale size={11} />
              {CONFIDENCE_CONFIG[result.confidenceLabel].label}
              {result.confidenceLabel === "LOW" && (
                <span className="ml-1 font-semibold">Zane is uncertain - have a lawyer verify before relying on this analysis.</span>
              )}
            </div>
          )}

          {/* Playbook comparison */}
          {result.comparisonStatement && (
            <Detail title="Playbook comparison">
              <div className="rounded-lg border border-[#1E293B] bg-[#050A10] px-4 py-3 text-xs leading-relaxed text-[#94A3B8] font-mono whitespace-pre-line">
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
                  <div key={i} className="flex items-start gap-2.5 rounded-lg border border-[#312E81] bg-[#1E1B4B] px-3 py-2">
                    <BookOpen size={11} className="text-[#A5B4FC] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#A5B4FC]">{c.regulation} - {c.article}</div>
                      <div className="text-[11px] text-[#A5B4FC]/70 mt-0.5">{c.relevance}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Detail>
          )}

          {/* Suggested fallback */}
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

          {/* Generate reply */}
          {!isMock && (result.ragStatus === "RED" || result.ragStatus === "AMBER") && (
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
                    <><MessageSquare size={11} /> Draft negotiation response</>
                  )}
                </button>
              ) : (
                <Detail title="Negotiation reply">
                  <div className="space-y-2">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap rounded-lg border border-card-border bg-card px-4 py-3">
                      {generatedReply}
                    </p>
                    <div className="flex gap-2">
                      <button className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1" onClick={copyReply}>
                        <Copy size={11} />{copiedReply ? "Copied!" : "Copy text"}
                      </button>
                      <button className="btn-ghost text-xs px-3 py-1.5 text-muted-foreground" onClick={() => setGeneratedReply(null)}>
                        Regenerate
                      </button>
                    </div>
                  </div>
                </Detail>
              )}
            </div>
          )}

          {/* ── Section 18: Override + FP signal capture ─────────────── */}
          {!isMock && !showOverridePanel && !showFpSignalPanel && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {!overrideDone ? (
                <button
                  onClick={() => { setShowOverridePanel(true); setShowFpSignalPanel(false); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[#1E293B] hover:border-[#2563EB] hover:text-[#60A5FA] transition-colors"
                >
                  <Edit2 size={11} /> Override status
                </button>
              ) : (
                <span className="text-xs text-[#60A5FA] flex items-center gap-1"><CheckCircle size={11} /> Status overridden</span>
              )}
              {!fpSignalDone ? (
                <button
                  onClick={() => { setShowFpSignalPanel(true); setShowOverridePanel(false); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[#1E293B] hover:border-[#431407] hover:text-[#FCD34D] transition-colors"
                >
                  <Flag size={11} /> Flag as false positive
                </button>
              ) : (
                <span className="text-xs text-[#FCD34D] flex items-center gap-1"><CheckCircle size={11} /> False positive flagged</span>
              )}
            </div>
          )}
          {showOverridePanel && !isMock && (
            <OverridePanel
              result={result}
              onClose={() => setShowOverridePanel(false)}
              onDone={() => {
                setShowOverridePanel(false);
                setOverrideDone(true);
                void queryClient.invalidateQueries({ queryKey: ["review"] });
              }}
            />
          )}
          {showFpSignalPanel && !isMock && (
            <FalsePositivePanel
              result={result}
              onClose={() => setShowFpSignalPanel(false)}
              onDone={() => {
                setShowFpSignalPanel(false);
                setFpSignalDone(true);
              }}
            />
          )}

          {/* ── Record outcome ─────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#1E293B]">
            <span className="text-xs text-muted-foreground">Record outcome:</span>
            {([
              { action: "ACCEPTED",  label: "Accept",           icon: <CheckCircle size={12} /> },
              { action: "ESCALATED", label: "Escalate internally", icon: <AlertTriangle size={12} /> },
              { action: "DISMISSED", label: "Dismiss",            icon: <Clock size={12} /> },
            ] as { action: FeedbackAction; label: string; icon: React.ReactNode }[]).map(({ action, label: btnLabel, icon }) => (
              <button
                key={action}
                disabled={!!submitting || isMock}
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
                {submitting === action ? "…" : <>{icon} {btnLabel}</>}
              </button>
            ))}
            {isMock && (
              <span className="text-[10px] text-muted-foreground/40">Demo - outcomes disabled</span>
            )}
          </div>

          {/* Accept + capture clause text */}
          {showWhatAgreed && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }}>
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
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-[#86EFAC]/50">
                    Final agreed clause text (optional)
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-[#14532D] bg-[#052E16] px-3.5 py-2.5 text-sm text-[#86EFAC] placeholder:text-[#86EFAC]/25 focus:outline-none focus:border-[#166534] min-h-[96px] resize-y font-mono"
                    placeholder="Paste the final clause text as executed…"
                    value={agreedText}
                    onChange={(e) => setAgreedText(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-2">
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

          {/* ── Improve analysis ──────────────────────────────────────── */}
          {!isMock && (
            <div className="pt-2 border-t border-[#1E293B] space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Improve this analysis:</span>
                <button
                  onClick={() => setShowTeachZane(!showTeachZane)}
                  disabled={teachDone}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
                    teachDone ? "bg-[#052E16] border-[#14532D] text-[#86EFAC]" : "border-border hover:border-[#475569]"
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
                      fpDone ? "bg-[#1F0A0A] border-[#450A0A] text-[#FCA5A5]" : "border-border hover:border-[#475569]"
                    }`}
                  >
                    <XCircle size={11} />
                    {fpDone ? "Marked false positive" : fpSubmitting ? "…" : "False positive"}
                  </button>
                )}
              </div>

              {showTeachZane && (
                <div className="rounded-lg border border-[#172B4D] bg-[#0B1020] p-4 space-y-3">
                  <div className="text-xs font-semibold text-[#60A5FA]">Correct this analysis</div>
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
                      placeholder="Describe the correct legal position…"
                      value={correctOutput}
                      onChange={(e) => setCorrectOutput(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                      onClick={() => void handleTeachZane()}
                      disabled={teachSubmitting || !incorrectOutput.trim() || !correctOutput.trim()}
                    >
                      {teachSubmitting ? <Loader2 size={11} className="animate-spin" /> : <GraduationCap size={11} />}
                      Save correction
                    </button>
                    <button className="btn-ghost text-xs px-3 py-1.5" onClick={() => setShowTeachZane(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Three-tier Escalation Summary ───────────────────────────────────────────

const APPROVER_ORDER_FULL = ["Handler", "Legal", "GC", "CFO", "CEO", "Board"] as const;

function getValueTierFull(value: number): { label: string; approvers: string[] } | null {
  if (value < 10_000)    return null;
  if (value < 50_000)    return { label: "Legal sign-off required",  approvers: ["Legal"] };
  if (value < 250_000)   return { label: "GC sign-off required",     approvers: ["GC"] };
  if (value < 1_000_000) return { label: "CFO sign-off required",    approvers: ["CFO"] };
  return                        { label: "Board approval required",   approvers: ["Board"] };
}

function getGovernanceTriggers(
  counterpartyType?: string,
  contractType?: string,
): Array<{ label: string; approvers: string[] }> {
  const triggers: Array<{ label: string; approvers: string[] }> = [];
  switch (counterpartyType) {
    case "RELATED_PARTY": triggers.push({ label: "Related party: Board sign-off required",          approvers: ["Board"] }); break;
    case "REGULATOR":     triggers.push({ label: "Regulator / government body: GC sign-off required", approvers: ["GC"] }); break;
    case "INVESTOR":      triggers.push({ label: "Investor / shareholder: GC and CFO required",     approvers: ["GC", "CFO"] }); break;
    case "COMPETITOR":    triggers.push({ label: "Competitor: GC and CEO required",                 approvers: ["GC", "CEO"] }); break;
  }
  if (contractType === "JV_AGREEMENT") triggers.push({ label: "Joint venture: Board sign-off required", approvers: ["Board"] });
  return triggers;
}

function EscalationSummary({ doc, results }: { doc: UploadedDocument; results: ReviewResult[] }) {
  const [showExplainer, setShowExplainer] = useState(false);

  const tier1Clauses = results.filter((r) => r.escalationRequired);
  const valueTier    = doc.contractValue != null ? getValueTierFull(doc.contractValue) : null;
  const govTriggers  = getGovernanceTriggers(doc.counterpartyType, doc.contractType);

  const tiersActive = [tier1Clauses.length > 0, valueTier !== null, govTriggers.length > 0].filter(Boolean).length;
  if (tiersActive === 0) return null;

  const requiredApprovers = new Set<string>();
  if (tier1Clauses.length > 0) requiredApprovers.add("Legal");
  if (valueTier)   valueTier.approvers.forEach((a) => requiredApprovers.add(a));
  govTriggers.forEach((t) => t.approvers.forEach((a) => requiredApprovers.add(a)));
  const signOffSequence = APPROVER_ORDER_FULL.filter((a) => requiredApprovers.has(a));

  return (
    <div className="card overflow-hidden border border-[#450A0A]">
      <div className="bg-[#1F0A0A] px-5 py-3 flex items-center gap-3 border-b border-[#450A0A]">
        <AlertTriangle size={14} className="text-[#FCA5A5] shrink-0" />
        <span className="text-sm font-semibold text-[#FCA5A5] flex-1">
          Escalation required - {tiersActive} tier{tiersActive !== 1 ? "s" : ""} triggered
        </span>
      </div>
      <div className="p-4 space-y-3">
        {tier1Clauses.length > 0 && (
          <div className="rounded-lg bg-[#1F0A0A] border border-[#450A0A] p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#FCA5A5]">Tier 1 - Clause Risk</div>
            <ul className="space-y-1.5">
              {tier1Clauses.map((r) => (
                <li key={r.id} className="flex gap-2 text-sm text-[#FCA5A5]">
                  <span className="shrink-0 mt-0.5">·</span>
                  <span>
                    <span className="font-semibold">{CLAUSE_LABELS[r.clauseCategory] ?? r.clauseCategory}</span>
                    {r.escalationTrigger && <span className="opacity-70">: {r.escalationTrigger}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {valueTier && (
          <div className="rounded-lg bg-[#1C0F00] border border-[#431407] p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#FCD34D]">Tier 2 - Contract Value</div>
            <div className="text-sm text-[#FCD34D]">
              <span className="font-semibold">£{doc.contractValue!.toLocaleString("en-GB")}</span> - {valueTier.label}
            </div>
          </div>
        )}
        {govTriggers.length > 0 && (
          <div className="rounded-lg bg-[#1E1B4B] border border-[#312E81] p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#A5B4FC]">Tier 3 - Governance</div>
            <ul className="space-y-1.5">
              {govTriggers.map((t, i) => (
                <li key={i} className="flex gap-2 text-sm text-[#A5B4FC]">
                  <span className="shrink-0 mt-0.5">·</span>
                  <span>{t.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {signOffSequence.length > 0 && (
          <div className="pt-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Sign-off sequence
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {signOffSequence.map((approver, i) => (
                <span key={approver} className="flex items-center gap-1.5">
                  <span className="inline-flex items-center bg-[#2563EB] text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                    {approver}
                  </span>
                  {i < signOffSequence.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
                </span>
              ))}
            </div>
          </div>
        )}
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
              Zane uses three escalation tiers. <strong>Tier 1</strong> fires when individual clauses exceed your playbook thresholds and require sign-off. <strong>Tier 2</strong> fires when total contract value crosses an authority threshold set by your organisation. <strong>Tier 3</strong> fires based on the nature of the counterparty or contract type.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

function exportReviewAsText(doc: UploadedDocument) {
  const results = doc.reviewResults ?? [];
  const counts = {
    RED:           results.filter((r) => r.ragStatus === "RED").length,
    AMBER:         results.filter((r) => r.ragStatus === "AMBER").length,
    GREEN:         results.filter((r) => r.ragStatus === "GREEN").length,
    GREY:          results.filter((r) => r.ragStatus === "GREY").length,
    GREY_CRITICAL: results.filter((r) => r.ragStatus === "GREY" && r.missingSeverity === "CRITICAL").length,
    GREY_OPTIONAL: results.filter((r) => r.ragStatus === "GREY" && r.missingSeverity !== "CRITICAL").length,
  };
  const overallRag = counts.RED > 0 ? "RED" : counts.AMBER > 0 ? "AMBER" : "GREEN";
  const date = formatContractDate(doc.uploadedAt);

  const lines: string[] = [
    "ZANE REVIEW SUMMARY",
    "===================",
    "",
    `Contract:    ${doc.originalName}`,
    `Counterparty: ${doc.counterpartyName ?? "-"}`,
    `Type:        ${(doc.contractType ?? "").replace(/_/g, " ")}`,
    `Reviewed:    ${date}`,
    `Overall RAG: ${overallRag}`,
    doc.contractValue ? `Value:       £${doc.contractValue.toLocaleString("en-GB")}` : "",
    `Clauses:     ${results.length} reviewed  |  ${counts.RED} Red  |  ${counts.AMBER} Amber  |  ${counts.GREEN} Green  |  ${counts.GREY_CRITICAL} Missing (Critical)  |  ${counts.GREY_OPTIONAL} Missing (Optional)`,
    "",
  ].filter((l) => l !== "" || l === "");

  const escalations = results.filter((r) => r.escalationRequired);
  if (escalations.length > 0) {
    lines.push("ESCALATIONS REQUIRED", "--------------------");
    for (const r of escalations) {
      lines.push(`- ${CLAUSE_LABELS[r.clauseCategory] ?? r.clauseCategory}: ${r.escalationTrigger ?? "Sign-off needed"}`);
    }
    lines.push("");
  }

  for (const status of ["RED", "AMBER", "GREEN", "GREY"] as RagStatus[]) {
    const group = results.filter((r) => r.ragStatus === status);
    if (!group.length) continue;
    lines.push(`${status} CLAUSES (${group.length})`, "-".repeat(40));
    for (const r of group) {
      const lbl = CLAUSE_LABELS[r.clauseCategory] ?? r.clauseCategory;
      lines.push("", `[${status}] ${lbl}${r.isAbsent ? " (ABSENT)" : ""}`, "",
        "What it says:", r.clauseSummary, "",
        "Why it matters:", r.whyItMatters, "",
        "Recommended action:", r.recommendedAction);
      if (r.suggestedFallback) lines.push("", "Suggested fallback:", r.suggestedFallback);
      if (r.escalationRequired && r.escalationTrigger) lines.push("", "Escalation trigger:", r.escalationTrigger);
      lines.push("", "Plain English:", r.businessSummary, "", "-".repeat(40));
    }
    lines.push("");
  }

  lines.push("", "Generated by Zane", "https://zanelegal.ai");

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `Zane-Review-${doc.originalName.replace(/\.[^.]+$/, "")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">{title}</div>
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
