import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Save, BarChart2, BookOpen } from "lucide-react";
import { getPlaybookRules, updatePlaybookRule, getFeedbackPatterns } from "../lib/api";
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
                  ⚠ You accepted {outcome.accepted} clause{outcome.accepted > 1 ? "s" : ""} that MIKE flagged.
                  Consider reviewing your position below.
                </p>
              )}
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

// ── Outcomes tab ──────────────────────────────────────────────────────────────

function OutcomesView({ outcomes }: { outcomes: ClauseOutcome[] }) {
  if (outcomes.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-muted-foreground">
        No feedback data yet — accept, escalate or dismiss clauses on your review pages to track outcomes here.
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
            These clause types have been accepted even when MIKE flagged them as RED —
            your team may be drifting from your playbook position.
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
  const [tab, setTab] = useState<"playbook" | "outcomes">("playbook");

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["playbook-rules"],
    queryFn: getPlaybookRules,
  });

  const { data: patternsData } = useQuery({
    queryKey: ["feedback-patterns"],
    queryFn: getFeedbackPatterns,
    staleTime: 5 * 60 * 1000,
  });

  const outcomeMap = new Map<string, ClauseOutcome>(
    (patternsData?.clauseOutcomes ?? []).map((o) => [o.clauseCategory, o])
  );

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Playbook</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your legal positions for each clause type — and how they compare to your actual outcomes.
          </p>
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
            <div className="card p-8 text-center text-sm text-muted-foreground">
              No playbook rules found. Go through onboarding to set up your playbook.
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <RuleCard key={rule.id} rule={rule} outcome={outcomeMap.get(rule.clauseCategory)} />
              ))}
            </div>
          )
        ) : (
          <OutcomesView outcomes={patternsData?.clauseOutcomes ?? []} />
        )}
      </div>
    </AppLayout>
  );
}
