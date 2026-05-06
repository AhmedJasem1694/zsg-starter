import PocketBase from "pocketbase";

const POCKETBASE_URL = process.env.POCKETBASE_URL ?? "http://localhost:8090";

/**
 * Creates a fresh, unauthenticated PocketBase client.
 * Use this for user-facing auth operations (login, register) so they don't
 * overwrite the admin token stored on the shared `pb` singleton.
 */
export function newPBClient(): PocketBase {
  return new PocketBase(POCKETBASE_URL);
}

export const pb = new PocketBase(POCKETBASE_URL);

// Disable auto-cancellation — it's designed for browser UIs (cancel stale search
// requests on keystroke) but causes AbortErrors when server code makes concurrent
// requests to the same collection endpoint.
pb.autoCancellation(false);

let _adminEmail = "";
let _adminPassword = "";

export async function initPocketBase(): Promise<void> {
  _adminEmail = process.env.POCKETBASE_ADMIN_EMAIL ?? "admin@mike.local";
  _adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD ?? "changeme1234";

  await pb.admins.authWithPassword(_adminEmail, _adminPassword);
  console.log("[PocketBase] Admin authenticated");

  // Refresh admin token every 30 minutes (tokens expire after ~1 hour)
  setInterval(async () => {
    try {
      await pb.admins.authWithPassword(_adminEmail, _adminPassword);
    } catch (err) {
      console.error("[PocketBase] Token refresh failed:", err);
    }
  }, 30 * 60 * 1000);
}
