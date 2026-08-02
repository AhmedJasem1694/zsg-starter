import { useQuery } from "@tanstack/react-query";
import { BarChart2, Lock } from "lucide-react";
import AppLayout from "../components/layout/AppLayout";
import { getAdminMetrics, type AdminMetrics } from "../lib/api";

// ─── Internal compounding metrics dashboard (admin-only) ─────────────────────
// Proves the accumulation story: reviews, clauses, decisions, outcomes,
// counterparty coverage, hours saved, and unit economics, computed live from
// PocketBase with no external analytics dependency.

function fmtGBP(v: number): string {
  return `£${v.toLocaleString()}`;
}
function fmtUSD(v: number): string {
  return `$${v.toFixed(2)}`;
}

function MetricCard({ value, label, sub }: { value: string | number; label: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-2xl font-bold tabular">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

/** Dependency-free bar chart: reviews per month */
function ReviewsTrendChart({ months, byMonth }: { months: string[]; byMonth: Record<string, number> }) {
  const values = months.map((m) => byMonth[m] ?? 0);
  const max = Math.max(1, ...values);
  return (
    <div className="card p-5 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <BarChart2 size={12} /> Reviews per month
      </div>
      <div className="flex items-end gap-1.5 h-36">
        {months.map((m, i) => (
          <div key={m} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="text-[10px] text-muted-foreground tabular-nums">{values[i] > 0 ? values[i] : ""}</div>
            <div
              className="w-full rounded-t bg-primary/70 hover:bg-primary transition-colors"
              style={{ height: `${Math.max(values[i] > 0 ? 4 : 1, Math.round((values[i] / max) * 100))}%` }}
              title={`${m}: ${values[i]} review${values[i] !== 1 ? "s" : ""}`}
            />
            <div className="text-[9px] text-muted-foreground truncate">{m.slice(2).replace("-", "/")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricsCards({ m }: { m: AdminMetrics }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <MetricCard value={m.contractsReviewed} label="Contracts reviewed" />
      <MetricCard
        value={m.clausesAnalysed}
        label="Clauses analysed"
        sub={`${m.ragBreakdown.RED} red · ${m.ragBreakdown.AMBER} amber · ${m.ragBreakdown.GREEN} green · ${m.ragBreakdown.GREY} grey`}
      />
      <MetricCard value={`${m.deviationRate}%`} label="Playbook deviation rate" sub="Red + amber share of assessed clauses" />
      <MetricCard value={m.decisionEvents} label="Decision events captured" />
      <MetricCard value={`${m.outcomeCaptureRate}%`} label="Outcome capture rate" sub={`${m.outcomesLogged} outcomes logged`} />
      <MetricCard value={m.counterpartiesTracked} label="Counterparties tracked" sub="2+ data points" />
      <MetricCard value={`${m.hoursSaved.toLocaleString()}h`} label="Estimated hours saved" sub="Reviews × 2.5h" />
      <MetricCard value={fmtUSD(m.reviewCost)} label="Estimated review cost" sub="LLM spend, all runs" />
      <MetricCard value={`${fmtGBP(m.estMonthlyRevenue)}/mo`} label="Estimated revenue" sub="From subscription tiers" />
      <MetricCard value={m.legacyProcessed} label="Legacy contracts processed" />
    </div>
  );
}

export default function AdminMetrics() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: getAdminMetrics,
    retry: false,
  });

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-6xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <BarChart2 size={22} className="text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Compounding Metrics</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Internal accumulation dashboard, computed live from the database. Admin only.
            </p>
          </div>
        </div>

        {isLoading && <div className="text-sm text-muted-foreground py-8 text-center">Loading metrics…</div>}

        {error != null && (
          <div className="card p-14 text-center space-y-3">
            <Lock size={24} className="text-muted-foreground mx-auto" />
            <div className="font-semibold">Admin access required</div>
            <p className="text-sm text-muted-foreground">This dashboard is restricted to admin users.</p>
          </div>
        )}

        {data && (
          <>
            {/* Aggregate */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">All companies</h2>
              <MetricsCards m={data.aggregate} />
            </div>

            {/* Trend chart */}
            <ReviewsTrendChart months={data.months} byMonth={data.aggregate.reviewsByMonth} />

            {/* Per company */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Per company</h2>
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-card-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2.5">Company</th>
                      <th className="px-3 py-2.5">Tier</th>
                      <th className="px-3 py-2.5 text-right">Reviews</th>
                      <th className="px-3 py-2.5 text-right">Clauses</th>
                      <th className="px-3 py-2.5 text-right">Deviation</th>
                      <th className="px-3 py-2.5 text-right">Decisions</th>
                      <th className="px-3 py-2.5 text-right">Outcomes</th>
                      <th className="px-3 py-2.5 text-right">Counterparties</th>
                      <th className="px-3 py-2.5 text-right">Hours saved</th>
                      <th className="px-3 py-2.5 text-right">Cost</th>
                      <th className="px-3 py-2.5 text-right">Est. revenue</th>
                      <th className="px-3 py-2.5 text-right">Legacy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.companies.length === 0 && (
                      <tr><td colSpan={12} className="px-3 py-6 text-center text-muted-foreground">No companies yet.</td></tr>
                    )}
                    {data.companies.map((c) => (
                      <tr key={c.companyId} className="border-b border-card-border/50 last:border-0">
                        <td className="px-3 py-3 text-foreground/90 max-w-[180px] truncate">{c.name}</td>
                        <td className="px-3 py-3 text-muted-foreground capitalize">{c.tier}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">{c.contractsReviewed}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">{c.clausesAnalysed}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">{c.deviationRate}%</td>
                        <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">{c.decisionEvents}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">{c.outcomeCaptureRate}%</td>
                        <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">{c.counterpartiesTracked}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">{c.hoursSaved}h</td>
                        <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">{fmtUSD(c.reviewCost)}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">{fmtGBP(c.estMonthlyRevenue)}/mo</td>
                        <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">{c.legacyProcessed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
