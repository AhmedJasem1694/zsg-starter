/**
 * The scheduled monthly report send.
 *
 * The report already existed as an on-demand export: a person opened the
 * Portfolio page, pressed a button and saved a PDF. Which means it only ever
 * reached someone who was already looking. The point of a monthly report is
 * that it arrives. This loop makes it arrive.
 *
 * ── What it sends, and about when ────────────────────────────────────────────
 *
 * The report that lands on the 1st is about the month that just closed, not
 * the one that just started, so the model is built as of the last instant of
 * the previous month (see endOfPreviousMonth). Built as of the send moment it
 * would say "0 contracts reviewed in November" on the morning of 1 November.
 *
 * ── Off by default, deliberately ─────────────────────────────────────────────
 *
 * MONTHLY_REPORT_SEND must be set before anything is sent. An outbound email
 * to named people should not start happening because someone deployed, and
 * the recipient list comes from approval_contacts, which on this deployment
 * also holds seeded demo contacts. Mail to invented addresses is not a
 * harmless no-op: it is a bounce against the sending domain's reputation.
 * `npx tsx scripts/send-monthly-report.ts --recipients` prints exactly who
 * would be written to.
 *
 * ── Not sending twice ────────────────────────────────────────────────────────
 *
 * The period is claimed in audit_log before the send is attempted, not after.
 * Claim-then-send can lose a report when the send fails; send-then-claim can
 * duplicate one every hour for a month when the claim write fails. A missed
 * monthly report that is visible in the audit trail is a far better worst case
 * than twenty-four duplicates a day, so the claim goes first. A claim that
 * cannot be written aborts that company's send, and the next tick retries.
 *
 * A partial failure (two recipients of three) does NOT release the claim. The
 * alternative is re-sending to the two who already received it, so the
 * failure is recorded loudly instead and is a human's call to re-run.
 */

import { pb } from "../pb.js";
import { audit } from "./auditLogger.js";
import { computePortfolio } from "./portfolio.js";
import { renderMonthlyReportEmail } from "./monthlyReportEmail.js";
import { emailBlocker, emailVerification, isEmailConfigured, missingEmailConfig, sendHtmlEmail } from "./emailService.js";
import { emailLinkOrigin } from "../lib/canonicalOrigin.js";
import {
  buildMonthlyReportModel,
  endOfPreviousMonth,
  periodKey,
  type ReportApproval,
  type ReportDocument,
} from "../../shared/monthlyReport.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

/**
 * Which configured approval contacts receive the report.
 *
 * CFO and GC, because the report is a finance and general-counsel document:
 * red-flag exposure, escalations and their status, renewals due, which
 * counterparties are off standard terms. BOARD is excluded because the board
 * pack is a separate export with a separate cadence, and LEGAL because the
 * legal team is in the product daily and sees all of this live.
 *
 * This is a default, not a conclusion. Exported so the recipients script can
 * print the same list the loop will use rather than its own guess at it.
 */
export const MONTHLY_REPORT_ROLES = ["CFO", "GC"] as const;

/** Day of the month the report goes out, and the earliest hour it may go. */
const SEND_DAY = 1;
const SEND_HOUR = 7; // Server local time, which on this deployment is UTC.

/** Hourly. The due check is a comparison against a timestamp, not a cron tick,
 *  so a server that was down over the send window still sends when it returns. */
const LOOP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * The claim and the outcome are separate records with separate actions, both
 * keyed on the period. The claim is the idempotency guard; the outcome says
 * what happened. They are not one record updated twice, because audit_log is
 * append-only and the report is not a good enough reason to make that less
 * true than it already is.
 */
const CLAIM_ACTION = "monthly_report_scheduled";

