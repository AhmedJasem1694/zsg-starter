/**
 * DocumentFirstDashboard
 *
 * Shown to authenticated users who have not yet completed onboarding.
 * Instead of forcing them through a configuration wizard first, they can
 * drag-and-drop a contract immediately. Zane extracts metadata, asks only
 * the three fields we can't infer from the document, then runs the review.
 */

import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, ChevronDown } from "lucide-react";
import { ZaneLogo } from "../components/ZaneLogo";
import {
  uploadDocument,
  extractDocumentMetadata,
  quickSetup,
  startReview,
  type ExtractedDocumentMetadata,
} from "../lib/api";
import type { RiskAppetite, Persona } from "../lib/types";

// ── Contract-type label map (subset for display) ──────────────────────────────
const CONTRACT_TYPE_LABELS: Record<string, string> = {
  SUPPLIER_AGREEMENT:    "Supplier Agreement",
  CUSTOMER_AGREEMENT:    "Customer Agreement",
  MSA:                   "Master Services Agreement",
  NDA:                   "Non-Disclosure Agreement",
  SaaS_AGREEMENT:        "SaaS / Software Licence",
  PROFESSIONAL_SERVICES: "Professional Services Agreement",
  EMPLOYMENT:            "Employment Agreement",
  CONTRACTOR_AGREEMENT:  "Contractor / Consultancy Agreement",
  IP_LICENSE_AGREEMENT:  "IP Licence Agreement",
  JV_AGREEMENT:          "Joint Venture Agreement",
  SHARE_PURCHASE:        "Share Purchase Agreement",
  COMMERCIAL_LEASE:      "Commercial Lease",
  LOAN_AGREEMENT:        "Loan / Facility Agreement",
  DISTRIBUTION_AGREEMENT:"Distribution Agreement",
  OTHER:                 "Other",
};

// ── Stage machine ─────────────────────────────────────────────────────────────
type Stage =
  | "idle"          // drop zone visible, no file yet
  | "uploading"     // file is being sent to server
  | "extracting"    // LLM extracting metadata
  | "persona"       // persona picker modal
  | "confirm"       // minimal 3-field confirmation (CORPORATE path)
  | "setting-up"    // quick-setup + review trigger in progress
  | "error";

const SECTOR_OPTIONS = [
  "Technology & SaaS",
  "Financial Services & FinTech",
  "Healthcare & Life Sciences",
  "Professional Services",
  "Manufacturing & Supply Chain",
  "Retail & eCommerce",
  "Media & Entertainment",
  "Energy & CleanTech",
  "Education & EdTech",
  "Logistics, Freight & Supply Chain",
  "Gaming & Interactive Entertainment",
  "Legal Services",
  "Property & Real Estate",
  "Other",
];

const BG   = "#0B1020";
const CARD = "#0F172A";

