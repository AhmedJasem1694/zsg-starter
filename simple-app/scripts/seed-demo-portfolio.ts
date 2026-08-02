/**
 * Demo portfolio seed: 35 contracts, one shared dataset.
 *
 * Every screen reads this: Library, dashboard, Portfolio Risk, Negotiation
 * Intelligence, Timings and the monthly report. The figures are chosen so they
 * reconcile rather than being asserted anywhere:
 *
 *   total value          4,200,000   sum of contractValue across 35 contracts
 *   value at risk          340,000   sum of contractValue for contracts with a RED clause
 *
 * Value at risk is computed by the portfolio route as the value of every
 * document carrying at least one RED result, so exactly four contracts here
 * carry RED and their values sum to 340,000. Adding a RED clause anywhere else
 * changes that figure.
 *
 * The intelligence is emergent, not seeded. Liability cap erosion appears
 * because Nexus genuinely accepted below the playbook on four contracts, and
 * auto-renewal exposure appears because Halcyon genuinely has renewal clauses
 * inside the notice red line. Neither is written anywhere as a finding.
 *
 * Idempotent: deletes only records tagged source = "demo_seed" and recreates
 * them. Documents uploaded by hand are never touched.
 *
 * Run:  npx tsx scripts/seed-demo-portfolio.ts
 */

import "dotenv/config";
import { initPocketBase, pb } from "../server/pb.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PB = Record<string, any>;

const SEED_TAG = "demo_seed";
const DEMO_USER = "demo@zanelegal.ai";

// Reference point for the 90 day spread. Passed in rather than read from the
// clock so a re-run produces the same dates.
const TODAY = new Date(process.env.SEED_TODAY ?? "2026-08-02T09:00:00.000Z");
const daysAgoIso = (d: number) => {
  const t = new Date(TODAY.getTime() - d * 86_400_000);
  return t.toISOString().replace("T", " ");
};

type Rag = "GREEN" | "AMBER" | "RED";
type Action = "accepted" | "modified" | "overridden";

interface Decision {
  cat: string;
  rag: Rag;
  action: Action;
  summary: string;      // plain English, shown on the review card
  final: string;        // where it landed
  reason: string;       // why it landed there
  reasonCategory?: string;
  reasonText?: string;
}

interface Contract {
  cp: string;
  name: string;
  type: string;
  value: number;
  daysAgo: number;
  decisions: Decision[];
}

// ── Shared clause outcomes, so the file stays readable ────────────────────────

const capAccepted = (months: string, note: string, cat?: string, text?: string): Decision => ({
  cat: "LIABILITY_CAP", rag: "AMBER", action: "accepted",
  summary: `Aggregate liability capped at ${months} of fees. Below our preferred 24 month position, carve-outs retained.`,
  final: `${months} of fees, data protection and IP carved out`,
  reason: note, reasonCategory: cat, reasonText: text,
});
const capGreen: Decision = {
  cat: "LIABILITY_CAP", rag: "GREEN", action: "accepted",
  summary: "Liability capped at 24 months of fees with data protection and IP carved out, matching our preferred position.",
  final: "24 months of fees, carve-outs retained", reason: "Counterparty accepted our preferred cap",
};
const green = (cat: string, summary: string, final: string): Decision => ({
  cat, rag: "GREEN", action: "accepted", summary, final, reason: "Accepted our position",
});
const amberModified = (cat: string, summary: string, final: string, reason: string): Decision => ({
  cat, rag: "AMBER", action: "modified", summary, final, reason,
});

// ── The portfolio ─────────────────────────────────────────────────────────────
// Types: 12 MSA, 8 SaaS, 5 DPA, 4 supplier, 3 SOW, 3 NDA.

