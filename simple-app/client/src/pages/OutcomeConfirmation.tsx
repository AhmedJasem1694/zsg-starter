/**
 * OutcomeConfirmation - Section 18, Step 1 (frontend)
 * Route: /app/legal/:id/outcome
 *
 * Quick triage screen for confirming how each negotiated clause resolved.
 */

import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, Loader2,
} from "lucide-react";
import { getOutcomeDeltas, confirmOutcomeDeltas } from "../lib/api";
import type { OutcomeDelta, DeltaOutcome } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import { CLAUSE_LABELS } from "../lib/types";
import type { ClauseCategory, RagStatus } from "../lib/types";

// ── Outcome badge config ──────────────────────────────────────────────────────

const OUTCOME_CONFIG: Record<DeltaOutcome, { label: string; bg: string; border: string; text: string }> = {
  PREFERRED:      { label: "Preferred",      bg: "#E7F6EE", border: "#E7F6EE", text: "#1B7A4B" },
  FALLBACK:       { label: "Fallback",        bg: "#FAEEDA", border: "#FAEEDA", text: "#854F0B" },
  BELOW_FALLBACK: { label: "Below fallback",  bg: "#FCEBEB", border: "#FCEBEB", text: "#A32D2D" },
  NO_CHANGE:      { label: "No change",       bg: "#FFFFFF", border: "#E2E8F0", text: "#64748B" },
  REMOVED:        { label: "Removed",         bg: "#EDE9FE", border: "#EDE9FE", text: "#6D28D9" },
};

const RAG_BADGE: Record<RagStatus, string> = {
  RED:   "rag-red",
  AMBER: "rag-amber",
  GREEN: "rag-green",
  GREY:  "rag-grey",
};

const ALL_OUTCOMES: DeltaOutcome[] = ["PREFERRED", "FALLBACK", "BELOW_FALLBACK", "NO_CHANGE", "REMOVED"];

// ── Delta card ────────────────────────────────────────────────────────────────

