/**
 * Full email-thread negotiation capture (Section 3).
 *
 * When an inbound email belongs to a thread already linked to a contract, we
 * parse the ENTIRE thread history available, not just the latest message, and
 * turn it into structured, vendor-specific negotiation data:
 *
 *   3a  Reconstruct the negotiation transcript (stored thread bodies + the
 *       current message) and identify each explicit negotiation move: who
 *       proposed what, what was countered, what was accepted or rejected.
 *   3b  For every move write BOTH a `decision_event` (the moat layer) and a
 *       richer `negotiation_events` record linked to the contract AND the
 *       counterparty: clause category, counterparty position, our position, the
 *       movement between rounds, and the final landing point if reached.
 *   3e  Privacy & accuracy. Callers must already have verified the sender is a
 *       company user; all transcript text is run through the existing PII
 *       anonymiser before the model sees it; the model is instructed to NEVER
 *       fabricate a move and to capture only what is explicit.
 *
 * Aggregation into a per-counterparty profile (3c) and feeding it into review /
 * draft output (3d) live in `counterpartyProfile.ts`.
 */

import { pb } from "../pb.js";
import { llmJsonCall } from "./llmJsonParse.js";
import { getModelForTask } from "./modelRouter.js";
import { anonymise, deanonymise, buildKnownEntities } from "./piiAnonymiser.js";
import { recordDecisionEvent, type HumanAction } from "./decisionEvents.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

export type NegotiationOutcome = "proposed" | "countered" | "accepted" | "rejected" | "open";
export type Proposer = "counterparty" | "us";

export interface NegotiationMove {
  round: number;
  clauseCategory: string;
  proposer: Proposer;
  counterpartyPosition: string;
  ourPosition: string;
  movement: string;
  outcome: NegotiationOutcome;
  finalLanding: string;
}

// ─── Schema self-heal ──────────────────────────────────────────────────────────

let schemaEnsured = false;

