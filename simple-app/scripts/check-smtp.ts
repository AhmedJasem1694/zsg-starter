/**
 * SMTP preflight. Proves outbound email works before relying on it in a demo.
 *
 * Reads credentials from .env only. It never asks for or stores a password.
 *
 *   npx tsx scripts/check-smtp.ts                  verify the connection only
 *   npx tsx scripts/check-smtp.ts you@example.com  verify, then send a test email
 *
 * Exit code is non-zero when email is not usable, so this can gate a deploy.
 */

import "dotenv/config";
import {
  verifyEmailTransport,
  emailConfigSummary,
  missingEmailConfig,
  isEmailConfigured,
  sendPlainEmail,
  buildApprovalRequestEmail,
} from "../server/services/emailService.js";

async function main() {
  const recipient = process.argv[2];

  console.log("Zane SMTP preflight\n");

  if (!isEmailConfigured()) {
    console.error("NOT CONFIGURED. Missing from .env:");
    for (const m of missingEmailConfig()) console.error(`  - ${m}`);
    console.error("\nApproval requests are still created and audited, but nobody is notified.");
    console.error("Add the settings to simple-app/.env, then re-run this script.");
    process.exitCode = 1;
    return;
  }

  const cfg = emailConfigSummary();
  console.log(`  host    ${cfg.host}:${cfg.port}`);
  console.log(`  user    ${cfg.user}`);
  console.log(`  from    ${cfg.from}`);
  console.log(`  appUrl  ${cfg.appUrl}`);
  const missing = missingEmailConfig();
  if (missing.length) console.log(`  note    ${missing.join(", ")}`);
  console.log();

  process.stdout.write("Verifying connection and credentials... ");
  const result = await verifyEmailTransport();
  if (!result.ok) {
    console.log("FAILED");
    console.error(`\n  ${result.error}\n`);
    process.exitCode = 1;
    return;
  }
  console.log("OK");

  if (!recipient) {
    console.log("\nConnection is good. Pass an address to send a real test:");
    console.log("  npx tsx scripts/check-smtp.ts you@example.com");
    return;
  }

  // Send the actual approval-request template, not a generic "hello", so what
  // arrives is exactly what an approver would receive.
  const sample = buildApprovalRequestEmail({
    to: { name: "Preflight", email: recipient },
    role: "CFO",
    contractName: "SMTP preflight, not a real contract",
    counterpartyName: "Preflight check",
    contractValue: 0,
    currency: "GBP",
    reason: "Sent by scripts/check-smtp.ts to prove outbound email works",
    approvalId: "preflight",
  });

  process.stdout.write(`Sending the approval-request template to ${recipient}... `);
  const sent = await sendPlainEmail({
    to: recipient,
    subject: `[Preflight] ${sample.subject}`,
    text: sample.text,
  });
  console.log(sent ? "SENT" : "FAILED");
  if (!sent) { process.exitCode = 1; return; }
  console.log(`\nCheck ${recipient}. If it arrived, approval notifications will work.`);
  console.log(`Links in the email point at ${cfg.appUrl}.`);
}

main().catch((e) => {
  console.error("PREFLIGHT ERROR:", e?.stack ?? e?.message ?? e);
  process.exitCode = 1;
});
