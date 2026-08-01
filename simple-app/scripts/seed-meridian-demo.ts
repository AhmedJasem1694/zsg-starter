/**
 * Seed the demo account (demo@zanelegal.ai, Meridian Financial Technologies Ltd)
 * with a full, realistic GC playbook and counterparty intelligence data.
 *
 * Idempotent: re-running deletes only the records this script created (playbook
 * rules for the seeded categories, and contracts/reviews/events tagged
 * source = "demo_seed") and recreates them. It never touches other companies or
 * any document not tagged as a demo seed.
 *
 * Run:  npx tsx scripts/seed-meridian-demo.ts
 */

import "dotenv/config";
import { initPocketBase, pb } from "../server/pb.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PB = Record<string, any>;

const DEMO_USER = "demo@zanelegal.ai";
const SEED_TAG = "demo_seed";

// ─── Playbook (12 core commercial categories, GC-level positions) ───────────────
// clauseCategory uses the ClauseCategory enum keys so the playbook UI and the
// counterparty intelligence join line up.
const PLAYBOOK: Array<{
  cat: string; preferred: string; fallback: string; redline: string; approval: string; weight: number;
}> = [
  {
    cat: "LIABILITY_CAP", approval: "GC", weight: 5,
    preferred: "Aggregate liability capped at 24 months of fees paid in the 12 months preceding the claim, with uncapped carve-outs for breach of confidentiality, data protection breaches, IP infringement, and wilful misconduct. Exclusion of indirect and consequential loss is mutual.",
    fallback: "12 months of fees cap, retaining uncapped carve-outs for data protection breaches and IP infringement.",
    redline: "Any cap below 12 months of fees, or any cap that includes (rather than carves out) data protection breach or IP infringement liability.",
  },
  {
    cat: "INDEMNITY", approval: "GC", weight: 5,
    preferred: "Counterparty indemnifies Meridian for third-party claims arising from IP infringement, data protection breaches, and breach of applicable law. These indemnities are uncapped and survive termination. Meridian indemnities, if any, are limited to the liability cap.",
    fallback: "Mutual IP and data protection indemnities, each capped at the liability cap except the IP and data protection limbs which remain uncapped.",
    redline: "Meridian giving an uncapped general indemnity, or indemnifying the counterparty for the counterparty's own products, infrastructure, or regulatory obligations.",
  },
  {
    cat: "DATA_PRIVACY", approval: "LEGAL", weight: 5,
    preferred: "UK GDPR and Data Protection Act 2018 compliant DPA in place, with Meridian as controller where it determines the purposes. Processor bound by Article 28 terms, sub-processors only with prior written consent, data held in the UK or an adequacy country, breach notification within 72 hours, audit rights, and return or deletion on termination.",
    fallback: "Standard Article 28 processor terms with sub-processor notification rather than consent, UK or EEA or SCC-backed transfers, and breach notification within 72 hours.",
    redline: "No DPA, processing or transfer outside the UK, adequacy, or SCCs without safeguards, breach notification slower than 72 hours, or any right to use Meridian personal data for the counterparty's own purposes or AI training.",
  },
  {
    cat: "CONFIDENTIALITY", approval: "", weight: 4,
    preferred: "Mutual confidentiality surviving 5 years post-termination, and indefinitely for trade secrets and personal data. Use limited to performing the agreement, with standard exceptions only (public domain, independently developed, or required by law).",
    fallback: "Mutual confidentiality surviving 3 years post-termination.",
    redline: "One-way confidentiality favouring the counterparty, survival under 2 years, or any right to disclose Meridian confidential information to affiliates or for marketing without consent.",
  },
  {
    cat: "IP_OWNERSHIP", approval: "GC", weight: 4,
    preferred: "Meridian retains all pre-existing IP and all IP in deliverables created for Meridian, with the counterparty assigning IP in bespoke deliverables on payment. The counterparty keeps its background IP and grants Meridian a perpetual, royalty-free licence to use it as embedded in the deliverables.",
    fallback: "Meridian receives a perpetual, worldwide, royalty-free licence (rather than assignment) to the bespoke deliverables, with the right to modify and to sublicense to affiliates.",
    redline: "Counterparty retaining ownership of bespoke deliverables Meridian has paid for, any licence-back of Meridian background IP, or any claim over Meridian customer data or models.",
  },
  {
    cat: "TERMINATION", approval: "", weight: 3,
    preferred: "Termination for convenience on 60 days notice. Immediate termination for material breach uncured after 30 days, for insolvency, or for a change of control of the counterparty. Meridian may terminate immediately for a data protection or regulatory breach. Fees are payable only for services rendered to the termination date.",
    fallback: "Termination for convenience on 90 days notice, with a 30 day cure period for material breach.",
    redline: "No termination for convenience, cure periods longer than 30 days, early-termination penalties, or any obligation to pay for unperformed services.",
  },
  {
    cat: "PAYMENT_TERMS", approval: "", weight: 3,
    preferred: "30 days from receipt of a valid invoice. Fees fixed for the initial term, with annual increases capped at CPI or 3 percent, whichever is lower, on 60 days notice. Meridian may set off amounts owed, and may withhold genuinely disputed amounts pending resolution.",
    fallback: "30 day payment terms with annual increases capped at 5 percent on 90 days notice.",
    redline: "Payment terms under 30 days, uncapped or RPI-plus price increases, advance payment for unperformed services, or no right to withhold disputed sums.",
  },
  {
    cat: "WARRANTIES", approval: "", weight: 3,
    preferred: "Counterparty warrants that services are performed with reasonable skill and care and in line with the SLA, conform to specification and documentation, do not infringe third-party IP, comply with applicable law including financial services and data protection regulation, and are free of malicious code. Warranties survive 12 months.",
    fallback: "Core warranties (skill and care, non-infringement, compliance with law) with a 6 month warranty period.",
    redline: "Services provided as is, exclusion of the non-infringement or compliance-with-law warranties, or a warranty period under 90 days.",
  },
  {
    cat: "GOVERNING_LAW", approval: "", weight: 2,
    preferred: "Governed by the laws of England and Wales, with the exclusive jurisdiction of the English courts.",
    fallback: "England and Wales governing law with non-exclusive English jurisdiction, or London-seated arbitration under the LCIA Rules for cross-border counterparties.",
    redline: "Governing law or jurisdiction outside England and Wales, other than London-seated LCIA arbitration, or any agreement to litigate abroad.",
  },
  {
    cat: "ASSIGNMENT", approval: "", weight: 3,
    preferred: "Neither party may assign without the other's prior written consent, except that Meridian may assign to an affiliate or in connection with a group reorganisation or sale of the business. The counterparty may not subcontract material obligations without Meridian's prior written consent and remains fully liable for its subcontractors.",
    fallback: "Assignment to affiliates permitted on notice, and subcontracting permitted to pre-approved subcontractors with the counterparty remaining fully liable.",
    redline: "Counterparty assigning the contract or subcontracting core or regulated services without consent, or any subcontracting that offshores Meridian data outside approved locations.",
  },
  {
    cat: "FORCE_MAJEURE", approval: "", weight: 2,
    preferred: "Mutual and limited to genuinely unforeseeable events beyond reasonable control. Excludes labour disputes of the affected party's own workforce and the failure of the counterparty's subcontractors. The affected party must mitigate and notify within 5 business days, and either party may terminate if the event continues beyond 30 days. Payment obligations are not excused.",
    fallback: "Mutual force majeure with a 60 day termination right and prompt notification.",
    redline: "Force majeure that excuses payment obligations, no termination right for prolonged events, or inclusion of foreseeable events such as the counterparty's own resourcing or subcontractor failures.",
  },
  {
    cat: "INSURANCE", approval: "", weight: 3,
    preferred: "Counterparty maintains, with reputable insurers, professional indemnity cover of at least 5 million pounds per claim, cyber and data-breach cover of at least 5 million pounds, and public liability cover of at least 2 million pounds, throughout the term and for 2 years afterwards, with evidence provided on request.",
    fallback: "Professional indemnity and cyber cover of at least 2 million pounds each, and public liability of at least 1 million pounds, with evidence on request.",
    redline: "No cyber or data-breach cover, professional indemnity below 1 million pounds, or cover that lapses on termination with no run-off period.",
  },
  {
    cat: "AUTO_RENEWAL", approval: "GC", weight: 4,
    preferred: "No automatic renewal. Any extension is agreed in writing before the end of the term, with pricing reviewed at that point.",
    fallback: "Automatic renewal for no more than 12 months, with at least 90 days' written notice of non-renewal and any uplift capped at CPI.",
    redline: "Automatic renewal with no notice window, a notice window of 30 days or less, or an uncapped price increase taking effect on renewal.",
  },
];

