import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, AlertCircle, Upload, Trash2, Lock, Shield } from "lucide-react";
import {
  getLitigationIntake, saveLitigationIntake,
  getAncillaryDocuments, uploadAncillaryDocument, deleteAncillaryDocument,
} from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import type { AncillaryDocumentData } from "../lib/types";

// ─── Hard stop questions ───────────────────────────────────────────────────────

const HARD_STOP_QUESTIONS = [
  {
    id: "q1_policy_valid",
    question: "Is there a valid policy in force at the date of the alleged loss/incident?",
    options: ["Yes", "No", "Uncertain"],
    failureValues: ["No"],
    failureMessage: "Coverage issue identified. Assessment paused — GC escalation required before proceeding.",
    warningValues: ["Uncertain"],
    warningMessage: "Policy validity is uncertain. Obtain confirmation before proceeding.",
  },
  {
    id: "q2_notification",
    question: "Has the insured notified within the policy notification period?",
    options: ["Yes", "No", "Late — after period expired"],
    failureValues: ["No", "Late — after period expired"],
    failureMessage: "Notification defence identified. Assess strength of defence before proceeding.",
    isSoftStop: true,
  },
  {
    id: "q3_class_of_business",
    question: "Does the claim fall within the class of business covered by the policy?",
    options: ["Yes", "No", "Arguable"],
    failureValues: ["No"],
    failureMessage: "Non-coverage issue. Coverage opinion required before assessment can proceed.",
    warningValues: ["Arguable"],
    warningMessage: "Coverage is arguable. Obtain counsel's opinion on coverage position.",
  },
  {
    id: "q4_indemnity_limit",
    question: "Is the claim value within the policy indemnity limit?",
    options: ["Yes", "No — exceeds limit", "Uncertain — quantum not yet established"],
    failureValues: [] as string[],
    warningValues: ["No — exceeds limit"],
    warningMessage: "Claim may exceed policy limit. Notify excess layer insurer immediately.",
  },
  {
    id: "q5_fraud",
    question: "Are there any fraud or misrepresentation indicators?",
    options: ["No", "Yes — fraud suspected", "Yes — misrepresentation suspected"],
    failureValues: ["Yes — fraud suspected", "Yes — misrepresentation suspected"],
    failureMessage: "Fraud / misrepresentation indicator identified. Hard stop — refer to Special Investigations Unit immediately. Do not make any admission or interim payment.",
    isHardStop: true,
  },
  {
    id: "q6_fca_acknowledgment",
    question: "Has the FCA acknowledgment timeframe been met? (Typically 5 working days from receipt)",
    options: ["Yes", "No — timeframe not met", "Not yet received"],
    failureValues: ["No — timeframe not met"],
    failureMessage: "FCA acknowledgment timeframe breach. Regulatory compliance action required within 24 hours. Notify Compliance.",
    isSoftStop: true,
  },
  {
    id: "q7_fos",
    question: "Is there any FOS referral or complaint already lodged?",
    options: ["No", "Yes — FOS referral", "Yes — complaint only"],
    failureValues: [] as string[],
    warningValues: ["Yes — FOS referral", "Yes — complaint only"],
    warningMessage: "FOS jurisdiction applies. Assessment will include FOS jurisdiction and DISP compliance analysis.",
  },
  {
    id: "q8_vulnerable",
    question: "Is the claimant a vulnerable customer?",
    options: ["No", "Yes", "Unknown — treat as vulnerable"],
    failureValues: [] as string[],
    warningValues: ["Yes", "Unknown — treat as vulnerable"],
    warningMessage: "Enhanced TCF obligations apply throughout this assessment and all outputs.",
  },
];

// ─── Defence questions ─────────────────────────────────────────────────────────

const PRIMARY_DEFENCES = [
  "Causation disputed",
  "Contributory negligence",
  "Exclusion clause applies",
  "Policy condition breach",
  "Fraud / misrepresentation",
  "Limitation / time bar",
  "Jurisdiction / choice of law",
  "Third party liability",
  "Act of God / force majeure",
  "No loss / quantum disputed",
  "Other",
];

