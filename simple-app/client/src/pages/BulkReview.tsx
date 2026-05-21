import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload, FileText, ChevronRight, Download, X, Play, Loader2, CheckCircle,
  AlertTriangle, Folder,
} from "lucide-react";
import { uploadDocument, startReview, getDocuments } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import { CLAUSE_LABELS } from "../lib/types";
import type { UploadedDocument, ClauseCategory } from "../lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type DocWithResults = UploadedDocument & {
  reviewResults: { ragStatus: string; clauseCategory: string }[];
};

interface QueuedFile {
  id: string;
  file: File;
  contractType: string;
  counterpartyName: string;
  contractValue: string;
  folder: string;
  status: "queued" | "uploading" | "reviewing" | "done" | "error";
  error?: string;
}

const RAG_CELL: Record<string, string> = {
  RED:   "bg-[#1F0A0A] text-[#FCA5A5] border border-[#450A0A] font-semibold",
  AMBER: "bg-[#1C0F00] text-[#FCD34D] border border-[#431407] font-semibold",
  GREEN: "bg-[#052E16] text-[#86EFAC] border border-[#14532D] font-semibold",
  GREY:  "bg-[#0F172A] text-[#94A3B8] border border-[#334155]",
};

const RAG_SHORT: Record<string, string> = {
  RED: "R", AMBER: "A", GREEN: "G", GREY: "-",
};

const CONTRACT_TYPES = [
  { value: "SUPPLIER_AGREEMENT",  label: "Supplier Agreement" },
  { value: "CUSTOMER_AGREEMENT",  label: "Customer Agreement" },
  { value: "MSA",                 label: "Master Services Agreement" },
  { value: "NDA",                 label: "NDA" },
  { value: "SAAS_AGREEMENT",      label: "SaaS / Technology Agreement" },
  { value: "EMPLOYMENT_CONTRACT", label: "Employment Contract" },
  { value: "OTHER",               label: "Other" },
];

function nanoid8() { return Math.random().toString(36).slice(2, 10); }

// ── File queue table ──────────────────────────────────────────────────────────