// ─── Counterparty contracts + reviews + decision events ────────────────────────
// rag drives the review card colour; action drives the counterparty intelligence
// (accepted -> got our position; modified/overridden -> they pushed back).
type Decision = { cat: string; rag: "GREEN" | "AMBER" | "RED"; action: "accepted" | "modified" | "overridden"; final: string; reason: string; summary: string; reasonCategory?: string; reasonText?: string };
type Contract = { counterparty: string; name: string; type: string; value: number; decisions: Decision[] };

const CONTRACTS: Contract[] = [
  // Acme Technologies Ltd, generally agreeable, accepts our preferred liability cap.
  { counterparty: "Acme Technologies Ltd", name: "Acme Technologies, Master Services Agreement", type: "MSA", value: 180_000, decisions: [
    { cat: "LIABILITY_CAP", rag: "GREEN", action: "accepted", final: "24 months of fees, data protection and IP carved out", reason: "Counterparty accepted our preferred cap", summary: "Liability capped at 24 months of fees with data and IP carve-outs, matching our preferred position." },
    { cat: "INDEMNITY", rag: "GREEN", action: "accepted", final: "Counterparty IP and data protection indemnity, uncapped", reason: "Accepted our indemnity position", summary: "Counterparty gives uncapped IP and data protection indemnities." },
    { cat: "DATA_PRIVACY", rag: "GREEN", action: "accepted", final: "UK GDPR Article 28 DPA, UK data residency", reason: "DPA in line with playbook", summary: "Compliant Article 28 DPA with UK residency and 72-hour breach notice." },
  ] },
  { counterparty: "Acme Technologies Ltd", name: "Acme Technologies, Data Processing Agreement", type: "DPA", value: 0, decisions: [
    { cat: "LIABILITY_CAP", rag: "GREEN", action: "accepted", final: "24 months of fees, data breach uncapped", reason: "Accepted preferred cap", summary: "24 month cap with uncapped data breach liability." },
    { cat: "DATA_PRIVACY", rag: "GREEN", action: "accepted", final: "Sub-processors by prior consent, UK residency", reason: "Strong DPA terms", summary: "Sub-processors only by prior written consent, audit rights included." },
  ] },
  { counterparty: "Acme Technologies Ltd", name: "Acme Technologies, SaaS Order Form 2025", type: "SaaS_AGREEMENT", value: 95_000, decisions: [
    { cat: "LIABILITY_CAP", rag: "AMBER", action: "modified", final: "18 months of fees, carve-outs retained", reason: "Counterparty pushed to 18 months on a lower-value order", summary: "Cap negotiated to 18 months of fees on this order, carve-outs retained." },
    { cat: "INDEMNITY", rag: "AMBER", action: "modified", final: "Mutual indemnity, capped except IP and data", reason: "Moved to a mutual indemnity", summary: "Indemnity became mutual, capped except IP and data limbs." },
    { cat: "AUTO_RENEWAL", rag: "RED", action: "accepted", final: "Renews automatically for 12 months, 14 day notice window retained", reason: "Order form signed to hit the go-live date before the renewal terms were negotiated", summary: "Renews automatically for successive 12 month terms. Notice of non-renewal must be given in the 14 days before expiry, well inside our 90 day red line.", reasonCategory: "Commercial pressure", reasonText: "Go-live date drove the signature; the renewal window was accepted as drafted and needs reopening before the next term." },
  ] },

  // Nexus Solutions Ltd, consistently pushes back on liability, typical counter 12 months.
  { counterparty: "Nexus Solutions Ltd", name: "Nexus Solutions, Master Services Agreement", type: "MSA", value: 240_000, decisions: [
    { cat: "LIABILITY_CAP", rag: "AMBER", action: "accepted", final: "12 months of fees, carve-outs retained", reason: "Counterparty countered to a 12 month cap", summary: "Cap negotiated down to 12 months of fees, the counterparty's standard counter.", reasonCategory: "Strategic relationship", reasonText: "Multi-year strategic account; accepted their 12 month counter to keep the relationship moving." },
    { cat: "PAYMENT_TERMS", rag: "GREEN", action: "accepted", final: "30 days, CPI-capped increases", reason: "Accepted our payment terms", summary: "30 day terms with CPI-capped annual increases." },
  ] },
  { counterparty: "Nexus Solutions Ltd", name: "Nexus Solutions, Software Licence Agreement", type: "MSA", value: 130_000, decisions: [
    { cat: "LIABILITY_CAP", rag: "AMBER", action: "accepted", final: "12 months of fees, carve-outs retained", reason: "Counterparty countered to a 12 month cap again", summary: "Cap settled at 12 months of fees, consistent with their prior position." },
    { cat: "PAYMENT_TERMS", rag: "GREEN", action: "accepted", final: "30 days from valid invoice", reason: "Accepted payment terms", summary: "30 day payment terms accepted." },
  ] },
  { counterparty: "Nexus Solutions Ltd", name: "Nexus Solutions, Statement of Work Q1 2025", type: "MSA", value: 70_000, decisions: [
    { cat: "LIABILITY_CAP", rag: "RED", action: "accepted", final: "12 months of fees, data breach NOT carved out (escalated to GC)", reason: "Counterparty refused to carve out data breach; escalated and accepted under protest for this low-value SOW", summary: "Counterparty refused the data breach carve-out, breaching a red line. Escalated to GC.", reasonCategory: "One off exception", reasonText: "Low-value SOW; accepted the data breach exposure under protest this once, not a precedent for Nexus." },
    { cat: "INDEMNITY", rag: "AMBER", action: "modified", final: "Mutual indemnity with caps", reason: "Negotiated to mutual", summary: "Indemnity negotiated to mutual with caps." },
  ] },

  // DataFlow Technologies, mixed, negotiates IP and payment terms.
  { counterparty: "DataFlow Technologies", name: "DataFlow Technologies, Reseller Agreement", type: "MSA", value: 150_000, decisions: [
    { cat: "IP_OWNERSHIP", rag: "AMBER", action: "modified", final: "Perpetual licence to deliverables rather than assignment", reason: "Counterparty would license, not assign", summary: "Bespoke deliverables licensed perpetually rather than assigned." },
    { cat: "CONFIDENTIALITY", rag: "GREEN", action: "accepted", final: "Mutual, 5 year survival", reason: "Accepted confidentiality terms", summary: "Mutual confidentiality surviving 5 years." },
  ] },
  { counterparty: "DataFlow Technologies", name: "DataFlow Technologies, API Integration Agreement", type: "SaaS_AGREEMENT", value: 60_000, decisions: [
    { cat: "IP_OWNERSHIP", rag: "GREEN", action: "accepted", final: "Assignment of bespoke deliverables on payment", reason: "Accepted assignment", summary: "Counterparty assigned bespoke deliverables on payment." },
    { cat: "CONFIDENTIALITY", rag: "GREEN", action: "accepted", final: "Mutual, 5 year survival", reason: "Accepted confidentiality terms", summary: "Mutual confidentiality surviving 5 years." },
    { cat: "AUTO_RENEWAL", rag: "RED", action: "accepted", final: "Renews automatically for 12 months, no notice window and no uplift cap", reason: "Renewal terms not challenged at signature", summary: "Renews automatically for successive 12 month terms with no notice window at all, and the fee uplift on renewal is uncapped.", reasonCategory: "Missed at review", reasonText: "The renewal clause was not raised during the review; it breaches both limbs of the auto-renewal red line." },
  ] },
];

