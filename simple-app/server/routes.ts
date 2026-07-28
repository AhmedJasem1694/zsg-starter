import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { pb, newPBClient } from "./pb.js";
import multer from "multer";
import { upload, uploadAncillary, classifyFileType, inboundUpload } from "./upload.js";
import {
  ensureInboundSchema, backfillInboundEmails, generateUniqueInboundEmail,
  verifyMailgunSignature, extractInboundAddresses, resolveCompanyByRecipient,
  getAuthorisedSenders, normaliseEmail, logRejection,
} from "./services/inboundEmail.js";
import { parseEmailIntent, UNCLEAR_REPLY_TEXT } from "./services/emailIntentParser.js";
import { sendPlainEmail, sendApprovalDecisionEmail } from "./services/emailService.js";
import { createApprovalRequest } from "./services/approvals.js";
import { processReviewByEmail, type InboundAttachment } from "./services/emailReview.js";
import { processDraftByEmail } from "./services/draftGenerator.js";
import { processQuestionByEmail } from "./services/emailQuestion.js";
import {
  ensureThreadSchema, computeThreadId, logEmail, getThreadContractId,
  threadReplyText, looksForwarded,
} from "./services/emailThreads.js";
import { runReview } from "./services/reviewOrchestrator.js";
import { runLegacyReview, ensureLegacyFields } from "./services/legacyReview.js";
import { detectAndSaveRegulations } from "./services/regulatoryDetection.js";
import { requireAuth, signToken } from "./middleware/auth.js";
import { transcribeAudioFile } from "./services/transcription.js";
import { chatComplete } from "./services/openrouter.js";
import { searchCompanies, enrichCompany } from "./services/companySearch.js";
import { audit } from "./services/auditLogger.js";
import { recordDecisionEvent, recordDecisionEventForResult, deriveZaneRecommendation, updateDecisionReasoning } from "./services/decisionEvents.js";
import { assessResultDecision, type SignificanceResult } from "./services/decisionSignificance.js";
import { captureThreadNegotiation, carriesThreadHistory } from "./services/negotiationCapture.js";
import { buildCounterpartyProfile, profileDraftToConfirm } from "./services/counterpartyProfile.js";
import { buildCounterpartyJudgmentMemory } from "./services/counterpartyJudgment.js";
import { generateBriefing, getLatestBriefing } from "./services/teamBriefing.js";
import { synthesiseCompany, getPlaybookSynthesis, getCompanyKnowledge, getRegulatorySynthesis } from "./services/synthesisEngine.js";
import { getCrossRefResult, relinkCrossReferences } from "./services/crossReferenceCheck.js";
import { getFeatureFlags, resolveTier, trialDaysRemaining } from "./services/featureFlags.js";
import { runDeltaComparison } from "./services/deltaComparison.js";
import { runPatternDetection } from "./services/patternDetector.js";
import { MARKET_STANDARD_PLAYBOOK } from "./data/marketStandardPlaybook.js";
import { parseDocument } from "./services/documentParser.js";
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
  listGoogleFolders,
  watchGoogleFolder,
  syncGoogleFolder,
} from "./services/googleDriveService.js";
import {
  getMicrosoftAuthUrl,
  handleMicrosoftCallback,
  listSharePointFolders,
  watchSharePointFolder,
  syncSharePointFolder,
} from "./services/sharePointService.js";

// ── Express 4 async error helper ─────────────────────────────────────────────
// Express 4 does NOT automatically forward rejected async handlers to next().
// Without this wrapper, any uncaught throw in an async route crashes the Node
// process in Node 20+ (unhandledRejection → exit 1).  Wrapping every handler
// ensures errors reach the global error middleware instead.
function ah(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch((err: unknown) => {
      console.error("[route throw]", (err as Error)?.message ?? err);
      next(err);
    });
  };
}

const isProd = process.env.NODE_ENV === "production";
const crossDomain = !!process.env.FRONTEND_URL;
const COOKIE_OPTS = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd && crossDomain ? "none" : "lax") as "none" | "lax",
  // Scope cookie to all zanelegal.ai subdomains in production so auth works
  // across app.zanelegal.ai → api.zanelegal.ai. In dev (no isProd), omit domain
  // so localhost cookies work without cross-origin complexity.
  ...(isProd ? { domain: ".zanelegal.ai" } : {}),
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// ── Zod schemas ──────────────────────────────────────────────────────────────

const companySchema = z.object({
  name: z.string().min(1),
  sector: z.string().min(1),
  jurisdiction: z.string().min(1),
  role: z.enum(["BUYER", "SUPPLIER", "BOTH", "INSURER_INHOUSE", "PANEL_FIRM", "TPA", "CLAIMANT_FIRM", "DEFENDANT_FIRM"]),
  riskAppetite: z.enum(["CONSERVATIVE", "MODERATE", "COMMERCIAL"]),
  industry: z.string().optional(),
  persona: z.enum(["CORPORATE", "FOUNDER"]).optional(),
  workflowType: z.enum(["COMMERCIAL_CONTRACT", "INSURANCE_LITIGATION", "LOGISTICS_CONTRACT", "HEALTHCARE_PROCUREMENT"]).optional(),
});

const playbookRuleSchema = z.object({
  clauseCategory: z.string().min(1),
  preferredPosition: z.string().min(1),
  acceptableFallback: z.string().min(1),
  hardRedLine: z.string().min(1),
  approvalRequired: z.enum(["LEGAL", "GC", "CFO", "BOARD"]).optional(),
  fallbackTemplate: z.string().optional(),
  riskWeight: z.number().int().min(1).max(5).optional(),
  workflowType: z.string().optional(),
});

const approvalContactSchema = z.object({
  role: z.enum(["LEGAL", "GC", "CFO", "BOARD"]),
  name: z.string().min(1),
  email: z.string().email(),
});

const feedbackSchema = z.object({
  userAction: z.enum(["ACCEPTED", "EDITED", "ESCALATED", "DISMISSED"]),
  editedOutput: z.string().optional(),
  finalClauseText: z.string().optional(),
  notes: z.string().optional(),
});

// ── Field-name mappers (PocketBase → frontend) ───────────────────────────────
// PocketBase uses `created`/`updated` and stores relation IDs under the field
// name (e.g. `company`). The frontend was built expecting Prisma-style field
// names, so we alias here at the API boundary.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

function mapCompany(c: PBRecord) {
  return { ...c, createdAt: c.created };
}

function mapDoc(d: PBRecord) {
  let contradictions: unknown[] = [];
  try {
    if (d["contradictions"]) contradictions = JSON.parse(d["contradictions"] as string);
  } catch { /* malformed */ }
  const auditFindings = (() => {
    const raw = d["auditFindings"];
    if (!raw) return null;
    try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return null; }
  })();
  return { ...d, companyId: d.company, uploadedAt: d.created, contradictions, auditFindings };
}

function mapResult(r: PBRecord) {
  let regulatoryCitations: unknown[] = [];
  try {
    if (r["regulatoryCitations"]) {
      regulatoryCitations = JSON.parse(r["regulatoryCitations"] as string);
    }
  } catch { /* malformed JSON - return empty */ }

  return {
    ...r,
    documentId: r.document,
    clauseId: r.clause ?? null,
    ruleId: r.rule ?? null,
    createdAt: r.created,
    regulatoryCitations,
    iracIssue: r["iracIssue"] ?? "",
    iracRule: r["iracRule"] ?? "",
    iracApplication: r["iracApplication"] ?? "",
    iracConclusion: r["iracConclusion"] ?? "",
    urgencyLevel: r["urgencyLevel"] ?? "BACKGROUND",
    errorCategory: r["errorCategory"] ?? "SUBSTANTIVE_RISK",
  };
}

function mapFeedback(f: PBRecord) {
  return { ...f, resultId: f.result, createdAt: f.created };
}

function mapRule(r: PBRecord) {
  return { ...r, companyId: r.company, createdAt: r.created, updatedAt: r.updated };
}

function mapContact(c: PBRecord) {
  return { ...c, companyId: c.company };
}

function mapRegulation(r: PBRecord) {
  return { ...r, companyId: r.company, createdAt: r.created };
}

function mapIntake(i: PBRecord) {
  return { ...i, documentId: i.document, createdAt: i.created, updatedAt: i.updated };
}

function mapAncillary(a: PBRecord) {
  return { ...a, documentId: a.document, uploadedAt: a.created };
}

function sendError(res: Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}

// ── Helper: get the single company (single-company mode) ─────────────────────

// Known demo users mapped to a name fragment that identifies their company.
// Lets multiple demo accounts coexist with separate company records without
// any PocketBase schema changes.
const DEMO_COMPANY_MAP: Record<string, string> = {
  "demo@zanelegal.ai":         "meridian",
  "founder-demo@zanelegal.ai": "pulse",  // company is "Pulse Health Technologies Ltd"
};

// We store the owner's email in the `role_in_contracts` field, an existing
// schema text field that PocketBase reliably stores and returns. This avoids
// issues with custom fields (ownerEmail) that PocketBase silently ignores
// when not present in the collection schema.
const OWNER_FIELD = "role_in_contracts";

async function getCompany(ownerEmail?: string): Promise<PBRecord | null> {
  // Fetch ALL companies once and filter in-memory. More reliable than PB filters
  // on non-indexed fields.
  let allCompanies: PBRecord[];
  try {
    allCompanies = await pb.collection("companies").getFullList();
  } catch (err) {
    console.error("[getCompany] PocketBase query failed:", (err as Error)?.message ?? err);
    throw err;
  }

  if (ownerEmail) {
    // Step 1: Demo users, find by known company name fragment.
    if (ownerEmail in DEMO_COMPANY_MAP) {
      const fragment = DEMO_COMPANY_MAP[ownerEmail].toLowerCase();
      const match = allCompanies.find((c) =>
        String(c["name"] ?? "").toLowerCase().includes(fragment)
      );
      if (match) return match;
    }

    // Step 2: All real users, find by OWNER_FIELD (role_in_contracts stores the owner email).
    const byOwner = allCompanies.find(
      (c) => String(c[OWNER_FIELD] ?? "") === ownerEmail
    );
    if (byOwner) return byOwner;
  }

  // Step 3: Single-tenant fallback, only when exactly one company exists.
  if (allCompanies.length === 1) return allCompanies[0];
  return null;
}

// ── Tenant ownership guard ───────────────────────────────────────────────────

async function assertOwnsDocument(userId: string, documentId: string, userCompanyId: string): Promise<void> {
  // userId param kept for future per-user checks; current guard is company-level
  void userId;
  const doc = await pb.collection("uploaded_documents").getOne(documentId);
  if ((doc["company"] as string) !== userCompanyId) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}

