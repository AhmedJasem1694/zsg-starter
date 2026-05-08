import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ArrowLeft, AlertTriangle, Clock, CheckCircle, Download, ChevronDown, ChevronUp, Mail, Copy, Loader2 } from "lucide-react";
import { getReview, saveFeedback, generateReply } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import type { ReviewResult, RagStatus, FeedbackAction, UploadedDocument } from "../lib/types";
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
    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-5xl mx-auto space-y-4">
          <BackButton onClick={() => navigate("/app/legal/dashboard")} />
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
                Not found in contract
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
              <div className="clause-block text-sm leading-relaxed">
                {result.suggestedFallback}
              </div>
            </Detail>
          )}

          {result.escalationRequired && result.escalationTrigger && (
            <Detail title="Escalation trigger">
              <div className="bg-[#1F0A0A] border border-[#450A0A] rounded-lg px-4 py-3 text-sm text-[#FCA5A5] flex gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-[#FCA5A5]" />
                {result.escalationTrigger}
              </div>
            </Detail>
          )}

          <Detail title="Plain English summary - for stakeholders">
            <div className="bg-card border border-card-border rounded-lg px-4 py-3 text-sm leading-relaxed">
              {result.businessSummary}
            </div>
          </Detail>

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
                    <><Loader2 size={11} className="animate-spin" /> Drafting reply…</>
                  ) : (
                    <><Mail size={11} /> Draft negotiation reply</>
                  )}
                </button>
              ) : (
                <Detail title="Negotiation reply — copy and send">
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
                  {submitting === action ? "…" : <>{icons[action]} {action.charAt(0) + action.slice(1).toLowerCase()}</>}
                </button>
              );
            })}
          </div>

          {/* What was agreed capture */}
          {showWhatAgreed && (
            <div className="rounded-lg border border-[#14532D] bg-[#052E16] p-3 space-y-2">
              <div className="text-xs font-medium text-[#86EFAC]">
                Optional: record the final agreed wording
              </div>
              <textarea
                className="input text-xs min-h-[64px] resize-none w-full"
                placeholder="Paste the final clause text as signed…"
                value={agreedText}
                onChange={(e) => setAgreedText(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  className="btn-primary text-xs px-3 py-1.5"
                  onClick={() => { void handle("ACCEPTED", agreedText || undefined); setShowWhatAgreed(false); }}
                >
                  Save & accept
                </button>
                <button
                  className="btn-ghost text-xs px-3 py-1.5"
                  onClick={() => { void handle("ACCEPTED"); setShowWhatAgreed(false); }}
                >
                  Accept without recording
                </button>
              </div>
            </div>
          )}
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
    "MIKE REVIEW SUMMARY",
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

  lines.push("", "Generated by MIKE - Legal Decision Engine", "https://usemike.co");

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `MIKE-Review-${doc.originalName.replace(/\.[^.]+$/, "")}.txt`;
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
      triggers.push({ label: "Related party / connected party — Board sign-off always required", approvers: ["Board"] });
      break;
    case "REGULATOR":
      triggers.push({ label: "Regulator / government body — GC sign-off always required", approvers: ["GC"] });
      break;
    case "INVESTOR":
      triggers.push({ label: "Investor / shareholder — GC and CFO always required", approvers: ["GC", "CFO"] });
      break;
    case "COMPETITOR":
      triggers.push({ label: "Competitor — GC and CEO always required", approvers: ["GC", "CEO"] });
      break;
  }

  if (contractType === "JV_AGREEMENT") {
    triggers.push({ label: "Joint venture — Board sign-off always required", approvers: ["Board"] });
  }
  if (contractType && (contractType.includes("EXCLUSIV") || contractType === "EXCLUSIVITY")) {
    triggers.push({ label: "Exclusivity agreement — CEO minimum always required", approvers: ["CEO"] });
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
          Escalation required — {tiersActive} tier{tiersActive !== 1 ? "s" : ""} triggered
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Tier 1 — Clause Risk */}
        {tier1Clauses.length > 0 && (
          <div className="rounded-lg bg-[#1F0A0A] border border-[#450A0A] p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#FCA5A5]">
              Tier 1 — Clause Risk
            </div>
            <ul className="space-y-1.5">
              {tier1Clauses.map((r) => (
                <li key={r.id} className="flex gap-2 text-sm text-[#FCA5A5]">
                  <span className="shrink-0 mt-0.5">•</span>
                  <span>
                    <span className="font-semibold">{CLAUSE_LABELS[r.clauseCategory] ?? r.clauseCategory}</span>
                    {r.escalationTrigger && (
                      <span className="opacity-80"> — {r.escalationTrigger}</span>
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
              Tier 2 — Contract Value
            </div>
            <div className="text-sm text-[#FCD34D]">
              <span className="font-semibold">
                {doc.currency ?? "£"}{doc.contractValue!.toLocaleString("en-GB")}
              </span>{" "}
              — {valueTier.label}
            </div>
          </div>
        )}

        {/* Tier 3 — Governance */}
        {govTriggers.length > 0 && (
          <div className="rounded-lg bg-[#1E1B4B] border border-[#312E81] p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#A5B4FC]">
              Tier 3 — Governance
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
              MIKE uses three escalation tiers. <strong>Tier 1</strong> fires when individual clauses
              contain terms that exceed your playbook thresholds and require sign-off.{" "}
              <strong>Tier 2</strong> fires when the total contract value crosses an authority threshold
              set by your organisation. <strong>Tier 3</strong> fires based on the nature of the
              counterparty or contract type — certain relationships (regulators, investors, related
              parties) and structures (JVs, exclusivity) always require elevated sign-off regardless
              of clause content or value.
            </p>
          )}
        </div>
      </div>
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
