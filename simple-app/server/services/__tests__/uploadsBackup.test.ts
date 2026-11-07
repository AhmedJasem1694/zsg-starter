/**
 * When the uploads backup runs.
 *
 * The sync itself was exercised against the real bucket (copied, idempotent
 * on a second run, read back byte-identical). What is pinned here is the
 * scheduling, because the obvious implementation is wrong in a way nobody
 * notices: a plain 24-hour interval from boot drifts to whenever the service
 * last restarted, and a service that restarts daily never backs up at all.
 */

import { describe, expect, it } from "vitest";
import { isUploadsBackupDue, isUploadsBackupStale } from "../uploadsBackup";

const at = (iso: string) => new Date(iso);

describe("isUploadsBackupDue", () => {
  it("is not due before 03:00 UTC", () => {
    expect(isUploadsBackupDue(at("2026-11-07T02:59:00Z"), undefined)).toBe(false);
  });

  it("is due at 03:00 UTC when it has never run", () => {
    expect(isUploadsBackupDue(at("2026-11-07T03:00:00Z"), undefined)).toBe(true);
  });

  it("is not due again once it has run for today's window", () => {
    expect(isUploadsBackupDue(at("2026-11-07T09:00:00Z"), "2026-11-07T03:00:05Z")).toBe(false);
    expect(isUploadsBackupDue(at("2026-11-07T23:59:00Z"), "2026-11-07T03:00:05Z")).toBe(false);
  });

  it("is due again the next day", () => {
    expect(isUploadsBackupDue(at("2026-11-08T03:00:00Z"), "2026-11-07T03:00:05Z")).toBe(true);
  });

  it("catches up when the service was down across the window", () => {
    // The drift failure the interval version had: restarting at 14:00 must
    // still run today, not wait until 14:00 tomorrow.
    expect(isUploadsBackupDue(at("2026-11-07T14:00:00Z"), "2026-11-06T03:00:02Z")).toBe(true);
  });

  it("does not re-run after a restart later the same day", () => {
    // Having run at 03:00, a restart at 14:00 must not trigger a second run.
    expect(isUploadsBackupDue(at("2026-11-07T14:00:00Z"), "2026-11-07T03:00:02Z")).toBe(false);
  });

  it("treats an unparseable last-run as never having run", () => {
    expect(isUploadsBackupDue(at("2026-11-07T04:00:00Z"), "not a date")).toBe(true);
  });

  it("uses UTC, not the host's local midnight", () => {
    // 02:00 UTC is due nowhere; it is only the UTC hour that counts.
    expect(isUploadsBackupDue(at("2026-11-07T02:00:00Z"), undefined)).toBe(false);
    expect(isUploadsBackupDue(at("2026-11-07T03:30:00Z"), undefined)).toBe(true);
  });
});

/**
 * When the backup is overdue, which is a different question from when it is
 * due. The failure worth catching is the job silently ceasing to happen, and
 * that one is invisible: nothing errors, the health object just stops moving.
 */
describe("isUploadsBackupStale", () => {
  const files = 12;

  it("is not stale when a copy succeeded within the window", () => {
    expect(isUploadsBackupStale(at("2026-11-07T12:00:00Z"), "2026-11-07T03:00:00Z", files)).toBe(false);
    expect(isUploadsBackupStale(at("2026-11-08T12:00:00Z"), "2026-11-07T03:00:00Z", files)).toBe(false);
  });

  it("is stale once two windows have been missed", () => {
    expect(isUploadsBackupStale(at("2026-11-09T04:00:00Z"), "2026-11-07T03:00:00Z", files)).toBe(true);
  });

  it("is stale when no copy has ever succeeded", () => {
    expect(isUploadsBackupStale(at("2026-11-07T12:00:00Z"), undefined, files)).toBe(true);
  });

  it("is NOT stale when there is nothing to back up", () => {
    // The volume is currently almost empty. A monitor that complained daily
    // about an empty directory would be muted within a week, and then it
    // would not be there for the day that matters.
    expect(isUploadsBackupStale(at("2026-11-09T04:00:00Z"), undefined, 0)).toBe(false);
    expect(isUploadsBackupStale(at("2027-01-01T04:00:00Z"), "2026-11-01T03:00:00Z", 0)).toBe(false);
  });

  it("treats an unreadable marker as stale rather than as fresh", () => {
    // Fail towards complaining. The opposite reports a backup that may not
    // exist as healthy.
    expect(isUploadsBackupStale(at("2026-11-07T12:00:00Z"), "not a date", files)).toBe(true);
  });

  it("does not use recent uploads as the signal", () => {
    // The tempting shortcut, and wrong: this is a one-way copy that skips
    // files already in the bucket, so a backup can be complete and current
    // while nothing new has been uploaded for weeks. Only the run marker
    // moving proves the job still runs.
    const monthOldMarker = "2026-10-07T03:00:00Z";
    expect(isUploadsBackupStale(at("2026-11-07T04:00:00Z"), monthOldMarker, files)).toBe(true);
  });
});
