import { useQuery } from "@tanstack/react-query";
import {
  Activity, CheckCircle, AlertTriangle, Info, TrendingUp, ArrowRight,
  Users, GitMerge, AlertOctagon, TrendingDown,
} from "lucide-react";
import { Link } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import { getFeedbackPatterns, getOverrideTrend } from "../lib/api";
import type { MikePattern, CounterpartyPattern, NegotiationDrift, OverrideTrendEntry } from "../lib/api";
import { CLAUSE_LABELS } from "../lib/types";
import type { ClauseCategory } from "../lib/types";

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

function label(cat: string) {
  return CLAUSE_LABELS[cat as ClauseCategory] ?? cat.replace(/_/g, " ");
}

// ── Counterparty pattern card ──────────────────────────────────────────────────

function CounterpartyCard({ cp }: { cp: CounterpartyPattern }) {
  const total = cp.redCount + cp.amberCount;
  const redPct = total > 0 ? Math.round((cp.redCount / total) * 100) : 0;
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="text-sm font-medium">{cp.counterparty}</div>
          <div className="text-xs text-foreground/50">{label(cp.clauseCategory)}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-red-400">{cp.redCount}× RED</div>
          <div className="text-[10px] text-foreground/40">{cp.amberCount > 0 ? `+${cp.amberCount} amber` : "no amber"}</div>
        </div>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-red-400 rounded-full" style={{ width: `${redPct}%` }} />
      </div>
      {cp.acceptedRed > 0 && (
        <div className="mt-2 text-[10px] text-amber-400 flex items-center gap-1">
          <AlertTriangle size={9} />
          Accepted below red line {cp.acceptedRed} time{cp.acceptedRed !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

// ── Drift bar ─────────────────────────────────────────────────────────────────

function DriftBar({ entry }: { entry: NegotiationDrift }) {
  const severity = entry.driftPct >= 75 ? "text-red-400" : entry.driftPct >= 50 ? "text-amber-400" : "text-foreground/60";
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 shrink-0">
        <div className="text-xs font-medium truncate">{label(entry.clauseCategory)}</div>
        <div className="text-[10px] text-foreground/40">{entry.acceptedRed}/{entry.totalRed} accepted below red line</div>
      </div>
      <div className="flex-1">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${entry.driftPct >= 75 ? "bg-red-400" : entry.driftPct >= 50 ? "bg-amber-400" : "bg-foreground/30"}`}
            style={{ width: `${entry.driftPct}%` }}
          />
        </div>
      </div>
      <div className={`text-xs font-bold w-10 text-right shrink-0 ${severity}`}>{entry.driftPct}%</div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

// ── Override trend bar chart ──────────────────────────────────────────────────

function OverrideTrendSection() {
  const { data: trend, isLoading } = useQuery({
    queryKey: ["override-trend"],
    queryFn: getOverrideTrend,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !trend || trend.length === 0) return null;

  const maxRate = Math.max(...trend.map((t) => t.overrideRate), 1);
  const hasData = trend.some((t) => t.totalResults > 0);
  if (!hasData) return null;

  const first = trend.filter((t) => t.totalResults > 0)[0]?.overrideRate ?? 0;
  const last  = trend.filter((t) => t.totalResults > 0).slice(-1)[0]?.overrideRate ?? 0;
  const declining = last < first;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <Activity size={13} /> Override rate by month
        </h2>
        <div className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border ${
          declining
            ? "bg-[#052E16] border-[#14532D] text-[#86EFAC]"
            : "bg-[#1C0F00] border-[#431407] text-[#FCD34D]"
        }`}>
          {declining ? <><TrendingDown size={11} /> Zane is learning</> : <><TrendingUp size={11} /> Calibration needed</>}
        </div>
      </div>
      <div className="card p-4">
        <div className="flex items-end gap-2 h-24">
          {trend.map((entry: OverrideTrendEntry) => {
            const height = maxRate > 0 ? (entry.overrideRate / maxRate) * 100 : 0;
            return (
              <div key={entry.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div
                  className="w-full rounded-t-sm transition-all bg-[#2563EB]/60 group-hover:bg-[#2563EB]"
                  style={{ height: `${Math.max(height, entry.totalResults > 0 ? 4 : 0)}%` }}
                  title={`${entry.month}: ${entry.overrideRate}% override rate (${entry.overrideCount}/${entry.totalResults})`}
                />
                <div className="text-[9px] text-muted-foreground/50">{entry.month.slice(5)}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground/60">
          A declining override rate means Zane's analysis is aligning more closely with your team's judgement.
        </div>
      </div>
    </div>
  );
}

export default function Patterns() {
  const { data, isLoading } = useQuery({
    queryKey: ["feedback-patterns"],
    queryFn: getFeedbackPatterns,
    staleTime: 5 * 60 * 1000,
  });

  const patterns            = data?.patterns ?? [];
  const outcomes            = data?.clauseOutcomes ?? [];
  const counterpartyPats    = data?.counterpartyPatterns ?? [];
  const drift               = data?.negotiationDrift ?? [];

  const hasData = patterns.length > 0 || outcomes.length > 0;

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Activity size={22} className="text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Negotiation Intelligence</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Patterns, counterparty behaviour and negotiation drift detected from your review history.
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading patterns…</div>
        )}

        {!isLoading && !hasData && (
          <div className="card p-14 text-center space-y-5">
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mx-auto">
              <Activity size={24} className="text-muted-foreground/50" />
            </div>
            <div className="space-y-2">
              <div className="font-semibold">No patterns detected yet</div>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                Zane builds memory from your review decisions. After you accept, negotiate, or escalate clauses across
                5 or more contracts, patterns will surface here — recurring counterparty behaviour, clause types
                that consistently fail your playbook, and drift between your stated positions and actual outcomes.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              <Link to="/app/legal/dashboard" className="btn-primary gap-2">
                Review your first contract
                <ArrowRight size={14} />
              </Link>
              <p className="text-xs text-muted-foreground">Patterns emerge after feedback on 5+ reviews</p>
            </div>
          </div>
        )}

        {/* ── Zane notices ───────────────────────────────────────────────────── */}
        {patterns.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Info size={13} /> Zane noticed
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

        {/* ── Counterparty patterns ──────────────────────────────────────────── */}
        {counterpartyPats.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Users size={13} /> Counterparty behaviour
            </h2>
            <p className="text-xs text-muted-foreground -mt-1">
              These counterparties consistently push back on the same clause types across multiple contracts.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {counterpartyPats.map((cp, i) => (
                <CounterpartyCard key={i} cp={cp} />
              ))}
            </div>
          </div>
        )}

        {/* ── Negotiation drift ──────────────────────────────────────────────── */}
        {drift.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <GitMerge size={13} /> Negotiation position drift
            </h2>
            <p className="text-xs text-muted-foreground -mt-1">
              Clauses where you routinely accept below your playbook red line. High drift signals a mismatch between your stated position and actual practice.
            </p>
            <div className="card p-5 space-y-3">
              {drift.map((entry, i) => (
                <DriftBar key={i} entry={entry} />
              ))}
              {drift.some((d) => d.driftPct >= 50) && (
                <div className="pt-3 mt-3 border-t border-border/50">
                  <div className="flex items-start gap-2 text-xs text-amber-400">
                    <AlertOctagon size={12} className="shrink-0 mt-0.5" />
                    <span>High drift detected. Consider updating your playbook red lines to reflect your actual negotiation behaviour, or double down on enforcement.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Clause outcome breakdown ──────────────────────────────────────── */}
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
                      {label(o.clauseCategory)}
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
                  Consider reviewing your playbook positions or updating your hard red lines.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Override rate trend ────────────────────────────────────────────── */}
        <OverrideTrendSection />

      </div>
    </AppLayout>
  );
}
