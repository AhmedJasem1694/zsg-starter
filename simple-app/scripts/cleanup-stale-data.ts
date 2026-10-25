/**
 * Cleanup for leftover companies and orphaned documents.
 *
 * The database accumulated ten companies: two seeded demos and eight abandoned
 * onboarding runs, six of which hold no contracts but together carry hundreds
 * of playbook rules copied from PLAYBOOK_DEFAULTS. Separately, 22 documents
 * have an empty `company` field, left behind when single-company mode deleted
 * the company they belonged to.
 *
 * Nothing is deleted unless --apply is passed. Without it this prints the plan
 * and exits.
 *
 * SAFETY
 *
 *   Dry run by default.
 *
 *   The two demo companies are protected by name fragment and are never
 *   deleted, even when named explicitly with --company. They are what
 *   DEMO_COMPANY_MAP resolves for demo@zanelegal.ai and
 *   founder-demo@zanelegal.ai, so losing them breaks both demo logins.
 *
 *   Every row is written to a timestamped JSON file before anything is
 *   deleted, and the run aborts if that file cannot be written. This project
 *   has no backup mechanism of any kind, so that file is the only way back.
 *
 *   Uploaded files are NOT removed. This script talks to PocketBase over the
 *   network while uploads/ lives on the application server's disk, so the
 *   files it cannot reach are reported rather than silently left unmentioned.
 *
 * USAGE
 *
 *   npx tsx scripts/cleanup-stale-data.ts                      plan everything
 *   npx tsx scripts/cleanup-stale-data.ts --empty-companies    plan one part
 *   npx tsx scripts/cleanup-stale-data.ts --all --apply        carry it out
 *
 * FLAGS
 *
 *   --empty-companies   companies with zero documents
 *   --orphan-documents  documents whose company field is empty or dangling
 *   --company=<id>      one specific company and everything under it
 *   --all               both of the above categories (the default when no
 *                       category flag is given)
 *   --include-audit     also delete audit_log rows for removed companies.
 *                       Off by default: the trail is append-only by
 *                       convention and deleting from it should be deliberate.
 *   --apply             perform the deletions
 *   --out=<dir>         backup directory (default ./cleanup-backup)
 */

import "../server/env";
import fs from "fs";
import path from "path";
import { pb, initPocketBase } from "../server/pb";

type Row = Record<string, unknown> & { id: string };

/** Name fragments of the demo companies, from DEMO_COMPANY_MAP in routes.ts. */
const PROTECTED_NAME_FRAGMENTS = ["meridian", "pulse"];

/** Mirrors cascadeDeleteDocument in routes.ts. Order matters: children first. */
const DOC_CHILDREN: Array<{ collection: string; field: string }> = [
  { collection: "extracted_clauses", field: "document" },
  { collection: "ancillary_documents", field: "document" },
  { collection: "pii_sessions", field: "documentId" },
  { collection: "outcome_deltas", field: "document" },
];

/** Linked to a review_result rather than to the document directly. */
const RESULT_CHILDREN = ["user_feedback", "override_signals", "false_positive_signals"];

// ── Arguments ─────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const value = (prefix: string) =>
  argv.filter((a) => a.startsWith(prefix)).map((a) => a.slice(prefix.length));

const APPLY = has("--apply");
const INCLUDE_AUDIT = has("--include-audit");
const OUT_DIR = value("--out=")[0] ?? path.join(process.cwd(), "cleanup-backup");
const NAMED_COMPANIES = value("--company=");

const wantsCategory = has("--empty-companies") || has("--orphan-documents") || has("--all");
const DO_EMPTY = has("--empty-companies") || has("--all") || !wantsCategory;
const DO_ORPHANS = has("--orphan-documents") || has("--all") || !wantsCategory;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Sorting by +created fails against this instance; +id is the reliable key. */
async function all(collection: string, filter?: string): Promise<Row[]> {
  try {
    return (await pb.collection(collection).getFullList({
      sort: "+id",
      ...(filter ? { filter } : {}),
    })) as Row[];
  } catch (err) {
    console.warn(`  [warn] could not read ${collection}: ${(err as Error)?.message}`);
    return [];
  }
}

/**
 * Index rows by one field so membership is a map lookup.
 *
 * Every collection is fetched once and filtered in memory rather than queried
 * per document. The first version of this script issued one request per child
 * collection per document, plus three per review result: several thousand
 * round trips to a remote PocketBase, which did not finish in ten minutes.
 * The data is small enough to hold, so hold it.
 */
