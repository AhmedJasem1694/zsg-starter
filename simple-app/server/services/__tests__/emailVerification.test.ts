/**
 * Whether a configured email credential actually works.
 *
 * This exists because of a real incident: RESEND_API_KEY was set to the
 * literal placeholder from a copy-pasted command. Every presence check passed,
 * /api/health reported transport "resend" and configured true, and nothing was
 * deliverable. Had it survived to a send window, the monthly report would have
 * claimed the reporting period, failed every recipient, and left the month
 * closed.
 *
 * The distinction these pin is between "the provider rejected this" and "we
 * could not get an answer". The first is a standing fault. The second says
 * nothing about the key, must never be recorded as a rejection, and must also
 * never be read as permission to proceed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const RESEND_DOMAINS = "https://api.resend.com/domains";

/**
 * emailService reads RESEND_API_KEY at module load, so the environment has to
 * be set before importing and the module registry reset between cases.
 */
async function loadWith(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return import("../emailService");
}

const saved = { ...process.env };

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
});

afterEach(() => {
  process.env = { ...saved };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("a key the provider accepts", () => {
  it("verifies as valid, and email is usable when the domain is verified too", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      expect(url).toBe(RESEND_DOMAINS);
      return new Response(
        JSON.stringify({ data: [{ name: "zanelegal.ai", status: "verified" }] }),
        { status: 200 },
      );
    }));
    const m = await loadWith({
      RESEND_API_KEY: "re_live_realkey",
      SMTP_FROM: "Zane <approvals@zanelegal.ai>",
    });
    const v = await m.emailVerification(true);
    expect(v.state).toBe("valid");
    expect(v.checkedAt).toBeTruthy();
    expect(await m.isEmailUsable()).toBe(true);
  });
});

describe("a key the provider rejects", () => {
  // Resend answered 400 for the placeholder, not 401, so both must count.
  it.each([
    [400, '{"statusCode":400,"message":"API key is invalid"}'],
    [401, '{"message":"Unauthorized"}'],
    [403, '{"message":"Forbidden"}'],
  ])("treats %i as invalid", async (status, body) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status })));
    const m = await loadWith({ RESEND_API_KEY: "re_your_key_here" });
    const v = await m.emailVerification(true);
    expect(v.state).toBe("invalid");
    expect(v.error).toContain(String(status));
    expect(await m.isEmailUsable()).toBe(false);
  });

  it("never puts the credential in the error", async () => {
    const secret = "re_super_secret_value";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    const m = await loadWith({ RESEND_API_KEY: secret });
    const v = await m.emailVerification(true);
    expect(JSON.stringify(v)).not.toContain(secret);
  });

  it("still reports configured true, which is the point", async () => {
    // configured means "a key is set". Verification means "it works". The two
    // disagreeing is exactly the state that previously looked healthy.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad", { status: 401 })));
    const m = await loadWith({ RESEND_API_KEY: "re_junk" });
    await m.emailVerification(true);
    const s = m.emailStatus();
    expect(s.configured).toBe(true);
    expect(s.transport).toBe("resend");
    expect(s.verification.state).toBe("invalid");
  });
});

describe("when the provider cannot be reached", () => {
  it("is unreachable, not invalid, on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ENOTFOUND"); }));
    const m = await loadWith({ RESEND_API_KEY: "re_probably_fine" });
    const v = await m.emailVerification(true);
    expect(v.state).toBe("unreachable");
    // A DNS blip is not evidence of a bad key.
    expect(v.state).not.toBe("invalid");
  });

  it("is unreachable, not invalid, on a provider 5xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("upstream", { status: 503 })));
    const m = await loadWith({ RESEND_API_KEY: "re_probably_fine" });
    expect((await m.emailVerification(true)).state).toBe("unreachable");
  });

  it("is still not usable, because unconfirmed is not a yes", async () => {
    // The caller asking is about to claim a reporting period it cannot undo.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNRESET"); }));
    const m = await loadWith({ RESEND_API_KEY: "re_probably_fine" });
    expect(await m.isEmailUsable()).toBe(false);
  });
});

