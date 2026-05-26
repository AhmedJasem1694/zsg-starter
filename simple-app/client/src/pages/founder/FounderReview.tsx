import { useState, useEffect, useRef } from "react";
import { formatContractDate } from "../../lib/dateUtils";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft, AlertTriangle, CheckCircle, AlertCircle,
  Copy, ChevronDown, ChevronUp, Sparkles, Mail, Loader2,
  FileText, Plus, Check, X, Download, ExternalLink,
} from "lucide-react";
import {
  getReview, saveFeedback, generateReply,
  generateNegotiationEmail, generateAmendedClause, suggestMissingClause,
} from "../../lib/api";
import AppLayout from "../../components/layout/AppLayout";
import type { ReviewResult, RagStatus, FeedbackAction, UploadedDocument, FounderStatus } from "../../lib/types";
import { CLAUSE_LABELS } from "../../lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type Verdict = "safe" | "caution" | "danger" | "pending";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getVerdict(results: ReviewResult[]): Verdict {
  if (results.length === 0) return "pending";
  const statuses = results.map((r) => r.founderStatus).filter(Boolean) as FounderStatus[];
  if (statuses.includes("DO NOT SIGN YET")) return "danger";
  if (statuses.includes("CAUTION"))         return "caution";
  if (statuses.length > 0)                  return "safe";
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

// ── Fundraising relevance mapping ─────────────────────────────────────────────

type FundraisingRelevance = "High investor concern" | "Standard diligence item" | "Worth noting";

const FUNDRAISING_RELEVANCE: Record<string, FundraisingRelevance> = {
  LIQUIDATION_PREFERENCE:  "High investor concern",
  ANTI_DILUTION:           "High investor concern",
  DRAG_ALONG:              "High investor concern",
  BOARD_COMPOSITION:       "High investor concern",
  OPTION_POOL_SHUFFLE:     "High investor concern",
  PRO_RATA_RIGHTS:         "High investor concern",
  PAY_TO_PLAY:             "High investor concern",
  IP_OWNERSHIP:            "High investor concern",
  VESTING_LEAVER:          "Standard diligence item",
  INFORMATION_RIGHTS:      "Standard diligence item",
  REDEMPTION_RIGHTS:       "Standard diligence item",
  LIMITATION_OF_LIABILITY: "Standard diligence item",
  INDEMNITY:               "Standard diligence item",
  CHANGE_OF_CONTROL:       "Standard diligence item",
  CONFIDENTIALITY:         "Worth noting",
  GOVERNING_LAW:           "Worth noting",
  DISPUTE_RESOLUTION:      "Worth noting",
};

const FUNDRAISING_RELEVANCE_COLOR: Record<FundraisingRelevance, string> = {
  "High investor concern":   "text-[#FCA5A5] bg-[#1F0A0A] border-[#450A0A]",
  "Standard diligence item": "text-[#FCD34D] bg-[#1C0F00] border-[#431407]",
  "Worth noting":            "text-[#94A3B8] bg-[#0F172A] border-[#334155]",
};

// ── Negotiation Email Modal ───────────────────────────────────────────────────

