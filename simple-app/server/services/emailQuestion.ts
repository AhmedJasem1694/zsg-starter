/**
 * Questions via email (Section 5).
 *
 * Answers a `question` intent grounded ONLY in the company's own Zane data:
 * their playbook positions, their reviewed contracts, and their counterparty
 * history. One Sonnet call with the relevant context retrieved. If the answer
 * isn't in their data, it says so plainly. It never answers general legal
 * questions. It replies that Zane answers questions about the company's own
 * contracts and positions. Replies are short, in-thread, with a link to the
 * relevant contract or the playbook in-app.
 */

import { pb } from "../pb.js";
import { llmJsonCall } from "./llmJsonParse.js";
import { getModelForTask } from "./modelRouter.js";
import { threadReplyText, type ThreadContext } from "./emailThreads.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

interface IntentParams {
  counterparty?: string;
  documentType?: string;
  ourRole?: string;
  instructions?: string;
}

const clauseLabel = (c: string) => (c ?? "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase());
const NOT_IN_RECORDS = "I do not have that in your contract records.";
const GENERAL_REFUSAL =
  "I answer questions about your own contracts and positions: what's in your playbook, your reviewed contracts, and your counterparty history. For general legal questions you'll want a lawyer.\n\nZane";

// ─── Retrieval ─────────────────────────────────────────────────────────────────

/** Find the company's reviewed contracts most relevant to the question text + named counterparty. */
async function findRelevantContracts(companyId: string, questionText: string, counterparty: string): Promise<PBRecord[]> {
  const docs = await pb.collection("uploaded_documents")
    .getFullList({ filter: `company = "${companyId}"` })
    .catch(() => [] as PBRecord[]);
  const complete = docs.filter((d) => d["status"] === "COMPLETE");
  const q = questionText.toLowerCase();
  const cp = counterparty.trim().toLowerCase();

  const scored = complete.map((d) => {
    let score = 0;
    const name = String(d["originalName"] ?? "").toLowerCase().replace(/\.(pdf|docx?|)$/i, "");
    const dcp = String(d["counterpartyName"] ?? "").toLowerCase();
    if (cp && dcp && (dcp.includes(cp) || cp.includes(dcp))) score += 3;
    // token overlap between the file/counterparty name and the question
    for (const tok of name.split(/[^a-z0-9]+/).filter((t) => t.length >= 4)) {
      if (q.includes(tok)) score += 1;
    }
    if (dcp && dcp.length >= 4 && q.includes(dcp)) score += 2;
    return { d, score };
  });

  let picked = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).map((s) => s.d);
  // If nothing matched by text but a counterparty was named, fall back to their contracts.
  if (picked.length === 0 && cp) {
    picked = complete.filter((d) => String(d["counterpartyName"] ?? "").toLowerCase().includes(cp));
  }
  return picked.slice(0, 3);
}

function summariseResults(results: PBRecord[]): string {
  return results.slice(0, 12).map((r) => {
    const bits = [`${clauseLabel(r["clauseCategory"] as string)} [${r["ragStatus"]}]`];
    const detail = String(r["clauseSummary"] || r["whyItMatters"] || "").slice(0, 240);
    if (detail) bits.push(detail);
    const action = String(r["recommendedAction"] || "").slice(0, 160);
    if (action) bits.push(`Recommended: ${action}`);
    return "  - " + bits.join(", ");
  }).join("\n");
}

// ─── Orchestration ─────────────────────────────────────────────────────────────

export interface QuestionResult { scope: string; answer: string; link: string }

