import { useQuery } from "@tanstack/react-query";
import {
  Activity, CheckCircle, AlertTriangle, Info, TrendingUp, ArrowRight,
  Users, GitMerge, AlertOctagon, TrendingDown, BookOpen, Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import { getFeedbackPatterns, getOverrideTrend } from "../lib/api";
import type { ZanePattern, CounterpartyPattern, NegotiationDrift, OverrideTrendEntry, ClauseOutcome } from "../lib/api";
import { CLAUSE_LABELS } from "../lib/types";
import type { ClauseCategory } from "../lib/types";
import { useFeatureFlags } from "../contexts/FeatureFlagsContext";
import UpgradePrompt from "../components/UpgradePrompt";

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

// ── Enrich real patterns from data ────────────────────────────────────────────

const PATTERN_META: Record<string, { name: string; action: string }> = {
  below_playbook_acceptance: {
    name: "Repeated acceptance below playbook",
    action: "Review your playbook position for this clause. Either hold the line at the next renewal, or move the stated position to where you actually settle.",
  },
  auto_renewal_exposure: {
    name: "Automatic renewal exposure",
    action: "Diarise each renewal window now, and reopen the notice period at the next negotiation.",
  },
  recurring_red: {
    name: "Recurring red position",
    action: "Review your playbook position for this clause. Either tighten enforcement or move your stated red line to where you actually settle.",
  },
  counterparty_concentration: {
    name: "Counterparty position",
    action: "Prepare a fallback for this clause before the next negotiation with this counterparty.",
  },
  repeated_acceptance: {
    name: "Repeated red-line acceptance",
    action: "Review your playbook position for this clause type and consider tightening enforcement.",
  },
  repeated_escalation: {
    name: "Consistent escalation pattern",
    action: "Delegate approval authority or clarify playbook guidance to reduce escalations.",
  },
  frequently_absent: {
    name: "Clause frequently missing",
    action: "Request this clause proactively in your standard template.",
  },
  high_red_acceptance: {
    name: "High red acceptance rate",
    action: "Recalibrate your playbook to reflect realistic negotiation positions.",
  },
  consistently_clean: {
    name: "Position holding",
    action: "No action required. Continue enforcing this position.",
  },
  clean_streak: {
    name: "Strong playbook alignment",
    action: "Maintain current playbook positions. Continue monitoring.",
  },
};

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };

function enrichPattern(p: ZanePattern, outcomes: ClauseOutcome[], currency: string): EnrichedPattern {
  const meta = PATTERN_META[p.type] ?? { name: p.type.replace(/_/g, " "), action: "Consult your playbook." };
  const outcome = p.clauseCategory ? outcomes.find((o) => o.clauseCategory === p.clauseCategory) : undefined;

  // The server sends a {clause} token so the display label stays consistent
  // with the rest of the app rather than the raw category name.
  const description = p.clauseCategory
    ? p.message.replace(/\{clause\}/g, label(p.clauseCategory))
    : p.message.replace(/\{clause\}/g, "This clause");

  const plural = (n: number) => `${n} contract${n !== 1 ? "s" : ""}`;

  // Frequency must count what the pattern actually detected. A counterparty
  // pattern counts that counterparty's contracts and an acceptance pattern
  // counts acceptances, otherwise the two numbers on the card contradict.
  const FREQUENCY_BY_TYPE: Record<string, string> = {
    counterparty_concentration: `${plural(p.contractsAffected)} with this counterparty`,
    below_playbook_acceptance: `${plural(p.contractsAffected)} accepted below playbook`,
    auto_renewal_exposure: `${plural(p.contractsAffected)} renewing automatically`,
  };
  const frequency = FREQUENCY_BY_TYPE[p.type]
    ?? (outcome
      ? `${outcome.redCount} of ${outcome.total} reviews flagged RED`
      : p.contractsAffected > 0
        ? `${plural(p.contractsAffected)} affected`
        : "Across your review history");

  // Only ever states figures that exist in the data. Where no contract value is
  // recorded, it says so rather than estimating an exposure.
  const sym = CURRENCY_SYMBOLS[currency] ?? "";
  const commercialImpact = p.severity === "good"
    ? "No exposure identified from this position."
    : p.valueAffected != null
      ? `${sym}${p.valueAffected.toLocaleString("en-GB")} of contract value across ${plural(p.contractsAffected)} carrying this position.`
      : p.contractsAffected > 0
        ? `${plural(p.contractsAffected)} affected. No contract value recorded for these.`
        : "No contract value recorded.";

  return {
    severity: p.severity,
    name: meta.name,
    description,
    frequency,
    commercialImpact,
    counterparties: p.counterparties,
    // The server sends an action citing the company's own playbook rule where
    // one exists; the generic wording is only a fallback.
    suggestedAction: p.suggestedAction ?? meta.action,
    clauseCategory: p.clauseCategory,
  };
}

