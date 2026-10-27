/**
 * The monthly legal report, rendered for an inbox.
 *
 * Separate from the printable version in client/src/lib/monthlyReport.ts on
 * purpose. That one targets a print dialog and uses @page margins, a
 * self-hosted variable webfont and a flex row of stat cards. An email client
 * will strip the <style> block, ignore @font-face and, in Outlook's case, not
 * lay out a flex row at all, so reusing it would produce a report that is
 * correct and unreadable.
 *
 * So this renderer follows email rules instead: tables for layout, styles
 * inline on every element, system fonts, fixed pixel widths, no script. The
 * figures are not re-derived: they come from buildMonthlyReportModel, which
 * the printable version also uses, so the two documents cannot disagree.
 *
 * A plain-text part is built alongside the HTML rather than left to the
 * provider. The text version of a table of contract values is the part a
 * recipient on a phone or a text-only client actually reads, and an
 * auto-generated one would be a list of tags.
 */

import {
  dmy,
  esc,
  money,
  roleLabel,
  roleLabelRaw,
  titleCase,
  titleCaseRaw,
  type MonthlyReportModel,
} from "../../shared/monthlyReport.js";

const INK = "#0B1220";
const MUTED = "#64748B";
const FAINT = "#94A3B8";
const RULE = "#E2E8F0";
const HAIRLINE = "#F1F5F9";
const COBALT = "#2563EB";
const RED = "#DC2626";
const AMBER = "#D97706";
const GREEN = "#16A34A";

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** One headline figure, as a table cell so Outlook lays it out. */
function statCell(label: string, value: string, accent = INK): string {
  return `<td width="50%" style="padding:0 6px 12px 0;vertical-align:top;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid ${RULE};border-radius:10px;">
      <tr><td style="padding:12px 14px;">
        <div style="font-family:${FONT};font-size:20px;font-weight:700;color:${accent};line-height:1.2;">${esc(value)}</div>
        <div style="font-family:${FONT};font-size:11px;color:${MUTED};margin-top:3px;line-height:1.4;">${esc(label)}</div>
      </td></tr>
    </table>
  </td>`;
}

function heading(text: string): string {
  return `<tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:15px;font-weight:600;color:#334155;padding:26px 0 10px;">${esc(text)}</td></tr>`;
}

function th(text: string, align: "left" | "right" = "left"): string {
  return `<th align="${align}" style="font-family:${FONT};font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:${FAINT};border-bottom:1px solid ${RULE};padding:7px 8px;font-weight:600;">${esc(text)}</th>`;
}

function td(html: string, align: "left" | "right" = "left"): string {
  return `<td align="${align}" style="font-family:${FONT};font-size:13px;color:${INK};padding:8px;border-bottom:1px solid ${HAIRLINE};">${html}</td>`;
}

function emptyRow(span: number, text: string): string {
  return `<tr><td colspan="${span}" style="font-family:${FONT};font-size:13px;color:${FAINT};padding:8px;border-bottom:1px solid ${HAIRLINE};">${esc(text)}</td></tr>`;
}

function table(head: string, body: string): string {
  return `<tr><td>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </td></tr>`;
}

export interface RenderedReportEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * @param appOrigin  Origin for the "open in Zane" link. Comes from
 *                   emailLinkOrigin() via the caller, which validates APP_URL
 *                   and falls back when it is unusable.
 */
export function renderMonthlyReportEmail(
  model: MonthlyReportModel,
  appOrigin: string,
): RenderedReportEmail {
  const portfolioUrl = `${appOrigin}/portfolio`;

  const escalationBody = model.escalations.length
    ? model.escalations
        .map((e) => {
          const who = e.decidedByName ? ` by ${esc(e.decidedByName)}` : "";
          const dot = `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${e.statusAccent};margin-right:8px;"></span>`;
          return `<tr>
            ${td(esc(e.contract))}
            ${td(e.clause ? titleCase(e.clause) : `<span style="color:${FAINT};">-</span>`)}
            ${td(roleLabel(e.routedToRole))}
            ${td(`${dot}${esc(e.statusLabel)}${who}`)}
          </tr>`;
        })
        .join("")
    : emptyRow(4, `No escalations were raised in ${model.monthLabel}.`);

  const renewalBody = model.renewals.length
    ? model.renewals
        .map(
          (r) => `<tr>
            ${td(esc(r.contract))}
            ${td(titleCase(r.type ?? ""))}
            ${td(esc(dmy(r.renewalDate)))}
            ${td(r.contractValue ? money(r.contractValue) : "-", "right")}
          </tr>`,
        )
        .join("")
    : emptyRow(4, "No contract renewals fall due in the next quarter.");

  const counterpartyBody = model.counterparties.length
    ? model.counterparties
        .map(
          (cp) => `<tr>
            ${td(esc(cp.name))}
            ${td(String(cp.red), "right")}
            ${td(String(cp.amber), "right")}
            ${td(money(cp.value), "right")}
          </tr>`,
        )
        .join("")
    : emptyRow(4, "No counterparties currently deviating from your standard terms.");

  const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(model.reportTitle)}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F8FAFC;">
