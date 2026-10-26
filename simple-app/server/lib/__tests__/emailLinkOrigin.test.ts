/**
 * Links in approval and review emails were being built on a host with no DNS
 * record, so every one of them was dead on arrival. These cover the rewrite
 * and, as importantly, its limits.
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

  it("rewrites the apex, which has no DNS record for this deployment", () => {
    process.env.APP_URL = "https://zanelegal.ai";
    expect(emailLinkOrigin()).toBe(WWW);
  });

  it("leaves a host that does resolve exactly as configured", () => {
    process.env.APP_URL = "https://app.zanelegal.ai";
    expect(emailLinkOrigin()).toBe("https://app.zanelegal.ai");
  });

  it("is not a general rewrite: an unrelated host passes through", () => {
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