describe("the sending domain, which a valid key says nothing about", () => {
  const domains = (data: unknown) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data }), { status: 200 })));

  it("is usable when the from-domain is verified", async () => {
    domains([{ name: "zanelegal.ai", status: "verified" }]);
    const m = await loadWith({ RESEND_API_KEY: "re_live", SMTP_FROM: "Zane <approvals@zanelegal.ai>" });
    const v = await m.emailVerification(true);
    expect(v.state).toBe("valid");
    expect(v.sendingDomain).toEqual({ name: "zanelegal.ai", status: "verified", verified: true });
    expect(await m.isEmailUsable()).toBe(true);
    expect(await m.emailBlocker()).toBeNull();
  });

  it("is NOT usable when the key is good but the domain is still pending", async () => {
    // The 403-on-send case: nothing about the credential is wrong, and every
    // send would still be refused.
    domains([{ name: "zanelegal.ai", status: "pending" }]);
    const m = await loadWith({ RESEND_API_KEY: "re_live", SMTP_FROM: "Zane <approvals@zanelegal.ai>" });
    expect((await m.emailVerification(true)).state).toBe("valid");
    expect(await m.isEmailUsable()).toBe(false);
    expect(await m.emailBlocker()).toContain("sending domain zanelegal.ai");
  });

  it("is NOT usable when the from-domain is not registered at all", async () => {
    domains([{ name: "someone-else.com", status: "verified" }]);
    const m = await loadWith({ RESEND_API_KEY: "re_live", SMTP_FROM: "Zane <approvals@zanelegal.ai>" });
    expect((await m.emailVerification(true)).sendingDomain?.status).toBe("not listed");
    expect(await m.isEmailUsable()).toBe(false);
  });

  it("does not block when the domain list cannot be parsed", async () => {
    // Fail soft: an unreadable response is not evidence that sending is broken.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not json", { status: 200 })));
    const m = await loadWith({ RESEND_API_KEY: "re_live", SMTP_FROM: "Zane <approvals@zanelegal.ai>" });
    const v = await m.emailVerification(true);
    expect(v.state).toBe("valid");
    expect(v.sendingDomain).toBeUndefined();
    expect(await m.isEmailUsable()).toBe(true);
  });

  it("reads the domain out of either SMTP_FROM spelling", async () => {
    domains([]);
    const angled = await loadWith({ RESEND_API_KEY: "re_live", SMTP_FROM: "Zane <approvals@zanelegal.ai>" });
    expect(angled.sendingDomain()).toBe("zanelegal.ai");
    const bare = await loadWith({ RESEND_API_KEY: "re_live", SMTP_FROM: "approvals@ZaneLegal.AI" });
    expect(bare.sendingDomain()).toBe("zanelegal.ai");
  });
});

describe("with no transport configured", () => {
  it("makes no network call at all", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const m = await loadWith({ RESEND_API_KEY: undefined });
    expect(await m.isEmailUsable()).toBe(false);
    expect(m.emailStatus().transport).toBe("none");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("caching", () => {
  it("does not re-check within the TTL unless forced", async () => {
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const m = await loadWith({ RESEND_API_KEY: "re_live" });

    await m.emailVerification(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await m.emailVerification();      // cached
    await m.emailVerification();      // cached
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await m.emailVerification(true);  // forced, as the monthly report does
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("collapses concurrent checks into one request", async () => {
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const m = await loadWith({ RESEND_API_KEY: "re_live" });

    await Promise.all([
      m.emailVerification(true),
      m.emailVerification(true),
      m.emailVerification(true),
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("reports unchecked before anything has run", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    const m = await loadWith({ RESEND_API_KEY: "re_live" });
    expect(m.lastEmailVerification().state).toBe("unchecked");
  });
});

/**
 * The reason string the approvals audit record and the contact-form log both
 * write. It used to be a two-way guess from whether a key was set, which named
 * SMTP on a Resend deployment and recorded a rejected credential as a
 * transient "send failed".
 */
describe("emailBlocker wording", () => {
  it("names the missing variables when nothing is configured", async () => {
    const m = await loadWith({ RESEND_API_KEY: undefined });
    expect(await m.emailBlocker()).toContain("not configured");
    expect(await m.emailBlocker()).toContain("RESEND_API_KEY");
  });

  it("says the credential was rejected, not that the send failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad", { status: 401 })));
    const m = await loadWith({ RESEND_API_KEY: "re_junk" });
    const why = await m.emailBlocker(true);
    expect(why).toContain("rejected");
    expect(why).not.toContain("not configured");
  });

  it("distinguishes could-not-verify from rejected", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ENOTFOUND"); }));
    const m = await loadWith({ RESEND_API_KEY: "re_live" });
    const why = await m.emailBlocker(true);
    expect(why).toContain("could not verify");
    expect(why).not.toContain("rejected");
  });

  it("names the unverified sending domain", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ name: "zanelegal.ai", status: "pending" }] }), { status: 200 })));
    const m = await loadWith({ RESEND_API_KEY: "re_live", SMTP_FROM: "Zane <approvals@zanelegal.ai>" });
    expect(await m.emailBlocker(true)).toContain("zanelegal.ai");
  });

  it("is null when everything works, so callers can treat it as the only gate", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ name: "zanelegal.ai", status: "verified" }] }), { status: 200 })));
    const m = await loadWith({ RESEND_API_KEY: "re_live", SMTP_FROM: "Zane <approvals@zanelegal.ai>" });
    expect(await m.emailBlocker(true)).toBeNull();
  });
});