// ── Severity config ────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<ZanePattern["severity"], {
  bg: string; border: string; badge: string; badgeText: string; icon: React.ReactNode;
}> = {
  good: {
    bg: "#E7F6EE", border: "#E7F6EE",
    badge: "bg-[#E7F6EE] text-foreground", badgeText: "Positive pattern",
    icon: <CheckCircle size={14} className="text-foreground shrink-0" />,
  },
  warn: {
    bg: "#FAEEDA", border: "#FAEEDA",
    badge: "bg-[#FAEEDA] text-foreground", badgeText: "Action recommended",
    icon: <AlertTriangle size={14} className="text-foreground shrink-0" />,
  },
  info: {
    bg: "#E6F1FB", border: "#E6F1FB",
    badge: "bg-[#E6F1FB] text-foreground", badgeText: "Monitor",
    icon: <Info size={14} className="text-foreground shrink-0" />,
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
        <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Frequency</div>
          <div className="text-xs text-foreground/80 leading-relaxed">{pattern.frequency}</div>
        </div>

        {/* Contract value affected */}
        <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Contract value affected</div>
          <div className="text-xs text-foreground/80 leading-relaxed">{pattern.commercialImpact}</div>
        </div>

        {/* Counterparties */}
        <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Counterparties involved</div>
          {pattern.counterparties.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {pattern.counterparties.slice(0, 3).map((cp) => (
                <span key={cp} className="text-[10px] px-2 py-0.5 rounded-full bg-[#EEF2F8] text-[#475569] border border-[#E2E8F0]">{cp}</span>
              ))}
              {pattern.counterparties.length > 3 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F8FAFC] text-muted-foreground border border-[#E2E8F0]">
                  +{pattern.counterparties.length - 3} more
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">No specific counterparty identified</div>
          )}
        </div>

        {/* Suggested action */}
        <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Suggested action</div>
          <div className="text-xs text-foreground/80 leading-relaxed">{pattern.suggestedAction}</div>
        </div>
      </div>

      {/* Footer button */}
      <div className="pt-1 border-t border-[#E2E8F0]">
        <Link
          to={pattern.clauseCategory
            ? `/app/legal/playbook?clause=${pattern.clauseCategory}`
            : "/app/legal/playbook"
          }
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-[#2563EB] transition-colors"
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
  const severity = entry.driftPct >= 75 ? "text-[#A32D2D]" : entry.driftPct >= 50 ? "text-[#854F0B]" : "text-foreground/60";
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 shrink-0">
        <div className="text-xs font-medium truncate">{label(entry.clauseCategory)}</div>
        <div className="text-[10px] text-muted-foreground">{entry.acceptedRed}/{entry.totalRed} accepted below red line</div>
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
          <div className="text-xs text-muted-foreground">{label(cp.clauseCategory)}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-[#A32D2D]">{cp.redCount}× RED</div>
          <div className="text-[10px] text-muted-foreground">{cp.amberCount > 0 ? `+${cp.amberCount} amber` : "no amber"}</div>
        </div>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-red-400 rounded-full" style={{ width: `${redPct}%` }} />
      </div>
      {cp.acceptedRed > 0 && (
        <div className="mt-2 text-[10px] text-[#854F0B] flex items-center gap-1">
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
            ? "bg-[#E7F6EE] border-[#E7F6EE] text-foreground"
            : "bg-[#FAEEDA] border-[#FAEEDA] text-foreground"
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
                <div className="text-[9px] text-muted-foreground">{entry.month.slice(5)}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">
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
  const { flags } = useFeatureFlags();

  const patterns            = data?.patterns ?? [];
  const outcomes            = data?.clauseOutcomes ?? [];
  const counterpartyPats    = data?.counterpartyPatterns ?? [];
  const drift               = data?.negotiationDrift ?? [];
  const currency            = data?.currency ?? "GBP";
  const reviewsAnalysed     = data?.reviewsAnalysed ?? 0;

  const hasData = patterns.length > 0 || outcomes.length > 0;

  // Build enriched patterns for display
  const enrichedPatterns: EnrichedPattern[] = patterns.map((p) => enrichPattern(p, outcomes, currency));

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Activity size={22} className="text-primary" />
          <div>
            <h1 className="t-page-title">Negotiation Intelligence</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Patterns, counterparty behaviour and negotiation drift detected from your review history.
            </p>
          </div>
        </div>

        {!flags.patternIntelligence && (
          <UpgradePrompt feature="Negotiation Intelligence" requiredTier="team" />
        )}

        {isLoading && flags.patternIntelligence && (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading patterns…</div>
        )}

        {!isLoading && !hasData && flags.patternIntelligence && (
          <div className="card p-14 text-center space-y-5">
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mx-auto">
              <Activity size={24} className="text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <div className="font-semibold">No patterns detected yet</div>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                {reviewsAnalysed === 0
                  ? "Patterns appear as reviews accumulate. Nothing has been reviewed yet."
                  : `Patterns appear as reviews accumulate. ${reviewsAnalysed} contract${reviewsAnalysed !== 1 ? "s have" : " has"} been reviewed so far, which is not yet enough for the same position to repeat across contracts.`}
              </p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                A pattern needs the same clause type to recur, so recurring counterparty behaviour, positions accepted
                below your playbook, and automatic renewals will surface here once they do.
              </p>
            </div>
            <div className="flex items-center justify-center pt-1">
              <Link to="/app/legal/library" className="btn-primary gap-2">
                Review a contract
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}

        {/* ── Decision data (structured human-judgment capture) ──────────────── */}
        {data?.decisionSummary && flags.patternIntelligence && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
              Decision data
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card p-4">
                <div className="text-2xl font-bold">{data.decisionSummary.total}</div>
                <div className="text-xs text-muted-foreground mt-1">Decisions captured</div>
              </div>
              <div className="card p-4">
                <div className="text-2xl font-bold">{data.decisionSummary.agreementRate}%</div>
                <div className="text-xs text-muted-foreground mt-1">Recommendations accepted</div>
              </div>
              <div className="card p-4">
                <div className="text-2xl font-bold">{data.decisionSummary.overrideRate}%</div>
                <div className="text-xs text-muted-foreground mt-1">Overridden</div>
              </div>
              <div className="card p-4">
                <div className="text-2xl font-bold">{data.decisionSummary.byAction["modified"] ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-1">Language edited before use</div>
              </div>
            </div>
            {data.decisionSummary.mostOverriddenCategories.length > 0 && (
              <div className="card p-4 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Most overridden clause positions
                </div>
                {data.decisionSummary.mostOverriddenCategories.map((c) => (
                  <div key={c.clauseCategory} className="flex items-center justify-between text-sm">
                    <span className="text-foreground/80">{c.clauseCategory.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">{c.overridden} of {c.total} decisions overridden</span>
                  </div>
                ))}
              </div>
            )}
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
                  <div className="flex items-start gap-2 text-xs text-[#854F0B]">
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
                  <span className="text-center text-[#A32D2D]">Red</span>
                  <span className="text-center text-[#1B7A4B]">Accepted</span>
                  <span className="text-center text-[#2563EB]">Escalated</span>
                </div>
              </div>
              <div className="divide-y divide-card-border">
                {outcomes.map((o) => (
                  <div
                    key={o.clauseCategory}
                    className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-3 text-sm
                      ${o.accepted > 0 && o.redCount > 0 ? "bg-[#FAEEDA]/60" : ""}`}
                  >
                    <span className="font-medium truncate">{label(o.clauseCategory)}</span>
                    <span className="text-center text-muted-foreground text-xs w-12">{o.total}</span>
                    <span className={`text-center text-xs w-12 ${o.redCount > 0 ? "text-[#A32D2D] font-semibold" : "text-muted-foreground"}`}>
                      {o.redCount || "-"}
                    </span>
                    <span className={`text-center text-xs w-16 ${o.accepted > 0 ? "font-medium" : "text-muted-foreground"}`}>
                      {o.accepted || "-"}
                    </span>
                    <span className={`text-center text-xs w-16 ${o.escalated > 0 ? "text-[#2563EB] font-medium" : "text-muted-foreground"}`}>
                      {o.escalated || "-"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {outcomes.some((o) => o.accepted > 0 && o.redCount > 0) && (
              <div className="card border-[#FAEEDA] bg-[#FAEEDA] p-4">
                <div className="text-sm font-semibold text-[#854F0B] mb-1">Negotiation drift detected</div>
                <p className="text-xs text-[#854F0B]/80 leading-relaxed">
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
