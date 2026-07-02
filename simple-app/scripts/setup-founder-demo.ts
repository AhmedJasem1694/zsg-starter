/**
 * setup-founder-demo.ts
 *
 * Creates the Pulse Health Technologies Ltd founder demo account in PocketBase.
 * The server's getCompany() uses name-based detection ("pulse" fragment) to
 * route founder-demo@zanelegal.ai to the Pulse company, no schema changes needed.
 *
 * Run: npx tsx scripts/setup-founder-demo.ts
 */

import PocketBase from "pocketbase";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config();

const pb = new PocketBase(process.env.POCKETBASE_URL ?? "http://localhost:8090");

type PBRecord = Record<string, unknown>;

async function run() {
  await pb.admins.authWithPassword(
    process.env.POCKETBASE_ADMIN_EMAIL ?? "",
    process.env.POCKETBASE_ADMIN_PASSWORD ?? ""
  );
  console.log("✓ Authenticated");

  // ── 1. Create / update Pulse company ─────────────────────────────────────────
  const companies = await pb.collection("companies").getFullList<PBRecord>();
  const existingPulse = companies.find((c) =>
    String(c["name"] ?? "").toLowerCase().includes("pulse")
  );

  let pulseCompany: PBRecord;
  const companyData = {
    name: "Pulse Health Technologies Ltd",
    sector: "healthtech",
    jurisdiction: "england_wales",
    riskAppetite: "COMMERCIAL",
    risk_appetite: "COMMERCIAL",
    workflowType: "COMMERCIAL_CONTRACT",
    workflow_types: "COMMERCIAL_CONTRACT",
    persona: "FOUNDER",
    interface_type: "founder",
    role: "BUYER",
    industry: "Digital Health",
    // Demo account must never hit the trial monthly-review cap.
    subscription_tier: "team",
  };

  if (existingPulse) {
    pulseCompany = await pb.collection("companies").update(String(existingPulse["id"]), companyData);
    console.log(`✓ Updated Pulse company (${pulseCompany["id"]})`);
  } else {
    pulseCompany = await pb.collection("companies").create(companyData);
    console.log(`✓ Created Pulse company (${pulseCompany["id"]})`);
  }

  // ── 2. Create / update founder-demo user ─────────────────────────────────────
  const existingUsers = await pb.collection("users").getFullList<PBRecord>({
    filter: `email = "founder-demo@zanelegal.ai"`,
  });

  let founderUser: PBRecord;
  const passwordHash = await bcrypt.hash("ZaneDemo2026!", 12);
  const PLAIN_PASSWORD = "ZaneDemo2026!";

  if (existingUsers.length > 0) {
    founderUser = await pb.collection("users").update(String(existingUsers[0]["id"]), {
      name: "James Rivera",
      password: PLAIN_PASSWORD,
      passwordConfirm: PLAIN_PASSWORD,
      passwordHash,
    });
    console.log(`✓ Updated founder user (${founderUser["id"]})`);
  } else {
    founderUser = await pb.collection("users").create({
      email: "founder-demo@zanelegal.ai",
      name: "James Rivera",
      password: PLAIN_PASSWORD,
      passwordConfirm: PLAIN_PASSWORD,
      passwordHash,
    });
    console.log(`✓ Created founder user (${founderUser["id"]})`);
  }

  // ── 3. Playbook rules ─────────────────────────────────────────────────────────
  const existingRules = await pb.collection("playbook_rules").getFullList<PBRecord>({
    filter: `company = "${pulseCompany["id"]}"`,
  });
  await Promise.all(existingRules.map((r) => pb.collection("playbook_rules").delete(String(r["id"]))));

  const RULES = [
    {
      clauseCategory: "LIABILITY_CAP",
      workflowType: "COMMERCIAL_CONTRACT",
      preferredPosition: "Mutual cap at 12 months of fees, applying equally to both parties. Exclusions for death, personal injury, and fraud only.",
      acceptableFallback: "Mutual cap at 6 months of fees. Minimum acceptable.",
      hardRedLine: "No cap, cap below 3 months fees, or asymmetric cap favouring supplier.",
      approvalRequired: "GC",
      riskWeight: 10,
    },
    {
      clauseCategory: "DATA_PRIVACY",
      workflowType: "COMMERCIAL_CONTRACT",
      preferredPosition: "Full UK GDPR DPA as a schedule covering all Article 28 requirements. UK-only data processing. Written consent for new sub-processors.",
      acceptableFallback: "DPA by reference acceptable if it meets UK GDPR minimum requirements.",
      hardRedLine: "No DPA where personal data is being processed. Non-UK storage without adequacy basis.",
      approvalRequired: "GC",
      riskWeight: 10,
    },
    {
      clauseCategory: "IP_OWNERSHIP",
      workflowType: "COMMERCIAL_CONTRACT",
      preferredPosition: "Company retains all IP in bespoke outputs and deliverables. Supplier retains background IP with licence back.",
      acceptableFallback: "Perpetual, irrevocable, royalty-free licence to use, adapt, and sublicense outputs for any business purpose.",
      hardRedLine: "Supplier ownership of bespoke deliverables with no licence back. Any restriction on using what we paid for.",
      approvalRequired: "GC",
      riskWeight: 8,
    },
    {
      clauseCategory: "PAYMENT_TERMS",
      workflowType: "COMMERCIAL_CONTRACT",
      preferredPosition: "Net 30 from receipt of valid invoice. Monthly billing for annual contracts.",
      acceptableFallback: "Net 45. Quarterly billing for annual contracts.",
      hardRedLine: "Full annual fee payable upfront with no refund right on early termination.",
      approvalRequired: "LEGAL",
      riskWeight: 6,
    },
    {
      clauseCategory: "TERMINATION",
      workflowType: "COMMERCIAL_CONTRACT",
      preferredPosition: "Termination for convenience on 30 days written notice. Immediate termination for unremedied material breach.",
      acceptableFallback: "60 days notice for convenience where supplier has genuine setup costs.",
      hardRedLine: "No termination for convenience right. Lock-in for full term with no exit.",
      approvalRequired: "LEGAL",
      riskWeight: 7,
    },
  ];

  for (const rule of RULES) {
    await pb.collection("playbook_rules").create({ company: pulseCompany["id"], ...rule });
  }
  console.log(`✓ Created ${RULES.length} playbook rules`);

  // ── 4. Demo contract ──────────────────────────────────────────────────────────
  const existingDocs = await pb.collection("uploaded_documents").getFullList<PBRecord>({
    filter: `company = "${pulseCompany["id"]}"`,
  });
  await Promise.all(existingDocs.map((d) => pb.collection("uploaded_documents").delete(String(d["id"]))));

  const demoDoc = await pb.collection("uploaded_documents").create({
    company: pulseCompany["id"],
    filename: "cloud-infrastructure-services-agreement.pdf",
    originalName: "Cloud Infrastructure Services Agreement",
    contractType: "SUPPLIER_AGREEMENT",
    status: "COMPLETE",
    counterpartyName: "DataStack Solutions Ltd",
    counterpartyType: "TECH_VENDOR",
    contractValue: 18000,
    currency: "GBP",
    contractTermMonths: 12,
    autoRenewal: true,
    noticePeriodDays: 30,
    reviewType: "COMMERCIAL_CONTRACT",
    workflowType: "COMMERCIAL_CONTRACT",
  });
  console.log(`✓ Created demo contract (${demoDoc["id"]})`);

  // ── 5. Review results ─────────────────────────────────────────────────────────
  const rules = await pb.collection("playbook_rules").getFullList<PBRecord>({
    filter: `company = "${pulseCompany["id"]}"`,
  });
  const ruleByCategory = new Map(rules.map((r) => [r["clauseCategory"] as string, r]));

  const RESULTS = [
    {
      clauseCategory:      "LIABILITY_CAP",
      ragStatus:           "RED",
      confidenceLabel:     "HIGH",
      clauseSummary:       "Liability is capped at one month of fees paid (£1,500), applying only to DataStack. No reciprocal cap. No exclusions protecting you.",
      whyItMatters:        "If DataStack causes a data breach or infrastructure failure, you can only recover £1,500 regardless of the actual damage to your business.",
      recommendedAction:   "Reject. Negotiate a mutual cap of at least 12 months fees (£18,000) applying to both parties equally.",
      suggestedFallback:   "Each party's total liability shall not exceed the greater of £18,000 or total fees paid in the 12 months preceding the claim.",
      escalationRequired:  true,
      escalationTrigger:   "Liability cap (£1,500) is below the 3-month red line (£4,500 minimum). Unacceptable for a business-critical infrastructure contract.",
      businessSummary:     "The current cap means DataStack has almost no financial accountability. For a contract managing your cloud infrastructure, this is a significant exposure.",
      founderStatus:       "CAUTION",
      founderPlainEnglish: "The liability cap is too low. If something goes wrong you could only recover £1,500. You should push for at least £18,000. That's 12 months of fees, which is the standard position.",
      founderBusinessImpact: "A service outage, data loss, or security breach from DataStack could cost you customers, revenue, and regulatory fines. £1,500 does not begin to cover those losses.",
      founderAskFor:       "Ask for a mutual liability cap of £18,000 (12 months of fees), applying equally to both sides.",
      founderCopyPaste:    "Hi [name], we're broadly happy to move forward but need one amendment on the liability clause. The current cap of one month's fees is too low for us given what you're managing. Could we agree a mutual cap at 12 months of fees, so £18,000 applying to both sides equally? That's standard for infrastructure contracts of this type. Happy to discuss.",
      founderFundraisingRelevance: "High investor concern",
      founderIfIgnored:    "You are financially exposed for anything above £1,500. If DataStack causes a serious incident, you bear the cost.",
      isAbsent:            false,
      urgencyLevel:        "IMMEDIATE",
    },
    {
      clauseCategory:      "AUTO_RENEWAL",
      ragStatus:           "AMBER",
      confidenceLabel:     "HIGH",
      clauseSummary:       "Contract auto-renews annually. Notice to cancel must be given 30 days before the renewal date. No active notification from DataStack.",
      whyItMatters:        "A 30-day window is very tight. Missing it by a few days locks you into another 12 months of fees (£18,000).",
      recommendedAction:   "Push for 90 days notice period. Minimum acceptable is 60 days. Also request a notification from DataStack 90 days before the window opens.",
      suggestedFallback:   "The contract shall auto-renew unless either party provides written notice no later than 60 days before the end of the then-current term. Supplier shall notify Company at least 90 days before the renewal date.",
      escalationRequired:  false,
      escalationTrigger:   "",
      businessSummary:     "Auto-renewal with a short notice window is one of the most common ways startups get locked into contracts they wanted to exit. The current 30-day window is tight.",
      founderStatus:       "CAUTION",
      founderPlainEnglish: "The contract auto-renews automatically. You need to give 30 days notice to cancel, but miss that window and you're locked in for another year and another £18,000.",
      founderBusinessImpact: "Missing the 30-day window costs you £18,000 in committed spend on a service you may no longer need. There is no active reminder in the contract.",
      founderAskFor:       "Ask for a 60- to 90-day notice window and a notification from DataStack before the window opens.",
      founderCopyPaste:    "Hi [name], one thing on the renewal clause. The 30-day notice window is tight for us operationally. Could we extend this to 60 days? It just gives us more time to make a considered decision at renewal. If possible, we'd also appreciate a reminder from your side 90 days before the renewal date. Happy to add this to the contract.",
      founderFundraisingRelevance: "Standard diligence item",
      founderIfIgnored:    "You risk accidentally committing to another £18,000 year of services. There's no reminder mechanism in the contract.",
      isAbsent:            false,
      urgencyLevel:        "MATERIAL",
    },
    {
      clauseCategory:      "PAYMENT_TERMS",
      ragStatus:           "RED",
      confidenceLabel:     "HIGH",
      clauseSummary:       "Full annual fee of £18,000 is payable upfront within 7 days of signing. No refund on early termination. No right to withhold payment for service failures.",
      whyItMatters:        "You pay £18,000 before receiving any services, with no recovery right if you terminate early or if DataStack fails to perform.",
      recommendedAction:   "Reject upfront annual payment. Negotiate monthly billing or quarterly billing. If annual is required, negotiate a pro-rata refund on early termination.",
      suggestedFallback:   "Fees invoiced monthly in advance. Payment due within 30 days of invoice. On termination, prepaid fees for future periods refunded pro-rata.",
      escalationRequired:  true,
      escalationTrigger:   "Advance payment of full annual fee without refund right. Breaches the hard red line on prepayment.",
      businessSummary:     "Paying £18,000 upfront removes your payment leverage and ties up working capital before you have tested the service.",
      founderStatus:       "CAUTION",
      founderPlainEnglish: "You're being asked to pay the full £18,000 for the year upfront with no refunds if you cancel. That ties up your cash and removes any leverage if the service isn't what was promised.",
      founderBusinessImpact: "Upfront annual payment locks £18,000 of working capital into an untested service relationship. If service quality is poor, you have no payment leverage and no refund right.",
      founderAskFor:       "Ask for monthly billing. If they insist on annual, ask for a pro-rata refund right if you terminate and the right to pause payment for unresolved service failures.",
      founderCopyPaste:    "Hi [name], the payment terms are something we need to work through. We're not in a position to pay £18,000 upfront. We'd need monthly or at most quarterly billing. Most SaaS providers we work with use monthly. If annual billing is important to you, we'd also need a pro-rata refund right if we terminate and the right to dispute invoices for service failures. Let me know what works.",
      founderFundraisingRelevance: "Standard diligence item",
      founderIfIgnored:    "You pay £18,000 immediately with no recovery right. If the service underperforms or you want to exit, the money is gone.",
      isAbsent:            false,
      urgencyLevel:        "IMMEDIATE",
    },
  ];

  let count = 0;
  for (const result of RESULTS) {
    const rule = ruleByCategory.get(result.clauseCategory);
    await pb.collection("review_results").create({
      document:            demoDoc["id"],
      clause:              null,
      rule:                rule?.["id"] ?? null,
      ...result,
      regulatoryCitations: "[]",
      missingSeverity:     "",
      iracIssue:           result.founderPlainEnglish,
      iracRule:            result.clauseSummary,
      iracApplication:     result.founderBusinessImpact,
      iracConclusion:      result.recommendedAction,
      errorCategory:       "SUBSTANTIVE_RISK",
      model_used:          "anthropic/claude-sonnet-4-5",
      comparisonStatement: result.clauseSummary,
    });
    count++;
  }
  console.log(`✓ Created ${count} review results`);

  console.log("\n" + "─".repeat(60));
  console.log("✓ Founder demo account ready\n");
  console.log("Login:    founder-demo@zanelegal.ai / ZaneDemo2026!");
  console.log("Company:  Pulse Health Technologies Ltd");
  console.log("Persona:  FOUNDER (simplified founder interface)");
  console.log("Contract: Cloud Infrastructure Services Agreement");
  console.log("          DataStack Solutions Ltd, £18,000, AMBER");
}

run().catch((err) => {
  console.error("✗ Failed:", err);
  process.exit(1);
});