const LIABILITY_ADMISSION_OPTIONS = ["No admission", "Partial admission of liability", "Full admission of liability"];
const WITNESS_OPTIONS = ["Strong — credible witnesses available", "Adequate", "Weak", "None"];
const EVIDENCE_OPTIONS = ["Complete — all documents preserved", "Minor gaps identified", "Significant gaps"];
const EXPERT_OPTIONS = ["Yes — expert report obtained", "Yes — expert to be instructed", "No — not yet instructed", "Not required"];
const PROCEDURAL_STAGES = [
  "Pre-action (letter of claim received)",
  "Pre-action protocol ongoing",
  "Proceedings issued",
  "Directions / case management",
  "Trial listed",
  "Appeal",
  "Settlement negotiation only",
  "FOS referral",
];

// ─── File type helpers ─────────────────────────────────────────────────────────

function getFileIcon(fileType: string) {
  if (fileType === "AUDIO") return "🎵";
  if (fileType === "VIDEO") return "🎬";
  if (fileType === "IMAGE") return "🖼";
  return "📄";
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LitigationIntake() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [currentStage, setCurrentStage] = useState(1);
  const [hardStopAnswers, setHardStopAnswers] = useState<Record<string, string>>({});
  const [hardStopBlocked, setHardStopBlocked] = useState<string | null>(null);
  const [defenceAnswers, setDefenceAnswers] = useState<{
    primaryDefences: string[];
    liabilityAdmission: string;
    claimedValue: string;
    quantumLow: string;
    quantumMid: string;
    quantumHigh: string;
    currentReserve: string;
    trialCostEstimate: string;
    witnessStrength: string;
    evidenceCompleteness: string;
    expertEvidence: string;
    proceduralStage: string;
    upcomingDeadlines: string;
    additionalNotes: string;
  }>({
    primaryDefences: [],
    liabilityAdmission: "",
    claimedValue: "",
    quantumLow: "",
    quantumMid: "",
    quantumHigh: "",
    currentReserve: "",
    trialCostEstimate: "",
    witnessStrength: "",
    evidenceCompleteness: "",
    expertEvidence: "",
    proceduralStage: "",
    upcomingDeadlines: "",
    additionalNotes: "",
  });

  const [ancillaryUploading, setAncillaryUploading] = useState(false);
  const [privilegeModalFile, setPrivilegeModalFile] = useState<File | null>(null);
  const ancillaryInputRef = useRef<HTMLInputElement>(null);

  // Load existing intake on mount (in case of page refresh)
  useQuery({
    queryKey: ["litigation-intake", id],
    queryFn: () => getLitigationIntake(id!),
    enabled: !!id,
  });

  const { data: ancillaryDocs = [] } = useQuery({
    queryKey: ["ancillary", id],
    queryFn: () => getAncillaryDocuments(id!),
    enabled: currentStage === 3,
    refetchInterval: (query) => {
      const docs = query.state.data as AncillaryDocumentData[] | undefined;
      const needsPoll = docs?.some(
        (d) => (d.fileType === "AUDIO" || d.fileType === "VIDEO") && !d.transcription
      );
      return needsPoll ? 5000 : false;
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: Parameters<typeof saveLitigationIntake>[1]) =>
      saveLitigationIntake(id!, data),
  });

  // ── Stage 1 logic ─────────────────────────────────────────────────────────────

  function getHardStopStatus(questionId: string, answer: string) {
    const q = HARD_STOP_QUESTIONS.find((hq) => hq.id === questionId);
    if (!q || !answer) return null;
    if (q.failureValues?.includes(answer)) {
      return { type: q.isHardStop ? "block" : "warn", message: q.failureMessage ?? "" };
    }
    if (q.warningValues?.includes(answer)) {
      return { type: "info", message: q.warningMessage ?? "" };
    }
    return null;
  }

  function handleStage1Answer(questionId: string, answer: string) {
    const newAnswers = { ...hardStopAnswers, [questionId]: answer };
    setHardStopAnswers(newAnswers);

    const q = HARD_STOP_QUESTIONS.find((hq) => hq.id === questionId);
    if (q?.isHardStop && q.failureValues?.includes(answer)) {
      setHardStopBlocked(q.failureMessage ?? "Hard stop triggered.");
    } else {
      setHardStopBlocked(null);
    }
  }

  async function proceedFromStage1() {
    const fraudAnswer = hardStopAnswers["q5_fraud"];
    const q5 = HARD_STOP_QUESTIONS.find((q) => q.id === "q5_fraud");
    if (q5 && fraudAnswer && q5.failureValues.includes(fraudAnswer)) {
      setHardStopBlocked(q5.failureMessage ?? "");
      return;
    }

    const fcaAnswer = hardStopAnswers["q6_fca_acknowledgment"];
    const fcaBreach = fcaAnswer === "No — timeframe not met";
    const vulnerableAnswer = hardStopAnswers["q8_vulnerable"];
    const vulnerableCustomer = vulnerableAnswer === "Yes" || vulnerableAnswer === "Unknown — treat as vulnerable";

    await saveMutation.mutateAsync({
      stage: 2,
      hardStopData: JSON.stringify(hardStopAnswers),
      hardStopPassed: true,
      fcaBreach,
      vulnerableCustomer,
      fraudFlag: false,
    });
    setCurrentStage(2);
  }

  // ── Stage 2 logic ─────────────────────────────────────────────────────────────

  async function proceedFromStage2() {
    await saveMutation.mutateAsync({
      stage: 3,
      defenceData: JSON.stringify(defenceAnswers),
    });
    setCurrentStage(3);
  }

  // ── Stage 3 logic ─────────────────────────────────────────────────────────────

  function handleAncillaryFileSelected(file: File) {
    setPrivilegeModalFile(file);
  }

  async function uploadWithPrivilege(privileged: boolean) {
    if (!privilegeModalFile) return;
    setAncillaryUploading(true);
    try {
      await uploadAncillaryDocument(id!, privilegeModalFile, privileged);
      await queryClient.invalidateQueries({ queryKey: ["ancillary", id] });
    } catch (e) {
      console.error(e);
    } finally {
      setAncillaryUploading(false);
      setPrivilegeModalFile(null);
    }
  }

  async function handleDeleteAncillary(ancillaryId: string) {
    await deleteAncillaryDocument(ancillaryId);
    await queryClient.invalidateQueries({ queryKey: ["ancillary", id] });
  }

  async function completeIntake() {
    await saveMutation.mutateAsync({ stage: 4, complete: true });
    navigate(`/review/${id}`);
  }

  const allStage1Answered = HARD_STOP_QUESTIONS.every((q) => hardStopAnswers[q.id]);

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <button
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3"
            onClick={() => navigate("/dashboard")}
          >
            &larr; Back to dashboard
          </button>
          <h1 className="text-2xl font-semibold">Litigation intake</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete all three stages before MIKE can assess coverage and exposure.
          </p>
        </div>

        {/* Stage progress */}
        <div className="flex items-center gap-2">
          {[
            { n: 1, label: "Hard stops" },
            { n: 2, label: "Defence & exposure" },
            { n: 3, label: "Ancillary documents" },
          ].map((s, i) => (
            <div key={s.n} className={`flex items-center gap-2 flex-1 ${i < 2 ? "after:content-[''] after:flex-1 after:h-px after:bg-border" : ""}`}>
              <div
                className={`flex items-center gap-1.5 shrink-0 ${
                  currentStage > s.n ? "text-emerald-600" : currentStage === s.n ? "text-primary font-semibold" : "text-muted-foreground"
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                  currentStage > s.n ? "bg-emerald-100 border-emerald-300 text-emerald-700" :
                  currentStage === s.n ? "bg-primary text-primary-foreground border-primary" :
                  "bg-muted border-border text-muted-foreground"
                }`}>
                  {currentStage > s.n ? "✓" : s.n}
                </div>
                <span className="text-xs hidden sm:block">{s.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── STAGE 1 ─────────────────────────────────────────────────────── */}
        {currentStage === 1 && (
          <div className="space-y-4">
            <div className="card border-amber-200 bg-amber-50 p-4 flex gap-3">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Answer all 8 questions before proceeding. If any hard stop fires, MIKE will pause and tell you what action is required.
              </p>
            </div>

            {HARD_STOP_QUESTIONS.map((q, idx) => {
              const answer = hardStopAnswers[q.id];
              const status = answer ? getHardStopStatus(q.id, answer) : null;
              return (
                <div key={q.id} className="card p-5 space-y-3">
                  <div className="text-sm font-semibold">
                    <span className="text-muted-foreground mr-2">Q{idx + 1}.</span>
                    {q.question}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleStage1Answer(q.id, opt)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          answer === opt
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border hover:border-primary/60 text-foreground"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  {status && (
                    <div className={`flex gap-2 p-3 rounded-lg text-xs ${
                      status.type === "block" ? "bg-red-50 border border-red-200 text-red-800" :
                      status.type === "warn" ? "bg-amber-50 border border-amber-200 text-amber-800" :
                      "bg-blue-50 border border-blue-200 text-blue-800"
                    }`}>
                      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                      {status.message}
                    </div>
                  )}
                </div>
              );
            })}

            {hardStopBlocked && (
              <div className="card border-red-300 bg-red-50 p-5 space-y-2">
                <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
                  <AlertTriangle size={16} />
                  Hard stop — assessment paused
                </div>
                <p className="text-xs text-red-700">{hardStopBlocked}</p>
              </div>
            )}

            <button
              className="btn-primary w-full"
              disabled={!allStage1Answered || !!hardStopBlocked || saveMutation.isPending}
              onClick={() => void proceedFromStage1()}
            >
              {saveMutation.isPending ? "Saving…" : "Proceed to Stage 2 — Defence & Exposure"}
            </button>
          </div>
        )}

        {/* ── STAGE 2 ─────────────────────────────────────────────────────── */}
        {currentStage === 2 && (
          <div className="space-y-4">
            {/* Primary defence */}
            <div className="card p-5 space-y-3">
              <div className="text-sm font-semibold">What is the primary defence to liability? (Select all that apply)</div>
              <div className="flex flex-wrap gap-2">
                {PRIMARY_DEFENCES.map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      const current = defenceAnswers.primaryDefences;
                      setDefenceAnswers({
                        ...defenceAnswers,
                        primaryDefences: current.includes(d)
                          ? current.filter((x) => x !== d)
                          : [...current, d],
                      });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      defenceAnswers.primaryDefences.includes(d)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/60"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Liability admission */}
            <div className="card p-5 space-y-3">
              <div className="text-sm font-semibold">Has liability been admitted?</div>
              <div className="flex flex-wrap gap-2">
                {LIABILITY_ADMISSION_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setDefenceAnswers({ ...defenceAnswers, liabilityAdmission: opt })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      defenceAnswers.liabilityAdmission === opt
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/60"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantum */}
            <div className="card p-5 space-y-3">
              <div className="text-sm font-semibold">Quantum assessment</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Claimant&apos;s claimed value (&pound;)</label>
                  <input
                    type="number"
                    className="input text-sm py-1.5 w-full"
                    placeholder="0"
                    value={defenceAnswers.claimedValue}
                    onChange={(e) => setDefenceAnswers({ ...defenceAnswers, claimedValue: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Current reserve (&pound;)</label>
                  <input
                    type="number"
                    className="input text-sm py-1.5 w-full"
                    placeholder="0"
                    value={defenceAnswers.currentReserve}
                    onChange={(e) => setDefenceAnswers({ ...defenceAnswers, currentReserve: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Realistic quantum &mdash; low estimate (&pound;)</label>
                  <input
                    type="number"
                    className="input text-sm py-1.5 w-full"
                    placeholder="0"
                    value={defenceAnswers.quantumLow}
                    onChange={(e) => setDefenceAnswers({ ...defenceAnswers, quantumLow: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Realistic quantum &mdash; mid estimate (&pound;)</label>
                  <input
                    type="number"
                    className="input text-sm py-1.5 w-full"
                    placeholder="0"
                    value={defenceAnswers.quantumMid}
                    onChange={(e) => setDefenceAnswers({ ...defenceAnswers, quantumMid: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Realistic quantum &mdash; high estimate (&pound;)</label>
                  <input
                    type="number"
                    className="input text-sm py-1.5 w-full"
                    placeholder="0"
                    value={defenceAnswers.quantumHigh}
                    onChange={(e) => setDefenceAnswers({ ...defenceAnswers, quantumHigh: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Estimated litigation costs to trial (&pound;)</label>
                  <input
                    type="number"
                    className="input text-sm py-1.5 w-full"
                    placeholder="0"
                    value={defenceAnswers.trialCostEstimate}
                    onChange={(e) => setDefenceAnswers({ ...defenceAnswers, trialCostEstimate: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Evidence */}
            <div className="card p-5 space-y-4">
              <div className="text-sm font-semibold">Evidence and procedural position</div>
              {[
                { label: "Witness strength", key: "witnessStrength" as const, options: WITNESS_OPTIONS },
                { label: "Documentary evidence completeness", key: "evidenceCompleteness" as const, options: EVIDENCE_OPTIONS },
                { label: "Expert evidence", key: "expertEvidence" as const, options: EXPERT_OPTIONS },
                { label: "Current procedural stage", key: "proceduralStage" as const, options: PROCEDURAL_STAGES },
              ].map(({ label, key, options }) => (
                <div key={key} className="space-y-2">
                  <div className="text-xs text-muted-foreground font-medium">{label}</div>
                  <div className="flex flex-wrap gap-2">
                    {options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setDefenceAnswers({ ...defenceAnswers, [key]: opt })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          defenceAnswers[key] === opt
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border hover:border-primary/60"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <label className="text-xs text-muted-foreground block mb-1">Upcoming deadlines or hearing dates</label>
                <input
                  type="text"
                  className="input text-sm py-1.5 w-full"
                  placeholder="e.g. CMC listed 15 June; trial window October 2026"
                  value={defenceAnswers.upcomingDeadlines}
                  onChange={(e) => setDefenceAnswers({ ...defenceAnswers, upcomingDeadlines: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">Additional notes for MIKE</label>
                <textarea
                  className="input text-sm py-1.5 w-full min-h-[80px] resize-y"
                  placeholder="Any additional context relevant to coverage, defence, or quantum…"
                  value={defenceAnswers.additionalNotes}
                  onChange={(e) => setDefenceAnswers({ ...defenceAnswers, additionalNotes: e.target.value })}
                />
              </div>
            </div>

            <button
              className="btn-primary w-full"
              disabled={saveMutation.isPending}
              onClick={() => void proceedFromStage2()}
            >
              {saveMutation.isPending ? "Saving…" : "Proceed to Stage 3 — Ancillary Documents"}
            </button>
          </div>
        )}

        {/* ── STAGE 3 ─────────────────────────────────────────────────────── */}
        {currentStage === 3 && (
          <div className="space-y-4">
            <div className="card border-violet-200 bg-violet-50 p-4 flex gap-3">
              <Lock size={16} className="text-violet-600 shrink-0 mt-0.5" />
              <p className="text-sm text-violet-800">
                You will be asked whether each document is legally privileged before uploading. Privileged documents are stored separately and excluded from all external exports.
              </p>
            </div>

            {/* Upload zone */}
            <div className="card p-5 space-y-3">
              <div className="text-sm font-semibold">Upload ancillary documents</div>
              <p className="text-xs text-muted-foreground">
                Accepted: PDF, DOCX, XLSX, images (JPG/PNG/HEIC), audio (MP3/M4A/WAV), video (MP4/MOV). Max 100MB per file.
              </p>
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/60 hover:bg-accent/30 transition-all"
                onClick={() => ancillaryInputRef.current?.click()}
              >
                <input
                  ref={ancillaryInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.heic,.tiff,.gif,.mp3,.m4a,.wav,.aac,.ogg,.mp4,.mov,.avi,.mkv,.webm"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAncillaryFileSelected(file);
                    e.target.value = "";
                  }}
                />
                <Upload size={22} className="text-muted-foreground/50 mx-auto mb-2" />
                <div className="text-sm font-medium">Drop file or click to browse</div>
                <div className="text-xs text-muted-foreground mt-1">You will be asked about legal privilege before uploading</div>
              </div>
            </div>

            {/* Privilege modal */}
            {privilegeModalFile && (
              <div className="card border-violet-300 p-5 space-y-4">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Lock size={15} className="text-violet-600" />
                  Is this document legally privileged?
                </div>
                <p className="text-xs text-muted-foreground">
                  <strong>{privilegeModalFile.name}</strong> &mdash; Privileged documents are stored in a secure vault and excluded from all client-facing exports.
                </p>
                <div className="flex gap-3">
                  <button
                    className="btn-primary flex-1 text-sm"
                    disabled={ancillaryUploading}
                    onClick={() => void uploadWithPrivilege(true)}
                  >
                    Yes &mdash; store as privileged
                  </button>
                  <button
                    className="btn-secondary flex-1 text-sm"
                    disabled={ancillaryUploading}
                    onClick={() => void uploadWithPrivilege(false)}
                  >
                    No &mdash; standard document
                  </button>
                  <button
                    className="btn-secondary text-sm"
                    onClick={() => setPrivilegeModalFile(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Uploaded files list */}
            {(ancillaryDocs as AncillaryDocumentData[]).length > 0 && (
              <div className="card divide-y divide-card-border">
                {(ancillaryDocs as AncillaryDocumentData[]).map((ad) => (
                  <div key={ad.id}>
                    <div className="px-4 py-3 flex items-center gap-3">
                      <span className="text-lg">{getFileIcon(ad.fileType)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{ad.originalName}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{ad.fileType}</span>
                          {ad.privilegeFlag && (
                            <span className="text-[10px] bg-violet-100 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                              <Lock size={9} /> Privileged
                            </span>
                          )}
                          {(ad.fileType === "AUDIO" || ad.fileType === "VIDEO") && !ad.transcription && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">
                              Transcription pending
                            </span>
                          )}
                          {(ad.fileType === "AUDIO" || ad.fileType === "VIDEO") && ad.transcription && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5">Transcribed</span>
                          )}
                        </div>
                      </div>
                      <button
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        onClick={() => void handleDeleteAncillary(ad.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {(ad.fileType === "AUDIO" || ad.fileType === "VIDEO") && ad.transcription && !ad.privilegeFlag && (
                      <div className="px-4 pb-3">
                        <div className="text-xs text-muted-foreground font-medium mb-1">Transcription</div>
                        <div className="text-xs bg-muted rounded p-2 max-h-24 overflow-y-auto leading-relaxed">
                          {ad.transcription}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Privileged vault summary */}
            {(ancillaryDocs as AncillaryDocumentData[]).some((d) => d.privilegeFlag) && (
              <div className="card border-violet-200 bg-violet-50 p-4 flex gap-3">
                <Shield size={16} className="text-violet-600 shrink-0 mt-0.5" />
                <p className="text-sm text-violet-800">
                  {(ancillaryDocs as AncillaryDocumentData[]).filter((d) => d.privilegeFlag).length} privileged document(s) stored securely. These will not appear in any export sent outside your legal team.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                className="btn-secondary flex-1"
                onClick={() => setCurrentStage(2)}
              >
                Back
              </button>
              <button
                className="btn-primary flex-1"
                disabled={saveMutation.isPending}
                onClick={() => void completeIntake()}
              >
                {saveMutation.isPending ? "Saving…" : "Complete intake — view MIKE review"}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
