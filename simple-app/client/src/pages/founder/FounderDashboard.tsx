import { useState, useRef } from "react";
import { formatDateShort } from "../../lib/dateUtils";
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
import ZaneNoticedPanel from "../../components/ZaneNoticedPanel";
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
  safe:    { label: "Looks good",           sublabel: "No major issues found",       color: "text-foreground",            bg: "bg-[#E7F6EE]",  border: "border-[#E7F6EE]",  icon: CheckCircle   },
  caution: { label: "Worth a closer look",  sublabel: "A few things to negotiate",   color: "text-foreground",            bg: "bg-[#FAEEDA]",  border: "border-[#FAEEDA]",  icon: AlertTriangle },
  danger:  { label: "Don't sign yet",       sublabel: "Fix these issues first",      color: "text-foreground",            bg: "bg-[#FCEBEB]",  border: "border-[#FCEBEB]",  icon: AlertTriangle },
  pending: { label: "Reviewing…",           sublabel: "Zane is reading your contract", color: "text-muted-foreground", bg: "bg-muted", border: "border-border",      icon: Clock         },
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
  { value: "OPTIONS_AGREEMENT",     label: "Options Agreement (EMI / CSOP)" },
  { value: "JV_AGREEMENT",          label: "Partnership / JV" },
  { value: "COMMERCIAL_LEASE",      label: "Office / property lease" },
  { value: "IP_ASSIGNMENT",         label: "IP Assignment" },
  { value: "OTHER",                 label: "Something else" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function FounderDashboard() {
  const navigate       = useNavigate();
  const queryClient    = useQueryClient();
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const [uploading, setUploading]         = useState(false);
  const [uploadError, setUploadError]     = useState<string | null>(null);
  const [selectedType, setSelectedType]   = useState("SUPPLIER_AGREEMENT");
  const [counterpartyName, setCpName]     = useState("");
  const [dragOver, setDragOver]           = useState(false);

  const { data: company } = useQuery({ queryKey: ["company"], queryFn: getCompany, retry: false });

  const ACTIVE_STATUSES: DocumentStatus[] = ["PROCESSING", "PARSING", "ANONYMISING", "CLASSIFYING", "COMPARING"];

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getDocuments(),
    refetchInterval: (query) => {
      const docs = query.state.data as UploadedDocument[] | undefined;
      return docs?.some((d) => ACTIVE_STATUSES.includes(d.status)) ? 3000 : false;
    },
  });

  const reviewMutation = useMutation({
    mutationFn: startReview,
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["documents"] }); },
  });

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
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
      console.error("[upload]", e);
      const msg = e instanceof Error ? e.message : String(e);
      // Classify and surface errors clearly: show the actual server message where possible
      if (msg.includes("413") || msg.toLowerCase().includes("too large") || msg.toLowerCase().includes("50mb") || msg.toLowerCase().includes("20mb")) {
        setUploadError("This file exceeds the 50MB limit. Very large documents can be split into sections before uploading.");
      } else if (msg.includes("415") || msg.toLowerCase().includes("not supported")) {
        setUploadError("Only PDF and Word (.docx) files are supported.");
      } else if (msg.includes("422") || msg.toLowerCase().includes("playbook")) {
        setUploadError("Please complete your playbook setup before uploading a contract.");
      } else if (msg.includes("400") || msg.toLowerCase().includes("onboarding")) {
        setUploadError("Please complete onboarding before uploading a contract.");
      } else if (msg.toLowerCase().includes("api key") || msg.toLowerCase().includes("openrouter")) {
        setUploadError("AI service unavailable. Please contact support.");
      } else if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
        setUploadError("Connection error. Check your internet connection and try again.");
      } else {
        // Show the actual error so it's debuggable, but cap the length
        setUploadError(msg.length < 120 ? msg : "Upload failed. Please try again or contact support.");
      }
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

  const processing = documents.some((d) => ACTIVE_STATUSES.includes(d.status));
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
            <h1 className="text-2xl font-semibold">Hi, {firstName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Drop a contract below. Zane will tell you if it is safe to sign.
            </p>
          </div>
          {processing && (
            <span className="text-xs text-foreground flex items-center gap-1.5 bg-[#FAEEDA] border border-[#FAEEDA] rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
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
              <div className="px-4 py-2 rounded-lg border bg-[#FCEBEB] border-[#FCEBEB] text-sm text-foreground">
                <span className="font-semibold">{redCount}</span>
                <span className="ml-1">need{redCount === 1 ? "s" : ""} attention</span>
              </div>
            )}
            {redCount === 0 && complete.length > 0 && (
              <div className="px-4 py-2 rounded-lg border bg-[#E7F6EE] border-[#E7F6EE] text-sm text-foreground">
                <span className="font-semibold">All clear</span>
                <span className="ml-1">No red flags</span>
              </div>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Left - upload + contracts */}
          <div className="lg:col-span-2 space-y-5">

            {/* Upload card */}
            <div className="card">
              <div className="card-header space-y-3">
                <div>
                  <h2 className="text-base font-semibold">Upload a contract to review</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">PDF or Word document · up to 50 MB</p>
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
                      <div className="text-xs text-muted-foreground">Zane is checking every clause for you</div>
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

                {/* Upload error */}
                {uploadError && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2.5">
                    <AlertCircle size={14} className="text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive leading-snug">{uploadError}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Processing stage cards - shown for all active pipeline statuses */}
            {(documents as UploadedDocument[])
              .filter((d) => ACTIVE_STATUSES.includes(d.status))
              .map((d) => {
                const elapsedSec = (Date.now() - new Date(d.uploadedAt).getTime()) / 1000;
                const STAGES = [
                  { label: "Reading your contract",           maxSec: 15  },
                  { label: "Removing personal details",        maxSec: 35  },
                  { label: "Identifying key clauses",          maxSec: 70  },
                  { label: "Comparing against your playbook",  maxSec: 130 },
                  { label: "Checking investment terms",        maxSec: 200 },
                  { label: "Preparing your risk report",       maxSec: Infinity },
                ];
                const activeIdx = STAGES.findIndex((s) => elapsedSec < s.maxSec);
                const stageIdx  = activeIdx === -1 ? STAGES.length - 1 : activeIdx;
                // If stalled for more than 10 minutes, show a retry card instead of endless progress
                const isStalled = elapsedSec > 600;
                return (
                  <div key={d.id} className="card p-5 space-y-4 border-[#E2E8F0]" style={{ background: "#FFFFFF" }}>
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <Sparkles size={15} className={isStalled ? "text-[#A32D2D]" : "text-[#2563EB]"} />
                        <div>
                          <div className="text-sm font-semibold text-[#2563EB]">Reviewing: {d.originalName}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {isStalled ? "Taking longer than expected" : "Usually takes 1 to 3 minutes"}
                          </div>
                        </div>
                      </div>
                      {isStalled && (
                        <button
                          className="btn-ghost text-xs px-2 py-1 gap-1 shrink-0 text-[#A32D2D]"
                          onClick={() => reviewMutation.mutate(d.id)}
                        >
                          <RotateCcw size={12} /> Retry
                        </button>
                      )}
                    </div>
                    {!isStalled && (
                      <div className="space-y-2">
                        {STAGES.map((stage, i) => {
                          const done    = i < stageIdx;
                          const active  = i === stageIdx;
                          const pending = i > stageIdx;
                          return (
                            <div key={stage.label} className="flex items-center gap-2.5">
                              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0
                                ${done    ? "bg-[#E7F6EE] border-[#BBE6CC]" : ""}
                                ${active  ? "bg-[#FAEEDA] border-[#92400E] animate-pulse" : ""}
                                ${pending ? "bg-transparent border-[#E2E8F0]" : ""}`}>
                                {done   && <CheckCircle size={9} className="text-[#1B7A4B]" />}
                                {active && <span className="w-1 h-1 rounded-full bg-[#854F0B]" />}
                              </div>
                              <span className={`text-xs leading-none
                                ${done    ? "text-muted-foreground line-through" : ""}
                                ${active  ? "text-[#854F0B] font-medium" : ""}
                                ${pending ? "text-muted-foreground/35" : ""}`}>
                                {stage.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {isStalled && (
                      <p className="text-xs text-muted-foreground">
                        The review is taking longer than expected. This can happen with complex or scanned documents. Click Retry to try again.
                      </p>
                    )}
                  </div>
                );
              })}

            {/* Contract list */}
            <div className="card">
              <div className="card-header">
                <h2 className="text-base font-semibold">Your contracts</h2>
              </div>
              {documents.length === 0 ? (
                <div className="card-body text-center py-12">
                  <FileText size={32} className="text-muted-foreground/30 mx-auto mb-3" />
                  <div className="text-sm font-medium text-muted-foreground">No contracts yet</div>
                  <div className="text-xs text-muted-foreground mt-1">Upload one above - you'll get a plain-English verdict on every clause</div>
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
                              {formatDateShort(doc.uploadedAt)}
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

                        {ACTIVE_STATUSES.includes(doc.status) && (
                          <span className="flex items-center gap-1 text-xs text-[#854F0B] shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#854F0B] animate-pulse" />
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

          {/* Right - guide */}
          <div className="space-y-5">

            {/* What Zane does */}
            <div className="card bg-accent border-accent-border">
              <div className="card-body space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-primary" />
                  <span className="text-sm font-semibold text-accent-foreground">What Zane checks</span>
                </div>
                <div className="space-y-3 text-xs text-foreground/80">
                  {[
                    { text: "Who pays if something goes wrong" },
                    { text: "Who owns what you build or share" },
                    { text: "How hard is it to get out" },
                    { text: "Automatic renewals you might miss" },
                    { text: "Which country's law applies" },
                    { text: "Data protection obligations" },
                  ].map(({ text }) => (
                    <div key={text} className="flex items-start gap-2.5">
                      <div className="w-1 h-1 rounded-full bg-primary/60 shrink-0 mt-1.5" />
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
                    { icon: CheckCircle,   color: "text-[#1B7A4B]", label: "Looks good",           desc: "No red flags - you can proceed" },
                    { icon: AlertCircle,   color: "text-[#854F0B]", label: "Worth a closer look",  desc: "A few things worth negotiating" },
                    { icon: AlertTriangle, color: "text-[#A32D2D]", label: "Don't sign yet",        desc: "Fix these issues before signing" },
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

            {/* Zane noticed */}
            <ZaneNoticedPanel />

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
