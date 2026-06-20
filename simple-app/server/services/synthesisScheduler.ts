/**
 * Automatic L3 synthesis regeneration.
 *
 * Synthesis used to regenerate only on a manual trigger (the Regenerate button /
 * POST /api/synthesis/generate). This scheduler makes the product compound on its
 * own: it counts new decision activity per company and, once enough has
 * accumulated, regenerates that company's synthesis pages server-side, with no one
 * needing to be on a page.
 *
 * Design:
 *  - Every recorded decision event (feedback, override, false positive, or a
 *    captured negotiation move) calls notifyDecisionActivity(companyId).
 *  - After THRESHOLD new events for a company, a regeneration is scheduled on a
 *    debounce so a burst of events coalesces into a single run.
 *  - A per-company in-flight guard means a company never synthesises twice
 *    concurrently; if more activity arrives mid-run, exactly one follow-up run is
 *    queued.
 *
 * Counters are in-memory and per-process, which is fine: synthesis is idempotent
 * and versioned, so at worst it runs once more than strictly necessary. The manual
 * trigger remains available and unchanged.
 */

import { synthesiseCompany } from "./synthesisEngine.js";

const THRESHOLD = 5;              // regenerate after this many new decision events
const DEBOUNCE_MS = 20_000;       // coalesce a burst into one run

const pendingCounts = new Map<string, number>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlight = new Set<string>();
const rerunQueued = new Set<string>();

/**
 * Record one new decision-activity event for a company. When the company crosses
 * the threshold, a debounced synthesis run is scheduled. Safe to call on every
 * decision event; cheap and non-blocking.
 */
export function notifyDecisionActivity(companyId: string | undefined): void {
  if (!companyId) return;
  const n = (pendingCounts.get(companyId) ?? 0) + 1;
  pendingCounts.set(companyId, n);
  if (n >= THRESHOLD) scheduleSynthesis(companyId);
}

function scheduleSynthesis(companyId: string): void {
  if (timers.has(companyId)) return; // already scheduled within the debounce window
  const timer = setTimeout(() => {
    timers.delete(companyId);
    pendingCounts.set(companyId, 0);
    void runGuarded(companyId);
  }, DEBOUNCE_MS);
  // Don't let the debounce timer hold the process open.
  if (typeof (timer as { unref?: () => void }).unref === "function") (timer as { unref: () => void }).unref();
  timers.set(companyId, timer);
}

/** Run synthesis for a company, guaranteeing no concurrent run for the same company. */
async function runGuarded(companyId: string): Promise<void> {
  if (inFlight.has(companyId)) {
    rerunQueued.add(companyId); // activity arrived mid-run; queue exactly one follow-up
    return;
  }
  inFlight.add(companyId);
  try {
    const result = await synthesiseCompany(companyId);
    console.log(`[synthesisScheduler] auto-regenerated synthesis for ${companyId}:`, JSON.stringify(result));
  } catch (err) {
    console.warn(`[synthesisScheduler] auto-regenerate for ${companyId} failed (non-fatal):`, (err as Error)?.message);
  } finally {
    inFlight.delete(companyId);
    if (rerunQueued.has(companyId)) {
      rerunQueued.delete(companyId);
      void runGuarded(companyId);
    }
  }
}
