/**
 * Resolves the PocketBase superuser credentials, or refuses to run.
 *
 * This replaces hardcoded fallbacks in server/pb.ts:
 *
 *   _adminEmail    = process.env.POCKETBASE_ADMIN_EMAIL    ?? "admin@zane.local";
 *   _adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD ?? "changeme1234";
 *
 * Those credentials authenticate the shared client that performs every
 * database operation in the application, with no PocketBase API rules anywhere
 * to limit it. Whoever holds them can read, change or delete any row in any
 * collection, so a committed default is the whole database.
 *
 * The rule mirrors server/lib/jwtSecret.ts:
 *
 *   production   Both variables must be set, and neither may be the published
 *                development value. Otherwise the process refuses to start.
 *
 *   development  The documented local defaults are allowed, with a warning.
 *                Unlike the JWT secret these cannot be generated: they have to
 *                match the account created in the local PocketBase admin UI,
 *                so falling back to the documented pair is the useful
 *                behaviour rather than a security hole on a local instance.
 *
 * Rotating these means changing the superuser in the PocketBase admin UI and
 * updating the environment, not just editing the variables.
 */

/** Published in .env.example and CLAUDE.md, so both must be treated as public. */
const PUBLISHED_EMAIL = "admin@zane.local";
const PUBLISHED_PASSWORD = "changeme1234";

export interface PbCredentials {
  email: string;
  password: string;
}

export class PbCredentialsUnset extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PbCredentialsUnset";
  }
}

function productionMessage(reason: string): string {
  return [
    `${reason}, so the server will not start.`,
    "",
    "These credentials authenticate the client that performs every database",
    "operation. There are no PocketBase API rules in this project, so they are",
    "equivalent to full access to every company's data.",
    "",
    "Set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD in the",
    "environment to the superuser you created in the PocketBase admin UI.",
    "",
    "If the published development values are in use on a real instance, change",
    "the superuser's password in that UI first. Editing the variables alone",
    "leaves the old password working.",
  ].join("\n");
}

let cached: PbCredentials | null = null;

/**
 * The superuser credentials. Resolved once per process.
 *
 * @throws PbCredentialsUnset in production when either value is missing or is
 *         the published development value. server/env.ts catches this at boot.
 */
export function resolvePbCredentials(): PbCredentials {
  if (cached) return cached;

  const email = process.env.POCKETBASE_ADMIN_EMAIL?.trim();
  const password = process.env.POCKETBASE_ADMIN_PASSWORD?.trim();
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    if (!email || !password) {
      throw new PbCredentialsUnset(
        productionMessage("POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD is not set"),
      );
    }
    if (email === PUBLISHED_EMAIL || password === PUBLISHED_PASSWORD) {
      throw new PbCredentialsUnset(
        productionMessage("The PocketBase admin credentials are the published development values"),
      );
    }
    cached = { email, password };
    return cached;
  }

  if (!email || !password) {
    console.warn(
      "[pb] POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD is not set. Using the documented development values, which will only work against a local PocketBase set up with them.",
    );
  }

  cached = {
    email: email || PUBLISHED_EMAIL,
    password: password || PUBLISHED_PASSWORD,
  };
  return cached;
}
