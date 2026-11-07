/**
 * The legal pages are drafts, and the thing that must not happen is a draft
 * quietly looking finished. The banner reports how many details are still to
 * be confirmed by counting them, so these pin the counter rather than the
 * count: an assertion on an exact number would just be re-typed whenever a
 * blank is filled, and would never catch the failure that matters.
 */

import { describe, expect, it } from "vitest";
import { PRIVACY, TERMS, LEGAL_BANNER, LEGAL_REVIEWER_PATTERN, outstandingGaps, reviewerChecklist } from "../legal";

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

/**
 * Blanks and reviewer notes are different things and must not be confused.
 *
 * A blank is a missing fact that belongs in the final text, like the company
 * number: it renders, marked, because a draft that hides its blanks looks
 * finished. A reviewer note is an instruction about the draft, like "confirm
 * with the solicitor whether EU GDPR applies": it must never reach a reader,
 * because publishing your worklist is not a form of honesty.
 */
describe("reviewer notes versus blanks", () => {
  const allText = (page: typeof PRIVACY) =>
    [page.updatedLabel, ...page.intro, ...page.blocks.flatMap((b) => [
      ...(b.paragraphs ?? []), ...(b.bullets ?? []),
      ...(b.rows ?? []).flatMap((r) => [r.label, r.value]),
    ])].join("\n");

  it("collects the solicitor's instructions", () => {
    const notes = [...reviewerChecklist(PRIVACY), ...reviewerChecklist(TERMS)];
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.join(" ")).toContain("EU GDPR");
  });

  it("does not count a reviewer note as an outstanding blank", () => {
    // The banner's number is only meaningful if it counts what a reader can
    // actually see waiting to be filled in.
    for (const page of [PRIVACY, TERMS]) {
      for (const gap of outstandingGaps(page)) {
        expect(gap).not.toContain("reviewing solicitor");
        expect(gap).not.toContain("confirm whether");
      }
    }
  });

  it("strips reviewer notes from what renders, leaving no stray brackets", () => {
    for (const page of [PRIVACY, TERMS]) {
      const rendered = allText(page).replace(LEGAL_REVIEWER_PATTERN, "");
      expect(rendered).not.toContain("[REVIEWER");
      expect(rendered).not.toContain("REVIEWER:");
    }
  });

  it("leaves the genuine blanks visible", () => {
    const blanks = [...outstandingGaps(PRIVACY), ...outstandingGaps(TERMS)].join(" ");
    expect(blanks).toContain("registered company name");
    expect(blanks).toContain("registered company number");
  });
});
