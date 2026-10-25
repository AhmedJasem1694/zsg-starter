/**
 * Regression tests for the audit log's tenant scope.
 *
 * The bug these guard against: GET /api/audit built its PocketBase filter from
 * req.query alone, with no company predicate, so any authenticated user could
 * read and CSV-export every company's audit rows.
 *
 * Two properties matter and are tested separately, because fixing only the
 * first would not have been a fix: the filter must always carry the company,
 * AND a caller must not be able to break out of a quoted literal to append
 * their own predicate and widen the result set.
 */

import { describe, it, expect } from "vitest";
import { buildAuditFilter, InvalidAuditFilter } from "../auditFilter";

const COMPANY = "abc123xyz456def";
const OTHER = "zzz999yyy888www";

describe("buildAuditFilter", () => {
  it("always scopes to the company, even with no query at all", () => {
    expect(buildAuditFilter(COMPANY)).toBe(`companyId = "${COMPANY}"`);
    expect(buildAuditFilter(COMPANY, {})).toBe(`companyId = "${COMPANY}"`);
  });

  it("keeps the company predicate when filters are supplied", () => {
    const f = buildAuditFilter(COMPANY, {
      action: "review_completed",
      from: "2026-01-01",
      to: "2026-12-31",
      entityId: "doc123",
    });
    expect(f).toContain(`companyId = "${COMPANY}"`);
    expect(f).toBe(
      `companyId = "${COMPANY}" && action = "review_completed" ` +
        `&& created >= "2026-01-01" && created <= "2026-12-31" && entityId = "doc123"`
    );
  });

  it("joins every clause with && so none can widen the result set", () => {
    const f = buildAuditFilter(COMPANY, { action: "user_login", entityId: "x1" });
    expect(f).not.toContain("||");
    expect(f.startsWith(`companyId = "${COMPANY}"`)).toBe(true);
  });

  it("ignores empty and whitespace-only values rather than emitting empty clauses", () => {
    expect(buildAuditFilter(COMPANY, { action: "", from: "   ", entityId: undefined }))
      .toBe(`companyId = "${COMPANY}"`);
  });

  // ── Injection: the reason values are validated, not interpolated raw ────────

  it("rejects an action that tries to close the literal and escape the scope", () => {
    // The original handler would have produced:
    //   action = "x" || companyId != "" && ...
    // which returns every company's rows.
    expect(() =>
      buildAuditFilter(COMPANY, { action: `x" || companyId != "` })
    ).toThrow(InvalidAuditFilter);
  });

  it("rejects an entityId carrying a quote or an || operator", () => {
    expect(() => buildAuditFilter(COMPANY, { entityId: `a" || companyId = "${OTHER}` }))
      .toThrow(InvalidAuditFilter);
    expect(() => buildAuditFilter(COMPANY, { entityId: "a || b" })).toThrow(InvalidAuditFilter);
  });

  it("rejects a backslash, so an escaped quote cannot smuggle a predicate", () => {
    expect(() => buildAuditFilter(COMPANY, { action: 'a\\" || x' })).toThrow(InvalidAuditFilter);
  });

  it("rejects a malformed date rather than interpolating it", () => {
    expect(() => buildAuditFilter(COMPANY, { from: `2026-01-01" || companyId != "` }))
      .toThrow(InvalidAuditFilter);
    expect(() => buildAuditFilter(COMPANY, { to: "not-a-date" })).toThrow(InvalidAuditFilter);
  });

  it("accepts the date shapes the client actually sends", () => {
    for (const d of ["2026-10-25", "2026-10-25 14:03:00", "2026-10-25T14:03:00.000Z"]) {
      expect(() => buildAuditFilter(COMPANY, { from: d })).not.toThrow();
    }
  });

  it("rejects a repeated query parameter, which Express delivers as an array", () => {
    // String(["a","b"]) would smuggle a comma through a naive coercion.
    expect(() => buildAuditFilter(COMPANY, { action: ["user_login", "x"] as unknown }))
      .toThrow(InvalidAuditFilter);
  });

  it("rejects a malformed company id rather than emitting an unscoped filter", () => {
    expect(() => buildAuditFilter("")).toThrow(InvalidAuditFilter);
    expect(() => buildAuditFilter(`" || id != "`)).toThrow(InvalidAuditFilter);
  });
});
