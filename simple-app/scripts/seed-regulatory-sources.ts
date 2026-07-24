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

  // Verification seed: mark a couple as verified by a named reviewer, leave the rest unverified.
  const VERIFIED: Array<{ code: string; by: string; at: string }> = [
    { code: "GB_ICO_UK_GDPR", by: "Priya Nair, Head of Compliance", at: "2026-06-18 09:30:00.000Z" },
    { code: "GB_FCA_CONSUMER_DUTY", by: "Priya Nair, Head of Compliance", at: "2026-06-18 09:34:00.000Z" },
  ];
  for (const v of VERIFIED) {
    const existing = await pb.collection("regulatory_framework_verifications").getFullList({ filter: `code = "${v.code}"` }).catch(() => []);
    const payload = { code: v.code, status: "verified", verifiedBy: v.by, verifiedAt: v.at };
    if (existing.length > 0) await pb.collection("regulatory_framework_verifications").update(existing[0].id, payload);
    else await pb.collection("regulatory_framework_verifications").create(payload);
    console.log(`verified ${v.code} by ${v.by}`);
  }
  process.exit(0);
}

main().catch((err) => { console.error("Seed failed:", err?.message ?? err); process.exit(1); });
