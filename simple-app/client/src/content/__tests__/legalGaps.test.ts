/**
 * The legal pages are drafts, and the thing that must not happen is a draft
 * quietly looking finished. The banner reports how many details are still to
 * be confirmed by counting them, so these pin the counter rather than the
 * count: an assertion on an exact number would just be re-typed whenever a
 * blank is filled, and would never catch the failure that matters.
 */

import { describe, expect, it } from "vitest";
import { PRIVACY, TERMS, LEGAL_BANNER, outstandingGaps } from "../legal";

describe("outstandingGaps", () => {
  it("finds the blanks a solicitor still has to fill", () => {
    const privacy = outstandingGaps(PRIVACY);
    const terms = outstandingGaps(TERMS);
    expect(privacy.length).toBeGreaterThan(0);
    expect(terms.length).toBeGreaterThan(0);
    // The facts only the business can supply, on both pages.
    expect(terms.join(" ")).toContain("registered company name");
    expect(privacy.join(" ")).toContain("registered company number");
  });

  it("returns the text inside the marker, not the marker itself", () => {
    for (const gap of [...outstandingGaps(PRIVACY), ...outstandingGaps(TERMS)]) {
      expect(gap).not.toContain("[TODO");
      expect(gap).not.toContain("]");
      expect(gap.trim()).toBe(gap);
    }
  });

  it("keeps the draft banner while any blank remains", () => {
    // Emptying LEGAL_BANNER is the deliberate act of putting the pages into
    // force. Doing it while blanks remain would publish a legal page that
    // still says "registered company name" where a name should be.
    const remaining = outstandingGaps(PRIVACY).length + outstandingGaps(TERMS).length;
    if (remaining > 0) expect(LEGAL_BANNER).not.toBe("");
  });
});
