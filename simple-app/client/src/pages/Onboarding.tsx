import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle } from "lucide-react";
import { createCompany, savePlaybookRules, saveContacts, detectRegulations } from "../lib/api";
import {
  CLAUSE_CATEGORIES,
  CLAUSE_LABELS,
  PLAYBOOK_DEFAULTS,
  GAMING_CLAUSE_CATEGORIES,
  INVESTMENT_CLAUSE_CATEGORIES,
  INDUSTRY_LABELS,
  type ClauseCategory,
  type RiskAppetite,
  type CompanyRole,
  type ApprovalRole,
  type Industry,
  type Persona,
} from "../lib/types";

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface CompanyForm {
  name: string;
  sector: string;
  jurisdiction: string;
  role: CompanyRole;
  riskAppetite: RiskAppetite;
  industry: string;
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

const STEPS = ["Persona", "Company", "Contracts", "Playbook", "Approvers", "Regulations", "Done"];

// ─── Industry config ──────────────────────────────────────────────────────────

const INDUSTRY_ICONS: Record<Industry, string> = {
  TECHNOLOGY_SAAS:          "💻",
  FINANCIAL_SERVICES:       "🏦",
  HEALTHCARE_LIFESCIENCES:  "🏥",
  GAMING_INTERACTIVE:       "🎮",
  PROPERTY_REAL_ESTATE:     "🏢",
  PROFESSIONAL_SERVICES:    "💼",
  MANUFACTURING_SUPPLY:     "🏭",
  RETAIL_ECOMMERCE:         "🛒",
  MEDIA_ENTERTAINMENT:      "🎬",
  ENERGY_CLEANTECH:         "⚡",
  EDUCATION_EDTECH:         "📚",
  LEGAL_SERVICES:           "⚖️",
  OTHER:                    "🔲",
};

// ─── Contract types ───────────────────────────────────────────────────────────

const CONTRACT_TYPES: { value: string; label: string; group: string; industries: Industry[]; personas?: Persona[] }[] = [
  { value: "SUPPLIER_AGREEMENT",     label: "Supplier Agreement",                    group: "Commercial",     industries: [] },
  { value: "CUSTOMER_AGREEMENT",     label: "Customer Agreement",                    group: "Commercial",     industries: [] },
  { value: "MSA",                    label: "Master Services Agreement (MSA)",        group: "Commercial",     industries: [] },
  { value: "NDA",                    label: "Non-Disclosure Agreement (NDA)",         group: "Commercial",     industries: [] },
  { value: "DPA",                    label: "Data Processing Agreement (DPA)",        group: "Commercial",     industries: ["TECHNOLOGY_SAAS","FINANCIAL_SERVICES","HEALTHCARE_LIFESCIENCES","GAMING_INTERACTIVE","RETAIL_ECOMMERCE","EDUCATION_EDTECH"] },
  { value: "DISTRIBUTION_AGREEMENT", label: "Distribution Agreement",                group: "Commercial",     industries: ["MANUFACTURING_SUPPLY","RETAIL_ECOMMERCE","GAMING_INTERACTIVE","MEDIA_ENTERTAINMENT"] },
  { value: "RESELLER_AGREEMENT",     label: "Reseller / Channel Partner Agreement",  group: "Commercial",     industries: ["TECHNOLOGY_SAAS","MANUFACTURING_SUPPLY","RETAIL_ECOMMERCE"] },
  { value: "SaaS_AGREEMENT",         label: "SaaS / Software Licence",               group: "Technology",     industries: ["TECHNOLOGY_SAAS","GAMING_INTERACTIVE","FINANCIAL_SERVICES","HEALTHCARE_LIFESCIENCES","EDUCATION_EDTECH"] },
  { value: "PROFESSIONAL_SERVICES",  label: "Professional Services Agreement",        group: "Technology",     industries: ["TECHNOLOGY_SAAS","PROFESSIONAL_SERVICES","LEGAL_SERVICES"] },
  { value: "IP_LICENSE_AGREEMENT",   label: "IP Licence Agreement",                  group: "Technology",     industries: ["TECHNOLOGY_SAAS","GAMING_INTERACTIVE","MEDIA_ENTERTAINMENT","LEGAL_SERVICES"] },
  { value: "PLATFORM_PUBLISHING",    label: "Platform / Publisher Agreement",         group: "Gaming & Media", industries: ["GAMING_INTERACTIVE","MEDIA_ENTERTAINMENT"] },
  { value: "REVENUE_SHARE",          label: "Revenue Share / Profit Share",          group: "Gaming & Media", industries: ["GAMING_INTERACTIVE","MEDIA_ENTERTAINMENT","RETAIL_ECOMMERCE"] },
  { value: "CONTENT_LICENSE",        label: "Content Licence Agreement",              group: "Gaming & Media", industries: ["GAMING_INTERACTIVE","MEDIA_ENTERTAINMENT","EDUCATION_EDTECH"] },
  { value: "ESPORTS_SPONSORSHIP",    label: "Esports Sponsorship & Partnership",     group: "Gaming & Media", industries: ["GAMING_INTERACTIVE","MEDIA_ENTERTAINMENT"] },
  { value: "EMPLOYMENT",             label: "Employment Agreement",                  group: "People",         industries: [] },
  { value: "CONTRACTOR_AGREEMENT",   label: "Contractor / Consultancy Agreement",    group: "People",         industries: [] },
  { value: "COMMERCIAL_LEASE",       label: "Commercial Lease",                      group: "Property",       industries: ["PROPERTY_REAL_ESTATE"] },
  { value: "LICENSE_AGREEMENT",      label: "Licence to Occupy",                    group: "Property",       industries: ["PROPERTY_REAL_ESTATE"] },
  { value: "AGREEMENT_FOR_LEASE",    label: "Agreement for Lease",                  group: "Property",       industries: ["PROPERTY_REAL_ESTATE"] },
  { value: "LOAN_AGREEMENT",         label: "Loan / Facility Agreement",             group: "Financial",      industries: ["FINANCIAL_SERVICES"] },
  { value: "CLINICAL_TRIAL",         label: "Clinical Trial Agreement",              group: "Healthcare",     industries: ["HEALTHCARE_LIFESCIENCES"] },
  { value: "RESEARCH_COLLAB",        label: "Research Collaboration Agreement",      group: "Healthcare",     industries: ["HEALTHCARE_LIFESCIENCES"] },
  { value: "JV_AGREEMENT",           label: "Joint Venture Agreement",               group: "Corporate",      industries: [] },
  { value: "SHARE_PURCHASE",         label: "Share Purchase Agreement (SPA)",        group: "Corporate",      industries: [] },
  // ── Investment documents (Founder / PE only) ──────────────────────────────
  { value: "TERM_SHEET",             label: "Term Sheet / Investment Terms",          group: "Investment",     industries: [], personas: ["FOUNDER","PE_FUND"] },
  { value: "SUBSCRIPTION_AGREEMENT", label: "Subscription / Investment Agreement",   group: "Investment",     industries: [], personas: ["FOUNDER","PE_FUND"] },
  { value: "SHA",                    label: "Shareholders' Agreement (SHA)",          group: "Investment",     industries: [], personas: ["FOUNDER","PE_FUND"] },
  { value: "CONVERTIBLE_NOTE",       label: "Convertible Loan Note (CLN)",           group: "Investment",     industries: [], personas: ["FOUNDER","PE_FUND"] },
  { value: "SAFE",                   label: "Simple Agreement for Future Equity (SAFE)", group: "Investment", industries: [], personas: ["FOUNDER","PE_FUND"] },
  { value: "INVESTMENT_AGREEMENT",   label: "Investment Agreement",                  group: "Investment",     industries: [], personas: ["FOUNDER","PE_FUND"] },
  { value: "OTHER",                  label: "Other",                                 group: "Other",          industries: [] },
];

const PROPERTY_CONTRACT_TYPES = ["COMMERCIAL_LEASE", "LICENSE_AGREEMENT", "AGREEMENT_FOR_LEASE"];
const INVESTMENT_CONTRACT_TYPES = ["TERM_SHEET","SUBSCRIPTION_AGREEMENT","SHA","CONVERTIBLE_NOTE","SAFE","INVESTMENT_AGREEMENT","SHARE_PURCHASE"];

function getContractTypesForPersonaAndIndustry(persona: Persona, industries: Industry[]) {
  return CONTRACT_TYPES.filter((ct) => {
    // Persona-restricted types
    if (ct.personas && !ct.personas.includes(persona)) return false;
    // Industry filter (empty = universal)
    if (ct.industries.length > 0 && !ct.industries.some((ind) => industries.includes(ind))) {
      // But still include if it has no persona restriction and industries is just filtering
      // (the industry check only filters non-empty lists)
      return false;
    }
    return true;
  });
}

// ─── Jurisdictions ────────────────────────────────────────────────────────────

const JURISDICTION_OPTIONS = [
  { value: "England & Wales", label: "🇬🇧 England & Wales" },
  { value: "Scotland",        label: "🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland" },
  { value: "European Union",  label: "🇪🇺 European Union" },
  { value: "United States",   label: "🇺🇸 United States (Federal)" },
  { value: "New York",        label: "🇺🇸 New York (US)" },
  { value: "California",      label: "🇺🇸 California (US)" },
  { value: "Canada",          label: "🇨🇦 Canada" },
  { value: "Singapore",       label: "🇸🇬 Singapore" },
  { value: "UAE / DIFC",      label: "🇦🇪 UAE / DIFC" },
  { value: "UAE / ADGM",      label: "🇦🇪 UAE / ADGM" },
  { value: "KSA",             label: "🇸🇦 Saudi Arabia (KSA)" },
  { value: "South Korea",     label: "🇰🇷 South Korea" },
];

// ─── Dark palette helpers ─────────────────────────────────────────────────────

const BG   = "hsl(222 47% 6%)";
const CARD = "hsl(222 47% 10%)";
const CARD2 = "hsl(222 47% 13%)";

// ─── Main component ───────────────────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(0);
  const [persona, setPersona] = useState<Persona>("CORPORATE");
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<string[]>(["England & Wales"]);
  const [selectedIndustries, setSelectedIndustries] = useState<Industry[]>(["TECHNOLOGY_SAAS"]);
  const [companyForm, setCompanyForm] = useState<CompanyForm>({
    name: "",
    sector: INDUSTRY_LABELS["TECHNOLOGY_SAAS"],
    jurisdiction: "England & Wales",
    role: "BUYER",
    riskAppetite: "MODERATE",
    industry: "TECHNOLOGY_SAAS",
  });
  const [selectedContractTypes, setSelectedContractTypes] = useState<string[]>([]);
  const [playbook, setPlaybook] = useState<PlaybookEntry[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([
    { role: "LEGAL", name: "", email: "" },
    { role: "GC",    name: "", email: "" },
    { role: "CFO",   name: "", email: "" },
  ]);
  const [regulationsDetected, setRegulationsDetected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finishError, setFinishError] = useState("");

  const companyMutation = useMutation({ mutationFn: createCompany });

  function initPlaybook(appetite: RiskAppetite, isProperty: boolean, isGaming: boolean, isInvestment: boolean) {
    const defaults = PLAYBOOK_DEFAULTS[appetite];
    const PROPERTY_ONLY: ClauseCategory[] = ["RENT_REVIEW", "BREAK_CLAUSE", "REPAIR_OBLIGATIONS", "SERVICE_CHARGE"];
    return CLAUSE_CATEGORIES
      .filter((cat) => {
        if (PROPERTY_ONLY.includes(cat))                  return isProperty;
        if (GAMING_CLAUSE_CATEGORIES.includes(cat))       return isGaming;
        if (INVESTMENT_CLAUSE_CATEGORIES.includes(cat))   return isInvestment;
        return true;
      })
      .map((cat) => ({ clauseCategory: cat, ...defaults[cat], riskWeight: 3 }));
  }

  function handlePersonaNext(chosen: Persona) {
    setPersona(chosen);
    // Pre-select sensible defaults for investment personas
    if (chosen === "FOUNDER") {
      setSelectedContractTypes(["TERM_SHEET", "SUBSCRIPTION_AGREEMENT", "SHA"]);
    } else if (chosen === "PE_FUND") {
      setSelectedContractTypes(["SHARE_PURCHASE", "SHA", "TERM_SHEET"]);
    } else {
      setSelectedContractTypes(["SUPPLIER_AGREEMENT"]);
    }
    setStep(1);
  }

  function handleCompanyNext() {
    if (!companyForm.name.trim()) return;
    const jurisdictionStr = selectedJurisdictions.join(", ") || "England & Wales";
    const industryStr     = selectedIndustries.join(", ") || "OTHER";
    const sectorStr       = companyForm.sector.trim() || selectedIndustries.map((i) => INDUSTRY_LABELS[i]).join(", ");
    setCompanyForm((prev) => ({ ...prev, jurisdiction: jurisdictionStr, industry: industryStr, sector: sectorStr }));
    setStep(2);
  }

  function handleContractTypeNext() {
    const isProperty   = selectedContractTypes.some((ct) => PROPERTY_CONTRACT_TYPES.includes(ct));
    const isGaming     = selectedIndustries.includes("GAMING_INTERACTIVE");
    const isInvestment = persona === "FOUNDER" || persona === "PE_FUND" ||
                         selectedContractTypes.some((ct) => INVESTMENT_CONTRACT_TYPES.includes(ct));
    setPlaybook(initPlaybook(companyForm.riskAppetite, isProperty, isGaming, isInvestment));
    setStep(3);
  }

  function updateRule(cat: ClauseCategory, field: keyof PlaybookEntry, value: string) {
    setPlaybook((prev) => prev.map((r) => (r.clauseCategory === cat ? { ...r, [field]: value } : r)));
  }

  async function handleFinish() {
    setSaving(true);
    setFinishError("");
    try {
      await companyMutation.mutateAsync({ ...companyForm, persona });
      await savePlaybookRules(
        playbook.map(({ clauseCategory, preferredPosition, acceptableFallback, hardRedLine, approvalRequired, fallbackTemplate, riskWeight }) => ({
          clauseCategory, preferredPosition, acceptableFallback, hardRedLine, approvalRequired, fallbackTemplate, riskWeight,
        }))
      );
      const validContacts = contacts.filter((c) => c.name && c.email);
      if (validContacts.length > 0) await saveContacts(validContacts);
      if (!regulationsDetected) await detectRegulations().catch(() => {});
      await queryClient.invalidateQueries({ queryKey: ["company"] });
      navigate("/dashboard");
    } catch (e: unknown) {
      setFinishError(e instanceof Error ? e.message : "Something went wrong - please try again.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  // Progress: step 0–6 → 0–100%
  const progressPct = (step / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG }}>

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-white/8 flex items-center gap-3 px-6 py-4 backdrop-blur-md"
        style={{ background: "hsl(222 47% 6% / 0.85)" }}>
        <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <div>
            <span className="text-sm font-semibold text-white">MIKE</span>
            <span className="text-[10px] text-white/30 ml-2 tracking-widest uppercase hidden sm:block">Legal Decision Engine</span>
          </div>
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <Link to="/" className="text-xs text-white/35 hover:text-white/70 transition-colors hidden sm:block">← Home</Link>
          <span className="text-xs text-white/25">Step {step + 1} of {STEPS.length}</span>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-0.5 bg-white/5">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Step labels */}
      <div className="border-b border-white/8 px-6 py-3" style={{ background: "hsl(222 47% 8%)" }}>
        <div className="flex items-center gap-0 max-w-2xl">
          {STEPS.map((label, i) => {
            const done   = i < step;
            const active = i === step;
            return (
              <div key={label} className="flex items-center flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${
                    done   ? "bg-primary text-white" :
                    active ? "bg-primary text-white ring-2 ring-primary/30 ring-offset-1 ring-offset-transparent" :
                             "bg-white/8 text-white/25"
                  }`}>
                    {done ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs hidden sm:block truncate ${active ? "text-white font-medium" : done ? "text-white/50" : "text-white/20"}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 transition-colors ${done ? "bg-primary/40" : "bg-white/8"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 px-4 sm:px-6 py-10 max-w-2xl mx-auto w-full">
        {step === 0 && (
          <Step0Persona onNext={handlePersonaNext} />
        )}
        {step === 1 && (
          <Step1Company
            form={companyForm} onChange={setCompanyForm}
            persona={persona}
            selectedJurisdictions={selectedJurisdictions} onJurisdictionsChange={setSelectedJurisdictions}
            selectedIndustries={selectedIndustries} onIndustriesChange={setSelectedIndustries}
            onBack={() => setStep(0)} onNext={handleCompanyNext}
          />
        )}
        {step === 2 && (
          <Step2ContractType
            values={selectedContractTypes} industries={selectedIndustries} persona={persona}
            onChange={setSelectedContractTypes}
            onBack={() => setStep(1)} onNext={handleContractTypeNext}
          />
        )}
        {step === 3 && <Step3Playbook playbook={playbook} onUpdate={updateRule} onBack={() => setStep(2)} onNext={() => setStep(4)} />}
        {step === 4 && <Step4Approvers contacts={contacts} persona={persona} onChange={setContacts} onBack={() => setStep(3)} onNext={() => setStep(5)} />}
        {step === 5 && <Step5Regulations companyForm={companyForm} detected={regulationsDetected} onDetected={() => setRegulationsDetected(true)} onBack={() => setStep(4)} onNext={() => setStep(6)} />}
        {step === 6 && <Step6Done persona={persona} saving={saving} error={finishError} onBack={() => setStep(5)} onFinish={handleFinish} />}
      </main>
    </div>
  );
}

// ─── Step 0: Persona ──────────────────────────────────────────────────────────

const PERSONA_CONFIG: {
  id: Persona;
  icon: string;
  label: string;
  tagline: string;
  bullets: string[];
  badge?: string;
}[] = [
  {
    id: "CORPORATE",
    icon: "🏛️",
    label: "In-house legal team",
    tagline: "Lean legal function reviewing commercial contracts day-to-day.",
    bullets: [
      "Supplier, customer & operational contracts",
      "Company playbook with your standard positions",
      "Regulatory compliance mapped to your sector",
      "Escalation matrix for approvals",
    ],
  },
  {
    id: "FOUNDER",
    icon: "🚀",
    label: "Founder / Startup",
    tagline: "Reviewing investment documents, commercial deals & growth contracts.",
    bullets: [
      "Investment terms: liquidation preference, anti-dilution, drag-along",
      "Term sheets, shareholder agreements, convertible notes",
      "Commercial & employment contracts as you scale",
      "Know what to push back on before you sign",
    ],
    badge: "Includes investment clause library",
  },
  {
    id: "PE_FUND",
    icon: "📊",
    label: "PE / M&A fund",
    tagline: "Running DD on targets, structuring deals and managing portfolio risk.",
    bullets: [
      "DD contract review across target company",
      "Investment document clause analysis",
      "Portfolio risk appetite configuration",
      "Anticipated regulatory pipeline (UK, EU, US)",
    ],
    badge: "Portfolio DD coming in V2",
  },
];

function Step0Persona({ onNext }: { onNext: (p: Persona) => void }) {
  const [selected, setSelected] = useState<Persona>("CORPORATE");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">How will you use MIKE?</h2>
        <p className="text-white/45 text-sm mt-2 leading-relaxed">
          MIKE adapts its clause library, playbook defaults and output framing to your context.
          You can change this later.
        </p>
      </div>

      <div className="space-y-3">
        {PERSONA_CONFIG.map((p) => {
          const sel = selected === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              className={`w-full text-left rounded-2xl border p-5 transition-all ${
                sel
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/15"
                  : "border-white/10 hover:border-white/20"
              }`}
              style={{ background: sel ? undefined : CARD }}
            >
              <div className="flex items-start gap-4">
                {/* Radio indicator */}
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                  sel ? "border-primary" : "border-white/25"
                }`}>
                  {sel && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl">{p.icon}</span>
                    <span className="text-sm font-semibold text-white">{p.label}</span>
                    {p.badge && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-primary/30 text-primary/80 bg-primary/10">
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/50 mt-1 mb-3 leading-relaxed">{p.tagline}</p>
                  <ul className="space-y-1.5">
                    {p.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-xs text-white/40">
                        <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${sel ? "bg-primary" : "bg-white/20"}`} />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={() => onNext(selected)}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

// ─── Step 1: Company ──────────────────────────────────────────────────────────

function Step1Company({ form, onChange, persona, selectedJurisdictions, onJurisdictionsChange, selectedIndustries, onIndustriesChange, onBack, onNext }: {
  form: CompanyForm;
  onChange: (f: CompanyForm) => void;
  persona: Persona;
  selectedJurisdictions: string[];
  onJurisdictionsChange: (j: string[]) => void;
  selectedIndustries: Industry[];
  onIndustriesChange: (i: Industry[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const canProceed = Boolean(form.name.trim()) && selectedJurisdictions.length > 0 && selectedIndustries.length > 0;

  function toggleJurisdiction(value: string) {
    onJurisdictionsChange(
      selectedJurisdictions.includes(value)
        ? selectedJurisdictions.filter((j) => j !== value)
        : [...selectedJurisdictions, value]
    );
  }

  function toggleIndustry(value: Industry) {
    const next = selectedIndustries.includes(value)
      ? selectedIndustries.filter((i) => i !== value)
      : [...selectedIndustries, value];
    onIndustriesChange(next);
    const autoFilled = selectedIndustries.map((i) => INDUSTRY_LABELS[i]).join(", ");
    if (!form.sector.trim() || form.sector === autoFilled) {
      onChange({ ...form, sector: next.map((i) => INDUSTRY_LABELS[i]).join(", ") });
    }
  }

  const allIndustries = Object.entries(INDUSTRY_LABELS) as [Industry, string][];

  // Persona-adapted heading
  const headings: Record<Persona, { title: string; sub: string }> = {
    CORPORATE: { title: "Tell MIKE about your company", sub: "This shapes your playbook defaults and regulatory detection." },
    FOUNDER:   { title: "Tell MIKE about your startup", sub: "This configures your investment clause defaults and operational playbook." },
    PE_FUND:   { title: "Tell MIKE about your fund", sub: "This configures your deal analysis framework and portfolio risk appetite." },
  };
  const { title, sub } = headings[persona];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
        <p className="text-white/45 text-sm mt-2 leading-relaxed">
          {sub} Required fields marked <span className="text-red-400">*</span>
        </p>
      </div>

      <div className="space-y-5">

        {/* Company / Fund name */}
        <DarkField label={persona === "PE_FUND" ? "Fund name" : persona === "FOUNDER" ? "Company name" : "Company name"} required>
          <DarkInput
            placeholder={persona === "PE_FUND" ? "Apex Capital Partners" : "Acme Ltd"}
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
          />
        </DarkField>

        {/* Industry multi-select */}
        <DarkField label="Industry" required hint="Select all that apply - MIKE filters contract types and injects sector-specific clauses.">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
            {allIndustries.map(([value, label]) => {
              const sel = selectedIndustries.includes(value);
              return (
                <button key={value} type="button" onClick={() => toggleIndustry(value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all text-xs ${
                    sel ? "border-primary bg-primary/15 text-white" : "border-white/10 text-white/45 hover:border-white/25 hover:text-white/75"
                  }`}
                  style={{ background: sel ? undefined : CARD }}
                >
                  <div className={`w-3.5 h-3.5 rounded shrink-0 flex items-center justify-center transition-colors ${sel ? "bg-primary" : "border border-white/20"}`}>
                    {sel && <span className="text-white text-[9px] font-bold">✓</span>}
                  </div>
                  <span className="text-base shrink-0">{INDUSTRY_ICONS[value]}</span>
                  <span className="leading-tight truncate">{label}</span>
                </button>
              );
            })}
          </div>
          {selectedIndustries.length === 0 && <p className="text-xs text-red-400 mt-1">Select at least one industry</p>}
        </DarkField>

        {/* Sector */}
        <DarkField label="Sector" hint="Auto-filled from industry - edit to be more specific (e.g. 'Mobile F2P gaming').">
          <DarkInput
            placeholder="e.g. Mobile gaming, B2B SaaS, Commercial property"
            value={form.sector}
            onChange={(e) => onChange({ ...form, sector: e.target.value })}
          />
        </DarkField>

        {/* Jurisdictions */}
        <DarkField label="Jurisdictions" required hint="Select all that apply.">
          <div className="grid grid-cols-2 gap-2 mt-1">
            {JURISDICTION_OPTIONS.map(({ value, label }) => {
              const checked = selectedJurisdictions.includes(value);
              return (
                <label key={value} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm cursor-pointer transition-all ${
                  checked ? "border-primary bg-primary/10 text-white" : "border-white/10 text-white/45 hover:border-white/25 hover:text-white/75"
                }`} style={{ background: checked ? undefined : CARD }}>
                  <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleJurisdiction(value)} />
                  <div className={`w-3.5 h-3.5 rounded shrink-0 flex items-center justify-center ${checked ? "bg-primary" : "border border-white/20"}`}>
                    {checked && <span className="text-white text-[9px] font-bold">✓</span>}
                  </div>
                  {label}
                </label>
              );
            })}
          </div>
          {selectedJurisdictions.length === 0 && <p className="text-xs text-red-400 mt-1">Select at least one jurisdiction</p>}
        </DarkField>

        {/* Role - only show for CORPORATE/FOUNDER; PE_FUND is investor */}
        {persona !== "PE_FUND" && (
          <DarkField label="Your typical contract role" required>
            <DarkSelect value={form.role} onChange={(v) => onChange({ ...form, role: v as CompanyRole })} options={[
              { value: "BUYER",    label: "Buyer / Customer" },
              { value: "SUPPLIER", label: "Supplier / Vendor" },
              { value: "BOTH",     label: "Both" },
            ]} />
          </DarkField>
        )}

        {/* Risk appetite */}
        <DarkField label={persona === "PE_FUND" ? "Fund risk appetite" : "Risk appetite"} required hint="Sets default clause positions - adjust each one in the playbook step.">
          <div className="grid grid-cols-3 gap-2 mt-1">
            {([
              { value: "CONSERVATIVE", label: "Conservative", sub: persona === "PE_FUND" ? "Maximum investor protection" : "Maximum protection" },
              { value: "MODERATE",     label: "Moderate",     sub: "Balanced (recommended)" },
              { value: "COMMERCIAL",   label: "Commercial",   sub: persona === "FOUNDER" ? "Founder-friendly" : "Deal-oriented" },
            ] as const).map((opt) => {
              const sel = form.riskAppetite === opt.value;
              return (
                <button key={opt.value} type="button" onClick={() => onChange({ ...form, riskAppetite: opt.value })}
                  className={`flex flex-col gap-0.5 px-3 py-3 rounded-xl border text-left transition-all ${
                    sel ? "border-primary bg-primary/15 text-white" : "border-white/10 text-white/45 hover:border-white/25"
                  }`} style={{ background: sel ? undefined : CARD }}>
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <span className="text-[10px] text-white/35 leading-tight">{opt.sub}</span>
                </button>
              );
            })}
          </div>
        </DarkField>
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-sm text-white/40 hover:text-white/70 transition-colors">← Back</button>
        <button onClick={onNext} disabled={!canProceed}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary/25 disabled:opacity-30 disabled:pointer-events-none">
          Next: Contract types →
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Contract types ───────────────────────────────────────────────────

function Step2ContractType({ values, industries, persona, onChange, onBack, onNext }: {
  values: string[];
  industries: Industry[];
  persona: Persona;
  onChange: (v: string[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const filtered = getContractTypesForPersonaAndIndustry(persona, industries);
  const groupsSeen = new Set<string>();
  const groups: string[] = [];
  for (const ct of filtered) {
    if (!groupsSeen.has(ct.group)) { groupsSeen.add(ct.group); groups.push(ct.group); }
  }

  function toggle(ctValue: string) {
    onChange(values.includes(ctValue) ? values.filter((v) => v !== ctValue) : [...values, ctValue]);
  }

  const isGaming = industries.includes("GAMING_INTERACTIVE");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Contract types</h2>
        <p className="text-white/45 text-sm mt-2">Select all the types you regularly deal with. MIKE will inject the right clauses for each.</p>
      </div>

      {/* Persona + industry tags */}
      <div className="flex flex-wrap gap-2">
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/15 bg-white/5 text-xs text-white/50">
          {persona === "CORPORATE" ? "🏛️ In-house" : persona === "FOUNDER" ? "🚀 Founder" : "📊 PE / M&A"}
        </span>
        {industries.map((ind) => (
          <span key={ind} className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-xs text-white/70">
            <span>{INDUSTRY_ICONS[ind]}</span>
            <span>{INDUSTRY_LABELS[ind]}</span>
          </span>
        ))}
      </div>

      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group}>
            <div className="text-[10px] uppercase tracking-widest text-white/25 font-semibold mb-2 px-1">{group}</div>
            <div className="space-y-2">
              {filtered.filter((ct) => ct.group === group).map((ct) => {
                const sel = values.includes(ct.value);
                return (
                  <button key={ct.value} onClick={() => toggle(ct.value)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all flex items-center gap-3 ${
                      sel ? "border-primary bg-primary/10 text-white" : "border-white/10 text-white/55 hover:border-white/25 hover:text-white/80"
                    }`} style={{ background: sel ? undefined : CARD }}>
                    <div className={`w-4 h-4 rounded shrink-0 flex items-center justify-center ${sel ? "bg-primary" : "border border-white/20"}`}>
                      {sel && <span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                    <span className="flex-1 font-medium">{ct.label}</span>
                    {PROPERTY_CONTRACT_TYPES.includes(ct.value) && (
                      <span className="text-[10px] text-primary/70 font-normal shrink-0">+ property clauses</span>
                    )}
                    {INVESTMENT_CONTRACT_TYPES.includes(ct.value) && (
                      <span className="text-[10px] text-primary/70 font-normal shrink-0">+ investment clauses</span>
                    )}
                    {["PLATFORM_PUBLISHING","REVENUE_SHARE","ESPORTS_SPONSORSHIP","CONTENT_LICENSE"].includes(ct.value) && isGaming && (
                      <span className="text-[10px] text-primary/70 font-normal shrink-0">+ gaming clauses</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {values.length === 0 && <p className="text-xs text-red-400">Select at least one contract type</p>}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-sm text-white/40 hover:text-white/70 transition-colors">← Back</button>
        <button onClick={onNext} disabled={values.length === 0}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary/25 disabled:opacity-30 disabled:pointer-events-none">
          Next: Playbook →
        </button>
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
  const [expanded, setExpanded] = useState<ClauseCategory | null>(playbook[0]?.clauseCategory ?? null);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Calibrate your playbook</h2>
        <p className="text-white/45 text-sm mt-2 leading-relaxed">
          Pre-filled from your risk appetite. Expand each clause to adjust. Focus on positions specific to your company.
        </p>
      </div>
      <div className="space-y-2">
        {playbook.map((rule) => {
          const isOpen = expanded === rule.clauseCategory;
          return (
            <div key={rule.clauseCategory} className="rounded-xl border border-white/10 overflow-hidden" style={{ background: CARD }}>
              <button
                className="w-full text-left px-4 py-3.5 flex items-center justify-between text-sm font-semibold text-white/80 hover:text-white hover:bg-white/3 transition-colors"
                onClick={() => setExpanded(isOpen ? null : rule.clauseCategory)}
              >
                <span>{CLAUSE_LABELS[rule.clauseCategory]}</span>
                <span className="text-white/25 text-xs">{isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <div className="border-t border-white/8 px-4 pb-4 pt-3 space-y-3" style={{ background: CARD2 }}>
                  <DarkTextarea label="Preferred position" value={rule.preferredPosition}
                    onChange={(v) => onUpdate(rule.clauseCategory, "preferredPosition", v)} />
                  <DarkTextarea label="Acceptable fallback" value={rule.acceptableFallback}
                    onChange={(v) => onUpdate(rule.clauseCategory, "acceptableFallback", v)} />
                  <DarkTextarea label="Hard red line (non-negotiable)" value={rule.hardRedLine}
                    onChange={(v) => onUpdate(rule.clauseCategory, "hardRedLine", v)} />
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Who approves exceptions?</label>
                    <DarkSelect value={rule.approvalRequired ?? ""} onChange={(v) => onUpdate(rule.clauseCategory, "approvalRequired", v)}
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
      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-sm text-white/40 hover:text-white/70 transition-colors">← Back</button>
        <button onClick={onNext}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary/25">
          Next: Approvers →
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Approvers ────────────────────────────────────────────────────────

function Step4Approvers({ contacts, persona, onChange, onBack, onNext }: {
  contacts: Contact[];
  persona: Persona;
  onChange: (c: Contact[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  function update(i: number, field: keyof Contact, value: string) {
    const updated = [...contacts];
    updated[i] = { ...updated[i], [field]: value };
    onChange(updated);
  }

  const ROLE_LABELS: Record<ApprovalRole, { label: string; sub: string }> = {
    LEGAL: { label: "Legal team",      sub: persona === "PE_FUND" ? "Deal legal review" : "Day-to-day clause review" },
    GC:    { label: "General Counsel", sub: "High-risk decisions" },
    CFO:   { label: persona === "PE_FUND" ? "CFO / Finance partner" : "CFO", sub: "Financial exposure thresholds" },
    BOARD: { label: persona === "PE_FUND" ? "Investment committee" : "Board", sub: "Material contracts" },
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          {persona === "PE_FUND" ? "Approvals & escalation" : "Approval matrix"}
        </h2>
        <p className="text-white/45 text-sm mt-2">
          When MIKE triggers an escalation, it names the right person. Leave blank if not applicable.
        </p>
      </div>
      <div className="space-y-3">
        {contacts.map((c, i) => (
          <div key={c.role} className="rounded-xl border border-white/10 p-5 space-y-4" style={{ background: CARD }}>
            <div>
              <div className="text-sm font-semibold text-white">{ROLE_LABELS[c.role].label}</div>
              <div className="text-xs text-white/35 mt-0.5">{ROLE_LABELS[c.role].sub}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Name</label>
                <DarkInput placeholder="Jane Smith" value={c.name} onChange={(e) => update(i, "name", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Email</label>
                <DarkInput type="email" placeholder="jane@company.com" value={c.email} onChange={(e) => update(i, "email", e.target.value)} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-sm text-white/40 hover:text-white/70 transition-colors">← Back</button>
        <button onClick={onNext}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary/25">
          Next: Regulations →
        </button>
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
  const [regs, setRegs] = useState<{ frameworkName: string; regulator: string }[]>([]);
  const [error, setError] = useState("");

  async function detect() {
    setDetecting(true);
    setError("");
    try {
      const result = await detectRegulations();
      setRegs(result);
      onDetected();
    } catch {
      setError("Could not detect frameworks - skip for now and detect later from the Regulations page.");
    } finally {
      setDetecting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Regulatory environment</h2>
        <p className="text-white/45 text-sm mt-2 leading-relaxed">
          MIKE auto-detects applicable regulations from your sector and jurisdiction, then flags clauses that conflict with your obligations.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 p-5 space-y-4" style={{ background: CARD }}>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-1">Industry</div>
            <div className="text-white/70">{companyForm.industry.split(", ").map((i) => INDUSTRY_LABELS[i as Industry] ?? i).join(", ")}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-1">Jurisdiction</div>
            <div className="text-white/70">{companyForm.jurisdiction}</div>
          </div>
        </div>

        {!detected ? (
          <button onClick={detect} disabled={detecting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50">
            {detecting
              ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Detecting…</>
              : "Detect applicable regulations"
            }
          </button>
        ) : null}

        {error && <p className="text-xs text-amber-400">{error}</p>}

        {detected && regs.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle size={14} /> {regs.length} frameworks detected
            </div>
            <div className="space-y-1.5">
              {regs.map((r) => (
                <div key={r.frameworkName} className="flex items-center gap-2 text-xs text-white/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {r.frameworkName} <span className="text-white/25">· {r.regulator}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {detected && regs.length === 0 && (
          <p className="text-sm text-white/40">No specific frameworks detected. MIKE will apply general contract standards.</p>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-sm text-white/40 hover:text-white/70 transition-colors">← Back</button>
        <button onClick={onNext}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary/25">
          {detected ? "Next: Launch →" : "Skip for now →"}
        </button>
      </div>
    </div>
  );
}

// ─── Step 6: Done ─────────────────────────────────────────────────────────────

function Step6Done({ persona, saving, error, onBack, onFinish }: {
  persona: Persona;
  saving: boolean;
  error?: string;
  onBack: () => void;
  onFinish: () => void;
}) {
  const bullets: Record<Persona, string[]> = {
    CORPORATE: [
      "Upload counterparty paper (PDF or DOCX)",
      "MIKE extracts and classifies key clauses automatically",
      "Each clause is compared against your playbook + live regulations",
      "You get a Red / Amber / Green risk report with fallback language",
      "MIKE tells you exactly what to push back on and who needs to approve",
    ],
    FOUNDER: [
      "Upload term sheets, shareholder agreements or commercial contracts",
      "MIKE flags investment clause traps: participating preferred, full ratchet, drag-along",
      "Operational contracts reviewed against your standard positions",
      "Plain-English explanation of what each clause means for you as founder",
      "Know what to push back on before you sign",
    ],
    PE_FUND: [
      "Upload target company contracts for DD review",
      "MIKE maps risk exposure across the contract portfolio",
      "Investment terms compared against your deal criteria",
      "Escalation triggers surfaced for IC review",
      "Portfolio risk appetite applied consistently across all deals",
    ],
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">MIKE is ready</h2>
        <p className="text-white/45 text-sm mt-2">Your playbook is set. Upload your first contract and MIKE will review it within minutes.</p>
      </div>

      <div className="rounded-xl border border-white/10 p-6 space-y-4" style={{ background: CARD }}>
        <div className="text-sm font-semibold text-white">What happens next</div>
        <ul className="space-y-3">
          {bullets[persona].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-white/50">
              <CheckCircle size={14} className="text-primary mt-0.5 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-sm text-white/40 hover:text-white/70 transition-colors">← Back</button>
        <button onClick={onFinish} disabled={saving}
          className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity shadow-xl shadow-primary/30 disabled:opacity-50">
          {saving ? (
            <><span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Setting up…</>
          ) : "Launch MIKE →"}
        </button>
      </div>
    </div>
  );
}

// ─── Dark-mode primitives ─────────────────────────────────────────────────────

function DarkField({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-white/70">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-white/30 leading-relaxed">{hint}</p>}
      {children}
    </div>
  );
}

function DarkInput({ placeholder, value, onChange, type = "text" }: {
  placeholder?: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className="w-full rounded-xl border border-white/10 px-3.5 py-2.5 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-colors"
      style={{ background: CARD }}
    />
  );
}

function DarkSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-white/10 px-3.5 py-2.5 text-sm text-white/70 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-colors"
      style={{ background: CARD }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function DarkTextarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{label}</label>
      <textarea
        className="w-full rounded-xl border border-white/10 px-3.5 py-2.5 text-sm text-white/70 placeholder:text-white/20 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-colors min-h-[80px] resize-y"
        style={{ background: CARD2 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
