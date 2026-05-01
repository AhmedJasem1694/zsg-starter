import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload, FileText, AlertTriangle, CheckCircle, Clock,
  RotateCcw, TrendingUp, Shield, Zap,
  ChevronRight, BarChart2, AlertCircle,
} from "lucide-react";
import { getDocuments, uploadDocument, startReview, getStats } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import { CLAUSE_LABELS, type DocumentStatus, type ClauseCategory } from "../lib/types";
import { MOCK_MODE, MOCK_STATS, MOCK_DOCUMENTS, MOCK_ACTIONS } from "../lib/mockData";
import type { UploadedDocument } from "../lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocWithRag {
  id: string;
  originalName: string;
  contractType: string;
  status: DocumentStatus;
  uploadedAt: string;
  reviewResults?: { ragStatus: string }[];
}

type SignReadiness = "ready" | "negotiate" | "review" | "not-ready" | "pending";

const CONTRACT_TYPES = [
  { value: "SUPPLIER_AGREEMENT",    label: "Supplier Agreement" },
  { value: "CUSTOMER_AGREEMENT",    label: "Customer Agreement" },
  { value: "MSA",                   label: "Master Services Agreement" },
  { value: "NDA",                   label: "NDA" },
  { value: "DPA",                   label: "Data Processing Agreement" },
  { value: "SaaS_AGREEMENT",        label: "SaaS / Software Licence" },
  { value: "PROFESSIONAL_SERVICES", label: "Professional Services" },
  { value: "EMPLOYMENT",            label: "Employment Agreement" },
  { value: "CONTRACTOR_AGREEMENT",  label: "Contractor Agreement" },
  { value: "COMMERCIAL_LEASE",      label: "Commercial Lease" },
  { value: "LICENSE_AGREEMENT",     label: "Licence to Occupy" },
  { value: "JV_AGREEMENT",          label: "Joint Venture Agreement" },
  { value: "SHARE_PURCHASE",        label: "Share Purchase Agreement" },
];

// ─── Sign readiness helpers ───────────────────────────────────────────────────

function getSignReadiness(results: { ragStatus: string }[]): SignReadiness {
  if (!results.length) return "pending";
  const red   = results.filter((r) => r.ragStatus === "RED").length;
  const amber = results.filter((r) => r.ragStatus === "AMBER").length;
  if (red >= 2) return "not-ready";
  if (red === 1) return "negotiate";
  if (amber >= 2) return "review";
  return "ready";
}

