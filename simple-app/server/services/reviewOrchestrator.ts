import path from "path";
import { pb } from "../pb.js";
import { parseDocument, chunkText } from "./documentParser.js";
import { classifyClauses } from "./clauseClassifier.js";
import {
  compareClauseToPlaybook,
  buildAbsentClauseResult,
} from "./playbookComparison.js";
import { detectContradictions } from "./contradictionDetector.js";
import { getRegulationSummaryForLLM } from "./regulatoryDetection.js";
import { getRegulatoryContext, formatRegulatoryContextForPrompt } from "./regulatoryEngine.js";
import { sendEscalationEmail } from "./emailService.js";
import { anonymise, deanonymise, buildKnownEntities } from "./piiAnonymiser.js";
import { audit } from "./auditLogger.js";
import { persistOutcomePatterns } from "./outcomeCapture.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

function toTitleCase(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function runReview(documentId: string): Promise<void> {
  // Load document, company, and playbook rules
  const doc = await pb.collection("uploaded_documents").getOne(documentId);
  const company = await pb.collection("companies").getOne(doc["company"] as string);
  const playbookRules = await pb.collection("playbook_rules").getFullList({
    filter: `company = "${company.id}"`,
  });

  // ── Load governance configuration (Tier 2 + Tier 3) ────────────────────────
  const [approvalThresholds, governanceTriggers] = await Promise.all([
    pb.collection("approval_thresholds").getFullList({ filter: `companyId = "${company.id}"`, sort: "+minValue" }).catch(() => []),
    pb.collection("governance_triggers").getFullList({ filter: `companyId = "${company.id}"` }).catch(() => []),
  ]);
  const contractValue = doc["contractValue"] as number | null;

  // Helper: Tier 2 — check if contract value triggers an approver
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

  // Helper: Tier 3 — check if a clause category is a governance trigger
  function getGovernanceTriggerApprover(category: string): string | null {
    const trigger = governanceTriggers.find((t) => t["clauseCategory"] === category);
    return trigger ? (trigger["escalateTo"] as string) : null;
  }

  await pb.collection("uploaded_documents").update(documentId, { status: "PROCESSING" });

  // Audit: review started
  await audit({
    action: "review_started",
    entityType: "uploaded_document",
    entityId: documentId,
    companyId: company.id,
    detail: { contractType: doc["contractType"], originalName: doc["originalName"] },
  });

  try {
    const filePath = path.join(process.cwd(), "uploads", doc["filename"] as string);
    const rawText = await parseDocument(filePath);

    // ── PII Anonymisation ────────────────────────────────────────────────────
    // Anonymise the raw contract text BEFORE it is sent to any external LLM.
    // We replace known party names first, then apply structural PII patterns.
    await audit({
      action: "pii_anonymisation_started",
      entityType: "uploaded_document",
      entityId: documentId,
      companyId: company.id,
    });

    const knownEntities = buildKnownEntities(
      company["name"] as string,
      doc["counterpartyName"] as string | undefined,
    );

    const { anonymisedText, entityMap, sessionId } = await anonymise(
      rawText,
      knownEntities,
      documentId
    );

    await audit({
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

    const chunks = chunkText(anonymisedText);

    // Derive active categories from the company's playbook rules
    const playbookCategories = Array.from(new Set(playbookRules.map((r) => r["clauseCategory"] as string)));
    const classified = await classifyClauses(chunks, company["workflowType"] as string, playbookCategories);

    // Deduplicate — keep highest-confidence chunk per category
    const bestByCategory = new Map<string, (typeof classified)[0]>();
    for (const item of classified) {
      const existing = bestByCategory.get(item.category);
      if (!existing || item.confidence > existing.confidence) {
        bestByCategory.set(item.category, item);
      }
    }

    // Fetch regulatory context once — injected into every clause comparison
    const regulatoryContext = await getRegulationSummaryForLLM(company.id);

    const results: Array<{
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
      clauseId: string | null;
      ruleId: string | null;
      // Founder fields
      founderStatus: string;
      founderPlainEnglish: string;
      founderBusinessImpact: string;
      founderAskFor: string;
      founderCopyPaste: string;
      founderFundraisingRelevance: string;
      founderIfIgnored: string;
    }> = [];

    for (const rule of playbookRules) {
      const category = rule["clauseCategory"] as string;
      const match = bestByCategory.get(category);

      if (!match) {
        // Clause absent from contract
        const absent = buildAbsentClauseResult(
          category,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rule as any,
          (company["persona"] ?? "CORPORATE") as "CORPORATE" | "FOUNDER"
        );
        results.push({
          clauseCategory: category,
          ...absent,
          regulatoryCitations: JSON.stringify(absent.regulatoryCitations),
          escalationTrigger: absent.escalationTrigger || null,
          isAbsent: true,
          clauseId: null,
          ruleId: rule.id,
          founderStatus: absent.founderStatus,
          founderPlainEnglish: absent.founderPlainEnglish,
          founderBusinessImpact: absent.founderBusinessImpact,
          founderAskFor: absent.founderAskFor,
          founderCopyPaste: absent.founderCopyPaste,
          founderFundraisingRelevance: absent.founderFundraisingRelevance,
          founderIfIgnored: absent.founderIfIgnored,
        });
        continue;
      }

      // Store extracted clause — de-anonymise rawText for user-facing display
      const extractedClause = await pb.collection("extracted_clauses").create({
        document: documentId,
        clauseCategory: category,
        rawText: deanonymise(match.rawText, entityMap),
        confidence: match.confidence,
      });

      // Fetch per-clause regulatory context from the regulatory engine
      const clauseRegDocs = await getRegulatoryContext({
        clauseCategory: category,
        jurisdiction: company["jurisdiction"] as string,
        sector: company["sector"] as string,
      });
      const clauseRegContext = formatRegulatoryContextForPrompt(clauseRegDocs);
      const combinedRegContext = regulatoryContext + clauseRegContext;

      // Compare against playbook with regulatory context
      // Note: match.rawText is already anonymised — company/counterparty names
      // are placeholders. The comparison result text is de-anonymised below.
      const docGoverningLaw = doc["governingLaw"] as string | undefined;
      const docJurisdiction = doc["jurisdiction"] as string | undefined;
      const govLawContext = docGoverningLaw
        ? `\n\nContract governing law: ${docGoverningLaw}${docJurisdiction ? ` (jurisdiction: ${docJurisdiction})` : ""}. Apply the law of this jurisdiction when assessing the clause.`
        : "";
      const comparison = await compareClauseToPlaybook(
        match.rawText,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rule as any,
        company["name"] as string,
        company["sector"] as string,
        combinedRegContext + govLawContext,
        (company["persona"] ?? "CORPORATE") as "CORPORATE" | "FOUNDER",
        doc["workflowType"] as string || "COMMERCIAL_CONTRACT",
        company.id,
        doc["counterpartyType"] as string || "",
        doc["contractType"] as string || ""
      );

      // ── De-anonymise LLM output fields ─────────────────────────────────────
      // Restore original party names / PII in user-facing text fields.
      const deAnon = <T extends string | null | undefined>(s: T): T =>
        (s ? deanonymise(s, entityMap) : s) as T;

      const deanonComparison = {
        ...comparison,
        clauseSummary:              deAnon(comparison.clauseSummary),
        whyItMatters:               deAnon(comparison.whyItMatters),
        recommendedAction:          deAnon(comparison.recommendedAction),
        suggestedFallback:          deAnon(comparison.suggestedFallback),
        escalationTrigger:          deAnon(comparison.escalationTrigger),
        businessSummary:            deAnon(comparison.businessSummary),
        founderPlainEnglish:        deAnon(comparison.founderPlainEnglish),
        founderBusinessImpact:      deAnon(comparison.founderBusinessImpact),
        founderAskFor:              deAnon(comparison.founderAskFor),
        founderCopyPaste:           deAnon(comparison.founderCopyPaste),
        founderFundraisingRelevance: deAnon(comparison.founderFundraisingRelevance),
        founderIfIgnored:           deAnon(comparison.founderIfIgnored),
      };
      // ───────────────────────────────────────────────────────────────────────

      // Audit: RAG status assigned
      await audit({
        action: "rag_status_assigned",
        entityType: "review_result",
        entityId: extractedClause.id,
        companyId: company.id,
        detail: {
          documentId,
          clauseCategory: category,
          ragStatus: deanonComparison.ragStatus,
          confidenceLabel: deanonComparison.confidenceLabel,
          escalationRequired: deanonComparison.escalationRequired,
        },
      });

      // ── Three-tier governance escalation ───────────────────────────────────
      // Tier 1: clause-level RAG (from LLM comparison — already in deanonComparison)
      // Tier 2: contract value band (from approval_thresholds)
      // Tier 3: governance triggers (from governance_triggers — always escalate)
      const tier2Approver = getValueTierApprover();
      const tier3Approver = getGovernanceTriggerApprover(category);

      const tier2Escalation = !!tier2Approver;
      const tier3Escalation = !!tier3Approver;
      const combinedEscalation = deanonComparison.escalationRequired || tier2Escalation || tier3Escalation;

      let combinedTrigger = deanonComparison.escalationTrigger || null;
      const extraTriggers: string[] = [];
      if (tier2Escalation && tier2Approver) extraTriggers.push(`Contract value threshold: ${tier2Approver} approval required.`);
      if (tier3Escalation && tier3Approver) extraTriggers.push(`Governance trigger: ${category.replace(/_/g, " ")} always requires ${tier3Approver} sign-off.`);
      if (extraTriggers.length > 0) {
        combinedTrigger = [combinedTrigger, ...extraTriggers].filter(Boolean).join(" | ");
      }

      results.push({
        clauseCategory: category,
        ...deanonComparison,
        escalationRequired: combinedEscalation,
        escalationTrigger: combinedTrigger,
        regulatoryCitations: JSON.stringify(deanonComparison.regulatoryCitations ?? []),
        isAbsent: false,
        clauseId: extractedClause.id,
        ruleId: rule.id,
        founderStatus: deanonComparison.founderStatus,
        founderPlainEnglish: deanonComparison.founderPlainEnglish,
        founderBusinessImpact: deanonComparison.founderBusinessImpact,
        founderAskFor: deanonComparison.founderAskFor,
        founderCopyPaste: deanonComparison.founderCopyPaste,
        founderFundraisingRelevance: deanonComparison.founderFundraisingRelevance,
        founderIfIgnored: deanonComparison.founderIfIgnored,
      });
    }

    // ── Contradiction detection (second LLM pass) ──────────────────────────────
    // Build a map of category → de-anonymised clause text for the detector
    const clauseTextMap = new Map<string, string>();
    for (const r of results) {
      if (!r.isAbsent && r.clauseSummary) {
        clauseTextMap.set(r.clauseCategory, r.clauseSummary);
      }
    }

    let contradictions: unknown[] = [];
    if (clauseTextMap.size >= 2) {
      try {
        const findings = await detectContradictions(
          clauseTextMap,
          company["name"] as string,
          company["workflowType"] as string
        );
        contradictions = findings;
        if (findings.length > 0) {
          await audit({
            action: "contradiction_detected",
            entityType: "uploaded_document",
            entityId: documentId,
            companyId: company.id,
            detail: { count: findings.length, findings: findings.map((f) => f.title) },
          });
        }
      } catch (err) {
        console.error("[contradiction detection] failed (non-fatal):", err);
      }
    }

    // Persist contradictions on the document record
    if (contradictions.length > 0) {
      await pb.collection("uploaded_documents").update(documentId, {
        contradictions: JSON.stringify(contradictions),
      });
    }

    // Persist all review results
    await Promise.all(
      results.map((r) =>
        pb.collection("review_results").create({
          document: documentId,
          clause: r.clauseId,
          rule: r.ruleId,
          clauseCategory: r.clauseCategory,
          ragStatus: r.ragStatus,
          comparisonStatement: r.comparisonStatement,
          clauseSummary: r.clauseSummary,
          whyItMatters: r.whyItMatters,
          recommendedAction: r.recommendedAction,
          suggestedFallback: r.suggestedFallback,
          escalationRequired: r.escalationRequired,
          escalationTrigger: r.escalationTrigger,
          businessSummary: r.businessSummary,
          confidenceLabel: r.confidenceLabel,
          regulatoryCitations: r.regulatoryCitations,
          isAbsent: r.isAbsent,
          founderStatus: r.founderStatus,
          founderPlainEnglish: r.founderPlainEnglish,
          founderBusinessImpact: r.founderBusinessImpact,
          founderAskFor: r.founderAskFor,
          founderCopyPaste: r.founderCopyPaste,
          founderFundraisingRelevance: r.founderFundraisingRelevance,
          founderIfIgnored: r.founderIfIgnored,
        })
      )
    );

    await pb.collection("uploaded_documents").update(documentId, { status: "COMPLETE" });

    await audit({
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
      },
    });

    // Persist outcome patterns — fire-and-forget
    persistOutcomePatterns(company.id).catch((err: unknown) => {
      console.error("[Zane] Outcome pattern persistence failed:", err);
    });

    // Send escalation emails — fire-and-forget, never block or fail the review
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
          companyName:       company["name"] as string,
        }).catch((err: unknown) => {
          console.error(`[Zane] Escalation email failed for ${esc.clauseCategory}:`, err);
        });
      }
    }
  } catch (err) {
    await pb.collection("uploaded_documents").update(documentId, { status: "FAILED" });
    await audit({
      action: "review_failed",
      entityType: "uploaded_document",
      entityId: documentId,
      companyId: company.id,
      detail: { error: (err as Error)?.message ?? String(err) },
    });
    throw err;
  }
}
