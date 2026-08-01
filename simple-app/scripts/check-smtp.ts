/**
 * Email preflight. Proves outbound notification works before relying on it in a
 * demo. Uses Resend when RESEND_API_KEY is set, otherwise generic SMTP.
 *
 * Reads credentials from the environment only. It never asks for, prints or
 * stores a key.
 *
 *   npm run email:test                  verify credentials only, send nothing
 *   npm run email:test you@example.com  verify, then send a sample approval email
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

  console.log("Zane email preflight\n");

  if (!isEmailConfigured()) {
    console.error("NOT CONFIGURED. Missing from the environment:");
    for (const m of missingEmailConfig()) console.error(`  - ${m}`);
    console.error("\nApproval requests are still created and audited, but nobody is notified.");
    console.error("\nSet these in simple-app/.env, then re-run:");
    console.error('  RESEND_API_KEY="re_..."            from resend.com/api-keys');
    console.error('  APP_URL="https://zanelegal.ai"     used for the approval link in the email');
    process.exitCode = 1;
    return;
  }

  const cfg = emailConfigSummary();
  console.log(`  transport  ${cfg.transport}`);
  console.log(`  detail     ${cfg.detail}`);
  console.log(`  from       ${cfg.from}`);
  console.log(`  appUrl     ${cfg.appUrl}`);
  const missing = missingEmailConfig();
  if (missing.length) console.log(`  note    ${missing.join(", ")}`);
  console.log();

  process.stdout.write("Verifying credentials... ");
  const result = await verifyEmailTransport();
  if (!result.ok) {
    console.log("FAILED");
    console.error(`\n  ${result.error}\n`);
    process.exitCode = 1;
    return;
  }
  console.log("OK");

  if (!recipient) {
    console.log("\nCredentials are good. Pass an address to send a real test:");
    console.log("  npm run email:test you@example.com");
    return;
  }

  // Send the actual approval-request template, not a generic "hello", so what
  // arrives is exactly what an approver would receive.
  const sample = buildApprovalRequestEmail({
    to: { name: "Preflight", email: recipient },
    role: "CFO",
    contractName: "Preflight check, not a real contract",
    counterpartyName: "Halcyon Systems",
    contractValue: 120000,
    currency: "GBP",
    reason: "sent by the email preflight to prove outbound notification works",
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
  console.log("The body is the real approval template, so what landed is what an approver receives.");
  console.log(`Links in the email point at ${cfg.appUrl}.`);
}

main().catch((e) => {
  console.error("PREFLIGHT ERROR:", e?.stack ?? e?.message ?? e);
  process.exitCode = 1;
});
