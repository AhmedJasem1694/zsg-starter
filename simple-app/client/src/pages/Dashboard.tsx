import React, { useState, useRef } from "react";
import { formatDateShort } from "../lib/dateUtils";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload, FileText, AlertTriangle, CheckCircle, Clock,
  RotateCcw, Shield, ChevronRight, AlertCircle, LayoutGrid, ArrowRight,
  CalendarClock, Bell, Lock, Activity, X, Trash2,
} from "lucide-react";
import { getDocuments, uploadDocument, startReview, getCompany, getDocumentStats, deleteDocument, deleteDocuments } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import ZaneNoticedPanel from "../components/ZaneNoticedPanel";
import MissingDocsPanel from "../components/MissingDocsPanel";
import AccumulationCard from "../components/AccumulationCard";
import { Link } from "react-router-dom";
import type { DocumentStatus } from "../lib/types";
import { MOCK_MODE, MOCK_DOCUMENTS, MOCK_URGENCY_SIGNALS } from "../lib/mockData";
import type { UploadedDocument } from "../lib/types";

// ─── Format lastError for display ────────────────────────────────────────────

function formatLastError(raw: string): string {
  if (raw.includes("timed out") || raw.includes("timeout")) {
    return "This document took too long to process. Try again or split it into smaller sections.";
  }
  if (raw.includes("Could not extract text") || raw.includes("mammoth") || raw.includes("docx")) {
    return "Zane could not read this Word document. Try saving it as a PDF and uploading again.";
  }
  if (raw.includes("pdf-parse") || raw.includes("scanned") || raw.includes("no text")) {
    return "This looks like a scanned document. Please try a text-based PDF or Word document.";
  }
  if (raw.includes("LLM returned invalid JSON") || raw.includes("OpenRouter")) {
    return "Zane could not complete the analysis. Please retry. This is usually a temporary issue.";
  }
  if (raw.includes("not found on disk") || raw.includes("uploads directory")) {
    return "The uploaded file could not be found. Please upload the document again.";
  }
  return "Review failed. Please retry or contact support@zanelegal.ai if this persists.";
}

// ─── Pilot safety notice ──────────────────────────────────────────────────────

