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

/**
 * The bucket is shared. PocketBase's database archives sit at the root while
 * uploadsBackup writes contract files under uploads/ and a run marker under
 * _meta/. A listing that counts those reports the newest "backup" as a 0 MB
 * JSON file minutes old, and calls it healthy while saying nothing about the
 * database. This pins the filter that keeps the two apart.
 */
describe("which objects count as a database backup", () => {
  const isArchive = (key: string) => key.endsWith(".zip") && !key.includes("/");

  it("counts PocketBase's own archives", () => {
    expect(isArchive("@auto_pb_backup_acme_20261107030000.zip")).toBe(true);
    expect(isArchive("premigration_1794075380.zip")).toBe(true);
  });

  it("ignores the uploads backup's files and its run marker", () => {
    expect(isArchive("uploads/aaa111.pdf")).toBe(false);
    expect(isArchive("_meta/uploads-backup-last-run.json")).toBe(false);
    // The case that actually bit: a backed-up contract that happens to be a
    // zip would otherwise be counted as a database backup.
    expect(isArchive("uploads/contract-bundle.zip")).toBe(false);
  });
});
