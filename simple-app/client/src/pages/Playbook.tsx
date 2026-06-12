import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Save, BarChart2, BookOpen, Sparkles, Loader2, Plus, X, Star, TrendingUp, AlertOctagon, CheckCircle, Shield, AlertTriangle, FileText } from "lucide-react";
import { getPlaybookRules, updatePlaybookRule, getFeedbackPatterns, generatePlaybookSuggestion, createPlaybookRule, getPlaybookDriftSuggestions, getCompanyRules, approveCompanyRule, rejectCompanyRule, updateCompanyRuleText, getClauseOutcomesExtended, getCompany, getCounterpartyIntelligence, generateBriefing } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import { CLAUSE_LABELS, type ClauseCategory, type PlaybookRule, type ApprovalRole } from "../lib/types";
import type { ClauseOutcome, PlaybookDriftSuggestion, CompanyRule, ExtendedClauseOutcome, CounterpartyIntelligenceEntry } from "../lib/api";
import { useFeatureFlags } from "../contexts/FeatureFlagsContext";
import UpgradePrompt from "../components/UpgradePrompt";

// ── Key clauses for demo highlight ───────────────────────────────────────────
// These are the 3 clause types that matter most in the majority of commercial contracts
const KEY_CLAUSE_CATEGORIES = ["LIABILITY_CAP", "INDEMNITY", "IP_OWNERSHIP"] as const;

const APPROVAL_OPTIONS = [
  { value: "",      label: "No approval needed" },
  { value: "LEGAL", label: "Legal team" },
  { value: "GC",    label: "General Counsel" },
  { value: "CFO",   label: "CFO" },
  { value: "BOARD", label: "Board" },
];

// ── Rule card ─────────────────────────────────────────────────────────────────

