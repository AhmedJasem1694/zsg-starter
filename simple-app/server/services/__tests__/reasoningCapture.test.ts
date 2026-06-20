/**
 * Reasoning capture loop (Sections 1 to 4), end-to-end logic test.
 *
 * Confirms the full loop on representative data, without needing a live database:
 *   1. A decision worse than the playbook fallback is flagged significant and the
 *      verdict explains what is specifically unusual (Section 1).
 *   2. A routine GREEN accept is NOT flagged, so the prompt never nags, even on a
 *      high-importance clause (Sections 1/2).
 *   3. Captured reasoning aggregates into per-counterparty judgment memory:
 *      considerations, repeated-concession patterns, and one-off exceptions
 *      (Section 3) that Section 4 then resurfaces.
 *   4. Capture is independent of the prompt: a significant decision is fully
 *      assessable whether or not a reason is later attached (dismiss never blocks).
 */

import { describe, it, expect } from "vitest";
import { assessSignificance } from "../decisionSignificance.js";
import { aggregateJudgmentMemory } from "../counterpartyJudgment.js";

describe("assessSignificance (Section 1: detect unusual or material decisions)", () => {
  it("flags accepting a position worse than the fallback, and explains why", () => {
    const r = assessSignificance({
      clauseCategory: "LIABILITY_CAP",
      ragStatus: "RED",
      humanAction: "accepted",
      rule: { acceptableFallback: "Liability capped at 12 months' fees" },
    });
    expect(r.significant).toBe(true);
    expect(r.reasons).toContain("worse_than_fallback");
    expect(r.description).toMatch(/Liability Cap/);
    expect(r.description).toMatch(/12 months/);
    expect(r.headline.length).toBeGreaterThan(0);
  });

  it("does NOT flag a routine GREEN accept (no nagging)", () => {
    const r = assessSignificance({
      clauseCategory: "GOVERNING_LAW",
      ragStatus: "GREEN",
      humanAction: "accepted",
      rule: { riskWeight: 3 },
    });
    expect(r.significant).toBe(false);
    expect(r.reasons).toHaveLength(0);
  });

  it("does NOT nag on a GREEN accept even for a high-importance clause", () => {
    const r = assessSignificance({
      clauseCategory: "DATA_PRIVACY",
      ragStatus: "GREEN",
      humanAction: "accepted",
      rule: { riskWeight: 9, approvalRequired: "GC" },
    });
    expect(r.significant).toBe(false);
  });

  it("flags a concession that deviates from the lawyer's own pattern, with the count", () => {
    const r = assessSignificance({
      clauseCategory: "INDEMNITY",
      ragStatus: "AMBER",
      humanAction: "accepted",
      history: { total: 5, held: 4, conceded: 1, mostRecentStance: "held", mostRecentLabel: "Acme Technologies Ltd" },
    });
    expect(r.significant).toBe(true);
    expect(r.reasons).toContain("deviates_from_history");
    expect(r.reasons).toContain("contradicts_recent_similar");
    expect(r.description).toMatch(/held that line in 4 of your last 5/);
  });

  it("flags a contract above the escalation threshold with both amounts", () => {
    const r = assessSignificance({
      clauseCategory: "PAYMENT_TERMS",
      ragStatus: "AMBER",
      humanAction: "accepted",
      contractValue: 500_000,
      currency: "GBP",
      escalationThreshold: 250_000,
    });
    expect(r.reasons).toContain("above_escalation_threshold");
    expect(r.description).toMatch(/£500,000/);
    expect(r.description).toMatch(/£250,000/);
  });

  it("flags a flagged decision on a high-importance clause", () => {
    const r = assessSignificance({
      clauseCategory: "DATA_PRIVACY",
      ragStatus: "AMBER",
      humanAction: "accepted",
      rule: { riskWeight: 9 },
    });
    expect(r.significant).toBe(true);
    expect(r.reasons).toContain("high_importance_clause");
  });

  it("does NOT flag holding the line (editing the position back), absent other triggers", () => {
    const r = assessSignificance({
      clauseCategory: "TERMINATION",
      ragStatus: "RED",
      humanAction: "modified",
    });
    expect(r.significant).toBe(false);
  });
});

