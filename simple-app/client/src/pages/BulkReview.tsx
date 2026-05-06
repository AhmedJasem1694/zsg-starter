import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, ChevronRight, Download } from "lucide-react";
import { uploadDocument, startReview, getDocuments } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import { CLAUSE_LABELS } from "../lib/types";
import type { UploadedDocument, ClauseCategory } from "../lib/types";

type DocWithResults = UploadedDocument & {
  reviewResults: { ragStatus: string; clauseCategory: string }[];
};

const RAG_CELL: Record<string, string> = {
  RED:   "bg-red-100 text-red-700 font-semibold",
  AMBER: "bg-amber-100 text-amber-700 font-semibold",
  GREEN: "bg-emerald-100 text-emerald-700 font-semibold",
  GREY:  "bg-slate-100 text-slate-500",
};

const RAG_SHORT: Record<string, string> = {
  RED: "R", AMBER: "A", GREEN: "G", GREY: "—",
};

export default function BulkReview() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [selectedContractType, setSelectedContractType] = useState("SUPPLIER_AGREEMENT");

  const { data: allDocs = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getDocuments(),
    refetchInterval: (query) => {
      const docs = query.state.data as DocWithResults[] | undefined;
      return docs?.some((d) => d.status === "PROCESSING") ? 4000 : false;
    },
  });

  const docs = (allDocs as DocWithResults[]).filter(
    (d) => d.status === "COMPLETE" && d.reviewResults?.length > 0
  );

  const allCategories = Array.from(
    new Set(docs.flatMap((d) => d.reviewResults.map((r) => r.clauseCategory)))
  ) as ClauseCategory[];

  const reviewMutation = useMutation({
    mutationFn: startReview,
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["documents"] }); },
  });

  async function handleFiles(files: FileList) {
    setUploading(true);
    setUploadingCount(files.length);
    try {
      const uploads = Array.from(files).map(async (file) => {
        const doc = await uploadDocument(file, selectedContractType);
        await reviewMutation.mutateAsync(doc.id);
      });
      await Promise.all(uploads);
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
      setUploadingCount(0);
    }
  }

  function exportCSV() {
    const headers = ["Contract", "Counterparty", "Type", "Value", ...allCategories.map((c) => CLAUSE_LABELS[c] ?? c)];
    const rows = docs.map((doc) => {
      const d = doc as DocWithResults & { counterpartyName?: string; contractValue?: number };
      const ragMap: Record<string, string> = {};
      doc.reviewResults.forEach((r) => { ragMap[r.clauseCategory] = r.ragStatus; });
      return [
        d.originalName,
        d.counterpartyName ?? "",
        d.contractType.replace(/_/g, " "),
        d.contractValue ? `£${d.contractValue.toLocaleString("en-GB")}` : "",
        ...allCategories.map((c) => ragMap[c] ?? ""),
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mike-bulk-review-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const processingDocs = (allDocs as DocWithResults[]).filter((d) => d.status === "PROCESSING");

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 max-w-5xl">
          <div>
            <h1 className="text-2xl font-semibold">Bulk review</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload multiple contracts at once. MIKE reviews them all and shows a risk matrix across your portfolio.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {docs.length > 0 && (
              <button className="btn-secondary flex items-center gap-2 text-sm" onClick={exportCSV}>
                <Download size={14} /> Export CSV
              </button>
            )}
            <button
              className="btn-primary flex items-center gap-2 text-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={14} />
              {uploading ? `Uploading ${uploadingCount} file${uploadingCount !== 1 ? "s" : ""}…` : "Upload contracts"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.doc"
              multiple
              onChange={(e) => {
                if (e.target.files?.length) void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {/* Contract type selector */}
        <div className="max-w-5xl flex items-center gap-3">
          <label className="text-xs text-muted-foreground shrink-0">Contract type for batch:</label>
          <select
            className="input text-sm py-1.5 w-auto"
            value={selectedContractType}
            onChange={(e) => setSelectedContractType(e.target.value)}
          >
            <option value="SUPPLIER_AGREEMENT">Supplier Agreement</option>
            <option value="CUSTOMER_AGREEMENT">Customer Agreement</option>
            <option value="MSA">Master Services Agreement</option>
            <option value="NDA">NDA</option>
            <option value="SAAS_AGREEMENT">SaaS / Technology Agreement</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {/* Processing indicator */}
        {processingDocs.length > 0 && (
          <div className="max-w-5xl card p-4 flex items-center gap-3 border-amber-200 bg-amber-50">
            <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin shrink-0" />
            <span className="text-sm text-amber-800">
              {processingDocs.length} contract{processingDocs.length !== 1 ? "s" : ""} being reviewed — results will appear automatically.
            </span>
          </div>
        )}

        {/* Empty state */}
        {docs.length === 0 && !uploading && processingDocs.length === 0 && (
          <div
            className="max-w-5xl card p-16 text-center border-2 border-dashed cursor-pointer hover:border-primary/60 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={36} className="text-muted-foreground/30 mx-auto mb-4" />
            <div className="text-base font-semibold">Upload contracts to begin</div>
            <div className="text-sm text-muted-foreground mt-1">
              Select multiple PDF or DOCX files — MIKE reviews them all in parallel
            </div>
          </div>
        )}

        {/* Risk matrix table */}
        {docs.length > 0 && allCategories.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-card-border">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted border-b border-card-border">
                  <th className="text-left px-4 py-3 font-semibold text-sm sticky left-0 bg-muted z-10 min-w-[200px]">
                    Contract
                  </th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">Type</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">Value</th>
                  {allCategories.map((cat) => (
                    <th key={cat} className="px-2 py-3 font-medium text-muted-foreground text-center">
                      <div className="w-20 truncate text-[10px]" title={CLAUSE_LABELS[cat] ?? cat}>
                        {CLAUSE_LABELS[cat] ?? cat}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-muted-foreground" />
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => {
                  const d = doc as DocWithResults & { counterpartyName?: string; contractValue?: number };
                  const ragMap: Record<string, string> = {};
                  doc.reviewResults.forEach((r) => { ragMap[r.clauseCategory] = r.ragStatus; });
                  const hasRed = Object.values(ragMap).some((s) => s === "RED");
                  return (
                    <tr
                      key={doc.id}
                      className={`border-b border-card-border hover:bg-muted/30 transition-colors ${hasRed ? "bg-red-50/30" : ""}`}
                    >
                      <td className="px-4 py-3 sticky left-0 bg-background z-10 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <FileText size={13} className="text-muted-foreground shrink-0" />
                          <span className="font-medium truncate max-w-[160px]">{doc.originalName}</span>
                        </div>
                        {d.counterpartyName && (
                          <div className="text-muted-foreground text-[10px] mt-0.5 pl-5 truncate">
                            {d.counterpartyName}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                        {doc.contractType.replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                        {d.contractValue ? `£${d.contractValue.toLocaleString("en-GB")}` : "—"}
                      </td>
                      {allCategories.map((cat) => {
                        const status = ragMap[cat];
                        return (
                          <td key={cat} className="px-2 py-3 text-center">
                            {status ? (
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${RAG_CELL[status]}`}>
                                {RAG_SHORT[status]}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-3">
                        <button
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => navigate(`/review/${doc.id}`)}
                          title="Open full review"
                        >
                          <ChevronRight size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        {docs.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground max-w-5xl">
            <span className="font-medium">Key:</span>
            {[
              { short: "R", label: "Red — review required", cls: "bg-red-100 text-red-700" },
              { short: "A", label: "Amber — caution",       cls: "bg-amber-100 text-amber-700" },
              { short: "G", label: "Green — acceptable",    cls: "bg-emerald-100 text-emerald-700" },
              { short: "—", label: "Not found",             cls: "bg-slate-100 text-slate-500" },
            ].map(({ short, label, cls }) => (
              <span key={short} className="flex items-center gap-1.5">
                <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-[10px] ${cls}`}>{short}</span>
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
