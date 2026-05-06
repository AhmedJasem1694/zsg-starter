import path from "path";
import { pb } from "../pb.js";
import { parseDocument, chunkText } from "./documentParser.js";
import { classifyClauses } from "./clauseClassifier.js";
import {
  compareClauseToPlaybook,
  buildAbsentClauseResult,
} from "./playbookComparison.js";
import { getRegulationSummaryForLLM } from "./regulatoryDetection.js";
import { getRegulatoryContext, formatRegulatoryContextForPrompt } from "./regulatoryEngine.js";
import { sendEscalationEmail } from "./emailService.js";

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

  await pb.collection("uploaded_documents").update(documentId, { status: "PROCESSING" });

  try {
    const filePath = path.join(process.cwd(), "uploads", doc["filename"] as string);
    const rawText = await parseDocument(filePath);
    const chunks = chunkText(rawText);

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
      clauseSummary: string;
      whyItMatters: string;
      recommendedAction: string;
      suggestedFallback: string;
      escalationRequired: boolean;
      escalationTrigger: string | null;
      businessSummary: string;
      confidence: number;
      isAbsent: boolean;
      clauseId: string | null;
      ruleId: string | null;
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
          (company["persona"] ?? "CORPORATE") as "CORPORATE" | "FOUNDER" | "PE_FUND"
        );
        results.push({
          clauseCategory: category,
          ...absent,
          escalationTrigger: absent.escalationTrigger || null,
          isAbsent: true,
          clauseId: null,
          ruleId: rule.id,
        });
        continue;
      }

      // Store extracted clause
      const extractedClause = await pb.collection("extracted_clauses").create({
        document: documentId,
        clauseCategory: category,
        rawText: match.rawText,
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
      const comparison = await compareClauseToPlaybook(
        match.rawText,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rule as any,
        company["name"] as string,
        company["sector"] as string,
        combinedRegContext,
        (company["persona"] ?? "CORPORATE") as "CORPORATE" | "FOUNDER" | "PE_FUND"
      );

      results.push({
        clauseCategory: category,
        ...comparison,
        escalationTrigger: comparison.escalationTrigger || null,
        isAbsent: false,
        clauseId: extractedClause.id,
        ruleId: rule.id,
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
          clauseSummary: r.clauseSummary,
          whyItMatters: r.whyItMatters,
          recommendedAction: r.recommendedAction,
          suggestedFallback: r.suggestedFallback,
          escalationRequired: r.escalationRequired,
          escalationTrigger: r.escalationTrigger,
          businessSummary: r.businessSummary,
          confidence: r.confidence,
          isAbsent: r.isAbsent,
        })
      )
    );

    await pb.collection("uploaded_documents").update(documentId, { status: "COMPLETE" });

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
          console.error(`[MIKE] Escalation email failed for ${esc.clauseCategory}:`, err);
        });
      }
    }
  } catch (err) {
    await pb.collection("uploaded_documents").update(documentId, { status: "FAILED" });
    throw err;
  }
}
