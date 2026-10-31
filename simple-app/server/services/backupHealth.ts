/**
 * Whether the database is actually being backed up.
 *
 * PocketBase takes the backups itself, on a cron set in its settings. That is
 * the right mechanism: it snapshots consistently, which matters here because
 * the database runs in WAL mode and a plain file copy taken mid-write can be
 * torn. Nothing in this file takes a backup.
 *
 * What this file does is notice when they stop. A backup schedule that
 * silently stopped running is worse than having none, because the first state
 * is believed and the second is known, and both lose the same data. Until
 * now, nothing outside PocketBase's own settings page could tell you which
 * one you were in.
 *
 * ── What this does NOT give you ──────────────────────────────────────────────
 *
 * With S3 disabled, PocketBase writes backups into pb_data/backups, on the
 * same volume as the database. That protects against an accidental delete, a
 * bad migration, or logical corruption. It protects against nothing at the
 * hosting layer: lose the volume and the backups go with it. `offsite` is
 * reported precisely so that distinction is visible rather than assumed, and
 * NOT_YET_CLAIMS.backups stays honest about it.
 */

import { pb } from "../pb.js";

export interface BackupStatus {
  /** A cron expression is configured, so PocketBase will take them. */
  scheduled: boolean;
  cron: string;
  /** How many PocketBase keeps before rotating the oldest out. */
  keep: number;
  /** True only when backups leave this volume. S3 is the only way today. */
  offsite: boolean;
  /** The most recent backup, if any. */
  latest: { key: string; sizeMB: number; ageHours: number } | null;
  /** How many exist right now. */
  count: number;
  /**
   * Scheduled, and a backup exists that is recent enough to believe the
   * schedule is still running. Null when it has not been checked yet.
   */
  healthy: boolean | null;
  checkedAt?: string;
  error?: string;
}

/**
 * A daily cron means a backup should never be much more than 24 hours old.
 * 48 allows one missed run, or a restart near the scheduled time, without
 * crying wolf. Anything older means the schedule is not running.
 */
const STALE_AFTER_HOURS = 48;

const TTL_MS = 15 * 60 * 1000;

let cached: BackupStatus = {
  scheduled: false, cron: "", keep: 0, offsite: false,
  latest: null, count: 0, healthy: null,
};
let inFlight: Promise<BackupStatus> | null = null;

function isFresh(s: BackupStatus): boolean {
  return Boolean(s.checkedAt) && Date.now() - new Date(s.checkedAt!).getTime() < TTL_MS;
}

async function run(): Promise<BackupStatus> {
  const checkedAt = new Date().toISOString();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = (await pb.settings.getAll()) as any;
    const b = settings?.backups ?? {};
    const cron = String(b.cron ?? "");
    const scheduled = cron.trim() !== "";
    const offsite = Boolean(b.s3?.enabled);

    const files = await pb.backups.getFullList();
    const sorted = [...files].sort(
      (x, y) => new Date(String(y.modified)).getTime() - new Date(String(x.modified)).getTime(),
    );
    const newest = sorted[0];
    const latest = newest
      ? {
          key: String(newest.key),
          sizeMB: Math.round((Number(newest.size) / 1048576) * 10) / 10,
          ageHours: Math.round(
            ((Date.now() - new Date(String(newest.modified)).getTime()) / 3600000) * 10,
          ) / 10,
        }
      : null;

    return {
      scheduled,
      cron,
      keep: Number(b.cronMaxKeep ?? 0),
      offsite,
      latest,
      count: files.length,
      // A schedule with no backup yet is not healthy, it is unproven.
      healthy: scheduled && latest !== null && latest.ageHours <= STALE_AFTER_HOURS,
      checkedAt,
    };
  } catch (err) {
    return {
      ...cached,
      healthy: null,
      checkedAt,
      error: `Could not read backup state: ${(err as Error)?.message}`,
    };
  }
}

/** Current state, re-reading when the cache has gone stale. */
export async function backupStatus(force = false): Promise<BackupStatus> {
  if (!force && isFresh(cached)) return cached;
  if (inFlight) return inFlight;
  inFlight = run()
    .then((s) => { cached = s; return s; })
    .finally(() => { inFlight = null; });
  return inFlight;
}

/**
 * Cached state with no network call, for the health endpoint.
 *
 * Kicks off a refresh when stale and returns what it has rather than waiting,
 * so /api/health stays fast and still converges.
 *
 * Before the first read completes it returns `{ checked: false }` and nothing
 * else. The obvious alternative, returning the zeroed struct, asserts
 * `scheduled: false` and `offsite: false` during the window after every
 * restart, which is not merely unknown but the precise opposite of the truth
 * here, and would tell anyone looking at health just after a deploy that
 * backups are switched off.
 */
export function lastBackupStatus(): BackupStatus | { checked: false } {
  if (!isFresh(cached) && !inFlight) void backupStatus().catch(() => { /* reported in state */ });
  if (!cached.checkedAt) return { checked: false };
  return cached;
}

/**
 * Check at boot and periodically, and say so in the log when it is wrong.
 *
 * Six hours, not daily: the point is to notice within a working day, and the
 * check costs two API calls against a database on the same network.
 */
export function startBackupMonitor(): void {
  const check = () => {
    backupStatus(true)
      .then((s) => {
        if (s.error) {
          console.warn(`[backups] ${s.error}`);
        } else if (!s.scheduled) {
          console.error(
            "[backups] NO BACKUP SCHEDULE. PocketBase's backups.cron is empty, so nothing is " +
            "being backed up. Set it in the PocketBase admin UI, or see docs/region-migration-runbook.md.",
          );
        } else if (!s.healthy) {
          const age = s.latest ? `${s.latest.ageHours}h old` : "none exist";
          console.error(
            `[backups] SCHEDULE IS SET (${s.cron}) BUT NOT RUNNING: newest backup ${age}. ` +
            "Backups are believed to be happening and are not.",
          );
        } else if (!s.offsite) {
          console.warn(
            `[backups] ${s.count} backup(s), newest ${s.latest?.ageHours}h old, kept on the same ` +
            "volume as the database. Losing the volume loses the backups. Enable S3 in PocketBase for off-site copies.",
          );
        }
      })
      .catch((err) => console.warn("[backups] monitor error:", (err as Error)?.message));
  };

  setTimeout(check, 45 * 1000);
  setInterval(check, 6 * 60 * 60 * 1000);
}
