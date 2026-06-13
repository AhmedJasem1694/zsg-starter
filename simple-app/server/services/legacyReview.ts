/**
 * Legacy contract review, lightweight, cost-controlled pipeline.
 *
 * For historical contract estates (up to 100 files per batch). Each contract
 * runs: parse → boilerplate strip → classification (Gemini Flash) → PII
 * anonymisation → ONE batched Sonnet call extracting key provisions.
 * NO full playbook comparison. NO Opus calls. Target cost < $0.25/contract
 * (typical run lands well under $0.10).
 *
 * Each legacy contract becomes a normal library record flagged legacy: true,
 * with its metadata fields populated so it feeds portfolio intelligence and
 * counterparty history like any other document.
 */

import path from "path";
import fs from "fs";
import { pb } from "../pb.js";
import { parseDocument, stripBoilerplate } from "./documentParser.js";
import { anonymise, deanonymise, buildKnownEntities } from "./piiAnonymiser.js";
import { chatComplete } from "./openrouter.js";
import { llmJsonCall } from "./llmJsonParse.js";
import { getModelForTask } from "./modelRouter.js";
import { withCostTracking } from "./costTracker.js";
import { audit } from "./auditLogger.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

// ─── Key-provision extraction shape ───────────────────────────────────────────

export interface LegacyExtract {
  parties: string[];
  counterparty: string;
  contractTypeGuess: string;
  term: { summary: string; startDate: string | null; endDate: string | null; termMonths: number | null };
  value: { amount: number | null; currency: string; summary: string };
  renewal: { autoRenewal: boolean; renewalDate: string | null; noticePeriodDays: number | null; summary: string };
  terminationRights: string;
  liabilityCap: { present: boolean; capped: boolean | null; summary: string };
  governingLaw: string | null;
  assignment: string;
  dataProtection: string;
}

// ─── Schema self-heal ─────────────────────────────────────────────────────────
// Older deployments may predate the legacy/legacyExtract fields and the cost
// logging fields (contentHash/reviewCost/reviewCostDetail). Ensure once per
// process before the first legacy run.

let legacyFieldsEnsured = false;
export async function ensureLegacyFields(): Promise<void> {
  if (legacyFieldsEnsured) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const col = await (pb.collections as any).getOne("uploaded_documents");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields: any[] = col.fields ?? col.schema ?? [];
    const names = new Set(fields.map((f) => f.name));
    const missing = [];
    if (!names.has("legacy")) missing.push({ name: "legacy", type: "bool", required: false });
    if (!names.has("legacyExtract")) missing.push({ name: "legacyExtract", type: "text", required: false });
    if (!names.has("contentHash")) missing.push({ name: "contentHash", type: "text", required: false });
    if (!names.has("reviewCost")) missing.push({ name: "reviewCost", type: "number", required: false });
    if (!names.has("reviewCostDetail")) missing.push({ name: "reviewCostDetail", type: "text", required: false });
    // PocketBase 0.23+ does not auto-add created/updated. Without them every
    // sort by "created" 400s (legacy report, cache lookup) and month bucketing
    // is empty. Autodate fields populate from the moment they exist.
    if (!names.has("created")) missing.push({ name: "created", type: "autodate", onCreate: true, onUpdate: false });
    if (!names.has("updated")) missing.push({ name: "updated", type: "autodate", onCreate: true, onUpdate: true });
    if (missing.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (pb.collections as any).update(col.id, { fields: [...fields, ...missing] });
      console.log(`[legacy] Patched uploaded_documents schema with: ${missing.map((m) => m.name).join(", ")}`);
    }
    legacyFieldsEnsured = true;
  } catch (err) {
    console.warn("[legacy] Could not ensure legacy fields (non-fatal):", (err as Error)?.message);
  }
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

// Input cap for the extraction call (cost control). Key provisions cluster at
// the start (parties, term, value) and end (governing law, notices, signature
// area) of contracts, so long documents send head + tail.
const HEAD_CHARS = 18_000;
const TAIL_CHARS = 6_000;

function capForExtraction(text: string): string {
  if (text.length <= HEAD_CHARS + TAIL_CHARS) return text;
  return `${text.slice(0, HEAD_CHARS)}\n\n[... middle of document omitted ...]\n\n${text.slice(-TAIL_CHARS)}`;
}

