import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { pb, newPBClient } from "./pb.js";
import multer from "multer";
import { upload, uploadAncillary, classifyFileType } from "./upload.js";
import { runReview } from "./services/reviewOrchestrator.js";
import { detectAndSaveRegulations } from "./services/regulatoryDetection.js";
import { requireAuth, signToken } from "./middleware/auth.js";
import { transcribeAudioFile } from "./services/transcription.js";
import { chatComplete } from "./services/openrouter.js";
import { searchCompanies, enrichCompany } from "./services/companySearch.js";
import { audit } from "./services/auditLogger.js";
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

async function getCompany(): Promise<PBRecord | null> {
  const list = await pb.collection("companies").getFullList({ batch: 1 }).catch((err: unknown) => {
    console.error("[getCompany] PocketBase query failed:", (err as Error)?.message ?? err);
    throw err;
  });
  return list[0] ?? null;
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

export async function registerRoutes(app: Express): Promise<Server> {

  // ── Auth ─────────────────────────────────────────────────────────────────────

  app.post("/api/auth/register", ah(async (req: Request, res: Response) => {
    const parsed = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8),
    }).safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, parsed.error.message); return; }

    const { name, email, password } = parsed.data;

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
    res.clearCookie("token");
    res.json({ ok: true });
  });

  app.get("/api/auth/me", requireAuth, (req: Request, res: Response) => {
    // The JWT has already been verified by requireAuth. We trust it.
    // Include a fresh token so the client can use Authorization: Bearer as a fallback
    // when httpOnly cookies are stripped by a reverse proxy (e.g. Railway).
    //
    // IMPORTANT: jwt.verify() returns the full payload including `exp` and `iat`.
    // We must pass ONLY the fields we want to re-sign — otherwise jwt.sign throws
    // "payload already has an exp property" when combined with expiresIn option.
    const { userId, email } = req.user!;
    const freshToken = signToken({ userId, email });
    res.json({ userId, email, token: freshToken });
  });

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

    // Single-company mode: wipe existing before creating.
    // Cascade-delete handles child records (playbook_rules, documents, etc).
    // Ignore individual delete errors so a stuck record doesn't block re-setup.
    const existing = await pb.collection("companies").getFullList();
    await Promise.allSettled(existing.map((c) => pb.collection("companies").delete(c.id)));

    const company = await pb.collection("companies").create(parsed.data);

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

  app.get("/api/company", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
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

  // ── Regulatory ───────────────────────────────────────────────────────────────

  app.post("/api/regulatory/detect", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { sendError(res, 404, "No company configured"); return; }

    await detectAndSaveRegulations(company.id);
    const regs = await pb.collection("company_regulations").getFullList({
      filter: `company = "${company.id}"`,
      sort: "+jurisdiction",
    });
    res.json(regs.map(mapRegulation));
  }));

  app.get("/api/regulatory", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { res.json([]); return; }

    const regs = await pb.collection("company_regulations").getFullList({
      filter: `company = "${company.id}"`,
      sort: "+jurisdiction",
    });
    res.json(regs.map(mapRegulation));
  }));

  // ── Regulatory synthesis ──────────────────────────────────────────────────────
  // Synthesises an in-depth interpretation of a regulation for this company's
  // context. Uses LLM; result cached in regulatory_synthesis_pages collection.

  app.post("/api/regulatory/synthesise/:regulationId", requireAuth, ah(async (req: Request, res: Response) => {
    const { regulationId } = req.params as { regulationId: string };
    const company = await getCompany();
    if (!company) { sendError(res, 404, "No company configured"); return; }

    // Load the regulation
    let reg: Record<string, unknown>;
    try {
      reg = await pb.collection("company_regulations").getOne(regulationId);
    } catch {
      sendError(res, 404, "Regulation not found"); return;
    }

    // Check for existing fresh synthesis (< 7 days old)
    const existing = await pb.collection("regulatory_synthesis_pages").getFullList({
      filter: `companyId = "${company.id}" && topic = "${regulationId}"`,
      sort: "-id",
    }).catch(() => []);
    if (existing.length > 0) {
      const age = Date.now() - new Date(existing[0]["created"] as string).getTime();
      if (age < 7 * 24 * 60 * 60 * 1000) {
        res.json({ synthesis: existing[0]["content"] as string, cached: true, createdAt: existing[0]["created"] });
        return;
      }
    }

    // Generate synthesis via LLM
    const prompt = `You are a specialist legal intelligence analyst. Generate a concise but substantive synthesis (400–600 words) of how the regulation below applies specifically to this company's context.

Regulation: ${reg["frameworkName"] as string} (${reg["jurisdiction"] as string})
Regulator: ${reg["regulator"] as string}
Description: ${reg["description"] as string}
Applies to: ${reg["appliesTo"] as string || "general"}

Company context:
- Name: ${company.name as string}
- Sector: ${company.sector as string}
- Industry: ${(company as Record<string, unknown>)["industry"] as string || "not specified"}
- Jurisdiction: ${(company as Record<string, unknown>)["jurisdiction"] as string || "not specified"}
- Workflow: ${(company as Record<string, unknown>)["workflowType"] as string || "COMMERCIAL_CONTRACT"}

Structure your synthesis as:
1. **Key obligations** (2-3 bullet points of the most material requirements)
2. **Contract clause implications** (how this regulation should shape their standard contract positions)
3. **Practical risk areas** (specific risk watch-points for this company type)
4. **Recommended next steps** (1-2 actionable steps)

Be precise, practical, and legally accurate. This is advisory context, not legal advice.`;

    let synthesis = "";
    try {
      const result = await chatComplete([{ role: "user", content: prompt }], 800);
      synthesis = result.trim();
    } catch (err) {
      sendError(res, 500, "Failed to generate synthesis"); return;
    }

    // Cache the synthesis
    await pb.collection("regulatory_synthesis_pages").create({
      companyId: company.id,
      topic: regulationId,
      jurisdiction: reg["jurisdiction"] as string,
      sector: company.sector as string,
      content: synthesis,
      version: 1,
    }).catch(() => null);

    await audit({ action: "regulatory_profile_updated", entityType: "regulation", entityId: regulationId, companyId: company.id, detail: { action: "synthesise", frameworkName: reg["frameworkName"] } });
    res.json({ synthesis, cached: false, createdAt: new Date().toISOString() });
  }));

  // ── Regulatory updates digest ─────────────────────────────────────────────────
  // Returns a digest of recent regulatory developments for the company's
  // active frameworks. Uses LLM simulation (no live API key required).

  app.get("/api/regulatory/updates", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { res.json({ updates: [] }); return; }

    const regs = await pb.collection("company_regulations").getFullList({
      filter: `company = "${company.id}"`,
    });
    if (regs.length === 0) { res.json({ updates: [] }); return; }

    // Check for cached digest (< 24h old)
    const existing = await pb.collection("regulatory_synthesis_pages").getFullList({
      filter: `companyId = "${company.id}" && topic = "DIGEST"`,
      sort: "-id",
    }).catch(() => []);
    if (existing.length > 0) {
      const age = Date.now() - new Date(existing[0]["created"] as string).getTime();
      if (age < 24 * 60 * 60 * 1000) {
        const updates = JSON.parse(existing[0]["content"] as string);
        res.json({ updates, cached: true });
        return;
      }
    }

    const frameworkList = regs.slice(0, 6).map((r) => `${r["frameworkName"] as string} (${r["jurisdiction"] as string})`).join(", ");
    const prompt = `You are a legal regulatory intelligence system. Generate a JSON array of 4-6 recent regulatory developments relevant to these frameworks: ${frameworkList}.

Company context: ${company.sector as string} sector, ${(company as Record<string, unknown>)["jurisdiction"] as string || "GB"} jurisdiction.

Return ONLY a valid JSON array. Each item must have:
- "framework": framework name (string)
- "jurisdiction": jurisdiction code (string, e.g. "GB")
- "title": brief title of the update (string, max 80 chars)
- "summary": 1-2 sentence plain-English summary (string)
- "impact": "HIGH" | "MEDIUM" | "LOW"
- "date": approximate date in YYYY-MM format (within the last 12 months)
- "actionRequired": boolean

Ensure updates are realistic, plausible, and specific (not generic).`;

    let updates: unknown[] = [];
    try {
      const result = await chatComplete([{ role: "user", content: prompt }], 700);
      const match = result.match(/\[[\s\S]*\]/);
      if (match) updates = JSON.parse(match[0]) as unknown[];
    } catch {
      // Return empty - non-fatal
    }

    // Cache for 24h
    if (updates.length > 0) {
      await pb.collection("regulatory_synthesis_pages").create({
        companyId: company.id,
        topic: "DIGEST",
        jurisdiction: "ALL",
        sector: company.sector as string,
        content: JSON.stringify(updates),
        version: 1,
      }).catch(() => null);
    }

    res.json({ updates, cached: false });
  }));

  // ── Playbook Rules ───────────────────────────────────────────────────────────

  app.post("/api/playbook/rules", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany();
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
    const company = await getCompany();
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

  app.get("/api/playbook/drift-suggestions", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
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

  // ── Approval Contacts ────────────────────────────────────────────────────────

  app.post("/api/company/contacts", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany();
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
        if (err) return sendError(res, 415, "Only PDF and DOCX files are supported.");
        next();
      });
    },
    ah(async (req: Request, res: Response) => {
      // Document-first flow: accept uploads even before onboarding is complete.
      // The document will be associated with the company via POST /api/quick-setup.
      const company = await getCompany();

      const file = req.file;
      if (!file) { sendError(res, 400, "No file uploaded"); return; }

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
      // Use first 8000 chars — covers parties section, definitions, and opening recitals
      // even in contracts with long preambles before the substantive clauses
      rawText = parsed.text.slice(0, 8000);
    } catch {
      // Return empty extraction rather than erroring — the modal can still work
      res.json({});
      return;
    }

    if (!rawText.trim()) { res.json({}); return; }

    // LLM extraction — best-effort, swallow any failure
    const { chatComplete } = await import("./services/openrouter.js");
    try {
      const response = await chatComplete([{
        role: "user",
        content: `Extract the following information from this contract if present. Return valid JSON only. No preamble. No markdown.

{
  "contract_type": "one of: SUPPLIER_AGREEMENT | CUSTOMER_AGREEMENT | MSA | NDA | SaaS_AGREEMENT | PROFESSIONAL_SERVICES | EMPLOYMENT | CONTRACTOR_AGREEMENT | IP_LICENSE_AGREEMENT | JV_AGREEMENT | SHARE_PURCHASE | COMMERCIAL_LEASE | LOAN_AGREEMENT | DISTRIBUTION_AGREEMENT | OTHER — or null",
  "counterparty_name": "full legal name of the counterparty company or individual — look in: (1) the opening 'between X and Y' parties clause, (2) the definitions section where 'Supplier', 'Service Provider', 'Vendor', 'Customer', or 'Client' is defined, (3) the agreement title or header, (4) the signature block. Return the full legal entity name (e.g. 'Attio Limited' not just 'Attio'). Return null only if genuinely not identifiable.",
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
      res.json({}); // best-effort — never block the UX
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

    // Save market-standard playbook rules — must complete before we respond so
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

    // NOW delete old companies — document is already safe under the new company
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
    const company = await getCompany();
    if (!company) { res.json([]); return; }

    const { search, ragStatus, contractType: typeFilter } = req.query as Record<string, string>;

    // Fetch documents first so we can filter review_results by document ID,
    // then user_feedback by result ID — avoids chained relation filters like
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

  app.get("/api/documents/stats", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) {
      res.json({ totalContracts: 0, totalValue: 0, redContracts: 0, renewalsDue: 0 });
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

    res.json({ totalContracts, totalValue, redContracts, renewalsDue });
  }));

  // ── Missing document check ────────────────────────────────────────────────────
  // MUST be registered before GET /api/documents/:id or Express routes "missing" as id="missing"

  app.get("/api/documents/missing", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
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
    const ownerCompany = await getCompany();
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
      return; // Already gone — treat as success
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

    // Audit entry — fire-and-forget
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
    const company = await getCompany();
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
    const company = await getCompany();
    if (!company) { sendError(res, 404, "Company not found"); return; }
    // Verify ownership of all before deleting any
    await Promise.all(ids.map((id) => assertOwnsDocument(userId, id, company.id as string)));
    await Promise.allSettled(ids.map((id) => cascadeDeleteDocument(id, userId)));
    res.json({ ok: true, deleted: ids.length });
  }));

  app.delete("/api/company/contracts", requireAuth, ah(async (req: Request, res: Response) => {
    const { userId } = req.user!;
    const company = await getCompany();
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

    // Guard: refuse to start review if no playbook rules exist — would produce empty results
    const company = await getCompany();
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
    const company = await getCompany();
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
    await audit({
      action: actionMap[parsed.data.userAction] ?? "feedback_accepted",
      entityType: "review_result",
      entityId: req.params.resultId,
      userId: req.user?.userId,
    });

    res.json(mapFeedback(feedback));
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

    await audit({
      action: "teach_zane_correction",
      entityType: "review_result",
      entityId: req.params.resultId,
      userId: req.user?.userId,
      detail: { correctOutputLength: parsed.data.correctOutput.length },
    });

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

    await audit({
      action: "false_positive_marked",
      entityType: "review_result",
      entityId: req.params.resultId,
      userId: req.user?.userId,
    });

    res.json(mapFeedback(feedback));
  }));

  // ── Feedback patterns (memory layer) ─────────────────────────────────────────

  app.get("/api/feedback/patterns", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { res.json({ patterns: [], clauseOutcomes: [], counterpartyPatterns: [], negotiationDrift: [] }); return; }

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

    res.json({
      patterns: patterns.slice(0, 8),
      clauseOutcomes,
      counterpartyPatterns: counterpartyPatterns.slice(0, 10),
      negotiationDrift: driftEntries.slice(0, 6),
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

    const company = await getCompany();
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
        return `Issue ${i + 1} – Add ${clauseLabel}:\n${ask}`;
      }
      const verb = r["ragStatus"] === "RED" ? "needs to change" : "worth discussing";
      return `Issue ${i + 1} – ${clauseLabel} (${verb}):\n${ask}${fallback ? `\nSuggested wording: "${fallback}"` : ""}`;
    }).join("\n\n");

    const systemPrompt = `You are helping a founder draft a negotiation email to a counterparty about a contract.

Write a ${tonePhrase} email that:
- Opens by thanking them for sending the agreement and noting you have reviewed it
- Raises each issue by name (use the issue heading as a natural part of the sentence)
- States clearly what change is being requested for each
- Includes any suggested wording naturally in the text where provided
- Uses plain English — no Latin, no legal jargon, no clause number references like "14.2(b)" unless the counterparty used them
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
      subject = `Re: ${contractType} – proposed amendments`;
      body = `Hi,\n\nThanks for sending across the ${contractType}. We've had a chance to review it and have a few points we'd like to raise before we proceed.\n\n${included.map((r) => {
        const label = (r["clauseCategory"] as string).replace(/_/g, " ");
        const ask   = (r["founderAskFor"] as string | undefined) || (r["recommendedAction"] as string | undefined) || "We'd like to discuss this further.";
        return `${label}: ${ask}`;
      }).join("\n\n")}\n\nHappy to jump on a call to walk through these – let us know what works.\n\nBest,\n${companyName}`;
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
        subject = `Re: ${contractType} – proposed amendments`;
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

    const systemPrompt = `You are a commercial contracts expert rewriting a clause to be more founder-friendly.
Use plain English. No Latin. Minimal legal jargon.
Return ONLY valid JSON with no markdown fences:
{"revised":"the full revised clause text as proper contract language","explanation":"one plain English sentence explaining the key change"}`;

    const userPrompt = `Contract type: ${contractType}
Clause: ${clauseLabel}

Original clause text:
${originalText}

What needs to change:
${ask}
${fallback ? `\nSuggested wording to incorporate:\n"${fallback}"` : ""}

Rewrite the full clause incorporating the change. Keep it professional and complete.`;

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

    const company      = await getCompany();
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
        clauseText  = fallback || `[${clauseLabel} clause — unable to generate, please try again]`;
        explanation = "Unable to generate clause. Please try again.";
      }
    }

    res.json({ clauseText, explanation });
  }));

  // ── Stats ────────────────────────────────────────────────────────────────────

  app.get("/api/stats", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
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

  app.get("/api/portfolio", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
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

  app.get("/api/timings", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
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
        sort: "-id",
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

      // Audit the export itself
      audit({
        action: "audit_log_exported",
        entityType: "audit_log",
        companyId: req.user?.userId,
        userId: req.user?.userId,
        detail: { rows: rows.length, filters: filterStr },
      }).catch(() => {});

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="audit-log-${new Date().toISOString().split("T")[0]}.csv"`);
      res.send(header + body);
      return;
    }

    const result = await pb.collection("audit_log").getList(page, limit, {
      sort: "-id",
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

  // ── Contract library ──────────────────────────────────────────────────────────

  // GET /api/library - documents grouped by folder, with version chain resolution
  app.get("/api/library", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany();
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

  app.get("/api/governance/thresholds", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { res.json([]); return; }
    const rows = await pb.collection("approval_thresholds").getFullList({
      filter: `companyId = "${company.id}"`,
      sort: "+minValue",
    });
    res.json(rows);
  }));

  app.post("/api/governance/thresholds", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { sendError(res, 400, "Company not found"); return; }
    const thresholds = req.body as Array<{ minValue: number; maxValue: number | null; requiredApprover: string; label: string }>;
    // Replace existing thresholds for this company
    const existing = await pb.collection("approval_thresholds").getFullList({ filter: `companyId = "${company.id}"` });
    await Promise.all(existing.map((r) => pb.collection("approval_thresholds").delete(r.id)));
    const created = await Promise.all(thresholds.map((t) => pb.collection("approval_thresholds").create({ ...t, companyId: company.id })));
    res.json(created);
  }));

  // ── Governance triggers ──────────────────────────────────────────────────────

  app.get("/api/governance/triggers", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { res.json([]); return; }
    const rows = await pb.collection("governance_triggers").getFullList({
      filter: `companyId = "${company.id}"`,
      sort: "+clauseCategory",
    });
    res.json(rows);
  }));

  app.post("/api/governance/triggers", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { sendError(res, 400, "Company not found"); return; }
    const triggers = req.body as Array<{ clauseCategory: string; escalateTo: string; reason: string }>;
    const existing = await pb.collection("governance_triggers").getFullList({ filter: `companyId = "${company.id}"` });
    await Promise.all(existing.map((r) => pb.collection("governance_triggers").delete(r.id)));
    const created = await Promise.all(triggers.map((t) => pb.collection("governance_triggers").create({ ...t, companyId: company.id })));
    res.json(created);
  }));

  // ── Team invites ──────────────────────────────────────────────────────────────

  app.post("/api/team/invite", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { sendError(res, 400, "Company not found"); return; }
    const { emails, role = "LEGAL" } = req.body as { emails: string[]; role?: string };
    if (!Array.isArray(emails) || emails.length === 0) { sendError(res, 400, "No emails provided"); return; }
    const created = await Promise.all(
      emails.map((email) => pb.collection("team_invites").create({ companyId: company.id, email, role, status: "pending" }))
    );
    // Best-effort invite emails - import sendEscalationEmail-like mailer if SMTP configured
    res.json({ invited: created.map((r) => r.id).length });
  }));

  app.get("/api/team/invites", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { res.json([]); return; }
    const rows = await pb.collection("team_invites").getFullList({
      filter: `companyId = "${company.id}"`,
      sort: "-id",
    });
    res.json(rows);
  }));

  app.delete("/api/team/invites/:id", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany();
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
    const company = await getCompany();
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
      detail: { overrideFrom: result["ragStatus"], overrideTo: correctedStatus, reason },
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
      detail: { errorType, clauseCategory: result["clauseCategory"] },
    });

    res.json({ ok: true });
  }));

  // ── Step 5 - Company rules engine ────────────────────────────────────────────

  app.get("/api/company-rules", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
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
    const company = await getCompany();
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
  app.get("/api/accumulation/progress", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
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
  app.get("/api/accumulation/clause-outcomes-extended", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
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
  app.get("/api/accumulation/override-trend", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
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

  app.get("/api/integrations/google-drive/auth", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
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

  app.get("/api/integrations/google-drive/status", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { res.json(null); return; }
    const configs = await pb.collection("integration_configs").getFullList({
      filter: `companyId = "${company.id}" && provider = "google_drive"`,
    }).catch(() => []);
    res.json(configs[0] ?? null);
  }));

  app.get("/api/integrations/google-drive/folders", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { sendError(res, 400, "No company"); return; }
    const configs = await pb.collection("integration_configs").getFullList({
      filter: `companyId = "${company.id}" && provider = "google_drive"`,
    }).catch(() => []);
    if (!configs[0]) { sendError(res, 404, "Google Drive not connected"); return; }
    const folders = await listGoogleFolders(configs[0].id);
    res.json({ folders });
  }));

  app.post("/api/integrations/google-drive/watch", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany();
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

  app.post("/api/integrations/google-drive/disconnect", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
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

  app.get("/api/integrations/sharepoint/auth", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
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

  app.get("/api/integrations/sharepoint/status", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { res.json(null); return; }
    const configs = await pb.collection("integration_configs").getFullList({
      filter: `companyId = "${company.id}" && provider = "sharepoint"`,
    }).catch(() => []);
    res.json(configs[0] ?? null);
  }));

  app.get("/api/integrations/sharepoint/folders", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { sendError(res, 400, "No company"); return; }
    const configs = await pb.collection("integration_configs").getFullList({
      filter: `companyId = "${company.id}" && provider = "sharepoint"`,
    }).catch(() => []);
    if (!configs[0]) { sendError(res, 404, "SharePoint not connected"); return; }
    const folders = await listSharePointFolders(configs[0].id);
    res.json({ folders });
  }));

  app.post("/api/integrations/sharepoint/watch", requireAuth, ah(async (req: Request, res: Response) => {
    const company = await getCompany();
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

  app.post("/api/integrations/sharepoint/disconnect", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
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

  app.get("/api/integrations/sync-log", requireAuth, ah(async (_req: Request, res: Response) => {
    const company = await getCompany();
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
