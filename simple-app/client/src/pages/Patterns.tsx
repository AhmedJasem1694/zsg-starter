import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle, AlertTriangle, Info, TrendingUp } from "lucide-react";
import AppLayout from "../components/layout/AppLayout";
import { getFeedbackPatterns } from "../lib/api";
import type { MikePattern } from "../lib/api";

function PatternIcon({ severity }: { severity: MikePattern["severity"] }) {
  if (severity === "good") return <CheckCircle  size={15} className="text-[#86EFAC] shrink-0 mt-0.5" />;
  if (severity === "warn") return <AlertTriangle size={15} className="text-[#FCD34D] shrink-0 mt-0.5" />;
  return                          <Info          size={15} className="text-[#60A5FA] shrink-0 mt-0.5" />;
}

const SEVERITY_CONFIG: Record<MikePattern["severity"], { bg: string; border: string }> = {
  good: { bg: "#052E16", border: "#14532D" },
  warn: { bg: "#1C0F00", border: "#431407" },
  info: { bg: "#172B4D", border: "#1E3A5F" },
};

export default function Patterns() {
  const { data, isLoading } = useQuery({
    queryKey: ["feedback-patterns"],
    queryFn: getFeedbackPatterns,
    staleTime: 5 * 60 * 1000,
  });

  const patterns = data?.patterns ?? [];
  const outcomes = data?.clauseOutcomes ?? [];

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Activity size={22} className="text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Patterns</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Recurring risk patterns detected across your contract reviews.
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading patterns…</div>
        )}

        {!isLoading && patterns.length === 0 && outcomes.length === 0 && (
          <div className="card p-12 text-center space-y-3">
            <Activity size={32} className="text-muted-foreground/30 mx-auto" />
            <div className="font-medium text-muted-foreground">No patterns detected yet</div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Zane builds patterns from your feedback. Accept, escalate or dismiss clause results
              on review pages to start building your pattern history.
            </p>
          </div>
        )}

        {patterns.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
              Detected patterns
            </h2>
            {patterns.map((p, i) => (
              <div
                key={i}
                className="card p-4 flex items-start gap-3"
                style={{ background: SEVERITY_CONFIG[p.severity].bg, borderColor: SEVERITY_CONFIG[p.severity].border }}
              >
                <PatternIcon severity={p.severity} />
                <p className="text-sm leading-relaxed">{p.message}</p>
              </div>
            ))}
          </div>
        )}

        {outcomes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={14} /> Clause outcome breakdown
            </h2>
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
                      ${o.accepted > 0 && o.redCount > 0 ? "bg-[#1C0F00]/60" : ""}`}
                  >
                    <span className="font-medium truncate">
                      {o.clauseCategory.replace(/_/g, " ")}
                    </span>
                    <span className="text-center text-muted-foreground text-xs w-12">{o.total}</span>
                    <span className={`text-center text-xs w-12 ${o.redCount > 0 ? "text-[#FCA5A5] font-semibold" : "text-muted-foreground"}`}>
                      {o.redCount || "—"}
                    </span>
                    <span className={`text-center text-xs w-16 ${o.accepted > 0 ? "font-medium" : "text-muted-foreground"}`}>
                      {o.accepted || "—"}
                    </span>
                    <span className={`text-center text-xs w-16 ${o.escalated > 0 ? "text-[#60A5FA] font-medium" : "text-muted-foreground"}`}>
                      {o.escalated || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {outcomes.some((o) => o.accepted > 0 && o.redCount > 0) && (
              <div className="card border-[#431407] bg-[#1C0F00] p-4">
                <div className="text-sm font-semibold text-[#FCD34D] mb-1">Negotiation drift detected</div>
                <p className="text-xs text-[#FCD34D]/80 leading-relaxed">
                  Some clause types have been accepted even when Zane flagged them RED.
                  Consider reviewing your playbook positions.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
