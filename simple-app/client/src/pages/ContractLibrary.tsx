import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Library, Search, ChevronDown, ChevronRight, Folder, FolderOpen,
  FileText, ExternalLink, GitBranch, Tag, CheckCircle, AlertTriangle, XCircle,
  Edit2, Check, X,
} from "lucide-react";
import AppLayout from "../components/layout/AppLayout";
import { getLibrary, setDocumentFolder, linkDocumentVersion } from "../lib/api";
import type { UploadedDocument } from "../lib/types";

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  if (!status || status === "COMPLETE") return null;
  const map: Record<string, { label: string; cls: string }> = {
    UPLOADED:   { label: "Uploaded",   cls: "bg-foreground/10 text-foreground/50 border-foreground/20" },
    PROCESSING: { label: "Processing", cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    FAILED:     { label: "Failed",     cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  };
  const entry = map[status];
  if (!entry) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${entry.cls}`}>
      {entry.label}
    </span>
  );
}

// ── Outcome badge ─────────────────────────────────────────────────────────────

function OutcomeBadge({ outcome }: { outcome?: string }) {
  if (!outcome || outcome === "DRAFT") return <span className="text-[10px] text-foreground/30">Draft</span>;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
      outcome === "SIGNED" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-purple-500/20 text-purple-400 border-purple-500/30"
    }`}>
      {outcome === "SIGNED" ? "Signed" : "Executed"}
    </span>
  );
}

// ── Folder edit inline ────────────────────────────────────────────────────────

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
    if (value.trim()) {
      onSave(value.trim());
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        className="inline-flex items-center gap-1 text-[10px] text-foreground/40 hover:text-foreground/70 transition-colors"
        onClick={(e) => { e.preventDefault(); setEditing(true); }}
        title="Edit folder"
      >
        <Edit2 size={10} />
        {currentFolder ? currentFolder : "Set folder"}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1" onClick={(e) => e.preventDefault()}>
      <input
        autoFocus
        className="text-[11px] bg-card border border-border rounded px-1.5 py-0.5 text-foreground w-28 outline-none focus:border-blue-500"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
      />
      <button className="text-green-500 hover:text-green-400" onClick={handleSave}><Check size={12} /></button>
      <button className="text-red-400 hover:text-red-300" onClick={() => setEditing(false)}><X size={12} /></button>
    </span>
  );
}

// ── Document row ──────────────────────────────────────────────────────────────

