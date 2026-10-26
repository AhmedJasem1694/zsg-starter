/**
 * Works out who a request came from, for rate limiting.
 *
 * req.ip is not reliable for this behind Railway. Express derives it from the
 * `trust proxy` setting, which is 1 here, so it takes the entry one hop from
 * the right of X-Forwarded-For. That is the correct choice for deciding
 * whether a connection arrived over HTTPS, which is why the setting exists,
 * but the number of hops in front of the app is a property of the platform,
 * not of the request. If an edge inserts an extra hop, req.ip becomes an
 * infrastructure address rather than the caller, and a limiter keyed on it
 * either buckets everyone together or scatters them, depending which way it
 * moves.
 *
 * The left-most X-Forwarded-For entry is the original client. It is
 * attacker-supplied and therefore spoofable, which matters when the stakes are
 * authorisation. Here the stake is a contact form: someone willing to forge a
 * header to send a seventh enquiry has already defeated a five-per-hour limit
 * by other means, and the honeypot and validation still apply. Correctly
 * bucketing ordinary traffic is worth more than resisting a determined forger.
 */

import type { Request } from "express";

/** IPv4, or IPv6, loosely. Enough to reject anything that is not an address. */
const IP_SHAPE = /^[0-9a-fA-F:.]{3,45}$/;

/** ::ffff:203.0.113.1 and 203.0.113.1 are the same client. */
function normalise(ip: string): string {
  const trimmed = ip.trim();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(trimmed);
  return (mapped ? mapped[1] : trimmed).toLowerCase();
}

export interface ClientIdentity {
  /** The address to key on. "unknown" when nothing usable was found. */
  ip: string;
  /** How many entries X-Forwarded-For carried. Useful when this misbehaves. */
  hops: number;
  /** Where the value came from, for diagnosis. */
  source: "x-forwarded-for" | "req.ip" | "socket" | "none";
}

export function clientIdentity(req: Request): ClientIdentity {
  const header = req.headers["x-forwarded-for"];
  const raw = Array.isArray(header) ? header.join(",") : header ?? "";
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);

  const first = parts[0] ? normalise(parts[0]) : "";
  if (first && IP_SHAPE.test(first)) {
    return { ip: first, hops: parts.length, source: "x-forwarded-for" };
  }

  const fromExpress = req.ip ? normalise(req.ip) : "";
  if (fromExpress && IP_SHAPE.test(fromExpress)) {
    return { ip: fromExpress, hops: parts.length, source: "req.ip" };
  }

  const fromSocket = req.socket.remoteAddress ? normalise(req.socket.remoteAddress) : "";
  if (fromSocket && IP_SHAPE.test(fromSocket)) {
    return { ip: fromSocket, hops: parts.length, source: "socket" };
  }

  return { ip: "unknown", hops: parts.length, source: "none" };
}
