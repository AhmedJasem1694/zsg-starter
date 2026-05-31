import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Library, Search, FileText, ExternalLink, GitBranch, Tag,
  CheckCircle, AlertTriangle, XCircle, Edit2, Check, X,
  ArrowUpDown, Upload,
} from "lucide-react";
import AppLayout from "../components/layout/AppLayout";
import { getLibrary, setDocumentFolder, linkDocumentVersion } from "../lib/api";
import type { UploadedDocument } from "../lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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

function InlineFolderEdit({
  documentId,
  currentFolder,
  onSave,
}: {
  documentId: string;
  currentFolder?: string;
  onSave: (folder: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentFolder ?? "");

  const handleSave = () => {
    if (value.trim()) onSave(value.trim());
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        className="inline-flex items-center gap-1 text-[10px] text-foreground/40 hover:text-foreground/70 transition-colors max-w-[100px] truncate"
        onClick={(e) => { e.preventDefault(); setEditing(true); }}
        title="Edit folder"
      >
        <Edit2 size={9} />
        <span className="truncate">{currentFolder || "—"}</span>
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1" onClick={(e) => e.preventDefault()}>
      <input
        autoFocus
        className="text-[11px] bg-card border border-border rounded px-1.5 py-0.5 text-foreground w-24 outline-none focus:border-blue-500"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
      />
      <button className="text-green-500 hover:text-green-400" onClick={handleSave}><Check size={12} /></button>
      <button className="text-red-400 hover:text-red-300" onClick={() => setEditing(false)}><X size={12} /></button>
    </span>
  );
}

// ── Version picker ────────────────────────────────────────────────────────────

function VersionPickerCell({
  doc,
  allDocs,
}: {
  doc: UploadedDocument;
  allDocs: UploadedDocument[];
}) {
  const [open, setOpen] = useState(false);
  const linkMutation = useMutation({
    mutationFn: ({ docId, parentId }: { docId: string; parentId: string }) =>
      linkDocumentVersion(docId, parentId),
    onSuccess: () => setOpen(false),
  });

  const parent   = doc.parentDocumentId ? allDocs.find((d) => d.id === doc.parentDocumentId) : null;
  const children = allDocs.filter((d) => d.parentDocumentId === doc.id);

  if (parent || children.length > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-foreground/40">
        <GitBranch size={10} />
        {parent ? "Version" : `${children.length}v`}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        className="inline-flex items-center gap-1 text-[10px] text-foreground/20 hover:text-blue-400 transition-colors"
        title="Link as version"
        onClick={(e) => { e.preventDefault(); setOpen(!open); }}
      >
        <GitBranch size={10} />
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-64 bg-card border border-border rounded-xl shadow-xl p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[11px] text-foreground/60 mb-2">Select the parent document:</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {allDocs
              .filter((d) => d.id !== doc.id && !d.parentDocumentId)
              .map((d) => (
                <button
                  key={d.id}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 text-[11px] text-foreground/80 transition-colors"
                  onClick={() => linkMutation.mutate({ docId: doc.id, parentId: d.id })}
                >
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

function TableRow({
  doc,
  allDocs,
  onFolderChange,
}: {
  doc: UploadedDocument;
  allDocs: UploadedDocument[];
  onFolderChange: (id: string, folder: string) => void;
}) {
  return (
    <tr className="group hover:bg-white/[0.03] transition-colors">
      {/* Name */}
      <td className="px-4 py-3 max-w-0 w-[260px]">
        <Link
          to={`/app/legal/review/${doc.id}`}
          className="flex items-center gap-2 group/link"
        >
          <FileText size={13} className="shrink-0 text-foreground/30 group-hover/link:text-foreground/60 transition-colors" />
          <span className="text-sm text-foreground/90 font-medium truncate group-hover/link:text-white transition-colors">
            {doc.originalName ?? doc.filename}
          </span>
          <ExternalLink size={10} className="shrink-0 text-foreground/20 group-hover/link:text-foreground/50 transition-colors" />
        </Link>
        {doc.contractTags && (
          <div className="flex items-center gap-1 mt-0.5 ml-5">
            <Tag size={8} className="text-foreground/30" />
            <span className="text-[9px] text-foreground/30 truncate">{doc.contractTags}</span>
          </div>
        )}
      </td>

      {/* Counterparty */}
      <td className="px-4 py-3 text-xs text-foreground/60 whitespace-nowrap">
        {doc.counterpartyName || <span className="text-foreground/20">—</span>}
      </td>

      {/* Contract type */}
      <td className="px-4 py-3 text-xs text-foreground/60 whitespace-nowrap">
        {doc.contractType
          ? doc.contractType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
          : <span className="text-foreground/20">—</span>}
      </td>

      {/* Value */}
      <td className="px-4 py-3 text-xs text-foreground/60 whitespace-nowrap text-right">
        {doc.contractValue != null
          ? `${doc.currency ?? "£"}${doc.contractValue.toLocaleString()}`
          : <span className="text-foreground/20">—</span>}
      </td>

      {/* Governing law */}
      <td className="px-4 py-3 text-xs text-foreground/50 whitespace-nowrap">
        {doc.governingLaw || <span className="text-foreground/20">—</span>}
      </td>

      {/* Status */}
      <td className="px-4 py-3 whitespace-nowrap">
        <StatusPill status={doc.status} />
      </td>

      {/* Outcome */}
      <td className="px-4 py-3 whitespace-nowrap">
        <OutcomePill outcome={doc.outcome} />
      </td>

      {/* Folder */}
      <td className="px-4 py-3 whitespace-nowrap">
        <InlineFolderEdit
          documentId={doc.id}
          currentFolder={doc.folder}
          onSave={(folder) => onFolderChange(doc.id, folder)}
        />
      </td>

      {/* Uploaded */}
      <td className="px-4 py-3 text-[11px] text-foreground/40 whitespace-nowrap">
        {formatDate(doc.uploadedAt)}
      </td>

      {/* Version */}
      <td className="px-4 py-3">
        <VersionPickerCell doc={doc} allDocs={allDocs} />
      </td>
    </tr>
  );
}

// ── Column header ─────────────────────────────────────────────────────────────

type SortKey = "name" | "counterparty" | "value" | "uploadedAt" | "status";

function ColHeader({
  label,
  sortKey,
  current,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey?: SortKey;
  current?: SortKey;
  direction?: "asc" | "desc";
  onSort?: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey && current === sortKey;
  return (
    <th
      className={`px-4 py-3 text-[10px] uppercase tracking-wider font-semibold whitespace-nowrap select-none
        ${align === "right" ? "text-right" : "text-left"}
        ${sortKey ? "cursor-pointer hover:text-foreground/70" : ""}
        ${active ? "text-foreground/60" : "text-foreground/30"}`}
      onClick={() => sortKey && onSort?.(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey && <ArrowUpDown size={9} className={active ? "text-blue-400" : "opacity-30"} />}
      </span>
    </th>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ContractLibrary() {
  const [search, setSearch]           = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey, setSortKey]         = useState<SortKey>("uploadedAt");
  const [sortDir, setSortDir]         = useState<"asc" | "desc">("desc");
  const queryClient = useQueryClient();

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout((handleSearch as { _t?: ReturnType<typeof setTimeout> })._t);
    (handleSearch as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["library", debouncedSearch],
    queryFn: () => getLibrary(debouncedSearch || undefined),
  });

  const folderMutation = useMutation({
    mutationFn: ({ id, folder }: { id: string; folder: string }) => setDocumentFolder(id, folder),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
  });

  // Flatten all docs
  const allDocs: UploadedDocument[] = data?.folders.flatMap((f) => f.documents) ?? [];

  // Sort
  const sorted = [...allDocs].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name")          cmp = (a.originalName ?? a.filename).localeCompare(b.originalName ?? b.filename);
    else if (sortKey === "counterparty") cmp = (a.counterpartyName ?? "").localeCompare(b.counterpartyName ?? "");
    else if (sortKey === "value")    cmp = (a.contractValue ?? 0) - (b.contractValue ?? 0);
    else if (sortKey === "uploadedAt")   cmp = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
    else if (sortKey === "status")   cmp = (a.status ?? "").localeCompare(b.status ?? "");
    return sortDir === "asc" ? cmp : -cmp;
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  // Stats
  const completeCount = allDocs.filter((d) => d.status === "COMPLETE").length;
  const signedCount   = allDocs.filter((d) => d.outcome === "SIGNED" || d.outcome === "EXECUTED").length;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Library size={22} className="text-blue-400" />
              <h1 className="text-2xl font-bold text-foreground">Contract Library</h1>
            </div>
            <p className="text-sm text-foreground/50">
              All contracts in one view — search, sort, and manage outcomes
            </p>
          </div>

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

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-16 text-foreground/40 text-sm">Loading library…</div>
        )}

        {/* Empty */}
        {!isLoading && allDocs.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <Library size={40} className="mx-auto text-foreground/20" />
            <p className="text-foreground/50 text-sm">
              {debouncedSearch ? "No contracts match your search." : "No contracts uploaded yet."}
            </p>
            {!debouncedSearch && (
              <Link to="/app/legal/dashboard" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                <Upload size={12} />
                Upload your first contract
              </Link>
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
                    <ColHeader label="Name"          sortKey="name"        current={sortKey} direction={sortDir} onSort={handleSort} />
                    <ColHeader label="Counterparty"  sortKey="counterparty" current={sortKey} direction={sortDir} onSort={handleSort} />
                    <ColHeader label="Type" />
                    <ColHeader label="Value"         sortKey="value"       current={sortKey} direction={sortDir} onSort={handleSort} align="right" />
                    <ColHeader label="Governing Law" />
                    <ColHeader label="Status"        sortKey="status"      current={sortKey} direction={sortDir} onSort={handleSort} />
                    <ColHeader label="Outcome" />
                    <ColHeader label="Folder" />
                    <ColHeader label="Uploaded"      sortKey="uploadedAt"  current={sortKey} direction={sortDir} onSort={handleSort} />
                    <ColHeader label="" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {sorted.map((doc) => (
                    <TableRow
                      key={doc.id}
                      doc={doc}
                      allDocs={allDocs}
                      onFolderChange={(id, folder) => folderMutation.mutate({ id, folder })}
                    />
                  ))}
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
