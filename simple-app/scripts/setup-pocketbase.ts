/**
 * PocketBase Collection Bootstrap Script (PocketBase 0.22+ API)
 *
 * Creates or patches all required collections in PocketBase.
 * Safe to re-run — existing collections with correct fields are skipped;
 * existing empty collections are updated to add their fields.
 *
 * Usage:
 *   POCKETBASE_URL=https://your-pb.railway.app \
 *   POCKETBASE_ADMIN_EMAIL=admin@zane.app \
 *   POCKETBASE_ADMIN_PASSWORD=yourpassword \
 *   npx tsx scripts/setup-pocketbase.ts
 */

import { config } from "dotenv";
config();

import PocketBase from "pocketbase";

const POCKETBASE_URL = process.env.POCKETBASE_URL ?? "http://localhost:8090";
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL ?? "admin@zane.local";
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

  // ── 1. users — must be an AUTH collection so authWithPassword works ──────────
  // The routes use PocketBase native auth (authWithPassword / create with password+passwordConfirm).
  // If users exists as a base collection (wrong type), delete it and recreate as auth.
  let usersExists = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usersCol = await (pb.collections as any).getOne("users");
    if (usersCol.type === "auth") {
      console.log("  ✓ 'users' already an auth collection — adding 'name' field if missing");
      // Ensure the custom 'name' field exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingFields: any[] = usersCol.fields ?? usersCol.schema ?? [];
      const hasName = existingFields.some((f: { name: string }) => f.name === "name");
      if (!hasName) {
        await (pb.collections as any).update(usersCol.id, {
          fields: [...existingFields, textField("name")],
        });
        console.log("    → added 'name' field");
      }
      usersExists = true;
    } else {
      console.log("  ⚠ 'users' is a base collection — deleting and recreating as auth");
      await (pb.collections as any).delete(usersCol.id);
    }
  } catch {
    // collection doesn't exist — will create below
  }

  if (!usersExists) {
    await (pb.collections as any).create({
      name: "users",
      type: "auth",
      fields: [
        textField("name"),
      ],
    });
    console.log("  ✓ Created 'users' as auth collection");
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
    textField("governingLaw"),
    textField("jurisdiction"),
    numberField("contractValue"),
    textField("currency"),
    numberField("contractTermMonths"),
    boolField("autoRenewal"),
    numberField("noticePeriodDays"),
    dateField("renewalDate"),
    textField("contractTags"),
    textField("folder"),              // User-assigned folder label (e.g. "Suppliers", "Investors")
    textField("parentDocumentId"),    // ID of prior version document (version chain)
    textField("outcome"),        // DRAFT | SIGNED | EXECUTED — set via outcome capture
    textField("signedAt"),       // ISO date when marked as signed/executed
    textField("outcomeNotes"),   // free text: what was actually negotiated
    textField("contradictions", { max: 50000 }),  // JSON array of ContradictionFinding
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
    // Verification-first output fields
    textField("comparisonStatement", { max: 5000 }),
    textField("confidenceLabel"),          // HIGH | MEDIUM | LOW
    textField("regulatoryCitations", { max: 20000 }),  // JSON array
    // Standard output fields
    textField("clauseSummary", { max: 10000 }),
    textField("whyItMatters", { max: 10000 }),
    textField("recommendedAction", { max: 10000 }),
    textField("suggestedFallback", { max: 10000 }),
    boolField("escalationRequired"),
    textField("escalationTrigger"),
    textField("businessSummary", { max: 10000 }),
    boolField("isAbsent"),
    // Founder-specific fields
    textField("founderStatus"),                          // SAFE | CAUTION | DO NOT SIGN YET
    textField("founderPlainEnglish", { max: 5000 }),
    textField("founderBusinessImpact", { max: 5000 }),
    textField("founderAskFor", { max: 5000 }),
    textField("founderCopyPaste", { max: 10000 }),
    textField("founderFundraisingRelevance", { max: 5000 }),
    textField("founderIfIgnored", { max: 5000 }),
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
    textField("userAction", { required: true }),   // ACCEPTED | EDITED | ESCALATED | DISMISSED
    textField("feedbackType"),                      // STANDARD | TEACH_ZANE | FALSE_POSITIVE
    textField("editedOutput", { max: 10000 }),
    textField("finalClauseText", { max: 10000 }),
    textField("correctOutput", { max: 10000 }),    // Teach Zane: what the correct analysis should say
    textField("notes", { max: 5000 }),
  ]);

  // ── 12. detected_patterns ────────────────────────────────────────────────────
  // L2 outcome memory: persisted patterns detected from lawyer feedback.
  // Feeds the v3 synthesis layer and the "Zane noticed" panel.
  await setupCollection("detected_patterns", [
    textField("companyId", { required: true }),
    textField("clauseCategory", { required: true }),
    textField("patternType", { required: true }),  // repeated_acceptance | repeated_escalation | frequently_absent | consistently_green
    textField("message", { max: 2000 }),
    textField("severity"),                          // info | warn | good
    numberField("count"),
  ]);

  // ── 13. regulatory_synthesis_pages ────────────────────────────────────────────
  // L3 synthesis: structured knowledge pages synthesised from regulatory data.
  // Schema-only in v1 — populated by future synthesis pipeline.
  await setupCollection("regulatory_synthesis_pages", [
    textField("companyId", { required: true }),
    textField("jurisdiction", { required: true }),
    textField("sector"),
    textField("topic", { required: true }),
    textField("content", { max: 500000 }),          // rendered markdown
    textField("citations", { max: 50000 }),          // JSON array of {article, regulation, url}
    numberField("version"),
  ]);

  // ── 14. company_knowledge_pages ───────────────────────────────────────────────
  // L3 synthesis: Zane's accumulated knowledge about how THIS company negotiates.
  // Schema-only in v1 — populated as L2 patterns accumulate.
  await setupCollection("company_knowledge_pages", [
    textField("companyId", { required: true }),
    textField("pageType"),          // PLAYBOOK_INSIGHT | COUNTERPARTY_PATTERN | SECTOR_NORM
    textField("topic", { required: true }),
    textField("content", { max: 500000 }),
    textField("sourceResultIds", { max: 50000 }),   // JSON array of review_result IDs used
    textField("confidenceLabel"),                    // HIGH | MEDIUM | LOW
    numberField("version"),
  ]);

  // ── 15. playbook_synthesis_pages ─────────────────────────────────────────────
  // L3 synthesis: per-clause synthesis of trends, market norms, and negotiation patterns.
  // Schema-only in v1 — populated as feedback volume grows.
  await setupCollection("playbook_synthesis_pages", [
    textField("companyId", { required: true }),
    textField("clauseCategory", { required: true }),
    textField("synthesisType"),     // RISK_TREND | NEGOTIATION_PATTERN | MARKET_NORM
    textField("content", { max: 500000 }),
    numberField("dataPoints"),      // number of results this synthesis is based on
    textField("confidenceLabel"),
    numberField("version"),
  ]);

  // ── 16. pii_sessions ─────────────────────────────────────────────────────────
  // Stores the reversible entity map for each anonymisation session so that
  // LLM output can be de-anonymised and PII events can be correlated in audits.
  await setupCollection("pii_sessions", [
    textField("sessionId", { required: true }),
    textField("documentId"),
    textField("entityMap", { max: 500000 }),  // JSON array of PiiEntity
    numberField("entitiesDetected"),
  ]);

  // ── 17. approval_thresholds ───────────────────────────────────────────────────
  // Contract value bands defining approval requirements.
  // e.g. £0-25k = NONE, £25k-250k = CFO, £250k+ = BOARD
  await setupCollection("approval_thresholds", [
    textField("companyId", { required: true }),
    numberField("minValue"),                     // lower bound (inclusive), null = 0
    numberField("maxValue"),                     // upper bound (exclusive), null = unlimited
    textField("requiredApprover"),               // ApprovalRole | "NONE"
    textField("label"),                          // e.g. "Up to £25k"
  ]);

  // ── 18. governance_triggers ───────────────────────────────────────────────────
  // Clause categories that always require escalation, regardless of individual
  // clause-level RAG assessment. These are hard-wired governance rules.
  await setupCollection("governance_triggers", [
    textField("companyId", { required: true }),
    textField("clauseCategory", { required: true }),
    textField("escalateTo"),                    // ApprovalRole
    textField("reason"),                         // Plain-English rationale
  ]);

  // ── 19. team_invites ──────────────────────────────────────────────────────────
  // Pending team invitations sent during onboarding.
  await setupCollection("team_invites", [
    textField("companyId", { required: true }),
    textField("email", { required: true }),
    textField("role"),                           // e.g. LEGAL | GC | CFO
    textField("status"),                         // pending | accepted
  ]);

  // ── 20. audit_log ─────────────────────────────────────────────────────────────
  // Immutable audit trail for all significant Zane actions.
  // Intentionally not using strict relations so entries survive deletions.
  await setupCollection("audit_log", [
    textField("action", { required: true }),
    textField("entityType"),
    textField("entityId"),
    textField("companyId"),
    textField("userId"),
    textField("detail", { max: 100000 }), // JSON blob
    textField("ipAddress"),
  ]);

  // ── 21. outcome_deltas ────────────────────────────────────────────────────────
  // Section 18 Step 1: captures how each flagged clause resolved in the signed doc
  await setupCollection("outcome_deltas", [
    relationField("company", companiesId),
    relationField("document", uploadedDocumentsId, { cascadeDelete: false }),        // original doc
    relationField("finalDocument", uploadedDocumentsId, { cascadeDelete: false }),  // final signed doc
    textField("clauseCategory"),
    textField("originalStatus"),           // RAG status from original review
    textField("originalClauseText", { max: 50000 }),
    textField("finalClauseText", { max: 50000 }),
    textField("llmOutcome"),               // PREFERRED/FALLBACK/BELOW_FALLBACK/NO_CHANGE/REMOVED
    textField("llmConfidence"),            // 0.0–1.0 as string
    textField("confirmedOutcome"),         // set by user
    textField("confirmedBy"),              // userId
    dateField("confirmedAt"),
    textField("notes", { max: 5000 }),
  ]);

  // ── 22. override_signals ─────────────────────────────────────────────────────
  // Section 18 Step 2: captures RAG status overrides with mandatory reason
  await setupCollection("override_signals", [
    relationField("company", companiesId),
    relationField("result", reviewResultsId, { cascadeDelete: false }),
    textField("clauseCategory"),
    textField("originalStatus"),
    textField("correctedStatus"),
    textField("clauseText", { max: 50000 }),
    textField("counterpartyType"),
    textField("contractType"),
    textField("contractValueBand"),
    textField("userRole"),
    textField("reason", { required: true, max: 5000 }),
    textField("userId"),
  ]);

  // ── 23. false_positive_signals ───────────────────────────────────────────────
  // Section 18 Step 3: flags clause extractions that were incorrect
  await setupCollection("false_positive_signals", [
    relationField("company", companiesId),
    relationField("result", reviewResultsId, { cascadeDelete: false }),
    textField("clauseCategory"),
    textField("errorType"),               // extraction/classification/regulatory/fallback
    textField("originalExtractedText", { max: 50000 }),
    textField("correctInterpretation", { max: 50000 }),
    textField("userId"),
  ]);

  // ── 24. company_rules ────────────────────────────────────────────────────────
  // Section 18 Steps 4+5: LLM-generated rules pending GC approval
  await setupCollection("company_rules", [
    relationField("company", companiesId),
    textField("clauseCategory"),
    textField("counterpartyType"),
    textField("contractType"),
    textField("ruleText", { max: 50000 }),
    textField("status"),                  // PENDING/ACTIVE/REJECTED
    textField("approvedBy"),              // userId
    dateField("approvedAt"),
    numberField("evidenceCount"),
    textField("evidenceContracts", { max: 50000 }), // JSON array of document IDs
    textField("riskAssessment", { max: 20000 }),
    textField("generatedFrom"),           // OUTCOME_PATTERN/OVERRIDE_PATTERN
    textField("editedRuleText", { max: 50000 }),
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
