/**
 * Email intent parsing (Section 2).
 *
 * Every verified inbound email is classified with ONE Gemini 3.5 Flash call
 * (cheap, fast — the same model used for document classification). We return
 * the intent plus extracted parameters (counterparty, document type, our role,
 * any specific instructions) so a downstream section can do the actual work.
 */

import { llmJsonCall } from "./llmJsonParse.js";
import { getModelForTask } from "./modelRouter.js";

export type EmailIntent =
  | "review_contract"   // attachment present, wants a review
  | "draft_document"    // asks for a first draft (e.g. "draft an NDA for X")
  | "question"          // asks a question about a contract / position
  | "unclear";

export interface EmailIntentResult {
  intent: EmailIntent;
  /** Counterparty / other-party name, or "" if none stated */
  counterparty: string;
  /** Document type, e.g. "NDA", "MSA", "DPA", or "" if not stated */
  documentType: string;
  /** Which side we are on: "customer" | "supplier" | "buyer" | "vendor" | "" */
  ourRole: string;
  /** Any specific instructions, e.g. "focus on liability", verbatim-ish */
  instructions: string;
}

const VALID_INTENTS: EmailIntent[] = ["review_contract", "draft_document", "question", "unclear"];

function coerceIntent(raw: unknown, hasAttachments: boolean): EmailIntent {
  const v = String(raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((VALID_INTENTS as string[]).includes(v)) return v as EmailIntent;
  // Reasonable fallback: an attachment with no clear instruction is almost
  // always a review request; otherwise we ask for clarification.
  return hasAttachments ? "review_contract" : "unclear";
}

const cap = (s: unknown, n: number): string => String(s ?? "").trim().slice(0, n);

export async function parseEmailIntent(input: {
  subject: string;
  bodyText: string;
  attachmentNames: string[];
}): Promise<EmailIntentResult> {
  const hasAttachments = input.attachmentNames.length > 0;
  const attachmentList = hasAttachments ? input.attachmentNames.join(", ") : "(none)";

  const system = `You classify inbound emails sent to a legal AI assistant ("Zane"). The sender is a member of a company's legal/commercial team. Classify what they want and extract parameters. Respond with JSON only.`;

  const user = `Classify this email into exactly one intent and extract parameters.

INTENTS:
- "review_contract": the sender wants a contract reviewed. Usually an attachment is present, or they reference an attached/forwarded document.
- "draft_document": the sender asks Zane to produce a first draft of a document (e.g. "draft an NDA for Acme", "put together a mutual NDA").
- "question": the sender asks a question about a contract, clause, or their negotiating position, and does not need a review or a draft.
- "unclear": the request cannot be confidently placed in the above, or is too vague to act on.

EMAIL SUBJECT: ${input.subject || "(no subject)"}
ATTACHMENTS: ${attachmentList}
EMAIL BODY:
${input.bodyText || "(empty body)"}

Return ONLY this JSON:
{
  "intent": "review_contract" | "draft_document" | "question" | "unclear",
  "counterparty": "the other party's name if stated, else empty string",
  "documentType": "the contract/document type if stated (e.g. NDA, MSA, DPA, Services Agreement), else empty string",
  "ourRole": "which side the sender's company is on: customer | supplier | buyer | vendor | licensor | licensee, else empty string",
  "instructions": "any specific instruction the sender gave, e.g. 'focus on liability', 'we are the supplier here', else empty string"
}

Rules:
- If an attachment is present and the body asks for a review (or says nothing specific), use "review_contract".
- Only use "draft_document" when they clearly ask you to create/produce/draft a new document.
- Do not invent a counterparty, document type, or role that is not in the email.`;

  try {
    const raw = await llmJsonCall<Record<string, unknown>>({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      model: getModelForTask("document_classification"), // Gemini 3.5 Flash
      // Generous budget: Gemini 3.5 Flash spends reasoning tokens against this
      // ceiling, so a small limit truncates the JSON before it completes.
      maxTokens: 2000,
      timeoutMs: 30_000,
      description: "email intent classification",
    });

    return {
      intent: coerceIntent(raw["intent"], hasAttachments),
      counterparty: cap(raw["counterparty"], 200),
      documentType: cap(raw["documentType"], 100),
      ourRole: cap(raw["ourRole"], 40).toLowerCase(),
      instructions: cap(raw["instructions"], 1000),
    };
  } catch (err) {
    console.warn("[intent] classification failed (non-fatal):", (err as Error)?.message);
    // On failure, fall back conservatively: a lone attachment → review, else unclear.
    return {
      intent: hasAttachments ? "review_contract" : "unclear",
      counterparty: "",
      documentType: "",
      ourRole: "",
      instructions: "",
    };
  }
}

/** The clarification email body sent when intent is "unclear" (Section 2b). */
export const UNCLEAR_REPLY_TEXT =
  `Thanks for your email. I wasn't sure exactly what you'd like me to do.\n\n` +
  `I can:\n` +
  `  • review attached contracts,\n` +
  `  • draft first drafts from your playbook, or\n` +
  `  • answer questions about your positions.\n\n` +
  `Try something like:\n` +
  `  "Review the attached MSA, we are the customer"\n` +
  `  "Draft a mutual NDA with Acme Ltd"\n\n` +
  `— Zane`;
