/**
 * PocketBase Collection Bootstrap Script (PocketBase 0.22+ API)
 *
 * Creates or patches all required collections in PocketBase.
 * Safe to re-run — existing collections with correct fields are skipped;
 * missing fields are added to existing collections without touching existing data.
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

function boolField(name: string, opts: FieldDef = {}): FieldDef {
  return { name, type: "bool", required: false, ...opts };
}

function dateField(name: string, opts: FieldDef = {}): FieldDef {
  return { name, type: "date", required: false, ...opts };
}

function emailField(name: string, opts: FieldDef = {}): FieldDef {
  return { name, type: "email", required: false, ...opts };
}

function relationField(name: string, collectionId: string, opts: FieldDef = {}): FieldDef {
  return {
    name,
    type: "relation",
    required: false,
    collectionId,
    cascadeDelete: false,
    maxSelect: 1,
    minSelect: 0,
    ...opts,
  };
}

function jsonField(name: string, opts: FieldDef = {}): FieldDef {
  return { name, type: "json", required: false, ...opts };
}

function fileField(name: string, opts: FieldDef = {}): FieldDef {
  return { name, type: "file", required: false, maxSelect: 1, maxSize: 52428800, ...opts };
}

// ── Smart additive create-or-update ──────────────────────────────────────────
// Adds missing fields to existing collections — never removes or modifies existing.

async function ensureCollection(
  name: string,
  fields: FieldDef[],
  type: "base" | "auth" = "base"
): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (pb.collections as any).getOne(name);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingFields: any[] = existing.fields ?? existing.schema ?? [];
    const existingNames = new Set(existingFields.map((f: any) => f.name));
    const missing = fields.filter((f) => !existingNames.has(f.name));

    if (missing.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (pb.collections as any).update(existing.id, {
        fields: [...existingFields, ...missing],
      });
      console.log(
        `  ✓ Patched '${name}' — added ${missing.length} field(s): ${missing.map((f) => f.name).join(", ")}`
      );
    } else {
      console.log(`  ✓ '${name}' already complete`);
    }
    return existing.id as string;
  } catch (err: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = (err as any)?.status;
    if (status !== 404) throw err;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (pb.collections as any).create({ name, type, fields });
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
  await (pb as any).admins
    .authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD)
    .catch(async () => {
      // PocketBase 0.22+ uses _superusers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (pb as any)
        .collection("_superusers")
        .authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    });
  console.log("Authenticated as admin.\n");

  console.log("Setting up collections...\n");

  // ── 1. companies ──────────────────────────────────────────────────────────
  const companiesId = await ensureCollection("companies", [
    textField("name", { required: true }),
    textField("sector", { required: true }),
    textField("jurisdiction"),
    textField("risk_appetite"),
    textField("role_in_contracts"),
    textField("workflow_types"),
    textField("interface_type"),
    numberField("team_size"),
    // compat fields — keep for existing code
    textField("riskAppetite"),
    textField("role"),
    textField("persona"),
    textField("workflowType"),
    textField("industry"),
  ]);

  // ── 2. panel_firms ────────────────────────────────────────────────────────
  const panelFirmsId = await ensureCollection("panel_firms", [
    relationField("company", companiesId, { required: true }),
    textField("firm_name", { required: true }),
    jsonField("matter_types"),
    jsonField("rate_card"),
    numberField("approved_to"),
    textField("contact_name"),
    emailField("contact_email"),
    boolField("active"),
  ]);

  // ── 3. users — AUTH collection — handle specially ─────────────────────────
  let usersExists = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usersCol = await (pb.collections as any).getOne("users");
    if (usersCol.type === "auth") {
      console.log("  ✓ 'users' already an auth collection — patching fields if needed");
      usersExists = true;
    } else {
      console.log("  ⚠ 'users' is a base collection — deleting and recreating as auth");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (pb.collections as any).delete(usersCol.id);
      usersExists = false;
    }
  } catch {
    // collection doesn't exist — will create below
  }

  if (!usersExists) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (pb.collections as any).create({
      name: "users",
      type: "auth",
      fields: [textField("name")],
    });
    console.log("  ✓ Created 'users' as auth collection");
  }

  const usersId = await getCollectionId("users");

  // Patch in new user fields
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usersCol = await (pb.collections as any).getOne("users");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingUserFields: any[] = usersCol.fields ?? usersCol.schema ?? [];
    const existingUserNames = new Set(existingUserFields.map((f: any) => f.name));
    const newUserFields = [
      textField("name"),
      relationField("company", companiesId),
      textField("role"),
      textField("interface_type"),
      fileField("avatar"),
    ].filter((f) => !existingUserNames.has(f.name));

    if (newUserFields.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (pb.collections as any).update(usersId, {
        fields: [...existingUserFields, ...newUserFields],
      });
      console.log(
        `  ✓ Patched 'users' with ${newUserFields.length} new field(s): ${newUserFields.map((f) => f.name).join(", ")}`
      );
    } else {
      console.log("  ✓ 'users' fields already complete");
    }
  }

  // ── 4. playbook_templates ─────────────────────────────────────────────────
  await ensureCollection("playbook_templates", [
    textField("workflow_type", { required: true }),
    textField("interface_type"),
    textField("sector"),
    textField("jurisdiction"),
    textField("risk_appetite"),
    jsonField("clause_defaults"),
  ]);

  // ── 5. regulatory_sources ─────────────────────────────────────────────────
  await ensureCollection("regulatory_sources", [
    textField("source_name", { required: true }),
    textField("source_url", { required: true }),
    jsonField("workflow_types"),
    textField("jurisdiction"),
    jsonField("sector_tags"),
    textField("fetch_frequency"),
    dateField("last_fetched_at"),
    boolField("active"),
  ]);

  // ── 6. regulatory_provisions ─────────────────────────────────────────────
  await ensureCollection("regulatory_provisions", [
    textField("source_name", { required: true }),
    textField("regulation_name", { required: true }),
    textField("provision_reference"),
    textField("provision_text", { required: true }),
    textField("jurisdiction", { required: true }),
    jsonField("sector_tags"),
    jsonField("clause_tags"),
    jsonField("workflow_tags"),
    dateField("effective_date"),
    dateField("retrieved_at", { required: true }),
    dateField("last_changed_at"),
    textField("source_url"),
    jsonField("embedding"),
  ]);

  // ── 7. counterparties ────────────────────────────────────────────────────
  const counterpartiesId = await ensureCollection("counterparties", [
    relationField("company", companiesId, { required: true }),
    textField("name", { required: true }),
    textField("type"),
    dateField("first_contract_date"),
  ]);

  // ── 8. escalation_contacts ───────────────────────────────────────────────
  await ensureCollection("escalation_contacts", [
    relationField("company", companiesId, { required: true }),
    textField("role", { required: true }),
    textField("name", { required: true }),
    emailField("email", { required: true }),
    boolField("active"),
  ]);

  // ── 9. governance_triggers ───────────────────────────────────────────────
  await ensureCollection("governance_triggers", [
    relationField("company", companiesId, { required: true }),
    textField("trigger_type", { required: true }),
    textField("trigger_condition", { required: true }),
    textField("trigger_description"),
    jsonField("escalation_roles"),
    boolField("active"),
  ]);

  // ── 10. approval_thresholds ──────────────────────────────────────────────
  await ensureCollection("approval_thresholds", [
    relationField("company", companiesId, { required: true }),
    textField("threshold_name", { required: true }),
    numberField("min_value"),
    numberField("max_value"),
    textField("currency"),
    textField("approver_role", { required: true }),
    textField("approver_name", { required: true }),
    emailField("approver_email"),
    textField("workflow_type"),
  ]);

  // ── 11. integration_connections ──────────────────────────────────────────
  const integrationConnectionsId = await ensureCollection("integration_connections", [
    relationField("company", companiesId, { required: true }),
    textField("integration_type", { required: true }),
    textField("connection_status"),
    jsonField("config"),
    relationField("connected_by", usersId),
    dateField("connected_at"),
    dateField("last_sync_at"),
  ]);

  // ── 12. playbooks ────────────────────────────────────────────────────────
  const playbooksId = await ensureCollection("playbooks", [
    relationField("company", companiesId, { required: true }),
    textField("name", { required: true }),
    textField("workflow_type", { required: true }),
    textField("interface_type"),
    textField("risk_appetite"),
    numberField("version"),
    boolField("active"),
    relationField("last_updated_by", usersId),
  ]);

  // ── 13. playbook_clauses ─────────────────────────────────────────────────
  await ensureCollection("playbook_clauses", [
    relationField("playbook", playbooksId, { required: true }),
    textField("clause_category", { required: true }),
    textField("preferred_position", { required: true }),
    textField("acceptable_fallback", { required: true }),
    textField("hard_red_line", { required: true }),
    textField("approver_role"),
    textField("approver_name"),
    textField("suggested_wording"),
  ]);

  // ── 14. playbook_update_suggestions ─────────────────────────────────────
  await ensureCollection("playbook_update_suggestions", [
    relationField("company", companiesId, { required: true }),
    relationField("playbook", playbooksId, { required: true }),
    textField("clause_category", { required: true }),
    textField("current_position"),
    textField("suggested_position"),
    textField("basis"),
    jsonField("contracts_referenced"),
    textField("status"),
    relationField("reviewed_by", usersId),
    dateField("reviewed_at"),
  ]);

  // ── 15. claim_assessments ─────────────────────────────────────────────────
  const claimAssessmentsId = await ensureCollection("claim_assessments", [
    relationField("company", companiesId, { required: true }),
    textField("claim_reference", { required: true }),
    textField("policy_reference"),
    textField("claim_type"),
    textField("claimant_type"),
    textField("claim_stage"),
    textField("policy_basis"),
    jsonField("hard_stop_answers"),
    boolField("hard_stop_passed"),
    boolField("fraud_flag"),
    boolField("fca_breach_flag"),
    boolField("vulnerable_customer"),
    jsonField("defence_questions"),
    textField("coverage_status"),
    textField("defence_prospects"),
    numberField("current_reserve"),
    numberField("quantum_low"),
    numberField("quantum_mid"),
    numberField("quantum_high"),
    textField("reserve_status"),
    numberField("settlement_recommended_low"),
    numberField("settlement_recommended_high"),
    textField("settlement_authority_level"),
    relationField("panel_firm", panelFirmsId),
    numberField("panel_budget"),
    numberField("panel_spend_to_date"),
    jsonField("regulatory_flags"),
    textField("overall_rag_status"),
    textField("board_summary"),
    dateField("assessed_at"),
    relationField("assessed_by", usersId),
  ]);

  // ── 16. contracts — FIRST PASS (no self-ref yet) ──────────────────────────
  const contractsId = await ensureCollection("contracts", [
    relationField("company", companiesId, { required: true }),
    relationField("playbook", playbooksId),
    relationField("counterparty", counterpartiesId),
    textField("workflow_type", { required: true }),
    textField("interface_type"),
    textField("contract_type", { required: true }),
    textField("counterparty_name", { required: true }),
    textField("counterparty_type"),
    textField("review_type"),
    numberField("contract_value"),
    numberField("annual_value"),
    numberField("total_commitment_value"),
    textField("currency"),
    numberField("contract_term_months"),
    boolField("auto_renewal"),
    numberField("notice_period_days"),
    dateField("renewal_date"),
    textField("governing_law"),
    textField("jurisdiction"),
    textField("file_path"),
    textField("overall_rag_status"),
    textField("founder_status"),
    textField("value_approval_required"),
    textField("value_approval_status"),
    jsonField("governance_flags"),
    jsonField("tags"),
    relationField("assigned_to", usersId),
    relationField("uploaded_by", usersId, { required: true }),
    dateField("uploaded_at"),
    dateField("signed_at"),
    textField("status"),
    textField("folder"),
    numberField("version_number"),
    boolField("is_current_version"),
    textField("relationship_type"),
    textField("search_text"),
  ]);

  // ── 16b. contracts SECOND PASS — self-referential parent_contract ─────────
  {
    const contractsColId = await getCollectionId("contracts");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contractsCol = await (pb.collections as any).getOne("contracts");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contractsFields: any[] = contractsCol.fields ?? contractsCol.schema ?? [];
    if (!contractsFields.some((f: any) => f.name === "parent_contract")) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (pb.collections as any).update(contractsColId, {
        fields: [...contractsFields, relationField("parent_contract", contractsColId)],
      });
      console.log("  ✓ Patched contracts.parent_contract (self-ref)");
    } else {
      console.log("  ✓ contracts.parent_contract already exists");
    }
  }

  // ── 17. contract_versions ────────────────────────────────────────────────
  await ensureCollection("contract_versions", [
    relationField("contract", contractsId, { required: true }),
    numberField("version_number", { required: true }),
    textField("file_path", { required: true }),
    relationField("uploaded_by", usersId, { required: true }),
    dateField("uploaded_at", { required: true }),
    jsonField("rag_summary"),
    textField("changes_from_previous"),
    boolField("is_final_signed"),
  ]);

  // ── 18. clause_analyses ───────────────────────────────────────────────────
  const clauseAnalysesId = await ensureCollection("clause_analyses", [
    relationField("contract", contractsId, { required: true }),
    textField("clause_category", { required: true }),
    textField("clause_text_extracted"),
    textField("counterparty_position"),
    textField("rag_status", { required: true }),
    textField("founder_status"),
    textField("issue_summary"),
    textField("why_it_matters"),
    jsonField("regulatory_citations"),
    jsonField("playbook_position"),
    textField("recommended_action"),
    textField("fallback_language"),
    textField("escalation_trigger"),
    textField("business_explanation"),
    textField("founder_plain_english"),
    textField("founder_business_impact"),
    textField("founder_ask_for"),
    textField("founder_copy_paste"),
    textField("founder_fundraising_relevance"),
    textField("founder_if_ignored"),
    textField("founder_call_lawyer_if"),
    textField("confidence_signal"),
    boolField("company_context_applied"),
    jsonField("context_signals_used"),
  ]);

  // ── 19. contradiction_findings ───────────────────────────────────────────
  await ensureCollection("contradiction_findings", [
    relationField("contract", contractsId, { required: true }),
    textField("contradiction_type", { required: true }),
    textField("clause_a_reference"),
    textField("clause_a_text"),
    textField("clause_b_reference"),
    textField("clause_b_text"),
    textField("plain_english_explanation"),
    textField("risk_assessment"),
    textField("counterparty_relies_on"),
    textField("recommended_resolution"),
    textField("severity", { required: true }),
    boolField("resolved"),
    dateField("resolved_at"),
    relationField("resolved_by", usersId),
  ]);

  // ── 20. escalation_records ────────────────────────────────────────────────
  await ensureCollection("escalation_records", [
    relationField("contract", contractsId, { required: true }),
    relationField("clause_analysis", clauseAnalysesId),
    textField("escalation_type", { required: true }),
    textField("trigger_description"),
    textField("escalated_to_role"),
    textField("escalated_to_name"),
    emailField("escalated_to_email"),
    dateField("escalated_at", { required: true }),
    textField("decision"),
    textField("decision_notes"),
    relationField("decided_by", usersId),
    dateField("decided_at"),
  ]);

  // ── 21. outcomes ──────────────────────────────────────────────────────────
  const outcomesId = await ensureCollection("outcomes", [
    relationField("contract", contractsId, { required: true }),
    textField("clause_category", { required: true }),
    textField("rag_status_at_review"),
    textField("outcome_type", { required: true }),
    textField("final_position"),
    boolField("deviation_from_playbook"),
    textField("deviation_reason"),
    relationField("approved_by", usersId),
    textField("notes"),
    dateField("recorded_at"),
    relationField("recorded_by", usersId, { required: true }),
  ]);

  // ── 22. outcome_deltas ────────────────────────────────────────────────────
  await ensureCollection("outcome_deltas", [
    relationField("outcome", outcomesId, { required: true }),
    textField("clause_category"),
    textField("zane_recommendation"),
    textField("actual_outcome"),
    boolField("matched_recommendation"),
    textField("commercial_reason"),
    // compat fields from old schema
    relationField("company", companiesId),
    textField("originalStatus"),
    textField("originalClauseText"),
    textField("finalClauseText"),
    textField("llmOutcome"),
    textField("llmConfidence"),
    textField("confirmedOutcome"),
    textField("confirmedBy"),
    dateField("confirmedAt"),
  ]);

  // ── 23. override_signals ─────────────────────────────────────────────────
  await ensureCollection("override_signals", [
    relationField("company", companiesId, { required: true }),
    relationField("contract", contractsId, { required: true }),
    relationField("clause_analysis", clauseAnalysesId),
    textField("clause_category", { required: true }),
    textField("original_rag_status", { required: true }),
    textField("corrected_rag_status", { required: true }),
    textField("clause_text"),
    textField("counterparty_type"),
    textField("contract_type"),
    textField("contract_value_band"),
    textField("governing_law"),
    textField("user_role"),
    textField("reason_text", { required: true }),
    boolField("processed"),
    // compat fields from old schema
    textField("originalStatus"),
    textField("correctedStatus"),
    textField("clauseText"),
    textField("counterpartyType"),
    textField("contractType"),
    textField("contractValueBand"),
    textField("userRole"),
    textField("userId"),
  ]);

  // ── 24. false_positive_signals ───────────────────────────────────────────
  await ensureCollection("false_positive_signals", [
    relationField("company", companiesId, { required: true }),
    relationField("contract", contractsId, { required: true }),
    relationField("clause_analysis", clauseAnalysesId),
    textField("clause_category", { required: true }),
    textField("error_type", { required: true }),
    textField("original_extracted_text"),
    textField("correct_interpretation"),
    boolField("processed"),
    // compat fields from old schema
    textField("errorType"),
    textField("originalExtractedText"),
    textField("correctInterpretation"),
    textField("userId"),
  ]);

  // ── 25. company_rules ─────────────────────────────────────────────────────
  await ensureCollection("company_rules", [
    relationField("company", companiesId, { required: true }),
    textField("rule_name", { required: true }),
    textField("clause_category", { required: true }),
    textField("counterparty_type"),
    textField("contract_type"),
    textField("rule_description", { required: true }),
    textField("rag_status_override"),
    boolField("overrides_playbook"),
    boolField("supplements_playbook"),
    boolField("approved_by_gc"),
    dateField("gc_approved_at"),
    relationField("gc_approved_by", usersId),
    boolField("active"),
    numberField("contracts_count"),
    // compat fields from old schema
    textField("clauseCategory"),
    textField("counterpartyType"),
    textField("contractType"),
    textField("ruleText"),
    textField("status"),
    textField("approvedBy"),
    dateField("approvedAt"),
    numberField("evidenceCount"),
    textField("evidenceContracts"),
    textField("riskAssessment"),
    textField("generatedFrom"),
    textField("editedRuleText"),
  ]);

  // ── 26. pii_sessions ─────────────────────────────────────────────────────
  await ensureCollection("pii_sessions", [
    textField("session_id", { required: true }),
    relationField("contract", contractsId, { required: true }),
    relationField("company", companiesId, { required: true }),
    relationField("user", usersId, { required: true }),
    jsonField("entity_count_by_type"),
    dateField("created_at", { required: true }),
    dateField("expires_at", { required: true }),
    boolField("archived"),
    // compat fields from old schema
    textField("sessionId"),
    textField("documentId"),
    textField("entityMap"),
    numberField("entitiesDetected"),
  ]);

  // ── 27. ancillary_documents ───────────────────────────────────────────────
  const ancillaryId = await ensureCollection("ancillary_documents", [
    relationField("company", companiesId, { required: true }),
    relationField("contract", contractsId),
    relationField("claim_assessment", claimAssessmentsId),
    textField("document_type", { required: true }),
    textField("file_name", { required: true }),
    textField("file_format", { required: true }),
    textField("file_path", { required: true }),
    numberField("file_size_bytes"),
    boolField("privilege_flag"),
    boolField("stored_in_vault"),
    textField("transcription"),
    boolField("transcription_confirmed"),
    textField("transcription_model"),
    relationField("uploaded_by", usersId, { required: true }),
    dateField("uploaded_at", { required: true }),
    // compat fields from old schema
    textField("originalName"),
    textField("filename"),
    textField("fileType"),
  ]);

  // ── 28. privilege_vault ───────────────────────────────────────────────────
  await ensureCollection("privilege_vault", [
    relationField("document", ancillaryId, { required: true }),
    relationField("company", companiesId, { required: true }),
    jsonField("access_log"),
  ]);

  // ── 29. audit_log ─────────────────────────────────────────────────────────
  await ensureCollection("audit_log", [
    relationField("company", companiesId, { required: true }),
    relationField("user", usersId),
    textField("action", { required: true }),
    textField("entity_type"),
    textField("entity_id"),
    jsonField("detail"),
    textField("ip_address"),
    // compat fields from old schema
    textField("entityType"),
    textField("entityId"),
    textField("companyId"),
    textField("userId"),
  ]);

  // ── 30. team_briefing_documents ───────────────────────────────────────────
  await ensureCollection("team_briefing_documents", [
    relationField("company", companiesId, { required: true }),
    relationField("generated_for", usersId, { required: true }),
    textField("playbook_briefing"),
    textField("actual_vs_stated"),
    textField("counterparty_intel"),
    textField("significant_decisions"),
    textField("portfolio_snapshot"),
    textField("approval_matrix"),
    dateField("generated_at", { required: true }),
    dateField("valid_until"),
  ]);

  // ── 31. new_hire_context_periods ──────────────────────────────────────────
  await ensureCollection("new_hire_context_periods", [
    relationField("user", usersId, { required: true }),
    relationField("company", companiesId, { required: true }),
    dateField("started_at", { required: true }),
    dateField("ends_at", { required: true }),
    boolField("active"),
  ]);

  // ── 32. integration_events ────────────────────────────────────────────────
  await ensureCollection("integration_events", [
    relationField("company", companiesId, { required: true }),
    relationField("integration", integrationConnectionsId),
    textField("event_type", { required: true }),
    jsonField("payload"),
    boolField("processed"),
    dateField("processed_at"),
    relationField("contract", contractsId),
  ]);

  // ══════════════════════════════════════════════════════════════════════════
  // Legacy / compatibility collections — keep all existing with ensureCollection
  // ══════════════════════════════════════════════════════════════════════════

  // ── company_regulations ───────────────────────────────────────────────────
  await ensureCollection("company_regulations", [
    relationField("company", companiesId),
    textField("jurisdiction"),
    textField("regulator"),
    textField("frameworkName"),
    textField("description"),
    textField("appliesTo"),
  ]);

  // ── playbook_rules ────────────────────────────────────────────────────────
  const playbookRulesId = await ensureCollection("playbook_rules", [
    relationField("company", companiesId),
    textField("workflowType"),
    textField("clauseCategory", { required: true }),
    textField("preferredPosition", { required: true }),
    textField("acceptableFallback", { required: true }),
    textField("hardRedLine", { required: true }),
    textField("approvalRequired"),
    textField("fallbackTemplate"),
    numberField("riskWeight"),
  ]);

  // ── approval_contacts ─────────────────────────────────────────────────────
  await ensureCollection("approval_contacts", [
    relationField("company", companiesId),
    textField("role", { required: true }),
    textField("name", { required: true }),
    emailField("email"),
  ]);

  // ── uploaded_documents ────────────────────────────────────────────────────
  const uploadedDocumentsId = await ensureCollection("uploaded_documents", [
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
    textField("folder"),
    textField("parentDocumentId"),
    textField("outcome"),
    textField("signedAt"),
    textField("outcomeNotes"),
    textField("contradictions"),
  ]);

  // ── extracted_clauses ─────────────────────────────────────────────────────
  const extractedClausesId = await ensureCollection("extracted_clauses", [
    relationField("document", uploadedDocumentsId),
    textField("clauseCategory", { required: true }),
    textField("rawText", { required: true }),
    textField("normalisedSummary"),
    numberField("confidence"),
  ]);

  // ── review_results ────────────────────────────────────────────────────────
  const reviewResultsId = await ensureCollection("review_results", [
    relationField("document", uploadedDocumentsId),
    relationField("clause", extractedClausesId, { cascadeDelete: false }),
    relationField("rule", playbookRulesId, { cascadeDelete: false }),
    textField("clauseCategory", { required: true }),
    textField("ragStatus", { required: true }),
    textField("comparisonStatement"),
    textField("confidenceLabel"),
    textField("regulatoryCitations"),
    textField("clauseSummary"),
    textField("whyItMatters"),
    textField("recommendedAction"),
    textField("suggestedFallback"),
    boolField("escalationRequired"),
    textField("escalationTrigger"),
    textField("businessSummary"),
    boolField("isAbsent"),
    textField("founderStatus"),
    textField("founderPlainEnglish"),
    textField("founderBusinessImpact"),
    textField("founderAskFor"),
    textField("founderCopyPaste"),
    textField("founderFundraisingRelevance"),
    textField("founderIfIgnored"),
  ]);

  // ── litigation_intakes ────────────────────────────────────────────────────
  await ensureCollection("litigation_intakes", [
    relationField("document", uploadedDocumentsId),
    numberField("stage"),
    textField("hardStopData"),
    textField("defenceData"),
    boolField("fraudFlag"),
    boolField("fcaBreach"),
    boolField("vulnerableCustomer"),
    boolField("hardStopPassed"),
    dateField("completedAt"),
  ]);

  // ── user_feedback ─────────────────────────────────────────────────────────
  await ensureCollection("user_feedback", [
    relationField("result", reviewResultsId),
    textField("userAction", { required: true }),
    textField("feedbackType"),
    textField("editedOutput"),
    textField("finalClauseText"),
    textField("correctOutput"),
    textField("notes"),
  ]);

  // ── detected_patterns ────────────────────────────────────────────────────
  await ensureCollection("detected_patterns", [
    textField("companyId", { required: true }),
    textField("clauseCategory", { required: true }),
    textField("patternType", { required: true }),
    textField("message"),
    textField("severity"),
    numberField("count"),
  ]);

  // ── regulatory_synthesis_pages ────────────────────────────────────────────
  await ensureCollection("regulatory_synthesis_pages", [
    textField("companyId", { required: true }),
    textField("jurisdiction", { required: true }),
    textField("sector"),
    textField("topic", { required: true }),
    textField("content"),
    textField("citations"),
    numberField("version"),
  ]);

  // ── company_knowledge_pages ───────────────────────────────────────────────
  await ensureCollection("company_knowledge_pages", [
    textField("companyId", { required: true }),
    textField("pageType"),
    textField("topic", { required: true }),
    textField("content"),
    textField("sourceResultIds"),
    textField("confidenceLabel"),
    numberField("version"),
  ]);

  // ── playbook_synthesis_pages ──────────────────────────────────────────────
  await ensureCollection("playbook_synthesis_pages", [
    textField("companyId", { required: true }),
    textField("clauseCategory", { required: true }),
    textField("synthesisType"),
    textField("content"),
    numberField("dataPoints"),
    textField("confidenceLabel"),
    numberField("version"),
  ]);

  // ── team_invites ──────────────────────────────────────────────────────────
  await ensureCollection("team_invites", [
    textField("companyId", { required: true }),
    textField("email", { required: true }),
    textField("role"),
    textField("status"),
  ]);

  // ── integration_configs ───────────────────────────────────────────────────
  await ensureCollection("integration_configs", [
    textField("companyId", { required: true }),
    textField("provider", { required: true }),
    textField("status", { required: true }),
    textField("accessToken"),
    textField("refreshToken"),
    dateField("tokenExpiry"),
    textField("tenantId"),
    textField("driveId"),
    textField("folderId"),
    textField("folderName"),
    textField("syncToken"),
    textField("webhookChannelId"),
    dateField("webhookExpiry"),
    textField("webhookSecret"),
    dateField("lastSyncAt"),
    textField("errorMessage"),
  ]);

  // ── integration_sync_log ──────────────────────────────────────────────────
  await ensureCollection("integration_sync_log", [
    textField("integrationId", { required: true }),
    textField("documentId"),
    textField("provider", { required: true }),
    textField("externalFileId", { required: true }),
    textField("externalFileName"),
    textField("status", { required: true }),
    textField("errorMessage"),
    textField("matchedDocumentId"),
    textField("matchSummary"),
  ]);

  console.log("\n✅ All collections created/patched successfully.\n");

  // ══════════════════════════════════════════════════════════════════════════
  // Verification
  // ══════════════════════════════════════════════════════════════════════════
  await verify();
}

async function verify() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Verifying collections...\n");

  const targets: Array<{ name: string; requiredFields: string[] }> = [
    { name: "companies", requiredFields: ["name", "sector"] },
    { name: "users", requiredFields: ["name"] },
    { name: "playbooks", requiredFields: ["name", "workflow_type"] },
    { name: "playbook_clauses", requiredFields: ["clause_category", "preferred_position"] },
    { name: "playbook_templates", requiredFields: ["workflow_type"] },
    { name: "playbook_update_suggestions", requiredFields: ["clause_category"] },
    { name: "approval_thresholds", requiredFields: ["threshold_name", "approver_role"] },
    { name: "escalation_contacts", requiredFields: ["role", "name", "email"] },
    { name: "governance_triggers", requiredFields: ["trigger_type", "trigger_condition"] },
    { name: "counterparties", requiredFields: ["name"] },
    { name: "contracts", requiredFields: ["workflow_type", "contract_type", "counterparty_name"] },
    { name: "contract_versions", requiredFields: ["version_number", "file_path"] },
    { name: "clause_analyses", requiredFields: ["clause_category", "rag_status"] },
    { name: "contradiction_findings", requiredFields: ["contradiction_type", "severity"] },
    { name: "escalation_records", requiredFields: ["escalation_type"] },
    { name: "outcomes", requiredFields: ["clause_category", "outcome_type"] },
    { name: "outcome_deltas", requiredFields: ["zane_recommendation", "actual_outcome"] },
    { name: "override_signals", requiredFields: ["clause_category", "reason_text"] },
    { name: "false_positive_signals", requiredFields: ["clause_category", "error_type"] },
    { name: "company_rules", requiredFields: ["rule_name", "clause_category"] },
    { name: "pii_sessions", requiredFields: ["session_id"] },
    { name: "ancillary_documents", requiredFields: ["document_type", "file_name"] },
    { name: "privilege_vault", requiredFields: ["access_log"] },
    { name: "regulatory_sources", requiredFields: ["source_name", "source_url"] },
    { name: "regulatory_provisions", requiredFields: ["regulation_name", "provision_text"] },
    { name: "claim_assessments", requiredFields: ["claim_reference"] },
    { name: "panel_firms", requiredFields: ["firm_name"] },
    { name: "audit_log", requiredFields: ["action"] },
    { name: "team_briefing_documents", requiredFields: ["playbook_briefing"] },
    { name: "new_hire_context_periods", requiredFields: ["started_at", "ends_at"] },
    { name: "integration_connections", requiredFields: ["integration_type"] },
    { name: "integration_events", requiredFields: ["event_type"] },
  ];

  let pass = 0;
  let fail = 0;

  for (const target of targets) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const col = await (pb.collections as any).getOne(target.name);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields: any[] = col.fields ?? col.schema ?? [];
      const fieldNames = new Set(fields.map((f: any) => f.name));

      const missingRequired = target.requiredFields.filter((f) => !fieldNames.has(f));
      if (missingRequired.length === 0) {
        console.log(`  ✅ ${target.name} (${fields.length} fields)`);
        pass++;
      } else {
        console.log(`  ❌ ${target.name} — missing fields: ${missingRequired.join(", ")}`);
        fail++;
      }
    } catch {
      console.log(`  ❌ ${target.name} — NOT FOUND`);
      fail++;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Summary: ${pass} ✅  ${fail} ❌  (of ${targets.length} target collections)\n`);

  if (fail > 0) {
    console.log("⚠ Some collections have issues — review output above.");
    process.exit(1);
  } else {
    console.log("🎉 All collections verified successfully!");
  }
}

main().catch((err) => {
  console.error("\n❌ Setup failed:", err);
  process.exit(1);
});