export async function ensureNegotiationSchema(): Promise<void> {
  if (schemaEnsured) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collections = pb.collections as any;
  try {
    await collections.getOne("negotiation_events");
    schemaEnsured = true;
    return;
  } catch { /* create below */ }
  try {
    await collections.create({
      name: "negotiation_events",
      type: "base",
      fields: [
        { name: "company", type: "text", required: true },
        { name: "contract", type: "text", required: false },        // uploaded_documents id
        { name: "counterparty", type: "text", required: false },    // denormalised counterparty name
        { name: "thread_id", type: "text", required: false },
        { name: "clause_category", type: "text", required: false },
        { name: "round", type: "number", required: false },
        { name: "proposer", type: "text", required: false },        // counterparty | us
        { name: "counterparty_position", type: "text", required: false },
        { name: "our_position", type: "text", required: false },
        { name: "movement", type: "text", required: false },
        { name: "outcome", type: "text", required: false },         // proposed | countered | accepted | rejected | open
        { name: "final_landing", type: "text", required: false },
        { name: "source", type: "text", required: false },          // email_thread
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    });
    schemaEnsured = true;
  } catch (err) {
    console.warn("[negotiation] could not create negotiation_events (non-fatal):", (err as Error)?.message);
  }
}

// ─── Trigger heuristic ───────────────────────────────────────────────────────

/** Does this inbound email carry a quoted/forwarded thread history worth parsing? */
export function carriesThreadHistory(body: string): boolean {
  if (!body) return false;
  return (
    /^\s*>/m.test(body) ||                                   // quoted lines
    /\bon\b.{0,80}\bwrote:/i.test(body) ||                   // "On <date> <name> wrote:"
    /-{2,}\s*(original|forwarded) message/i.test(body) ||    // Outlook/Gmail separators
    /^\s*from:\s.+/im.test(body)                             // forwarded header block
  );
}

const cap = (s: string, n: number) => (s ?? "").slice(0, n);

// ─── Transcript assembly (3a) ──────────────────────────────────────────────────

/**
 * The fullest thread transcript available: every stored inbound/outbound body
 * for this thread (oldest first) plus the current message. The current body
 * itself usually quotes the prior chain, so we de-duplicate conservatively by
 * skipping any stored body that is already wholly contained in the current one.
 */
export async function gatherThreadTranscript(
  companyId: string,
  threadId: string,
  currentBody: string,
): Promise<string> {
  const parts: string[] = [];
  if (threadId) {
    try {
      const rows = await pb.collection("email_threads").getFullList({
        filter: `company = "${companyId}" && thread_id = "${threadId.replace(/"/g, "")}"`,
        sort: "created",
        fields: "direction,body,created",
      });
      for (const r of rows) {
        const body = String(r["body"] ?? "").trim();
        if (!body) continue;
        if (currentBody && currentBody.includes(body)) continue; // already quoted below
        const who = r["direction"] === "outbound" ? "ZANE/US" : "COUNTERPARTY/INBOUND";
        parts.push(`--- ${who} ---\n${body}`);
      }
    } catch { /* non-fatal */ }
  }
  if (currentBody?.trim()) parts.push(`--- LATEST INBOUND ---\n${currentBody.trim()}`);
  return parts.join("\n\n");
}

// ─── LLM parse (3a), strictly grounded, never fabricates (3e) ──────────────────

async function parseMoves(opts: {
  transcript: string;
  counterpartyName: string;
  allowedCategories: string[];
}): Promise<NegotiationMove[]> {
  const { transcript, counterpartyName, allowedCategories } = opts;
  const vocab = allowedCategories.length > 0
    ? `Prefer one of these clause categories (use the closest match): ${allowedCategories.join(", ")}. If none fit, use a short snake_case label.`
    : `Use a short snake_case clause category label (e.g. limitation_of_liability, indemnity, payment_terms).`;

  const system = `You extract a structured negotiation history from an email thread between our company ("us") and a counterparty. Respond with JSON only.

HARD RULES:
1. Capture ONLY negotiation moves that are EXPLICITLY present in the thread. NEVER invent, infer, or fabricate a position, number, or movement that is not written in the text.
2. If the thread is ambiguous about a move, capture only the part that is explicit and leave the rest as an empty string. Do not guess.
3. If there is no explicit negotiation in the thread, return {"moves": []}.
4. "proposer" is "counterparty" when the counterparty proposed/changed the term, "us" when our side did.
5. Number rounds in chronological order starting at 1. Multiple moves can share a round.
6. ${vocab}
7. Keep each text field concise (one or two sentences), quoting or closely paraphrasing the thread.`;

  const user = `COUNTERPARTY: ${counterpartyName || "(the other party)"}

THREAD TRANSCRIPT (oldest first):
${transcript}

Return ONLY this JSON:
{
  "moves": [
    {
      "round": 1,
      "clauseCategory": "snake_case category",
      "proposer": "counterparty" | "us",
      "counterpartyPosition": "what the counterparty wanted/proposed for this clause, or empty",
      "ourPosition": "what we wanted/proposed for this clause, or empty",
      "movement": "how the position moved this round vs the prior one, or empty",
      "outcome": "proposed" | "countered" | "accepted" | "rejected" | "open",
      "finalLanding": "the final agreed position if the thread reached one for this clause, else empty"
    }
  ]
}`;

  const raw = await llmJsonCall<{ moves?: unknown }>({
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    model: getModelForTask("pattern_intelligence"), // Claude Sonnet 4.6
    maxTokens: 4000,
    timeoutMs: 90_000,
    description: "email thread negotiation parse",
  });

  const moves = Array.isArray(raw?.moves) ? raw.moves : [];
  const VALID_OUTCOME = new Set<NegotiationOutcome>(["proposed", "countered", "accepted", "rejected", "open"]);
  return moves
    .filter((m): m is PBRecord => !!m && typeof m === "object")
    .map((m): NegotiationMove => {
      const outcome = String(m.outcome ?? "open").toLowerCase() as NegotiationOutcome;
      return {
        round: Number.isFinite(Number(m.round)) ? Math.max(1, Math.floor(Number(m.round))) : 1,
        clauseCategory: cap(String(m.clauseCategory ?? "").trim().toLowerCase().replace(/\s+/g, "_"), 80),
        proposer: String(m.proposer ?? "").toLowerCase() === "us" ? "us" : "counterparty",
        counterpartyPosition: cap(String(m.counterpartyPosition ?? "").trim(), 2000),
        ourPosition: cap(String(m.ourPosition ?? "").trim(), 2000),
        movement: cap(String(m.movement ?? "").trim(), 2000),
        outcome: VALID_OUTCOME.has(outcome) ? outcome : "open",
        finalLanding: cap(String(m.finalLanding ?? "").trim(), 2000),
      };
    })
    // Drop empty husks, a move must say something explicit.
    .filter((m) => m.clauseCategory || m.counterpartyPosition || m.ourPosition || m.movement || m.finalLanding);
}

// ─── Persistence (3b) ──────────────────────────────────────────────────────────

async function recordNegotiationEvent(input: {
  companyId: string;
  contractId: string;
  counterparty: string;
  threadId: string;
  move: NegotiationMove;
}): Promise<void> {
  const { companyId, contractId, counterparty, threadId, move } = input;
  await ensureNegotiationSchema();
  try {
    await pb.collection("negotiation_events").create({
      company: companyId,
      contract: contractId,
      counterparty,
      thread_id: threadId,
      clause_category: move.clauseCategory,
      round: move.round,
      proposer: move.proposer,
      counterparty_position: move.counterpartyPosition,
      our_position: move.ourPosition,
      movement: move.movement,
      outcome: move.outcome,
      final_landing: move.finalLanding,
      source: "email_thread",
    });
  } catch (err) {
    console.warn("[negotiation] recordNegotiationEvent failed (non-fatal):", (err as Error)?.message);
  }
}

/** Map a negotiation outcome to the decision_events human_action vocabulary. */
function outcomeToHumanAction(outcome: NegotiationOutcome): HumanAction {
  if (outcome === "accepted") return "accepted";
  if (outcome === "rejected") return "overridden";
  return "modified"; // proposed / countered / open all represent movement
}

// ─── Orchestration ──────────────────────────────────────────────────────────────

export interface CaptureResult { moves: number }

/**
 * Parse a contract-linked thread and persist every explicit negotiation move as
 * both a decision_event and a negotiation_events record. PII-safe, non-fatal,
 * and idempotent-ish: re-running on the same thread re-derives moves from the
 * transcript (callers gate by detecting fresh negotiation content).
 *
 * The caller MUST have already verified the sender is a registered company user.
 */
export async function captureThreadNegotiation(input: {
  companyId: string;
  contractId: string;
  threadId: string;
  currentBody: string;
  sender: string;
}): Promise<CaptureResult> {
  const { companyId, contractId, threadId, currentBody, sender } = input;
  try {
    const transcript = await gatherThreadTranscript(companyId, threadId, currentBody);
    if (transcript.trim().length < 60) return { moves: 0 }; // nothing substantive to parse

    // Resolve the contract + counterparty + company name for grounding/anonymisation.
    const [doc, company] = await Promise.all([
      pb.collection("uploaded_documents").getOne(contractId).catch(() => null),
      pb.collection("companies").getOne(companyId).catch(() => null),
    ]);
    const counterpartyName = String(doc?.["counterpartyName"] ?? "").trim();
    const companyName = String(company?.["name"] ?? "").trim();

    // Company's own playbook clause vocabulary, to keep categories consistent.
    const rules = await pb.collection("playbook_rules")
      .getFullList({ filter: `company = "${companyId}"`, fields: "clauseCategory" })
      .catch(() => [] as PBRecord[]);
    const allowedCategories = Array.from(
      new Set(rules.map((r) => String(r["clauseCategory"] ?? "").trim()).filter(Boolean)),
    );

    // 3e: anonymise the transcript before any model call.
    const known = buildKnownEntities(companyName, counterpartyName);
    const { anonymisedText, entityMap } = await anonymise(transcript, known);

    const rawMoves = await parseMoves({
      transcript: anonymisedText,
      counterpartyName: counterpartyName || "the counterparty",
      allowedCategories,
    });
    if (rawMoves.length === 0) return { moves: 0 };

    // De-anonymise the extracted free-text fields before persisting.
    const moves: NegotiationMove[] = rawMoves.map((m) => ({
      ...m,
      counterpartyPosition: deanonymise(m.counterpartyPosition, entityMap),
      ourPosition: deanonymise(m.ourPosition, entityMap),
      movement: deanonymise(m.movement, entityMap),
      finalLanding: deanonymise(m.finalLanding, entityMap),
    }));

    for (const move of moves) {
      await recordNegotiationEvent({ companyId, contractId, counterparty: counterpartyName, threadId, move });
      await recordDecisionEvent({
        companyId,
        userId: sender,
        documentId: contractId,
        clauseCategory: move.clauseCategory,
        zaneRecommendation: "negotiate",
        zaneSuggestedText: move.ourPosition,
        humanAction: outcomeToHumanAction(move.outcome),
        humanFinalPosition: move.finalLanding || move.ourPosition,
        overrideReason: `Round ${move.round}: ${move.movement || `${move.proposer} ${move.outcome}`} (captured from email negotiation thread)`,
      });
    }

    console.log(`[negotiation] captured ${moves.length} move(s) for contract ${contractId} (${counterpartyName || "unknown counterparty"})`);
    return { moves: moves.length };
  } catch (err) {
    console.warn("[negotiation] captureThreadNegotiation failed (non-fatal):", (err as Error)?.message);
    return { moves: 0 };
  }
}
