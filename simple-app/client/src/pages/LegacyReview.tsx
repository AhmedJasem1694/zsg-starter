import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive, Upload, Loader2, CheckCircle, XCircle, AlertTriangle,
  CalendarClock, Download, ChevronUp, ChevronDown, Calculator,
} from "lucide-react";
import AppLayout from "../components/layout/AppLayout";
import {
  uploadDocument, startLegacyReview, getLegacyReport, getLegacyQuote,
  type LegacyReportRow, type LegacyQuote,
} from "../lib/api";
import { useAuth } from "../hooks/useAuth";

// ─── Client-side upload queue ─────────────────────────────────────────────────

interface QueueItem {
  name: string;
  state: "queued" | "uploading" | "submitted" | "failed";
  error?: string;
}

const MAX_BATCH = 100;
const UPLOAD_CONCURRENCY = 3;

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(rows: LegacyReportRow[]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = [
    "Contract", "Counterparty", "Type", "Status", "Value", "Currency",
    "Term", "End date", "Auto-renewal", "Renewal date", "Notice period (days)",
    "Governing law", "Liability cap", "Termination rights", "Assignment",
    "Data protection", "Risk flags",
  ];
  const lines = rows.map((r) => [
    r.name, r.counterparty, r.contractType, r.status, r.value ?? "", r.currency,
    r.termSummary, r.endDate ?? "", r.autoRenewal ? "Yes" : "No", r.renewalDate ?? "",
    r.noticePeriodDays ?? "", r.governingLaw, r.liabilityCap, r.terminationRights,
    r.assignment, r.dataProtection, r.riskFlags.join("; "),
  ].map(esc).join(","));
  const csv = [header.map(esc).join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `legacy-review-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sortable table helpers ───────────────────────────────────────────────────

type SortKey = "name" | "counterparty" | "contractType" | "value" | "renewalDate" | "governingLaw" | "riskFlags";

function compareRows(a: LegacyReportRow, b: LegacyReportRow, key: SortKey): number {
  switch (key) {
    case "value":      return (a.value ?? -1) - (b.value ?? -1);
    case "riskFlags":  return a.riskFlags.length - b.riskFlags.length;
    case "renewalDate": return String(a.renewalDate ?? "9999").localeCompare(String(b.renewalDate ?? "9999"));
    default:           return String(a[key] ?? "").localeCompare(String(b[key] ?? ""));
  }
}

const STATUS_LABELS: Record<string, string> = {
  PROCESSING: "Queued",
  PARSING: "Reading document",
  CLASSIFYING: "Classifying",
  ANONYMISING: "Anonymising",
  COMPARING: "Extracting key terms",
  COMPLETE: "Complete",
  FAILED: "Failed",
};

function fmtMoney(v: number | null, currency: string): string {
  if (v === null || v === undefined) return "-";
  const sym = currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : `${currency} `;
  return `${sym}${v.toLocaleString()}`;
}

// ─── Admin-only: internal indicative quoting helper ────────────────────────────
// A sales aid for quoting legacy review during conversations. NOT customer-facing;
// price bands live server-side and the endpoint is admin-gated.

function AdminLegacyQuote() {
  const [input, setInput] = useState("");
  const [quote, setQuote] = useState<LegacyQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;

  async function calculate() {
    const n = Math.max(0, Math.floor(Number(input) || 0));
    if (!n) { setQuote(null); setError("Enter a number of contracts."); return; }
    setLoading(true); setError(null);
    try {
      setQuote(await getLegacyQuote(n));
    } catch {
      setError("Could not calculate (admin access required).");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-6 space-y-4 border-dashed">
      <div className="flex items-center gap-2 flex-wrap">
        <Calculator size={16} className="text-primary" />
        <div className="text-sm font-semibold">Internal indicative pricing</div>
        <span className="text-[10px] uppercase tracking-widest text-[#FCD34D] border border-[#FCD34D]/30 rounded px-1.5 py-0.5">Admin only</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
        Sales helper for quoting legacy review. Not a customer-facing price list and not shown publicly. Pricing stays conversation-led.
      </p>
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Number of contracts</label>
          <input
            type="number" min={0} value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void calculate(); }}
            placeholder="e.g. 300"
            className="bg-card border border-card-border rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:border-primary"
          />
        </div>
        <button className="btn-secondary text-sm gap-2" onClick={() => void calculate()} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : null} Calculate
        </button>
      </div>
      {error && <p className="text-xs text-[#FCA5A5]">{error}</p>}
      {quote && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-card-border px-4 py-3">
            <div className="text-[11px] text-muted-foreground">Band</div>
            <div className="text-sm font-semibold mt-0.5">{quote.band}</div>
          </div>
          <div className="rounded-lg border border-card-border px-4 py-3">
            <div className="text-[11px] text-muted-foreground">Per contract</div>
            <div className="text-lg font-semibold mt-0.5">{gbp(quote.perContract)}</div>
          </div>
          <div className="rounded-lg border border-card-border px-4 py-3">
            <div className="text-[11px] text-muted-foreground">Indicative total</div>
            <div className="text-lg font-semibold mt-0.5">{gbp(quote.total)}</div>
          </div>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground/60">Indicative only. Final pricing agreed in conversation.</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LegacyReview() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [uploadingBatch, setUploadingBatch] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("renewalDate");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const { data: report } = useQuery({
    queryKey: ["legacy-report"],
    queryFn: getLegacyReport,
    refetchInterval: (query) => {
      const s = query.state.data?.summary;
      // Poll while anything is still processing (or a batch is uploading)
      return (s && s.processing > 0) || uploadingBatch ? 4000 : false;
    },
  });

  const rows = report?.rows ?? [];
  const summary = report?.summary ?? null;
  const renewals = report?.renewals ?? [];
  const completeRows = rows.filter((r) => r.status === "COMPLETE");

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    let files = Array.from(fileList);
    if (files.length > MAX_BATCH) {
      files = files.slice(0, MAX_BATCH);
    }
    const items: QueueItem[] = files.map((f) => ({ name: f.name, state: "queued" }));
    setQueue(items);
    setUploadingBatch(true);

    // Upload with limited concurrency; each file then kicks off the
    // lightweight legacy pipeline server-side.
    let nextIndex = 0;
    const setItem = (i: number, patch: Partial<QueueItem>) =>
      setQueue((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

    async function worker() {
      while (nextIndex < files.length) {
        const i = nextIndex++;
        const file = files[i];
        setItem(i, { state: "uploading" });
        try {
          const doc = await uploadDocument(file, "OTHER", {});
          await startLegacyReview(doc.id);
          setItem(i, { state: "submitted" });
        } catch (err) {
          setItem(i, { state: "failed", error: err instanceof Error ? err.message : "Upload failed" });
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, () => worker()));
    setUploadingBatch(false);
    void queryClient.invalidateQueries({ queryKey: ["legacy-report"] });
    void queryClient.invalidateQueries({ queryKey: ["documents"] });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(1); }
  }

  const sortedRows = [...rows].sort((a, b) => compareRows(a, b, sortKey) * sortDir);

  const uploadsInFlight = queue.filter((q) => q.state === "queued" || q.state === "uploading").length;
  const serverProcessing = summary?.processing ?? 0;

  const SortHeader = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th
      className="px-3 py-2.5 text-left cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap"
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === k && (sortDir === 1 ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
      </span>
    </th>
  );

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Archive size={22} className="text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Legacy Review</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Map your historical contract estate, terms, renewals, and risks, with a cost-controlled extraction pipeline.
              </p>
            </div>
          </div>
          {completeRows.length > 0 && (
            <button className="btn-secondary gap-2 text-sm" onClick={() => exportCsv(sortedRows.filter((r) => r.status === "COMPLETE"))}>
              <Download size={14} />
              Export CSV
            </button>
          )}
        </div>

        {/* Admin-only internal quoting helper */}
        {user?.isAdmin && <AdminLegacyQuote />}

        {/* Upload zone */}
        <div className="card p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-sm font-semibold">Bulk upload</div>
              <p className="text-xs text-muted-foreground mt-1">
                Up to {MAX_BATCH} files per batch. PDF or DOCX. Each contract runs a lightweight extraction of
                parties, term, value, renewals, termination, liability cap, governing law, assignment, data protection.
              </p>
            </div>
            <button
              className="btn-primary gap-2 text-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingBatch}
            >
              {uploadingBatch ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploadingBatch ? `Uploading ${uploadsInFlight} remaining…` : "Select files"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc"
              className="hidden"
              onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }}
            />
          </div>

          {/* Client upload queue */}
          {queue.length > 0 && (
            <div className="border-t border-card-border pt-3 space-y-1 max-h-48 overflow-y-auto">
              {queue.map((q, i) => (
                <div key={`${q.name}-${i}`} className="flex items-center gap-2 text-xs">
                  {q.state === "queued"    && <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />}
                  {q.state === "uploading" && <Loader2 size={14} className="animate-spin text-primary shrink-0" />}
                  {q.state === "submitted" && <CheckCircle size={14} className="text-[#86EFAC] shrink-0" />}
                  {q.state === "failed"    && <XCircle size={14} className="text-[#FCA5A5] shrink-0" />}
                  <span className="truncate text-foreground/80">{q.name}</span>
                  <span className="text-muted-foreground/60 shrink-0 ml-auto">
                    {q.state === "submitted" ? "processing" : q.state === "failed" ? (q.error ?? "failed") : q.state}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Exposure summary */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="card p-4">
              <div className="text-xl font-bold">{summary.total}</div>
              <div className="text-xs text-muted-foreground mt-1">Contracts {serverProcessing > 0 && `(${serverProcessing} processing)`}</div>
            </div>
            <div className="card p-4">
              <div className="text-xl font-bold">{fmtMoney(summary.totalValue, "GBP")}</div>
              <div className="text-xs text-muted-foreground mt-1">Total stated value</div>
            </div>
            <div className="card p-4">
              <div className="text-xl font-bold text-[#FCA5A5]">{fmtMoney(summary.flaggedValue, "GBP")}</div>
              <div className="text-xs text-muted-foreground mt-1">Value carrying risk flags</div>
            </div>
            <div className="card p-4">
              <div className="text-xl font-bold">{summary.renewalsNext12mo}</div>
              <div className="text-xs text-muted-foreground mt-1">Renewals next 12 months</div>
            </div>
            <div className="card p-4">
              <div className="text-xl font-bold">{summary.uncappedLiability}</div>
              <div className="text-xs text-muted-foreground mt-1">Liability cap issues</div>
            </div>
            <div className="card p-4">
              <div className="text-xl font-bold">{summary.missingGoverningLaw}</div>
              <div className="text-xs text-muted-foreground mt-1">Missing governing law</div>
            </div>
          </div>
        )}

        {/* Renewals timeline */}
        {renewals.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <CalendarClock size={13} /> Renewals &amp; expiries, next 12 months
            </h2>
            <div className="card divide-y divide-card-border/50">
              {renewals.map((r) => {
                const days = Math.ceil((Date.parse(r.date) - Date.now()) / 86_400_000);
                return (
                  <div key={r.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 ${days <= 60 ? "rag-amber" : "bg-muted text-muted-foreground"}`}>
                      {r.date}
                    </span>
                    <span className="text-foreground/90 truncate">{r.name}</span>
                    {r.counterparty && <span className="text-muted-foreground truncate">· {r.counterparty}</span>}
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">
                      {r.kind} in {days} day{days !== 1 ? "s" : ""}
                      {r.autoRenewal && r.noticePeriodDays ? `, ${r.noticePeriodDays} days' notice required` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Portfolio table */}
        {rows.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
              Contract estate ({rows.length})
            </h2>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border text-xs uppercase tracking-wider text-muted-foreground/60">
                    <SortHeader k="name">Contract</SortHeader>
                    <SortHeader k="counterparty">Counterparty</SortHeader>
                    <SortHeader k="contractType">Type</SortHeader>
                    <SortHeader k="value">Value</SortHeader>
                    <SortHeader k="renewalDate">Renewal</SortHeader>
                    <SortHeader k="governingLaw">Governing law</SortHeader>
                    <th className="px-3 py-2.5 text-left whitespace-nowrap">Liability cap</th>
                    <SortHeader k="riskFlags">Risk flags</SortHeader>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r) => (
                    <tr key={r.id} className="border-b border-card-border/50 last:border-0 align-top">
                      <td className="px-3 py-3">
                        <div className="text-foreground/90 max-w-[220px] truncate">{r.name}</div>
                        <div className="text-[11px] text-muted-foreground/60 mt-0.5">
                          {STATUS_LABELS[r.status] ?? r.status}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground max-w-[160px] truncate">{r.counterparty || "-"}</td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{r.contractType.replace(/_/g, " ") || "-"}</td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{fmtMoney(r.value, r.currency)}</td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                        {r.renewalDate ?? r.endDate ?? "-"}
                        {r.autoRenewal && <span className="block text-[10px] text-[#FCD34D]">auto-renews</span>}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground max-w-[120px] truncate">{r.governingLaw || "-"}</td>
                      <td className="px-3 py-3 text-muted-foreground max-w-[200px]">
                        <span className="line-clamp-2">{r.liabilityCap || "-"}</span>
                      </td>
                      <td className="px-3 py-3">
                        {r.riskFlags.length === 0 ? (
                          <span className="text-muted-foreground/50 text-xs">{r.status === "COMPLETE" ? "None" : "-"}</span>
                        ) : (
                          <div className="space-y-1">
                            {r.riskFlags.map((f) => (
                              <span key={f} className="flex items-center gap-1 text-xs text-[#FCA5A5]">
                                <AlertTriangle size={10} className="shrink-0" /> {f}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card p-14 text-center space-y-4">
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mx-auto">
              <Archive size={24} className="text-muted-foreground/50" />
            </div>
            <div className="space-y-2">
              <div className="font-semibold">No legacy contracts yet</div>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                Upload your historical contracts above. Zane extracts key terms, renewal dates, and risk
                flags from each one and builds a structured map of your entire contract estate.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
