import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, AlertCircle, CheckCircle, Clock, RotateCcw } from "lucide-react";
import { getDocuments, uploadDocument, startReview } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import type { UploadedDocument, DocumentStatus } from "../lib/types";

const STATUS_CONFIG: Record<DocumentStatus, { label: string; icon: React.ElementType; className: string }> = {
  UPLOADED:   { label: "Queued",      icon: Clock,         className: "text-muted-foreground" },
  PROCESSING: { label: "Reviewing…",  icon: Clock,         className: "text-amber-600" },
  COMPLETE:   { label: "Complete",    icon: CheckCircle,   className: "text-emerald-600" },
  FAILED:     { label: "Failed",      icon: AlertCircle,   className: "text-destructive" },
};

const CONTRACT_TYPES = [
  { value: "SUPPLIER_AGREEMENT", label: "Supplier Agreement" },
  { value: "CUSTOMER_AGREEMENT", label: "Customer Agreement" },
  { value: "MSA",                label: "Master Services Agreement" },
  { value: "NDA",                label: "NDA" },
  { value: "DPA",                label: "Data Processing Agreement" },
];

const RAG_COUNTS_KEY = ["rag-counts"];

function RagBar({ results }: { results?: { ragStatus: string }[] }) {
  if (!results?.length) return null;
  const red   = results.filter((r) => r.ragStatus === "RED").length;
  const amber = results.filter((r) => r.ragStatus === "AMBER").length;
  const green = results.filter((r) => r.ragStatus === "GREEN").length;
  const grey  = results.filter((r) => r.ragStatus === "GREY").length;
  const total = results.length;

  return (
    <div className="flex items-center gap-2">
      {red   > 0 && <span className="rag-red">{red} RED</span>}
      {amber > 0 && <span className="rag-amber">{amber} AMBER</span>}
      {green > 0 && <span className="rag-green">{green} GREEN</span>}
      {grey  > 0 && <span className="rag-grey">{grey} ABSENT</span>}
      <span className="text-xs text-muted-foreground">{total} clauses</span>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState("SUPPLIER_AGREEMENT");
  const [dragOver, setDragOver] = useState(false);

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: getDocuments,
    refetchInterval: (query) => {
      const docs = query.state.data as UploadedDocument[] | undefined;
      return docs?.some((d) => d.status === "PROCESSING") ? 3000 : false;
    },
  });

  const reviewMutation = useMutation({
    mutationFn: startReview,
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["documents"] }); },
  });

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const doc = await uploadDocument(file, selectedType);
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      await reviewMutation.mutateAsync(doc.id);
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  const processing = documents.some((d) => d.status === "PROCESSING");

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-5xl mx-auto space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Upload counterparty paper and MIKE reviews it against your playbook.</p>
        </div>

        {/* Upload card */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Upload a contract</h2>
              <p className="text-xs text-muted-foreground mt-0.5">PDF or DOCX · Max 20MB</p>
            </div>
            <select
              className="input text-sm py-1.5 w-auto min-w-[200px]"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              {CONTRACT_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
          </div>
          <div className="card-body">
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer
                ${dragOver ? "border-primary bg-accent" : "border-border hover:border-primary/60 hover:bg-accent/40"}
                ${uploading ? "opacity-60 pointer-events-none" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.doc"
                onChange={onFileChange}
              />
              {uploading ? (
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
                  <div className="text-sm font-medium">Uploading and starting review…</div>
                  <div className="text-xs text-muted-foreground">Hang tight — this takes a minute</div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mx-auto">
                    <Upload size={22} className="text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Drop your contract here</div>
                    <div className="text-xs text-muted-foreground mt-1">or click to browse files</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reviews table */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-base font-semibold">Reviews</h2>
            {processing && (
              <span className="text-xs text-amber-600 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Review in progress — auto-refreshing
              </span>
            )}
          </div>

          {documents.length === 0 ? (
            <div className="card-body text-center py-12">
              <FileText size={32} className="text-muted-foreground/40 mx-auto mb-3" />
              <div className="text-sm font-medium text-muted-foreground">No contracts reviewed yet</div>
              <div className="text-xs text-muted-foreground mt-1">Upload one above to get started</div>
            </div>
          ) : (
            <div className="divide-y divide-card-border">
              {documents.map((doc) => {
                const { label, icon: Icon, className } = STATUS_CONFIG[doc.status];
                const isClickable = doc.status === "COMPLETE";

                return (
                  <div
                    key={doc.id}
                    className={`px-6 py-4 flex items-center justify-between gap-4
                      ${isClickable ? "hover:bg-muted/30 cursor-pointer transition-colors" : ""}`}
                    onClick={isClickable ? () => navigate(`/review/${doc.id}`) : undefined}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <FileText size={15} className="text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{doc.originalName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {doc.contractType.replace(/_/g, " ")} ·{" "}
                          {new Date(doc.uploadedAt).toLocaleDateString("en-GB", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      {isClickable && (doc as UploadedDocument & { reviewResults?: { ragStatus: string }[] }).reviewResults && (
                        <RagBar results={(doc as UploadedDocument & { reviewResults?: { ragStatus: string }[] }).reviewResults} />
                      )}
                      <div className={`flex items-center gap-1.5 text-xs font-medium ${className}`}>
                        <Icon size={13} />
                        {label}
                        {doc.status === "PROCESSING" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse ml-0.5" />
                        )}
                      </div>
                      {doc.status === "FAILED" && (
                        <button
                          className="btn-ghost text-xs px-2 py-1 gap-1"
                          onClick={(e) => { e.stopPropagation(); reviewMutation.mutate(doc.id); }}
                        >
                          <RotateCcw size={12} /> Retry
                        </button>
                      )}
                      {isClickable && (
                        <span className="text-muted-foreground text-sm">→</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
