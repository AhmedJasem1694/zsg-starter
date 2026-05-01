import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Shield, Globe, AlertCircle } from "lucide-react";
import { getRegulations, detectRegulations } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import type { CompanyRegulation } from "../lib/types";

const JURISDICTION_FLAGS: Record<string, string> = {
  GB: "🇬🇧",
  EU: "🇪🇺",
  US: "🇺🇸",
  SG: "🇸🇬",
  AE: "🇦🇪",
};

const JURISDICTION_LABELS: Record<string, string> = {
  GB: "United Kingdom",
  EU: "European Union",
  US: "United States",
  SG: "Singapore",
  AE: "United Arab Emirates",
};

function RegCard({ reg }: { reg: CompanyRegulation }) {
  const flag = JURISDICTION_FLAGS[reg.jurisdiction] ?? "🌐";
  const label = JURISDICTION_LABELS[reg.jurisdiction] ?? reg.jurisdiction;

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{flag}</span>
          <div>
            <div className="text-sm font-semibold">{reg.frameworkName}</div>
            <div className="text-xs text-muted-foreground">{reg.regulator} · {label}</div>
          </div>
        </div>
        <span className="text-[10px] bg-accent text-accent-foreground border border-accent-border rounded-full px-2 py-0.5 font-medium shrink-0">
          Active
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{reg.description}</p>
      {reg.appliesTo && (
        <div className="text-xs text-foreground/70 border-t border-card-border pt-3">
          <span className="font-medium">Applies to: </span>{reg.appliesTo}
        </div>
      )}
    </div>
  );
}

function groupByJurisdiction(regs: CompanyRegulation[]) {
  const map = new Map<string, CompanyRegulation[]>();
  for (const r of regs) {
    const list = map.get(r.jurisdiction) ?? [];
    list.push(r);
    map.set(r.jurisdiction, list);
  }
  return map;
}

export default function Regulations() {
  const queryClient = useQueryClient();

  const { data: regulations = [], isLoading } = useQuery({
    queryKey: ["regulations"],
    queryFn: getRegulations,
  });

  const detectMut = useMutation({
    mutationFn: detectRegulations,
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["regulations"] }); },
  });

  const grouped = groupByJurisdiction(regulations);

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Regulatory environment</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Frameworks MIKE applies when reviewing your contracts. Detected from your company's sector and jurisdictions.
            </p>
          </div>
          <button
            className="btn-secondary gap-2 text-sm shrink-0"
            onClick={() => detectMut.mutate()}
            disabled={detectMut.isPending}
          >
            <RefreshCw size={14} className={detectMut.isPending ? "animate-spin" : ""} />
            {detectMut.isPending ? "Detecting…" : "Re-detect"}
          </button>
        </div>

        {/* Info banner */}
        <div className="card bg-accent border-accent-border p-4 flex gap-3">
          <Shield size={16} className="text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-foreground/80">
            MIKE injects these regulatory requirements into every contract review - flagging clauses that conflict with your
            obligations even if your playbook doesn't explicitly mention them.
          </p>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading regulatory frameworks…</div>
        ) : regulations.length === 0 ? (
          <div className="card p-10 text-center space-y-4">
            <AlertCircle size={32} className="text-muted-foreground/40 mx-auto" />
            <div>
              <div className="text-sm font-medium">No regulatory frameworks detected yet</div>
              <div className="text-xs text-muted-foreground mt-1">
                Click "Re-detect" above - MIKE will analyse your company sector and jurisdiction.
              </div>
            </div>
            <button
              className="btn-primary gap-2 mx-auto"
              onClick={() => detectMut.mutate()}
              disabled={detectMut.isPending}
            >
              <Globe size={14} />
              {detectMut.isPending ? "Detecting…" : "Detect now"}
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {Array.from(grouped.entries()).map(([jurisdiction, regs]) => (
              <div key={jurisdiction} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{JURISDICTION_FLAGS[jurisdiction] ?? "🌐"}</span>
                  <h2 className="text-base font-semibold">
                    {JURISDICTION_LABELS[jurisdiction] ?? jurisdiction}
                  </h2>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {regs.length} framework{regs.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {regs.map((r) => (
                    <RegCard key={r.id} reg={r} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