function RuleCard({ rule, outcome, counterpartyEntries }: { rule: PlaybookRule; outcome?: ClauseOutcome; counterpartyEntries?: CounterpartyIntelligenceEntry[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PlaybookRule>(rule);
  const [saved, setSaved] = useState(false);
  const [suggestion, setSuggestion] = useState<{ preferredPosition: string; acceptableFallback: string; hardRedLine: string } | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [cpOpen, setCpOpen] = useState(false);

  async function handleGenerateSuggestion() {
    setSuggestionLoading(true);
    try {
      const result = await generatePlaybookSuggestion(rule.clauseCategory, rule.workflowType);
      setSuggestion(result);
      setShowSuggestion(true);
    } finally {
      setSuggestionLoading(false);
    }
  }

  function applySuggestion() {
    if (!suggestion) return;
    setDraft((d) => ({
      ...d,
      preferredPosition: suggestion.preferredPosition,
      acceptableFallback: suggestion.acceptableFallback,
      hardRedLine: suggestion.hardRedLine,
    }));
    setShowSuggestion(false);
    setSuggestion(null);
  }

  const mut = useMutation({
    mutationFn: () => updatePlaybookRule(rule.id, {
      preferredPosition: draft.preferredPosition,
      acceptableFallback: draft.acceptableFallback,
      hardRedLine: draft.hardRedLine,
      approvalRequired: draft.approvalRequired,
      fallbackTemplate: draft.fallbackTemplate,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["playbook-rules"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const dirty = JSON.stringify(draft) !== JSON.stringify(rule);

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-sm font-semibold">{CLAUSE_LABELS[rule.clauseCategory as ClauseCategory]}</span>
          {/* Variance indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
            {outcome && outcome.total > 0 ? (
              <>
                <span className="text-white bg-[#052E16] border border-[#14532D] px-1.5 py-0.5 rounded-full">
                  Preferred {Math.round((outcome.greenCount / outcome.total) * 100)}%
                </span>
                <span className="text-white bg-[#1C0F00] border border-[#431407] px-1.5 py-0.5 rounded-full">
                  Fallback {Math.round((outcome.amberCount / outcome.total) * 100)}%
                </span>
                <span className="text-white bg-[#1F0A0A] border border-[#450A0A] px-1.5 py-0.5 rounded-full">
                  Below fallback {Math.round((outcome.redCount / outcome.total) * 100)}%
                </span>
              </>
            ) : (
              <span className="bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground/50">No outcomes yet</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {rule.approvalRequired && (
            <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full hidden sm:block">
              Escalates to {rule.approvalRequired}
            </span>
          )}
          {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-card-border px-5 pb-5 pt-4 space-y-4">

          {/* Outcome stats */}
          {outcome && outcome.total > 0 && (
            <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outcomes from your contracts</div>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: "Reviewed",   val: outcome.total,     color: "" },
                  { label: "RED",        val: outcome.redCount,   color: "text-[#FCA5A5]" },
                  { label: "AMBER",      val: outcome.amberCount, color: "text-[#FCD34D]" },
                  { label: "GREEN",      val: outcome.greenCount, color: "text-[#86EFAC]" },
                  { label: "Accepted",   val: outcome.accepted,   color: "text-foreground" },
                  { label: "Escalated",  val: outcome.escalated,  color: "text-[#60A5FA]" },
                ].map(({ label, val, color }) => val > 0 ? (
                  <div key={label} className="text-xs">
                    <span className={`font-semibold ${color}`}>{val}</span>
                    <span className="text-muted-foreground ml-1">{label}</span>
                  </div>
                ) : null)}
              </div>
              {outcome.accepted > 0 && outcome.redCount > 0 && (
                <p className="text-xs text-[#FCD34D]">
                  You accepted {outcome.accepted} clause{outcome.accepted > 1 ? "s" : ""} that Zane flagged as red.
                  Consider reviewing your position below.
                </p>
              )}
            </div>
          )}

          {/* CHANGE 3 — Drift visualisation */}
          {outcome && outcome.total >= 3 && (() => {
            const avgSigned =
              outcome.greenCount >= outcome.redCount + outcome.amberCount
                ? "preferred"
                : outcome.amberCount > outcome.redCount
                ? "fallback"
                : "below_fallback";
            const firstFiveWords = (rule.preferredPosition ?? CLAUSE_LABELS[rule.clauseCategory as ClauseCategory] ?? rule.clauseCategory)
              .split(" ").slice(0, 5).join(" ");
            return (
              <div className="rounded-lg bg-[#0B1118] border border-[#1E293B] px-4 py-3">
                <div className="flex items-center gap-6 text-xs">
                  <div>
                    <span className="text-muted-foreground/60">Written position: </span>
                    <span className="font-medium">{firstFiveWords}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground/60">Avg signed: </span>
                    <span className={avgSigned === "preferred" ? "text-[#86EFAC] font-semibold" : "text-[#FCA5A5] font-semibold"}>
                      {avgSigned === "preferred" ? "Preferred position" : avgSigned === "fallback" ? "Fallback" : "Below fallback"}
                    </span>
                  </div>
                  {avgSigned !== "preferred" && (
                    <span className="text-[10px] bg-[#1F0A0A] text-white border border-[#450A0A] rounded px-2 py-0.5">Drifting below preferred</span>
                  )}
                  {avgSigned === "preferred" && (
                    <span className="text-[10px] bg-[#052E16] text-white border border-[#14532D] rounded px-2 py-0.5">Tracking to preferred</span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Feature 39 - Generate suggested position */}
          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[#312E81] bg-[#1E1B4B] text-white hover:bg-[#312E81] transition-colors disabled:opacity-50"
              onClick={() => void handleGenerateSuggestion()}
              disabled={suggestionLoading}
            >
              {suggestionLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {suggestionLoading ? "Generating…" : "Generate suggested position"}
            </button>
            <span className="text-[10px] text-muted-foreground/60">Zane suggests a starting position based on market standards for your sector</span>
          </div>

          {/* Suggestion panel */}
          {showSuggestion && suggestion && (
            <div className="rounded-xl border border-[#312E81] bg-[#0F0E1A] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={12} className="text-[#A5B4FC]" />
                  <span className="text-xs font-semibold text-white">Suggested starting position</span>
                </div>
                <span className="text-[10px] text-white/50 bg-[#1E1B4B] border border-[#312E81] rounded px-2 py-0.5">
                  AI-generated. Review before saving.
                </span>
              </div>
              {[
                { label: "Preferred position",    value: suggestion.preferredPosition },
                { label: "Acceptable fallback",   value: suggestion.acceptableFallback },
                { label: "Hard red line",         value: suggestion.hardRedLine },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-white/50">{label}</div>
                  <div className="text-xs text-white leading-relaxed font-mono bg-[#1E1B4B] rounded-lg px-3 py-2">{value}</div>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors"
                  onClick={applySuggestion}
                >
                  <Sparkles size={11} /> Use this suggestion
                </button>
                <button
                  className="text-xs px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowSuggestion(false)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {[
            { field: "preferredPosition" as const, label: "Preferred position" },
            { field: "acceptableFallback" as const, label: "Acceptable fallback" },
            { field: "hardRedLine" as const, label: "Hard red line (non-negotiable)" },
            { field: "fallbackTemplate" as const, label: "Fallback wording template (optional)" },
          ].map(({ field, label }) => (
            <div key={field} className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
              <textarea
                className="input min-h-[80px] resize-y text-sm font-mono"
                value={draft[field] ?? ""}
                onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
              />
            </div>
          ))}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Who approves exceptions?</label>
            <select
              className="input text-sm"
              value={draft.approvalRequired ?? ""}
              onChange={(e) => setDraft({ ...draft, approvalRequired: (e.target.value || undefined) as ApprovalRole | undefined })}
            >
              {APPROVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* CHANGE 2 — Counterparty intelligence */}
          <div className="rounded-lg bg-[#0C1929] border border-[#1E3A5F] rounded-lg p-3">
            <button
              className="flex items-center justify-between w-full text-left"
              onClick={() => setCpOpen(!cpOpen)}
            >
              <span className="text-xs font-semibold text-white">
                Counterparty intelligence ({counterpartyEntries?.length ?? 0} counterparties tracked)
              </span>
              {cpOpen ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
            </button>
            {cpOpen && (
              <div className="mt-3 space-y-3">
                {!counterpartyEntries || counterpartyEntries.length === 0 ? (
                  <p className="text-xs text-muted-foreground/50">No counterparty data yet. This builds automatically as contracts are reviewed and outcomes logged.</p>
                ) : counterpartyEntries.map((entry) => (
                  <div key={entry.counterpartyName} className="space-y-0.5">
                    <div className="text-xs font-semibold text-white">{entry.counterpartyName}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      Accepted our preferred position in {entry.accepted} of {entry.total} contracts.{" "}
                      Pushed back in {entry.pushedBack} of {entry.total}.{" "}
                      Typical counter: {entry.typicalOutcome}.
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            {saved && <span className="text-xs text-[#86EFAC] flex items-center gap-1">✓ Saved</span>}
            <button
              className="btn-primary gap-2 text-sm"
              onClick={() => mut.mutate()}
              disabled={!dirty || mut.isPending}
            >
              <Save size={13} />
              {mut.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add clause panel ──────────────────────────────────────────────────────────

function AddClausePanel({ workflowType, onSaved, startOpen }: { workflowType?: string; onSaved: () => void; startOpen?: string }) {
  const [open, setOpen] = useState(!!startOpen);
  const [clauseCategory, setClauseCategory] = useState(startOpen ?? "");
  const [preferredPosition, setPreferredPosition] = useState("");
  const [acceptableFallback, setAcceptableFallback] = useState("");
  const [hardRedLine, setHardRedLine] = useState("");
  const [fallbackTemplate, setFallbackTemplate] = useState("");
  const [approvalRequired, setApprovalRequired] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleGenerate() {
    if (!clauseCategory.trim()) return;
    setGenerating(true);
    try {
      const result = await generatePlaybookSuggestion(clauseCategory, workflowType);
      setPreferredPosition(result.preferredPosition);
      setAcceptableFallback(result.acceptableFallback);
      setHardRedLine(result.hardRedLine);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!clauseCategory.trim()) return;
    setSaving(true);
    try {
      await createPlaybookRule({
        clauseCategory: clauseCategory.trim().toUpperCase().replace(/\s+/g, "_"),
        preferredPosition,
        acceptableFallback,
        hardRedLine,
        fallbackTemplate,
        approvalRequired: approvalRequired || undefined,
        workflowType,
      });
      setSaved(true);
      setTimeout(() => {
        setOpen(false);
        setSaved(false);
        setClauseCategory(""); setPreferredPosition(""); setAcceptableFallback("");
        setHardRedLine(""); setFallbackTemplate(""); setApprovalRequired("");
        onSaved();
      }, 800);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-[#475569] rounded-xl px-5 py-4 w-full transition-colors"
        onClick={() => setOpen(true)}
      >
        <Plus size={15} className="shrink-0" />
        Add clause position
      </button>
    );
  }

  return (
    <div className="card border-[#312E81] overflow-hidden" style={{ background: "#0F0E1A" }}>
      <div className="px-5 py-4 border-b border-[#312E81] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plus size={14} className="text-[#A5B4FC]" />
          <span className="text-sm font-semibold text-[#C4B5FD]">Add clause position</span>
        </div>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X size={15} />
        </button>
      </div>

      <div className="px-5 py-5 space-y-4">
        {/* Clause name + Generate */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Clause name</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="input text-sm flex-1"
              placeholder="e.g. Limitation of Liability, Data Protection, Force Majeure…"
              value={clauseCategory}
              onChange={(e) => setClauseCategory(e.target.value)}
            />
            <button
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[#312E81] bg-[#1E1B4B] text-white hover:bg-[#312E81] transition-colors disabled:opacity-50 shrink-0"
              onClick={() => void handleGenerate()}
              disabled={generating || !clauseCategory.trim()}
            >
              {generating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {generating ? "Generating…" : "Generate positions"}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/50">
            Enter the clause name then click Generate. Zane suggests a starting position based on market standards.
          </p>
        </div>

        {/* Fields */}
        {[
          { label: "Preferred position",                 key: "preferredPosition",  val: preferredPosition,  set: setPreferredPosition },
          { label: "Acceptable fallback",                key: "acceptableFallback", val: acceptableFallback, set: setAcceptableFallback },
          { label: "Hard red line (non-negotiable)",     key: "hardRedLine",        val: hardRedLine,        set: setHardRedLine },
          { label: "Suggested fallback wording (optional)", key: "fallbackTemplate", val: fallbackTemplate,  set: setFallbackTemplate },
        ].map(({ label, key, val, set }) => (
          <div key={key} className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
            <textarea
              className="input min-h-[72px] resize-y text-sm font-mono"
              value={val}
              onChange={(e) => set(e.target.value)}
              placeholder={`${label}…`}
            />
          </div>
        ))}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Who approves exceptions?</label>
          <select
            className="input text-sm"
            value={approvalRequired}
            onChange={(e) => setApprovalRequired(e.target.value)}
          >
            {APPROVAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 pt-1 border-t border-[#312E81]">
          {saved && <span className="text-xs text-[#86EFAC] flex items-center gap-1">✓ Clause added to playbook</span>}
          <div className="ml-auto flex gap-2">
            <button className="btn-ghost text-xs px-3 py-1.5" onClick={() => setOpen(false)}>Cancel</button>
            <button
              className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5"
              onClick={() => void handleSave()}
              disabled={saving || !clauseCategory.trim()}
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              {saving ? "Saving…" : "Add to playbook"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Outcomes tab ──────────────────────────────────────────────────────────────

function OutcomesView({ outcomes }: { outcomes: ClauseOutcome[] }) {
  if (outcomes.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-muted-foreground">
        No feedback data yet. Accept, escalate or dismiss clauses on your review pages to track outcomes here.
      </div>
    );
  }

  const drifted = outcomes.filter((o) => o.accepted > 0 && o.redCount > 0);
  const clean   = outcomes.filter((o) => o.greenCount > 0 && o.accepted === 0 && o.redCount === 0);

  return (
    <div className="space-y-6">
      {/* Drift alert */}
      {drifted.length > 0 && (
        <div className="card border-[#431407] bg-[#1C0F00] p-4 space-y-2">
          <div className="text-sm font-semibold text-[#FCD34D]">Negotiation drift detected</div>
          <p className="text-xs text-[#FCD34D] opacity-80">
            These clause types have been accepted even when Zane flagged them as red. Your team may be drifting from the playbook position.
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            {drifted.map((o) => (
              <span key={o.clauseCategory} className="text-xs bg-[#1C0F00] border border-[#431407] text-white px-2 py-0.5 rounded-full">
                {CLAUSE_LABELS[o.clauseCategory as ClauseCategory] ?? o.clauseCategory.replace(/_/g, " ")}
                {" "}({o.accepted}×)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Per-clause table */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            <span>Clause</span>
            <span className="text-center">Reviews</span>
            <span className="text-center text-[#FCA5A5]">Red</span>
            <span className="text-center text-[#86EFAC]">Accepted</span>
            <span className="text-center text-[#60A5FA]">Escalated</span>
          </div>
        </div>
        <div className="divide-y divide-card-border">
          {outcomes.map((o) => (
            <div
              key={o.clauseCategory}
              className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-3 text-sm
                ${o.accepted > 0 && o.redCount > 0 ? "bg-[#1C0F00]" : ""}`}
            >
              <span className="font-medium text-sm">
                {CLAUSE_LABELS[o.clauseCategory as ClauseCategory] ?? o.clauseCategory.replace(/_/g, " ")}
              </span>
              <span className="text-center text-muted-foreground text-xs w-12">{o.total}</span>
              <span className={`text-center text-xs w-12 ${o.redCount > 0 ? "text-[#FCA5A5] font-semibold" : "text-muted-foreground"}`}>
                {o.redCount || "-"}
              </span>
              <span className={`text-center text-xs w-16 ${o.accepted > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {o.accepted || "-"}
              </span>
              <span className={`text-center text-xs w-16 ${o.escalated > 0 ? "text-[#60A5FA] font-medium" : "text-muted-foreground"}`}>
                {o.escalated || "-"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Clean streak */}
      {clean.length > 0 && (
        <div className="card border-[#14532D] bg-[#052E16] p-4">
          <div className="text-sm font-semibold text-[#86EFAC] mb-1">Playbook holding strong</div>
          <p className="text-xs text-[#86EFAC] opacity-80">
            {clean.length} clause type{clean.length > 1 ? "s" : ""} ({clean.map((o) => CLAUSE_LABELS[o.clauseCategory as ClauseCategory] ?? o.clauseCategory.replace(/_/g, " ")).join(", ")}) have been consistently green.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Drift suggestions tab ─────────────────────────────────────────────────────

function DriftSuggestionsView({
  suggestions,
  isLoading,
  onApply,
}: {
  suggestions: PlaybookDriftSuggestion[];
  isLoading: boolean;
  onApply: (ruleId: string, preferredPosition: string, hardRedLine: string) => void;
}) {
  const [applied, setApplied] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 size={14} className="animate-spin" />
        Analysing your negotiation history…
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="card p-10 text-center space-y-3">
        <TrendingUp size={28} className="text-muted-foreground/30 mx-auto" />
        <div className="text-sm font-medium">No updates needed</div>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Your playbook positions appear to match your actual negotiation outcomes. Keep reviewing contracts and Zane will
          flag drift as it emerges.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card border-[#431407] bg-[#1C0F00] p-4 flex gap-3">
        <AlertOctagon size={15} className="text-[#FCD34D] shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold text-[#FCD34D]">Playbook drift detected</div>
          <p className="text-xs text-[#FCD34D]/80 mt-0.5">
            Zane has detected {suggestions.length} clause{suggestions.length !== 1 ? "s" : ""} where your team consistently accepts below the playbook red line.
            Review and apply the suggested updates below.
          </p>
        </div>
      </div>

      {suggestions.map((sug) => {
        const isApplied = applied.has(sug.clauseCategory);
        return (
          <div
            key={sug.clauseCategory}
            className={`card overflow-hidden ${isApplied ? "border-green-500/30" : ""}`}
          >
            <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">
                  {CLAUSE_LABELS[sug.clauseCategory as ClauseCategory] ?? sug.clauseCategory.replace(/_/g, " ")}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {sug.acceptedRed} of {sug.totalRed} RED clauses accepted · {sug.driftPct}% drift rate
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  sug.driftPct >= 75
                    ? "text-red-400 bg-red-500/10 border-red-500/30"
                    : "text-amber-400 bg-amber-500/10 border-amber-500/30"
                }`}>
                  {sug.driftPct}% drift
                </span>
              </div>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Zane's analysis</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{sug.reasoning}</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-blue-400">Suggested preferred position</div>
                  <div className="text-xs bg-card border border-border rounded-lg px-3 py-2 font-mono leading-relaxed text-foreground/80">
                    {sug.updatedPreferredPosition}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-red-400">Suggested red line</div>
                  <div className="text-xs bg-card border border-border rounded-lg px-3 py-2 font-mono leading-relaxed text-foreground/80">
                    {sug.updatedRedLine}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-amber-400 flex items-start gap-1.5">
                <AlertOctagon size={11} className="shrink-0 mt-0.5" />
                {sug.recommendation}
              </div>

              <div className="flex gap-2 pt-1 border-t border-border/50">
                {isApplied ? (
                  <div className="flex items-center gap-1.5 text-xs text-green-400">
                    <CheckCircle size={12} />
                    Applied - open the clause below to review and save.
                  </div>
                ) : (
                  <>
                    {sug.ruleId && (
                      <button
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                        onClick={() => {
                          onApply(sug.ruleId!, sug.updatedPreferredPosition, sug.updatedRedLine);
                          setApplied((prev) => { const n = new Set(Array.from(prev)); n.add(sug.clauseCategory); return n; });
                        }}
                      >
                        <Sparkles size={11} />
                        Apply suggestion
                      </button>
                    )}
                    <button className="text-xs px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors">
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

// ── Pending Rules view ────────────────────────────────────────────────────────

function PendingRulesView() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["company-rules"],
    queryFn: getCompanyRules,
    staleTime: 2 * 60 * 1000,
  });

  const pendingRules = data?.PENDING ?? [];
  const activeRules = data?.ACTIVE ?? [];

  const approveMut = useMutation({
    mutationFn: (id: string) => approveCompanyRule(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["company-rules"] }),
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => rejectCompanyRule(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["company-rules"] }),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  function startEdit(rule: CompanyRule) {
    setEditingId(rule.id);
    setEditText(rule.editedRuleText || rule.ruleText);
  }

  async function saveEdit(ruleId: string) {
    await updateCompanyRuleText(ruleId, editText);
    setEditingId(null);
    void queryClient.invalidateQueries({ queryKey: ["company-rules"] });
  }

  async function approveWithEdit(ruleId: string) {
    if (editingId === ruleId) {
      await updateCompanyRuleText(ruleId, editText);
    }
    approveMut.mutate(ruleId);
    setEditingId(null);
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Loading rules…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Pending */}
      {pendingRules.length === 0 && activeRules.length === 0 ? (
        <div className="card p-8 text-center space-y-2">
          <Shield size={24} className="mx-auto text-muted-foreground/40" />
          <div className="text-sm font-medium text-muted-foreground">No pending rules</div>
          <p className="text-xs text-muted-foreground/60 max-w-sm mx-auto">
            As Zane detects patterns in your overrides and negotiated outcomes, it will suggest rules here for GC approval.
          </p>
        </div>
      ) : (
        <>
          {pendingRules.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={13} className="text-[#FCD34D]" />
                <span className="text-sm font-semibold">{pendingRules.length} pending rule{pendingRules.length !== 1 ? "s" : ""} - awaiting GC approval</span>
              </div>
              {pendingRules.map((rule) => (
                <div key={rule.id} className="card overflow-hidden border-l-4 border-l-[#431407]">
                  <div className="px-5 py-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-[#FCD34D] uppercase tracking-wide">
                          {CLAUSE_LABELS[rule.clauseCategory as ClauseCategory] ?? rule.clauseCategory.replace(/_/g, " ")}
                        </div>
                        <div className="text-[11px] text-muted-foreground/60 mt-0.5">
                          {rule.generatedFrom === "OUTCOME_PATTERN"
                            ? `${rule.evidenceCount} contract${rule.evidenceCount !== 1 ? "s" : ""} accepted below fallback`
                            : `Same override ${rule.evidenceCount} time${rule.evidenceCount !== 1 ? "s" : ""}`}
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded border border-[#431407] bg-[#1C0F00] text-white shrink-0">
                        {rule.generatedFrom === "OUTCOME_PATTERN" ? "Outcome pattern" : "Override pattern"}
                      </span>
                    </div>

                    {/* Rule text (editable) */}
                    {editingId === rule.id ? (
                      <textarea
                        className="w-full rounded-lg border border-[#2563EB] bg-[#0B1118] px-3 py-2.5 text-sm text-foreground focus:outline-none min-h-[80px] resize-y"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                      />
                    ) : (
                      <div
                        className="text-sm text-foreground leading-relaxed px-3 py-2.5 rounded-lg border border-[#1E293B] bg-[#0B1118] cursor-pointer hover:border-[#2563EB] transition-colors"
                        onClick={() => startEdit(rule)}
                        title="Click to edit"
                      >
                        {rule.editedRuleText || rule.ruleText}
                      </div>
                    )}

                    {/* Risk assessment */}
                    {rule.riskAssessment && (
                      <div className="text-xs text-muted-foreground/70 italic border-l-2 border-[#431407] pl-3">
                        {rule.riskAssessment}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {editingId === rule.id ? (
                        <>
                          <button
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[#052E16] border border-[#14532D] text-white hover:bg-[#14532D] transition-colors"
                            onClick={() => void approveWithEdit(rule.id)}
                            disabled={approveMut.isPending}
                          >
                            <CheckCircle size={11} /> Approve with edits
                          </button>
                          <button
                            className="text-xs px-3 py-1.5 rounded-md border border-[#1E293B] text-muted-foreground hover:border-[#475569] transition-colors"
                            onClick={() => void saveEdit(rule.id)}
                          >
                            Save only
                          </button>
                          <button
                            className="text-xs px-2 py-1.5 text-muted-foreground/50 hover:text-muted-foreground"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[#052E16] border border-[#14532D] text-[#86EFAC] hover:bg-[#14532D] transition-colors disabled:opacity-50"
                            onClick={() => approveMut.mutate(rule.id)}
                            disabled={approveMut.isPending}
                          >
                            <CheckCircle size={11} /> Approve
                          </button>
                          <button
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[#1E293B] text-muted-foreground hover:border-[#2563EB] hover:text-[#60A5FA] transition-colors"
                            onClick={() => startEdit(rule)}
                          >
                            Edit & approve
                          </button>
                          <button
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[#450A0A] text-[#FCA5A5] hover:bg-[#1F0A0A] transition-colors disabled:opacity-50"
                            onClick={() => rejectMut.mutate(rule.id)}
                            disabled={rejectMut.isPending}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active rules */}
          {activeRules.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield size={13} className="text-[#86EFAC]" />
                <span className="text-sm font-semibold text-[#86EFAC]">{activeRules.length} active rule{activeRules.length !== 1 ? "s" : ""}</span>
              </div>
              {activeRules.map((rule) => (
                <div key={rule.id} className="card px-4 py-3 border-l-4 border-l-[#14532D]">
                  <div className="flex items-start gap-3">
                    <CheckCircle size={13} className="text-[#86EFAC] shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[#86EFAC]">
                        {CLAUSE_LABELS[rule.clauseCategory as ClauseCategory] ?? rule.clauseCategory.replace(/_/g, " ")}
                      </div>
                      <p className="text-xs text-foreground/70 mt-0.5">{rule.editedRuleText || rule.ruleText}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Extended outcomes view ────────────────────────────────────────────────────

function ExtendedOutcomesView({ outcomes, extendedOutcomes }: { outcomes: ClauseOutcome[]; extendedOutcomes: ExtendedClauseOutcome[] }) {
  const extMap = new Map(extendedOutcomes.map((o) => [o.clauseCategory, o]));

  if (outcomes.length === 0 && extendedOutcomes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground/60 py-6 text-center">
        No feedback data yet. Accept, escalate or dismiss clauses on your review pages to track outcomes here.
      </div>
    );
  }

  const merged = outcomes.length > 0 ? outcomes : extendedOutcomes.map((o) => ({
    clauseCategory: o.clauseCategory,
    total: o.total,
    accepted: o.accepted,
    escalated: o.escalated,
    dismissed: 0,
    redCount: o.redCount,
    amberCount: 0,
    greenCount: 0,
  }));

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1E293B] text-left text-muted-foreground/60">
              <th className="pb-2 pr-4 font-medium">Clause</th>
              <th className="pb-2 px-3 font-medium text-center">Reviews</th>
              <th className="pb-2 px-3 font-medium text-center">Red</th>
              <th className="pb-2 px-3 font-medium text-center">Accepted</th>
              <th className="pb-2 px-3 font-medium text-center">Avg signed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]/50">
            {merged.map((o) => {
              const ext = extMap.get(o.clauseCategory);
              const avgSigned = ext?.avgSignedOutcome ?? "UNKNOWN";
              const belowFallbackRate = ext?.belowFallbackRate ?? 0;

              const avgColor =
                avgSigned === "BELOW_FALLBACK" ? "text-[#FCA5A5]" :
                avgSigned === "FALLBACK" ? "text-[#FCD34D]" :
                avgSigned === "PREFERRED" ? "text-[#86EFAC]" :
                "text-muted-foreground/50";

              return (
                <tr key={o.clauseCategory}>
                  <td className="py-2.5 pr-4 font-medium">
                    {CLAUSE_LABELS[o.clauseCategory as ClauseCategory] ?? o.clauseCategory.replace(/_/g, " ")}
                  </td>
                  <td className="py-2.5 px-3 text-center text-muted-foreground">{o.total}</td>
                  <td className="py-2.5 px-3 text-center">
                    {o.redCount > 0 ? <span className="text-[#FCA5A5]">{o.redCount}</span> : <span className="text-muted-foreground/40">-</span>}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {o.accepted > 0 ? <span className="text-[#FCD34D]">{o.accepted}</span> : <span className="text-muted-foreground/40">-</span>}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {avgSigned !== "UNKNOWN" ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`font-medium ${avgColor}`}>{avgSigned.replace(/_/g, " ")}</span>
                        {belowFallbackRate > 0 && (
                          <span className="text-[10px] text-[#FCA5A5]/60">{belowFallbackRate}% below fallback</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/40">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Demo outcome data for Meridian Financial Technologies ────────────────────
const MERIDIAN_DEMO_OUTCOMES: Record<string, ClauseOutcome> = {
  LIABILITY_CAP:  { clauseCategory: "LIABILITY_CAP",   total: 6, greenCount: 3, amberCount: 2, redCount: 1, accepted: 1, escalated: 1, dismissed: 0 },
  INDEMNITY:      { clauseCategory: "INDEMNITY",       total: 4, greenCount: 2, amberCount: 2, redCount: 0, accepted: 0, escalated: 0, dismissed: 0 },
  PAYMENT_TERMS:  { clauseCategory: "PAYMENT_TERMS",   total: 5, greenCount: 1, amberCount: 3, redCount: 1, accepted: 1, escalated: 0, dismissed: 0 },
  IP_OWNERSHIP:   { clauseCategory: "IP_OWNERSHIP",    total: 4, greenCount: 4, amberCount: 0, redCount: 0, accepted: 0, escalated: 0, dismissed: 0 },
  CONFIDENTIALITY:{ clauseCategory: "CONFIDENTIALITY", total: 4, greenCount: 3, amberCount: 1, redCount: 0, accepted: 0, escalated: 0, dismissed: 0 },
  GOVERNING_LAW:  { clauseCategory: "GOVERNING_LAW",   total: 5, greenCount: 5, amberCount: 0, redCount: 0, accepted: 0, escalated: 0, dismissed: 0 },
  AUTO_RENEWAL:   { clauseCategory: "AUTO_RENEWAL",    total: 4, greenCount: 0, amberCount: 2, redCount: 2, accepted: 2, escalated: 0, dismissed: 0 },
  TERMINATION:    { clauseCategory: "TERMINATION",     total: 4, greenCount: 3, amberCount: 1, redCount: 0, accepted: 0, escalated: 0, dismissed: 0 },
};

export default function Playbook() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"playbook" | "outcomes" | "updates" | "rules">("playbook");
  const [quickAddCategory, setQuickAddCategory] = useState<string | undefined>(undefined);

  const { data: rulesData, isLoading } = useQuery({
    queryKey: ["playbook-rules"],
    queryFn: getPlaybookRules,
  });
  const rules = rulesData?.rules ?? [];
  const playbookVersion = rulesData?.playbookVersion ?? 1;

  const { data: patternsData } = useQuery({
    queryKey: ["feedback-patterns"],
    queryFn: getFeedbackPatterns,
    staleTime: 5 * 60 * 1000,
  });

  const { data: driftData, isLoading: driftLoading } = useQuery({
    queryKey: ["playbook-drift-suggestions"],
    queryFn: getPlaybookDriftSuggestions,
    staleTime: 10 * 60 * 1000,
    enabled: tab === "updates",
  });

  const { data: companyRulesData } = useQuery({
    queryKey: ["company-rules"],
    queryFn: getCompanyRules,
    staleTime: 2 * 60 * 1000,
    enabled: tab === "rules",
  });

  const { data: extendedOutcomes } = useQuery({
    queryKey: ["clause-outcomes-extended"],
    queryFn: getClauseOutcomesExtended,
    staleTime: 5 * 60 * 1000,
    enabled: tab === "outcomes",
  });

  const pendingRulesCount = companyRulesData?.PENDING?.length ?? 0;

  // Get company for workflowType (for suggestion context)
  const { data: company } = useQuery({
    queryKey: ["company"],
    queryFn: getCompany,
    retry: false,
  });
  const workflowType = (company as { workflowType?: string } | undefined)?.workflowType;

  // CHANGE 2 — Counterparty intelligence
  const { data: counterpartyData } = useQuery({
    queryKey: ["counterparty-intelligence"],
    queryFn: getCounterpartyIntelligence,
    staleTime: 5 * 60 * 1000,
  });

  const { flags } = useFeatureFlags();

  // CHANGE 5 — Briefing state
  const [showBriefing, setShowBriefing] = useState(false);
  const [briefingText, setBriefingText] = useState("");
  const [briefingLoading, setBriefingLoading] = useState(false);

  const isMeridianDemo = (company as { name?: string } | undefined)?.name?.toLowerCase().includes("meridian") ?? false;
  const demoOutcomes: ClauseOutcome[] = isMeridianDemo
    ? Object.entries(MERIDIAN_DEMO_OUTCOMES).map(([, o]) => ({ ...o }))
    : [];

  const rawOutcomes = (patternsData?.clauseOutcomes ?? []).length > 0
    ? (patternsData?.clauseOutcomes ?? [])
    : demoOutcomes;

  const outcomeMap = new Map<string, ClauseOutcome>(
    rawOutcomes.map((o) => [o.clauseCategory, o])
  );

  // Apply a drift suggestion to a playbook rule in the local state
  const applyDriftSuggestion = async (ruleId: string, preferredPosition: string, hardRedLine: string) => {
    await updatePlaybookRule(ruleId, { preferredPosition, hardRedLine });
    void queryClient.invalidateQueries({ queryKey: ["playbook-rules"] });
  };

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Playbook</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Your legal positions for each clause type and how they compare to your actual negotiation outcomes.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            {!isLoading && (
              <span className="text-[11px] text-muted-foreground/60 border border-border rounded-full px-2.5 py-1">
                v{playbookVersion}
              </span>
            )}
            {flags.newHireBriefing ? (
              <button
                className="btn-secondary flex items-center gap-1.5 text-sm"
                onClick={() => {
                  setBriefingLoading(true);
                  generateBriefing()
                    .then((result) => {
                      setBriefingText(result.briefing);
                      setShowBriefing(true);
                    })
                    .catch(() => {})
                    .finally(() => setBriefingLoading(false));
                }}
                disabled={briefingLoading}
              >
                {briefingLoading ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                {briefingLoading ? "Generating…" : "Generate new hire briefing"}
              </button>
            ) : (
              <button
                className="btn-secondary flex items-center gap-1.5 text-sm opacity-60 cursor-default"
                onClick={() => {}}
                title="Upgrade to Team to unlock new hire briefing"
              >
                <FileText size={13} />
                New hire briefing
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded ml-1">Team</span>
              </button>
            )}
          </div>
        </div>

        {/* CHANGE 4 — Playbook health score (Team+) */}
        {!flags.playbookHealthScore && (
          <UpgradePrompt feature="Playbook Health Score" requiredTier="team" />
        )}
        {flags.playbookHealthScore && (() => {
          const clauseOutcomesForHealth = patternsData?.clauseOutcomes ?? [];
          const withData = clauseOutcomesForHealth.filter((o) => o.total >= 1);
          const healthyCount = withData.filter((o) => o.greenCount / o.total >= 0.5).length;
          const totalWithData = withData.length;
          const driftingCount = totalWithData - healthyCount;
          const healthPct = totalWithData > 0 ? Math.round(healthyCount / totalWithData * 100) : null;
          return (
            <div className="card p-4 flex items-center gap-6">
              {healthPct !== null ? (
                <>
                  <div>
                    <div className={`text-2xl font-bold ${healthPct >= 70 ? "text-[#86EFAC]" : healthPct >= 40 ? "text-[#FCD34D]" : "text-[#FCA5A5]"}`}>{healthPct}%</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Playbook Health</div>
                  </div>
                  <div className="text-sm">
                    <p>{healthyCount} of {totalWithData} clause categories tracking to your preferred positions.</p>
                    {driftingCount > 0 && <p className="text-xs text-muted-foreground mt-0.5">{driftingCount} categor{driftingCount === 1 ? "y" : "ies"} showing drift below preferred.</p>}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Playbook health will appear after your first contracts are reviewed and outcomes are logged.</p>
              )}
            </div>
          );
        })()}

        {/* Tabs — drift visualisation gated below in RuleCard via flags prop */}
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <button
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === "playbook" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("playbook")}
          >
            <BookOpen size={14} />
            My Positions
          </button>
          <button
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === "outcomes" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("outcomes")}
          >
            <BarChart2 size={14} />
            Outcomes
            {(patternsData?.clauseOutcomes ?? []).length > 0 && (
              <span className="ml-1 text-[10px] bg-primary text-white rounded-full px-1.5 py-0.5">
                {(patternsData?.clauseOutcomes ?? []).length}
              </span>
            )}
          </button>
          <button
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === "updates" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("updates")}
          >
            <Sparkles size={14} />
            Suggested Updates
          </button>
          <button
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === "rules" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("rules")}
          >
            <Shield size={14} />
            Pending Rules
            {pendingRulesCount > 0 && (
              <span className="ml-1 text-[10px] bg-[#431407] text-white rounded-full px-1.5 py-0.5">
                {pendingRulesCount}
              </span>
            )}
          </button>
        </div>

        {tab === "playbook" ? (
          isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Loading playbook…</div>
          ) : rules.length === 0 ? (
            <div className="space-y-8">
              <div className="text-center py-10 space-y-4">
                <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mx-auto">
                  <BookOpen size={22} className="text-muted-foreground/50" />
                </div>
                <div className="space-y-2">
                  <div className="text-base font-semibold">Your playbook is empty.</div>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Add your first clause position to start reviewing contracts against your own standards rather than generic market defaults.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  {[
                    { cat: "LIABILITY_CAP", label: "Limitation of Liability" },
                    { cat: "DATA_PRIVACY",  label: "Data and Privacy" },
                    { cat: "GOVERNING_LAW", label: "Governing Law" },
                  ].map(({ cat, label }) => (
                    <button
                      key={cat}
                      className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                      onClick={() => setQuickAddCategory(cat)}
                    >
                      <Plus size={13} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <AddClausePanel
                workflowType={workflowType}
                onSaved={() => { setQuickAddCategory(undefined); void queryClient.invalidateQueries({ queryKey: ["playbook-rules"] }); }}
                startOpen={quickAddCategory}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Key positions callout - 3 most critical clauses for commercial contracts */}
              {rules.some((r) => KEY_CLAUSE_CATEGORIES.includes(r.clauseCategory as typeof KEY_CLAUSE_CATEGORIES[number])) && (
                <div className="rounded-xl border border-[#1B2D4A] p-4 space-y-3" style={{ background: "#0C1929" }}>
                  <div className="flex items-center gap-2">
                    <Star size={13} className="text-[#60A5FA]" />
                    <span className="text-xs font-semibold text-[#60A5FA]">Key positions</span>
                    <span className="text-xs text-muted-foreground ml-1">- the 3 clauses that matter most in commercial contracts</span>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {rules
                      .filter((r) => KEY_CLAUSE_CATEGORIES.includes(r.clauseCategory as typeof KEY_CLAUSE_CATEGORIES[number]))
                      .map((rule) => (
                        <div key={rule.id} className="rounded-lg border border-[#1E3A5F] bg-[#0F1F35] px-3 py-3 space-y-2">
                          <div className="text-xs font-semibold text-white">
                            {CLAUSE_LABELS[rule.clauseCategory as ClauseCategory] ?? rule.clauseCategory.replace(/_/g, " ")}
                          </div>
                          {rule.preferredPosition ? (
                            <p className="text-[11px] text-white/70 leading-relaxed line-clamp-3 font-mono">
                              {rule.preferredPosition}
                            </p>
                          ) : (
                            <p className="text-[11px] text-white/40 italic">No position set - click to configure</p>
                          )}
                          {rule.hardRedLine && (
                            <div className="flex items-center gap-1 text-[10px] text-white/80">
                              <div className="w-1 h-1 rounded-full bg-white/80 shrink-0" />
                              Red line set
                            </div>
                          )}
                          {rule.approvalRequired && (
                            <div className="text-[10px] text-muted-foreground/50">
                              Escalates to {rule.approvalRequired}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground/50">
                    Open any clause below to review or update your full position, fallback language, and approval routing.
                  </p>
                </div>
              )}

              {/* Full clause list */}
              {rules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  outcome={outcomeMap.get(rule.clauseCategory)}
                  counterpartyEntries={counterpartyData?.intelligence[rule.clauseCategory]}
                />
              ))}
              <AddClausePanel
                workflowType={workflowType}
                onSaved={() => void queryClient.invalidateQueries({ queryKey: ["playbook-rules"] })}
              />

            </div>
          )
        ) : tab === "outcomes" ? (
          <ExtendedOutcomesView
            outcomes={patternsData?.clauseOutcomes ?? []}
            extendedOutcomes={extendedOutcomes ?? []}
          />
        ) : tab === "rules" ? (
          <PendingRulesView />
        ) : (
          <DriftSuggestionsView
            suggestions={driftData?.suggestions ?? []}
            isLoading={driftLoading}
            onApply={(ruleId, pos, rl) => void applyDriftSuggestion(ruleId, pos, rl)}
          />
        )}
      </div>
      {/* CHANGE 5 — Briefing modal */}
      {showBriefing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowBriefing(false)}>
          <div className="bg-[#111A24] border border-[#1E293B] rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E293B]">
              <span className="font-semibold">New Hire Legal Briefing</span>
              <div className="flex items-center gap-2">
                <button onClick={() => { void navigator.clipboard.writeText(briefingText); }} className="btn-secondary text-xs px-3 py-1.5">Copy</button>
                <button onClick={() => setShowBriefing(false)} className="text-muted-foreground hover:text-foreground">×</button>
              </div>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <pre className="text-sm text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">{briefingText}</pre>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
