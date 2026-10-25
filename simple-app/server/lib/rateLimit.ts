/**
 * Fixed-window rate limiting, in memory.
 *
 * Sized for the one public unauthenticated form on the site. The app runs as a
 * single Express process, so a module-level map is sufficient; if it is ever
 * run behind more than one instance each will keep its own count and the
 * effective limit multiplies by the instance count. Move to a shared store
 * before that happens.
 *
 * Entries are swept lazily on access rather than on a timer, so an idle
 * process holds nothing and there is no interval to clean up.
 */

interface Window {
  count: number;
  /** Epoch ms when this window opened. */
  startedAt: number;
}

const windows = new Map<string, Window>();

/** Sweep anything older than this on every call, so the map cannot grow forever. */
const SWEEP_AFTER_MS = 60 * 60 * 1000;

let lastSweep = 0;

function sweep(now: number, windowMs: number) {
  // At most once a minute, and only over what has certainly expired.
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  const cutoff = now - Math.max(windowMs, SWEEP_AFTER_MS);
  // forEach rather than for..of: the project's tsconfig target predates
  // downlevelIteration, so iterating a Map directly does not compile.
  const expired: string[] = [];
  windows.forEach((w, key) => {
    if (w.startedAt < cutoff) expired.push(key);
  });
  for (const key of expired) windows.delete(key);
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets. Only meaningful when allowed is false. */
  retryAfterSeconds: number;
}

/**
 * Count one attempt against `key`.
 *
 * @param key      Usually an IP address. Callers should namespace it, e.g. "access-request:1.2.3.4".
 * @param limit    Attempts permitted per window.
 * @param windowMs Window length in milliseconds.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now, windowMs);

  const existing = windows.get(key);
  if (!existing || now - existing.startedAt >= windowMs) {
    windows.set(key, { count: 1, startedAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.startedAt + windowMs - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Test seam. */
export function resetRateLimits() {
  windows.clear();
  lastSweep = 0;
}
