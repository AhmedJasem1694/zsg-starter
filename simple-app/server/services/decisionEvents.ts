/**
 * Decision event capture — the moat layer.
 *
 * Every human judgment inside Zane (accepting a recommendation, overriding a
 * RAG status, editing suggested fallback language, dismissing a flag, acting
 * at an escalation step) is captured as a structured decision_events record:
 * what Zane recommended, what the human actually did, and why.
 *
 * Capture is silent and fire-and-forget: recording never throws and never
 * blocks or fails the user-facing action. This data feeds counterparty
 * intelligence and playbook calibration.
 */

import { pb } from "../pb.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

export type ZaneRecommendation = "accept" | "negotiate" | "escalate" | "reject";
export type HumanAction = "accepted" | "overridden" | "modified" | "ignored";

export interface DecisionEventInput {
  companyId: string;
  userId?: string;
  /** uploaded_documents id — the contract this judgment relates to */
  documentId: string;
  clauseCategory: string;
  zaneRecommendation: ZaneRecommendation;
  zaneSuggestedText: string;
  humanAction: HumanAction;
  humanFinalPosition: string;
  overrideReason?: string;
}

/** Map a review result's RAG output onto the recommendation enum. */
export function deriveZaneRecommendation(result: PBRecord): ZaneRecommendation {
  if (result["escalationRequired"]) return "escalate";
  switch (result["ragStatus"]) {
    case "GREEN": return "accept";
    case "RED":   return "reject";
    case "AMBER":
    default:      return "negotiate";
  }
}

const cap = (s: unknown, n: number): string => String(s ?? "").slice(0, n);

/** Write one decision event. Silent: never throws; self-heals a missing collection. */
export async function recordDecisionEvent(input: DecisionEventInput): Promise<void> {
  const record = {
    company:              input.companyId,
    user:                 input.userId ?? "",
    contract:             input.documentId,
    clause_category:      input.clauseCategory,
    zane_recommendation:  input.zaneRecommendation,
    zane_suggested_text:  cap(input.zaneSuggestedText, 4000),
    human_action:         input.humanAction,
    human_final_position: cap(input.humanFinalPosition, 4000),
    override_reason:      cap(input.overrideReason, 2000),
  };
  try {
    await pb.collection("decision_events").create(record);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) {
      // Collection doesn't exist yet (pb:setup not re-run) — create it and retry
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (pb.collections as any).create({
          name: "decision_events",
          type: "base",
          fields: [
            { name: "company", type: "text", required: true },
            { name: "user", type: "text", required: false },
            { name: "contract", type: "text", required: false },
            { name: "clause_category", type: "text", required: false },
            { name: "zane_recommendation", type: "text", required: false },
            { name: "zane_suggested_text", type: "text", required: false },
            { name: "human_action", type: "text", required: false },
            { name: "human_final_position", type: "text", required: false },
            { name: "override_reason", type: "text", required: false },
            // PB 0.23+ needs explicit autodate fields for created/updated
            { name: "created", type: "autodate", onCreate: true, onUpdate: false },
            { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
          ],
        });
        await pb.collection("decision_events").create(record);
        return;
      } catch (retryErr) {
        console.warn("[decisionEvents] capture failed after collection create (non-fatal):", (retryErr as Error)?.message);
        return;
      }
    }
    console.warn("[decisionEvents] capture failed (non-fatal):", (err as Error)?.message);
  }
}

/**
 * Record a decision event given only a review_results id — looks up the result
 * and its document to derive company, contract, clause category, and what Zane
 * recommended. Silent: any lookup failure is swallowed.
 */
export async function recordDecisionEventForResult(
  resultId: string,
  userId: string | undefined,
  humanAction: HumanAction,
  humanFinalPosition: string,
  overrideReason?: string,
): Promise<void> {
  try {
    const result = await pb.collection("review_results").getOne(resultId);
    const doc = await pb.collection("uploaded_documents").getOne(result["document"] as string);
    await recordDecisionEvent({
      companyId: doc["company"] as string,
      userId,
      documentId: doc.id as string,
      clauseCategory: (result["clauseCategory"] as string) ?? "",
      zaneRecommendation: deriveZaneRecommendation(result as PBRecord),
      zaneSuggestedText: (result["suggestedFallback"] as string) ?? "",
      humanAction,
      humanFinalPosition,
      overrideReason,
    });
  } catch (err) {
    console.warn(`[decisionEvents] capture for result ${resultId} failed (non-fatal):`, (err as Error)?.message);
  }
}
