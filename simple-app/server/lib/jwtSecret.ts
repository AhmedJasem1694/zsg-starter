/**
 * Resolves the JWT signing secret, or refuses to run.
 *
 * This replaces a hardcoded fallback in server/middleware/auth.ts:
 *
 *   const JWT_SECRET = process.env.JWT_SECRET ?? "zane-dev-secret-change-in-production";
 *
 * That constant was committed to the repository and, with JWT_SECRET unset, it
 * was the live signing key. Anyone able to read the source could mint a token
 * for any userId and email and pass requireAuth on every authenticated route.
 * Nothing downstream would catch it: the payload carries no role, and the only
 * gate above requireAuth is an email allowlist that a forged token satisfies.
 *
 * The rule now:
 *
 *   production   JWT_SECRET must be set. If it is missing, or is the old
 *                committed default, the process refuses to start. A server
 *                that cannot authenticate safely should not accept traffic.
 *
 *   development  A random secret is generated and cached in .jwt-secret.local
 *                (gitignored) so restarts do not sign everyone out. It never
 *                leaves the machine that made it, and there is no shared
 *                constant for anyone to look up.
 *
 * Set one for production with:
 *
 *   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
 *
 * Changing the secret invalidates every existing session. That is the intended
 * effect when rotating away from a compromised one.
 */

import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";

/** The value that used to be compiled in. Treated as equivalent to unset. */
const LEAKED_DEFAULT = "zane-dev-secret-change-in-production";

/** Where a development secret is cached. Gitignored; never used in production. */
const DEV_SECRET_FILE = path.join(process.cwd(), ".jwt-secret.local");

/** Shorter than this is worth warning about, but not worth refusing to boot over. */
const WEAK_LENGTH = 32;

export class JwtSecretUnset extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwtSecretUnset";
  }
}

const PRODUCTION_MESSAGE = [
  "JWT_SECRET is not set, so the server will not start.",
  "",
  "Session tokens are signed with this value. Without it the server would fall",
  "back to a secret committed to the repository, and anyone who can read the",
  "source could forge a session for any user.",
  "",
  "Generate one:",
  "",
  "  node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
  "",
  "Then set JWT_SECRET in the environment and restart. Note that setting or",
  "changing it signs out every existing session, which is what you want when",
  "rotating away from the old default.",
].join("\n");

const REUSED_DEFAULT_MESSAGE = [
  "JWT_SECRET is set to the old committed default, so the server will not start.",
  "",
  "That value is in the repository's history and must be treated as public.",
  "Generate a fresh one:",
  "",
  "  node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
].join("\n");

function newSecret(): string {
  return randomBytes(48).toString("base64url");
}

/**
 * Development only. Cached on disk so `tsx --watch` restarts do not invalidate
 * the session on every file save. If the file cannot be read or written, fall
 * back to a per-process secret: logging in again beats refusing to run locally.
 */
function devSecret(): string {
  try {
    const existing = fs.readFileSync(DEV_SECRET_FILE, "utf8").trim();
    if (existing.length >= WEAK_LENGTH) return existing;
  } catch {
    // No cached secret yet, which is the normal first run.
  }

  const generated = newSecret();
  try {
    fs.writeFileSync(DEV_SECRET_FILE, `${generated}\n`, { mode: 0o600 });
    console.warn(
      `[auth] JWT_SECRET is not set. Generated a development secret and cached it in ${path.basename(DEV_SECRET_FILE)}. Set JWT_SECRET before deploying.`,
    );
  } catch {
    console.warn(
      "[auth] JWT_SECRET is not set and the development secret could not be cached. Using a per-process secret, so restarting will sign you out.",
    );
  }
  return generated;
}

let cached: string | null = null;

/**
 * The signing secret. Resolved once per process.
 *
 * @throws JwtSecretUnset in production when the value is missing or is the old
 *         committed default. server/env.ts catches this at boot and reports it
 *         before anything starts listening.
 */
export function resolveJwtSecret(): string {
  if (cached) return cached;

  const fromEnv = process.env.JWT_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === "production";

  if (fromEnv && fromEnv !== LEAKED_DEFAULT) {
    if (fromEnv.length < WEAK_LENGTH) {
      console.warn(
        `[auth] JWT_SECRET is shorter than ${WEAK_LENGTH} characters. Use at least 32 bytes of randomness.`,
      );
    }
    cached = fromEnv;
    return cached;
  }

  if (isProduction) {
    throw new JwtSecretUnset(fromEnv === LEAKED_DEFAULT ? REUSED_DEFAULT_MESSAGE : PRODUCTION_MESSAGE);
  }

  if (fromEnv === LEAKED_DEFAULT) {
    console.warn("[auth] JWT_SECRET is the old committed default. Replacing it with a local development secret.");
  }

  cached = devSecret();
  return cached;
}
