/**
 * The origin links in approval, review, draft and monthly-report emails are
 * built on.
 *
 * This used to cover a rewrite of one known-dead host, added while APP_URL
 * pointed at the apex. APP_URL is now correct at source and the rewrite is
 * gone, so the first test below is inverted on purpose: it asserts that the
 * apex passes through untouched. That is the test that fails if anyone
 * reintroduces a hardcoded rewrite, which would silently mask the next
 * misconfigured APP_URL.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { emailLinkOrigin } from "../canonicalOrigin";

const WWW = "https://www.zanelegal.ai";

describe("emailLinkOrigin", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...saved };
    vi.restoreAllMocks();
  });

  it("no longer rewrites the apex: what is configured is what is used", () => {
    // Was rewritten to www while APP_URL was wrong. Now a wrong APP_URL is
    // visible as a broken link instead of being quietly corrected here.
    process.env.APP_URL = "https://zanelegal.ai";
    expect(emailLinkOrigin()).toBe("https://zanelegal.ai");
  });

  it("leaves a host that does resolve exactly as configured", () => {
    process.env.APP_URL = "https://app.zanelegal.ai";
    expect(emailLinkOrigin()).toBe("https://app.zanelegal.ai");
  });

  it("passes an unrelated host through, for a deployment on its own domain", () => {
    process.env.APP_URL = "https://zane.customer.example";
    expect(emailLinkOrigin()).toBe("https://zane.customer.example");
  });

  it("strips a trailing slash so links do not double up", () => {
    process.env.APP_URL = "https://app.zanelegal.ai/";
    expect(emailLinkOrigin()).toBe("https://app.zanelegal.ai");
  });

  it("uses localhost in development when unset, so a dev send is clickable", () => {
    delete process.env.APP_URL;
    process.env.NODE_ENV = "development";
    expect(emailLinkOrigin()).toBe("http://localhost:3000");
  });

  it("never emits localhost from a production deployment", () => {
    delete process.env.APP_URL;
    process.env.NODE_ENV = "production";
    expect(emailLinkOrigin()).toBe(WWW);
  });

  it("falls back rather than emitting a malformed link", () => {
    process.env.APP_URL = "not a url";
    expect(emailLinkOrigin()).toBe(WWW);
  });

  it("falls back on a scheme no mail client will make clickable", () => {
    // Parses as a URL, so only a scheme check catches it.
    process.env.APP_URL = "ftp://zanelegal.ai";
    expect(emailLinkOrigin()).toBe(WWW);
  });
});
