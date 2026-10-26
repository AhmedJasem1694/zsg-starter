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

/**
 * Hosts that are configured but do not resolve, mapped to the one that does.
 *
 * The apex has no DNS record pointing at this deployment, so every link built
 * on it is dead on arrival in someone's inbox. APP_URL has been set to it, and
 * correcting the variable turned out to mean finding which of four places it
 * was set in. A link in an approval email is not the right thing to leave
 * broken while that is sorted out, so the known-dead host is rewritten here
 * and the misconfiguration is logged rather than hidden.
 *
 * This is deliberately a narrow list of hosts proven not to resolve, not a
 * general rewrite. Anything else configured is passed through untouched.
 */
const UNREACHABLE_HOSTS = new Map<string, string>([
  ["zanelegal.ai", PREFERRED_ORIGIN],
]);

let warnedAboutAppUrl = false;

/**
 * Origin for links inside emails: approval requests, review links, drafts.
 *
 * Not the same as canonicalOrigin. That one answers which address should be
 * indexed; this one has to be an address a recipient can click, which is a
 * lower bar and a different failure mode.
 *
 * OAuth and webhook callback URLs are deliberately NOT routed through this.
 * Those have to match values registered with Google and Microsoft, so quietly
 * rewriting them would break the integration rather than fix a link.
 */
export function emailLinkOrigin(): string {
  const raw = process.env.APP_URL?.trim();

  if (!raw) {
    // Local development wants localhost; a deployment never does.
    return process.env.NODE_ENV === "production"
      ? PREFERRED_ORIGIN
      : "http://localhost:3000";
  }

  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    if (!warnedAboutAppUrl) {
      warnedAboutAppUrl = true;
      console.warn(`[email] APP_URL is not a valid URL (${raw}). Using ${PREFERRED_ORIGIN} for links.`);
    }
    return PREFERRED_ORIGIN;
  }

  const replacement = UNREACHABLE_HOSTS.get(host);
  if (replacement) {
    if (!warnedAboutAppUrl) {
      warnedAboutAppUrl = true;
      console.warn(
        `[email] APP_URL is set to ${raw}, whose host does not resolve. ` +
        `Links in emails use ${replacement} instead. Fix APP_URL: webhook and OAuth ` +
        `callback URLs still use it as given and are NOT rewritten.`,
      );
    }
    return replacement;
  }

  return stripTrailingSlashes(raw);
}
