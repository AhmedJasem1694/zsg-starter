import { useQuery } from "@tanstack/react-query";
import {
  Activity, CheckCircle, AlertTriangle, Info, TrendingUp, ArrowRight,
  Users, GitMerge, AlertOctagon, TrendingDown, BookOpen, Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import { getFeedbackPatterns, getOverrideTrend, getCompany } from "../lib/api";
import type { ZanePattern, CounterpartyPattern, NegotiationDrift, OverrideTrendEntry, ClauseOutcome } from "../lib/api";
import { CLAUSE_LABELS } from "../lib/types";
import type { ClauseCategory } from "../lib/types";

function label(cat: string) {
  return CLAUSE_LABELS[cat as ClauseCategory] ?? cat.replace(/_/g, " ");
}

// ── Enriched pattern shape ─────────────────────────────────────────────────────

interface EnrichedPattern {
  severity: ZanePattern["severity"];
  name: string;
  description: string;
  frequency: string;
  commercialImpact: string;
  counterparties: string[];
  suggestedAction: string;
  clauseCategory?: string;
}

// ── Demo patterns for Meridian account ────────────────────────────────────────

const MERIDIAN_DEMO_PATTERNS: EnrichedPattern[] = [
  {
    severity: "warn",
    name: "Liability cap erosion — Technology vendors",
    description: "Across 6 technology contracts, counterparties have consistently pushed liability caps below 1× annual fees. You have accepted this in 3 of 6 reviews.",
    frequency: "6 contracts reviewed — 4 flagged RED",
    commercialImpact: "Estimated £2.4M in uncapped exposure across the portfolio if any single vendor causes a material service failure.",
    counterparties: ["Apex Systems Ltd", "DataFlow Technologies", "Vertex Cloud"],
    suggestedAction: "Update playbook to require 2× annual fees as the minimum acceptable cap. Add to red-line enforcement for vendor agreements.",
    clauseCategory: "LIABILITY_CAP",
  },
  {
    severity: "warn",
    name: "Auto-renewal accepted without notice period",
    description: "4 contracts contain auto-renewal clauses with no notice period or a notice period shorter than 30 days. 2 have already renewed without commercial review.",
    frequency: "4 contracts — 2 renewed without review",
    commercialImpact: "An estimated £340K in committed spend renewed automatically. One contract includes a price escalation clause triggered at renewal.",
    counterparties: ["Nexus Analytics", "CoreData Inc"],
    suggestedAction: "Require a minimum 60-day notice period in all auto-renewal clauses. Flag contracts renewing within 90 days for review in the Timings page.",
    clauseCategory: "AUTO_RENEWAL",
  },
  {
    severity: "info",
    name: "Indemnity scope — consistently broad",
    description: "Counterparties are requesting broad indemnity clauses covering consequential and indirect losses. These have been escalated 3 times but not yet resolved.",
    frequency: "4 contracts — 3 escalated for approval",
    commercialImpact: "Broad indemnity exposure across 4 active contracts. If any claim is brought, consequential loss liability is uncapped.",
    counterparties: ["Apex Systems Ltd", "Meridian Supply Co"],
    suggestedAction: "Narrow indemnity to direct losses only. Use the standard fallback wording in the Playbook for Indemnity clauses.",
    clauseCategory: "INDEMNITY",
  },
  {
    severity: "good",
    name: "Governing law — 100% aligned",
    description: "All 5 contracts reviewed contain English law and English courts jurisdiction. This is consistent with your playbook preferred position.",
    frequency: "5 contracts reviewed — 5 GREEN",
    commercialImpact: "No jurisdictional risk identified. Consistent governing law across the portfolio simplifies dispute resolution.",
    counterparties: [],
    suggestedAction: "No action required. Continue enforcing English law as a non-negotiable position.",
    clauseCategory: "GOVERNING_LAW",
  },
];

// ── Enrich real patterns from data ────────────────────────────────────────────

const PATTERN_META: Record<string, { name: string; impact: string; action: string }> = {
  repeated_acceptance: {
    name: "Repeated red-line acceptance",
    impact: "Accumulated liability exposure from accepting terms below your stated red line.",
    action: "Review your playbook position for this clause type and consider tightening enforcement.",
  },
  repeated_escalation: {
    name: "Consistent escalation pattern",
    impact: "Operational delays and approval bottlenecks are slowing contract execution.",
    action: "Delegate approval authority or clarify playbook guidance to reduce escalations.",
  },
  frequently_absent: {
    name: "Clause frequently missing",
    impact: "Unprotected risk exposure where protective language should exist.",
    action: "Request this clause proactively in your standard template.",
  },
  high_red_acceptance: {
    name: "High red acceptance rate",
    impact: "Systematic playbook erosion — your stated positions may not reflect actual practice.",
    action: "Recalibrate your playbook to reflect realistic negotiation positions.",
  },
  clean_streak: {
    name: "Strong playbook alignment",
    impact: "Reduced legal risk across your contract portfolio.",
    action: "Maintain current playbook positions — continue monitoring.",
  },
};

function enrichPattern(
  p: ZanePattern,
  outcomes: ClauseOutcome[],
  counterpartyPats: CounterpartyPattern[],
): EnrichedPattern {
  const meta = PATTERN_META[p.type] ?? { name: p.type.replace(/_/g, " "), impact: "Review required.", action: "Consult your playbook." };

  // Try to extract a clause category from the message
  let relatedOutcome: ClauseOutcome | undefined;
  for (const o of outcomes) {
    const clauseLabel = label(o.clauseCategory).toLowerCase();
    if (p.message.toLowerCase().includes(clauseLabel)) {
      relatedOutcome = o;
      break;
    }
  }

  const frequency = relatedOutcome
    ? `${relatedOutcome.total} contracts reviewed — ${relatedOutcome.redCount} flagged RED`
    : "Multiple contracts reviewed";

  const relatedCounterparties = relatedOutcome
    ? counterpartyPats
        .filter((cp) => cp.clauseCategory === relatedOutcome!.clauseCategory && cp.redCount > 0)
        .slice(0, 3)
        .map((cp) => cp.counterparty)
    : [];

  return {
    severity: p.severity,
    name: meta.name,
    description: p.message,
    frequency,
    commercialImpact: meta.impact,
    counterparties: relatedCounterparties,
    suggestedAction: meta.action,
    clauseCategory: relatedOutcome?.clauseCategory,
  };
}

// ── Severity config ────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<ZanePattern["severity"], {
  bg: string; border: string; badge: string; badgeText: string; icon: React.ReactNode;
}> = {
  good: {
    bg: "#052E16", border: "#14532D",
    badge: "bg-[#14532D] text-[#86EFAC]", badgeText: "Positive pattern",
    icon: <CheckCircle size={14} className="text-[#86EFAC] shrink-0" />,
  },
  warn: {
    bg: "#1C0F00", border: "#431407",
    badge: "bg-[#431407] text-[#FCD34D]", badgeText: "Action recommended",
    icon: <AlertTriangle size={14} className="text-[#FCD34D] shrink-0" />,
  },
  info: {
    bg: "#172B4D", border: "#1E3A5F",
    badge: "bg-[#1E3A5F] text-[#93C5FD]", badgeText: "Monitor",
    icon: <Info size={14} className="text-[#93C5FD] shrink-0" />,
  },
};

