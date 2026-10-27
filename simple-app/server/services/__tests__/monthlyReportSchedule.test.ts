/**
 * The two decisions the scheduled send makes before it touches anything: is it
 * switched on, and is it due.
 *
 * Both are worth a test for the same reason: their failure mode is silent.
 * A gate that reads a truthy string as "on" starts emailing named people
 * because a variable was set to "off", and a due check that matches the 1st
 * exactly skips the whole month when the server happened to be restarting.
 *
 * The pass itself is not tested here. It needs a database, so it is exercised
 * through scripts/send-monthly-report.ts, whose default is a dry run.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  isDue,
  isScheduledSendEnabled,
  MONTHLY_REPORT_ROLES,
  suppressPeriod,
} from "../monthlyReportSchedule";

const original = process.env.MONTHLY_REPORT_SEND;

afterEach(() => {
  if (original === undefined) delete process.env.MONTHLY_REPORT_SEND;
  else process.env.MONTHLY_REPORT_SEND = original;
});

describe("isScheduledSendEnabled", () => {
  it("is off when the variable is absent", () => {
    delete process.env.MONTHLY_REPORT_SEND;
    expect(isScheduledSendEnabled()).toBe(false);
  });

  it("accepts the explicit affirmatives, case and padding insensitive", () => {
    for (const value of ["on", "ON", " on ", "true", "1", "yes"]) {
      process.env.MONTHLY_REPORT_SEND = value;
      expect(isScheduledSendEnabled(), `"${value}" should enable`).toBe(true);
    }
  });

  it("treats anything else as off, including words that merely look set", () => {
    // The failure that matters: "off" is a set variable, and a truthiness
    // check on a string would read it as on and start sending.
    for (const value of ["off", "false", "0", "no", "", "disabled", "maybe"]) {
      process.env.MONTHLY_REPORT_SEND = value;
      expect(isScheduledSendEnabled(), `"${value}" should not enable`).toBe(false);
    }
  });
});

describe("isDue", () => {
  it("is false before the send hour on the 1st", () => {
    expect(isDue(new Date(2026, 10, 1, 6, 59))).toBe(false);
  });

  it("is true at the send hour on the 1st", () => {
    expect(isDue(new Date(2026, 10, 1, 7, 0))).toBe(true);
  });

  it("stays true later in the month, so a missed window still sends", () => {
    // The point of comparing against a timestamp rather than matching the 1st:
    // a server down from the 1st to the 3rd must still send October's report.
    expect(isDue(new Date(2026, 10, 3, 2, 0))).toBe(true);
    expect(isDue(new Date(2026, 10, 28, 23, 0))).toBe(true);
  });
});

describe("suppressPeriod", () => {
  /**
   * The period is interpolated into a PocketBase filter, which is a plain
   * string: a value carrying a double quote would close the literal and append
   * its own predicate. These reject before any query is built, so the test
   * needs no database.
   */
  it("rejects a malformed period rather than querying with it", async () => {
    for (const bad of ['2026-09" || id != "', "2026-9", "sept", "2026", "", "2026-09-01"]) {
      await expect(
        suppressPeriod("company123", bad, "test"),
        `"${bad}" should be rejected`,
      ).rejects.toThrow(/Malformed period/);
    }
  });
});

describe("MONTHLY_REPORT_ROLES", () => {
  it("is the finance and general-counsel pair, not every contact", () => {
    // BOARD gets the board pack on its own cadence; LEGAL is in the product
    // daily. Changing this changes who gets emailed, so it is asserted.
    expect([...MONTHLY_REPORT_ROLES]).toEqual(["CFO", "GC"]);
  });
});
