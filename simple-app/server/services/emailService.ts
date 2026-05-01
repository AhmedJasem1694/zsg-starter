import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? "MIKE Legal <noreply@usemike.co>";
const APP_URL   = process.env.APP_URL   ?? "http://localhost:3000";

function getTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host:   SMTP_HOST,
    port:   SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth:   { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export interface EscalationEmailParams {
  to:                { name: string; email: string };
  contractName:      string;
  documentId:        string;
  clauseLabel:       string;
  ragStatus:         string;
  escalationTrigger: string;
  recommendedAction: string;
  businessSummary:   string;
  companyName:       string;
}

export async function sendEscalationEmail(p: EscalationEmailParams): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`[MIKE] SMTP not configured - skipping escalation email to ${p.to.email} (${p.clauseLabel})`);
    return;
  }

  const reviewUrl = `${APP_URL}/review/${p.documentId}`;
  const accent    = p.ragStatus === "RED" ? "#dc2626" : "#d97706";
  const accentBg  = p.ragStatus === "RED" ? "#fef2f2" : "#fffbeb";
  const accentBorder = p.ragStatus === "RED" ? "#fecaca" : "#fde68a";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;">
<div style="max-width:580px;margin:40px auto 60px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">

  <!-- Header -->
  <div style="background:#0f172a;padding:22px 28px;display:flex;align-items:center;gap:10px;">
    <div style="width:30px;height:30px;background:#0d9488;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;">
      <span style="color:#fff;font-weight:700;font-size:13px;">M</span>
    </div>
    <span style="color:#fff;font-weight:600;font-size:15px;margin-left:2px;">MIKE</span>
    <span style="color:rgba(255,255,255,0.3);font-size:11px;letter-spacing:0.08em;text-transform:uppercase;margin-left:6px;">Legal Decision Engine</span>
  </div>

  <!-- Alert strip -->
  <div style="background:${accentBg};border-bottom:1px solid ${accentBorder};padding:14px 28px;display:flex;align-items:center;gap:10px;">
    <div style="width:8px;height:8px;border-radius:50%;background:${accent};flex-shrink:0;"></div>
    <span style="font-size:13px;font-weight:600;color:${accent};">Escalation required - your approval is needed</span>
  </div>

  <!-- Body -->
  <div style="padding:28px 28px 24px;">
    <p style="margin:0 0 6px;font-size:14px;color:#64748b;">Hi ${p.to.name},</p>
    <p style="margin:0 0 24px;font-size:14px;color:#1e293b;line-height:1.65;">
      MIKE has reviewed <strong>${p.contractName}</strong> and flagged a clause that requires your sign-off before the team can proceed.
    </p>

    <!-- Clause detail card -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <span style="font-size:13px;font-weight:700;color:#0f172a;">${p.clauseLabel}</span>
        <span style="font-size:11px;font-weight:700;color:${accent};background:${accentBg};border:1px solid ${accentBorder};border-radius:4px;padding:3px 8px;">${p.ragStatus}</span>
      </div>

      <div style="margin-bottom:14px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;margin-bottom:5px;">Why escalation is required</div>
        <div style="font-size:13px;color:#1e293b;line-height:1.6;">${p.escalationTrigger}</div>
      </div>

      <div style="margin-bottom:14px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;margin-bottom:5px;">Recommended action</div>
        <div style="font-size:13px;color:#1e293b;line-height:1.6;">${p.recommendedAction}</div>
      </div>

      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;margin-bottom:5px;">Plain English summary</div>
        <div style="font-size:13px;color:#475569;line-height:1.65;">${p.businessSummary}</div>
      </div>
    </div>

    <!-- CTA -->
    <a href="${reviewUrl}"
       style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 26px;border-radius:8px;margin-bottom:28px;">
      Review in MIKE &rarr;
    </a>

    <!-- Footer -->
    <div style="border-top:1px solid #f1f5f9;padding-top:18px;">
      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
        This notification was sent by MIKE on behalf of <strong>${p.companyName}</strong>.
        You are receiving it because you are listed as an approver in their escalation matrix.
        To update your notification preferences, contact your MIKE administrator.
      </p>
    </div>
  </div>

</div>
</body>
</html>`;

  const text = [
    `MIKE: Escalation required - ${p.clauseLabel}`,
    `Contract: ${p.contractName}`,
    "",
    `Hi ${p.to.name},`,
    "",
    `MIKE has reviewed "${p.contractName}" and flagged a clause that requires your approval.`,
    "",
    `Clause:                ${p.clauseLabel}`,
    `Status:                ${p.ragStatus}`,
    `Why escalation needed: ${p.escalationTrigger}`,
    `Recommended action:    ${p.recommendedAction}`,
    "",
    `Summary: ${p.businessSummary}`,
    "",
    `View the full review: ${reviewUrl}`,
    "",
    `Sent by MIKE on behalf of ${p.companyName}.`,
  ].join("\n");

  await transporter.sendMail({
    from:    SMTP_FROM,
    to:      `${p.to.name} <${p.to.email}>`,
    subject: `[MIKE] Approval needed: ${p.clauseLabel} - ${p.contractName}`,
    text,
    html,
  });

  console.log(`[MIKE] Escalation email sent to ${p.to.email} for clause: ${p.clauseLabel}`);
}