function groupBy(rows: Row[], field: string): Map<string, Row[]> {
  const out = new Map<string, Row[]>();
  for (const r of rows) {
    const key = String(r[field] ?? "");
    if (!key) continue;
    const bucket = out.get(key);
    if (bucket) bucket.push(r);
    else out.set(key, [r]);
  }
  return out;
}

/**
 * Collections carrying a company link, read from the live schema rather than
 * hardcoded, so a new collection is picked up without editing this script.
 */
async function companyLinkedCollections(): Promise<Array<{ name: string; field: string }>> {
  const out: Array<{ name: string; field: string }> = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collections: any[] = await (pb.collections as any).getFullList();
  for (const c of collections) {
    if (c.name === "companies" || c.name.startsWith("_")) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields: any[] = c.fields ?? c.schema ?? [];
    const names = new Set(fields.map((f) => f.name));
    // uploaded_documents is handled by the document cascade, not here.
    if (c.name === "uploaded_documents") continue;
    if (names.has("company")) out.push({ name: c.name, field: "company" });
    else if (names.has("companyId")) out.push({ name: c.name, field: "companyId" });
  }
  return out;
}

// ── Plan ──────────────────────────────────────────────────────────────────────

interface Plan {
  companies: Row[];
  documents: Row[];
  /** collection -> rows to delete */
  rows: Map<string, Row[]>;
  /** Files that live on the app server and this script cannot remove. */
  strandedFiles: string[];
  protectedSkipped: string[];
}

function add(plan: Plan, collection: string, rows: Row[]) {
  if (rows.length === 0) return;
  const existing = plan.rows.get(collection) ?? [];
  const seen = new Set(existing.map((r) => r.id));
  plan.rows.set(collection, existing.concat(rows.filter((r) => !seen.has(r.id))));
}

async function buildPlan(): Promise<Plan> {
  const plan: Plan = {
    companies: [],
    documents: [],
    rows: new Map(),
    strandedFiles: [],
    protectedSkipped: [],
  };

  const companies = await all("companies");
  const documents = await all("uploaded_documents");
  const companyIds = new Set(companies.map((c) => c.id));

  const isProtected = (c: Row) => {
    const name = String(c["name"] ?? "").toLowerCase();
    return PROTECTED_NAME_FRAGMENTS.some((f) => name.includes(f));
  };

  // Which companies go
  const targets: Row[] = [];
  for (const c of companies) {
    const docCount = documents.filter((d) => d["company"] === c.id).length;
    const named = NAMED_COMPANIES.includes(c.id);
    const empty = DO_EMPTY && docCount === 0;
    if (!named && !empty) continue;
    if (isProtected(c)) {
      plan.protectedSkipped.push(`${String(c["name"])} (${c.id})`);
      continue;
    }
    targets.push(c);
  }
  plan.companies = targets;
  const targetIds = new Set(targets.map((c) => c.id));

  // Which documents go: those under a doomed company, plus orphans if asked
  const docs = documents.filter((d) => {
    const company = String(d["company"] ?? "");
    if (targetIds.has(company)) return true;
    if (DO_ORPHANS && (company === "" || !companyIds.has(company))) return true;
    return false;
  });
  plan.documents = docs;

  const docIds = new Set(docs.map((d) => d.id));
  for (const d of docs) {
    const filename = d["filename"];
    if (typeof filename === "string" && filename) plan.strandedFiles.push(filename);
  }

  // Per-document cascade. One fetch per collection, then filter in memory.
  for (const { collection, field } of DOC_CHILDREN) {
    const byDoc = groupBy(await all(collection), field);
    add(plan, collection, [...docIds].flatMap((id) => byDoc.get(id) ?? []));
  }

  const resultsByDoc = groupBy(await all("review_results"), "document");
  const results = [...docIds].flatMap((id) => resultsByDoc.get(id) ?? []);
  const resultIds = new Set(results.map((r) => r.id));

  for (const collection of RESULT_CHILDREN) {
    const byResult = groupBy(await all(collection), "result");
    add(plan, collection, [...resultIds].flatMap((id) => byResult.get(id) ?? []));
  }
  add(plan, "review_results", results);

  // Per-company cascade, discovered from the live schema.
  if (targetIds.size > 0) {
    const linked = await companyLinkedCollections();
    for (const { name, field } of linked) {
      if (name === "audit_log" && !INCLUDE_AUDIT) continue;
      const byCompany = groupBy(await all(name), field);
      add(plan, name, [...targetIds].flatMap((id) => byCompany.get(id) ?? []));
    }
  }

  return plan;
}

