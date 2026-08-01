// ── House style for generated text ────────────────────────────────────────────
// Zane never uses em dashes or en dashes in anything it writes. Two layers
// enforce this, both defined here so they cannot drift:
//
//   1. NO_DASHES_RULE is appended to the prompt of every model call, centrally
//      in chatComplete, so any future call site inherits it automatically.
//   2. stripDashes() post-processes model output at the same choke point,
//      because models ignore instructions occasionally.
//
// The post-processor runs on generated text only. Calls that return content
// lifted verbatim from a contract, an email, or a company register opt out via
// preserveVerbatim, so source material is never rewritten.

export const NO_DASHES_RULE =
  "Never use em dashes or en dashes in any output. Use commas, full stops, or restructure the sentence instead.";

/**
 * Removes em dashes and en dashes from generated text.
 *
 * - A dash with spaces around it becomes a comma and a space: "a — b" -> "a, b"
 * - A dash between words with no spaces becomes a comma and a space:
 *   "a—b" -> "a, b"
 * - A dash between digits is a numeric range, so it becomes a plain hyphen
 *   rather than a comma, which would change the meaning: "2020–2024" ->
 *   "2020-2024"
 * - A stray dash left anywhere else is replaced with a comma.
 *
 * Never call this on contract text, extracted document content, or anything a
 * user wrote. It is for text Zane generates.
 */
export function stripDashes(text: string): string {
  if (!text || (!text.includes("—") && !text.includes("–"))) return text;

  return text
    // Numeric ranges keep their meaning with a hyphen.
    .replace(/(\d)\s*[—–]\s*(\d)/g, "$1-$2")
    // Between any two non-space characters, spaced or not.
    .replace(/(\S)\s*[—–]\s*(\S)/g, "$1, $2")
    // Anything left over (line-leading or trailing dash).
    .replace(/[—–]/g, ",")
    // Tidy the artefacts the replacements can create.
    .replace(/ ,/g, ",")
    .replace(/,{2,}/g, ",")
    .replace(/,\s*([.,;:!?])/g, "$1");
}

/** True when a string contains a dash this house style forbids. */
export function hasForbiddenDash(text: string): boolean {
  return /[—–]/.test(text ?? "");
}
