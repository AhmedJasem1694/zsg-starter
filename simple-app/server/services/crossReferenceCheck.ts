/**
 * Cross-document reference checking (Sections 2 to 4).
 *
 * Many contracts are not standalone: a schedule, order form, SOW, amendment, or
 * variation hangs off a Master Services Agreement or other principal document and
 * relies on its clauses and defined terms. Section 1 (parentReferenceDetector)
 * detects those references in the text. This module closes the loop:
 *
 *   - Section 2: locate the referenced parent in the company's own library.
 *   - Section 3: record, per document, which parents are referenced, which
 *     clauses/defined terms are relied upon, and whether the parent is on file.
 *   - Section 4: re-check against the library after a parent is uploaded, without
 *     re-parsing (the references are already stored).
 *
 * The result is stored as JSON on uploaded_documents.crossRefCheck and surfaced in
 * the review. Everything here is best-effort and non-blocking: a failure never
 * affects the review itself.
 */

import { pb } from "../pb.js";
import { detectParentReferences, type ExternalReference } from "./parentReferenceDetector.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

export interface MatchedReference extends ExternalReference {
  /** True when a likely parent document was found in the company's library. */
  found: boolean;
  foundDocumentId: string;
  foundName: string;
}

export interface CrossRefResult {
  checkedAt: string;
  references: MatchedReference[];
}

const STOPWORDS = new Set(["the", "agreement", "dated", "between", "and", "of", "a", "an", "this", "made", "by"]);

/** The distinctive core phrase of a parent name, e.g. "master services" / "framework". */
function corePhrase(parentName: string): string {
  return parentName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .join(" ")
    .trim();
}

/**
 * Try to find the referenced parent in the company's library. Conservative: a
 * library document matches when its name contains the reference's core phrase
 * (e.g. "master services"), preferring a same-counterparty match when known.
 */
function locateParent(reference: ExternalReference, library: PBRecord[]): { id: string; name: string } | null {
  const core = corePhrase(reference.parentName);
  if (!core) return null;
  const refCp = (reference.counterparty ?? "").trim().toLowerCase();

  const candidates = library.filter((d) => {
    const name = String(d["originalName"] ?? "").toLowerCase();
    return name.includes(core) || (core.length > 6 && name.includes(core.split(" ")[0]));
  });
  if (candidates.length === 0) return null;

  // Prefer a candidate whose counterparty matches the reference's counterparty.
  const byCp = refCp
    ? candidates.find((d) => String(d["counterpartyName"] ?? "").toLowerCase().includes(refCp))
    : undefined;
  const chosen = byCp ?? candidates[0];
  return { id: String(chosen.id), name: String(chosen["originalName"] ?? "") };
}

/** Re-match a set of references against the current library (no LLM, no parsing). */
async function matchReferences(companyId: string, refs: ExternalReference[], excludeDocId: string): Promise<MatchedReference[]> {
  let library: PBRecord[] = [];
  try {
    library = await pb.collection("uploaded_documents").getFullList({
      filter: `company = "${companyId}" && id != "${excludeDocId}"`,
      fields: "id,originalName,counterpartyName,contractType",
    });
  } catch { /* empty library */ }

  return refs.map((r) => {
    const hit = locateParent(r, library);
    return {
      ...r,
      found: !!hit,
      foundDocumentId: hit?.id ?? "",
      foundName: hit?.name ?? "",
    };
  });
}

async function persist(documentId: string, result: CrossRefResult): Promise<void> {
  try {
    await pb.collection("uploaded_documents").update(documentId, { crossRefCheck: JSON.stringify(result) });
  } catch (err) {
    console.warn(`[crossRef] persist for ${documentId} failed (non-fatal):`, (err as Error)?.message);
  }
}

/**
 * Detect parent references in a freshly reviewed document, locate any in the
 * library, and store the result. Called fire-and-forget from the review pipeline.
 */
export async function checkParentReferences(documentId: string, companyId: string, text: string): Promise<CrossRefResult | null> {
  try {
    let companyName = "";
    let counterpartyName = "";
    try {
      const doc = await pb.collection("uploaded_documents").getOne(documentId);
      counterpartyName = String(doc["counterpartyName"] ?? "");
    } catch { /* ignore */ }
    try {
      const company = await pb.collection("companies").getOne(companyId);
      companyName = String(company["name"] ?? "");
    } catch { /* ignore */ }

    const { references } = await detectParentReferences({ text, companyName, counterpartyName });
    if (references.length === 0) {
      // Standalone: record an empty, checked result so the UI can say "no external
      // dependencies" rather than "not checked".
      const empty: CrossRefResult = { checkedAt: new Date().toISOString(), references: [] };
      await persist(documentId, empty);
      return empty;
    }

    const matched = await matchReferences(companyId, references, documentId);
    const result: CrossRefResult = { checkedAt: new Date().toISOString(), references: matched };
    await persist(documentId, result);
    return result;
  } catch (err) {
    console.warn(`[crossRef] check for ${documentId} failed (non-fatal):`, (err as Error)?.message);
    return null;
  }
}

/** Read the stored cross-reference result for a document. Null if never checked. */
export async function getCrossRefResult(documentId: string): Promise<CrossRefResult | null> {
  try {
    const doc = await pb.collection("uploaded_documents").getOne(documentId);
    const raw = String(doc["crossRefCheck"] ?? "").trim();
    if (!raw) return null;
    return JSON.parse(raw) as CrossRefResult;
  } catch {
    return null;
  }
}

/**
 * Re-check the already-detected references against the current library (Section 4:
 * "upload the parent, then verify"). Cheap: no re-parsing or LLM, it just
 * re-matches stored references. Returns the updated result, or null if there is
 * nothing stored to re-check.
 */
export async function relinkCrossReferences(documentId: string, companyId: string): Promise<CrossRefResult | null> {
  const existing = await getCrossRefResult(documentId);
  if (!existing || existing.references.length === 0) return existing;
  const matched = await matchReferences(companyId, existing.references, documentId);
  const result: CrossRefResult = { checkedAt: new Date().toISOString(), references: matched };
  await persist(documentId, result);
  return result;
}
