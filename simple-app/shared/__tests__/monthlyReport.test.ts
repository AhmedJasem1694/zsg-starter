/**
 * The report's arithmetic, which both the printable export and the scheduled
 * email depend on.
 *
 * The cases worth holding down are the period boundaries. A monthly report
 * built one day out either says "0 contracts reviewed" about a busy month or
 * counts the next month's activity in this month's figures, and neither is
 * visible by looking at the output: a wrong report looks exactly like a right
 * one until someone reconciles it.
 */

import { describe, expect, it } from "vitest";
import {
  buildMonthlyReportModel,
  endOfPreviousMonth,
  periodKey,
  roleLabel,
  roleLabelRaw,
  titleCase,
  type MonthlyReportInput,
} from "../monthlyReport";

const portfolio = {
  valueAtRisk: { RED: 250_000, AMBER: 90_000, GREEN: 10_000, total: 350_000 },
  byCounterparty: [
    { name: "Northwind Ltd", red: 3, amber: 1, green: 4, total: 5, value: 120_000 },
    { name: "Calm Seas Ltd", red: 0, amber: 2, green: 9, total: 4, value: 60_000 },
  ],
};

const base = (over: Partial<MonthlyReportInput> = {}): MonthlyReportInput => ({
  companyName: "Meridian Health",
  portfolio,
  documents: [],
  approvals: [],
  asOf: new Date(2026, 9, 31, 23, 59, 59, 999), // 31 October 2026
  generatedAt: new Date(2026, 10, 1, 7, 0, 0), // 1 November 2026
  ...over,
});

describe("endOfPreviousMonth", () => {
  it("returns the last instant of the month before", () => {
    const end = endOfPreviousMonth(new Date(2026, 10, 1, 7, 0, 0)); // 1 Nov
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(9); // October
    expect(end.getDate()).toBe(31);
    expect(end.getHours()).toBe(23);
  });

  it("crosses a year boundary", () => {
    const end = endOfPreviousMonth(new Date(2027, 0, 1, 7, 0, 0)); // 1 Jan 2027
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(11); // December
    expect(end.getDate()).toBe(31);
  });

  it("handles February in a non-leap and a leap year", () => {
    expect(endOfPreviousMonth(new Date(2026, 2, 1)).getDate()).toBe(28);
    expect(endOfPreviousMonth(new Date(2028, 2, 1)).getDate()).toBe(29);
  });
});

describe("periodKey", () => {
  it("zero-pads the month", () => {
    expect(periodKey(new Date(2026, 0, 31))).toBe("2026-01");
    expect(periodKey(new Date(2026, 9, 31))).toBe("2026-10");
  });
});

describe("buildMonthlyReportModel period windows", () => {
  it("titles and labels the month it is as of, not the month it is generated in", () => {
    const m = buildMonthlyReportModel(base());
    expect(m.monthLabel).toBe("October 2026");
    expect(m.reportTitle).toBe("October 2026 Legal Report");
    expect(m.period).toBe("2026-10");
    // Generated on 1 November, about October.
    expect(m.generatedLabel).toBe("1 November 2026");
  });

  /**
   * The window is built with local-time constructors (new Date(y, m, 1)) and
   * compared against stored UTC timestamps, so these literals are written in
   * local time too. That is not incidental: the boundary genuinely sits at
   * midnight in the evaluating process's zone, which is UTC on the server and
   * the viewer's own zone in the browser. See the note in monthlyReport.ts.
   */
  const localIso = (y: number, mIndex: number, d: number, h = 12) =>
    new Date(y, mIndex, d, h).toISOString();

  it("counts a review on the last day of the month and excludes the next month's", () => {
    const m = buildMonthlyReportModel(
      base({
        documents: [
          { status: "COMPLETE", uploadedAt: localIso(2026, 9, 31, 18) }, // in
          { status: "COMPLETE", uploadedAt: localIso(2026, 9, 1, 0) },   // in, first instant
          { status: "COMPLETE", uploadedAt: localIso(2026, 10, 1, 9) },  // next month
          { status: "COMPLETE", uploadedAt: localIso(2026, 8, 30, 23) }, // last month
        ],
      }),
    );
    expect(m.reviewedCount).toBe(2);
  });

  it("ignores documents that are not complete", () => {
    const m = buildMonthlyReportModel(
      base({
        documents: [
          { status: "COMPLETE", uploadedAt: "2026-10-10T10:00:00Z" },
          { status: "PROCESSING", uploadedAt: "2026-10-11T10:00:00Z" },
          { status: "FAILED", uploadedAt: "2026-10-12T10:00:00Z" },
        ],
      }),
    );
    expect(m.reviewedCount).toBe(1);
  });

  it("counts escalations raised in the period only", () => {
    const m = buildMonthlyReportModel(
      base({
        approvals: [
          { createdAt: "2026-10-05T10:00:00Z", status: "PENDING", routedToRole: "CFO" },
          { createdAt: "2026-10-30T10:00:00Z", status: "APPROVED", routedToRole: "GC" },
          { createdAt: "2026-11-02T10:00:00Z", status: "PENDING", routedToRole: "CFO" },
        ],
      }),
    );
    expect(m.escalationsRaised).toBe(2);
    expect(m.escalations).toHaveLength(2);
  });

  it("measures the renewal horizon forward from the period end", () => {
    const m = buildMonthlyReportModel(
      base({
        documents: [
          { status: "COMPLETE", renewalDate: "2026-11-15T00:00:00Z" }, // inside 90 days
          { status: "COMPLETE", renewalDate: "2027-01-20T00:00:00Z" }, // inside 90 days
          { status: "COMPLETE", renewalDate: "2027-06-01T00:00:00Z" }, // beyond
          { status: "COMPLETE", renewalDate: "2026-10-02T00:00:00Z" }, // already passed
        ],
      }),
    );
    expect(m.renewalsDueCount).toBe(2);
    // Soonest first, so the reader's first row is the next thing to act on.
    expect(m.renewals[0].renewalDate).toBe("2026-11-15T00:00:00Z");
  });

  it("ignores dates it cannot parse rather than counting them", () => {
    const m = buildMonthlyReportModel(
      base({
        documents: [
          { status: "COMPLETE", uploadedAt: "not a date", renewalDate: "also not a date" },
          { status: "COMPLETE", uploadedAt: null, renewalDate: null },
        ],
      }),
    );
    expect(m.reviewedCount).toBe(0);
    expect(m.renewalsDueCount).toBe(0);
  });
});

