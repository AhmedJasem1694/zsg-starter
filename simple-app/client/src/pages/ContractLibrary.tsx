import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import {
  Library, Search, FileText, ExternalLink, GitBranch, Tag,
  CheckCircle, AlertTriangle, XCircle, Edit2, Check, X,
  ArrowUpDown, Upload, ChevronDown, ChevronUp, Loader2, Mail,
} from "lucide-react";
import AppLayout from "../components/layout/AppLayout";
import { getLibrary, setDocumentFolder, linkDocumentVersion, uploadDocument, startReview, getCompany } from "../lib/api";
import type { UploadedDocument } from "../lib/types";

// ── Contract types ────────────────────────────────────────────────────────────

const CONTRACT_TYPES = [
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
  { value: "LICENCE_AGREEMENT",     label: "Licence Agreement" },
  { value: "OTHER",                 label: "Other" },
];

// NHS & Healthcare contract types, shown only when company sector is healthcare
const NHS_CONTRACT_TYPES = [
  { value: "NHS_STANDARD_CONTRACT",           label: "NHS Standard Contract" },
  { value: "NHS_SUBCONTRACT",                 label: "NHS Subcontract Agreement" },
  { value: "NHS_FRAMEWORK",                   label: "NHS Framework Agreement" },
  { value: "NHS_PARTNERSHIP",                 label: "NHS Partnership Agreement" },
  { value: "NHS_COLLABORATIVE",               label: "NHS Collaborative Agreement" },
  { value: "HEALTHCARE_SAAS",                 label: "Healthcare SaaS Agreement" },
  { value: "MEDICAL_EQUIPMENT_SUPPLY",        label: "Medical Equipment Supply Agreement" },
  { value: "CLINICAL_SERVICES",               label: "Clinical Services Agreement" },
  { value: "PHARMACY_SERVICES",               label: "Pharmacy Services Agreement" },
  { value: "FM_HEALTHCARE",                   label: "Facilities Management Healthcare" },
  { value: "CATERING_HEALTHCARE",             label: "Catering Services Healthcare" },
  { value: "IT_DIGITAL_HEALTH",               label: "IT and Digital Health Agreement" },
  { value: "MEDICAL_STAFFING",                label: "Medical Staffing Agency Agreement" },
  { value: "CLINICAL_TRIAL",                  label: "Clinical Trial Agreement" },
  { value: "RESEARCH_COLLABORATION",          label: "Research Collaboration Agreement" },
];

// ── Library grouping (by document type / by vendor) ────────────────────────────

type GroupView = "type" | "vendor" | "all";

// value -> friendly label, from the types the pipeline already classifies into.
const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  [...CONTRACT_TYPES, ...NHS_CONTRACT_TYPES].map((t) => [t.value, t.label]),
);

