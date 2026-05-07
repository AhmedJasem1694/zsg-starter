import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload, FileText, AlertTriangle, CheckCircle, Clock,
  RotateCcw, Shield, ChevronRight, AlertCircle, LayoutGrid, ArrowRight,
} from "lucide-react";
import { getDocuments, uploadDocument, startReview, getCompany, getDocumentStats } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import MikeNoticedPanel from "../components/MikeNoticedPanel";
import MissingDocsPanel from "../components/MissingDocsPanel";
import { Link } from "react-router-dom";
import type { DocumentStatus } from "../lib/types";
import { MOCK_MODE, MOCK_DOCUMENTS } from "../lib/mockData";
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

// ── Workflow-specific options ──────────────────────────────────────────────────

const COMMERCIAL_CONTRACT_TYPES = [
  { value: "SUPPLIER_AGREEMENT",    label: "Supplier Agreement" },
  { value: "CUSTOMER_AGREEMENT",    label: "Customer Agreement" },
  { value: "MSA",                   label: "Master Services Agreement" },
  { value: "NDA",                   label: "NDA / Confidentiality Agreement" },
  { value: "DPA",                   label: "Data Processing Agreement" },
  { value: "SAAS_AGREEMENT",        label: "SaaS / Technology Agreement" },
  { value: "PROFESSIONAL_SERVICES", label: "Professional Services Agreement" },
  { value: "EMPLOYMENT",            label: "Employment Agreement" },
  { value: "CONTRACTOR_AGREEMENT",  label: "Contractor Agreement" },
  { value: "COMMERCIAL_LEASE",      label: "Property / Lease Agreement" },
  { value: "JV_AGREEMENT",          label: "Joint Venture Agreement" },
  { value: "AGENCY_AGREEMENT",      label: "Agency Agreement" },
  { value: "DISTRIBUTION",          label: "Distribution Agreement" },
  { value: "LICENCE_AGREEMENT",     label: "Licence Agreement" },
  { value: "OTHER",                 label: "Other" },
];

const COMMERCIAL_COUNTERPARTY_TYPES = [
  { value: "SUPPLIER",       label: "Supplier" },
  { value: "CUSTOMER",       label: "Customer" },
  { value: "TECH_VENDOR",    label: "Technology vendor" },
  { value: "PROF_SERVICES",  label: "Professional services provider" },
  { value: "PARTNER",        label: "Partner" },
  { value: "LANDLORD",       label: "Landlord / property owner" },
  { value: "INVESTOR",       label: "Investor" },
  { value: "EMPLOYEE",       label: "Employee / Contractor" },
  { value: "GOVERNMENT",     label: "Government / public sector" },
  { value: "REGULATOR",      label: "Regulator" },
  { value: "RELATED_PARTY",  label: "Related party" },
  { value: "COMPETITOR",     label: "Competitor" },
  { value: "OTHER",          label: "Other" },
];

const COMMERCIAL_REVIEW_TYPES = [
  { value: "INBOUND",     label: "Their paper (inbound review)" },
  { value: "OUTBOUND",    label: "Our paper (outbound check)" },
  { value: "NEGOTIATED",  label: "Negotiated draft (mid-negotiation)" },
  { value: "EXECUTION",   label: "Final execution version" },
];

const INSURANCE_CLAIM_TYPES = [
  { value: "MOTOR_PI",       label: "Motor — personal injury" },
  { value: "MOTOR_PROPERTY", label: "Motor — property damage" },
  { value: "EMPLOYERS_LI",   label: "Employers Liability" },
  { value: "PUBLIC_LI",      label: "Public Liability" },
  { value: "PI",             label: "Professional Indemnity" },
  { value: "PROPERTY",       label: "Property / Material Damage" },
  { value: "CYBER",          label: "Cyber and Data Breach" },
  { value: "DO",             label: "Directors and Officers" },
  { value: "MARINE_CARGO",   label: "Marine Cargo" },
  { value: "CONSTRUCTION",   label: "Construction / Engineering" },
  { value: "PRODUCT_LI",     label: "Product Liability" },
  { value: "ENVIRONMENTAL",  label: "Environmental" },
  { value: "OTHER",          label: "Other" },
];

