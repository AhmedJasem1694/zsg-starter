import nodemailer from "nodemailer";

// Resend is the configured provider. Generic SMTP is retained so a different
// provider can be used without a code change, but Resend takes precedence.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
import { emailLinkOrigin } from "../lib/canonicalOrigin.js";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM ?? "Zane <approvals@zanelegal.ai>";
const APP_URL   = process.env.APP_URL;

/**
 * Base URL for links in emails. Falls back to localhost so a development send
 * still produces a usable link, and warns, because a production email carrying
 * a localhost approval link is worse than one that never sent.
 */
function baseUrl(): string {
  // emailLinkOrigin validates APP_URL and falls back if it is missing or not a
  // usable web URL. It does not correct a host that simply does not resolve.
  // See server/lib/canonicalOrigin.ts.
  return emailLinkOrigin();
}

/** Which transport will be used, if any. */
export type EmailTransport = "resend" | "smtp" | "none";
export function activeTransport(): EmailTransport {
  if (RESEND_API_KEY) return "resend";
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) return "smtp";
  return "none";
}

function getTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host:   SMTP_HOST,
    port:   SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth:   { user: SMTP_USER, pass: SMTP_PASS },
  });
}

/**
 * Send through the Resend HTTP API. Returns a specific error string rather than
 * a boolean so the caller can log why a notification did not arrive.
 */
