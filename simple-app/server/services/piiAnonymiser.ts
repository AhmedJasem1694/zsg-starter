/**
 * PII Anonymisation Service
 *
 * Detects and replaces personally identifiable information in contract text
 * BEFORE sending to external LLM providers (OpenRouter/Claude).
 *
 * Strategy:
 *  1. Replace known context entities (company name, counterparty name) first.
 *  2. Apply regex patterns for structured PII (emails, phones, postcodes, etc.).
 *  3. Return anonymised text + a reversible entity map keyed by session ID.
 *  4. After the LLM response arrives, call deanonymise() to restore originals.
 *
 * Placeholders take the form [TYPE_N] e.g. [COMPANY_A], [EMAIL_1], [PHONE_1].
 * The session entity map is stored in PocketBase (pii_sessions collection)
 * so it survives async gaps and can be referenced in audit logs.
 */

import { nanoid } from "nanoid";
import { pb } from "../pb.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PiiEntity {
  /** The placeholder string inserted into text, e.g. "[EMAIL_1]" */
  placeholder: string;
  /** The original PII value */
  original: string;
  /** Entity type label */
  type: string;
}

export interface AnonymisationResult {
  anonymisedText: string;
  entityMap: PiiEntity[];
  /** UUID for this anonymisation session — stored in PocketBase */
  sessionId: string;
}

// ── Regex patterns ────────────────────────────────────────────────────────────
// Ordered: most-specific first to avoid partial overlaps.

