/**
 * Brings the seeded demo portfolio's dates forward to the present.
 *
 * The seed used to anchor every relative date to a frozen day, so the demo
 * aged: by October the monthly report said "0 contracts reviewed this month"
 * and both date-driven tables were empty. The seed now anchors to now, but
 * data already in the database still carries the old dates, and re-seeding
 * would destroy the demo rather than adjust it. This shifts what is there.
 *
 * WHAT IT CHANGES, on the demo company only:
 *
 *   uploaded_documents.reviewedAt   shifted forward by one delta, so the most
 *                                   recent review lands today and the spread
 *                                   between contracts is preserved exactly.
 *   uploaded_documents.renewalDate  populated. The seed never wrote one, so
 *                                   "Renewals due next quarter" was empty
 *                                   whatever the review dates said. Same rule
 *                                   as the seed: every fourth contract renews
 *                                   inside 90 days.
 *   approval_requests.created       shifted by the same delta.
 *
 * WHAT IT DOES NOT TOUCH:
 *
 *   audit_log. Rewriting audit timestamps is exactly the operation that makes
 *   "immutable" untrue of that collection, and doing it to make a screenshot
 *   look better is not a good enough reason. The audit timeline will keep
 *   showing the original event dates.
 *
 * Dry run unless --apply. Every row is written to a timestamped JSON file
 * before anything changes, and the run aborts if that file cannot be written.
 *
 *   npx tsx scripts/refresh-demo-dates.ts
 *   npx tsx scripts/refresh-demo-dates.ts --apply
 */

import "../server/env";
import fs from "fs";
import path from "path";
import { pb, initPocketBase } from "../server/pb";

type Row = Record<string, unknown> & { id: string };

/** Only the seeded demo company is touched. */
const DEMO_NAME_FRAGMENT = "meridian";

const APPLY = process.argv.includes("--apply");
const OUT_DIR =
  process.argv.filter((a) => a.startsWith("--out=")).map((a) => a.slice(6))[0] ??
  path.join(process.cwd(), "cleanup-backup");

const DAY = 86_400_000;
const pbDate = (d: Date) => d.toISOString().replace("T", " ");

/** Same shape as renewalFor() in seed-demo-portfolio.ts. Keep them in step. */
function renewalFor(index: number, from: Date) {
  const soon = index % 4 === 0;
  const days = soon ? 12 + ((index * 7) % 75) : 190 + ((index * 23) % 360);
  return {
    renewalDate: pbDate(new Date(from.getTime() + days * DAY)),
    autoRenewal: index % 3 !== 0,
    noticePeriodDays: [30, 60, 90][index % 3],
  };
}

async function all(collection: string): Promise<Row[]> {
  try {
    return (await pb.collection(collection).getFullList({ sort: "+id" })) as Row[];
  } catch (err) {
    console.warn(`  [warn] could not read ${collection}: ${(err as Error)?.message}`);
    return [];
  }
}