const INSURANCE_CLAIMANT_TYPES = [
  { value: "INDIVIDUAL",       label: "Individual / consumer" },
  { value: "SME",              label: "SME business" },
  { value: "LARGE_CORPORATE",  label: "Large corporate" },
  { value: "PUBLIC_SECTOR",    label: "Public sector body" },
  { value: "THIRD_PARTY",      label: "Third party (subrogation target)" },
  { value: "VULNERABLE",       label: "Vulnerable customer" },
];

const INSURANCE_CLAIM_STAGES = [
  { value: "PRE_ACTION_LOC",    label: "Pre-action (letter of claim received)" },
  { value: "PRE_ACTION_PAP",    label: "Pre-action (pre-action protocol)" },
  { value: "PROCEEDINGS",       label: "Proceedings issued" },
  { value: "DIRECTIONS",        label: "Directions / case management" },
  { value: "TRIAL_LISTED",      label: "Trial listed" },
  { value: "APPEAL",            label: "Appeal" },
  { value: "SETTLEMENT_ONLY",   label: "Settlement negotiation only" },
  { value: "FOS_REFERRAL",      label: "FOS referral" },
  { value: "COMPLAINT_ONLY",    label: "Complaint only (not yet claim)" },
];

const LOGISTICS_CONTRACT_TYPES = [
  { value: "CARRIER_HAULIER",    label: "Carrier / Haulier Agreement" },
  { value: "CUSTOMER_MSA",       label: "Customer MSA" },
  { value: "WAREHOUSE_3PL",      label: "Warehouse / 3PL Agreement" },
  { value: "FREIGHT_FORWARDING", label: "Freight Forwarding Terms" },
  { value: "LAST_MILE",          label: "Last Mile Delivery Agreement" },
  { value: "CROSS_BORDER",       label: "Cross-border / International Carriage" },
  { value: "TECHNOLOGY",         label: "Technology / Platform Agreement" },
  { value: "AGENCY",             label: "Agency Agreement" },
  { value: "SUBCONTRACTOR",      label: "Subcontractor Agreement" },
  { value: "CUSTOMS_AGENCY",     label: "Customs Agency Agreement" },
  { value: "AIR_FREIGHT",        label: "Air Freight Agreement" },
  { value: "SEA_FREIGHT",        label: "Sea Freight Agreement" },
  { value: "RAIL_FREIGHT",       label: "Rail Freight Agreement" },
  { value: "OTHER",              label: "Other" },
];

