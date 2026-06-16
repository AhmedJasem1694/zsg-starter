import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, FileText, Activity, Lightbulb, ScrollText, ChevronRight } from "lucide-react";
import AppLayout from "../components/layout/AppLayout";
import { getVendorIntelligence, type VendorDocument } from "../lib/api";

// ── Labels ──────────────────────────────────────────────────────────────────────

function prettyLabel(raw?: string): string {
  const t = (raw ?? "").trim();
  if (!t) return "Uncategorised";
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const ACTION_LABELS: Record<string, string> = {
  accepted:   "Accepted",
  modified:   "Negotiated",
  overridden: "Overrode",
  ignored:    "Dismissed",
};

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VendorIntelligence() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName ?? "");

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-intelligence", name],
    queryFn: () => getVendorIntelligence(name),
    enabled: !!name,
  });

  const docs = data?.documents ?? [];
  const profile = data?.profile ?? null;
  const decisions = data?.decisions ?? [];
  const notes = data?.notes ?? [];

  // Group this vendor's documents by document type.
  const docGroups: { label: string; docs: VendorDocument[] }[] = (() => {
    const map = new Map<string, VendorDocument[]>();
    for (const d of docs) {
      const label = prettyLabel(d.contractType);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(d);
    }
    return Array.from(map.entries())
      .map(([label, ds]) => ({ label, docs: ds }))
      .sort((a, b) => b.docs.length - a.docs.length || a.label.localeCompare(b.label));
  })();

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div className="space-y-2">
          <Link to="/app/legal/library" className="inline-flex items-center gap-1.5 text-xs text-foreground/50 hover:text-foreground/80 transition-colors">
            <ArrowLeft size={13} /> Back to library
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{name}</h1>
          <p className="text-sm text-foreground/50">Everything Zane knows about how you deal with this vendor.</p>
        </div>

        {isLoading && <div className="text-center py-16 text-foreground/40 text-sm">Loading vendor intelligence…</div>}

        {!isLoading && (
          <>
            {/* Negotiation profile */}
            <section className="card shadow-sm p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-blue-400" />
                <h2 className="text-sm font-semibold text-foreground">Negotiation profile</h2>
              </div>
              {profile ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-border px-4 py-3">
                      <div className="text-lg font-semibold text-foreground">{profile.contracts}</div>
                      <div className="text-[11px] text-foreground/50 mt-0.5">Contracts</div>
                    </div>
                    <div className="rounded-lg border border-border px-4 py-3">
                      <div className="text-lg font-semibold text-foreground">{profile.totalMoves}</div>
                      <div className="text-[11px] text-foreground/50 mt-0.5">Captured moves</div>
                    </div>
                    <div className="rounded-lg border border-border px-4 py-3">
                      <div className="text-lg font-semibold text-foreground">{profile.avgRoundsToClose ?? "-"}</div>
                      <div className="text-[11px] text-foreground/50 mt-0.5">Avg rounds to close</div>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/70">Typically {profile.typicalMovement}.</p>
                  {profile.alwaysPushOn.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-foreground/40 mb-1.5">Consistently pushes on</div>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.alwaysPushOn.map((c) => (
                          <span key={c} className="text-xs px-2 py-0.5 rounded-full border border-amber-500/25 bg-amber-500/10 text-amber-300">{prettyLabel(c)}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile.neverConcede.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-foreground/40 mb-1.5">Rarely concedes</div>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.neverConcede.map((c) => (
                          <span key={c} className="text-xs px-2 py-0.5 rounded-full border border-red-500/25 bg-red-500/10 text-red-300">{prettyLabel(c)}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-foreground/50">No negotiation history captured yet. This builds as contracts with this vendor are negotiated over email.</p>
              )}
            </section>

            {/* Worth considering for the next contract */}
            {notes.length > 0 && (
              <section className="card shadow-sm p-5 sm:p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Lightbulb size={16} className="text-blue-400" />
                  <h2 className="text-sm font-semibold text-foreground">Worth considering for your next contract</h2>
                </div>
                <ul className="space-y-1.5">
                  {notes.map((n, i) => (
                    <li key={i} className="text-sm text-foreground/70 leading-relaxed">• {n}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* Significant decisions and captured reasoning */}
            {decisions.length > 0 && (
              <section className="card shadow-sm p-5 sm:p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <ScrollText size={16} className="text-blue-400" />
                  <h2 className="text-sm font-semibold text-foreground">Decisions and captured reasoning</h2>
                </div>
                <div className="divide-y divide-border/50">
                  {decisions.map((d, i) => (
                    <div key={i} className="py-3 first:pt-0 last:pb-0">
                      <div className="text-sm text-foreground">
                        <span className="font-semibold">{ACTION_LABELS[d.humanAction] ?? prettyLabel(d.humanAction)}</span>
                        {d.clauseCategory && <span> on {prettyLabel(d.clauseCategory)}</span>}
                        {d.finalPosition && <span className="text-foreground/70">: {d.finalPosition}</span>}
                      </div>
                      {d.reason && <div className="text-xs text-foreground/50 mt-1 leading-relaxed">Reason: {d.reason}</div>}
                      <div className="text-[11px] text-foreground/30 mt-1">{d.contractName}{d.contractName && formatDate(d.created) ? " · " : ""}{formatDate(d.created)}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Documents grouped by type */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-foreground/50" />
                <h2 className="text-sm font-semibold text-foreground">Documents <span className="font-normal text-foreground/40">({docs.length})</span></h2>
              </div>
              {docs.length === 0 ? (
                <p className="text-xs text-foreground/50">No documents with this vendor yet.</p>
              ) : (
                <div className="space-y-5">
                  {docGroups.map((g) => (
                    <div key={g.label} className="space-y-1.5">
                      <div className="text-[11px] uppercase tracking-wider text-foreground/40">{g.label} ({g.docs.length})</div>
                      <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/40">
                        {g.docs.map((d) => (
                          <Link key={d.id} to={`/app/legal/review/${d.id}`}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors group">
                            <FileText size={15} className="text-foreground/30 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-foreground truncate">{d.originalName}</div>
                              <div className="text-[11px] text-foreground/40">
                                {d.status}{d.contractValue ? ` · ${d.currency || "£"}${d.contractValue.toLocaleString()}` : ""}{formatDate(d.uploadedAt) ? ` · ${formatDate(d.uploadedAt)}` : ""}
                              </div>
                            </div>
                            <ChevronRight size={15} className="text-foreground/30 shrink-0" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

      </div>
    </AppLayout>
  );
}