async function sendViaResend(p: {
  to: string; subject: string; text: string; html?: string; from?: string; inReplyTo?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const from = p.from
    ? (p.from.includes("<") ? p.from : `Zane <${p.from}>`)
    : SMTP_FROM;
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [p.to],
        subject: p.subject,
        text: p.text,
        ...(p.html ? { html: p.html } : {}),
        ...(p.inReplyTo ? { headers: { "In-Reply-To": p.inReplyTo, "References": p.inReplyTo } } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // 403 here is almost always an unverified sending domain, which is the
      // one failure a correct API key still produces.
      const hint = res.status === 403
        ? " (check that zanelegal.ai is verified in the Resend dashboard)"
        : res.status === 401 ? " (RESEND_API_KEY rejected)" : "";
      return { ok: false, error: `Resend ${res.status}${hint}: ${body.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Resend request failed: ${(err as Error)?.message ?? String(err)}` };
  }
}

/**
 * Whether a transport is CONFIGURED. Not whether it works.
 *
 * This answers "did someone set a key", which is a weaker question than it
 * looks: any non-empty string passes. RESEND_API_KEY was once set to the
 * literal placeholder from a copy-pasted command, and for three minutes this
 * returned true, /api/health reported transport "resend", and nothing was
 * deliverable. Use isEmailUsable() where the answer must mean the provider
 * accepts the credentials.
 */
export function isEmailConfigured(): boolean {
  return activeTransport() !== "none";
}

// ── Is the configured credential actually good? ──────────────────────────────

/**
 * Three outcomes, not two, and the third is the one that matters.
 *
 * "invalid" means the provider answered and rejected the credential. That is
 * a standing fault: it will not fix itself and a caller should refuse to do
 * anything it cannot undo.
 *
 * "unreachable" means we could not get an answer. A DNS blip is not evidence
 * of a bad key, so it must never be recorded as one, and equally must not be
 * read as permission to proceed. Callers treat it like "unchecked": safe to
 * retry, not safe to commit to.
 */
export type EmailVerificationState = "unchecked" | "valid" | "invalid" | "unreachable";

export interface EmailVerification {
  state: EmailVerificationState;
  /** ISO timestamp of the last completed check, absent while unchecked. */
  checkedAt?: string;
  /** Why it failed. Never contains the credential. */
  error?: string;
  /**
   * The domain mail is sent from, and whether the provider will accept it.
   *
   * A valid key is not the same as a working send. Resend answers /domains
   * with 200 for any good key, then rejects the send itself with 403 when the
   * from-domain is not verified in the dashboard. That is the one failure a
   * perfectly correct key still produces, and it is invisible to a check that
   * only asks whether the credential is accepted.
   *
   * Absent when the provider is not Resend, or when the domain list could not
   * be parsed. In that case deliverability is not asserted either way: an
   * unparsed response is not evidence of a problem, so it does not block.
   */
  sendingDomain?: { name: string; status: string; verified: boolean };
}

/** The domain in SMTP_FROM, which is what a send will be addressed from. */
export function sendingDomain(): string | null {
  const m = SMTP_FROM.match(/<([^>]+)>/);
  const address = (m ? m[1] : SMTP_FROM).trim();
  const at = address.lastIndexOf("@");
  if (at === -1) return null;
  return address.slice(at + 1).toLowerCase() || null;
}

let verification: EmailVerification = { state: "unchecked" };
/** Guards against a thundering herd of checks when several callers race. */
let inFlight: Promise<EmailVerification> | null = null;

/** How long a completed check is trusted before it is made again. The monthly
 *  report loop runs hourly, so it always re-checks rather than trusting this. */
const VERIFICATION_TTL_MS = 15 * 60 * 1000;

function isFresh(v: EmailVerification): boolean {
  if (!v.checkedAt) return false;
  return Date.now() - new Date(v.checkedAt).getTime() < VERIFICATION_TTL_MS;
}

/**
 * Ask the provider whether the configured credential is accepted.
 *
 * Sends nothing. For Resend this lists domains, which is the cheapest call
 * that the provider authenticates. Note the status codes: a rejected key has
 * been seen as both 401 and 400 ("API key is invalid"), so anything the
 * provider answers with that is not success is treated as a rejection, while
 * only a transport-level throw counts as unreachable.
 */
async function runVerification(): Promise<EmailVerification> {
  const checkedAt = new Date().toISOString();
  const transport = activeTransport();

  if (transport === "none") {
    return { state: "unchecked", checkedAt };
  }

  if (transport === "resend") {
    let res: Response;
    try {
      res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      });
    } catch (err) {
      // No answer. Says nothing about the key.
      return { state: "unreachable", checkedAt, error: `Could not reach Resend: ${(err as Error)?.message}` };
    }
    if (res.ok) {
      // The key is good. Now ask whether a send from our own domain would be
      // accepted, which the key alone does not tell us.
      const want = sendingDomain();
      try {
        const payload = (await res.json()) as { data?: Array<{ name?: string; status?: string }> };
        const list = Array.isArray(payload?.data) ? payload.data : null;
        if (list && want) {
          const found = list.find((d) => String(d?.name ?? "").toLowerCase() === want);
          const status = String(found?.status ?? "not listed");
          return {
            state: "valid",
            checkedAt,
            sendingDomain: { name: want, status, verified: status.toLowerCase() === "verified" },
          };
        }
      } catch {
        // Shape changed, or not JSON. Fail soft: the credential is proven, and
        // an unparsed list is not evidence that sending is broken.
      }
      return { state: "valid", checkedAt };
    }

    const body = (await res.text().catch(() => "")).slice(0, 200);
    // 5xx is the provider having a bad day, not a verdict on the credential.
    if (res.status >= 500) {
      return { state: "unreachable", checkedAt, error: `Resend ${res.status}: ${body}` };
    }
    return { state: "invalid", checkedAt, error: `Resend ${res.status}: ${body}` };
  }

  const transporter = getTransporter();
  if (!transporter) return { state: "unchecked", checkedAt };
  try {
    await transporter.verify();
    return { state: "valid", checkedAt };
  } catch (err) {
    return { state: "invalid", checkedAt, error: (err as Error)?.message ?? String(err) };
  }
}

/**
 * The verification state, re-checking when the cached one has gone stale.
 *
 * @param force  Ignore the cache. The monthly report passes this, because it
 *               is about to claim a reporting period it cannot un-claim.
 */