function PilotNoticeBanner() {
  const [dismissed, setDismissed] = React.useState(
    () => localStorage.getItem("zane_pilot_notice_dismissed") === "true"
  );
  if (dismissed) return null;
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
      <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-200/80 leading-relaxed flex-1">
        <span className="font-semibold text-amber-300">Pilot use only.</span>{" "}
        Do not upload highly sensitive, privileged, or production-critical documents without prior agreement with Zane.
      </p>
      <button
        onClick={() => { localStorage.setItem("zane_pilot_notice_dismissed", "true"); setDismissed(true); }}
        className="text-amber-400/50 hover:text-amber-400 transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Delete confirmation modal ────────────────────────────────────────────────

interface DeleteModalProps {
  count: number;
  name?: string; // single contract name
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function DeleteConfirmModal({ count, name, onConfirm, onCancel, loading }: DeleteModalProps) {
  const isBulk = count > 1;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-[#0D1521] border border-[#1E293B] rounded-xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
        <div className="space-y-1">
          <div className="text-base font-semibold text-foreground">
            {isBulk ? `Delete ${count} contracts?` : "Delete this contract?"}
          </div>
          {!isBulk && name && (
            <div className="text-sm text-muted-foreground truncate">{name}</div>
          )}
        </div>
        <p className="text-sm text-muted-foreground/70 leading-relaxed">
          {isBulk
            ? `This will permanently remove ${count} contracts and all their analysis results.`
            : "This will permanently remove the contract, its analysis results, and all associated data."}
          {" "}This cannot be undone.
        </p>
        <div className="flex items-center gap-3 pt-1">
          {/* Cancel is focused by default so Enter doesn't accidentally confirm */}
          <button
            autoFocus
            onClick={onCancel}
            disabled={loading}
            className="flex-1 btn-secondary text-sm py-2"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#450A0A] hover:bg-[#5A0E0E] text-[#FCA5A5] text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? "Deleting…" : isBulk ? `Delete ${count} contracts` : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocWithRag {
  id: string;
  originalName: string;
  contractType: string;
  status: DocumentStatus;
  uploadedAt: string;
  reviewResults?: { ragStatus: string; escalationRequired?: boolean; feedback?: { userAction?: string } }[];
}

type SignReadiness = "ready" | "negotiate" | "review" | "not-ready" | "pending";

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
  { value: "OPTIONS_AGREEMENT",     label: "Options Agreement (EMI / CSOP)" },
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
  { value: "MOTOR_PI",       label: "Motor: Personal injury" },
  { value: "MOTOR_PROPERTY", label: "Motor: Property damage" },
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

// ─── Urgency Panel ───────────────────────────────────────────────────────────

type UrgencySignal = typeof MOCK_URGENCY_SIGNALS[number];

function computeUrgencySignals(documents: DocWithRag[]): UrgencySignal[] {
  const signals: UrgencySignal[] = [];
  const completed = documents.filter((d) => d.status === "COMPLETE");

  const escCount = completed.filter((d) =>
    (d.reviewResults ?? []).some((r) => r.escalationRequired && r.feedback?.userAction !== "ESCALATED")
  ).length;

  if (escCount > 0) {
    const names = completed
      .filter((d) => (d.reviewResults ?? []).some((r) => r.escalationRequired && r.feedback?.userAction !== "ESCALATED"))
      .slice(0, 3)
      .map((d) => d.originalName.replace(/\.(pdf|docx?)$/i, ""))
      .join(" · ");
    signals.push({
      id: "esc",
      type: "escalation",
      severity: "red",
      message: `${escCount} unresolved escalation${escCount !== 1 ? "s" : ""} require sign-off`,
      detail: names,
      docId: "",
    });
  }

  const redDocs = completed.filter((d) => (d.reviewResults ?? []).filter((r) => r.ragStatus === "RED").length >= 2);
  if (redDocs.length > 0) {
    signals.push({
      id: "threshold",
      type: "threshold",
      severity: "red",
      message: `${redDocs.length} contract${redDocs.length !== 1 ? "s" : ""} with multiple critical clause failures`,
      detail: redDocs.slice(0, 2).map((d) => d.originalName.replace(/\.(pdf|docx?)$/i, "")).join(" · "),
      docId: "",
    });
  }

  const now = Date.now();
  const renewalDocs = (documents as (DocWithRag & { renewalDate?: string })[]).filter((d) => {
    if (!d.renewalDate) return false;
    const diff = new Date(d.renewalDate).getTime() - now;
    return diff > 0 && diff <= 30 * 24 * 60 * 60 * 1000;
  });
  if (renewalDocs.length > 0) {
    const d = renewalDocs[0] as DocWithRag & { renewalDate: string; counterpartyName?: string };
    const days = Math.ceil((new Date(d.renewalDate).getTime() - now) / (1000 * 60 * 60 * 24));
    signals.push({
      id: "renewal",
      type: "renewal",
      severity: "amber",
      message: `Renewal notice due in ${days} days - ${d.counterpartyName ?? d.originalName.replace(/\.(pdf|docx?)$/i, "")}`,
      detail: "Act before the notice window closes to avoid automatic renewal.",
      docId: "",
    });
  }

  return signals;
}

function UrgencyPanel({ signals }: { signals: UrgencySignal[] }) {
  if (signals.length === 0) return null;

  const SIGNAL_CONFIG = {
    escalation: { icon: AlertTriangle,  color: "#FCA5A5", border: "#450A0A", bg: "#120303" },
    threshold:  { icon: AlertTriangle,  color: "#FCA5A5", border: "#450A0A", bg: "#120303" },
    renewal:    { icon: CalendarClock,  color: "#FCD34D", border: "#431407", bg: "#0D0800" },
    pattern:    { icon: Activity,       color: "#A5B4FC", border: "#312E81", bg: "#0A0915" },
  } as const;

  return (
    <div className="rounded-xl border border-[#2A1A0A] bg-[#0D0906] divide-y divide-[#1E1309]">
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#FCA5A5] animate-pulse" />
        <span className="text-xs font-semibold text-[#FCA5A5]/80 uppercase tracking-wider">
          {signals.filter(s => s.severity === "red").length > 0 ? "Requires attention" : "Operational notice"}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground/40">{signals.length} active</span>
      </div>
      {signals.map((sig) => {
        const cfg = SIGNAL_CONFIG[sig.type] ?? SIGNAL_CONFIG.pattern;
        const Icon = cfg.icon;
        return (
          <div key={sig.id} className="flex items-start gap-3 px-4 py-3">
            <Icon size={13} className="shrink-0 mt-0.5" style={{ color: cfg.color }} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold" style={{ color: cfg.color }}>{sig.message}</div>
              {sig.detail && (
                <div className="text-[11px] text-muted-foreground/50 mt-0.5 truncate">{sig.detail}</div>
              )}
            </div>
            {sig.docId && (
              <a
                href={`/app/legal/review/${sig.docId}`}
                className="text-[10px] font-semibold text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
              >
                View →
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Next best action ─────────────────────────────────────────────────────────

function NextBestAction({ documents, isMock }: { documents: DocWithRag[]; isMock: boolean }) {
  if (isMock) {
    return (
      <a
        href="/app/legal/review/mock-1"
        className="flex items-center gap-4 px-5 py-3.5 rounded-xl border border-[#1B2D4A] hover:border-[#2A4570] transition-colors group"
        style={{ background: "#0C1929" }}
      >
        <div className="w-8 h-8 rounded-lg bg-[#1B2D4A] flex items-center justify-center shrink-0">
          <ArrowRight size={14} className="text-[#60A5FA]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-[#60A5FA]/60 font-semibold mb-0.5">Next action</div>
          <div className="text-sm font-semibold text-foreground truncate">
            Acme Corp MSA - 3 unresolved red clauses, GC sign-off required
          </div>
        </div>
        <div className="text-xs font-semibold text-[#60A5FA] shrink-0 group-hover:translate-x-0.5 transition-transform">
          Review now →
        </div>
      </a>
    );
  }

  const completed = documents.filter((d) => d.status === "COMPLETE");

  // Prioritise: escalation-pending > highest red count
  const withEscalation = completed.filter((d) =>
    (d.reviewResults ?? []).some((r) => r.escalationRequired && r.feedback?.userAction !== "ESCALATED")
  );
  const withRed = completed.filter((d) =>
    (d.reviewResults ?? []).some((r) => r.ragStatus === "RED")
  );

  const priority = withEscalation[0] ?? withRed[0];
  if (!priority) return null;

  const redCount  = (priority.reviewResults ?? []).filter((r) => r.ragStatus === "RED").length;
  const escCount  = (priority.reviewResults ?? []).filter((r) => r.escalationRequired && r.feedback?.userAction !== "ESCALATED").length;
  const detail    = escCount > 0
    ? `${escCount} clause${escCount !== 1 ? "s" : ""} pending escalation`
    : `${redCount} red clause${redCount !== 1 ? "s" : ""} unresolved`;
  const name      = (priority as DocWithRag & { counterpartyName?: string }).counterpartyName
    ? `${(priority as DocWithRag & { counterpartyName?: string }).counterpartyName} - ${detail}`
    : `${priority.originalName.replace(/\.(pdf|docx?)$/i, "")} - ${detail}`;

  return (
    <a
      href={`/app/legal/review/${priority.id}`}
      className="flex items-center gap-4 px-5 py-3.5 rounded-xl border border-[#1B2D4A] hover:border-[#2A4570] transition-colors group"
      style={{ background: "#0C1929" }}
    >
      <div className="w-8 h-8 rounded-lg bg-[#1B2D4A] flex items-center justify-center shrink-0">
        <ArrowRight size={14} className="text-[#60A5FA]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-[#60A5FA]/60 font-semibold mb-0.5">Next action</div>
        <div className="text-sm font-semibold text-foreground truncate">{name}</div>
      </div>
      <div className="text-xs font-semibold text-[#60A5FA] shrink-0 group-hover:translate-x-0.5 transition-transform">
        Review now →
      </div>
    </a>
  );
}

// ─── Processing stages ────────────────────────────────────────────────────────

const PROCESSING_STAGES = [
  { label: "Parsing document",              maxSec: 15  },
  { label: "Anonymising sensitive data",    maxSec: 35  },
  { label: "Identifying clause categories", maxSec: 70  },
  { label: "Comparing against playbook",    maxSec: 130 },
  { label: "Applying regulatory context",   maxSec: 200 },
  { label: "Preparing review report",       maxSec: Infinity },
];

const STATUS_TO_STAGE: Record<string, number> = {
  UPLOADED: 0,
  PARSING: 0,
  ANONYMISING: 1,
  CLASSIFYING: 2,
  COMPARING: 3,
  PROCESSING: 2, // legacy
};

function ReviewProcessingCard({ doc }: { doc: UploadedDocument }) {
  const statusStage = STATUS_TO_STAGE[doc.status] ?? 0;
  const uploadTime = doc.uploadedAt ? new Date(doc.uploadedAt).getTime() : Date.now();
  const elapsedSec = (Date.now() - (isNaN(uploadTime) ? Date.now() : uploadTime)) / 1000;
  const timeIdx = PROCESSING_STAGES.findIndex((s) => elapsedSec < s.maxSec);
  const timeStage = timeIdx === -1 ? PROCESSING_STAGES.length - 1 : timeIdx;
  // Use whichever is further along
  const stageIdx = Math.max(statusStage, timeStage);

  return (
    <div className="card border-[#1C2A3A] shimmer relative overflow-hidden" style={{ background: "#0D1B2A" }}>
      <div className="card-body space-y-3 relative z-10">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-[#93C5FD] truncate">{doc.originalName}</div>
          <span className="flex items-center gap-1 text-[10px] text-[#FCD34D] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FCD34D] animate-pulse" /> Reviewing
          </span>
        </div>
        <div className="space-y-1.5">
          {PROCESSING_STAGES.map((stage, i) => {
            const done    = i < stageIdx;
            const active  = i === stageIdx;
            const pending = i > stageIdx;
            return (
              <div key={stage.label} className="flex items-center gap-2.5">
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-all
                  ${done    ? "bg-[#14532D] border-[#166534]" : ""}
                  ${active  ? "bg-[#1C0F00] border-[#92400E] animate-pulse" : ""}
                  ${pending ? "bg-transparent border-[#1E293B]" : ""}`}>
                  {done && <CheckCircle size={9} className="text-[#86EFAC]" />}
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-[#FCD34D]" />}
                </div>
                <span className={`text-xs leading-none transition-all
                  ${done    ? "text-muted-foreground line-through" : ""}
                  ${active  ? "text-[#FCD34D] font-medium" : ""}
                  ${pending ? "text-muted-foreground/40" : ""}`}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Risk inbox ───────────────────────────────────────────────────────────────

interface RiskInboxProps {
  documents: DocWithRag[];
}

function RiskInbox({ documents }: RiskInboxProps) {
  const completed = documents.filter((d) => d.status === "COMPLETE");

  // RED risk contracts
  const redDocs = completed.filter((d) =>
    (d.reviewResults ?? []).some((r) => r.ragStatus === "RED")
  );

  // Upcoming renewals (within 90 days)
  const now = Date.now();
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;
  const renewalDocs = (documents as (DocWithRag & { renewalDate?: string })[]).filter((d) => {
    if (!d.renewalDate) return false;
    const diff = new Date(d.renewalDate).getTime() - now;
    return diff > 0 && diff <= ninetyDays;
  });

  const hasItems = redDocs.length > 0 || renewalDocs.length > 0;
  if (!hasItems) return null;

  return (
    <div className="card border-[#1E1B4B]" style={{ background: "#0F0E1A" }}>
      <div className="card-body space-y-3">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-[#A5B4FC]" />
          <span className="text-sm font-semibold text-[#C4B5FD]">Risk inbox</span>
        </div>

        {redDocs.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">Red flags open</div>
            {redDocs.slice(0, 3).map((d) => {
              const redCount = (d.reviewResults ?? []).filter((r) => r.ragStatus === "RED").length;
              return (
                <a key={d.id} href={`/app/legal/review/${d.id}`}
                  className="flex items-center justify-between gap-2 text-xs py-1 hover:opacity-80 transition-opacity">
                  <span className="truncate text-foreground/80">{d.originalName}</span>
                  <span className="rag-red shrink-0">{redCount} RED</span>
                </a>
              );
            })}
          </div>
        )}

        {renewalDocs.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">Renewals due</div>
            {renewalDocs.slice(0, 3).map((d) => {
              const daysLeft = Math.ceil((new Date((d as DocWithRag & { renewalDate: string }).renewalDate).getTime() - now) / (1000 * 60 * 60 * 24));
              return (
                <div key={d.id} className="flex items-center justify-between gap-2 text-xs py-1">
                  <span className="truncate text-foreground/80">{d.originalName}</span>
                  <span className="flex items-center gap-1 text-[#FCD34D] shrink-0">
                    <CalendarClock size={10} /> {daysLeft}d
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Approval queue ───────────────────────────────────────────────────────────

function ApprovalQueue({ documents }: { documents: DocWithRag[] }) {
  // Contracts with escalation-required results that haven't had ESCALATED feedback
  const pending = documents.filter((d) =>
    d.status === "COMPLETE" &&
    (d.reviewResults ?? []).some(
      (r) => r.escalationRequired && r.feedback?.userAction !== "ESCALATED"
    )
  );

  if (pending.length === 0) return null;

  return (
    <div className="card border-[#2D1F00]" style={{ background: "#1A1200" }}>
      <div className="card-body space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-[#FCD34D]" />
            <span className="text-sm font-semibold text-[#FCD34D]">Pending approvals</span>
          </div>
          <span className="text-[10px] bg-[#FCD34D]/15 text-[#FCD34D] border border-[#FCD34D]/25 rounded-full px-2 py-0.5 font-semibold">
            {pending.length}
          </span>
        </div>
        <div className="space-y-1.5">
          {pending.slice(0, 4).map((d) => {
            const count = (d.reviewResults ?? []).filter(
              (r) => r.escalationRequired && r.feedback?.userAction !== "ESCALATED"
            ).length;
            return (
              <a
                key={d.id}
                href={`/app/legal/review/${d.id}`}
                className="flex items-center justify-between gap-2 text-xs py-1.5 hover:opacity-80 transition-opacity"
              >
                <span className="truncate text-foreground/80">{d.originalName}</span>
                <span className="text-[#FCD34D] shrink-0 font-medium">{count} clause{count !== 1 ? "s" : ""}</span>
              </a>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
          These contracts have clauses flagged for escalation. Open each to confirm, escalate or dismiss.
        </p>
      </div>
    </div>
  );
}

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
  "ready":     { label: "Ready to sign",   color: "text-[#86EFAC]",        bg: "bg-[#052E16] border-[#14532D]",  icon: CheckCircle },
  "negotiate": { label: "Negotiate first", color: "text-[#FCD34D]",        bg: "bg-[#1C0F00] border-[#431407]",  icon: AlertTriangle },
  "review":    { label: "Review needed",   color: "text-[#FCD34D]",        bg: "bg-[#1C0F00] border-[#431407]",  icon: AlertCircle },
  "not-ready": { label: "Do not sign yet", color: "text-[#FCA5A5]",        bg: "bg-[#1F0A0A] border-[#450A0A]",  icon: AlertTriangle },
  "pending":   { label: "Reviewing…",      color: "text-muted-foreground", bg: "bg-muted border-border",          icon: Clock },
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
        {red   > 0 && <div className="bg-[#FCA5A5]" style={{ width: `${(red / total) * 100}%` }} />}
        {amber > 0 && <div className="bg-[#FCD34D]" style={{ width: `${(amber / total) * 100}%` }} />}
        {green > 0 && <div className="bg-[#86EFAC]" style={{ width: `${(green / total) * 100}%` }} />}
        {grey  > 0 && <div className="bg-[#475569]"   style={{ width: `${(grey / total) * 100}%` }} />}
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
  const [uploadError, setUploadError] = useState<string | null>(null);
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
  const [governingLaw, setGoverningLaw] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");

  // Search / filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRag, setFilterRag] = useState("");
  const [filterType, setFilterType] = useState("");

  // Next Actions expand/collapse
  const [showAllActions, setShowAllActions] = useState(false);

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

  const ACTIVE_STATUSES: DocumentStatus[] = ["PROCESSING", "PARSING", "ANONYMISING", "CLASSIFYING", "COMPARING"];

  const { data: realDocuments = [], error: docsError, refetch: refetchDocs } = useQuery({
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

  // ── Delete state ────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState<{ ids: string[]; name?: string } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      ids.length === 1 ? deleteDocument(ids[0]) : deleteDocuments(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["document-stats"] });
      setDeleteModal(null);
      setSelectedIds(new Set());
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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
    setUploadError(null);
    try {
      const meta = {
        counterpartyName,
        counterpartyType,
        reviewType,
        governingLaw: governingLaw || undefined,
        jurisdiction: jurisdiction || undefined,
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
      setGoverningLaw(""); setJurisdiction("");
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Upload failed";
      const status = e instanceof Error && (e as { status?: number }).status;

      if (msg.includes("413") || status === 413 || msg.toLowerCase().includes("too large") || msg.toLowerCase().includes("50mb") || msg.toLowerCase().includes("20mb")) {
        setUploadError("This file exceeds the 50MB limit. Very large documents like litigation bundles can be split into sections before uploading. Contact support@zanelegal.ai if you need help.");
      } else if (msg.includes("415") || status === 415 || msg.toLowerCase().includes("not supported") || msg.toLowerCase().includes("unsupported")) {
        setUploadError("Zane only accepts PDF and Word documents (.pdf, .docx).\nPlease upload one of these formats.");
      } else if (msg.includes("401")) {
        setUploadError("Your session has expired. Please log in again.");
      } else {
        setUploadError("Upload failed. Please check your connection and try again.");
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

  const useMock = MOCK_MODE && realDocuments.length === 0;
  const documents = useMock ? MOCK_DOCUMENTS : realDocuments;
  const processing = (realDocuments as UploadedDocument[]).some((d) => ACTIVE_STATUSES.includes(d.status));

  // Client-side filtering
  const filteredDocuments = documents.filter((doc) => {
    const d = doc as DocWithRag & { counterpartyName?: string; originalName: string };
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesCounterparty = d.counterpartyName?.toLowerCase().includes(q) ?? false;
      const matchesName = d.originalName?.toLowerCase().includes(q) ?? false;
      if (!matchesCounterparty && !matchesName) return false;
    }
    if (filterRag && !d.reviewResults?.some((r) => r.ragStatus === filterRag)) return false;
    if (filterType && d.contractType !== filterType) return false;
    return true;
  });

  const urgencySignals = useMock
    ? MOCK_URGENCY_SIGNALS
    : computeUrgencySignals(filteredDocuments as DocWithRag[]);

  // ── Next Actions derivation ────────────────────────────────────────────────
  const completedDocs = (realDocuments as UploadedDocument[]).filter((d) => d.status === "COMPLETE");

  const redActionDocs = (completedDocs as (UploadedDocument & DocWithRag)[]).filter((d) =>
    (d.reviewResults ?? []).some((r) => r.ragStatus === "RED")
  );

  const escalationDocs = (completedDocs as (UploadedDocument & DocWithRag)[]).filter((d) =>
    (d.reviewResults ?? []).some((r) => r.escalationRequired && r.feedback?.userAction !== "ESCALATED")
  );

  const now30 = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const renewalActionDocs = (realDocuments as (UploadedDocument & { renewalDate?: string; counterpartyName?: string })[]).filter((d) => {
    if (!d.renewalDate) return false;
    const diff = new Date(d.renewalDate).getTime() - now30;
    return diff > 0 && diff <= thirtyDays;
  });

  const hasActions = redActionDocs.length > 0 || escalationDocs.length > 0 || renewalActionDocs.length > 0;

  // ── Next Actions visibility (max 3 by default) ─────────────────────────────
  const ACTIONS_LIMIT = 3;
  const totalActionCount = (useMock ? 1 : 0) + redActionDocs.length + escalationDocs.length + renewalActionDocs.length;
  const hiddenActionCount = Math.max(0, totalActionCount - ACTIONS_LIMIT);
  let _actionBudget = showAllActions ? Infinity : ACTIONS_LIMIT;
  // Mock item always counts as 1 if shown
  if (!showAllActions && useMock) _actionBudget -= 1;
  const visibleRedDocs    = showAllActions ? redActionDocs    : redActionDocs.slice(0, Math.max(0, _actionBudget));
  _actionBudget -= visibleRedDocs.length;
  const visibleEscDocs    = showAllActions ? escalationDocs   : escalationDocs.slice(0, Math.max(0, _actionBudget));
  _actionBudget -= visibleEscDocs.length;
  const visibleRenewalDocs = showAllActions ? renewalActionDocs : renewalActionDocs.slice(0, Math.max(0, _actionBudget));

  // Last 5 completed for Recent Reviews
  const recentDocs = [...(realDocuments as UploadedDocument[])]
    .filter((d) => d.status === "COMPLETE")
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .slice(0, 5);

  return (
    <>
    <AppLayout>
      <div className="px-6 py-8 max-w-4xl mx-auto space-y-10">

        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {useMock ? "Demo data" : `${company?.name ?? ""}`}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {processing && (
              <span className="text-xs text-[#FCD34D] flex items-center gap-1.5 bg-[#1C0F00] border border-[#431407] rounded-full px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FCD34D] animate-pulse" />
                Review in progress
              </span>
            )}
            <Link
              to="/app/legal/library"
              className="btn-secondary flex items-center gap-1.5 text-sm px-4 py-2"
            >
              <Upload size={14} />
              Upload a contract
            </Link>
          </div>
        </div>

        <PilotNoticeBanner />

        {/* Processing stage cards */}
        {(realDocuments as UploadedDocument[])
          .filter((d) => ACTIVE_STATUSES.includes(d.status))
          .map((d) => (
            <ReviewProcessingCard key={d.id} doc={d} />
          ))}

        {/* ── Section 1: Next Actions ─────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Next Actions</h2>

          {!hasActions && !useMock && (
            <div className="card px-5 py-8 text-center space-y-2">
              <CheckCircle size={22} className="text-[#86EFAC] mx-auto" />
              <div className="text-sm font-medium">No actions required today.</div>
              <div className="text-xs text-muted-foreground">All contracts are up to date.</div>
            </div>
          )}

          {useMock && (
            <a href="/app/legal/review/mock-1"
              className="flex items-start gap-4 px-5 py-4 rounded-xl border border-[#450A0A] bg-[#1A0404] hover:bg-[#200505] transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-[#450A0A] flex items-center justify-center shrink-0">
                <AlertTriangle size={14} className="text-[#FCA5A5]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold uppercase tracking-widest text-[#FCA5A5]/60 mb-0.5">Red clauses — do not sign yet</div>
                <div className="text-sm font-semibold text-foreground">Acme Corp MSA</div>
                <div className="text-xs text-muted-foreground mt-0.5">3 red clauses · GC sign-off required</div>
              </div>
              <span className="text-xs font-semibold text-[#FCA5A5] shrink-0 group-hover:translate-x-0.5 transition-transform">Review now →</span>
            </a>
          )}

          {visibleRedDocs.map((d) => {
            const redCount = (d.reviewResults ?? []).filter((r) => r.ragStatus === "RED").length;
            const cp = (d as UploadedDocument & { counterpartyName?: string }).counterpartyName;
            return (
              <a key={d.id} href={`/app/legal/review/${d.id}`}
                className="flex items-start gap-4 px-5 py-4 rounded-xl border border-[#450A0A] bg-[#1A0404] hover:bg-[#200505] transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-[#450A0A] flex items-center justify-center shrink-0">
                  <AlertTriangle size={14} className="text-[#FCA5A5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold uppercase tracking-widest text-[#FCA5A5]/60 mb-0.5">Red clauses — do not sign yet</div>
                  <div className="text-sm font-semibold text-foreground truncate">{cp ?? d.originalName}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{redCount} red clause{redCount !== 1 ? "s" : ""}</div>
                </div>
                <span className="text-xs font-semibold text-[#FCA5A5] shrink-0 group-hover:translate-x-0.5 transition-transform">Review now →</span>
              </a>
            );
          })}

          {visibleEscDocs.map((d) => {
            const escResults = (d.reviewResults ?? []).filter((r) => r.escalationRequired && r.feedback?.userAction !== "ESCALATED");
            const trigger = escResults[0]?.escalationTrigger ?? "Approval required";
            const cp = (d as UploadedDocument & { counterpartyName?: string }).counterpartyName;
            return (
              <a key={`esc-${d.id}`} href={`/app/legal/review/${d.id}`}
                className="flex items-start gap-4 px-5 py-4 rounded-xl border border-[#431407] bg-[#1A1000] hover:bg-[#201300] transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-[#431407] flex items-center justify-center shrink-0">
                  <Bell size={14} className="text-[#FCD34D]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold uppercase tracking-widest text-[#FCD34D]/60 mb-0.5">Pending escalation</div>
                  <div className="text-sm font-semibold text-foreground truncate">{cp ?? d.originalName}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{trigger}</div>
                </div>
                <span className="text-xs font-semibold text-[#FCD34D] shrink-0 group-hover:translate-x-0.5 transition-transform">Review now →</span>
              </a>
            );
          })}

          {visibleRenewalDocs.map((d) => {
            const daysLeft = Math.ceil((new Date(d.renewalDate!).getTime() - now30) / (1000 * 60 * 60 * 24));
            return (
              <a key={`ren-${d.id}`} href={`/app/legal/review/${d.id}`}
                className="flex items-start gap-4 px-5 py-4 rounded-xl border border-[#1B2D4A] bg-[#0C1929] hover:bg-[#0F1E35] transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-[#1B2D4A] flex items-center justify-center shrink-0">
                  <CalendarClock size={14} className="text-[#60A5FA]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold uppercase tracking-widest text-[#60A5FA]/60 mb-0.5">Renewal window closing</div>
                  <div className="text-sm font-semibold text-foreground truncate">{d.counterpartyName ?? d.originalName}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{daysLeft} days remaining</div>
                </div>
                <span className="text-xs font-semibold text-[#60A5FA] shrink-0 group-hover:translate-x-0.5 transition-transform">Review now →</span>
              </a>
            );
          })}

          {/* See all / collapse */}
          {!showAllActions && hiddenActionCount > 0 && (
            <button
              onClick={() => setShowAllActions(true)}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-2.5 rounded-lg border border-border hover:border-foreground/20 transition-colors"
            >
              See all actions ({hiddenActionCount} more)
            </button>
          )}
          {showAllActions && totalActionCount > ACTIONS_LIMIT && (
            <button
              onClick={() => setShowAllActions(false)}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
            >
              Show fewer
            </button>
          )}
        </div>

        {/* ── Section 2: Executive Overview ──────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Contracts reviewed this month",
                value: stats ? stats.totalContracts.toString() : "-",
                highlight: false,
              },
              {
                label: "Escalations open",
                value: escalationDocs.length > 0 ? escalationDocs.length.toString() : (stats ? (stats as { escalationsOpen?: number }).escalationsOpen?.toString() ?? "0" : "0"),
                highlight: escalationDocs.length > 0,
              },
              {
                label: "Value at risk from red clauses",
                value: stats && (stats as { valueAtRisk?: { RED?: number } }).valueAtRisk?.RED
                  ? `£${(((stats as unknown as { valueAtRisk: { RED: number } }).valueAtRisk.RED) / 1000).toFixed(0)}k`
                  : "£0",
                highlight: !!(stats && (stats as { valueAtRisk?: { RED?: number } }).valueAtRisk?.RED),
              },
              {
                label: "Renewals due in 90 days",
                value: stats ? (stats.renewalsDue ?? 0).toString() : "0",
                highlight: false,
              },
            ].map((s) => (
              <div key={s.label} className="card px-4 py-4 space-y-1">
                <div className={`text-2xl font-bold ${s.highlight ? "text-[#FCA5A5]" : ""}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground leading-snug">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 3: Recent Reviews ───────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recent Reviews</h2>
            <Link to="/app/legal/library" className="text-xs text-primary hover:opacity-80 transition-opacity">View all →</Link>
          </div>

          <div className="card">
            {docsError ? (
              <div className="card-body text-center py-8">
                <AlertCircle size={24} className="text-[#FCA5A5] mx-auto mb-2" />
                <p className="text-sm text-[#FCA5A5]">Contracts could not be loaded.</p>
                <button className="text-xs text-[#FCA5A5]/70 underline mt-1" onClick={() => void refetchDocs()}>Retry</button>
              </div>
            ) : recentDocs.length === 0 && !useMock ? (
              <div className="card-body text-center py-12">
                <FileText size={32} className="text-muted-foreground/30 mx-auto mb-3" />
                <div className="text-sm font-medium text-muted-foreground">No contracts reviewed yet</div>
                <div className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
                  Go to <Link to="/app/legal/library" className="text-primary underline">Library</Link> to upload your first contract.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-card-border">
                {(useMock ? filteredDocuments.slice(0, 5) : recentDocs).map((doc) => {
                  const results = (doc as DocWithRag).reviewResults ?? [];
                  const readiness = doc.status === "COMPLETE" ? getSignReadiness(results) : "pending";
                  const { label: readinessLabel, color: readinessColor, bg: readinessBg, icon: ReadinessIcon } = READINESS_CONFIG[readiness];
                  const isClickable = doc.status === "COMPLETE" && (!useMock || doc.id === "mock-1");
                  const red   = results.filter((r) => r.ragStatus === "RED").length;
                  const amber = results.filter((r) => r.ragStatus === "AMBER").length;
                  const docWithMeta = doc as DocWithRag & { counterpartyName?: string; contractValue?: number; lastError?: string };
                  const isStuck = ACTIVE_STATUSES.includes(doc.status as DocumentStatus) &&
                    doc.uploadedAt &&
                    (Date.now() - new Date(doc.uploadedAt).getTime()) > 10 * 60 * 1000;

                  return (
                    <div key={doc.id} className="group">
                      <div
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
                              <span className="ml-2 text-xs font-normal text-muted-foreground">· {docWithMeta.counterpartyName}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground">{doc.contractType.replace(/_/g, " ")}</span>
                            <span className="text-xs text-muted-foreground">{formatDateShort(doc.uploadedAt)}</span>
                            {doc.status === "COMPLETE" && results.length > 0 && <MiniRagBar results={results} />}
                          </div>
                        </div>
                        {doc.status === "COMPLETE" && results.length > 0 && (
                          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                            {red   > 0 && <span className="rag-red">{red} RED</span>}
                            {amber > 0 && <span className="rag-amber">{amber} AMBER</span>}
                            {red === 0 && amber === 0 && <span className="rag-green">All clear</span>}
                          </div>
                        )}
                        <div className={`hidden md:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border shrink-0 ${readinessBg} ${readinessColor}`}>
                          <ReadinessIcon size={12} />
                          {readinessLabel}
                        </div>
                        {isStuck ? (
                          <div className="text-xs text-[#FCA5A5] text-right shrink-0">
                            <div>Stuck</div>
                            <button className="text-[10px] underline" onClick={(e) => { e.stopPropagation(); reviewMutation.mutate(doc.id); }}>Retry</button>
                          </div>
                        ) : ACTIVE_STATUSES.includes(doc.status as DocumentStatus) ? (
                          <span className="flex items-center gap-1 text-xs text-[#FCD34D] shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FCD34D] animate-pulse" /> Reviewing
                          </span>
                        ) : null}
                        {doc.status === "FAILED" && (
                          <button className="btn-ghost text-xs px-2 py-1 gap-1 shrink-0"
                            onClick={(e) => { e.stopPropagation(); reviewMutation.mutate(doc.id); }}>
                            <RotateCcw size={12} /> Retry
                          </button>
                        )}
                        {isClickable && <ChevronRight size={15} className="text-muted-foreground shrink-0" />}
                        {!useMock && (
                          <button onClick={(e) => { e.stopPropagation(); setDeleteModal({ ids: [doc.id], name: doc.originalName }); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-[#450A0A]/60 text-muted-foreground hover:text-[#FCA5A5] shrink-0"
                            title="Delete">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {doc.status === "FAILED" && (
                        <div className="px-5 pb-3">
                          <p className="text-[11px] text-[#FCA5A5]/70 leading-relaxed">
                            {docWithMeta.lastError ? formatLastError(docWithMeta.lastError) : "Review failed. Please retry."}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </AppLayout>

    {/* Delete confirmation modal: rendered outside AppLayout so it overlays everything */}
    {deleteModal && (
      <DeleteConfirmModal
        count={deleteModal.ids.length}
        name={deleteModal.name}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteModal.ids)}
        onCancel={() => setDeleteModal(null)}
      />
    )}
    </>
  );
}
