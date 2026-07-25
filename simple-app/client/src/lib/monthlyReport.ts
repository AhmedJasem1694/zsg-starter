// Monthly legal report export for the Portfolio surface.
//
// V1: a dated, month-titled report (for example "July 2026 Legal Report")
// built the same way as the board pack: a light print window the user saves
// as PDF. Every figure comes from the existing portfolio, documents, and
// approvals payloads that already drive the dashboard and Portfolio page, so
// the report always agrees with them. Nothing is recomputed or newly derived
// beyond filtering those payloads to the reporting period.

import type { getPortfolio, ApprovalListItem } from "./api";
import type { UploadedDocument } from "./types";

type PortfolioData = NonNullable<Awaited<ReturnType<typeof getPortfolio>>>;

const money = (v: number): string => {
  if (!isFinite(v) || v <= 0) return "£0";
  return "£" + Math.round(v).toLocaleString("en-GB");
};

const esc = (s: string): string =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const titleCase = (s: string): string =>
  esc(String(s ?? "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()));

const dmy = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export function exportMonthlyReport(opts: {
  companyName: string;
  data: PortfolioData;
  documents: UploadedDocument[];
  approvals: ApprovalListItem[];
  now?: Date;
}): void {
  const { companyName, data, documents, approvals } = opts;
  const now = opts.now ?? new Date();

  const monthLabel = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const reportTitle = `${monthLabel} Legal Report`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  // Same 90-day window the dashboard's "Renewals due in 90 days" tile uses
  // server-side, so the report's renewal count always agrees with it.
  const quarterEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  // Contracts reviewed in the period: completed reviews uploaded this month.
  const reviewedThisPeriod = documents.filter((d) => {
    if (d.status !== "COMPLETE") return false;
    const at = new Date(d.uploadedAt ?? "");
    return !isNaN(at.getTime()) && at >= monthStart && at <= now;
  });

  // Red escalations raised in the period, with their status, from the
  // approvals queue (the same records the Approvals page shows).
  const raisedThisPeriod = approvals.filter((a) => {
    const at = new Date(a.createdAt ?? "");
    return !isNaN(at.getTime()) && at >= monthStart && at <= now;
  });

  // Renewals due next quarter (the same 90-day horizon as the dashboard tile),
  // from the documents' stored renewal dates.
  const renewalsNextQuarter = documents
    .filter((d) => {
      if (!d.renewalDate) return false;
      const at = new Date(d.renewalDate);
      return !isNaN(at.getTime()) && at >= now && at <= quarterEnd;
    })
    .sort((a, b) => String(a.renewalDate).localeCompare(String(b.renewalDate)));

  const deviating = data.byCounterparty.filter((cp) => cp.red > 0);

  const stat = (label: string, value: string, accent = "#0B1220") =>
    `<div class="stat"><div class="stat-v" style="color:${accent}">${esc(value)}</div><div class="stat-l">${esc(label)}</div></div>`;

  const STATUS_LABELS: Record<string, { label: string; accent: string }> = {
    PENDING:  { label: "Awaiting decision", accent: "#D97706" },
    APPROVED: { label: "Approved",          accent: "#16A34A" },
    REJECTED: { label: "Rejected",          accent: "#DC2626" },
  };

  const ROLE_LABELS: Record<string, string> = { CFO: "CFO", BOARD: "Board", GC: "GC", LEGAL: "Legal" };
  const roleLabel = (role: string) => ROLE_LABELS[role] ?? titleCase(role);

  const escalationRows = raisedThisPeriod.length
    ? raisedThisPeriod
        .map((a) => {
          const s = STATUS_LABELS[a.status] ?? { label: a.status, accent: "#64748B" };
          const who = a.status !== "PENDING" && a.decidedByName ? ` by ${a.decidedByName}` : "";
          return `<tr>
            <td>${esc(a.counterpartyName || a.documentName)}</td>
            <td>${a.clauseCategory ? titleCase(a.clauseCategory) : "<span class=\"muted\">-</span>"}</td>
            <td>${esc(roleLabel(a.routedToRole))}</td>
            <td><span class="dot" style="background:${s.accent}"></span>${esc(s.label)}${esc(who)}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="4" class="muted">No escalations were raised in ${esc(monthLabel)}.</td></tr>`;

  const renewalRows = renewalsNextQuarter.length
    ? renewalsNextQuarter
        .map(
          (d) =>
            `<tr><td>${esc(d.counterpartyName || d.originalName)}</td><td>${titleCase(d.contractType ?? "")}</td><td>${esc(dmy(d.renewalDate))}</td><td class="num">${d.contractValue ? money(d.contractValue) : "-"}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="muted">No contract renewals fall due in the next quarter.</td></tr>`;

  const counterpartyRows = deviating.length
    ? deviating
        .map(
          (cp) =>
            `<tr><td>${esc(cp.name)}</td><td class="num">${cp.red}</td><td class="num">${cp.amber}</td><td class="num">${money(cp.value)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="muted">No counterparties currently deviating from your standard terms.</td></tr>`;

  const generatedLabel = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(reportTitle)}</title>
<style>
  @page { margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0B1220; margin: 0; line-height: 1.5; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 8px 0 40px; }
  header { border-bottom: 2px solid #2563EB; padding-bottom: 14px; margin-bottom: 22px; }
  .brand { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #2563EB; font-weight: 700; }
  h1 { font-size: 22px; margin: 6px 0 2px; font-weight: 700; }
  .sub { color: #64748B; font-size: 13px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #334155; margin: 26px 0 10px; font-weight: 700; }
  .stats { display: flex; flex-wrap: wrap; gap: 14px; }
  .stat { flex: 1; min-width: 130px; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 14px; }
  .stat-v { font-size: 20px; font-weight: 700; }
  .stat-l { font-size: 11px; color: #64748B; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94A3B8; border-bottom: 1px solid #E2E8F0; padding: 7px 8px; font-weight: 600; }
  td { padding: 8px; border-bottom: 1px solid #F1F5F9; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.muted, .muted { color: #94A3B8; }
  .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 8px; vertical-align: middle; }
  footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; }
</style></head>
<body><div class="wrap">
  <header>
    <div class="brand">Zane · Monthly Legal Report</div>
    <h1>${esc(reportTitle)}</h1>
    <div class="sub">${esc(companyName)} · Generated ${esc(generatedLabel)}</div>
  </header>

  <h2>The month at a glance</h2>
  <div class="stats">
    ${stat(`Contracts reviewed in ${esc(monthLabel)}`, String(reviewedThisPeriod.length))}
    ${stat("Red-flag exposure", money(data.valueAtRisk.RED), data.valueAtRisk.RED > 0 ? "#DC2626" : "#16A34A")}
    ${stat("Escalations raised this month", String(raisedThisPeriod.length), raisedThisPeriod.length > 0 ? "#D97706" : "#16A34A")}
    ${stat("Renewals due next quarter", String(renewalsNextQuarter.length))}
  </div>

  <h2>Escalations raised and their status</h2>
  <table>
    <thead><tr><th>Contract</th><th>Clause</th><th>Routed to</th><th>Status</th></tr></thead>
    <tbody>${escalationRows}</tbody>
  </table>

  <h2>Renewals due next quarter (next 90 days)</h2>
  <table>
    <thead><tr><th>Contract</th><th>Type</th><th>Renewal date</th><th class="num">Value</th></tr></thead>
    <tbody>${renewalRows}</tbody>
  </table>

  <h2>Counterparties deviating from standard terms</h2>
  <table>
    <thead><tr><th>Counterparty</th><th class="num">Red</th><th class="num">Amber</th><th class="num">Value</th></tr></thead>
    <tbody>${counterpartyRows}</tbody>
  </table>

  <footer>Generated by Zane on ${esc(generatedLabel)}. Every figure is drawn from the live portfolio data shown in the dashboard at time of export. For internal use.</footer>
</div>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Please allow pop-ups to generate the monthly report.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
