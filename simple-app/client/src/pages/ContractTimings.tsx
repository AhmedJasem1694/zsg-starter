import AppLayout from "../components/layout/AppLayout";
import { MOCK_RENEWALS } from "../lib/mockData";

export default function ContractTimings() {
  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-7xl mx-auto space-y-7">
        <div>
          <h1 className="text-2xl font-semibold">Contract Timings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Renewal dates, notice periods, and break clause deadlines across your portfolio
          </p>
        </div>
        <RenewalsContent data={MOCK_RENEWALS} />
      </div>
    </AppLayout>
  );
}

function RenewalsContent({ data }: { data: typeof MOCK_RENEWALS }) {
  function urgencyColor(days: number) {
    if (days < 30)  return "text-red-600 bg-red-50 border-red-200";
    if (days < 90)  return "text-amber-700 bg-amber-50 border-amber-200";
    return "text-muted-foreground bg-muted border-border";
  }

  function urgencyLabel(days: number) {
    if (days < 0)   return "Expired";
    if (days === 0) return "Today";
    if (days < 30)  return `${days}d`;
    if (days < 90)  return `${Math.round(days / 7)}w`;
    return `${Math.round(days / 30)}mo`;
  }

  return (
    <div className="space-y-6">
      {/* Upcoming deadlines */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold">Upcoming deadlines</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Renewal dates, notice periods, and break clause deadlines</p>
        </div>
        <div className="divide-y divide-card-border">
          {data.upcoming.map((item) => (
            <div key={item.id} className="px-5 py-4 flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl border flex flex-col items-center justify-center shrink-0 text-center ${urgencyColor(item.daysUntil)}`}>
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                  {item.daysUntil < 0 ? "PAST" : "IN"}
                </span>
                <span className="text-lg font-bold leading-tight">{urgencyLabel(item.daysUntil)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{item.contractName}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.eventType}</div>
                <div className="text-xs text-muted-foreground">{item.date}</div>
              </div>
              <div className="hidden sm:block text-right text-xs text-muted-foreground">
                <div className="font-medium">{item.noticePeriod}</div>
                <div>notice period</div>
              </div>
              {item.actionRequired && (
                <span className="shrink-0 text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                  Action needed
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contract timeline */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold">Contract term overview</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Active contracts by remaining term</p>
        </div>
        <div className="card-body space-y-3">
          {data.termOverview.map(({ label, count, pct }) => (
            <div key={label} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{count} contracts</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Renewal dates are extracted from your contract metadata. Upload contracts and run a review to populate this automatically.
      </p>
    </div>
  );
}