/**
 * A period deliberately skipped, which is NOT the same record as a period
 * claimed for sending.
 *
 * Both stop the loop acting on that month, so they could have been one action
 * with a flag in the detail. They are not, because this collection is the
 * product's evidence that what it says happened, happened. A timeline entry
 * reading "scheduled" with no matching "sent" is something a reader has to
 * infer the meaning of; one reading "suppressed" states it. Writing a record
 * that could be read as a report having gone out, when none did, is the exact
 * failure the audit trail exists to prevent.
 */
const SUPPRESS_ACTION = "monthly_report_suppressed";

/**
 * Permission to act on a period again, after it was claimed or suppressed.
 *
 * The obvious way to re-send a month is to delete its claim record. That is
 * the one thing this collection must not support: the product tells users the
 * audit log is immutable, and a row quietly removed so the system could repeat
 * an action is exactly the deletion that makes the word a lie. So a re-send is
 * granted by appending, not by erasing, and the trail keeps the whole story:
 * claimed, failed, re-authorised, sent.
 *
 * Gating is by count rather than by recency: a period is closed while the
 * blocking records outnumber the authorisations, and each authorisation
 * releases exactly one. That avoids resolving "most recent" from timestamps,
 * which PocketBase ordering has not been dependable about in this project, and
 * it stays correct across repeated cycles.
 */
const RESEND_ACTION = "monthly_report_resend_authorised";

/** Actions that close a period. */
const BLOCKING_ACTIONS = [CLAIM_ACTION, SUPPRESS_ACTION];

const AUDIT_ENTITY = "monthly_report";

/** YYYY-MM. Periods are interpolated into PocketBase filters, which are plain
 *  strings, so the shape is enforced rather than escaped. See CLAUDE.md. */
const PERIOD_PATTERN = /^\d{4}-\d{2}$/;

/** Whether the send is switched on at all. Anything but an explicit yes is no. */
export function isScheduledSendEnabled(): boolean {
  const raw = (process.env.MONTHLY_REPORT_SEND ?? "").trim().toLowerCase();
  return raw === "on" || raw === "true" || raw === "1" || raw === "yes";
}

/**
 * True once the send moment for the current month has passed.
 *
 * A comparison against a timestamp rather than a match on "is it the 1st at
 * 07:00", so a server that was down across the window still sends when it
 * comes back: on the 3rd this is just as true as on the 1st, and the per-period
 * claim is what stops it sending twice.
 *
 * Exported for the test, which is the only thing that pins this distinction.
 */
export function isDue(now: Date): boolean {
  const sendMoment = new Date(now.getFullYear(), now.getMonth(), SEND_DAY, SEND_HOUR, 0, 0, 0);
  return now.getTime() >= sendMoment.getTime();
}

/**
 * The gating records for one company and period, counted by kind.
 *
 * Deliberately ignores the outcome records (sent / failed). Those say what
 * came of an attempt; they do not open or close a period, and counting them
 * here would mean a failed send released its own claim.
 *
 * Filters on the compat text fields `companyId` and `entityId`, because those
 * are the ones auditLogger actually writes.
 */
async function gatingActions(companyId: string, period: string): Promise<string[]> {
  if (!PERIOD_PATTERN.test(period)) throw new Error(`Refusing to query a malformed period: ${period}`);
  const clause = [...BLOCKING_ACTIONS, RESEND_ACTION].map((a) => `action = "${a}"`).join(" || ");
  const rows = await pb.collection("audit_log").getFullList({
    filter: `(${clause}) && companyId = "${companyId}" && entityId = "${period}"`,
    fields: "action",
  });
  return rows.map((r) => String(r["action"]));
}

/**
 * Given every gating record for one company and period, is that period closed?
 *
 * Each authorisation releases exactly one block, so the cycle
 * claim, fail, authorise, claim again behaves correctly however many times it
 * repeats. Anything that is neither a block nor a release is ignored rather
 * than treated as a block: the outcome records say what came of an attempt,
 * and counting those here would let a failed send release its own claim.
 *
 * Pure, and exported, because this is the whole correctness argument for not
 * deleting records and it should be pinned by tests rather than by a database.
 */
