/**
 * Audit Trail Timestamp Backfill
 *
 * The audit_log collection originally had no `created` field, so legacy
 * entries carry no event time. This script:
 *
 *   1. Captures the real `created` values that exist (entries written after
 *      the timestamp fix landed) so they can be restored exactly.
 *   2. Replaces the autodate `created` field with a plain `date` field
 *      (PocketBase forbids in-place type changes, and autodate fields
 *      ignore manual writes). auditLogger stamps the field explicitly on
 *      every new write.
 *   3. Backfills legacy entries with plausible, internally consistent demo
 *      timestamps spread over the past 60 days:
 *        - Entries sharing an entityId form one workflow cluster and are
 *          ordered by the natural action sequence (upload, review started,
 *          anonymisation, clause results, completion, feedback, deletion).
 *        - Clusters for documents that still exist are anchored to the
 *          document's real upload time so the audit trail matches the
 *          Library dates.
 *        - Other clusters are spread deterministically (hash of entityId)
 *          across the window, during business hours.
 *        - user_login entries for a company spread across the days after
 *          that company's registration.
 *
 * Usage:
 *   npx tsx scripts/backfill-audit-timestamps.ts [--dry-run]
 */

import { config } from "dotenv";
config();

import PocketBase from "pocketbase";

const POCKETBASE_URL = process.env.POCKETBASE_URL ?? "http://localhost:8090";
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL ?? "admin@zane.local";
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD ?? "changeme1234";
const dryRun = process.argv.includes("--dry-run");

const pb = new PocketBase(POCKETBASE_URL);
pb.autoCancellation(false);

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

// Offsets (ms) from a cluster's base time, by action. rag_status_assigned and
// contradiction_detected additionally step by their index within the cluster
// so per-clause events read as a sequence, not a single instant.
const ACTION_OFFSET: Record<string, number> = {
  user_registered: 0,
  company_created: 2 * MIN,
  company_updated: 45 * MIN,
  playbook_updated: 20 * MIN,
  contract_uploaded: 0,
  review_started: 1 * MIN,
  pii_anonymisation_started: 1.5 * MIN,
  pii_anonymisation_completed: 3 * MIN,
  rag_status_assigned: 4 * MIN,
  contradiction_detected: 9 * MIN,
  review_completed: 13 * MIN,
  review_failed: 13 * MIN,
  feedback_accepted: 3 * 60 * MIN,
  contract_deleted: 2 * DAY,
};
const DEFAULT_OFFSET = 6 * MIN;

