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
          <Brain size={14} className="text-[#2563EB]" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Zane learning</span>
        </div>
        <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">Loading…</div>
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
    { label: "Contracts reviewed",  value: contractsReviewed, color: "#2563EB" },
    { label: "Outcomes logged",     value: outcomesLogged,    color: "#1B7A4B" },
    { label: "Patterns detected",   value: patternsDetected,  color: "#854F0B" },
    { label: "Active rules",        value: rulesActive,       color: "#6D28D9" },
  ];

  return (
    <div className="card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-[#2563EB]" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Zane learning</span>
        </div>
        {overrideRate !== undefined && (
          <div className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${
            overrideImproving
              ? "bg-[#E7F6EE] border-[#BBE6CC] text-[#1B7A4B]"
              : "bg-[#FAEEDA] border-[#F5D9AE] text-[#854F0B]"
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
          <div key={s.label} className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2.5">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Override rate trend */}
      {(overrideRate !== undefined && overrideRatePrev !== undefined) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity size={11} />
          <span>
            Override rate:{" "}
            <span className={overrideImproving ? "text-[#1B7A4B]" : "text-[#854F0B]"}>
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
        <div className="text-xs text-muted-foreground italic border-t border-[#E2E8F0] pt-3 leading-relaxed">
          {insight}
        </div>
      )}

      {!hasInsight && contractsReviewed === 0 && (
        <div className="text-xs text-muted-foreground italic">
          Upload and review contracts to start building Zane's understanding of your negotiation patterns.
        </div>
      )}
    </div>
  );
}
