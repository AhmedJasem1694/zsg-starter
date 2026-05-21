/**
 * PocketBase Collection Export Script
 *
 * Connects to a running PocketBase instance and dumps every collection's
 * full schema to stdout as pretty-printed JSON.  Pipe to a file to keep
 * a snapshot you can diff, commit, or use to recreate the schema elsewhere.
 *
 * Usage:
 *   POCKETBASE_URL=https://your-pb.railway.app \
 *   POCKETBASE_ADMIN_EMAIL=admin@zane.app \
 *   POCKETBASE_ADMIN_PASSWORD=yourpassword \
 *   npx tsx scripts/collect-collections.ts
 *
 *   # Save to file:
 *   npx tsx scripts/collect-collections.ts > collections.json
 */

import { config } from "dotenv";
config();

import PocketBase from "pocketbase";

const POCKETBASE_URL = process.env.POCKETBASE_URL ?? "http://localhost:8090";
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL ?? "admin@zane.local";
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD ?? "changeme1234";

async function main() {
  const pb = new PocketBase(POCKETBASE_URL);

  process.stderr.write(`Connecting to ${POCKETBASE_URL}...\n`);
  await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
  process.stderr.write("Authenticated.\n");

  const collections = await pb.collections.getFullList({ sort: "+name" });

  process.stderr.write(`Found ${collections.length} collection(s): ${collections.map((c) => c.name).join(", ")}\n\n`);

  // Strip the internal system collections PocketBase adds automatically
  const SYSTEM_COLLECTIONS = new Set(["_superusers", "_externalAuths", "_mfas", "_otps", "_authOrigins"]);
  const userCollections = collections.filter((c) => !SYSTEM_COLLECTIONS.has(c.name));

  // Output clean JSON - id, name, type, schema fields only
  const output = userCollections.map((c) => ({
    id:     c.id,
    name:   c.name,
    type:   c.type,
    schema: c.schema,   // array of field definitions
    indexes: c.indexes, // any custom indexes
  }));

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(`\nError: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
