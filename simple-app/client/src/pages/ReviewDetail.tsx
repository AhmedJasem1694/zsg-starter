import { useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft, AlertTriangle, Clock, CheckCircle, Download, ChevronDown, ChevronUp,
  Mail, Copy, Loader2, GraduationCap, XCircle, BookOpen, Scale, Zap, Info,
  TrendingDown, Layers, CalendarClock, FileCheck, Users, BarChart2, ChevronRight,
  MessageSquare, Shield, Edit2, Flag, Upload, Brain, Dot,
} from "lucide-react";
import { getReview, saveFeedback, generateReply, teachZane, markFalsePositive, captureOutcome, uploadFinalVersion, getOutcomeDeltas, overrideRagStatus, markFalsePositiveSignal, getSignalsSummary } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import type { ReviewResult, RagStatus, FeedbackAction, UploadedDocument, ConfidenceLabel, RegulatoryCitation } from "../lib/types";
import { CLAUSE_LABELS } from "../lib/types";
import { MOCK_REVIEW_DETAIL } from "../lib/mockData";

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
  const [filter, setFilter] = useState<RagStatus | "ALL">("ALL");
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
      return d?.status && ACTIVE_STATUSES.includes(d.status) ? 3000 : false;
    },
  });

  const doc: UploadedDocument | undefined = isMock ? MOCK_REVIEW_DETAIL : realDoc;
  const loading = isMock ? false : isLoading;

  async function handleFeedback(resultId: string, action: FeedbackAction, finalClauseText?: string) {
    if (isMock) return; // no-op in demo
    await saveFeedback(resultId, { userAction: action, finalClauseText });
    await queryClient.invalidateQueries({ queryKey: ["review", id] });
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
        <div className="px-6 py-8 max-w-6xl mx-auto">
          <BackButton onClick={() => navigate("/app/legal/dashboard")} />
          <div className="text-sm text-destructive mt-8">Document not found.</div>
        </div>
      </AppLayout>
    );
  }

  // ── Processing state ──────────────────────────────────────────────────────

  if (ACTIVE_STATUSES.includes(doc.status)) {
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
              {DETAIL_STAGES.map((stage, i) => {
                const done    = i < stageIdx;
                const active  = i === stageIdx;
                const pending = i > stageIdx;
                return (
                  <div key={stage.label} className="flex items-center gap-3">
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
        <div className="px-6 py-8 max-w-6xl mx-auto space-y-4">
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

  // ── Complete state ────────────────────────────────────────────────────────

  function handleExport() {
    if (doc) exportReviewAsText(doc);
  }

  // Upload final version state
  const finalFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFinal, setUploadingFinal] = useState(false);

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

  // Check for unconfirmed outcome deltas
  const { data: outcomeDeltaData } = useQuery({
    queryKey: ["outcome-deltas-check", id],
    queryFn: () => getOutcomeDeltas(id!),
    enabled: !isMock && !!id,
    staleTime: 60_000,
  });
  const hasUnconfirmedOutcomes = outcomeDeltaData?.hasUnconfirmed ?? false;

  // Outcome capture state
  const [outcomeDismissed, setOutcomeDismissed] = useState(false);
  const [outcomeCaptured, setOutcomeCaptured] = useState(!!doc?.outcome);
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [showOutcomeNotes, setShowOutcomeNotes] = useState(false);

  const outcomeMutation = useMutation({
    mutationFn: (outcome: "SIGNED" | "EXECUTED") =>
      captureOutcome(doc!.id, outcome, outcomeNotes),
    onSuccess: () => {
      setOutcomeCaptured(true);
      void queryClient.invalidateQueries({ queryKey: ["review", id] });
    },
  });

  // Auto-detect "final signed" from filename
  const looksLikeSigned = !isMock && doc?.originalName
    ? /\b(signed|executed|final|countersigned|esigned|e-signed)\b/i.test(doc.originalName)
    : false;

  const results = doc.reviewResults ?? [];
  const counts = {
    RED:   results.filter((r) => r.ragStatus === "RED").length,
    AMBER: results.filter((r) => r.ragStatus === "AMBER").length,
    GREEN: results.filter((r) => r.ragStatus === "GREEN").length,
    GREY:  results.filter((r) => r.ragStatus === "GREY").length,
  };
  const overallRag: RagStatus = counts.RED > 0 ? "RED" : counts.AMBER > 0 ? "AMBER" : "GREEN";
  const filtered = filter === "ALL" ? results : results.filter((r) => r.ragStatus === filter);

  const renewalDaysUntil = doc.renewalDate
    ? Math.ceil((new Date(doc.renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <AppLayout>
      <div className="px-6 py-6 max-w-6xl mx-auto space-y-5">

        {/* Back */}
        <BackButton onClick={() => navigate("/app/legal/dashboard")} />

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
                    const severityColor = finding.severity === "HIGH"
                      ? "text-[#FCA5A5] bg-[#1F0A0A] border-[#450A0A]"
                      : finding.severity === "MEDIUM"
                      ? "text-[#FCD34D] bg-[#1C0F00] border-[#431407]"
                      : "text-[#94A3B8] bg-[#0F172A] border-[#334155]";
                    return (
                      <div key={i} className={`rounded-lg border px-3 py-2 space-y-1 ${severityColor}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${severityColor}`}>
                            {finding.severity}
                          </span>
                          <span className="text-xs font-semibold">{finding.title}</span>
                        </div>
                        <p className="text-xs opacity-80">{finding.explanation}</p>
                        <p className="text-xs font-medium opacity-90 pt-0.5">→ {finding.recommendation}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filter pills */}
            <div className="flex flex-wrap gap-2">
              {(["ALL", "RED", "AMBER", "GREEN", "GREY"] as const).map((f) => {
                const count = f === "ALL" ? results.length : counts[f as RagStatus];
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      filter === f
                        ? "bg-[#1E3A5F] text-[#93C5FD] border-[#2563EB]"
                        : "border-border text-muted-foreground hover:border-[#475569] hover:text-foreground"
                    }`}
                  >
                    {f === "ALL" ? `All (${count})` : `${RAG_LABEL[f as RagStatus]} (${count})`}
                  </button>
                );
              })}
            </div>

            {/* Clause cards */}
            <div className="space-y-2 card-enter-stagger">
              {filtered.map((result, i) => (
                <ClauseCard
                  key={result.id}
                  result={result}
                  index={i}
                  expanded={expandedId === result.id}
                  onToggle={() => setExpandedId(expandedId === result.id ? null : result.id)}
                  onFeedback={(action, finalClauseText) => handleFeedback(result.id, action, finalClauseText)}
                  isMock={isMock}
                />
              ))}
              {filtered.length === 0 && (
                <div className="text-sm text-muted-foreground py-10 text-center">
                  No clauses in this category.
                </div>
              )}
            </div>
          </div>

          {/* Right - sticky sidebar */}
          <div className="space-y-4 lg:sticky lg:top-4 slide-in-left">
            <SignOffTracker doc={doc} results={results} />
            <IntelligenceSignals doc={doc} results={results} isMock={isMock} />
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
  counts: Record<RagStatus, number>;
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

  const date = new Date(doc.uploadedAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

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
            <span>{doc.contractType.replace(/_/g, " ")}</span>
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
}: {
  doc: UploadedDocument;
  results: ReviewResult[];
  isMock: boolean;
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

  // Pattern signal from red clauses
  if (redResults.length > 0) {
    const cats = redResults.map((r) => CLAUSE_LABELS[r.clauseCategory] ?? r.clauseCategory).join(" and ");
    signals.push({
      icon: TrendingDown,
      color: "#FCA5A5",
      bgColor: "#1A0404",
      borderColor: "#450A0A",
      text: isMock
        ? `${cats} flagged RED across all prior Acme Corp reviews - consistent counterparty negotiation posture.`
        : `${cats} flagged as high risk in this agreement.`,
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

// ─── Risk Distribution ────────────────────────────────────────────────────────

function RiskDistribution({ counts, total }: { counts: Record<RagStatus, number>; total: number }) {
  if (total === 0) return null;

  const bars: Array<{ label: string; count: number; color: string; bg: string }> = [
    { label: "Red",     count: counts.RED,   color: "#FCA5A5", bg: "bg-[#FCA5A5]" },
    { label: "Amber",   count: counts.AMBER, color: "#FCD34D", bg: "bg-[#FCD34D]" },
    { label: "Green",   count: counts.GREEN, color: "#86EFAC", bg: "bg-[#86EFAC]" },
    { label: "Missing", count: counts.GREY,  color: "#475569", bg: "bg-[#475569]" },
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
          {/* Business summary - always visible */}
          <div className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
            {result.businessSummary || result.clauseSummary}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          {!isMock && <LearningIndicator clauseCategory={result.clauseCategory} />}
          <span className={RAG_BADGE[result.ragStatus]}>{RAG_LABEL[result.ragStatus]}</span>
          <span className="text-muted-foreground/50 text-xs">{expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
        </div>
      </button>

      {/* ── Expanded detail ───────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-[#1E293B] px-5 py-5 space-y-5 bg-[#080F18]">

          {/* Decision summary */}
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
  const counts  = {
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
    `Counterparty: ${doc.counterpartyName ?? "-"}`,
    `Type:        ${doc.contractType.replace(/_/g, " ")}`,
    `Reviewed:    ${date}`,
    `Overall RAG: ${overallRag}`,
    doc.contractValue ? `Value:       £${doc.contractValue.toLocaleString("en-GB")}` : "",
    `Clauses:     ${results.length} reviewed  |  ${counts.RED} Red  |  ${counts.AMBER} Amber  |  ${counts.GREEN} Green  |  ${counts.GREY} Missing`,
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

  lines.push("", "Generated by Zane", "https://usezane.ai");

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