// ── Rich pattern card ─────────────────────────────────────────────────────────

function PatternCard({ pattern }: { pattern: EnrichedPattern }) {
  const cfg = SEVERITY_CONFIG[pattern.severity];
  return (
    <div
      className="rounded-xl border p-5 space-y-4"
      style={{ background: cfg.bg, borderColor: cfg.border }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {cfg.icon}
          <div>
            <div className="text-sm font-semibold leading-snug">{pattern.name}</div>
            <p className="text-xs text-foreground/70 mt-1 leading-relaxed">{pattern.description}</p>
          </div>
        </div>
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md shrink-0 ${cfg.badge}`}>
          {cfg.badgeText}
        </span>
      </div>

      {/* Data grid */}
      <div className="grid sm:grid-cols-2 gap-3">
        {/* Frequency */}
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-foreground/40 font-medium mb-1">Frequency</div>
          <div className="text-xs text-foreground/80 leading-relaxed">{pattern.frequency}</div>
        </div>

        {/* Commercial impact */}
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-foreground/40 font-medium mb-1">Commercial impact</div>
          <div className="text-xs text-foreground/80 leading-relaxed">{pattern.commercialImpact}</div>
        </div>

        {/* Counterparties */}
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-foreground/40 font-medium mb-1">Counterparties involved</div>
          {pattern.counterparties.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {pattern.counterparties.map((cp) => (
                <span key={cp} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-foreground/70 border border-white/10">{cp}</span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-foreground/40">No specific counterparty identified</div>
          )}
        </div>

        {/* Suggested action */}
        <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-foreground/40 font-medium mb-1">Suggested action</div>
          <div className="text-xs text-foreground/80 leading-relaxed">{pattern.suggestedAction}</div>
        </div>
      </div>

      {/* Footer button */}
      <div className="pt-1 border-t border-white/5">
        <Link
          to={pattern.clauseCategory
            ? `/app/legal/playbook?clause=${pattern.clauseCategory}`
            : "/app/legal/playbook"
          }
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#60A5FA] hover:text-[#93C5FD] transition-colors"
        >
          <BookOpen size={11} />
          Update playbook position
          <ArrowRight size={10} />
        </Link>
      </div>
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

// ── Counterparty card ──────────────────────────────────────────────────────────

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

// ── Override trend ─────────────────────────────────────────────────────────────

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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Patterns() {
  const { data, isLoading } = useQuery({
    queryKey: ["feedback-patterns"],
    queryFn: getFeedbackPatterns,
    staleTime: 5 * 60 * 1000,
  });
  const { data: company } = useQuery({ queryKey: ["company"], queryFn: getCompany, retry: false });

  const isMeridianDemo = (company as { name?: string } | undefined)?.name?.toLowerCase().includes("meridian") ?? false;

  const patterns            = data?.patterns ?? [];
  const outcomes            = data?.clauseOutcomes ?? [];
  const counterpartyPats    = data?.counterpartyPatterns ?? [];
  const drift               = data?.negotiationDrift ?? [];

  const hasData = patterns.length > 0 || outcomes.length > 0 || isMeridianDemo;

  // Build enriched patterns for display
  const enrichedPatterns: EnrichedPattern[] = isMeridianDemo
    ? MERIDIAN_DEMO_PATTERNS
    : patterns.map((p) => enrichPattern(p, outcomes, counterpartyPats));

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
              <Link to="/app/legal/library" className="btn-primary gap-2">
                Review a contract
                <ArrowRight size={14} />
              </Link>
              <p className="text-xs text-muted-foreground">Patterns emerge after feedback on 5+ reviews</p>
            </div>
          </div>
        )}

        {/* ── Pattern cards ───────────────────────────────────────────────────── */}
        {enrichedPatterns.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Zap size={13} /> Detected patterns
              </h2>
              <span className="text-xs text-muted-foreground">{enrichedPatterns.length} pattern{enrichedPatterns.length !== 1 ? "s" : ""} detected</span>
            </div>
            <div className="space-y-3">
              {enrichedPatterns.map((p, i) => (
                <PatternCard key={i} pattern={p} />
              ))}
            </div>
          </div>
        )}

        {/* ── Counterparty patterns ──────────────────────────────────────────── */}
        {!isMeridianDemo && counterpartyPats.length > 0 && (
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
        {!isMeridianDemo && drift.length > 0 && (
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
        {!isMeridianDemo && outcomes.length > 0 && (
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
                    <span className="font-medium truncate">{label(o.clauseCategory)}</span>
                    <span className="text-center text-muted-foreground text-xs w-12">{o.total}</span>
                    <span className={`text-center text-xs w-12 ${o.redCount > 0 ? "text-[#FCA5A5] font-semibold" : "text-muted-foreground"}`}>
                      {o.redCount || "-"}
                    </span>
                    <span className={`text-center text-xs w-16 ${o.accepted > 0 ? "font-medium" : "text-muted-foreground"}`}>
                      {o.accepted || "-"}
                    </span>
                    <span className={`text-center text-xs w-16 ${o.escalated > 0 ? "text-[#60A5FA] font-medium" : "text-muted-foreground"}`}>
                      {o.escalated || "-"}
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
        {!isMeridianDemo && <OverrideTrendSection />}

      </div>
    </AppLayout>
  );
}