async function main() {
  await initPocketBase();
  console.log(`Connected to ${process.env.POCKETBASE_URL ?? "(default)"}`);

  const companies = await all("companies");
  const demo = companies.find((c) =>
    String(c["name"] ?? "").toLowerCase().includes(DEMO_NAME_FRAGMENT),
  );
  if (!demo) throw new Error(`No demo company matching "${DEMO_NAME_FRAGMENT}"`);
  console.log(`Demo company: ${String(demo["name"])} (${demo.id})\n`);

  const docs = (await all("uploaded_documents")).filter((d) => d["company"] === demo.id);
  const approvals = (await all("approval_requests")).filter(
    (a) => a["company"] === demo.id || a["companyId"] === demo.id,
  );

  const reviewed = docs
    .map((d) => new Date(String(d["reviewedAt"] ?? "")))
    .filter((d) => !isNaN(+d));
  if (reviewed.length === 0) throw new Error("No reviewedAt dates to shift");

  const newest = new Date(Math.max(...reviewed.map((d) => +d)));
  const now = new Date();
  const deltaDays = Math.round((+now - +newest) / DAY);
  if (deltaDays <= 0) {
    console.log(`Newest review is ${newest.toISOString().slice(0, 10)}, already current. Nothing to shift.`);
    return;
  }

  console.log(`Newest review : ${newest.toISOString().slice(0, 10)}`);
  console.log(`Today         : ${now.toISOString().slice(0, 10)}`);
  console.log(`Shift forward : ${deltaDays} days\n`);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const quarterEnd = new Date(+now + 90 * DAY);

  const docUpdates = docs.map((d, i) => {
    const old = new Date(String(d["reviewedAt"] ?? ""));
    const shifted = isNaN(+old) ? null : new Date(+old + deltaDays * DAY);
    return {
      id: d.id,
      name: String(d["originalName"] ?? ""),
      before: { reviewedAt: d["reviewedAt"], renewalDate: d["renewalDate"] ?? null },
      after: {
        ...(shifted ? { reviewedAt: pbDate(shifted) } : {}),
        ...renewalFor(i, now),
      },
      landsThisMonth: shifted ? shifted >= monthStart : false,
    };
  });

  const approvalUpdates = approvals.map((a) => {
    const old = new Date(String(a.created ?? ""));
    return {
      id: a.id,
      before: { created: a.created },
      after: isNaN(+old) ? {} : { created: pbDate(new Date(+old + deltaDays * DAY)) },
    };
  });

  const reviewedThisMonth = docUpdates.filter((u) => u.landsThisMonth).length;
  const renewalsInWindow = docUpdates.filter((u) => {
    const r = new Date(String(u.after.renewalDate));
    return r >= now && r <= quarterEnd;
  }).length;

  console.log(`documents to update : ${docUpdates.length}`);
  console.log(`  reviewed in ${now.toLocaleString("en-GB", { month: "long", year: "numeric" })} after the shift: ${reviewedThisMonth}`);
  console.log(`  renewals inside the next 90 days: ${renewalsInWindow}`);
  console.log(`approval requests to update: ${approvalUpdates.length}`);
  console.log(`audit_log: untouched by design\n`);

  if (!APPLY) {
    console.log("Dry run. Nothing has been changed. Re-run with --apply.\n");
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `demo-dates-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({ takenAt: new Date().toISOString(), deltaDays, docUpdates, approvalUpdates }, null, 2),
  );
  console.log(`Backed up previous values to ${file}\n`);

  let ok = 0;
  let failed = 0;
  for (const u of docUpdates) {
    try {
      await pb.collection("uploaded_documents").update(u.id, u.after);
      ok++;
    } catch (err) {
      failed++;
      console.warn(`  [warn] ${u.id}: ${(err as Error)?.message}`);
    }
  }
  /**
   * approval_requests.created is an autodate field, so PocketBase accepts the
   * write, returns 200 and silently drops it. An earlier version of this
   * script counted those as successes. Read the rows back and say what
   * actually changed, because a silent no-op reported as success is worse than
   * a failure.
   */
  let ignored = 0;
  for (const u of approvalUpdates) {
    if (!("created" in u.after)) continue;
    try {
      await pb.collection("approval_requests").update(u.id, u.after);
      const back = await pb.collection("approval_requests").getOne(u.id);
      if (String(back.created).slice(0, 10) === String(u.after.created).slice(0, 10)) ok++;
      else ignored++;
    } catch (err) {
      failed++;
      console.warn(`  [warn] approval ${u.id}: ${(err as Error)?.message}`);
    }
  }
  console.log(`Updated ${ok} record(s). ${failed} failure(s).`);
  if (ignored > 0) {
    console.log(
      `\n${ignored} approval_request date(s) were accepted and then ignored by PocketBase.\n` +
      `  approval_requests.created is declared autodate in scripts/setup-pocketbase.ts,\n` +
      `  so it cannot be backdated. "Escalations raised this month" will stay at zero\n` +
      `  until that field is changed to a plain date, as audit_log.created already is.`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", (err as Error)?.message ?? err);
    process.exit(1);
  });