export function isPeriodClosed(actions: string[]): boolean {
  let blocks = 0;
  let releases = 0;
  for (const a of actions) {
    if (a === RESEND_ACTION) releases++;
    else if ((BLOCKING_ACTIONS as string[]).includes(a)) blocks++;
  }
  return blocks > releases;
}

/**
 * Is this company's report for this period closed off, either by having been
 * claimed for sending or by having been deliberately suppressed, and not since
 * re-authorised?
 */
async function alreadyHandled(companyId: string, period: string): Promise<boolean> {
  return isPeriodClosed(await gatingActions(companyId, period));
}

/**
 * Re-open a period so the next pass will build and send it again.
 *
 * Appends rather than deleting the claim, so the audit trail keeps the whole
 * sequence. Returns false when the period is not currently closed, because
 * authorising an open period would bank a release that silently cancels the
 * next real claim.
 */
export async function authoriseResend(
  companyId: string,
  period: string,
  reason: string,
): Promise<boolean> {
  if (!PERIOD_PATTERN.test(period)) throw new Error(`Malformed period: ${period}. Expected YYYY-MM.`);
  if (!(await alreadyHandled(companyId, period))) return false;

  await pb.collection("audit_log").create({
    action: RESEND_ACTION,
    entityType: AUDIT_ENTITY,
    entityId: period,
    companyId,
    company: companyId,
    userId: "",
    ipAddress: "",
    detail: JSON.stringify({ period, reason, authorisedAt: new Date().toISOString() }),
    created: new Date().toISOString().replace("T", " "),
  });
  return true;
}

/**
 * Record a period as deliberately skipped, so the loop will not send it.
 *
 * The case this exists for: switching the send on part-way through a month.
 * Catch-up is unbounded by design, so the first pass would otherwise deliver
 * the previous month's report weeks late, correctly labelled but stale. This
 * closes that month off and lets the next one be the first to arrive.
 *
 * Returns false when the period was already handled, so running it twice is
 * safe and does not stack records.
 */
export async function suppressPeriod(
  companyId: string,
  period: string,
  reason: string,
): Promise<boolean> {
  if (!PERIOD_PATTERN.test(period)) throw new Error(`Malformed period: ${period}. Expected YYYY-MM.`);
  if (await alreadyHandled(companyId, period)) return false;

  await pb.collection("audit_log").create({
    action: SUPPRESS_ACTION,
    entityType: AUDIT_ENTITY,
    entityId: period,
    companyId,
    company: companyId,
    userId: "",
    ipAddress: "",
    // No recipients key at all. An empty list would read as "sent to nobody";
    // the point is that no send was attempted.
    detail: JSON.stringify({ period, reason, suppressedAt: new Date().toISOString() }),
    created: new Date().toISOString().replace("T", " "),
  });
  return true;
}

/**
 * Claim the period. Throws if the record cannot be written, which is the whole
 * point: an unverifiable claim must stop the send rather than risk a loop of
 * duplicates. Deliberately not routed through audit(), which swallows errors.
 */
async function claimPeriod(companyId: string, period: string, recipients: string[]): Promise<void> {
  await pb.collection("audit_log").create({
    action: CLAIM_ACTION,
    entityType: AUDIT_ENTITY,
    entityId: period,
    companyId,
    company: companyId,
    userId: "",
    ipAddress: "",
    detail: JSON.stringify({ period, recipients, claimedAt: new Date().toISOString() }),
    created: new Date().toISOString().replace("T", " "),
  });
}

/**
 * The documents and approvals the report reads, in the shapes the shared model
 * expects.
 *
 * Both come from one pass over the company's documents, because approval
 * records carry neither the contract name nor the counterparty: on
 * approval_requests, `document` is a plain text id and the display fields live
 * on uploaded_documents. GET /api/approvals joins them with one getOne per
 * distinct document, which is fine for a page of a queue and wasteful for a
 * whole company, so the documents fetched for the report's own tables are
 * reused as the lookup.
 *
 * approval_requests has no companyId field, only `company` as plain text. An
 * earlier version of this filtered on both and PocketBase rejected the whole
 * query, which is worth stating because the equivalent mistake on a collection
 * that does have the field would have passed silently.
 */
