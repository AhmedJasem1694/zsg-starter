/**
 * Cross-document reference checking, Section 1: detect references to a parent
 * agreement.
 *
 * Many contracts are not standalone: a schedule, order form, statement of work,
 * amendment, or variation hangs off a Master Services Agreement, Framework
 * Agreement, or other principal document, and relies on specific clauses and
 * defined terms from it. This module scans an incoming document for those
 * external references and returns a structured result: the named parent
 * agreement, its date and counterparty if stated, and every clause number or
 * defined term the new document leans on from that parent.
 *
 * Privacy: the document text is run through the existing PII anonymiser before
 * any model call, and the extracted free-text fields are de-anonymised after,
 * exactly as the rest of the pipeline does.
 */

import { llmJsonCall } from "./llmJsonParse.js";
import { getModelForTask } from "./modelRouter.js";
import { anonymise, deanonymise, buildKnownEntities } from "./piiAnonymiser.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

export interface ExternalReference {
  /** The named parent agreement, e.g. "Master Services Agreement". */
  parentName: string;
  /** The parent's date if the document states one, else "". */
  date: string;
  /** The counterparty named in connection with the parent, if stated, else "". */
  counterparty: string;
  /** Specific clause numbers the new document cites from the parent, e.g. ["clause 5.2", "clause 8.2"]. */
  clauseRefs: string[];
  /** Defined terms the new document uses that should come from the parent. */
  definedTerms: string[];
}

export interface ParentReferenceResult {
  references: ExternalReference[];
}

const cap = (s: string, n: number) => (s ?? "").slice(0, n);

/**
 * Cheap pre-filter: only worth an LLM call if the text actually contains the
 * tell-tale language of an external parent reference. Avoids a model call on
 * standalone documents.
 */
export function hasParentReferenceMarkers(text: string): boolean {
  if (!text) return false;
  return (
    /master\s+(services\s+)?agreement/i.test(text) ||
    /framework\s+agreement/i.test(text) ||
    /principal\s+agreement/i.test(text) ||
    /\bthe\s+agreement\s+dated\b/i.test(text) ||
    /governed\s+by\s+the\s+terms\s+of/i.test(text) ||
    /subject\s+to\s+the\s+(limitations|terms)\s+(in|of)/i.test(text) ||
    /as\s+defined\s+in\s+the\s+(master|principal|framework)\s+agreement/i.test(text) ||
    /clause\s+\d+(\.\d+)*\s+of\s+the\s+(master|principal|framework|main)\s+agreement/i.test(text) ||
    /\bunder\s+the\s+(master|principal|framework)\s+agreement\b/i.test(text)
  );
}

/**
 * Detect references to a parent agreement in a document. Returns the external
 * references found (usually one parent, with the clauses and defined terms the
 * new document relies on). Strictly grounded: never fabricates a reference that
 * is not present in the text.
 */
export async function detectParentReferences(input: {
  text: string;
  companyName?: string;
  counterpartyName?: string;
}): Promise<ParentReferenceResult> {
  const { text, companyName, counterpartyName } = input;
  if (!hasParentReferenceMarkers(text)) return { references: [] };

  // Cap the text sent to the model: parent references live in the recitals,
  // definitions, and the clauses that incorporate the parent, so head + tail
  // captures them without paying for the whole document.
  const head = text.slice(0, 16000);
  const tail = text.length > 22000 ? "\n\n[...]\n\n" + text.slice(-6000) : "";
  const source = head + tail;

  const known = buildKnownEntities(companyName, counterpartyName);
  const { anonymisedText, entityMap } = await anonymise(source, known);

  const system = `You analyse a contract document that may be subordinate to a parent agreement (a schedule, order form, statement of work, amendment, or variation that hangs off a Master Services Agreement, Framework Agreement, or other principal document). Respond with JSON only.

HARD RULES:
1. Report ONLY references that are EXPLICITLY present in the text. NEVER invent a parent agreement, date, clause number, or defined term that is not written there.
2. A "parent reference" is where the document relies on, incorporates, or is governed by another agreement (e.g. "Master Services Agreement", "the Agreement dated 1 March 2024", "the Principal Agreement", "governed by the terms of the Master Agreement", "subject to the limitations in clause 11 of the Master Agreement", "as defined in the Master Agreement").
3. For each distinct parent agreement referenced, capture: its name, its date if stated (else ""), the counterparty named with it if stated (else ""), every specific clause number the document cites from it (e.g. "clause 5.2", "clause 8.2", "schedule 3"), and the defined terms it uses that should come from that parent.
4. If the document is standalone and does not rely on any parent agreement, return {"references": []}.`;

  const user = `DOCUMENT:
${anonymisedText}

Return ONLY this JSON:
{
  "references": [
    {
      "parentName": "the named parent agreement, e.g. Master Services Agreement",
      "date": "the parent's date if stated, else empty string",
      "counterparty": "the counterparty named with the parent if stated, else empty string",
      "clauseRefs": ["every clause/schedule number this document cites from the parent, e.g. clause 8.2"],
      "definedTerms": ["defined terms this document uses that should be defined in the parent"]
    }
  ]
}`;

  let raw: { references?: unknown };
  try {
    raw = await llmJsonCall<{ references?: unknown }>({
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      model: getModelForTask("cross_reference_check"), // Claude Sonnet 4.6
      maxTokens: 2500,
      timeoutMs: 60_000,
      description: "parent-reference detection",
      preserveVerbatim: true, // quotes clause references from the contract
    });
  } catch (err) {
    console.warn("[parentRef] detection failed (non-fatal):", (err as Error)?.message);
    return { references: [] };
  }

  const list = Array.isArray(raw?.references) ? raw.references : [];
  const references: ExternalReference[] = list
    .filter((r): r is PBRecord => !!r && typeof r === "object")
    .map((r) => ({
      parentName: deanonymise(cap(String(r.parentName ?? "").trim(), 200), entityMap),
      date: cap(String(r.date ?? "").trim(), 100),
      counterparty: deanonymise(cap(String(r.counterparty ?? "").trim(), 200), entityMap),
      clauseRefs: Array.isArray(r.clauseRefs)
        ? r.clauseRefs.map((c: unknown) => cap(String(c).trim(), 60)).filter(Boolean).slice(0, 40)
        : [],
      definedTerms: Array.isArray(r.definedTerms)
        ? r.definedTerms.map((c: unknown) => deanonymise(cap(String(c).trim(), 120), entityMap)).filter(Boolean).slice(0, 40)
        : [],
    }))
    .filter((r) => r.parentName);

  return { references };
}
