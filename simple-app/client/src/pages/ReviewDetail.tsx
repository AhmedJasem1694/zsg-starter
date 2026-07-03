import { useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft, AlertTriangle, Clock, CheckCircle, Download, ChevronDown, ChevronUp,
  Mail, Copy, Loader2, GraduationCap, XCircle, BookOpen, Scale, Zap, Info,
  TrendingDown, Layers, CalendarClock, FileCheck, Users, BarChart2, ChevronRight,
  MessageSquare, Shield, Edit2, Flag, Upload, Brain, Dot,
} from "lucide-react";
import { getReview, saveFeedback, generateReply, generateAmendedClause, teachZane, markFalsePositive, captureOutcome, uploadFinalVersion, getOutcomeDeltas, overrideRagStatus, markFalsePositiveSignal, getSignalsSummary, getCompany, getContractCounterpartyProfile, getContractCounterpartyJudgment, getCrossReferences, relinkCrossReferences } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import ReasoningPrompt from "../components/ReasoningPrompt";
import type { ReviewResult, RagStatus, FeedbackAction, UploadedDocument, ConfidenceLabel, RegulatoryCitation, FeedbackResponse, SignificanceResult } from "../lib/types";
import { CLAUSE_LABELS } from "../lib/types";
import { resolveRegulationProminence, isCitationDirectlyRelevant, type RegulationProminence } from "../lib/regulationProminence";
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
        <div className="rounded-xl border border-[#FCEBEB] bg-[#FCEBEB] px-4 py-3 text-xs text-foreground/70">
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
  return "Review failed. Please retry or contact ahmed@zanelegal.ai if this persists.";
}

// ─── RAG styling ─────────────────────────────────────────────────────────────

const RAG_BADGE: Record<RagStatus, string> = {
  RED:   "rag-red",
  AMBER: "rag-amber",
  GREEN: "rag-green",
  GREY:  "rag-grey",
};

const RAG_DOT: Record<RagStatus, string> = {
  RED:   "bg-[#A32D2D]",
  AMBER: "bg-[#854F0B]",
  GREEN: "bg-[#1B7A4B]",
  GREY:  "bg-[#64748B]",
};

const RAG_LABEL: Record<RagStatus, string> = {
  RED:   "Red",
  AMBER: "Amber",
  GREEN: "Green",
  GREY:  "Missing",
};

const RAG_BORDER_LEFT: Record<RagStatus, string> = {
  RED:   "border-l-[#A32D2D]",
  AMBER: "border-l-[#854F0B]",
  GREEN: "border-l-[#1B7A4B]",
  GREY:  "border-l-[#64748B]",
};

// ─── Confidence badge config ──────────────────────────────────────────────────