async function loadReportData(
  companyId: string,
): Promise<{ documents: ReportDocument[]; approvals: ReportApproval[] }> {
  const [docRows, approvalRows] = await Promise.all([
    pb.collection("uploaded_documents").getFullList({
      filter: `company = "${companyId}"`,
      fields: "id,status,reviewedAt,created,renewalDate,counterpartyName,originalName,contractType,contractValue",
    }) as Promise<PBRecord[]>,
    pb.collection("approval_requests").getFullList({
      filter: `company = "${companyId}"`,
      fields: "document,created,clauseCategory,routedToRole,status,decidedByName",
    }) as Promise<PBRecord[]>,
  ]);

  const docById = new Map(docRows.map((d) => [String(d.id), d]));

  const documents: ReportDocument[] = docRows.map((d) => ({
    status: String(d["status"] ?? ""),
    // The same expression the documents route uses for uploadedAt, so the
    // report's reviewed-this-month count matches the library's dates.
    uploadedAt: (d["reviewedAt"] || d["created"]) as string | null,
    renewalDate: (d["renewalDate"] as string) || null,
    counterpartyName: (d["counterpartyName"] as string) || null,
    originalName: (d["originalName"] as string) || null,
    contractType: (d["contractType"] as string) || null,
    contractValue: (d["contractValue"] as number) ?? null,
  }));

  const approvals: ReportApproval[] = approvalRows.map((a) => {
    const doc = docById.get(String(a["document"] ?? ""));
    return {
      createdAt: (a["created"] as string) || null,
      // Same fallback the approvals route uses, so a contract deleted after an
      // escalation still appears as a line rather than as a blank row.
      documentName: (doc?.["originalName"] as string) || "Contract no longer in the library",
      counterpartyName: (doc?.["counterpartyName"] as string) || null,
      clauseCategory: (a["clauseCategory"] as string) || null,
      routedToRole: (a["routedToRole"] as string) || null,
      status: (a["status"] as string) || null,
      decidedByName: (a["decidedByName"] as string) || null,
    };
  });

  return { documents, approvals };
}

/**
 * The report for one company, or null when it has no completed reviews.
 *
 * Exported so the preview in scripts/send-monthly-report.ts renders the same
 * model the send would, rather than its own assembly of the same tables. A
 * preview that is built differently from the thing it previews is worse than
 * no preview.
 */
export async function buildReportFor(
  companyId: string,
  companyName: string,
  asOf: Date,
  generatedAt: Date,
) {
  const portfolio = await computePortfolio(companyId);
  if (!portfolio) return null;

  const { documents, approvals } = await loadReportData(companyId);
  return buildMonthlyReportModel({
    companyName,
    portfolio,
    documents,
    approvals,
    asOf,
    generatedAt,
  });
}

/** Configured recipients for a company, deduplicated by address. */
async function recipientsFor(
  companyId: string,
): Promise<Array<{ name: string; email: string; role: string }>> {
  const contacts = (await pb.collection("approval_contacts").getFullList({
    filter: `company = "${companyId}"`,
  })) as PBRecord[];

  const seen = new Set<string>();
  const out: Array<{ name: string; email: string; role: string }> = [];
  for (const c of contacts) {
    const role = String(c["role"] ?? "");
    if (!MONTHLY_REPORT_ROLES.includes(role as (typeof MONTHLY_REPORT_ROLES)[number])) continue;
    const email = String(c["email"] ?? "").trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: String(c["name"] ?? "").trim() || email, email, role });
  }
  return out;
}

