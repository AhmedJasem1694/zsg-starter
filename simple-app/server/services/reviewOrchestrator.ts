import path from "path";
import { prisma } from "../db.js";
import { parseDocument, chunkText } from "./documentParser.js";
import { classifyClauses, CLAUSE_CATEGORIES } from "./clauseClassifier.js";
import {
  compareClauseToPlaybook,
  buildAbsentClauseResult,
} from "./playbookComparison.js";
import { getRegulationSummaryForLLM } from "./regulatoryDetection.js";

export async function runReview(documentId: string): Promise<void> {
  const doc = await prisma.uploadedDocument.findUniqueOrThrow({
    where: { id: documentId },
    include: { company: { include: { playbookRules: true } } },
  });

  await prisma.uploadedDocument.update({
    where: { id: documentId },
    data: { status: "PROCESSING" },
  });

  try {
    const filePath = path.join(process.cwd(), "uploads", doc.filename);
    const rawText = await parseDocument(filePath);
    const chunks = chunkText(rawText);

    // Classify all chunks into clause categories
    const classified = await classifyClauses(chunks);

    // Deduplicate — keep highest-confidence chunk per category
    const bestByCategory = new Map<string, (typeof classified)[0]>();
    for (const item of classified) {
      const existing = bestByCategory.get(item.category);
      if (!existing || item.confidence > existing.confidence) {
        bestByCategory.set(item.category, item);
      }
    }

    const company = doc.company;

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

    for (const category of CLAUSE_CATEGORIES) {
      const rule = company.playbookRules.find(
        (r) => r.clauseCategory === category
      );
      if (!rule) continue; // No playbook rule for this category — skip

      const match = bestByCategory.get(category);

      if (!match) {
        // Clause absent from contract
        const absent = buildAbsentClauseResult(category, rule);
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
      const extractedClause = await prisma.extractedClause.create({
        data: {
          documentId,
          clauseCategory: category,
          rawText: match.rawText,
          confidence: match.confidence,
        },
      });

      // Compare against playbook with regulatory context
      const comparison = await compareClauseToPlaybook(
        match.rawText,
        rule,
        company.name,
        company.sector,
        regulatoryContext
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
    await prisma.reviewResult.createMany({
      data: results.map((r) => ({
        documentId,
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
        clauseId: r.clauseId,
        ruleId: r.ruleId,
      })),
    });

    await prisma.uploadedDocument.update({
      where: { id: documentId },
      data: { status: "COMPLETE" },
    });
  } catch (err) {
    await prisma.uploadedDocument.update({
      where: { id: documentId },
      data: { status: "FAILED" },
    });
    throw err;
  }
}
