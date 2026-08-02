/**
 * Regulatory Source Backfill + Verification Seed
 *
 * Backfills existing company_regulations records with their verifiable source
 * data (matched by framework name to the curated registry), so demo frameworks
 * carry an official instrument name, reference number, issuing body, and
 * citation. Records with no source match are left without a code and are never
 * surfaced. Then seeds a couple of frameworks as verified by a named reviewer
 * so the verification status reads well in a demo; the rest stay unverified.
 *
 * Usage: npx tsx scripts/seed-regulatory-sources.ts
 */

import "dotenv/config";

async function main() {
  const { initPocketBase, pb } = await import("../server/pb.js");
  const { REGULATORY_FRAMEWORKS } = await import("../server/data/regulatoryFrameworks.js");
  const { getRegulatorySource } = await import("../server/data/regulatorySources.js");
  await initPocketBase();

  const regs = await pb.collection("company_regulations").getFullList();
  let filled = 0, skipped = 0;
  for (const r of regs) {
    if (r["code"] && r["citationUrl"]) { continue; }
    const framework = REGULATORY_FRAMEWORKS.find((f) => f.frameworkName === r["frameworkName"]);
    const src = framework ? getRegulatorySource(framework.code) : null;
    if (!framework || !src) { skipped++; continue; }
    await pb.collection("company_regulations").update(r.id, {
      code: framework.code,
      officialName: src.officialName,
      referenceNumber: src.referenceNumber,
      issuingBody: src.issuingBody,
      citationUrl: src.citationUrl,
    });
    filled++;
  }
  console.log(`backfilled source data: ${filled}, left unsourced (won't surface): ${skipped}`);

  // No verification is seeded. Verification is an attestation that a named
  // human checked the source, so seeding one fabricates a compliance sign-off
  // that never happened. Frameworks default to unverified and a real reviewer
  // records their name through POST /api/regulatory/frameworks/:code/verify.

  process.exit(0);
}

main().catch((err) => { console.error("Seed failed:", err?.message ?? err); process.exit(1); });
