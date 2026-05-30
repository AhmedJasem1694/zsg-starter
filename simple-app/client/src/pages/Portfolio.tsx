import { Zap, BarChart2, Upload, TrendingUp, AlertTriangle, CheckCircle, DollarSign, Users, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPortfolio } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import { CLAUSE_LABELS, type ClauseCategory } from "../lib/types";

// ── Panel wrapper ──────────────────────────────────────────────────────────────

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color = "text-foreground",
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: string;
}) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon size={17} className={color} />
      </div>
      <div className="min-w-0">
        <div className={`text-xl font-bold ${color}`}>{value}</div>
        <div className="text-xs font-medium text-foreground/80 mt-0.5">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ── Stacked bar ───────────────────────────────────────────────────────────────

function StackedBar({ red, amber, green, height = "h-2" }: { red: number; amber: number; green: number; height?: string }) {
  const total = red + amber + green;
  if (total === 0) return <div className={`${height} bg-muted rounded-full`} />;
  return (
    <div className={`flex ${height} rounded-full overflow-hidden gap-px`}>
      {red   > 0 && <div className="bg-red-400"   style={{ flex: red }} />}
      {amber > 0 && <div className="bg-amber-400" style={{ flex: amber }} />}
      {green > 0 && <div className="bg-green-400" style={{ flex: green }} />}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Portfolio() {
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio"],
    queryFn: getPortfolio,
  });

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-7xl mx-auto space-y-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Portfolio Risk</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Clause-level risk breakdown across your entire contract portfolio
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="py-20 text-center text-sm text-muted-foreground">Loading portfolio…</div>
        )}

        {!isLoading && !data && (
          <div className="card p-14 text-center space-y-5">
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mx-auto">
              <BarChart2 size={24} className="text-muted-foreground/50" />
            </div>
            <div className="space-y-2">
              <div className="font-semibold">No portfolio data yet</div>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                Upload 3 or more contracts to see recurring risk across your estate - which clause types consistently
                flag red, which counterparties deviate most from your playbook, and where contract value is concentrated.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              <Link to="/app/legal/dashboard" className="btn-primary gap-2">
                <Upload size={14} />
                Upload a contract
              </Link>
              <p className="text-xs text-muted-foreground">Portfolio view populates after your first completed review</p>
            </div>
          </div>
        )}

        {data && <PortfolioContent data={data} />}
      </div>
    </AppLayout>
  );
}

type PortfolioData = NonNullable<Awaited<ReturnType<typeof getPortfolio>>>;

function fmt(n: number, currency = "GBP") {
  if (n >= 1_000_000) return `${currency === "GBP" ? "£" : "$"}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${currency === "GBP" ? "£" : "$"}${(n / 1_000).toFixed(0)}k`;
  return `${currency === "GBP" ? "£" : "$"}${n.toFixed(0)}`;
}