function DeltaCard({
  delta,
  selected,
  onSelect,
}: {
  delta: OutcomeDelta;
  selected: DeltaOutcome | "";
  onSelect: (outcome: DeltaOutcome) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const clauseLabel = CLAUSE_LABELS[delta.clauseCategory as ClauseCategory] ?? delta.clauseCategory.replace(/_/g, " ");
  const llmCfg = OUTCOME_CONFIG[delta.llmOutcome];
  const isConfirmed = !!selected;

  return (
    <div
      className="card overflow-hidden border border-[#E2E8F0]"
      style={{ borderLeftWidth: 4, borderLeftColor: isConfirmed ? "#1B7A4B" : "#E2E8F0" }}
    >
      {/* Header */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-sm font-semibold">{clauseLabel}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`rag-badge ${RAG_BADGE[delta.originalStatus as RagStatus] ?? "rag-grey"} text-[10px]`}>
                {delta.originalStatus}
              </span>
              <span className="text-[10px] text-muted-foreground">original status</span>
            </div>
          </div>
          {/* LLM suggested outcome */}
          <div
            className="rounded-lg px-3 py-1.5 text-xs font-medium border shrink-0"
            style={{ background: llmCfg.bg, borderColor: llmCfg.border, color: llmCfg.text }}
          >
            Zane: {llmCfg.label}
          </div>
        </div>

        {/* Outcome selector */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {ALL_OUTCOMES.map((outcome) => {
            const cfg = OUTCOME_CONFIG[outcome];
            const isSelected = selected === outcome;
            return (
              <button
                key={outcome}
                onClick={() => onSelect(outcome)}
                className="rounded-md px-3 py-1.5 text-xs font-medium border transition-all"
                style={{
                  background: isSelected ? cfg.bg : "transparent",
                  borderColor: isSelected ? cfg.border : "#E2E8F0",
                  color: isSelected ? cfg.text : "#64748B",
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Collapsible detail */}
        <button
          className="flex items-center gap-1 mt-3 text-xs text-muted-foreground hover:text-foreground/70 transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? "Hide reasoning" : "Show Zane's reasoning"}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-[#E2E8F0] px-5 py-4 space-y-3 bg-[#FFFFFF]/60">
          {delta.notes && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">LLM reasoning</div>
              <p className="text-xs text-foreground/70">{delta.notes}</p>
            </div>
          )}
          {delta.originalClauseText && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Original clause</div>
              <p className="text-xs text-foreground/60 line-clamp-4">{delta.originalClauseText}</p>
            </div>
          )}
          {delta.finalClauseText && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Final clause</div>
              <p className="text-xs text-foreground/60 line-clamp-4">{delta.finalClauseText}</p>
            </div>
          )}
          {delta.playbookPreferred && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Playbook preferred</div>
              <p className="text-xs text-foreground/60">{delta.playbookPreferred}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OutcomeConfirmation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["outcome-deltas", id],
    queryFn: () => getOutcomeDeltas(id!),
    enabled: !!id,
  });

  // Local state: confirmed outcome per delta
  const [selections, setSelections] = useState<Record<string, DeltaOutcome>>({});

  // Initialise selections from already-confirmed deltas
  const deltas = data?.deltas ?? [];
  const allDeltasMap = new Map(deltas.map((d) => [d.id, d]));

  function getEffectiveSelection(delta: OutcomeDelta): DeltaOutcome | "" {
    if (selections[delta.id]) return selections[delta.id];
    if (delta.confirmedOutcome) return delta.confirmedOutcome as DeltaOutcome;
    return delta.llmOutcome; // pre-fill with LLM suggestion
  }

  const confirmMutation = useMutation({
    mutationFn: () => {
      const confirmations = deltas.map((d) => ({
        deltaId: d.id,
        confirmedOutcome: getEffectiveSelection(d) as DeltaOutcome,
      })).filter((c) => c.confirmedOutcome);
      return confirmOutcomeDeltas(id!, confirmations);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["outcome-deltas", id] });
      navigate(`/app/legal/review/${id}`);
    },
  });

  const confirmedCount = deltas.filter((d) => !!getEffectiveSelection(d)).length;
  const progress = deltas.length > 0 ? (confirmedCount / deltas.length) * 100 : 0;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-3xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Loading outcomes…
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-3xl mx-auto">
          <div className="text-sm text-destructive">Failed to load outcome data.</div>
        </div>
      </AppLayout>
    );
  }

  // Already-confirmed completion state
  if (data.allConfirmed && !confirmMutation.isSuccess) {
    return (
      <AppLayout>
        <div className="px-6 py-8 max-w-3xl mx-auto space-y-5">
          <Link to={`/app/legal/review/${id}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground/80 transition-colors">
            <ArrowLeft size={14} /> Back to review
          </Link>
          <div className="card p-8 text-center space-y-3">
            <CheckCircle size={32} className="text-[#1B7A4B] mx-auto" />
            <div className="font-semibold text-[#1B7A4B]">All outcomes confirmed</div>
            <div className="text-sm text-muted-foreground">
              Zane has recorded how this contract was negotiated. These signals will inform future analysis.
            </div>
            <Link to={`/app/legal/review/${id}`} className="inline-block text-xs text-[#2563EB] hover:underline">
              Return to review →
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-6 py-6 max-w-3xl mx-auto space-y-5">

        {/* Back */}
        <Link
          to={`/app/legal/review/${id}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground/80 transition-colors"
        >
          <ArrowLeft size={14} /> Back to review
        </Link>

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold">Confirm negotiation outcomes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Confirm how each flagged clause resolved in the final signed version. Zane has pre-filled its best guess - correct any mistakes.
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{confirmedCount} of {deltas.length} confirmed</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1B7A4B] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Delta cards */}
        <div className="space-y-3">
          {deltas.length === 0 && (
            <div className="card p-8 text-center text-sm text-muted-foreground">
              <AlertTriangle size={20} className="mx-auto mb-2 text-amber-400" />
              No flagged clauses found for comparison.
              <br />This usually means the original review had no RED or AMBER results.
            </div>
          )}
          {deltas.map((delta) => (
            <DeltaCard
              key={delta.id}
              delta={delta}
              selected={selections[delta.id] ?? (delta.confirmedOutcome as DeltaOutcome) ?? delta.llmOutcome}
              onSelect={(outcome) => setSelections((prev) => ({ ...prev, [delta.id]: outcome }))}
            />
          ))}
        </div>

        {/* Footer action */}
        {deltas.length > 0 && (
          <div className="sticky bottom-4 pt-2">
            <button
              className="w-full flex items-center justify-center gap-2 bg-[#1D4ED8] hover:bg-[#2563EB] text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors disabled:opacity-60"
              disabled={confirmMutation.isPending || confirmedCount === 0}
              onClick={() => confirmMutation.mutate()}
            >
              {confirmMutation.isPending ? (
                <><Loader2 size={14} className="animate-spin" /> Saving…</>
              ) : (
                <><CheckCircle size={14} /> Confirm all & close ({confirmedCount}/{deltas.length})</>
              )}
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