// Classify a verified inbound email's intent and act on it. Runs fire-and-forget
// after the webhook has acknowledged Mailgun. Persists the parsed intent on the
// inbound_emails record for downstream sections; for "unclear" it replies with a
// short helpful email (Section 2b). Never throws.
async function handleInboundIntent(input: {
  recordId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  company: Record<string, any>;
  sender: string;
  subject: string;
  bodyText: string;
  attachments: InboundAttachment[];
  messageId: string;
  threadId: string;
  threadContractId: string;
}): Promise<void> {
  const companyInboundEmail = (input.company["inbound_email"] as string) || "";
  const companyId = input.company.id as string;
  const { threadId, threadContractId } = input;
  try {
    const result = await parseEmailIntent({
      subject: input.subject,
      bodyText: input.bodyText,
      attachmentNames: input.attachments.map((a) => a.originalName),
    });

    if (input.recordId) {
      await pb.collection("inbound_emails").update(input.recordId, {
        intent: result.intent,
        intentParams: JSON.stringify(result),
      }).catch((e: unknown) => console.warn("[intent] could not persist intent:", (e as Error)?.message));
    }
    // Record the intent on the inbound thread record too.
    void pb.collection("email_threads").getFullList({
      filter: `thread_id = "${threadId.replace(/"/g, "")}" && direction = "inbound" && intent = ""`,
      fields: "id",
    }).then((rows) => rows.forEach((r) => pb.collection("email_threads").update(r.id, { intent: result.intent }).catch(() => {})))
      .catch(() => {});

    console.log(
      `[intent] ${input.sender}: ${result.intent}` +
      `${result.documentType ? ` (${result.documentType})` : ""}` +
      `${result.counterparty ? ` / ${result.counterparty}` : ""}` +
      `${threadContractId ? ` [thread→contract ${threadContractId}]` : ""}`
    );

    // Section 3: when an inbound email belongs to a thread already linked to a
    // contract and carries negotiation history (forwarded or quoted reply chain),
    // parse the ENTIRE thread, not just this message, into structured
    // per-counterparty negotiation moves (decision_events + negotiation_events).
    // The sender is already verified as a company user (3e). Additive: normal
    // intent handling still runs. Non-fatal.
    if (threadContractId && (looksForwarded(input.subject, input.bodyText) || carriesThreadHistory(input.bodyText))) {
      await captureThreadNegotiation({
        companyId,
        contractId: threadContractId,
        threadId,
        currentBody: input.bodyText,
        sender: input.sender,
      }).catch((e) => console.warn("[intent] negotiation capture failed (non-fatal):", (e as Error)?.message));
    }

    const ctxBase = { companyId, user: input.sender, threadId, intent: result.intent };

    // Section 3: review_contract WITH an attachment → run the full pipeline.
    const hasContractAttachment = input.attachments.length > 0;
    if (result.intent === "review_contract" && hasContractAttachment) {
      await processReviewByEmail({
        company: input.company, sender: input.sender, subject: input.subject,
        messageId: input.messageId, attachments: input.attachments, intentParams: result,
        inboundRecordId: input.recordId, threadId,
      });
      return;
    }

    // Contextual reply: a review/question follow-up in a thread that already has
    // a contract, with no new attachment, is answered against that contract
    // without the user re-attaching anything (Section 6a).
    if ((result.intent === "question" || result.intent === "review_contract") && threadContractId) {
      await processQuestionByEmail({
        company: input.company, sender: input.sender, subject: input.subject, bodyText: input.bodyText,
        messageId: input.messageId, intentParams: result, inboundRecordId: input.recordId,
        threadId, forceContractId: threadContractId,
      });
      return;
    }

    // Section 4: draft_document → playbook-grounded first draft (scoped).
    if (result.intent === "draft_document") {
      await processDraftByEmail({
        company: input.company, sender: input.sender, subject: input.subject,
        messageId: input.messageId, intentParams: result, inboundRecordId: input.recordId, threadId,
      });
      return;
    }

    // Section 5: question (no thread contract) → grounded answer from company data.
    if (result.intent === "question") {
      await processQuestionByEmail({
        company: input.company, sender: input.sender, subject: input.subject, bodyText: input.bodyText,
        messageId: input.messageId, intentParams: result, inboundRecordId: input.recordId, threadId,
      });
      return;
    }

    // Section 2b: unclear → short helpful clarification reply.
    if (result.intent === "unclear") {
      const sent = await threadReplyText(
        { ...ctxBase, contractId: threadContractId || undefined },
        {
          to: input.sender,
          from: companyInboundEmail || undefined,
          subject: input.subject ? `Re: ${input.subject}` : "How can I help?",
          text: UNCLEAR_REPLY_TEXT,
          inReplyTo: input.messageId || undefined,
        }
      );
      if (input.recordId) {
        await pb.collection("inbound_emails").update(input.recordId, {
          status: sent ? "CLARIFICATION_SENT" : "UNCLEAR",
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[intent] handleInboundIntent failed:", (err as Error)?.message);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {

  // Inbound email: ensure schema (companies.inbound_email + inbound_emails /
  // inbound_rejections collections) and backfill addresses for existing
  // companies. Fire-and-forget so a slow/unavailable PB never blocks boot.
  void backfillInboundEmails().catch((e: unknown) =>
    console.warn("[inbound] startup backfill failed:", (e as Error)?.message));

  // ── Inbound email webhook (Mailgun) ───────────────────────────────────────────
  // Public endpoint. Mailgun cannot present our auth cookie, so every request's
  // Mailgun signature is verified instead. Only emails from a registered user of
  // the recipient company are persisted; everything else (no matching company,
  // unknown sender) is logged silently to inbound_rejections and ignored. We
  // always return 200 on policy rejections so nothing is revealed to a sender
  // and Mailgun does not retry. No model call happens here. When attachments
  // are processed downstream they run through the existing PII anonymisation
  // pipeline, exactly like manual uploads.
  app.post(
    "/api/inbound-email",
    (req: Request, res: Response, next: NextFunction) => {
      inboundUpload.any()(req, res, (err: unknown) => {
        if (err) {
          console.warn("[inbound] multipart parse error:", (err as Error)?.message);
          res.status(200).json({ ok: false }); // acknowledge; do nothing else
          return;
        }
        next();
      });
    },
    ah(async (req: Request, res: Response) => {
      const body = (req.body ?? {}) as Record<string, string>;
      const files = ((req.files as Express.Multer.File[] | undefined) ?? []);
      const cleanupFiles = () => {
        for (const f of files) { try { fs.unlinkSync(f.path); } catch { /* ignore */ } }
      };

      // 1. Verify the Mailgun signature on EVERY request.
      if (!verifyMailgunSignature(body.timestamp, body.token, body.signature)) {
        cleanupFiles();
        sendError(res, 401, "Invalid signature");
        return;
      }

      await ensureInboundSchema().catch(() => {});
      await ensureThreadSchema().catch(() => {});

      const sender = normaliseEmail(body.sender || body.from || body.From);
      const recipientField = body.recipient || body.To || body.to || "";
      const subject = body.subject || body.Subject || "";
      const bodyText = body["stripped-text"] || body["body-plain"] || body["body-html"] || "";
      const messageId = body["Message-Id"] || body["message-id"] || "";
      const inReplyTo = body["In-Reply-To"] || body["in-reply-to"] || "";
      const references = body["References"] || body["references"] || "";

      // 2. Resolve the company from the recipient (handles To + Cc + forwards).
      const addresses = extractInboundAddresses(recipientField, body.To, body.Cc, body.recipient);
      const company = await resolveCompanyByRecipient(addresses);
      if (!company) {
        cleanupFiles();
        await logRejection({ sender, recipient: recipientField, subject, reason: "no_company" });
        res.status(200).json({ ok: true }); // neutral, reveal nothing
        return;
      }

      // 3. Sender must be a registered user of THAT company (security, 1d).
      const authorised = await getAuthorisedSenders(company);
      if (!sender || !authorised.has(sender)) {
        cleanupFiles();
        await logRejection({ sender, recipient: recipientField, subject, reason: "unknown_sender", companyId: company.id as string });
        res.status(200).json({ ok: true }); // neutral
        return;
      }

      // 4. Accepted, persist the parsed email + attachment references for the
      //    downstream intent/processing section. Attachments are already saved
      //    to ./uploads (nanoid names) by the inbound multer; only PDF/DOCX are
      //    kept.
      const attachments = files.map((f) => ({
        filename: f.filename,        // on-disk name in ./uploads
        originalName: f.originalname,
        size: f.size,
        mime: f.mimetype,
      }));

      let inboundRecordId = "";
      try {
        const rec = await pb.collection("inbound_emails").create({
          company: company.id,
          sender,
          recipient: addresses[0] ?? recipientField,
          subject: subject.slice(0, 500),
          bodyText: bodyText.slice(0, 50_000),
          attachments: JSON.stringify(attachments),
          messageId,
          status: "RECEIVED",
        });
        inboundRecordId = rec.id as string;
      } catch (err) {
        console.error("[inbound] failed to persist inbound_emails record:", (err as Error)?.message);
      }

      // Thread awareness (Section 6a): derive a stable thread id, resolve any
      // contract already linked to this thread, and log the inbound email.
      const threadId = computeThreadId(messageId, inReplyTo, references);
      const threadContractId = await getThreadContractId(company.id as string, threadId);
      await logEmail({
        companyId: company.id as string, user: sender, threadId, direction: "inbound",
        contractId: threadContractId, subject, body: bodyText, messageId,
      });

      console.log(`[inbound] accepted email from ${sender} → ${company["name"]} (${attachments.length} attachment(s))`);
      // Acknowledge Mailgun immediately; classify intent + handle async so the
      // webhook stays fast.
      res.status(200).json({ ok: true });

      void handleInboundIntent({
        recordId: inboundRecordId,
        company,
        sender,
        subject,
        bodyText,
        attachments,
        messageId,
        threadId,
        threadContractId,
      });
    })
  );

  // ── Auth ─────────────────────────────────────────────────────────────────────

  app.post("/api/auth/register", ah(async (req: Request, res: Response) => {
    const parsed = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8),
    }).safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, parsed.error.message); return; }

    const { name, email, password } = parsed.data;

    // Manual onboarding model: public self-serve registration is disabled.
    // Accounts are created by admin via PocketBase, or via a pending team
    // invite (invited emails may still register here).
    const pendingInvites = await pb.collection("team_invites").getFullList({
      filter: `email = "${email.replace(/"/g, '\\"')}" && status = "pending"`,
      fields: "id",
    }).catch(() => []);
    if (pendingInvites.length === 0) {
      sendError(res, 403, "Self-serve registration is disabled. Request access from the home page and Ahmed will personally onboard you within 24 hours.");
      return;
    }

    try {
      // Use PocketBase native auth - it handles hashing internally
      const user = await pb.collection("users").create({
        name,
        email,
        emailVisibility: true,
        password,
        passwordConfirm: password,
      });
      const token = signToken({ userId: user.id, email: user["email"] as string });
      res.cookie("token", token, { ...COOKIE_OPTS, path: "/" });
      await audit({ action: "user_registered", userId: user.id, detail: { email: user["email"] } });
      // Include token in body so clients can use Authorization: Bearer as fallback
      res.json({ userId: user.id, name: user["name"], email: user["email"], token });
    } catch (err: unknown) {
      const pbErr = err as { status?: number; response?: { data?: Record<string, unknown>; message?: string } };
      console.error("[register] PocketBase error:", pbErr.status, JSON.stringify(pbErr.response ?? err));
      if (pbErr.status === 400) {
        const data = pbErr.response?.data ?? {};
        if ("email" in data) {
          sendError(res, 409, "An account with this email already exists."); return;
        }
        // Surface the actual PocketBase validation message if present
        const detail = pbErr.response?.message ?? "Account creation failed. Please try again.";
        sendError(res, 400, detail); return;
      }
      sendError(res, 500, "Account creation failed. Please try again."); return;
    }
  }));

  // ── Access requests (manual onboarding) ──────────────────────────────────────
  // Public endpoint backing the landing-page "Request access" form. Stores the
  // submission in the access_requests collection for Ahmed to onboard manually.
  app.post("/api/access-request", ah(async (req: Request, res: Response) => {
    const parsed = z.object({
      name: z.string().min(1).max(200),
      email: z.string().email(),
      company: z.string().min(1).max(200),
      role: z.string().min(1).max(200),
      contractsDescription: z.string().max(2000).optional().default(""),
    }).safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, "Please fill in your name, work email, company, and role."); return; }

    const { name, email, company, role, contractsDescription } = parsed.data;
    const record = {
      name,
      email,
      company,
      role,
      contracts_description: contractsDescription,
    };

    try {
      await pb.collection("access_requests").create(record);
    } catch (err: unknown) {
      // If the collection doesn't exist yet (pb:setup not re-run), create it
      // on the fly so no request is ever lost, then retry once.
      const status = (err as { status?: number }).status;
      if (status === 404) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (pb.collections as any).create({
          name: "access_requests",
          type: "base",
          fields: [
            { name: "name", type: "text", required: true },
            { name: "email", type: "text", required: true },
            { name: "company", type: "text", required: false },
            { name: "role", type: "text", required: false },
            { name: "contracts_description", type: "text", required: false },
          ],
        }).catch(() => {});
        await pb.collection("access_requests").create(record);
      } else {
        throw err;
      }
    }
    res.json({ ok: true });
  }));

  // ── Legacy contract review (cost-controlled estate mapping) ────────────────

  // Kick off the lightweight legacy pipeline for an uploaded document.
  // Flags the document legacy: true so it feeds portfolio intelligence and
  // counterparty history as a normal library record.
  app.post("/api/legacy/review/:documentId", requireAuth, ah(async (req: Request, res: Response) => {
    const { documentId } = req.params;
    try {
      await pb.collection("uploaded_documents").getOne(documentId);
    } catch {
      sendError(res, 404, "Document not found"); return;
    }
    await ensureLegacyFields();
    await pb.collection("uploaded_documents").update(documentId, { status: "PROCESSING", legacy: true });
    // Fire-and-forget, the client polls the report endpoint for status
    runLegacyReview(documentId).catch((err: unknown) =>
      console.error(`[legacy] review failed for ${documentId}:`, (err as Error)?.message));
    res.json({ ok: true, documentId });
  }));

  // Estate report: portfolio rows, renewals timeline (next 12 months),
  // risk flags, and exposure summary across all legacy contracts.
  app.get("/api/legacy/report", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json({ rows: [], renewals: [], summary: null }); return; }

    const docs = await pb.collection("uploaded_documents").getFullList({
      filter: `company = "${company.id}" && legacy = true`,
      sort: "-created",
    }).catch(() => [] as PBRecord[]);

    const now = Date.now();
    const DAY = 24 * 3600 * 1000;
    const in12mo = now + 365 * DAY;

    const rows = docs.map((d) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let extract: any = null;
      try { extract = d["legacyExtract"] ? JSON.parse(d["legacyExtract"] as string) : null; } catch { /* malformed */ }

      const status = (d["status"] as string) ?? "";
      const isComplete = status === "COMPLETE";
      const renewalDate = ((d["renewalDate"] as string) || extract?.renewal?.renewalDate || "").slice(0, 10);
      const noticePeriodDays = (d["noticePeriodDays"] as number) ?? extract?.renewal?.noticePeriodDays ?? null;
      const autoRenewal = !!d["autoRenewal"] || extract?.renewal?.autoRenewal === true;
      const governingLaw = (d["governingLaw"] as string) || extract?.governingLaw || "";

      // Risk flags, computed only for completed extractions
      const riskFlags: string[] = [];
      if (isComplete && extract) {
        if (extract.liabilityCap?.present === true && extract.liabilityCap?.capped === false) {
          riskFlags.push("Uncapped liability");
        } else if (extract.liabilityCap?.present === false) {
          riskFlags.push("No liability cap clause");
        }
        if (autoRenewal && renewalDate) {
          const rts = Date.parse(renewalDate);
          if (!isNaN(rts) && rts >= now) {
            const noticeDeadline = noticePeriodDays ? rts - noticePeriodDays * DAY : rts;
            if (noticeDeadline <= now + 30 * DAY) riskFlags.push("Auto-renewal notice window open");
          }
        }
        if (!governingLaw) riskFlags.push("Missing governing law");
      }

      return {
        id: d.id,
        name: (d["originalName"] as string) ?? "",
        status,
        counterparty: (d["counterpartyName"] as string) || extract?.counterparty || "",
        contractType: (d["contractType"] as string) ?? "",
        value: (d["contractValue"] as number) ?? extract?.value?.amount ?? null,
        currency: (d["currency"] as string) || extract?.value?.currency || "GBP",
        governingLaw,
        autoRenewal,
        renewalDate: renewalDate || null,
        noticePeriodDays,
        endDate: extract?.term?.endDate ?? null,
        termSummary: extract?.term?.summary ?? "",
        liabilityCap: extract?.liabilityCap?.summary ?? "",
        terminationRights: extract?.terminationRights ?? "",
        assignment: extract?.assignment ?? "",
        dataProtection: extract?.dataProtection ?? "",
        riskFlags,
        created: d["created"],
      };
    });

    // Renewals timeline: anything renewing or expiring in the next 12 months
    const renewals = rows
      .map((r) => {
        const dateStr = r.renewalDate || r.endDate;
        if (!dateStr) return null;
        const ts = Date.parse(dateStr);
        if (isNaN(ts) || ts < now || ts > in12mo) return null;
        return {
          id: r.id,
          name: r.name,
          counterparty: r.counterparty,
          date: dateStr,
          kind: r.renewalDate ? (r.autoRenewal ? "auto-renews" : "renews") : "expires",
          autoRenewal: r.autoRenewal,
          noticePeriodDays: r.noticePeriodDays,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.date.localeCompare(b.date));

    const complete = rows.filter((r) => r.status === "COMPLETE");
    const flagged = complete.filter((r) => r.riskFlags.length > 0);
    const summary = rows.length === 0 ? null : {
      total: rows.length,
      complete: complete.length,
      processing: rows.filter((r) => r.status !== "COMPLETE" && r.status !== "FAILED").length,
      failed: rows.filter((r) => r.status === "FAILED").length,
      totalValue: complete.reduce((s, r) => s + (r.value ?? 0), 0),
      flaggedValue: flagged.reduce((s, r) => s + (r.value ?? 0), 0),
      flaggedCount: flagged.length,
      uncappedLiability: complete.filter((r) => r.riskFlags.some((f) => f.includes("liability") || f.includes("Uncapped"))).length,
      autoRenewalsInWindow: complete.filter((r) => r.riskFlags.some((f) => f.startsWith("Auto-renewal"))).length,
      missingGoverningLaw: complete.filter((r) => r.riskFlags.includes("Missing governing law")).length,
      renewalsNext12mo: renewals.length,
    };

    res.json({ rows, renewals, summary });
  }));

  // ── Admin gate ──────────────────────────────────────────────────────────────
  // Admin = email in ADMIN_EMAILS (comma-separated; defaults to the founder),
  // or an is_admin flag on the user record (supported if the field is added).
  async function isAdminRequest(req: Request): Promise<boolean> {
    const adminEmails = (process.env.ADMIN_EMAILS ?? "ahmed@zanelegal.ai")
      .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    const userEmail = (req.user?.email ?? "").toLowerCase();
    if (adminEmails.includes(userEmail)) return true;
    if (req.user?.userId) {
      const userRec = await pb.collection("users").getOne(req.user.userId).catch(() => null);
      if (userRec && (userRec as PBRecord)["is_admin"] === true) return true;
    }
    return false;
  }

  // ── Admin: compounding metrics dashboard ───────────────────────────────────
  // Internal indicative quote for legacy contract review. Admin only: the price
  // bands live server-side so they never ship in the public bundle, and this is a
  // sales helper, not a customer-facing price list. Pricing stays conversation-led.
  app.get("/api/admin/legacy-quote", requireAuth, ah(async (req: Request, res: Response) => {
    if (!(await isAdminRequest(req))) { sendError(res, 403, "Admin access required"); return; }
    const contracts = Math.max(0, Math.floor(Number(req.query.contracts) || 0));
    // Bands: per-contract rate by estate size.
    const perContract =
      contracts <= 100  ? 12 :
      contracts <= 250  ? 10 :
      contracts <= 500  ? 8  :
      contracts <= 1000 ? 6  :
                          5;
    const band =
      contracts <= 100  ? "Up to 100 contracts" :
      contracts <= 250  ? "101 to 250 contracts" :
      contracts <= 500  ? "251 to 500 contracts" :
      contracts <= 1000 ? "501 to 1000 contracts" :
                          "1000+ contracts";
    res.json({ contracts, perContract, total: contracts * perContract, band });
  }));

  // Internal metrics proving the accumulation story, computed live from
  // PocketBase, no external analytics dependency.
  app.get("/api/admin/metrics", requireAuth, ah(async (req: Request, res: Response) => {
    if (!(await isAdminRequest(req))) { sendError(res, 403, "Admin access required"); return; }

    const [companies, docs, results, decisions] = await Promise.all([
      pb.collection("companies").getFullList({ fields: "id,name,subscription_tier" }).catch(() => [] as PBRecord[]),
      pb.collection("uploaded_documents").getFullList({
        fields: "id,company,status,legacy,reviewCost,outcome,counterpartyName,created",
      }).catch(() => [] as PBRecord[]),
      pb.collection("review_results").getFullList({ fields: "id,document,ragStatus" }).catch(() => [] as PBRecord[]),
      pb.collection("decision_events").getFullList({ fields: "id,company" }).catch(() => [] as PBRecord[]),
    ]);

    const HOURS_SAVED_PER_REVIEW = 2.5;
    const TIER_MONTHLY_PRICE: Record<string, number> = { trial: 0, starter: 450, team: 800, growth: 1350 };

    interface Metrics {
      contractsReviewed: number;
      reviewsByMonth: Record<string, number>;
      clausesAnalysed: number;
      ragBreakdown: { RED: number; AMBER: number; GREEN: number; GREY: number };
      deviationRate: number;        // % of analysed clauses (RED+AMBER) vs RED+AMBER+GREEN
      decisionEvents: number;
      outcomeCaptureRate: number;   // % of completed reviews with a logged outcome
      outcomesLogged: number;
      counterpartiesTracked: number; // distinct counterparties with 2+ contracts
      hoursSaved: number;
      reviewCost: number;
      estMonthlyRevenue: number;
      legacyProcessed: number;
    }
    const blank = (): Metrics => ({
      contractsReviewed: 0, reviewsByMonth: {}, clausesAnalysed: 0,
      ragBreakdown: { RED: 0, AMBER: 0, GREEN: 0, GREY: 0 },
      deviationRate: 0, decisionEvents: 0, outcomeCaptureRate: 0, outcomesLogged: 0,
      counterpartiesTracked: 0, hoursSaved: 0, reviewCost: 0, estMonthlyRevenue: 0, legacyProcessed: 0,
    });

    const docCompany = new Map<string, string>();
    const perCompany = new Map<string, Metrics>();
    const cpDocsByCompany = new Map<string, Map<string, number>>();
    const aggregate = blank();
    const get = (companyId: string): Metrics => {
      let m = perCompany.get(companyId);
      if (!m) { m = blank(); perCompany.set(companyId, m); }
      return m;
    };

    for (const d of docs) {
      const companyId = (d["company"] as string) || "unattached";
      docCompany.set(d.id, companyId);
      const m = get(companyId);
      const isComplete = d["status"] === "COMPLETE";
      const month = String(d["created"] ?? "").slice(0, 7);
      if (isComplete) {
        m.contractsReviewed++; aggregate.contractsReviewed++;
        if (month) {
          m.reviewsByMonth[month] = (m.reviewsByMonth[month] ?? 0) + 1;
          aggregate.reviewsByMonth[month] = (aggregate.reviewsByMonth[month] ?? 0) + 1;
        }
        if (d["outcome"]) { m.outcomesLogged++; aggregate.outcomesLogged++; }
      }
      if (d["legacy"] === true && isComplete) { m.legacyProcessed++; aggregate.legacyProcessed++; }
      const cost = (d["reviewCost"] as number) ?? 0;
      m.reviewCost += cost; aggregate.reviewCost += cost;
      const cp = ((d["counterpartyName"] as string) || "").trim();
      if (cp && cp.toLowerCase() !== "unknown") {
        const cpMap = cpDocsByCompany.get(companyId) ?? new Map<string, number>();
        cpMap.set(cp, (cpMap.get(cp) ?? 0) + 1);
        cpDocsByCompany.set(companyId, cpMap);
      }
    }

    for (const r of results) {
      const companyId = docCompany.get(r["document"] as string);
      if (!companyId) continue;
      const m = get(companyId);
      m.clausesAnalysed++; aggregate.clausesAnalysed++;
      const rag = (r["ragStatus"] as string) ?? "GREY";
      if (rag in m.ragBreakdown) {
        m.ragBreakdown[rag as keyof Metrics["ragBreakdown"]]++;
        aggregate.ragBreakdown[rag as keyof Metrics["ragBreakdown"]]++;
      }
    }

    for (const e of decisions) {
      const companyId = (e["company"] as string) || "";
      if (companyId) get(companyId).decisionEvents++;
      aggregate.decisionEvents++;
    }

    const finalise = (m: Metrics, companyId?: string) => {
      const assessed = m.ragBreakdown.RED + m.ragBreakdown.AMBER + m.ragBreakdown.GREEN;
      m.deviationRate = assessed > 0 ? Math.round(((m.ragBreakdown.RED + m.ragBreakdown.AMBER) / assessed) * 100) : 0;
      m.outcomeCaptureRate = m.contractsReviewed > 0 ? Math.round((m.outcomesLogged / m.contractsReviewed) * 100) : 0;
      m.hoursSaved = Math.round(m.contractsReviewed * HOURS_SAVED_PER_REVIEW * 10) / 10;
      m.reviewCost = Math.round(m.reviewCost * 100) / 100;
      if (companyId) {
        const cpMap = cpDocsByCompany.get(companyId);
        m.counterpartiesTracked = cpMap ? Array.from(cpMap.values()).filter((n) => n >= 2).length : 0;
      }
    };

    const companyRows = companies.map((c) => {
      const m = get(c.id);
      const tier = resolveTier(c["subscription_tier"]);
      m.estMonthlyRevenue = TIER_MONTHLY_PRICE[tier] ?? 0;
      finalise(m, c.id);
      return { companyId: c.id, name: (c["name"] as string) ?? c.id, tier, ...m };
    }).sort((a, b) => b.contractsReviewed - a.contractsReviewed);

    aggregate.estMonthlyRevenue = companyRows.reduce((s, c) => s + c.estMonthlyRevenue, 0);
    aggregate.counterpartiesTracked = companyRows.reduce((s, c) => s + c.counterpartiesTracked, 0);
    finalise(aggregate);

    // Months axis: last 12 months including current
    const months: string[] = [];
    const nowDate = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    res.json({ aggregate, companies: companyRows, months });
  }));

  // ── Admin: monthly review cost per company ────────────────────────────────
  // Unit-economics view fed by the per-run cost logging in reviewOrchestrator.
  // Admin-only: gated on ADMIN_EMAILS (comma-separated; defaults to the founder).
  app.get("/api/admin/review-costs", requireAuth, ah(async (req: Request, res: Response) => {
    const adminEmails = (process.env.ADMIN_EMAILS ?? "ahmed@zanelegal.ai")
      .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    const userEmail = (req.user?.email ?? "").toLowerCase();
    if (!adminEmails.includes(userEmail)) { sendError(res, 403, "Admin access required"); return; }

    const [docs, companies] = await Promise.all([
      pb.collection("uploaded_documents").getFullList({
        filter: "reviewCost > 0",
        fields: "id,company,reviewCost,created",
      }).catch(() => []),
      pb.collection("companies").getFullList({ fields: "id,name" }).catch(() => []),
    ]);
    const companyNames = new Map(companies.map((c) => [c.id, (c["name"] as string) ?? c.id]));

    // Aggregate: company → month (YYYY-MM) → total cost
    const byCompany = new Map<string, { name: string; monthly: Record<string, number>; total: number; reviews: number }>();
    const monthsSet = new Set<string>();
    let grandTotal = 0;
    for (const d of docs) {
      const companyId = (d["company"] as string) ?? "unknown";
      const cost = (d["reviewCost"] as number) ?? 0;
      const month = String(d["created"] ?? "").slice(0, 7); // "YYYY-MM"
      if (!month) continue;
      monthsSet.add(month);
      const entry = byCompany.get(companyId) ?? {
        name: companyNames.get(companyId) ?? companyId,
        monthly: {},
        total: 0,
        reviews: 0,
      };
      entry.monthly[month] = Math.round(((entry.monthly[month] ?? 0) + cost) * 10_000) / 10_000;
      entry.total = Math.round((entry.total + cost) * 10_000) / 10_000;
      entry.reviews += 1;
      byCompany.set(companyId, entry);
      grandTotal += cost;
    }

    res.json({
      months: Array.from(monthsSet).sort(),
      companies: Array.from(byCompany.entries()).map(([companyId, e]) => ({ companyId, ...e }))
        .sort((a, b) => b.total - a.total),
      grandTotal: Math.round(grandTotal * 10_000) / 10_000,
      currency: "USD",
    });
  }));

  app.post("/api/auth/login", ah(async (req: Request, res: Response) => {
    const parsed = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, "Invalid email or password"); return; }

    const { email, password } = parsed.data;

    try {
      // Use a fresh client so authWithPassword doesn't overwrite the admin token
      // stored on the shared `pb` singleton.
      const userClient = newPBClient();

      // Check if the user exists first (to distinguish "not found" from "wrong password")
      const existingUsers = await pb.collection("users").getFullList({
        filter: `email = "${email.replace(/"/g, '\\"')}"`,
        fields: "id",
      }).catch(() => []);

      if (existingUsers.length === 0) {
        sendError(res, 401, "No account found with this email address."); return;
      }

      const authData = await userClient.collection("users").authWithPassword(email, password);
      const user = authData.record;
      const token = signToken({ userId: user.id, email: user["email"] as string });
      res.cookie("token", token, { ...COOKIE_OPTS, path: "/" });
      await audit({ action: "user_login", userId: user.id, ipAddress: req.ip });
      // Include token in body so clients can use Authorization: Bearer as fallback
      res.json({ userId: user.id, name: user["name"], email: user["email"], token });
    } catch (err: unknown) {
      const pbErr = err as { status?: number };
      if (pbErr.status === 400 || pbErr.status === 401) {
        sendError(res, 401, "Email or password is incorrect. Please try again."); return;
      }
      sendError(res, 500, "Sign-in failed. Please try again."); return;
    }
  }));

  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    // clearCookie must use the same options the cookie was SET with, otherwise
    // the browser ignores the clear instruction. In production the cookie was
    // scoped to domain ".zanelegal.ai", match that here.
    const clearOpts: Parameters<typeof res.clearCookie>[1] = {
      path: "/",
      httpOnly: true,
      secure: isProd,
      sameSite: (isProd && crossDomain ? "none" : "lax") as "none" | "lax",
      ...(isProd ? { domain: ".zanelegal.ai" } : {}),
    };
    res.clearCookie("token", clearOpts);
    // Belt-and-suspenders: also clear without domain in case cookie was set differently
    res.clearCookie("token", { path: "/" });
    res.json({ ok: true });
  });

  app.get("/api/auth/me", requireAuth, ah(async (req: Request, res: Response) => {
    // The JWT has already been verified by requireAuth. We trust it.
    // Include a fresh token so the client can use Authorization: Bearer as a fallback
    // when httpOnly cookies are stripped by a reverse proxy (e.g. Railway).
    //
    // IMPORTANT: jwt.verify() returns the full payload including `exp` and `iat`.
    // We must pass ONLY the fields we want to re-sign, otherwise jwt.sign throws
    // "payload already has an exp property" when combined with expiresIn option.
    const { userId, email } = req.user!;
    const freshToken = signToken({ userId, email });
    // isAdmin lets the client gate admin-only UI (e.g. the internal legacy quote helper).
    const isAdmin = await isAdminRequest(req);
    res.json({ userId, email, token: freshToken, isAdmin });
  }));

  // ── Company search / enrichment ──────────────────────────────────────────────

  // No requireAuth - this searches public registry data and is needed during onboarding
  app.get("/api/company/search", ah(async (req: Request, res: Response) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) { res.json({ candidates: [] }); return; }
    const candidates = await searchCompanies(q);
    res.json({ candidates });
  }));

  // No requireAuth - enriches public company registry data, used during onboarding
  app.post("/api/company/enrich", ah(async (req: Request, res: Response) => {
    const candidate = req.body;
    if (!candidate?.name) { sendError(res, 400, "candidate required"); return; }
    const enriched = await enrichCompany(candidate);
    res.json(enriched);
  }));

  // ── Company ─────────────────────────────────────────────────────────────────

  app.post("/api/company", requireAuth, ah(async (req: Request, res: Response) => {
    const parsed = companySchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, parsed.error.message); return; }

    // Multi-tenant mode: only delete THIS user's existing company.
    // Never delete demo companies (Meridian, Sora) or other users' companies.
    // We identify the current user's company by ownerEmail, which is stored on
    // creation below. Ignore errors so a missing company doesn't block re-setup.
    // Delete only this user's existing company (identified by role_in_contracts = userEmail).
    const userEmail = req.user?.email;
    if (userEmail) {
      try {
        const all = await pb.collection("companies").getFullList();
        const existing = all.find(c => String(c[OWNER_FIELD] ?? "") === userEmail);
        if (existing) {
          await pb.collection("companies").delete(existing.id);
        }
      } catch { /* no existing company for this user, fine */ }
    }

    // Generate this company's dedicated inbound email address ({slug}@inbox...).
    // Best-effort: never block company creation if address generation fails.
    await ensureInboundSchema().catch(() => {});
    const inboundEmail = await generateUniqueInboundEmail(parsed.data.name)
      .catch(() => "");

    const company = await pb.collection("companies").create({
      ...parsed.data,
      [OWNER_FIELD]: userEmail ?? "", // role_in_contracts stores owner email
      subscription_tier: "trial",
      ...(inboundEmail ? { inbound_email: inboundEmail } : {}),
    });

    await audit({
      action: "company_created",
      entityType: "company",
      entityId: company.id,
      userId: req.user?.userId,
      detail: { name: company["name"], sector: company["sector"], workflowType: company["workflowType"] },
    });

    // Kick off regulatory detection async
    detectAndSaveRegulations(company.id).catch(console.error);

    res.json(mapCompany(company));
  }));

  app.get("/api/company", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 404, "No company configured"); return; }

    const [playbookRules, approvalContacts, regulations] = await Promise.all([
      pb.collection("playbook_rules").getFullList({
        filter: `company = "${company.id}"`,
        sort: "+clauseCategory",
      }),
      pb.collection("approval_contacts").getFullList({
        filter: `company = "${company.id}"`,
      }),
      pb.collection("company_regulations").getFullList({
        filter: `company = "${company.id}"`,
        sort: "+jurisdiction",
      }),
    ]);

    res.json({
      ...mapCompany(company),
      playbookRules: playbookRules.map(mapRule),
      approvalContacts: approvalContacts.map(mapContact),
      regulations: regulations.map(mapRegulation),
    });
  }));

  // Company-level settings update (currently: regulatory analysis prominence).
  // "" resets to the sector-derived default.
  app.patch("/api/company", requireAuth, ah(async (req: Request, res: Response) => {
    const parsed = z.object({
      regulationProminence: z.enum(["", "FULL", "RELEVANT", "MINIMAL"]),
    }).safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, parsed.error.message); return; }

    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 404, "No company configured"); return; }

    const doUpdate = () => pb.collection("companies").update(company.id, parsed.data);
    let updated;
    try {
      updated = await doUpdate();
    } catch {
      // companies collection may predate the regulationProminence field,
      // add it to the schema and retry once.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const col = await (pb.collections as any).getOne("companies");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fields: any[] = col.fields ?? col.schema ?? [];
        if (!fields.some((f) => f.name === "regulationProminence")) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (pb.collections as any).update(col.id, {
            fields: [...fields, { name: "regulationProminence", type: "text", required: false }],
          });
        }
      } catch { /* schema patch best-effort */ }
      updated = await doUpdate();
    }

    await audit({
      action: "company_updated",
      entityType: "company",
      entityId: company.id,
      userId: req.user?.userId,
      detail: { regulationProminence: parsed.data.regulationProminence },
    });
    res.json(mapCompany(updated));
  }));

  // ── Feature flags ─────────────────────────────────────────────────────────────

  app.get("/api/features", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) {
      // No company yet: return trial flags
      const flags = getFeatureFlags("trial");
      res.json({ tier: "trial", flags, trialDaysRemaining: 14, reviewsThisMonth: 0 });
      return;
    }
    const tier = resolveTier(company["subscription_tier"]);
    const flags = getFeatureFlags(tier);
    const daysLeft = tier === "trial" ? trialDaysRemaining(company["created"] as string) : null;

    // Monthly review count (for enforcing maxMonthlyReviews)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthDocs = await pb.collection("uploaded_documents").getFullList({
      filter: `company = "${company.id}" && created >= "${monthStart}"`,
      fields: "id",
    }).catch(() => [] as { id: string }[]);

    res.json({
      tier,
      flags,
      trialDaysRemaining: daysLeft,
      reviewsThisMonth: monthDocs.length,
    });
  }));

  // ── Regulatory ───────────────────────────────────────────────────────────────

  app.post("/api/regulatory/detect", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 404, "No company configured"); return; }

    await detectAndSaveRegulations(company.id);
    const regs = await pb.collection("company_regulations").getFullList({
      filter: `company = "${company.id}"`,
      sort: "+jurisdiction",
    });
    res.json(regs.map(mapRegulation));
  }));

  app.get("/api/regulatory", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json([]); return; }

    const regs = await pb.collection("company_regulations").getFullList({
      filter: `company = "${company.id}"`,
      sort: "+jurisdiction",
    });

    // Only surface frameworks that carry complete verifiable source data.
    const sourced = regs.filter((r) =>
      r["code"] && r["officialName"] && r["referenceNumber"] && r["issuingBody"] && r["citationUrl"]
    );

    // Join per-framework verification status (absence of a row = unverified).
    const codes = Array.from(new Set(sourced.map((r) => r["code"] as string)));
    const verifications = codes.length > 0
      ? await pb.collection("regulatory_framework_verifications").getFullList({
          filter: codes.map((c) => `code = "${c.replace(/"/g, "")}"`).join(" || "),
          sort: "+created",
        }).catch(() => [] as PBRecord[])
      : [];
    const verById = new Map(verifications.map((v) => [v["code"] as string, v]));

    res.json(sourced.map((r) => {
      const v = verById.get(r["code"] as string);
      return {
        ...mapRegulation(r),
        verificationStatus: (v?.["status"] as string) === "verified" ? "verified" : "unverified",
        verifiedBy: (v?.["verifiedBy"] as string) ?? "",
        verifiedAt: (v?.["verifiedAt"] as string) ?? null,
      };
    }));
  }));

  // POST /api/regulatory/frameworks/:code/verify - a named reviewer records that
  // they have checked a framework's source. Admin-gated. Body: { status, verifiedBy }.
  app.post("/api/regulatory/frameworks/:code/verify", requireAuth, ah(async (req: Request, res: Response) => {
    if (!(await isAdminRequest(req))) { sendError(res, 403, "Only an administrator can verify frameworks"); return; }
    const code = String(req.params.code).replace(/[^A-Za-z0-9_]/g, "");
    if (!code) { sendError(res, 400, "Invalid framework code"); return; }
    const { status, verifiedBy } = req.body as { status?: string; verifiedBy?: string };
    const nextStatus = status === "verified" ? "verified" : "unverified";
    if (nextStatus === "verified" && !verifiedBy?.trim()) { sendError(res, 400, "A reviewer name is required to verify"); return; }

    // Sorted so the same (oldest) row is always the one updated; any duplicates
    // from a prior race are collapsed onto it and the extras removed.
    const existing = await pb.collection("regulatory_framework_verifications").getFullList({ filter: `code = "${code}"`, sort: "+created" }).catch(() => [] as PBRecord[]);
    for (const dupe of existing.slice(1)) {
      await pb.collection("regulatory_framework_verifications").delete(dupe.id).catch(() => {});
    }
    const payload = {
      code,
      status: nextStatus,
      verifiedBy: nextStatus === "verified" ? (verifiedBy as string).trim() : "",
      verifiedAt: nextStatus === "verified" ? new Date().toISOString().replace("T", " ") : "",
    };
    if (existing.length > 0) await pb.collection("regulatory_framework_verifications").update(existing[0].id, payload);
    else await pb.collection("regulatory_framework_verifications").create(payload);

    await audit({
      action: "regulatory_profile_updated",
      entityType: "regulatory_framework",
      entityId: code,
      companyId: (await getCompany(req.user?.email))?.id,
      userId: req.user?.userId,
      detail: { action: nextStatus === "verified" ? "verified" : "unverified", verifiedBy: payload.verifiedBy },
    });
    res.json({ code, verificationStatus: nextStatus, verifiedBy: payload.verifiedBy, verifiedAt: payload.verifiedAt || null });
  }));

  // ── Regulatory synthesis (disabled) ───────────────────────────────────────────
  // This endpoint used an LLM to free-generate a regulatory interpretation,
  // including obligations, for a framework. That is unsafe for regulated buyers,
  // so it is disabled: Zane surfaces only curated, source-cited framework data
  // and never free-generates regulatory obligations.
  app.post("/api/regulatory/synthesise/:regulationId", requireAuth, ah(async (_req: Request, res: Response) => {
    sendError(res, 410, "Regulatory synthesis is disabled. Zane surfaces only curated, source-cited framework data and does not generate regulatory obligations.");
  }));

  // ── Regulatory updates digest (disabled) ──────────────────────────────────────
  // Disabled: this endpoint used an LLM to fabricate "recent regulatory
  // developments" (the prompt explicitly asked for plausible-sounding updates),
  // which is unsafe to present to regulated buyers as regulatory fact. Zane does
  // not generate regulatory news or obligations. Returns an empty set.
  app.get("/api/regulatory/updates", requireAuth, ah(async (_req: Request, res: Response) => {
    res.json({ updates: [], disabled: true });
  }));

  // ── Playbook Rules ───────────────────────────────────────────────────────────

  app.post("/api/playbook/rules", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 404, "No company configured"); return; }

    const body = req.body as { rules?: unknown[] };
    if (!Array.isArray(body.rules)) { sendError(res, 400, "rules must be an array"); return; }

    const parsed = z.array(playbookRuleSchema).safeParse(body.rules);
    if (!parsed.success) { sendError(res, 400, parsed.error.message); return; }

    // Delete existing rules for this company
    const existing = await pb.collection("playbook_rules").getFullList({
      filter: `company = "${company.id}"`,
      fields: "id",
    });
    await Promise.all(existing.map((r) => pb.collection("playbook_rules").delete(r.id)));

    // Create all new rules
    const created = await Promise.all(
      parsed.data.map((r) =>
        pb.collection("playbook_rules").create({
          ...r,
          company: company.id,
          workflowType: r.workflowType ?? "COMMERCIAL_CONTRACT",
        })
      )
    );

    await audit({
      action: "playbook_updated",
      entityType: "company",
      entityId: company.id,
      userId: req.user?.userId,
      detail: { rulesCount: created.length },
    });

    res.json(created.map(mapRule));
  }));

  app.get("/api/playbook/rules", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json([]); return; }

    const { workflowType } = req.query as { workflowType?: string };
    const filter = workflowType
      ? `company = "${company.id}" && workflowType = "${workflowType}"`
      : `company = "${company.id}"`;

    const rules = await pb.collection("playbook_rules").getFullList({
      filter,
      sort: "+id",
    });

    // Derive playbook version from count of playbook_updated audit entries
    let playbookVersion = 1;
    try {
      const versionResult = await pb.collection("audit_log").getList(1, 1, {
        filter: `action = "playbook_updated" && companyId = "${company.id}"`,
        sort: "-id",
      });
      playbookVersion = Math.max(1, versionResult.totalItems);
    } catch { /* non-fatal */ }

    res.json({ rules: rules.map(mapRule), playbookVersion });
  }));

  app.put("/api/playbook/rule/:id", requireAuth, ah(async (req: Request, res: Response) => {
    const parsed = playbookRuleSchema.partial().safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, parsed.error.message); return; }

    const rule = await pb.collection("playbook_rules").update(req.params.id, parsed.data);

    // Audit: playbook rule updated
    const companyRec = await pb.collection("playbook_rules").getOne(rule.id);
    await audit({
      action: "playbook_updated",
      entityType: "playbook_rule",
      entityId: rule.id,
      companyId: companyRec["company"] as string,
      detail: { clauseCategory: rule["clauseCategory"], fields: Object.keys(parsed.data) },
    });

    res.json(mapRule(rule));
  }));

  // Add a single new clause to the playbook
  app.post("/api/playbook/rule", requireAuth, ah(async (req: Request, res: Response) => {
    const { companyId, ...rest } = req.body as { companyId?: string } & Record<string, unknown>;

    // Resolve company if not provided
    let cId = companyId;
    if (!cId) {
      const companies = await pb.collection("companies").getFullList({ sort: "-id" });
      if (!companies.length) { sendError(res, 400, "No company found"); return; }
      cId = companies[0].id;
    }

    const rule = await pb.collection("playbook_rules").create({ ...rest, company: cId });

    await audit({
      action: "playbook_updated",
      entityType: "playbook_rule",
      entityId: rule.id,
      companyId: cId,
      detail: { clauseCategory: rule["clauseCategory"], action: "clause_added" },
    });

    res.status(201).json(mapRule(rule));
  }));

  app.delete("/api/playbook/rule/:id", requireAuth, ah(async (req: Request, res: Response) => {
    await pb.collection("playbook_rules").delete(req.params.id);
    res.json({ ok: true });
  }));

  // Feature 39 - Generate AI-suggested playbook position for a clause category
  // ── Playbook update suggestions based on outcome data ────────────────────────
  // Returns clauses with high drift + an LLM-powered update suggestion for each.

  app.get("/api/playbook/drift-suggestions", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json({ suggestions: [] }); return; }

    // Load documents first, then query results/feedbacks without chained relation filters
    const [driftDocs, rules] = await Promise.all([
      pb.collection("uploaded_documents").getFullList({
        filter: `company = "${company.id}"`,
        fields: "id",
      }),
      pb.collection("playbook_rules").getFullList({
        filter: `company = "${company.id}"`,
        fields: "id,clauseCategory,preferredPosition,hardRedLine,workflowType",
      }),
    ]);
    const driftDocIds = driftDocs.map((d) => d.id);
    const driftDocFilter = driftDocIds.length > 0
      ? driftDocIds.map((id) => `document = "${id}"`).join(" || ")
      : `id = "none"`;
    const results = await pb.collection("review_results").getFullList({
      filter: driftDocFilter,
      fields: "id,clauseCategory,ragStatus",
    }).catch(() => [] as PBRecord[]);
    const driftResultIds = results.map((r) => r.id);
    const driftResultFilter = driftResultIds.length > 0
      ? driftResultIds.map((id) => `result = "${id}"`).join(" || ")
      : `id = "none"`;
    const feedbacks = await pb.collection("user_feedback").getFullList({
      filter: driftResultFilter,
      fields: "result,userAction",
    }).catch(() => [] as PBRecord[]);

    const fbMap = new Map<string, string>();
    for (const f of feedbacks) fbMap.set(f["result"] as string, f["userAction"] as string);

    // Per-category drift analysis
    const catDrift: Record<string, { totalRed: number; acceptedRed: number }> = {};
    for (const r of results) {
      const cat = r["clauseCategory"] as string;
      if (!catDrift[cat]) catDrift[cat] = { totalRed: 0, acceptedRed: 0 };
      if (r["ragStatus"] === "RED") {
        catDrift[cat].totalRed++;
        if (fbMap.get(r.id) === "ACCEPTED") catDrift[cat].acceptedRed++;
      }
    }

    // Only suggest for clauses with meaningful drift (>= 2 red accepted OR >= 50% of reds accepted with >= 2 total)
    const driftCats = Object.entries(catDrift)
      .filter(([, d]) => d.totalRed >= 2 && d.acceptedRed >= 1 && d.acceptedRed / d.totalRed >= 0.4)
      .map(([cat, d]) => ({ cat, ...d, driftPct: Math.round((d.acceptedRed / d.totalRed) * 100) }))
      .sort((a, b) => b.driftPct - a.driftPct)
      .slice(0, 4);

    if (driftCats.length === 0) { res.json({ suggestions: [] }); return; }

    // Generate LLM-based suggestions for each drifting category
    const suggestions = await Promise.all(driftCats.map(async (dc) => {
      const rule = rules.find((r) => r["clauseCategory"] === dc.cat);
      const currentPosition = rule?.["preferredPosition"] as string | undefined;
      const currentRedLine  = rule?.["hardRedLine"] as string | undefined;

      const prompt = `You are a senior commercial lawyer reviewing a legal team's playbook.

Context: This team has accepted ${dc.acceptedRed} out of ${dc.totalRed} contracts where their "${dc.cat.replace(/_/g, " ")}" clause was flagged RED - a ${dc.driftPct}% acceptance rate below their red line.

Current playbook positions:
- Preferred position: ${currentPosition ?? "Not set"}
- Hard red line: ${currentRedLine ?? "Not set"}

Generate an updated playbook suggestion that is more realistic given the team's actual negotiation behaviour.
Return ONLY valid JSON (no markdown):
{
  "reasoning": "Brief explanation of why the current position appears unrealistic (2-3 sentences)",
  "updatedPreferredPosition": "...",
  "updatedRedLine": "...",
  "recommendation": "Either tighten enforcement of the current red line, or accept the drift and update positions"
}`;

      try {
        const raw = await chatComplete([{ role: "user", content: prompt }], 500);
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) return null;
        const parsed = JSON.parse(match[0]) as {
          reasoning: string;
          updatedPreferredPosition: string;
          updatedRedLine: string;
          recommendation: string;
        };
        return {
          clauseCategory: dc.cat,
          ruleId: rule?.id ?? null,
          driftPct: dc.driftPct,
          totalRed: dc.totalRed,
          acceptedRed: dc.acceptedRed,
          ...parsed,
        };
      } catch {
        return null;
      }
    }));

    res.json({ suggestions: suggestions.filter(Boolean) });
  }));

  app.post("/api/playbook/generate-suggestion", requireAuth, ah(async (req: Request, res: Response) => {
    const { clauseCategory, workflowType } = req.body as { clauseCategory?: string; workflowType?: string };
    if (!clauseCategory) { res.status(400).json({ error: "clauseCategory required" }); return; }

    const prompt = `You are a senior commercial lawyer. Generate a concise but precise playbook position for the "${clauseCategory.replace(/_/g, " ")}" clause type.
Workflow context: ${workflowType ?? "COMMERCIAL_CONTRACT"}.

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "preferredPosition": "...",
  "acceptableFallback": "...",
  "hardRedLine": "..."
}

Each field should be 1-3 sentences of clear, practical legal language.
- preferredPosition: what the company ideally wants
- acceptableFallback: what the company can accept after negotiation
- hardRedLine: what the company will never accept (deal-breaker)`;

    const raw = await chatComplete([{ role: "user", content: prompt }], 600);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) { res.status(500).json({ error: "Could not parse LLM response" }); return; }
    const result = JSON.parse(match[0]) as { preferredPosition: string; acceptableFallback: string; hardRedLine: string };
    res.json(result);
  }));

  // ── Counterparty intelligence ────────────────────────────────────────────────

  app.get("/api/playbook/counterparty-intelligence", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json({ intelligence: {} }); return; }

    // Counterparty names come from the documents the data points reference
    const docs = await pb.collection("uploaded_documents").getFullList({
      filter: `company = "${company.id}"`,
      fields: "id,counterpartyName",
    }).catch(() => [] as PBRecord[]);

    if (docs.length === 0) { res.json({ intelligence: {} }); return; }

    const docMap = new Map<string, string>();
    for (const d of docs) docMap.set(d.id, ((d["counterpartyName"] as string) || "").trim());

    // Data sources: logged outcomes (signed final versions compared against the
    // original review) + structured decision events (every human judgment).
    const [deltas, decisions] = await Promise.all([
      pb.collection("outcome_deltas").getFullList({
        filter: `company = "${company.id}"`,
        fields: "document,clauseCategory,llmOutcome,confirmedOutcome",
      }).catch(() => [] as PBRecord[]),
      pb.collection("decision_events").getFullList({
        filter: `company = "${company.id}"`,
        fields: "contract,clause_category,human_action",
      }).catch(() => [] as PBRecord[]),
    ]);

    const OUTCOME_LABELS: Record<string, string> = {
      PREFERRED:      "accepted our preferred position",
      FALLBACK:       "settled at our fallback position",
      BELOW_FALLBACK: "pushed below our fallback",
      NO_CHANGE:      "left the clause unchanged",
      REMOVED:        "removed the clause entirely",
    };
    const ACTION_LABELS: Record<string, string> = {
      accepted:   "accepted Zane's recommendation",
      modified:   "negotiated amended language",
      overridden: "required a position override",
      ignored:    "flag dismissed without change",
    };

    // clauseCategory → counterpartyName → aggregate
    interface CpAgg {
      docs: Set<string>;
      acceptedDocs: Set<string>;
      pushedBackDocs: Set<string>;
      counters: Map<string, number>;
      dataPoints: number;
    }
    const tree: Record<string, Record<string, CpAgg>> = {};
    const bump = (cat: string, docId: string): CpAgg | null => {
      const cp = docMap.get(docId) ?? "";
      if (!cp || cp.toLowerCase() === "unknown") return null;
      tree[cat] ??= {};
      const agg = (tree[cat][cp] ??= {
        docs: new Set(), acceptedDocs: new Set(), pushedBackDocs: new Set(),
        counters: new Map(), dataPoints: 0,
      });
      agg.docs.add(docId);
      agg.dataPoints++;
      return agg;
    };

    for (const d of deltas) {
      const cat = (d["clauseCategory"] as string) || "";
      const docId = (d["document"] as string) || "";
      if (!cat || !docId) continue;
      const agg = bump(cat, docId);
      if (!agg) continue;
      // A human-confirmed outcome takes precedence over the LLM-inferred one
      const outcome = (((d["confirmedOutcome"] as string) || (d["llmOutcome"] as string)) ?? "").toUpperCase();
      if (outcome === "PREFERRED") agg.acceptedDocs.add(docId);
      else if (outcome === "FALLBACK" || outcome === "BELOW_FALLBACK" || outcome === "REMOVED") agg.pushedBackDocs.add(docId);
      const label = OUTCOME_LABELS[outcome];
      if (label) agg.counters.set(label, (agg.counters.get(label) ?? 0) + 1);
    }

    for (const e of decisions) {
      const cat = (e["clause_category"] as string) || "";
      const docId = (e["contract"] as string) || "";
      if (!cat || !docId) continue;
      const agg = bump(cat, docId);
      if (!agg) continue;
      const action = (e["human_action"] as string) || "";
      if (action === "accepted") agg.acceptedDocs.add(docId);
      else if (action === "overridden" || action === "modified") agg.pushedBackDocs.add(docId);
      const label = ACTION_LABELS[action];
      if (label) agg.counters.set(label, (agg.counters.get(label) ?? 0) + 1);
    }

    const intelligence: Record<string, Array<{ counterpartyName: string; total: number; accepted: number; pushedBack: number; typicalOutcome: string }>> = {};

    for (const [cat, cpData] of Object.entries(tree)) {
      const entries = [];
      for (const [cp, agg] of Object.entries(cpData)) {
        if (agg.dataPoints < 2) continue; // only counterparties with 2+ data points
        // Typical counter = the most common logged outcome for this pairing
        let typicalOutcome = "";
        let maxCount = 0;
        agg.counters.forEach((count, label) => {
          if (count > maxCount) { maxCount = count; typicalOutcome = label; }
        });
        if (!typicalOutcome) {
          typicalOutcome = agg.acceptedDocs.size >= agg.pushedBackDocs.size
            ? "accepted our preferred position"
            : "negotiated amended language";
        }
        entries.push({
          counterpartyName: cp,
          total: agg.docs.size,
          accepted: agg.acceptedDocs.size,
          pushedBack: agg.pushedBackDocs.size,
          typicalOutcome,
        });
      }
      if (entries.length > 0) {
        intelligence[cat] = entries.sort((a, b) => b.total - a.total);
      }
    }

    // Section 3c: per-counterparty negotiation profiles built from captured
    // negotiation_events (email-thread moves). Surfaced alongside the per-clause
    // intelligence on the playbook's counterparty section.
    const counterpartyNames = Array.from(new Set(
      Array.from(docMap.values()).map((n) => n.trim()).filter((n) => n && n.toLowerCase() !== "unknown"),
    ));
    const profiles: Record<string, Awaited<ReturnType<typeof buildCounterpartyProfile>>> = {};
    await Promise.all(counterpartyNames.map(async (name) => {
      const profile = await buildCounterpartyProfile(company.id as string, name).catch(() => null);
      if (profile) profiles[name] = profile;
    }));

    res.json({ intelligence, profiles });
  }));

  // Section 3c: the negotiation profile for a single contract's counterparty,
  // surfaced on the contract review page.
  app.get("/api/contracts/:id/counterparty-profile", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json({ profile: null }); return; }
    const doc = await pb.collection("uploaded_documents").getOne(req.params.id).catch(() => null);
    if (!doc || (doc["company"] as string) !== company.id) { res.json({ profile: null }); return; }
    const counterparty = String(doc["counterpartyName"] ?? "").trim();
    if (!counterparty) { res.json({ profile: null }); return; }
    const profile = await buildCounterpartyProfile(company.id as string, counterparty).catch(() => null);
    res.json({ profile });
  }));

  // Reasoning capture, Section 4: the per-counterparty judgment memory for this
  // contract's counterparty (the unusual positions previously accepted and why),
  // surfaced at the top of the review when the counterparty is already known.
  app.get("/api/contracts/:id/counterparty-judgment", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json({ judgment: null }); return; }
    const doc = await pb.collection("uploaded_documents").getOne(req.params.id).catch(() => null);
    if (!doc || (doc["company"] as string) !== company.id) { res.json({ judgment: null }); return; }
    const counterparty = String(doc["counterpartyName"] ?? "").trim();
    if (!counterparty) { res.json({ judgment: null }); return; }
    const judgment = await buildCounterpartyJudgmentMemory(company.id as string, counterparty).catch(() => null);
    res.json({ judgment });
  }));

  // Section 3: consolidated per-vendor intelligence, everything Zane knows about
  // one counterparty: their documents, negotiation profile, captured decision
  // reasoning, and worth-considering notes. Reuses existing data only.
  app.get("/api/counterparty/vendor-intelligence", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    const name = String(req.query.name ?? "").trim();
    if (!company || !name) {
      res.json({ counterparty: name, documents: [], profile: null, decisions: [], notes: [] });
      return;
    }

    const docs = await pb.collection("uploaded_documents").getFullList({
      filter: `company = "${company.id}" && counterpartyName = "${name.replace(/"/g, "")}"`,
      sort: "-created",
    }).catch(() => [] as PBRecord[]);
    const documents = docs.map((d) => ({
      id: d.id as string,
      originalName: (d["originalName"] as string) ?? "",
      contractType: (d["contractType"] as string) ?? "",
      status: (d["status"] as string) ?? "",
      outcome: (d["outcome"] as string) ?? "",
      contractValue: (d["contractValue"] as number) ?? null,
      currency: (d["currency"] as string) ?? "",
      uploadedAt: d["created"] as string,
    }));
    const docNames = new Map<string, string>(docs.map((d) => [d.id as string, (d["originalName"] as string) ?? ""]));
    const docIds = new Set(docs.map((d) => d.id as string));

    const profile = await buildCounterpartyProfile(company.id as string, name).catch(() => null);

    // Significant decisions + captured reasoning, scoped to this vendor's contracts.
    const allDecisions = await pb.collection("decision_events").getFullList({
      filter: `company = "${company.id}"`, sort: "-created",
    }).catch(() => [] as PBRecord[]);
    const decisions = allDecisions
      .filter((e) => docIds.has(String(e["contract"] ?? "")))
      .map((e) => ({
        clauseCategory: (e["clause_category"] as string) ?? "",
        humanAction: (e["human_action"] as string) ?? "",
        finalPosition: (e["human_final_position"] as string) ?? "",
        reason: (e["override_reason"] as string) ?? "",
        zaneRecommendation: (e["zane_recommendation"] as string) ?? "",
        contractName: docNames.get(String(e["contract"] ?? "")) ?? "",
        created: e["created"] as string,
      }));

    res.json({ counterparty: name, documents, profile, decisions, notes: profileDraftToConfirm(profile) });
  }));

  // ── New hire briefing ────────────────────────────────────────────────────────

  app.post("/api/playbook/briefing", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 404, "No company configured"); return; }

    const [playbookRules, docs, recentEscalations] = await Promise.all([
      pb.collection("playbook_rules").getFullList({
        filter: `company = "${company.id}"`,
        fields: "clauseCategory,preferredPosition,acceptableFallback,hardRedLine",
      }).catch(() => [] as PBRecord[]),
      pb.collection("uploaded_documents").getFullList({
        filter: `company = "${company.id}"`,
        fields: "id,counterpartyName",
        sort: "-created",
      }).catch(() => [] as PBRecord[]),
      (async () => {
        const allDocs = await pb.collection("uploaded_documents").getFullList({
          filter: `company = "${company.id}"`,
          fields: "id",
        }).catch(() => [] as PBRecord[]);
        if (allDocs.length === 0) return [] as PBRecord[];
        const docFilter = allDocs.map((d) => `document = "${d.id}"`).join(" || ");
        return pb.collection("review_results").getFullList({
          filter: `(${docFilter}) && escalationRequired = true`,
          fields: "clauseCategory,clauseSummary,ragStatus",
          sort: "-created",
          batch: 10,
        }).catch(() => [] as PBRecord[]);
      })(),
    ]);

    // Get feedback data for outcome summary
    let outcomeSummary = "No outcome data yet.";
    if (docs.length > 0) {
      const docFilter = docs.map((d) => `document = "${d.id}"`).join(" || ");
      const allResults = await pb.collection("review_results").getFullList({
        filter: docFilter,
        fields: "id,clauseCategory,ragStatus",
      }).catch(() => [] as PBRecord[]);

      if (allResults.length > 0) {
        const resultFilter = allResults.map((r) => `result = "${r.id}"`).join(" || ");
        const feedbacks = await pb.collection("user_feedback").getFullList({
          filter: resultFilter,
          fields: "result,userAction",
        }).catch(() => [] as PBRecord[]);

        const fbMap = new Map<string, string>();
        for (const f of feedbacks) fbMap.set(f["result"] as string, f["userAction"] as string);

        const catStats: Record<string, { total: number; accepted: number; escalated: number }> = {};
        for (const r of allResults) {
          const cat = r["clauseCategory"] as string;
          if (!catStats[cat]) catStats[cat] = { total: 0, accepted: 0, escalated: 0 };
          catStats[cat].total++;
          const action = fbMap.get(r.id);
          if (action === "ACCEPTED") catStats[cat].accepted++;
          if (action === "ESCALATED") catStats[cat].escalated++;
        }

        outcomeSummary = Object.entries(catStats)
          .map(([cat, s]) => `${cat.replace(/_/g, " ")}: ${s.total} reviewed, ${s.accepted} accepted, ${s.escalated} escalated`)
          .join("\n");
      }
    }

    const playbookClauses = playbookRules
      .map((r) => `${(r["clauseCategory"] as string).replace(/_/g, " ")}: preferred="${r["preferredPosition"] as string}" | fallback="${r["acceptableFallback"] as string}" | red line="${r["hardRedLine"] as string}"`)
      .join("\n");

    // Top 3 most active counterparties
    const cpCounts: Record<string, number> = {};
    for (const d of docs) {
      const cp = (d["counterpartyName"] as string) || "Unknown";
      if (cp !== "Unknown") cpCounts[cp] = (cpCounts[cp] ?? 0) + 1;
    }
    const topCounterparties = Object.entries(cpCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => `${name} (${count} contract${count !== 1 ? "s" : ""})`)
      .join(", ");
    const counterpartySummary = topCounterparties || "No counterparty data yet.";

    const escalationSummary = recentEscalations.length > 0
      ? recentEscalations.slice(0, 10).map((r) => `${(r["clauseCategory"] as string).replace(/_/g, " ")}: ${r["clauseSummary"] as string ?? "No summary"}`).join("\n")
      : "No escalations recorded yet.";

    const prompt = `Generate a new hire legal briefing document for a lawyer joining this company. Use the following data:
Playbook positions: ${playbookClauses}
Outcome history: ${outcomeSummary}
Counterparty intelligence: ${counterpartySummary}
Recent escalations: ${escalationSummary}
The document should explain: 1. The company's key legal positions in plain English 2. Where the company typically negotiates and where it holds firm 3. The most important counterparty patterns to know 4. The most significant decisions made recently and why
Write as a professional onboarding document. No legal jargon. Practical and readable.`;

    const briefing = await chatComplete([{ role: "user", content: prompt }], 1200);
    res.json({ briefing: briefing.trim() });
  }));

  // ── Approval Contacts ────────────────────────────────────────────────────────

  app.post("/api/company/contacts", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 404, "No company configured"); return; }

    const body = req.body as { contacts?: unknown[] };
    if (!Array.isArray(body.contacts)) { sendError(res, 400, "contacts must be an array"); return; }

    const parsed = z.array(approvalContactSchema).safeParse(body.contacts);
    if (!parsed.success) { sendError(res, 400, parsed.error.message); return; }

    const existing = await pb.collection("approval_contacts").getFullList({
      filter: `company = "${company.id}"`,
      fields: "id",
    });
    await Promise.all(existing.map((c) => pb.collection("approval_contacts").delete(c.id)));

    const created = await Promise.all(
      parsed.data.map((c) => pb.collection("approval_contacts").create({ ...c, company: company.id }))
    );
    res.json(created.map(mapContact));
  }));

  // ── Documents ────────────────────────────────────────────────────────────────

  app.post(
    "/api/documents/upload",
    requireAuth,
    // Wrap multer so file-type/size rejections return JSON (not HTML Express error page)
    (req: Request, res: Response, next: NextFunction) => {
      upload.single("contract")(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") return sendError(res, 413, "This file exceeds the 50MB limit. Very large documents like litigation bundles can be split into sections before uploading. Contact support if you need help with this.");
          return sendError(res, 400, `Upload error: ${err.message}`);
        }
        if (err) {
          // The fileFilter rejects unsupported types with this exact message. Any
          // other error here is a server-side failure (e.g. the uploads directory
          // could not be written), not a bad file, so report it honestly instead
          // of blaming the file type.
          const m = (err as Error).message || "";
          if (/PDF and DOCX/i.test(m)) return sendError(res, 415, "Only PDF and DOCX files are supported.");
          console.error("[upload] storage/other error (not a file-type rejection):", m);
          return sendError(res, 500, "The file could not be saved on the server. Please try again, and contact ahmed@zanelegal.ai if it keeps happening.");
        }
        next();
      });
    },
    ah(async (req: Request, res: Response) => {
      // Document-first flow: accept uploads even before onboarding is complete.
      // The document will be associated with the company via POST /api/quick-setup.
      const company = await getCompany(req.user?.email);

      const file = req.file;
      if (!file) { sendError(res, 400, "No file uploaded"); return; }

      // ── Monthly review limit check ────────────────────────────────────────────
      if (company) {
        const tier = resolveTier(company["subscription_tier"]);
        const flags = getFeatureFlags(tier);
        if (flags.maxMonthlyReviews > 0) {
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          const monthDocs = await pb.collection("uploaded_documents").getFullList({
            filter: `company = "${company.id}" && created >= "${monthStart}"`,
            fields: "id",
          }).catch(() => [] as { id: string }[]);
          if (monthDocs.length >= flags.maxMonthlyReviews) {
            try { fs.unlinkSync(file.path); } catch { /* ignore */ }
            const tierLabel = tier === "starter" ? "Team" : "Growth";
            sendError(res, 402, `You have used ${monthDocs.length} of ${flags.maxMonthlyReviews} reviews this month. Upgrade to ${tierLabel} for unlimited reviews.`);
            return;
          }
        }
      }
      // ─────────────────────────────────────────────────────────────────────────

      // File size check (50MB max)
      const MAX_SIZE_BYTES = 50 * 1024 * 1024;
      if (file.size > MAX_SIZE_BYTES) {
        try { fs.unlinkSync(file.path); } catch { /* ignore cleanup errors */ }
        sendError(res, 413, "This file exceeds the 50MB limit. Very large documents like litigation bundles can be split into sections before uploading. Contact support if you need help with this.");
        return;
      }

      // File type check
      const allowedMimes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"];
      const allowedExts = [".pdf", ".docx", ".doc"];
      const uploadExt = path.extname(file.originalname).toLowerCase();
      // Use && so files with a valid extension but an unexpected MIME type
      // (e.g. application/octet-stream when dragging a PDF from the desktop)
      // are still accepted.  Reject only when BOTH extension and MIME are wrong.
      if (!allowedExts.includes(uploadExt) && !allowedMimes.includes(file.mimetype)) {
        try { fs.unlinkSync(file.path); } catch { /* ignore cleanup errors */ }
        sendError(res, 415, "Only PDF and DOCX files are supported.");
        return;
      }

      const body = req.body as Record<string, string>;
      const contractValue = body.contractValue ? parseFloat(body.contractValue) : null;
      const contractTermMonths = body.contractTermMonths ? parseInt(body.contractTermMonths) : null;
      const autoRenewal = body.autoRenewal === "true";
      const noticePeriodDays = body.noticePeriodDays ? parseInt(body.noticePeriodDays) : null;
      const renewalDate = body.renewalDate || null; // ISO date string or null

      const doc = await pb.collection("uploaded_documents").create({
        // company is omitted for document-first uploads (pre-onboarding).
        // The relation field is non-required and will be associated later via /api/quick-setup.
        ...(company ? { company: company.id } : {}),
        filename: file.filename,
        originalName: file.originalname,
        contractType: body.contractType ?? "SUPPLIER_AGREEMENT",
        status: "UPLOADED",
        counterpartyName: body.counterpartyName ?? "",
        counterpartyType: body.counterpartyType ?? "",
        reviewType: body.reviewType ?? "INBOUND",
        governingLaw: body.governingLaw ?? "",
        jurisdiction: body.jurisdiction ?? "",
        contractValue,
        currency: body.currency ?? "GBP",
        contractTermMonths,
        autoRenewal,
        noticePeriodDays,
        renewalDate,
        contractTags: body.contractTags ?? "",
      });

      // Fire-and-forget: audit must never block the upload response
      void audit({
        action: "contract_uploaded",
        entityType: "uploaded_document",
        entityId: doc.id,
        companyId: company?.id,
        userId: req.user?.userId,
        ipAddress: req.ip,
        detail: { contractType: doc["contractType"], originalName: doc["originalName"], contractValue },
      });

      console.log(`[upload] Document created: ${doc.id} (${doc["originalName"] as string}) for company ${company?.id ?? "(pre-onboarding)"}`);
      res.json(mapDoc(doc));
    })
  );

  // ── Document-first: extract metadata via LLM ──────────────────────────────
  // Used immediately after upload to pre-fill the minimal onboarding modal.
  app.post("/api/documents/:id/extract-metadata", requireAuth, ah(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };

    let doc: Record<string, unknown>;
    try {
      doc = await pb.collection("uploaded_documents").getOne(id);
    } catch {
      sendError(res, 404, "Document not found"); return;
    }

    const filePath = path.join(process.cwd(), "uploads", doc["filename"] as string);
    if (!fs.existsSync(filePath)) { sendError(res, 404, "File not found on disk"); return; }

    // Parse the document to get raw text
    let rawText = "";
    try {
      const parsed = await parseDocument(filePath);
      // Use first 8000 chars, covering parties section, definitions, and opening recitals
      // even in contracts with long preambles before the substantive clauses
      rawText = parsed.text.slice(0, 8000);
    } catch {
      // Return empty extraction rather than erroring. The modal can still work.
      res.json({});
      return;
    }

    if (!rawText.trim()) { res.json({}); return; }

    // LLM extraction: best-effort, swallow any failure
    const { chatComplete } = await import("./services/openrouter.js");
    try {
      const response = await chatComplete([{
        role: "user",
        content: `Extract the following information from this contract if present. Return valid JSON only. No preamble. No markdown.

{
  "contract_type": "one of: SUPPLIER_AGREEMENT | CUSTOMER_AGREEMENT | MSA | NDA | SaaS_AGREEMENT | PROFESSIONAL_SERVICES | EMPLOYMENT | CONTRACTOR_AGREEMENT | IP_LICENSE_AGREEMENT | JV_AGREEMENT | SHARE_PURCHASE | COMMERCIAL_LEASE | LOAN_AGREEMENT | DISTRIBUTION_AGREEMENT | OTHER, or null",
  "counterparty_name": "full legal name of the counterparty company or individual. Look in: (1) the opening 'between X and Y' parties clause, (2) the definitions section where 'Supplier', 'Service Provider', 'Vendor', 'Customer', or 'Client' is defined, (3) the agreement title or header, (4) the signature block. Return the full legal entity name (e.g. 'Attio Limited' not just 'Attio'). Return null only if genuinely not identifiable.",
  "governing_law": "full jurisdiction name (e.g. England and Wales, New York, Singapore), or null",
  "contract_value": contract value as a plain number (no currency symbol) or null,
  "currency": "ISO currency code (GBP/USD/EUR/SGD etc.) or null",
  "renewal_date": "ISO date string YYYY-MM-DD or null",
  "auto_renewal": true or false or null,
  "contract_term_months": integer number of months or null
}

Contract text:
${rawText}`,
      }], 512);

      const match = response.match(/\{[\s\S]*?\}/);
      if (!match) { res.json({}); return; }

      const extracted = JSON.parse(match[0]) as Record<string, unknown>;
      res.json(extracted);
    } catch {
      res.json({}); // best-effort: never block the UX
    }
  }));

  // ── Document-first: quick company setup ───────────────────────────────────
  // Creates a company from minimal fields, saves market-standard playbook rules,
  // associates a pending document, and optionally fires the review pipeline.
  app.post("/api/quick-setup", requireAuth, ah(async (req: Request, res: Response) => {
    const body = req.body as {
      companyName?: string;
      sector?: string;
      riskAppetite?: string;
      persona?: string;
      pendingDocumentId?: string;
      startReview?: boolean;
    };

    const companyName  = (body.companyName ?? "My Company").trim();
    const sector       = (body.sector ?? "General").trim();
    const riskAppetite = body.riskAppetite ?? "MODERATE";
    const persona      = body.persona ?? "CORPORATE";

    // Single-company mode: collect old companies BEFORE creating the new one,
    // but delete them AFTER the new company and document association are in place.
    // This prevents any cascade-delete from removing the pending document.
    const existingCompanies = await pb.collection("companies").getFullList();

    const company = await pb.collection("companies").create({
      name: companyName,
      sector,
      riskAppetite,
      jurisdiction: "England & Wales",
      role: "BUYER",
      persona,
      workflowType: "COMMERCIAL_CONTRACT",
    });

    // Associate the pending document with the new company BEFORE deleting old companies
    // so that any cascade-delete on old companies cannot remove the document.
    let docId: string | null = null;
    if (body.pendingDocumentId) {
      try {
        await pb.collection("uploaded_documents").update(body.pendingDocumentId, {
          company: company.id,
        });
        docId = body.pendingDocumentId;
        console.log(`[quick-setup] document ${docId} associated with company ${company.id}`);
      } catch (e) {
        console.warn("[quick-setup] doc association failed:", e);
      }
    }

    // Save market-standard playbook rules. Must complete before we respond so
    // that POST /api/review/:id doesn't hit the "no rules" 422 guard immediately.
    const ruleCreates = MARKET_STANDARD_PLAYBOOK.map((entry) =>
      pb.collection("playbook_rules").create({
        company: company.id,
        clauseCategory: entry.clauseCategory,
        workflowType: "COMMERCIAL_CONTRACT",
        preferredPosition: entry.preferredPosition,
        acceptableFallback: entry.acceptableFallback,
        hardRedLine: entry.hardRedLine,
        riskWeight: entry.riskWeight,
      }).catch((e: unknown) => console.warn("[quick-setup] rule create failed:", e))
    );
    await Promise.all(ruleCreates);

    // NOW delete old companies. Document is already safe under the new company.
    await Promise.allSettled(existingCompanies.map((c) => pb.collection("companies").delete(c.id)));

    // Kick off regulatory detection in the background (rules already saved above)
    void detectAndSaveRegulations(company.id).catch(console.error);

    await audit({
      action: "company_created",
      entityType: "company",
      entityId: company.id,
      userId: req.user?.userId,
      detail: { name: company["name"], sector, persona, source: "document_first" },
    });

    res.json({ company: mapCompany(company), documentId: docId });
  }));

  app.get("/api/documents", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json([]); return; }

    const { search, ragStatus, contractType: typeFilter } = req.query as Record<string, string>;

    // Fetch documents first so we can filter review_results by document ID,
    // then user_feedback by result ID, avoiding chained relation filters like
    // document.company which are unreliable across PocketBase versions.
    const docs = await pb.collection("uploaded_documents").getFullList({
      filter: `company = "${company.id}"`,
      sort: "-id",
    }).catch((err: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pbErr = err as any;
      console.error("[GET /api/documents] uploaded_documents query failed:", pbErr?.message, "status:", pbErr?.status, "data:", JSON.stringify(pbErr?.response ?? pbErr?.data));
      throw err; // re-throw so the route returns 500 with a useful log
    });

    const docIds = docs.map((d) => d.id);
    const docIdFilter = docIds.length > 0
      ? docIds.map((id) => `document = "${id}"`).join(" || ")
      : `id = "none"`; // no documents → no results

    const allResults: PBRecord[] = await pb.collection("review_results").getFullList({
      filter: docIdFilter,
      fields: "id,document,ragStatus,escalationRequired",
    }).catch(() => [] as PBRecord[]);

    const resultIds = allResults.map((r) => r.id);
    const resultIdFilter = resultIds.length > 0
      ? resultIds.map((id) => `result = "${id}"`).join(" || ")
      : `id = "none"`;

    const allFeedbacks: PBRecord[] = await pb.collection("user_feedback").getFullList({
      filter: resultIdFilter,
      fields: "id,result,userAction",
    }).catch(() => [] as PBRecord[]);

    // Build feedback lookup by result ID
    const feedbackByResult = new Map<string, { userAction: string }>();
    for (const f of allFeedbacks) {
      feedbackByResult.set(f["result"] as string, { userAction: f["userAction"] as string });
    }

    // Group results by documentId (including escalation + feedback)
    const resultsByDoc = new Map<string, { ragStatus: string; escalationRequired: boolean; feedback?: { userAction: string } }[]>();
    for (const r of allResults) {
      const arr = resultsByDoc.get(r["document"] as string) ?? [];
      arr.push({
        ragStatus: r["ragStatus"] as string,
        escalationRequired: !!(r["escalationRequired"] as boolean),
        feedback: feedbackByResult.get(r.id),
      });
      resultsByDoc.set(r["document"] as string, arr);
    }

    let mapped: PBRecord[] = docs.map((doc) => ({
      ...mapDoc(doc),
      reviewResults: resultsByDoc.get(doc.id) ?? [],
    }));

    // Apply remaining filters in JS
    if (typeFilter) mapped = mapped.filter((d) => d["contractType"] === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      mapped = mapped.filter((d) => (d["counterpartyName"] as string)?.toLowerCase().includes(q));
    }
    if (ragStatus) {
      mapped = mapped.filter((d) =>
        (d["reviewResults"] as { ragStatus: string }[]).some((r) => r.ragStatus === ragStatus)
      );
    }

    res.json(mapped);
  }));

  app.get("/api/documents/stats", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) {
      res.json({ totalContracts: 0, totalValue: 0, redContracts: 0, renewalsDue: 0, reviewedThisMonth: 0 });
      return;
    }

    const docs = await pb.collection("uploaded_documents").getFullList({
      filter: `company = "${company.id}"`,
    });
    const statsDocFilter = docs.length > 0
      ? docs.map((d) => `document = "${d.id}"`).join(" || ")
      : `id = "none"`;
    const allResults = await pb.collection("review_results").getFullList({
      filter: statsDocFilter,
      fields: "document,ragStatus",
    }).catch(() => [] as PBRecord[]);

    const resultsByDoc = new Map<string, { ragStatus: string }[]>();
    for (const r of allResults) {
      const arr = resultsByDoc.get(r["document"] as string) ?? [];
      arr.push({ ragStatus: r["ragStatus"] as string });
      resultsByDoc.set(r["document"] as string, arr);
    }

    const totalContracts = docs.length;
    const totalValue = docs.reduce((sum, d) => sum + ((d["contractValue"] as number) ?? 0), 0);
    const redContracts = docs.filter((d) =>
      (resultsByDoc.get(d.id) ?? []).some((r) => r.ragStatus === "RED")
    ).length;

    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const renewalsDue = docs.filter((d) => {
      if (!d["renewalDate"]) return false;
      const rd = new Date(d["renewalDate"] as string);
      return rd >= now && rd <= in90;
    }).length;

    // Same definition as the monthly report export (client/src/lib/monthlyReport.ts):
    // completed reviews uploaded in the current calendar month.
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const reviewedThisMonth = docs.filter((d) => {
      if (d["status"] !== "COMPLETE") return false;
      const at = new Date(d["created"] as string);
      return !isNaN(at.getTime()) && at >= monthStart && at <= now;
    }).length;

    res.json({ totalContracts, totalValue, redContracts, renewalsDue, reviewedThisMonth });
  }));

  // ── Missing document check ────────────────────────────────────────────────────
  // MUST be registered before GET /api/documents/:id or Express routes "missing" as id="missing"

  app.get("/api/documents/missing", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json({ missing: [] }); return; }

    const docs = await pb.collection("uploaded_documents").getFullList({
      filter: `company = "${company.id}"`,
      fields: "contractType,status",
    });

    const persona   = (company["persona"] as string) ?? "CORPORATE";
    const workflow  = (company["workflowType"] as string) ?? "COMMERCIAL_CONTRACT";
    const uploaded  = new Set(docs.map((d) => d["contractType"] as string));

    const recommendations: { contractType: string; label: string; reason: string; priority: "high" | "medium" }[] = [];

    if (persona === "FOUNDER") {
      if (!uploaded.has("SHA") && !uploaded.has("SUBSCRIPTION_AGREEMENT")) {
        recommendations.push({ contractType: "SHA", label: "Shareholders' Agreement", reason: "Every funded company needs a SHA to govern investor rights, board seats, and exit mechanics.", priority: "high" });
      }
      if (!uploaded.has("TERM_SHEET")) {
        recommendations.push({ contractType: "TERM_SHEET", label: "Term Sheet", reason: "If you're fundraising, review your term sheet before signing - it sets the economic terms.", priority: "high" });
      }
      if (!uploaded.has("NDA")) {
        recommendations.push({ contractType: "NDA", label: "NDA / Confidentiality Agreement", reason: "Share sensitive information with investors and partners under a signed NDA.", priority: "medium" });
      }
      if (!uploaded.has("EMPLOYMENT") && !uploaded.has("CONTRACTOR_AGREEMENT")) {
        recommendations.push({ contractType: "EMPLOYMENT", label: "Founder / Employee Agreements", reason: "IP assignment and vesting need to be in writing before you hire or take investment.", priority: "high" });
      }
    } else if (workflow === "COMMERCIAL_CONTRACT") {
      if (!uploaded.has("NDA") && !uploaded.has("CONFIDENTIALITY_AGREEMENT")) {
        recommendations.push({ contractType: "NDA", label: "NDA", reason: "Protect confidential information before starting commercial conversations.", priority: "medium" });
      }
      if (!uploaded.has("DPA")) {
        recommendations.push({ contractType: "DPA", label: "Data Processing Agreement", reason: "Required under UK GDPR if any supplier handles personal data on your behalf.", priority: "high" });
      }
      if (!uploaded.has("MSA") && !uploaded.has("SUPPLIER_AGREEMENT")) {
        recommendations.push({ contractType: "SUPPLIER_AGREEMENT", label: "Supplier / Master Services Agreement", reason: "A framework MSA avoids re-negotiating terms on every order.", priority: "medium" });
      }
    }

    res.json({ missing: recommendations });
  }));

  app.get("/api/documents/:id", requireAuth, ah(async (req: Request, res: Response) => {
    let doc: PBRecord;
    try {
      doc = await pb.collection("uploaded_documents").getOne(req.params.id);
    } catch {
      sendError(res, 404, "Document not found"); return;
    }

    // Tenant guard: ensure document belongs to the active company
    const ownerCompany = await getCompany(req.user?.email);
    if (ownerCompany && (doc["company"] as string) !== ownerCompany.id) {
      sendError(res, 403, "Forbidden"); return;
    }

    const results = await pb.collection("review_results").getFullList({
      filter: `document = "${req.params.id}"`,
    });

    const feedbackMap = new Map<string, PBRecord>();
    if (results.length > 0) {
      const feedbacks = await pb.collection("user_feedback").getFullList({
        filter: `result.document = "${req.params.id}"`,
      });
      for (const f of feedbacks) feedbackMap.set(f["result"] as string, mapFeedback(f));
    }

    const reviewResults = results.map((r) => ({
      ...mapResult(r),
      feedback: feedbackMap.get(r.id) ?? null,
    }));

    res.json({ ...mapDoc(doc), reviewResults });
  }));

  // ── Contract deletion ────────────────────────────────────────────────────────

  /** Cascade-delete one document and all records that reference it. */
  async function cascadeDeleteDocument(documentId: string, userId?: string): Promise<void> {
    let doc: PBRecord;
    try {
      doc = await pb.collection("uploaded_documents").getOne(documentId);
    } catch {
      return; // Already gone. Treat as success.
    }

    // Collect all review result IDs first (needed to delete signals linked to results)
    const results = await pb.collection("review_results").getFullList({
      filter: `document = "${documentId}"`,
      fields: "id",
    }).catch(() => [] as PBRecord[]);

    const resultIds = results.map((r) => r.id as string);

    // Parallel cascade: all child collections linked to this document
    await Promise.allSettled([
      // Directly linked to document
      pb.collection("extracted_clauses").getFullList({ filter: `document = "${documentId}"`, fields: "id" })
        .then((rows) => Promise.allSettled(rows.map((r) => pb.collection("extracted_clauses").delete(r.id)))),
      pb.collection("ancillary_documents").getFullList({ filter: `document = "${documentId}"`, fields: "id" })
        .then((rows) => Promise.allSettled(rows.map((r) => pb.collection("ancillary_documents").delete(r.id)))),
      pb.collection("pii_sessions").getFullList({ filter: `documentId = "${documentId}"`, fields: "id" })
        .then((rows) => Promise.allSettled(rows.map((r) => pb.collection("pii_sessions").delete(r.id)))).catch(() => {}),
      pb.collection("outcome_deltas").getFullList({ filter: `document = "${documentId}"`, fields: "id" })
        .then((rows) => Promise.allSettled(rows.map((r) => pb.collection("outcome_deltas").delete(r.id)))).catch(() => {}),
      // Results and everything linked to them
      ...resultIds.flatMap((rid) => [
        pb.collection("user_feedback").getFullList({ filter: `result = "${rid}"`, fields: "id" })
          .then((rows) => Promise.allSettled(rows.map((r) => pb.collection("user_feedback").delete(r.id)))).catch(() => {}),
        pb.collection("override_signals").getFullList({ filter: `result = "${rid}"`, fields: "id" })
          .then((rows) => Promise.allSettled(rows.map((r) => pb.collection("override_signals").delete(r.id)))).catch(() => {}),
        pb.collection("false_positive_signals").getFullList({ filter: `result = "${rid}"`, fields: "id" })
          .then((rows) => Promise.allSettled(rows.map((r) => pb.collection("false_positive_signals").delete(r.id)))).catch(() => {}),
      ]),
    ]);

    // Delete review_results after their children are gone
    await Promise.allSettled(resultIds.map((rid) => pb.collection("review_results").delete(rid)));

    // Delete the physical file from disk (best-effort)
    const filename = doc["filename"] as string | undefined;
    if (filename) {
      const filePath = path.join(process.cwd(), "uploads", filename);
      try { fs.unlinkSync(filePath); } catch { /* file may already be gone */ }
    }

    // Delete the document record itself
    await pb.collection("uploaded_documents").delete(documentId);

    // Audit entry: fire-and-forget
    void audit({
      action: "contract_deleted",
      entityType: "uploaded_document",
      entityId: documentId,
      companyId: doc["company"] as string,
      userId,
      detail: { originalName: doc["originalName"], contractType: doc["contractType"] },
    });
  }

  app.delete("/api/documents/:id", requireAuth, ah(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const { userId } = req.user!;
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 404, "Company not found"); return; }
    try {
      await assertOwnsDocument(userId, id, company.id as string);
    } catch {
      sendError(res, 403, "Forbidden"); return;
    }
    await cascadeDeleteDocument(id, userId);
    res.json({ ok: true });
  }));

  app.delete("/api/documents", requireAuth, ah(async (req: Request, res: Response) => {
    const { userId } = req.user!;
    const { ids } = req.body as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      sendError(res, 400, "ids array required"); return;
    }
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 404, "Company not found"); return; }
    // Verify ownership of all before deleting any
    await Promise.all(ids.map((id) => assertOwnsDocument(userId, id, company.id as string)));
    await Promise.allSettled(ids.map((id) => cascadeDeleteDocument(id, userId)));
    res.json({ ok: true, deleted: ids.length });
  }));

  app.delete("/api/company/contracts", requireAuth, ah(async (req: Request, res: Response) => {
    const { userId } = req.user!;
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 404, "Company not found"); return; }
    const allDocs = await pb.collection("uploaded_documents").getFullList({
      filter: `company = "${company.id}"`,
      fields: "id",
    });
    await Promise.allSettled(allDocs.map((d) => cascadeDeleteDocument(d.id as string, userId)));
    res.json({ ok: true, deleted: allDocs.length });
  }));

  // ── Review ───────────────────────────────────────────────────────────────────

  app.post("/api/review/:documentId", requireAuth, ah(async (req: Request, res: Response) => {
    let doc: PBRecord;
    try {
      doc = await pb.collection("uploaded_documents").getOne(req.params.documentId);
    } catch {
      sendError(res, 404, "Document not found"); return;
    }

    const ACTIVE_STATUSES = ["PROCESSING", "PARSING", "ANONYMISING", "CLASSIFYING", "COMPARING"];
    if (ACTIVE_STATUSES.includes(doc["status"] as string)) { sendError(res, 409, "Review already in progress"); return; }

    // On retry (COMPLETE or FAILED), clear previous results so there are no duplicates
    if (doc["status"] === "COMPLETE" || doc["status"] === "FAILED") {
      const [existingResults, existingClauses] = await Promise.all([
        pb.collection("review_results").getFullList({
          filter: `document = "${doc.id}"`,
          fields: "id",
        }),
        pb.collection("extracted_clauses").getFullList({
          filter: `document = "${doc.id}"`,
          fields: "id",
        }),
      ]);
      if (existingResults.length > 0 || existingClauses.length > 0) {
        console.log(`[review] Retry cleanup: deleting ${existingResults.length} results + ${existingClauses.length} clauses for ${doc.id}`);
        await Promise.allSettled([
          ...existingResults.map((r) => pb.collection("review_results").delete(r.id)),
          ...existingClauses.map((c) => pb.collection("extracted_clauses").delete(c.id)),
        ]);
      }
    }

    // Guard: refuse to start review if no playbook rules exist, as this would produce empty results
    const company = await getCompany(req.user?.email);
    if (company) {
      const rules = await pb.collection("playbook_rules").getFullList({
        filter: `company = "${company.id}"`,
        fields: "id",
      });
      if (rules.length === 0) {
        sendError(res, 422, "No playbook rules configured. Please complete the onboarding playbook step before reviewing contracts.");
        return;
      }
    }

    // Set PROCESSING synchronously before returning so the 409 guard works for concurrent requests
    await pb.collection("uploaded_documents").update(doc.id, { status: "PROCESSING", lastError: "" });
    // Fire-and-forget: ensure any uncaught error sets status to FAILED and stores the error message
    runReview(doc.id).catch(async (err: unknown) => {
      const errMsg = (err as Error)?.message ?? String(err);
      console.error(`[review] Unhandled error for ${doc.id}:`, errMsg);
      await pb.collection("uploaded_documents").update(doc.id, {
        status: "FAILED",
        lastError: errMsg.slice(0, 2000),
      }).catch(() => {/* ignore */});
    });
    res.json({ status: "started", documentId: doc.id });
  }));

  app.get("/api/review/:documentId", requireAuth, ah(async (req: Request, res: Response) => {
    let doc: PBRecord;
    try {
      doc = await pb.collection("uploaded_documents").getOne(req.params.documentId);
    } catch {
      sendError(res, 404, "Document not found"); return;
    }

    // Tenant isolation: verify document belongs to the requesting user's company
    const company = await getCompany(req.user?.email);
    if (!company || (doc["company"] as string) !== company.id) {
      sendError(res, 403, "Forbidden"); return;
    }

    const results = await pb.collection("review_results").getFullList({
      filter: `document = "${req.params.documentId}"`,
      sort: "+clauseCategory",
    });

    const feedbackMap = new Map<string, PBRecord>();
    if (results.length > 0) {
      const feedbacks = await pb.collection("user_feedback").getFullList({
        filter: `result.document = "${req.params.documentId}"`,
      });
      for (const f of feedbacks) feedbackMap.set(f["result"] as string, mapFeedback(f));
    }

    const reviewResults = results.map((r) => ({
      ...mapResult(r),
      feedback: feedbackMap.get(r.id) ?? null,
    }));

    res.json({ ...mapDoc(doc), reviewResults });
  }));

  // ── Feedback ─────────────────────────────────────────────────────────────────

  app.post("/api/feedback/:resultId", requireAuth, ah(async (req: Request, res: Response) => {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, parsed.error.message); return; }

    const existing = await pb.collection("user_feedback").getFullList({
      filter: `result = "${req.params.resultId}"`,
    });

    let feedback: PBRecord;
    if (existing.length > 0) {
      feedback = await pb.collection("user_feedback").update(existing[0].id, {
        ...parsed.data,
        feedbackType: "STANDARD",
      });
    } else {
      feedback = await pb.collection("user_feedback").create({
        result: req.params.resultId,
        feedbackType: "STANDARD",
        ...parsed.data,
      });
    }

    const actionMap: Record<string, import("./services/auditLogger.js").AuditAction> = {
      ACCEPTED:  "feedback_accepted",
      EDITED:    "feedback_edited",
      ESCALATED: "feedback_escalated",
      DISMISSED: "feedback_dismissed",
    };
    // Carry the contract id so the per-contract audit view can link this entry
    const fbResult = await pb.collection("review_results").getOne(req.params.resultId, { fields: "id,document,clauseCategory,rule,escalationTrigger" }).catch(() => null);
    await audit({
      action: actionMap[parsed.data.userAction] ?? "feedback_accepted",
      entityType: "review_result",
      entityId: req.params.resultId,
      userId: req.user?.userId,
      detail: { documentId: fbResult?.["document"] ?? "", clauseCategory: fbResult?.["clauseCategory"] ?? "", userAction: parsed.data.userAction },
    });

    // Escalating a clause routes it into the approvals queue: the playbook
    // rule's approvalRequired names the role, defaulting to GC when unset.
    // Guarded by ownership: the result's document must belong to the caller's
    // company, otherwise a foreign resultId would inject requests (and leak
    // decision notifications) across tenants.
    if (parsed.data.userAction === "ESCALATED" && fbResult) {
      const requesterCompany = await getCompany(req.user?.email);
      const fbDoc = await pb.collection("uploaded_documents").getOne(fbResult["document"] as string, { fields: "id,company" }).catch(() => null);
      if (requesterCompany && fbDoc && fbDoc["company"] === requesterCompany.id) {
        const fbRule = fbResult["rule"]
          ? await pb.collection("playbook_rules").getOne(fbResult["rule"] as string, { fields: "id,approvalRequired" }).catch(() => null)
          : null;
        const role = ((fbRule?.["approvalRequired"] as string) || "GC").toUpperCase();
        void createApprovalRequest({
          documentId: fbResult["document"] as string,
          resultId: fbResult.id,
          clauseCategory: (fbResult["clauseCategory"] as string) || undefined,
          role: role === "NONE" ? "GC" : role,
          reason: (fbResult["escalationTrigger"] as string) || "Escalated by the reviewing lawyer for approval.",
          requestedBy: req.user?.email,
        });
      }
    }

    // Decision data capture + significance assessment (reasoning capture, Section 1/2):
    // ACCEPTED  → accepted Zane's recommendation as-is
    // EDITED    → modified the suggested fallback language before using it
    // DISMISSED → ignored the flag
    // ESCALATED → acted at the escalation step per Zane's recommendation
    //
    // Capture itself is silent. We additionally assess whether the decision is
    // unusual or material enough to be worth asking the lawyer for the reasoning,
    // and hand the verdict + the decision_event id back so the client can prompt
    // inline. Best-effort: any failure here must not affect the feedback response.
    let significance: SignificanceResult | null = null;
    let decisionEventId: string | null = null;
    {
      const decisionMap: Record<string, { action: import("./services/decisionEvents.js").HumanAction; position: string }> = {
        ACCEPTED:  { action: "accepted",  position: "Accepted Zane's recommendation as-is" },
        EDITED:    { action: "modified",  position: parsed.data.finalClauseText || parsed.data.editedOutput || "Edited the suggested language" },
        DISMISSED: { action: "ignored",   position: "Dismissed the flag" },
        ESCALATED: { action: "accepted",  position: "Escalated for approval per recommendation" },
      };
      const d = decisionMap[parsed.data.userAction];
      if (d) {
        try {
          decisionEventId = await recordDecisionEventForResult(req.params.resultId, req.user?.userId, d.action, d.position, parsed.data.notes);
          // Escalating is the compliant path, never an unusual override, so we
          // never prompt on it. Assess everything else.
          if (parsed.data.userAction !== "ESCALATED") {
            significance = await assessResultDecision({
              resultId: req.params.resultId,
              userId: req.user?.userId,
              humanAction: d.action,
              humanFinalPosition: d.position,
            });
          }
        } catch (err) {
          console.warn("[feedback] decision capture/significance failed (non-fatal):", (err as Error)?.message);
        }
      }
    }

    res.json({ ...mapFeedback(feedback), significance, decisionEventId });
  }));

  // ── Reasoning capture (Section 2) ─────────────────────────────────────────────
  // Attach the lawyer's reasoning to a significant decision they just made. The
  // decision itself is already captured; this only enriches it, so a missing or
  // dismissed reasoning never blocks anything.
  app.post("/api/decisions/:decisionEventId/reasoning", requireAuth, ah(async (req: Request, res: Response) => {
    const schema = z.object({
      category: z.string().max(60).optional().default(""),
      text: z.string().max(2000).optional().default(""),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, parsed.error.message); return; }
    if (!parsed.data.category && !parsed.data.text.trim()) { res.json({ ok: true }); return; }
    await updateDecisionReasoning(req.params.decisionEventId, parsed.data.category, parsed.data.text.trim());
    res.json({ ok: true });
  }));

  // ── Teach Zane ────────────────────────────────────────────────────────────────
  // Captures a lawyer correction: what Zane got wrong + what the correct analysis is.
  // Stored separately from standard feedback so it can train the knowledge layer.

  app.post("/api/feedback/teach-zane/:resultId", requireAuth, ah(async (req: Request, res: Response) => {
    const parsed = z.object({
      incorrectOutput: z.string().min(1),
      correctOutput:   z.string().min(1),
      notes:           z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, parsed.error.message); return; }

    const existing = await pb.collection("user_feedback").getFullList({
      filter: `result = "${req.params.resultId}"`,
    });

    let feedback: PBRecord;
    if (existing.length > 0) {
      feedback = await pb.collection("user_feedback").update(existing[0].id, {
        feedbackType:  "TEACH_ZANE",
        userAction:    "EDITED",
        editedOutput:  parsed.data.incorrectOutput,
        correctOutput: parsed.data.correctOutput,
        notes:         parsed.data.notes ?? "",
      });
    } else {
      feedback = await pb.collection("user_feedback").create({
        result:        req.params.resultId,
        feedbackType:  "TEACH_ZANE",
        userAction:    "EDITED",
        editedOutput:  parsed.data.incorrectOutput,
        correctOutput: parsed.data.correctOutput,
        notes:         parsed.data.notes ?? "",
      });
    }

    // Carry the contract id so the per-contract audit view can link this entry
    const tzResult = await pb.collection("review_results").getOne(req.params.resultId, { fields: "id,document,clauseCategory" }).catch(() => null);
    await audit({
      action: "teach_zane_correction",
      entityType: "review_result",
      entityId: req.params.resultId,
      userId: req.user?.userId,
      detail: { correctOutputLength: parsed.data.correctOutput.length, documentId: tzResult?.["document"] ?? "", clauseCategory: tzResult?.["clauseCategory"] ?? "" },
    });

    // Decision data capture: a Teach Zane correction is an override of Zane's analysis
    void recordDecisionEventForResult(
      req.params.resultId,
      req.user?.userId,
      "overridden",
      parsed.data.correctOutput,
      parsed.data.notes || `Correction of: ${parsed.data.incorrectOutput.slice(0, 500)}`,
    );

    res.json(mapFeedback(feedback));
  }));

  // ── False Positive ────────────────────────────────────────────────────────────
  // Marks a clause extraction as incorrect - the clause wasn't really there or was
  // misclassified. Logged separately to improve the classifier over time.

  app.post("/api/feedback/false-positive/:resultId", requireAuth, ah(async (req: Request, res: Response) => {
    const parsed = z.object({
      notes: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, parsed.error.message); return; }

    const existing = await pb.collection("user_feedback").getFullList({
      filter: `result = "${req.params.resultId}"`,
    });

    let feedback: PBRecord;
    if (existing.length > 0) {
      feedback = await pb.collection("user_feedback").update(existing[0].id, {
        feedbackType: "FALSE_POSITIVE",
        userAction:   "DISMISSED",
        notes:        parsed.data.notes ?? "Marked as false positive",
      });
    } else {
      feedback = await pb.collection("user_feedback").create({
        result:       req.params.resultId,
        feedbackType: "FALSE_POSITIVE",
        userAction:   "DISMISSED",
        notes:        parsed.data.notes ?? "Marked as false positive",
      });
    }

    // Carry the contract id so the per-contract audit view can link this entry
    const fpResult = await pb.collection("review_results").getOne(req.params.resultId, { fields: "id,document,clauseCategory" }).catch(() => null);
    await audit({
      action: "false_positive_marked",
      entityType: "review_result",
      entityId: req.params.resultId,
      userId: req.user?.userId,
      detail: { documentId: fpResult?.["document"] ?? "", clauseCategory: fpResult?.["clauseCategory"] ?? "" },
    });

    // Decision data capture: marking a false positive overrides Zane's flag
    void recordDecisionEventForResult(
      req.params.resultId,
      req.user?.userId,
      "overridden",
      "Flag marked as false positive",
      parsed.data.notes ?? "Marked as false positive",
    );

    res.json(mapFeedback(feedback));
  }));

  // ── Feedback patterns (memory layer) ─────────────────────────────────────────

  app.get("/api/feedback/patterns", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json({ patterns: [], clauseOutcomes: [], counterpartyPatterns: [], negotiationDrift: [], decisionSummary: null }); return; }

    const docs = await pb.collection("uploaded_documents").getFullList({
      filter: `company = "${company.id}"`,
      fields: "id,counterpartyName,contractType",
    });

    const docIds = docs.map((d) => d.id);
    const docIdFilter = docIds.length > 0
      ? docIds.map((id) => `document = "${id}"`).join(" || ")
      : `id = "none"`;

    const results = await pb.collection("review_results").getFullList({
      filter: docIdFilter,
      fields: "id,document,clauseCategory,ragStatus,clauseSummary,businessSummary,recommendedAction",
    }).catch(() => [] as PBRecord[]);

    const resultIds = results.map((r) => r.id);
    const resultIdFilter = resultIds.length > 0
      ? resultIds.map((id) => `result = "${id}"`).join(" || ")
      : `id = "none"`;

    const feedbacks = await pb.collection("user_feedback").getFullList({
      filter: resultIdFilter,
      fields: "result,userAction,finalClauseText,notes,created",
    }).catch(() => [] as PBRecord[]);

    // Build doc → counterparty/type maps
    const docMetaMap = new Map<string, { counterpartyName: string; contractType: string }>();
    for (const d of docs) {
      docMetaMap.set(d.id, {
        counterpartyName: (d["counterpartyName"] as string) || "Unknown",
        contractType: (d["contractType"] as string) || "UNKNOWN",
      });
    }

    const fbMap = new Map<string, PBRecord>();
    for (const f of feedbacks) fbMap.set(f["result"] as string, f);

    // Per-clause-category aggregation
    const catStats: Record<string, {
      total: number; accepted: number; escalated: number; dismissed: number;
      ragCounts: Record<string, number>;
    }> = {};

    for (const r of results) {
      const cat = r["clauseCategory"] as string;
      if (!catStats[cat]) catStats[cat] = { total: 0, accepted: 0, escalated: 0, dismissed: 0, ragCounts: {} };
      catStats[cat].total++;
      catStats[cat].ragCounts[r["ragStatus"] as string] = (catStats[cat].ragCounts[r["ragStatus"] as string] ?? 0) + 1;
      const fb = fbMap.get(r.id);
      if (fb) {
        const action = fb["userAction"] as string;
        if (action === "ACCEPTED")  catStats[cat].accepted++;
        if (action === "ESCALATED") catStats[cat].escalated++;
        if (action === "DISMISSED") catStats[cat].dismissed++;
      }
    }

    // Build Zane NOTICED insights
    const patterns: { type: string; message: string; severity: "info" | "warn" | "good" }[] = [];

    for (const [cat, stats] of Object.entries(catStats)) {
      if (stats.accepted >= 3 && (stats.ragCounts["RED"] ?? 0) > 0) {
        patterns.push({
          type: "repeated_acceptance",
          message: `You've accepted ${stats.ragCounts["RED"]} red-flagged ${cat.replace(/_/g, " ")} clause${stats.ragCounts["RED"] > 1 ? "s" : ""} - consider updating your playbook.`,
          severity: "warn",
        });
      }
      if (stats.escalated >= 2) {
        patterns.push({
          type: "repeated_escalation",
          message: `${cat.replace(/_/g, " ")} has been escalated ${stats.escalated} times - this clause type consistently needs legal review.`,
          severity: "info",
        });
      }
      if ((stats.ragCounts["GREY"] ?? 0) >= 3) {
        patterns.push({
          type: "frequently_absent",
          message: `${cat.replace(/_/g, " ")} has been absent in ${stats.ragCounts["GREY"]} contracts - worth requesting this clause proactively.`,
          severity: "warn",
        });
      }
    }

    // Overall acceptance rate for RED clauses
    const totalRed       = results.filter((r) => r["ragStatus"] === "RED").length;
    const acceptedRedFbs = feedbacks.filter((f) => f["userAction"] === "ACCEPTED");
    const acceptedRed    = acceptedRedFbs.filter((f) => {
      const r = results.find((x) => x.id === f["result"]);
      return r?.["ragStatus"] === "RED";
    }).length;

    if (totalRed > 0 && acceptedRed / totalRed > 0.5) {
      patterns.push({
        type: "high_red_acceptance",
        message: `You've accepted ${acceptedRed} out of ${totalRed} red-flagged clauses. Consider whether your playbook positions are realistic.`,
        severity: "warn",
      });
    }

    const totalGreen = results.filter((r) => r["ragStatus"] === "GREEN").length;
    if (totalGreen > 5 && acceptedRed === 0) {
      patterns.push({
        type: "clean_streak",
        message: `${totalGreen} clauses have been green across your contracts - your playbook is working well.`,
        severity: "good",
      });
    }

    // Clause outcomes (for playbook page)
    const clauseOutcomes = Object.entries(catStats)
      .filter(([, s]) => s.total > 0)
      .map(([cat, s]) => ({
        clauseCategory: cat,
        total: s.total,
        accepted: s.accepted,
        escalated: s.escalated,
        dismissed: s.dismissed,
        redCount: s.ragCounts["RED"] ?? 0,
        amberCount: s.ragCounts["AMBER"] ?? 0,
        greenCount: s.ragCounts["GREEN"] ?? 0,
      }))
      .sort((a, b) => b.total - a.total);

    // ── Counterparty pattern analysis ────────────────────────────────────────
    // Which counterparties consistently flag RED/AMBER on which clause types?
    const cpCatMap: Record<string, Record<string, { red: number; amber: number; accepted: number }>> = {};
    for (const r of results) {
      const meta = docMetaMap.get(r["document"] as string);
      if (!meta) continue;
      const cp = meta.counterpartyName;
      const cat = r["clauseCategory"] as string;
      if (!cpCatMap[cp]) cpCatMap[cp] = {};
      if (!cpCatMap[cp][cat]) cpCatMap[cp][cat] = { red: 0, amber: 0, accepted: 0 };
      if (r["ragStatus"] === "RED")   cpCatMap[cp][cat].red++;
      if (r["ragStatus"] === "AMBER") cpCatMap[cp][cat].amber++;
      const fb = fbMap.get(r.id);
      if (fb?.["userAction"] === "ACCEPTED") cpCatMap[cp][cat].accepted++;
    }

    interface CounterpartyPattern {
      counterparty: string;
      clauseCategory: string;
      redCount: number;
      amberCount: number;
      acceptedRed: number;
    }

    const counterpartyPatterns: CounterpartyPattern[] = [];
    for (const [cp, catData] of Object.entries(cpCatMap)) {
      if (cp === "Unknown") continue;
      for (const [cat, stats] of Object.entries(catData)) {
        if (stats.red >= 2) {
          counterpartyPatterns.push({
            counterparty: cp,
            clauseCategory: cat,
            redCount: stats.red,
            amberCount: stats.amber,
            acceptedRed: stats.accepted,
          });
        }
      }
    }
    counterpartyPatterns.sort((a, b) => b.redCount - a.redCount);

    // ── Negotiation position drift ───────────────────────────────────────────
    // Clauses where RED was frequently accepted (lawyer accepted below red line)
    interface DriftEntry {
      clauseCategory: string;
      totalRed: number;
      acceptedRed: number;
      driftPct: number;
    }
    const driftEntries: DriftEntry[] = [];
    for (const [cat, stats] of Object.entries(catStats)) {
      const redTotal = stats.ragCounts["RED"] ?? 0;
      if (redTotal < 2) continue;
      // Count accepted feedbacks where the underlying result was RED
      let acceptedRedCount = 0;
      for (const r of results.filter((x) => x["clauseCategory"] === cat && x["ragStatus"] === "RED")) {
        const fb = fbMap.get(r.id);
        if (fb?.["userAction"] === "ACCEPTED") acceptedRedCount++;
      }
      if (acceptedRedCount >= 1) {
        driftEntries.push({
          clauseCategory: cat,
          totalRed: redTotal,
          acceptedRed: acceptedRedCount,
          driftPct: Math.round((acceptedRedCount / redTotal) * 100),
        });
      }
    }
    driftEntries.sort((a, b) => b.driftPct - a.driftPct);

    // ── Decision events (structured human-judgment capture) ──────────────────
    // The moat layer: every accept / override / modify / ignore decision feeds
    // the negotiation intelligence view directly.
    const decisionEvents = await pb.collection("decision_events").getFullList({
      filter: `company = "${company.id}"`,
      sort: "-created",
    }).catch(() => [] as PBRecord[]);

    const byAction: Record<string, number> = {};
    const byCategory: Record<string, { total: number; overridden: number }> = {};
    for (const e of decisionEvents) {
      const action = (e["human_action"] as string) || "unknown";
      byAction[action] = (byAction[action] ?? 0) + 1;
      const cat = (e["clause_category"] as string) || "UNKNOWN";
      const c = (byCategory[cat] ??= { total: 0, overridden: 0 });
      c.total += 1;
      if (action === "overridden") c.overridden += 1;
    }
    const decisionSummary = decisionEvents.length === 0 ? null : {
      total: decisionEvents.length,
      byAction,
      agreementRate: Math.round(((byAction["accepted"] ?? 0) / decisionEvents.length) * 100),
      overrideRate: Math.round(((byAction["overridden"] ?? 0) / decisionEvents.length) * 100),
      mostOverriddenCategories: Object.entries(byCategory)
        .filter(([, c]) => c.overridden > 0)
        .sort((a, b) => b[1].overridden - a[1].overridden)
        .slice(0, 5)
        .map(([clauseCategory, c]) => ({ clauseCategory, overridden: c.overridden, total: c.total })),
      recent: decisionEvents.slice(0, 20).map((e) => ({
        clauseCategory: e["clause_category"],
        zaneRecommendation: e["zane_recommendation"],
        humanAction: e["human_action"],
        humanFinalPosition: String(e["human_final_position"] ?? "").slice(0, 200),
        overrideReason: String(e["override_reason"] ?? "").slice(0, 200),
        created: e["created"],
      })),
    };

    res.json({
      patterns: patterns.slice(0, 8),
      clauseOutcomes,
      counterpartyPatterns: counterpartyPatterns.slice(0, 10),
      negotiationDrift: driftEntries.slice(0, 6),
      decisionSummary,
    });
  }));

  // ── Generate negotiation reply ────────────────────────────────────────────────

  app.post("/api/review/generate-reply/:resultId", requireAuth, ah(async (req: Request, res: Response) => {
    const { resultId } = req.params;
    const { tone = "professional" } = req.body as { tone?: string };

    let result: PBRecord;
    try {
      result = await pb.collection("review_results").getOne(resultId);
    } catch {
      sendError(res, 404, "Result not found"); return;
    }

    // Get the document for context (counterparty name, contract type)
    const doc = await pb.collection("uploaded_documents").getOne(result["document"] as string).catch(() => null);
    const counterparty = doc?.["counterpartyName"] as string | undefined;
    const contractType = doc?.["contractType"] as string | undefined;

    // Build a prompt for a negotiation reply
    const clauseLabel = (result["clauseCategory"] as string).replace(/_/g, " ");
    const ragStatus   = result["ragStatus"] as string;
    const summary     = result["clauseSummary"] as string ?? "";
    const recommended = result["recommendedAction"] as string ?? "";
    const fallback    = result["suggestedFallback"] as string ?? "";

    const systemPrompt = `You are a commercial contract negotiation expert.
Write a short, ${tone} email paragraph (3-5 sentences) that a business owner can send to the other side to negotiate the ${clauseLabel} clause.
The clause is currently rated ${ragStatus} (RED = problematic, AMBER = needs improvement, GREEN = fine).
Be specific, polite, and suggest the improved wording. Do not use legalese - keep it plain English.
Output ONLY the email text, no subject line, no preamble.`;

    const userPrompt = `Contract: ${contractType ?? "commercial agreement"}
${counterparty ? `Counterparty: ${counterparty}` : ""}
Clause issue: ${summary}
What to do: ${recommended}
Preferred wording: ${fallback}

Write the negotiation email paragraph.`;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === "your-api-key-here") {
      // Fallback: compose a template-based reply
      const templateReply = fallback
        ? `Thank you for sending through the contract. Regarding the ${clauseLabel} clause, we'd like to propose the following amendment: "${fallback}". This better reflects our standard position and we'd welcome your thoughts.`
        : `Thank you for sending through the contract. We'd like to discuss the ${clauseLabel} clause before proceeding - please let us know when you're available to talk through our proposed changes.`;
      res.json({ reply: templateReply });
      return;
    }

    const reply = await chatComplete([
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt },
    ], 300);

    res.json({ reply: reply.trim() });
  }));

  // ── Founder negotiation: full negotiation email ────────────────────────────

  app.post("/api/review/:documentId/negotiation-email", requireAuth, ah(async (req: Request, res: Response) => {
    const { documentId } = req.params;
    const { resultIds } = req.body as { resultIds?: string[] };

    const doc = await pb.collection("uploaded_documents").getOne(documentId).catch(() => null);
    if (!doc) { sendError(res, 404, "Document not found"); return; }

    const company = await getCompany(req.user?.email);
    const riskAppetite = (company?.["riskAppetite"] as string | undefined) ?? "MODERATE";
    const companyName  = (company?.["name"] as string | undefined) ?? "us";

    // Fetch the results to include in the email
    let included: PBRecord[];
    if (resultIds && resultIds.length > 0) {
      included = await pb.collection("review_results").getFullList({
        filter: resultIds.map((id) => `id = "${id}"`).join(" || "),
      });
    } else {
      included = (await pb.collection("review_results").getFullList({
        filter: `document = "${documentId}"`,
      })).filter((r) => r["ragStatus"] !== "GREEN");
    }

    if (included.length === 0) {
      const ct = (doc["contractType"] as string | undefined) ?? "agreement";
      res.json({ subject: `Re: ${ct.replace(/_/g, " ")} - looks good`, body: "Everything in the agreement looks fine to us. Happy to proceed." });
      return;
    }

    const tonePhrase = riskAppetite === "CONSERVATIVE" ? "professional and precise"
      : riskAppetite === "AGGRESSIVE"    ? "confident and direct"
      : "friendly and collaborative";

    const counterparty  = (doc["counterpartyName"] as string | undefined) ?? "you";
    const contractType  = ((doc["contractType"] as string | undefined) ?? "agreement").replace(/_/g, " ").toLowerCase();

    const issueList = included.map((r, i) => {
      const clauseLabel = (r["clauseCategory"] as string).replace(/_/g, " ");
      const isAbsent    = r["isAbsent"] as boolean;
      const ask         = (r["founderAskFor"] as string | undefined) || (r["recommendedAction"] as string | undefined) || "";
      const fallback    = (r["founderCopyPaste"] as string | undefined) || (r["suggestedFallback"] as string | undefined) || "";
      if (isAbsent) {
        return `Issue ${i + 1}, Add ${clauseLabel}:\n${ask}`;
      }
      const verb = r["ragStatus"] === "RED" ? "needs to change" : "worth discussing";
      return `Issue ${i + 1}, ${clauseLabel} (${verb}):\n${ask}${fallback ? `\nSuggested wording: "${fallback}"` : ""}`;
    }).join("\n\n");

    const systemPrompt = `You are helping a founder draft a negotiation email to a counterparty about a contract.

Never use em dashes or en dashes in any output. Use a comma or a full stop instead.

Write a ${tonePhrase} email that:
- Opens by thanking them for sending the agreement and noting you have reviewed it
- Raises each issue by name (use the issue heading as a natural part of the sentence)
- States clearly what change is being requested for each
- Includes any suggested wording naturally in the text where provided
- Uses plain English, no Latin, no legal jargon, no clause number references like "14.2(b)" unless the counterparty used them
- Is not aggressive or adversarial
- Closes collaboratively (e.g. "Happy to jump on a call to talk through any of this")
- Reads as if the founder is writing it themselves, not a lawyer

Return plain text only.
First line must be: Subject: [subject line]
Then a blank line.
Then the email body.
No preamble. No explanation. No markdown.`;

    const userPrompt = `Contract type: ${contractType}
Counterparty: ${counterparty}
Our company: ${companyName}

Issues to raise:
${issueList}`;

    const apiKey = process.env.OPENROUTER_API_KEY;
    let subject: string;
    let body: string;

    if (!apiKey || apiKey === "your-api-key-here") {
      subject = `Re: ${contractType}, proposed amendments`;
      body = `Hi,\n\nThanks for sending across the ${contractType}. We've had a chance to review it and have a few points we'd like to raise before we proceed.\n\n${included.map((r) => {
        const label = (r["clauseCategory"] as string).replace(/_/g, " ");
        const ask   = (r["founderAskFor"] as string | undefined) || (r["recommendedAction"] as string | undefined) || "We'd like to discuss this further.";
        return `${label}: ${ask}`;
      }).join("\n\n")}\n\nHappy to jump on a call to walk through these. Let us know what works.\n\nBest,\n${companyName}`;
    } else {
      const raw = await chatComplete([
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ], 1400);

      const lines = raw.trim().split("\n");
      const subIdx = lines.findIndex((l) => /^subject:/i.test(l.trim()));
      if (subIdx !== -1) {
        subject = lines[subIdx].replace(/^subject:\s*/i, "").trim();
        body    = lines.slice(subIdx + 1).join("\n").trim();
      } else {
        subject = `Re: ${contractType}, proposed amendments`;
        body    = raw.trim();
      }
    }

    res.json({ subject, body });
  }));

  // ── Founder negotiation: amended clause ────────────────────────────────────

  app.post("/api/review/result/:resultId/amended-clause", requireAuth, ah(async (req: Request, res: Response) => {
    const { resultId } = req.params;

    let result: PBRecord;
    try { result = await pb.collection("review_results").getOne(resultId); }
    catch { sendError(res, 404, "Result not found"); return; }

    // Try to get the raw clause text from extracted_clauses
    const clauseId = result["clause"] as string | undefined;
    let originalText = "";
    if (clauseId) {
      const extracted = await pb.collection("extracted_clauses").getOne(clauseId).catch(() => null);
      originalText = (extracted?.["rawText"] as string | undefined) ?? "";
    }
    if (!originalText) originalText = (result["clauseSummary"] as string | undefined) ?? "";

    const clauseLabel = (result["clauseCategory"] as string).replace(/_/g, " ");
    const ask      = (result["founderAskFor"] as string | undefined) || (result["recommendedAction"] as string | undefined) || "";
    const fallback = (result["founderCopyPaste"] as string | undefined) || (result["suggestedFallback"] as string | undefined) || "";

    const doc = await pb.collection("uploaded_documents").getOne(result["document"] as string).catch(() => null);
    const contractType = ((doc?.["contractType"] as string | undefined) ?? "commercial agreement").replace(/_/g, " ").toLowerCase();

    // Ground the redraft in the company's own playbook position for this clause,
    // so the output is the playbook-aligned version, not a generic rewrite.
    const company = await getCompany(req.user?.email).catch(() => null);
    let playbookContext = "";
    if (company) {
      const rules = await pb.collection("playbook_rules").getFullList({
        filter: `company = "${company.id}" && clauseCategory = "${(result["clauseCategory"] as string).replace(/"/g, "")}"`,
      }).catch(() => [] as PBRecord[]);
      const rule = rules[0];
      if (rule) {
        playbookContext = `\nYour company's position on this clause:\n- Preferred: ${String(rule["preferredPosition"] ?? "").slice(0, 600)}\n- Acceptable fallback: ${String(rule["acceptableFallback"] ?? "").slice(0, 600)}\n- Red line (never cross): ${String(rule["hardRedLine"] ?? "").slice(0, 600)}`;
      }
    }

    const systemPrompt = `You are a commercial contracts expert producing a clean, drop-in redraft of a single clause, aligned to the company's own position. The output is the actual clause wording a lawyer can paste straight into the contract, not a negotiation note.

Rules:
- Write proper, complete contract language in plain professional English. Minimal Latin, minimal jargon.
- Align the redraft to the company's playbook position where provided (aim for preferred, no worse than the acceptable fallback, never cross a red line).
- Do NOT invent specific commercial terms (figures, dates, percentages, cap amounts, notice periods) that are not given. Where a specific commercial value is genuinely needed, insert a clearly marked placeholder in the form [TO CONFIRM: what the business must decide], for example "[TO CONFIRM: liability cap amount]".
- Return ONLY valid JSON, no markdown fences:
{"revised":"the full redrafted clause as proper contract language","explanation":"one plain English sentence on the key change"}`;

    const userPrompt = `Contract type: ${contractType}
Clause: ${clauseLabel}

Original clause text:
${originalText}
${playbookContext}

What needs to change:
${ask}
${fallback ? `\nSuggested wording to incorporate:\n"${fallback}"` : ""}

Produce the full redrafted clause aligned to the company's position. Keep it complete and professional, and use [TO CONFIRM: ...] placeholders for any commercial term that is not specified rather than inventing one.`;

    const apiKey = process.env.OPENROUTER_API_KEY;
    let revised: string;
    let explanation: string;

    if (!apiKey || apiKey === "your-api-key-here") {
      revised     = fallback || `[Revised ${clauseLabel} clause incorporating: ${ask}]`;
      explanation = "The revised clause incorporates the requested change to better protect your position.";
    } else {
      try {
        const raw   = await chatComplete([{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], 900);
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("no JSON");
        const parsed = JSON.parse(match[0]) as { revised?: string; explanation?: string };
        revised     = parsed.revised     ?? fallback ?? "";
        explanation = parsed.explanation ?? "";
      } catch {
        revised     = fallback || `[Revised ${clauseLabel} clause]`;
        explanation = "Unable to generate revised clause. Please try again.";
      }
    }

    res.json({ original: originalText, revised, explanation });
  }));

  // ── Founder negotiation: suggest missing clause ────────────────────────────

  app.post("/api/review/result/:resultId/suggest-clause", requireAuth, ah(async (req: Request, res: Response) => {
    const { resultId } = req.params;

    let result: PBRecord;
    try { result = await pb.collection("review_results").getOne(resultId); }
    catch { sendError(res, 404, "Result not found"); return; }

    const clauseLabel  = (result["clauseCategory"] as string).replace(/_/g, " ");
    const ask          = (result["recommendedAction"] as string | undefined) ?? "";
    const fallback     = (result["suggestedFallback"] as string | undefined) ?? "";

    const doc          = await pb.collection("uploaded_documents").getOne(result["document"] as string).catch(() => null);
    const contractType = ((doc?.["contractType"] as string | undefined) ?? "commercial agreement").replace(/_/g, " ").toLowerCase();

    const company      = await getCompany(req.user?.email);
    const riskAppetite = (company?.["riskAppetite"] as string | undefined) ?? "MODERATE";
    const riskDesc     = riskAppetite === "CONSERVATIVE" ? "protective and precise, favouring the founder"
      : riskAppetite === "AGGRESSIVE" ? "commercially assertive, maximising the founder's rights"
      : "balanced and commercially reasonable";

    const systemPrompt = `You are a commercial contracts expert. Draft a standalone contract clause that a founder can ask the counterparty to add.

The clause should be:
- Written in plain commercial English (minimal Latin, no excessive jargon)
- Complete and self-contained with a clause heading
- ${riskDesc} in tone
- Appropriate for a ${contractType}

Return ONLY valid JSON with no markdown fences:
{"clauseText":"the full clause text starting with a short heading in ALL CAPS followed by the clause body","explanation":"one plain English sentence explaining what this clause does and why the founder needs it"}`;

    const userPrompt = `Missing clause: ${clauseLabel}
Contract type: ${contractType}
Why it matters: ${ask}
${fallback ? `Reference wording: "${fallback}"` : ""}

Draft the complete clause.`;

    const apiKey = process.env.OPENROUTER_API_KEY;
    let clauseText: string;
    let explanation: string;

    if (!apiKey || apiKey === "your-api-key-here") {
      clauseText  = fallback || `[${clauseLabel.toUpperCase()}\n\n${ask}]`;
      explanation = `This clause covers ${clauseLabel.toLowerCase()} and should be added to protect your position.`;
    } else {
      try {
        const raw   = await chatComplete([{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], 800);
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("no JSON");
        const parsed = JSON.parse(match[0]) as { clauseText?: string; explanation?: string };
        clauseText  = parsed.clauseText  ?? fallback ?? "";
        explanation = parsed.explanation ?? "";
      } catch {
        clauseText  = fallback || `[${clauseLabel} clause: unable to generate, please try again]`;
        explanation = "Unable to generate clause. Please try again.";
      }
    }

    res.json({ clauseText, explanation });
  }));

  // ── Stats ────────────────────────────────────────────────────────────────────

  app.get("/api/stats", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json(null); return; }

    const docs = await pb.collection("uploaded_documents").getFullList({
      filter: `company = "${company.id}"`,
    });

    const docIds = docs.map((d) => d.id);
    const docIdFilter = docIds.length > 0
      ? docIds.map((id) => `document = "${id}"`).join(" || ")
      : `id = "none"`;

    const results = await pb.collection("review_results").getFullList({
      filter: docIdFilter,
    }).catch(() => [] as PBRecord[]);

    const feedbackMap = new Map<string, PBRecord>();
    if (results.length > 0) {
      const resultIds = results.map((r) => r.id);
      const resultIdFilter = resultIds.map((id) => `result = "${id}"`).join(" || ");
      const feedbacks = await pb.collection("user_feedback").getFullList({
        filter: resultIdFilter,
      }).catch(() => [] as PBRecord[]);
      for (const f of feedbacks) feedbackMap.set(f["result"] as string, f);
    }

    const resultsWithFeedback: PBRecord[] = results.map((r) => ({
      ...r,
      feedback: feedbackMap.get(r.id) ?? null,
    }));

    const complete = docs.filter((d) => d["status"] === "COMPLETE").length;
    const redOpen = resultsWithFeedback.filter(
      (r) =>
        r["ragStatus"] === "RED" &&
        r.feedback?.["userAction"] !== "ACCEPTED" &&
        r.feedback?.["userAction"] !== "DISMISSED"
    ).length;
    const escalations = resultsWithFeedback.filter(
      (r) =>
        r["escalationRequired"] &&
        r.feedback?.["userAction"] !== "ESCALATED" &&
        r.feedback?.["userAction"] !== "DISMISSED"
    ).length;
    const accepted = resultsWithFeedback.filter((r) => r.feedback?.["userAction"] === "ACCEPTED").length;

    const categoryRed: Record<string, number> = {};
    for (const r of results) {
      if (r["ragStatus"] === "RED") {
        const cat = r["clauseCategory"] as string;
        categoryRed[cat] = (categoryRed[cat] ?? 0) + 1;
      }
    }
    const topIssues = Object.entries(categoryRed)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([category, count]) => ({ category, count }));

    res.json({
      totalReviews: complete,
      totalDocuments: docs.length,
      redFlagsOpen: redOpen,
      escalationsPending: escalations,
      clausesAccepted: accepted,
      estimatedHoursSaved: complete * 1.5,
      ragBreakdown: {
        RED:   results.filter((r) => r["ragStatus"] === "RED").length,
        AMBER: results.filter((r) => r["ragStatus"] === "AMBER").length,
        GREEN: results.filter((r) => r["ragStatus"] === "GREEN").length,
        GREY:  results.filter((r) => r["ragStatus"] === "GREY").length,
      },
      topIssues,
    });
  }));

  // ── Portfolio ─────────────────────────────────────────────────────────────────

  app.get("/api/portfolio", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json(null); return; }

    const completeDocs = await pb.collection("uploaded_documents").getFullList({
      filter: `company = "${company.id}" && status = "COMPLETE"`,
      fields: "id,contractType,counterpartyName,contractValue,currency,outcome",
    });

    const completeDocIds = completeDocs.map((d) => d.id);
    const completeDocFilter = completeDocIds.length > 0
      ? completeDocIds.map((id) => `document = "${id}"`).join(" || ")
      : `id = "none"`;

    const [results, allEscalations] = await Promise.all([
      pb.collection("review_results").getFullList({
        filter: completeDocFilter,
      }).catch(() => [] as PBRecord[]),
      pb.collection("review_results").getFullList({
        filter: `${completeDocFilter} && escalationRequired = true`,
        fields: "id,document",
      }).catch(() => [] as PBRecord[]),
    ]);

    if (results.length === 0) { res.json(null); return; }

    const docMeta = new Map(completeDocs.map((d) => [d.id, {
      contractType: d["contractType"] as string,
      counterpartyName: d["counterpartyName"] as string | null,
      contractValue: d["contractValue"] as number | null,
      currency: (d["currency"] as string) || "GBP",
      outcome: d["outcome"] as string | null,
    }]));

    const GROUPS = [
      { label: "Liability & Risk",      icon: "⚖️",  cats: ["LIABILITY_CAP","INDEMNITY","WARRANTIES","LIQUIDATED_DAMAGES","INSURANCE"] },
      { label: "Data & Privacy",        icon: "🔐",  cats: ["DATA_PRIVACY","CONFIDENTIALITY","SANCTIONS_COMPLIANCE","MODERN_SLAVERY","ANTI_BRIBERY"] },
      { label: "IP & Technology",       icon: "💡",  cats: ["IP_OWNERSHIP","SOURCE_CODE_ESCROW","ACCEPTANCE_TESTING","MARKETING_RIGHTS","SERVICE_LEVELS"] },
      { label: "Termination & Renewal", icon: "📅",  cats: ["TERMINATION","AUTO_RENEWAL","BREAK_CLAUSE","CHANGE_OF_CONTROL","REGULATORY_CHANGE"] },
    ];

    const groups = GROUPS.map((g) => {
      const gr = results.filter((r) => g.cats.includes(r["clauseCategory"] as string));
      return {
        label: g.label,
        icon:  g.icon,
        red:   gr.filter((r) => r["ragStatus"] === "RED").length,
        amber: gr.filter((r) => r["ragStatus"] === "AMBER").length,
        green: gr.filter((r) => r["ragStatus"] === "GREEN").length,
      };
    });

    const totalDocs = new Set(results.map((r) => r["document"] as string)).size;
    const totalRedResults = results.filter((r) => r["ragStatus"] === "RED").length;
    const escalationsOpen = new Set(allEscalations.map((r) => r["document"] as string)).size;
    const totalValue = completeDocs.reduce((acc, d) => acc + ((d["contractValue"] as number | null) ?? 0), 0);
    const signedDocs = completeDocs.filter((d) => d["outcome"] === "SIGNED" || d["outcome"] === "EXECUTED").length;

    const categoryRed: Record<string, number> = {};
    const categoryTotal: Record<string, number> = {};
    for (const r of results) {
      const cat = r["clauseCategory"] as string;
      categoryTotal[cat] = (categoryTotal[cat] ?? 0) + 1;
      if (r["ragStatus"] === "RED") categoryRed[cat] = (categoryRed[cat] ?? 0) + 1;
    }
    const topRedCategories = Object.entries(categoryRed)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([category, count]) => ({ category, count, pct: Math.round((count / totalDocs) * 100) }));

    const typeMap: Record<string, { red: number; amber: number; docIds: Set<string> }> = {};
    for (const r of results) {
      const docId = r["document"] as string;
      const t = docMeta.get(docId)?.contractType ?? "UNKNOWN";
      if (!typeMap[t]) typeMap[t] = { red: 0, amber: 0, docIds: new Set() };
      typeMap[t].docIds.add(docId);
      if (r["ragStatus"] === "RED")   typeMap[t].red++;
      if (r["ragStatus"] === "AMBER") typeMap[t].amber++;
    }
    const byContractType = Object.entries(typeMap)
      .map(([type, v]) => ({ type: type.replace(/_/g, " "), red: v.red, amber: v.amber, total: v.docIds.size }))
      .sort((a, b) => b.red - a.red);

    // Counterparty risk heat map - top 8 counterparties by red count
    const cpMap: Record<string, { red: number; amber: number; green: number; docIds: Set<string>; value: number }> = {};
    for (const r of results) {
      const docId = r["document"] as string;
      const meta = docMeta.get(docId);
      const cp = meta?.counterpartyName || "Unknown";
      if (!cpMap[cp]) cpMap[cp] = { red: 0, amber: 0, green: 0, docIds: new Set(), value: 0 };
      cpMap[cp].docIds.add(docId);
      if (r["ragStatus"] === "RED")   cpMap[cp].red++;
      if (r["ragStatus"] === "AMBER") cpMap[cp].amber++;
      if (r["ragStatus"] === "GREEN") cpMap[cp].green++;
    }
    for (const [, v] of Object.entries(cpMap)) {
      Array.from(v.docIds).forEach((docId) => {
        v.value += docMeta.get(docId)?.contractValue ?? 0;
      });
    }
    const byCounterparty = Object.entries(cpMap)
      .map(([name, v]) => ({
        name,
        red: v.red, amber: v.amber, green: v.green,
        total: v.docIds.size,
        value: v.value,
      }))
      .sort((a, b) => b.red - a.red)
      .slice(0, 8);

    // Value at risk by RAG band
    // For each doc, determine its "worst" RAG: if any RED → RED, else if any AMBER → AMBER, else GREEN
    const docRag: Record<string, "RED" | "AMBER" | "GREEN"> = {};
    for (const r of results) {
      const docId = r["document"] as string;
      const rag = r["ragStatus"] as string;
      const cur = docRag[docId];
      if (!cur || (rag === "RED") || (rag === "AMBER" && cur === "GREEN")) {
        docRag[docId] = rag as "RED" | "AMBER" | "GREEN";
      }
    }
    const valueAtRisk = { RED: 0, AMBER: 0, GREEN: 0, total: 0 };
    for (const [docId, rag] of Object.entries(docRag)) {
      const v = docMeta.get(docId)?.contractValue ?? 0;
      valueAtRisk[rag] += v;
      valueAtRisk.total += v;
    }

    const topCat = topRedCategories[0];
    const insight = topCat
      ? `${topCat.category.replace(/_/g, " ")} is your most common risk issue across ${totalDocs} reviewed contract${totalDocs !== 1 ? "s" : ""}. Check your playbook position and consider whether your red line is calibrated correctly.`
      : `${totalDocs} contract${totalDocs !== 1 ? "s" : ""} reviewed with no RED flags. Your playbook positions are holding well.`;

    res.json({
      groups, topRedCategories, byContractType, insight,
      totalDocuments: totalDocs, totalClauses: results.length,
      // New panels
      totalRedResults, escalationsOpen, totalValue, signedDocs,
      byCounterparty, valueAtRisk,
    });
  }));

  // ── Timings ───────────────────────────────────────────────────────────────────

  app.get("/api/timings", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json(null); return; }

    const docs = await pb.collection("uploaded_documents").getFullList({
      filter: `company = "${company.id}"`,
      sort: "-id",
    });
    const timingDocIds = docs.map((d) => d.id);
    const timingDocFilter = timingDocIds.length > 0
      ? timingDocIds.map((id) => `document = "${id}"`).join(" || ")
      : `id = "none"`;
    const allResults = await pb.collection("review_results").getFullList({
      filter: timingDocFilter,
      fields: "id,document,clauseCategory,ragStatus,clauseSummary",
    }).catch(() => [] as PBRecord[]);

    const relevantCats = new Set(["AUTO_RENEWAL", "TERMINATION", "BREAK_CLAUSE", "PAYMENT_TERMS", "CHANGE_OF_CONTROL"]);

    const flagged = docs
      .filter((d) => d["status"] === "COMPLETE")
      .flatMap((d) =>
        allResults
          .filter((r) =>
            r["document"] === d.id &&
            relevantCats.has(r["clauseCategory"] as string) &&
            (r["ragStatus"] === "RED" || r["ragStatus"] === "AMBER")
          )
          .map((r) => ({
            id:            r.id,
            contractName:  d["originalName"] as string,
            contractType:  (d["contractType"] as string).replace(/_/g, " "),
            clauseCategory: r["clauseCategory"] as string,
            ragStatus:     r["ragStatus"] as string,
            summary:       r["clauseSummary"] as string,
            uploadedAt:    d["created"] as string,
          }))
      )
      .sort((a, b) => (a.ragStatus === "RED" && b.ragStatus !== "RED" ? -1 : 1));

    const total = docs.length || 1;
    const statusCounts = {
      complete:   docs.filter((d) => d["status"] === "COMPLETE").length,
      processing: docs.filter((d) => d["status"] === "PROCESSING").length,
      uploaded:   docs.filter((d) => d["status"] === "UPLOADED").length,
      failed:     docs.filter((d) => d["status"] === "FAILED").length,
    };
    const overview = [
      { label: "Reviewed",        count: statusCounts.complete,   pct: Math.round(statusCounts.complete   / total * 100) },
      { label: "Processing",      count: statusCounts.processing, pct: Math.round(statusCounts.processing / total * 100) },
      { label: "Awaiting review", count: statusCounts.uploaded,   pct: Math.round(statusCounts.uploaded   / total * 100) },
      { label: "Failed",          count: statusCounts.failed,     pct: Math.round(statusCounts.failed     / total * 100) },
    ].filter((o) => o.count > 0);

    res.json({ flagged, overview, totalDocuments: docs.length });
  }));

  // ── Litigation Intake ─────────────────────────────────────────────────────────

  app.get("/api/litigation/intake/:documentId", requireAuth, ah(async (req: Request, res: Response) => {
    const intakes = await pb.collection("litigation_intakes").getFullList({
      filter: `document = "${req.params.documentId}"`,
    });
    res.json(intakes.length > 0 ? mapIntake(intakes[0]) : null);
  }));

  app.post("/api/litigation/intake/:documentId", requireAuth, ah(async (req: Request, res: Response) => {
    const body = req.body as {
      stage?: number;
      hardStopData?: string;
      defenceData?: string;
      fraudFlag?: boolean;
      fcaBreach?: boolean;
      vulnerableCustomer?: boolean;
      hardStopPassed?: boolean;
      complete?: boolean;
    };

    const data = {
      stage:              body.stage ?? 1,
      hardStopData:       body.hardStopData ?? "",
      defenceData:        body.defenceData ?? "",
      fraudFlag:          body.fraudFlag ?? false,
      fcaBreach:          body.fcaBreach ?? false,
      vulnerableCustomer: body.vulnerableCustomer ?? false,
      hardStopPassed:     body.hardStopPassed ?? false,
      completedAt:        body.complete ? new Date().toISOString() : null,
    };

    const existing = await pb.collection("litigation_intakes").getFullList({
      filter: `document = "${req.params.documentId}"`,
    });

    let intake: PBRecord;
    if (existing.length > 0) {
      intake = await pb.collection("litigation_intakes").update(existing[0].id, data);
    } else {
      intake = await pb.collection("litigation_intakes").create({
        document: req.params.documentId,
        ...data,
      });
    }

    res.json(mapIntake(intake));
  }));

  // ── Ancillary Documents ───────────────────────────────────────────────────────

  app.post(
    "/api/ancillary/:documentId",
    requireAuth,
    uploadAncillary.single("file"),
    ah(async (req: Request, res: Response) => {
      const file = req.file;
      if (!file) { sendError(res, 400, "No file uploaded"); return; }

      const privilegeFlag = (req.body as { privilegeFlag?: string }).privilegeFlag === "true";
      const fileType = classifyFileType(file.originalname);

      const ancillary = await pb.collection("ancillary_documents").create({
        document: req.params.documentId,
        originalName: file.originalname,
        filename: file.filename,
        fileType,
        privilegeFlag,
      });

      res.json(mapAncillary(ancillary));

      // Fire-and-forget transcription for audio/video
      if (fileType === "AUDIO" || fileType === "VIDEO") {
        const fullPath = path.join(process.cwd(), "uploads", file.filename);
        transcribeAudioFile(fullPath).then(async (transcription) => {
          if (transcription) {
            await pb.collection("ancillary_documents").update(ancillary.id, { transcription });
          }
        }).catch(console.error);
      }
    })
  );

  app.get("/api/ancillary/:documentId", requireAuth, ah(async (req: Request, res: Response) => {
    const docs = await pb.collection("ancillary_documents").getFullList({
      filter: `document = "${req.params.documentId}"`,
      sort: "-id",
    });
    res.json(docs.map(mapAncillary));
  }));

  app.delete("/api/ancillary/:ancillaryId", requireAuth, ah(async (req: Request, res: Response) => {
    await pb.collection("ancillary_documents").delete(req.params.ancillaryId);
    res.json({ ok: true });
  }));

  // ── Audit Trail ──────────────────────────────────────────────────────────────

  app.get("/api/audit", requireAuth, ah(async (req: Request, res: Response) => {
    const limit  = Math.min(parseInt((req.query.limit as string) ?? "50", 10), 200);
    const page   = parseInt((req.query.page as string) ?? "1", 10);
    const format = req.query.format as string | undefined; // "csv" for export

    // Build filter
    const filters: string[] = [];
    if (req.query.action)   filters.push(`action = "${req.query.action}"`);
    if (req.query.from)     filters.push(`created >= "${req.query.from}"`);
    if (req.query.to)       filters.push(`created <= "${req.query.to}"`);
    if (req.query.entityId) filters.push(`entityId = "${req.query.entityId}"`);
    const filterStr = filters.join(" && ");

    if (format === "csv") {
      // Full export - no pagination, max 5000 rows
      const rows = await pb.collection("audit_log").getFullList({
        sort: "-created",
        filter: filterStr || undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      const header = "id,action,entityType,entityId,companyId,userId,createdAt,detail\n";
      const body = rows.map((r) => {
        const cols = [
          r.id,
          r["action"],
          r["entityType"] ?? "",
          r["entityId"] ?? "",
          r["companyId"] ?? "",
          r["userId"] ?? "",
          r.created,
          JSON.stringify(r["detail"] ?? "{}").replace(/"/g, '""'),
        ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
        return cols;
      }).join("\n");

      // Audit the export itself. companyId must be a real company record id
      // (auditLogger sets it on the company relation); passing the user id here
      // made every audit_log_exported write fail relation validation silently.
      audit({
        action: "audit_log_exported",
        entityType: "audit_log",
        userId: req.user?.userId,
        detail: { rows: rows.length, filters: filterStr },
      }).catch(() => {});

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="audit-log-${new Date().toISOString().split("T")[0]}.csv"`);
      res.send(header + body);
      return;
    }

    const result = await pb.collection("audit_log").getList(page, limit, {
      sort: "-created",
      filter: filterStr || undefined,
    });

    res.json({
      entries: result.items.map((r) => ({
        id: r.id,
        action: r["action"],
        entityType: r["entityType"],
        entityId: r["entityId"],
        companyId: r["companyId"],
        userId: r["userId"],
        detail: r["detail"] ? (() => { try { return JSON.parse(r["detail"] as string); } catch { return {}; } })() : {},
        createdAt: r.created,
      })),
      totalPages: result.totalPages,
      totalItems: result.totalItems,
      page: result.page,
    });
  }));

  // ── Per-contract audit history ────────────────────────────────────────────────
  // Chronological history of one agreement: pipeline events, RAG assignments,
  // human decisions with captured reasons, escalations, outcome capture, and
  // version movement. Aggregates audit_log entries linked to the document, its
  // review results, or its extracted clauses (plus entries carrying the
  // document id in their detail JSON), decision_events, and the version chain.
  // The system-wide /api/audit endpoint is untouched.
  app.get("/api/documents/:id/audit", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 404, "No company configured"); return; }
    const doc = await pb.collection("uploaded_documents").getOne(req.params.id).catch(() => null);
    if (!doc || doc["company"] !== company.id) { sendError(res, 404, "Document not found"); return; }

    const results: PBRecord[] = await pb.collection("review_results").getFullList({
      filter: `document = "${req.params.id}"`,
      fields: "id,clause,clauseCategory,ragStatus,recommendedAction,escalationRequired,escalationTrigger",
    }).catch(() => [] as PBRecord[]);
    const byResult = new Map(results.map((r) => [r.id, r]));
    const byClause = new Map(results.filter((r) => r["clause"]).map((r) => [r["clause"] as string, r]));

    const idFilters = [
      `entityId = "${req.params.id}"`,
      ...results.map((r) => `entityId = "${r.id}"`),
      ...results.filter((r) => r["clause"]).map((r) => `entityId = "${r["clause"]}"`),
      // Entries that carry this document's id as their documentId detail field.
      // Matched structurally (key and value), not as a bare substring: other
      // writers embed foreign document ids under keys like sourceDocumentId or
      // matchedDocumentId, and a bare substring match would attribute those
      // documents' events to this contract.
      `detail ~ '"documentId":"${req.params.id}"'`,
    ];
    const entries: PBRecord[] = await pb.collection("audit_log").getFullList({
      filter: idFilters.join(" || "),
      sort: "+created",
    }).catch(() => [] as PBRecord[]);

    const auditEvents = entries.map((e) => {
      const detail = (() => {
        try { return JSON.parse((e["detail"] as string) || "{}"); } catch { return {}; }
      })() as Record<string, unknown>;
      const linked = byResult.get(e["entityId"] as string) ?? byClause.get(e["entityId"] as string);
      return {
        id: e.id,
        at: e.created,
        kind: "audit" as const,
        action: e["action"] as string,
        detail,
        clauseCategory: (detail.clauseCategory as string) ?? (linked?.["clauseCategory"] as string) ?? null,
        ragStatus: (detail.ragStatus as string) ?? (detail.overrideTo as string) ?? (linked?.["ragStatus"] as string) ?? null,
        escalationTrigger: (linked?.["escalationTrigger"] as string) ?? null,
      };
    });

    // Human decisions with captured reasoning
    const decisions: PBRecord[] = await pb.collection("decision_events").getFullList({
      filter: `contract = "${req.params.id}"`,
      sort: "+created",
    }).catch(() => [] as PBRecord[]);
    const decisionEvents = decisions.map((d) => ({
      id: d.id,
      at: d.created,
      kind: "decision" as const,
      action: "decision_captured",
      detail: {
        zaneRecommendation: d["zane_recommendation"] ?? "",
        humanAction: d["human_action"] ?? "",
        finalPosition: d["human_final_position"] ?? "",
        overrideReason: d["override_reason"] ?? "",
        reasonCategory: d["reasoning_category"] ?? "",
        reasonText: d["reasoning_text"] ?? "",
      },
      clauseCategory: (d["clause_category"] as string) || null,
      ragStatus: null,
      escalationTrigger: null,
    }));

    // Version movement from the document chain. Both directions are scoped to
    // the caller's company so a forged parentDocumentId can never surface
    // another tenant's document names in this timeline.
    const versionEvents: Array<{ id: string; at: unknown; kind: "version"; action: string; detail: Record<string, unknown>; clauseCategory: null; ragStatus: null; escalationTrigger: null }> = [];
    if (doc["parentDocumentId"]) {
      const parent = await pb.collection("uploaded_documents").getOne(doc["parentDocumentId"] as string).catch(() => null);
      if (parent && parent["company"] === company.id) {
        versionEvents.push({
          id: "version-parent",
          at: doc.created,
          kind: "version",
          action: "uploaded_as_new_version",
          detail: { parentName: parent["originalName"], parentId: doc["parentDocumentId"] },
          clauseCategory: null, ragStatus: null, escalationTrigger: null,
        });
      }
    }
    const children: PBRecord[] = await pb.collection("uploaded_documents").getFullList({
      filter: `parentDocumentId = "${req.params.id}" && company = "${company.id}"`,
      fields: "id,originalName,created,reviewType",
    }).catch(() => [] as PBRecord[]);
    for (const c of children) {
      versionEvents.push({
        id: `version-${c.id}`,
        at: c.created,
        kind: "version",
        action: "new_version_uploaded",
        detail: { childName: c["originalName"], childId: c.id, reviewType: c["reviewType"] ?? "" },
        clauseCategory: null, ragStatus: null, escalationTrigger: null,
      });
    }

    // A single human action writes both an audit_log entry and a decision_events
    // record. Pair them by clause category within a 10 minute window and keep
    // one per pair: the decision event for plain feedback (it carries the
    // recommendation and captured reason), the audit entry for overrides,
    // corrections, and false positives (it carries the from/to specifics).
    const PAIR_WINDOW_MS = 10 * 60 * 1000;
    const paired = (a: { at: unknown; clauseCategory: string | null }, d: { at: unknown; clauseCategory: string | null }) =>
      a.clauseCategory != null && a.clauseCategory === d.clauseCategory &&
      Math.abs(new Date(String(a.at ?? 0)).getTime() - new Date(String(d.at ?? 0)).getTime()) < PAIR_WINDOW_MS;

    const droppedAudit = new Set<string>();
    const droppedDecision = new Set<string>();
    const FEEDBACK_ACTIONS = new Set(["feedback_accepted", "feedback_edited", "feedback_escalated", "feedback_dismissed"]);
    const OVERRIDE_ACTIONS = new Set(["teach_zane_correction", "false_positive_marked"]);
    for (const a of auditEvents) {
      const isOverrideRag = a.action === "rag_status_assigned" && typeof a.detail.overrideTo === "string";
      if (!FEEDBACK_ACTIONS.has(a.action) && !OVERRIDE_ACTIONS.has(a.action) && !isOverrideRag) continue;
      const match = decisionEvents.find((d) => !droppedDecision.has(d.id) && paired(a, d));
      if (!match) continue;
      if (FEEDBACK_ACTIONS.has(a.action)) droppedAudit.add(a.id);
      else droppedDecision.add(match.id);
    }

    const events = [
      ...auditEvents.filter((e) => !droppedAudit.has(e.id)),
      ...decisionEvents.filter((e) => !droppedDecision.has(e.id)),
      ...versionEvents,
    ].sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")));

    res.json({ documentId: req.params.id, documentName: doc["originalName"], events });
  }));

  // ── Approvals queue (end-to-end approval flow) ────────────────────────────────

  // GET /api/approvals - the company's approval requests, newest first.
  // Optional ?role=CFO and ?status=PENDING filters for the per-role queue.
  app.get("/api/approvals", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json({ approvals: [] }); return; }

    const filters = [`company = "${company.id}"`];
    // role and status are user-controlled query strings interpolated into a
    // PocketBase filter: restrict to the uppercase token shape real values
    // take so quote characters can never alter the filter.
    const { role, status } = req.query as Record<string, string>;
    if (role && /^[A-Z_]{1,24}$/.test(role)) filters.push(`routedToRole = "${role}"`);
    if (status && /^[A-Z]{1,12}$/.test(status)) filters.push(`status = "${status}"`);
    const records = await pb.collection("approval_requests").getFullList({
      filter: filters.join(" && "),
      sort: "-created",
    }).catch(() => [] as PBRecord[]);

    // Enrich with document metadata in one pass
    const docIds = Array.from(new Set(records.map((r) => r["document"] as string)));
    const docs = await Promise.all(docIds.map((id) =>
      pb.collection("uploaded_documents").getOne(id, { fields: "id,originalName,counterpartyName,contractValue,currency,contractType" }).catch(() => null)
    ));
    const docById = new Map(docs.filter(Boolean).map((d) => [d!.id, d!]));

    res.json({
      approvals: records.map((r) => {
        const d = docById.get(r["document"] as string);
        return {
          id: r.id,
          documentId: r["document"],
          documentName: d?.["originalName"] ?? "Contract no longer in the library",
          counterpartyName: d?.["counterpartyName"] ?? "",
          contractValue: d?.["contractValue"] ?? null,
          currency: d?.["currency"] ?? "GBP",
          contractType: d?.["contractType"] ?? "",
          clauseCategory: r["clauseCategory"] || null,
          routedToRole: r["routedToRole"],
          reason: r["reason"] ?? "",
          status: r["status"],
          requestedBy: r["requestedBy"] ?? "",
          createdAt: r.created,
          decidedAt: r["decidedAt"] ?? null,
          decidedByName: r["decidedByName"] ?? "",
          deciderRole: r["deciderRole"] ?? "",
          decisionReason: r["decisionReason"] ?? "",
        };
      }),
    });
  }));

  // GET /api/approvals/:id - the focused decision view payload: the request,
  // contract facts, the flagged clause in plain English, and the relevant
  // playbook position.
  app.get("/api/approvals/:id", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 404, "No company configured"); return; }
    const rec = await pb.collection("approval_requests").getOne(req.params.id).catch(() => null);
    if (!rec || rec["company"] !== company.id) { sendError(res, 404, "Approval request not found"); return; }

    const doc = await pb.collection("uploaded_documents").getOne(rec["document"] as string).catch(() => null);
    const result = rec["result"]
      ? await pb.collection("review_results").getOne(rec["result"] as string).catch(() => null)
      : null;
    // clauseCategory can be user-authored text on custom playbook rules:
    // strip quote characters so the stored value cannot alter the filter and
    // escape the company scope.
    const safeCat = String(rec["clauseCategory"] ?? "").replace(/["'\\]/g, "");
    const rules = safeCat
      ? await pb.collection("playbook_rules").getFullList({
          filter: `company = "${company.id}" && clauseCategory = "${safeCat}"`,
        }).catch(() => [] as PBRecord[])
      : [];
    const rule = rules[0] ?? null;

    res.json({
      id: rec.id,
      status: rec["status"],
      routedToRole: rec["routedToRole"],
      reason: rec["reason"] ?? "",
      clauseCategory: rec["clauseCategory"] || null,
      requestedBy: rec["requestedBy"] ?? "",
      createdAt: rec.created,
      decidedAt: rec["decidedAt"] ?? null,
      decidedByName: rec["decidedByName"] ?? "",
      deciderRole: rec["deciderRole"] ?? "",
      decisionReason: rec["decisionReason"] ?? "",
      document: doc ? {
        id: doc.id,
        name: doc["originalName"],
        counterpartyName: doc["counterpartyName"] ?? "",
        contractValue: doc["contractValue"] ?? null,
        currency: doc["currency"] ?? "GBP",
        contractType: doc["contractType"] ?? "",
      } : null,
      clause: result ? {
        ragStatus: result["ragStatus"],
        plainEnglish: (result["businessSummary"] as string) || (result["whyItMatters"] as string) || (result["clauseSummary"] as string) || "",
        recommendedAction: result["recommendedAction"] ?? "",
        escalationTrigger: result["escalationTrigger"] ?? "",
      } : null,
      playbookPosition: rule ? {
        preferred: rule["preferredPosition"] ?? "",
        redLine: rule["hardRedLine"] ?? "",
      } : null,
    });
  }));

  // POST /api/approvals/:id/decide - resolve a pending request. Both decisions
  // require a typed reason. Writes the immutable audit entry (approver name,
  // role, decision, reason, timestamp), updates the escalation state, and
  // notifies the requester (email sends once SMTP is configured).
  app.post("/api/approvals/:id/decide", requireAuth, ah(async (req: Request, res: Response) => {
    const { decision, reason } = req.body as { decision?: string; reason?: string };
    if (decision !== "APPROVED" && decision !== "REJECTED") { sendError(res, 400, "decision must be APPROVED or REJECTED"); return; }
    if (!reason || !reason.trim()) { sendError(res, 400, "A reason is required for the audit record"); return; }

    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 404, "No company configured"); return; }
    const rec = await pb.collection("approval_requests").getOne(req.params.id).catch(() => null);
    if (!rec || rec["company"] !== company.id) { sendError(res, 404, "Approval request not found"); return; }
    if (rec["status"] !== "PENDING") { sendError(res, 409, "This request has already been decided"); return; }

    // Pilot-stage authorization model: the queue is shared within the company
    // and any signed-in member can record a decision (lean teams act on each
    // other's behalf). The audit entry therefore records who actually decided
    // and their own configured role alongside the role the request was routed
    // to, so the record never asserts a role the decider does not hold.
    const approver = req.user?.userId
      ? await pb.collection("users").getOne(req.user.userId).catch(() => null)
      : null;
    const approverName = ((approver?.["name"] as string) || req.user?.email || "Unknown").trim();
    const approverActualRole = ((approver?.["role"] as string) || "").trim();
    const decidedAt = new Date().toISOString().replace("T", " ");

    // Re-check just before writing: the PENDING guard above is not atomic, so
    // narrow the double-decide window to the final read.
    const fresh = await pb.collection("approval_requests").getOne(rec.id).catch(() => null);
    if (!fresh || fresh["status"] !== "PENDING") { sendError(res, 409, "This request has already been decided"); return; }

    const updated = await pb.collection("approval_requests").update(rec.id, {
      status: decision,
      decidedByName: approverName,
      decidedByEmail: req.user?.email ?? "",
      deciderRole: rec["routedToRole"],
      decisionReason: reason.trim(),
      decidedAt,
    });

    await audit({
      action: decision === "APPROVED" ? "approval_granted" : "approval_rejected",
      entityType: "approval_request",
      entityId: rec.id,
      companyId: company.id,
      userId: req.user?.userId,
      detail: {
        documentId: rec["document"],
        clauseCategory: rec["clauseCategory"] ?? "",
        role: rec["routedToRole"],
        decision,
        reason: reason.trim(),
        approverName,
        approverEmail: req.user?.email ?? "",
        approverActualRole,
      },
    });

    // An approval resolves the open escalation on the linked clause: record
    // the escalation as acted on so pending counts clear. A rejection leaves
    // the clause blocked on purpose - the contract must be renegotiated.
    if (decision === "APPROVED" && rec["result"]) {
      const existing = await pb.collection("user_feedback").getFullList({
        filter: `result = "${rec["result"]}"`,
      }).catch(() => [] as PBRecord[]);
      const approvalNote = `Approved by ${approverName} (${rec["routedToRole"]}): ${reason.trim()}`;
      if (existing.length > 0) {
        // Preserve any prior reviewer notes; append the approval record. If
        // the lawyer already resolved the clause another way (accepted,
        // edited, dismissed) after this request was raised, keep their
        // recorded action and only append the note: a stale approval must not
        // rewrite the reviewer's decision.
        const priorNotes = ((existing[0]["notes"] as string) || "").trim();
        const priorAction = ((existing[0]["userAction"] as string) || "").trim();
        const keepAction = priorAction && priorAction !== "ESCALATED";
        await pb.collection("user_feedback").update(existing[0].id, {
          ...(keepAction ? {} : { userAction: "ESCALATED" }),
          notes: priorNotes ? `${priorNotes}\n${approvalNote}` : approvalNote,
        }).catch(() => null);
      } else {
        await pb.collection("user_feedback").create({
          result: rec["result"],
          feedbackType: "STANDARD",
          userAction: "ESCALATED",
          notes: approvalNote,
        }).catch(() => null);
      }
    }

    // Notify the requester (no-op until SMTP is configured)
    const requestedBy = (rec["requestedBy"] as string) ?? "";
    if (requestedBy) {
      const doc = await pb.collection("uploaded_documents").getOne(rec["document"] as string, { fields: "id,originalName" }).catch(() => null);
      void sendApprovalDecisionEmail({
        to: requestedBy,
        contractName: (doc?.["originalName"] as string) ?? "Contract",
        decision,
        deciderName: approverName,
        deciderRole: rec["routedToRole"] as string,
        reason: reason.trim(),
        documentId: rec["document"] as string,
      });
    }

    res.json({ id: updated.id, status: updated["status"], decidedAt: updated["decidedAt"] });
  }));

  // ── Document text (for the split review view) ─────────────────────────────────
  // Returns the contract text as ordered blocks for the document pane beside the
  // findings. No full document text or per-clause character offsets are stored at
  // review time, so this reconstructs the text: the original file is re-parsed
  // when still on disk (source "parsed"), otherwise the stored extracted clause
  // passages are used (source "clauses"). Each block is tagged with the clause
  // categories it carries so the client can scroll to and highlight the passage
  // for a selected finding without offsets. Read-only; changes no analysis.
  // A reviewed document's source file and extracted clauses are immutable, so
  // the reconstructed blocks are cached per process. This avoids re-parsing the
  // file (mammoth / pdf-parse, up to ~30s for large PDFs) on every page load and
  // for every viewer; the tenant check still runs on each request before serving.
  const documentTextCache = new Map<string, { source: string; blocks: unknown[]; documentName: unknown }>();
  const DOCUMENT_TEXT_CACHE_MAX = 200;

  app.get("/api/documents/:id/text", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 404, "No company configured"); return; }
    const doc = await pb.collection("uploaded_documents").getOne(req.params.id).catch(() => null);
    if (!doc || doc["company"] !== company.id) { sendError(res, 404, "Document not found"); return; }

    const cached = documentTextCache.get(req.params.id);
    if (cached) { res.json({ documentId: req.params.id, ...cached }); return; }

    const clauses = await pb.collection("extracted_clauses").getFullList({
      filter: `document = "${req.params.id}"`,
      fields: "id,clauseCategory,rawText",
      sort: "+id",
    }).catch(() => [] as PBRecord[]);

    type Block = { id: string; text: string; clauseCategories: string[] };

    // Full text from the file on disk when it is still present.
    let fullText = "";
    const filename = doc["filename"] as string | undefined;
    if (filename) {
      const filePath = path.join(process.cwd(), "uploads", filename);
      if (fs.existsSync(filePath)) {
        try {
          const parsed = await parseDocument(filePath);
          if (parsed.text.trim().length > 20) fullText = parsed.text;
        } catch { /* fall through to clause reconstruction */ }
      }
    }

    let blocks: Block[] = [];
    let source: "parsed" | "clauses" | "empty" = "empty";

    if (fullText) {
      source = "parsed";
      const paras = fullText.split(/\n{2,}/).map((p) => p.replace(/\s+\n/g, "\n").trim()).filter((p) => p.length > 0);
      blocks = paras.map((text, i) => ({ id: `b${i}`, text, clauseCategories: [] as string[] }));
      // Tag paragraphs by finding the clause passage inside them (best-effort,
      // no offsets exist). Use a normalised prefix of the clause text.
      for (const c of clauses) {
        const raw = String(c["rawText"] ?? "").trim();
        if (!raw) continue;
        const needle = raw.slice(0, 60).toLowerCase().replace(/\s+/g, " ");
        const hit = blocks.find((b) => b.text.toLowerCase().replace(/\s+/g, " ").includes(needle));
        if (hit && !hit.clauseCategories.includes(c["clauseCategory"] as string)) {
          hit.clauseCategories.push(c["clauseCategory"] as string);
        }
      }
    } else if (clauses.length > 0) {
      source = "clauses";
      // Deduplicate by passage text: the classifier stores one chunk per clause
      // category and categories can share a chunk, so group them into one block.
      const byText = new Map<string, Block>();
      for (const c of clauses) {
        const text = String(c["rawText"] ?? "").trim();
        if (!text) continue;
        const key = text.slice(0, 200);
        const existing = byText.get(key);
        if (existing) {
          if (!existing.clauseCategories.includes(c["clauseCategory"] as string)) {
            existing.clauseCategories.push(c["clauseCategory"] as string);
          }
        } else {
          byText.set(key, { id: `c${byText.size}`, text, clauseCategories: [c["clauseCategory"] as string] });
        }
      }
      blocks = Array.from(byText.values());
    }

    // Cache the reconstructed blocks (bounded, oldest evicted first).
    if (documentTextCache.size >= DOCUMENT_TEXT_CACHE_MAX) {
      const oldest = documentTextCache.keys().next().value;
      if (oldest !== undefined) documentTextCache.delete(oldest);
    }
    documentTextCache.set(req.params.id, { source, blocks, documentName: doc["originalName"] });

    res.json({ documentId: req.params.id, documentName: doc["originalName"], source, blocks });
  }));

  // ── Contract library ──────────────────────────────────────────────────────────

  // GET /api/library - documents grouped by folder, with version chain resolution
  app.get("/api/library", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json({ folders: [] }); return; }

    const { search } = req.query as Record<string, string>;
    const docs = await pb.collection("uploaded_documents").getFullList({
      sort: "-id",
      filter: `company = "${company.id}"`,
    });

    let filtered = docs;
    if (search) {
      const q = search.toLowerCase();
      filtered = docs.filter((d) =>
        (d["originalName"] as string)?.toLowerCase().includes(q) ||
        (d["counterpartyName"] as string)?.toLowerCase().includes(q) ||
        (d["contractTags"] as string)?.toLowerCase().includes(q) ||
        (d["folder"] as string)?.toLowerCase().includes(q)
      );
    }

    // Group by folder (default folder = contract type label for unassigned docs)
    const groups: Record<string, typeof filtered> = {};
    for (const d of filtered) {
      const folder = (d["folder"] as string) || (d["contractType"] as string)?.replace(/_/g, " ") || "Ungrouped";
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(d);
    }

    const folders = Object.entries(groups).map(([name, items]) => ({
      name,
      count: items.length,
      documents: items.map(mapDoc),
    })).sort((a, b) => b.count - a.count);

    res.json({ folders, total: filtered.length });
  }));

  // PATCH /api/documents/:id/folder - assign a folder
  app.patch("/api/documents/:id/folder", requireAuth, ah(async (req: Request, res: Response) => {
    const { folder } = req.body as { folder: string };
    const updated = await pb.collection("uploaded_documents").update(req.params.id, { folder });
    res.json(mapDoc(updated));
  }));

  // PATCH /api/documents/:id/version - link to parent document version
  app.patch("/api/documents/:id/version", requireAuth, ah(async (req: Request, res: Response) => {
    const { parentDocumentId } = req.body as { parentDocumentId: string };
    // Both ends of a version link must belong to the caller's company. Without
    // this, an arbitrary parentDocumentId injects cross-tenant document names
    // into version chains and the per-contract audit history.
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 404, "No company configured"); return; }
    const child = await pb.collection("uploaded_documents").getOne(req.params.id).catch(() => null);
    if (!child || child["company"] !== company.id) { sendError(res, 404, "Document not found"); return; }
    if (parentDocumentId) {
      const parent = await pb.collection("uploaded_documents").getOne(parentDocumentId).catch(() => null);
      if (!parent || parent["company"] !== company.id) { sendError(res, 404, "Parent document not found"); return; }
    }
    const updated = await pb.collection("uploaded_documents").update(req.params.id, { parentDocumentId });
    res.json(mapDoc(updated));
  }));

  // ── Outcome capture ───────────────────────────────────────────────────────────

  app.post("/api/documents/:id/outcome", requireAuth, ah(async (req: Request, res: Response) => {
    const { outcome = "SIGNED", outcomeNotes = "" } = req.body as { outcome?: string; outcomeNotes?: string };
    const doc = await pb.collection("uploaded_documents").getOne(req.params.id);
    const updated = await pb.collection("uploaded_documents").update(req.params.id, {
      outcome,
      signedAt: new Date().toISOString(),
      outcomeNotes,
    });

    await audit({
      action: "contract_outcome_captured",
      entityType: "uploaded_document",
      entityId: req.params.id,
      companyId: doc["company"] as string,
      userId: req.user?.userId,
      detail: { outcome, originalName: doc["originalName"] },
    });

    // Re-run outcome pattern aggregation - fire-and-forget
    const { persistOutcomePatterns } = await import("./services/outcomeCapture.js");
    persistOutcomePatterns(doc["company"] as string).catch((err: unknown) =>
      console.error("[outcome capture] pattern update failed:", err)
    );

    res.json(mapDoc(updated));
  }));

  // ── Approval thresholds ──────────────────────────────────────────────────────

  app.get("/api/governance/thresholds", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json([]); return; }
    const rows = await pb.collection("approval_thresholds").getFullList({
      filter: `companyId = "${company.id}"`,
      sort: "+minValue",
    });
    res.json(rows);
  }));

  app.post("/api/governance/thresholds", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 400, "Company not found"); return; }
    const thresholds = req.body as Array<{ minValue: number; maxValue: number | null; requiredApprover: string; label: string }>;
    // Replace existing thresholds for this company
    const existing = await pb.collection("approval_thresholds").getFullList({ filter: `companyId = "${company.id}"` });
    await Promise.all(existing.map((r) => pb.collection("approval_thresholds").delete(r.id)));
    const created = await Promise.all(thresholds.map((t) => pb.collection("approval_thresholds").create({ ...t, companyId: company.id })));
    res.json(created);
  }));

  // ── Governance triggers ──────────────────────────────────────────────────────

  app.get("/api/governance/triggers", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json([]); return; }
    const rows = await pb.collection("governance_triggers").getFullList({
      filter: `companyId = "${company.id}"`,
      sort: "+clauseCategory",
    });
    res.json(rows);
  }));

  app.post("/api/governance/triggers", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 400, "Company not found"); return; }
    const triggers = req.body as Array<{ clauseCategory: string; escalateTo: string; reason: string }>;
    const existing = await pb.collection("governance_triggers").getFullList({ filter: `companyId = "${company.id}"` });
    await Promise.all(existing.map((r) => pb.collection("governance_triggers").delete(r.id)));
    const created = await Promise.all(triggers.map((t) => pb.collection("governance_triggers").create({ ...t, companyId: company.id })));
    res.json(created);
  }));

  // ── Team invites ──────────────────────────────────────────────────────────────

  app.post("/api/team/invite", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 400, "Company not found"); return; }
    const { emails, role = "LEGAL" } = req.body as { emails: string[]; role?: string };
    if (!Array.isArray(emails) || emails.length === 0) { sendError(res, 400, "No emails provided"); return; }
    const created = await Promise.all(
      emails.map((email) => pb.collection("team_invites").create({ companyId: company.id, email, role, status: "pending" }))
    );
    // Best-effort invite emails - import sendEscalationEmail-like mailer if SMTP configured
    res.json({ invited: created.map((r) => r.id).length });
  }));

  // ── Cross-document reference checking ─────────────────────────────────────────
  // The parent-agreement references found in a contract and whether the parent is
  // on file in the company's library.
  app.get("/api/contracts/:id/cross-references", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json({ crossRef: null }); return; }
    const doc = await pb.collection("uploaded_documents").getOne(req.params.id).catch(() => null);
    if (!doc || (doc["company"] as string) !== company.id) { res.json({ crossRef: null }); return; }
    const crossRef = await getCrossRefResult(req.params.id);
    res.json({ crossRef });
  }));

  // Re-check the detected references against the current library, e.g. after the
  // parent agreement has just been uploaded (Section 4: upload, then verify).
  app.post("/api/contracts/:id/cross-references/relink", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 400, "Company not found"); return; }
    const doc = await pb.collection("uploaded_documents").getOne(req.params.id).catch(() => null);
    if (!doc || (doc["company"] as string) !== company.id) { sendError(res, 404, "Not found"); return; }
    const crossRef = await relinkCrossReferences(req.params.id, company.id as string);
    res.json({ crossRef });
  }));

  // ── L3 synthesis ──────────────────────────────────────────────────────────────
  // Regenerate the company's synthesis pages (per-clause trends, overall posture,
  // applicable regulatory frameworks) from everything captured so far.
  app.post("/api/synthesis/generate", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 400, "Company not found"); return; }
    const result = await synthesiseCompany(company.id as string);
    res.json(result);
  }));

  // Read the latest synthesis: overall company posture + applicable regulatory
  // frameworks, and (optionally) the per-clause trend for one clause category.
  app.get("/api/synthesis", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json({ companyKnowledge: null, regulatory: null, playbook: null }); return; }
    const cid = company.id as string;
    const clause = typeof req.query.clause === "string" ? req.query.clause : "";
    const [companyKnowledge, regulatory, playbook] = await Promise.all([
      getCompanyKnowledge(cid).catch(() => null),
      getRegulatorySynthesis(cid).catch(() => null),
      clause ? getPlaybookSynthesis(cid, clause).catch(() => null) : Promise.resolve(null),
    ]);
    res.json({ companyKnowledge, regulatory, playbook });
  }));

  // ── New-joiner briefing (the inheritance layer) ───────────────────────────────
  // The latest assembled briefing for the company (and optionally a joiner).
  app.get("/api/team/briefing", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json({ briefing: null }); return; }
    const briefing = await getLatestBriefing(company.id as string, req.user?.userId).catch(() => null)
      ?? await getLatestBriefing(company.id as string).catch(() => null);
    res.json({ briefing });
  }));

  // Generate a fresh briefing from everything Zane has captured for the company.
  app.post("/api/team/briefing/generate", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 400, "Company not found"); return; }
    const forUser = (req.body as { forUserId?: string })?.forUserId || req.user?.userId || "";
    const briefing = await generateBriefing(company.id as string, forUser);
    res.json({ briefing });
  }));

  app.get("/api/team/invites", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json([]); return; }
    const rows = await pb.collection("team_invites").getFullList({
      filter: `companyId = "${company.id}"`,
      sort: "-id",
    });
    res.json(rows);
  }));

  app.delete("/api/team/invites/:id", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 404, "Company not found"); return; }
    const { id } = req.params as { id: string };
    try {
      const invite = await pb.collection("team_invites").getOne(id);
      if (invite["companyId"] !== company.id) { sendError(res, 403, "Forbidden"); return; }
      await pb.collection("team_invites").delete(id);
      res.json({ ok: true });
    } catch {
      sendError(res, 404, "Invite not found");
    }
  }));

  app.patch("/api/team/invites/:id", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 404, "Company not found"); return; }
    const { id } = req.params as { id: string };
    const { status } = req.body as { status?: string };
    try {
      const invite = await pb.collection("team_invites").getOne(id);
      if (invite["companyId"] !== company.id) { sendError(res, 403, "Forbidden"); return; }
      const updated = await pb.collection("team_invites").update(id, { status: status ?? "pending" });
      res.json(updated);
    } catch {
      sendError(res, 404, "Invite not found");
    }
  }));

  // ── Section 18 - Behavioural Accumulation Engine ─────────────────────────────

  // ── Step 1 - Outcome delta capture ───────────────────────────────────────────

  // Upload the final signed version of a document
  app.post(
    "/api/documents/:id/upload-final",
    requireAuth,
    upload.single("contract"),
    ah(async (req: Request, res: Response) => {
      let originalDoc: PBRecord;
      try {
        originalDoc = await pb.collection("uploaded_documents").getOne(req.params.id);
      } catch {
        sendError(res, 404, "Document not found"); return;
      }

      const file = req.file;
      if (!file) { sendError(res, 400, "No file uploaded"); return; }

      // Create new uploaded_documents record for the final version
      const finalDoc = await pb.collection("uploaded_documents").create({
        company: originalDoc["company"],
        filename: file.filename,
        originalName: file.originalname,
        contractType: originalDoc["contractType"],
        status: "UPLOADED",
        counterpartyName: originalDoc["counterpartyName"],
        counterpartyType: originalDoc["counterpartyType"],
        reviewType: "EXECUTION",
        governingLaw: originalDoc["governingLaw"],
        jurisdiction: originalDoc["jurisdiction"],
        contractValue: originalDoc["contractValue"],
        currency: originalDoc["currency"],
        parentDocumentId: req.params.id,
      });

      // Fire-and-forget comparison
      runDeltaComparison(req.params.id, finalDoc.id, originalDoc["company"] as string)
        .catch(console.error);

      res.json({ finalDocumentId: finalDoc.id, message: "Comparison running" });
    })
  );

  // Get outcome deltas for a document
  app.get("/api/documents/:id/outcome-delta", requireAuth, ah(async (req: Request, res: Response) => {
    let doc: PBRecord;
    try {
      doc = await pb.collection("uploaded_documents").getOne(req.params.id);
    } catch {
      sendError(res, 404, "Document not found"); return;
    }

    const deltas = await pb.collection("outcome_deltas").getFullList({
      filter: `document = "${req.params.id}"`,
      sort: "+clauseCategory",
    });

    // Load playbook rules for context
    const rules = await pb.collection("playbook_rules").getFullList({
      filter: `company = "${doc["company"] as string}"`,
    });
    const ruleByCategory = new Map<string, PBRecord>();
    for (const r of rules) ruleByCategory.set(r["clauseCategory"] as string, r);

    const enrichedDeltas = deltas.map((d) => {
      const rule = ruleByCategory.get(d["clauseCategory"] as string);
      return {
        ...d,
        playbookPreferred: rule?.["preferredPosition"] ?? null,
        playbookFallback: rule?.["acceptableFallback"] ?? null,
        playbookRedLine: rule?.["hardRedLine"] ?? null,
      };
    });

    const allConfirmed = deltas.length > 0 && deltas.every((d) => !!d["confirmedOutcome"]);
    const hasUnconfirmed = deltas.some((d) => !d["confirmedOutcome"]);

    res.json({ deltas: enrichedDeltas, allConfirmed, hasUnconfirmed });
  }));

  // Confirm outcome deltas (bulk)
  app.post("/api/documents/:id/outcome-delta/confirm", requireAuth, ah(async (req: Request, res: Response) => {
    const { confirmations } = req.body as {
      confirmations: Array<{ deltaId: string; confirmedOutcome: string; notes?: string }>;
    };

    if (!Array.isArray(confirmations) || confirmations.length === 0) {
      sendError(res, 400, "confirmations array required"); return;
    }

    let doc: PBRecord;
    try {
      doc = await pb.collection("uploaded_documents").getOne(req.params.id);
    } catch {
      sendError(res, 404, "Document not found"); return;
    }

    await Promise.all(
      confirmations.map((c) =>
        pb.collection("outcome_deltas").update(c.deltaId, {
          confirmedOutcome: c.confirmedOutcome,
          confirmedBy: req.user!.userId,
          confirmedAt: new Date().toISOString(),
          notes: c.notes ?? "",
        })
      )
    );

    // Fire-and-forget pattern detection
    runPatternDetection(doc["company"] as string).catch(console.error);

    res.json({ ok: true });
  }));

  // ── Step 2 - Override signal capture ─────────────────────────────────────────

  app.post("/api/review/:resultId/override", requireAuth, ah(async (req: Request, res: Response) => {
    const { correctedStatus, reason } = req.body as { correctedStatus: string; reason: string };

    if (!reason || reason.trim() === "") {
      sendError(res, 400, "reason is required"); return;
    }
    if (!correctedStatus) {
      sendError(res, 400, "correctedStatus is required"); return;
    }

    let result: PBRecord;
    try {
      result = await pb.collection("review_results").getOne(req.params.resultId);
    } catch {
      sendError(res, 404, "Review result not found"); return;
    }

    const docId = result["document"] as string;
    let doc: PBRecord;
    try {
      doc = await pb.collection("uploaded_documents").getOne(docId);
    } catch {
      sendError(res, 404, "Document not found"); return;
    }

    const companyRec = await pb.collection("companies").getOne(doc["company"] as string).catch(() => null);

    // Determine contract value band
    const contractValue = doc["contractValue"] as number | null;
    let contractValueBand = "";
    if (contractValue !== null && contractValue !== undefined) {
      if (contractValue < 50000) contractValueBand = "<50k";
      else if (contractValue < 250000) contractValueBand = "50k-250k";
      else if (contractValue < 1000000) contractValueBand = "250k-1m";
      else contractValueBand = ">1m";
    }

    await pb.collection("override_signals").create({
      company: doc["company"],
      result: req.params.resultId,
      clauseCategory: result["clauseCategory"],
      originalStatus: result["ragStatus"],
      correctedStatus,
      clauseText: result["clauseSummary"] ?? "",
      counterpartyType: doc["counterpartyType"] ?? "",
      contractType: doc["contractType"] ?? "",
      contractValueBand,
      userRole: "LEGAL",
      reason: reason.trim(),
      userId: req.user!.userId,
    });

    // Update the review result
    await pb.collection("review_results").update(req.params.resultId, {
      ragStatus: correctedStatus,
    });

    await audit({
      action: "rag_status_assigned",
      entityType: "review_result",
      entityId: req.params.resultId,
      companyId: doc["company"] as string,
      userId: req.user!.userId,
      detail: { overrideFrom: result["ragStatus"], overrideTo: correctedStatus, reason, documentId: result["document"], clauseCategory: result["clauseCategory"] },
    });

    // Decision data capture: RAG status override with the user's stated reason
    void recordDecisionEvent({
      companyId: doc["company"] as string,
      userId: req.user?.userId,
      documentId: docId,
      clauseCategory: (result["clauseCategory"] as string) ?? "",
      zaneRecommendation: deriveZaneRecommendation(result),
      zaneSuggestedText: (result["suggestedFallback"] as string) ?? "",
      humanAction: "overridden",
      humanFinalPosition: `RAG status overridden: ${result["ragStatus"]} → ${correctedStatus}`,
      overrideReason: reason.trim(),
    });

    res.json({ ok: true });
  }));

  // ── Step 3 - False positive capture ──────────────────────────────────────────

  app.post("/api/review/:resultId/false-positive", requireAuth, ah(async (req: Request, res: Response) => {
    const { errorType, correctInterpretation } = req.body as {
      errorType: string;
      correctInterpretation?: string;
    };

    if (!errorType) {
      sendError(res, 400, "errorType is required"); return;
    }

    let result: PBRecord;
    try {
      result = await pb.collection("review_results").getOne(req.params.resultId);
    } catch {
      sendError(res, 404, "Review result not found"); return;
    }

    const docId = result["document"] as string;
    let doc: PBRecord;
    try {
      doc = await pb.collection("uploaded_documents").getOne(docId);
    } catch {
      sendError(res, 404, "Document not found"); return;
    }

    await pb.collection("false_positive_signals").create({
      company: doc["company"],
      result: req.params.resultId,
      clauseCategory: result["clauseCategory"],
      errorType,
      originalExtractedText: result["clauseSummary"] ?? "",
      correctInterpretation: correctInterpretation ?? "",
      userId: req.user!.userId,
    });

    await audit({
      action: "false_positive_marked",
      entityType: "review_result",
      entityId: req.params.resultId,
      companyId: doc["company"] as string,
      userId: req.user!.userId,
      detail: { errorType, clauseCategory: result["clauseCategory"], documentId: result["document"] },
    });

    // Decision data capture: false-positive signal overrides Zane's flag
    void recordDecisionEvent({
      companyId: doc["company"] as string,
      userId: req.user?.userId,
      documentId: docId,
      clauseCategory: (result["clauseCategory"] as string) ?? "",
      zaneRecommendation: deriveZaneRecommendation(result),
      zaneSuggestedText: (result["suggestedFallback"] as string) ?? "",
      humanAction: "overridden",
      humanFinalPosition: correctInterpretation ?? "Flag marked as false positive",
      overrideReason: `False positive (${errorType})`,
    });

    res.json({ ok: true });
  }));

  // ── Step 5 - Company rules engine ────────────────────────────────────────────

  app.get("/api/company-rules", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json({ PENDING: [], ACTIVE: [], REJECTED: [] }); return; }

    const allRules = await pb.collection("company_rules").getFullList({
      filter: `company = "${company.id}"`,
      sort: "-id",
    });

    const grouped = {
      PENDING:  allRules.filter((r) => r["status"] === "PENDING"),
      ACTIVE:   allRules.filter((r) => r["status"] === "ACTIVE"),
      REJECTED: allRules.filter((r) => r["status"] === "REJECTED"),
    };

    res.json(grouped);
  }));

  app.post("/api/company-rules/:id/approve", requireAuth, ah(async (req: Request, res: Response) => {
    let rule: PBRecord;
    try {
      rule = await pb.collection("company_rules").getOne(req.params.id);
    } catch {
      sendError(res, 404, "Rule not found"); return;
    }

    const updated = await pb.collection("company_rules").update(req.params.id, {
      status: "ACTIVE",
      approvedBy: req.user!.userId,
      approvedAt: new Date().toISOString(),
      // If editedRuleText was set, it becomes the canonical rule text
      ruleText: (rule["editedRuleText"] as string) || (rule["ruleText"] as string),
    });

    res.json(updated);
  }));

  app.post("/api/company-rules/:id/reject", requireAuth, ah(async (req: Request, res: Response) => {
    try {
      await pb.collection("company_rules").getOne(req.params.id);
    } catch {
      sendError(res, 404, "Rule not found"); return;
    }

    const updated = await pb.collection("company_rules").update(req.params.id, {
      status: "REJECTED",
    });

    res.json(updated);
  }));

  app.patch("/api/company-rules/:id", requireAuth, ah(async (req: Request, res: Response) => {
    const { editedRuleText } = req.body as { editedRuleText: string };

    try {
      await pb.collection("company_rules").getOne(req.params.id);
    } catch {
      sendError(res, 404, "Rule not found"); return;
    }

    const updated = await pb.collection("company_rules").update(req.params.id, {
      editedRuleText: editedRuleText ?? "",
    });

    res.json(updated);
  }));

  // ── Step 7 - Visibility layer routes ──────────────────────────────────────────

  // Signals summary per clause category
  app.get("/api/accumulation/signals-summary", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json({ overrideCount: 0, outcomeCount: 0, ruleCount: 0, fpCount: 0 }); return; }

    const clauseCategory = req.query.clauseCategory as string | undefined;
    if (!clauseCategory) { sendError(res, 400, "clauseCategory required"); return; }

    const [overrides, outcomes, rules, fps] = await Promise.all([
      pb.collection("override_signals").getFullList({
        filter: `company = "${company.id}" && clauseCategory = "${clauseCategory}"`,
        fields: "id",
      }).catch(() => []),
      pb.collection("outcome_deltas").getFullList({
        filter: `company = "${company.id}" && clauseCategory = "${clauseCategory}" && confirmedOutcome != ""`,
        fields: "id",
      }).catch(() => []),
      pb.collection("company_rules").getFullList({
        filter: `company = "${company.id}" && clauseCategory = "${clauseCategory}" && status = "ACTIVE"`,
        fields: "id",
      }).catch(() => []),
      pb.collection("false_positive_signals").getFullList({
        filter: `company = "${company.id}" && clauseCategory = "${clauseCategory}"`,
        fields: "id",
      }).catch(() => []),
    ]);

    res.json({
      overrideCount: overrides.length,
      outcomeCount: outcomes.length,
      ruleCount: rules.length,
      fpCount: fps.length,
    });
  }));

  // Accumulation progress for dashboard card
  app.get("/api/accumulation/progress", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) {
      res.json({
        contractsReviewed: 0, outcomesLogged: 0, patternsDetected: 0, rulesActive: 0,
        overrideRate: 0, overrideRatePrev: 0, insight: "",
      });
      return;
    }

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().replace("T", " ").split(".")[0];
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().replace("T", " ").split(".")[0];
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().replace("T", " ").split(".")[0];

    // Fetch complete docs first so we can filter review results without chained relation queries
    const completeDocs: PBRecord[] = await pb.collection("uploaded_documents").getFullList({
      filter: `company = "${company.id}" && status = "COMPLETE"`,
      fields: "id",
    }).catch(() => []);
    const completeDocIdSet = new Set(completeDocs.map((d) => d.id as string));

    const [
      confirmedOutcomes,
      pendingRules,
      activeRules,
      allResultsRaw,
      thisMonthOverrides,
      lastMonthResultsRaw,
      lastMonthOverrides,
      belowFallbackDeltas,
    ] = await Promise.all([
      pb.collection("outcome_deltas").getFullList({
        filter: `company = "${company.id}" && confirmedOutcome != ""`,
        fields: "id",
      }).catch(() => []),
      pb.collection("company_rules").getFullList({
        filter: `company = "${company.id}" && status = "PENDING"`,
        fields: "id",
      }).catch(() => []),
      pb.collection("company_rules").getFullList({
        filter: `company = "${company.id}" && status = "ACTIVE"`,
        fields: "id",
      }).catch(() => []),
      pb.collection("review_results").getFullList({
        filter: `created >= "${thisMonthStart}"`,
        fields: "id,document",
      }).catch(() => [] as PBRecord[]),
      pb.collection("override_signals").getFullList({
        filter: `company = "${company.id}" && created >= "${thisMonthStart}"`,
        fields: "id",
      }).catch(() => []),
      pb.collection("review_results").getFullList({
        filter: `created >= "${lastMonthStart}" && created < "${lastMonthEnd}"`,
        fields: "id,document",
      }).catch(() => [] as PBRecord[]),
      pb.collection("override_signals").getFullList({
        filter: `company = "${company.id}" && created >= "${lastMonthStart}" && created < "${lastMonthEnd}"`,
        fields: "id",
      }).catch(() => []),
      pb.collection("outcome_deltas").getFullList({
        filter: `company = "${company.id}" && confirmedOutcome = "BELOW_FALLBACK"`,
        sort: "-confirmedAt",
      }).catch(() => [] as PBRecord[]),
    ]);

    // Filter review results to this company's docs only (avoids chained relation filter)
    const allResults = allResultsRaw.filter((r) => completeDocIdSet.has(r["document"] as string));
    const lastMonthResults = lastMonthResultsRaw.filter((r) => completeDocIdSet.has(r["document"] as string));

    const overrideRate = allResults.length > 0
      ? Math.round((thisMonthOverrides.length / allResults.length) * 100)
      : 0;
    const overrideRatePrev = lastMonthResults.length > 0
      ? Math.round((lastMonthOverrides.length / lastMonthResults.length) * 100)
      : 0;

    // Generate insight from most frequent BELOW_FALLBACK pattern
    let insight = "";
    if (belowFallbackDeltas.length > 0) {
      const catCounts: Record<string, number> = {};
      for (const d of belowFallbackDeltas) {
        const cat = d["clauseCategory"] as string;
        catCounts[cat] = (catCounts[cat] ?? 0) + 1;
      }
      const topCat = Object.entries(catCounts).sort(([, a], [, b]) => b - a)[0];
      if (topCat) {
        insight = `Zane has learned that ${company.name as string} consistently accepts below-fallback positions on ${topCat[0].replace(/_/g, " ").toLowerCase()} clauses (${topCat[1]} confirmed).`;
      }
    }

    res.json({
      contractsReviewed: completeDocs.length,
      outcomesLogged: confirmedOutcomes.length,
      patternsDetected: pendingRules.length,
      rulesActive: activeRules.length,
      overrideRate,
      overrideRatePrev,
      insight,
    });
  }));

  // Clause outcomes extended (for Playbook page "Outcomes" tab)
  app.get("/api/accumulation/clause-outcomes-extended", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json([]); return; }

    const extDocs = await pb.collection("uploaded_documents").getFullList({
      filter: `company = "${company.id}"`,
      fields: "id",
    }).catch(() => [] as PBRecord[]);
    const extDocIds = extDocs.map((d) => d.id);
    const extDocFilter = extDocIds.length > 0
      ? extDocIds.map((id) => `document = "${id}"`).join(" || ")
      : `id = "none"`;

    const results = await pb.collection("review_results").getFullList({
      filter: extDocFilter,
      fields: "id,clauseCategory,ragStatus",
    }).catch(() => [] as PBRecord[]);

    const extResultIds = results.map((r) => r.id);
    const extResultFilter = extResultIds.length > 0
      ? extResultIds.map((id) => `result = "${id}"`).join(" || ")
      : `id = "none"`;

    const [feedbacks, outcomes] = await Promise.all([
      pb.collection("user_feedback").getFullList({
        filter: extResultFilter,
        fields: "result,userAction",
      }).catch(() => [] as PBRecord[]),
      pb.collection("outcome_deltas").getFullList({
        filter: `company = "${company.id}" && confirmedOutcome != ""`,
        fields: "clauseCategory,confirmedOutcome",
      }).catch(() => [] as PBRecord[]),
    ]);

    const fbMap = new Map<string, string>();
    for (const f of feedbacks) fbMap.set(f["result"] as string, f["userAction"] as string);

    // Per-category stats
    const catStats: Record<string, {
      total: number; redCount: number; accepted: number; escalated: number;
      outcomeCounts: Record<string, number>;
    }> = {};

    for (const r of results) {
      const cat = r["clauseCategory"] as string;
      if (!catStats[cat]) catStats[cat] = { total: 0, redCount: 0, accepted: 0, escalated: 0, outcomeCounts: {} };
      catStats[cat].total++;
      if (r["ragStatus"] === "RED") catStats[cat].redCount++;
      const fb = fbMap.get(r.id as string);
      if (fb === "ACCEPTED") catStats[cat].accepted++;
      if (fb === "ESCALATED") catStats[cat].escalated++;
    }

    // Add outcome delta data
    for (const o of outcomes) {
      const cat = o["clauseCategory"] as string;
      if (!catStats[cat]) catStats[cat] = { total: 0, redCount: 0, accepted: 0, escalated: 0, outcomeCounts: {} };
      const confirmed = o["confirmedOutcome"] as string;
      catStats[cat].outcomeCounts[confirmed] = (catStats[cat].outcomeCounts[confirmed] ?? 0) + 1;
    }

    const result = Object.entries(catStats)
      .filter(([, s]) => s.total > 0)
      .map(([cat, s]) => {
        const totalOutcomes = Object.values(s.outcomeCounts).reduce((a, b) => a + b, 0);
        const belowFallbackCount = s.outcomeCounts["BELOW_FALLBACK"] ?? 0;
        const belowFallbackRate = totalOutcomes > 0 ? belowFallbackCount / totalOutcomes : 0;
        const preferredCount = s.outcomeCounts["PREFERRED"] ?? 0;
        const fallbackCount = s.outcomeCounts["FALLBACK"] ?? 0;
        let avgSignedOutcome = "UNKNOWN";
        if (totalOutcomes > 0) {
          if (belowFallbackRate > 0.5) avgSignedOutcome = "BELOW_FALLBACK";
          else if ((preferredCount + fallbackCount) / totalOutcomes > 0.5) avgSignedOutcome = "FALLBACK";
          else avgSignedOutcome = "PREFERRED";
        }
        return {
          clauseCategory: cat,
          total: s.total,
          redCount: s.redCount,
          accepted: s.accepted,
          escalated: s.escalated,
          avgSignedOutcome,
          belowFallbackRate: Math.round(belowFallbackRate * 100),
          outcomeCounts: s.outcomeCounts,
        };
      })
      .sort((a, b) => b.total - a.total);

    res.json(result);
  }));

  // Override rate trend (last 6 months)
  app.get("/api/accumulation/override-trend", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json([]); return; }

    const trend: Array<{ month: string; overrideRate: number; totalResults: number; overrideCount: number }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const monthStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01 00:00:00`;
      const d2 = new Date(d);
      d2.setMonth(d2.getMonth() + 1);
      const monthEnd = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, "0")}-01 00:00:00`;
      const monthLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      const [results, overrides] = await Promise.all([
        pb.collection("review_results").getFullList({
          filter: `document.company = "${company.id}" && created >= "${monthStart}" && created < "${monthEnd}"`,
          fields: "id",
        }).catch(() => []),
        pb.collection("override_signals").getFullList({
          filter: `company = "${company.id}" && created >= "${monthStart}" && created < "${monthEnd}"`,
          fields: "id",
        }).catch(() => []),
      ]);

      const overrideRate = results.length > 0
        ? Math.round((overrides.length / results.length) * 100)
        : 0;

      trend.push({ month: monthLabel, overrideRate, totalResults: results.length, overrideCount: overrides.length });
    }

    res.json(trend);
  }));

  // ── Integrations ─────────────────────────────────────────────────────────────

  // Helper: get current company (same as the private getCompany helper above)
  // Note: getCompany is already defined earlier in this file

  // ── Google Drive ──────────────────────────────────────────────────────────────

  app.get("/api/integrations/google-drive/auth", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 400, "Complete onboarding first"); return; }
    const authUrl = getGoogleAuthUrl(company.id);
    res.json({ authUrl });
  }));

  app.get("/api/integrations/google-drive/callback", ah(async (req: Request, res: Response) => {
    const { code, state: companyId, error } = req.query as Record<string, string>;
    if (error) {
      res.redirect(`/settings?tab=integrations&error=${encodeURIComponent(error)}`);
      return;
    }
    if (!code || !companyId) { sendError(res, 400, "Missing code or state"); return; }
    try {
      await handleGoogleCallback(code, companyId);
      res.redirect("/settings?tab=integrations&connected=google_drive");
    } catch (err) {
      console.error("[Google Drive callback]", err);
      res.redirect(`/settings?tab=integrations&error=${encodeURIComponent((err as Error).message ?? "OAuth failed")}`);
    }
  }));

  app.get("/api/integrations/google-drive/status", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json(null); return; }
    const configs = await pb.collection("integration_configs").getFullList({
      filter: `companyId = "${company.id}" && provider = "google_drive"`,
    }).catch(() => []);
    res.json(configs[0] ?? null);
  }));

  app.get("/api/integrations/google-drive/folders", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 400, "No company"); return; }
    const configs = await pb.collection("integration_configs").getFullList({
      filter: `companyId = "${company.id}" && provider = "google_drive"`,
    }).catch(() => []);
    if (!configs[0]) { sendError(res, 404, "Google Drive not connected"); return; }
    const folders = await listGoogleFolders(configs[0].id);
    res.json({ folders });
  }));

  app.post("/api/integrations/google-drive/watch", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 400, "No company"); return; }
    const { folderId, folderName } = req.body as { folderId?: string; folderName?: string };
    if (!folderId || !folderName) { sendError(res, 400, "folderId and folderName required"); return; }
    const configs = await pb.collection("integration_configs").getFullList({
      filter: `companyId = "${company.id}" && provider = "google_drive"`,
    }).catch(() => []);
    if (!configs[0]) { sendError(res, 404, "Google Drive not connected"); return; }
    await watchGoogleFolder(configs[0].id, folderId, folderName);
    res.json({ ok: true, folderName });
  }));

  // Google Drive webhook - no auth, external POST
  app.post("/api/integrations/google-drive/webhook", ah(async (req: Request, res: Response) => {
    // Respond immediately to avoid retry
    res.status(200).end();

    const channelId = req.headers["x-goog-channel-id"] as string | undefined;
    const channelToken = req.headers["x-goog-channel-token"] as string | undefined;
    const resourceState = req.headers["x-goog-resource-state"] as string | undefined;

    if (resourceState === "sync") return; // Initial handshake, not a real change

    if (!channelId) return;

    // Find integration by channel ID
    const configs = await pb.collection("integration_configs").getFullList({
      filter: `webhookChannelId = "${channelId}"`,
    }).catch(() => []);

    if (!configs[0]) return;

    // Verify webhook secret
    if (channelToken && channelToken !== configs[0]["webhookSecret"]) {
      console.warn("[Google Drive webhook] Invalid channel token");
      return;
    }

    // Process asynchronously
    syncGoogleFolder(configs[0].id).catch((err: unknown) => {
      console.error("[Google Drive webhook] sync error:", err);
    });
  }));

  app.post("/api/integrations/google-drive/disconnect", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 400, "No company"); return; }
    const configs = await pb.collection("integration_configs").getFullList({
      filter: `companyId = "${company.id}" && provider = "google_drive"`,
    }).catch(() => []);
    if (configs[0]) {
      await pb.collection("integration_configs").delete(configs[0].id);
    }
    res.json({ ok: true });
  }));

  // ── SharePoint ────────────────────────────────────────────────────────────────

  app.get("/api/integrations/sharepoint/auth", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 400, "Complete onboarding first"); return; }
    const authUrl = getMicrosoftAuthUrl(company.id);
    res.json({ authUrl });
  }));

  app.get("/api/integrations/sharepoint/callback", ah(async (req: Request, res: Response) => {
    const { code, state: companyId, error } = req.query as Record<string, string>;
    if (error) {
      res.redirect(`/settings?tab=integrations&error=${encodeURIComponent(error)}`);
      return;
    }
    if (!code || !companyId) { sendError(res, 400, "Missing code or state"); return; }
    try {
      await handleMicrosoftCallback(code, companyId);
      res.redirect("/settings?tab=integrations&connected=sharepoint");
    } catch (err) {
      console.error("[SharePoint callback]", err);
      res.redirect(`/settings?tab=integrations&error=${encodeURIComponent((err as Error).message ?? "OAuth failed")}`);
    }
  }));

  app.get("/api/integrations/sharepoint/status", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json(null); return; }
    const configs = await pb.collection("integration_configs").getFullList({
      filter: `companyId = "${company.id}" && provider = "sharepoint"`,
    }).catch(() => []);
    res.json(configs[0] ?? null);
  }));

  app.get("/api/integrations/sharepoint/folders", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 400, "No company"); return; }
    const configs = await pb.collection("integration_configs").getFullList({
      filter: `companyId = "${company.id}" && provider = "sharepoint"`,
    }).catch(() => []);
    if (!configs[0]) { sendError(res, 404, "SharePoint not connected"); return; }
    const folders = await listSharePointFolders(configs[0].id);
    res.json({ folders });
  }));

  app.post("/api/integrations/sharepoint/watch", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 400, "No company"); return; }
    const { driveId, folderId, folderName } = req.body as { driveId?: string; folderId?: string; folderName?: string };
    if (!driveId || !folderId || !folderName) { sendError(res, 400, "driveId, folderId, and folderName required"); return; }
    const configs = await pb.collection("integration_configs").getFullList({
      filter: `companyId = "${company.id}" && provider = "sharepoint"`,
    }).catch(() => []);
    if (!configs[0]) { sendError(res, 404, "SharePoint not connected"); return; }
    await watchSharePointFolder(configs[0].id, driveId, folderId, folderName);
    res.json({ ok: true, folderName });
  }));

  // SharePoint webhook - no auth, external POST
  // Graph validation: first request is GET with validationToken query param
  app.get("/api/integrations/sharepoint/webhook", (req: Request, res: Response) => {
    const validationToken = (req.query as Record<string, string>).validationToken;
    if (validationToken) {
      res.setHeader("Content-Type", "text/plain");
      res.status(200).send(validationToken);
    } else {
      res.status(200).end();
    }
  });

  app.post("/api/integrations/sharepoint/webhook", ah(async (req: Request, res: Response) => {
    // Graph validation handshake
    const validationToken = (req.query as Record<string, string>).validationToken;
    if (validationToken) {
      res.setHeader("Content-Type", "text/plain");
      res.status(200).send(validationToken);
      return;
    }

    // Respond 202 immediately
    res.status(202).end();

    const body = req.body as {
      value?: Array<{
        clientState?: string;
        resource?: string;
        resourceData?: { id?: string };
      }>;
    };

    const notifications = body.value ?? [];

    for (const notification of notifications) {
      try {
        const clientState = notification.clientState;
        const driveItemId = notification.resourceData?.id;

        // Find integration by webhook secret (clientState)
        if (!clientState) continue;
        const configs = await pb.collection("integration_configs").getFullList({
          filter: `webhookSecret = "${clientState}"`,
        }).catch(() => []);

        if (!configs[0]) continue;

        syncSharePointFolder(configs[0].id, driveItemId).catch((err: unknown) => {
          console.error("[SharePoint webhook] sync error:", err);
        });
      } catch (err) {
        console.error("[SharePoint webhook] notification processing error:", err);
      }
    }
  }));

  app.post("/api/integrations/sharepoint/disconnect", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { sendError(res, 400, "No company"); return; }
    const configs = await pb.collection("integration_configs").getFullList({
      filter: `companyId = "${company.id}" && provider = "sharepoint"`,
    }).catch(() => []);
    if (configs[0]) {
      await pb.collection("integration_configs").delete(configs[0].id);
    }
    res.json({ ok: true });
  }));

  // ── Integration sync log ──────────────────────────────────────────────────────

  app.get("/api/integrations/sync-log", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany(req.user?.email);
    if (!company) { res.json({ entries: [] }); return; }

    // Get all integration configs for this company
    const configs = await pb.collection("integration_configs").getFullList({
      filter: `companyId = "${company.id}"`,
      fields: "id",
    }).catch(() => []);

    if (configs.length === 0) { res.json({ entries: [] }); return; }

    const integrationIds = configs.map((c) => c.id).join('","');
    const entries = await pb.collection("integration_sync_log").getFullList({
      filter: `integrationId ?= "${integrationIds}"`,
      sort: "-id",
    }).catch(async () => {
      // Fallback: fetch per-integration
      const all = [];
      for (const c of configs) {
        const logs = await pb.collection("integration_sync_log").getFullList({
          filter: `integrationId = "${c.id}"`,
          sort: "-id",
        }).catch(() => []);
        all.push(...logs);
      }
      return all.sort((a, b) => String(b["id"]).localeCompare(String(a["id"]))).slice(0, 50);
    });

    res.json({ entries: entries.slice(0, 50) });
  }));

  // ── Health ───────────────────────────────────────────────────────────────────

  // ── Founder output feedback ───────────────────────────────────────────────────
  app.post("/api/review-results/:resultId/founder-feedback", requireAuth, ah(async (req: Request, res: Response) => {
    const { resultId } = req.params;
    const { rating, reason } = req.body as { rating: "up" | "down"; reason?: string };
    // Store feedback on the review_results record as a non-fatal best-effort update
    await pb.collection("review_results").update(resultId, {
      founderFeedbackRating: rating,
      founderFeedbackReason: reason ?? "",
    }).catch(() => { /* field may not exist in schema, non-fatal */ });
    res.json({ ok: true });
  }));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // ── Global async error handler ───────────────────────────────────────────────
  // Catches unhandled errors from async route handlers so the process doesn't crash.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use((err: any, _req: Request, res: Response, _next: unknown) => {
    console.error("[route error]", err?.message ?? err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return createServer(app);
}
