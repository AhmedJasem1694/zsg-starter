import { CalendarClock, AlertTriangle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getTimings } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import { CLAUSE_LABELS, type ClauseCategory } from "../lib/types";

const CLAUSE_ICONS: Partial<Record<ClauseCategory, string>> = {
  AUTO_RENEWAL:     "🔄",
  TERMINATION:      "🚪",
  BREAK_CLAUSE:     "🔓",
  PAYMENT_TERMS:    "💳",
  CHANGE_OF_CONTROL:"🔀",
};

export default function ContractTimings() {
  const { data, isLoading } = useQuery({
    queryKey: ["timings"],
    queryFn: getTimings,
  });

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-7xl mx-auto space-y-7">
        <div>
          <h1 className="text-2xl font-semibold">Contract Timings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Renewal, termination, and timing risks flagged across your reviewed contracts
          </p>
        </div>

        {isLoading && (
          <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>
        )}

        {!isLoading && !data && (
          <div className="card p-12 text-center space-y-3">
            <CalendarClock size={32} className="mx-auto text-muted-foreground/40" />
            <div className="font-semibold text-muted-foreground">No data yet</div>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Upload and review contracts from the Dashboard to start tracking timing risks.
            </p>
          </div>
        )}

        {data && <TimingsContent data={data} />}
      </div>
    </AppLayout>
  );
}

type TimingsData = NonNullable<Awaited<ReturnType<typeof getTimings>>>;

function TimingsContent({ data }: { data: TimingsData }) {
  return (
    <div className="space-y-6">
      {/* Flagged contracts */}
      <div className="card">
        <div className="card-header flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold">Renewal & timing risks</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Contracts with RED or AMBER flags on renewal, termination, or timing clauses
            </p>
          </div>
          {data.flagged.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 shrink-0">
              {data.flagged.filter((f) => f.ragStatus === "RED").length} need action
            </span>
          )}
        </div>

        {data.flagged.length === 0 ? (
          <div className="card-body flex items-center gap-3 text-sm text-emerald-700">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            No renewal or timing risks flagged across your reviewed contracts.
          </div>
        ) : (
          <div className="divide-y divide-card-border">
            {data.flagged.map((item) => (
              <div key={item.id} className="px-5 py-4 flex items-start gap-4">
                {/* RAG indicator */}
                <div className={`mt-0.5 flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
                  item.ragStatus === "RED"
                    ? "bg-red-50 border border-red-200"
                    : "bg-amber-50 border border-amber-200"
                }`}>
                  {item.ragStatus === "RED"
                    ? <AlertTriangle size={14} className="text-red-600" />
                    : <Clock size={14} className="text-amber-600" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-semibold truncate">{item.contractName}</span>
                    <span className={item.ragStatus === "RED" ? "rag-red" : "rag-amber"}>
                      {item.ragStatus}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1.5">
                    <span>{CLAUSE_ICONS[item.clauseCategory as ClauseCategory] ?? "📄"}</span>
                    <span className="font-medium text-foreground/70">
                      {CLAUSE_LABELS[item.clauseCategory as ClauseCategory] ?? item.clauseCategory.replace(/_/g, " ")}
                    </span>
                    <span>·</span>
                    <span>{item.contractType}</span>
                    <span>·</span>
                    <span>Reviewed {new Date(item.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{item.summary}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contract overview */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold">Contract overview</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Status breakdown across {data.totalDocuments} uploaded contract{data.totalDocuments !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="card-body space-y-3">
          {data.overview.map(({ label, count, pct }) => (
            <div key={label} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{count} contract{count !== 1 ? "s" : ""}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Exact renewal dates and notice deadlines will be extracted automatically from contract text in a future update.
      </p>
    </div>
  );
}
