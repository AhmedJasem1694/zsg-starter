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
    limit:
      "Do not write 'immutable'. Nothing enforces it: no PocketBase API rules exist in the project, the shared client authenticates as superuser so it can update or delete any row, `created` on audit_log is a plain writable date field rather than an autodate (scripts/setup-pocketbase.ts:757), and scripts/backfill-audit-timestamps.ts:213 updates existing rows. Writes are also best-effort, swallowed on failure at auditLogger.ts:114, so the log is not guaranteed complete. Append-only by convention is the accurate description.",
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
      "Legacy Review imports already-signed contracts into the register, extracting parties, term, value, renewal date, notice period, liability cap and governing law, and flags uncapped liability, an open renewal notice window and missing governing law.",
    provenBy:
      "server/services/legacyReview.ts (parse, strip, classify, anonymise, one extraction call); LegacyExtract shape :30; metadata promoted to the document :244; risk flags derived at server/routes.ts:672-686 in GET /api/legacy/report; client/src/pages/LegacyReview.tsx",
    limit:
      "Extraction and registration only. It runs NO playbook comparison (legacyReview.ts:1-12 says so outright), writes no review_results and no extracted_clauses, so it cannot show where the company sits against its own positions. It does not extract obligations: there is no obligations register in the schema, only the free-text terminationRights, assignment and dataProtection lines. No duration is measured anywhere, so state no timeframe.",
  },
  {
    id: "source-text-integrity",
    claim:
      "Contract text is never rewritten by a model. Stored clause text is taken from the document, not from model output.",
    provenBy:
      "server/services/clauseClassifier.ts:317 rawText: chunks[item.chunkIndex] (the classifier returns indices, never text); extracted_clauses is only ever created or deleted, never updated; dash post-processing applies to model output alone at server/services/openrouter.ts:109 and is forbidden on contract text at server/services/textStyle.ts:10",
    limit:
      "Stored text is not byte-identical to the source file. stripBoilerplate (documentParser.ts:187) substitutes notice-address runs with a placeholder, and the PII round trip restores a name with its first-seen casing. The uploaded file itself is untouched and GET /api/documents/:id/text re-parses from it.",
  },
  {
    id: "no-telemetry",
    claim:
      "No analytics, telemetry or external logging service receives anything from Zane. Logging goes to the console only.",
    provenBy:
      "no sentry, datadog, posthog, logtail, pino or winston in package.json or server/; review logging emits lengths, counts and categories rather than document bodies (server/services/reviewOrchestrator.ts:299, :454, :1227)",
    limit:
      "This is about logging and nothing else. Contract text IS sent to OpenRouter during review. That is a separate fact and must stay separately disclosed; do not let this claim imply the text goes nowhere.",
  },
  {
    id: "file-naming",
    claim:
      "Uploaded files are stored under randomised names rather than the name they arrived with.",
    provenBy:
      "server/upload.ts:9 filename callback uses nanoid(); the single storage object is shared by upload, uploadAncillary and inboundUpload, so it covers contracts, ancillary files and email attachments",
    limit:
      "Randomised naming is neither encryption nor deletion. Files remain on disk in plaintext after review: the orchestrator's success path never unlinks, and unlink fires only on upload rejection or explicit user deletion.",
  },
  {
    id: "llm-transport",
    claim:
      "Contract text is sent as an ordinary user message and is not cached by Zane.",
    provenBy:
      "server/services/playbookComparison.ts:227 places CLAUSE TEXT in the user prompt and clauseClassifier.ts:283 does likewise; the request body is exactly { model, max_tokens, messages } at server/services/openrouter.ts:72, with no cache_control, ephemeral or anthropic-beta anywhere in server/",
    limit:
      "Describes what Zane sends, not what the provider does with it afterwards. No retention or training flag is sent. The system prompt does carry the company's playbook positions.",
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
  // ── Security page. Every one of these was published as fact and was false. ──
  {
    id: "encryption-at-rest",
    doNotClaim:
      "Encryption at rest, AES-256, encrypted backups, or any key management.",
    insteadSay:
      "Nothing in server/ encrypts anything. The only crypto in the project is an HMAC for Mailgun signature verification, randomBytes for an inbox slug, and a SHA-256 content hash for review dedup. Contracts sit in uploads/ as plaintext and clause text is stored de-anonymised. Whatever the host does to its disks is not an application control, so do not describe it as one.",
  },
  {
    id: "backups",
    doNotClaim: "Backups of any kind, encrypted or otherwise.",
    insteadSay: "No backup mechanism exists anywhere in the repository.",
  },
  {
    id: "rbac",
    doNotClaim:
      "Role-based access control, or that any action is restricted by a user's role.",
    insteadSay:
      "No role system gates anything. The JWT payload is {userId, email} only, the user `role` field is read for display and audit text but never for authorisation, and the sole gate above requireAuth is an email allowlist (isAdminRequest, server/routes.ts:791). Any signed-in member of the company can record an approval decision, including one routed to a different role. Say that plainly rather than avoiding it.",
  },
  {
    id: "password-hashing",
    doNotClaim:
      "A password hashing algorithm or cost factor, for example bcrypt at cost 12.",
    insteadSay:
      "The application never hashes passwords. Registration passes the plaintext to PocketBase and login delegates to authWithPassword, so hashing is PocketBase's implementation detail and is not configured here. The only cost-12 bcrypt in the repo is dead demo data in a seed script.",
  },
  {
    id: "tenant-isolation",
    doNotClaim:
      "Per-organisation isolation, no cross-tenant access, or that all database queries are scoped to the authenticated company.",
    insteadSay:
      "Zane is single-tenant: one company per deployment. There are no PocketBase API rules in the project and every query runs as superuser, so isolation is a convention held in route handlers rather than a control. Six unscoped handlers were found and fixed in one sweep. See the Tenancy section of CLAUDE.md.",
  },
  {
    id: "data-residency",
    doNotClaim:
      "A hosting region, UK or EU data centres, a chosen jurisdiction, or separate per-jurisdiction environments.",
    insteadSay:
      "No region is pinned anywhere in code or config, there is no per-company region field, and no deployment manifest exists. The region is whatever the Railway project was created in, which this repository does not record.",
  },
  {
    id: "certifications",
    doNotClaim:
      "ISO 27001, SOC 2, Cyber Essentials, a penetration test report, or a controls framework aligned to any of them, including as roadmap items phrased to imply work in progress.",
    insteadSay:
      "None are held and no controls framework exists. State that none are held. A roadmap item a reader cannot distinguish from a commitment is worse than silence.",
  },
  {
    id: "provider-retention",
    doNotClaim:
      "That the model provider does not retain or train on contract text, or that data is not kept beyond the session.",
    insteadSay:
      "server/services/openrouter.ts sends only Content-Type and Authorization: no zero-retention header, no data-policy field, no provider routing preference. OpenRouter is a broker that fans out to several upstreams, so retention depends on whichever one serves the request. Zane's own control is anonymisation before the call, which is real; say that instead, and say plainly that provider terms govern the rest.",
  },
  {
    id: "self-hosting",
    doNotClaim:
      "A self-hosted deployment option, bring-your-own-cloud, or customer-supplied model API keys.",
    insteadSay:
      "There is no Dockerfile, compose file or self-hosting documentation, and OPENROUTER_API_KEY is a single global env var with no per-company override. Hardcoded zanelegal.ai origins, cookie domain, admin allowlist and inbound mail domain would all need patching first.",
  },
  {
    id: "offboarding-deletion",
    doNotClaim:
      "Account deletion on request, secure deletion, a deletion window, or written confirmation of deletion.",
    insteadSay:
      "There is no DELETE /api/company route and no off-boarding routine. DELETE /api/company/contracts cascades documents only and leaves the company row, the user account, team invites, audit_log and pii_sessions in place. Deletion is an ordinary row delete with no overwrite, so 'secure' is unsupported separately.",
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