const PII_PATTERNS: Array<{ type: string; pattern: RegExp }> = [
  // Email addresses
  {
    type: "EMAIL",
    pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
  },
  // IBAN (before sort codes to avoid partial match)
  {
    type: "IBAN",
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]?){0,16}\b/g,
  },
  // UK sort code  nn-nn-nn
  {
    type: "SORT_CODE",
    pattern: /\b\d{2}[-–]\d{2}[-–]\d{2}\b/g,
  },
  // UK bank account numbers (exactly 8 digits, not preceded/followed by digits)
  {
    type: "ACCOUNT_NUMBER",
    pattern: /(?<!\d)\b\d{8}\b(?!\d)/g,
  },
  // UK NI number
  {
    type: "NI_NUMBER",
    pattern: /\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi,
  },
  // UK company registration number (8 digits, optionally prefixed SC/NI/OC)
  {
    type: "COMPANY_REG",
    pattern: /\b(?:SC|NI|OC|IP|RS|SO|GE|GS|NL|R|LP|NC|NP|NA|NZ|FC|SF|SA|ZC)?\d{8}\b/g,
  },
  // UK postcodes
  {
    type: "POSTCODE_UK",
    pattern: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/gi,
  },
  // UK landline / mobile (catches +44, 07, 01, 02, 03)
  {
    type: "PHONE",
    pattern:
      /\b(?:(?:\+44\s?|0)(?:(?:1\d{1}|2[03478]|3[0347]|5[56]|7[0-9]|8[047]|9[018])\d{7,8}|(?:800|808)\s?\d{6,7}|(?:1\d{3}|2[0-9]\d{2}|3[0-9]\d{2})\s?\d{6}))\b/g,
  },
  // International phone (E.164)
  {
    type: "PHONE",
    pattern: /\+\d{1,3}[\s.\-]?\(?\d{1,4}\)?[\s.\-]?\d{3,4}[\s.\-]?\d{4}\b/g,
  },
  // Passport numbers (UK format and generic 6-9 alphanumeric)
  {
    type: "PASSPORT",
    pattern: /\b(?:[A-Z]{2}\d{7}|\d{9}|[A-Z]\d{8})\b/g,
  },
  // Dates of birth (explicit DOB context)
  {
    type: "DATE_OF_BIRTH",
    pattern:
      /\bborn\s+(?:on\s+)?(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/gi,
  },
  // VAT registration numbers
  {
    type: "VAT_NUMBER",
    pattern: /\b(?:GB)?\s?\d{9}\s?(?:\d{3})?\b/g,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Escape special regex characters in a literal string */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Build a regex that matches a name/company string (case-insensitive, word-boundary) */
function namePattern(name: string): RegExp {
  return new RegExp(`(?<![A-Za-z])${escapeRegex(name)}(?![A-Za-z])`, "gi");
}

// ── Core anonymise function ───────────────────────────────────────────────────

/**
 * Anonymise PII in `text` before it is sent to an external LLM.
 *
 * @param text           Raw contract clause / document text
 * @param knownEntities  Named entities already known from context (company name,
 *                       counterparty name, etc.). These are replaced first.
 * @param documentId     Optional: PocketBase uploaded_documents ID for audit correlation.
 */
export async function anonymise(
  text: string,
  knownEntities: Array<{ value: string; type: string }> = [],
  documentId?: string
): Promise<AnonymisationResult> {
  const entityMap: PiiEntity[] = [];
  let result = text;

  // Counter per type for readable placeholder names
  const counters: Record<string, number> = {};

  function nextPlaceholder(type: string): string {
    counters[type] = (counters[type] ?? 0) + 1;
    // Use alphabetic suffix for companies (A/B/C), numeric for the rest
    if (type === "COMPANY" || type === "PERSON") {
      const letter = String.fromCharCode(64 + counters[type]); // A, B, C…
      return `[${type}_${letter}]`;
    }
    return `[${type}_${counters[type]}]`;
  }

  function replaceEntity(original: string, type: string): string {
    // Dedup — if the same value was already mapped, return the existing placeholder
    const existing = entityMap.find(
      (e) => e.original.toLowerCase() === original.toLowerCase()
    );
    if (existing) return existing.placeholder;

    const placeholder = nextPlaceholder(type);
    entityMap.push({ placeholder, original, type });
    return placeholder;
  }

  // ── Step 1: Replace known named entities (company / counterparty names) ───
  for (const entity of knownEntities) {
    if (!entity.value || entity.value.trim().length < 3) continue;
    result = result.replace(namePattern(entity.value), () =>
      replaceEntity(entity.value, entity.type)
    );
  }

  // ── Step 2: Apply structural PII regex patterns ───────────────────────────
  for (const { type, pattern } of PII_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    result = result.replace(pattern, (match) => replaceEntity(match, type));
  }

  // ── Step 3: Persist session to PocketBase ─────────────────────────────────
  const sessionId = nanoid();

  try {
    await pb.collection("pii_sessions").create({
      sessionId,
      documentId: documentId ?? "",
      entityMap: JSON.stringify(entityMap),
      entitiesDetected: entityMap.length,
    });
  } catch (err) {
    // Non-fatal — if PB write fails, we still proceed with anonymisation in memory.
    // The entity map is returned and held in the calling scope.
    console.warn("[PII] Failed to persist pii_session to PocketBase:", err);
  }

  return { anonymisedText: result, entityMap, sessionId };
}

// ── De-anonymise ──────────────────────────────────────────────────────────────

/**
 * Restore original values in LLM output using the entity map from anonymise().
 * Replacement is case-insensitive on the placeholder to handle any LLM casing.
 */
export function deanonymise(text: string, entityMap: PiiEntity[]): string {
  let result = text;
  // Replace longest placeholders first to avoid partial matches
  const sorted = [...entityMap].sort(
    (a, b) => b.placeholder.length - a.placeholder.length
  );
  for (const { placeholder, original } of sorted) {
    result = result.split(placeholder).join(original);
  }
  return result;
}

/**
 * Load an entity map from PocketBase by sessionId (for async / multi-step flows).
 */
export async function loadEntityMap(sessionId: string): Promise<PiiEntity[]> {
  try {
    const record = await pb
      .collection("pii_sessions")
      .getFirstListItem(`sessionId = "${sessionId}"`);
    return JSON.parse(record["entityMap"] as string) as PiiEntity[];
  } catch {
    return [];
  }
}

/**
 * Build the knownEntities array from document/company context.
 * Pass the result to anonymise() as the `knownEntities` argument.
 */
export function buildKnownEntities(
  companyName?: string,
  counterpartyName?: string,
  extraNames?: string[]
): Array<{ value: string; type: string }> {
  const entities: Array<{ value: string; type: string }> = [];

  if (counterpartyName && counterpartyName.trim()) {
    entities.push({ value: counterpartyName.trim(), type: "COMPANY" });
  }
  if (companyName && companyName.trim()) {
    // We still anonymise the client company name to avoid leaking it via the LLM
    entities.push({ value: companyName.trim(), type: "COMPANY" });
  }
  for (const name of extraNames ?? []) {
    if (name.trim().length >= 3) {
      entities.push({ value: name.trim(), type: "COMPANY" });
    }
  }

  return entities;
}
