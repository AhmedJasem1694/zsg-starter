import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft, AlertTriangle, CheckCircle, AlertCircle,
  Copy, ChevronDown, ChevronUp, Sparkles, Mail, Loader2,
} from "lucide-react";
import { getReview, saveFeedback, generateReply } from "../../lib/api";
import AppLayout from "../../components/layout/AppLayout";
import type { ReviewResult, RagStatus, FeedbackAction, UploadedDocument } from "../../lib/types";
import { CLAUSE_LABELS } from "../../lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type Verdict = "safe" | "caution" | "danger";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getVerdict(results: ReviewResult[]): Verdict {
  const red   = results.filter((r) => r.ragStatus === "RED").length;
  const amber = results.filter((r) => r.ragStatus === "AMBER").length;
  if (red >= 1)   return "danger";
  if (amber >= 2) return "caution";
  return "safe";
}

function founderRagLabel(s: RagStatus): string {
  return { RED: "Problem", AMBER: "Worth negotiating", GREEN: "Fine", GREY: "Missing clause" }[s];
}

function founderRagBg(s: RagStatus): string {
  return {
    RED:   "bg-[#1F0A0A] border-[#450A0A]",
    AMBER: "bg-[#1C0F00] border-[#431407]",
    GREEN: "bg-[#052E16] border-[#14532D]",
    GREY:  "bg-[#0F172A] border-[#334155]",
  }[s];
}

function founderRagColor(s: RagStatus): string {
  return {
    RED:   "text-[#FCA5A5]",
    AMBER: "text-[#FCD34D]",
    GREEN: "text-[#86EFAC]",
    GREY:  "text-[#94A3B8]",
  }[s];
}

function founderRagDot(s: RagStatus): string {
  return {
    RED:   "bg-[#FCA5A5]",
    AMBER: "bg-[#FCD34D]",
    GREEN: "bg-[#86EFAC]",
    GREY:  "bg-[#475569]",
  }[s];
}

// ── Risk card ─────────────────────────────────────────────────────────────────