function PortfolioContent({ data }: { data: PortfolioData }) {
  const redPct = data.totalClauses > 0 ? Math.round((data.totalRedResults / data.totalClauses) * 100) : 0;

  return (
    <div className="space-y-6">

      {/* ── Panel 1: Portfolio KPIs ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Contracts reviewed"
          value={data.totalDocuments}
          sub={`${data.totalClauses} clauses analysed`}
          icon={BarChart2}
        />
        <KpiCard
          label="RED clause rate"
          value={`${redPct}%`}
          sub={
            data.escalationsOpen > 0
              ? `${data.escalationsOpen} contract${data.escalationsOpen !== 1 ? "s" : ""} require approval${data.valueAtRisk?.RED > 0 ? ` — ${fmt(data.valueAtRisk.RED)} at risk` : ""}`
              : `${data.totalRedResults} clause${data.totalRedResults !== 1 ? "s" : ""} outside risk tolerance`
          }
          icon={AlertTriangle}
          color={redPct > 30 ? "text-red-400" : redPct > 15 ? "text-amber-400" : "text-green-400"}
        />
        <KpiCard
          label="Escalations open"
          value={data.escalationsOpen}
          sub="Contracts needing senior approval"
          icon={Shield}
          color={data.escalationsOpen > 0 ? "text-amber-400" : "text-green-400"}
        />
        <KpiCard
          label="Total contract value"
          value={data.totalValue > 0 ? fmt(data.totalValue) : "-"}
          sub={`${data.signedDocs} signed/executed`}
          icon={DollarSign}
          color="text-blue-400"
        />
      </div>

      {/* ── Panel 2: Risk group tiles ───────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.groups.map(({ label, red, amber, green, icon }) => {
          const total = red + amber + green;
          return (
            <div key={label} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-lg">{icon}</span>
              </div>
              {total > 0 ? (
                <>
                  <StackedBar red={red} amber={amber} green={green} height="h-2" />
                  <div className="flex gap-3 text-xs text-muted-foreground mt-2">
                    {red   > 0 && <span className="text-red-400   font-medium">{red} Red</span>}
                    {amber > 0 && <span className="text-amber-400 font-medium">{amber} Amber</span>}
                    {green > 0 && <span className="text-green-400 font-medium">{green} Green</span>}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No clauses in this group yet</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">

        {/* ── Panel 3: Clause-type exposure ──────────────────────────────────── */}
        <Panel title="Clause-type exposure" subtitle="RED issues by clause category across your portfolio">
          {data.topRedCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No RED flags across your portfolio.</p>
          ) : (
            <div className="space-y-3">
              {data.topRedCategories.map(({ category, count, pct }) => (
                <div key={category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">
                      {CLAUSE_LABELS[category as ClauseCategory] ?? category.replace(/_/g, " ")}
                    </span>
                    <span className="text-red-400 font-semibold">{count} issue{count !== 1 ? "s" : ""} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* ── Panel 4: Risk by contract type ─────────────────────────────────── */}
        <Panel title="Risk by contract type" subtitle="Clause flags across contract types in your portfolio">
          {data.byContractType.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contract data yet.</p>
          ) : (
            <div className="divide-y divide-border/50 -mx-5">
              {data.byContractType.map(({ type, red, amber, total }) => (
                <div key={type} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium capitalize">{type.toLowerCase()}</div>
                    <div className="text-xs text-muted-foreground">{total} contract{total !== 1 ? "s" : ""}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {red   > 0 && <span className="rag-red text-xs">{red} RED</span>}
                    {amber > 0 && <span className="rag-amber text-xs">{amber} AMBER</span>}
                    {red === 0 && amber === 0 && <span className="rag-green text-xs">Clean</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Panel 5: Counterparty heat map ─────────────────────────────────────── */}
      {data.byCounterparty.length > 0 && (
        <Panel title="Counterparty risk heat map" subtitle="Which counterparties deviate most from your playbook positions">
          <div className="space-y-2">
            {data.byCounterparty.map(({ name, red, amber, green, total, value }) => {
              const tot = red + amber + green;
              return (
                <div key={name} className="flex items-center gap-3">
                  <div className="w-32 shrink-0">
                    <div className="text-xs font-medium truncate" title={name}>{name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {total} contract{total !== 1 ? "s" : ""}
                      {value > 0 && ` · ${fmt(value)}`}
                    </div>
                  </div>
                  <div className="flex-1">
                    <StackedBar red={red} amber={amber} green={green} height="h-3" />
                  </div>
                  <div className="text-[10px] text-muted-foreground w-16 text-right shrink-0">
                    {tot > 0 ? `${Math.round((red / tot) * 100)}% red` : "-"}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />Red</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />Amber</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block" />Green</span>
          </div>
        </Panel>
      )}

      {/* ── Panel 6: Value at risk ──────────────────────────────────────────────── */}
      {data.valueAtRisk.total > 0 && (
        <Panel title="Contract value at risk" subtitle="Total contract value segmented by overall risk RAG - contracts with any RED clause are counted as RED">
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { band: "RED",   label: "High risk value",   cls: "text-red-400",   bg: "bg-red-400" },
              { band: "AMBER", label: "Medium risk value", cls: "text-amber-400", bg: "bg-amber-400" },
              { band: "GREEN", label: "Low risk value",    cls: "text-green-400", bg: "bg-green-400" },
            ].map(({ band, label, cls, bg }) => {
              const v = data.valueAtRisk[band as "RED" | "AMBER" | "GREEN"];
              const pct = data.valueAtRisk.total > 0 ? Math.round((v / data.valueAtRisk.total) * 100) : 0;
              return (
                <div key={band} className="text-center">
                  <div className={`text-lg font-bold ${cls}`}>{fmt(v)}</div>
                  <div className="text-[10px] text-muted-foreground">{label}</div>
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${bg} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className={`text-[10px] mt-0.5 font-medium ${cls}`}>{pct}%</div>
                </div>
              );
            })}
          </div>
          <div className="text-center text-xs text-muted-foreground">
            Total portfolio value: <span className="font-semibold text-foreground">{fmt(data.valueAtRisk.total)}</span>
          </div>
        </Panel>
      )}

      {/* ── Panel 7: Portfolio insight ──────────────────────────────────────────── */}
      <div className="card bg-accent border-accent-border p-5">
        <div className="flex items-start gap-3">
          <Zap size={16} className="text-primary mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              Portfolio insight
              {data.totalDocuments > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  <TrendingUp size={9} />
                  {data.totalDocuments} contracts · {data.totalClauses} clauses
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{data.insight}</p>
            {data.escalationsOpen > 0 && (
              <p className="text-xs text-amber-400 mt-2 flex items-center gap-1.5">
                <AlertTriangle size={11} />
                {data.escalationsOpen} contract{data.escalationsOpen !== 1 ? "s" : ""} pending senior approval - check your escalation queue.
              </p>
            )}
            {data.signedDocs > 0 && (
              <p className="text-xs text-green-400 mt-1 flex items-center gap-1.5">
                <CheckCircle size={11} />
                {data.signedDocs} contract{data.signedDocs !== 1 ? "s" : ""} signed or executed.
              </p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
