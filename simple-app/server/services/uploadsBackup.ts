/**
 * Copies uploaded contract files off their volume and into object storage.
 *
 * PocketBase backs up the database daily, off-site and with a rehearsed
 * restore. It does not back up the files people upload: those live on a
 * separate volume mounted at UPLOAD_DIR, which the database backup never
 * touches. Losing that volume would lose every source document while leaving
 * the review results intact, and that asymmetry is what this closes.
 *
 * ── What it is, and is not ───────────────────────────────────────────────────
 *
 * A one-way copy, not a sync. Files are uploaded if the bucket has no object
 * of the same key and size, and nothing is ever deleted from the bucket. A
 * file deleted from the volume, by a user removing a contract or by anything
 * else, stays in the bucket until someone decides otherwise. That is the
 * conservative direction: a backup that mirrors deletions is not a backup.
 *
 * It only ever reads from the uploads directory. It cannot damage the live
 * upload path, which is the main reason it is a separate job rather than
 * something wired into the request that writes the file.
 *
 * ── Credentials ──────────────────────────────────────────────────────────────
 *
 * The same bucket PocketBase sends its database backups to, under a different
 * prefix. Reads S3_BUCKET / S3_REGION / S3_ENDPOINT / S3_ACCESS_KEY /
 * S3_SECRET from the environment and does nothing at all when they are
 * absent, so an unconfigured deployment is quiet rather than noisy.
 */

import fs from "fs";
import path from "path";
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { UPLOADS_DIR } from "../lib/uploadsDir.js";

/** Objects go under this prefix so they cannot collide with PocketBase's own
 *  database backups, which share the bucket. */
const PREFIX = "uploads/";

/** Never try to copy something implausible for a contract. A volume that has
 *  filled with something unexpected should not become an egress bill. */
const MAX_FILE_BYTES = 200 * 1024 * 1024;

export interface UploadsBackupStatus {
  configured: boolean;
  /** Files present in the uploads directory at the last run. */
  localFiles: number;
  /** Objects already in the bucket under the prefix at the last run. */
  remoteObjects: number;
  /** Copied up during the last run. */
  uploaded: number;
  failed: number;
  lastRunAt?: string;
  error?: string;
}

let status: UploadsBackupStatus = {
  configured: false, localFiles: 0, remoteObjects: 0, uploaded: 0, failed: 0,
};

function config() {
  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.S3_REGION?.trim();
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY?.trim();
  const secretAccessKey = process.env.S3_SECRET?.trim();
  if (!bucket || !region || !endpoint || !accessKeyId || !secretAccessKey) return null;
  return { bucket, region, endpoint, accessKeyId, secretAccessKey };
}

/** Files directly in the uploads directory. Not recursive: nothing writes
 *  subdirectories there, and lost+found is skipped explicitly. */
function localFiles(): Array<{ name: string; size: number }> {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(UPLOADS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: Array<{ name: string; size: number }> = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (e.name === "lost+found" || e.name.startsWith(".")) continue;
    try {
      const st = fs.statSync(path.join(UPLOADS_DIR, e.name));
      out.push({ name: e.name, size: st.size });
    } catch {
      // Disappeared between listing and stat. It will be caught next run.
    }
  }
  return out;
}

/**
 * Copy anything the bucket does not already have.
 *
 * Matching is on key and byte length. Uploaded filenames are generated
 * identifiers and the content behind one never changes, so a key that exists
 * at the right size is the same file. Comparing checksums would mean reading
 * every local file on every run to learn nothing.
 */
