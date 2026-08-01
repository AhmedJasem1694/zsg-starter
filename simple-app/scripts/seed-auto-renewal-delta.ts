/**
 * Additive delta for the Meridian demo: auto-renewal exposure.
 *
 * seed-meridian-demo.ts is the source of truth and now contains this data, but
 * re-running it deletes and recreates every seeded contract with new ids, which
 * would orphan the seeded approvals and any feedback attached to those reviews.
 * This script applies only the missing pieces to the live demo data in place.
 *
 * Idempotent: every write checks for an existing record first, so re-running
 * changes nothing.
 *
 * Run:  npx tsx scripts/seed-auto-renewal-delta.ts
 */

import "dotenv/config";
import { initPocketBase, pb } from "../server/pb.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PB = Record<string, any>;

const SEED_TAG = "demo_seed";
const DEMO_USER = "demo@zanelegal.ai";

const PLAYBOOK_RULE = {
  clauseCategory: "AUTO_RENEWAL",
  preferredPosition:
    "No automatic renewal. Any extension is agreed in writing before the end of the term, with pricing reviewed at that point.",
  acceptableFallback:
    "Automatic renewal for no more than 12 months, with at least 90 days' written notice of non-renewal and any uplift capped at CPI.",
  hardRedLine:
    "Automatic renewal with no notice window, a notice window of 30 days or less, or an uncapped price increase taking effect on renewal.",
  approvalRequired: "GC",
  riskWeight: 4,
};

/** Auto-renewal findings, attached to contracts that already exist in the seed. */
const FINDINGS: Array<{
  contract: string; counterparty: string; summary: string; final: string;
  reason: string; reasonCategory: string; reasonText: string;
}> = [
  {
    contract: "Acme Technologies, SaaS Order Form 2025",
    counterparty: "Acme Technologies Ltd",
    summary:
      "Renews automatically for successive 12 month terms. Notice of non-renewal must be given in the 14 days before expiry, well inside our 90 day red line.",
    final: "Renews automatically for 12 months, 14 day notice window retained",
    reason: "Order form signed to hit the go-live date before the renewal terms were negotiated",
    reasonCategory: "Commercial pressure",
    reasonText:
      "Go-live date drove the signature; the renewal window was accepted as drafted and needs reopening before the next term.",
  },
  {
    contract: "DataFlow Technologies, API Integration Agreement",
    counterparty: "DataFlow Technologies",
    summary:
      "Renews automatically for successive 12 month terms with no notice window at all, and the fee uplift on renewal is uncapped.",
    final: "Renews automatically for 12 months, no notice window and no uplift cap",
    reason: "Renewal terms not challenged at signature",
    reasonCategory: "Missed at review",
    reasonText:
      "The renewal clause was not raised during the review; it breaches both limbs of the auto-renewal red line.",
  },
];

async function main() {
  await initPocketBase();

  const cos = await pb.collection("companies").getFullList();
  const company = cos.find((c: PB) => String(c.name ?? "").toLowerCase().includes("meridian"));
  if (!company) throw new Error("Meridian demo company not found");
  const cid = company.id as string;
  console.log(`Company: ${company.name} (${cid})`);

  // ── Playbook rule ──────────────────────────────────────────────────────────
  const rules = await pb.collection("playbook_rules").getFullList({ filter: `company = "${cid}"` });
  const hasRule = rules.some((r: PB) => r.clauseCategory === "AUTO_RENEWAL");
  if (hasRule) {
    console.log("Playbook: AUTO_RENEWAL rule already present, skipped");
  } else {
    await pb.collection("playbook_rules").create({
      company: cid,
      workflowType: company.workflowType ?? "COMMERCIAL_CONTRACT",
      ...PLAYBOOK_RULE,
    });
    console.log("Playbook: created AUTO_RENEWAL rule");
  }

  // ── Findings on existing contracts ─────────────────────────────────────────
  const docs = await pb.collection("uploaded_documents").getFullList({ filter: `company = "${cid}"` });
  let created = 0, skipped = 0;

  for (const f of FINDINGS) {
    const doc = docs.find((d: PB) => d.originalName === f.contract);
    if (!doc) { console.warn(`  MISSING contract, skipped: ${f.contract}`); continue; }

    const existing = await pb.collection("review_results").getFullList({
      filter: `document = "${doc.id}" && clauseCategory = "AUTO_RENEWAL"`,
    }).catch(() => [] as PB[]);
    if (existing.length > 0) { skipped++; console.log(`  already present: ${f.contract}`); continue; }

    await pb.collection("review_results").create({
      document: doc.id,
      clauseCategory: "AUTO_RENEWAL",
      ragStatus: "RED",
      clauseSummary: f.summary,
      whyItMatters: f.summary,
      recommendedAction: `Negotiate toward playbook: ${PLAYBOOK_RULE.acceptableFallback}`,
      suggestedFallback: PLAYBOOK_RULE.acceptableFallback,
      businessSummary: f.summary,
      confidenceLabel: "High",
      escalationRequired: true,
      escalationTrigger: f.reason,
    });
    await pb.collection("decision_events").create({
      company: cid,
      user: DEMO_USER,
      contract: doc.id,
      counterparty: f.counterparty,
      clause_category: "AUTO_RENEWAL",
      zane_recommendation: "reject",
      zane_suggested_text: "",
      human_action: "accepted",
      human_final_position: f.final,
      override_reason: f.reason,
      reasoning_category: f.reasonCategory,
      reasoning_text: f.reasonText,
    });
    created++;
    console.log(`  created: ${f.contract} (£${doc.contractValue ?? 0})`);
  }

  console.log(`\nAuto-renewal findings: ${created} created, ${skipped} already present.`);
  console.log(`Seed tag on parent contracts: ${SEED_TAG}`);
}

main()
  .catch((e) => { console.error("DELTA FAILED:", e?.stack ?? e?.message ?? e); process.exitCode = 1; })
  .finally(() => process.exit(process.exitCode ?? 0));