export async function processQuestionByEmail(input: {
  company: PBRecord;
  sender: string;
  subject: string;
  bodyText: string;
  messageId: string;
  intentParams: IntentParams;
  inboundRecordId: string;
  threadId?: string;
  forceContractId?: string;
}): Promise<QuestionResult> {
  const { company, sender, subject, bodyText, messageId, intentParams, inboundRecordId } = input;
  const fromAddr = (company["inbound_email"] as string) || undefined;
  const replySubject = subject ? `Re: ${subject}` : "Re: your question";
  const companyName = ((company["name"] as string) ?? "").trim() || "your company";
  const questionText = `${subject}\n${bodyText}`.trim();
  const threadId = input.threadId ?? "";
  const forceContractId = (input.forceContractId ?? "").trim();
  const ctx = (contractId?: string): ThreadContext => ({
    companyId: company.id as string, user: sender, threadId, intent: "question", contractId: contractId || forceContractId || undefined,
  });

  const markStatus = (status: string) =>
    inboundRecordId ? pb.collection("inbound_emails").update(inboundRecordId, { status, intent: "question" }).catch(() => {}) : Promise.resolve();

  // ── Retrieve grounding context (company data only) ──────────────────────────
  const [playbookRules, relevantContracts] = await Promise.all([
    pb.collection("playbook_rules").getFullList({ filter: `company = "${company.id}"` }).catch(() => [] as PBRecord[]),
    findRelevantContracts(company.id as string, questionText, intentParams.counterparty ?? ""),
  ]);

  // A reply in an existing thread resolves against that thread's contract, pull it
  // to the front so a follow-up like "what about the indemnity clause?" is grounded
  // in the contract already under discussion without re-attaching anything.
  let contracts = relevantContracts;
  if (forceContractId && !contracts.some((c) => c.id === forceContractId)) {
    const forced = await pb.collection("uploaded_documents").getOne(forceContractId).catch(() => null);
    if (forced) contracts = [forced, ...contracts].slice(0, 3);
  }

  const positionsBlock = playbookRules.length > 0
    ? playbookRules.map((r) =>
        `- ${clauseLabel(r["clauseCategory"] as string)}: preferred="${r["preferredPosition"] ?? ""}" | fallback="${r["acceptableFallback"] ?? ""}" | red line="${r["hardRedLine"] ?? ""}"`
      ).join("\n")
    : "(No playbook positions on file.)";

  // Load each relevant contract's review results.
  const contractBlocks: string[] = [];
  const contractIndex: Array<{ id: string; name: string; counterparty: string }> = [];
  for (const d of contracts) {
    const results = await pb.collection("review_results").getFullList({ filter: `document = "${d.id}"` }).catch(() => [] as PBRecord[]);
    contractIndex.push({ id: d.id as string, name: String(d["originalName"] ?? ""), counterparty: String(d["counterpartyName"] ?? "") });
    contractBlocks.push(
      `CONTRACT id=${d.id} name="${d["originalName"]}" counterparty="${d["counterpartyName"] || "unknown"}" type="${d["contractType"] || ""}"\n${summariseResults(results) || "  (no clause results)"}`
    );
  }
  const contractsBlock = contractBlocks.length > 0 ? contractBlocks.join("\n\n") : "(No matching reviewed contracts found in your records.)";

  // Counterparty history line (grounded count).
  let counterpartyBlock = "";
  if ((intentParams.counterparty ?? "").trim()) {
    const cp = intentParams.counterparty!.trim();
    counterpartyBlock = `\nCOUNTERPARTY HISTORY: ${contractIndex.filter((c) => c.counterparty.toLowerCase().includes(cp.toLowerCase())).length} reviewed contract(s) with "${cp}" in your records.`;
  }

  // ── One Sonnet call, hard-grounded ──────────────────────────────────────────
  const system = `You are Zane, answering a question from a member of ${companyName}'s team about THEIR OWN contracts and positions. You may ONLY use the data provided below: their playbook positions, their reviewed contracts, and their counterparty history. Respond with JSON only.

HARD RULES:
1. Answer ONLY from the provided data. Do not use outside legal knowledge.
2. If the answer is not in the provided data, set scope="none". Do not guess.
3. If the question is a general legal question (not about this company's specific contracts or positions), set scope="general".
4. Keep the answer short and direct, 1 to 4 sentences. No preamble.
5. If you reference a specific contract, put its id in contractId (must be one of the provided contract ids).`;

  const user = `QUESTION:
${questionText}

${companyName}'S PLAYBOOK POSITIONS:
${positionsBlock}

${companyName}'S RELEVANT REVIEWED CONTRACTS:
${contractsBlock}${counterpartyBlock}

Return ONLY this JSON:
{
  "answer": "the short, direct answer grounded only in the data above",
  "scope": "contract" | "playbook" | "counterparty" | "none" | "general",
  "contractId": "the id of the contract your answer references, or empty string"
}`;

  let parsed: { answer: string; scope: string; contractId: string };
  try {
    const raw = await llmJsonCall<Record<string, unknown>>({
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      model: getModelForTask("playbook_comparison"), // Claude Sonnet 4.6
      maxTokens: 1200,
      timeoutMs: 60_000,
      description: "email question answering",
    });
    parsed = {
      answer: String(raw["answer"] ?? "").trim(),
      scope: String(raw["scope"] ?? "none").trim().toLowerCase(),
      contractId: String(raw["contractId"] ?? "").trim(),
    };
  } catch (err) {
    console.error(`[question] answering failed for ${sender}:`, (err as Error)?.message);
    await threadReplyText(ctx(), { to: sender, from: fromAddr, subject: replySubject, inReplyTo: messageId,
      text: `Sorry, I couldn't answer that just now. Please try again or contact ahmed@zanelegal.ai.\n\nZane` });
    await markStatus("FAILED");
    return { scope: "error", answer: "", link: "" };
  }

  // General legal question, refuse with the standard message.
  if (parsed.scope === "general") {
    await threadReplyText(ctx(), { to: sender, from: fromAddr, subject: replySubject, inReplyTo: messageId, text: GENERAL_REFUSAL });
    await markStatus("ANSWERED_GENERAL_REFUSED");
    console.log(`[question] ${sender}: general legal question refused`);
    return { scope: "general", answer: GENERAL_REFUSAL, link: "" };
  }

  // Not in their data, say so plainly.
  if (parsed.scope === "none" || !parsed.answer) {
    await threadReplyText(ctx(), { to: sender, from: fromAddr, subject: replySubject, inReplyTo: messageId,
      text: `${NOT_IN_RECORDS}\n\nZane` });
    await markStatus("ANSWERED_NO_DATA");
    console.log(`[question] ${sender}: not in records`);
    return { scope: "none", answer: NOT_IN_RECORDS, link: "" };
  }

  // Grounded answer, reply short + a link to the relevant contract or playbook.
  const validContract = contractIndex.find((c) => c.id === parsed.contractId);
  const link = validContract
    ? `${APP_URL}/review/${validContract.id}`
    : `${APP_URL}/app/legal/playbook`;
  const linkLabel = validContract ? `View the contract in Zane: ${link}` : `Your playbook in Zane: ${link}`;

  await threadReplyText(ctx(validContract?.id), {
    to: sender, from: fromAddr, subject: replySubject, inReplyTo: messageId,
    text: `${parsed.answer}\n\n${linkLabel}\n\nZane`,
  });
  await markStatus("ANSWERED");
  console.log(`[question] ${sender}: answered (scope=${parsed.scope}${validContract ? ", contract " + validContract.id : ""})`);
  return { scope: parsed.scope, answer: parsed.answer, link };
}