const CONTRACTS: Contract[] = [
  // ── Nexus Solutions Ltd, 6 contracts. The difficult counterparty: pushes
  // back on liability every time and we settle below playbook on four of them.
  { cp: "Nexus Solutions Ltd", name: "Nexus Solutions, Master Services Agreement", type: "MSA", value: 640_000, daysAgo: 86, decisions: [
    capAccepted("12 months", "Counterparty refused to move above 12 months across three rounds", "Strategic relationship", "Largest account in the portfolio. Accepted their standard 12 month counter to keep the renewal on track."),
    green("PAYMENT_TERMS", "Payment within 30 days of a valid invoice, annual uplift capped at CPI.", "30 days, CPI-capped uplift"),
  ] },
  { cp: "Nexus Solutions Ltd", name: "Nexus Solutions, Platform Licence", type: "MSA", value: 185_000, daysAgo: 71, decisions: [
    capAccepted("12 months", "Same 12 month counter as the master agreement", "Precedent", "Held to the position they set on the MSA rather than reopening it."),
    amberModified("INDEMNITY", "Indemnity negotiated to mutual, capped except the IP and data protection limbs.", "Mutual indemnity, IP and data uncapped", "Counterparty required mutuality"),
  ] },
  { cp: "Nexus Solutions Ltd", name: "Nexus Solutions, Managed Services Agreement", type: "MSA", value: 142_000, daysAgo: 58, decisions: [
    capAccepted("12 months", "Third contract settling at their 12 month cap", "Precedent", "Consistent with the two prior agreements. Worth reopening at the next renewal rather than per contract."),
    green("CONFIDENTIALITY", "Mutual confidentiality surviving five years from disclosure.", "Mutual, 5 year survival"),
  ] },
  // The one Nexus contract that breaks a red line. Counts toward value at risk.
  { cp: "Nexus Solutions Ltd", name: "Nexus Solutions, Statement of Work Q2", type: "SOW", value: 95_000, daysAgo: 34, decisions: [
    { cat: "LIABILITY_CAP", rag: "RED", action: "accepted",
      summary: "Liability capped at 12 months of fees with data protection breach inside the cap rather than carved out. A single data incident on this work could exhaust the cap and leave Meridian carrying the balance.",
      final: "12 months of fees, data breach NOT carved out",
      reason: "Counterparty refused the data breach carve-out and the delivery date could not move",
      reasonCategory: "One off exception",
      reasonText: "Accepted under protest on a lower value SOW. Explicitly not a precedent for the Nexus master agreement." },
  ] },
  { cp: "Nexus Solutions Ltd", name: "Nexus Solutions, Support Renewal 2026", type: "MSA", value: 78_000, daysAgo: 22, decisions: [
    amberModified("LIABILITY_CAP", "Cap negotiated to 18 months of fees on renewal, an improvement on the 12 months they held elsewhere.", "18 months of fees", "Moved them off 12 months for the first time"),
    green("WARRANTIES", "Services warranted to conform to the documented specification.", "Conformance warranty given"),
  ] },
  { cp: "Nexus Solutions Ltd", name: "Nexus Solutions, Data Processing Agreement", type: "DPA", value: 22_000, daysAgo: 15, decisions: [
    green("DATA_PRIVACY", "UK GDPR Article 28 terms with UK data residency and 72 hour breach notification.", "Article 28 DPA, UK residency"),
    amberModified("LIABILITY_CAP", "Cap follows the master agreement rather than standing alone.", "Follows MSA cap", "Aligned to the master agreement"),
  ] },

  // ── DataFlow Technologies, 5 contracts. Reasonable, settles within 2 rounds.
  { cp: "DataFlow Technologies", name: "DataFlow Technologies, Reseller Agreement", type: "MSA", value: 450_000, daysAgo: 79, decisions: [
    amberModified("IP_OWNERSHIP", "Bespoke deliverables licensed perpetually rather than assigned outright.", "Perpetual licence to deliverables", "Counterparty would license but not assign"),
    green("CONFIDENTIALITY", "Mutual confidentiality surviving five years.", "Mutual, 5 year survival"),
  ] },
  { cp: "DataFlow Technologies", name: "DataFlow Technologies, API Integration Agreement", type: "SaaS_AGREEMENT", value: 115_000, daysAgo: 64, decisions: [
    green("IP_OWNERSHIP", "Bespoke deliverables assigned to Meridian on payment.", "Assignment on payment"),
    green("PAYMENT_TERMS", "30 days from a valid invoice.", "30 days"),
  ] },
  { cp: "DataFlow Technologies", name: "DataFlow Technologies, Analytics Subscription", type: "SaaS_AGREEMENT", value: 88_000, daysAgo: 45, decisions: [
    capGreen,
    green("DATA_PRIVACY", "Article 28 terms, sub-processors only on prior written consent.", "DPA with consent-based sub-processing"),
  ] },
  { cp: "DataFlow Technologies", name: "DataFlow Technologies, Data Processing Agreement", type: "DPA", value: 18_000, daysAgo: 30, decisions: [
    green("DATA_PRIVACY", "Article 28 terms with audit rights and UK residency.", "Article 28 DPA, audit rights"),
  ] },
  { cp: "DataFlow Technologies", name: "DataFlow Technologies, Professional Services SOW", type: "SOW", value: 64_000, daysAgo: 11, decisions: [
    amberModified("PAYMENT_TERMS", "Payment moved to 45 days on this statement of work only.", "45 days, this SOW only", "Counterparty sought longer terms on services work"),
  ] },

  // ── Acme Technologies Ltd, 4 contracts. Accepts quickly.
  { cp: "Acme Technologies Ltd", name: "Acme Technologies, Master Services Agreement", type: "MSA", value: 210_000, daysAgo: 83, decisions: [
    capGreen,
    green("INDEMNITY", "Counterparty gives uncapped IP and data protection indemnities.", "Uncapped IP and data indemnity"),
  ] },
  { cp: "Acme Technologies Ltd", name: "Acme Technologies, SaaS Order Form 2026", type: "SaaS_AGREEMENT", value: 96_000, daysAgo: 52, decisions: [
    capGreen,
    green("DATA_PRIVACY", "Article 28 DPA with UK residency.", "Article 28 DPA, UK residency"),
  ] },
  { cp: "Acme Technologies Ltd", name: "Acme Technologies, Data Processing Agreement", type: "DPA", value: 15_000, daysAgo: 39, decisions: [
    green("DATA_PRIVACY", "Sub-processors on prior written consent, audit rights included.", "Consent-based sub-processing"),
  ] },
  { cp: "Acme Technologies Ltd", name: "Acme Technologies, Support Agreement", type: "MSA", value: 54_000, daysAgo: 18, decisions: [
    green("WARRANTIES", "Support levels warranted with service credits for sustained failure.", "Service credits on SLA breach"),
    green("PAYMENT_TERMS", "30 days from a valid invoice.", "30 days"),
  ] },

  // ── Halcyon Systems, 3 contracts. Every one renews automatically inside our
  // notice red line. Two carry RED and count toward value at risk.
  { cp: "Halcyon Systems", name: "Halcyon Systems, Platform Subscription", type: "SaaS_AGREEMENT", value: 120_000, daysAgo: 67, decisions: [
    { cat: "AUTO_RENEWAL", rag: "RED", action: "accepted",
      summary: "Renews automatically for successive 12 month terms with a 14 day notice window. This contract has already renewed once without commercial review, so a further 12 months is committed.",
      final: "Renewed for 12 months, 14 day notice window retained",
      reason: "Renewal window passed before the contract was reviewed",
      reasonCategory: "Missed at review",
      reasonText: "The renewal date was not diarised. The next window closes before the end of the current term and needs an owner." },
  ] },
  { cp: "Halcyon Systems", name: "Halcyon Systems, Analytics Module", type: "SaaS_AGREEMENT", value: 68_000, daysAgo: 41, decisions: [
    { cat: "AUTO_RENEWAL", rag: "RED", action: "accepted",
      summary: "Renews automatically for successive 12 month terms with no notice window at all, and the fee uplift on renewal is uncapped. There is no contractual route to exit before the next term begins.",
      final: "Renews automatically, no notice window and no uplift cap",
      reason: "Renewal terms were not challenged at signature",
      reasonCategory: "Missed at review",
      reasonText: "Breaches both limbs of the auto-renewal red line. Reopen at the next negotiation or budget for the uplift." },
  ] },
  { cp: "Halcyon Systems", name: "Halcyon Systems, Integration Services", type: "MSA", value: 43_000, daysAgo: 26, decisions: [
    amberModified("AUTO_RENEWAL", "Renews automatically with a 25 day notice window, inside our 90 day preferred position but at least workable.", "25 day notice window", "Counterparty would not extend the notice period"),
    green("PAYMENT_TERMS", "30 days from a valid invoice.", "30 days"),
  ] },

  // ── One-off counterparties, 17 contracts.
  // Brightwater carries the fourth and final RED.
  { cp: "Brightwater Utilities", name: "Brightwater Utilities, Data Processing Agreement", type: "DPA", value: 57_000, daysAgo: 73, decisions: [
    { cat: "DATA_PRIVACY", rag: "RED", action: "accepted",
      summary: "Personal data is processed with no Article 28 data processing agreement in place and sub-processors may be appointed without notice. Meridian carries the regulatory exposure for a processor it cannot see.",
      final: "No DPA, sub-processors appointed without notice",
      reason: "Signed by the business before legal review",
      reasonCategory: "Reached legal late",
      reasonText: "Paper was executed before it reached the team. A compliant DPA needs to be papered as a variation." },
  ] },
  { cp: "Kingsbridge Logistics", name: "Kingsbridge Logistics, Master Services Agreement", type: "MSA", value: 240_000, daysAgo: 88, decisions: [
    capGreen, green("PAYMENT_TERMS", "30 days from a valid invoice.", "30 days"),
  ] },
  { cp: "Orrell Financial", name: "Orrell Financial, SaaS Subscription", type: "SaaS_AGREEMENT", value: 132_000, daysAgo: 76, decisions: [
    capGreen, green("DATA_PRIVACY", "Article 28 DPA with UK residency.", "Article 28 DPA"),
  ] },
  { cp: "Thornbury Media", name: "Thornbury Media, Master Services Agreement", type: "MSA", value: 124_000, daysAgo: 69, decisions: [
    amberModified("INDEMNITY", "Indemnity mutual and capped except the IP limb.", "Mutual, IP uncapped", "Counterparty required mutuality"),
  ] },
  { cp: "Calder Health", name: "Calder Health, Data Processing Agreement", type: "DPA", value: 31_000, daysAgo: 62, decisions: [
    green("DATA_PRIVACY", "Article 28 terms with special category data safeguards.", "Article 28 DPA, special category safeguards"),
  ] },
  { cp: "Ridgeway Manufacturing", name: "Ridgeway Manufacturing, Supplier Agreement", type: "SUPPLIER_AGREEMENT", value: 119_000, daysAgo: 56, decisions: [
    green("WARRANTIES", "Goods warranted to specification for 24 months.", "24 month warranty"),
    green("GOVERNING_LAW", "England and Wales with exclusive jurisdiction of the English courts.", "England and Wales"),
  ] },
  { cp: "Pentland Insurance", name: "Pentland Insurance, Master Services Agreement", type: "MSA", value: 195_000, daysAgo: 50, decisions: [
    capGreen, green("INSURANCE", "Professional indemnity and cyber cover of 5 million each, evidenced annually.", "PI and cyber at 5 million"),
  ] },
  { cp: "Aldgate Consulting", name: "Aldgate Consulting, Statement of Work", type: "SOW", value: 72_000, daysAgo: 47, decisions: [
    green("IP_OWNERSHIP", "Deliverables assigned to Meridian on payment.", "Assignment on payment"),
  ] },
  { cp: "Wexford Retail", name: "Wexford Retail, SaaS Subscription", type: "SaaS_AGREEMENT", value: 94_000, daysAgo: 43, decisions: [
    capGreen, green("PAYMENT_TERMS", "30 days from a valid invoice.", "30 days"),
  ] },
  { cp: "Marlow Engineering", name: "Marlow Engineering, Supplier Agreement", type: "SUPPLIER_AGREEMENT", value: 108_000, daysAgo: 37, decisions: [
    amberModified("PAYMENT_TERMS", "Payment at 45 days rather than our preferred 30.", "45 days", "Counterparty standard terms"),
  ] },
  { cp: "Sable Payments", name: "Sable Payments, Master Services Agreement", type: "MSA", value: 210_000, daysAgo: 32, decisions: [
    capGreen, green("DATA_PRIVACY", "Article 28 DPA with UK residency and audit rights.", "Article 28 DPA"),
  ] },
  { cp: "Ferrier Group", name: "Ferrier Group, Non-Disclosure Agreement", type: "NDA", value: 16_000, daysAgo: 29, decisions: [
    green("CONFIDENTIALITY", "Mutual confidentiality surviving three years.", "Mutual, 3 year survival"),
  ] },
  { cp: "Lyndon Partners", name: "Lyndon Partners, Non-Disclosure Agreement", type: "NDA", value: 15_000, daysAgo: 24, decisions: [
    green("CONFIDENTIALITY", "Mutual confidentiality surviving three years.", "Mutual, 3 year survival"),
  ] },
  { cp: "Hartley Foods", name: "Hartley Foods, Supplier Agreement", type: "SUPPLIER_AGREEMENT", value: 86_000, daysAgo: 20, decisions: [
    green("WARRANTIES", "Goods warranted to specification with a right to reject.", "Right to reject retained"),
  ] },
  { cp: "Ashcombe Digital", name: "Ashcombe Digital, SaaS Subscription", type: "SaaS_AGREEMENT", value: 77_000, daysAgo: 13, decisions: [
    capGreen, green("AUTO_RENEWAL", "No automatic renewal. Any extension is agreed in writing before the term ends.", "No auto-renewal"),
  ] },
  { cp: "Verity Labs", name: "Verity Labs, Non-Disclosure Agreement", type: "NDA", value: 19_000, daysAgo: 1, decisions: [
    green("CONFIDENTIALITY", "Mutual confidentiality surviving three years.", "Mutual, 3 year survival"),
  ] },
  { cp: "Northgate Property", name: "Northgate Property, Supplier Agreement", type: "SUPPLIER_AGREEMENT", value: 102_000, daysAgo: 0, decisions: [
    green("GOVERNING_LAW", "England and Wales with exclusive jurisdiction of the English courts.", "England and Wales"),
    green("PAYMENT_TERMS", "30 days from a valid invoice.", "30 days"),
  ] },
];

