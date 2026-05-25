import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Search, Loader2, Building2, ChevronDown } from "lucide-react";
import { ZaneLogo } from "../components/ZaneLogo";
import { createCompany, savePlaybookRules, saveContacts, detectRegulations, searchCompany, enrichCompanyData, saveGovernanceThresholds, saveGovernanceTriggers, sendTeamInvites, getMe } from "../lib/api";
import type { CompanyCandidate, EnrichedCompany } from "../lib/api";
import {
  CLAUSE_CATEGORIES,
  CLAUSE_LABELS,
  PLAYBOOK_DEFAULTS,
  GAMING_CLAUSE_CATEGORIES,
  INVESTMENT_CLAUSE_CATEGORIES,
  INSURANCE_CLAUSE_CATEGORIES,
  LOGISTICS_CLAUSE_CATEGORIES,
  INDUSTRY_LABELS,
  getIndustryClauseCategories,
  type ClauseCategory,
  type RiskAppetite,
  type CompanyRole,
  type ApprovalRole,
  type Industry,
  type Persona,
  type WorkflowType,
  type CompanyRegulation,
} from "../lib/types";

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

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

const STEPS = ["Workflow", "Persona", "Company", "Contracts", "Playbook", "Governance", "Team", "Regulations", "Done"];

// ─── Industry config ──────────────────────────────────────────────────────────


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
  { value: "CARRIER_HAULIER",        label: "Carrier / Haulier Agreement",           group: "Logistics",      industries: ["LOGISTICS_SUPPLY", "MANUFACTURING_SUPPLY"] as Industry[] },
  { value: "WAREHOUSE_3PL",          label: "Warehouse / 3PL Agreement",             group: "Logistics",      industries: ["LOGISTICS_SUPPLY"] as Industry[] },
  { value: "FREIGHT_FORWARDING",     label: "Freight Forwarding Terms",               group: "Logistics",      industries: ["LOGISTICS_SUPPLY"] as Industry[] },
  { value: "LAST_MILE",              label: "Last Mile Delivery Agreement",           group: "Logistics",      industries: ["LOGISTICS_SUPPLY"] as Industry[] },
  { value: "CROSS_BORDER",           label: "Cross-border / International Carriage",  group: "Logistics",      industries: ["LOGISTICS_SUPPLY"] as Industry[] },
  { value: "CUSTOMS_AGENCY",         label: "Customs Agency Agreement",               group: "Logistics",      industries: ["LOGISTICS_SUPPLY"] as Industry[] },
  { value: "SUBCONTRACTOR_LOG",      label: "Subcontractor Agreement",               group: "Logistics",      industries: ["LOGISTICS_SUPPLY"] as Industry[] },
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
  { value: "TERM_SHEET",             label: "Term Sheet / Investment Terms",          group: "Investment",     industries: [], personas: ["FOUNDER"] },
  { value: "SUBSCRIPTION_AGREEMENT", label: "Subscription / Investment Agreement",   group: "Investment",     industries: [], personas: ["FOUNDER"] },
  { value: "SHA",                    label: "Shareholders' Agreement (SHA)",          group: "Investment",     industries: [], personas: ["FOUNDER"] },
  { value: "CONVERTIBLE_NOTE",       label: "Convertible Loan Note (CLN)",           group: "Investment",     industries: [], personas: ["FOUNDER"] },
  { value: "SAFE",                   label: "Simple Agreement for Future Equity (SAFE)", group: "Investment", industries: [], personas: ["FOUNDER"] },
  { value: "INVESTMENT_AGREEMENT",   label: "Investment Agreement",                  group: "Investment",     industries: [], personas: ["FOUNDER"] },
  { value: "OTHER",                  label: "Other",                                 group: "Other",          industries: [] },
];

const PROPERTY_CONTRACT_TYPES = ["COMMERCIAL_LEASE", "LICENSE_AGREEMENT", "AGREEMENT_FOR_LEASE"];
const INVESTMENT_CONTRACT_TYPES = ["TERM_SHEET","SUBSCRIPTION_AGREEMENT","SHA","CONVERTIBLE_NOTE","SAFE","INVESTMENT_AGREEMENT","SHARE_PURCHASE"];

const LITIGATION_CLAIM_TYPES: { value: string; label: string; sub: string; group: string }[] = [
  // Motor
  { value: "MOTOR_PI",          label: "Motor: Personal Injury",      sub: "RTA injuries, whiplash, serious injury",                      group: "Motor" },
  { value: "MOTOR_PROPERTY",    label: "Motor: Property Damage",      sub: "Vehicle damage, third party property",                        group: "Motor" },
  // Liability
  { value: "EMPLOYERS_LI",      label: "Employers Liability",          sub: "Workplace accidents, occupational disease",                   group: "Liability" },
  { value: "PUBLIC_LI",         label: "Public Liability",             sub: "Slips, trips, third party injury or damage",                  group: "Liability" },
  { value: "PRODUCT_LI",        label: "Product Liability",            sub: "Defective products causing injury or damage",                 group: "Liability" },
  // Professional
  { value: "PROF_INDEMNITY",    label: "Professional Indemnity",       sub: "Solicitors, accountants, surveyors, architects",              group: "Professional" },
  { value: "CLINICAL_NEG",      label: "Clinical Negligence",          sub: "Medical malpractice, surgical errors, NHS claims",            group: "Professional" },
  { value: "DO",                label: "Directors & Officers",         sub: "Wrongful acts, breach of duty, corporate governance",         group: "Professional" },
  // Property & Specialist
  { value: "PROPERTY_DAMAGE",   label: "Property / Material Damage",   sub: "Commercial and residential property loss",                    group: "Property & Specialist" },
  { value: "CYBER",             label: "Cyber & Data Breach",          sub: "Ransomware, data theft, business interruption",               group: "Property & Specialist" },
  { value: "MARINE_CARGO",      label: "Marine Cargo",                 sub: "Cargo loss, hull damage, international transit",              group: "Property & Specialist" },
  { value: "CONSTRUCTION",      label: "Construction / Engineering",   sub: "JCT, NEC, contractor negligence, latent defects",             group: "Property & Specialist" },
  { value: "ENVIRONMENTAL",     label: "Environmental",                sub: "Pollution, contamination, regulatory breach",                 group: "Property & Specialist" },
  // Civil & Other
  { value: "COMMERCIAL_CIVIL",  label: "Commercial Civil",             sub: "Contract disputes, debt recovery, fraud",                     group: "Civil & Other" },
  { value: "PROPERTY_LIT",      label: "Property Litigation",          sub: "Landlord & tenant, boundary, adverse possession",             group: "Civil & Other" },
  { value: "EMPLOYMENT_LIT",    label: "Employment",                   sub: "Unfair dismissal, discrimination, TUPE",                      group: "Civil & Other" },
  { value: "INSOLVENCY",        label: "Insolvency",                   sub: "Administration, liquidation, creditor claims",                group: "Civil & Other" },
  { value: "REGULATORY",        label: "Regulatory / FCA",             sub: "FCA enforcement, SRA proceedings, public law",               group: "Civil & Other" },
];

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
  { value: "England & Wales", label: "England & Wales" },
  { value: "Scotland",        label: "Scotland" },
  { value: "Ireland",         label: "Ireland" },
  { value: "Netherlands",     label: "Netherlands" },
  { value: "Switzerland",     label: "Switzerland" },
  { value: "European Union",  label: "European Union" },
  { value: "United States",   label: "United States (Federal)" },
  { value: "New York",        label: "New York (US)" },
  { value: "California",      label: "California (US)" },
  { value: "Canada",          label: "Canada" },
  { value: "Singapore",       label: "Singapore" },
  { value: "Hong Kong",       label: "Hong Kong" },
  { value: "Japan",           label: "Japan" },
  { value: "UAE / DIFC",      label: "UAE / DIFC" },
  { value: "UAE / ADGM",      label: "UAE / ADGM" },
  { value: "KSA",             label: "Saudi Arabia (KSA)" },
  { value: "South Korea",     label: "South Korea" },
  { value: "India",           label: "India" },
  { value: "Brazil",          label: "Brazil" },
];

// ─── Dark palette helpers ─────────────────────────────────────────────────────