export async function emailVerification(force = false): Promise<EmailVerification> {
  if (!force && isFresh(verification)) return verification;
  if (inFlight) return inFlight;

  inFlight = runVerification()
    .then((v) => {
      verification = v;
      return v;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** The last known state without making a network call. May be "unchecked". */
export function lastEmailVerification(): EmailVerification {
  return verification;
}

/**
 * Whether email can actually be delivered: a transport is configured AND the
 * provider accepts the credential.
 *
 * Deliberately false on "unreachable" and "unchecked". A caller asking this is
 * about to do something it cannot take back, and "we could not confirm" is not
 * a yes.
 */
export async function isEmailUsable(force = false): Promise<boolean> {
  if (activeTransport() === "none") return false;
  const v = await emailVerification(force);
  if (v.state !== "valid") return false;
  // When the domain status is known and is not verified, a send will be
  // refused however good the key is. When it is unknown, do not block on a
  // fact we could not establish.
  if (v.sendingDomain && !v.sendingDomain.verified) return false;
  return true;
}

/** One line saying why email is not usable, or null when it is. For logs and
 *  the preflight, so every caller words the same failure the same way. */
export async function emailBlocker(force = false): Promise<string | null> {
  if (activeTransport() === "none") {
    return `not configured (missing: ${missingEmailConfig().join(", ")})`;
  }
  const v = await emailVerification(force);
  if (v.state === "invalid") return `credential rejected by the provider: ${v.error}`;
  if (v.state === "unreachable") return `could not verify the credential: ${v.error}`;
  if (v.state === "unchecked") return "credential not yet checked";
  if (v.sendingDomain && !v.sendingDomain.verified) {
    return `the key is valid but the sending domain ${v.sendingDomain.name} is "${v.sendingDomain.status}" in the provider, so sends will be refused`;
  }
  return null;
}

/**
 * Check once at boot and say so in the log, so an invalid key is visible from
 * the deploy output rather than only when a send fails hours later. Never
 * throws and never blocks startup.
 */
export function startEmailVerification(): void {
  if (activeTransport() === "none") return;
  emailVerification(true)
    .then((v) => {
      if (v.state === "valid") {
        console.log(`[email] Credentials accepted by ${activeTransport()}.`);
      } else if (v.state === "invalid") {
        console.error(
          `[email] CREDENTIALS REJECTED: ${v.error}. A key is set, so the app looks configured, ` +
          `but nothing will be delivered. Run: npx tsx scripts/check-smtp.ts`,
        );
      } else {
        console.warn(`[email] Could not verify credentials: ${v.error}. Will retry.`);
      }
    })
    .catch((err) => console.warn("[email] Verification error:", (err as Error)?.message));
}

/** Which required settings are missing, for startup, preflight and the UI. */
export function missingEmailConfig(): string[] {
  const missing: string[] = [];
  if (activeTransport() === "none") missing.push("RESEND_API_KEY");
  if (!APP_URL) missing.push("APP_URL");
  return missing;
}

/**
 * Whether notifications can be delivered, and why not when they cannot. Served
 * to the approvals screen so a missing send is visible to the person waiting on
 * it rather than only in a server log.
 */
export function emailStatus(): {
  configured: boolean;
  transport: EmailTransport;
  missing: string[];
  verification: EmailVerification;
} {
  return {
    configured: isEmailConfigured(),
    transport: activeTransport(),
    missing: missingEmailConfig(),
    // Cached, never a network call: this is called per request. `configured`
    // and `verification.state` disagreeing is the whole point. A key that is
    // set but rejected reads configured true, verification invalid, which is
    // exactly the state that previously looked healthy.
    verification: lastEmailVerification(),
  };
}

/**
 * Opens a connection and authenticates without sending anything. Used by the
 * preflight script so credentials can be proven before a live approval is run.
 */
export async function verifyEmailTransport(): Promise<{ ok: boolean; error?: string }> {
  const transport = activeTransport();
  if (transport === "none") return { ok: false, error: `Not configured. Missing: ${missingEmailConfig().join(", ")}` };

  if (transport === "resend") {
    // Resend has no verify endpoint; listing domains proves the key works and
    // is the cheapest call that distinguishes a bad key from an unverified one.
    try {
      const res = await fetch("https://api.resend.com/domains", {
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}` },
      });
      if (res.status === 401) return { ok: false, error: "RESEND_API_KEY was rejected (401)" };
      if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `Could not reach Resend: ${(err as Error)?.message}` };
    }
  }

  const transporter = getTransporter()!;
  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? String(err) };
  }
}

/** Host and sender in use, for preflight output. Never returns the password. */
export function emailConfigSummary(): { transport: string; detail: string; from: string; appUrl: string } {
  const transport = activeTransport();
  const detail = transport === "resend"
    // Never print the key. The last four characters are enough to confirm which
    // key is loaded without exposing a usable secret.
    ? `api.resend.com, key ...${String(RESEND_API_KEY).slice(-4)}`
    : transport === "smtp"
      ? `${SMTP_HOST}:${SMTP_PORT} as ${SMTP_USER ? `${SMTP_USER.slice(0, 2)}***` : "(unset)"}`
      : "(none)";
  return { transport, detail, from: SMTP_FROM, appUrl: APP_URL ?? "(unset)" };
}

/**
 * Generic plain-text email send, used by the inbound "Email Zane" flow to
 * reply to a sender. `from` defaults to the company's inbound address when
 * provided (so replies thread naturally and the user can reply again), else
 * SMTP_FROM. `inReplyTo` (the inbound Message-Id) threads the reply.
 * Returns true if sent, false if SMTP isn't configured / send failed.
 * Never throws (a failed reply must not break inbound processing).
 */
export async function sendPlainEmail(p: {
  to: string;
  subject: string;
  text: string;
  from?: string;
  inReplyTo?: string;
}): Promise<boolean> {
  const transport = activeTransport();

  // No silent skip. A notification that never left must say so, and say which
  // variable is missing, because the failure is otherwise invisible until an
  // approver asks why they were never told.
  if (transport === "none") {
    console.error(
      `[Zane] EMAIL NOT SENT to ${p.to} ("${p.subject}"). No transport configured. ` +
      `Set RESEND_API_KEY (and APP_URL) in the environment. Missing: ${missingEmailConfig().join(", ")}`,
    );
    return false;
  }

  if (transport === "resend") {
    const result = await sendViaResend(p);
    if (!result.ok) {
      console.error(`[Zane] EMAIL NOT SENT to ${p.to} ("${p.subject}"). ${result.error}`);
      return false;
    }
    return true;
  }

  const transporter = getTransporter()!;
  const from = p.from
    ? (p.from.includes("<") ? p.from : `Zane <${p.from}>`)
    : SMTP_FROM;
  const headers = p.inReplyTo
    ? { "In-Reply-To": p.inReplyTo, "References": p.inReplyTo }
    : undefined;
  try {
    await transporter.sendMail({ from, to: p.to, subject: p.subject, text: p.text, headers });
    return true;
  } catch (err) {
    console.error(`[Zane] EMAIL NOT SENT to ${p.to} ("${p.subject}"). SMTP error: ${(err as Error)?.message}`);
    return false;
  }
}

/**
 * HTML email send with a plain-text fallback part. Used for the inbound review
 * result email. Same threading / from semantics as sendPlainEmail. Never throws.
 */
export async function sendHtmlEmail(p: {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  inReplyTo?: string;
  attachments?: Array<{ filename: string; path?: string; content?: Buffer; contentType?: string }>;
}): Promise<boolean> {
  const transport = activeTransport();
  if (transport === "none") {
    console.error(
      `[Zane] EMAIL NOT SENT to ${p.to} ("${p.subject}"). No transport configured. ` +
      `Missing: ${missingEmailConfig().join(", ")}`,
    );
    return false;
  }
  if (transport === "resend") {
    // Attachments are not supported on this path; the review email body carries
    // the link instead.
    const result = await sendViaResend({ to: p.to, subject: p.subject, text: p.text, html: p.html, from: p.from, inReplyTo: p.inReplyTo });
    if (!result.ok) console.error(`[Zane] EMAIL NOT SENT to ${p.to} ("${p.subject}"). ${result.error}`);
    return result.ok;
  }
  const transporter = getTransporter()!;
  const from = p.from
    ? (p.from.includes("<") ? p.from : `Zane <${p.from}>`)
    : SMTP_FROM;
  const headers = p.inReplyTo
    ? { "In-Reply-To": p.inReplyTo, "References": p.inReplyTo }
    : undefined;
  try {
    await transporter.sendMail({
      from, to: p.to, subject: p.subject, html: p.html, text: p.text, headers,
      attachments: p.attachments,
    });
    return true;
  } catch (err) {
    console.error(`[Zane] Failed to send HTML email to ${p.to}:`, (err as Error)?.message);
    return false;
  }
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
    console.warn(`[Zane] SMTP not configured - skipping escalation email to ${p.to.email} (${p.clauseLabel})`);
    return;
  }

  const reviewUrl = `${baseUrl()}/review/${p.documentId}`;
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
    <span style="color:#fff;font-weight:600;font-size:15px;margin-left:2px;">Zane</span>
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
      Zane has reviewed <strong>${p.contractName}</strong> and flagged a clause that requires your sign-off before the team can proceed.
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
      Review in Zane &rarr;
    </a>

    <!-- Footer -->
    <div style="border-top:1px solid #f1f5f9;padding-top:18px;">
      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
        This notification was sent by Zane on behalf of <strong>${p.companyName}</strong>.
        You are receiving it because you are listed as an approver in their escalation matrix.
        To update your notification preferences, contact your Zane administrator.
      </p>
    </div>
  </div>

</div>
</body>
</html>`;

  const text = [
    `Zane: Escalation required - ${p.clauseLabel}`,
    `Contract: ${p.contractName}`,
    "",
    `Hi ${p.to.name},`,
    "",
    `Zane has reviewed "${p.contractName}" and flagged a clause that requires your approval.`,
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
    `Sent by Zane on behalf of ${p.companyName}.`,
  ].join("\n");

  await transporter.sendMail({
    from:    SMTP_FROM,
    to:      `${p.to.name} <${p.to.email}>`,
    subject: `[Zane] Approval needed: ${p.clauseLabel} - ${p.contractName}`,
    text,
    html,
  });

  console.log(`[Zane] Escalation email sent to ${p.to.email} for clause: ${p.clauseLabel}`);
}

// ── Approval flow emails ──────────────────────────────────────────────────────
// The content is built separately from sending so the notification can be
// inspected and tested without delivering anything.

export interface ApprovalRequestEmailParams {
  to:              { name: string; email: string };
  role:            string;   // CFO | BOARD | ...
  contractName:    string;
  counterpartyName: string;
  contractValue:   number | null;
  currency:        string;
  reason:          string;   // why this was routed to this approver
  approvalId:      string;
}

export function buildApprovalRequestEmail(p: ApprovalRequestEmailParams): { subject: string; text: string; approvalUrl: string } {
  const approvalUrl = `${baseUrl()}/app/legal/approvals/${p.approvalId}`;
  const CURRENCY_SYMBOLS: Record<string, string> = { GBP: "\u00a3", USD: "$", EUR: "\u20ac" };
  const symbol = CURRENCY_SYMBOLS[p.currency || "GBP"] ?? "";
  const value = p.contractValue != null && p.contractValue > 0
    ? `${symbol}${p.contractValue.toLocaleString("en-GB")}`
    : "Not recorded";
  const counterparty = p.counterpartyName || "Not identified";

  // Subject names both the contract and the counterparty so the approver can
  // triage from the inbox list without opening anything.
  const subject = `Approval needed: ${p.contractName} (${counterparty})`;

  const text = [
    `Hi ${p.to.name},`,
    ``,
    `A contract is waiting for your ${p.role} approval before the team can proceed.`,
    ``,
    `Contract      ${p.contractName}`,
    `Counterparty  ${counterparty}`,
    `Value         ${value}`,
    `Reason        ${p.reason}`,
    ``,
    `Review the findings and record your decision here (sign-in required):`,
    approvalUrl,
    ``,
    `Your decision and the reason you give are written to the contract audit history.`,
    ``,
    `Zane`,
  ].join("\n");
  return { subject, text, approvalUrl };
}

/** Sends the approval request notification. Returns true only if actually sent. */
export async function sendApprovalRequestEmail(p: ApprovalRequestEmailParams): Promise<boolean> {
  const { subject, text } = buildApprovalRequestEmail(p);
  return sendPlainEmail({ to: p.to.email, subject, text });
}

/** Notifies the requester that a decision was made. Returns true only if sent. */
export async function sendApprovalDecisionEmail(p: {
  to: string;
  contractName: string;
  decision: "APPROVED" | "REJECTED";
  deciderName: string;
  deciderRole: string;
  reason: string;
  documentId: string;
}): Promise<boolean> {
  const reviewUrl = `${baseUrl()}/app/legal/review/${p.documentId}`;
  const verb = p.decision === "APPROVED" ? "approved" : "rejected";
  const subject = `${p.decision === "APPROVED" ? "Approved" : "Rejected"}: ${p.contractName}`;
  const text = [
    `${p.deciderName} (${p.deciderRole}) has ${verb} the escalation on ${p.contractName}.`,
    ``,
    `Reason: ${p.reason}`,
    ``,
    `Full review: ${reviewUrl}`,
  ].join("\n");
  return sendPlainEmail({ to: p.to, subject, text });
}
