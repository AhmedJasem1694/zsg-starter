/**
 * Who may call the API cross-origin with credentials.
 *
 * The case that matters most is the one in the middle: production with
 * FRONTEND_URL unset. That used to allow every origin, because enforcement of
 * the allowlist was conditional on a variable describing a deployment shape.
 * It is the configuration this deployment now runs, so it is the one most
 * worth holding down.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { allowedOrigins, isOriginAllowed } from "../corsPolicy";

const saved = { ...process.env };

beforeEach(() => {
  delete process.env.FRONTEND_URL;
});

afterEach(() => {
  process.env = { ...saved };
});

describe("in production", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });

  it("allows the product's own hosts", () => {
    expect(isOriginAllowed("https://www.zanelegal.ai")).toBe(true);
    expect(isOriginAllowed("https://zanelegal.ai")).toBe(true);
    expect(isOriginAllowed("https://app.zanelegal.ai")).toBe(true);
  });

  it("refuses an unknown origin even with FRONTEND_URL unset", () => {
    // The regression this file exists for. Previously this returned true,
    // pairing Access-Control-Allow-Origin: <any> with credentials: true.
    expect(process.env.FRONTEND_URL).toBeUndefined();
    expect(isOriginAllowed("https://evil.example")).toBe(false);
  });

  it("refuses an unknown origin with FRONTEND_URL set", () => {
    process.env.FRONTEND_URL = "https://app.example.com";
    expect(isOriginAllowed("https://evil.example")).toBe(false);
  });

  it("allows a separately hosted frontend when one is configured", () => {
    process.env.FRONTEND_URL = "https://app.example.com";
    expect(isOriginAllowed("https://app.example.com")).toBe(true);
  });

  it("refuses a lookalike host", () => {
    expect(isOriginAllowed("https://zanelegal.ai.evil.example")).toBe(false);
    expect(isOriginAllowed("https://notzanelegal.ai")).toBe(false);
  });

  it("distinguishes scheme and port, because an origin is all three", () => {
    expect(isOriginAllowed("http://www.zanelegal.ai")).toBe(false);
    expect(isOriginAllowed("https://www.zanelegal.ai:8443")).toBe(false);
  });
});

describe("requests with no Origin header", () => {
  it("are allowed, so webhooks and server-to-server callers keep working", () => {
    // Mailgun, Google and Microsoft webhooks send no Origin. So does curl,
    // and so does a same-origin navigation.
    process.env.NODE_ENV = "production";
    expect(isOriginAllowed(undefined)).toBe(true);
    expect(isOriginAllowed("")).toBe(true);
  });
});

describe("in development", () => {
  it("allows anything, because the client may be on any port", () => {
    process.env.NODE_ENV = "development";
    expect(isOriginAllowed("http://localhost:4321")).toBe(true);
    expect(isOriginAllowed("https://anything.example")).toBe(true);
  });
});

describe("allowedOrigins", () => {
  it("lists the product hosts and omits a frontend entry when unset", () => {
    expect(allowedOrigins()).toEqual([
      "https://zanelegal.ai",
      "https://www.zanelegal.ai",
      "https://app.zanelegal.ai",
      "http://localhost:3000",
      "http://localhost:5173",
    ]);
  });

  it("puts a configured frontend first without dropping the rest", () => {
    process.env.FRONTEND_URL = "https://app.example.com";
    const list = allowedOrigins();
    expect(list[0]).toBe("https://app.example.com");
    expect(list).toContain("https://www.zanelegal.ai");
  });
});