describe("aggregateJudgmentMemory (Section 3: per-counterparty judgment memory)", () => {
  const CP = "Acme Technologies Ltd";
  // Newest-first, as the loader returns them.
  const decisions = [
    {
      clause_category: "LIABILITY_CAP",
      zane_recommendation: "reject",
      human_action: "accepted",
      human_final_position: "Accepted Zane's recommendation as-is",
      reasoning_category: "Strategic relationship",
      reasoning_text: "Key account, worth the concession this once was not the case",
      counterparty: CP,
      contract: "c1",
      created: "2026-03-12T10:00:00Z",
    },
    {
      clause_category: "LIABILITY_CAP",
      zane_recommendation: "negotiate",
      human_action: "accepted",
      human_final_position: "Accepted Zane's recommendation as-is",
      reasoning_category: "",
      reasoning_text: "",
      counterparty: CP,
      contract: "c2",
      created: "2026-02-01T10:00:00Z",
    },
    {
      clause_category: "INDEMNITY",
      zane_recommendation: "reject",
      human_action: "accepted",
      human_final_position: "Accepted Zane's recommendation as-is",
      reasoning_category: "One off exception",
      reasoning_text: "Pressured close, do not repeat",
      counterparty: CP,
      contract: "c3",
      created: "2026-01-20T10:00:00Z",
    },
  ];

  it("aggregates reasoned decisions into items and advisory considerations", () => {
    const m = aggregateJudgmentMemory(CP, decisions);
    expect(m).not.toBeNull();
    expect(m!.counterparty).toBe(CP);
    // Two decisions carry reasoning (LIABILITY_CAP strategic + INDEMNITY one-off).
    expect(m!.items).toHaveLength(2);
    expect(m!.considerations.some((c) => /strategic relationship/i.test(c))).toBe(true);
    expect(m!.considerations.some((c) => new RegExp(CP).test(c))).toBe(true);
  });

  it("surfaces a repeated-concession pattern across distinct contracts", () => {
    const m = aggregateJudgmentMemory(CP, decisions);
    // Conceded on LIABILITY_CAP across c1 and c2 → a pattern.
    expect(m!.patterns.some((p) => /Liability Cap/.test(p) && /2 contracts/.test(p))).toBe(true);
  });

  it("keeps one-off exceptions visible so they are not treated as precedent", () => {
    const m = aggregateJudgmentMemory(CP, decisions);
    expect(m!.oneOffExceptions).toHaveLength(1);
    expect(m!.oneOffExceptions[0]).toMatch(/Indemnity/);
    expect(m!.oneOffExceptions[0]).toMatch(/one-off/i);
  });

  it("returns null when nothing meaningful has been captured", () => {
    expect(aggregateJudgmentMemory(CP, [])).toBeNull();
  });
});

describe("capture is independent of the prompt (dismiss never blocks)", () => {
  it("a significant decision is fully assessable whether or not a reason is attached", () => {
    // The verdict that drives the prompt is computed from the decision itself; it
    // never depends on the lawyer answering. So skipping the prompt cannot block
    // capture: the decision is recorded and still aggregates downstream.
    const verdict = assessSignificance({
      clauseCategory: "LIABILITY_CAP",
      ragStatus: "RED",
      humanAction: "accepted",
      rule: { acceptableFallback: "12 months' fees" },
    });
    expect(verdict.significant).toBe(true);

    // The same decision with NO reasoning still forms part of the memory.
    const m = aggregateJudgmentMemory("Nexus Solutions Ltd", [
      { clause_category: "LIABILITY_CAP", zane_recommendation: "reject", human_action: "accepted", contract: "n1", created: "2026-05-01T10:00:00Z" },
      { clause_category: "LIABILITY_CAP", zane_recommendation: "reject", human_action: "accepted", contract: "n2", created: "2026-04-01T10:00:00Z" },
    ]);
    expect(m).not.toBeNull();
    expect(m!.patterns.some((p) => /Liability Cap/.test(p))).toBe(true);
  });
});
