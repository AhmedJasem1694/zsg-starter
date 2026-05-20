/**
 * Integration Processor
 *
 * Shared logic called by both Google Drive and SharePoint after a file
 * is downloaded and an UploadedDocument record created.
 *
 * 1. Pattern match against prior contracts from the same company
 * 2. Update sync log
 * 3. Trigger review pipeline
 */

import { pb } from "../pb.js";
import { runReview } from "./reviewOrchestrator.js";
import { audit } from "./auditLogger.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

// ── Pattern matching ──────────────────────────────────────────────────────────

export async function findPatternMatch(
  companyId: string,
  newDocId: string
): Promise<{ matchedDocumentId: string; summary: string } | null> {
  try {
    const newDoc = await pb
      .collection("uploaded_documents")
      .getOne(newDocId) as PBRecord;

    const newName = ((newDoc["originalName"] as string) ?? "").toLowerCase();
    const newCounterparty = (
      (newDoc["counterpartyName"] as string) ?? ""
    ).toLowerCase().trim();

    // Get recent review results for the same company
    const recentResults = await pb
      .collection("review_results")
      .getFullList({
        filter: `document.company = "${companyId}"`,
        sort: "-created",
        expand: "document",
        fields: "id,clauseCategory,document,created,expand",
      })
      .catch(() => [] as PBRecord[]);

    // Group by document
    const docMap = new Map<
      string,
      { categories: string[]; createdAt: string; docName: string; counterparty: string }
    >();

    for (const r of recentResults) {
      const docId = r["document"] as string;
      if (docId === newDocId) continue;

      const expandedDoc = r["expand"]?.["document"] as PBRecord | undefined;
      const docName = (expandedDoc?.["originalName"] as string) ?? "";
      const counterparty = (
        (expandedDoc?.["counterpartyName"] as string) ?? ""
      ).toLowerCase().trim();

      if (!docMap.has(docId)) {
        docMap.set(docId, {
          categories: [],
          createdAt: r["created"] as string,
          docName,
          counterparty,
        });
      }
      docMap.get(docId)!.categories.push(r["clauseCategory"] as string);
    }

    // Get new doc's categories (from file name keywords as a heuristic)
    const nameKeywords = newName
      .replace(/[^a-z0-9 ]/g, " ")
      .split(" ")
      .filter((w) => w.length > 3);

    let bestMatch: {
      docId: string;
      score: number;
      docName: string;
      createdAt: string;
      categories: string[];
    } | null = null;

    for (const [docId, info] of Array.from(docMap.entries())) {
      let score = 0;

      // Counterparty name match (strongest signal)
      if (
        newCounterparty &&
        info.counterparty &&
        (info.counterparty.includes(newCounterparty) ||
          newCounterparty.includes(info.counterparty))
      ) {
        score += 10;
      }

      // Clause category overlap (existing document categories vs filename keywords)
      const categoryMatches = info.categories.filter((cat: string) =>
        nameKeywords.some((kw) => cat.toLowerCase().includes(kw))
      );
      score += categoryMatches.length;

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { docId, score, docName: info.docName, createdAt: info.createdAt, categories: info.categories };
      }
    }

    if (!bestMatch || bestMatch.score < 2) return null;

    const reviewDate = new Date(bestMatch.createdAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const sharedCats = bestMatch.categories.slice(0, 3).join(", ");
    const summary = `Similar to "${bestMatch.docName}" reviewed on ${reviewDate} — shared clause categories: ${sharedCats}`;

    return { matchedDocumentId: bestMatch.docId, summary };
  } catch (err) {
    console.error("[integrationProcessor] findPatternMatch error (non-fatal):", err);
    return null;
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function processIntegrationDocument(
  integrationId: string,
  syncLogId: string,
  documentId: string,
  companyId: string
): Promise<void> {
  try {
    // Step 1: Update sync log — downloaded
    await pb.collection("integration_sync_log").update(syncLogId, {
      documentId,
      status: "downloaded",
    });

    // Step 2: Pattern match
    const match = await findPatternMatch(companyId, documentId);
    if (match) {
      await pb.collection("integration_sync_log").update(syncLogId, {
        matchedDocumentId: match.matchedDocumentId,
        matchSummary: match.summary,
      });
    }

    // Step 3: Start review
    await pb.collection("integration_sync_log").update(syncLogId, {
      status: "review_started",
    });

    await audit({
      action: "review_started" as never,
      entityType: "uploaded_document",
      entityId: documentId,
      companyId,
      detail: {
        source: "integration",
        integrationId,
        ...(match ? { matchedDocumentId: match.matchedDocumentId } : {}),
      },
    });

    // Fire review — async, update sync log on completion
    runReview(documentId)
      .then(async () => {
        await pb.collection("integration_sync_log").update(syncLogId, {
          status: "review_complete",
        });
      })
      .catch(async (err: unknown) => {
        await pb.collection("integration_sync_log").update(syncLogId, {
          status: "error",
          errorMessage:
            (err as Error)?.message ?? String(err),
        });
        console.error(
          "[integrationProcessor] runReview failed:",
          err
        );
      });
  } catch (err) {
    await pb.collection("integration_sync_log").update(syncLogId, {
      status: "error",
      errorMessage: (err as Error)?.message ?? String(err),
    });
    throw err;
  }
}