function NegotiationEmailModal({
  subject: initialSubject,
  body: initialBody,
  onClose,
}: {
  subject: string;
  body: string;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody]       = useState(initialBody);
  const [copied, setCopied]   = useState(false);

  function handleCopy() {
    const full = `Subject: ${subject}\n\n${body}`;
    void navigator.clipboard.writeText(full).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    const full = `Subject: ${subject}\n\n${body}`;
    const blob = new Blob([full], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "negotiation-email.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleMailto() {
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, "_blank");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-[#1E293B] bg-[#0B1118] flex flex-col max-h-[90vh] shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E293B] shrink-0">
          <div className="flex items-center gap-2.5">
            <Mail size={16} className="text-[#60A5FA]" />
            <span className="font-semibold text-[#93C5FD]">Negotiation email draft</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0">
          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Subject line
            </label>
            <input
              className="w-full rounded-lg border border-[#1E293B] bg-[#050A10] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#3B82F6] transition-colors"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Email body
            </label>
            <textarea
              className="w-full rounded-lg border border-[#1E293B] bg-[#050A10] px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#3B82F6] transition-colors resize-none leading-relaxed"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={18}
            />
          </div>

          <p className="text-[11px] text-muted-foreground/60">
            Edit freely — this is your email. Zane has drafted it based on the issues you flagged.
          </p>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-t border-[#1E293B] shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1D4ED8] text-white text-sm font-medium hover:bg-[#2563EB] transition-colors"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy email"}
          </button>
          <button
            onClick={handleMailto}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#1E293B] bg-[#0D1521] text-sm text-foreground hover:border-[#334155] transition-colors"
          >
            <ExternalLink size={13} className="text-muted-foreground" />
            Open in email client
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#1E293B] bg-[#0D1521] text-sm text-foreground hover:border-[#334155] transition-colors"
          >
            <Download size={13} className="text-muted-foreground" />
            Download
          </button>
          <button
            onClick={onClose}
            className="ml-auto text-sm text-muted-foreground hover:text-foreground px-3 py-2 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Amended Clause Panel ──────────────────────────────────────────────────────

function AmendedClausePanel({
  original,
  revised,
  explanation,
  onClose,
}: {
  original: string;
  revised: string;
  explanation: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(revised).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-[#1E293B] bg-[#080F18] overflow-hidden space-y-0">
      {/* Original */}
      <div className="px-4 pt-4 pb-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#FCA5A5]/70">Original clause</div>
        <div className="rounded-lg border border-[#450A0A] bg-[#1F0A0A] px-3 py-2.5 text-xs leading-relaxed text-[#FCA5A5]/80 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
          {original || "(Original text not available — paste the original clause here when sending)"}
        </div>
      </div>

      {/* Revised */}
      <div className="px-4 pb-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#86EFAC]/70">Revised clause</div>
        <div className="rounded-lg border border-[#14532D] bg-[#052E16] px-3 py-2.5 text-xs leading-relaxed text-[#86EFAC]/90 font-mono whitespace-pre-wrap">
          {revised}
        </div>
      </div>

      {/* Explanation + actions */}
      <div className="px-4 pb-4 space-y-3">
        {explanation && (
          <p className="text-xs text-muted-foreground italic">{explanation}</p>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14532D] text-[#86EFAC] text-xs font-medium hover:bg-[#166534] transition-colors"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? "Copied!" : "Copy revised clause"}
          </button>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5">
            ×
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground/60">
          Paste this into your reply or negotiation email where you reference this clause.
        </p>
      </div>
    </div>
  );
}

// ── Suggest Clause Panel ──────────────────────────────────────────────────────

function SuggestClausePanel({
  clauseText,
  explanation,
  onClose,
}: {
  clauseText: string;
  explanation: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(clauseText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-[#1E3A5F] bg-[#0C1929] overflow-hidden">
      <div className="px-4 pt-4 pb-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#60A5FA]/70">Suggested clause to add</div>
        <div className="rounded-lg border border-[#1E3A5F] bg-[#050A14] px-3 py-2.5 text-xs leading-relaxed text-[#93C5FD]/90 font-mono whitespace-pre-wrap">
          {clauseText}
        </div>
      </div>
      <div className="px-4 pb-4 space-y-3">
        {explanation && (
          <p className="text-xs text-muted-foreground italic">{explanation}</p>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D4ED8]/30 text-[#60A5FA] text-xs font-medium hover:bg-[#1D4ED8]/50 transition-colors border border-[#1D4ED8]/40"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? "Copied!" : "Copy clause"}
          </button>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5">
            ×
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground/60">
          Ask the counterparty to add this clause to the agreement.
        </p>
      </div>
    </div>
  );
}

// ── Risk card ─────────────────────────────────────────────────────────────────

function FounderClauseCard({
  result,
  expanded,
  onToggle,
  onFeedback,
  selected,
  onToggleSelect,
}: {
  result: ReviewResult;
  expanded: boolean;
  onToggle: () => void;
  onFeedback: (action: FeedbackAction, finalClauseText?: string) => void;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const [copied, setCopied]               = useState(false);
  const [copiedReply, setCopiedReply]     = useState(false);
  const [generatedReply, setGeneratedReply] = useState<string | null>(null);
  const [showWhatAgreed, setShowWhatAgreed] = useState(false);
  const [agreedText, setAgreedText]         = useState("");

  // Feature 2 — amended clause
  const [amendedData, setAmendedData]         = useState<{ original: string; revised: string; explanation: string } | null>(null);
  const [generatingAmended, setGeneratingAmended] = useState(false);

  // Feature 3 — suggest missing clause
  const [suggestedData, setSuggestedData]         = useState<{ clauseText: string; explanation: string } | null>(null);
  const [generatingSuggested, setGeneratingSuggested] = useState(false);

  const label              = CLAUSE_LABELS[result.clauseCategory] ?? result.clauseCategory.replace(/_/g, " ");
  const tagBg              = founderRagBg(result.ragStatus);
  const tagColor           = founderRagColor(result.ragStatus);
  const fundraisingRelevance = (FUNDRAISING_RELEVANCE[result.clauseCategory] as FundraisingRelevance | undefined);
  const frColor            = fundraisingRelevance ? FUNDRAISING_RELEVANCE_COLOR[fundraisingRelevance] : null;
  const displaySummary     = result.founderPlainEnglish || result.businessSummary || result.clauseSummary;
  const copyPasteText      = result.founderCopyPaste || result.suggestedFallback;
  const isNegotiable       = result.ragStatus !== "GREEN";

  const replyMutation = useMutation({
    mutationFn: () => generateReply(result.id, "friendly but firm"),
    onSuccess: (data) => setGeneratedReply(data.reply),
  });

  function copyFallback() {
    if (!copyPasteText) return;
    void navigator.clipboard.writeText(copyPasteText).then(() => {
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

  async function handleGenerateAmended() {
    setGeneratingAmended(true);
    try {
      const data = await generateAmendedClause(result.id);
      setAmendedData(data);
    } catch {
      /* silent */
    } finally {
      setGeneratingAmended(false);
    }
  }

  async function handleSuggestClause() {
    setGeneratingSuggested(true);
    try {
      const data = await suggestMissingClause(result.id);
      setSuggestedData(data);
    } catch {
      /* silent */
    } finally {
      setGeneratingSuggested(false);
    }
  }

  return (
    <div className={`card border rounded-xl ${tagBg} overflow-hidden`}>
      {/* ── Collapsed header ──────────────────────────────────────────── */}
      <div className="flex items-start gap-0">
        <button
          className="flex-1 px-5 py-4 flex items-start gap-4 text-left min-w-0"
          onClick={onToggle}
        >
          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${founderRagDot(result.ragStatus)}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold uppercase tracking-wide ${tagColor}`}>
                {founderRagLabel(result.ragStatus)}
              </span>
              <span className="text-sm font-medium text-foreground">{label}</span>
              {fundraisingRelevance && frColor && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${frColor}`}>
                  {fundraisingRelevance}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-foreground/80 line-clamp-2">
              {displaySummary}
            </p>
          </div>
          {expanded ? (
            <ChevronUp size={16} className="text-muted-foreground shrink-0 mt-1" />
          ) : (
            <ChevronDown size={16} className="text-muted-foreground shrink-0 mt-1" />
          )}
        </button>

        {/* Selection toggle — only for negotiable clauses */}
        {isNegotiable && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
            title={selected ? "Remove from negotiation email" : "Include in negotiation email"}
            className={`shrink-0 self-stretch px-3 flex items-center border-l transition-colors ${
              selected
                ? "border-current/20 bg-current/10 text-current"
                : "border-current/10 text-muted-foreground/40 hover:text-muted-foreground"
            }`}
          >
            {selected
              ? <Check size={14} className={tagColor} />
              : <Plus size={14} />
            }
          </button>
        )}
      </div>

      {/* ── Expanded detail ───────────────────────────────────────────── */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-current/10 pt-4">

          {/* Absent clause notice */}
          {result.isAbsent && (
            <div className="flex items-start gap-2 rounded-lg bg-[#0F172A] border border-[#334155] px-3 py-2.5">
              <AlertCircle size={13} className="text-[#94A3B8] mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-[#94A3B8]">Clause not found in this contract</div>
                <p className="text-xs text-[#94A3B8]/80">
                  Check whether your deal requires this clause to be present. If so, ask the other side to include it before you sign.
                </p>
              </div>
            </div>
          )}

          {/* Business impact */}
          {result.founderBusinessImpact && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                What does this cost you?
              </div>
              <p className="text-sm text-foreground/90">{result.founderBusinessImpact}</p>
            </div>
          )}
          {!result.founderBusinessImpact && result.whyItMatters && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Why does this matter?
              </div>
              <p className="text-sm text-foreground/90">{result.whyItMatters}</p>
            </div>
          )}

          {/* What to ask for */}
          {result.founderAskFor && result.ragStatus !== "GREEN" && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                What to ask for
              </div>
              <p className="text-sm text-foreground/90">{result.founderAskFor}</p>
            </div>
          )}
          {!result.founderAskFor && result.recommendedAction && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                What should I do?
              </div>
              <p className="text-sm text-foreground/90">{result.recommendedAction}</p>
            </div>
          )}

          {/* Copy-paste wording */}
          {copyPasteText && result.ragStatus !== "GREEN" && (
            <div className="rounded-lg bg-background/60 border border-border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={12} className="text-primary" />
                  <span className="text-xs font-semibold text-primary">
                    {result.founderCopyPaste ? "Paste this into your email" : "Suggested wording"}
                  </span>
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
                {copyPasteText}
              </p>
            </div>
          )}

          {/* ── Feature 2: Amended clause ────────────────────────────── */}
          {!result.isAbsent && result.ragStatus !== "GREEN" && (
            <div className="space-y-2">
              {!amendedData ? (
                <button
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                  onClick={handleGenerateAmended}
                  disabled={generatingAmended}
                >
                  {generatingAmended
                    ? <><Loader2 size={11} className="animate-spin" /> Writing amended clause…</>
                    : <><FileText size={11} /> Amended clause</>
                  }
                </button>
              ) : (
                <AmendedClausePanel
                  original={amendedData.original}
                  revised={amendedData.revised}
                  explanation={amendedData.explanation}
                  onClose={() => setAmendedData(null)}
                />
              )}
            </div>
          )}

          {/* ── Feature 3: Suggest missing clause ───────────────────── */}
          {result.isAbsent && (
            <div className="space-y-2">
              {!suggestedData ? (
                <button
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                  onClick={handleSuggestClause}
                  disabled={generatingSuggested}
                >
                  {generatingSuggested
                    ? <><Loader2 size={11} className="animate-spin" /> Writing clause…</>
                    : <><Plus size={11} /> Generate clause to request</>
                  }
                </button>
              ) : (
                <SuggestClausePanel
                  clauseText={suggestedData.clauseText}
                  explanation={suggestedData.explanation}
                  onClose={() => setSuggestedData(null)}
                />
              )}
            </div>
          )}

          {/* Fundraising relevance */}
          {result.founderFundraisingRelevance && result.founderFundraisingRelevance !== "Not relevant to fundraising" && (
            <div className="rounded-lg bg-[#0F172A] border border-[#334155] px-3 py-2.5">
              <div className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-0.5">Fundraising note</div>
              <p className="text-xs text-[#94A3B8]">{result.founderFundraisingRelevance}</p>
            </div>
          )}

          {/* If ignored */}
          {result.founderIfIgnored && result.ragStatus !== "GREEN" && (
            <div className="rounded-lg bg-[#1F0A0A] border border-[#450A0A] px-3 py-2.5">
              <div className="text-[10px] font-semibold text-[#FCA5A5] uppercase tracking-wide mb-0.5">If you sign as-is</div>
              <p className="text-xs text-[#FCA5A5]/90">{result.founderIfIgnored}</p>
            </div>
          )}

          {/* Generate reply email (per-clause) */}
          {result.ragStatus !== "GREEN" && (
            <div className="space-y-2">
              {!generatedReply ? (
                <button
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                  onClick={() => replyMutation.mutate()}
                  disabled={replyMutation.isPending}
                >
                  {replyMutation.isPending
                    ? <><Loader2 size={11} className="animate-spin" /> Writing reply…</>
                    : <><Mail size={11} /> Generate email reply</>
                  }
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
              onClick={() => setShowWhatAgreed(true)}
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

          {/* "What was actually agreed" capture */}
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
  const { id }      = useParams<{ id: string }>();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter]         = useState<RagStatus | "ALL">("ALL");

  // Negotiation email state — all hooks must be before early returns
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set());
  const [emailModal, setEmailModal]       = useState<{ subject: string; body: string } | null>(null);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const docIdRef = useRef<string | undefined>(undefined);

  const ACTIVE_STATUSES = ["PROCESSING", "PARSING", "ANONYMISING", "CLASSIFYING", "COMPARING"];

  const { data: doc, isLoading } = useQuery({
    queryKey: ["review", id],
    queryFn: () => getReview(id!),
    refetchInterval: (query) => {
      const d = query.state.data;
      return d?.status && ACTIVE_STATUSES.includes(d.status) ? 3000 : false;
    },
  });

  // Auto-select all non-GREEN results when doc first loads
  useEffect(() => {
    if (doc && doc.id !== docIdRef.current) {
      docIdRef.current = doc.id;
      setSelectedIds(new Set(
        (doc.reviewResults ?? []).filter((r) => r.ragStatus !== "GREEN").map((r) => r.id)
      ));
    }
  }, [doc]);

  async function handleFeedback(resultId: string, action: FeedbackAction, finalClauseText?: string) {
    await saveFeedback(resultId, { userAction: action, finalClauseText });
    await queryClient.invalidateQueries({ queryKey: ["review", id] });
  }

  function toggleSelected(resultId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(resultId)) next.delete(resultId);
      else next.add(resultId);
      return next;
    });
  }

  async function handleDraftEmail() {
    if (!id) return;
    setGeneratingEmail(true);
    try {
      const selected = Array.from(selectedIds);
      const data = await generateNegotiationEmail(id, selected.length > 0 ? selected : undefined);
      setEmailModal(data);
    } catch {
      /* silent */
    } finally {
      setGeneratingEmail(false);
    }
  }

  const backPath = "/app/founder/dashboard";

  // ── Early returns ──────────────────────────────────────────────────────────

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

  if (ACTIVE_STATUSES.includes(doc.status)) {
    const elapsedSec = (Date.now() - new Date(doc.uploadedAt).getTime()) / 1000;
    const FOUNDER_STAGES = [
      { label: "Reading your contract",           maxSec: 15  },
      { label: "Removing personal details",        maxSec: 35  },
      { label: "Identifying key clauses",          maxSec: 70  },
      { label: "Comparing against your playbook",  maxSec: 130 },
      { label: "Checking investment terms",        maxSec: 200 },
      { label: "Preparing your risk report",       maxSec: Infinity },
    ];
    const activeIdx = FOUNDER_STAGES.findIndex((s) => elapsedSec < s.maxSec);
    const stageIdx  = activeIdx === -1 ? FOUNDER_STAGES.length - 1 : activeIdx;

    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-3xl mx-auto space-y-4">
          <button onClick={() => navigate(backPath)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={15} /> Back
          </button>
          <div className="card p-8 space-y-6 border-[#1C2A3A]" style={{ background: "#0D1B2A" }}>
            <div className="flex items-center gap-3">
              <Sparkles size={18} className="text-[#60A5FA]" />
              <div>
                <div className="font-semibold text-[#93C5FD]">Zane is reviewing your contract</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{doc.originalName}</div>
              </div>
            </div>
            <div className="space-y-2.5 max-w-xs">
              {FOUNDER_STAGES.map((stage, i) => {
                const done    = i < stageIdx;
                const active  = i === stageIdx;
                const pending = i > stageIdx;
                return (
                  <div key={stage.label} className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                      ${done    ? "bg-[#14532D] border-[#166534]" : ""}
                      ${active  ? "bg-[#1C0F00] border-[#92400E] animate-pulse" : ""}
                      ${pending ? "bg-transparent border-[#1E293B]" : ""}`}>
                      {done   && <CheckCircle size={10} className="text-[#86EFAC]" />}
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

  // ── Complete state ─────────────────────────────────────────────────────────

  const results  = doc.reviewResults ?? [];
  const verdict  = getVerdict(results);
  const issueCount = Array.from(selectedIds).filter(
    (id) => results.some((r) => r.id === id)
  ).length;

  const counts = {
    RED:   results.filter((r) => r.ragStatus === "RED").length,
    AMBER: results.filter((r) => r.ragStatus === "AMBER").length,
    GREEN: results.filter((r) => r.ragStatus === "GREEN").length,
    GREY:  results.filter((r) => r.ragStatus === "GREY").length,
  };

  const topRisks = [
    ...results.filter((r) => r.ragStatus === "RED"),
    ...results.filter((r) => r.ragStatus === "AMBER"),
  ].slice(0, 3);

  const filtered = filter === "ALL" ? results : results.filter((r) => r.ragStatus === filter);

  const VERDICT_BANNER = {
    safe:    { label: "Looks good — you can proceed",              color: "text-[#86EFAC]", bg: "bg-[#052E16] border-[#14532D]", icon: CheckCircle   },
    caution: { label: "Worth a closer look before signing",        color: "text-[#FCD34D]", bg: "bg-[#1C0F00] border-[#431407]", icon: AlertCircle   },
    danger:  { label: "Don't sign yet — fix these first",          color: "text-[#FCA5A5]", bg: "bg-[#1F0A0A] border-[#450A0A]", icon: AlertTriangle },
    pending: { label: "No playbook clauses matched this contract",  color: "text-[#94A3B8]", bg: "bg-[#0F172A] border-[#334155]", icon: AlertCircle   },
  } as const;

  const banner    = VERDICT_BANNER[verdict];
  const BannerIcon = banner.icon;

  return (
    <AppLayout>
      {/* Email modal overlay */}
      {emailModal && (
        <NegotiationEmailModal
          subject={emailModal.subject}
          body={emailModal.body}
          onClose={() => setEmailModal(null)}
        />
      )}

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
            {formatContractDate(doc.uploadedAt)}
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

        {/* Top risks */}
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
                  {result.founderPlainEnglish || result.businessSummary || result.clauseSummary}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {(["ALL", "RED", "AMBER", "GREEN", "GREY"] as const).map((f) => {
            const count = f === "ALL" ? results.length : counts[f as RagStatus];
            const labels: Record<string, string> = { ALL: "All", RED: "Problems", AMBER: "Negotiate", GREEN: "Fine", GREY: "Missing" };
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

        {/* Selection hint — shown when there are negotiable items */}
        {results.some((r) => r.ragStatus !== "GREEN") && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60 -mt-2">
            <Check size={11} />
            <span>
              {issueCount} issue{issueCount !== 1 ? "s" : ""} selected for negotiation email — tap the{" "}
              <span className="font-semibold text-foreground/50">+</span> on any clause to include or exclude it
            </span>
          </div>
        )}

        {/* Clause cards */}
        <div className="space-y-3">
          {filtered.map((result) => (
            <FounderClauseCard
              key={result.id}
              result={result}
              expanded={expandedId === result.id}
              onToggle={() => setExpandedId(expandedId === result.id ? null : result.id)}
              onFeedback={(action, finalClauseText) => void handleFeedback(result.id, action, finalClauseText)}
              selected={selectedIds.has(result.id)}
              onToggleSelect={() => toggleSelected(result.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-sm text-muted-foreground py-10 text-center">
              No clauses in this category.
            </div>
          )}
        </div>

        {/* ── Feature 4: Draft full negotiation response ─────────────── */}
        {(counts.RED + counts.AMBER + counts.GREY) > 0 && (
          <div className="rounded-2xl border border-[#1E3A5F] bg-[#0C1929] px-6 py-5 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-[#60A5FA]" />
                <span className="font-semibold text-[#93C5FD]">Draft full negotiation response</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Zane writes one professional email covering all the issues you want to raise — ready to edit and send.
              </p>
            </div>

            {issueCount > 0 && (
              <p className="text-xs text-[#60A5FA]/80">
                Will cover {issueCount} selected issue{issueCount !== 1 ? "s" : ""}.
                Use the <strong>+</strong> button on each clause card to add or remove issues.
              </p>
            )}

            <button
              onClick={handleDraftEmail}
              disabled={generatingEmail || issueCount === 0}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-[#1D4ED8] text-white font-semibold text-sm hover:bg-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generatingEmail ? (
                <><Loader2 size={15} className="animate-spin" /> Writing your email…</>
              ) : (
                <><Mail size={15} /> Draft negotiation email{issueCount > 0 ? ` (${issueCount} issue${issueCount !== 1 ? "s" : ""})` : ""}</>
              )}
            </button>

            {issueCount === 0 && (
              <p className="text-xs text-muted-foreground/60 text-center">
                Select at least one issue using the + button on a clause card.
              </p>
            )}
          </div>
        )}

      </div>
    </AppLayout>
  );
}
