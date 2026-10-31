/**
 * The health report for backups.
 *
 * The case worth pinning is the cold one. For the window after every restart
 * nothing has been read yet, and the zeroed struct would assert
 * `scheduled: false` and `offsite: false`. Here that is not an unknown, it is
 * the opposite of the truth, and it would tell anyone checking health just
 * after a deploy that backups are switched off.
 */

import { describe, expect, it, vi } from "vitest";

async function freshModule() {
  vi.resetModules();
  return import("../backupHealth");
}

describe("before anything has been checked", () => {
  it("asserts nothing rather than reporting zeros", async () => {
    const m = await freshModule();
    const s = m.lastBackupStatus();
    expect(s).toEqual({ checked: false });
    // The failure this guards against: a reader seeing scheduled:false and
    // concluding there is no backup schedule.
    expect(s).not.toHaveProperty("scheduled", false);
    expect(s).not.toHaveProperty("offsite", false);
  });

  it("does not claim healthy either way", async () => {
    const m = await freshModule();
    expect(m.lastBackupStatus()).not.toHaveProperty("healthy", true);
    expect(m.lastBackupStatus()).not.toHaveProperty("healthy", false);
  });
});