describe("buildMonthlyReportModel content", () => {
  it("takes red exposure straight from the portfolio payload", () => {
    expect(buildMonthlyReportModel(base()).redExposure).toBe(250_000);
  });

  it("lists only counterparties with a red flag", () => {
    const m = buildMonthlyReportModel(base());
    expect(m.counterparties.map((c) => c.name)).toEqual(["Northwind Ltd"]);
  });

  it("names a decider only once there is a decision", () => {
    const m = buildMonthlyReportModel(
      base({
        approvals: [
          { createdAt: "2026-10-05T10:00:00Z", status: "PENDING", decidedByName: "Someone Early" },
          { createdAt: "2026-10-06T10:00:00Z", status: "APPROVED", decidedByName: "Dana Reed" },
        ],
      }),
    );
    expect(m.escalations[0].decidedByName).toBe("");
    expect(m.escalations[0].statusLabel).toBe("Awaiting decision");
    expect(m.escalations[1].decidedByName).toBe("Dana Reed");
    expect(m.escalations[1].statusLabel).toBe("Approved");
  });

  it("falls back to the document name when there is no counterparty", () => {
    const m = buildMonthlyReportModel(
      base({
        approvals: [
          { createdAt: "2026-10-05T10:00:00Z", status: "PENDING", documentName: "MSA v4.docx" },
        ],
      }),
    );
    expect(m.escalations[0].contract).toBe("MSA v4.docx");
  });
});

describe("isEmpty", () => {
  it("is true when nothing happened and no counterparty deviates", () => {
    const m = buildMonthlyReportModel(
      base({
        portfolio: { valueAtRisk: portfolio.valueAtRisk, byCounterparty: [] },
      }),
    );
    expect(m.isEmpty).toBe(true);
  });

  it("is false when a counterparty deviates even with no activity", () => {
    // A standing exposure with no activity against it is the month's most
    // important fact, not an empty month.
    expect(buildMonthlyReportModel(base()).isEmpty).toBe(false);
  });

  it("is false when anything was reviewed", () => {
    const m = buildMonthlyReportModel(
      base({
        portfolio: { valueAtRisk: portfolio.valueAtRisk, byCounterparty: [] },
        documents: [{ status: "COMPLETE", uploadedAt: "2026-10-09T10:00:00Z" }],
      }),
    );
    expect(m.isEmpty).toBe(false);
  });
});

describe("titleCase", () => {
  it("title-cases ordinary multi-word tokens", () => {
    expect(titleCase("SUPPLIER_AGREEMENT")).toBe("Supplier Agreement");
    expect(titleCase("LIABILITY_CAP")).toBe("Liability Cap");
  });

  it("leaves acronyms as acronyms", () => {
    // "Msa" in a contract table reads as a typo in a document whose job is to
    // look checked.
    expect(titleCase("MSA")).toBe("MSA");
    expect(titleCase("NDA")).toBe("NDA");
    expect(titleCase("DPA")).toBe("DPA");
    expect(titleCase("IP_OWNERSHIP")).toBe("IP Ownership");
    expect(titleCase("SERVICE_LEVELS")).toBe("Service Levels");
  });

  it("still escapes", () => {
    expect(titleCase("A&B_LTD")).toBe("A&amp;b Ltd");
  });
});

describe("roleLabel", () => {
  it("uses the house spelling for known roles", () => {
    expect(roleLabelRaw("CFO")).toBe("CFO");
    expect(roleLabelRaw("GC")).toBe("GC");
    expect(roleLabelRaw("BOARD")).toBe("Board");
  });

  it("title-cases a role added later without leaking entities into plain text", () => {
    expect(roleLabelRaw("HEAD_OF_RISK")).toBe("Head Of Risk");
    expect(roleLabelRaw("R&D_LEAD")).toBe("R&D Lead");
    // The markup form escapes; the raw form must not.
    expect(roleLabel("R&D_LEAD")).toBe("R&amp;D Lead");
  });
});