function FounderClauseCard({
  result,
  expanded,
  onToggle,
  onFeedback,
}: {
  result: ReviewResult;
  expanded: boolean;
  onToggle: () => void;
  onFeedback: (action: FeedbackAction, finalClauseText?: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copiedReply, setCopiedReply] = useState(false);
  const [generatedReply, setGeneratedReply] = useState<string | null>(null);
  const [showWhatAgreed, setShowWhatAgreed] = useState(false);
  const [agreedText, setAgreedText] = useState("");

  const label = CLAUSE_LABELS[result.clauseCategory] ?? result.clauseCategory.replace(/_/g, " ");
  const tagBg = founderRagBg(result.ragStatus);
  const tagColor = founderRagColor(result.ragStatus);

  const replyMutation = useMutation({
    mutationFn: () => generateReply(result.id, "friendly but firm"),
    onSuccess: (data) => setGeneratedReply(data.reply),
  });

  function copyFallback() {
    if (!result.suggestedFallback) return;
    void navigator.clipboard.writeText(result.suggestedFallback).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyReply() {
    if (!generatedReply) return;
    void navigator.clipboard.writeText(generatedReply).then(() => {
      setCopiedReply(true);
      setTimeout(() => setCopiedReply(false), 2000);
    });
  }

  return (
    <div className={`card border rounded-xl ${tagBg} overflow-hidden`}>
      <button
        className="w-full px-5 py-4 flex items-start gap-4 text-left"
        onClick={onToggle}
      >
        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${founderRagDot(result.ragStatus)}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold uppercase tracking-wide ${tagColor}`}>
              {founderRagLabel(result.ragStatus)}
            </span>
            <span className="text-sm font-medium text-foreground">{label}</span>
          </div>
          <p className="mt-1 text-sm text-foreground/80 line-clamp-2">
            {result.businessSummary || result.clauseSummary}
          </p>
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-muted-foreground shrink-0 mt-1" />
        ) : (
          <ChevronDown size={16} className="text-muted-foreground shrink-0 mt-1" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-current/10 pt-4">

          {/* Why it matters */}
          {result.whyItMatters && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Why does this matter?
              </div>
              <p className="text-sm text-foreground/90">{result.whyItMatters}</p>
            </div>
          )}

          {/* What to do */}
          {result.recommendedAction && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                What should I do?
              </div>
              <p className="text-sm text-foreground/90">{result.recommendedAction}</p>
            </div>
          )}

          {/* Copy-paste wording */}
          {result.suggestedFallback && result.ragStatus !== "GREEN" && (
            <div className="rounded-lg bg-background/60 border border-border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={12} className="text-primary" />
                  <span className="text-xs font-semibold text-primary">Suggested wording</span>
                </div>
                <button
                  className="btn-ghost text-xs px-2 py-1 gap-1 flex items-center"
                  onClick={copyFallback}
                >
                  <Copy size={11} />
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-foreground/80 font-mono leading-relaxed">
                {result.suggestedFallback}
              </p>
            </div>
          )}

          {/* Generate reply email */}
          {result.ragStatus !== "GREEN" && (
            <div className="space-y-2">
              {!generatedReply ? (
                <button
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                  onClick={() => replyMutation.mutate()}
                  disabled={replyMutation.isPending}
                >
                  {replyMutation.isPending ? (
                    <><Loader2 size={11} className="animate-spin" /> Writing reply…</>
                  ) : (
                    <><Mail size={11} /> Generate email reply</>
                  )}
                </button>
              ) : (
                <div className="copy-block rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Mail size={12} className="text-[#60A5FA]" />
                      <span className="text-xs font-semibold text-[#60A5FA]">Email reply — copy and send</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        className="btn-ghost text-xs px-2 py-1 gap-1 flex items-center"
                        onClick={copyReply}
                      >
                        <Copy size={11} />
                        {copiedReply ? "Copied!" : "Copy"}
                      </button>
                      <button
                        className="btn-ghost text-xs px-2 py-1 text-muted-foreground"
                        onClick={() => setGeneratedReply(null)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{generatedReply}</p>
                </div>
              )}
            </div>
          )}

          {/* Escalation note */}
          {result.escalationRequired && result.escalationTrigger && (
            <div className="flex items-start gap-2 rounded-lg bg-[#1F0A0A] border border-[#450A0A] px-3 py-2.5">
              <AlertTriangle size={13} className="text-[#FCA5A5] mt-0.5 shrink-0" />
              <p className="text-xs text-[#FCA5A5]">{result.escalationTrigger}</p>
            </div>
          )}

          {/* Feedback buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
              onClick={() => { setShowWhatAgreed(true); }}
            >
              <CheckCircle size={11} /> Accept as-is
            </button>
            <button
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
              onClick={() => onFeedback("ESCALATED")}
            >
              <AlertTriangle size={11} /> Escalate to legal
            </button>
            <button
              className="btn-ghost text-xs px-3 py-1.5"
              onClick={() => onFeedback("DISMISSED")}
            >
              Dismiss
            </button>
          </div>

          {/* "What was actually agreed" optional capture */}
          {showWhatAgreed && (
            <div className="rounded-lg border border-[#14532D] bg-[#052E16] p-3 space-y-2">
              <div className="text-xs font-medium text-[#86EFAC]">
                Optional: what was the final agreed wording?
              </div>
              <textarea
                className="input text-xs min-h-[64px] resize-none w-full"
                placeholder="Paste or type the final agreed clause text here…"
                value={agreedText}
                onChange={(e) => setAgreedText(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  className="btn-primary text-xs px-3 py-1.5"
                  onClick={() => {
                    onFeedback("ACCEPTED", agreedText || undefined);
                    setShowWhatAgreed(false);
                  }}
                >
                  Confirm accepted
                </button>
                <button
                  className="btn-ghost text-xs px-3 py-1.5"
                  onClick={() => {
                    onFeedback("ACCEPTED");
                    setShowWhatAgreed(false);
                  }}
                >
                  Skip
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FounderReview() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<RagStatus | "ALL">("ALL");

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

  const backPath = "/app/founder/dashboard";

  if (isLoading) {
    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-3xl mx-auto">
          <button onClick={() => navigate(backPath)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft size={15} /> Back
          </button>
          <div className="text-sm text-muted-foreground">Loading…</div>
        </div>
      </AppLayout>
    );
  }

  if (!doc) {
    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-3xl mx-auto">
          <button onClick={() => navigate(backPath)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft size={15} /> Back
          </button>
          <div className="text-sm text-destructive">Document not found.</div>
        </div>
      </AppLayout>
    );
  }

  if (doc.status === "PROCESSING") {
    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-3xl mx-auto space-y-4">
          <button onClick={() => navigate(backPath)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={15} /> Back
          </button>
          <div className="card p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
            <div className="font-semibold">MIKE is reading your contract…</div>
            <div className="text-sm text-muted-foreground max-w-sm mx-auto">
              Checking every clause. This usually takes 1–3 minutes.
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (doc.status === "FAILED") {
    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-3xl mx-auto space-y-4">
          <button onClick={() => navigate(backPath)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={15} /> Back
          </button>
          <div className="card p-12 text-center space-y-3">
            <AlertTriangle size={32} className="text-destructive mx-auto" />
            <div className="font-semibold text-destructive">Something went wrong</div>
            <div className="text-sm text-muted-foreground">Go back and retry from the dashboard.</div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const results = doc.reviewResults ?? [];
  const verdict = getVerdict(results);

  const counts = {
    RED:   results.filter((r) => r.ragStatus === "RED").length,
    AMBER: results.filter((r) => r.ragStatus === "AMBER").length,
    GREEN: results.filter((r) => r.ragStatus === "GREEN").length,
    GREY:  results.filter((r) => r.ragStatus === "GREY").length,
  };

  // Top risks = RED first, then AMBER, max 3 for "priority" section
  const topRisks = [
    ...results.filter((r) => r.ragStatus === "RED"),
    ...results.filter((r) => r.ragStatus === "AMBER"),
  ].slice(0, 3);

  const filtered = filter === "ALL" ? results : results.filter((r) => r.ragStatus === filter);

  const VERDICT_BANNER = {
    safe:    { label: "Looks good — you can proceed",         color: "text-[#86EFAC]", bg: "bg-[#052E16] border-[#14532D]", icon: CheckCircle },
    caution: { label: "Worth a closer look before signing",   color: "text-[#FCD34D]", bg: "bg-[#1C0F00] border-[#431407]", icon: AlertCircle },
    danger:  { label: "Don't sign yet — fix these first",     color: "text-[#FCA5A5]", bg: "bg-[#1F0A0A] border-[#450A0A]", icon: AlertTriangle },
  } as const;

  const banner = VERDICT_BANNER[verdict];
  const BannerIcon = banner.icon;

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-3xl mx-auto space-y-6">

        {/* Back + title */}
        <div className="space-y-1">
          <button
            onClick={() => navigate(backPath)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft size={15} /> Back to my contracts
          </button>
          <h1 className="text-xl font-semibold truncate">{doc.originalName}</h1>
          <div className="text-sm text-muted-foreground">
            {new Date(doc.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>

        {/* Verdict banner */}
        <div className={`card p-5 flex items-center gap-3 border ${banner.bg}`}>
          <BannerIcon size={22} className={banner.color} />
          <div>
            <div className={`font-semibold ${banner.color}`}>{banner.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {counts.RED} problem{counts.RED !== 1 ? "s" : ""} · {counts.AMBER} to negotiate · {counts.GREEN} fine · {counts.GREY} missing
            </div>
          </div>
        </div>

        {/* Top risks — only if there are any */}
        {topRisks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-[#FCD34D]" />
              <h2 className="text-sm font-semibold">Top things to focus on</h2>
            </div>
            {topRisks.map((result) => (
              <div
                key={result.id}
                className={`rounded-lg border px-4 py-3 space-y-1 ${founderRagBg(result.ragStatus)}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${founderRagDot(result.ragStatus)}`} />
                  <span className={`text-xs font-semibold ${founderRagColor(result.ragStatus)}`}>
                    {founderRagLabel(result.ragStatus)}
                  </span>
                  <span className="text-sm font-medium">
                    {CLAUSE_LABELS[result.clauseCategory] ?? result.clauseCategory.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-sm text-foreground/80 pl-4">
                  {result.businessSummary || result.clauseSummary}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {(["ALL", "RED", "AMBER", "GREEN", "GREY"] as const).map((f) => {
            const count = f === "ALL" ? results.length : counts[f as RagStatus];
            const labels: Record<string, string> = {
              ALL: "All",
              RED: "Problems",
              AMBER: "Negotiate",
              GREEN: "Fine",
              GREY: "Missing",
            };
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
                {labels[f]} ({count})
              </button>
            );
          })}
        </div>

        {/* Clause cards */}
        <div className="space-y-3">
          {filtered.map((result) => (
            <FounderClauseCard
              key={result.id}
              result={result}
              expanded={expandedId === result.id}
              onToggle={() => setExpandedId(expandedId === result.id ? null : result.id)}
              onFeedback={(action, finalClauseText) => void handleFeedback(result.id, action, finalClauseText)}
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
