/**
 * The limiter is only as good as the key it buckets on.
 *
 * In production, fourteen requests from one address never tripped a five per
 * hour limit. The service runs a single process, so it was not a counter split
 * across replicas: the key itself was not stable. These cover the shapes a
 * proxied request actually arrives in.
 */

import { describe, it, expect } from "vitest";
import type { Request } from "express";
import { clientIdentity } from "../clientIp";
import { rateLimit, resetRateLimits } from "../rateLimit";

function req(headers: Record<string, string | string[]>, ip?: string, socketIp?: string): Request {
  return {
    headers,
    ip,
    socket: { remoteAddress: socketIp },
  } as unknown as Request;
}

describe("clientIdentity", () => {
  it("takes the left-most forwarded entry, which is the original client", () => {
    const r = clientIdentity(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" }, "10.0.0.1"));
    expect(r).toEqual({ ip: "203.0.113.7", hops: 3, source: "x-forwarded-for" });
  });

  it("is stable when the platform adds a hop, which req.ip is not", () => {
    const before = clientIdentity(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }, "203.0.113.7"));
    const after = clientIdentity(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.9" }, "10.0.0.1"));
    expect(before.ip).toBe(after.ip);
    // req.ip moved from the client to an internal address; the key did not.
    expect(before.ip).toBe("203.0.113.7");
  });

  it("treats an IPv4-mapped IPv6 address as the same client", () => {
    expect(clientIdentity(req({}, "::ffff:203.0.113.7")).ip).toBe("203.0.113.7");
    expect(clientIdentity(req({ "x-forwarded-for": "::ffff:203.0.113.7" })).ip).toBe("203.0.113.7");
  });

  it("falls back to req.ip, then the socket, then unknown", () => {
    expect(clientIdentity(req({}, "198.51.100.4")).source).toBe("req.ip");
    expect(clientIdentity(req({}, undefined, "198.51.100.5")).source).toBe("socket");
    expect(clientIdentity(req({})).source).toBe("none");
    expect(clientIdentity(req({})).ip).toBe("unknown");
  });

  it("ignores a forwarded header that is not an address", () => {
    const r = clientIdentity(req({ "x-forwarded-for": "not-an-ip" }, "198.51.100.4"));
    expect(r.source).toBe("req.ip");
  });

  it("handles a repeated header, which Express gives as an array", () => {
    const r = clientIdentity(req({ "x-forwarded-for": ["203.0.113.7", "10.0.0.1"] }));
    expect(r.ip).toBe("203.0.113.7");
  });
});

describe("rateLimit", () => {
  it("allows up to the limit then refuses, per key", () => {
    resetRateLimits();
    const key = "access-request:203.0.113.7";
    for (let i = 0; i < 5; i++) expect(rateLimit(key, 5, 60_000).allowed).toBe(true);

    const sixth = rateLimit(key, 5, 60_000);
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfterSeconds).toBeGreaterThan(0);

    // A different caller is unaffected.
    expect(rateLimit("access-request:198.51.100.4", 5, 60_000).allowed).toBe(true);
  });

  it("a key that changes every request never reaches the limit", () => {
    // This is the production failure, reproduced: scattering the key across
    // requests makes the limiter inert without erroring.
    resetRateLimits();
    for (let i = 0; i < 20; i++) {
      expect(rateLimit(`access-request:10.0.0.${i}`, 5, 60_000).allowed).toBe(true);
    }
  });
});
