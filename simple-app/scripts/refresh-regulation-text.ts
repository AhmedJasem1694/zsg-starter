/**
 * Resync stored regulation text from the curated source registry.
 *
 * company_regulations rows carry a copy of each framework's description, taken
 * at detection time. When the curated text in
 * regulatoryFrameworks.ts is corrected, existing rows keep the old wording, so
 * a fix in source never reaches a company that was onboarded before it. This
 * brings stored rows back in line with the file, which is the source of truth.
 *
 * Idempotent: rows already matching are left untouched.
 *
 * Run:  npx tsx scripts/refresh-regulation-text.ts
 */

import "dotenv/config";
import { initPocketBase, pb } from "../server/pb.js";
import { REGULATORY_FRAMEWORKS } from "../server/data/regulatoryFrameworks.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PB = Record<string, any>;

async function main() {
  await initPocketBase();
  const byCode = new Map(REGULATORY_FRAMEWORKS.map((f) => [f.code, f]));
  const rows = await pb.collection("company_regulations").getFullList();
  let updated = 0, unchanged = 0, unknown = 0;

  for (const r of rows as PB[]) {
    const src = byCode.get(String(r.code));
    if (!src) { unknown++; continue; }
    // description is the only curated prose the collection actually stores.
    // contractRelevance and keyObligations are not columns here; writing them
    // is silently dropped by PocketBase and makes every run look like a change.
    if (r.description === src.description) { unchanged++; continue; }
    await pb.collection("company_regulations").update(r.id, { description: src.description });
    console.log(`  refreshed ${r.code}`);
    updated++;
  }
  console.log(`\n${updated} refreshed, ${unchanged} already current, ${unknown} with no source entry.`);
}

main()
  .catch((e) => { console.error("REFRESH FAILED:", e?.stack ?? e?.message ?? e); process.exitCode = 1; })
  .finally(() => process.exit(process.exitCode ?? 0));