// ─── Negotiation events (Section 3c vendor profiles) ───────────────────────────
type Move = { thread: string; cat: string; round: number; proposer: "us" | "counterparty"; cp: string; us: string; movement: string; outcome: "proposed" | "countered" | "accepted" | "rejected" | "open"; landing: string };
const NEGOTIATIONS: Array<{ counterparty: string; moves: Move[] }> = [
  { counterparty: "Acme Technologies Ltd", moves: [
    { thread: "acme-msa", cat: "limitation_of_liability", round: 1, proposer: "us", cp: "", us: "24 months of fees with data and IP carve-outs", movement: "Opened at our preferred cap", outcome: "proposed", landing: "" },
    { thread: "acme-msa", cat: "limitation_of_liability", round: 2, proposer: "counterparty", cp: "Accepts 24 months with carve-outs", us: "24 months of fees", movement: "Counterparty accepted our preferred cap", outcome: "accepted", landing: "24 months of fees, data and IP carved out" },
    { thread: "acme-saas", cat: "indemnity", round: 1, proposer: "counterparty", cp: "Prefers a mutual indemnity", us: "Counterparty IP and data indemnity", movement: "Counterparty asked for mutuality", outcome: "countered", landing: "" },
    { thread: "acme-saas", cat: "indemnity", round: 2, proposer: "us", cp: "Mutual, capped except IP and data", us: "Mutual indemnity acceptable", movement: "Settled on a mutual indemnity", outcome: "accepted", landing: "Mutual indemnity, capped except IP and data" },
  ] },
  { counterparty: "Nexus Solutions Ltd", moves: [
    { thread: "nexus-msa", cat: "limitation_of_liability", round: 1, proposer: "us", cp: "", us: "24 months of fees with carve-outs", movement: "Opened at our preferred cap", outcome: "proposed", landing: "" },
    { thread: "nexus-msa", cat: "limitation_of_liability", round: 2, proposer: "counterparty", cp: "Will only offer 12 months of fees", us: "Held at 24 months", movement: "Counterparty countered hard to 12 months", outcome: "countered", landing: "" },
    { thread: "nexus-msa", cat: "limitation_of_liability", round: 3, proposer: "counterparty", cp: "Refuses to move above 12 months", us: "Conceded 12 months, kept carve-outs", movement: "Counterparty held firm at 12 months", outcome: "rejected", landing: "12 months of fees, carve-outs retained" },
    { thread: "nexus-sow", cat: "limitation_of_liability", round: 1, proposer: "counterparty", cp: "12 months and resists the data breach carve-out", us: "24 months with data breach carved out", movement: "Counterparty reopened the cap and the carve-out", outcome: "countered", landing: "" },
    { thread: "nexus-sow", cat: "limitation_of_liability", round: 2, proposer: "counterparty", cp: "Refuses the data breach carve-out", us: "Escalated to GC", movement: "Counterparty rejected the data breach carve-out", outcome: "rejected", landing: "12 months, data breach not carved out (escalated)" },
  ] },
  { counterparty: "DataFlow Technologies", moves: [
    { thread: "dataflow-reseller", cat: "ip_ownership", round: 1, proposer: "us", cp: "", us: "Assignment of bespoke deliverables", movement: "Asked for assignment", outcome: "proposed", landing: "" },
    { thread: "dataflow-reseller", cat: "ip_ownership", round: 2, proposer: "counterparty", cp: "Will license, not assign", us: "Perpetual licence acceptable as fallback", movement: "Counterparty offered a perpetual licence", outcome: "accepted", landing: "Perpetual licence to deliverables" },
    { thread: "dataflow-api", cat: "payment_terms", round: 1, proposer: "counterparty", cp: "Asked for 45 day terms", us: "30 days from valid invoice", movement: "Counterparty sought longer terms", outcome: "countered", landing: "" },
    { thread: "dataflow-api", cat: "payment_terms", round: 2, proposer: "us", cp: "Agrees 30 days", us: "30 days", movement: "Settled at 30 days", outcome: "accepted", landing: "30 days from valid invoice" },
  ] },
];