// ── Negotiation rounds, used by the counterparty profiles ─────────────────────
// Nexus takes three rounds to close, DataFlow and Acme take one or two.
type Move = { thread: string; cat: string; round: number; proposer: "us" | "counterparty"; cp: string; us: string; movement: string; outcome: string; landing: string };
const NEGOTIATIONS: Array<{ counterparty: string; moves: Move[] }> = [
  { counterparty: "Nexus Solutions Ltd", moves: [
    { thread: "nexus-msa", cat: "limitation_of_liability", round: 1, proposer: "us", cp: "", us: "24 months of fees with carve-outs", movement: "Opened at our preferred cap", outcome: "proposed", landing: "" },
    { thread: "nexus-msa", cat: "limitation_of_liability", round: 2, proposer: "counterparty", cp: "Will only offer 12 months", us: "Held at 24 months", movement: "Countered hard to 12 months", outcome: "countered", landing: "" },
    { thread: "nexus-msa", cat: "limitation_of_liability", round: 3, proposer: "counterparty", cp: "Refuses to move above 12 months", us: "Conceded 12 months, kept carve-outs", movement: "Held firm across three rounds", outcome: "rejected", landing: "12 months of fees, carve-outs retained" },
    { thread: "nexus-sow", cat: "limitation_of_liability", round: 1, proposer: "counterparty", cp: "12 months and resists the data breach carve-out", us: "24 months with data breach carved out", movement: "Reopened the cap and the carve-out", outcome: "countered", landing: "" },
    { thread: "nexus-sow", cat: "limitation_of_liability", round: 2, proposer: "us", cp: "Still refuses the carve-out", us: "Escalated to GC", movement: "Escalated rather than conceded", outcome: "countered", landing: "" },
    { thread: "nexus-sow", cat: "limitation_of_liability", round: 3, proposer: "counterparty", cp: "Final position, no carve-out", us: "Accepted under protest", movement: "Rejected the data breach carve-out outright", outcome: "rejected", landing: "12 months, data breach not carved out" },
  ] },
  { counterparty: "DataFlow Technologies", moves: [
    { thread: "dataflow-reseller", cat: "ip_ownership", round: 1, proposer: "us", cp: "", us: "Assignment of bespoke deliverables", movement: "Asked for assignment", outcome: "proposed", landing: "" },
    { thread: "dataflow-reseller", cat: "ip_ownership", round: 2, proposer: "counterparty", cp: "Will license, not assign", us: "Perpetual licence acceptable", movement: "Settled in the second round", outcome: "accepted", landing: "Perpetual licence to deliverables" },
    { thread: "dataflow-sow", cat: "payment_terms", round: 1, proposer: "counterparty", cp: "Asked for 45 days", us: "30 days preferred", movement: "Counterparty sought longer terms", outcome: "countered", landing: "" },
    { thread: "dataflow-sow", cat: "payment_terms", round: 2, proposer: "us", cp: "Agreed 45 days on services only", us: "45 days, this SOW only", movement: "Settled in the second round", outcome: "accepted", landing: "45 days, this SOW only" },
  ] },
  { counterparty: "Acme Technologies Ltd", moves: [
    { thread: "acme-msa", cat: "limitation_of_liability", round: 1, proposer: "us", cp: "", us: "24 months of fees with carve-outs", movement: "Opened at our preferred cap", outcome: "proposed", landing: "" },
    { thread: "acme-msa", cat: "limitation_of_liability", round: 2, proposer: "counterparty", cp: "Accepts 24 months with carve-outs", us: "24 months of fees", movement: "Accepted our position first time", outcome: "accepted", landing: "24 months of fees, carve-outs retained" },
  ] },
  { counterparty: "Halcyon Systems", moves: [
    { thread: "halcyon-platform", cat: "auto_renewal", round: 1, proposer: "us", cp: "", us: "90 day notice of non-renewal", movement: "Asked for a 90 day window", outcome: "proposed", landing: "" },
    { thread: "halcyon-platform", cat: "auto_renewal", round: 2, proposer: "counterparty", cp: "Standard terms are a 14 day window", us: "Pressed for 90 days", movement: "Refused to extend the notice window", outcome: "rejected", landing: "14 day notice window" },
  ] },
];