const READINESS_CONFIG: Record<SignReadiness, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  "ready":     { label: "Ready to sign",     color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200",  icon: CheckCircle },
  "negotiate": { label: "Negotiate first",   color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",    icon: AlertTriangle },
  "review":    { label: "Review needed",     color: "text-amber-600",   bg: "bg-amber-50 border-amber-100",    icon: AlertCircle },
  "not-ready": { label: "Do not sign yet",   color: "text-red-700",     bg: "bg-red-50 border-red-200",        icon: AlertTriangle },
  "pending":   { label: "Reviewing…",        color: "text-muted-foreground", bg: "bg-muted border-border",    icon: Clock },
};

// ─── Mini RAG bar component ───────────────────────────────────────────────────

function MiniRagBar({ results }: { results: { ragStatus: string }[] }) {
  if (!results.length) return <div className="h-1.5 w-24 bg-muted rounded-full animate-pulse" />;
  const total = results.length;
  const red   = results.filter((r) => r.ragStatus === "RED").length;
  const amber = results.filter((r) => r.ragStatus === "AMBER").length;
  const green = results.filter((r) => r.ragStatus === "GREEN").length;
  const grey  = results.filter((r) => r.ragStatus === "GREY").length;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex h-1.5 w-20 rounded-full overflow-hidden gap-px">
        {red   > 0 && <div className="bg-red-500"   style={{ width: `${(red / total) * 100}%` }} />}
        {amber > 0 && <div className="bg-amber-400" style={{ width: `${(amber / total) * 100}%` }} />}
        {green > 0 && <div className="bg-emerald-500" style={{ width: `${(green / total) * 100}%` }} />}
        {grey  > 0 && <div className="bg-slate-300" style={{ width: `${(grey / total) * 100}%` }} />}
      </div>
      <span className="text-[10px] text-muted-foreground">{total} clauses</span>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "red" | "amber" | "green" | "primary";
}) {
  const iconColors = {
    red: "text-red-600 bg-red-50",
    amber: "text-amber-600 bg-amber-50",
    green: "text-emerald-600 bg-emerald-50",
    primary: "text-primary bg-accent",
  };
  const iconClass = accent ? iconColors[accent] : "text-primary bg-accent";

  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-sm font-medium text-foreground mt-0.5">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Portfolio risk bar ───────────────────────────────────────────────────────

function PortfolioRisk({ breakdown }: { breakdown: { RED: number; AMBER: number; GREEN: number; GREY: number } }) {
  const total = breakdown.RED + breakdown.AMBER + breakdown.GREEN + breakdown.GREY;
  if (!total) return null;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;

  return (
    <div className="space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {breakdown.RED   > 0 && <div className="bg-red-500 rounded-l-full transition-all" style={{ width: pct(breakdown.RED) }} title={`${breakdown.RED} RED`} />}
        {breakdown.AMBER > 0 && <div className="bg-amber-400 transition-all" style={{ width: pct(breakdown.AMBER) }} title={`${breakdown.AMBER} AMBER`} />}
        {breakdown.GREEN > 0 && <div className="bg-emerald-500 transition-all" style={{ width: pct(breakdown.GREEN) }} title={`${breakdown.GREEN} GREEN`} />}
        {breakdown.GREY  > 0 && <div className="bg-slate-300 rounded-r-full transition-all" style={{ width: pct(breakdown.GREY) }} title={`${breakdown.GREY} ABSENT`} />}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {[
          { label: "Red", val: breakdown.RED,   dot: "bg-red-500" },
          { label: "Amber", val: breakdown.AMBER, dot: "bg-amber-400" },
          { label: "Green", val: breakdown.GREEN, dot: "bg-emerald-500" },
          { label: "Absent", val: breakdown.GREY, dot: "bg-slate-300" },
        ].map(({ label, val, dot }) => val > 0 ? (
          <span key={label} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            {val} {label}
          </span>
        ) : null)}
        <span className="ml-auto">{total} total clauses</span>
      </div>
    </div>
  );
}

// ─── Action item ──────────────────────────────────────────────────────────────

function ActionItem({
  action,
  onClick,
}: {
  action: { id: string; docName: string; type: "escalation" | "review"; message: string; ragStatus: string };
  onClick: () => void;
}) {
  const isEscalation = action.type === "escalation";
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
    >
      <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
        isEscalation ? "bg-red-100" : "bg-amber-100"
      }`}>
        {isEscalation
          ? <AlertTriangle size={12} className="text-red-600" />
          : <AlertCircle size={12} className="text-amber-600" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-foreground truncate">{action.docName}</div>
        <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{action.message}</div>
      </div>
      <ChevronRight size={14} className="text-muted-foreground shrink-0 mt-1 group-hover:text-foreground transition-colors" />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState("SUPPLIER_AGREEMENT");
  const [dragOver, setDragOver] = useState(false);

  const { data: realStats } = useQuery({
    queryKey: ["stats"],
    queryFn: getStats,
    retry: false,
  });

  const { data: realDocuments = [] } = useQuery({
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

  // Use mock data when real data is empty/unavailable
  const useMock = MOCK_MODE && realDocuments.length === 0;
  const stats = (realStats && realStats.totalDocuments > 0) ? realStats : (useMock ? MOCK_STATS : realStats);
  const documents = useMock ? MOCK_DOCUMENTS : realDocuments;
  const actions = useMock ? MOCK_ACTIONS : [];

  const processing = (realDocuments as UploadedDocument[]).some((d) => d.status === "PROCESSING");

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-7xl mx-auto space-y-7">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your contract risk command centre
              {useMock && (
                <span className="ml-2 text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                  Demo data
                </span>
              )}
            </p>
          </div>
          {processing && (
            <span className="text-xs text-amber-600 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Review in progress
            </span>
          )}
        </div>

        {/* Stats row - always visible */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={FileText}      label="Contracts reviewed"  value={stats.totalReviews}       sub={`${stats.totalDocuments} uploaded total`} accent="primary" />
            <StatCard icon={AlertTriangle} label="Open RED flags"      value={stats.redFlagsOpen}       sub="Awaiting your decision" accent={stats.redFlagsOpen > 0 ? "red" : "green"} />
            <StatCard icon={Shield}        label="Escalations pending" value={stats.escalationsPending} sub="Need stakeholder sign-off" accent={stats.escalationsPending > 0 ? "amber" : "green"} />
            <StatCard icon={TrendingUp}    label="Hours saved"         value={`~${stats.estimatedHoursSaved}h`} sub={`${stats.clausesAccepted} clauses accepted`} accent="green" />
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Left col - 2/3 */}
          <div className="lg:col-span-2 space-y-6">

            {/* Upload */}
            <div className="card">
              <div className="card-header flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold">Upload a contract</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">PDF or DOCX · Max 20MB · MIKE reviews in ~2 minutes</p>
                </div>
                <select
                  className="input text-sm py-1.5 w-auto min-w-[190px]"
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
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                    ${dragOver ? "border-primary bg-accent scale-[1.01]" : "border-border hover:border-primary/60 hover:bg-accent/30"}
                    ${uploading ? "opacity-60 pointer-events-none" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                >
                  <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.docx,.doc" onChange={onFileChange} />
                  {uploading ? (
                    <div className="space-y-3">
                      <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
                      <div className="text-sm font-medium">Uploading and starting review…</div>
                      <div className="text-xs text-muted-foreground">Classifying clauses, checking your playbook and regulations</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mx-auto">
                        <Upload size={22} className="text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Drop your contract here</div>
                        <div className="text-xs text-muted-foreground mt-1">or click to browse</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Contract list */}
            <div className="card">
              <div className="card-header">
                <h2 className="text-base font-semibold">Recent reviews</h2>
              </div>
              {documents.length === 0 ? (
                <div className="card-body text-center py-12">
                  <FileText size={32} className="text-muted-foreground/30 mx-auto mb-3" />
                  <div className="text-sm font-medium text-muted-foreground">No contracts reviewed yet</div>
                  <div className="text-xs text-muted-foreground mt-1">Upload one above - MIKE reviews it in ~2 minutes</div>
                </div>
              ) : (
                <div className="divide-y divide-card-border">
                  {documents.map((doc) => {
                    const results = (doc as DocWithRag).reviewResults ?? [];
                    const readiness = doc.status === "COMPLETE" ? getSignReadiness(results) : "pending";
                    const { label: readinessLabel, color: readinessColor, bg: readinessBg, icon: ReadinessIcon } = READINESS_CONFIG[readiness];
                    const isClickable = doc.status === "COMPLETE" && !useMock;
                    const red   = results.filter((r) => r.ragStatus === "RED").length;
                    const amber = results.filter((r) => r.ragStatus === "AMBER").length;

                    return (
                      <div
                        key={doc.id}
                        className={`px-5 py-4 flex items-center gap-4 transition-colors
                          ${isClickable ? "hover:bg-muted/20 cursor-pointer" : ""}`}
                        onClick={isClickable ? () => navigate(`/review/${doc.id}`) : undefined}
                      >
                        {/* File icon */}
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <FileText size={15} className="text-muted-foreground" />
                        </div>

                        {/* Name + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{doc.originalName}</div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {doc.contractType.replace(/_/g, " ")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(doc.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                            {doc.status === "COMPLETE" && results.length > 0 && (
                              <MiniRagBar results={results} />
                            )}
                          </div>
                        </div>

                        {/* Risk summary pills */}
                        {doc.status === "COMPLETE" && results.length > 0 && (
                          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                            {red   > 0 && <span className="rag-red">{red} RED</span>}
                            {amber > 0 && <span className="rag-amber">{amber} AMBER</span>}
                            {red === 0 && amber === 0 && <span className="rag-green">All clear</span>}
                          </div>
                        )}

                        {/* Sign readiness */}
                        <div className={`hidden md:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border shrink-0 ${readinessBg} ${readinessColor}`}>
                          <ReadinessIcon size={12} />
                          {readinessLabel}
                        </div>

                        {/* Status / caret */}
                        {doc.status === "PROCESSING" && (
                          <span className="flex items-center gap-1 text-xs text-amber-600 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Reviewing
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
                        {useMock && doc.status === "COMPLETE" && (
                          <ChevronRight size={15} className="text-muted-foreground/40 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right col - 1/3 */}
          <div className="space-y-6">

            {/* Action required */}
            {actions.length > 0 && (
              <div className="card border-red-200">
                <div className="card-header border-red-100 bg-red-50/50">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} className="text-red-600" />
                    <h2 className="text-sm font-semibold text-red-900">Needs your attention</h2>
                    <span className="ml-auto bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {actions.length}
                    </span>
                  </div>
                </div>
                <div className="px-3 py-2 space-y-1">
                  {actions.map((action) => (
                    <ActionItem
                      key={action.id}
                      action={action}
                      onClick={() => { if (!useMock) navigate(`/review/${action.docId}`); }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Portfolio risk */}
            {stats && (
              <div className="card">
                <div className="card-header">
                  <div className="flex items-center gap-2">
                    <BarChart2 size={15} className="text-primary" />
                    <h2 className="text-sm font-semibold">Portfolio risk</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Clause-level breakdown across all reviewed contracts</p>
                </div>
                <div className="card-body">
                  <PortfolioRisk breakdown={stats.ragBreakdown} />
                </div>
              </div>
            )}

            {/* Top issues */}
            {stats && stats.topIssues.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <div className="flex items-center gap-2">
                    <Zap size={15} className="text-primary" />
                    <h2 className="text-sm font-semibold">MIKE insights</h2>
                  </div>
                </div>
                <div className="card-body space-y-4">
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Most disputed clauses across your contracts:</p>
                    {stats.topIssues.map(({ category, count }) => (
                      <div key={category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{CLAUSE_LABELS[category as ClauseCategory] ?? category.replace(/_/g, " ")}</span>
                          <span className="rag-red">{count}✕ RED</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-400 rounded-full"
                            style={{ width: `${Math.min((count / (stats.topIssues[0]?.count ?? 1)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-card-border pt-3 text-xs text-muted-foreground leading-relaxed">
                    Counterparties push back hardest on <span className="font-medium text-foreground">
                      {CLAUSE_LABELS[stats.topIssues[0]?.category as ClauseCategory] ?? "Liability Cap"}
                    </span>. Consider whether your preferred position is realistic for your sector.
                  </div>
                </div>
              </div>
            )}

            {/* Quick guide for non-lawyers */}
            <div className="card bg-accent border-accent-border">
              <div className="card-body space-y-3">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-primary" />
                  <span className="text-xs font-semibold text-accent-foreground">Reading your results</span>
                </div>
                <div className="space-y-2 text-xs text-foreground/70">
                  {[
                    { badge: "rag-red",   label: "Red",   desc: "Do not sign - issue to fix first" },
                    { badge: "rag-amber", label: "Amber", desc: "Negotiate before signing" },
                    { badge: "rag-green", label: "Green", desc: "Meets your position" },
                    { badge: "rag-grey",  label: "Absent",desc: "Clause missing - request insertion" },
                  ].map(({ badge, label, desc }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className={badge}>{label}</span>
                      <span>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
