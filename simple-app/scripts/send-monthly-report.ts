/**
 * Inspect, preview and run the scheduled monthly report send by hand.
 *
 * The loop in server/services/monthlyReportSchedule.ts is off until
 * MONTHLY_REPORT_SEND is set, and it should stay off until someone has seen
 * exactly which addresses it would write to. The recipient list comes from the
 * approval_contacts table, not from code, and this deployment's contacts
 * include seeded demo ones. Mail to an invented address is not a harmless
 * no-op: bounces are charged against the sending domain's reputation.
 *
 * Dry run unless --apply. Nothing is claimed and nothing is sent without it.
 *
 *   npx tsx scripts/send-monthly-report.ts --recipients   who would receive one
 *   npx tsx scripts/send-monthly-report.ts                dry run of the pass
 *   npx tsx scripts/send-monthly-report.ts --preview      write the email to a file
 *   npx tsx scripts/send-monthly-report.ts --apply        send for real
 *
 *   npx tsx scripts/send-monthly-report.ts --suppress=2026-09 --apply
 *       Close a period off without sending it. For when the send is switched
 *       on part-way through a month: catch-up is unbounded, so the first pass
 *       would otherwise deliver the previous month weeks late. Writes a
 *       monthly_report_suppressed audit record, which is deliberately a
 *       different action from the one a real send writes.
 *
 * --force ignores the day-of-month check so a pass can be run mid-month. It
 * does NOT ignore the per-period claim, so a forced run still cannot send the
 * same month to the same company twice.
 */

import "../server/env";
import fs from "fs";
import path from "path";
import { pb, initPocketBase } from "../server/pb";
import {
  MONTHLY_REPORT_ROLES,
  buildReportFor,
  isScheduledSendEnabled,
  runMonthlyReportPass,
  suppressPeriod,
} from "../server/services/monthlyReportSchedule";
import { renderMonthlyReportEmail } from "../server/services/monthlyReportEmail";
import { emailStatus } from "../server/services/emailService";
import { endOfPreviousMonth, periodKey } from "../shared/monthlyReport";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any> & { id: string };

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const RECIPIENTS_ONLY = process.argv.includes("--recipients");
const PREVIEW = process.argv.includes("--preview");
const SUPPRESS =
  process.argv.filter((a) => a.startsWith("--suppress=")).map((a) => a.slice(11))[0] ?? "";
const OUT_DIR =
  process.argv.filter((a) => a.startsWith("--out=")).map((a) => a.slice(6))[0] ??
  path.join(process.cwd(), "report-preview");

/**
 * Close a reporting period off for every company without sending it.
 *
 * The reason string is written into the audit record, because a suppressed
 * month is a decision someone made and the record should say who decided what
 * and why, not merely that a month is missing.
 */
async function suppress(period: string, apply: boolean) {
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new Error(`--suppress expects YYYY-MM, got "${period}"`);
  }

  const companies = (await pb.collection("companies").getFullList({ sort: "+id" })) as Row[];
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const reason =
    `No report was sent for ${period}. Scheduled sending was switched on on ${today}, ` +
    `after this period had closed, and the period was suppressed deliberately so that the ` +
    `first delivered report would be a current month rather than a stale catch-up.`;

  console.log(`Period to suppress: ${period}`);
  console.log(`Reason recorded   : ${reason}\n`);

  let done = 0;
  let already = 0;
  for (const c of companies) {
    const name = String(c["name"] ?? "(unnamed)");
    if (!apply) {
      console.log(`  would suppress ${period} for ${name} (${c.id})`);
      continue;
    }
    const written = await suppressPeriod(String(c.id), period, reason);
    if (written) {
      done++;
      console.log(`  suppressed ${period} for ${name} (${c.id})`);
    } else {
      already++;
      console.log(`  ${name} (${c.id}): ${period} was already handled, left alone`);
    }
  }

  if (apply) {
    console.log(`\n${done} suppressed, ${already} already handled.`);
  } else {
    console.log(`\nDry run. Nothing written. Re-run with --apply.`);
  }
}