// ── Approvals waiting on a decision ───────────────────────────────────────────
// Two CFO, one Board, each pinned to a contract that genuinely warrants it.
const APPROVALS: Array<{ contract: string; role: string; reason: string; clauseCategory: string }> = [
  { contract: "Nexus Solutions, Statement of Work Q2", role: "CFO", clauseCategory: "LIABILITY_CAP",
    reason: "data protection breach sits inside the liability cap, against the playbook red line" },
  { contract: "Halcyon Systems, Platform Subscription", role: "CFO", clauseCategory: "AUTO_RENEWAL",
    reason: "contract renewed automatically without commercial review and a further 12 months is now committed" },
  { contract: "Nexus Solutions, Master Services Agreement", role: "BOARD", clauseCategory: "LIABILITY_CAP",
    reason: "contract value is the largest in the portfolio and the cap sits below the stated playbook position" },
];

async function main() {
  await initPocketBase();

  const cos = await pb.collection("companies").getFullList();
  const company = cos.find((c: PB) => String(c.name ?? "").toLowerCase().includes("meridian"));
  if (!company) throw new Error("Meridian demo company not found");
  const cid = company.id as string;

  // Fail before writing anything if the spec arithmetic does not hold.
  const total = CONTRACTS.reduce((s, c) => s + c.value, 0);
  const redDocs = CONTRACTS.filter((c) => c.decisions.some((d) => d.rag === "RED"));
  const atRisk = redDocs.reduce((s, c) => s + c.value, 0);
  console.log(`Company: ${company.name}`);
  console.log(`Contracts: ${CONTRACTS.length} | total ${total.toLocaleString("en-GB")} | at risk ${atRisk.toLocaleString("en-GB")} across ${redDocs.length} contracts`);
  if (CONTRACTS.length !== 35) throw new Error(`Expected 35 contracts, found ${CONTRACTS.length}`);
  if (total !== 4_200_000) throw new Error(`Expected total 4,200,000, computed ${total}`);
  if (atRisk !== 340_000) throw new Error(`Expected value at risk 340,000, computed ${atRisk}`);

  await pb.collection("companies").update(cid, { subscription_tier: "team" }).catch(() => {});

  // ── Clear the prior seed, and only the prior seed ───────────────────────────
  const priorDocs = await pb.collection("uploaded_documents").getFullList({ filter: `company = "${cid}" && source = "${SEED_TAG}"` }).catch(() => [] as PB[]);
  for (const d of priorDocs) {
    for (const coll of ["review_results", "extracted_clauses"]) {
      const rows = await pb.collection(coll).getFullList({ filter: `document = "${d.id}"` }).catch(() => [] as PB[]);
      for (const r of rows) await pb.collection(coll).delete(r.id).catch(() => {});
    }
    const des = await pb.collection("decision_events").getFullList({ filter: `contract = "${d.id}"` }).catch(() => [] as PB[]);
    for (const e of des) await pb.collection("decision_events").delete(e.id).catch(() => {});
    const aps = await pb.collection("approval_requests").getFullList({ filter: `document = "${d.id}"` }).catch(() => [] as PB[]);
    for (const a of aps) await pb.collection("approval_requests").delete(a.id).catch(() => {});
    await pb.collection("uploaded_documents").delete(d.id).catch(() => {});
  }
  const priorNeg = await pb.collection("negotiation_events").getFullList({ filter: `company = "${cid}" && source = "${SEED_TAG}"` }).catch(() => [] as PB[]);
  for (const n of priorNeg) await pb.collection("negotiation_events").delete(n.id).catch(() => {});
  console.log(`Cleared prior seed: ${priorDocs.length} contracts, ${priorNeg.length} negotiation events`);

  // Approvals whose contract no longer exists. Earlier seed generations left
  // these behind, and they render in the queue as "Contract no longer in the
  // library", burying the real ones. They cannot be acted on, so they go.
  {
    const liveDocs = await pb.collection("uploaded_documents").getFullList({ filter: `company = "${cid}"`, fields: "id" }).catch(() => [] as PB[]);
    const liveIds = new Set(liveDocs.map((d) => d.id));
    const allApprovals = await pb.collection("approval_requests").getFullList({ filter: `company = "${cid}"` }).catch(() => [] as PB[]);
    const orphans = allApprovals.filter((a) => !liveIds.has(String(a["document"] ?? "")));
    for (const o of orphans) await pb.collection("approval_requests").delete(o.id).catch(() => {});
    if (orphans.length) console.log(`Cleared ${orphans.length} orphaned approval request(s) pointing at deleted contracts`);
  }

  // ── Contracts, reviews, decisions, audit ───────────────────────────────────
  const docIdByName = new Map<string, string>();
  const resultIdByDocCat = new Map<string, string>();
  let rrCount = 0, deCount = 0, auditCount = 0;

  for (const c of CONTRACTS) {
    const reviewedAt = daysAgoIso(c.daysAgo);
    const doc = await pb.collection("uploaded_documents").create({
      company: cid,
      filename: `${SEED_TAG}_${c.name.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}.pdf`,
      originalName: c.name,
      contractType: c.type,
      status: "COMPLETE",
      counterpartyName: c.cp,
      reviewType: "INBOUND",
      governingLaw: "England & Wales",
      jurisdiction: "England & Wales",
      currency: "GBP",
      contractValue: c.value,
      reviewedAt,
      source: SEED_TAG,
      draft: false,
    });
    docIdByName.set(c.name, doc.id);

    for (const d of c.decisions) {
      const result = await pb.collection("review_results").create({
        document: doc.id,
        clauseCategory: d.cat,
        ragStatus: d.rag,
        clauseSummary: d.summary,
        whyItMatters: d.summary,
        recommendedAction: d.rag === "GREEN" ? "Position acceptable as drafted." : `Negotiate toward playbook: ${d.final}.`,
        suggestedFallback: d.rag === "GREEN" ? "" : d.final,
        businessSummary: d.summary,
        confidenceLabel: "High",
        escalationRequired: d.rag === "RED",
        escalationTrigger: d.rag === "RED" ? d.reason : "",
      });
      resultIdByDocCat.set(`${doc.id}:${d.cat}`, result.id);
      rrCount++;

      await pb.collection("decision_events").create({
        company: cid,
        user: DEMO_USER,
        contract: doc.id,
        counterparty: c.cp,
        clause_category: d.cat,
        zane_recommendation: d.rag === "GREEN" ? "accept" : d.rag === "RED" ? "reject" : "negotiate",
        zane_suggested_text: "",
        human_action: d.action,
        human_final_position: d.final,
        override_reason: d.reason,
        reasoning_category: d.reasonCategory ?? "",
        reasoning_text: d.reasonText ?? "",
      });
      deCount++;
    }

    // Audit entries carry the review date, not today's date.
    for (const [action, detail] of [
      ["document_uploaded", { originalName: c.name, counterparty: c.cp }],
      ["review_completed", { clauses: c.decisions.length, red: c.decisions.filter((d) => d.rag === "RED").length }],
    ] as const) {
      await pb.collection("audit_log").create({
        company: cid, companyId: cid, user: DEMO_USER, userId: DEMO_USER,
        action, entity_type: "document", entityType: "document",
        entity_id: doc.id, entityId: doc.id,
        detail: JSON.stringify(detail),
        created: reviewedAt,
      }).catch(() => {});
      auditCount++;
    }
  }
  console.log(`Contracts ${CONTRACTS.length} | review_results ${rrCount} | decision_events ${deCount} | audit ${auditCount}`);

  // ── Negotiation events ─────────────────────────────────────────────────────
  let neCount = 0;
  for (const cp of NEGOTIATIONS) {
    for (const m of cp.moves) {
      await pb.collection("negotiation_events").create({
        company: cid, contract: "", counterparty: cp.counterparty,
        thread_id: `<${m.thread}@demo-seed>`, clause_category: m.cat, round: m.round,
        proposer: m.proposer, counterparty_position: m.cp, our_position: m.us,
        movement: m.movement, outcome: m.outcome, final_landing: m.landing, source: SEED_TAG,
      }).catch(() => {});
      neCount++;
    }
  }
  console.log(`negotiation_events ${neCount}`);

  // ── Pending approvals ──────────────────────────────────────────────────────
  let apCount = 0;
  for (const a of APPROVALS) {
    const docId = docIdByName.get(a.contract);
    if (!docId) { console.warn(`  approval skipped, contract not found: ${a.contract}`); continue; }
    await pb.collection("approval_requests").create({
      company: cid,
      document: docId,
      result: resultIdByDocCat.get(`${docId}:${a.clauseCategory}`) ?? "",
      clauseCategory: a.clauseCategory,
      routedToRole: a.role,
      reason: a.reason,
      requestedBy: DEMO_USER,
      status: "PENDING",
    });
    apCount++;
  }
  console.log(`approval_requests ${apCount} pending (${APPROVALS.filter((a) => a.role === "CFO").length} CFO, ${APPROVALS.filter((a) => a.role === "BOARD").length} Board)`);

  console.log("\nSeed complete.");
}

main()
  .catch((e) => { console.error("SEED FAILED:", e?.stack ?? e?.message ?? e); process.exitCode = 1; })
  .finally(() => process.exit(process.exitCode ?? 0));
