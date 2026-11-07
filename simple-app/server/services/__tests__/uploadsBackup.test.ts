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
import { isUploadsBackupDue } from "../uploadsBackup";

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
