/**
 * Claims register for the public site.
 *
 * Any sentence on the public site that states what Zane does must map to an
 * entry in ALLOWED_CLAIMS. If it does not, do not write it.
 *
 * Each allowed claim carries the code path that proves it. Before editing a
 * claim, open that path and confirm it still says what the claim says. When a
 * feature is removed or changed, the claim moves or changes with it in the
 * same commit, so the register can never drift from the product.
 *
 * NOT_YET_CLAIMS is the other half of the contract: roadmap items that must
 * not appear as product claims anywhere on the site. They are written down so
 * the gap is deliberate rather than forgotten.
 *
 * Verified against the codebase on 24 October 2026.
 */

export interface Claim {
  /** Stable id, referenced from copy constants where a line leans on a claim. */
  id: string;
  /** What the product does, in one line, in the voice the site uses. */
  claim: string;
  /** Where in the codebase this is true. Path, and a symbol or line where useful. */
  provenBy: string;
  /** Anything a copywriter must not over-reach into. Present only where there is a real edge. */
  limit?: string;
}

export const ALLOWED_CLAIMS: Claim[] = [
  {
    id: "intake",
    claim:
      "Contracts arrive by upload, by email to a dedicated company address, or from a watched Google Drive or SharePoint folder.",
    provenBy:
      "server/upload.ts; server/services/inboundEmail.ts; server/services/googleDriveService.ts (folder watch); server/services/sharePointService.ts (Graph subscription); server/services/integrationProcessor.ts calls runReview()",
  },
  {
    id: "anonymisation",
    claim:
      "Party names and personal data are removed before any text is sent to a model, and restored afterwards.",
    provenBy:
      "server/services/piiAnonymiser.ts; called at server/services/reviewOrchestrator.ts:419 (anonymise) and :633 (deanonymise)",
    limit:
      "Anonymisation is ours and is real. Do not extend this into a claim about what a model provider does with data afterwards: no training opt-out flag is sent in server/services/openrouter.ts.",
  },
  {
    id: "rag-verdict",
    claim:
      "Each clause is checked against the company's own playbook positions and returns Red, Amber or Green with a plain-English reason and fallback wording.",
    provenBy:
      "server/services/playbookComparison.ts: preferredPosition and hardRedLine injected at :221; returns ragStatus :30, whyItMatters :34, suggestedFallback :36",
  },
  {
    id: "escalation-routing",
    claim:
      "Contracts outside policy, above a value threshold, or from a flagged counterparty type route to a named approver role.",
    provenBy:
      "server/services/approvals.ts createApprovalRequest() :24, routedToRole :56; tier logic in server/routes.ts getValueTierFull and getGovernanceTriggers",
  },
  {
    id: "approval-decision",
    claim:
      "Approvers are notified by email and decide in the app, and a reason is required with every decision.",
    provenBy:
      "server/services/emailService.ts buildApprovalRequestEmail(); decision at server/routes.ts POST /api/approvals/:id/decide, reason enforced server-side :4342; UI at client/src/pages/ApprovalDecision.tsx",
    limit:
      "Approvers cannot decide by replying to the email. The email carries a link; the decision happens in the app. Email intents are review, question, draft and classification only (server/services/emailIntentParser.ts). Also note the pilot authorisation model: the queue is shared and any signed-in member can record a decision, so do not claim the decision is restricted to the routed role.",
  },
  {
    id: "audit-trail",
    claim:
      "Every upload, review, decision, escalation and approval is written to an audit trail, viewable system-wide and per contract.",
    provenBy:
      "server/services/auditLogger.ts (AuditAction registry); GET /api/audit server/routes.ts:4009 (system-wide); GET /api/documents/:id/audit :4089 (per contract)",
  },
  {
    id: "portfolio-exposure",
    claim:
      "The portfolio view shows exposure by counterparty and contract type across all contracts.",
    provenBy:
      "server/routes.ts GET /api/portfolio: byContractType :3788, byCounterparty :3809, valueAtRisk :3830; client/src/pages/Portfolio.tsx",
  },
  {
    id: "portfolio-total-value",
    claim:
      "Total contract value under management is computed across the portfolio and printed in the board pack.",
    provenBy:
      "server/routes.ts:3764 totalValue (sums contractValue over COMPLETE documents); :3830 valueAtRisk.total (reviewed documents only); printed at client/src/lib/boardPack.ts:131",
    limit:
      "The Portfolio page does not render a total. client/src/pages/Portfolio.tsx shows valueAtRisk.RED only and never reads totalValue, so do not caption a Portfolio screenshot as showing value under management. The board pack is the screen that prints it, and it prefers valueAtRisk.total (reviewed docs) with totalValue (all complete docs) as a fallback, so the two can differ.",
  },
  {
    id: "playbook-baseline",
    claim:
      "Playbook positions are pre-filled from a market-standard baseline, a preferred position, an acceptable fallback and a hard line per clause, and can be edited.",
    provenBy:
      "client/src/lib/types.ts:881 PLAYBOOK_DEFAULTS, seeded by client/src/pages/Onboarding.tsx:263 initPlaybook and edited at Step4Playbook :1362; server/data/marketStandardPlaybook.ts:16 MARKET_STANDARD_PLAYBOOK, copied by POST /api/quick-setup server/routes.ts:2125",
    limit:
      "Pre-filled, never generated. Both sets are hand-written literals copied into the company's rules. POST /api/playbook/generate-suggestion (server/routes.ts:1531) can draft one position on request from the Playbook page, but it writes nothing, is never called during onboarding, and is passed no company context. Do not write that the playbook is generated. Do not write that the system adjusts it to your behaviour on its own: GET /api/playbook/drift-suggestions (:1427) only proposes, and quick-setup and the FOUNDER onboarding path skip the editing step entirely.",
  },
  {
    id: "negotiation-intelligence",
    claim:
      "Negotiation Intelligence computes patterns from recorded decisions: repeated concessions, counterparty behaviour and renewal exposure.",
    provenBy:
      "server/routes.ts GET /api/feedback/patterns: below_playbook_acceptance :3176, counterparty_concentration :3138, auto_renewal_exposure, recurring_red :2985; client/src/pages/Patterns.tsx",
    limit:
      "Patterns are computed from stored decision_events, not generated. Do not describe them as predictions or advice.",
  },
  {
    id: "timings",
    claim:
      "Timings and Obligations tracks renewal dates, notice windows and dated obligations.",
    provenBy:
      "server/routes.ts GET /api/timings :3853, reads renewalDate and noticePeriodDays :665; client/src/pages/Timings.tsx",
  },
  {
    id: "monthly-report",
    claim:
      "The monthly report exports a plain-English summary built from live portfolio data.",
    provenBy:
      "client/src/lib/monthlyReport.ts exportMonthlyReport() :32, reads valueAtRisk and byCounterparty from the portfolio payload",
  },
  {
    id: "legacy-import",
    claim:
      "Legacy Review imports already-signed contracts into the register.",
    provenBy:
      "server/services/legacyReview.ts (batches up to 100 files: parse, strip, classify, anonymise, one batched extraction call); client/src/pages/LegacyReview.tsx",
  },
  {
    id: "model-routing",
    claim:
      "Model calls are routed per task through a single client, so the product is not tied to one model vendor.",
    provenBy:
      "server/services/modelRouter.ts MODEL_MAP (classification, extraction and comparison, and the harder judgement tasks each routed separately); every call passes through server/services/openrouter.ts chatComplete()",
  },
];

