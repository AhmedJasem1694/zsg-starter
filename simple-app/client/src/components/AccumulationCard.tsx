/**
 * AccumulationCard - Section 18, Step 7 (Dashboard)
 *
 * Shows the 4 accumulation stats, override rate trend, and an insight.
 */

import { useQuery } from "@tanstack/react-query";
import { Brain, TrendingDown, TrendingUp, Activity } from "lucide-react";
import { getAccumulationProgress } from "../lib/api";

export default function AccumulationCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["accumulation-progress"],
    queryFn: getAccumulationProgress,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !data) {
    return (
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain size={14} className="text-[#60A5FA]" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Zane learning</span>
        </div>
        <div className="h-20 flex items-center justify-center text-xs text-muted-foreground/40">Loading…</div>
      </div>
    );
  }

  const {
    contractsReviewed, outcomesLogged, patternsDetected, rulesActive,
    overrideRate, overrideRatePrev, insight,
  } = data;

  const overrideImproving = overrideRate < overrideRatePrev;
  const hasInsight = !!insight;

  const stats = [
    { label: "Contracts reviewed",  value: contractsReviewed, color: "#60A5FA" },
    { label: "Outcomes logged",     value: outcomesLogged,    color: "#86EFAC" },
    { label: "Patterns detected",   value: patternsDetected,  color: "#FCD34D" },
    { label: "Active rules",        value: rulesActive,       color: "#C4B5FD" },
  ];

  return (
    <div className="card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-[#60A5FA]" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Zane learning</span>
        </div>
        {overrideRate !== undefined && (
          <div className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${
            overrideImproving
              ? "bg-[#052E16] border-[#14532D] text-[#86EFAC]"
              : "bg-[#1C0F00] border-[#431407] text-[#FCD34D]"
          }`}>
            {overrideImproving
              ? <><TrendingDown size={11} /> {overrideRate}% override rate</>
              : <><TrendingUp size={11} /> {overrideRate}% override rate</>
            }
          </div>
        )}
      </div>

      {/* 2×2 grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-[#1E293B] bg-[#0B1118] px-3 py-2.5">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground/60 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Override rate trend */}
      {(overrideRate !== undefined && overrideRatePrev !== undefined) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
          <Activity size={11} />
          <span>
            Override rate:{" "}
            <span className={overrideImproving ? "text-[#86EFAC]" : "text-[#FCD34D]"}>
              {overrideRate}%
            </span>
            {" "}this month vs {overrideRatePrev}% last month
            {overrideImproving
              ? " - Zane is learning"
              : " - calibration needed"}
          </span>
        </div>
      )}

      {/* Insight */}
      {hasInsight && (
        <div className="text-xs text-muted-foreground/70 italic border-t border-[#1E293B] pt-3 leading-relaxed">
          {insight}
        </div>
      )}

      {!hasInsight && contractsReviewed === 0 && (
        <div className="text-xs text-muted-foreground/40 italic">
          Upload and review contracts to start building Zane's understanding of your negotiation patterns.
        </div>
      )}
    </div>
  );
}
