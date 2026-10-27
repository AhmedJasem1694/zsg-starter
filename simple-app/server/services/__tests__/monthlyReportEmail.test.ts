/**
 * The email rendering of the monthly report.
 *
 * The things asserted here are the ones that would otherwise be discovered by
 * a CFO opening a broken email: layout that only works outside a mail client,
 * HTML entities leaking into the plain-text part, and a counterparty name
 * carrying markup into the document.
 */

import { describe, expect, it } from "vitest";
import { buildMonthlyReportModel, type MonthlyReportInput } from "../../../shared/monthlyReport";
import { renderMonthlyReportEmail } from "../monthlyReportEmail";

const input = (over: Partial<MonthlyReportInput> = {}): MonthlyReportInput => ({
  companyName: "Meridian Health",
  portfolio: {
    valueAtRisk: { RED: 250_000, AMBER: 90_000, GREEN: 10_000, total: 350_000 },
    byCounterparty: [
      { name: "Northwind Ltd", red: 3, amber: 1, green: 4, total: 5, value: 120_000 },
    ],
  },
  documents: [
    { status: "COMPLETE", uploadedAt: new Date(2026, 9, 12, 10).toISOString() },
    { status: "COMPLETE", renewalDate: new Date(2026, 10, 20, 10).toISOString(), counterpartyName: "Acme Supplies", contractType: "SUPPLY_AGREEMENT", contractValue: 48_000 },
  ],
  approvals: [
    {
      createdAt: new Date(2026, 9, 14, 9).toISOString(),
      counterpartyName: "Northwind Ltd",
      clauseCategory: "LIABILITY_CAP",
      routedToRole: "CFO",
      status: "APPROVED",
      decidedByName: "Dana Reed",
    },
  ],
  asOf: new Date(2026, 9, 31, 23, 59, 59, 999),
  generatedAt: new Date(2026, 10, 1, 7),
  ...over,
});

const render = (over: Partial<MonthlyReportInput> = {}) =>
  renderMonthlyReportEmail(buildMonthlyReportModel(input(over)), "https://www.zanelegal.ai");

describe("subject", () => {
  it("names the month and the company", () => {
    expect(render().subject).toBe("October 2026 Legal Report: Meridian Health");
  });
});

describe("html, for a mail client rather than a browser", () => {
  it("carries no stylesheet, script or print rule", () => {
    const { html } = render();
    // A mail client strips <style>, ignores @font-face and @page, and will not
    // run a script. Anything the layout depends on has to be inline.
    expect(html).not.toContain("<style");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("@font-face");
    expect(html).not.toContain("@page");
    expect(html).not.toContain("window.print");
  });

  it("lays out with tables and no flexbox", () => {
    const { html } = render();
    expect(html).toContain('role="presentation"');
    expect(html).not.toContain("display:flex");
  });

  it("links to the portfolio on the origin it was given", () => {
    expect(render().html).toContain('href="https://www.zanelegal.ai/portfolio"');
  });

  it("escapes a counterparty name that contains markup", () => {
    const { html } = render({
      portfolio: {
        valueAtRisk: { RED: 1, AMBER: 0, GREEN: 0, total: 1 },
        byCounterparty: [
          { name: "<script>alert(1)</script> & Co", red: 2, amber: 0, green: 0, total: 1, value: 10 },
        ],
      },
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; Co");
  });

  it("shows the headline figures from the model", () => {
    const { html } = render();
    expect(html).toContain("£250,000"); // red exposure
    expect(html).toContain("October 2026 Legal Report");
    expect(html).toContain("Meridian Health");
  });
});

describe("plain text part", () => {
  it("contains no markup and no escaped entities", () => {
    const { text } = render();
    expect(text).not.toMatch(/<[a-z/]/i);
    expect(text).not.toContain("&amp;");
    expect(text).not.toContain("&lt;");
  });

  it("keeps an ampersand in a counterparty name literal", () => {
    const { text } = render({
      portfolio: {
        valueAtRisk: { RED: 1, AMBER: 0, GREEN: 0, total: 1 },
        byCounterparty: [
          { name: "Marks & Spencer", red: 1, amber: 0, green: 0, total: 1, value: 10 },
        ],
      },
    });
    expect(text).toContain("Marks & Spencer");
    expect(text).not.toContain("Marks &amp; Spencer");
  });

  it("states each section and the figures", () => {
    const { text } = render();
    expect(text).toContain("OCTOBER 2026 LEGAL REPORT");
    expect(text).toContain("Contracts reviewed in October 2026: 1");
    expect(text).toContain("Red-flag exposure: £250,000");
    expect(text).toContain("ESCALATIONS RAISED AND THEIR STATUS");
    expect(text).toContain("routed to CFO · Approved by Dana Reed");
    expect(text).toContain("RENEWALS DUE NEXT QUARTER");
    expect(text).toContain("Acme Supplies · Supply Agreement");
    expect(text).toContain("(Liability Cap)");
    expect(text).toContain("https://www.zanelegal.ai/portfolio");
  });

  it("says plainly when a section is empty rather than leaving it blank", () => {
    const { text } = render({ approvals: [] });
    expect(text).toContain("No escalations were raised in October 2026.");
  });
});
