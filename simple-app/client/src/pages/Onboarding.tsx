import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle } from "lucide-react";
import { createCompany, savePlaybookRules, saveContacts, detectRegulations } from "../lib/api";
import {
  CLAUSE_CATEGORIES,
  CLAUSE_LABELS,
  PLAYBOOK_DEFAULTS,
  type ClauseCategory,
  type RiskAppetite,
  type CompanyRole,
  type ApprovalRole,
} from "../lib/types";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

interface CompanyForm {
  name: string;
  sector: string;
  jurisdiction: string;
  role: CompanyRole;
  riskAppetite: RiskAppetite;
}

interface PlaybookEntry {
  clauseCategory: ClauseCategory;
  preferredPosition: string;
  acceptableFallback: string;
  hardRedLine: string;
  approvalRequired?: ApprovalRole;
  fallbackTemplate?: string;
  riskWeight: number;
}

interface Contact {
  role: ApprovalRole;
  name: string;
  email: string;
}

const STEPS = ["Company", "Contract type", "Playbook", "Approvers", "Regulations", "Done"];

const CONTRACT_TYPES = [
  { value: "SUPPLIER_AGREEMENT", label: "Supplier Agreement" },
  { value: "CUSTOMER_AGREEMENT", label: "Customer Agreement" },
  { value: "MSA",                label: "Master Services Agreement" },
  { value: "NDA",                label: "NDA" },
  { value: "DPA",                label: "Data Processing Agreement" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [companyForm, setCompanyForm] = useState<CompanyForm>({
    name: "",
    sector: "",
    jurisdiction: "England & Wales",
    role: "BUYER",
    riskAppetite: "MODERATE",
  });
  const [contractType, setContractType] = useState("SUPPLIER_AGREEMENT");
  const [playbook, setPlaybook] = useState<PlaybookEntry[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([
    { role: "LEGAL", name: "", email: "" },
    { role: "GC",    name: "", email: "" },
    { role: "CFO",   name: "", email: "" },
  ]);
  const [regulationsDetected, setRegulationsDetected] = useState(false);
  const [saving, setSaving] = useState(false);

  const companyMutation = useMutation({ mutationFn: createCompany });

  function initPlaybook(appetite: RiskAppetite) {
    const defaults = PLAYBOOK_DEFAULTS[appetite];
    return CLAUSE_CATEGORIES.map((cat) => ({
      clauseCategory: cat,
      ...defaults[cat],
      riskWeight: 3,
    }));
  }

  function handleCompanyNext() {
    if (!companyForm.name || !companyForm.sector) return;
    setPlaybook(initPlaybook(companyForm.riskAppetite));
    setStep(2);
  }

  function updateRule(cat: ClauseCategory, field: keyof PlaybookEntry, value: string) {
    setPlaybook((prev) =>
      prev.map((r) => (r.clauseCategory === cat ? { ...r, [field]: value } : r))
    );
  }

  async function handleFinish() {
    setSaving(true);
    try {
      await companyMutation.mutateAsync(companyForm);
      await savePlaybookRules(
        playbook.map(({ clauseCategory, preferredPosition, acceptableFallback, hardRedLine, approvalRequired, fallbackTemplate, riskWeight }) => ({
          clauseCategory, preferredPosition, acceptableFallback, hardRedLine, approvalRequired, fallbackTemplate, riskWeight,
        }))
      );
      const validContacts = contacts.filter((c) => c.name && c.email);
      if (validContacts.length > 0) await saveContacts(validContacts);
      if (!regulationsDetected) {
        await detectRegulations().catch(() => {});
      }
      await queryClient.invalidateQueries({ queryKey: ["company"] });
      navigate("/dashboard");
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/60 px-6 py-4 flex items-center gap-3">
        <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
          <span className="text-white text-xs font-bold">M</span>
        </div>
        <div>
          <span className="text-sm font-semibold">MIKE</span>
          <span className="text-xs text-muted-foreground ml-2">Legal Decision Engine</span>
        </div>
      </header>

      {/* Progress stepper */}
      <div className="border-b border-border bg-card/30 px-6 py-4">
        <div className="flex items-center gap-1 max-w-3xl">
          {STEPS.map((label, i) => {
            const s = (i + 1) as Step;
            const active = s === step;
            const done = s < step;
            return (
              <div key={label} className="flex items-center gap-1 flex-1 min-w-0">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                    done  ? "bg-primary text-primary-foreground" :
                    active ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                    "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </div>
                <span className={`text-xs hidden sm:block truncate ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {label}
                </span>
                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border mx-1" />}
              </div>
            );
          })}
        </div>
      </div>

      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full">
        {step === 1 && <Step1Company form={companyForm} onChange={setCompanyForm} onNext={handleCompanyNext} />}
        {step === 2 && <Step2ContractType value={contractType} onChange={setContractType} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
        {step === 3 && <Step3Playbook playbook={playbook} onUpdate={updateRule} onBack={() => setStep(2)} onNext={() => setStep(4)} />}
        {step === 4 && <Step4Approvers contacts={contacts} onChange={setContacts} onBack={() => setStep(3)} onNext={() => setStep(5)} />}
        {step === 5 && <Step5Regulations companyForm={companyForm} detected={regulationsDetected} onDetected={() => setRegulationsDetected(true)} onBack={() => setStep(4)} onNext={() => setStep(6)} />}
        {step === 6 && <Step6Done saving={saving} onBack={() => setStep(5)} onFinish={handleFinish} />}
      </main>
    </div>
  );
}

// ─── Step 1: Company ──────────────────────────────────────────────────────────

function Step1Company({ form, onChange, onNext }: { form: CompanyForm; onChange: (f: CompanyForm) => void; onNext: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Tell MIKE about your company</h2>
        <p className="text-muted-foreground text-sm mt-1">
          This shapes the market defaults in your playbook. You'll review every clause before saving.
        </p>
      </div>
      <div className="space-y-4">
        <Field label="Company name">
          <input className="input" placeholder="Acme Ltd" value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Sector" hint="MIKE uses this to detect your regulatory environment automatically.">
          <input className="input" placeholder="e.g. Financial services, SaaS, Healthcare, FinTech"
            value={form.sector} onChange={(e) => onChange({ ...form, sector: e.target.value })} />
        </Field>
        <Field label="Primary jurisdiction">
          <Select value={form.jurisdiction}
            onChange={(v) => onChange({ ...form, jurisdiction: v })}
            options={[
              { value: "England & Wales", label: "England & Wales (UK)" },
              { value: "Scotland", label: "Scotland (UK)" },
              { value: "European Union", label: "European Union" },
              { value: "United States", label: "United States" },
              { value: "California", label: "California, US" },
              { value: "Singapore", label: "Singapore" },
              { value: "UAE / DIFC", label: "UAE / DIFC" },
              { value: "Multiple", label: "Multiple jurisdictions" },
            ]}
          />
        </Field>
        <Field label="Your typical contract role">
          <Select value={form.role} onChange={(v) => onChange({ ...form, role: v as CompanyRole })}
            options={[
              { value: "BUYER",    label: "Buyer / Customer" },
              { value: "SUPPLIER", label: "Supplier / Vendor" },
              { value: "BOTH",     label: "Both" },
            ]}
          />
        </Field>
        <Field label="Risk appetite" hint="Sets your default clause positions — you can adjust each one next.">
          <Select value={form.riskAppetite} onChange={(v) => onChange({ ...form, riskAppetite: v as RiskAppetite })}
            options={[
              { value: "CONSERVATIVE", label: "Conservative — maximum protection" },
              { value: "MODERATE",     label: "Moderate — balanced (recommended)" },
              { value: "COMMERCIAL",   label: "Commercial — deal-oriented" },
            ]}
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <button className="btn-primary" onClick={onNext} disabled={!form.name || !form.sector}>
          Next: Contract type →
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Contract type ────────────────────────────────────────────────────

function Step2ContractType({ value, onChange, onBack, onNext }: { value: string; onChange: (v: string) => void; onBack: () => void; onNext: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Primary contract type</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Start with the contract type you receive most often from counterparties.
        </p>
      </div>
      <div className="grid gap-2">
        {CONTRACT_TYPES.map((ct) => (
          <button key={ct.value} onClick={() => onChange(ct.value)}
            className={`text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all ${
              value === ct.value
                ? "border-primary bg-accent text-primary"
                : "border-border hover:border-primary/40 hover:bg-muted/30"
            }`}>
            {ct.label}
          </button>
        ))}
      </div>
      <div className="flex justify-between">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-primary" onClick={onNext}>Next: Playbook →</button>
      </div>
    </div>
  );
}

// ─── Step 3: Playbook ─────────────────────────────────────────────────────────

function Step3Playbook({ playbook, onUpdate, onBack, onNext }: {
  playbook: PlaybookEntry[];
  onUpdate: (cat: ClauseCategory, field: keyof PlaybookEntry, value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [expanded, setExpanded] = useState<ClauseCategory | null>("LIABILITY_CAP");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Calibrate your playbook</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Pre-filled from your risk appetite. Expand each clause to adjust — focus on positions that are specific to your company.
        </p>
      </div>
      <div className="space-y-2">
        {playbook.map((rule) => {
          const isOpen = expanded === rule.clauseCategory;
          return (
            <div key={rule.clauseCategory} className="card overflow-hidden">
              <button
                className="w-full text-left px-4 py-3.5 flex items-center justify-between text-sm font-semibold hover:bg-muted/30 transition-colors"
                onClick={() => setExpanded(isOpen ? null : rule.clauseCategory)}
              >
                <span>{CLAUSE_LABELS[rule.clauseCategory]}</span>
                <span className="text-muted-foreground text-xs">{isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <div className="border-t border-card-border px-4 pb-4 pt-3 space-y-3 bg-muted/10">
                  <Textarea label="Preferred position" value={rule.preferredPosition}
                    onChange={(v) => onUpdate(rule.clauseCategory, "preferredPosition", v)} />
                  <Textarea label="Acceptable fallback" value={rule.acceptableFallback}
                    onChange={(v) => onUpdate(rule.clauseCategory, "acceptableFallback", v)} />
                  <Textarea label="Hard red line (non-negotiable)" value={rule.hardRedLine}
                    onChange={(v) => onUpdate(rule.clauseCategory, "hardRedLine", v)} />
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Who approves exceptions?
                    </label>
                    <Select value={rule.approvalRequired ?? ""} onChange={(v) => onUpdate(rule.clauseCategory, "approvalRequired", v)}
                      options={[
                        { value: "",      label: "No approval needed" },
                        { value: "LEGAL", label: "Legal team" },
                        { value: "GC",    label: "General Counsel" },
                        { value: "CFO",   label: "CFO" },
                        { value: "BOARD", label: "Board" },
                      ]}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-primary" onClick={onNext}>Next: Approvers →</button>
      </div>
    </div>
  );
}

// ─── Step 4: Approvers ────────────────────────────────────────────────────────

function Step4Approvers({ contacts, onChange, onBack, onNext }: {
  contacts: Contact[];
  onChange: (c: Contact[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  function update(i: number, field: keyof Contact, value: string) {
    const updated = [...contacts];
    updated[i] = { ...updated[i], [field]: value };
    onChange(updated);
  }

  const ROLE_LABELS: Record<ApprovalRole, string> = {
    LEGAL: "Legal team",
    GC:    "General Counsel",
    CFO:   "CFO",
    BOARD: "Board",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Who approves exceptions?</h2>
        <p className="text-muted-foreground text-sm mt-1">
          When MIKE triggers an escalation, it names the right person. Leave blank if not applicable.
        </p>
      </div>
      <div className="space-y-3">
        {contacts.map((c, i) => (
          <div key={c.role} className="card p-4 space-y-3">
            <div className="text-sm font-semibold">{ROLE_LABELS[c.role]}</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name">
                <input className="input" placeholder="Jane Smith" value={c.name}
                  onChange={(e) => update(i, "name", e.target.value)} />
              </Field>
              <Field label="Email">
                <input className="input" type="email" placeholder="jane@company.com" value={c.email}
                  onChange={(e) => update(i, "email", e.target.value)} />
              </Field>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-primary" onClick={onNext}>Next: Regulations →</button>
      </div>
    </div>
  );
}

// ─── Step 5: Regulations ──────────────────────────────────────────────────────

function Step5Regulations({ companyForm, detected, onDetected, onBack, onNext }: {
  companyForm: CompanyForm;
  detected: boolean;
  onDetected: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [detecting, setDetecting] = useState(false);
  const [regs, setRegs] = useState<{ frameworkName: string; regulator: string; jurisdiction: string }[]>([]);
  const [error, setError] = useState("");

  async function detect() {
    setDetecting(true);
    setError("");
    try {
      const detected = await detectRegulations();
      setRegs(detected);
      onDetected();
    } catch (e) {
      setError("Could not detect frameworks — you can skip this and detect later from the Regulations page.");
    } finally {
      setDetecting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Regulatory environment</h2>
        <p className="text-muted-foreground text-sm mt-1">
          MIKE auto-detects applicable regulations from your sector and jurisdiction, then flags contract clauses that conflict with your obligations.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <div className="text-sm">
          <span className="font-medium">Sector:</span>{" "}
          <span className="text-muted-foreground">{companyForm.sector}</span>
        </div>
        <div className="text-sm">
          <span className="font-medium">Jurisdiction:</span>{" "}
          <span className="text-muted-foreground">{companyForm.jurisdiction}</span>
        </div>

        {!detected && (
          <button className="btn-primary gap-2 mt-2" onClick={detect} disabled={detecting}>
            {detecting ? (
              <><span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Detecting…</>
            ) : (
              "Detect applicable regulations"
            )}
          </button>
        )}

        {error && <p className="text-xs text-amber-600">{error}</p>}

        {detected && regs.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle size={14} /> {regs.length} frameworks detected
            </div>
            <div className="space-y-1">
              {regs.map((r) => (
                <div key={r.frameworkName} className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {r.frameworkName} ({r.regulator})
                </div>
              ))}
            </div>
          </div>
        )}

        {detected && regs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No specific regulatory frameworks detected for your profile. MIKE will apply general contract standards.
          </p>
        )}
      </div>

      <div className="flex justify-between">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-primary" onClick={onNext}>
          {detected ? "Next: Launch →" : "Skip for now →"}
        </button>
      </div>
    </div>
  );
}

// ─── Step 6: Done ─────────────────────────────────────────────────────────────

function Step6Done({ saving, onBack, onFinish }: { saving: boolean; onBack: () => void; onFinish: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">MIKE is ready</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Your playbook is configured. Upload your first contract and MIKE will review it within a couple of minutes.
        </p>
      </div>
      <div className="card p-5 space-y-3">
        <div className="text-sm font-semibold">What happens next</div>
        <ul className="space-y-2">
          {[
            "Upload counterparty paper (PDF or DOCX)",
            "MIKE extracts and classifies key clauses",
            "Each clause is compared against your playbook + live regulations",
            "You get a Red / Amber / Green risk report with fallback language",
            "MIKE tells you what to push back on and who needs to approve what",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
              <CheckCircle size={14} className="text-primary mt-0.5 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex justify-between">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-primary" onClick={onFinish} disabled={saving}>
          {saving ? "Setting up…" : "Launch MIKE →"}
        </button>
      </div>
    </div>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <textarea className="input min-h-[80px] resize-y text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
