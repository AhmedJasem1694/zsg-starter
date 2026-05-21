import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw, Shield, Globe, AlertCircle, Zap, ChevronDown, ChevronRight,
  AlertTriangle, TrendingUp, CheckCircle, Loader2,
} from "lucide-react";
import { getRegulations, detectRegulations, getCompany, getRegulatoryUpdates, synthesiseRegulation } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import type { CompanyRegulation } from "../lib/types";

const JURISDICTION_LABELS: Record<string, string> = {
  GB:  "United Kingdom",
  EU:  "European Union",
  IE:  "Ireland",
  NL:  "Netherlands",
  CH:  "Switzerland",
  US:  "United States",
  CA:  "Canada",
  SG:  "Singapore",
  HK:  "Hong Kong",
  JP:  "Japan",
  AE:  "United Arab Emirates",
  KSA: "Saudi Arabia",
  KR:  "South Korea",
  IN:  "India",
  BR:  "Brazil",
};

type Tier = "core" | "likely" | "monitor";

const ADJACENT: Record<string, string[]> = {
  GB: ["EU", "IE"],
  EU: ["GB", "CH"],
  IE: ["GB", "EU"],
  US: ["CA"],
  CA: ["US"],
  SG: ["HK", "AE"],
  HK: ["SG", "CN"],
};

function computeTier(reg: CompanyRegulation, companyJurisdiction?: string): Tier {
  if (!companyJurisdiction) return "likely";
  const primary = companyJurisdiction.toUpperCase();
  if (reg.jurisdiction.toUpperCase() === primary) return "core";
  const adjacent = ADJACENT[primary] ?? [];
  if (adjacent.includes(reg.jurisdiction.toUpperCase())) return "likely";
  return "monitor";
}

const TIER_CONFIG: Record<Tier, { label: string; badge: string; borderClass: string; bgClass: string }> = {
  core:    { label: "Core obligation",  badge: "text-[#86EFAC] bg-[#052E16] border-[#14532D]",    borderClass: "border-[#14532D]",  bgClass: "#052E16" },
  likely:  { label: "Likely relevant",  badge: "text-[#FCD34D] bg-[#1C0F00] border-[#431407]",    borderClass: "border-card-border", bgClass: "" },
  monitor: { label: "Monitor context",  badge: "text-[#94A3B8] bg-[#0F172A] border-[#334155]",    borderClass: "border-card-border", bgClass: "" },
};

// ── Synthesis expander ────────────────────────────────────────────────────────