<tr><td align="center" style="padding:24px 12px;">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;width:100%;background:#FFFFFF;border-radius:12px;">
<tr><td style="padding:28px 28px 32px;">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td style="border-bottom:2px solid ${COBALT};padding-bottom:14px;">
      <div style="font-family:${FONT};font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${COBALT};font-weight:700;">Zane &middot; Monthly Legal Report</div>
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:600;color:${INK};margin:6px 0 2px;">${esc(model.reportTitle)}</div>
      <div style="font-family:${FONT};font-size:13px;color:${MUTED};">${esc(model.companyName)} &middot; Generated ${esc(model.generatedLabel)}</div>
    </td></tr>

    ${heading("The month at a glance")}
    <tr><td>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          ${statCell(`Contracts reviewed in ${model.monthLabel}`, String(model.reviewedCount))}
          ${statCell("Red-flag exposure", money(model.redExposure), model.redExposure > 0 ? RED : GREEN)}
        </tr>
        <tr>
          ${statCell("Escalations raised this month", String(model.escalationsRaised), model.escalationsRaised > 0 ? AMBER : GREEN)}
          ${statCell("Renewals due next quarter", String(model.renewalsDueCount))}
        </tr>
      </table>
    </td></tr>

    ${heading("Escalations raised and their status")}
    ${table(`${th("Contract")}${th("Clause")}${th("Routed to")}${th("Status")}`, escalationBody)}

    ${heading("Renewals due next quarter (next 90 days)")}
    ${table(`${th("Contract")}${th("Type")}${th("Renewal date")}${th("Value", "right")}`, renewalBody)}

    ${heading("Counterparties deviating from standard terms")}
    ${table(`${th("Counterparty")}${th("Red", "right")}${th("Amber", "right")}${th("Value", "right")}`, counterpartyBody)}

    <tr><td style="padding:28px 0 0;">
      <a href="${esc(portfolioUrl)}" style="font-family:${FONT};font-size:13px;font-weight:600;color:#FFFFFF;background:${COBALT};border-radius:8px;padding:11px 18px;text-decoration:none;display:inline-block;">Open the portfolio in Zane</a>
    </td></tr>

    <tr><td style="padding:28px 0 0;border-top:1px solid ${RULE};margin-top:32px;">
      <div style="font-family:${FONT};font-size:11px;color:${FAINT};line-height:1.6;padding-top:12px;">
        Generated by Zane on ${esc(model.generatedLabel)}. Every figure is drawn from the portfolio data in your dashboard at the close of ${esc(model.monthLabel)}. For internal use.
      </div>
    </td></tr>
  </table>

</td></tr>
</table>

</td></tr>
</table>
</body></html>`;

  // ── Plain text ──────────────────────────────────────────────────────────────

  const rule = "-".repeat(60);
  const lines: string[] = [
    model.reportTitle.toUpperCase(),
    `${model.companyName} · Generated ${model.generatedLabel}`,
    "",
    rule,
    "THE MONTH AT A GLANCE",
    rule,
    `Contracts reviewed in ${model.monthLabel}: ${model.reviewedCount}`,
    `Red-flag exposure: ${money(model.redExposure)}`,
    `Escalations raised this month: ${model.escalationsRaised}`,
    `Renewals due next quarter: ${model.renewalsDueCount}`,
    "",
    rule,
    "ESCALATIONS RAISED AND THEIR STATUS",
    rule,
  ];

  if (model.escalations.length) {
    for (const e of model.escalations) {
      const clause = e.clause ? ` (${titleCaseRaw(e.clause)})` : "";
      const who = e.decidedByName ? ` by ${e.decidedByName}` : "";
      lines.push(`- ${e.contract}${clause}`);
      lines.push(`  routed to ${roleLabelRaw(e.routedToRole)} · ${e.statusLabel}${who}`);
    }
  } else {
    lines.push(`No escalations were raised in ${model.monthLabel}.`);
  }

  lines.push("", rule, "RENEWALS DUE NEXT QUARTER (NEXT 90 DAYS)", rule);
  if (model.renewals.length) {
    for (const r of model.renewals) {
      const value = r.contractValue ? ` · ${money(r.contractValue)}` : "";
      const type = r.type ? ` · ${titleCaseRaw(r.type)}` : "";
      lines.push(`- ${r.contract}${type} · ${dmy(r.renewalDate)}${value}`);
    }
  } else {
    lines.push("No contract renewals fall due in the next quarter.");
  }

  lines.push("", rule, "COUNTERPARTIES DEVIATING FROM STANDARD TERMS", rule);
  if (model.counterparties.length) {
    for (const cp of model.counterparties) {
      lines.push(`- ${cp.name}: ${cp.red} red, ${cp.amber} amber · ${money(cp.value)}`);
    }
  } else {
    lines.push("No counterparties currently deviating from your standard terms.");
  }

  lines.push(
    "",
    `Open the portfolio in Zane: ${portfolioUrl}`,
    "",
    `Generated by Zane on ${model.generatedLabel}. Every figure is drawn from the portfolio data in your dashboard at the close of ${model.monthLabel}. For internal use.`,
  );

  // The plain part is assembled from the model's own strings, which the HTML
  // renderer escapes on the way out. Here they must be raw, so anything that
  // went through esc() or titleCase() is avoided above.
  return {
    subject: `${model.reportTitle}: ${model.companyName}`,
    html,
    text: lines.join("\n"),
  };
}
