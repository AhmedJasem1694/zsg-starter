/**
 * Approvals Demo Seed
 *
 * Creates pending approval requests on existing Meridian demo contracts so
 * the approvals queue and decision screens are never empty in a demo:
 * two routed to the CFO role and one to the Board role, each with a
 * plausible plain-English routing reason. Links a real review result for the
 * clause where one exists so the decision screen shows the actual flagged
 * risk. Idempotent: an existing PENDING request for the same document, role,
 * and clause is left alone (the createApprovalRequest helper deduplicates).
 *
 * Usage: npx tsx scripts/seed-approvals-demo.ts
 */

import "dotenv/config";

async function main() {
  const { initPocketBase, pb } = await import("../server/pb.js");
  const { createApprovalRequest } = await import("../server/services/approvals.js");
  await initPocketBase();

  const companies = await pb.collection("companies").getFullList();
  const meridian = companies.find((c) => String(c["name"] ?? "").toLowerCase().includes("meridian"));
  if (!meridian) { console.error("Meridian demo company not found"); process.exit(1); }

  const docs = await pb.collection("uploaded_documents").getFullList({
    filter: `company = "${meridian.id}"`,
  });
  const findDoc = (needle: string) =>
    docs.find((d) => String(d["originalName"] ?? "").toLowerCase().includes(needle.toLowerCase()));

  const findResult = async (docId: string, category: string) => {
    const results = await pb.collection("review_results").getFullList({
      filter: `document = "${docId}" && clauseCategory = "${category}"`,
      fields: "id",
    }).catch(() => []);
    return results[0]?.id as string | undefined;
  };

  const SEEDS = [
    {
      doc: findDoc("Nexus Solutions, Master Services Agreement"),
      clause: "LIABILITY_CAP",
      role: "CFO",
      reason: "Nexus is holding at a 12 month fee cap on a £240,000 contract, below the playbook minimum of 2x annual fees. Accepting leaves up to £480,000 of exposure uncovered, which exceeds the finance sign-off threshold.",
    },
    {
      doc: findDoc("DataFlow Technologies, Reseller Agreement"),
      clause: "AUTO_RENEWAL",
      role: "CFO",
      reason: "The reseller agreement auto-renews for 12 months with only 30 days notice and a 4 percent price escalator at renewal. Committed spend renews without commercial review unless notice is served, which needs CFO sign-off under the spend approval policy.",
    },
    {
      doc: findDoc("Nexus Solutions, Statement of Work"),
      clause: "INDEMNITY",
      role: "BOARD",
      reason: "Aggregate exposure to Nexus Solutions now stands at £440,000 across three agreements, and this SoW adds an uncapped indemnity for third party IP claims. Combined counterparty concentration and uncapped exposure crosses the board notification threshold.",
    },
  ];

  for (const s of SEEDS) {
    if (!s.doc) { console.warn(`seed skipped: document not found for ${s.role} / ${s.clause}`); continue; }
    const resultId = await findResult(s.doc.id, s.clause);
    const id = await createApprovalRequest({
      documentId: s.doc.id,
      resultId,
      clauseCategory: s.clause,
      role: s.role,
      reason: s.reason,
      requestedBy: "demo@zanelegal.ai",
      notify: false,
    });
    console.log(`${s.role} <- ${s.doc["originalName"]} [${s.clause}] result=${resultId ?? "none"} -> ${id ?? "FAILED"}`);
  }

  const pending = await pb.collection("approval_requests").getFullList({
    filter: `company = "${meridian.id}" && status = "PENDING"`,
  });
  console.log(`pending approvals for Meridian: ${pending.length}`);
  process.exit(0);
}

main().catch((err) => { console.error("Seed failed:", err?.message ?? err); process.exit(1); });
