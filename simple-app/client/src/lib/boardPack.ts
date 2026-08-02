// Board pack export for the Portfolio surface.
//
// Builds a clean, light-themed one-page risk summary from the data already shown
// on the Portfolio page (plus the existing timings endpoint for upcoming
// renewals) and opens it in a print window so a head of legal can Save as PDF and
// hand it to their board. It does not recompute anything: every figure comes
// straight from the portfolio/timings payloads.

import type { getPortfolio, getTimings } from "./api";

type PortfolioData = NonNullable<Awaited<ReturnType<typeof getPortfolio>>>;
type TimingsData = Awaited<ReturnType<typeof getTimings>>;

const money = (v: number): string => {
  if (!isFinite(v) || v <= 0) return "£0";
  return "£" + Math.round(v).toLocaleString("en-GB");
};

const esc = (s: string): string =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const titleCase = (s: string): string =>
  esc(String(s ?? "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()));

export function exportBoardPack(opts: {
  companyName: string;
  data: PortfolioData;
  timings: TimingsData | null;
  dateLabel: string;
}): void {
  const { companyName, data, timings, dateLabel } = opts;

  const amberClauseCount = data.byContractType.reduce((a, t) => a + (t.amber || 0), 0);
  const deviating = data.byCounterparty.filter((cp) => cp.red > 0);

  const stat = (label: string, value: string, accent = "#0B1220") =>
    `<div class="stat"><div class="stat-v" style="color:${accent}">${esc(value)}</div><div class="stat-l">${esc(label)}</div></div>`;

  const exposureRow = (label: string, value: number, accent: string) =>
    `<tr><td><span class="dot" style="background:${accent}"></span>${esc(label)}</td><td class="num">${money(value)}</td></tr>`;

  const counterpartyRows = deviating.length
    ? deviating
        .map(
          (cp) =>
            `<tr><td>${esc(cp.name)}</td><td class="num">${cp.red}</td><td class="num">${cp.amber}</td><td class="num">${money(cp.value)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="muted">No counterparties currently deviating from your standard terms.</td></tr>`;

  const clauseRows = data.topRedCategories.length
    ? data.topRedCategories
        .map((c) => `<tr><td>${titleCase(c.category)}</td><td class="num">${c.count}</td><td class="num">${c.pct}%</td></tr>`)
        .join("")
    : `<tr><td colspan="3" class="muted">No clause types are repeatedly flagging red.</td></tr>`;

  const contractTypeRows = data.byContractType.length
    ? data.byContractType
        .map((t) => `<tr><td>${titleCase(t.type)}</td><td class="num">${t.red}</td><td class="num">${t.amber}</td><td class="num">${t.total}</td></tr>`)
        .join("")
    : `<tr><td colspan="4" class="muted">No contract-type breakdown available.</td></tr>`;

  const renewalItems = (timings?.flagged ?? []).slice(0, 12);
  const renewalsSection = renewalItems.length
    ? `<h2>Upcoming renewals and key dates</h2>
       <table>
         <thead><tr><th>Contract</th><th>Type</th><th>Obligation</th><th>Status</th></tr></thead>
         <tbody>${renewalItems
           .map(
             (f) =>
               `<tr><td>${esc(f.contractName)}</td><td>${titleCase(f.contractType)}</td><td>${titleCase(f.clauseCategory)}</td><td>${esc(f.ragStatus)}</td></tr>`,
           )
           .join("")}</tbody>
       </table>`
    : `<h2>Upcoming renewals and key dates</h2><p class="muted">No upcoming renewal or notice-period obligations are currently flagged.</p>`;

  const insightSection = data.insight
    ? `<div class="note"><div class="note-h">Head of legal note</div><p>${esc(data.insight)}</p></div>`
    : "";

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(companyName)} Board Risk Pack</title>
<style>
  /* Source Serif 4, self-hosted. The export is written into a blank window, so
     the URL must be absolute or it resolves against about:blank and silently
     falls back. */
  @font-face {
    font-family: 'Source Serif 4';
    src: url('${window.location.origin}/fonts/SourceSerif4-Variable.woff2') format('woff2-variations');
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
  .note { margin-top: 26px; border: 1px solid #DBEAFE; background: #F8FAFF; border-radius: 10px; padding: 14px 16px; }
  .note-h { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #2563EB; font-weight: 700; margin-bottom: 5px; }
  .note p { margin: 0; font-size: 13px; color: #334155; }
  footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; }
</style></head>
<body><div class="wrap">
  <header>
    <div class="brand">Zane · Board Risk Pack</div>
    <h1>${esc(companyName)}</h1>
    <div class="sub">Contract portfolio risk summary · ${esc(dateLabel)}</div>
  </header>

  <h2>Exposure by RAG band</h2>
  <table><tbody>
    ${exposureRow("Red (do not sign / high risk)", data.valueAtRisk.RED, "#DC2626")}
    ${exposureRow("Amber (negotiate)", data.valueAtRisk.AMBER, "#D97706")}
    ${exposureRow("Green (acceptable)", data.valueAtRisk.GREEN, "#16A34A")}
    <tr><td><strong>Total portfolio value</strong></td><td class="num"><strong>${money(data.valueAtRisk.total || data.totalValue)}</strong></td></tr>
  </tbody></table>

  <h2>At a glance</h2>
  <div class="stats">
    ${stat("Contracts reviewed", String(data.totalDocuments))}
    ${stat("Red clauses", String(data.totalRedResults), "#DC2626")}
    ${stat("Amber clauses", String(amberClauseCount), "#D97706")}
    ${stat("Open escalations", String(data.escalationsOpen), data.escalationsOpen > 0 ? "#D97706" : "#16A34A")}
  </div>

  <h2>Counterparties deviating from your standard terms</h2>
  <table>
    <thead><tr><th>Counterparty</th><th class="num">Red</th><th class="num">Amber</th><th class="num">Value</th></tr></thead>
    <tbody>${counterpartyRows}</tbody>
  </table>

  <h2>Risk by clause type</h2>
  <table>
    <thead><tr><th>Clause</th><th class="num">Red flags</th><th class="num">Share</th></tr></thead>
    <tbody>${clauseRows}</tbody>
  </table>

  <h2>Risk by contract type</h2>
  <table>
    <thead><tr><th>Contract type</th><th class="num">Red</th><th class="num">Amber</th><th class="num">Total</th></tr></thead>
    <tbody>${contractTypeRows}</tbody>
  </table>

  ${renewalsSection}

  ${insightSection}

  <footer>Generated by Zane on ${esc(dateLabel)}. Figures reflect the portfolio at time of export. For internal and board use.</footer>
</div>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Please allow pop-ups to export the board pack.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