async function main() {
  await initPocketBase();

  const cos = await pb.collection("companies").getFullList();
  const company = cos.find((c: PB) => String(c.name ?? "").toLowerCase().includes("meridian"));
  if (!company) throw new Error("Meridian demo company not found");
  const cid = company.id as string;
  console.log(`Meridian company: ${company.name} (${cid})`);

  // Demo account must never hit the trial monthly-review cap: give it an unlimited tier.
  await pb.collection("companies").update(cid, { subscription_tier: "team" }).catch(() => {});

  // ── Cleanup prior seed (only records this script created) ──────────────────
  const priorDocs = await pb.collection("uploaded_documents").getFullList({ filter: `company = "${cid}" && source = "${SEED_TAG}"` }).catch(() => [] as PB[]);
  for (const d of priorDocs) {
    const rrs = await pb.collection("review_results").getFullList({ filter: `document = "${d.id}"` }).catch(() => [] as PB[]);
    for (const r of rrs) await pb.collection("review_results").delete(r.id).catch(() => {});
    const des = await pb.collection("decision_events").getFullList({ filter: `contract = "${d.id}"` }).catch(() => [] as PB[]);
    for (const e of des) await pb.collection("decision_events").delete(e.id).catch(() => {});
    await pb.collection("uploaded_documents").delete(d.id).catch(() => {});
  }
  const priorNeg = await pb.collection("negotiation_events").getFullList({ filter: `company = "${cid}" && source = "${SEED_TAG}"` }).catch(() => [] as PB[]);
  for (const n of priorNeg) await pb.collection("negotiation_events").delete(n.id).catch(() => {});
  if (priorDocs.length || priorNeg.length) console.log(`Cleaned prior seed: ${priorDocs.length} contract(s), ${priorNeg.length} negotiation event(s)`);

  // ── Playbook (delete existing rules for our categories, then create) ───────
  const existingRules = await pb.collection("playbook_rules").getFullList({ filter: `company = "${cid}"` }).catch(() => [] as PB[]);
  const cats = new Set(PLAYBOOK.map((p) => p.cat));
  for (const r of existingRules) if (cats.has(String(r.clauseCategory))) await pb.collection("playbook_rules").delete(r.id).catch(() => {});
  for (const p of PLAYBOOK) {
    await pb.collection("playbook_rules").create({
      company: cid,
      workflowType: company.workflowType ?? "COMMERCIAL_CONTRACT",
      clauseCategory: p.cat,
      preferredPosition: p.preferred,
      acceptableFallback: p.fallback,
      hardRedLine: p.redline,
      approvalRequired: p.approval,
      riskWeight: p.weight,
    });
  }
  console.log(`Playbook: created ${PLAYBOOK.length} rules`);

  // ── Contracts + reviews + decision events ──────────────────────────────────
  let docCount = 0, rrCount = 0, deCount = 0;
  for (const c of CONTRACTS) {
    const doc = await pb.collection("uploaded_documents").create({
      company: cid,
      filename: `${SEED_TAG}_${Math.random().toString(36).slice(2)}.pdf`,
      originalName: c.name,
      contractType: c.type,
      status: "COMPLETE",
      counterpartyName: c.counterparty,
      reviewType: "INBOUND",
      governingLaw: "England & Wales",
      currency: "GBP",
      contractValue: c.value || undefined,
      source: SEED_TAG,
      draft: false,
    });
    docCount++;
    for (const d of c.decisions) {
      await pb.collection("review_results").create({
        document: doc.id,
        clauseCategory: d.cat,
        ragStatus: d.rag,
        clauseSummary: d.summary,
        whyItMatters: d.summary,
        recommendedAction: d.rag === "GREEN" ? "Position acceptable as drafted." : `Negotiate toward playbook: ${d.final}.`,
        // Fallback / replacement wording, present on non-green clauses so the
        // negotiation message and the redrafted clause outputs both surface.
        suggestedFallback: d.rag === "GREEN" ? "" : d.final,
        businessSummary: d.summary,
        confidenceLabel: "High",
        escalationRequired: d.rag === "RED",
        escalationTrigger: d.rag === "RED" ? d.reason : "",
      });
      rrCount++;
      await pb.collection("decision_events").create({
        company: cid,
        user: DEMO_USER,
        contract: doc.id,
        counterparty: c.counterparty,
        clause_category: d.cat,
        // What Zane recommended, derived from the RAG it produced.
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
  }
  console.log(`Contracts: ${docCount} | review_results: ${rrCount} | decision_events: ${deCount}`);

  // ── Negotiation events (vendor profiles) ───────────────────────────────────
  let neCount = 0;
  for (const cp of NEGOTIATIONS) {
    for (const m of cp.moves) {
      await pb.collection("negotiation_events").create({
        company: cid,
        contract: "",
        counterparty: cp.counterparty,
        thread_id: `<${m.thread}@demo-seed>`,
        clause_category: m.cat,
        round: m.round,
        proposer: m.proposer,
        counterparty_position: m.cp,
        our_position: m.us,
        movement: m.movement,
        outcome: m.outcome,
        final_landing: m.landing,
        source: SEED_TAG,
      });
      neCount++;
    }
  }
  console.log(`negotiation_events: ${neCount}`);

  console.log("\nDemo seed complete.");
}

main()
  .catch((e) => { console.error("SEED FAILED:", e?.stack ?? e?.message ?? e); process.exitCode = 1; })
  .finally(() => process.exit(process.exitCode ?? 0));
