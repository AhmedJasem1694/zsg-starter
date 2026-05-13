import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Save, BarChart2, BookOpen, Sparkles, Loader2, Plus, X } from "lucide-react";
import { getPlaybookRules, updatePlaybookRule, getFeedbackPatterns, generatePlaybookSuggestion, createPlaybookRule } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import { CLAUSE_LABELS, type ClauseCategory, type PlaybookRule, type ApprovalRole } from "../lib/types";
import type { ClauseOutcome } from "../lib/api";

const APPROVAL_OPTIONS = [
  { value: "",      label: "No approval needed" },
  { value: "LEGAL", label: "Legal team" },
  { value: "GC",    label: "General Counsel" },
  { value: "CFO",   label: "CFO" },
  { value: "BOARD", label: "Board" },
];

// ── Rule card ─────────────────────────────────────────────────────────────────

function RuleCard({ rule, outcome }: { rule: PlaybookRule; outcome?: ClauseOutcome }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PlaybookRule>(rule);
  const [saved, setSaved] = useState(false);
  const [suggestion, setSuggestion] = useState<{ preferredPosition: string; acceptableFallback: string; hardRedLine: string } | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);

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
          {/* Drift indicator */}
          {outcome && outcome.total > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
              <span className="bg-muted px-1.5 py-0.5 rounded-full">{outcome.total} reviews</span>
              {outcome.redCount > 0 && outcome.accepted > 0 && (
                <span className="text-[#FCD34D] bg-[#1C0F00] border border-[#431407] px-1.5 py-0.5 rounded-full">
                  {outcome.accepted} accepted
                </span>
              )}
              {outcome.escalated > 0 && (
                <span className="text-[#60A5FA] bg-[#172B4D] border border-[#1E3A5F] px-1.5 py-0.5 rounded-full">
                  {outcome.escalated} escalated
                </span>
              )}
            </div>
          )}
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

          {/* Feature 39 — Generate suggested position */}
          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[#312E81] bg-[#1E1B4B] text-[#A5B4FC] hover:bg-[#312E81] transition-colors disabled:opacity-50"
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
                  <span className="text-xs font-semibold text-[#C4B5FD]">Suggested starting position</span>
                </div>
                <span className="text-[10px] text-muted-foreground/50 bg-[#1E1B4B] border border-[#312E81] rounded px-2 py-0.5">
                  AI-generated. Review before saving.
                </span>
              </div>
              {[
                { label: "Preferred position",    value: suggestion.preferredPosition },
                { label: "Acceptable fallback",   value: suggestion.acceptableFallback },
                { label: "Hard red line",         value: suggestion.hardRedLine },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-[#7C3AED]/70">{label}</div>
                  <div className="text-xs text-[#C4B5FD] leading-relaxed font-mono bg-[#1E1B4B] rounded-lg px-3 py-2">{value}</div>
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

function AddClausePanel({ workflowType, onSaved }: { workflowType?: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [clauseCategory, setClauseCategory] = useState("");
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
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[#312E81] bg-[#1E1B4B] text-[#A5B4FC] hover:bg-[#312E81] transition-colors disabled:opacity-50 shrink-0"
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
              <span key={o.clauseCategory} className="text-xs bg-[#1C0F00] border border-[#431407] text-[#FCD34D] px-2 py-0.5 rounded-full">
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
                {o.redCount || "—"}
              </span>
              <span className={`text-center text-xs w-16 ${o.accepted > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {o.accepted || "—"}
              </span>
              <span className={`text-center text-xs w-16 ${o.escalated > 0 ? "text-[#60A5FA] font-medium" : "text-muted-foreground"}`}>
                {o.escalated || "—"}
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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Playbook() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"playbook" | "outcomes">("playbook");

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

  // Get company for workflowType (for suggestion context)
  const { data: company } = useQuery({
    queryKey: ["company"],
    queryFn: () => import("../lib/api").then((m) => m.getCompany()),
    retry: false,
  });
  const workflowType = (company as { workflowType?: string } | undefined)?.workflowType;

  const outcomeMap = new Map<string, ClauseOutcome>(
    (patternsData?.clauseOutcomes ?? []).map((o) => [o.clauseCategory, o])
  );

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
          {!isLoading && (
            <span className="text-[11px] text-muted-foreground/60 border border-border rounded-full px-2.5 py-1 shrink-0 mt-1">
              v{playbookVersion}
            </span>
          )}
        </div>

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
        </div>

        {tab === "playbook" ? (
          isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Loading playbook…</div>
          ) : rules.length === 0 ? (
            <div className="card p-8 text-center space-y-2">
              <div className="text-sm font-medium text-muted-foreground">No playbook rules found</div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Add preferred positions, fallback language and approval triggers before running reviews.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <RuleCard key={rule.id} rule={rule} outcome={outcomeMap.get(rule.clauseCategory)} />
              ))}
              <AddClausePanel
                workflowType={workflowType}
                onSaved={() => void queryClient.invalidateQueries({ queryKey: ["playbook-rules"] })}
              />
            </div>
          )
        ) : (
          <OutcomesView outcomes={patternsData?.clauseOutcomes ?? []} />
        )}
      </div>
    </AppLayout>
  );
}