async function listRecipients() {
  const companies = (await pb.collection("companies").getFullList({ sort: "+id" })) as Row[];
  const contacts = (await pb.collection("approval_contacts").getFullList({ sort: "+id" })) as Row[];

  console.log(`${companies.length} company/companies, ${contacts.length} approval contact(s)`);
  console.log(`The report goes to roles: ${MONTHLY_REPORT_ROLES.join(", ")}\n`);

  let wouldReceive = 0;
  for (const c of companies) {
    const mine = contacts.filter((k) => k["company"] === c.id);
    const targeted = mine.filter((k) =>
      MONTHLY_REPORT_ROLES.includes(String(k["role"] ?? "") as (typeof MONTHLY_REPORT_ROLES)[number]),
    );
    console.log(`${String(c["name"] ?? "(unnamed)")} (${c.id})`);
    if (mine.length === 0) {
      console.log("  no approval contacts at all");
    } else {
      for (const k of mine) {
        const hit = targeted.includes(k);
        console.log(
          `  ${hit ? "WOULD SEND ->" : "             "} ${String(k["role"])}: ` +
          `${String(k["name"] ?? "")} <${String(k["email"] ?? "")}>`,
        );
      }
    }
    if (targeted.length > 0) wouldReceive++;
    console.log("");
  }
  console.log(`${wouldReceive} of ${companies.length} companies would receive a report.`);
}

/**
 * Write the rendered email to disk for the first company that has something to
 * report, so the HTML and the plain-text part can be read before anyone sends
 * either. Sends nothing.
 */
async function writePreview(now: Date) {
  const asOf = endOfPreviousMonth(now);
  const companies = (await pb.collection("companies").getFullList({ sort: "+id" })) as Row[];
  let written = 0;

  for (const company of companies) {
    // The same builder the send uses, so this previews the real thing.
    const model = await buildReportFor(
      String(company.id),
      String(company["name"] ?? "Your company"),
      asOf,
      now,
    );
    if (!model) continue;

    if (model.isEmpty) {
      console.log(`${model.companyName}: no activity in ${model.monthLabel}, would not be sent.`);
      continue;
    }

    const rendered = renderMonthlyReportEmail(model, "https://www.zanelegal.ai");
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const stem = `${model.period}-${String(company.id)}`;
    const htmlFile = path.join(OUT_DIR, `${stem}.html`);
    const textFile = path.join(OUT_DIR, `${stem}.txt`);
    fs.writeFileSync(htmlFile, rendered.html);
    fs.writeFileSync(textFile, rendered.text);

    console.log(`${model.companyName}`);
    console.log(`  subject: ${rendered.subject}`);
    console.log(`  html   : ${htmlFile}`);
    console.log(`  text   : ${textFile}`);
    written++;
  }

  if (written === 0) console.log("No company had anything to report, so nothing was previewed.");
}

async function main() {
  await initPocketBase();
  console.log(`Connected to ${process.env.POCKETBASE_URL ?? "(default)"}`);

  const now = new Date();
  const status = emailStatus();
  console.log(`Scheduled send : ${isScheduledSendEnabled() ? "ON" : "OFF (set MONTHLY_REPORT_SEND=on)"}`);
  console.log(`Email transport: ${status.transport}${status.configured ? "" : ` (missing ${status.missing.join(", ")})`}`);
  console.log(`Reporting period: ${periodKey(endOfPreviousMonth(now))}\n`);

  if (SUPPRESS) {
    await suppress(SUPPRESS, APPLY);
    return;
  }

  if (RECIPIENTS_ONLY) {
    await listRecipients();
    return;
  }

  if (PREVIEW) {
    await writePreview(now);
    return;
  }

  const result = await runMonthlyReportPass({ now, dryRun: !APPLY, force: FORCE });

  console.log(`Period ${result.period}: considered ${result.considered}, sent ${result.sent}, skipped ${result.skipped}, failed ${result.failed}`);
  for (const note of result.notes) console.log(`  ${note}`);

  if (!APPLY) {
    console.log("\nDry run. Nothing was claimed and nothing was sent. Re-run with --apply.");
  }
}

/**
 * Exit explicitly. initPocketBase() installs a 30-minute token-refresh
 * interval, so the event loop never empties and the process would otherwise
 * sit there after printing. Same ending as the other admin scripts.
 */
main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", (err as Error)?.message ?? err);
    process.exit(1);
  });