function fnv(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function toPBDate(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ");
}

/** Deterministic business-hours base within [start, end] for a cluster key. */
function hashedBase(key: string, start: number, end: number): number {
  const h = fnv(key);
  const span = end - start;
  let base = start + (h % 100000) / 100000 * span * 0.95;
  // Normalise to a business hour (08:00-18:00 UTC) on that day
  const d = new Date(base);
  d.setUTCHours(8 + (h % 10), h % 60, (h >> 6) % 60, h % 1000);
  base = d.getTime();
  return Math.min(Math.max(base, start), end);
}

async function main() {
  await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

  // Server "now" from a probe record (local clock may drift from PB's)
  const probe = await pb.collection("audit_log").create({ action: "backfill_probe", detail: "{}" });
  const serverNow = probe.created ? new Date(String(probe.created)).getTime() : Date.now();
  await pb.collection("audit_log").delete(probe.id);

  const windowEnd = serverNow - 60 * MIN;
  const windowStart = serverNow - 60 * DAY;
  console.log(`window: ${toPBDate(windowStart)} .. ${toPBDate(windowEnd)}`);

  // 1. Capture everything
  const entries = await pb.collection("audit_log").getFullList({
    fields: "id,action,entityType,entityId,created",
  });
  const real = new Map<string, string>();
  for (const e of entries) {
    if (e.created) real.set(e.id, String(e.created));
  }
  console.log(`entries: ${entries.length}, with real timestamps to preserve: ${real.size}`);

  // Live documents anchor their clusters to the real upload time
  const docs = await pb.collection("uploaded_documents").getFullList({ fields: "id,created" });
  const docCreated = new Map<string, number>();
  for (const d of docs) {
    if (d.created) docCreated.set(d.id, new Date(String(d.created)).getTime());
  }

  // 2. Field swap: autodate -> plain date (skipped on dry runs and re-runs)
  const col = await pb.collections.getOne("audit_log");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createdField = (col as any).fields.find((f: any) => f.name === "created");
  if (!createdField) throw new Error("audit_log has no created field, run pb:setup first");
  if (createdField.type === "autodate") {
    if (dryRun) {
      console.log("[dry-run] would replace autodate created field with plain date field");
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await pb.collections.update(col.id, { fields: (col as any).fields.filter((f: any) => f.name !== "created") });
      const fresh = await pb.collections.getOne("audit_log");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await pb.collections.update(fresh.id, { fields: [...(fresh as any).fields, { name: "created", type: "date" }] });
      console.log("created field replaced: autodate -> date (all values cleared, will be rewritten)");
    }
  } else {
    console.log(`created field already type=${createdField.type}, skipping swap`);
  }

  // 3. Cluster and compute timestamps
  const clusters = new Map<string, typeof entries>();
  for (const e of entries) {
    const key = String(e.entityId || "") || `solo:${e.id}`;
    const arr = clusters.get(key) ?? [];
    arr.push(e);
    clusters.set(key, arr);
  }
  console.log(`clusters: ${clusters.size}`);

  const plan = new Map<string, string>(); // entry id -> timestamp
  for (const [key, members] of clusters) {
    const anchored = docCreated.get(key);
    const base = anchored !== undefined
      ? Math.min(Math.max(anchored, windowStart), windowEnd)
      : hashedBase(key, windowStart, windowEnd);

    // Per-action index so repeated actions in a cluster step forward in time
    const seen = new Map<string, number>();
    for (const e of members) {
      if (real.has(e.id)) continue; // preserved exactly, not recomputed
      const action = String(e.action);
      const idx = seen.get(action) ?? 0;
      seen.set(action, idx + 1);

      let ts: number;
      if (action === "user_login") {
        // Logins spread across the days after the cluster base
        ts = base + ((fnv(e.id) % 100000) / 100000) * Math.max(windowEnd - base, DAY);
      } else {
        const offset = ACTION_OFFSET[action] ?? DEFAULT_OFFSET;
        const step = action === "rag_status_assigned" ? idx * 25 * 1000
                   : action === "contradiction_detected" ? idx * 60 * 1000
                   : idx * 90 * 1000;
        ts = base + offset + step;
      }
      plan.set(e.id, toPBDate(Math.min(Math.max(ts, windowStart), windowEnd)));
    }
  }

  // 4. Apply: computed values for legacy entries, captured values for real ones
  const writes: Array<[string, string]> = [
    ...plan.entries(),
    ...(createdField.type === "autodate" && !dryRun ? [...real.entries()] : dryRun ? [] : [...real.entries()]),
  ];
  console.log(`writes planned: ${writes.length} (${plan.size} backfilled, ${real.size} restored)`);

  if (dryRun) {
    const sample = [...plan.entries()].slice(0, 8);
    for (const [id, ts] of sample) {
      const e = entries.find((x) => x.id === id)!;
      console.log(`[dry-run] ${ts}  ${e.action}  entity=${e.entityId || "-"}`);
    }
    return;
  }

  let done = 0;
  const BATCH = 15;
  for (let i = 0; i < writes.length; i += BATCH) {
    await Promise.all(writes.slice(i, i + BATCH).map(([id, ts]) =>
      pb.collection("audit_log").update(id, { created: ts }).catch((err: unknown) => {
        console.warn(`  update failed for ${id}:`, (err as Error)?.message);
      })
    ));
    done = Math.min(i + BATCH, writes.length);
    if (done % 300 < BATCH) console.log(`  ${done}/${writes.length}`);
  }

  // 5. Verify
  const unstamped = await pb.collection("audit_log").getList(1, 1, { filter: `created = ""` });
  const newest = await pb.collection("audit_log").getList(1, 1, { sort: "-created" });
  const oldest = await pb.collection("audit_log").getList(1, 1, { sort: "+created", filter: `created != ""` });
  console.log(`done. unstamped remaining: ${unstamped.totalItems}`);
  console.log(`range: ${oldest.items[0]?.created} .. ${newest.items[0]?.created}`);
}

main().catch((err) => {
  const e = err as { message?: string; status?: number; response?: unknown };
  console.error("Backfill failed:", e?.message ?? err);
  if (e?.status !== undefined) console.error("  status:", e.status, "response:", JSON.stringify(e.response));
  process.exit(1);
});