/**
 * Roadmap. None of this exists in the codebase today, so none of it may appear
 * on the public site as something Zane does. Each entry records the wording to
 * use instead where a nearby true claim exists.
 */
export interface NotYetClaim {
  id: string;
  /** The thing that must not be claimed. */
  doNotClaim: string;
  /** Why it is not claimable, and what to say instead where there is a true alternative. */
  insteadSay?: string;
}

export const NOT_YET_CLAIMS: NotYetClaim[] = [
  {
    id: "authority-matrix",
    doNotClaim:
      "A delegation of authority matrix, or any authority check on approvers or signatories.",
    insteadSay:
      "Escalation routes to a named approver role by value, policy breach and counterparty type. That is routing, not an authority check.",
  },
  {
    id: "out-of-authority-detection",
    doNotClaim:
      "Detection of contracts signed outside authority.",
    insteadSay:
      "Nothing in the product inspects a signature against an authority limit. Do not imply after-the-fact policing of who signed what.",
  },
  {
    id: "mandatory-review-reasons",
    doNotClaim:
      "That a reason is captured on every decision everywhere in the product.",
    insteadSay:
      "On an approval the reason is required and server-enforced, so claim it there (see the approval-decision claim). On a clause outcome in a review the reason is optional, so say a reason can be recorded.",
  },
  {
    id: "cfo-digest",
    doNotClaim: "A weekly CFO digest email, or any scheduled recurring digest.",
    insteadSay:
      "The monthly report is generated on demand by a person, not sent on a schedule.",
  },
  {
    id: "e-signature",
    doNotClaim:
      "E-signature integration, or capture of executed documents from DocuSign or any similar service.",
    insteadSay:
      "A signed version can be uploaded by hand after the fact, which is how outcome capture works today.",
  },
  {
    id: "cross-customer-benchmarks",
    doNotClaim:
      "Cross-customer supplier benchmarks, pooled data, or any comparison against other companies.",
    insteadSay:
      "Intelligence is computed from that company's own decisions only. This is a selling point, so state it positively rather than avoiding the subject.",
  },
  {
    id: "regulatory-monitoring",
    doNotClaim:
      "Regulatory monitoring, horizon scanning, or alerts when the law changes.",
    insteadSay:
      "Regulatory frameworks are a curated reference surfaced as review context, carrying an explicit unverified status and a not-legal-advice disclaimer.",
  },
  {
    id: "implementation-time",
    doNotClaim:
      "Any specific implementation or time-to-value figure, including live in a week, working in twenty minutes, or a stated average review time. There is no onboarding timer and no review duration is recorded anywhere in the schema or the orchestrator.",
    insteadSay:
      "Fast to start: begin with your signed contracts.",
  },
];

/** Lookup helper, so copy can reference a claim by id and fail loudly if it moves. */
export function claimById(id: string): Claim {
  const found = ALLOWED_CLAIMS.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown claim id: ${id}. Add it to ALLOWED_CLAIMS or do not write the sentence.`);
  return found;
}
