import PocketBase from "pocketbase";

const POCKETBASE_URL = process.env.POCKETBASE_URL ?? "http://localhost:8090";

export const pb = new PocketBase(POCKETBASE_URL);

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
