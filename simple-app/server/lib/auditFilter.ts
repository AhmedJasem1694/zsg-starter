/**
 * Filter construction for the audit log.
 *
 * Split out of routes.ts so the tenant scope is one small testable function
 * rather than string concatenation buried in a handler. Two rules hold here.
 *
 * 1. Every query is scoped to exactly one company. audit_log rows carry the
 *    company twice: as a relation (`company`) and as a compat text field
 *    (`companyId`). auditLogger.ts writes the text field whenever a company is
 *    known and the relation only when it is non-empty, and routes.ts already
 *    filters the playbook version counter on `companyId`, so `companyId` is
 *    the field used here too.
 *
 * 2. Caller-supplied values are validated against a strict pattern rather than
 *    escaped. PocketBase filters are plain strings, so a value containing a
 *    double quote can close the literal and append its own predicate, which
 *    would defeat rule 1 entirely. A value that does not match its pattern is
 *    rejected rather than silently dropped, so a malformed client surfaces as
 *    a 400 instead of quietly returning the wrong rows.
 *
 * Rule 2 is not theoretical. Before this module existed the handler built its
 * filter by interpolating req.query directly, so `?action=x" || companyId != "`
 * would have escaped any scope added around it.
 */

export interface AuditFilterInput {
  action?: unknown;
  from?: unknown;
  to?: unknown;
  entityId?: unknown;
}

/** Thrown for a caller-supplied value that fails validation. Maps to a 400. */
export class InvalidAuditFilter extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAuditFilter";
  }
}

/** Audit action names are snake_case, declared in auditLogger.ts AuditAction. */
const ACTION_RE = /^[a-z0-9_]{1,64}$/;
/** PocketBase record ids are short alphanumeric strings. */
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
/** "2026-10-25", "2026-10-25 14:03:00", "2026-10-25T14:03:00.000Z". */
const DATE_RE =
  /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z?)?$/;

/**
 * Normalise one query value. Express gives `string | string[] | ParsedQs`, and
 * a repeated parameter arrives as an array; anything but a string is rejected
 * rather than coerced, since String(["a","b"]) would smuggle a comma through.
 */
function str(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new InvalidAuditFilter(`Invalid ${field} filter`);
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function check(value: string | undefined, pattern: RegExp, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (!pattern.test(value)) throw new InvalidAuditFilter(`Invalid ${field} filter`);
  return value;
}

/**
 * Build a PocketBase filter for one company's audit rows.
 *
 * @throws InvalidAuditFilter if the company id or any caller value is malformed.
 */
export function buildAuditFilter(companyId: string, query: AuditFilterInput = {}): string {
  if (!ID_RE.test(companyId)) throw new InvalidAuditFilter("Invalid company id");

  // The tenant predicate goes first and is joined with && throughout, so no
  // later clause can widen the result set.
  const parts = [`companyId = "${companyId}"`];

  const action = check(str(query.action, "action"), ACTION_RE, "action");
  const from = check(str(query.from, "from"), DATE_RE, "from");
  const to = check(str(query.to, "to"), DATE_RE, "to");
  const entityId = check(str(query.entityId, "entityId"), ID_RE, "entityId");

  if (action) parts.push(`action = "${action}"`);
  if (from) parts.push(`created >= "${from}"`);
  if (to) parts.push(`created <= "${to}"`);
  if (entityId) parts.push(`entityId = "${entityId}"`);

  return parts.join(" && ");
}
