import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload, FileText, CheckCircle, AlertTriangle, Clock,
  ChevronRight, RotateCcw, AlertCircle, Sparkles,
} from "lucide-react";
import {
  getDocuments, uploadDocument, startReview, getCompany,
} from "../../lib/api";
import AppLayout from "../../components/layout/AppLayout";
import MikeNoticedPanel from "../../components/MikeNoticedPanel";
import MissingDocsPanel from "../../components/MissingDocsPanel";
import InvestorFlagsPanel from "../../components/InvestorFlagsPanel";
import type { DocumentStatus, UploadedDocument } from "../../lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocWithRag {
  id: string;
  originalName: string;
  contractType: string;
  status: DocumentStatus;
  uploadedAt: string;
  counterpartyName?: string;
  contractValue?: number;
  reviewResults?: { ragStatus: string }[];
}

type Verdict = "safe" | "caution" | "danger" | "pending";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getVerdict(results: { ragStatus: string }[]): Verdict {
  if (!results.length) return "pending";
  const red   = results.filter((r) => r.ragStatus === "RED").length;
  const amber = results.filter((r) => r.ragStatus === "AMBER").length;
  if (red >= 1)   return "danger";
  if (amber >= 2) return "caution";
  return "safe";
}

const VERDICT_CONFIG: Record<Verdict, {
  label: string; sublabel: string;
  color: string; bg: string; border: string; icon: React.ElementType;
}> = {
  safe:    { label: "Looks good",           sublabel: "No major issues found",       color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", icon: CheckCircle   },
  caution: { label: "Worth a closer look",  sublabel: "A few things to negotiate",   color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200",   icon: AlertTriangle },
  danger:  { label: "Don't sign yet",       sublabel: "Fix these issues first",      color: "text-red-700",     bg: "bg-red-50",      border: "border-red-200",     icon: AlertTriangle },
  pending: { label: "Reviewing…",           sublabel: "MIKE is reading your contract", color: "text-muted-foreground", bg: "bg-muted", border: "border-border",    icon: Clock         },
};

const CONTRACT_TYPES = [
  { value: "SUPPLIER_AGREEMENT",    label: "Supplier or vendor contract" },
  { value: "CUSTOMER_AGREEMENT",    label: "Customer contract" },
  { value: "MSA",                   label: "Master Services Agreement" },
  { value: "NDA",                   label: "NDA / Confidentiality" },
  { value: "SAAS_AGREEMENT",        label: "Software / SaaS agreement" },
  { value: "EMPLOYMENT",            label: "Employment or contractor" },
  { value: "TERM_SHEET",            label: "Term Sheet / Investment" },
  { value: "SHA",                   label: "Shareholders' Agreement" },
  { value: "CONVERTIBLE_NOTE",      label: "Convertible Note / SAFE" },
  { value: "JV_AGREEMENT",          label: "Partnership / JV" },
  { value: "COMMERCIAL_LEASE",      label: "Office / property lease" },
  { value: "OTHER",                 label: "Something else" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function FounderDashboard() {
  const navigate       = useNavigate();
  const queryClient    = useQueryClient();
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const [uploading, setUploading]         = useState(false);
  const [selectedType, setSelectedType]   = useState("SUPPLIER_AGREEMENT");
  const [counterpartyName, setCpName]     = useState("");
  const [dragOver, setDragOver]           = useState(false);

  const { data: company } = useQuery({ queryKey: ["company"], queryFn: getCompany, retry: false });

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getDocuments(),
    refetchInterval: (query) => {
      const docs = query.state.data as UploadedDocument[] | undefined;
      return docs?.some((d) => d.status === "PROCESSING") ? 3000 : false;
    },
  });

  const reviewMutation = useMutation({
    mutationFn: startReview,
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["documents"] }); },
  });

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const doc = await uploadDocument(file, selectedType, {
        counterpartyName: counterpartyName || undefined,
        reviewType: "INBOUND",
        currency: "GBP",
      });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      await reviewMutation.mutateAsync(doc.id);
      setCpName("");
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleUpload(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleUpload(file);
  }

  const processing = documents.some((d) => d.status === "PROCESSING");
  const firstName = (company as { name?: string } | undefined)?.name?.split(" ")[0] ?? "there";

  // Counts for summary bar
  const complete = documents.filter((d) => d.status === "COMPLETE");
  const redCount = complete.filter((d) => {
    const r = (d as DocWithRag).reviewResults ?? [];
    return r.some((x) => x.ragStatus === "RED");
  }).length;

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Hi, {firstName} 👋</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Drop a contract below — MIKE tells you if it's safe to sign.
            </p>
          </div>
          {processing && (
            <span className="text-xs text-amber-600 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Reading your contract…
            </span>
          )}
        </div>

        {/* Summary pills */}
        {documents.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <div className="px-4 py-2 rounded-lg border bg-card text-sm">
              <span className="font-semibold">{documents.length}</span>
              <span className="text-muted-foreground ml-1">contract{documents.length !== 1 ? "s" : ""} reviewed</span>
            </div>
            {redCount > 0 && (
              <div className="px-4 py-2 rounded-lg border bg-red-50 border-red-200 text-sm text-red-700">
                <span className="font-semibold">{redCount}</span>
                <span className="ml-1">need{redCount === 1 ? "s" : ""} attention</span>
              </div>
            )}
            {redCount === 0 && complete.length > 0 && (
              <div className="px-4 py-2 rounded-lg border bg-emerald-50 border-emerald-200 text-sm text-emerald-700">
                <span className="font-semibold">All clear</span>
                <span className="ml-1">— no red flags</span>
              </div>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Left — upload + contracts */}
          <div className="lg:col-span-2 space-y-5">

            {/* Upload card */}
            <div className="card">
              <div className="card-header space-y-3">
                <div>
                  <h2 className="text-base font-semibold">Upload a contract to review</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">PDF or Word document · up to 20 MB</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    className="input text-sm py-1.5"
                    placeholder="Who sent this? (e.g. Acme Ltd)"
                    value={counterpartyName}
                    onChange={(e) => setCpName(e.target.value)}
                  />
                  <select
                    className="input text-sm py-1.5"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                  >
                    {CONTRACT_TYPES.map((ct) => (
                      <option key={ct.value} value={ct.value}>{ct.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="card-body">
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                    ${dragOver ? "border-primary bg-accent scale-[1.01]" : "border-border hover:border-primary/60 hover:bg-accent/30"}
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
                    <div className="space-y-3">
                      <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
                      <div className="text-sm font-medium">Reading your contract…</div>
                      <div className="text-xs text-muted-foreground">MIKE is checking every clause for you</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mx-auto">
                        <Upload size={22} className="text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Drop your contract here</div>
                        <div className="text-xs text-muted-foreground mt-1">or click to choose a file</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Contract list */}
            <div className="card">
              <div className="card-header">
                <h2 className="text-base font-semibold">Your contracts</h2>
              </div>
              {documents.length === 0 ? (
                <div className="card-body text-center py-12">
                  <FileText size={32} className="text-muted-foreground/30 mx-auto mb-3" />
                  <div className="text-sm font-medium text-muted-foreground">No contracts yet</div>
                  <div className="text-xs text-muted-foreground mt-1">Upload one above — you'll get a plain-English verdict in about 2 minutes</div>
                </div>
              ) : (
                <div className="divide-y divide-card-border">
                  {documents.map((doc) => {
                    const d = doc as DocWithRag;
                    const results = d.reviewResults ?? [];
                    const verdict = doc.status === "COMPLETE" ? getVerdict(results) : "pending";
                    const cfg = VERDICT_CONFIG[verdict];
                    const VIcon = cfg.icon;
                    const isClickable = doc.status === "COMPLETE";

                    return (
                      <div
                        key={doc.id}
                        className={`px-5 py-4 flex items-center gap-4 transition-colors
                          ${isClickable ? "hover:bg-muted/20 cursor-pointer" : ""}`}
                        onClick={isClickable ? () => navigate(`/app/founder/review/${doc.id}`) : undefined}
                      >
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <FileText size={15} className="text-muted-foreground" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">
                            {doc.originalName}
                            {d.counterpartyName && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                · {d.counterpartyName}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {new Date(doc.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                            {d.contractValue && (
                              <span className="text-xs text-muted-foreground">
                                £{d.contractValue.toLocaleString("en-GB")}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Verdict badge */}
                        <div className={`hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border shrink-0 ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                          <VIcon size={12} />
                          {cfg.label}
                        </div>

                        {doc.status === "PROCESSING" && (
                          <span className="flex items-center gap-1 text-xs text-amber-600 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Reading…
                          </span>
                        )}
                        {doc.status === "FAILED" && (
                          <button
                            className="btn-ghost text-xs px-2 py-1 gap-1 shrink-0"
                            onClick={(e) => { e.stopPropagation(); reviewMutation.mutate(doc.id); }}
                          >
                            <RotateCcw size={12} /> Retry
                          </button>
                        )}
                        {isClickable && <ChevronRight size={15} className="text-muted-foreground shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right — guide */}
          <div className="space-y-5">

            {/* What MIKE does */}
            <div className="card bg-accent border-accent-border">
              <div className="card-body space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-primary" />
                  <span className="text-sm font-semibold text-accent-foreground">What MIKE checks</span>
                </div>
                <div className="space-y-3 text-xs text-foreground/80">
                  {[
                    { emoji: "💸", text: "Who pays if something goes wrong" },
                    { emoji: "🔒", text: "Who owns what you build or share" },
                    { emoji: "🚪", text: "How hard is it to get out" },
                    { emoji: "🔄", text: "Automatic renewals you might miss" },
                    { emoji: "🌍", text: "Which country's law applies" },
                    { emoji: "🛡️", text: "Data protection obligations" },
                  ].map(({ emoji, text }) => (
                    <div key={text} className="flex items-start gap-2.5">
                      <span className="text-sm shrink-0">{emoji}</span>
                      <span className="leading-relaxed">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Verdicts guide */}
            <div className="card">
              <div className="card-body space-y-3">
                <div className="text-sm font-semibold">How to read your verdict</div>
                <div className="space-y-3 text-xs text-muted-foreground">
                  {[
                    { icon: CheckCircle, color: "text-emerald-600", label: "Looks good", desc: "No red flags — you can proceed" },
                    { icon: AlertCircle, color: "text-amber-600",   label: "Worth a closer look", desc: "A few things worth negotiating" },
                    { icon: AlertTriangle, color: "text-red-600",   label: "Don't sign yet", desc: "Fix these issues before signing" },
                  ].map(({ icon: Icon, color, label, desc }) => (
                    <div key={label} className="flex items-start gap-2.5">
                      <Icon size={14} className={`${color} mt-0.5 shrink-0`} />
                      <div>
                        <div className={`font-medium ${color}`}>{label}</div>
                        <div>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Investor flags */}
            <InvestorFlagsPanel />

            {/* Missing docs */}
            <MissingDocsPanel />

            {/* MIKE noticed */}
            <MikeNoticedPanel />

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
