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
import ReasoningPrompt from "../../components/ReasoningPrompt";
import type { ReviewResult, RagStatus, FeedbackAction, UploadedDocument, FounderStatus, FeedbackResponse, SignificanceResult } from "../../lib/types";
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
    RED:   "bg-[#FCEBEB] border-[#FCEBEB]",
    AMBER: "bg-[#FAEEDA] border-[#FAEEDA]",
    GREEN: "bg-[#E7F6EE] border-[#E7F6EE]",
    GREY:  "bg-[#FFFFFF] border-[#CBD5E1]",
  }[s];
}

function founderRagColor(s: RagStatus): string {
  return {
    RED:   "text-[#A32D2D]",
    AMBER: "text-[#854F0B]",
    GREEN: "text-[#1B7A4B]",
    GREY:  "text-[#64748B]",
  }[s];
}

function founderRagDot(s: RagStatus): string {
  return {
    RED:   "bg-[#A32D2D]",
    AMBER: "bg-[#854F0B]",
    GREEN: "bg-[#1B7A4B]",
    GREY:  "bg-[#64748B]",
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
  "High investor concern":   "text-foreground bg-[#FCEBEB] border-[#FCEBEB]",
  "Standard diligence item": "text-foreground bg-[#FAEEDA] border-[#FAEEDA]",
  "Worth noting":            "text-foreground bg-[#FFFFFF] border-[#CBD5E1]",
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
      <div className="w-full max-w-2xl rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] flex flex-col max-h-[90vh] shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] shrink-0">
          <div className="flex items-center gap-2.5">
            <Mail size={16} className="text-[#2563EB]" />
            <span className="font-semibold text-[#2563EB]">Negotiation email draft</span>
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
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#3B82F6] transition-colors"
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
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#3B82F6] transition-colors resize-none leading-relaxed"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={18}
            />
          </div>

          <p className="text-[11px] text-muted-foreground/60">
            Edit freely. This is your email. Zane has drafted it based on the issues you flagged.
          </p>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-t border-[#E2E8F0] shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1D4ED8] text-white text-sm font-medium hover:bg-[#2563EB] transition-colors"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy email"}
          </button>
          <button
            onClick={handleMailto}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-sm text-foreground hover:border-[#CBD5E1] transition-colors"
          >
            <ExternalLink size={13} className="text-muted-foreground" />
            Open in email client
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] text-sm text-foreground hover:border-[#CBD5E1] transition-colors"
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
    <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] overflow-hidden space-y-0">
      {/* Original */}
      <div className="px-4 pt-4 pb-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">Original clause</div>
        <div className="rounded-lg border border-[#FCEBEB] bg-[#FCEBEB] px-3 py-2.5 text-xs leading-relaxed text-foreground/80 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
          {original || "(Original text not available. Paste the original clause here when sending.)"}
        </div>
      </div>

      {/* Revised */}
      <div className="px-4 pb-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">Revised clause</div>
        <div className="rounded-lg border border-[#E7F6EE] bg-[#E7F6EE] px-3 py-2.5 text-xs leading-relaxed text-foreground/90 font-mono whitespace-pre-wrap">
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E7F6EE] text-foreground text-xs font-medium hover:bg-[#BBE6CC] transition-colors"
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
    <div className="rounded-xl border border-[#E6F1FB] bg-[#FFFFFF] overflow-hidden">
      <div className="px-4 pt-4 pb-3 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#2563EB]/70">Suggested clause to add</div>
        <div className="rounded-lg border border-[#E6F1FB] bg-[#FFFFFF] px-3 py-2.5 text-xs leading-relaxed text-[#2563EB]/90 font-mono whitespace-pre-wrap">
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D4ED8]/30 text-[#2563EB] text-xs font-medium hover:bg-[#1D4ED8]/50 transition-colors border border-[#1D4ED8]/40"
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
  onFeedback: (action: FeedbackAction, finalClauseText?: string) => Promise<FeedbackResponse | void>;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const [copied, setCopied]               = useState(false);
  const [copiedReply, setCopiedReply]     = useState(false);
  const [generatedReply, setGeneratedReply] = useState<string | null>(null);
  const [showWhatAgreed, setShowWhatAgreed] = useState(false);
  const [agreedText, setAgreedText]         = useState("");
  // Reasoning capture: same flow as the corporate review. After a decision, if it
  // is flagged significant, show the shared ReasoningPrompt. Never blocks.
  const [reasoningPrompt, setReasoningPrompt] = useState<{ decisionEventId: string; significance: SignificanceResult } | null>(null);

  async function runFeedback(action: FeedbackAction, finalClauseText?: string) {
    const res = await onFeedback(action, finalClauseText);
    if (res && res.significance?.significant && res.decisionEventId) {
      setReasoningPrompt({ decisionEventId: res.decisionEventId, significance: res.significance });
    }
  }

  // Feature 2: amended clause
  const [amendedData, setAmendedData]         = useState<{ original: string; revised: string; explanation: string } | null>(null);
  const [generatingAmended, setGeneratingAmended] = useState(false);

  // Feature 3: suggest missing clause
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

        {/* Selection toggle: only for negotiable clauses */}
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
            <div className="flex items-start gap-2 rounded-lg bg-[#FFFFFF] border border-[#CBD5E1] px-3 py-2.5">
              <AlertCircle size={13} className="text-[#64748B] mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-[#64748B]">Clause not found in this contract</div>
                <p className="text-xs text-[#64748B]/80">
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
            <div className="rounded-lg bg-[#FFFFFF] border border-[#CBD5E1] px-3 py-2.5">
              <div className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wide mb-0.5">Fundraising note</div>
              <p className="text-xs text-[#64748B]">{result.founderFundraisingRelevance}</p>
            </div>
          )}

          {/* If ignored */}
          {result.founderIfIgnored && result.ragStatus !== "GREEN" && (
            <div className="rounded-lg bg-[#FCEBEB] border border-[#FCEBEB] px-3 py-2.5">
              <div className="text-[10px] font-semibold text-[#A32D2D] uppercase tracking-wide mb-0.5">If you sign as-is</div>
              <p className="text-xs text-[#A32D2D]/90">{result.founderIfIgnored}</p>
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
                      <Mail size={12} className="text-[#2563EB]" />
                      <span className="text-xs font-semibold text-[#2563EB]">Email reply: copy and send</span>
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
            <div className="flex items-start gap-2 rounded-lg bg-[#FCEBEB] border border-[#FCEBEB] px-3 py-2.5">
              <AlertTriangle size={13} className="text-[#A32D2D] mt-0.5 shrink-0" />
              <p className="text-xs text-[#A32D2D]">{result.escalationTrigger}</p>
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
              onClick={() => void runFeedback("ESCALATED")}
            >
              <AlertTriangle size={11} /> Escalate to legal
            </button>
            <button
              className="btn-ghost text-xs px-3 py-1.5"
              onClick={() => void runFeedback("DISMISSED")}
            >
              Dismiss
            </button>
          </div>

          {/* Reasoning capture prompt: only on a significant decision */}
          {reasoningPrompt && (
            <ReasoningPrompt
              significance={reasoningPrompt.significance}
              decisionEventId={reasoningPrompt.decisionEventId}
              onClose={() => setReasoningPrompt(null)}
            />
          )}

          {/* "What was actually agreed" capture */}
          {showWhatAgreed && (
            <div className="rounded-lg border border-[#E7F6EE] bg-[#E7F6EE] p-3 space-y-2">
              <div className="text-xs font-medium text-[#1B7A4B]">
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
                    void runFeedback("ACCEPTED", agreedText || undefined);
                    setShowWhatAgreed(false);
                  }}
                >
                  Confirm accepted
                </button>
                <button
                  className="btn-ghost text-xs px-3 py-1.5"
                  onClick={() => {
                    void runFeedback("ACCEPTED");
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

// ── Founder fallback card, shown when verification fails ────────────────────

function FounderFallbackCard({ result }: { result: ReviewResult }) {
  const label = CLAUSE_LABELS[result.clauseCategory] ?? result.clauseCategory.replace(/_/g, " ");
  const isRed = result.ragStatus === "RED";
  return (
    <div className="rounded-2xl border border-[#CBD5E1] bg-[#FFFFFF] overflow-hidden border-l-4 border-l-[#CBD5E1]">
      <div className="bg-[#E2E8F0] px-4 py-3 flex items-center gap-2">
        <AlertTriangle size={14} className="text-foreground shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">Needs manual review</span>
        <span className="ml-auto text-[10px] text-foreground/40">{label}</span>
      </div>
      <div className="px-4 py-4 space-y-3">
        <p className="text-sm text-foreground/70 leading-relaxed">
          Zane identified an issue with this clause but could not generate a reliable recommendation automatically.
        </p>
        <div className="bg-[#FFFFFF] rounded-lg px-3 py-2.5 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/30">What was found</div>
          <p className="text-sm text-foreground/80">
            <span className={`font-semibold ${isRed ? "text-[#A32D2D]" : "text-[#854F0B]"}`}>
              {isRed ? "Problem" : "Worth negotiating"}:
            </span>{" "}
            {result.clauseSummary || result.founderPlainEnglish || "This clause deviates from your preferred position."}
          </p>
        </div>
        <p className="text-xs text-foreground/50 leading-relaxed">
          This clause should be reviewed by a qualified solicitor before you respond to the counterparty.
        </p>
        <div className="flex gap-2 pt-1">
          <a
            href="https://calendly.com/ahmedljasem/30min"
            target="_blank" rel="noopener noreferrer"
            className="flex-1 text-center px-3 py-2 rounded-lg border border-[#E6F1FB] text-[#2563EB] text-xs font-semibold hover:bg-[#FFFFFF] transition-colors"
          >
            Book a 30 min legal review
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Thumbs feedback on founder solution cards ─────────────────────────────────

function FounderFeedbackButtons({ resultId }: { resultId: string }) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const reasons = [
    "The figures are incorrect",
    "The email tone is wrong",
    "The replacement clause does not make sense",
    "The risk explanation is inaccurate",
    "Other",
  ];

  if (submitted) {
    return <p className="text-xs text-foreground/30 text-center py-1">Thanks for your feedback.</p>;
  }

  return (
    <div className="border-t border-white/8 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-foreground/30 uppercase tracking-widest">Was this helpful?</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setRating("up"); setSubmitted(true); }}
            className={`text-sm px-2 py-0.5 rounded transition-colors ${rating === "up" ? "bg-[#E7F6EE] text-foreground" : "text-foreground/30 hover:text-foreground/60"}`}
          >
            👍 Looks right
          </button>
          <button
            onClick={() => setRating(rating === "down" ? null : "down")}
            className={`text-sm px-2 py-0.5 rounded transition-colors ${rating === "down" ? "bg-[#FCEBEB] text-foreground" : "text-foreground/30 hover:text-foreground/60"}`}
          >
            👎 Something's wrong
          </button>
        </div>
      </div>
      {rating === "down" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {reasons.map(r => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={`text-[10px] px-2 py-1 rounded border transition-colors ${reason === r ? "border-primary bg-primary/10 text-white" : "border-white/10 text-foreground/40 hover:border-white/25"}`}
              >
                {r}
              </button>
            ))}
          </div>
          {reason && (
            <button
              onClick={() => {
                // Fire-and-forget: log feedback without blocking the UI
                void fetch(`/api/review-results/${resultId}/founder-feedback`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ rating: "down", reason }),
                }).catch(() => {});
                setSubmitted(true);
              }}
              className="text-xs px-3 py-1.5 rounded bg-primary text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Submit feedback
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Founder Solution Card, four collapsible sections ────────────────────────

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-foreground transition-colors px-2 py-1 rounded border border-[#E6F1FB] hover:border-[#3B82F6]"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> {label}</>}
    </button>
  );
}

function SolutionSection({
  title, preview, children, defaultOpen = false,
}: {
  title: string; preview?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-white/8">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/3 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <ChevronDown size={14} className={`text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {!open && preview && (
        <p className="px-4 pb-3 text-xs text-foreground/40 truncate">{preview}</p>
      )}
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function FounderSolutionCard({
  result,
  onFeedback,
}: {
  result: ReviewResult;
  onFeedback: (action: FeedbackAction, finalClauseText?: string) => Promise<FeedbackResponse | void>;
}) {
  // Reasoning capture: same flow as the corporate review. RED/AMBER clauses are
  // where a founder makes the unusual call (accepting a problem clause anyway),
  // so the significance check + prompt belong here too.
  const [reasoningPrompt, setReasoningPrompt] = useState<{ decisionEventId: string; significance: SignificanceResult } | null>(null);
  // Clean redrafted clause (drop-in), distinct from the negotiation message.
  const [amendedData, setAmendedData] = useState<{ original: string; revised: string; explanation: string } | null>(null);
  const [generatingAmended, setGeneratingAmended] = useState(false);

  async function runFeedback(action: FeedbackAction, finalClauseText?: string) {
    const res = await onFeedback(action, finalClauseText);
    if (res && res.significance?.significant && res.decisionEventId) {
      setReasoningPrompt({ decisionEventId: res.decisionEventId, significance: res.significance });
    }
  }

  async function handleGenerateRedraft() {
    setGeneratingAmended(true);
    try {
      setAmendedData(await generateAmendedClause(result.id));
    } catch { /* silent */ } finally {
      setGeneratingAmended(false);
    }
  }

  // Show fallback when verification explicitly failed
  if (result.founderVerificationPassed === false) {
    return <FounderFallbackCard result={result} />;
  }
  const label   = CLAUSE_LABELS[result.clauseCategory] ?? result.clauseCategory.replace(/_/g, " ");
  const isRed   = result.ragStatus === "RED";
  const isAmber = result.ragStatus === "AMBER";

  const borderColor  = isRed ? "border-l-[#FCEBEB]" : isAmber ? "border-l-[#FAEEDA]" : "border-l-[#E7F6EE]";
  const headerBg     = isRed ? "bg-[#FCEBEB]"         : isAmber ? "bg-[#FAEEDA]"         : "bg-[#E7F6EE]";
  const badgeColor   = isRed ? "bg-[#FCEBEB] text-foreground" : isAmber ? "bg-[#FAEEDA] text-foreground" : "bg-[#E7F6EE] text-foreground";
  const statusLabel  = isRed ? "Problem" : isAmber ? "Worth negotiating" : "Fine";

  // Section content, use stored founder fields with fallbacks
  const verdict      = result.founderPlainEnglish || result.businessSummary || result.clauseSummary || "No analysis available.";
  const riskIfSigned = result.founderIfIgnored || result.whyItMatters || "";
  const emailText    = result.founderCopyPaste || "";
  const replaceClause = result.suggestedFallback || "";
  const askFor       = result.founderAskFor || result.recommendedAction || "";

  // Parse email into subject + body if it contains subject-like structure
  const emailLines   = emailText.split("\n");
  const emailSubject = `Re: ${label} clause, amendment request`;
  const emailBody    = emailText.startsWith("Hi ") || emailText.startsWith("Dear ") ? emailText : emailText;

  return (
    <div className={`rounded-2xl overflow-hidden border border-white/8 border-l-4 ${borderColor}`}>
      {/* Header, always visible */}
      <div className={`${headerBg} px-4 py-4`}>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${badgeColor}`}>
            {statusLabel}
          </span>
          <span className="font-semibold text-foreground text-sm">{label}</span>
        </div>
        <p className="text-sm text-foreground/80 mt-2 leading-relaxed">{verdict}</p>
        {riskIfSigned && (
          <p className="text-xs text-foreground/50 mt-1.5 leading-relaxed italic">{riskIfSigned}</p>
        )}
      </div>

      {/* Section 2, Email to send */}
      {emailText && (
        <SolutionSection
          title="Message to counterparty →"
          preview={emailBody.slice(0, 80) + "…"}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40">Subject</span>
              <CopyButton text={`Subject: ${emailSubject}\n\n${emailBody}`} label="Copy email" />
            </div>
            <div className="text-xs text-foreground/60 bg-[#FFFFFF] rounded px-3 py-1.5 font-mono">{emailSubject}</div>
            <pre className="text-sm text-foreground/80 bg-[#FFFFFF] rounded px-3 py-3 leading-relaxed whitespace-pre-wrap font-sans max-h-64 overflow-y-auto">
              {emailBody}
            </pre>
          </div>
        </SolutionSection>
      )}

      {/* Section 3, Redrafted clause to drop in */}
      {replaceClause && (
        <SolutionSection
          title="Redrafted clause to drop in →"
          preview={replaceClause.slice(0, 80) + "…"}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground/40">Suggested replacement</span>
              <CopyButton text={replaceClause} label="Copy clause" />
            </div>
            <pre className="text-xs text-foreground/80 bg-[#FFFFFF] rounded px-3 py-3 leading-relaxed whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
              {replaceClause}
            </pre>
            {askFor && (
              <p className="text-xs text-foreground/50 leading-relaxed pt-1">{askFor}</p>
            )}
            {/* Clean, playbook-aligned drop-in version generated on demand */}
            {!amendedData ? (
              <button
                onClick={() => void handleGenerateRedraft()}
                disabled={generatingAmended}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                {generatingAmended
                  ? <><Loader2 size={11} className="animate-spin" /> Redrafting clause…</>
                  : <><FileText size={11} /> Generate a clean drop-in version</>}
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
        </SolutionSection>
      )}

      {/* Section 4, Risk if signed as-is */}
      {riskIfSigned && (
        <SolutionSection
          title="If you sign this as it stands →"
          preview={riskIfSigned.slice(0, 80) + "…"}
        >
          <p className="text-sm text-foreground/70 leading-relaxed">{riskIfSigned}</p>
        </SolutionSection>
      )}

      {/* Your decision: records the call and captures reasoning if it is unusual */}
      <div className="border-t border-white/8 px-4 py-3 space-y-2">
        <span className="text-[10px] text-foreground/30 uppercase tracking-widest">Your decision</span>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
            onClick={() => void runFeedback("ACCEPTED")}
          >
            <CheckCircle size={11} /> Accept anyway
          </button>
          <button
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
            onClick={() => void runFeedback("ESCALATED")}
          >
            <AlertTriangle size={11} /> Escalate to legal
          </button>
          <button
            className="btn-ghost text-xs px-3 py-1.5"
            onClick={() => void runFeedback("DISMISSED")}
          >
            Dismiss
          </button>
        </div>
        {reasoningPrompt && (
          <ReasoningPrompt
            significance={reasoningPrompt.significance}
            decisionEventId={reasoningPrompt.decisionEventId}
            onClose={() => setReasoningPrompt(null)}
          />
        )}
      </div>

      {/* Feedback buttons */}
      <FounderFeedbackButtons resultId={result.id} />
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

  // Negotiation email state: all hooks must be before early returns
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

  async function handleFeedback(resultId: string, action: FeedbackAction, finalClauseText?: string): Promise<FeedbackResponse | void> {
    const res = await saveFeedback(resultId, { userAction: action, finalClauseText });
    await queryClient.invalidateQueries({ queryKey: ["review", id] });
    return res;
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
          <div className="card p-8 space-y-6 border-[#E2E8F0]" style={{ background: "#FFFFFF" }}>
            <div className="flex items-center gap-3">
              <Sparkles size={18} className="text-[#2563EB]" />
              <div>
                <div className="font-semibold text-[#2563EB]">Zane is reviewing your contract</div>
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
                      ${done    ? "bg-[#E7F6EE] border-[#BBE6CC]" : ""}
                      ${active  ? "bg-[#FAEEDA] border-[#92400E] animate-pulse" : ""}
                      ${pending ? "bg-transparent border-[#E2E8F0]" : ""}`}>
                      {done   && <CheckCircle size={10} className="text-[#1B7A4B]" />}
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-[#854F0B]" />}
                    </div>
                    <span className={`text-sm leading-none transition-all
                      ${done    ? "text-muted-foreground line-through" : ""}
                      ${active  ? "text-[#854F0B] font-medium" : ""}
                      ${pending ? "text-muted-foreground/40" : ""}`}>
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-muted-foreground">Usually takes 1 to 3 minutes. This page auto-refreshes.</div>
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
    safe:    { label: "Looks good. You can proceed",              color: "text-foreground", bg: "bg-[#E7F6EE] border-[#E7F6EE]", icon: CheckCircle   },
    caution: { label: "Worth a closer look before signing",        color: "text-foreground", bg: "bg-[#FAEEDA] border-[#FAEEDA]", icon: AlertCircle   },
    danger:  { label: "Don't sign yet. Fix these first.",          color: "text-foreground", bg: "bg-[#FCEBEB] border-[#FCEBEB]", icon: AlertTriangle },
    pending: { label: "No playbook clauses matched this contract",  color: "text-foreground", bg: "bg-[#FFFFFF] border-[#CBD5E1]", icon: AlertCircle   },
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

        {/* ── Large prominent verdict banner ── */}
        <div className={`rounded-2xl border-2 p-7 text-center space-y-3 ${
          verdict === "danger"  ? "border-[#FCEBEB] bg-[#FCEBEB]" :
          verdict === "caution" ? "border-[#FAEEDA] bg-[#FAEEDA]" :
          verdict === "safe"    ? "border-[#E7F6EE] bg-[#E7F6EE]" :
          "border-[#CBD5E1] bg-[#FFFFFF]"
        }`}>
          <div className="flex items-center justify-center gap-2">
            <BannerIcon size={20} className="text-foreground" />
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {verdict === "danger"  ? "DO NOT SIGN YET" :
               verdict === "caution" ? "NEGOTIATE FIRST" :
               verdict === "safe"    ? "SAFE TO SIGN"    : "REVIEWING…"}
            </span>
          </div>
          <p className="text-foreground/70 text-sm max-w-sm mx-auto leading-relaxed">
            {verdict === "danger"  ? `${counts.RED} issue${counts.RED !== 1 ? "s" : ""} need${counts.RED === 1 ? "s" : ""} resolving first. Here is exactly what to do for each one.` :
             verdict === "caution" ? `${counts.AMBER} clause${counts.AMBER !== 1 ? "s" : ""} worth pushing back on. Here is what to say.` :
             verdict === "safe"    ? "No material issues found. You can proceed." :
             "Review in progress…"}
          </p>
          <div className="text-xs text-foreground/35">
            {counts.RED > 0 && <span className="mr-3">🔴 {counts.RED} problem{counts.RED !== 1 ? "s" : ""}</span>}
            {counts.AMBER > 0 && <span className="mr-3">🟡 {counts.AMBER} to negotiate</span>}
            {counts.GREEN > 0 && <span className="mr-3">🟢 {counts.GREEN} fine</span>}
            {counts.GREY > 0 && <span>⬜ {counts.GREY} missing</span>}
          </div>
        </div>

        {/* Top risks */}
        {topRisks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-[#854F0B]" />
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

        {/* Selection hint: shown when there are negotiable items */}
        {results.some((r) => r.ragStatus !== "GREEN") && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60 -mt-2">
            <Check size={11} />
            <span>
              {issueCount} issue{issueCount !== 1 ? "s" : ""} selected for negotiation email. Tap the{" "}
              <span className="font-semibold text-foreground/50">+</span> on any clause to include or exclude it
            </span>
          </div>
        )}

        {/* Clause cards, solution cards for RED/AMBER, standard for GREEN/GREY */}
        <div className="space-y-4">
          {filtered.map((result) => (
            result.ragStatus === "RED" || result.ragStatus === "AMBER" ? (
              <FounderSolutionCard
                key={result.id}
                result={result}
                onFeedback={(action, finalClauseText) => handleFeedback(result.id, action, finalClauseText)}
              />
            ) : (
              <FounderClauseCard
                key={result.id}
                result={result}
                expanded={expandedId === result.id}
                onToggle={() => setExpandedId(expandedId === result.id ? null : result.id)}
                onFeedback={(action, finalClauseText) => handleFeedback(result.id, action, finalClauseText)}
                selected={selectedIds.has(result.id)}
                onToggleSelect={() => toggleSelected(result.id)}
              />
            )
          ))}
          {filtered.length === 0 && (
            <div className="text-sm text-muted-foreground py-10 text-center">
              No clauses in this category.
            </div>
          )}
        </div>

        {/* ── Feature 4: Draft full negotiation response ─────────────── */}
        {(counts.RED + counts.AMBER + counts.GREY) > 0 && (
          <div className="rounded-2xl border border-[#E6F1FB] bg-[#FFFFFF] px-6 py-5 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-[#2563EB]" />
                <span className="font-semibold text-[#2563EB]">Draft full negotiation response</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Zane writes one professional email covering all the issues you want to raise, ready to edit and send.
              </p>
            </div>

            {issueCount > 0 && (
              <p className="text-xs text-[#2563EB]/80">
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

        {/* ── Persistent disclaimer ── */}
        <div className="rounded-xl border border-white/8 bg-[#FFFFFF] px-4 py-3">
          <p className="text-[11px] text-foreground/35 leading-relaxed text-center">
            Zane's output is based on the contract text you uploaded and your configured playbook positions.
            It is decision support, not legal advice. For contracts above £10,000 in value or involving
            unusual terms we recommend a qualified solicitor reviews before you sign.
          </p>
        </div>

        {/* ── Download all emails pack ── */}
        {(counts.RED + counts.AMBER) > 0 && (
          <div className="pt-2">
            <button
              onClick={() => {
                const emailResults = results.filter(
                  (r) => (r.ragStatus === "RED" || r.ragStatus === "AMBER") && (r.founderCopyPaste || r.suggestedFallback)
                );
                const text = emailResults.map((r) => {
                  const label = CLAUSE_LABELS[r.clauseCategory] ?? r.clauseCategory.replace(/_/g, " ");
                  const subject = `Re: ${label} clause, amendment request`;
                  const body    = r.founderCopyPaste || r.suggestedFallback || "";
                  return `═══════════════════════════════════════\n${label.toUpperCase()}\n═══════════════════════════════════════\nSubject: ${subject}\n\n${body}\n`;
                }).join("\n\n");
                const blob = new Blob([`NEGOTIATION EMAIL PACK\n${doc.originalName}\n\n${text}`], { type: "text/plain" });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement("a");
                a.href = url; a.download = "negotiation-emails.txt"; a.click();
                URL.revokeObjectURL(url);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[#E6F1FB] text-[#2563EB] text-sm font-semibold hover:bg-[#FFFFFF] transition-colors"
            >
              <Download size={15} /> Download all emails as a pack
            </button>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