function typeLabel(contractType?: string): string {
  const t = (contractType ?? "").trim();
  if (!t) return "Uncategorised";
  return TYPE_LABELS[t] ?? TYPE_LABELS[t.toUpperCase()] ?? t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Pluralise common contract-type labels for group headings ("...Agreement" -> "...Agreements").
function pluralLabel(label: string): string {
  if (label === "Uncategorised") return label;
  if (/agreement$/i.test(label)) return label + "s";
  if (/contract$/i.test(label))  return label + "s";
  return label;
}

interface DocGroup { key: string; label: string; docs: UploadedDocument[] }

// Group an already-sorted document list by document type or by vendor. Groups are
// ordered by size (largest first), with the "Other"/"Unknown" bucket pinned last.
function groupDocuments(docs: UploadedDocument[], view: GroupView): DocGroup[] {
  const map = new Map<string, DocGroup>();
  for (const doc of docs) {
    let key: string, label: string;
    if (view === "vendor") {
      const v = (doc.counterpartyName ?? "").trim();
      key = v || "__none";
      label = v || "Unknown vendor";
    } else {
      const t = (doc.contractType ?? "").trim();
      key = t || "__none";
      label = pluralLabel(typeLabel(t));
    }
    if (!map.has(key)) map.set(key, { key, label, docs: [] });
    map.get(key)!.docs.push(doc);
  }
  const groups = Array.from(map.values());
  const isOther = (g: DocGroup) => g.key === "__none";
  groups.sort((a, b) => {
    if (isOther(a) !== isOther(b)) return isOther(a) ? 1 : -1;
    if (b.docs.length !== a.docs.length) return b.docs.length - a.docs.length;
    return a.label.localeCompare(b.label);
  });
  // In the vendor view, sub-order each vendor's documents by document type so a
  // vendor's MSA, NDA, SLA, etc. sit together within their group.
  if (view === "vendor") {
    for (const g of groups) {
      g.docs.sort((a, b) => {
        const cmp = typeLabel(a.contractType).localeCompare(typeLabel(b.contractType));
        return cmp !== 0 ? cmp : (a.originalName ?? "").localeCompare(b.originalName ?? "");
      });
    }
  }
  return groups;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status }: { status?: string }) {
  if (!status || status === "COMPLETE") {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/15 text-green-400 border border-green-500/25">Complete</span>;
  }
  const map: Record<string, { label: string; cls: string }> = {
    UPLOADED:   { label: "Uploaded",   cls: "bg-foreground/10 text-foreground/50 border-foreground/20" },
    PROCESSING: { label: "Processing", cls: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
    FAILED:     { label: "Failed",     cls: "bg-red-500/15 text-red-400 border-red-500/25" },
  };
  const entry = map[status];
  if (!entry) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${entry.cls}`}>
      {entry.label}
    </span>
  );
}

// ── Outcome pill ──────────────────────────────────────────────────────────────

function OutcomePill({ outcome }: { outcome?: string }) {
  if (!outcome || outcome === "DRAFT") {
    return <span className="text-[10px] text-foreground/30">Draft</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
      outcome === "SIGNED" ? "bg-blue-500/15 text-blue-400 border-blue-500/25" : "bg-purple-500/15 text-purple-400 border-purple-500/25"
    }`}>
      {outcome === "SIGNED" ? "Signed" : "Executed"}
    </span>
  );
}

// ── Inline folder edit ────────────────────────────────────────────────────────

function InlineFolderEdit({ documentId, currentFolder, onSave }: {
  documentId: string; currentFolder?: string; onSave: (folder: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentFolder ?? "");
  const handleSave = () => { if (value.trim()) onSave(value.trim()); setEditing(false); };
  if (!editing) {
    return (
      <button className="inline-flex items-center gap-1 text-[10px] text-foreground/40 hover:text-foreground/70 transition-colors max-w-[100px] truncate"
        onClick={(e) => { e.preventDefault(); setEditing(true); }} title="Edit folder">
        <Edit2 size={9} /><span className="truncate">{currentFolder || "-"}</span>
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1" onClick={(e) => e.preventDefault()}>
      <input autoFocus className="text-[11px] bg-card border border-border rounded px-1.5 py-0.5 text-foreground w-24 outline-none focus:border-blue-500"
        value={value} onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }} />
      <button className="text-green-500 hover:text-green-400" onClick={handleSave}><Check size={12} /></button>
      <button className="text-red-400 hover:text-red-300" onClick={() => setEditing(false)}><X size={12} /></button>
    </span>
  );
}

// ── Version picker ────────────────────────────────────────────────────────────

