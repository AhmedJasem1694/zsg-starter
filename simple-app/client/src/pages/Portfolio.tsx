import { Zap, BarChart2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getPortfolio } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import { CLAUSE_LABELS, type ClauseCategory } from "../lib/types";

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
          {data && (
            <div className="text-right text-xs text-muted-foreground">
              <div className="font-semibold text-foreground text-sm">{data.totalDocuments}</div>
              <div>contracts reviewed</div>
              <div className="mt-1 font-semibold text-foreground text-sm">{data.totalClauses}</div>
              <div>clauses analysed</div>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="py-20 text-center text-sm text-muted-foreground">Loading portfolio…</div>
        )}

        {!isLoading && !data && (
          <div className="card p-12 text-center space-y-3">
            <BarChart2 size={32} className="mx-auto text-muted-foreground/40" />
            <div className="font-semibold text-muted-foreground">No data yet</div>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Upload and review your first contract from the Dashboard to start building your portfolio risk picture.
            </p>
          </div>
        )}

        {data && <PortfolioContent data={data} />}
      </div>
    </AppLayout>
  );
}

type PortfolioData = NonNullable<Awaited<ReturnType<typeof getPortfolio>>>;

function PortfolioContent({ data }: { data: PortfolioData }) {
  return (
    <div className="space-y-6">
      {/* Group cards */}
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
                  <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mb-2">
                    {red   > 0 && <div className="bg-red-500"     style={{ flex: red }} />}
                    {amber > 0 && <div className="bg-amber-400"   style={{ flex: amber }} />}
                    {green > 0 && <div className="bg-emerald-500" style={{ flex: green }} />}
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {red   > 0 && <span className="text-red-600 font-medium">{red} Red</span>}
                    {amber > 0 && <span className="text-amber-600 font-medium">{amber} Amber</span>}
                    {green > 0 && <span className="text-emerald-600 font-medium">{green} Green</span>}
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
        {/* Top red categories */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold">Clause-type exposure</h3>
            <p className="text-xs text-muted-foreground mt-0.5">RED issues by clause category across your portfolio</p>
          </div>
          <div className="card-body space-y-3">
            {data.topRedCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No RED flags across your portfolio.</p>
            ) : (
              data.topRedCategories.map(({ category, count, pct }) => (
                <div key={category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">
                      {CLAUSE_LABELS[category as ClauseCategory] ?? category.replace(/_/g, " ")}
                    </span>
                    <span className="text-red-600 font-semibold">{count} issue{count !== 1 ? "s" : ""} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Risk by contract type */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold">Risk by contract type</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Clause flags across contract types in your portfolio</p>
          </div>
          {data.byContractType.length === 0 ? (
            <div className="card-body text-sm text-muted-foreground">No contract data yet.</div>
          ) : (
            <div className="divide-y divide-card-border">
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
        </div>
      </div>

      {/* Insight callout */}
      <div className="card bg-accent border-accent-border p-5">
        <div className="flex items-start gap-3">
          <Zap size={16} className="text-primary mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold">Portfolio insight</div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{data.insight}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