export async function runUploadsBackup(): Promise<UploadsBackupStatus> {
  const lastRunAt = new Date().toISOString();
  const cfg = config();
  if (!cfg) {
    status = { ...status, configured: false, lastRunAt };
    return status;
  }

  const s3 = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    // Railway's object storage is S3-compatible rather than S3, and compatible
    // endpoints generally address buckets by path. Same reasoning as the
    // forcePathStyle in scripts/enable-s3-backups.ts.
    forcePathStyle: true,
  });

  const files = localFiles();

  // What is already there, paged, because a listing is capped at 1000.
  const remote = new Map<string, number>();
  try {
    let token: string | undefined;
    do {
      const page = await s3.send(new ListObjectsV2Command({
        Bucket: cfg.bucket, Prefix: PREFIX, ContinuationToken: token,
      }));
      for (const o of page.Contents ?? []) {
        if (o.Key) remote.set(o.Key, Number(o.Size ?? -1));
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  } catch (err) {
    status = {
      configured: true, localFiles: files.length, remoteObjects: 0,
      uploaded: 0, failed: 0, lastRunAt,
      error: `Could not list the bucket: ${(err as Error)?.message}`,
    };
    return status;
  }

  let uploaded = 0;
  let failed = 0;
  for (const f of files) {
    const key = PREFIX + f.name;
    if (remote.get(key) === f.size) continue;
    if (f.size > MAX_FILE_BYTES) {
      failed++;
      console.warn(`[uploadsBackup] skipping ${f.name}: ${f.size} bytes exceeds the limit`);
      continue;
    }
    try {
      await s3.send(new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        // Streamed rather than read whole: these are documents, and there is
        // no reason to hold one in memory to hand it to the SDK.
        Body: fs.createReadStream(path.join(UPLOADS_DIR, f.name)),
        ContentLength: f.size,
      }));
      uploaded++;
    } catch (err) {
      failed++;
      console.warn(`[uploadsBackup] ${f.name} failed: ${(err as Error)?.message}`);
    }
  }

  status = {
    configured: true,
    localFiles: files.length,
    remoteObjects: remote.size,
    uploaded,
    failed,
    lastRunAt,
  };
  return status;
}

/** Last known state, for /api/health. No work done on the request path. */
export function lastUploadsBackupStatus(): UploadsBackupStatus | { checked: false } {
  if (!status.lastRunAt) return { checked: false };
  return status;
}

/**
 * The hour, UTC, this runs at. PocketBase takes the database backup at 03:00
 * UTC (settings.backups.cron "0 3 * * *"), and these two together are the
 * whole backup: the database and the files its rows point at. Taking them
 * hours apart would mean a restore pairing a database with files from a
 * different day, so they are deliberately the same time.
 */
const RUN_AT_UTC_HOUR = 3;

/** Checked hourly. The decision is a comparison against a timestamp, not a
 *  match on the hour, so a restart during the window does not skip a day. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** Today's run moment, in UTC. */
function dueMomentFor(now: Date): Date {
  return new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), RUN_AT_UTC_HOUR, 0, 0, 0,
  ));
}

/**
 * Has the run for today's window already happened?
 *
 * Exported for the test, because this is the whole scheduling argument and
 * the alternative, a plain 24-hour interval from boot, silently drifts: a
 * service that restarts at 14:00 backs up at 14:00 from then on, and a
 * service that restarts daily never backs up at all.
 */
export function isUploadsBackupDue(now: Date, lastRunAt?: string): boolean {
  const due = dueMomentFor(now);
  if (now.getTime() < due.getTime()) return false;
  if (!lastRunAt) return true;
  const last = new Date(lastRunAt).getTime();
  return isNaN(last) ? true : last < due.getTime();
}

/**
 * Check hourly and run once past 03:00 UTC each day.
 *
 * Quiet when unconfigured: a deployment without the S3 variables has not
 * asked for this, and a warning every hour would train someone to ignore the
 * log.
 */
export function startUploadsBackup(): void {
  const tick = () => {
    if (!config()) return;
    if (!isUploadsBackupDue(new Date(), status.lastRunAt)) return;

    runUploadsBackup()
      .then((s) => {
        if (s.error) {
          console.error(`[uploadsBackup] FAILED: ${s.error}`);
        } else if (s.failed > 0) {
          console.error(`[uploadsBackup] ${s.uploaded} copied, ${s.failed} FAILED of ${s.localFiles} local file(s). See warnings above for which.`);
        } else {
          console.log(`[uploadsBackup] ok: ${s.uploaded} new file(s) copied, ${s.localFiles} local, ${s.remoteObjects} already in the bucket.`);
        }
      })
      .catch((err) => console.error("[uploadsBackup] run error:", (err as Error)?.message));
  };

  // Soon after boot, so a deployment that happens after the window still
  // catches up the same day rather than waiting until tomorrow.
  setTimeout(tick, 2 * 60 * 1000);
  setInterval(tick, CHECK_INTERVAL_MS);
}