function FileQueue({
  queue,
  onUpdate,
  onRemove,
  onStart,
  isRunning,
}: {
  queue: QueuedFile[];
  onUpdate: (id: string, field: keyof QueuedFile, value: string) => void;
  onRemove: (id: string) => void;
  onStart: () => void;
  isRunning: boolean;
}) {
  const pendingCount = queue.filter((f) => f.status === "queued").length;
  const doneCount = queue.filter((f) => f.status === "done").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          {queue.length} file{queue.length !== 1 ? "s" : ""} in queue
          {doneCount > 0 && <span className="text-green-400 ml-2">· {doneCount} complete</span>}
        </div>
        {pendingCount > 0 && (
          <button
            className="btn-primary gap-2 text-sm"
            onClick={onStart}
            disabled={isRunning}
          >
            {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {isRunning ? "Reviewing…" : `Start review (${pendingCount})`}
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted border-b border-border">
              <th className="text-left px-3 py-2 font-medium text-foreground/70 min-w-[180px]">File</th>
              <th className="text-left px-3 py-2 font-medium text-foreground/70 min-w-[160px]">Contract type</th>
              <th className="text-left px-3 py-2 font-medium text-foreground/70 min-w-[140px]">Counterparty</th>
              <th className="text-left px-3 py-2 font-medium text-foreground/70 min-w-[100px]">Value (£)</th>
              <th className="text-left px-3 py-2 font-medium text-foreground/70 min-w-[120px]">Folder</th>
              <th className="px-3 py-2 min-w-[90px]">Status</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {queue.map((qf) => (
              <tr key={qf.id} className={`${qf.status === "error" ? "bg-red-500/5" : qf.status === "done" ? "bg-green-500/5" : ""}`}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <FileText size={12} className="shrink-0 text-foreground/40" />
                    <span className="truncate max-w-[140px] font-medium" title={qf.file.name}>
                      {qf.file.name}
                    </span>
                  </div>
                  <div className="text-[10px] text-foreground/30 pl-4">
                    {(qf.file.size / 1024).toFixed(0)} KB
                  </div>
                </td>
                <td className="px-3 py-2">
                  {qf.status === "queued" ? (
                    <select
                      className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-foreground outline-none focus:border-blue-500"
                      value={qf.contractType}
                      onChange={(e) => onUpdate(qf.id, "contractType", e.target.value)}
                    >
                      {CONTRACT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-foreground/60">{CONTRACT_TYPES.find((t) => t.value === qf.contractType)?.label ?? qf.contractType}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {qf.status === "queued" ? (
                    <input
                      className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-foreground outline-none focus:border-blue-500"
                      placeholder="Counterparty name"
                      value={qf.counterpartyName}
                      onChange={(e) => onUpdate(qf.id, "counterpartyName", e.target.value)}
                    />
                  ) : (
                    <span className="text-foreground/60">{qf.counterpartyName || "-"}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {qf.status === "queued" ? (
                    <input
                      className="w-full bg-card border border-border rounded px-1.5 py-1 text-xs text-foreground outline-none focus:border-blue-500"
                      placeholder="0"
                      type="number"
                      min="0"
                      value={qf.contractValue}
                      onChange={(e) => onUpdate(qf.id, "contractValue", e.target.value)}
                    />
                  ) : (
                    <span className="text-foreground/60">{qf.contractValue ? `£${Number(qf.contractValue).toLocaleString()}` : "-"}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {qf.status === "queued" ? (
                    <div className="relative">
                      <Folder size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-foreground/30" />
                      <input
                        className="w-full bg-card border border-border rounded pl-5 pr-1.5 py-1 text-xs text-foreground outline-none focus:border-blue-500"
                        placeholder="Optional folder"
                        value={qf.folder}
                        onChange={(e) => onUpdate(qf.id, "folder", e.target.value)}
                      />
                    </div>
                  ) : (
                    <span className="text-foreground/60">{qf.folder || "-"}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {qf.status === "queued" && <span className="text-[10px] text-foreground/40">Queued</span>}
                  {qf.status === "uploading" && (
                    <span className="flex items-center gap-1 justify-center text-amber-400 text-[10px]">
                      <Loader2 size={10} className="animate-spin" />Uploading
                    </span>
                  )}
                  {qf.status === "reviewing" && (
                    <span className="flex items-center gap-1 justify-center text-blue-400 text-[10px]">
                      <Loader2 size={10} className="animate-spin" />Reviewing
                    </span>
                  )}
                  {qf.status === "done" && (
                    <span className="flex items-center gap-1 justify-center text-green-400 text-[10px]">
                      <CheckCircle size={10} />Done
                    </span>
                  )}
                  {qf.status === "error" && (
                    <span className="flex items-center gap-1 justify-center text-red-400 text-[10px]" title={qf.error}>
                      <AlertTriangle size={10} />Error
                    </span>
                  )}
                </td>
                <td className="px-2 py-2">
                  {(qf.status === "queued" || qf.status === "error") && (
                    <button
                      className="text-foreground/30 hover:text-red-400 transition-colors"
                      onClick={() => onRemove(qf.id)}
                    >
                      <X size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BulkReview() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const { data: allDocs = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getDocuments(),
    refetchInterval: (query) => {
      const docs = query.state.data as DocWithResults[] | undefined;
      return docs?.some((d) => d.status === "PROCESSING") ? 4000 : false;
    },
  });

  const reviewMutation = useMutation({
    mutationFn: startReview,
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["documents"] }); },
  });

  const docs = (allDocs as DocWithResults[]).filter(
    (d) => d.status === "COMPLETE" && d.reviewResults?.length > 0
  );

  const allCategories = Array.from(
    new Set(docs.flatMap((d) => d.reviewResults.map((r) => r.clauseCategory)))
  ) as ClauseCategory[];

  const processingDocs = (allDocs as DocWithResults[]).filter((d) => d.status === "PROCESSING");

  // Add files to queue
  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: QueuedFile[] = Array.from(files).map((file) => ({
      id: nanoid8(),
      file,
      contractType: "SUPPLIER_AGREEMENT",
      counterpartyName: "",
      contractValue: "",
      folder: "",
      status: "queued" as const,
    }));
    setQueue((prev) => [...prev, ...newItems]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) addFiles(files);
  }, [addFiles]);

  const updateFile = (id: string, field: keyof QueuedFile, value: string) => {
    setQueue((prev) => prev.map((f) => f.id === id ? { ...f, [field]: value } : f));
  };

  const removeFile = (id: string) => {
    setQueue((prev) => prev.filter((f) => f.id !== id));
  };

  const setFileStatus = (id: string, status: QueuedFile["status"], error?: string) => {
    setQueue((prev) => prev.map((f) => f.id === id ? { ...f, status, error } : f));
  };

  async function runQueue() {
    setIsRunning(true);
    const pending = queue.filter((f) => f.status === "queued");

    // Process sequentially to avoid overwhelming the server
    for (const qf of pending) {
      try {
        setFileStatus(qf.id, "uploading");
        const doc = await uploadDocument(qf.file, qf.contractType, {
          counterpartyName: qf.counterpartyName || undefined,
          contractValue: qf.contractValue ? Number(qf.contractValue) : undefined,
          // folder is a doc field - set via PATCH after upload if specified
        });

        // Set folder if specified
        if (qf.folder) {
          await fetch(`/api/documents/${doc.id}/folder`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder: qf.folder }),
          }).catch(() => null);
        }

        setFileStatus(qf.id, "reviewing");
        await reviewMutation.mutateAsync(doc.id);
        setFileStatus(qf.id, "done");
      } catch (err) {
        setFileStatus(qf.id, "error", (err as Error).message);
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["documents"] });
    setIsRunning(false);
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
    a.download = `zane-bulk-review-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 max-w-6xl">
          <div>
            <h1 className="text-2xl font-semibold">Bulk Review</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload and configure multiple contracts at once - enter metadata per file before starting review.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {docs.length > 0 && (
              <button className="btn-secondary flex items-center gap-2 text-sm" onClick={exportCSV}>
                <Download size={14} /> Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Drag-and-drop zone */}
        <div
          className={`max-w-6xl border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            dragOver
              ? "border-blue-500 bg-blue-500/10"
              : "border-border hover:border-blue-500/50 hover:bg-white/5"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={28} className={`mx-auto mb-3 ${dragOver ? "text-blue-400" : "text-foreground/20"}`} />
          <div className="text-sm font-medium text-foreground/70">
            {dragOver ? "Drop files to add to queue" : "Drag & drop contracts here, or click to select"}
          </div>
          <div className="text-xs text-foreground/40 mt-1">PDF and DOCX supported · Multiple files</div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.doc"
            multiple
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* File queue */}
        {queue.length > 0 && (
          <div className="max-w-6xl">
            <FileQueue
              queue={queue}
              onUpdate={updateFile}
              onRemove={removeFile}
              onStart={() => void runQueue()}
              isRunning={isRunning}
            />
          </div>
        )}

        {/* Processing indicator */}
        {processingDocs.length > 0 && (
          <div className="max-w-6xl card p-4 flex items-center gap-3 border-[#431407] bg-[#1C0F00]">
            <div className="w-4 h-4 rounded-full border-2 border-[#FCD34D] border-t-transparent animate-spin shrink-0" />
            <span className="text-sm text-[#FCD34D]">
              {processingDocs.length} contract{processingDocs.length !== 1 ? "s" : ""} being reviewed. Results will appear automatically.
            </span>
          </div>
        )}

        {/* Risk matrix table */}
        {docs.length > 0 && allCategories.length > 0 && (
          <>
            <div className="max-w-6xl">
              <div className="text-sm font-semibold mb-2">Portfolio risk matrix</div>
              <p className="text-xs text-muted-foreground mb-3">
                Completed reviews - click any row to open the full review detail.
              </p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-card-border max-w-full">
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
                        className={`border-b border-card-border hover:bg-muted/30 transition-colors cursor-pointer ${hasRed ? "bg-[#1F0A0A]/40" : ""}`}
                        onClick={() => navigate(`/review/${doc.id}`)}
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
                          {d.contractValue ? `£${d.contractValue.toLocaleString("en-GB")}` : "-"}
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
                                <span className="text-muted-foreground/30">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-3">
                          <ChevronRight size={15} className="text-muted-foreground" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Legend */}
        {docs.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground max-w-6xl">
            <span className="font-medium">Key:</span>
            {[
              { short: "R", label: "Red: review required", cls: "bg-[#1F0A0A] text-[#FCA5A5] border border-[#450A0A]" },
              { short: "A", label: "Amber: caution",       cls: "bg-[#1C0F00] text-[#FCD34D] border border-[#431407]" },
              { short: "G", label: "Green: acceptable",    cls: "bg-[#052E16] text-[#86EFAC] border border-[#14532D]" },
              { short: "-", label: "Not found",             cls: "bg-[#0F172A] text-[#94A3B8] border border-[#334155]" },
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
