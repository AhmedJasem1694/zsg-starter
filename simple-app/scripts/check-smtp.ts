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
  emailVerification,
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
  const check = await emailVerification(true);
  if (check.state !== "valid") {
    console.log(check.state === "invalid" ? "REJECTED" : "COULD NOT VERIFY");
    console.error(`\n  ${check.error}\n`);
    if (check.state === "invalid") {
      console.error("  A key IS set, so the app reports itself configured. Nothing will be delivered.");
      console.error("  Check the value is the real key and not a placeholder from a pasted command.\n");
    }
    process.exitCode = 1;
    return;
  }
  console.log("OK");

  /**
   * A good key is not a working send. Resend answers /domains for any valid
   * key and then refuses the send itself with 403 when the from-domain is not
   * verified, which is the one failure a perfectly correct key still produces.
   */
  if (check.sendingDomain) {
    const d = check.sendingDomain;
    process.stdout.write(`Sending domain ${d.name}... `);
    if (d.verified) {
      console.log("verified");
    } else {
      console.log(`${d.status.toUpperCase()}`);
      console.error(`\n  The key is valid, but ${d.name} is "${d.status}" in the provider.`);
      console.error("  Sends from this address will be refused with 403. Verify the domain");
      console.error("  in the Resend dashboard, or change SMTP_FROM to a domain that is.\n");
      process.exitCode = 1;
      return;
    }
  }

  if (!recipient) {
    console.log("\nCredentials are good and the sending domain is verified.");
    console.log("Pass an address to send a real test:");
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
