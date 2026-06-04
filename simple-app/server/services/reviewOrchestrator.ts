import path from "path";
import fs from "fs";
import { pb } from "../pb.js";
import { parseDocument, chunkText } from "./documentParser.js";
import { classifyClauses } from "./clauseClassifier.js";
import {
  compareClauseToPlaybook,
  buildAbsentClauseResult,
  buildFavourableAbsentResult,
  FAVOURABLE_WHEN_ABSENT,
} from "./playbookComparison.js";
import { detectContradictions } from "./contradictionDetector.js";
import { getRegulationSummaryForLLM } from "./regulatoryDetection.js";
import { getRegulatoryContext, formatRegulatoryContextForPrompt } from "./regulatoryEngine.js";
import { sendEscalationEmail } from "./emailService.js";
import { anonymise, deanonymise, buildKnownEntities } from "./piiAnonymiser.js";
import { audit } from "./auditLogger.js";
import { persistOutcomePatterns } from "./outcomeCapture.js";
import { runDocumentAudit } from "./documentAudit.js";
import { getModelForTask, getModelLabel } from "./modelRouter.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

function toTitleCase(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Pipeline timing helpers ───────────────────────────────────────────────────
function makeTiming(docId: string) {
  const origin = Date.now();
  let last = origin;
  return {
    mark(label: string): void {
      const now = Date.now();
      const sinceOrigin = now - origin;
      const sinceLast  = now - last;
      last = now;
      console.log(`[timing] ${docId} | ${label} | +${sinceLast}ms | total ${sinceOrigin}ms`);
    },
  };
}

// ── Missing-clause severity classification ────────────────────────────────────
// Hardcoded v1 classification for commercial contracts.
// A clause absent from the document is CRITICAL if its absence creates genuine
// legal or commercial risk; OPTIONAL otherwise.

const CRITICAL_COMMERCIAL = new Set([
  "LIABILITY_CAP",
  "DATA_PRIVACY",
  "GOVERNING_LAW",
  "TERMINATION",
  "CONFIDENTIALITY",
]);

const CRITICAL_SUPPLIER_EXTRA = new Set([
  "INDEMNITY",
  "PAYMENT_TERMS",
]);

const OPTIONAL_COMMERCIAL = new Set([
  "AUDIT_RIGHTS",
  "CHANGE_OF_CONTROL",
  "FORCE_MAJEURE",
  "ANTI_BRIBERY",
  "DISPUTE_RESOLUTION",
  "AUTO_RENEWAL",
  "IP_OWNERSHIP",
]);

export function computeMissingSeverity(
  clauseCategory: string,
  contractType: string
): "CRITICAL" | "OPTIONAL" {
  const isSupplier = /supplier/i.test(contractType);
  if (CRITICAL_COMMERCIAL.has(clauseCategory)) return "CRITICAL";
  if (isSupplier && CRITICAL_SUPPLIER_EXTRA.has(clauseCategory)) return "CRITICAL";
  if (OPTIONAL_COMMERCIAL.has(clauseCategory)) return "OPTIONAL";
  // Unlisted categories: default to OPTIONAL so nothing is incorrectly flagged critical
  return "OPTIONAL";
}

// Hard ceiling: if the entire review hasn't completed in 20 minutes, force FAILED.
// Increased from 8 to 20 minutes to handle large documents (50K+ chars) with many parallel LLM
// comparisons that may be rate-limited to run somewhat sequentially by the upstream API.
const REVIEW_TIMEOUT_MS = 20 * 60 * 1000;

export async function runReview(documentId: string): Promise<void> {
  // Wrap the entire review in a hard timeout.
  // We use a flag to short-circuit _runReview if the timeout fires first,
  // preventing the stale continuation from later overwriting FAILED with COMPLETE.
  let timedOut = false;
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => {
      timedOut = true;
      reject(new Error(`Review pipeline timed out after ${REVIEW_TIMEOUT_MS / 60000} minutes`));
    }, REVIEW_TIMEOUT_MS)
  );
  return Promise.race([_runReview(documentId, () => timedOut), timeoutPromise]);
}

// Concurrency limiter: run at most MAX_CONCURRENT LLM clause comparisons simultaneously.
// 8 is the sweet spot: covers a typical NDA (5-8 clauses) in a single parallel batch
// while staying under OpenRouter's per-minute rate limit for claude-sonnet.
const MAX_CONCURRENT_COMPARISONS = 8;

