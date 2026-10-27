/**
 * The monthly legal report, as data.
 *
 * This file exists because the report now has two renderers and must never
 * have two sets of figures.
 *
 * The report started as a client-only export: a print window a person opened
 * from the Portfolio page. It is now also emailed on a schedule, and print
 * markup and email markup are genuinely different media. Print wants
 * @page margins, a self-hosted webfont and flexbox; email wants tables and
 * inline styles, because a mail client will strip a <style> block and Outlook
 * will not lay out a flex row. So the markup is deliberately not shared.
 *
 * What is shared, and what had to be, is the arithmetic. If the emailed
 * "Red-flag exposure" and the exported "Red-flag exposure" were computed by
 * two pieces of code, they would eventually disagree, and a CFO holding two
 * Zane documents with two different numbers on them is a worse outcome than
 * either document not existing. Every figure in the report is derived here,
 * once, and both renderers are handed the result.
 *
 * Inputs are declared structurally rather than imported from the client or the
 * server, so neither side owns this file and neither has to pass a type it
 * does not already have. Nothing here touches `window`, `process` or the
 * database: give it the same three payloads the dashboard is built from and a
 * point in time, and it returns the report.
 */

// ── Inputs ────────────────────────────────────────────────────────────────────

/** The subset of the /api/portfolio payload the report reads. */
export interface ReportPortfolio {
  valueAtRisk: { RED: number; AMBER: number; GREEN: number; total: number };
  byCounterparty: Array<{
    name: string;
    red: number;
    amber: number;
    green: number;
    total: number;
    value: number;
  }>;
}

/** The subset of an uploaded document the report reads. */
export interface ReportDocument {
  status: string;
  /**
   * When the review completed. The client's document payload aliases
   * `reviewedAt` to `uploadedAt`, so the caller passes whichever field its
   * payload carries; this file does not care which, only that it is the date
   * the review landed.
   */
  uploadedAt?: string | null;
  renewalDate?: string | null;
  counterpartyName?: string | null;
  originalName?: string | null;
  contractType?: string | null;
  contractValue?: number | null;
}

/** The subset of an approval request the report reads. */
export interface ReportApproval {
  createdAt?: string | null;
  documentName?: string | null;
  counterpartyName?: string | null;
  clauseCategory?: string | null;
  routedToRole?: string | null;
  status?: string | null;
  decidedByName?: string | null;
}

export interface MonthlyReportInput {
  companyName: string;
  portfolio: ReportPortfolio;
  documents: ReportDocument[];
  approvals: ReportApproval[];
  /**
   * The instant the report is "as of". The reporting window runs from the
   * first of that month to this instant, and the renewal horizon runs forward
   * from it.
   *
   * On-demand export passes now, which gives a month-to-date report. The
   * scheduled send passes endOfPreviousMonth(now), which gives a report for
   * the month that has just closed. See that function for why.
   */
  asOf: Date;
  /**
   * When the document was produced, for the footer. Defaults to now, which is
   * right for both callers: an on-demand export is generated at its as-of
   * instant, and a scheduled send is generated on the 1st about the 31st, so
   * the footer should say the 1st. Passed explicitly only by tests.
   */
  generatedAt?: Date;
}

// ── Formatting, shared so both renderers agree on presentation too ────────────

const DAY_MS = 24 * 60 * 60 * 1000;

export const money = (v: number): string => {
  if (!isFinite(v) || v <= 0) return "£0";
  return "£" + Math.round(v).toLocaleString("en-GB");
};

/** HTML-escape. Every string in the model passes through a renderer, not here. */
export const esc = (s: string): string =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Contract-type and clause-category tokens that are acronyms, not words.
 *
 * Without this, titleCase lowercases MSA and title-cases it back to "Msa",
 * which is what the printed report has always shown. It reads as a typo in a
 * document whose whole job is to look like it was checked.
 */
const ACRONYMS = new Set(["MSA", "NDA", "DPA", "SLA", "SOW", "IP", "GDPR", "KPI", "VAT", "TUPE"]);

/**
 * UPPER_SNAKE to Title Case, leaving known acronyms alone. Unescaped: use this
 * in plain text, and titleCase in markup.
 */
export const titleCaseRaw = (s: string): string =>
  String(s ?? "")
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => {
      if (!word) return word;
      if (ACRONYMS.has(word.toUpperCase())) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");

/** UPPER_SNAKE to Title Case, escaped for insertion into markup. */
export const titleCase = (s: string): string => esc(titleCaseRaw(s));

export const dmy = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/**
 * The last instant of the month before `now`.
 *
 * A report that lands in an inbox on the 1st is read as a report about the
 * month that just ended, so it has to be built as of the 31st rather than as
 * of the moment it is sent. Built as of the 1st it would say "0 contracts
 * reviewed in November" on the morning of 1 November, which is true and
 * useless.
 *
 * Day 0 of the current month is the last day of the previous one, which also
 * handles February and December without a special case.
 */
export function endOfPreviousMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
}

/** The period an as-of date belongs to, as YYYY-MM. The send's idempotency key. */
export function periodKey(asOf: Date): string {
  return `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, "0")}`;
}

// ── The model ─────────────────────────────────────────────────────────────────

export interface EscalationRow {
  contract: string;
  clause: string | null;
  routedToRole: string;
  status: string;
  statusLabel: string;
  statusAccent: string;
  decidedByName: string;
}

export interface RenewalRow {
  contract: string;
  type: string | null;
  renewalDate: string | null;
  contractValue: number | null;
}

