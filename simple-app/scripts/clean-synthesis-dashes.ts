/**
 * Strip em and en dashes from stored synthesis content.
 *
 * The synthesis collections keep every version rather than replacing, so pages
 * generated before the house style rule landed still carry dashes in their
 * superseded rows. Nothing displays them today, since the app reads the newest
 * version, but they are inconsistent with everything generated since and would
 * surface the moment version history is browsable.
 *
 * These rows are rewritten rather than deleted. They are the record of how the
 * company's own understanding developed, which is worth more than the few
 * kilobytes reclaiming them would save, and the same stripDashes utility that
 * guards new generations produces exactly the wording the rest of the corpus
 * already uses.
 *
 * Idempotent: a row with no dash is skipped.
 *
 * Run:  npx tsx scripts/clean-synthesis-dashes.ts
 *       npx tsx scripts/clean-synthesis-dashes.ts --dry-run
 */

import "dotenv/config";
import { initPocketBase, pb } from "../server/pb.js";
import { stripDashes, hasForbiddenDash } from "../server/services/textStyle.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PB = Record<string, any>;

const COLLECTIONS = [
  "playbook_synthesis_pages",
  "company_knowledge_pages",
  "regulatory_synthesis_pages",
];

/** Prose fields these collections store. Ids and codes are never touched. */
const TEXT_FIELDS = ["content", "synthesis", "topic", "confidenceLabel"];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  await initPocketBase();
  if (dryRun) console.log("DRY RUN, nothing will be written.\n");

  let scanned = 0, changed = 0, fieldsRewritten = 0;

  for (const coll of COLLECTIONS) {
    const rows: PB[] = await pb.collection(coll).getFullList().catch(() => []);
    let collChanged = 0;

    for (const row of rows) {
      scanned++;
      const patch: Record<string, string> = {};
      for (const f of TEXT_FIELDS) {
        const value = row[f];
        if (typeof value !== "string" || !hasForbiddenDash(value)) continue;
        patch[f] = stripDashes(value);
        fieldsRewritten++;
      }
      if (Object.keys(patch).length === 0) continue;

      const label = row.clauseCategory ?? row.topic ?? row.pageType ?? row.id;
      console.log(`  ${coll} v${row.version ?? "?"} ${label}`);
      for (const [f, next] of Object.entries(patch)) {
        // Show the same passage before and after, anchored on the dash, so the
        // rewrite can be checked rather than trusted.
        const original = String(row[f]);
        const at = original.search(/[—–]/);
        const from = Math.max(0, at - 40);
        const window = (text: string, start: number) => text.slice(start, start + 84).replace(/\n/g, " ");
        console.log(`      ${f}`);
        console.log(`        was: ...${window(original, from)}`);
        console.log(`        now: ...${window(next, from)}`);
      }
      if (!dryRun) await pb.collection(coll).update(row.id, patch);
      collChanged++; changed++;
    }
    console.log(`${coll}: ${rows.length} rows, ${collChanged} rewritten`);
  }

  console.log(`\n${scanned} rows scanned, ${changed} rewritten, ${fieldsRewritten} fields cleaned.`);
  if (dryRun) console.log("Re-run without --dry-run to apply.");
}

main()
  .catch((e) => { console.error("CLEAN FAILED:", e?.stack ?? e?.message ?? e); process.exitCode = 1; })
  .finally(() => process.exit(process.exitCode ?? 0));
