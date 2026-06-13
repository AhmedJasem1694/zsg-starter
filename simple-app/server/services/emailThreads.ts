/**
 * Email thread persistence + contextual replies (Section 6).
 *
 * Every inbound and outbound email is recorded in `email_threads`, keyed by a
 * stable thread_id derived from the message headers (References → In-Reply-To →
 * Message-Id). This lets a reply in an existing thread ("what about the
 * indemnity clause?") resolve against the contract that thread already linked,
 * without the user re-attaching anything, and is the groundwork for capturing
 * forwarded counterparty responses as negotiation events.
 */

import { pb } from "../pb.js";
import { sendPlainEmail, sendHtmlEmail } from "./emailService.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

export type EmailDirection = "inbound" | "outbound";

// ─── Schema self-heal ─────────────────────────────────────────────────────────

let schemaEnsured = false;

export async function ensureThreadSchema(): Promise<void> {
  if (schemaEnsured) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collections = pb.collections as any;
  try {
    await collections.getOne("email_threads");
    schemaEnsured = true;
    return;
  } catch { /* create below */ }
  try {
    await collections.create({
      name: "email_threads",
      type: "base",
      fields: [
        { name: "company", type: "text", required: true },
        { name: "user", type: "text", required: false },        // sender / recipient email
        { name: "thread_id", type: "text", required: false },
        { name: "direction", type: "text", required: false },   // inbound | outbound
        { name: "intent", type: "text", required: false },
        { name: "linked_contract", type: "text", required: false },
        { name: "subject", type: "text", required: false },
        { name: "body", type: "text", required: false },
        { name: "message_id", type: "text", required: false },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    });
    schemaEnsured = true;
  } catch (err) {
    console.warn("[threads] could not create email_threads (non-fatal):", (err as Error)?.message);
  }
}

// ─── Thread id ─────────────────────────────────────────────────────────────────

/** Derive a stable thread id from headers: References[0] → In-Reply-To → Message-Id. */
export function computeThreadId(messageId?: string, inReplyTo?: string, references?: string): string {
  const refs = (references ?? "").match(/<[^>]+>/g);
  if (refs && refs.length > 0) return refs[0];
  const irt = (inReplyTo ?? "").match(/<[^>]+>/);
  if (irt) return irt[0];
  if (inReplyTo && inReplyTo.trim()) return inReplyTo.trim();
  const mid = (messageId ?? "").match(/<[^>]+>/);
  if (mid) return mid[0];
  return (messageId ?? "").trim();
}

// ─── Logging ───────────────────────────────────────────────────────────────────

export async function logEmail(input: {
  companyId: string;
  user: string;
  threadId: string;
  direction: EmailDirection;
  intent?: string;
  contractId?: string;
  subject?: string;
  body?: string;
  messageId?: string;
}): Promise<string> {
  try {
    const rec = await pb.collection("email_threads").create({
      company: input.companyId,
      user: input.user ?? "",
      thread_id: input.threadId ?? "",
      direction: input.direction,
      intent: input.intent ?? "",
      linked_contract: input.contractId ?? "",
      subject: (input.subject ?? "").slice(0, 500),
      body: (input.body ?? "").slice(0, 50_000),
      message_id: input.messageId ?? "",
    });
    return rec.id as string;
  } catch (err) {
    console.warn("[threads] logEmail failed (non-fatal):", (err as Error)?.message);
    return "";
  }
}

/** The contract already linked to a thread (most recent linked record), or "". */
export async function getThreadContractId(companyId: string, threadId: string): Promise<string> {
  if (!threadId) return "";
  try {
    const rows = await pb.collection("email_threads").getFullList({
      filter: `company = "${companyId}" && thread_id = "${threadId.replace(/"/g, "")}" && linked_contract != ""`,
      sort: "-created",
      fields: "linked_contract",
    });
    return rows.length > 0 ? String(rows[0]["linked_contract"] ?? "") : "";
  } catch {
    return "";
  }
}

/** Link a contract to every record in a thread that doesn't yet have one. */
export async function linkThreadContract(companyId: string, threadId: string, contractId: string): Promise<void> {
  if (!threadId || !contractId) return;
  try {
    const rows = await pb.collection("email_threads").getFullList({
      filter: `company = "${companyId}" && thread_id = "${threadId.replace(/"/g, "")}" && linked_contract = ""`,
      fields: "id",
    });
    for (const r of rows) {
      await pb.collection("email_threads").update(r.id, { linked_contract: contractId }).catch(() => {});
    }
  } catch { /* non-fatal */ }
}

// ─── Thread-aware send wrappers (send + log outbound) ──────────────────────────

export interface ThreadContext {
  companyId: string;
  user: string;       // the counterparty in the conversation (the inbound sender)
  threadId: string;
  intent?: string;
  contractId?: string;
}

/** Send a plain-text reply and log it as an outbound email_threads record. */
export async function threadReplyText(ctx: ThreadContext, opts: {
  to: string; subject: string; text: string; from?: string; inReplyTo?: string;
}): Promise<boolean> {
  const sent = await sendPlainEmail(opts);
  await logEmail({
    companyId: ctx.companyId, user: opts.to, threadId: ctx.threadId, direction: "outbound",
    intent: ctx.intent, contractId: ctx.contractId, subject: opts.subject, body: opts.text, messageId: opts.inReplyTo,
  });
  return sent;
}

/** Send an HTML reply (optionally with attachments) and log it as outbound. */
export async function threadReplyHtml(ctx: ThreadContext, opts: {
  to: string; subject: string; html: string; text: string; from?: string; inReplyTo?: string;
  attachments?: Array<{ filename: string; path?: string; content?: Buffer; contentType?: string }>;
}): Promise<boolean> {
  const sent = await sendHtmlEmail(opts);
  await logEmail({
    companyId: ctx.companyId, user: opts.to, threadId: ctx.threadId, direction: "outbound",
    intent: ctx.intent, contractId: ctx.contractId, subject: opts.subject, body: opts.text, messageId: opts.inReplyTo,
  });
  return sent;
}

// ─── Forwarded-counterparty-response detection (6b) ────────────────────────────

/** Heuristic: is this inbound email a forwarded counterparty response? */
export function looksForwarded(subject: string, body: string): boolean {
  if (/^\s*(fwd?|fw):/i.test(subject)) return true;
  return /-{2,}\s*forwarded message|begin forwarded message|^\s*from:\s.+\n.*\n?(sent|date):/im.test(body);
}
