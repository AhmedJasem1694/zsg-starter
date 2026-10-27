/**
 * Which origins may call the API with credentials.
 *
 * Extracted from the inline callback in server/index.ts because the rule it
 * encodes had a bug that was invisible where it sat: enforcement of the
 * allowlist was conditional on FRONTEND_URL being set.
 *
 * FRONTEND_URL means "the browser app is served from a different origin than
 * this API". That is a deployment shape, and it was being used as a switch for
 * whether cross-origin requests are checked at all, which is a security
 * control. The two have nothing to do with each other. A same-origin
 * deployment, which is what this is, would unset the variable to get
 * sameSite=lax cookies back and silently also turn the allowlist off, ending
 * up with `Access-Control-Allow-Origin: <any>` and `credentials: true` in
 * production.
 *
 * So: in production the allowlist is always enforced. FRONTEND_URL only
 * contributes an entry to it. In development everything is allowed, because a
 * developer may be serving the client from any port.
 *
 * Note this is not the CSRF boundary and was never load-bearing as one. CORS
 * does not preflight simple requests, so a cross-site form POST reaches the
 * route regardless of what is allowed here. The cookie's SameSite attribute is
 * what actually stops the browser attaching credentials to such a request.
 * See COOKIE_OPTS in server/routes.ts.
 */

/** Hosts this product is served from. Fixed product facts, like the canonical
 *  origin in canonicalOrigin.ts, not deployment secrets. */
const STATIC_ALLOWED = [
  "https://zanelegal.ai",
  "https://www.zanelegal.ai",
  "https://app.zanelegal.ai",
  "http://localhost:3000",
  "http://localhost:5173",
];

/** The full allowlist, including a separately-hosted frontend when there is one. */
export function allowedOrigins(): string[] {
  const frontend = process.env.FRONTEND_URL?.trim();
  return frontend ? [frontend, ...STATIC_ALLOWED] : [...STATIC_ALLOWED];
}

/**
 * @param origin  The request's Origin header. Undefined for same-origin
 *                requests, curl, and server-to-server callers such as the
 *                Mailgun, Google and Microsoft webhooks, all of which must
 *                continue to work.
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (allowedOrigins().includes(origin)) return true;
  // Development only. A deployment never falls through to here.
  return process.env.NODE_ENV !== "production";
}