export interface MonthlyReportPassResult {
  period: string;
  considered: number;
  sent: number;
  skipped: number;
  failed: number;
  /** One line per company, for a script or a log to print. */
  notes: string[];
}

/**
 * One pass over every company. Never throws: a failure on one company must not
 * stop the others, and must not take the loop down with it.
 *
 * @param opts.now     Point in time to evaluate. Tests and the manual script
 *                     pass this; the loop passes nothing.
 * @param opts.dryRun  Build the report and resolve recipients, claim nothing
 *                     and send nothing.
 * @param opts.force   Ignore the due check. Does NOT ignore the claim, so a
 *                     forced run still cannot double-send a period.
 */
export async function runMonthlyReportPass(
  opts: { now?: Date; dryRun?: boolean; force?: boolean } = {},
): Promise<MonthlyReportPassResult> {
  const now = opts.now ?? new Date();
  const dryRun = opts.dryRun === true;
  const asOf = endOfPreviousMonth(now);
  const period = periodKey(asOf);
  const result: MonthlyReportPassResult = {
    period,
    considered: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    notes: [],
  };

  if (!opts.force && !isDue(now)) {
    result.notes.push(`Not due: the send moment for ${period} has not passed.`);
    return result;
  }

  if (!dryRun) {
    /**
     * Not "is a key set" but "does the provider accept it", re-checked rather
     * than trusted from cache, because the next thing this function does is
     * claim a reporting period it cannot un-claim.
     *
     * A key set to a placeholder once made isEmailConfigured() true while
     * nothing was deliverable. Had that survived to a send window, this pass
     * would have claimed the month, failed every recipient, and left the
     * period closed. Verification is what stops presence being mistaken for
     * working.
     *
     * "unreachable" is treated exactly like "not configured": nothing is
     * claimed, and the next hourly tick tries again. Declining to act on an
     * unconfirmed credential costs an hour; claiming on one costs the month.
     */
    const blocker = await emailBlocker(true);
    if (blocker) {
      result.notes.push(
        `Email is ${blocker}. Nothing sent and nothing claimed, so ${period} still goes out once email works.`,
      );
      return result;
    }
  }

  let companies: PBRecord[];
  try {
    companies = (await pb.collection("companies").getFullList({ sort: "+id" })) as PBRecord[];
  } catch (err) {
    result.notes.push(`Could not list companies: ${(err as Error)?.message}`);
    result.failed++;
    return result;
  }

  const origin = emailLinkOrigin();

  for (const company of companies) {
    const companyId = String(company.id);
    const companyName = String(company["name"] ?? "Your company");
    result.considered++;

    try {
      if (await alreadyHandled(companyId, period)) {
        result.skipped++;
        // Deliberately does not say "already sent": the period may have been
        // suppressed rather than delivered.
        result.notes.push(`${companyName}: ${period} already handled.`);
        continue;
      }

      const recipients = await recipientsFor(companyId);
      if (recipients.length === 0) {
        result.skipped++;
        result.notes.push(
          `${companyName}: no ${MONTHLY_REPORT_ROLES.join(" or ")} contact configured, nobody to send to.`,
        );
        continue;
      }

      const model = await buildReportFor(companyId, companyName, asOf, now);
      if (!model) {
        result.skipped++;
        result.notes.push(`${companyName}: no completed reviews, nothing to report.`);
        continue;
      }

      if (model.isEmpty) {
        // Nothing reviewed, escalated, renewing or deviating. A report whose
        // every table reads "none" is worse than no email: it trains the
        // recipient to ignore the next one.
        result.skipped++;
        result.notes.push(`${companyName}: no activity in ${model.monthLabel}, not sending an empty report.`);
        continue;
      }

      const addresses = recipients.map((r) => r.email);

      if (dryRun) {
        result.notes.push(
          `${companyName}: would send "${model.reportTitle}" to ${addresses.join(", ")} ` +
          `(${model.reviewedCount} reviewed, ${model.escalationsRaised} escalations, ${model.renewalsDueCount} renewals).`,
        );
        continue;
      }

      // Claim before sending. See the note at the top of this file.
      await claimPeriod(companyId, period, addresses);

      const { subject, html, text } = renderMonthlyReportEmail(model, origin);
      const delivered: string[] = [];
      const undelivered: string[] = [];
      for (const r of recipients) {
        const ok = await sendHtmlEmail({ to: r.email, subject, html, text });
        (ok ? delivered : undelivered).push(r.email);
      }

      if (undelivered.length > 0) {
        result.failed++;
        console.error(
          `[monthlyReport] ${companyName} ${period}: sent to ${delivered.length}, FAILED for ` +
          `${undelivered.join(", ")}. The period stays claimed, so these will not retry automatically.`,
        );
      }
      if (delivered.length > 0) result.sent++;

      await audit({
        action: undelivered.length === 0 ? "monthly_report_sent" : "monthly_report_failed",
        entityType: AUDIT_ENTITY,
        entityId: period,
        companyId,
        detail: {
          period,
          subject,
          delivered,
          undelivered,
          reviewedCount: model.reviewedCount,
          escalationsRaised: model.escalationsRaised,
          renewalsDueCount: model.renewalsDueCount,
          redExposure: model.redExposure,
        },
      });

      result.notes.push(
        `${companyName}: sent "${model.reportTitle}" to ${delivered.join(", ") || "(nobody)"}` +
        (undelivered.length ? `, failed for ${undelivered.join(", ")}` : "") + ".",
      );
    } catch (err) {
      result.failed++;
      const message = (err as Error)?.message ?? String(err);
      result.notes.push(`${companyName}: ${message}`);
      console.error(`[monthlyReport] ${companyName} (${companyId}) failed:`, message);
    }
  }

  return result;
}

