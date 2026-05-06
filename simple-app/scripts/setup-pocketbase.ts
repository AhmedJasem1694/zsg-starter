/**
 * PocketBase Collection Bootstrap Script (PocketBase 0.22+ API)
 *
 * Creates or patches all required collections in PocketBase.
 * Safe to re-run — existing collections with correct fields are skipped;
 * existing empty collections are updated to add their fields.
 *
 * Usage:
 *   POCKETBASE_URL=https://your-pb.railway.app \
 *   POCKETBASE_ADMIN_EMAIL=admin@mike.app \
 *   POCKETBASE_ADMIN_PASSWORD=yourpassword \
 *   npx tsx scripts/setup-pocketbase.ts
 */

import { config } from "dotenv";
config();

import PocketBase from "pocketbase";

const POCKETBASE_URL = process.env.POCKETBASE_URL ?? "http://localhost:8090";
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL ?? "admin@mike.local";
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD ?? "changeme1234";

const pb = new PocketBase(POCKETBASE_URL);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FieldDef = Record<string, any>;

// ── Field helpers — PocketBase 0.22+ flat format (no nested "options") ────────

function textField(name: string, opts: FieldDef = {}): FieldDef {
  return { name, type: "text", required: false, ...opts };
}

function numberField(name: string, opts: FieldDef = {}): FieldDef {
  return { name, type: "number", required: false, ...opts };
}

function boolField(name: string): FieldDef {
  return { name, type: "bool", required: false };
}

function dateField(name: string): FieldDef {
  return { name, type: "date", required: false };
}

function emailField(name: string): FieldDef {
  return { name, type: "email", required: false };
}

function relationField(name: string, collectionId: string, opts: FieldDef = {}): FieldDef {
  return {
    name,
    type: "relation",
    required: false,
    collectionId,
    cascadeDelete: true,
    maxSelect: 1,
    minSelect: 0,
    ...opts,
  };
}

// ── Smart create-or-update ────────────────────────────────────────────────────
// PocketBase 0.22+ uses "fields" not "schema".
// If the collection exists but has no custom fields (empty schema from an old
// run that used the wrong key), we PATCH it to add the fields.

async function setupCollection(name: string, fields: FieldDef[]): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (pb.collections as any).getOne(name);

    // Check for custom (non-system) fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingFields: any[] = existing.fields ?? existing.schema ?? [];
    const customFields = existingFields.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (f: any) => !f.system && f.name !== "id"
    );

    if (customFields.length > 0) {
      console.log(`  ✓ '${name}' already has fields — skipping`);
      return existing.id as string;
    }

    // Collection exists but is empty — patch it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (pb.collections as any).update(existing.id, { fields });
    console.log(`  ✓ Patched '${name}' with ${fields.length} fields`);
    return updated.id as string;

  } catch (err: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = (err as any)?.status;
    if (status !== 404) throw err; // unexpected error

    // Collection doesn't exist — create it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (pb.collections as any).create({
      name,
      type: "base",
      fields,
    });
    console.log(`  ✓ Created '${name}' (${result.id})`);
    return result.id as string;
  }
}

async function getCollectionId(name: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const col = await (pb.collections as any).getOne(name);
  return col.id as string;
}

