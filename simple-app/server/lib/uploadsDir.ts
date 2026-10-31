/**
 * Where uploaded contract files live.
 *
 * This was `path.join(process.cwd(), "uploads")` repeated at thirteen call
 * sites across seven files, which made the location both unconfigurable and
 * easy to get subtly wrong. It mattered more than duplication usually does:
 * the application server on Railway has no persistent storage attached, so
 * every redeploy destroyed the directory and the original documents in it.
 * The review results survived, because those are in the database; the files
 * people uploaded did not.
 *
 * Making the path a single configurable value is what lets a volume be
 * mounted somewhere and the application told about it, rather than depending
 * on the container's working directory being what we assume. Set UPLOAD_DIR
 * to the volume's mount path. Unset, it keeps the old behaviour, which is
 * what local development wants.
 */

import fs from "fs";
import path from "path";

/** Absolute path to the uploads directory. */
export const UPLOADS_DIR = path.resolve(
  process.env.UPLOAD_DIR?.trim() || path.join(process.cwd(), "uploads"),
);

/** Create it if it is not there. Safe to call repeatedly. */
export function ensureUploadsDir(): void {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Resolve a stored filename to its absolute path, refusing anything that
 * escapes the uploads directory.
 *
 * Most callers pass a nanoid generated at upload time, which is safe by
 * construction. Not all of them do: inbound email attachments arrive with
 * names chosen by whoever sent the message, and a name containing `..` would
 * otherwise resolve outside the directory. One guard here covers every call
 * site, which is the other reason this file exists.
 *
 * @throws if the name would escape, rather than returning a path a caller
 *         might then read or unlink.
 */
export function uploadPath(filename: string): string {
  const resolved = path.resolve(UPLOADS_DIR, filename);
  const root = UPLOADS_DIR.endsWith(path.sep) ? UPLOADS_DIR : UPLOADS_DIR + path.sep;
  if (resolved !== UPLOADS_DIR && !resolved.startsWith(root)) {
    throw new Error(`Refusing a filename that escapes the uploads directory: ${filename}`);
  }
  return resolved;
}

/** uploadPath, but null instead of throwing, for callers probing existence. */
export function uploadPathOrNull(filename: string): string | null {
  try {
    return uploadPath(filename);
  } catch {
    return null;
  }
}

/**
 * Whether uploads are going somewhere that survives a deploy, for /api/health.
 *
 * `configured` is the one that matters: false means UPLOAD_DIR is unset and
 * files are going to the working directory, which on a platform without a
 * mounted volume is destroyed on every deploy. That was true here for months
 * and nothing outside the container could show it.
 *
 * Deliberately reports no file count. This endpoint is public and how many
 * contracts have been uploaded is business data.
 */
export function uploadsHealth(): {
  dir: string;
  configured: boolean;
  exists: boolean;
  writable: boolean;
} {
  const configured = Boolean(process.env.UPLOAD_DIR?.trim());
  let exists = false;
  let writable = false;
  try {
    exists = fs.statSync(UPLOADS_DIR).isDirectory();
    fs.accessSync(UPLOADS_DIR, fs.constants.W_OK);
    writable = true;
  } catch {
    // Left false. A directory that is missing or unwritable is the failure
    // this field exists to surface, not something to throw over.
  }
  return { dir: UPLOADS_DIR, configured, exists, writable };
}
