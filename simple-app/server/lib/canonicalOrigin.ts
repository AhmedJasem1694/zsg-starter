/**
 * The origin used for canonical and Open Graph URLs.
 *
 * This used to come from APP_URL, which was the wrong source twice over.
 *
 * First, APP_URL answers a different question. It is the origin used to build
 * links inside emails, so it must be a host that resolves and that a recipient
 * can click. A canonical tag answers "of the several addresses this page is
 * reachable at, which is the one search engines should index". Those happen to
 * coincide on a healthy deployment and came apart on this one: APP_URL points
 * at the apex, which does not resolve, so the site advertised an unreachable
 * canonical and share cards pointed at an image nobody could fetch.
 *
 * Second, the preferred public host is not a deployment secret. It is a fixed
 * product fact, in the same category as the allowedOrigins list in
 * server/index.ts, which already names these hosts in source. Putting it in an
 * environment variable bought nothing and cost several deploys when the
 * variable turned out to be set in four different places.
 *
 * So: the preferred host is named here, every alias canonicalises to it, and
 * anything else, a preview deployment or localhost, canonicalises to itself.
 * SITE_URL remains as an override for a deployment that genuinely needs one.
 */

import type { Request } from "express";

/** The address this site should be indexed under. */
const PREFERRED_ORIGIN = "https://www.zanelegal.ai";

/**
 * Hosts that serve the same content and must point at PREFERRED_ORIGIN rather
 * than at themselves. Without this, app.zanelegal.ai would declare itself
 * canonical and compete with www for the same pages.
 */
const ALIASES = new Set(["zanelegal.ai", "www.zanelegal.ai", "app.zanelegal.ai"]);

const stripTrailingSlashes = (s: string) => s.replace(/\/+$/, "");

/**
 * @param req  Used only to read the host. Omit it and the preferred origin is
 *             returned, which is the right answer when there is no request,
 *             for example when generating something at build time.
 */
export function canonicalOrigin(req?: Request): string {
  const override = process.env.SITE_URL?.trim();
  if (override) return stripTrailingSlashes(override);

  const host = req?.get("host")?.trim().toLowerCase();
  if (!host) return PREFERRED_ORIGIN;

  // Compare without a port so localhost:3000 still matches a bare entry.
  const bare = host.replace(/:\d+$/, "");
  if (ALIASES.has(bare)) return PREFERRED_ORIGIN;

  // A preview deployment or local run is canonical unto itself. Anything else
  // would tell a crawler to index an address this response did not come from.
  const protocol = req?.protocol === "http" ? "http" : "https";
  return `${protocol}://${host}`;
}

export const PREFERRED_PUBLIC_ORIGIN = PREFERRED_ORIGIN;

// ── Links inside emails ───────────────────────────────────────────────────────

let warnedAboutAppUrl = false;

/**
 * Origin for links inside emails: approval requests, review links, drafts,
 * the monthly report.
 *
 * Not the same as canonicalOrigin. That one answers which address should be
 * indexed; this one has to be an address a recipient can click, which is a
 * lower bar and a different failure mode.
 *
 * This used to rewrite one known-dead host. APP_URL was set to the apex, which
 * has no DNS record for this deployment, so every link built on it arrived
 * dead, and correcting the variable meant first finding which of four places
 * it was set in. The rewrite kept approval links working while that was sorted
 * out. APP_URL is now correct at source, so it is gone: kept any longer it
 * would mask the next misconfiguration rather than surface it, and it never
 * covered the OAuth and webhook callback URLs that read APP_URL directly, so
 * it was never the whole fix.
 *
 * What remains is validation, which is not the same thing. A missing or
 * malformed APP_URL still falls back to the preferred origin in production
 * rather than emitting a broken link, and says so once. A host that resolves
 * to nothing is now somebody's job to fix, not this function's to paper over.
 */
export function emailLinkOrigin(): string {
  const raw = process.env.APP_URL?.trim();

  if (!raw) {
    // Local development wants localhost; a deployment never does.
    return process.env.NODE_ENV === "production"
      ? PREFERRED_ORIGIN
      : "http://localhost:3000";
  }

  try {
    const { protocol } = new URL(raw);
    // A URL parses but is useless in an inbox unless a mail client will make
    // it clickable, so the scheme is checked rather than assumed.
    if (protocol !== "https:" && protocol !== "http:") {
      throw new Error(`unsupported scheme ${protocol}`);
    }
  } catch (err) {
    if (!warnedAboutAppUrl) {
      warnedAboutAppUrl = true;
      console.warn(
        `[email] APP_URL is not a usable URL (${raw}: ${(err as Error).message}). ` +
        `Using ${PREFERRED_ORIGIN} for links.`,
      );
    }
    return PREFERRED_ORIGIN;
  }

  return stripTrailingSlashes(raw);
}