async function main() {
  console.log(`\nConnecting to PocketBase at ${POCKETBASE_URL}...`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (pb as any).admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD)
    .catch(async () => {
      // PocketBase 0.22+ uses _superusers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (pb as any).collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    });
  console.log("Authenticated as admin.\n");

  console.log("Setting up collections...\n");

  // ── 1. users (note: PocketBase may have created this as auth — skip if so) ──
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usersCol = await (pb.collections as any).getOne("users");
    if (usersCol.type === "auth") {
      console.log("  ✓ 'users' is an auth collection — skipping (using built-in auth)");
    } else {
      await setupCollection("users", [
        { name: "email", type: "email", required: true },
        textField("passwordHash", { required: true }),
        textField("name", { required: true }),
      ]);
    }
  } catch {
    await setupCollection("users", [
      { name: "email", type: "email", required: true },
      textField("passwordHash", { required: true }),
      textField("name", { required: true }),
    ]);
  }

  // ── 2. companies ─────────────────────────────────────────────────────────────
  const companiesId = await setupCollection("companies", [
    textField("name", { required: true }),
    textField("sector", { required: true }),
    textField("jurisdiction", { required: true }),
    textField("role", { required: true }),
    textField("riskAppetite", { required: true }),
    textField("industry"),
    textField("persona"),
    textField("workflowType"),
  ]);

  // ── 3. company_regulations ───────────────────────────────────────────────────
  await setupCollection("company_regulations", [
    relationField("company", companiesId),
    textField("jurisdiction"),
    textField("regulator"),
    textField("frameworkName"),
    textField("description", { max: 5000 }),
    textField("appliesTo"),
  ]);

  // ── 4. playbook_rules ────────────────────────────────────────────────────────
  const playbookRulesId = await setupCollection("playbook_rules", [
    relationField("company", companiesId),
    textField("workflowType"),
    textField("clauseCategory", { required: true }),
    textField("preferredPosition", { required: true, max: 10000 }),
    textField("acceptableFallback", { required: true, max: 10000 }),
    textField("hardRedLine", { required: true, max: 10000 }),
    textField("approvalRequired"),
    textField("fallbackTemplate", { max: 10000 }),
    numberField("riskWeight"),
  ]);

  // ── 5. approval_contacts ─────────────────────────────────────────────────────
  await setupCollection("approval_contacts", [
    relationField("company", companiesId),
    textField("role", { required: true }),
    textField("name", { required: true }),
    emailField("email"),
  ]);

  // ── 6. uploaded_documents ────────────────────────────────────────────────────
  const uploadedDocumentsId = await setupCollection("uploaded_documents", [
    relationField("company", companiesId),
    textField("filename", { required: true }),
    textField("originalName", { required: true }),
    textField("contractType"),
    textField("status"),
    textField("counterpartyName"),
    textField("counterpartyType"),
    textField("reviewType"),
    numberField("contractValue"),
    textField("currency"),
    numberField("contractTermMonths"),
    boolField("autoRenewal"),
    numberField("noticePeriodDays"),
    dateField("renewalDate"),
    textField("contractTags"),
  ]);

  // ── 7. extracted_clauses ─────────────────────────────────────────────────────
  const extractedClausesId = await setupCollection("extracted_clauses", [
    relationField("document", uploadedDocumentsId),
    textField("clauseCategory", { required: true }),
    textField("rawText", { required: true, max: 100000 }),
    textField("normalisedSummary", { max: 10000 }),
    numberField("confidence"),
  ]);

  // ── 8. review_results ────────────────────────────────────────────────────────
  const reviewResultsId = await setupCollection("review_results", [
    relationField("document", uploadedDocumentsId),
    relationField("clause", extractedClausesId, { cascadeDelete: false }),
    relationField("rule", playbookRulesId, { cascadeDelete: false }),
    textField("clauseCategory", { required: true }),
    textField("ragStatus", { required: true }),
    textField("clauseSummary", { max: 10000 }),
    textField("whyItMatters", { max: 10000 }),
    textField("recommendedAction", { max: 10000 }),
    textField("suggestedFallback", { max: 10000 }),
    boolField("escalationRequired"),
    textField("escalationTrigger"),
    textField("businessSummary", { max: 10000 }),
    numberField("confidence"),
    boolField("isAbsent"),
  ]);

  // ── 9. litigation_intakes ────────────────────────────────────────────────────
  await setupCollection("litigation_intakes", [
    relationField("document", uploadedDocumentsId),
    numberField("stage"),
    textField("hardStopData", { max: 100000 }),
    textField("defenceData", { max: 100000 }),
    boolField("fraudFlag"),
    boolField("fcaBreach"),
    boolField("vulnerableCustomer"),
    boolField("hardStopPassed"),
    dateField("completedAt"),
  ]);

  // ── 10. ancillary_documents ──────────────────────────────────────────────────
  await setupCollection("ancillary_documents", [
    relationField("document", uploadedDocumentsId),
    textField("originalName", { required: true }),
    textField("filename", { required: true }),
    textField("fileType"),
    boolField("privilegeFlag"),
    textField("transcription", { max: 500000 }),
    boolField("transcriptionConfirmed"),
  ]);

  // ── 11. user_feedback ────────────────────────────────────────────────────────
  await setupCollection("user_feedback", [
    relationField("result", reviewResultsId),
    textField("userAction", { required: true }),
    textField("editedOutput", { max: 10000 }),
    textField("finalClauseText", { max: 10000 }),
    textField("notes", { max: 5000 }),
  ]);

  console.log("\n✅ All collections set up successfully.\n");
  console.log("Next steps:");
  console.log("  1. Ensure POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD are set on the app service");
  console.log("  2. Register at /register and complete onboarding\n");
}

main().catch((err) => {
  console.error("\n❌ Setup failed:", err);
  process.exit(1);
});