const LOGISTICS_COUNTERPARTY_TYPES = [
  { value: "CARRIER_ROAD",     label: "Carrier (road)" },
  { value: "CARRIER_AIR",      label: "Carrier (air)" },
  { value: "CARRIER_SEA",      label: "Carrier (sea)" },
  { value: "CARRIER_RAIL",     label: "Carrier (rail)" },
  { value: "WAREHOUSE_3PL",    label: "Warehouse / 3PL operator" },
  { value: "CUSTOMER_SHIPPER", label: "Customer (shipper)" },
  { value: "TECH_PLATFORM",    label: "Technology / platform provider" },
  { value: "CUSTOMS_AGENT",    label: "Customs agent / broker" },
  { value: "SUBCONTRACTOR",    label: "Subcontractor" },
  { value: "PORT_TERMINAL",    label: "Port / terminal operator" },
  { value: "OTHER",            label: "Other" },
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
  "ready":     { label: "Ready to sign",   color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle },
  "negotiate": { label: "Negotiate first", color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",    icon: AlertTriangle },
  "review":    { label: "Review needed",   color: "text-amber-600",   bg: "bg-amber-50 border-amber-100",    icon: AlertCircle },
  "not-ready": { label: "Do not sign yet", color: "text-red-700",     bg: "bg-red-50 border-red-200",        icon: AlertTriangle },
  "pending":   { label: "Reviewing…",      color: "text-muted-foreground", bg: "bg-muted border-border",    icon: Clock },
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
        {red   > 0 && <div className="bg-red-500"     style={{ width: `${(red / total) * 100}%` }} />}
        {amber > 0 && <div className="bg-amber-400"   style={{ width: `${(amber / total) * 100}%` }} />}
        {green > 0 && <div className="bg-emerald-500" style={{ width: `${(green / total) * 100}%` }} />}
        {grey  > 0 && <div className="bg-slate-300"   style={{ width: `${(grey / total) * 100}%` }} />}
      </div>
      <span className="text-[10px] text-muted-foreground">{total} clauses</span>
    </div>
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

  // New metadata state
  const [counterpartyName, setCounterpartyName] = useState("");
  const [counterpartyType, setCounterpartyType] = useState("");
  const [reviewType, setReviewType] = useState("INBOUND");
  const [contractValue, setContractValue] = useState("");
  const [contractTermMonths, setContractTermMonths] = useState("");
  const [autoRenewal, setAutoRenewal] = useState(false);
  const [noticePeriodDays, setNoticePeriodDays] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [contractTags, setContractTags] = useState("");

  // Search / filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRag, setFilterRag] = useState("");
  const [filterType, setFilterType] = useState("");

  // Company query (for workflowType)
  const { data: company } = useQuery({
    queryKey: ["company"],
    queryFn: getCompany,
    retry: false,
  });
  const workflowType = (company as { workflowType?: string } | undefined)?.workflowType ?? "COMMERCIAL_CONTRACT";

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ["document-stats"],
    queryFn: getDocumentStats,
    refetchInterval: 30000,
  });

  const { data: realDocuments = [] } = useQuery({
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

  // Computed dropdown options based on workflowType
  const contractTypeOptions = workflowType === "INSURANCE_LITIGATION"
    ? INSURANCE_CLAIM_TYPES
    : workflowType === "LOGISTICS_CONTRACT"
    ? LOGISTICS_CONTRACT_TYPES
    : COMMERCIAL_CONTRACT_TYPES;

  const counterpartyTypeOptions = workflowType === "INSURANCE_LITIGATION"
    ? INSURANCE_CLAIMANT_TYPES
    : workflowType === "LOGISTICS_CONTRACT"
    ? LOGISTICS_COUNTERPARTY_TYPES
    : COMMERCIAL_COUNTERPARTY_TYPES;

  const reviewTypeOptions = workflowType === "INSURANCE_LITIGATION"
    ? INSURANCE_CLAIM_STAGES
    : workflowType === "LOGISTICS_CONTRACT"
    ? [
        { value: "INBOUND",    label: "Inbound (reviewing their terms)" },
        { value: "OUTBOUND",   label: "Outbound (checking our terms)" },
        { value: "NEGOTIATED", label: "Negotiated draft" },
      ]
    : COMMERCIAL_REVIEW_TYPES;

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const meta = {
        counterpartyName,
        counterpartyType,
        reviewType,
        contractValue: contractValue ? parseFloat(contractValue) : undefined,
        currency: "GBP",
        contractTermMonths: contractTermMonths ? parseInt(contractTermMonths) : undefined,
        autoRenewal,
        noticePeriodDays: noticePeriodDays ? parseInt(noticePeriodDays) : undefined,
        renewalDate: renewalDate || undefined,
        contractTags,
      };
      const doc = await uploadDocument(file, selectedType, meta);
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      await queryClient.invalidateQueries({ queryKey: ["document-stats"] });
      await reviewMutation.mutateAsync(doc.id);
      // For insurance litigation workflow, redirect to intake flow
      if (workflowType === "INSURANCE_LITIGATION") {
        navigate(`/app/legal/litigation-intake/${doc.id}`);
        return;
      }
      // Reset form
      setCounterpartyName(""); setCounterpartyType(""); setReviewType("INBOUND");
      setContractValue(""); setContractTermMonths(""); setAutoRenewal(false);
      setNoticePeriodDays(""); setRenewalDate(""); setContractTags("");
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

  const useMock = MOCK_MODE && realDocuments.length === 0;
  const documents = useMock ? MOCK_DOCUMENTS : realDocuments;
  const processing = (realDocuments as UploadedDocument[]).some((d) => d.status === "PROCESSING");

  // Client-side filtering
  const filteredDocuments = documents.filter((doc) => {
    const d = doc as DocWithRag & { counterpartyName?: string };
    if (searchQuery && !d.counterpartyName?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterRag && !d.reviewResults?.some((r) => r.ragStatus === filterRag)) return false;
    if (filterType && d.contractType !== filterType) return false;
    return true;
  });

  // Keep CONTRACT_TYPES for any fallback usage
  void CONTRACT_TYPES;

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-5xl mx-auto space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Upload a contract and MIKE reviews it in minutes, not hours
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

        {/* Stats bar */}
        {stats && realDocuments.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Contracts", value: stats.totalContracts.toString() },
              {
                label: "Portfolio value",
                value: stats.totalValue > 0
                  ? `£${stats.totalValue >= 1_000_000 ? `${(stats.totalValue / 1_000_000).toFixed(1)}M` : stats.totalValue >= 1000 ? `${Math.round(stats.totalValue / 1000)}k` : stats.totalValue.toFixed(0)}`
                  : "—",
              },
              { label: "Red clauses", value: stats.redContracts > 0 ? `${stats.redContracts} contracts` : "None", highlight: stats.redContracts > 0 },
              { label: "Renewals in 90 days", value: stats.renewalsDue > 0 ? `${stats.renewalsDue} due` : "None" },
            ].map((s) => (
              <div key={s.label} className="card px-4 py-3">
                <div className={`text-lg font-semibold ${s.highlight ? "text-red-600" : ""}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Left col — upload + list */}
          <div className="lg:col-span-2 space-y-5">

            {/* Upload */}
            <div className="card">
              <div className="card-header space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold">Upload a contract</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">PDF or DOCX · Max 20 MB</p>
                  </div>
                </div>
                {/* Quick metadata fields */}
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    className="input text-sm py-1.5"
                    placeholder="Counterparty name (optional)"
                    value={counterpartyName}
                    onChange={(e) => setCounterpartyName(e.target.value)}
                  />
                  <select
                    className="input text-sm py-1.5"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                  >
                    {contractTypeOptions.map((ct) => (
                      <option key={ct.value} value={ct.value}>{ct.label}</option>
                    ))}
                  </select>
                  <select
                    className="input text-sm py-1.5"
                    value={counterpartyType}
                    onChange={(e) => setCounterpartyType(e.target.value)}
                  >
                    <option value="">
                      {workflowType === "INSURANCE_LITIGATION" ? "Claimant type…" : "Counterparty type…"}
                    </option>
                    {counterpartyTypeOptions.map((ct) => (
                      <option key={ct.value} value={ct.value}>{ct.label}</option>
                    ))}
                  </select>
                  <select
                    className="input text-sm py-1.5"
                    value={reviewType}
                    onChange={(e) => setReviewType(e.target.value)}
                  >
                    {reviewTypeOptions.map((rt) => (
                      <option key={rt.value} value={rt.value}>{rt.label}</option>
                    ))}
                  </select>
                </div>
                {/* Value + term row */}
                <div className="grid sm:grid-cols-3 gap-2">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">£</span>
                    <input
                      type="number"
                      className="input text-sm py-1.5 pl-6"
                      placeholder="Contract value"
                      value={contractValue}
                      onChange={(e) => setContractValue(e.target.value)}
                    />
                  </div>
                  <input
                    type="number"
                    className="input text-sm py-1.5"
                    placeholder="Term (months)"
                    value={contractTermMonths}
                    onChange={(e) => setContractTermMonths(e.target.value)}
                  />
                  <input
                    type="date"
                    className="input text-sm py-1.5"
                    placeholder="Renewal date"
                    value={renewalDate}
                    onChange={(e) => setRenewalDate(e.target.value)}
                  />
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
                  <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.docx,.doc" onChange={onFileChange} />
                  {uploading ? (
                    <div className="space-y-3">
                      <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
                      <div className="text-sm font-medium">Uploading and starting review…</div>
                      <div className="text-xs text-muted-foreground">Classifying clauses and checking your playbook</div>
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

            {/* Search and filter */}
            {realDocuments.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  className="input text-sm py-1.5 flex-1 min-w-[160px]"
                  placeholder="Search by counterparty name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                  className="input text-sm py-1.5 w-auto"
                  value={filterRag}
                  onChange={(e) => setFilterRag(e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="RED">Red flagged</option>
                  <option value="AMBER">Amber flagged</option>
                  <option value="GREEN">Green only</option>
                </select>
                <select
                  className="input text-sm py-1.5 w-auto"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="">All types</option>
                  {contractTypeOptions.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
                {(searchQuery || filterRag || filterType) && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => { setSearchQuery(""); setFilterRag(""); setFilterType(""); }}
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            {/* Recent reviews */}
            <div className="card">
              <div className="card-header">
                <h2 className="text-base font-semibold">Recent reviews</h2>
              </div>
              {documents.length === 0 ? (
                <div className="card-body text-center py-12">
                  <FileText size={32} className="text-muted-foreground/30 mx-auto mb-3" />
                  <div className="text-sm font-medium text-muted-foreground">No contracts reviewed yet</div>
                  <div className="text-xs text-muted-foreground mt-1">Upload one above to get started</div>
                </div>
              ) : (
                <div className="divide-y divide-card-border">
                  {filteredDocuments.map((doc) => {
                    const results = (doc as DocWithRag).reviewResults ?? [];
                    const readiness = doc.status === "COMPLETE" ? getSignReadiness(results) : "pending";
                    const { label: readinessLabel, color: readinessColor, bg: readinessBg, icon: ReadinessIcon } = READINESS_CONFIG[readiness];
                    const isClickable = doc.status === "COMPLETE" && !useMock;
                    const red   = results.filter((r) => r.ragStatus === "RED").length;
                    const amber = results.filter((r) => r.ragStatus === "AMBER").length;
                    const docWithMeta = doc as DocWithRag & { counterpartyName?: string; contractValue?: number };

                    return (
                      <div
                        key={doc.id}
                        className={`px-5 py-4 flex items-center gap-4 transition-colors
                          ${isClickable ? "hover:bg-muted/20 cursor-pointer" : ""}`}
                        onClick={isClickable ? () => navigate(`/app/legal/review/${doc.id}`) : undefined}
                      >
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <FileText size={15} className="text-muted-foreground" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">
                            {doc.originalName}
                            {docWithMeta.counterpartyName && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                · {docWithMeta.counterpartyName}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {doc.contractType.replace(/_/g, " ")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(doc.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                            {docWithMeta.contractValue && (
                              <span className="text-xs text-muted-foreground">
                                £{docWithMeta.contractValue.toLocaleString("en-GB")}
                              </span>
                            )}
                            {doc.status === "COMPLETE" && results.length > 0 && (
                              <MiniRagBar results={results} />
                            )}
                          </div>
                        </div>

                        {/* Risk pills */}
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

          {/* Right col — guide only */}
          <div className="space-y-5">

            {/* How to read results */}
            <div className="card bg-accent border-accent-border">
              <div className="card-body space-y-4">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-primary" />
                  <span className="text-sm font-semibold text-accent-foreground">How to read your results</span>
                </div>
                <div className="space-y-3 text-xs text-foreground/80">
                  {[
                    { badge: "rag-red",   label: "Red",    desc: "Do not sign — fix this first" },
                    { badge: "rag-amber", label: "Amber",  desc: "Worth negotiating before signing" },
                    { badge: "rag-green", label: "Green",  desc: "Looks good against your playbook" },
                    { badge: "rag-grey",  label: "Absent", desc: "Clause missing — ask for it" },
                  ].map(({ badge, label, desc }) => (
                    <div key={label} className="flex items-start gap-2.5">
                      <span className={`${badge} mt-0.5 shrink-0`}>{label}</span>
                      <span className="leading-relaxed">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* What MIKE checks */}
            <div className="card">
              <div className="card-body space-y-3">
                <div className="text-sm font-semibold">What MIKE checks</div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  {[
                    "Liability caps and exclusions",
                    "Indemnity and risk allocation",
                    "IP ownership and licensing",
                    "Data privacy obligations",
                    "Termination rights",
                    "Payment and auto-renewal terms",
                    "Governing law",
                    "Audit rights",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-primary/60 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Legal Inheritance */}
            <div className="card border-primary/20" style={{ background: "hsl(172 84% 6%)" }}>
              <div className="card-body space-y-3">
                <div className="flex items-center gap-2">
                  <LayoutGrid size={14} className="text-primary shrink-0" />
                  <span className="text-sm font-semibold">Legal Inheritance</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Already have a contract library? Upload your entire back-catalogue in one go. MIKE reviews every document against your playbook and surfaces hidden risk across your existing portfolio.
                </p>
                <Link
                  to="/app/legal/bulk-review"
                  className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:opacity-80 transition-opacity"
                >
                  Run a bulk review <ArrowRight size={11} />
                </Link>
              </div>
            </div>

            {/* MIKE noticed (memory layer) */}
            <MikeNoticedPanel />

            {/* Missing docs */}
            <MissingDocsPanel />

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
