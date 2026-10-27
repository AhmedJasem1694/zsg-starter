// Monthly legal report export for the Portfolio surface.
//
// A dated, month-titled report (for example "July 2026 Legal Report") built
// the same way as the board pack: a light print window the user saves as PDF.
//
// Every figure comes from shared/monthlyReport.ts, which filters the existing
// portfolio, documents and approvals payloads that already drive the dashboard
// and the Portfolio page. Nothing is recomputed or newly derived here. That
// module is shared with the scheduled email send, so the report a person
// exports and the report that arrives in an inbox cannot carry different
// numbers. This file is only the print markup.

import {
  buildMonthlyReportModel,
  dmy,
  esc,
  money,
  roleLabel,
  titleCase,
  type MonthlyReportModel,
} from "../../../shared/monthlyReport";
import type { getPortfolio, ApprovalListItem } from "./api";
import type { UploadedDocument } from "./types";

type PortfolioData = NonNullable<Awaited<ReturnType<typeof getPortfolio>>>;

export function exportMonthlyReport(opts: {
  companyName: string;
  data: PortfolioData;
  documents: UploadedDocument[];
  approvals: ApprovalListItem[];
  now?: Date;
}): void {
  const model = buildMonthlyReportModel({
    companyName: opts.companyName,
    portfolio: opts.data,
    documents: opts.documents,
    approvals: opts.approvals,
    // On demand, the report is month-to-date: the user asked for it now.
    asOf: opts.now ?? new Date(),
  });

  const html = renderPrintableReport(model, window.location.origin);

  const w = window.open("", "_blank");
  if (!w) {
    alert("Please allow pop-ups to generate the monthly report.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/**
 * @param origin  Absolute origin for the webfont URL. The export is written
 *                into a blank window, so a relative URL resolves against
 *                about:blank and silently falls back.
 */
function renderPrintableReport(model: MonthlyReportModel, origin: string): string {
  const stat = (label: string, value: string, accent = "#0B1220") =>
    `<div class="stat"><div class="stat-v" style="color:${accent}">${esc(value)}</div><div class="stat-l">${esc(label)}</div></div>`;

  const escalationRows = model.escalations.length
    ? model.escalations
        .map((e) => {
          const who = e.decidedByName ? ` by ${e.decidedByName}` : "";
          return `<tr>
            <td>${esc(e.contract)}</td>
            <td>${e.clause ? titleCase(e.clause) : "<span class=\"muted\">-</span>"}</td>
            <td>${roleLabel(e.routedToRole)}</td>
            <td><span class="dot" style="background:${e.statusAccent}"></span>${esc(e.statusLabel)}${esc(who)}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="4" class="muted">No escalations were raised in ${esc(model.monthLabel)}.</td></tr>`;

  const renewalRows = model.renewals.length
    ? model.renewals
        .map(
          (r) =>
            `<tr><td>${esc(r.contract)}</td><td>${titleCase(r.type ?? "")}</td><td>${esc(dmy(r.renewalDate))}</td><td class="num">${r.contractValue ? money(r.contractValue) : "-"}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="muted">No contract renewals fall due in the next quarter.</td></tr>`;

  const counterpartyRows = model.counterparties.length
    ? model.counterparties
        .map(
          (cp) =>
            `<tr><td>${esc(cp.name)}</td><td class="num">${cp.red}</td><td class="num">${cp.amber}</td><td class="num">${money(cp.value)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="muted">No counterparties currently deviating from your standard terms.</td></tr>`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(model.reportTitle)}</title>
<style>
  /* Source Serif 4, self-hosted. */
  @font-face {
    font-family: 'Source Serif 4';
    src: url('${origin}/fonts/SourceSerif4-Variable.woff2') format('woff2-variations');
    font-weight: 200 900;
    font-style: normal;
    font-display: swap;
  }

  @page { margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0B1220; margin: 0; line-height: 1.5; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 8px 0 40px; }
  header { border-bottom: 2px solid #2563EB; padding-bottom: 14px; margin-bottom: 22px; }
  .brand { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #2563EB; font-weight: 700; }
  h1 { font-family: 'Source Serif 4', Georgia, serif; font-size: 24px; margin: 6px 0 2px; font-weight: 600; letter-spacing: -0.01em; }
  .sub { color: #64748B; font-size: 13px; }
  h2 { font-family: 'Source Serif 4', Georgia, serif; font-size: 15px; text-transform: none; letter-spacing: 0; color: #334155; margin: 26px 0 10px; font-weight: 600; }
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
    <h1>${esc(model.reportTitle)}</h1>
    <div class="sub">${esc(model.companyName)} · Generated ${esc(model.generatedLabel)}</div>
  </header>

  <h2>The month at a glance</h2>
  <div class="stats">
    ${stat(`Contracts reviewed in ${esc(model.monthLabel)}`, String(model.reviewedCount))}
    ${stat("Red-flag exposure", money(model.redExposure), model.redExposure > 0 ? "#DC2626" : "#16A34A")}
    ${stat("Escalations raised this month", String(model.escalationsRaised), model.escalationsRaised > 0 ? "#D97706" : "#16A34A")}
    ${stat("Renewals due next quarter", String(model.renewalsDueCount))}
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

  <footer>Generated by Zane on ${esc(model.generatedLabel)}. Every figure is drawn from the live portfolio data shown in the dashboard at time of export. For internal use.</footer>
</div>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body></html>`;
}