const CONFIDENCE_CONFIG: Record<ConfidenceLabel, { label: string; classes: string }> = {
  HIGH:   { label: "High confidence",          classes: "bg-[#E7F6EE] border-[#E7F6EE] text-foreground" },
  MEDIUM: { label: "Medium confidence",        classes: "bg-[#FAEEDA] border-[#FAEEDA] text-foreground" },
  LOW:    { label: "Lawyer review required",   classes: "bg-[#FCEBEB] border-[#FCEBEB] text-foreground" },
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

  // Contextual regulation layer, prominence derived from company sector and
  // contract type, with the company-level override from Settings.
  const regProminence: RegulationProminence = resolveRegulationProminence(companyData, doc?.contractType);

  const { data: outcomeDeltaData } = useQuery({
    queryKey: ["outcome-deltas-check", id],
    queryFn:  () => getOutcomeDeltas(id!),
    enabled:  !isMock && !!id && !!doc && doc.status === "COMPLETE",
    staleTime: 60_000,
  });

  // Section 3c: vendor negotiation profile for this contract's counterparty.
  const { data: counterpartyProfileData } = useQuery({
    queryKey: ["counterparty-profile", id],
    queryFn:  () => getContractCounterpartyProfile(id!),
    enabled:  !isMock && !!id && !!doc && !!doc.counterpartyName,
    staleTime: 300_000,
  });
  const counterpartyProfile = counterpartyProfileData?.profile ?? null;

  // Reasoning capture, Section 4: judgment memory (prior unusual decisions + why)
  // for this contract's counterparty, surfaced advisorily at the top of the review.
  const { data: counterpartyJudgmentData } = useQuery({
    queryKey: ["counterparty-judgment", id],
    queryFn:  () => getContractCounterpartyJudgment(id!),
    enabled:  !isMock && !!id && !!doc && !!doc.counterpartyName,
    staleTime: 300_000,
  });
  const counterpartyJudgment = counterpartyJudgmentData?.judgment ?? null;

  // Cross-document reference checking: parent agreements this contract relies on.
  const { data: crossRefData } = useQuery({
    queryKey: ["cross-references", id],
    queryFn:  () => getCrossReferences(id!),
    enabled:  !isMock && !!id && !!doc,
    staleTime: 120_000,
  });
  const crossRef = crossRefData?.crossRef ?? null;
  const relinkMutation = useMutation({
    mutationFn: () => relinkCrossReferences(id!),
    onSuccess: (res) => queryClient.setQueryData(["cross-references", id], res),
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

  async function handleFeedback(resultId: string, action: FeedbackAction, finalClauseText?: string): Promise<FeedbackResponse | void> {
    if (isMock) return; // no-op in demo
    const res = await saveFeedback(resultId, { userAction: action, finalClauseText });
    await queryClient.invalidateQueries({ queryKey: ["review", id] });
    return res;
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
            <AlertTriangle size={24} className="text-[#A32D2D] mx-auto" />
            <div className="font-semibold text-[#A32D2D]">Document not found</div>
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
            <AlertTriangle size={28} className="text-[#A32D2D] mx-auto" />
            <div className="space-y-2">
              <div className="font-semibold text-[#A32D2D]">This review has been processing longer than expected</div>
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
              <a href="mailto:ahmed@zanelegal.ai" className="text-xs text-muted-foreground underline">
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
          <div className="card p-8 space-y-6 border-[#E2E8F0]" style={{ background: "#FFFFFF" }}>
            <div className="flex items-center gap-3">
              <Zap size={18} className="text-[#2563EB]" />
              <div>
                <div className="font-semibold text-[#2563EB]">Zane is reviewing this contract</div>
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
                      ${done    ? "bg-[#E7F6EE] border-[#BBE6CC]" : ""}
                      ${active  ? "bg-[#FAEEDA] border-[#854F0B] animate-pulse" : ""}
                      ${pending ? "bg-transparent border-[#E2E8F0]" : ""}`}>
                      {done && <CheckCircle size={10} className="text-[#1B7A4B]" />}
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-[#854F0B]" />}
                    </div>
                    <span className={`text-sm leading-none transition-all
                      ${done    ? "text-muted-foreground line-through" : ""}
                      ${active  ? "text-[#854F0B] font-medium" : ""}
                      ${pending ? "text-muted-foreground" : ""}`}>
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
          <div className="card border-[#FCEBEB] p-8 space-y-4" style={{ background: "#FCEBEB" }}>
            <AlertTriangle size={28} className="text-[#A32D2D] mx-auto" />
            <div className="text-center space-y-2">
              <div className="font-semibold text-[#A32D2D]">Review failed</div>
              <p className="text-sm text-[#A32D2D]/80 max-w-sm mx-auto">
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
              <a href="mailto:ahmed@zanelegal.ai" className="text-xs text-muted-foreground underline">
                Contact ahmed@zanelegal.ai
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
          <div className="flex items-center gap-3 rounded-xl border border-[#E6F1FB] bg-[#FFFFFF] px-4 py-3">
            <Loader2 size={14} className="text-[#2563EB] shrink-0 animate-spin" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-[#2563EB]">
                {doc.clausesTotal != null
                  ? `Analysing clauses: ${partialResults.length} of ${doc.clausesTotal} complete`
                  : "Analysing clauses…"}
              </span>
              {doc.clausesTotal != null && (
                <div className="mt-1.5 h-1 bg-[#E2E8F0] rounded-full overflow-hidden w-48">
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

        {/* ── Section 3c: known counterparty negotiation patterns ──────── */}
        {counterpartyProfile && (
          <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Known patterns · {counterpartyProfile.counterparty}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {counterpartyProfile.contracts} contract(s) · {counterpartyProfile.totalMoves} captured move(s)
              </span>
            </div>
            <ul className="space-y-0.5">
              {counterpartyProfile.summaryLines.map((line, i) => (
                <li key={i} className="text-xs text-foreground/80 leading-snug">• {line}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Section 4: Worth considering with this counterparty ──────────
            Advisory institutional memory: the unusual positions previously
            accepted with this counterparty and why. Raises what to consider,
            never prescribes. */}
        {counterpartyJudgment && counterpartyJudgment.considerations.length > 0 && (
          <div className="rounded-xl border border-[#DBEAFE]/50 bg-[#FFFFFF] px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <Brain size={14} className="text-[#2563EB] shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#2563EB]">
                Worth considering with {counterpartyJudgment.counterparty}
              </span>
            </div>
            <ul className="space-y-1">
              {counterpartyJudgment.considerations.map((line, i) => (
                <li key={i} className="text-xs text-foreground/80 leading-snug flex gap-1.5">
                  <span className="text-[#2563EB]/60 shrink-0">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Cross-document references: parent agreements relied upon ───── */}
        {crossRef && crossRef.references.length > 0 && (
          <div className="rounded-xl border border-[#F5D9AE] bg-[#FAEEDA] px-4 py-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-[#854F0B] shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[#854F0B]">
                  Relies on other agreements
                </span>
              </div>
              <button
                onClick={() => relinkMutation.mutate()}
                disabled={relinkMutation.isPending}
                className="shrink-0 text-[11px] px-2 py-1 rounded-md border border-[#F5D9AE] text-[#854F0B]/80 hover:text-[#854F0B] transition-colors disabled:opacity-50"
              >
                {relinkMutation.isPending ? "Checking…" : "Re-check library"}
              </button>
            </div>
            <div className="space-y-2.5">
              {crossRef.references.map((ref, i) => (
                <div key={i} className="text-xs space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{ref.parentName}</span>
                    {ref.date && <span className="text-muted-foreground">({ref.date})</span>}
                    {ref.found ? (
                      <Link to={`/app/legal/review/${ref.foundDocumentId}`} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-green-500/30 bg-green-500/10 text-green-400">
                        <CheckCircle size={10} /> In your library
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400">
                        <AlertTriangle size={10} /> Not on file
                      </span>
                    )}
                  </div>
                  {ref.clauseRefs.length > 0 && (
                    <div className="text-muted-foreground">Relies on: {ref.clauseRefs.join(", ")}</div>
                  )}
                  {ref.definedTerms.length > 0 && (
                    <div className="text-muted-foreground">Defined terms from it: {ref.definedTerms.slice(0, 8).join(", ")}</div>
                  )}
                  {!ref.found && (
                    <div className="text-[#854F0B]/70">
                      Upload this agreement to your library, then re-check so Zane can verify the clause references line up.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Urgency strip (RED only) ─────────────────────────────────── */}
        {counts.RED > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-[#FCEBEB] bg-[#FCEBEB] px-4 py-3">
            <AlertTriangle size={14} className="text-[#A32D2D] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-[#A32D2D]">
                {counts.RED} clause{counts.RED !== 1 ? "s" : ""} require immediate attention before signing.
              </span>
              <span className="text-xs text-[#A32D2D]/60 ml-2">
                {results.filter(r => r.ragStatus === "RED").map(r => CLAUSE_LABELS[r.clauseCategory] ?? r.clauseCategory).join(" · ")}
              </span>
            </div>
          </div>
        )}

        {/* ── Outcome capture banner ───────────────────────────────────── */}
        {!outcomeDismissed && !outcomeCaptured && (looksLikeSigned || doc?.outcome === undefined) && !isMock && (
          <div className="rounded-xl border border-[#E7F6EE] bg-[#E7F6EE] px-4 py-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileCheck size={14} className="text-[#1B7A4B] shrink-0" />
                <span className="text-sm font-semibold text-[#1B7A4B]">
                  {looksLikeSigned ? "Is this the final signed contract?" : "Mark this contract as signed"}
                </span>
              </div>
              <button onClick={() => setOutcomeDismissed(true)} className="text-[#1B7A4B]/40 hover:text-[#1B7A4B]/80 text-xs">✕</button>
            </div>
            {looksLikeSigned && (
              <p className="text-xs text-[#1B7A4B]/70">
                The filename suggests this may be an executed version. Marking it helps Zane track what was actually negotiated.
              </p>
            )}
            {showOutcomeNotes && (
              <textarea
                className="w-full rounded-lg border border-[#E7F6EE] bg-[#E7F6EE] px-3 py-2 text-xs text-[#1B7A4B] placeholder:text-[#1B7A4B]/30 focus:outline-none min-h-[64px] resize-y"
                placeholder="Optional: note what was negotiated or changed from the draft…"
                value={outcomeNotes}
                onChange={(e) => setOutcomeNotes(e.target.value)}
              />
            )}
            <div className="flex flex-wrap gap-2">
              <button
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#E7F6EE] text-foreground hover:bg-[#BBE6CC] transition-colors disabled:opacity-60"
                disabled={outcomeMutation.isPending}
                onClick={() => outcomeMutation.mutate("SIGNED")}
              >
                <CheckCircle size={11} /> Mark as signed
              </button>
              <button
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#E7F6EE] text-foreground hover:bg-[#BBE6CC] transition-colors disabled:opacity-60"
                disabled={outcomeMutation.isPending}
                onClick={() => outcomeMutation.mutate("EXECUTED")}
              >
                <CheckCircle size={11} /> Mark as executed
              </button>
              <button
                className="text-xs px-2 py-1.5 text-[#1B7A4B]/50 hover:text-[#1B7A4B]/80"
                onClick={() => setShowOutcomeNotes((v) => !v)}
              >
                {showOutcomeNotes ? "Hide notes" : "Add note"}
              </button>
            </div>
          </div>
        )}
        {outcomeCaptured && !isMock && (
          <div className="flex items-center gap-2 rounded-xl border border-[#E7F6EE] bg-[#E7F6EE] px-4 py-2.5">
            <CheckCircle size={13} className="text-[#1B7A4B] shrink-0" />
            <span className="text-xs text-[#1B7A4B]">
              Marked as {doc?.outcome?.toLowerCase() ?? "signed"} - outcome captured for negotiation intelligence.
            </span>
          </div>
        )}

        {/* ── Unconfirmed outcomes banner ────────────────────────────────── */}
        {hasUnconfirmedOutcomes && !isMock && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#1D4ED8] bg-[#FFFFFF] px-4 py-3">
            <div className="flex items-center gap-2">
              <Brain size={13} className="text-[#2563EB] shrink-0" />
              <span className="text-xs font-semibold text-[#2563EB]">
                Final version uploaded - confirm outcomes to update Zane's learning
              </span>
            </div>
            <Link
              to={`/app/legal/${id}/outcome`}
              className="text-xs text-[#2563EB] hover:text-[#2563EB] whitespace-nowrap font-medium"
            >
              Confirm now →
            </Link>
          </div>
        )}

        {/* ── Upload final version banner (not yet uploaded) ────────────── */}
        {!hasUnconfirmedOutcomes && !isMock && !outcomeDeltaData?.allConfirmed && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-2.5">
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
                className="text-xs text-[#2563EB] hover:text-[#2563EB] font-medium disabled:opacity-60 flex items-center gap-1"
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
              <div className="rounded-xl border border-[#FAEEDA] bg-[#FAEEDA] px-4 py-3 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-[#854F0B] shrink-0" />
                  <span className="text-xs font-semibold text-[#854F0B]">
                    {doc.contradictions.length} internal contradiction{doc.contradictions.length !== 1 ? "s" : ""} detected
                  </span>
                </div>
                <div className="space-y-2">
                  {doc.contradictions.map((c, i) => {
                    const finding = c as import("../lib/types").ContradictionFinding;
                    const sev = finding.severity ?? "LOW";
                    const severityColor = sev === "HIGH"
                      ? "text-foreground bg-[#FCEBEB] border-[#FCEBEB]"
                      : sev === "MEDIUM"
                      ? "text-foreground bg-[#FAEEDA] border-[#FAEEDA]"
                      : "text-foreground bg-[#FFFFFF] border-[#CBD5E1]";
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
                    ? "bg-[#E6F1FB] text-[#2563EB] border-[#2563EB]"
                    : "border-border text-muted-foreground hover:border-[#64748B] hover:text-foreground"
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
                      ? "bg-[#E6F1FB] text-[#2563EB] border-[#2563EB]"
                      : "border-border text-muted-foreground hover:border-[#64748B] hover:text-foreground"
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
                    ? "bg-[#E6F1FB] text-[#2563EB] border-[#2563EB]"
                    : "border-border text-muted-foreground hover:border-[#64748B] hover:text-foreground"
                }`}
              >
                Missing: Critical{" "}
                <span className="inline-flex items-center justify-center ml-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FCEBEB] border border-[#FCEBEB] text-foreground">
                  {counts.GREY_CRITICAL}
                </span>
              </button>

              {/* Missing: Optional (slate badge style) */}
              <button
                onClick={() => setFilter("GREY_OPTIONAL")}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filter === "GREY_OPTIONAL"
                    ? "bg-[#E6F1FB] text-[#2563EB] border-[#2563EB]"
                    : "border-border text-muted-foreground hover:border-[#64748B] hover:text-foreground"
                }`}
              >
                Missing: Optional{" "}
                <span className="inline-flex items-center justify-center ml-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FFFFFF] border border-[#CBD5E1] text-foreground">
                  {counts.GREY_OPTIONAL}
                </span>
              </button>

              {/* Immediate urgency filter */}
              {results.some(r => r.urgencyLevel === "IMMEDIATE") && (
                <button
                  onClick={() => setFilter("ALL")}
                  className="px-3 py-1 rounded-full text-xs font-medium border border-[#FCEBEB] bg-[#FCEBEB] text-foreground hover:bg-[#FCEBEB]"
                >
                  ⚡ {results.filter(r => r.urgencyLevel === "IMMEDIATE").length} Immediate
                </button>
              )}
            </div>

            {/* Clause cards */}
            <div className="space-y-2 card-enter-stagger">
              {results.length === 0 && doc.status === "COMPLETE" ? (
                <div className="card p-8 text-center space-y-2">
                  <AlertTriangle size={24} className="text-[#A32D2D] mx-auto" />
                  <div className="font-semibold text-[#A32D2D]">No clauses were analysed</div>
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
                        regulationProminence={regProminence}
                        companyIndustry={companyData?.industry}
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

            {/* LOW prominence: all regulatory content lives here, collapsed */}
            {regProminence === "LOW" && <RegulatoryReferencesAccordion results={results} />}
          </div>

          {/* Right - sticky sidebar */}
          <div className="space-y-4 lg:sticky lg:top-4 slide-in-left">
            <SignOffTracker doc={doc} results={results} />
            <IntelligenceSignals doc={doc} results={results} isMock={isMock} companyName={companyData?.name} />
            <RiskDistribution counts={counts} total={results.length} />
            {/* HIGH prominence: standalone regulatory summary panel */}
            {regProminence === "HIGH" && <RegulatorySummaryPanel results={results} />}
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
    RED:   { label: "High Risk",      bg: "bg-[#FCEBEB] border-[#FCEBEB]", text: "text-foreground" },
    AMBER: { label: "Moderate Risk",  bg: "bg-[#FAEEDA] border-[#FAEEDA]", text: "text-foreground" },
    GREEN: { label: "Low Risk",       bg: "bg-[#E7F6EE] border-[#E7F6EE]", text: "text-foreground" },
    GREY:  { label: "Pending",        bg: "bg-muted border-border",         text: "text-muted-foreground" },
  };
  const riskCfg = RISK_CONFIG[overallRag];

  const READINESS_CONFIG = {
    "not-ready": { label: "Do not sign yet",   color: "text-foreground", bg: "bg-[#FCEBEB] border-[#FCEBEB]" },
    "negotiate":  { label: "Negotiate first",   color: "text-foreground", bg: "bg-[#FAEEDA] border-[#FAEEDA]" },
    "review":     { label: "Review needed",     color: "text-foreground", bg: "bg-[#FAEEDA] border-[#FAEEDA]" },
    "ready":      { label: "Ready to sign",     color: "text-foreground", bg: "bg-[#E7F6EE] border-[#E7F6EE]" },
  };
  const readiness: "not-ready" | "negotiate" | "review" | "ready" =
    counts.RED >= 2 ? "not-ready" :
    counts.RED === 1 ? "negotiate" :
    counts.AMBER >= 2 ? "review" : "ready";
  const readinessCfg = READINESS_CONFIG[readiness];

  const date = formatDateShort(doc.uploadedAt);

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] px-6 py-5 space-y-4">
      {/* Top row: name + risk badge + actions */}
      <div className="flex items-start gap-4 justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold truncate">{doc.originalName}</h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-sm text-muted-foreground">
            {doc.counterpartyName && (
              <span className="font-medium text-foreground/80">{doc.counterpartyName}</span>
            )}
            {doc.counterpartyName && <span className="text-muted-foreground">·</span>}
            <span>{(doc.contractType ?? "").replace(/_/g, " ")}</span>
            <span className="text-muted-foreground">·</span>
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
        ? "border-[#FAEEDA] bg-[#FAEEDA] text-foreground"
        : "border-[#E2E8F0] bg-[#FFFFFF] text-muted-foreground"
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
        <Users size={13} className="text-muted-foreground shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Sign-off workflow
        </span>
      </div>
      <div className="space-y-2.5">
        {steps.map((step) => (
          <div key={step.label} className="flex items-start gap-2.5">
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all
              ${step.status === "done"     ? "bg-[#E7F6EE] border-[#BBE6CC]" : ""}
              ${step.status === "required" ? "bg-[#FAEEDA] border-[#854F0B]" : ""}
              ${step.status === "skipped"  ? "bg-transparent border-[#E2E8F0]" : ""}`}
            >
              {step.status === "done"     && <CheckCircle size={9} className="text-[#1B7A4B]" />}
              {step.status === "required" && <span className="w-1.5 h-1.5 rounded-full bg-[#854F0B]" />}
            </div>
            <div className="min-w-0">
              <div className={`text-xs font-medium leading-none
                ${step.status === "done"     ? "text-[#1B7A4B]" : ""}
                ${step.status === "required" ? "text-[#854F0B]" : ""}
                ${step.status === "skipped"  ? "text-muted-foreground/35" : ""}`}
              >
                {step.label}
              </div>
              {step.detail && (
                <div className={`text-[10px] mt-1 leading-tight
                  ${step.status === "done"     ? "text-muted-foreground" : ""}
                  ${step.status === "required" ? "text-[#854F0B]/55" : ""}
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
        <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">
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
      color: "#A32D2D",
      bgColor: "#FCEBEB",
      borderColor: "#FCEBEB",
      text: isMock
        ? `${redResults.length} clauses flagged RED across all prior Acme Corp reviews - consistent counterparty negotiation posture.`
        : `These ${redResults.length} clause${redResults.length !== 1 ? "s" : ""} exceed ${co}'s accepted risk thresholds and trigger mandatory ${approverRole} approval before this contract can proceed.`,
    });
  }

  // Renewal signal
  if (renewalDaysUntil !== null && renewalDaysUntil <= 90) {
    signals.push({
      icon: CalendarClock,
      color: "#854F0B",
      bgColor: "#FAEEDA",
      borderColor: "#FAEEDA",
      text: `Auto-renewal notice window closes in ${renewalDaysUntil} days. ${
        doc.contractValue ? `Failure to act locks £${doc.contractValue.toLocaleString("en-GB")} for another year.` : ""
      }`,
    });
  }

  // Memory / pattern signal
  if (isMock) {
    signals.push({
      icon: Layers,
      color: "#185FA5",
      bgColor: "#FFFFFF",
      borderColor: "#C7D2FE",
      text: "Zane has processed 2 prior agreements with this counterparty. Liability cap position unchanged across all 3 reviews - systemic pattern flagged.",
    });
  } else if (results.length > 0) {
    const absentCount = results.filter((r) => r.isAbsent).length;
    if (absentCount > 0) {
      signals.push({
        icon: Layers,
        color: "#185FA5",
        bgColor: "#FFFFFF",
        borderColor: "#C7D2FE",
        text: `${absentCount} clause${absentCount !== 1 ? "s" : ""} absent from this contract. Your playbook requires ${absentCount !== 1 ? "them" : "it"} to be present - request insertion before signing.`,
      });
    }
  }

  if (signals.length === 0) return null;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Layers size={13} className="text-muted-foreground shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
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
    HIGH:   { classes: "bg-[#FCEBEB] border-[#FCEBEB] text-foreground", label: "High" },
    MEDIUM: { classes: "bg-[#FAEEDA] border-[#FAEEDA] text-foreground", label: "Medium" },
    LOW:    { classes: "bg-[#FFFFFF] border-[#CBD5E1] text-foreground", label: "Low" },
  };

  return (
    <div className="rounded-xl border border-[#E6F1FB] bg-[#FFFFFF] overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#FFFFFF] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <Scale size={13} className="text-[#2563EB] shrink-0" />
          <span className="text-sm font-semibold text-[#2563EB]">Document Audit</span>
          <span className="text-[10px] bg-[#1D4ED8]/30 text-[#2563EB] border border-[#1D4ED8]/40 rounded-full px-2 py-0.5 font-semibold">
            {allFindings.length} finding{allFindings.length !== 1 ? "s" : ""}
          </span>
          {audit.highSeverityCount > 0 && (
            <span className="text-[10px] bg-[#FCEBEB] text-foreground border border-[#FCEBEB] rounded-full px-2 py-0.5 font-semibold">
              {audit.highSeverityCount} high
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>Passes 2 to 5: defined terms · cross-refs · numbers · consistency</span>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-[#E2E8F0] px-4 py-4 space-y-4">
          {[
            { key: "definedTerms",        findings: audit.definedTerms ?? [] },
            { key: "crossReferences",     findings: audit.crossReferences ?? [] },
            { key: "numbersDates",        findings: audit.numbersDates ?? [] },
            { key: "internalConsistency", findings: audit.internalConsistency ?? [] },
          ].filter(g => g.findings.length > 0).map(({ key, findings }) => (
            <div key={key} className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
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
    { label: "Red",               count: counts.RED,           color: "#A32D2D", bg: "bg-[#A32D2D]" },
    { label: "Amber",             count: counts.AMBER,         color: "#854F0B", bg: "bg-[#854F0B]" },
    { label: "Green",             count: counts.GREEN,         color: "#1B7A4B", bg: "bg-[#1B7A4B]" },
    { label: "Missing (critical)", count: counts.GREY_CRITICAL, color: "#A32D2D", bg: "bg-[#A32D2D]/60" },
    { label: "Missing (optional)", count: counts.GREY_OPTIONAL, color: "#64748B", bg: "bg-[#64748B]" },
  ].filter((b) => b.count > 0);

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart2 size={13} className="text-muted-foreground shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Risk distribution
        </span>
      </div>
      <div className="space-y-2">
        {bars.map((bar) => (
          <div key={bar.label} className="flex items-center gap-2.5">
            <div className="w-14 text-[11px] text-muted-foreground shrink-0">{bar.label}</div>
            <div className="flex-1 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
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
      <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">
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
      <div className={`w-1.5 h-1.5 rounded-full ${hasSignals ? "bg-[#2563EB]" : "bg-[#CBD5E1]"}`} />
      <span className="text-[10px] text-muted-foreground group-hover:text-foreground/60 transition-colors">
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
    { value: "RED",   label: "Red",   color: "#A32D2D", bg: "#FCEBEB", border: "#FCEBEB" },
    { value: "AMBER", label: "Amber", color: "#854F0B", bg: "#FAEEDA", border: "#FAEEDA" },
    { value: "GREEN", label: "Green", color: "#1B7A4B", bg: "#E7F6EE", border: "#E7F6EE" },
  ];

  return (
    <div className="rounded-xl border border-[#1D4ED8] bg-[#FFFFFF] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Edit2 size={12} className="text-[#2563EB]" />
          <span className="text-xs font-semibold text-[#2563EB]">Override RAG status</span>
        </div>
        <button onClick={onClose} className="text-[#2563EB]/40 hover:text-[#2563EB] text-xs">✕</button>
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
              borderColor: correctedStatus === s.value ? s.border : "#E2E8F0",
              color: correctedStatus === s.value ? s.color : "#64748B",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Reason chips */}
      <div>
        <div className="text-[10px] text-muted-foreground mb-1.5">Reason (required)</div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {OVERRIDE_REASON_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setReason(chip)}
              className="text-[11px] px-2.5 py-1 rounded-md border transition-colors"
              style={{
                borderColor: reason === chip ? "#2563EB" : "#E2E8F0",
                background: reason === chip ? "#1D4ED8" : "transparent",
                color: reason === chip ? "#fff" : "#64748B",
              }}
            >
              {chip}
            </button>
          ))}
        </div>
        <input
          className="w-full rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#2563EB]"
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
    <div className="rounded-xl border border-[#FAEEDA] bg-[#FAEEDA] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag size={12} className="text-[#854F0B]" />
          <span className="text-xs font-semibold text-[#854F0B]">Mark as false positive</span>
        </div>
        <button onClick={onClose} className="text-[#854F0B]/40 hover:text-[#854F0B] text-xs">✕</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {FP_ERROR_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setErrorType(t.value)}
            className="text-left p-3 rounded-lg border transition-all"
            style={{
              borderColor: errorType === t.value ? "#FAEEDA" : "#E2E8F0",
              background: errorType === t.value ? "#FAEEDA" : "transparent",
            }}
          >
            <div className={`text-[11px] font-semibold ${errorType === t.value ? "text-[#854F0B]" : "text-muted-foreground"}`}>
              {t.label}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</div>
          </button>
        ))}
      </div>

      <textarea
        className="w-full rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[60px] resize-y"
        placeholder="Optional: what is the correct interpretation?"
        value={correctInterpretation}
        onChange={(e) => setCorrectInterpretation(e.target.value)}
      />

      <button
        className="w-full text-xs py-2 rounded-lg bg-[#FAEEDA] text-foreground font-semibold disabled:opacity-50 transition-colors hover:bg-[#FCEBEB]"
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
  regulationProminence,
  companyIndustry,
}: {
  result: ReviewResult;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onFeedback: (action: FeedbackAction, finalClauseText?: string) => Promise<FeedbackResponse | void>;
  isMock: boolean;
  regulationProminence: RegulationProminence;
  companyIndustry?: string;
}) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState<FeedbackAction | null>(null);
  const [generatedReply, setGeneratedReply] = useState<string | null>(null);
  const [copiedReply, setCopiedReply] = useState(false);
  // Redrafted clause: the clean, playbook-aligned drop-in wording, distinct from
  // the negotiation message. Reuses the existing amended-clause generation.
  const [redraft, setRedraft] = useState<{ revised: string; explanation: string } | null>(null);
  const [copiedRedraft, setCopiedRedraft] = useState(false);
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
  // Reasoning capture (Section 2): inline prompt shown only when the decision the
  // lawyer just made is flagged significant. Never blocks; dismissing keeps the
  // decision captured without reasoning.
  const [reasoningPrompt, setReasoningPrompt] = useState<{ decisionEventId: string; significance: SignificanceResult } | null>(null);

  const feedback = result.feedback;
  const label = CLAUSE_LABELS[result.clauseCategory] ?? result.clauseCategory;

  const replyMutation = useMutation({
    mutationFn: () => generateReply(result.id, "professional"),
    onSuccess: (data) => setGeneratedReply(data.reply),
  });

  const redraftMutation = useMutation({
    mutationFn: () => generateAmendedClause(result.id),
    onSuccess: (data) => setRedraft({ revised: data.revised, explanation: data.explanation }),
  });

  function copyRedraft() {
    if (!redraft) return;
    void navigator.clipboard.writeText(redraft.revised).then(() => {
      setCopiedRedraft(true);
      setTimeout(() => setCopiedRedraft(false), 2000);
    });
  }

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
    try {
      const res = await onFeedback(action, finalClauseText);
      // Prompt for reasoning only when this decision was flagged significant.
      if (res && res.significance?.significant && res.decisionEventId) {
        setReasoningPrompt({ decisionEventId: res.decisionEventId, significance: res.significance });
      }
    } finally { setSubmitting(null); }
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
      className={`overflow-hidden rounded-xl border border-[#E2E8F0] border-l-[3px] ${RAG_BORDER_LEFT[result.ragStatus]} bg-card transition-all duration-200 ${expanded ? "shadow-lg shadow-black/20" : ""}`}
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
              <span className="text-[11px] bg-[#FFFFFF] text-foreground border border-[#CBD5E1] rounded px-1.5 py-0.5">
                Absent
              </span>
            )}
            {result.escalationRequired && (
              <span className="text-[11px] bg-[#FCEBEB] text-foreground border border-[#FCEBEB] rounded px-1.5 py-0.5 flex items-center gap-1">
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
            <div className="text-xs text-muted-foreground mt-1 line-clamp-1 leading-relaxed">
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
                ? "bg-[#FCEBEB] text-foreground border-[#FCEBEB]"
                : "bg-[#FAEEDA] text-foreground border-[#FAEEDA]"
            }`}>
              {result.urgencyLevel === "IMMEDIATE" ? "⚡ Immediate" : "Material"}
            </span>
          )}
          {/* Error category badge */}
          {result.errorCategory && result.errorCategory !== "SUBSTANTIVE_RISK" && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-[#FFFFFF] text-foreground border-[#CBD5E1]">
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
          <span className="text-muted-foreground text-xs">{expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
        </div>
      </button>

      {/* ── Expanded detail ───────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-[#E2E8F0] px-5 py-5 space-y-4 bg-[#FFFFFF]">

          {/* Absent clause notice */}
          {result.isAbsent && (
            <div className="flex items-start gap-2 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-2">
              <Info size={12} className="text-[#64748B] shrink-0 mt-0.5" />
              <span className="text-xs text-[#64748B]">
                This clause was not identified in the contract. Review whether your playbook requires it to be present.
              </span>
            </div>
          )}

          {/* Four-box layout, only render if there is analysis to show */}
          {(result.ragStatus !== "GREY" || result.clauseSummary || result.recommendedAction) && (
          <div className="grid sm:grid-cols-2 gap-3">
            {/* Issue */}
            <div className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-3 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB]/70">Issue</div>
              <p className="text-sm leading-snug font-medium">
                {result.iracIssue || result.recommendedAction || result.clauseSummary || "No analysis available for this clause."}
              </p>
            </div>

            {/* Why it matters */}
            <div className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-3 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#6D28D9]/70">Why it matters</div>
              <p className="text-sm leading-snug text-foreground/80">
                {result.whyItMatters || result.businessSummary}
              </p>
            </div>

            {/* Fallback */}
            <div className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-3 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#1B7A4B]/70">Fallback</div>
              {result.suggestedFallback ? (
                <div className="space-y-2">
                  <p className="text-xs leading-relaxed text-foreground/80 font-mono whitespace-pre-line">
                    {result.suggestedFallback}
                  </p>
                  <FallbackCopyButton text={result.suggestedFallback} />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No fallback wording available for this clause.</p>
              )}
            </div>

            {/* Escalation */}
            <div className={`rounded-lg border px-4 py-3 space-y-1.5 ${
              result.escalationRequired
                ? "border-[#FCEBEB] bg-[#FCEBEB]"
                : "border-[#E2E8F0] bg-[#FFFFFF]"
            }`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${result.escalationRequired ? "text-foreground/60" : "text-muted-foreground"}`}>
                Escalation
              </div>
              {result.escalationRequired ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <AlertTriangle size={11} className="shrink-0" />
                    Sign-off required
                  </div>
                  {result.escalationTrigger && (
                    <p className="text-xs text-foreground/70 leading-relaxed">{result.escalationTrigger}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle size={11} className="shrink-0" />
                  No escalation required
                </div>
              )}
            </div>
          </div>
          )} {/* end four-box conditional */}

          {/* Confidence */}
          {result.confidenceLabel && CONFIDENCE_CONFIG[result.confidenceLabel] && (
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
              <div className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-3 text-xs leading-relaxed text-[#64748B] font-mono whitespace-pre-line">
                {result.comparisonStatement}
              </div>
            </Detail>
          )}

          {/* Regulatory citations, contextual prominence:
              HIGH = all citations inline; MEDIUM = only directly relevant ones;
              LOW = none here (collapsed into page-level accordion) */}
          {regulationProminence !== "LOW" && result.regulatoryCitations && result.regulatoryCitations.length > 0 && (() => {
            const visibleCitations = regulationProminence === "HIGH"
              ? result.regulatoryCitations
              : result.regulatoryCitations.filter((c: RegulatoryCitation) =>
                  isCitationDirectlyRelevant(c, result.clauseCategory, companyIndustry));
            if (visibleCitations.length === 0) return null;
            return (
              <Detail title="Regulatory references">
                <div className="space-y-2">
                  {visibleCitations.map((c: RegulatoryCitation, i: number) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-2">
                      <BookOpen size={11} className="text-[#185FA5] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#185FA5]">{c.regulation} - {c.article}</div>
                        <div className="text-[11px] text-[#185FA5]/70 mt-0.5">{c.relevance}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Detail>
            );
          })()}

          {/* Two distinct outputs for a Red/Amber clause: the message to send the
              other side, and the clean redrafted clause to drop into the contract. */}
          {!isMock && (result.ragStatus === "RED" || result.ragStatus === "AMBER") && (
            <div className="space-y-4">

              {/* ── Output 1: Message to counterparty ──────────────────────── */}
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB]/70">Message to counterparty</div>
                {!generatedReply ? (
                  <button
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                    onClick={() => replyMutation.mutate()}
                    disabled={replyMutation.isPending}
                  >
                    {replyMutation.isPending ? (
                      <><Loader2 size={11} className="animate-spin" /> Drafting message…</>
                    ) : (
                      <><MessageSquare size={11} /> Draft message to counterparty</>
                    )}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap rounded-lg border border-card-border bg-card px-4 py-3">
                      {generatedReply}
                    </p>
                    <div className="flex gap-2">
                      <button className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1" onClick={copyReply}>
                        <Copy size={11} />{copiedReply ? "Copied!" : "Copy message"}
                      </button>
                      <button className="btn-ghost text-xs px-3 py-1.5 text-muted-foreground" onClick={() => setGeneratedReply(null)}>
                        Regenerate
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Output 2: Redrafted clause (clean drop-in) ─────────────── */}
              {result.suggestedFallback && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#1B7A4B]/70">Redrafted clause</div>
                  {!redraft ? (
                    <button
                      className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                      onClick={() => redraftMutation.mutate()}
                      disabled={redraftMutation.isPending}
                    >
                      {redraftMutation.isPending ? (
                        <><Loader2 size={11} className="animate-spin" /> Redrafting clause…</>
                      ) : (
                        <><FileCheck size={11} /> Generate redrafted clause</>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs leading-relaxed whitespace-pre-wrap rounded-lg border border-[#E7F6EE] bg-[#E7F6EE] px-4 py-3 font-mono text-foreground/90">
                        {redraft.revised}
                      </p>
                      {redraft.explanation && (
                        <p className="text-[11px] text-muted-foreground italic">{redraft.explanation}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        A playbook-aligned clause you can paste straight into the contract. Any [TO CONFIRM] marker is a commercial decision for you to set.
                      </p>
                      <div className="flex gap-2">
                        <button className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1" onClick={copyRedraft}>
                          <Copy size={11} />{copiedRedraft ? "Copied!" : "Copy clause"}
                        </button>
                        <button className="btn-ghost text-xs px-3 py-1.5 text-muted-foreground" onClick={() => setRedraft(null)}>
                          Regenerate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Section 18: Override + FP signal capture ─────────────── */}
          {!isMock && !showOverridePanel && !showFpSignalPanel && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {!overrideDone ? (
                <button
                  onClick={() => { setShowOverridePanel(true); setShowFpSignalPanel(false); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[#E2E8F0] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
                >
                  <Edit2 size={11} /> Override status
                </button>
              ) : (
                <span className="text-xs text-[#2563EB] flex items-center gap-1"><CheckCircle size={11} /> Status overridden</span>
              )}
              {!fpSignalDone ? (
                <button
                  onClick={() => { setShowFpSignalPanel(true); setShowOverridePanel(false); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[#E2E8F0] hover:border-[#FAEEDA] hover:text-[#854F0B] transition-colors"
                >
                  <Flag size={11} /> Flag as false positive
                </button>
              ) : (
                <span className="text-xs text-[#854F0B] flex items-center gap-1"><CheckCircle size={11} /> False positive flagged</span>
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
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#E2E8F0]">
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
                    : "border-border hover:border-[#64748B]"
                }`}
              >
                {submitting === action ? "…" : <>{icon} {btnLabel}</>}
              </button>
            ))}
            {isMock && (
              <span className="text-[10px] text-muted-foreground">Demo - outcomes disabled</span>
            )}
          </div>

          {/* Reasoning capture prompt: only on a significant decision (Section 2) */}
          {reasoningPrompt && (
            <ReasoningPrompt
              significance={reasoningPrompt.significance}
              decisionEventId={reasoningPrompt.decisionEventId}
              onClose={() => setReasoningPrompt(null)}
            />
          )}

          {/* Accept + capture clause text */}
          {showWhatAgreed && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }}>
              <div className="w-full max-w-md rounded-2xl border border-[#E7F6EE] bg-[#E7F6EE] shadow-2xl p-6 space-y-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-foreground" />
                    <span className="text-sm font-semibold text-foreground">Capture signed outcome</span>
                  </div>
                  <div className="text-xs text-foreground/60 leading-relaxed">
                    Record the final agreed wording for <span className="font-medium">{label}</span>. This trains Zane on your actual negotiation outcomes.
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Final agreed clause text (optional)
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-[#E7F6EE] bg-[#E7F6EE] px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#BBE6CC] min-h-[96px] resize-y font-mono"
                    placeholder="Paste the final clause text as executed…"
                    value={agreedText}
                    onChange={(e) => setAgreedText(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    className="w-full px-4 py-2.5 bg-[#E7F6EE] hover:bg-[#BBE6CC] text-foreground text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                    onClick={() => { void handle("ACCEPTED", agreedText || undefined); setShowWhatAgreed(false); }}
                  >
                    <CheckCircle size={14} /> Save & mark accepted
                  </button>
                  <button
                    className="w-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground/80 transition-colors"
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
            <div className="pt-2 border-t border-[#E2E8F0] space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Improve this analysis:</span>
                <button
                  onClick={() => setShowTeachZane(!showTeachZane)}
                  disabled={teachDone}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
                    teachDone ? "bg-[#E7F6EE] border-[#E7F6EE] text-foreground" : "border-border hover:border-[#64748B]"
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
                      fpDone ? "bg-[#FCEBEB] border-[#FCEBEB] text-foreground" : "border-border hover:border-[#64748B]"
                    }`}
                  >
                    <XCircle size={11} />
                    {fpDone ? "Marked false positive" : fpSubmitting ? "…" : "False positive"}
                  </button>
                )}
              </div>

              {showTeachZane && (
                <div className="rounded-lg border border-[#E6F1FB] bg-[#0B1020] p-4 space-y-3">
                  <div className="text-xs font-semibold text-[#2563EB]">Correct this analysis</div>
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
    <div className="card overflow-hidden border border-[#FCEBEB]">
      <div className="bg-[#FCEBEB] px-5 py-3 flex items-center gap-3 border-b border-[#FCEBEB]">
        <AlertTriangle size={14} className="text-foreground shrink-0" />
        <span className="text-sm font-semibold text-foreground flex-1">
          Escalation required - {tiersActive} tier{tiersActive !== 1 ? "s" : ""} triggered
        </span>
      </div>
      <div className="p-4 space-y-3">
        {tier1Clauses.length > 0 && (
          <div className="rounded-lg bg-[#FCEBEB] border border-[#FCEBEB] p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-foreground">Tier 1 - Clause Risk</div>
            <ul className="space-y-1.5">
              {tier1Clauses.map((r) => (
                <li key={r.id} className="flex gap-2 text-sm text-foreground">
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
          <div className="rounded-lg bg-[#FAEEDA] border border-[#FAEEDA] p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#854F0B]">Tier 2 - Contract Value</div>
            <div className="text-sm text-[#854F0B]">
              <span className="font-semibold">£{doc.contractValue!.toLocaleString("en-GB")}</span> - {valueTier.label}
            </div>
          </div>
        )}
        {govTriggers.length > 0 && (
          <div className="rounded-lg bg-[#EEF2FF] border border-[#C7D2FE] p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#185FA5]">Tier 3 - Governance</div>
            <ul className="space-y-1.5">
              {govTriggers.map((t, i) => (
                <li key={i} className="flex gap-2 text-sm text-[#185FA5]">
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
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:border-[#64748B] transition-colors"
    >
      <Copy size={11} />
      {copied ? "Copied!" : "Copy fallback language"}
    </button>
  );
}

// ─── Contextual regulation layer components ───────────────────────────────────

/** HIGH prominence: standalone summary of every regulation cited in this review. */
function RegulatorySummaryPanel({ results }: { results: ReviewResult[] }) {
  const counts = new Map<string, number>();
  for (const r of results) {
    for (const c of r.regulatoryCitations ?? []) {
      if (c.regulation) counts.set(c.regulation, (counts.get(c.regulation) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Shield size={11} />
        Regulatory summary
      </div>
      <div className="space-y-1.5">
        {Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([regulation, n]) => (
          <div key={regulation} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-foreground/80 truncate">{regulation}</span>
            <span className="text-muted-foreground shrink-0">{n} clause{n !== 1 ? "s" : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** LOW prominence: all regulatory content collapsed into one closed accordion. */
function RegulatoryReferencesAccordion({ results }: { results: ReviewResult[] }) {
  const [open, setOpen] = useState(false);
  const items = results.flatMap((r) =>
    (r.regulatoryCitations ?? []).map((c) => ({ citation: c, clauseCategory: r.clauseCategory }))
  );
  if (items.length === 0) return null;
  return (
    <div className="card overflow-hidden mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-2">
          <BookOpen size={13} />
          Regulatory references ({items.length})
        </span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-card-border px-4 py-3 space-y-3">
          {items.map(({ citation, clauseCategory }, i) => (
            <div key={i} className="flex items-start gap-2.5 text-xs">
              <BookOpen size={11} className="text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="font-semibold text-foreground/80">{citation.regulation} - {citation.article}</span>
                <span className="text-muted-foreground"> · {CLAUSE_LABELS[clauseCategory] ?? clauseCategory}</span>
                <div className="text-muted-foreground/80 mt-0.5 leading-relaxed">{citation.relevance}</div>
              </div>
            </div>
          ))}
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
