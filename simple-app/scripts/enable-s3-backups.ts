/**
 * Point PocketBase's scheduled backups at an S3 bucket, so they leave the
 * volume the database lives on.
 *
 * Backups are already automatic (daily 03:00 UTC, keep 7) but land in
 * pb_data/backups, on the same volume as the database. That covers a bad
 * migration or an accidental delete and covers nothing at the hosting layer:
 * lose the volume and both go. S3 is the only thing PocketBase offers that
 * changes it.
 *
 * ── Why this is a script and not something done for you ──────────────────────
 *
 * The secret access key is a credential. It is read from the environment here
 * and sent straight to PocketBase; it is never printed, never logged, never
 * written to a file, and never passes through anyone's hands but yours.
 *
 * Get the values (this prints the secret, so run it yourself):
 *
 *   railway bucket credentials --bucket zane-backups
 *
 * Then, in a shell you are happy to have them in:
 *
 *   export S3_BUCKET=zane-backups
 *   export S3_REGION=ams
 *   export S3_ENDPOINT=<endpoint from the command above>
 *   export S3_ACCESS_KEY=<access key id>
 *   export S3_SECRET=<secret access key>
 *   npx tsx scripts/enable-s3-backups.ts
 *
 * Add --apply to write the settings. Without it this only reports what it
 * would do. Add --test to take a backup afterwards and prove one actually
 * reaches the bucket, which is the only thing that distinguishes "configured"
 * from "working".
 *
 * Clear the variables afterwards:  unset S3_SECRET S3_ACCESS_KEY
 */

import "../server/env";
import { pb, initPocketBase } from "../server/pb";

const APPLY = process.argv.includes("--apply");
const TEST = process.argv.includes("--test");

/** Present and non-empty, or the name of what is missing. */
function readConfig(): { ok: true; cfg: Record<string, string> } | { ok: false; missing: string[] } {
  const want = {
    bucket: "S3_BUCKET",
    region: "S3_REGION",
    endpoint: "S3_ENDPOINT",
    accessKey: "S3_ACCESS_KEY",
    secret: "S3_SECRET",
  };
  const cfg: Record<string, string> = {};
  const missing: string[] = [];
  for (const [key, env] of Object.entries(want)) {
    const v = process.env[env]?.trim();
    if (!v) missing.push(env);
    else cfg[key] = v;
  }
  return missing.length ? { ok: false, missing } : { ok: true, cfg };
}

/** Last four characters only, so a mistyped key is recognisable without
 *  disclosing a usable credential. The same shape check-smtp.ts uses. */
const tail = (s: string) => `…${s.slice(-4)}`;

async function main() {
  const read = readConfig();
  if (!read.ok) {
    console.error("Missing from the environment:");
    for (const m of read.missing) console.error(`  - ${m}`);
    console.error("\nGet them with:  railway bucket credentials --bucket zane-backups");
    console.error("See the comment at the top of this file for the full sequence.");
    process.exitCode = 1;
    return;
  }
  const { cfg } = read;

  await initPocketBase();
  console.log(`Connected to ${process.env.POCKETBASE_URL ?? "(default)"}\n`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const current = ((await pb.settings.getAll()) as any).backups ?? {};
  console.log("Current backup settings:");
  console.log(`  cron        ${current.cron || "(none)"}`);
  console.log(`  keep        ${current.cronMaxKeep ?? "?"}`);
  console.log(`  s3.enabled  ${Boolean(current.s3?.enabled)}`);
  console.log(`  s3.bucket   ${current.s3?.bucket || "(none)"}\n`);

  console.log("Would set:");
  console.log(`  s3.enabled  true`);
  console.log(`  s3.bucket   ${cfg.bucket}`);
  console.log(`  s3.region   ${cfg.region}`);
  console.log(`  s3.endpoint ${cfg.endpoint}`);
  console.log(`  s3.accessKey ${tail(cfg.accessKey)}`);
  console.log(`  s3.secret    ${tail(cfg.secret)}   (never printed in full)\n`);

  if (!APPLY) {
    console.log("Dry run. Nothing written. Re-run with --apply.");
    return;
  }

  await pb.settings.update({
    backups: {
      // Keep whatever schedule is already set rather than reasserting one.
      cron: current.cron ?? "",
      cronMaxKeep: current.cronMaxKeep ?? 7,
      s3: {
        enabled: true,
        bucket: cfg.bucket,
        region: cfg.region,
        endpoint: cfg.endpoint,
        accessKey: cfg.accessKey,
        secret: cfg.secret,
        /**
         * Railway's object storage is S3-compatible rather than S3, and
         * compatible endpoints generally address buckets by path rather than
         * by virtual host. If a backup fails with a DNS or 404 error, this is
         * the first thing to flip.
         */
        forcePathStyle: true,
      },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const after = ((await pb.settings.getAll()) as any).backups ?? {};
  console.log("Written. PocketBase now reports:");
  console.log(`  s3.enabled  ${Boolean(after.s3?.enabled)}`);
  console.log(`  s3.bucket   ${after.s3?.bucket}`);
  console.log(`  s3.region   ${after.s3?.region}`);
  console.log(`  s3.endpoint ${after.s3?.endpoint}\n`);

  if (!TEST) {
    console.log("Settings accepted, which is NOT the same as a backup reaching the bucket.");
    console.log("Prove it:  npx tsx scripts/enable-s3-backups.ts --apply --test");
    return;
  }

  /**
   * The thing that actually matters. Settings that look right while every
   * backup silently fails is the exact failure mode this whole effort exists
   * to remove, so take one and look for it.
   */
  const name = `s3_verify_${Math.floor(Date.now() / 1000)}.zip`;
  console.log(`Taking a test backup (${name})...`);
  try {
    await pb.backups.create(name);
  } catch (err) {
    console.error(`\nFAILED to create a backup: ${(err as Error)?.message}`);
    console.error("The settings were accepted but PocketBase cannot write to the bucket.");
    console.error("Check the endpoint and whether forcePathStyle suits this provider.");
    process.exitCode = 1;
    return;
  }

  const list = await pb.backups.getFullList();
  const found = list.find((b) => String(b.key) === name);
  if (!found) {
    console.error("\nThe backup was created but does not appear in the listing. Investigate before relying on this.");
    process.exitCode = 1;
    return;
  }
  console.log(`\nBacked up to the bucket: ${found.key}, ${(Number(found.size) / 1048576).toFixed(1)}MB`);
  console.log("Confirm it is really there:  railway bucket info --bucket " + cfg.bucket);
  console.log("\nOff-site backups are on. Now unset the credentials:  unset S3_SECRET S3_ACCESS_KEY");
  console.log(
    "\nTwo things this changes that are not code:\n" +
    "  1. Customer data now lives somewhere new. If the bucket is in a different\n" +
    "     country from the database, the privacy notice's processors and transfers\n" +
    "     sections both need it adding. See client/src/content/legal.ts.\n" +
    "  2. The security page says backups are NOT off-site, and NOT_YET_CLAIMS.backups\n" +
    "     says the same. Both are now wrong in your favour: update them, and say a\n" +
    "     restore has been rehearsed only once one actually has been.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", (err as Error)?.message ?? err);
    process.exit(1);
  });