export interface CounterpartyRow {
  name: string;
  red: number;
  amber: number;
  value: number;
}

export interface MonthlyReportModel {
  companyName: string;
  /** "October 2026" */
  monthLabel: string;
  /** "October 2026 Legal Report" */
  reportTitle: string;
  /** The date the document was produced, for the footer. */
  generatedLabel: string;
  /** YYYY-MM, for an idempotency key or a filename. */
  period: string;
  /** The four headline figures. */
  reviewedCount: number;
  redExposure: number;
  escalationsRaised: number;
  renewalsDueCount: number;
  escalations: EscalationRow[];
  renewals: RenewalRow[];
  counterparties: CounterpartyRow[];
  /** True when every table is empty, so a caller can decline to send. */
  isEmpty: boolean;
}

const STATUS_LABELS: Record<string, { label: string; accent: string }> = {
  PENDING: { label: "Awaiting decision", accent: "#D97706" },
  APPROVED: { label: "Approved", accent: "#16A34A" },
  REJECTED: { label: "Rejected", accent: "#DC2626" },
};

const ROLE_LABELS: Record<string, string> = { CFO: "CFO", BOARD: "Board", GC: "GC", LEGAL: "Legal" };

/**
 * Role as a person would write it, unescaped. Falls back to Title Case for a
 * role added later. Use this in plain text; use roleLabel in markup.
 */
export const roleLabelRaw = (role: string): string =>
  ROLE_LABELS[role] ??
  String(role ?? "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Role as a person would write it, escaped for insertion into markup. */
export const roleLabel = (role: string): string => esc(roleLabelRaw(role));

export function buildMonthlyReportModel(input: MonthlyReportInput): MonthlyReportModel {
  const { companyName, portfolio, documents, approvals, asOf } = input;

  const monthLabel = asOf.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  /**
   * Local-time midnight, compared against stored UTC timestamps. So "October"
   * means October in the evaluating process's zone: UTC on the server, the
   * viewer's own zone in the browser. Carried over from the original export
   * rather than changed, because for a UK company "October" does mean the UK's
   * October. The consequence is that an on-demand export run from a browser in
   * BST and a scheduled send run on a UTC server can disagree about a document
   * reviewed in the first hour of the 1st. One hour at one boundary, in
   * exchange for month labels that mean what the reader thinks they mean.
   */
  const monthStart = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
  // The same 90-day window the dashboard's "Renewals due in 90 days" tile uses
  // server-side, so the report's renewal count always agrees with it.
  const quarterEnd = new Date(asOf.getTime() + 90 * DAY_MS);

  const within = (raw: string | null | undefined, from: Date, to: Date): boolean => {
    if (!raw) return false;
    const at = new Date(raw);
    return !isNaN(at.getTime()) && at >= from && at <= to;
  };

  // Contracts reviewed in the period: completed reviews dated inside it.
  const reviewedThisPeriod = documents.filter(
    (d) => d.status === "COMPLETE" && within(d.uploadedAt, monthStart, asOf),
  );

  // Escalations raised in the period, with their status, from the approvals
  // queue (the same records the Approvals page shows).
  const raisedThisPeriod = approvals.filter((a) => within(a.createdAt, monthStart, asOf));

  // Renewals due next quarter, from the documents' stored renewal dates.
  const renewalsNextQuarter = documents
    .filter((d) => within(d.renewalDate, asOf, quarterEnd))
    .sort((a, b) => String(a.renewalDate).localeCompare(String(b.renewalDate)));

  const deviating = portfolio.byCounterparty.filter((cp) => cp.red > 0);

  const escalations: EscalationRow[] = raisedThisPeriod.map((a) => {
    const status = String(a.status ?? "");
    const s = STATUS_LABELS[status] ?? { label: status, accent: "#64748B" };
    return {
      contract: a.counterpartyName || a.documentName || "",
      clause: a.clauseCategory || null,
      routedToRole: String(a.routedToRole ?? ""),
      status,
      statusLabel: s.label,
      statusAccent: s.accent,
      // Only name a decider once there is a decision to attribute.
      decidedByName: status !== "PENDING" && a.decidedByName ? a.decidedByName : "",
    };
  });

  const renewals: RenewalRow[] = renewalsNextQuarter.map((d) => ({
    contract: d.counterpartyName || d.originalName || "",
    type: d.contractType || null,
    renewalDate: d.renewalDate || null,
    contractValue: d.contractValue ?? null,
  }));

  const counterparties: CounterpartyRow[] = deviating.map((cp) => ({
    name: cp.name,
    red: cp.red,
    amber: cp.amber,
    value: cp.value,
  }));

  return {
    companyName,
    monthLabel,
    reportTitle: `${monthLabel} Legal Report`,
    generatedLabel: (input.generatedAt ?? new Date()).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    period: periodKey(asOf),
    reviewedCount: reviewedThisPeriod.length,
    redExposure: portfolio.valueAtRisk.RED,
    escalationsRaised: raisedThisPeriod.length,
    renewalsDueCount: renewalsNextQuarter.length,
    escalations,
    renewals,
    counterparties,
    /**
     * Nothing reviewed, nothing escalated, nothing renewing and no deviating
     * counterparty. Red exposure is excluded on purpose: a standing exposure
     * with no activity against it is the month's most important fact, not an
     * empty month.
     */
    isEmpty:
      reviewedThisPeriod.length === 0 &&
      raisedThisPeriod.length === 0 &&
      renewalsNextQuarter.length === 0 &&
      deviating.length === 0,
  };
}
