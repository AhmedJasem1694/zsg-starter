/**
 * Watch-folder webhook auto-renewal.
 *
 * Google Drive push channels (~7 day TTL) and Microsoft Graph subscriptions
 * (~3 day TTL) expire. The renewal functions already exist
 * (renewGoogleWatch / renewSharePointSubscription) but nothing called them on a
 * schedule, so a connected watch folder would silently stop auto-reviewing once
 * its webhook lapsed. This background loop closes that gap: it periodically renews
 * any webhook due to expire soon.
 *
 * Fully defensive: a failure on one integration never affects the others, and the
 * loop never throws into the process.
 */

import { pb } from "../pb.js";
import { renewGoogleWatch } from "./googleDriveService.js";
import { renewSharePointSubscription } from "./sharePointService.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

// Renew anything expiring within this window. The loop runs more often than the
// shortest TTL, so a webhook is always renewed with comfortable margin.
const RENEW_WITHIN_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOOP_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

/** Scan all integrations and renew any webhook due to expire within the window. */
export async function renewExpiringWebhooks(): Promise<{ renewed: number; failed: number }> {
  let renewed = 0;
  let failed = 0;
  let configs: PBRecord[] = [];
  try {
    configs = await pb.collection("integration_configs").getFullList({
      filter: `webhookChannelId != ""`,
    });
  } catch {
    return { renewed, failed }; // collection may not exist
  }

  const cutoff = Date.now() + RENEW_WITHIN_MS;
  for (const cfg of configs) {
    const expiryRaw = String(cfg["webhookExpiry"] ?? "").trim();
    const expiry = expiryRaw ? new Date(expiryRaw).getTime() : NaN;
    // Renew if expiry is unknown (be safe) or within the window.
    if (!isNaN(expiry) && expiry > cutoff) continue;

    const provider = String(cfg["provider"] ?? "");
    try {
      if (provider === "google_drive") {
        await renewGoogleWatch(cfg.id as string);
      } else if (provider === "sharepoint") {
        await renewSharePointSubscription(cfg.id as string);
      } else {
        continue;
      }
      renewed++;
      console.log(`[integrationRenewal] renewed ${provider} webhook for ${cfg.id}`);
    } catch (err) {
      failed++;
      console.warn(`[integrationRenewal] renew ${provider} for ${cfg.id} failed (non-fatal):`, (err as Error)?.message);
      try {
        await pb.collection("integration_configs").update(cfg.id as string, {
          errorMessage: `Webhook renewal failed: ${(err as Error)?.message ?? "unknown"}`,
        });
      } catch { /* ignore */ }
    }
  }
  return { renewed, failed };
}

/**
 * Start the renewal loop. Runs once shortly after boot (so a webhook that lapsed
 * while the server was down is recovered), then every 6 hours.
 */
export function startIntegrationRenewalLoop(): void {
  // Initial run after a short delay so it doesn't compete with startup work.
  setTimeout(() => {
    renewExpiringWebhooks()
      .then((r) => { if (r.renewed || r.failed) console.log(`[integrationRenewal] initial pass: ${r.renewed} renewed, ${r.failed} failed`); })
      .catch((err) => console.error("[integrationRenewal] initial pass error:", err));
  }, 60 * 1000);

  setInterval(() => {
    renewExpiringWebhooks().catch((err) => console.error("[integrationRenewal] loop error:", err));
  }, LOOP_INTERVAL_MS);
}