function DocumentRow({
  doc,
  allDocs,
  reviewBase,
  onFolderChange,
}: {
  doc: UploadedDocument;
  allDocs: UploadedDocument[];
  reviewBase: string;
  onFolderChange: (id: string, folder: string) => void;
}) {
  const [showVersionPicker, setShowVersionPicker] = useState(false);
  const linkMutation = useMutation({
    mutationFn: ({ docId, parentId }: { docId: string; parentId: string }) =>
      linkDocumentVersion(docId, parentId),
  });

  const parent = doc.parentDocumentId
    ? allDocs.find((d) => d.id === doc.parentDocumentId)
    : null;

  const children = allDocs.filter((d) => d.parentDocumentId === doc.id);

  return (
    <div className="group relative">
      <Link
        to={`${reviewBase}/${doc.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-lg transition-colors"
      >
        <FileText size={16} className="shrink-0 text-foreground/40" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate max-w-xs">
              {doc.originalName ?? doc.filename}
            </span>
            <StatusBadge status={doc.status} />
            <OutcomeBadge outcome={doc.outcome} />
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {doc.counterpartyName && (
              <span className="text-[11px] text-foreground/50">{doc.counterpartyName}</span>
            )}
            {doc.contractValue != null && (
              <span className="text-[11px] text-foreground/40">
                {doc.currency ?? "£"}{doc.contractValue.toLocaleString()}
              </span>
            )}
            {doc.governingLaw && (
              <span className="text-[11px] text-foreground/40">{doc.governingLaw}</span>
            )}
            {doc.contractTags && (
              <span className="inline-flex items-center gap-1 text-[10px] text-foreground/40">
                <Tag size={9} />
                {doc.contractTags}
              </span>
            )}
            <InlineFolderEdit
              documentId={doc.id}
              currentFolder={doc.folder}
              onSave={(folder) => onFolderChange(doc.id, folder)}
            />
          </div>
        </div>

        {/* Version chain indicator */}
        {(parent || children.length > 0) && (
          <div className="shrink-0 flex items-center gap-1 text-[10px] text-foreground/40">
            <GitBranch size={11} />
            {parent ? `v${(doc.originalName ?? "").match(/v(\d+)/i)?.[1] ?? "?"}` : `${children.length} version${children.length !== 1 ? "s" : ""}`}
          </div>
        )}

        <ExternalLink size={12} className="shrink-0 text-foreground/20 group-hover:text-foreground/50 transition-colors" />
      </Link>

      {/* Version link button — show on hover */}
      {!doc.parentDocumentId && (
        <button
          className="absolute right-8 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 text-[10px] text-foreground/40 hover:text-blue-400 transition-colors"
          title="Link as new version of another document"
          onClick={(e) => { e.preventDefault(); setShowVersionPicker(!showVersionPicker); }}
        >
          <GitBranch size={11} />
          Link version
        </button>
      )}

      {showVersionPicker && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-72 bg-card border border-border rounded-xl shadow-xl p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[11px] text-foreground/60 mb-2">Select the parent document (older version):</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {allDocs
              .filter((d) => d.id !== doc.id && !d.parentDocumentId)
              .map((d) => (
                <button
                  key={d.id}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 text-[11px] text-foreground/80 transition-colors"
                  onClick={() => {
                    linkMutation.mutate({ docId: doc.id, parentId: d.id });
                    setShowVersionPicker(false);
                  }}
                >
                  {d.originalName ?? d.filename}
                </button>
              ))}
          </div>
          <button
            className="mt-2 text-[11px] text-foreground/40 hover:text-foreground/70"
            onClick={() => setShowVersionPicker(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ── Folder accordion ──────────────────────────────────────────────────────────

function FolderAccordion({
  name,
  documents,
  allDocs,
  reviewBase,
  onFolderChange,
  defaultOpen = false,
}: {
  name: string;
  documents: UploadedDocument[];
  allDocs: UploadedDocument[];
  reviewBase: string;
  onFolderChange: (id: string, folder: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const processingCount = documents.filter((d) => d.status === "PROCESSING").length;
  const failedCount     = documents.filter((d) => d.status === "FAILED").length;
  const signedCount     = documents.filter((d) => d.outcome === "SIGNED" || d.outcome === "EXECUTED").length;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-white/5 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-foreground/50">
          {open ? <FolderOpen size={18} className="text-blue-400" /> : <Folder size={18} className="text-foreground/40" />}
        </span>
        <span className="flex-1 font-medium text-sm">{name}</span>

        <div className="flex items-center gap-2 text-[11px]">
          {processingCount > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertTriangle size={11} />{processingCount} processing
            </span>
          )}
          {failedCount > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <XCircle size={11} />{failedCount} failed
            </span>
          )}
          {signedCount > 0 && (
            <span className="flex items-center gap-1 text-blue-400">
              <CheckCircle size={11} />{signedCount} signed
            </span>
          )}
          <span className="text-foreground/40">{documents.length} doc{documents.length !== 1 ? "s" : ""}</span>
        </div>

        {open ? <ChevronDown size={14} className="text-foreground/40" /> : <ChevronRight size={14} className="text-foreground/40" />}
      </button>

      {open && (
        <div className="divide-y divide-border/50 bg-card/50">
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              allDocs={allDocs}
              reviewBase={reviewBase}
              onFolderChange={onFolderChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ContractLibrary() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const queryClient = useQueryClient();

  // Debounce search
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

  // Flatten all docs for version linking
  const allDocs = data?.folders.flatMap((f) => f.documents) ?? [];

  // Determine review base from first doc (all share same persona)
  const reviewBase = "/app/legal/review";

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Library size={22} className="text-blue-400" />
              <h1 className="text-2xl font-bold text-foreground">Contract Library</h1>
            </div>
            <p className="text-sm text-foreground/50">
              All contracts organised by folder — search, link versions, and track outcomes
            </p>
          </div>

          {data && (
            <div className="text-right">
              <div className="text-2xl font-bold text-foreground">{data.total}</div>
              <div className="text-xs text-foreground/40">total contracts</div>
            </div>
          )}
        </div>

        {/* Search bar */}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30" />
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
        {!isLoading && data?.folders.length === 0 && (
          <div className="text-center py-16">
            <Library size={40} className="mx-auto mb-3 text-foreground/20" />
            <p className="text-foreground/50 text-sm">
              {debouncedSearch ? "No contracts match your search." : "No contracts uploaded yet."}
            </p>
          </div>
        )}

        {/* Folder list */}
        {!isLoading && data && data.folders.length > 0 && (
          <div className="space-y-3">
            {data.folders.map((folder, i) => (
              <FolderAccordion
                key={folder.name}
                name={folder.name}
                documents={folder.documents}
                allDocs={allDocs}
                reviewBase={reviewBase}
                defaultOpen={i === 0}
                onFolderChange={(id, f) => folderMutation.mutate({ id, folder: f })}
              />
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="mt-8 pt-6 border-t border-border flex items-center gap-6 text-[11px] text-foreground/40 flex-wrap">
          <div className="flex items-center gap-1.5"><CheckCircle size={11} className="text-blue-400" /> Signed/Executed</div>
          <div className="flex items-center gap-1.5"><AlertTriangle size={11} className="text-amber-400" /> Processing</div>
          <div className="flex items-center gap-1.5"><XCircle size={11} className="text-red-400" /> Failed</div>
          <div className="flex items-center gap-1.5"><GitBranch size={11} /> Version chain</div>
          <div className="flex items-center gap-1.5"><Edit2 size={11} /> Hover to edit folder or link version</div>
        </div>
      </div>
    </AppLayout>
  );
}