// ── Report ────────────────────────────────────────────────────────────────────

function report(plan: Plan) {
  console.log(`\n${"=".repeat(68)}`);
  console.log(APPLY ? "CLEANUP PLAN (applying)" : "CLEANUP PLAN (dry run, nothing will be deleted)");
  console.log("=".repeat(68));

  if (plan.protectedSkipped.length > 0) {
    console.log("\nProtected, will not be touched:");
    for (const p of plan.protectedSkipped) console.log(`  ${p}`);
  }

  console.log(`\nCompanies to delete (${plan.companies.length}):`);
  if (plan.companies.length === 0) console.log("  none");
  for (const c of plan.companies) {
    console.log(
      `  ${String(c["name"] ?? "(unnamed)").padEnd(32)} owner:${String(c["role_in_contracts"] ?? "-").padEnd(26)} ${c.id}`,
    );
  }

  console.log(`\nDocuments to delete (${plan.documents.length}):`);
  if (plan.documents.length === 0) console.log("  none");
  const orphans = plan.documents.filter((d) => !String(d["company"] ?? ""));
  if (orphans.length) console.log(`  ${orphans.length} with no company (orphaned)`);
  if (plan.documents.length - orphans.length > 0) {
    console.log(`  ${plan.documents.length - orphans.length} belonging to the companies above`);
  }

  const collections = [...plan.rows.entries()].filter(([, r]) => r.length > 0);
  console.log(`\nChild rows to delete (${collections.reduce((n, [, r]) => n + r.length, 0)}):`);
  if (collections.length === 0) console.log("  none");
  for (const [name, rows] of collections.sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(rows.length).padStart(5)}  ${name}`);
  }

  if (!INCLUDE_AUDIT && plan.companies.length > 0) {
    console.log("\naudit_log is being left alone. Pass --include-audit to remove those rows too.");
  }

  if (plan.strandedFiles.length > 0) {
    console.log(
      `\n${plan.strandedFiles.length} uploaded file(s) will be left on the application server's disk.`,
    );
    console.log("  This script reaches PocketBase over the network, not uploads/. Remove them there.");
  }
}

// ── Apply ─────────────────────────────────────────────────────────────────────

function writeBackup(plan: Plan): string {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(OUT_DIR, `cleanup-${stamp}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        pocketbaseUrl: process.env.POCKETBASE_URL ?? "(default)",
        companies: plan.companies,
        documents: plan.documents,
        children: Object.fromEntries(plan.rows),
        strandedFiles: plan.strandedFiles,
      },
      null,
      2,
    ),
  );
  return file;
}

async function apply(plan: Plan) {
  // Children first, then documents, then company-linked rows, then companies.
  let deleted = 0;
  let failed = 0;

  const remove = async (collection: string, id: string) => {
    try {
      await pb.collection(collection).delete(id);
      deleted++;
    } catch (err) {
      failed++;
      console.warn(`  [warn] ${collection}/${id}: ${(err as Error)?.message}`);
    }
  };

  // Result children must go before review_results, which this ordering gives
  // because RESULT_CHILDREN are inserted into the map before review_results is.
  for (const [collection, rows] of plan.rows) {
    if (collection === "review_results") continue;
    for (const r of rows) await remove(collection, r.id);
  }
  for (const r of plan.rows.get("review_results") ?? []) await remove("review_results", r.id);
  for (const d of plan.documents) await remove("uploaded_documents", d.id);
  for (const c of plan.companies) await remove("companies", c.id);

  console.log(`\nDeleted ${deleted} record(s). ${failed} failure(s).`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await initPocketBase();
  console.log(`Connected to ${process.env.POCKETBASE_URL ?? "(default)"}`);

  const plan = await buildPlan();
  report(plan);

  const total =
    plan.companies.length +
    plan.documents.length +
    [...plan.rows.values()].reduce((n, r) => n + r.length, 0);

  if (total === 0) {
    console.log("\nNothing to do.\n");
    return;
  }

  if (!APPLY) {
    console.log(`\n${total} record(s) would be deleted. Nothing has been changed.`);
    console.log("Re-run with --apply to carry this out. A JSON copy is written first.\n");
    return;
  }

  let backup: string;
  try {
    backup = writeBackup(plan);
  } catch (err) {
    console.error(`\nAborting: could not write the backup file. ${(err as Error)?.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nBacked up ${total} record(s) to ${backup}`);
  console.log("This project has no other backup. Keep that file until you are satisfied.\n");

  await apply(plan);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", (err as Error)?.message ?? err);
    process.exit(1);
  });