// ── Component ─────────────────────────────────────────────────────────────────
export default function DocumentFirstDashboard() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const [stage,       setStage]     = useState<Stage>("idle");
  const [dragOver,    setDragOver]  = useState(false);
  const [errorMsg,    setErrorMsg]  = useState("");
  const [docId,       setDocId]     = useState<string | null>(null);
  const [extracted,   setExtracted] = useState<ExtractedDocumentMetadata>({});
  const [persona,     setPersona]   = useState<Persona>("CORPORATE");

  // Minimal form state
  const [companyName,  setCompanyName]  = useState("");
  const [sector,       setSector]       = useState(SECTOR_OPTIONS[0]);
  const [riskAppetite, setRiskAppetite] = useState<RiskAppetite>("MODERATE");

  const inputRef = useRef<HTMLInputElement>(null);

  // ── File handling ─────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx", "doc"].includes(ext ?? "")) {
      setErrorMsg("Only PDF and DOCX files are supported.");
      setStage("error");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg("This file exceeds the 50MB limit. Very large documents like litigation bundles can be split into sections before uploading. Contact support@zanelegal.ai if you need help.");
      setStage("error");
      return;
    }

    setStage("uploading");
    setErrorMsg("");

    try {
      // Upload without contract metadata — we'll fill it in after extraction
      const doc = await uploadDocument(file, "SUPPLIER_AGREEMENT");
      setDocId(doc.id);

      // Extract metadata from the uploaded file
      setStage("extracting");
      const meta = await extractDocumentMetadata(doc.id).catch(() => ({}));
      setExtracted(meta);

      // Pre-fill company name from counterparty if we know we're buying
      // (leave blank — user fills in their own company name, not counterparty)

      // Show persona picker first
      setStage("persona");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Upload failed. Please try again.");
      setStage("error");
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  // ── Persona selection → route to correct next step ────────────────────────
  function handlePersonaSelect(chosen: Persona) {
    setPersona(chosen);
    if (chosen === "FOUNDER") {
      // Founder skips all config — run immediately with market defaults
      void runFounderSetup(chosen);
    } else {
      setStage("confirm");
    }
  }

  async function runFounderSetup(chosenPersona: Persona) {
    setStage("setting-up");
    try {
      const result = await quickSetup({
        companyName: "My Company",
        sector: "Technology & SaaS",
        riskAppetite: "MODERATE",
        persona: chosenPersona,
        pendingDocumentId: docId!,
      });

      // Invalidate company cache so App routing re-evaluates
      await queryClient.invalidateQueries({ queryKey: ["company"] });

      if (result.documentId) {
        await startReview(result.documentId);
        navigate(`/app/founder/review/${result.documentId}`);
      } else {
        navigate("/app/founder/dashboard");
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Setup failed. Please try again.");
      setStage("error");
    }
  }

  async function handleConfirm() {
    if (!companyName.trim()) return;
    setStage("setting-up");
    try {
      const result = await quickSetup({
        companyName: companyName.trim(),
        sector,
        riskAppetite,
        persona,
        pendingDocumentId: docId!,
      });

      await queryClient.invalidateQueries({ queryKey: ["company"] });

      if (result.documentId) {
        await startReview(result.documentId);
        navigate(`/app/legal/review/${result.documentId}`);
      } else {
        navigate("/app/legal/dashboard");
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Setup failed. Please try again.");
      setStage("error");
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const detectedContractLabel =
    extracted.contract_type && CONTRACT_TYPE_LABELS[extracted.contract_type]
      ? CONTRACT_TYPE_LABELS[extracted.contract_type]
      : extracted.contract_type ?? null;

  const hasAnyExtracted = !!(
    extracted.contract_type ||
    extracted.counterparty_name ||
    extracted.governing_law ||
    extracted.contract_value
  );

  // ── Drop zone ─────────────────────────────────────────────────────────────
  if (stage === "idle" || stage === "error") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{ background: BG }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="w-full max-w-lg space-y-8">
          <div className="flex flex-col items-center gap-3">
            <ZaneLogo size="md" light />
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Drop your contract to get started
              </h1>
              <p className="text-white/45 text-sm mt-1 leading-relaxed max-w-xs">
                Zane reviews it and gives you Red / Amber / Green output in under 90 seconds. No configuration required.
              </p>
            </div>
          </div>

          {/* Drop zone */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`w-full rounded-2xl border-2 border-dashed p-12 flex flex-col items-center gap-4 transition-all cursor-pointer ${
              dragOver
                ? "border-primary bg-primary/10 scale-[1.01]"
                : "border-white/15 hover:border-white/30 hover:bg-white/3"
            }`}
          >
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${dragOver ? "bg-primary/20" : "bg-white/8"}`}>
              <Upload size={26} className={dragOver ? "text-primary" : "text-white/50"} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white/80">
                {dragOver ? "Release to upload" : "Drag & drop or click to upload"}
              </p>
              <p className="text-xs text-white/35 mt-1">PDF or DOCX · max 50 MB</p>
            </div>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.doc"
            className="hidden"
            onChange={onFileChange}
          />

          {stage === "error" && errorMsg && (
            <div className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/25 px-4 py-3 text-sm text-red-400">
              <AlertCircle size={15} className="shrink-0" />
              {errorMsg}
            </div>
          )}

          <p className="text-center text-xs text-white/25">
            Already have an account?{" "}
            <button onClick={() => navigate("/onboarding")} className="text-white/45 hover:text-white/70 underline underline-offset-2 transition-colors">
              Set up manually →
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Processing spinners ───────────────────────────────────────────────────
  if (stage === "uploading" || stage === "extracting" || stage === "setting-up") {
    const messages: Record<string, string> = {
      uploading:    "Uploading document…",
      extracting:   "Extracting contract details…",
      "setting-up": "Setting up your account and starting review…",
    };
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ background: BG }}>
        <ZaneLogo size="md" light />
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={36} className="text-primary animate-spin" />
          <p className="text-white/60 text-sm font-medium">{messages[stage]}</p>
          {stage === "setting-up" && (
            <p className="text-white/30 text-xs max-w-xs text-center">
              This takes about 30–90 seconds. We're running the full review pipeline now.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Persona picker ────────────────────────────────────────────────────────
  if (stage === "persona") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: BG }}>
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center gap-3">
            <ZaneLogo size="sm" light />
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <CheckCircle size={15} />
              Document uploaded successfully
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight text-center">
              What best describes you?
            </h2>
          </div>

          <div className="space-y-3">
            {[
              {
                persona: "FOUNDER" as Persona,
                icon: "🚀",
                title: "Founder reviewing a contract",
                sub: "Investment terms, commercial deals, or growth contracts. Plain-English output, no config needed.",
                badge: "Fastest — review in 60 seconds",
                badgeColor: "text-primary border-primary/30 bg-primary/10",
              },
              {
                persona: "CORPORATE" as Persona,
                icon: "🏛️",
                title: "In-house legal team",
                sub: "Review counterparty paper against your playbook. Flag deviations, produce fallback language.",
                badge: "",
                badgeColor: "",
              },
              {
                persona: "CORPORATE" as Persona,
                icon: "🤔",
                title: "Not sure",
                sub: "Zane will use sensible defaults and you can configure later.",
                badge: "",
                badgeColor: "",
                isNotSure: true,
              },
            ].map((opt) => (
              <button
                key={opt.title}
                type="button"
                onClick={() => handlePersonaSelect(opt.persona)}
                className="w-full text-left rounded-2xl border border-white/10 p-5 hover:border-primary/40 hover:bg-primary/5 transition-all"
                style={{ background: CARD }}
              >
                <div className="flex items-start gap-4">
                  <span className="text-2xl mt-0.5 shrink-0">{opt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{opt.title}</span>
                      {opt.badge && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${opt.badgeColor}`}>
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/45 mt-1 leading-relaxed">{opt.sub}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <p className="text-center text-xs text-white/25">
            You can always refine your setup from the settings page.
          </p>
        </div>
      </div>
    );
  }

  // ── Minimal 3-field confirmation (CORPORATE path) ─────────────────────────
  if (stage === "confirm") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: BG }}>
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center gap-2">
            <ZaneLogo size="sm" light />
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <CheckCircle size={15} />
              Document uploaded
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight text-center">
              Almost there — just three details
            </h2>
            <p className="text-white/40 text-xs text-center">
              We need your company info to compare this contract against market standards.
            </p>
          </div>

          {/* Detected metadata banner */}
          {hasAnyExtracted && (
            <div className="rounded-xl border border-[#1E3A5F] bg-[#0D1B2A] px-4 py-3 space-y-2">
              <p className="text-[11px] font-semibold text-[#60A5FA] uppercase tracking-widest">
                Zane detected from your document
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {detectedContractLabel && (
                  <div>
                    <span className="text-[10px] text-white/30">Contract type</span>
                    <p className="text-xs text-white/70 font-medium">{detectedContractLabel}</p>
                  </div>
                )}
                {extracted.counterparty_name && (
                  <div>
                    <span className="text-[10px] text-white/30">Counterparty</span>
                    <p className="text-xs text-white/70 font-medium">{extracted.counterparty_name}</p>
                  </div>
                )}
                {extracted.governing_law && (
                  <div>
                    <span className="text-[10px] text-white/30">Governing law</span>
                    <p className="text-xs text-white/70 font-medium">{extracted.governing_law}</p>
                  </div>
                )}
                {extracted.contract_value && (
                  <div>
                    <span className="text-[10px] text-white/30">Contract value</span>
                    <p className="text-xs text-white/70 font-medium">
                      {extracted.currency ?? ""}
                      {extracted.contract_value.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3 fields */}
          <div className="rounded-xl border border-white/10 p-5 space-y-5" style={{ background: CARD }}>
            {/* Company name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
                Your company name *
              </label>
              <input
                type="text"
                placeholder="Acme Ltd"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoFocus
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-primary/60 transition-colors"
              />
            </div>

            {/* Sector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
                Industry / sector
              </label>
              <div className="relative">
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/60 appearance-none transition-colors"
                >
                  {SECTOR_OPTIONS.map((s) => (
                    <option key={s} value={s} className="bg-[#0F172A]">{s}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              </div>
            </div>

            {/* Risk appetite */}
            <div className="space-y-2.5">
              <label className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
                Risk appetite
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["CONSERVATIVE", "MODERATE", "COMMERCIAL"] as RiskAppetite[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRiskAppetite(r)}
                    className={`rounded-lg py-2 text-xs font-semibold transition-all border ${
                      riskAppetite === r
                        ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                        : "bg-white/5 border-white/10 text-white/50 hover:border-white/25 hover:text-white/70"
                    }`}
                  >
                    {r === "CONSERVATIVE" ? "Conservative" : r === "MODERATE" ? "Balanced" : "Commercial"}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-white/25">
                {riskAppetite === "CONSERVATIVE"
                  ? "Tighter caps, longer obligations — protects against downside risk."
                  : riskAppetite === "MODERATE"
                  ? "Market-standard positions across all clause categories."
                  : "More flexibility for deal-doing — lower caps, shorter obligations."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { void handleConfirm(); }}
            disabled={!companyName.trim()}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-30 disabled:pointer-events-none shadow-lg shadow-primary/25"
          >
            Review my contract →
          </button>

          <p className="text-center text-xs text-white/25">
            Zane will run the full review immediately. Results in ~60 seconds.
          </p>

          {errorMsg && (
            <div className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/25 px-4 py-3 text-sm text-red-400">
              <AlertCircle size={15} className="shrink-0" />
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