async function runWithConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      try {
        results[idx] = { status: "fulfilled", value: await tasks[idx]() };
      } catch (reason) {
        results[idx] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function _runReview(documentId: string, isTimedOut: () => boolean = () => false): Promise<void> {
  // Load document and company sequentially (each depends on the previous).
  // Playbook rules, approval thresholds, and governance triggers all depend on
  // company.id: fetch them in parallel once company is known.
  const doc = await pb.collection("uploaded_documents").getOne(documentId);
  const company = await pb.collection("companies").getOne(doc["company"] as string);
  const [playbookRules, approvalThresholds, governanceTriggers] = await Promise.all([
    pb.collection("playbook_rules").getFullList({ filter: `company = "${company.id}"` }),
    pb.collection("approval_thresholds").getFullList({ filter: `companyId = "${company.id}"`, sort: "+minValue" }).catch(() => []),
    pb.collection("governance_triggers").getFullList({ filter: `companyId = "${company.id}"` }).catch(() => []),
  ]);
  const contractValue = doc["contractValue"] as number | null;

  // Helper: Tier 2 - check if contract value triggers an approver
  function getValueTierApprover(): string | null {
    if (!contractValue || approvalThresholds.length === 0) return null;
    for (const band of approvalThresholds) {
      const min = (band["minValue"] as number) ?? 0;
      const max = band["maxValue"] as number | null;
      if (contractValue >= min && (max === null || contractValue < max)) {
        const approver = band["requiredApprover"] as string;
        return approver === "NONE" ? null : approver;
      }
    }
    return null;
  }

  // Helper: Tier 3 - check if a clause category is a governance trigger
  function getGovernanceTriggerApprover(category: string): string | null {
    const trigger = governanceTriggers.find((t) => t["clauseCategory"] === category);
    return trigger ? (trigger["escalateTo"] as string) : null;
  }

  // Ensure company name is never empty. Fall back to "Your company" so LLM output is never blank
  const effectiveCompanyName = ((company["name"] as string) ?? "").trim() || "Your company";

  // ── Effective workflow type — auto-detect healthcare by sector ────────────────
  // Healthcare was removed from the user-facing workflow selector but must still
  // activate automatically when the company sector is healthcare. We derive the
  // effective workflow from the explicit workflowType first, then fall back to
  // sector-based detection so users never need to select a workflow manually.
  const rawWorkflow = (doc["workflowType"] as string) || (company["workflowType"] as string) || "COMMERCIAL_CONTRACT";
  const companySector = ((company["sector"] as string) ?? "").toLowerCase();
  const companyIndustry = ((company["industry"] as string) ?? "").toLowerCase();
  const contractType = ((doc["contractType"] as string) ?? "").toLowerCase();
  const isHealthcareSector =
    companySector.includes("health") || companySector.includes("nhs") ||
    companyIndustry.includes("health") || companyIndustry.includes("nhs") ||
    contractType.includes("nhs") || contractType.includes("clinical") ||
    contractType.includes("healthcare") || contractType.includes("medical") ||
    contractType.includes("pharmacy") || contractType.includes("cqc") ||
    contractType === "nhs_standard_contract";
  const effectiveWorkflow = rawWorkflow === "COMMERCIAL_CONTRACT" && isHealthcareSector
    ? "HEALTHCARE_PROCUREMENT"
    : rawWorkflow;
  if (isHealthcareSector && rawWorkflow !== "HEALTHCARE_PROCUREMENT") {
    console.log(`[review] Auto-routing to HEALTHCARE_PROCUREMENT (sector="${companySector}", contractType="${contractType}")`);
  }

  const t = makeTiming(documentId);
  console.log(`[review] START documentId=${documentId} file="${doc["filename"] as string}" company=${company.id} name="${effectiveCompanyName}"`);
  t.mark("pipeline start: setup complete (doc + company + playbook loaded)");

  // Status is already set to PROCESSING by the route handler before runReview() is called.
  // Audit: fire-and-forget, never block the pipeline on audit writes
  void audit({
    action: "review_started",
    entityType: "uploaded_document",
    entityId: documentId,
    companyId: company.id,
    detail: { contractType: doc["contractType"], originalName: doc["originalName"] },
  });

  try {
    const filePath = path.join(process.cwd(), "uploads", doc["filename"] as string);

    // Verify the file actually exists before attempting to parse
    if (!fs.existsSync(filePath)) {
      throw new Error(`Uploaded file not found on disk: ${filePath}. The uploads directory may not be persisted.`);
    }

    // Granular status: PARSING
    await pb.collection("uploaded_documents").update(documentId, { status: "PARSING" });
    console.log(`[review] PARSING ${documentId} - reading ${filePath}`);

    const parseResult = await parseDocument(filePath);
    const rawText = parseResult.text;
    const ocrUsed = parseResult.ocrUsed;
    const extractionMethod = parseResult.extractionMethod;

    console.log(`[review] PARSED ${documentId}: method=${extractionMethod} chars=${parseResult.textLength} ocrUsed=${ocrUsed}${parseResult.errorMessage ? ` warn="${parseResult.errorMessage}"` : ""}`);
    t.mark(`text extraction complete: ${parseResult.textLength} chars via ${extractionMethod}`);

    // Store extraction metadata on the document (best-effort - fields may not exist in older schemas)
    pb.collection("uploaded_documents").update(documentId, {
      extractionMethod,
      ocrUsed,
      textLength: parseResult.textLength,
    }).catch((e: unknown) => console.warn("[review] Could not store extraction metadata:", (e as Error)?.message));

    // If extraction failed completely, throw to trigger FAILED status
    if (extractionMethod === "failed" && parseResult.textLength === 0) {
      throw new Error(parseResult.errorMessage ?? "Document could not be parsed - ensure the PDF contains selectable text");
    }

    // If text is very sparse but non-zero, warn but continue
    if (parseResult.textLength < 100) {
      console.warn(`[review] Very sparse text (${parseResult.textLength} chars) for ${documentId} - review quality may be low`);
    }

    // ── Stage 1: Document classification via Gemini Flash ───────────────────
    // Fast first pass: determines contract type to guide the rest of the pipeline.
    // Uses Gemini 2.5 Flash — low latency, cheap, ideal for simple classification.
    const flashModel = getModelForTask("document_classification");
    let classifiedDocType = (doc["contractType"] as string) ?? "COMMERCIAL_CONTRACT";
    try {
      const { chatComplete } = await import("./openrouter.js");
      const classifySnippet = rawText.slice(0, 3000);
      const classifyResponse = await chatComplete([{
        role: "user",
        content: `Classify this contract document. Return exactly one type from this list (no explanation, just the type):
SUPPLIER_AGREEMENT, CUSTOMER_AGREEMENT, NDA, EMPLOYMENT, SAAS_AGREEMENT, LEASE, INVESTMENT, SERVICE_AGREEMENT, INSURANCE_POLICY, LOGISTICS_CONTRACT, HEALTHCARE_PROCUREMENT, OTHER

Contract text:
${classifySnippet}`,
      }], 20, 15_000, flashModel);
      const detectedType = classifyResponse.trim().toUpperCase().replace(/[^A-Z_]/g, "");
      if (detectedType && detectedType !== "OTHER") {
        classifiedDocType = detectedType;
        console.log(`[review] Gemini Flash classified document as: ${classifiedDocType} (was: ${doc["contractType"] ?? "unset"})`);
      }
      t.mark(`document classification (Gemini Flash): ${classifiedDocType}`);
    } catch (err) {
      console.warn("[review] Document classification (Gemini Flash) failed (non-fatal):", (err as Error)?.message);
      t.mark("document classification: failed, using stored type");
    }

    // ── Stage 2: Metadata extraction via GPT-4o ──────────────────────────────
    // Structured extraction of counterparty, value, dates, governing law.
    // GPT-4o is strong at pulling structured data from long documents.
    const gpt4oModel = getModelForTask("metadata_extraction");
    let resolvedCounterpartyName = ((doc["counterpartyName"] as string) ?? "").trim();
    if (!resolvedCounterpartyName && rawText.length > 20) {
      try {
        const { chatComplete } = await import("./openrouter.js");
        const snippet = rawText.slice(0, 6000);
        // 60 max tokens (just a name), 25s timeout for GPT-4o
        const cpResponse = await chatComplete([{
          role: "user",
          content: `Extract the counterparty company or individual name from this contract. Look in: (1) the opening "between X and Y" parties clause, (2) definitions of "Supplier", "Vendor", "Customer", "Client", "Service Provider", (3) the agreement title/header, (4) the signature block. Return ONLY the full legal entity name (e.g. "Attio Limited"), no explanation, no JSON, just the name. If genuinely not identifiable return the single word: unknown\n\n${snippet}`,
        }], 60, 25_000, gpt4oModel);
        const extracted = cpResponse.trim().replace(/^["']|["']$/g, "");
        if (extracted && extracted.toLowerCase() !== "unknown" && extracted.length < 120) {
          resolvedCounterpartyName = extracted;
          // Persist back so the UI shows it and future requests find it
          pb.collection("uploaded_documents").update(documentId, { counterpartyName: extracted })
            .catch((e: unknown) => console.warn("[review] Could not persist extracted counterpartyName:", (e as Error)?.message));
          console.log(`[review] GPT-4o extracted counterpartyName="${extracted}" for ${documentId}`);
        }
        t.mark(`metadata extraction (GPT-4o): counterparty=${resolvedCounterpartyName || "not found"}`);
      } catch (err) {
        console.warn("[review] Metadata extraction (GPT-4o) failed (non-fatal):", (err as Error)?.message);
        t.mark("metadata extraction: failed (non-fatal)");
      }
    }

    // Granular status: ANONYMISING
    await pb.collection("uploaded_documents").update(documentId, { status: "ANONYMISING" });
    console.log(`[review] ANONYMISING ${documentId}`);

    // ── PII Anonymisation ────────────────────────────────────────────────────
    // Anonymise the raw contract text BEFORE it is sent to any external LLM.
    // We replace known party names first, then apply structural PII patterns.
    void audit({
      action: "pii_anonymisation_started",
      entityType: "uploaded_document",
      entityId: documentId,
      companyId: company.id,
    });

    const knownEntities = buildKnownEntities(
      company["name"] as string,
      resolvedCounterpartyName || undefined,
    );

    const { anonymisedText, entityMap, sessionId } = await anonymise(
      rawText,
      knownEntities,
      documentId
    );

    console.log(`[review] ANONYMISED ${documentId}: session=${sessionId} entities=${entityMap.length}`);
    t.mark(`PII anonymisation complete: ${entityMap.length} entities masked`);

    void audit({
      action: "pii_anonymisation_completed",
      entityType: "uploaded_document",
      entityId: documentId,
      companyId: company.id,
      detail: {
        sessionId,
        entitiesDetected: entityMap.length,
        entityTypes: Array.from(new Set(entityMap.map((e) => e.type))),
      },
    });

    console.log(
      `[PII] Session ${sessionId}: ${entityMap.length} entities anonymised before LLM call.`
    );
    // ────────────────────────────────────────────────────────────────────────

    // ── Large-document detection ──────────────────────────────────────────────
    // Documents over 30,000 characters are split into overlapping 30,000-char
    // sections before classification. Each section is classified independently
    // and the results merged, ensuring the full document is searched even for
    // clauses appearing in the second half of long contracts.
    const LARGE_DOC_THRESHOLD = 30_000; // chars: typical 15-page contract threshold
    const SECTION_SIZE        = 30_000; // chars per section
    const SECTION_OVERLAP     = 5_000;  // overlap to avoid missing clauses near boundaries

    console.log(`[review] TEXT LENGTH ${documentId}: rawText=${rawText.length} chars, anonymised=${anonymisedText.length} chars`);

    let textSections: string[];
    if (anonymisedText.length > LARGE_DOC_THRESHOLD) {
      console.log(`[review] LARGE DOCUMENT ${documentId}: ${anonymisedText.length} chars, splitting into sections of ${SECTION_SIZE} chars (${SECTION_OVERLAP} overlap)`);
      textSections = [];
      let pos = 0;
      while (pos < anonymisedText.length) {
        textSections.push(anonymisedText.slice(pos, pos + SECTION_SIZE));
        pos += SECTION_SIZE - SECTION_OVERLAP;
        if (pos >= anonymisedText.length) break;
      }
      console.log(`[review] Split into ${textSections.length} sections for classification`);
    } else {
      textSections = [anonymisedText];
    }

    // Chunk each section independently
    const allChunksBySection = textSections.map((section) => chunkText(section));
    const chunks = allChunksBySection.flat();

    console.log(`[review] CLASSIFYING ${documentId}: ${chunks.length} chunks across ${textSections.length} section(s), ${playbookRules.length} playbook rules`);

    if (chunks.length === 0) {
      console.warn(`[review] No text chunks produced for ${documentId}. Text length: ${rawText.length} chars. Document may be a scanned image or empty.`);
    }

    // Granular status: CLASSIFYING
    await pb.collection("uploaded_documents").update(documentId, { status: "CLASSIFYING" });

    // Derive active categories from the company's playbook rules
    const playbookCategories = Array.from(new Set(playbookRules.map((r) => r["clauseCategory"] as string)));

    // ── Classification: run per section, merge results ─────────────────────────
    // For large documents we classify each section separately so no single LLM
    // call receives hundreds of chunk snippets. For normal documents there is
    // only one section so this is identical to the original behaviour.
    const classifyAllSections = async (): Promise<Awaited<ReturnType<typeof classifyClauses>>> => {
      const sectionResults = await Promise.all(
        allChunksBySection.map((sectionChunks, sIdx) => {
          if (sectionChunks.length === 0) return Promise.resolve([] as Awaited<ReturnType<typeof classifyClauses>>);
          console.log(`[review] Classifying section ${sIdx + 1}/${allChunksBySection.length} (${sectionChunks.length} chunks)`);
          // classifyClauses returns rawText strings directly, no index remapping needed
          return classifyClauses(sectionChunks, effectiveWorkflow, playbookCategories, getModelForTask("clause_extraction"));
        })
      );
      return sectionResults.flat();
    };

    // Classify and fetch regulatory context in parallel
    const [classified, regulatoryContext] = await Promise.all([
      classifyAllSections(),
      getRegulationSummaryForLLM(company.id),
    ]);
    console.log(`[review] CLASSIFIED ${documentId}: ${classified.length} clauses matched out of ${playbookCategories.length} categories`);
    t.mark(`clause classification complete: ${classified.length}/${playbookCategories.length} categories matched`);

    // Deduplicate - keep highest-confidence chunk per category (merges across all sections)
    const bestByCategory = new Map<string, (typeof classified)[0]>();
    for (const item of classified) {
      const existing = bestByCategory.get(item.category);
      if (!existing || item.confidence > existing.confidence) {
        bestByCategory.set(item.category, item);
      }
    }

    // ── Type for in-memory clause results (used for post-processing) ─────────
    type LocalResult = {
      clauseCategory: string;
      ragStatus: string;
      comparisonStatement: string;
      clauseSummary: string;
      whyItMatters: string;
      recommendedAction: string;
      suggestedFallback: string;
      escalationRequired: boolean;
      escalationTrigger: string | null;
      businessSummary: string;
      confidenceLabel: string;
      regulatoryCitations: string; // JSON
      isAbsent: boolean;
      missingSeverity: "CRITICAL" | "OPTIONAL" | null;
      clauseId: string | null;
      ruleId: string | null;
      resultId: string | null; // PocketBase review_results record ID (set after persistResult)
      model_used: string;       // Which model produced this result
      founderStatus: string;
      founderPlainEnglish: string;
      founderBusinessImpact: string;
      founderAskFor: string;
      founderCopyPaste: string;
      founderFundraisingRelevance: string;
      founderIfIgnored: string;
      iracIssue: string;
      iracRule: string;
      iracApplication: string;
      iracConclusion: string;
      urgencyLevel: string;
      errorCategory: string;
    };

    // ── Shared state for streaming progress ───────────────────────────────────
    // clausesCompleted is incremented atomically (Node.js is single-threaded,
    // so ++ on a local var cannot race between async continuations).
    let clausesCompleted = 0;
    const results: LocalResult[] = []; // kept for post-processing after all comparisons finish

    // Set COMPARING status + total clause count so the frontend can show progress.
    // clausesCompleted starts at 0 and is bumped each time a result lands in PB.
    await pb.collection("uploaded_documents").update(documentId, {
      status: "COMPARING",
      clausesTotal: playbookRules.length,
      clausesCompleted: 0,
    });

    // Helper: write one result record to PocketBase immediately and bump progress.
    // This is the "streaming" mechanism: the frontend polls and sees results as
    // they arrive rather than waiting for the full batch to finish.
    // Returns the newly created record ID so low-confidence Opus reanalysis can update it.
    const persistResult = async (r: LocalResult): Promise<string> => {
      const record = await pb.collection("review_results").create({
        document: documentId,
        clause: r.clauseId ?? undefined,
        rule: r.ruleId ?? undefined,
        clauseCategory: r.clauseCategory,
        ragStatus: r.ragStatus || "GREY",
        comparisonStatement: r.comparisonStatement ?? "",
        clauseSummary: r.clauseSummary ?? "",
        whyItMatters: r.whyItMatters ?? "",
        recommendedAction: r.recommendedAction ?? "",
        suggestedFallback: r.suggestedFallback ?? "",
        escalationRequired: r.escalationRequired,
        escalationTrigger: r.escalationTrigger ?? "",
        businessSummary: r.businessSummary ?? "",
        confidenceLabel: r.confidenceLabel ?? "",
        regulatoryCitations: r.regulatoryCitations ?? "[]",
        isAbsent: r.isAbsent,
        missingSeverity: r.missingSeverity ?? "",
        model_used: r.model_used ?? "",
        founderStatus: r.founderStatus ?? "",
        founderPlainEnglish: r.founderPlainEnglish ?? "",
        founderBusinessImpact: r.founderBusinessImpact ?? "",
        founderAskFor: r.founderAskFor ?? "",
        founderCopyPaste: r.founderCopyPaste ?? "",
        founderFundraisingRelevance: r.founderFundraisingRelevance ?? "",
        founderIfIgnored: r.founderIfIgnored ?? "",
        iracIssue: r.iracIssue ?? "",
        iracRule: r.iracRule ?? "",
        iracApplication: r.iracApplication ?? "",
        iracConclusion: r.iracConclusion ?? "",
        urgencyLevel: r.urgencyLevel ?? "BACKGROUND",
        errorCategory: r.errorCategory ?? "SUBSTANTIVE_RISK",
      }).catch((err: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        console.error(`[review] review_results.create FAILED for ${documentId}/${r.clauseCategory}:`, (err as any)?.message, JSON.stringify((err as any)?.response));
        throw err;
      });

      // Increment and push progress update: fire-and-forget so it never
      // blocks the LLM call pipeline. Out-of-order arrival is fine; the client
      // uses reviewResults.length as the authoritative completed count.
      clausesCompleted++;
      pb.collection("uploaded_documents").update(documentId, { clausesCompleted }).catch(() => {});

      return record.id as string;
    }

    // ── PARALLEL clause comparisons ───────────────────────────────────────────
    // All rules fire simultaneously. Each absent clause (no LLM call) completes
    // instantly; each present clause fires an independent LLM request. The total
    // wall-clock time is roughly the slowest single LLM call, not the sum of all.
    //
    // Promise.allSettled is used so that a single failing comparison doesn't abort
    // the rest. Failed clauses are logged and skipped.
    const deAnon = <T extends string | null | undefined>(s: T): T =>
      (s ? deanonymise(s, entityMap) : s) as T;

    const docGoverningLaw = doc["governingLaw"] as string | undefined;
    const docJurisdiction = doc["jurisdiction"] as string | undefined;
    const govLawSuffix = docGoverningLaw
      ? `\n\nContract governing law: ${docGoverningLaw}${docJurisdiction ? ` (jurisdiction: ${docJurisdiction})` : ""}. Apply the law of this jurisdiction when assessing the clause.`
      : "";

    // Build clause comparison tasks, wrapped as thunks so the concurrency limiter controls launch order
    const clauseTasks = playbookRules.map((rule) => async () => {
        const category = rule["clauseCategory"] as string;
        const match = bestByCategory.get(category);

        if (!match) {
          // ── Absent clause: check if absence is favourable before flagging missing ─
          const persona = (company["persona"] ?? "CORPORATE") as "CORPORATE" | "FOUNDER";
          const absent = FAVOURABLE_WHEN_ABSENT.has(category)
            ? buildFavourableAbsentResult(category, rule as any, persona)
            : buildAbsentClauseResult(
                category,
                rule as any,
                persona,
                (doc["contractType"] as string) ?? "",
                effectiveCompanyName
              );

          // Favourable-absent clauses get GREEN + no missingSeverity
          const isFavourableAbsent = FAVOURABLE_WHEN_ABSENT.has(category);
          const missingSeverity = isFavourableAbsent
            ? null
            : computeMissingSeverity(category, (doc["contractType"] as string) ?? "");
          const r: LocalResult = {
            clauseCategory: category,
            ...absent,
            regulatoryCitations: JSON.stringify(absent.regulatoryCitations),
            escalationTrigger: absent.escalationTrigger || null,
            isAbsent: !isFavourableAbsent,
            missingSeverity,
            clauseId: null,
            ruleId: rule.id,
            resultId: null,
            model_used: "none", // absent clauses need no LLM call
            founderStatus: absent.founderStatus,
            founderPlainEnglish: absent.founderPlainEnglish,
            founderBusinessImpact: absent.founderBusinessImpact,
            founderAskFor: absent.founderAskFor,
            founderCopyPaste: absent.founderCopyPaste,
            founderFundraisingRelevance: absent.founderFundraisingRelevance,
            founderIfIgnored: absent.founderIfIgnored,
            iracIssue: absent.iracIssue ?? "",
            iracRule: absent.iracRule ?? "",
            iracApplication: absent.iracApplication ?? "",
            iracConclusion: absent.iracConclusion ?? "",
            urgencyLevel: absent.urgencyLevel ?? "BACKGROUND",
            errorCategory: absent.errorCategory ?? "SUBSTANTIVE_RISK",
          };
          r.resultId = await persistResult(r);
          results.push(r);
          return;
        }

        // ── Present clause: LLM comparison ──────────────────────────────────
        // Run the PocketBase write (extracted_clauses) and the regulatory context
        // lookup in parallel, neither depends on the other, and both must complete
        // before the LLM comparison call can use their results.
        const isIndirect = match.presenceState === "INDIRECT";
        if (isIndirect) {
          console.log(`[review] INDIRECT match for ${category} at "${match.clauseReference ?? "unknown location"}" in ${documentId}`);
        }
        t.mark(`${category}: starting PB write + reg context fetch in parallel`);
        const [extractedClause, clauseRegDocs] = await Promise.all([
          pb.collection("extracted_clauses").create({
            document: documentId,
            clauseCategory: category,
            rawText: deanonymise(match.rawText, entityMap),
            confidence: match.confidence,
          }).catch((err: unknown) => {
            console.error(`[review] extracted_clauses.create FAILED for ${documentId}/${category}:`, (err as any)?.message, JSON.stringify((err as any)?.response));
            throw err;
          }),
          getRegulatoryContext({
            clauseCategory: category,
            jurisdiction: company["jurisdiction"] as string,
            sector: company["sector"] as string,
          }),
        ]);
        const combinedRegContext = regulatoryContext + formatRegulatoryContextForPrompt(clauseRegDocs);

        const sonnetModel = getModelForTask("playbook_comparison");
        t.mark(`${category}: LLM comparison starting (${getModelLabel(sonnetModel)})`);
        const comparison = await compareClauseToPlaybook(
          match.rawText,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rule as any,
          effectiveCompanyName,
          company["sector"] as string,
          combinedRegContext + govLawSuffix,
          (company["persona"] ?? "CORPORATE") as "CORPORATE" | "FOUNDER",
          effectiveWorkflow,
          company.id,
          doc["counterpartyType"] as string || "",
          doc["contractType"] as string || "",
          isIndirect,
          match.clauseReference ?? "",
          sonnetModel,
        );

        // ── Fix 1: Guard against GREY or empty fields from the LLM ─────────────
        // If the LLM returns GREY (which it should never do for a present clause)
        // or any critical display field is empty, fill from the absent template
        // and force AMBER so the card renders with meaningful content.
        const hasMissingFields = !comparison.clauseSummary || !comparison.whyItMatters || !comparison.recommendedAction;
        if (comparison.ragStatus === "GREY" || hasMissingFields) {
          console.warn(`[review] LLM returned GREY or empty fields for present clause ${category} in ${documentId}. Backfilling from absent template.`);
          const fallback = buildAbsentClauseResult(
            category, rule as any,
            (company["persona"] ?? "CORPORATE") as "CORPORATE" | "FOUNDER",
            (doc["contractType"] as string) ?? "",
            effectiveCompanyName
          );
          if (comparison.ragStatus === "GREY") (comparison as { ragStatus: string }).ragStatus = "AMBER";
          if (!comparison.clauseSummary)     (comparison as { clauseSummary: string }).clauseSummary = fallback.clauseSummary;
          if (!comparison.whyItMatters)      (comparison as { whyItMatters: string }).whyItMatters = fallback.whyItMatters;
          if (!comparison.recommendedAction) (comparison as { recommendedAction: string }).recommendedAction = fallback.recommendedAction;
          if (!comparison.businessSummary)   (comparison as { businessSummary: string }).businessSummary = fallback.businessSummary;
        }

        console.log(`[review] compared ${category}: ${comparison.ragStatus} (${comparison.confidenceLabel})`);
        t.mark(`${category}: LLM comparison complete, ragStatus=${comparison.ragStatus}`);

        // De-anonymise LLM output fields before persisting.
        const deanonComparison = {
          ...comparison,
          clauseSummary:               deAnon(comparison.clauseSummary),
          whyItMatters:                deAnon(comparison.whyItMatters),
          recommendedAction:           deAnon(comparison.recommendedAction),
          suggestedFallback:           deAnon(comparison.suggestedFallback),
          escalationTrigger:           deAnon(comparison.escalationTrigger),
          businessSummary:             deAnon(comparison.businessSummary),
          founderPlainEnglish:         deAnon(comparison.founderPlainEnglish),
          founderBusinessImpact:       deAnon(comparison.founderBusinessImpact),
          founderAskFor:               deAnon(comparison.founderAskFor),
          founderCopyPaste:            deAnon(comparison.founderCopyPaste),
          founderFundraisingRelevance: deAnon(comparison.founderFundraisingRelevance),
          founderIfIgnored:            deAnon(comparison.founderIfIgnored),
          iracIssue:                   deAnon(comparison.iracIssue),
          iracRule:                    deAnon(comparison.iracRule),
          iracApplication:             deAnon(comparison.iracApplication),
          iracConclusion:              deAnon(comparison.iracConclusion),
        };

        void audit({
          action: "rag_status_assigned",
          entityType: "review_result",
          entityId: extractedClause.id,
          companyId: company.id,
          detail: { documentId, clauseCategory: category, ragStatus: deanonComparison.ragStatus, confidenceLabel: deanonComparison.confidenceLabel, escalationRequired: deanonComparison.escalationRequired },
        });

        // ── Three-tier governance escalation ─────────────────────────────────
        const tier2Approver = getValueTierApprover();
        const tier3Approver = getGovernanceTriggerApprover(category);
        const combinedEscalation = deanonComparison.escalationRequired || !!tier2Approver || !!tier3Approver;
        const extraTriggers: string[] = [];
        if (tier2Approver) extraTriggers.push(`Contract value threshold: ${tier2Approver} approval required.`);
        if (tier3Approver) extraTriggers.push(`Governance trigger: ${category.replace(/_/g, " ")} always requires ${tier3Approver} sign-off.`);
        const combinedTrigger = [deanonComparison.escalationTrigger || null, ...extraTriggers].filter(Boolean).join(" | ") || null;

        const r: LocalResult = {
          clauseCategory: category,
          ...deanonComparison,
          escalationRequired: combinedEscalation,
          escalationTrigger: combinedTrigger,
          regulatoryCitations: JSON.stringify(deanonComparison.regulatoryCitations ?? []),
          isAbsent: false,
          missingSeverity: null,
          clauseId: extractedClause.id,
          ruleId: rule.id,
          resultId: null,
          model_used: sonnetModel,
          founderStatus: deanonComparison.founderStatus,
          founderPlainEnglish: deanonComparison.founderPlainEnglish,
          founderBusinessImpact: deanonComparison.founderBusinessImpact,
          founderAskFor: deanonComparison.founderAskFor,
          founderCopyPaste: deanonComparison.founderCopyPaste,
          founderFundraisingRelevance: deanonComparison.founderFundraisingRelevance,
          founderIfIgnored: deanonComparison.founderIfIgnored,
          iracIssue: deAnon(deanonComparison.iracIssue) ?? "",
          iracRule: deAnon(deanonComparison.iracRule) ?? "",
          iracApplication: deAnon(deanonComparison.iracApplication) ?? "",
          iracConclusion: deAnon(deanonComparison.iracConclusion) ?? "",
          urgencyLevel: deanonComparison.urgencyLevel ?? "BACKGROUND",
          errorCategory: deanonComparison.errorCategory ?? "SUBSTANTIVE_RISK",
        };

        // Write to PocketBase immediately. The frontend poll picks this up within 3s.
        r.resultId = await persistResult(r);
        results.push(r);
    });

    // Run at most MAX_CONCURRENT_COMPARISONS clause LLM calls simultaneously.
    // This prevents overwhelming the upstream API with 10+ requests at once.
    const settled = await runWithConcurrencyLimit(clauseTasks, MAX_CONCURRENT_COMPARISONS);

    // Log any individual clause failures (they don't abort the review).
    const clauseFailures = settled.filter((s) => s.status === "rejected");
    if (clauseFailures.length > 0) {
      console.error(`[review] ${clauseFailures.length} clause(s) failed during parallel comparison:`,
        clauseFailures.map((s) => (s as PromiseRejectedResult).reason?.message ?? s));
    }
    t.mark(`playbook comparison complete: ${results.length} clauses (${clauseFailures.length} failed)`);

    // ── Confidence-based Opus reanalysis ──────────────────────────────────────
    // Any clause where Claude Sonnet returned LOW confidence gets a second pass
    // from Claude Opus for deeper reasoning. High-confidence clauses skip Opus.
    const opusModel = getModelForTask("low_confidence_reanalysis");
    const lowConfidenceResults = results.filter((r) => !r.isAbsent && r.confidenceLabel === "LOW" && r.resultId);
    if (lowConfidenceResults.length > 0) {
      console.log(`[review] ${lowConfidenceResults.length} low-confidence clause(s) flagged for Opus reanalysis: ${lowConfidenceResults.map((r) => r.clauseCategory).join(", ")}`);
      t.mark(`starting Opus reanalysis for ${lowConfidenceResults.length} low-confidence clauses`);

      const reanalysisTasks = lowConfidenceResults.map((r) => async () => {
        const rule = playbookRules.find((pr) => pr.id === r.ruleId);
        if (!rule) return;
        const match = bestByCategory.get(r.clauseCategory);
        if (!match) return;
        try {
          const clauseRegDocs = await getRegulatoryContext({
            clauseCategory: r.clauseCategory,
            jurisdiction: company["jurisdiction"] as string,
            sector: company["sector"] as string,
          });
          const combinedRegContext = regulatoryContext + formatRegulatoryContextForPrompt(clauseRegDocs);
          const opusComparison = await compareClauseToPlaybook(
            match.rawText,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rule as any,
            effectiveCompanyName,
            company["sector"] as string,
            combinedRegContext + govLawSuffix,
            (company["persona"] ?? "CORPORATE") as "CORPORATE" | "FOUNDER",
            effectiveWorkflow,
            company.id,
            doc["counterpartyType"] as string || "",
            doc["contractType"] as string || "",
            false,
            "",
            opusModel,
          );
          const deanonOpus = {
            ...opusComparison,
            clauseSummary:     deAnon(opusComparison.clauseSummary),
            whyItMatters:      deAnon(opusComparison.whyItMatters),
            recommendedAction: deAnon(opusComparison.recommendedAction),
            suggestedFallback: deAnon(opusComparison.suggestedFallback),
            escalationTrigger: deAnon(opusComparison.escalationTrigger),
            businessSummary:   deAnon(opusComparison.businessSummary),
          };
          // Update PocketBase record in place
          await pb.collection("review_results").update(r.resultId!, {
            ragStatus:          deanonOpus.ragStatus || r.ragStatus,
            clauseSummary:      deanonOpus.clauseSummary || r.clauseSummary,
            whyItMatters:       deanonOpus.whyItMatters || r.whyItMatters,
            recommendedAction:  deanonOpus.recommendedAction || r.recommendedAction,
            suggestedFallback:  deanonOpus.suggestedFallback || r.suggestedFallback,
            escalationRequired: deanonOpus.escalationRequired,
            escalationTrigger:  deanonOpus.escalationTrigger || r.escalationTrigger,
            businessSummary:    deanonOpus.businessSummary || r.businessSummary,
            confidenceLabel:    deanonOpus.confidenceLabel,
            model_used:         opusModel,
          }).catch((e: unknown) => console.warn(`[review] Opus update failed for ${r.clauseCategory}:`, (e as Error)?.message));
          // Update in-memory result
          Object.assign(r, deanonOpus, { model_used: opusModel });
          console.log(`[review] Opus reanalysis ${r.clauseCategory}: ${deanonOpus.ragStatus} (was ${r.ragStatus}), confidence=${deanonOpus.confidenceLabel}`);
          t.mark(`Opus reanalysis complete: ${r.clauseCategory}`);
        } catch (err) {
          console.warn(`[review] Opus reanalysis failed for ${r.clauseCategory} (non-fatal):`, (err as Error)?.message);
        }
      });

      // Run Opus reanalyses with limited concurrency (max 3 at once — Opus is slow)
      await runWithConcurrencyLimit(reanalysisTasks, 3);
      t.mark(`Opus reanalysis batch complete: ${lowConfidenceResults.length} clauses processed`);
    }

    // ── Contradiction detection + document audit run in PARALLEL ──────────────
    // Both are independent post-processing LLM passes, neither depends on the
    // other, so they run simultaneously. This saves 10-15s vs. running them one
    // after the other.
    //
    // Contradiction detection (second LLM pass) ──────────────────────────────
    // Build a map of category → clause summary for the detector.
    const clauseTextMap = new Map<string, string>();
    for (const r of results) {
      if (!r.isAbsent && r.clauseSummary) {
        clauseTextMap.set(r.clauseCategory, r.clauseSummary);
      }
    }

    let contradictions: unknown[] = [];

    const runContradictions = async () => {
      if (clauseTextMap.size < 2) return;
      try {
        const findings = await detectContradictions(
          clauseTextMap,
          effectiveCompanyName,
          effectiveWorkflow
        );
        contradictions = findings;
        t.mark(`contradiction detection complete: ${findings.length} findings`);
        if (findings.length > 0) {
          void audit({
            action: "contradiction_detected",
            entityType: "uploaded_document",
            entityId: documentId,
            companyId: company.id,
            detail: { count: findings.length, findings: findings.map((f) => f.title) },
          });
          await pb.collection("uploaded_documents").update(documentId, {
            contradictions: JSON.stringify(findings),
          }).catch((e: unknown) => {
            console.warn("[review] Could not persist contradictions (non-fatal):", (e as Error)?.message);
          });
        }
      } catch (err) {
        console.error("[contradiction detection] failed (non-fatal):", err);
        t.mark("contradiction detection: failed (non-fatal)");
      }
    };

    // ── Multi-pass document audit (passes 2-5) ─────────────────────────────────
    // Runs in parallel with contradiction detection. All 4 internal audit passes
    // already run in parallel inside runDocumentAudit().
    console.log(`[review] AUDITING ${documentId}: running document audit passes 2-5`);
    const runAudit = async () => {
      try {
        const auditResult = await runDocumentAudit(
          rawText,
          effectiveCompanyName,
          (doc["contractType"] as string) ?? "COMMERCIAL_CONTRACT"
        );
        console.log(`[review] AUDIT ${documentId}: ${auditResult.totalFindings} findings (${auditResult.highSeverityCount} high severity)`);
        t.mark(`document audit complete: ${auditResult.totalFindings} findings (${auditResult.highSeverityCount} high)`);
        await pb.collection("uploaded_documents").update(documentId, {
          auditFindings: JSON.stringify(auditResult),
        }).catch((e: unknown) => {
          console.warn("[review] Could not persist audit findings (non-fatal):", (e as Error)?.message);
        });
      } catch (err) {
        console.error("[review] Document audit failed (non-fatal):", (err as Error)?.message);
        t.mark("document audit: failed (non-fatal)");
      }
    };

    // ── NHS Standard Contract schedule checklist (healthcare only) ───────────────
    // Runs when the contract type indicates an NHS Standard Contract. Checks for
    // required schedules and flags any missing from the document text.
    const runNhsScheduleCheck = async () => {
      const rawContractType = ((doc["contractType"] as string) ?? "").toUpperCase();
      const isNhsContract = rawContractType.includes("NHS") || rawContractType === "CLINICAL_SERVICES";
      if (!isNhsContract || effectiveWorkflow !== "HEALTHCARE_PROCUREMENT") return;
      try {
        const { chatComplete } = await import("./openrouter.js");
        const nhsModel = getModelForTask("clause_extraction");
        const snippet = rawText.slice(0, 40000);
        const nhsPrompt = `You are reviewing an NHS contract. Check whether the following standard NHS contract schedules appear in this document. For each schedule, state PRESENT or ABSENT. Return valid JSON only.

Schedules to check:
- Schedule 2N: NHS Targets and Indicators
- Schedule 2O: Quality Requirements
- Schedule 2P: Incentive Schemes
- Schedule 4: Regulated Activities
- Schedule 6: Data Processing
- Schedule 7: Transfer of and Access to Information
- Schedule 8: Information Requirements
- Schedule 9: Compliance with NHS Standards

Also check:
- General Condition 18 (termination provisions) - is it present and unmodified?
- General Condition 36 (payment terms) - is it present and unmodified?

Return JSON: { "schedules": [ { "name": "...", "status": "PRESENT" | "ABSENT" | "MODIFIED", "note": "..." } ], "gc18Present": true/false, "gc36Present": true/false }

Document text (truncated):
${snippet}`;
        const nhsResponse = await chatComplete(
          [{ role: "user", content: nhsPrompt }],
          2000,
          90_000,
          nhsModel,
        );
        const jsonMatch = nhsResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const nhsCheck = JSON.parse(jsonMatch[0]) as unknown;
          await pb.collection("uploaded_documents").update(documentId, {
            nhsScheduleCheck: JSON.stringify(nhsCheck),
          }).catch((e: unknown) => console.warn("[review] Could not persist NHS schedule check:", (e as Error)?.message));
          console.log(`[review] NHS schedule check complete for ${documentId}`);
          t.mark("NHS schedule checklist complete");
        }
      } catch (err) {
        console.error("[review] NHS schedule check failed (non-fatal):", (err as Error)?.message);
        t.mark("NHS schedule check: failed (non-fatal)");
      }
    };

    // Fire all post-processing passes simultaneously
    await Promise.all([runContradictions(), runAudit(), runNhsScheduleCheck()]);

    // If the hard timeout fired while we were running, do not override the FAILED status
    // that the timeout handler already wrote. Simply return without setting COMPLETE.
    if (isTimedOut()) {
      console.warn(`[review] ${documentId}: timeout detected before COMPLETE, skipping status update`);
      return;
    }

    // NOTE: individual review_results records are already persisted inline above
    // (streaming). No batch write needed here.

    await pb.collection("uploaded_documents").update(documentId, { status: "COMPLETE" });

    t.mark("COMPLETE: total pipeline time");

    console.log(`[review] COMPLETE ${documentId}: ${results.length} clauses (RED=${results.filter((r) => r.ragStatus === "RED").length} AMBER=${results.filter((r) => r.ragStatus === "AMBER").length} GREEN=${results.filter((r) => r.ragStatus === "GREEN").length} GREY=${results.filter((r) => r.ragStatus === "GREY").length})`);

    const modelsUsed = Array.from(new Set(results.map((r) => r.model_used).filter(Boolean)));
    const opusClauseCount = results.filter((r) => r.model_used === getModelForTask("low_confidence_reanalysis")).length;
    void audit({
      action: "review_completed",
      entityType: "uploaded_document",
      entityId: documentId,
      companyId: company.id,
      detail: {
        totalClauses: results.length,
        redCount:   results.filter((r) => r.ragStatus === "RED").length,
        amberCount: results.filter((r) => r.ragStatus === "AMBER").length,
        greenCount: results.filter((r) => r.ragStatus === "GREEN").length,
        greyCount:  results.filter((r) => r.ragStatus === "GREY").length,
        escalations: results.filter((r) => r.escalationRequired).length,
        // Model routing audit
        modelsUsed,
        opusReanalysisCount: opusClauseCount,
        classificationModel: getModelLabel(flashModel),
        extractionModel:     getModelLabel(gpt4oModel),
        comparisonModel:     getModelLabel(getModelForTask("playbook_comparison")),
      },
    });

    // Persist outcome patterns - fire-and-forget
    persistOutcomePatterns(company.id).catch((err: unknown) => {
      console.error("[Zane] Outcome pattern persistence failed:", err);
    });

    // Send escalation emails - fire-and-forget, never block or fail the review
    const escalations = results.filter((r) => r.escalationRequired && r.ruleId);
    if (escalations.length > 0) {
      const contacts = await pb.collection("approval_contacts").getFullList({
        filter: `company = "${company.id}"`,
      });

      for (const esc of escalations) {
        const rule = playbookRules.find((r) => r.id === esc.ruleId);
        if (!rule?.["approvalRequired"]) continue;

        const contact = contacts.find((c) => c["role"] === rule["approvalRequired"]);
        if (!contact?.["email"] || !contact?.["name"]) continue;

        sendEscalationEmail({
          to:                { name: contact["name"] as string, email: contact["email"] as string },
          contractName:      doc["originalName"] as string,
          documentId,
          clauseLabel:       toTitleCase(esc.clauseCategory),
          ragStatus:         esc.ragStatus,
          escalationTrigger: esc.escalationTrigger ?? "Approval required per playbook rule.",
          recommendedAction: esc.recommendedAction,
          businessSummary:   esc.businessSummary,
          companyName:       effectiveCompanyName,
        }).catch((err: unknown) => {
          console.error(`[Zane] Escalation email failed for ${esc.clauseCategory}:`, err);
        });
      }
    }
  } catch (err) {
    const errMsg = (err as Error)?.message ?? String(err);
    console.error(`[review] FAILED ${documentId}: ${errMsg}`);
    // Best-effort status update: store lastError so the UI can surface it
    await pb.collection("uploaded_documents").update(documentId, {
      status: "FAILED",
      lastError: errMsg.slice(0, 2000),
    }).catch((e: unknown) =>
      console.error("[review] Could not set FAILED status:", (e as Error)?.message)
    );
    // company may be undefined if failure happened before company was loaded (line 82)
    if (company?.id) {
      void audit({
        action: "review_failed",
        entityType: "uploaded_document",
        entityId: documentId,
        companyId: company.id,
        detail: { error: errMsg },
      });
    }
    throw err;
  }
}
