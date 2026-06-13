/**
 * Contract review via email (Section 3).
 *
 * For a verified inbound email classified `review_contract`, this runs the
 * attachment through the EXISTING full review pipeline — identical to an in-app
 * upload — attributed to the sender's company (so their playbook, sector pack,
 * and regulation prominence all apply). It:
 *   3a. creates an uploaded_documents record (source: "email") and runs runReview()
 *   3b. sends an immediate in-thread acknowledgement
 *   3c. on completion, replies in-thread with a scannable HTML result
 *   3d. uses founder framing (SAFE / NEGOTIATE / DO NOT SIGN) for founder companies
 *
 * Attachments are reviewed via runReview(), which anonymises (PII pipeline)
 * before any model call — same guarantee as uploads.
 */

import fs from "fs";
import path from "path";
import { pb } from "../pb.js";
import { runReview } from "./reviewOrchestrator.js";
import { ensureInboundSchema } from "./inboundEmail.js";
import { audit } from "./auditLogger.js";
import { threadReplyText, threadReplyHtml, linkThreadContract, type ThreadContext } from "./emailThreads.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export interface InboundAttachment {
  filename: string;       // on-disk name in ./uploads
  originalName: string;
  size: number;
  mime: string;
}

interface IntentParams {
  counterparty?: string;
  documentType?: string;
  ourRole?: string;
  instructions?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clauseLabel(category: string): string {
  return (category ?? "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Map a free-text document type to a contractType enum value (best-effort). */
function mapContractType(documentType?: string): string {
  const t = (documentType ?? "").toUpperCase();
  if (/\bNDA\b|NON.?DISCLOSURE/.test(t)) return "NDA";
  if (/\bMSA\b|MASTER SERVICES/.test(t)) return "MSA";
  if (/\bDPA\b|DATA PROCESSING/.test(t)) return "DPA";
  if (/SAAS|SOFTWARE/.test(t)) return "SaaS_AGREEMENT";
  if (/LEASE/.test(t)) return "COMMERCIAL_LEASE";
  if (/EMPLOY/.test(t)) return "EMPLOYMENT";
  if (/CUSTOMER/.test(t)) return "CUSTOMER_AGREEMENT";
  if (/SUPPLIER|VENDOR/.test(t)) return "SUPPLIER_AGREEMENT";
  return "SUPPLIER_AGREEMENT";
}

const URGENCY_RANK: Record<string, number> = { IMMEDIATE: 0, MATERIAL: 1, BACKGROUND: 2 };
const RAG_RANK: Record<string, number> = { RED: 0, AMBER: 1, GREEN: 2, GREY: 3 };

const esc = (s: unknown): string =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function isFounderCompany(company: PBRecord): boolean {
  return company["persona"] === "FOUNDER" ||
    String(company["interface_type"] ?? "").toLowerCase() === "founder";
}

// ─── Result email content ─────────────────────────────────────────────────────

interface ResultSummary {
  verdictLabel: string;
  verdictColor: string;      // hex
  issues: PBRecord[];        // top 3
  escalations: PBRecord[];
}

export function buildSummary(results: PBRecord[], founder: boolean): ResultSummary {
  const present = results.filter((r) => !r["isAbsent"]);
  const criticalAbsent = results.filter((r) => r["isAbsent"] && r["missingSeverity"] === "CRITICAL");
  const considered = [...present, ...criticalAbsent];

  const hasRed = considered.some((r) => r["ragStatus"] === "RED");
  const hasAmber = considered.some((r) => r["ragStatus"] === "AMBER");

  let verdictLabel: string;
  let verdictColor: string;
  if (founder) {
    verdictLabel = hasRed ? "DO NOT SIGN YET" : hasAmber ? "NEGOTIATE FIRST" : "SAFE TO SIGN";
  } else {
    verdictLabel = hasRed ? "High risk — do not sign as-is" : hasAmber ? "Negotiate before signing" : "Clean — safe to sign";
  }
  verdictColor = hasRed ? "#B91C1C" : hasAmber ? "#B45309" : "#15803D";

  // Top issues: RED then AMBER, by urgency.
  const issues = considered
    .filter((r) => r["ragStatus"] === "RED" || r["ragStatus"] === "AMBER")
    .sort((a, b) => {
      const rag = (RAG_RANK[a["ragStatus"]] ?? 9) - (RAG_RANK[b["ragStatus"]] ?? 9);
      if (rag !== 0) return rag;
      return (URGENCY_RANK[a["urgencyLevel"]] ?? 9) - (URGENCY_RANK[b["urgencyLevel"]] ?? 9);
    })
    .slice(0, 3);

  const escalations = present.filter((r) => r["escalationRequired"]);
  return { verdictLabel, verdictColor, issues, escalations };
}

function issueText(r: PBRecord, founder: boolean): { why: string; action: string } {
  if (founder) {
    return {
      why: String(r["founderPlainEnglish"] || r["founderIfIgnored"] || r["whyItMatters"] || r["businessSummary"] || ""),
      action: String(r["founderAskFor"] || r["recommendedAction"] || ""),
    };
  }
  return {
    why: String(r["whyItMatters"] || r["businessSummary"] || ""),
    action: String(r["recommendedAction"] || ""),
  };
}

export function buildResultHtml(opts: {
  filename: string; verdict: ResultSummary; founder: boolean; reviewUrl: string;
}): string {
  const { filename, verdict, founder, reviewUrl } = opts;
  const issueBlocks = verdict.issues.map((r, i) => {
    const { why, action } = issueText(r, founder);
    const tag = r["ragStatus"] === "RED" ? "RED" : "AMBER";
    const tagColor = r["ragStatus"] === "RED" ? "#B91C1C" : "#B45309";
    return `
      <tr><td style="padding:0 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:10px;margin-bottom:12px;">
          <tr><td style="padding:14px 16px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.04em;color:${tagColor};text-transform:uppercase;">${esc(tag)} · ${esc(clauseLabel(r["clauseCategory"]))}</div>
            <div style="font-size:14px;color:#0B1020;line-height:1.5;margin-top:6px;">${esc(why)}</div>
            ${action ? `<div style="font-size:13px;color:#475569;line-height:1.5;margin-top:8px;"><strong style="color:#0B1020;">${founder ? "Ask for:" : "Recommended:"}</strong> ${esc(action)}</div>` : ""}
          </td></tr>
        </table>
      </td></tr>`;
  }).join("");

  const escalationBlock = verdict.escalations.length === 0 ? "" : `
      <tr><td style="padding:8px 28px 0;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:#64748B;text-transform:uppercase;margin-bottom:6px;">Needs sign-off</div>
        ${verdict.escalations.map((r) => `<div style="font-size:13px;color:#0B1020;line-height:1.5;margin-bottom:4px;">• ${esc(clauseLabel(r["clauseCategory"]))}: ${esc(r["escalationTrigger"] || "approval required")}</div>`).join("")}
      </td></tr>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF8;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;margin:32px auto;background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">

  <tr><td style="background:#0B1020;padding:20px 28px;">
    <span style="color:#ffffff;font-weight:700;font-size:16px;">Zane</span>
    <span style="color:#94A3B8;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;margin-left:8px;">Contract review</span>
  </td></tr>

  <tr><td style="padding:24px 28px 8px;">
    <div style="font-size:13px;color:#64748B;">${esc(filename)}</div>
    <div style="display:inline-block;margin-top:10px;padding:7px 14px;border-radius:8px;background:${verdict.verdictColor};color:#ffffff;font-size:14px;font-weight:700;">${esc(verdict.verdictLabel)}</div>
  </td></tr>

  ${verdict.issues.length > 0 ? `<tr><td style="padding:16px 28px 4px;"><div style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:#64748B;text-transform:uppercase;">${founder ? "What to watch" : "Top issues"}</div></td></tr>${issueBlocks}` : `<tr><td style="padding:8px 28px;"><div style="font-size:14px;color:#15803D;">No material issues found against your playbook.</div></td></tr>`}

  ${escalationBlock}

  <tr><td style="padding:20px 28px 28px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#2563EB;">
      <a href="${esc(reviewUrl)}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">View full review in Zane →</a>
    </td></tr></table>
  </td></tr>

  <tr><td style="padding:16px 28px;border-top:1px solid #E2E8F0;">
    <div style="font-size:11px;color:#94A3B8;line-height:1.5;">Reply to this email to ask a follow-up. Zane reviewed this against your company playbook, sector requirements, and applicable regulations.</div>
  </td></tr>

</table></td></tr></table></body></html>`;
}

export function buildResultText(opts: { filename: string; verdict: ResultSummary; founder: boolean; reviewUrl: string }): string {
  const { filename, verdict, founder, reviewUrl } = opts;
  const lines = [`Zane — contract review: ${filename}`, "", `Verdict: ${verdict.verdictLabel}`, ""];
  if (verdict.issues.length > 0) {
    lines.push(founder ? "What to watch:" : "Top issues:");
    for (const r of verdict.issues) {
      const { why, action } = issueText(r, founder);
      lines.push(`- [${r["ragStatus"]}] ${clauseLabel(r["clauseCategory"])}: ${why}`);
      if (action) lines.push(`  ${founder ? "Ask for" : "Recommended"}: ${action}`);
    }
    lines.push("");
  } else {
    lines.push("No material issues found against your playbook.", "");
  }
  if (verdict.escalations.length > 0) {
    lines.push("Needs sign-off:");
    for (const r of verdict.escalations) lines.push(`- ${clauseLabel(r["clauseCategory"])}: ${r["escalationTrigger"] || "approval required"}`);
    lines.push("");
  }
  lines.push(`View full review: ${reviewUrl}`, "", "— Zane");
  return lines.join("\n");
}

// ─── Orchestration ─────────────────────────────────────────────────────────────

export async function processReviewByEmail(input: {
  company: PBRecord;
  sender: string;
  subject: string;
  messageId: string;
  attachments: InboundAttachment[];
  intentParams: IntentParams;
  inboundRecordId: string;
  threadId?: string;
}): Promise<void> {
  const { company, sender, subject, messageId, attachments, intentParams, inboundRecordId } = input;
  const fromAddr = (company["inbound_email"] as string) || undefined;
  const replySubject = subject ? `Re: ${subject}` : "Re: your contract";
  const threadId = input.threadId ?? "";
  const ctx = (contractId?: string): ThreadContext => ({ companyId: company.id as string, user: sender, threadId, intent: "review_contract", contractId });

  // Pick the first contract attachment that still exists on disk.
  const contract = attachments.find((a) => fs.existsSync(path.join(process.cwd(), "uploads", a.filename)));
  if (!contract) {
    await threadReplyText(ctx(), {
      to: sender, from: fromAddr, subject: replySubject, inReplyTo: messageId,
      text: "Thanks — but I didn't find a contract attached. Forward the PDF or Word file and I'll review it against your playbook.\n\n— Zane",
    });
    if (inboundRecordId) await pb.collection("inbound_emails").update(inboundRecordId, { status: "NO_ATTACHMENT" }).catch(() => {});
    return;
  }

  await ensureInboundSchema().catch(() => {});

  // 3a. Create the document exactly like an in-app upload (source: email).
  let doc: PBRecord;
  try {
    doc = await pb.collection("uploaded_documents").create({
      company: company.id,
      filename: contract.filename,
      originalName: contract.originalName,
      contractType: mapContractType(intentParams.documentType),
      status: "PROCESSING",
      counterpartyName: intentParams.counterparty ?? "",
      reviewType: "INBOUND",
      currency: "GBP",
      source: "email",
    });
  } catch (err) {
    console.error("[email-review] could not create document:", (err as Error)?.message);
    await threadReplyText(ctx(), {
      to: sender, from: fromAddr, subject: replySubject, inReplyTo: messageId,
      text: "Sorry — something went wrong setting up the review. Please try again or contact ahmed@zanelegal.ai.\n\n— Zane",
    });
    return;
  }

  // Link this contract to the thread so later replies resolve against it (6a).
  await linkThreadContract(company.id as string, threadId, doc.id as string).catch(() => {});

  if (inboundRecordId) {
    await pb.collection("inbound_emails").update(inboundRecordId, { status: "PROCESSING", intent: "review_contract" }).catch(() => {});
  }
  void audit({
    action: "contract_uploaded",
    entityType: "uploaded_document",
    entityId: doc.id as string,
    companyId: company.id as string,
    detail: { source: "email", sender, originalName: contract.originalName },
  }).catch(() => {});

  const founder = isFounderCompany(company);
  const reviewUrl = `${APP_URL}/review/${doc.id}`;

  const docCtx = ctx(doc.id as string);

  // 3b. Immediate acknowledgement, in-thread.
  await threadReplyText(docCtx, {
    to: sender, from: fromAddr, subject: replySubject, inReplyTo: messageId,
    text: `On it. Reviewing ${contract.originalName} against your playbook now — you'll have the result shortly.\n\n— Zane`,
  });

  // 3a (cont). Run the existing full pipeline; resolves on COMPLETE, throws on failure.
  try {
    await runReview(doc.id as string);
  } catch (err) {
    console.error(`[email-review] pipeline failed for ${doc.id}:`, (err as Error)?.message);
    await threadReplyText(docCtx, {
      to: sender, from: fromAddr, subject: replySubject, inReplyTo: messageId,
      text: `I hit a problem reviewing ${contract.originalName}. You can retry from Zane: ${reviewUrl}\n\n— Zane`,
    });
    if (inboundRecordId) await pb.collection("inbound_emails").update(inboundRecordId, { status: "FAILED" }).catch(() => {});
    return;
  }

  // 3c / 3d. Build and send the result email, in-thread.
  const results = await pb.collection("review_results").getFullList({ filter: `document = "${doc.id}"` }).catch(() => [] as PBRecord[]);
  const verdict = buildSummary(results, founder);
  const html = buildResultHtml({ filename: contract.originalName, verdict, founder, reviewUrl });
  const text = buildResultText({ filename: contract.originalName, verdict, founder, reviewUrl });

  await threadReplyHtml(docCtx, {
    to: sender, from: fromAddr, inReplyTo: messageId,
    subject: replySubject, html, text,
  });

  if (inboundRecordId) {
    await pb.collection("inbound_emails").update(inboundRecordId, { status: "PROCESSED" }).catch(() => {});
  }
  console.log(`[email-review] sent result for ${contract.originalName} → ${sender} (verdict: ${verdict.verdictLabel})`);
}
