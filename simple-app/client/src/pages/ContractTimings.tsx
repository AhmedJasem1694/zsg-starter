import { CalendarClock, AlertTriangle, Clock, Upload } from "lucide-react";
import { Link } from "react-router-dom";
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
          <h1 className="text-2xl font-semibold">Renewals & Notice Dates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Renewal dates, notice periods, and termination windows across your reviewed contracts
          </p>
        </div>

        {isLoading && (
          <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>
        )}

        {!isLoading && !data && (
          <div className="card p-14 text-center space-y-5">
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mx-auto">
              <CalendarClock size={24} className="text-muted-foreground/50" />
            </div>
            <div className="space-y-2">
              <div className="font-semibold">No renewal data yet</div>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                Zane extracts renewal dates, notice periods, and auto-renewal clauses from every reviewed contract.
                Upload contracts with renewal terms to start your renewal calendar - and get alerted before notice
                windows close.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              <Link to="/app/legal/dashboard" className="btn-primary gap-2">
                <Upload size={14} />
                Upload a contract
              </Link>
              <p className="text-xs text-muted-foreground">Renewal dates are extracted automatically from contract text</p>
            </div>
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
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#1F0A0A] text-[#FCA5A5] border border-[#450A0A] shrink-0">
              {data.flagged.filter((f) => f.ragStatus === "RED").length} need action
            </span>
          )}
        </div>

        {data.flagged.length === 0 ? (
          <div className="card-body flex items-center gap-3 text-sm text-[#86EFAC]">
            <div className="w-2 h-2 rounded-full bg-[#86EFAC] shrink-0" />
            No renewal or timing risks flagged across your reviewed contracts.
          </div>
        ) : (
          <div className="divide-y divide-card-border">
            {data.flagged.map((item) => (
              <div key={item.id} className="px-5 py-4 flex items-start gap-4">
                {/* RAG indicator */}
                <div className={`mt-0.5 flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
                  item.ragStatus === "RED"
                    ? "bg-[#1F0A0A] border border-[#450A0A]"
                    : "bg-[#1C0F00] border border-[#431407]"
                }`}>
                  {item.ragStatus === "RED"
                    ? <AlertTriangle size={14} className="text-[#FCA5A5]" />
                    : <Clock size={14} className="text-[#FCD34D]" />
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