function SynthesisPanel({ regId }: { regId: string }) {
  const [open, setOpen] = useState(false);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  const handleExpand = async () => {
    if (!open && !synthesis) {
      setLoading(true);
      try {
        const result = await synthesiseRegulation(regId);
        setSynthesis(result.synthesis);
        setCached(result.cached);
        setCreatedAt(result.createdAt);
      } catch {
        setSynthesis("Unable to generate synthesis at this time.");
      } finally {
        setLoading(false);
      }
    }
    setOpen(!open);
  };

  return (
    <div className="border-t border-border/50 mt-3 pt-3">
      <button
        className="flex items-center gap-2 text-[11px] text-foreground/50 hover:text-blue-400 transition-colors"
        onClick={handleExpand}
      >
        {loading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : open ? (
          <ChevronDown size={12} />
        ) : (
          <ChevronRight size={12} />
        )}
        <Zap size={11} />
        {loading ? "Generating Zane synthesis…" : open ? "Hide synthesis" : "Generate Zane synthesis"}
        {cached && !loading && <span className="text-[9px] text-foreground/30">(cached)</span>}
      </button>

      {open && synthesis && (
        <div className="mt-3 space-y-2">
          <div className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-line bg-card/60 rounded-lg px-3 py-2.5 border border-border/50">
            {synthesis}
          </div>
          {createdAt && (
            <div className="text-[9px] text-foreground/30">
              Synthesised {new Date(createdAt).toLocaleDateString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Regulatory update card ────────────────────────────────────────────────────

function UpdateCard({ update }: { update: { framework: string; jurisdiction: string; title: string; summary: string; impact: string; date: string; actionRequired: boolean } }) {
  const impactCls = {
    HIGH:   "text-red-400 bg-red-500/10 border-red-500/30",
    MEDIUM: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    LOW:    "text-green-400 bg-green-500/10 border-green-500/30",
  }[update.impact] ?? "text-foreground/50 bg-foreground/10 border-border";

  return (
    <div className="card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-foreground/40 font-mono mb-0.5">
            {update.framework} · {update.jurisdiction} · {update.date}
          </div>
          <div className="text-sm font-medium leading-snug">{update.title}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[9px] font-bold border rounded-full px-1.5 py-0.5 ${impactCls}`}>
            {update.impact}
          </span>
          {update.actionRequired && (
            <span className="text-[9px] font-bold border rounded-full px-1.5 py-0.5 text-amber-400 bg-amber-500/10 border-amber-500/30">
              ACTION
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{update.summary}</p>
    </div>
  );
}

// ── Regulation card ───────────────────────────────────────────────────────────

function RegCard({ reg, tier }: { reg: CompanyRegulation; tier: Tier }) {
  const label = JURISDICTION_LABELS[reg.jurisdiction] ?? reg.jurisdiction;
  const cfg = TIER_CONFIG[tier];

  return (
    <div className="card p-5 space-y-3" style={cfg.bgClass ? { background: cfg.bgClass } : {}}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">{reg.jurisdiction}</span>
          <div>
            <div className="text-sm font-semibold">{reg.frameworkName}</div>
            <div className="text-xs text-muted-foreground">{reg.regulator} · {label}</div>
          </div>
        </div>
        <span className={`text-[10px] border rounded-full px-2 py-0.5 font-medium shrink-0 ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{reg.description}</p>
      {reg.appliesTo && (
        <div className="text-xs text-foreground/70 border-t border-card-border pt-3">
          <span className="font-medium">Context: </span>{reg.appliesTo}
        </div>
      )}
      <SynthesisPanel regId={reg.id} />
    </div>
  );
}

// ── Group by tier ─────────────────────────────────────────────────────────────

function groupAndTier(regs: CompanyRegulation[], companyJurisdiction?: string) {
  const tiered = regs.map((r) => ({ reg: r, tier: computeTier(r, companyJurisdiction) }));
  tiered.sort((a, b) => {
    const order = { core: 0, likely: 1, monitor: 2 };
    return order[a.tier] - order[b.tier];
  });

  const tierGroups: Record<Tier, typeof tiered> = { core: [], likely: [], monitor: [] };
  for (const item of tiered) tierGroups[item.tier].push(item);
  return tierGroups;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Regulations() {
  const queryClient = useQueryClient();

  const { data: regulations = [], isLoading } = useQuery({
    queryKey: ["regulations"],
    queryFn: getRegulations,
  });

  const { data: company } = useQuery({
    queryKey: ["company"],
    queryFn: getCompany,
    retry: false,
  });

  const { data: updatesData, isLoading: updatesLoading, refetch: refetchUpdates } = useQuery({
    queryKey: ["regulatory-updates"],
    queryFn: getRegulatoryUpdates,
    enabled: regulations.length > 0,
  });

  const companyJurisdiction = (company as { jurisdiction?: string } | undefined)?.jurisdiction;

  const detectMut = useMutation({
    mutationFn: detectRegulations,
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["regulations"] }); },
  });

  const tierGroups = groupAndTier(regulations, companyJurisdiction);
  const coreCount    = tierGroups.core.length;
  const likelyCount  = tierGroups.likely.length;
  const monitorCount = tierGroups.monitor.length;

  const highImpactUpdates = updatesData?.updates.filter((u) => u.impact === "HIGH" || u.actionRequired) ?? [];

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Regulatory Profile</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Frameworks Zane uses as review context, detected from your company sector and jurisdiction.
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
            Zane uses these frameworks as review context - flagging where clauses may intersect with material
            obligations, even when your playbook doesn't explicitly address them. This is not legal advice.
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
                Click "Re-detect" above - Zane will analyse your company sector and jurisdiction.
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
            {/* Tier summary strip */}
            <div className="grid sm:grid-cols-3 gap-3">
              {([
                { tier: "core"    as Tier, count: coreCount,    desc: "Directly applicable obligations" },
                { tier: "likely"  as Tier, count: likelyCount,  desc: "Likely relevant to your context" },
                { tier: "monitor" as Tier, count: monitorCount, desc: "Broader international context" },
              ]).map(({ tier, count, desc }) => {
                const cfg = TIER_CONFIG[tier];
                return (
                  <div key={tier} className="card px-4 py-3 flex items-center gap-3">
                    <div className={`text-xl font-bold tabular-nums ${tier === "core" ? "text-[#86EFAC]" : tier === "likely" ? "text-[#FCD34D]" : "text-[#94A3B8]"}`}>
                      {count}
                    </div>
                    <div>
                      <div className="text-xs font-semibold">{cfg.label}</div>
                      <div className="text-[10px] text-muted-foreground">{desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Regulatory updates digest ─────────────────────────────────── */}
            {regulations.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={15} className="text-blue-400" />
                    <span className="text-sm font-semibold">Regulatory updates</span>
                    {updatesData?.cached && (
                      <span className="text-[10px] text-foreground/30">(cached)</span>
                    )}
                  </div>
                  <button
                    className="btn-secondary text-xs gap-1.5 py-1"
                    onClick={() => void refetchUpdates()}
                    disabled={updatesLoading}
                  >
                    <RefreshCw size={11} className={updatesLoading ? "animate-spin" : ""} />
                    Refresh
                  </button>
                </div>

                {updatesLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 size={14} className="animate-spin" />
                    Generating regulatory intelligence digest…
                  </div>
                )}

                {!updatesLoading && highImpactUpdates.length > 0 && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5">
                    <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                    <div className="text-xs text-amber-300">
                      <span className="font-semibold">{highImpactUpdates.length} high-priority update{highImpactUpdates.length !== 1 ? "s" : ""}</span>
                      {" "}require your attention - see below.
                    </div>
                  </div>
                )}

                {!updatesLoading && updatesData && updatesData.updates.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {updatesData.updates.map((u, i) => (
                      <UpdateCard key={i} update={u} />
                    ))}
                  </div>
                )}

                {!updatesLoading && (!updatesData || updatesData.updates.length === 0) && (
                  <p className="text-xs text-muted-foreground">No regulatory updates available. Click Refresh to generate.</p>
                )}

                {!updatesLoading && updatesData && updatesData.updates.some((u) => u.actionRequired) && (
                  <div className="flex items-center gap-1.5 text-[11px] text-green-400">
                    <CheckCircle size={11} />
                    Action-required items flagged - review and update your playbook positions where relevant.
                  </div>
                )}
              </div>
            )}

            {/* Tier sections */}
            {(["core", "likely", "monitor"] as Tier[]).map((tier) => {
              const items = tierGroups[tier];
              if (items.length === 0) return null;
              const cfg = TIER_CONFIG[tier];
              return (
                <div key={tier} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {items.length} framework{items.length !== 1 ? "s" : ""} · Click "Generate Zane synthesis" on any card for an in-depth analysis
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {items.map(({ reg }) => (
                      <RegCard key={reg.id} reg={reg} tier={tier} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