export async function runLegacyReview(documentId: string): Promise<void> {
  return withCostTracking(
    () => _runLegacyReview(documentId),
    (summary) => {
      if (summary.llmCalls === 0) return;
      console.log(`[legacy] [cost] ${documentId}: $${summary.totalCostUsd.toFixed(4)} across ${summary.llmCalls} LLM calls`);
      pb.collection("uploaded_documents").update(documentId, {
        reviewCost: summary.totalCostUsd,
        reviewCostDetail: JSON.stringify(summary),
      }).catch(() => {});
    }
  );
}

async function _runLegacyReview(documentId: string): Promise<void> {
  await ensureLegacyFields();
  const doc = await pb.collection("uploaded_documents").getOne(documentId);
  const company = await pb.collection("companies").getOne(doc["company"] as string);
  const companyName = ((company["name"] as string) ?? "").trim() || "Your company";

  console.log(`[legacy] START ${documentId} file="${doc["originalName"] as string}"`);

  try {
    const filePath = path.join(process.cwd(), "uploads", doc["filename"] as string);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Uploaded file not found on disk: ${filePath}`);
    }

    await pb.collection("uploaded_documents").update(documentId, { status: "PARSING" });
    const parseResult = await parseDocument(filePath);
    if (parseResult.extractionMethod === "failed" || parseResult.textLength === 0) {
      throw new Error(parseResult.errorMessage ?? "Document could not be parsed");
    }
    const rawText = parseResult.text;

    // ── Classification (Gemini Flash, cheap first pass) ─────────────────────
    await pb.collection("uploaded_documents").update(documentId, { status: "CLASSIFYING" });
    let classifiedDocType = (doc["contractType"] as string) || "OTHER";
    try {
      const flashModel = getModelForTask("document_classification");
      const classifyResponse = await chatComplete([{
        role: "user",
        content: `Classify this contract document. Return exactly one type from this list (no explanation, just the type):
SUPPLIER_AGREEMENT, CUSTOMER_AGREEMENT, NDA, EMPLOYMENT, SAAS_AGREEMENT, LEASE, INVESTMENT, SERVICE_AGREEMENT, INSURANCE_POLICY, LOGISTICS_CONTRACT, HEALTHCARE_PROCUREMENT, OTHER

Contract text:
${rawText.slice(0, 3000)}`,
      }], 20, 15_000, flashModel);
      const detectedType = classifyResponse.trim().toUpperCase().replace(/[^A-Z_]/g, "");
      if (detectedType) classifiedDocType = detectedType;
    } catch (err) {
      console.warn(`[legacy] Classification failed for ${documentId} (non-fatal):`, (err as Error)?.message);
    }

    // ── Strip boilerplate + anonymise before the extraction call ─────────────
    const stripped = stripBoilerplate(rawText, classifiedDocType);
    await pb.collection("uploaded_documents").update(documentId, { status: "ANONYMISING" });
    const knownEntities = buildKnownEntities(company["name"] as string, undefined);
    const { anonymisedText, entityMap } = await anonymise(stripped.text, knownEntities, documentId);

    // ── ONE batched Sonnet call: key-provision extraction ────────────────────
    await pb.collection("uploaded_documents").update(documentId, { status: "COMPARING" });
    const extractionModel = getModelForTask("metadata_extraction");
    const raw = await llmJsonCall<Record<string, unknown>>({
      messages: [
        {
          role: "system",
          content: `You are a legal data extraction engine reviewing a historical contract for ${companyName}. Extract the key provisions below precisely. Use only what is in the text. Never invent figures, dates, or names. Where something is genuinely absent, use null (or false/empty as the schema indicates). Never use em dashes or en dashes in any output. Use a comma or a full stop instead.`,
        },
        {
          role: "user",
          content: `Extract the key provisions from this contract. Return ONLY valid JSON with this exact structure:
{
  "parties": ["full legal names of all parties"],
  "counterparty": "the party that is NOT ${companyName} (or the most prominent other party)",
  "term": { "summary": "1 sentence on contract duration", "start_date": "YYYY-MM-DD or null", "end_date": "YYYY-MM-DD or null", "term_months": number or null },
  "value": { "amount": number or null, "currency": "ISO code, default GBP", "summary": "1 sentence on fees/value, or 'No value stated'" },
  "renewal": { "auto_renewal": true or false, "renewal_date": "YYYY-MM-DD or null", "notice_period_days": number or null, "summary": "1 sentence on renewal/expiry mechanics" },
  "termination_rights": "1-2 sentences: who can terminate, on what notice, for what causes",
  "liability_cap": { "present": true or false, "capped": true or false or null, "summary": "1 sentence: the cap amount/formula, or that liability is uncapped/silent" },
  "governing_law": "jurisdiction string or null if not stated",
  "assignment": "1 sentence: can the contract be assigned, and on what conditions",
  "data_protection": "1 sentence: data protection/GDPR provisions present, or 'None found'"
}

CONTRACT TEXT:
${capForExtraction(anonymisedText)}`,
        },
      ],
      maxTokens: 1600,
      timeoutMs: 90_000,
      description: `legacy key-provision extraction for ${documentId}`,
      model: extractionModel,
    });

    // ── Normalise + de-anonymise ──────────────────────────────────────────────
    const deAnon = (s: unknown): string => deanonymise(String(s ?? ""), entityMap);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = raw as any;
    const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);
    const dateOrNull = (v: unknown): string | null => {
      const s = String(v ?? "").trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    };

    const extract: LegacyExtract = {
      parties: Array.isArray(r.parties) ? r.parties.map(deAnon).filter(Boolean).slice(0, 6) : [],
      counterparty: deAnon(r.counterparty),
      contractTypeGuess: classifiedDocType,
      term: {
        summary: deAnon(r.term?.summary),
        startDate: dateOrNull(r.term?.start_date),
        endDate: dateOrNull(r.term?.end_date),
        termMonths: num(r.term?.term_months),
      },
      value: {
        amount: num(r.value?.amount),
        currency: String(r.value?.currency || "GBP").slice(0, 5),
        summary: deAnon(r.value?.summary),
      },
      renewal: {
        autoRenewal: r.renewal?.auto_renewal === true,
        renewalDate: dateOrNull(r.renewal?.renewal_date),
        noticePeriodDays: num(r.renewal?.notice_period_days),
        summary: deAnon(r.renewal?.summary),
      },
      terminationRights: deAnon(r.termination_rights),
      liabilityCap: {
        present: r.liability_cap?.present === true,
        capped: typeof r.liability_cap?.capped === "boolean" ? r.liability_cap.capped : null,
        summary: deAnon(r.liability_cap?.summary),
      },
      governingLaw: r.governing_law ? deAnon(r.governing_law) : null,
      assignment: deAnon(r.assignment),
      dataProtection: deAnon(r.data_protection),
    };

    // ── Persist: legacy extract + normal library metadata (9d) ───────────────
    // Populating the standard metadata fields means legacy contracts feed
    // portfolio intelligence and counterparty history like any other document.
    const update: PBRecord = {
      status: "COMPLETE",
      legacy: true,
      legacyExtract: JSON.stringify(extract),
      contractType: classifiedDocType,
    };
    if (extract.counterparty && !(doc["counterpartyName"] as string)) update.counterpartyName = extract.counterparty;
    if (extract.governingLaw && !(doc["governingLaw"] as string)) update.governingLaw = extract.governingLaw;
    if (extract.value.amount !== null && !doc["contractValue"]) {
      update.contractValue = extract.value.amount;
      update.currency = extract.value.currency;
    }
    if (extract.term.termMonths !== null && !doc["contractTermMonths"]) update.contractTermMonths = extract.term.termMonths;
    if (extract.renewal.autoRenewal) update.autoRenewal = true;
    if (extract.renewal.renewalDate && !doc["renewalDate"]) update.renewalDate = extract.renewal.renewalDate;
    if (extract.renewal.noticePeriodDays !== null && !doc["noticePeriodDays"]) update.noticePeriodDays = extract.renewal.noticePeriodDays;

    await pb.collection("uploaded_documents").update(documentId, update);

    console.log(`[legacy] COMPLETE ${documentId}: counterparty="${extract.counterparty}" type=${classifiedDocType}`);
    void audit({
      action: "review_completed",
      entityType: "uploaded_document",
      entityId: documentId,
      companyId: company.id,
      detail: { legacy: true, contractType: classifiedDocType, counterparty: extract.counterparty },
    });
  } catch (err) {
    const errMsg = (err as Error)?.message ?? String(err);
    console.error(`[legacy] FAILED ${documentId}: ${errMsg}`);
    await pb.collection("uploaded_documents").update(documentId, {
      status: "FAILED",
      lastError: errMsg.slice(0, 2000),
    }).catch(() => {});
    void audit({
      action: "review_failed",
      entityType: "uploaded_document",
      entityId: documentId,
      companyId: company.id,
      detail: { legacy: true, error: errMsg },
    });
    throw err;
  }
}
