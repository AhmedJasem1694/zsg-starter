/**
 * PocketBase Collection Bootstrap Script
 *
 * Creates all required collections in PocketBase. Run once after deploying
 * the PocketBase service. Safe to re-run — existing collections are skipped.
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

async function getCollectionId(name: string): Promise<string> {
  const col = await pb.collections.getOne(name);
  return col.id;
}

async function createCollection(name: string, fields: FieldDef[]): Promise<string> {
  try {
    const existing = await pb.collections.getOne(name);
    console.log(`  ✓ '${name}' already exists — skipping`);
    return existing.id;
  } catch {
    // Collection doesn't exist — create it
  }

  const result = await pb.collections.create({
    name,
    type: "base",
    schema: fields,
  });
  console.log(`  ✓ Created '${name}' (${result.id})`);
  return result.id;
}

function textField(name: string, opts: FieldDef = {}): FieldDef {
  return { name, type: "text", required: false, ...opts };
}

function numberField(name: string, opts: FieldDef = {}): FieldDef {
  return { name, type: "number", required: false, ...opts };
}

function boolField(name: string, defaultVal = false): FieldDef {
  return { name, type: "bool", required: false, options: { default: defaultVal } };
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
    options: {
      collectionId,
      cascadeDelete: true,
      maxSelect: 1,
      minSelect: 0,
      ...opts,
    },
  };
}

async function main() {
  console.log(`\nConnecting to PocketBase at ${POCKETBASE_URL}...`);
  await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log("Authenticated as admin.\n");

  console.log("Creating collections...\n");

  // ── 1. users (no relations) ────────────────────────────────────────────────
  await createCollection("users", [
    { name: "email", type: "email", required: true, unique: true },
    textField("passwordHash", { required: true }),
    textField("name", { required: true }),
  ]);

  // ── 2. companies (no relations) ────────────────────────────────────────────
  const companiesId = await createCollection("companies", [
    textField("name", { required: true }),
    textField("sector", { required: true }),
    textField("jurisdiction", { required: true }),
    textField("role", { required: true }),
    textField("riskAppetite", { required: true }),
    textField("industry"),
    textField("persona"),
    textField("workflowType"),
  ]);

  // ── 3. company_regulations ─────────────────────────────────────────────────
  await createCollection("company_regulations", [
    relationField("company", companiesId),
    textField("jurisdiction"),
    textField("regulator"),
    textField("frameworkName"),
    { name: "description", type: "text", required: false, options: { max: 5000 } },
    textField("appliesTo"),
  ]);

  // ── 4. playbook_rules ──────────────────────────────────────────────────────
  const playbookRulesId = await createCollection("playbook_rules", [
    relationField("company", companiesId),
    textField("workflowType"),
    textField("clauseCategory", { required: true }),
    { name: "preferredPosition", type: "text", required: true, options: { max: 10000 } },
    { name: "acceptableFallback", type: "text", required: true, options: { max: 10000 } },
    { name: "hardRedLine", type: "text", required: true, options: { max: 10000 } },
    textField("approvalRequired"),
    { name: "fallbackTemplate", type: "text", required: false, options: { max: 10000 } },
    numberField("riskWeight"),
  ]);

  // ── 5. approval_contacts ───────────────────────────────────────────────────
  await createCollection("approval_contacts", [
    relationField("company", companiesId),
    textField("role", { required: true }),
    textField("name", { required: true }),
    emailField("email"),
  ]);

  // ── 6. uploaded_documents ──────────────────────────────────────────────────
  const uploadedDocumentsId = await createCollection("uploaded_documents", [
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

  // ── 7. extracted_clauses ───────────────────────────────────────────────────
  const extractedClausesId = await createCollection("extracted_clauses", [
    relationField("document", uploadedDocumentsId),
    textField("clauseCategory", { required: true }),
    { name: "rawText", type: "text", required: true, options: { max: 100000 } },
    { name: "normalisedSummary", type: "text", required: false, options: { max: 10000 } },
    numberField("confidence"),
  ]);

  // ── 8. review_results ──────────────────────────────────────────────────────
  const reviewResultsId = await createCollection("review_results", [
    relationField("document", uploadedDocumentsId),
    relationField("clause", extractedClausesId, { cascadeDelete: false }),
    relationField("rule", playbookRulesId, { cascadeDelete: false }),
    textField("clauseCategory", { required: true }),
    textField("ragStatus", { required: true }),
    { name: "clauseSummary",     type: "text", required: false, options: { max: 10000 } },
    { name: "whyItMatters",      type: "text", required: false, options: { max: 10000 } },
    { name: "recommendedAction", type: "text", required: false, options: { max: 10000 } },
    { name: "suggestedFallback", type: "text", required: false, options: { max: 10000 } },
    boolField("escalationRequired"),
    textField("escalationTrigger"),
    { name: "businessSummary",   type: "text", required: false, options: { max: 10000 } },
    numberField("confidence"),
    boolField("isAbsent"),
  ]);

  // ── 9. litigation_intakes ──────────────────────────────────────────────────
  await createCollection("litigation_intakes", [
    relationField("document", uploadedDocumentsId),
    numberField("stage"),
    { name: "hardStopData", type: "text", required: false, options: { max: 100000 } },
    { name: "defenceData",  type: "text", required: false, options: { max: 100000 } },
    boolField("fraudFlag"),
    boolField("fcaBreach"),
    boolField("vulnerableCustomer"),
    boolField("hardStopPassed"),
    dateField("completedAt"),
  ]);

  // ── 10. ancillary_documents ────────────────────────────────────────────────
  await createCollection("ancillary_documents", [
    relationField("document", uploadedDocumentsId),
    textField("originalName", { required: true }),
    textField("filename",     { required: true }),
    textField("fileType"),
    boolField("privilegeFlag"),
    { name: "transcription", type: "text", required: false, options: { max: 500000 } },
    boolField("transcriptionConfirmed"),
  ]);

  // ── 11. user_feedback ──────────────────────────────────────────────────────
  await createCollection("user_feedback", [
    relationField("result", reviewResultsId),
    textField("userAction",      { required: true }),
    { name: "editedOutput",    type: "text", required: false, options: { max: 10000 } },
    { name: "finalClauseText", type: "text", required: false, options: { max: 10000 } },
    { name: "notes",           type: "text", required: false, options: { max: 5000 } },
  ]);

  console.log("\n✅ All collections created successfully.\n");
  console.log("Next steps:");
  console.log("  1. Set POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD in your app service");
  console.log("  2. Deploy the app service");
  console.log("  3. Register at /register and complete onboarding\n");
}

main().catch((err) => {
  console.error("\n❌ Setup failed:", err);
  process.exit(1);
});
