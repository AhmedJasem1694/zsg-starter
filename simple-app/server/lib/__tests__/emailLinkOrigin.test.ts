/**
 * APP_URL is used exactly as configured for links inside emails. An earlier
 * version rewrote hosts known not to resolve; that is gone, so these now cover
 * the pass-through, the unset cases, and the invalid-URL guard.
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

  it("uses APP_URL exactly as configured, including a host that does not resolve", () => {
    // The apex has no DNS record for this deployment. It is no longer
    // rewritten: a misconfigured APP_URL produces unreachable links, which is
    // visible in /api/health rather than hidden behind a substitution.
    process.env.APP_URL = "https://zanelegal.ai";
    expect(emailLinkOrigin()).toBe("https://zanelegal.ai");
  });

  it("passes any configured host through untouched", () => {
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
});