const BG    = "#0B1020";
const CARD  = "#0F172A";
const CARD2 = "#111827";

// ─── Main component ───────────────────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(0);
  const [workflowType, setWorkflowType] = useState<WorkflowType>("COMMERCIAL_CONTRACT");
  const [persona, setPersona] = useState<Persona>("CORPORATE");
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<string[]>(["England & Wales"]);
  const [selectedIndustries, setSelectedIndustries] = useState<Industry[]>([]);
  const [companyForm, setCompanyForm] = useState<CompanyForm>({
    name: "",
    sector: "",
    jurisdiction: "England & Wales",
    role: "BUYER",
    riskAppetite: "MODERATE",
    industry: "OTHER",
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

  // Governance thresholds (contract value bands)
  const [thresholds, setThresholds] = useState([
    { minValue: 0, maxValue: 25000, requiredApprover: "NONE", label: "Up to £25,000" },
    { minValue: 25000, maxValue: 250000, requiredApprover: "CFO", label: "£25,001 – £250,000" },
    { minValue: 250000, maxValue: null as number | null, requiredApprover: "BOARD", label: "Over £250,000" },
  ]);
  // Governance triggers (always-escalate clause categories)
  const [governanceTriggers, setGovernanceTriggers] = useState<Array<{ clauseCategory: string; escalateTo: string; reason: string }>>([
    { clauseCategory: "CHANGE_OF_CONTROL", escalateTo: "GC", reason: "Change of control always requires GC sign-off." },
    { clauseCategory: "ASSIGNMENT", escalateTo: "GC", reason: "Assignment of contractual rights requires GC approval." },
  ]);
  // Team invite emails
  const [teamInviteEmails, setTeamInviteEmails] = useState<string[]>([]);

  const companyMutation = useMutation({ mutationFn: createCompany });

  function initPlaybook(appetite: RiskAppetite, isProperty: boolean, isGaming: boolean, isInvestment: boolean, wfType: WorkflowType = "COMMERCIAL_CONTRACT", industries: Industry[] = []) {
    const defaults = PLAYBOOK_DEFAULTS[appetite];
    if (wfType === "INSURANCE_LITIGATION") {
      return INSURANCE_CLAUSE_CATEGORIES.map((cat) => ({ clauseCategory: cat, ...defaults[cat], riskWeight: 3 }));
    }
    if (wfType === "LOGISTICS_CONTRACT") {
      return LOGISTICS_CLAUSE_CATEGORIES.map((cat) => ({ clauseCategory: cat, ...defaults[cat], riskWeight: 3 }));
    }
    const PROPERTY_ONLY: ClauseCategory[] = ["RENT_REVIEW", "BREAK_CLAUSE", "REPAIR_OBLIGATIONS", "SERVICE_CHARGE"];
    const coreCategories = CLAUSE_CATEGORIES
      .filter((cat) => {
        if (PROPERTY_ONLY.includes(cat))                  return isProperty;
        if (GAMING_CLAUSE_CATEGORIES.includes(cat))       return isGaming;
        if (INVESTMENT_CLAUSE_CATEGORIES.includes(cat))   return isInvestment;
        return true;
      });
    // Append industry-specific categories (deduped) for COMMERCIAL_CONTRACT
    const industrySpecific: ClauseCategory[] = [];
    const seen = new Set<ClauseCategory>(coreCategories);
    for (const industry of industries) {
      for (const cat of getIndustryClauseCategories(industry)) {
        if (!seen.has(cat)) {
          seen.add(cat);
          industrySpecific.push(cat);
        }
      }
    }
    return [...coreCategories, ...industrySpecific]
      .map((cat) => ({ clauseCategory: cat, ...defaults[cat], riskWeight: 3 }));
  }

  async function handleQuickStart(companyName: string, chosenIndustries: Industry[]) {
    if (!companyName.trim()) return;
    setSaving(true);
    setFinishError("");
    try {
      const industries: Industry[] = chosenIndustries.length > 0 ? chosenIndustries : ["OTHER"];
      const sector = industries.map((i) => INDUSTRY_LABELS[i]).join(", ");

      const defaults: CompanyForm = {
        name: companyName.trim(),
        sector,
        jurisdiction: "England & Wales",
        role: "BUYER",
        riskAppetite: "MODERATE",
        industry: industries[0],
      };
      const pb = initPlaybook("MODERATE", false, false, false, "COMMERCIAL_CONTRACT", industries);
      await companyMutation.mutateAsync({ ...defaults, persona: "CORPORATE", workflowType: "COMMERCIAL_CONTRACT" });
      const validRules = pb
        .map(({ clauseCategory, preferredPosition, acceptableFallback, hardRedLine, fallbackTemplate, riskWeight }) => ({
          clauseCategory, preferredPosition, acceptableFallback, hardRedLine, fallbackTemplate, riskWeight,
        }))
        .filter((r) => r.preferredPosition?.trim() && r.acceptableFallback?.trim() && r.hardRedLine?.trim());
      await savePlaybookRules(validRules);
      detectRegulations().catch(() => {});
      // Use refetchQueries (not invalidateQueries) so we WAIT for the company
      // data to land in the cache before navigating. invalidateQueries marks the
      // query stale but navigates before the refetch finishes — when the query
      // was previously in error state (404, brand-new user) company stays null
      // on /dashboard and bounces straight back to /onboarding in a loop.
      await queryClient.refetchQueries({ queryKey: ["company"] });
      navigate("/dashboard");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Setup failed - please try again.";
      setFinishError(msg);
    } finally {
      setSaving(false);
    }
  }

  function handleWorkflowNext(chosen: WorkflowType) {
    setWorkflowType(chosen);
    setStep(1);
  }

  function handlePersonaNext(chosen: Persona) {
    setPersona(chosen);
    // Pre-select sensible defaults for founder
    if (chosen === "FOUNDER") {
      setSelectedContractTypes(["TERM_SHEET", "SUBSCRIPTION_AGREEMENT", "SHA"]);
    } else {
      setSelectedContractTypes(["SUPPLIER_AGREEMENT"]);
    }
    setStep(2);
  }

  function handleCompanyNext() {
    if (!companyForm.name.trim()) return;
    const jurisdictionStr = selectedJurisdictions.join(", ") || "England & Wales";
    const industryStr     = selectedIndustries.join(", ") || "OTHER";
    const sectorStr       = companyForm.sector.trim() || selectedIndustries.map((i) => INDUSTRY_LABELS[i]).join(", ");
    setCompanyForm((prev) => ({ ...prev, jurisdiction: jurisdictionStr, industry: industryStr, sector: sectorStr }));

    // Founder persona: skip contract-type, playbook, and approvers
    // - auto-initialise investment playbook and jump straight to Launch
    if (persona === "FOUNDER") {
      setPlaybook(initPlaybook(companyForm.riskAppetite, false, false, true, workflowType, selectedIndustries));
      setStep(8);
    } else {
      setStep(3);
    }
  }

  function handleContractTypeNext() {
    const isProperty   = selectedContractTypes.some((ct) => PROPERTY_CONTRACT_TYPES.includes(ct));
    const isGaming     = selectedIndustries.includes("GAMING_INTERACTIVE");
    const isInvestment = persona === "FOUNDER" ||
                         selectedContractTypes.some((ct) => INVESTMENT_CONTRACT_TYPES.includes(ct));
    setPlaybook(initPlaybook(companyForm.riskAppetite, isProperty, isGaming, isInvestment, workflowType, selectedIndustries));
    setStep(4);
  }

  function updateRule(cat: ClauseCategory, field: keyof PlaybookEntry, value: string) {
    setPlaybook((prev) => prev.map((r) => (r.clauseCategory === cat ? { ...r, [field]: value } : r)));
  }

  /** Creates (or re-creates) the company, then runs regulatory detection.
   *  Uses createCompany directly (not companyMutation) to avoid sharing
   *  useMutation state with handleFinish. Returns full regulation objects
   *  so Step 6 can display jurisdiction + industry groupings. */
  async function runDetection(): Promise<CompanyRegulation[]> {
    // Refresh Bearer token before the auth-required calls below.
    await getMe().catch(() => {});
    await createCompany({ ...companyForm, persona, workflowType });
    return detectRegulations();
  }

  async function handleFinish() {
    setSaving(true);
    setFinishError("");
    try {
      // Step 0: Refresh the Bearer token so it is current before any auth-required
      // API call. This guards against the token being wiped by a transient background
      // refetch failure (e.g. window-focus re-fetch while on a slow connection).
      // We swallow errors here — if getMe fails, we still try with the cookie.
      await getMe().catch(() => {});

      // Step 1: Always (re)create the company - idempotent because POST /api/company
      // deletes any existing company first (single-company mode).
      try {
        await companyMutation.mutateAsync({ ...companyForm, persona, workflowType });
      } catch (e) {
        throw new Error(`Company setup failed: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Step 2: Save playbook rules - filter out any entries missing required fields
      // (can happen if the user cleared a text area or if a category has no default)
      const validRules = playbook
        .map(({ clauseCategory, preferredPosition, acceptableFallback, hardRedLine, approvalRequired, fallbackTemplate, riskWeight }) => ({
          clauseCategory, preferredPosition, acceptableFallback, hardRedLine, approvalRequired, fallbackTemplate, riskWeight,
        }))
        .filter((r) => r.preferredPosition?.trim() && r.acceptableFallback?.trim() && r.hardRedLine?.trim());

      try {
        await savePlaybookRules(validRules);
      } catch (e) {
        throw new Error(`Playbook save failed: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Step 3: Save contacts (optional)
      const validContacts = contacts.filter((c) => c.name && c.email);
      if (validContacts.length > 0) {
        try {
          await saveContacts(validContacts);
        } catch (e) {
          console.warn("[handleFinish] contacts save failed (non-fatal):", e);
        }
      }

      // Step 4: Save approval thresholds - fire-and-forget
      if (thresholds.length > 0) {
        saveGovernanceThresholds(thresholds).catch((e) => console.warn("[handleFinish] thresholds save:", e));
      }

      // Step 5: Save governance triggers - fire-and-forget
      if (governanceTriggers.length > 0) {
        saveGovernanceTriggers(governanceTriggers).catch((e) => console.warn("[handleFinish] triggers save:", e));
      }

      // Step 6: Send team invites - fire-and-forget
      if (teamInviteEmails.length > 0) {
        sendTeamInvites(teamInviteEmails).catch((e) => console.warn("[handleFinish] invites:", e));
      }

      // Step 7: Detect regs - fire-and-forget, never blocks navigation
      detectRegulations().catch(() => {});

      // Use refetchQueries so the fresh company lands in cache before navigating.
      // invalidateQueries + navigate races and leaves company=null on the dashboard
      // route (error state from the pre-creation 404), causing an /onboarding loop.
      await queryClient.refetchQueries({ queryKey: ["company"] });
      navigate("/dashboard");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong - please try again.";
      setFinishError(msg);
      console.error("[handleFinish]", e);
    } finally {
      setSaving(false);
    }
  }

  // Founder persona uses only 3 visible steps (0→1→2→8=launch)
  const isFounderFlow = persona === "FOUNDER";
  const effectiveStepCount = isFounderFlow ? 3 : STEPS.length;
  // Map actual step index to display progress for founder flow
  const founderDisplayStep = step === 8 ? 3 : step; // steps 0,1,2 stay same; step 8 = last
  const displayStep = isFounderFlow ? founderDisplayStep : step;
  const progressPct = (displayStep / (effectiveStepCount - 1)) * 100;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG }}>

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-white/8 flex items-center gap-3 px-6 py-4 backdrop-blur-md"
        style={{ background: "rgba(11,17,24,0.92)" }}>
        <Link to="/" className="hover:opacity-80 transition-opacity">
          <ZaneLogo size="sm" light={true} />
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <Link to="/" className="text-xs text-white/35 hover:text-white/70 transition-colors hidden sm:block">← Home</Link>
          <span className="text-xs text-white/25">Step {displayStep + 1} of {effectiveStepCount}</span>
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
      <div className="border-b border-white/8 px-6 py-3" style={{ background: "#0F172A" }}>
        <div className="flex items-center gap-0 max-w-2xl">
          {(isFounderFlow ? ["Workflow", "Persona", "About you", "Launch"] : STEPS).map((label, i) => {
            // For founder flow, map display index to actual step: 0→0, 1→1, 2→2, 3→8
            const actualStep = isFounderFlow && i === 3 ? 8 : i;
            const done   = isFounderFlow ? displayStep > i : i < step;
            const active = isFounderFlow ? displayStep === i : i === step;
            void actualStep;
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
                {i < effectiveStepCount - 1 && (
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
          <Step0Workflow onNext={handleWorkflowNext} onQuickStart={(name, industries) => handleQuickStart(name, industries)} saving={saving} finishError={finishError} />
        )}
        {step === 1 && (
          <Step1Persona workflowType={workflowType} onNext={handlePersonaNext} onBack={() => setStep(0)} />
        )}
        {step === 2 && (
          <Step2Company
            form={companyForm} onChange={setCompanyForm}
            persona={persona}
            workflowType={workflowType}
            selectedJurisdictions={selectedJurisdictions} onJurisdictionsChange={setSelectedJurisdictions}
            selectedIndustries={selectedIndustries} onIndustriesChange={setSelectedIndustries}
            onBack={() => setStep(1)} onNext={handleCompanyNext}
          />
        )}
        {step === 3 && (
          <Step3ContractType
            values={selectedContractTypes} industries={selectedIndustries} persona={persona}
            workflowType={workflowType}
            onChange={setSelectedContractTypes}
            onBack={() => setStep(2)} onNext={handleContractTypeNext}
          />
        )}
        {step === 4 && <Step4Playbook playbook={playbook} onUpdate={updateRule} onBack={() => setStep(3)} onNext={() => setStep(5)} />}
        {step === 5 && (
          <Step5Governance
            contacts={contacts} persona={persona} onContactsChange={setContacts}
            thresholds={thresholds} onThresholdsChange={setThresholds}
            triggers={governanceTriggers} onTriggersChange={setGovernanceTriggers}
            onBack={() => setStep(4)} onNext={() => setStep(6)}
          />
        )}
        {step === 6 && (
          <Step6TeamInvite
            emails={teamInviteEmails} onChange={setTeamInviteEmails}
            onBack={() => setStep(5)} onNext={() => setStep(7)}
          />
        )}
        {step === 7 && <Step7Regulations companyForm={companyForm} detected={regulationsDetected} onDetected={() => setRegulationsDetected(true)} onBack={() => setStep(6)} onNext={() => setStep(8)} detectFn={runDetection} />}
        {step === 8 && <Step8Done persona={persona} saving={saving} error={finishError} onBack={() => setStep(persona === "FOUNDER" ? 2 : 7)} onFinish={handleFinish} />}
      </main>
    </div>
  );
}

// ─── Step 0: Workflow selection ───────────────────────────────────────────────

const WORKFLOW_OPTIONS: { value: WorkflowType; label: string; description: string }[] = [
  {
    value: "COMMERCIAL_CONTRACT",
    label: "Commercial contract review",
    description: "Review counterparty paper against your playbook positions. Flags deviations with fallback language and escalation routing.",
  },
  {
    value: "INSURANCE_LITIGATION",
    label: "Litigation",
    description: "Triage and manage claims across insurance, commercial civil, property, employment, and professional indemnity. Coverage analysis through to settlement authority and FCA compliance.",
  },
];

function Step0Workflow({
  onNext,
  onQuickStart,
  saving,
  finishError,
}: {
  onNext: (w: WorkflowType) => void;
  onQuickStart: (name: string, industries: Industry[]) => void;
  saving: boolean;
  finishError: string;
}) {
  const [selected, setSelected] = useState<WorkflowType>("COMMERCIAL_CONTRACT");
  const [quickName, setQuickName] = useState("");
  const [showQuick, setShowQuick] = useState(false);

  // Industry detection state for Quick Start
  const [detecting, setDetecting] = useState(false);
  const [detectedIndustries, setDetectedIndustries] = useState<Industry[]>([]);
  const [selectedQsIndustries, setSelectedQsIndustries] = useState<Industry[]>([]);
  const [detected, setDetected] = useState(false);
  const detectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allIndustries = Object.entries(INDUSTRY_LABELS) as [Industry, string][];

  // Auto-detect when name changes (debounced 700ms)
  useEffect(() => {
    if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
    if (quickName.trim().length < 3) {
      setDetected(false);
      setDetectedIndustries([]);
      setSelectedQsIndustries([]);
      return;
    }
    detectTimerRef.current = setTimeout(async () => {
      setDetecting(true);
      try {
        const { candidates } = await searchCompany(quickName.trim());
        if (candidates.length > 0) {
          const enriched = await enrichCompanyData(candidates[0]);
          const valid = (enriched.mappedIndustries ?? []).filter(
            (i): i is Industry => i in INDUSTRY_LABELS
          );
          setDetectedIndustries(valid);
          setSelectedQsIndustries(valid);
          setDetected(true);
        } else {
          setDetected(false);
          setDetectedIndustries([]);
        }
      } catch {
        setDetected(false);
      } finally {
        setDetecting(false);
      }
    }, 700);
    return () => { if (detectTimerRef.current) clearTimeout(detectTimerRef.current); };
  }, [quickName]);

  function toggleQsIndustry(v: Industry) {
    setSelectedQsIndustries((prev) =>
      prev.includes(v) ? prev.filter((i) => i !== v) : [...prev, v]
    );
  }

  return (
    <div className="space-y-8">
      {/* Quick Start panel */}
      <div className="rounded-2xl border border-[#4A6CF7]/30 bg-[#0B1320] p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#4A6CF7]" />
              <span className="text-xs font-semibold uppercase tracking-widest text-[#4A6CF7]">Quick Start</span>
            </div>
            <h3 className="text-sm font-semibold text-white mt-1">
              Get started in 30 seconds
            </h3>
            <p className="text-xs text-white/40 mt-0.5 leading-relaxed">
              Enter your company name - Zane auto-detects your industry. Adjust, then launch.
            </p>
          </div>
          <button
            onClick={() => setShowQuick((v) => !v)}
            className="text-xs text-[#4A6CF7] hover:text-[#7B9BFA] transition-colors font-medium shrink-0 pt-1"
          >
            {showQuick ? "Cancel" : "Use Quick Start →"}
          </button>
        </div>

        {showQuick && (
          <div className="space-y-4 pt-1 border-t border-white/8">

            {/* Company name */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
                Company name
              </label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-primary transition-colors pr-10"
                  placeholder="e.g. Collins River Enterprises Limited"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  autoFocus
                />
                {detecting && (
                  <Loader2 size={13} className="animate-spin text-primary/60 absolute right-3 top-1/2 -translate-y-1/2" />
                )}
              </div>
            </div>

            {/* Industry - auto-detected + editable */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
                  Industry
                </label>
                {detected && detectedIndustries.length > 0 && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle size={9} /> Auto-detected from Companies House - adjust as needed
                  </span>
                )}
                {!detected && !detecting && quickName.trim().length >= 3 && (
                  <span className="text-[10px] text-white/30">Not found - select manually</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {allIndustries.map(([value, label]) => {
                  const isDetected = detectedIndustries.includes(value);
                  const isSel = selectedQsIndustries.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleQsIndustry(value)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all text-[11px] ${
                        isSel
                          ? "border-primary bg-primary/15 text-white"
                          : "border-white/8 text-white/35 hover:border-white/20 hover:text-white/60"
                      }`}
                    >
                      <div className={`w-3 h-3 rounded shrink-0 flex items-center justify-center transition-colors ${isSel ? "bg-primary" : "border border-white/20"}`}>
                        {isSel && <span className="text-white text-[8px] font-bold">✓</span>}
                      </div>
                      <span className="leading-tight truncate flex-1">{label}</span>
                      {isDetected && (
                        <span className="text-[8px] text-primary/60 font-semibold uppercase shrink-0">CH</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Launch */}
            <button
              onClick={() => onQuickStart(quickName, selectedQsIndustries)}
              disabled={!quickName.trim() || saving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <><Loader2 size={14} className="animate-spin" /> Setting up…</>
              ) : (
                "Launch Zane →"
              )}
            </button>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/25">
              {["Commercial contracts", "England & Wales", "Moderate risk appetite"].map((d) => (
                <span key={d} className="flex items-center gap-1">
                  <CheckCircle size={9} className="text-primary/50" /> {d}
                </span>
              ))}
            </div>

            {finishError && (
              <div className="text-xs text-[#FCA5A5] bg-[#1F0A0A] border border-[#450A0A] rounded-lg px-3 py-2">
                {finishError}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Or configure your workflow</h2>
        <p className="text-white/40 text-sm mt-1.5 leading-relaxed">
          Zane adapts its clause library and output framing to your workflow. You can change this later.
        </p>
      </div>

      <div className="space-y-3">
        {WORKFLOW_OPTIONS.map((opt) => {
          const sel = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelected(opt.value)}
              className={`w-full text-left rounded-2xl border p-5 transition-all ${
                sel
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/15"
                  : "border-white/10 hover:border-white/20"
              }`}
              style={{ background: sel ? undefined : CARD }}
            >
              <div className="flex items-start gap-4">
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                  sel ? "border-primary" : "border-white/25"
                }`}>
                  {sel && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-white">{opt.label}</span>
                  <p className="text-xs text-white/50 mt-1 leading-relaxed">{opt.description}</p>
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
          Configure step by step →
        </button>
      </div>
    </div>
  );
}

// ─── Step 1: Persona ──────────────────────────────────────────────────────────

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
];

const LITIGATION_PERSONA_CONFIG: {
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
    label: "In-house litigation team",
    tagline: "Insurance company or large corporate with in-house claims and litigation function.",
    bullets: [
      "FCA-compliant coverage triage and settlement authority",
      "Panel firm instruction and budget management",
      "Reserve adequacy and board reporting",
      "TCF and vulnerable customer obligations",
    ],
  },
];

function Step1Persona({ workflowType, onNext, onBack }: { workflowType: WorkflowType; onNext: (p: Persona) => void; onBack: () => void }) {
  const [selected, setSelected] = useState<Persona>("CORPORATE");

  const isLitigation = workflowType === "INSURANCE_LITIGATION";
  const personaOptions = isLitigation ? LITIGATION_PERSONA_CONFIG : PERSONA_CONFIG;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          {isLitigation ? "How does your team operate?" : "How will you use Zane?"}
        </h2>
        <p className="text-white/45 text-sm mt-2 leading-relaxed">
          Zane adapts its clause library, playbook defaults and output framing to your context.
          You can change this later.
        </p>
      </div>

      <div className="space-y-3">
        {personaOptions.map((p) => {
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

      {isLitigation && (
        <p className="text-xs text-white/35 leading-relaxed">
          You can configure panel firm access and multi-user roles later.
        </p>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-sm text-white/40 hover:text-white/70 transition-colors">← Back</button>
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

// ─── Step 2: Company ──────────────────────────────────────────────────────────

const LITIGATION_PRACTICE_TYPES: { value: string; label: string; sub: string }[] = [
  { value: "Insurance Litigation: All classes", label: "Insurance: All Classes",    sub: "Motor, EL/PL, PI, Property, Cyber, D&O, Marine" },
  { value: "Personal Injury Litigation",          label: "Personal Injury",            sub: "RTA, Employers Liability, Public Liability, Clinical Negligence" },
  { value: "Commercial Civil Litigation",         label: "Commercial Civil",           sub: "Contract disputes, debt recovery, fraud, injunctions" },
  { value: "Property Litigation",                 label: "Property Litigation",        sub: "Landlord & tenant, boundary disputes, adverse possession" },
  { value: "Employment Litigation",               label: "Employment",                 sub: "Unfair dismissal, discrimination, TUPE, whistleblowing" },
  { value: "Clinical Negligence",                 label: "Clinical Negligence",        sub: "Medical malpractice, surgical errors, delayed diagnosis" },
  { value: "Professional Indemnity",              label: "Professional Indemnity",     sub: "Solicitors, accountants, surveyors, architects, financial advisers" },
  { value: "Construction & Engineering",          label: "Construction & Engineering", sub: "JCT, NEC, adjudication, professional negligence" },
  { value: "Insolvency & Restructuring",          label: "Insolvency",                 sub: "Administration, liquidation, creditor claims, antecedent transactions" },
  { value: "Regulatory & Public Law",             label: "Regulatory & Public Law",    sub: "FCA enforcement, judicial review, public inquiries" },
];

function Step2Company({ form, onChange, persona, workflowType, selectedJurisdictions, onJurisdictionsChange, selectedIndustries, onIndustriesChange, onBack, onNext }: {
  form: CompanyForm;
  onChange: (f: CompanyForm) => void;
  persona: Persona;
  workflowType: WorkflowType;
  selectedJurisdictions: string[];
  onJurisdictionsChange: (j: string[]) => void;
  selectedIndustries: Industry[];
  onIndustriesChange: (i: Industry[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const isLitigation = workflowType === "INSURANCE_LITIGATION";
  const canProceed = isLitigation
    ? Boolean(form.name.trim()) && Boolean(form.sector.trim()) && selectedJurisdictions.length > 0
    : Boolean(form.name.trim()) && selectedJurisdictions.length > 0 && selectedIndustries.length > 0;

  // ── Company search state ────────────────────────────────────────────────────
  const [searching, setSearching] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [candidates, setCandidates] = useState<CompanyCandidate[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [customIndustries, setCustomIndustries] = useState<string[]>([]);
  const [enriched, setEnriched] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSearch() {
    const q = form.name.trim();
    if (!q || q.length < 2) return;
    setSearching(true);
    setEnriched(false);
    setCandidates([]);
    setShowDropdown(false);
    try {
      const { candidates: results } = await searchCompany(q);
      if (results.length === 0) {
        setCandidates([]);
        setShowDropdown(true);
      } else if (results.length === 1) {
        await applyCandidate(results[0]);
      } else {
        setCandidates(results);
        setShowDropdown(true);
      }
    } catch {
      setCandidates([]);
      setShowDropdown(true);
    } finally {
      setSearching(false);
    }
  }

  async function applyCandidate(candidate: CompanyCandidate) {
    setShowDropdown(false);
    setEnriching(true);
    setEnriched(false);
    try {
      const result: EnrichedCompany = await enrichCompanyData(candidate);

      // Auto-fill company name + sector
      onChange({ ...form, name: result.name, sector: result.sector || form.sector });

      // Auto-tick mapped industries
      const validIndustries = result.mappedIndustries.filter(
        (i): i is Industry => i in INDUSTRY_LABELS
      );
      if (validIndustries.length > 0) {
        onIndustriesChange(validIndustries);
      }

      // Store custom (unmapped) SIC descriptions as extra chips
      setCustomIndustries(result.customIndustries ?? []);

      // Auto-select jurisdiction if we can match it
      if (result.jurisdiction) {
        const jMatch = JURISDICTION_OPTIONS.find(
          (j) => j.label.toLowerCase().includes(result.jurisdiction.toLowerCase()) ||
                 result.jurisdiction.toLowerCase().includes(j.value.toLowerCase())
        );
        if (jMatch && !selectedJurisdictions.includes(jMatch.value)) {
          onJurisdictionsChange([jMatch.value, ...selectedJurisdictions]);
        }
      }
      setEnriched(true);
    } catch {
      // Non-fatal - just apply the name
      onChange({ ...form, name: candidate.name });
      setEnriched(true);
    } finally {
      setEnriching(false);
    }
  }

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
    CORPORATE: { title: "Tell Zane about your company", sub: "This shapes your playbook defaults and regulatory detection." },
    FOUNDER:   { title: "Tell Zane about your startup", sub: "This configures your investment clause defaults and operational playbook." },
  };
  const { title, sub } = headings[persona];

  // ── Litigation branch ────────────────────────────────────────────────────────
  if (isLitigation) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Tell Zane about your practice</h2>
          <p className="text-white/45 text-sm mt-2 leading-relaxed">
            This calibrates Zane's coverage analysis, FCA obligations, and settlement authority thresholds.{" "}
            Required fields marked <span className="text-red-400">*</span>
          </p>
        </div>

        <div className="space-y-5">

          {/* Organisation name */}
          <DarkField label="Organisation name" required>
            <DarkInput
              placeholder="e.g. Aviva Claims Legal, Clyde & Co LLP"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
            />
          </DarkField>

          {/* Litigation practice type - single-select card grid */}
          <DarkField label="Litigation practice type" required>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {LITIGATION_PRACTICE_TYPES.map((opt) => {
                const sel = form.sector === opt.value;
                return (
                  <button key={opt.value} type="button" onClick={() => onChange({ ...form, sector: opt.value })}
                    className={`flex flex-col gap-0.5 px-3 py-3 rounded-xl border text-left transition-all ${
                      sel ? "border-primary bg-primary/15 text-white" : "border-white/10 text-white/45 hover:border-white/25 hover:text-white/75"
                    }`}
                    style={{ background: sel ? undefined : CARD }}
                  >
                    <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                    <span className="text-[10px] text-white/35 leading-tight">{opt.sub}</span>
                  </button>
                );
              })}
            </div>
            {!form.sector.trim() && <p className="text-xs text-red-400 mt-1">Select your practice type</p>}
          </DarkField>

          {/* Handler type / role in litigation */}
          <DarkField label="Your role in litigation" required>
            <DarkSelect value={form.role} onChange={(v) => onChange({ ...form, role: v as CompanyRole })} options={[
              { value: "INSURER_INHOUSE", label: "Insurer - in-house litigation team" },
              { value: "PANEL_FIRM",      label: "Panel solicitors / External counsel" },
              { value: "TPA",             label: "Third Party Administrator (TPA)" },
              { value: "CLAIMANT_FIRM",   label: "Claimant solicitors" },
              { value: "DEFENDANT_FIRM",  label: "Defendant solicitors (non-panel)" },
              { value: "BOTH",            label: "Multiple roles" },
            ]} />
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

          {/* Settlement posture slider */}
          <DarkField label="Settlement posture" required hint="Sets default clause positions - adjust each one in the playbook step.">
            <RiskAppetiteSlider
              value={form.riskAppetite}
              onChange={(v) => onChange({ ...form, riskAppetite: v })}
              labels={[
                { value: "CONSERVATIVE", label: "Conservative", sub: "Defend aggressively - every case on merits" },
                { value: "MODERATE",     label: "Moderate",     sub: "Balanced - merits-driven with pragmatic settlement" },
                { value: "COMMERCIAL",   label: "Commercial",   sub: "Settlement-focused - resolve cost-effectively" },
              ]}
            />
          </DarkField>
        </div>

        <div className="flex justify-between pt-2">
          <button onClick={onBack} className="px-4 py-2.5 text-sm text-white/40 hover:text-white/70 transition-colors">← Back</button>
          <button onClick={onNext} disabled={!canProceed}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary/25 disabled:opacity-30 disabled:pointer-events-none">
            Next: Claim types →
          </button>
        </div>
      </div>
    );
  }

  // ── Commercial branch (original) ─────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
        <p className="text-white/45 text-sm mt-2 leading-relaxed">
          {sub} Required fields marked <span className="text-red-400">*</span>
        </p>
      </div>

      <div className="space-y-5">

        {/* Company name + search */}
        <DarkField label="Company name" required hint="Type your company name then click Search to auto-fill industry and jurisdiction.">
          <div className="relative" ref={dropdownRef}>
            <div className="flex gap-2">
              <DarkInput
                placeholder={persona === "FOUNDER" ? "e.g. Acme Technologies Ltd" : "e.g. Acme Ltd"}
                value={form.name}
                onChange={(e) => onChange({ ...form, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } }}
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching || enriching || form.name.trim().length < 2}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
              >
                {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                {searching ? "Searching..." : "Search"}
              </button>
            </div>

            {/* Results dropdown */}
            {showDropdown && (
              <div className="absolute z-[200] top-full mt-1.5 left-0 right-0 rounded-xl border border-white/15 shadow-2xl"
                style={{ background: "#0F172A" }}>
                {candidates.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-[10px] text-white/30 uppercase tracking-widest border-b border-white/8">
                      Select your company
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {candidates.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => applyCandidate(c)}
                          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
                        >
                          <Building2 size={14} className="text-primary/70 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white font-medium leading-tight truncate">{c.name}</div>
                            <div className="text-[10px] text-white/40 mt-0.5 flex items-center gap-2 flex-wrap">
                              <span>{c.jurisdiction}</span>
                              {c.number && <span>No. {c.number}</span>}
                              {c.status && (
                                <span className={c.status.toLowerCase() === "active" ? "text-emerald-400" : "text-white/30"}>
                                  {c.status}
                                </span>
                              )}
                            </div>
                            {c.address && <div className="text-[10px] text-white/25 truncate mt-0.5">{c.address}</div>}
                          </div>
                          <ChevronDown size={12} className="text-white/30 shrink-0 mt-1 rotate-[-90deg]" />
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {candidates.length === 0 && (
                  <div className="px-4 py-3 text-xs text-white/40">
                    No registered companies found for "{form.name}".
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowDropdown(false)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-xs text-primary/80 hover:text-primary hover:bg-white/5 transition-colors border-t border-white/8 font-medium rounded-b-xl"
                >
                  Enter details manually
                </button>
              </div>
            )}

            {/* Enrichment loading indicator */}
            {enriching && (
              <div className="flex items-center gap-2 mt-2 text-xs text-white/50">
                <Loader2 size={12} className="animate-spin text-primary" />
                Looking up company details...
              </div>
            )}

            {/* Success confirmation */}
            {enriched && !enriching && (
              <div className="flex items-center gap-2 mt-2 text-xs text-emerald-400">
                <CheckCircle size={12} />
                Company found - industries pre-selected below. Add or remove as needed.
              </div>
            )}
          </div>
        </DarkField>

        {/* Industry multi-select */}
        <DarkField label="Industry" required hint="Select all that apply - Zane filters contract types and injects sector-specific clauses.">
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
                  <span className="leading-tight truncate">{label}</span>
                </button>
              );
            })}
          </div>
          {selectedIndustries.length === 0 && <p className="text-xs text-red-400 mt-1">Select at least one industry</p>}

          {/* Custom industries from SIC codes not in our enum */}
          {customIndustries.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {customIndustries.map((ci) => (
                <span key={ci} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-primary/30 bg-primary/10 text-xs text-primary/80 font-medium">
                  {ci}
                  <button type="button" onClick={() => setCustomIndustries((prev) => prev.filter((x) => x !== ci))}
                    className="text-primary/50 hover:text-primary/90 transition-colors leading-none">&times;</button>
                </span>
              ))}
            </div>
          )}
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

        {/* Role */}
        {(
          <DarkField label="Your typical contract role" required>
            <DarkSelect value={form.role} onChange={(v) => onChange({ ...form, role: v as CompanyRole })} options={[
              { value: "BUYER",    label: "Buyer / Customer" },
              { value: "SUPPLIER", label: "Supplier / Vendor" },
              { value: "BOTH",     label: "Both" },
            ]} />
          </DarkField>
        )}

        {/* Risk appetite slider */}
        <DarkField label="Risk appetite" required hint="Sets default clause positions - adjust each one in the playbook step.">
          <RiskAppetiteSlider
            value={form.riskAppetite}
            onChange={(v) => onChange({ ...form, riskAppetite: v })}
            labels={[
              { value: "CONSERVATIVE", label: "Conservative", sub: "Maximum protection" },
              { value: "MODERATE",     label: "Moderate",     sub: "Balanced (recommended)" },
              { value: "COMMERCIAL",   label: "Commercial",   sub: persona === "FOUNDER" ? "Founder-friendly" : "Deal-oriented" },
            ]}
          />
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

// ─── Step 3: Contract types ───────────────────────────────────────────────────

function Step3ContractType({ values, industries, persona, workflowType, onChange, onBack, onNext }: {
  values: string[];
  industries: Industry[];
  persona: Persona;
  workflowType: WorkflowType;
  onChange: (v: string[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  function toggle(ctValue: string) {
    onChange(values.includes(ctValue) ? values.filter((v) => v !== ctValue) : [...values, ctValue]);
  }

  // ── Litigation branch: show claim types ──────────────────────────────────────
  if (workflowType === "INSURANCE_LITIGATION") {
    const claimGroups: string[] = [];
    const claimGroupsSeen = new Set<string>();
    for (const ct of LITIGATION_CLAIM_TYPES) {
      if (!claimGroupsSeen.has(ct.group)) { claimGroupsSeen.add(ct.group); claimGroups.push(ct.group); }
    }

    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Claim types handled</h2>
          <p className="text-white/45 text-sm mt-2">
            Select all the claim types your team regularly handles. Zane calibrates its coverage analysis and assessment categories accordingly.
          </p>
        </div>

        <div className="space-y-5">
          {claimGroups.map((group) => (
            <div key={group}>
              <div className="text-[10px] uppercase tracking-widest text-white/25 font-semibold mb-2 px-1">{group}</div>
              <div className="space-y-2">
                {LITIGATION_CLAIM_TYPES.filter((ct) => ct.group === group).map((ct) => {
                  const sel = values.includes(ct.value);
                  return (
                    <button key={ct.value} onClick={() => toggle(ct.value)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all flex items-center gap-3 ${
                        sel ? "border-primary bg-primary/10 text-white" : "border-white/10 text-white/55 hover:border-white/25 hover:text-white/80"
                      }`} style={{ background: sel ? undefined : CARD }}>
                      <div className={`w-4 h-4 rounded shrink-0 flex items-center justify-center ${sel ? "bg-primary" : "border border-white/20"}`}>
                        {sel && <span className="text-white text-[10px] font-bold">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{ct.label}</div>
                        <div className="text-[11px] text-white/35 mt-0.5">{ct.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-white/40">
          {values.length} claim type{values.length !== 1 ? "s" : ""} selected
        </p>
        {values.length === 0 && <p className="text-xs text-red-400">Select at least one claim type</p>}

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

  // ── Commercial branch (original) ─────────────────────────────────────────────
  const filtered = getContractTypesForPersonaAndIndustry(persona, industries);
  const groupsSeen = new Set<string>();
  const groups: string[] = [];
  for (const ct of filtered) {
    if (!groupsSeen.has(ct.group)) { groupsSeen.add(ct.group); groups.push(ct.group); }
  }

  const isGaming = industries.includes("GAMING_INTERACTIVE");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Contract types</h2>
        <p className="text-white/45 text-sm mt-2">Select all the types you regularly deal with. Zane will inject the right clauses for each.</p>
      </div>

      {/* Persona + industry tags */}
      <div className="flex flex-wrap gap-2">
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/15 bg-white/5 text-xs text-white/50">
          {persona === "CORPORATE" ? "In-house" : "Founder"}
        </span>
        {industries.map((ind) => (
          <span key={ind} className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-xs text-white/70">
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

// ─── Step 4: Playbook ─────────────────────────────────────────────────────────

function Step4Playbook({ playbook, onUpdate, onBack, onNext }: {
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

// ─── Step 5: Approvers ────────────────────────────────────────────────────────

function Step5Approvers({ contacts, persona, onChange, onBack, onNext }: {
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
    LEGAL: { label: "Legal team",      sub: "Day-to-day clause review" },
    GC:    { label: "General Counsel", sub: "High-risk decisions" },
    CFO:   { label: "CFO",   sub: "Financial exposure thresholds" },
    BOARD: { label: "Board", sub: "Material contracts" },
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          {"Approval matrix"}
        </h2>
        <p className="text-white/45 text-sm mt-2">
          When Zane triggers an escalation, it names the right person. Leave blank if not applicable.
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

// ─── Step 5: Governance (Approvers + Thresholds + Triggers) ──────────────────

interface Threshold {
  minValue: number;
  maxValue: number | null;
  requiredApprover: string;
  label: string;
}

interface GovernanceTrigger {
  clauseCategory: string;
  escalateTo: string;
  reason: string;
}

function Step5Governance({
  contacts, persona, onContactsChange,
  thresholds, onThresholdsChange,
  triggers, onTriggersChange,
  onBack, onNext,
}: {
  contacts: Contact[];
  persona: Persona;
  onContactsChange: (c: Contact[]) => void;
  thresholds: Threshold[];
  onThresholdsChange: (t: Threshold[]) => void;
  triggers: GovernanceTrigger[];
  onTriggersChange: (t: GovernanceTrigger[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [newTriggerCat, setNewTriggerCat] = useState("");
  const [newTriggerRole, setNewTriggerRole] = useState("GC");

  function updateContact(i: number, field: keyof Contact, value: string) {
    const updated = [...contacts];
    updated[i] = { ...updated[i], [field]: value };
    onContactsChange(updated);
  }

  function updateThreshold(i: number, field: keyof Threshold, value: string | number | null) {
    const updated = [...thresholds];
    updated[i] = { ...updated[i], [field]: value };
    onThresholdsChange(updated);
  }

  function addTrigger() {
    if (!newTriggerCat) return;
    if (triggers.some((t) => t.clauseCategory === newTriggerCat)) return;
    onTriggersChange([...triggers, { clauseCategory: newTriggerCat, escalateTo: newTriggerRole, reason: "" }]);
    setNewTriggerCat("");
  }

  function removeTrigger(cat: string) {
    onTriggersChange(triggers.filter((t) => t.clauseCategory !== cat));
  }

  const ROLE_LABELS: Record<ApprovalRole, { label: string; sub: string }> = {
    LEGAL: { label: "Legal team",      sub: "Day-to-day clause review" },
    GC:    { label: "General Counsel", sub: "High-risk decisions" },
    CFO:   { label: "CFO",   sub: "Financial exposure thresholds" },
    BOARD: { label: "Board", sub: "Material contracts" },
  };

  const APPROVER_OPTIONS = ["NONE", "LEGAL", "GC", "CFO", "BOARD"];

  void persona;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Governance setup</h2>
        <p className="text-white/45 text-sm mt-2">
          Who approves what, and which clauses always require escalation.
        </p>
      </div>

      {/* Approvers */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-white/30">Approval contacts</div>
        {contacts.map((c, i) => (
          <div key={c.role} className="rounded-xl border border-white/10 p-4 space-y-3" style={{ background: CARD }}>
            <div>
              <div className="text-sm font-semibold text-white">{ROLE_LABELS[c.role].label}</div>
              <div className="text-xs text-white/35">{ROLE_LABELS[c.role].sub}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Name</label>
                <DarkInput placeholder="Jane Smith" value={c.name} onChange={(e) => updateContact(i, "name", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Email</label>
                <DarkInput type="email" placeholder="jane@company.com" value={c.email} onChange={(e) => updateContact(i, "email", e.target.value)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Approval thresholds */}
      <div className="space-y-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-0.5">Contract value thresholds</div>
          <div className="text-xs text-white/35">Contracts above each threshold automatically flag the relevant approver.</div>
        </div>
        {thresholds.map((t, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3" style={{ background: CARD }}>
            <div className="flex-1 text-sm text-white/80">{t.label}</div>
            <select
              className="bg-[#1E293B] border border-white/15 text-white text-xs rounded-lg px-2 py-1.5"
              value={t.requiredApprover}
              onChange={(e) => updateThreshold(i, "requiredApprover", e.target.value)}
            >
              {APPROVER_OPTIONS.map((o) => (
                <option key={o} value={o}>{o === "NONE" ? "Self-approval" : o}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Governance triggers */}
      <div className="space-y-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-0.5">Always-escalate clauses</div>
          <div className="text-xs text-white/35">These clause categories always trigger escalation, regardless of how they are scored.</div>
        </div>
        <div className="space-y-1.5">
          {triggers.map((t) => (
            <div key={t.clauseCategory} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2" style={{ background: CARD }}>
              <div>
                <span className="text-xs font-mono text-white/60">{t.clauseCategory.replace(/_/g, " ")}</span>
                <span className="ml-2 text-[10px] text-white/35">→ {t.escalateTo}</span>
              </div>
              <button onClick={() => removeTrigger(t.clauseCategory)} className="text-white/25 hover:text-white/60 text-xs">✕</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <select
            className="flex-1 bg-[#1E293B] border border-white/15 text-white/70 text-xs rounded-lg px-2 py-1.5"
            value={newTriggerCat}
            onChange={(e) => setNewTriggerCat(e.target.value)}
          >
            <option value="">Add a trigger clause…</option>
            {CLAUSE_CATEGORIES.filter((c) => !triggers.some((t) => t.clauseCategory === c)).map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
            ))}
          </select>
          <select
            className="bg-[#1E293B] border border-white/15 text-white/70 text-xs rounded-lg px-2 py-1.5"
            value={newTriggerRole}
            onChange={(e) => setNewTriggerRole(e.target.value)}
          >
            {["LEGAL", "GC", "CFO", "BOARD"].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            onClick={addTrigger}
            disabled={!newTriggerCat}
            className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg disabled:opacity-40 hover:opacity-90"
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-sm text-white/40 hover:text-white/70 transition-colors">← Back</button>
        <button onClick={onNext}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary/25">
          Next: Team →
        </button>
      </div>
    </div>
  );
}

// ─── Step 6: Team Invite ──────────────────────────────────────────────────────

function Step6TeamInvite({
  emails, onChange, onBack, onNext,
}: {
  emails: string[];
  onChange: (emails: string[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [input, setInput] = useState("");

  function addEmail() {
    const email = input.trim().toLowerCase();
    if (!email || !email.includes("@") || emails.includes(email)) return;
    onChange([...emails, email]);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addEmail(); }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Invite your team</h2>
        <p className="text-white/45 text-sm mt-2">
          Add colleagues who should have access to Zane. They'll receive an invitation. Skip if you want to set this up later.
        </p>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-white/30">Team email addresses</div>
        <div className="flex gap-2">
          <div className="flex-1">
            <DarkInput
              type="email"
              placeholder="colleague@company.com"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <button
            onClick={addEmail}
            className="px-4 py-2.5 text-sm bg-primary text-white rounded-xl hover:opacity-90 transition-opacity"
          >
            Add
          </button>
        </div>
        {emails.length > 0 && (
          <div className="space-y-1.5">
            {emails.map((email) => (
              <div key={email} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2" style={{ background: CARD }}>
                <span className="text-sm text-white/70">{email}</span>
                <button onClick={() => onChange(emails.filter((e) => e !== email))} className="text-white/25 hover:text-white/60 text-xs">✕</button>
              </div>
            ))}
          </div>
        )}
        {emails.length === 0 && (
          <p className="text-xs text-white/25 text-center py-4">No team members added yet. You can always invite from Settings.</p>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 text-sm text-white/40 hover:text-white/70 transition-colors">← Back</button>
        <button onClick={onNext}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary/25">
          {emails.length > 0 ? `Invite ${emails.length} & continue →` : "Skip →"}
        </button>
      </div>
    </div>
  );
}

// ─── Step 7: Regulations ──────────────────────────────────────────────────────

const JURISDICTION_LABELS: Record<string, string> = {
  GB:  "United Kingdom",
  EU:  "European Union",
  IE:  "Ireland",
  NL:  "Netherlands",
  CH:  "Switzerland",
  US:  "United States",
  CA:  "Canada",
  SG:  "Singapore",
  HK:  "Hong Kong",
  JP:  "Japan",
  AE:  "United Arab Emirates",
  KSA: "Saudi Arabia",
  KR:  "South Korea",
  IN:  "India",
  BR:  "Brazil",
};

// Plain-English descriptions of each jurisdiction's regulatory flavour
const JURISDICTION_CONTEXT: Record<string, string> = {
  GB:  "UK domestic law post-Brexit - FCA, ICO, CMA and sector regulators",
  EU:  "EU-wide rules that apply if you operate in, sell to, or process data from EU countries",
  IE:  "Irish law - important if you're EU-passporting via Dublin",
  NL:  "Dutch law - relevant for Netherlands-incorporated entities",
  CH:  "Swiss law - applies if you contract under Swiss jurisdiction",
  US:  "US federal & state law - relevant for US-facing products or contracts",
  CA:  "Canadian law - PIPEDA privacy and provincial regulations",
  SG:  "Singapore law - MAS regulated activities and PDPA",
  HK:  "Hong Kong law - SFC regulated activities",
  JP:  "Japanese law - APPI privacy and FSA regulations",
  AE:  "UAE / DIFC / ADGM law - relevant for Middle East operations",
  KSA: "Saudi Arabian law - PDPL and SAMA regulations",
  KR:  "South Korean law - PIPA and FSC regulations",
  IN:  "Indian law - DPDP Act and RBI/SEBI regulations",
  BR:  "Brazilian law - LGPD privacy and BACEN regulations",
};

function Step7Regulations({ companyForm, detected, onDetected, onBack, onNext, detectFn }: {
  companyForm: CompanyForm;
  detected: boolean;
  onDetected: () => void;
  onBack: () => void;
  onNext: () => void;
  detectFn: () => Promise<CompanyRegulation[]>;
}) {
  const [detecting, setDetecting] = useState(false);
  const [regs, setRegs] = useState<CompanyRegulation[]>([]);
  const [error, setError] = useState("");

  // User's selected industries as a Set for fast lookup
  const userIndustries = new Set(companyForm.industry.split(", ").map((s) => s.trim()));

  async function detect() {
    setDetecting(true);
    setError("");
    try {
      const result = await detectFn();
      setRegs(result);
      onDetected();
    } catch (e) {
      console.error("[detect]", e);
      setError("Could not detect frameworks - skip for now and detect later from the Regulations page.");
    } finally {
      setDetecting(false);
    }
  }

  // Group detected regs by jurisdiction
  const byJurisdiction = regs.reduce<Record<string, CompanyRegulation[]>>((acc, r) => {
    (acc[r.jurisdiction] ??= []).push(r);
    return acc;
  }, {});

  // For each reg, find which of the user's industries it covers
  function matchingIndustries(appliesTo: string): string[] {
    return appliesTo
      .split(",")
      .map((s) => s.trim())
      .filter((code) => userIndustries.has(code))
      .map((code) => INDUSTRY_LABELS[code as Industry] ?? code);
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Regulatory environment</h2>
        <p className="text-white/45 text-sm mt-2 leading-relaxed">
          Zane auto-detects the laws and regulations your contracts need to comply with, based on your industry and where you operate. These are injected into every review.
        </p>
      </div>

      {/* Context card */}
      <div className="rounded-xl border border-white/10 p-5 space-y-4" style={{ background: CARD }}>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-1">Your industry</div>
            <div className="text-white/70">{companyForm.industry.split(", ").map((i) => INDUSTRY_LABELS[i as Industry] ?? i).join(", ")}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-1">Where you operate</div>
            <div className="text-white/70">{companyForm.jurisdiction}</div>
          </div>
        </div>

        {!detected && (
          <button onClick={detect} disabled={detecting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50">
            {detecting
              ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Detecting…</>
              : "Detect applicable regulations"
            }
          </button>
        )}

        {error && <p className="text-xs text-amber-400">{error}</p>}
      </div>

      {/* Results - grouped by jurisdiction */}
      {detected && regs.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <CheckCircle size={15} className="text-emerald-400 shrink-0" />
            <span className="text-sm font-semibold text-emerald-400">{regs.length} regulatory framework{regs.length !== 1 ? "s" : ""} detected</span>
            <span className="text-xs text-white/30">- Zane will flag contract clauses that conflict with these</span>
          </div>

          {Object.entries(byJurisdiction).map(([jurisdiction, items]) => (
            <div key={jurisdiction} className="space-y-3">
              {/* Jurisdiction header */}
              <div className="flex items-start gap-3">
                <span className="text-[10px] font-bold bg-white/10 text-white/60 px-2 py-1 rounded font-mono shrink-0 mt-0.5">
                  {jurisdiction}
                </span>
                <div>
                  <div className="text-sm font-semibold text-white">
                    {JURISDICTION_LABELS[jurisdiction] ?? jurisdiction}
                    <span className="ml-2 text-xs text-white/30 font-normal">
                      {items.length} framework{items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {JURISDICTION_CONTEXT[jurisdiction] && (
                    <div className="text-xs text-white/35 mt-0.5">{JURISDICTION_CONTEXT[jurisdiction]}</div>
                  )}
                </div>
              </div>

              {/* Frameworks within this jurisdiction */}
              <div className="space-y-2 pl-2 border-l border-white/8">
                {items.map((r) => {
                  const industries = matchingIndustries(r.appliesTo);
                  return (
                    <div key={r.frameworkName}
                      className="rounded-lg border border-white/8 p-3.5 space-y-2"
                      style={{ background: "#0B1020" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white/90">{r.frameworkName}</div>
                          <div className="text-xs text-white/35 mt-0.5">{r.regulator}</div>
                        </div>
                        {industries.length > 0 && (
                          <div className="flex flex-wrap gap-1 justify-end shrink-0">
                            {industries.map((ind) => (
                              <span key={ind}
                                className="text-[10px] bg-primary/15 text-primary border border-primary/25 rounded-full px-2 py-0.5 font-medium whitespace-nowrap">
                                {ind}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {r.description && (
                        <p className="text-xs text-white/45 leading-relaxed">{r.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {detected && regs.length === 0 && (
        <p className="text-sm text-white/40">No specific frameworks detected. Zane will apply general contract standards.</p>
      )}

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

// ─── Step 7: Done ─────────────────────────────────────────────────────────────

function Step8Done({ persona, saving, error, onBack, onFinish }: {
  persona: Persona;
  saving: boolean;
  error?: string;
  onBack: () => void;
  onFinish: () => void;
}) {
  const bullets: Record<Persona, string[]> = {
    CORPORATE: [
      "Upload counterparty paper (PDF or DOCX)",
      "Zane extracts and classifies key clauses automatically",
      "Each clause is compared against your playbook + live regulations",
      "You get a Red / Amber / Green risk report with fallback language",
      "Zane tells you exactly what to push back on and who needs to approve",
    ],
    FOUNDER: [
      "Upload term sheets, shareholder agreements or commercial contracts",
      "Zane flags investment clause traps: participating preferred, full ratchet, drag-along",
      "Operational contracts reviewed against your standard positions",
      "Plain-English explanation of what each clause means for you as founder",
      "Know what to push back on before you sign",
    ],
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Zane is ready</h2>
        <p className="text-white/45 text-sm mt-2">Your playbook is set. Upload your first contract and Zane will review it within minutes.</p>
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
          ) : "Launch Zane →"}
        </button>
      </div>
    </div>
  );
}

// ─── Risk appetite slider ─────────────────────────────────────────────────────

const RISK_VALUES = ["CONSERVATIVE", "MODERATE", "COMMERCIAL"] as const;

function RiskAppetiteSlider({
  value,
  onChange,
  labels,
}: {
  value: RiskAppetite;
  onChange: (v: RiskAppetite) => void;
  labels: { value: RiskAppetite; label: string; sub: string }[];
}) {
  const idx = RISK_VALUES.indexOf(value);
  const current = labels[idx] ?? labels[1];

  return (
    <div className="space-y-3 mt-1">
      {/* Slider track */}
      <div className="px-1">
        <input
          type="range"
          min={0}
          max={2}
          step={1}
          value={idx}
          onChange={(e) => onChange(RISK_VALUES[parseInt(e.target.value)] as RiskAppetite)}
          className="w-full accent-primary cursor-pointer"
          style={{ accentColor: "hsl(var(--primary))" }}
        />
        {/* Tick labels */}
        <div className="flex justify-between mt-1">
          {labels.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => onChange(l.value)}
              className={`text-[10px] font-medium transition-colors ${
                value === l.value ? "text-primary" : "text-white/30 hover:text-white/55"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
      {/* Selected description */}
      <div className="rounded-xl border border-primary/30 bg-primary/8 px-4 py-3 flex items-start gap-2.5">
        <div className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0" />
        <div>
          <div className="text-xs font-semibold text-white">{current.label}</div>
          <div className="text-[11px] text-white/50 mt-0.5">{current.sub}</div>
        </div>
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

function DarkInput({ placeholder, value, onChange, onKeyDown, type = "text" }: {
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
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
        className="w-full rounded-xl border border-white/10 px-3.5 py-2.5 text-sm text-white/70 placeholder:text-white/20 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-colors min-h-[80px] resize-y font-mono"
        style={{ background: CARD2 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