/**
 * Start the loop. Runs shortly after boot so a send window missed while the
 * server was down is caught up, then hourly.
 */
export function startMonthlyReportLoop(): void {
  if (!isScheduledSendEnabled()) {
    console.log(
      "[monthlyReport] Scheduled send is OFF. Set MONTHLY_REPORT_SEND=on to enable it. " +
      "Run `npx tsx scripts/send-monthly-report.ts` first to see who would receive one.",
    );
    return;
  }

  // Still start in every case below: a key may be added after boot, and the
  // pass verifies the credential itself before claiming anything.
  if (!isEmailConfigured()) {
    console.warn(
      `[monthlyReport] Scheduled send is ON but email is not configured (missing: ${missingEmailConfig().join(", ")}). ` +
      "Nothing will be sent until a transport exists; no period will be marked as sent in the meantime.",
    );
  } else {
    // A key being present is not the same as it working, and the difference is
    // invisible until a send fails. Say which one this is, at boot.
    emailVerification(true)
      .then((v) => {
        if (v.state === "invalid") {
          console.error(
            `[monthlyReport] Scheduled send is ON and a key is set, but the provider REJECTED it: ${v.error}. ` +
            "No period will be claimed while that is true, so nothing is lost, but nothing will arrive either.",
          );
        } else if (v.state !== "valid") {
          console.warn(`[monthlyReport] Could not verify the email credential at boot: ${v.error}. Will re-check each pass.`);
        }
      })
      .catch(() => { /* the pass re-checks anyway */ });
  }

  const tick = () => {
    runMonthlyReportPass()
      .then((r) => {
        if (r.sent || r.failed) {
          console.log(`[monthlyReport] ${r.period}: ${r.sent} sent, ${r.skipped} skipped, ${r.failed} failed`);
          for (const note of r.notes) console.log(`[monthlyReport]   ${note}`);
        }
      })
      .catch((err) => console.error("[monthlyReport] pass error:", err));
  };

  // After the other startup work, like the integration renewal loop.
  setTimeout(tick, 90 * 1000);
  setInterval(tick, LOOP_INTERVAL_MS);
}