function VersionPickerCell({ doc, allDocs }: { doc: UploadedDocument; allDocs: UploadedDocument[] }) {
  const [open, setOpen] = useState(false);
  const linkMutation = useMutation({
    mutationFn: ({ docId, parentId }: { docId: string; parentId: string }) => linkDocumentVersion(docId, parentId),
    onSuccess: () => setOpen(false),
  });
  const parent   = doc.parentDocumentId ? allDocs.find((d) => d.id === doc.parentDocumentId) : null;
  const children = allDocs.filter((d) => d.parentDocumentId === doc.id);
  if (parent || children.length > 0) {
    return <span className="inline-flex items-center gap-1 text-[10px] text-foreground/40"><GitBranch size={10} />{parent ? "Version" : `${children.length}v`}</span>;
  }
  return (
    <div className="relative">
      <button className="inline-flex items-center gap-1 text-[10px] text-foreground/20 hover:text-blue-400 transition-colors"
        title="Link as version" onClick={(e) => { e.preventDefault(); setOpen(!open); }}>
        <GitBranch size={10} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 bg-card border border-border rounded-xl shadow-xl p-3"
          onClick={(e) => e.stopPropagation()}>
          <p className="text-[11px] text-foreground/60 mb-2">Select the parent document:</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {allDocs.filter((d) => d.id !== doc.id && !d.parentDocumentId).map((d) => (
              <button key={d.id} className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 text-[11px] text-foreground/80 transition-colors"
                onClick={() => linkMutation.mutate({ docId: doc.id, parentId: d.id })}>
                {d.originalName ?? d.filename}
              </button>
            ))}
          </div>
          <button className="mt-2 text-[11px] text-foreground/40 hover:text-foreground/70" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────

function TableRow({ doc, allDocs, onFolderChange }: {
  doc: UploadedDocument; allDocs: UploadedDocument[]; onFolderChange: (id: string, folder: string) => void;
}) {
  return (
    <tr className="group hover:bg-white/[0.03] transition-colors">
      <td className="px-4 py-3 max-w-0 w-[260px]">
        <Link to={`/app/legal/review/${doc.id}`} className="flex items-center gap-2 group/link">
          <FileText size={13} className="shrink-0 text-foreground/30 group-hover/link:text-foreground/60 transition-colors" />
          <span className="text-sm text-foreground/90 font-medium truncate group-hover/link:text-foreground transition-colors">
            {doc.originalName ?? doc.filename}
          </span>
          {doc.draft && (
            <span title="Zane-generated first draft" className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-400">
              Draft
            </span>
          )}
          {doc.source === "email" && (
            <span title="Received by email" className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/10 text-blue-400">
              <Mail size={8} /> Email
            </span>
          )}
          <ExternalLink size={10} className="shrink-0 text-foreground/20 group-hover/link:text-foreground/50 transition-colors" />
        </Link>
        {doc.contractTags && (
          <div className="flex items-center gap-1 mt-0.5 ml-5">
            <Tag size={8} className="text-foreground/30" />
            <span className="text-[9px] text-foreground/30 truncate">{doc.contractTags}</span>
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-foreground/60 whitespace-nowrap">
        {doc.counterpartyName || <span className="text-foreground/20">-</span>}
      </td>
      <td className="px-4 py-3 text-xs text-foreground/60 whitespace-nowrap">
        {doc.contractType ? doc.contractType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : <span className="text-foreground/20">-</span>}
      </td>
      <td className="px-4 py-3 text-xs text-foreground/60 whitespace-nowrap text-right">
        {doc.contractValue != null ? `${doc.currency ?? "£"}${doc.contractValue.toLocaleString()}` : <span className="text-foreground/20">-</span>}
      </td>
      <td className="px-4 py-3 text-xs text-foreground/50 whitespace-nowrap">
        {doc.governingLaw || <span className="text-foreground/20">-</span>}
      </td>
      <td className="px-4 py-3 whitespace-nowrap"><StatusPill status={doc.status} /></td>
      <td className="px-4 py-3 whitespace-nowrap"><OutcomePill outcome={doc.outcome} /></td>
      <td className="px-4 py-3 whitespace-nowrap">
        <InlineFolderEdit documentId={doc.id} currentFolder={doc.folder} onSave={(folder) => onFolderChange(doc.id, folder)} />
      </td>
      <td className="px-4 py-3 text-[11px] text-foreground/40 whitespace-nowrap">{formatDate(doc.uploadedAt)}</td>
      <td className="px-4 py-3"><VersionPickerCell doc={doc} allDocs={allDocs} /></td>
    </tr>
  );
}

// ── Column header ─────────────────────────────────────────────────────────────

type SortKey = "name" | "counterparty" | "value" | "uploadedAt" | "status";

function ColHeader({ label, sortKey, current, onSort, align = "left" }: {
  label: string; sortKey?: SortKey; current?: SortKey; direction?: "asc" | "desc";
  onSort?: (k: SortKey) => void; align?: "left" | "right";
}) {
  const active = sortKey && current === sortKey;
  return (
    <th className={`px-4 py-3 text-[10px] uppercase tracking-wider font-semibold whitespace-nowrap select-none
      ${align === "right" ? "text-right" : "text-left"}
      ${sortKey ? "cursor-pointer hover:text-foreground/70" : ""}
      ${active ? "text-foreground/60" : "text-foreground/30"}`}
      onClick={() => sortKey && onSort?.(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey && <ArrowUpDown size={9} className={active ? "text-blue-400" : "opacity-30"} />}
      </span>
    </th>
  );
}

// ── Upload zone ───────────────────────────────────────────────────────────────

function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragOver,       setDragOver]       = useState(false);
  const [uploading,      setUploading]      = useState(false);
  const [uploadError,    setUploadError]    = useState<string | null>(null);
  const [uploadSuccess,  setUploadSuccess]  = useState(false);

  // Form fields
  const [contractType,    setContractType]    = useState("SUPPLIER_AGREEMENT");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [reviewType,      setReviewType]      = useState("INBOUND");

  // company for workflowType + healthcare detection
  const { data: company } = useQuery({ queryKey: ["company"], queryFn: getCompany, retry: false });
  const workflowType = (company as { workflowType?: string } | undefined)?.workflowType;
  const companySector = ((company as { sector?: string } | undefined)?.sector ?? "").toLowerCase();
  const companyIndustry = ((company as { industry?: string } | undefined)?.industry ?? "").toLowerCase();
  const isHealthcare =
    companySector.includes("health") || companySector.includes("nhs") ||
    companyIndustry.includes("health") || companyIndustry.includes("nhs");
  const availableContractTypes = isHealthcare
    ? [...CONTRACT_TYPES.slice(0, -1), ...NHS_CONTRACT_TYPES, CONTRACT_TYPES[CONTRACT_TYPES.length - 1]]
    : CONTRACT_TYPES;

  const reviewMutation = useMutation({ mutationFn: startReview });

  async function handleFile(file: File) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    try {
      const doc = await uploadDocument(file, contractType, {
        counterpartyName: counterpartyName || undefined,
        reviewType,
        currency: "GBP",
      });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      await queryClient.invalidateQueries({ queryKey: ["library"] });
      await reviewMutation.mutateAsync(doc.id);
      // Litigation disabled, commercial contracts focus.
      // if (workflowType === "INSURANCE_LITIGATION") {
      //   navigate(`/app/legal/litigation-intake/${doc.id}`);
      //   return;
      // }
      setCounterpartyName("");
      setReviewType("INBOUND");
      setUploadSuccess(true);
      onUploaded();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      const status = e instanceof Error && (e as { status?: number }).status;
      if (msg.includes("413") || status === 413 || msg.toLowerCase().includes("too large")) {
        setUploadError("This file exceeds the 50 MB limit. Split large documents into sections before uploading.");
      } else if (msg.includes("415") || status === 415 || msg.toLowerCase().includes("unsupported")) {
        setUploadError("Only PDF and Word documents (.pdf, .docx) are accepted.");
      } else if (msg.includes("401")) {
        setUploadError("Your session has expired. Please log in again.");
      } else {
        setUploadError("Upload failed. Check your connection and try again.");
      }
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

  return (
    <div className="card p-5 space-y-4">
      {/* Metadata row */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Contract type</label>
          <select
            value={contractType}
            onChange={(e) => setContractType(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500 transition-colors"
          >
            {availableContractTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Counterparty name <span className="text-foreground/30 normal-case">(optional)</span></label>
          <input
            type="text"
            placeholder="e.g. Acme Corp Ltd"
            value={counterpartyName}
            onChange={(e) => setCounterpartyName(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Review type</label>
          <select
            value={reviewType}
            onChange={(e) => setReviewType(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500 transition-colors"
          >
            <option value="INBOUND">Their paper (inbound review)</option>
            <option value="OUTBOUND">Our paper (outbound check)</option>
            <option value="NEGOTIATED">Negotiated draft (mid-negotiation)</option>
            <option value="EXECUTION">Final execution version</option>
          </select>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 px-6 cursor-pointer transition-colors select-none
          ${dragOver ? "border-blue-500 bg-blue-500/5" : "border-border hover:border-foreground/30 hover:bg-white/[0.02]"}
          ${uploading ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={onFileChange}
          disabled={uploading}
        />

        {uploading ? (
          <>
            <Loader2 size={28} className="text-blue-400 animate-spin" />
            <div className="text-sm font-medium text-foreground">Uploading and starting review…</div>
            <div className="text-xs text-foreground/40">This may take a moment</div>
          </>
        ) : uploadSuccess ? (
          <>
            <CheckCircle size={28} className="text-green-400" />
            <div className="text-sm font-medium text-foreground">Upload complete, review started</div>
            <div className="text-xs text-foreground/40">The contract will appear in the table below when processing finishes</div>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Upload size={22} className="text-blue-400" />
            </div>
            <div className="text-center space-y-1">
              <div className="text-sm font-semibold text-foreground">
                {dragOver ? "Drop to upload" : "Drag and drop or click to browse"}
              </div>
              <div className="text-xs text-foreground/40">PDF or DOCX, max 50 MB</div>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {uploadError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
          <AlertTriangle size={13} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400 leading-relaxed">{uploadError}</p>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ContractLibrary() {
  const [search, setSearch]                   = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey]                 = useState<SortKey>("uploadedAt");
  const [sortDir, setSortDir]                 = useState<"asc" | "desc">("desc");
  const [view, setView]                       = useState<GroupView>("type");
  const [uploadOpen, setUploadOpen]           = useState(false);
  const uploadRef                             = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout((handleSearch as { _t?: ReturnType<typeof setTimeout> })._t);
    (handleSearch as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["library", debouncedSearch],
    queryFn: () => getLibrary(debouncedSearch || undefined),
  });

  const folderMutation = useMutation({
    mutationFn: ({ id, folder }: { id: string; folder: string }) => setDocumentFolder(id, folder),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
  });

  function openUpload() {
    if (!uploadOpen) {
      setUploadOpen(true);
      // Give React one tick to render, then scroll
      setTimeout(() => uploadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } else {
      uploadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const allDocs: UploadedDocument[] = data?.folders.flatMap((f) => f.documents) ?? [];

  const sorted = [...allDocs].sort((a, b) => {
    let cmp = 0;
    if      (sortKey === "name")         cmp = (a.originalName ?? a.filename).localeCompare(b.originalName ?? b.filename);
    else if (sortKey === "counterparty") cmp = (a.counterpartyName ?? "").localeCompare(b.counterpartyName ?? "");
    else if (sortKey === "value")        cmp = (a.contractValue ?? 0) - (b.contractValue ?? 0);
    else if (sortKey === "uploadedAt")   cmp = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
    else if (sortKey === "status")       cmp = (a.status ?? "").localeCompare(b.status ?? "");
    return sortDir === "asc" ? cmp : -cmp;
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const completeCount = allDocs.filter((d) => d.status === "COMPLETE").length;
  const signedCount   = allDocs.filter((d) => d.outcome === "SIGNED" || d.outcome === "EXECUTED").length;

  // Grouped views reuse the same sorted rows, split into labelled sections.
  const groups: DocGroup[] = view === "all" ? [{ key: "all", label: "", docs: sorted }] : groupDocuments(sorted, view);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Library size={22} className="text-blue-400" />
              <h1 className="text-2xl font-bold text-foreground">Contract Library</h1>
            </div>
            <p className="text-sm text-foreground/50">Upload contracts for review or browse your existing library</p>
          </div>

          <div className="flex items-center gap-4">
            {data && (
              <div className="flex items-center gap-5 text-right">
                <div>
                  <div className="text-xl font-bold text-foreground">{data.total}</div>
                  <div className="text-[10px] text-foreground/40 uppercase tracking-wider">Total</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-foreground">{completeCount}</div>
                  <div className="text-[10px] text-foreground/40 uppercase tracking-wider">Reviewed</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-blue-400">{signedCount}</div>
                  <div className="text-[10px] text-foreground/40 uppercase tracking-wider">Signed</div>
                </div>
              </div>
            )}
            <button
              onClick={openUpload}
              className="btn-primary flex items-center gap-2 px-4 py-2 text-sm shrink-0"
            >
              <Upload size={14} />
              Upload a contract
            </button>
          </div>
        </div>

        {/* Upload zone, collapsible, scrolled-to on button click */}
        <div ref={uploadRef}>
          <button
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:bg-white/5 transition-colors text-sm font-medium text-foreground/80"
            onClick={() => setUploadOpen((o) => !o)}
          >
            <div className="flex items-center gap-2">
              <Upload size={15} className="text-blue-400" />
              Upload a new contract for review
            </div>
            {uploadOpen ? <ChevronUp size={15} className="text-foreground/40" /> : <ChevronDown size={15} className="text-foreground/40" />}
          </button>

          {uploadOpen && (
            <div className="mt-2">
              <UploadZone onUploaded={() => { void refetch(); }} />
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30" />
          <input
            type="text"
            placeholder="Search by name, counterparty, tags, or folder…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-foreground/30 outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* View toggle: group by document type / by vendor / flat list */}
        {!isLoading && allDocs.length > 0 && (
          <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5 text-xs">
            {([
              { v: "type",   label: "By document type" },
              { v: "vendor", label: "By vendor" },
              { v: "all",    label: "All" },
            ] as { v: GroupView; label: string }[]).map(({ v, label }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  view === v ? "bg-blue-500/15 text-blue-300" : "text-foreground/50 hover:text-foreground/80"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-16 text-foreground/40 text-sm">Loading library…</div>
        )}

        {/* Empty state (no contracts yet) */}
        {!isLoading && allDocs.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <Library size={40} className="mx-auto text-foreground/20" />
            <p className="text-foreground/50 text-sm">
              {debouncedSearch ? "No contracts match your search." : "No contracts uploaded yet."}
            </p>
            {!debouncedSearch && (
              <button
                onClick={openUpload}
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Upload size={12} />
                Upload your first contract
              </button>
            )}
          </div>
        )}

        {/* Table */}
        {!isLoading && sorted.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-card/80">
                    <ColHeader label="Name"          sortKey="name"         current={sortKey} onSort={handleSort} />
                    <ColHeader label="Counterparty"  sortKey="counterparty" current={sortKey} onSort={handleSort} />
                    <ColHeader label="Type" />
                    <ColHeader label="Value"         sortKey="value"        current={sortKey} onSort={handleSort} align="right" />
                    <ColHeader label="Governing Law" />
                    <ColHeader label="Status"        sortKey="status"       current={sortKey} onSort={handleSort} />
                    <ColHeader label="Outcome" />
                    <ColHeader label="Folder" />
                    <ColHeader label="Uploaded"      sortKey="uploadedAt"   current={sortKey} onSort={handleSort} />
                    <ColHeader label="" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {groups.flatMap((g) => [
                    view !== "all" ? (
                      <tr key={`group-${g.key}`} className="bg-card/40">
                        <td colSpan={10} className="px-4 py-2.5 text-xs font-semibold text-foreground/70 border-y border-border">
                          {view === "vendor" && g.key !== "__none" ? (
                            <Link
                              to={`/app/legal/vendor/${encodeURIComponent(g.label)}`}
                              className="text-blue-300 hover:text-blue-200 hover:underline transition-colors"
                            >
                              {g.label}
                            </Link>
                          ) : (
                            g.label
                          )}
                          <span className="ml-1.5 font-normal text-foreground/40">({g.docs.length})</span>
                        </td>
                      </tr>
                    ) : null,
                    ...g.docs.map((doc) => (
                      <TableRow
                        key={doc.id}
                        doc={doc}
                        allDocs={allDocs}
                        onFolderChange={(id, folder) => folderMutation.mutate({ id, folder })}
                      />
                    )),
                  ])}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-border bg-card/50 flex items-center justify-between">
              <span className="text-[11px] text-foreground/40">
                {sorted.length} contract{sorted.length !== 1 ? "s" : ""}
                {debouncedSearch && " matching search"}
              </span>
              <div className="flex items-center gap-4 text-[11px] text-foreground/30">
                <div className="flex items-center gap-1.5"><CheckCircle size={10} className="text-blue-400" /> Signed/Executed</div>
                <div className="flex items-center gap-1.5"><AlertTriangle size={10} className="text-amber-400" /> Processing</div>
                <div className="flex items-center gap-1.5"><XCircle size={10} className="text-red-400" /> Failed</div>
                <div className="flex items-center gap-1.5"><GitBranch size={10} /> Version chain</div>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
