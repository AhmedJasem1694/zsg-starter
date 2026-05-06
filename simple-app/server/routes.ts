import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { pb } from "./pb.js";
import { upload, uploadAncillary, classifyFileType } from "./upload.js";
import { runReview } from "./services/reviewOrchestrator.js";
import { detectAndSaveRegulations } from "./services/regulatoryDetection.js";
import { requireAuth, signToken } from "./middleware/auth.js";
import { transcribeAudioFile } from "./services/transcription.js";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
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
  persona: z.enum(["CORPORATE", "FOUNDER", "PE_FUND"]).optional(),
  workflowType: z.enum(["COMMERCIAL_CONTRACT", "INSURANCE_LITIGATION", "LOGISTICS_CONTRACT"]).optional(),
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
  return { ...d, companyId: d.company, uploadedAt: d.created };
}

function mapResult(r: PBRecord) {
  return {
    ...r,
    documentId: r.document,
    clauseId: r.clause ?? null,
    ruleId: r.rule ?? null,
    createdAt: r.created,
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
  const list = await pb.collection("companies").getFullList({ batch: 1 });
  return list[0] ?? null;
}

export async function registerRoutes(app: Express): Promise<Server> {

  // ── Auth ─────────────────────────────────────────────────────────────────────

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const parsed = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8),
    }).safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, parsed.error.message); return; }

    const { name, email, password } = parsed.data;

    const existing = await pb.collection("users").getFullList({
      filter: `email = "${email}"`,
    });
    if (existing.length > 0) { sendError(res, 409, "An account with this email already exists"); return; }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await pb.collection("users").create({ name, email, passwordHash });

    const token = signToken({ userId: user.id, email: user["email"] as string });
    res.cookie("token", token, COOKIE_OPTS);
    res.json({ id: user.id, name: user["name"], email: user["email"] });
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const parsed = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, "Invalid email or password"); return; }

    const { email, password } = parsed.data;

    const users = await pb.collection("users").getFullList({
      filter: `email = "${email}"`,
    });
    const user = users[0];
    if (!user) { sendError(res, 401, "Invalid email or password"); return; }

    const valid = await bcrypt.compare(password, user["passwordHash"] as string);
    if (!valid) { sendError(res, 401, "Invalid email or password"); return; }

    const token = signToken({ userId: user.id, email: user["email"] as string });
    res.cookie("token", token, COOKIE_OPTS);
    res.json({ id: user.id, name: user["name"], email: user["email"] });
  });

  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    res.clearCookie("token");
    res.json({ ok: true });
  });

  app.get("/api/auth/me", requireAuth, (req: Request, res: Response) => {
    res.json(req.user);
  });

  // ── Company ─────────────────────────────────────────────────────────────────

  app.post("/api/company", requireAuth, async (req: Request, res: Response) => {
    const parsed = companySchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, parsed.error.message); return; }

    // Single-company mode: wipe existing before creating
    const existing = await pb.collection("companies").getFullList();
    await Promise.all(existing.map((c) => pb.collection("companies").delete(c.id)));

    const company = await pb.collection("companies").create(parsed.data);

    // Kick off regulatory detection async
    detectAndSaveRegulations(company.id).catch(console.error);

    res.json(mapCompany(company));
  });

  app.get("/api/company", requireAuth, async (_req: Request, res: Response) => {
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
  });

  // ── Regulatory ───────────────────────────────────────────────────────────────

  app.post("/api/regulatory/detect", requireAuth, async (_req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { sendError(res, 404, "No company configured"); return; }

    await detectAndSaveRegulations(company.id);
    const regs = await pb.collection("company_regulations").getFullList({
      filter: `company = "${company.id}"`,
      sort: "+jurisdiction",
    });
    res.json(regs.map(mapRegulation));
  });

  app.get("/api/regulatory", requireAuth, async (_req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { res.json([]); return; }

    const regs = await pb.collection("company_regulations").getFullList({
      filter: `company = "${company.id}"`,
      sort: "+jurisdiction",
    });
    res.json(regs.map(mapRegulation));
  });

  // ── Playbook Rules ───────────────────────────────────────────────────────────

  app.post("/api/playbook/rules", requireAuth, async (req: Request, res: Response) => {
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

    res.json(created.map(mapRule));
  });

  app.get("/api/playbook/rules", requireAuth, async (req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { res.json([]); return; }

    const { workflowType } = req.query as { workflowType?: string };
    const filter = workflowType
      ? `company = "${company.id}" && workflowType = "${workflowType}"`
      : `company = "${company.id}"`;

    const rules = await pb.collection("playbook_rules").getFullList({
      filter,
      sort: "+created",
    });
    res.json(rules.map(mapRule));
  });

  app.put("/api/playbook/rule/:id", requireAuth, async (req: Request, res: Response) => {
    const parsed = playbookRuleSchema.partial().safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, parsed.error.message); return; }

    const rule = await pb.collection("playbook_rules").update(req.params.id, parsed.data);
    res.json(mapRule(rule));
  });

  app.delete("/api/playbook/rule/:id", requireAuth, async (req: Request, res: Response) => {
    await pb.collection("playbook_rules").delete(req.params.id);
    res.json({ ok: true });
  });

  // ── Approval Contacts ────────────────────────────────────────────────────────

  app.post("/api/company/contacts", requireAuth, async (req: Request, res: Response) => {
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
  });

  // ── Documents ────────────────────────────────────────────────────────────────

  app.post(
    "/api/documents/upload",
    requireAuth,
    upload.single("contract"),
    async (req: Request, res: Response) => {
      const company = await getCompany();
      if (!company) { sendError(res, 400, "Complete onboarding before uploading"); return; }

      const file = req.file;
      if (!file) { sendError(res, 400, "No file uploaded"); return; }

      const body = req.body as Record<string, string>;
      const contractValue = body.contractValue ? parseFloat(body.contractValue) : null;
      const contractTermMonths = body.contractTermMonths ? parseInt(body.contractTermMonths) : null;
      const autoRenewal = body.autoRenewal === "true";
      const noticePeriodDays = body.noticePeriodDays ? parseInt(body.noticePeriodDays) : null;
      const renewalDate = body.renewalDate || null; // ISO date string or null

      const doc = await pb.collection("uploaded_documents").create({
        company: company.id,
        filename: file.filename,
        originalName: file.originalname,
        contractType: body.contractType ?? "SUPPLIER_AGREEMENT",
        status: "UPLOADED",
        counterpartyName: body.counterpartyName ?? "",
        counterpartyType: body.counterpartyType ?? "",
        reviewType: body.reviewType ?? "INBOUND",
        contractValue,
        currency: body.currency ?? "GBP",
        contractTermMonths,
        autoRenewal,
        noticePeriodDays,
        renewalDate,
        contractTags: body.contractTags ?? "",
      });

      res.json(mapDoc(doc));
    }
  );

  app.get("/api/documents", requireAuth, async (req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { res.json([]); return; }

    const { search, ragStatus, contractType: typeFilter } = req.query as Record<string, string>;

    const [docs, allResults] = await Promise.all([
      pb.collection("uploaded_documents").getFullList({
        filter: `company = "${company.id}"`,
        sort: "-created",
      }),
      pb.collection("review_results").getFullList({
        filter: `document.company = "${company.id}"`,
        fields: "id,document,ragStatus",
      }),
    ]);

    // Group results by documentId
    const resultsByDoc = new Map<string, { ragStatus: string }[]>();
    for (const r of allResults) {
      const arr = resultsByDoc.get(r["document"] as string) ?? [];
      arr.push({ ragStatus: r["ragStatus"] as string });
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
  });

  app.get("/api/documents/stats", requireAuth, async (_req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) {
      res.json({ totalContracts: 0, totalValue: 0, redContracts: 0, renewalsDue: 0 });
      return;
    }

    const [docs, allResults] = await Promise.all([
      pb.collection("uploaded_documents").getFullList({
        filter: `company = "${company.id}"`,
      }),
      pb.collection("review_results").getFullList({
        filter: `document.company = "${company.id}"`,
        fields: "document,ragStatus",
      }),
    ]);

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
  });

  app.get("/api/documents/:id", requireAuth, async (req: Request, res: Response) => {
    let doc: PBRecord;
    try {
      doc = await pb.collection("uploaded_documents").getOne(req.params.id);
    } catch {
      sendError(res, 404, "Document not found"); return;
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
  });

  // ── Review ───────────────────────────────────────────────────────────────────

  app.post("/api/review/:documentId", requireAuth, async (req: Request, res: Response) => {
    let doc: PBRecord;
    try {
      doc = await pb.collection("uploaded_documents").getOne(req.params.documentId);
    } catch {
      sendError(res, 404, "Document not found"); return;
    }

    if (doc["status"] === "PROCESSING") { sendError(res, 409, "Review already in progress"); return; }

    if (doc["status"] === "COMPLETE") {
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
      await Promise.all([
        ...existingResults.map((r) => pb.collection("review_results").delete(r.id)),
        ...existingClauses.map((c) => pb.collection("extracted_clauses").delete(c.id)),
      ]);
    }

    runReview(doc.id).catch(console.error);
    res.json({ status: "started", documentId: doc.id });
  });

  app.get("/api/review/:documentId", requireAuth, async (req: Request, res: Response) => {
    let doc: PBRecord;
    try {
      doc = await pb.collection("uploaded_documents").getOne(req.params.documentId);
    } catch {
      sendError(res, 404, "Document not found"); return;
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
  });

  // ── Feedback ─────────────────────────────────────────────────────────────────

  app.post("/api/feedback/:resultId", requireAuth, async (req: Request, res: Response) => {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, parsed.error.message); return; }

    const existing = await pb.collection("user_feedback").getFullList({
      filter: `result = "${req.params.resultId}"`,
    });

    let feedback: PBRecord;
    if (existing.length > 0) {
      feedback = await pb.collection("user_feedback").update(existing[0].id, parsed.data);
    } else {
      feedback = await pb.collection("user_feedback").create({
        result: req.params.resultId,
        ...parsed.data,
      });
    }

    res.json(mapFeedback(feedback));
  });

  // ── Stats ────────────────────────────────────────────────────────────────────

  app.get("/api/stats", requireAuth, async (_req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { res.json(null); return; }

    const [docs, results] = await Promise.all([
      pb.collection("uploaded_documents").getFullList({
        filter: `company = "${company.id}"`,
      }),
      pb.collection("review_results").getFullList({
        filter: `document.company = "${company.id}"`,
      }),
    ]);

    const feedbackMap = new Map<string, PBRecord>();
    if (results.length > 0) {
      const feedbacks = await pb.collection("user_feedback").getFullList({
        filter: `result.document.company = "${company.id}"`,
      });
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
  });

  // ── Portfolio ─────────────────────────────────────────────────────────────────

  app.get("/api/portfolio", requireAuth, async (_req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { res.json(null); return; }

    const [results, completeDocs] = await Promise.all([
      pb.collection("review_results").getFullList({
        filter: `document.company = "${company.id}" && document.status = "COMPLETE"`,
      }),
      pb.collection("uploaded_documents").getFullList({
        filter: `company = "${company.id}" && status = "COMPLETE"`,
        fields: "id,contractType",
      }),
    ]);

    if (results.length === 0) { res.json(null); return; }

    const docMap = new Map(completeDocs.map((d) => [d.id, d["contractType"] as string]));

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
      const t = docMap.get(docId) ?? "UNKNOWN";
      if (!typeMap[t]) typeMap[t] = { red: 0, amber: 0, docIds: new Set() };
      typeMap[t].docIds.add(docId);
      if (r["ragStatus"] === "RED")   typeMap[t].red++;
      if (r["ragStatus"] === "AMBER") typeMap[t].amber++;
    }
    const byContractType = Object.entries(typeMap)
      .map(([type, v]) => ({ type: type.replace(/_/g, " "), red: v.red, amber: v.amber, total: v.docIds.size }))
      .sort((a, b) => b.red - a.red);

    const topCat = topRedCategories[0];
    const insight = topCat
      ? `${topCat.category.replace(/_/g, " ")} is your most common risk issue across ${totalDocs} reviewed contract${totalDocs !== 1 ? "s" : ""}. Check your playbook position and consider whether your red line is calibrated correctly.`
      : `${totalDocs} contract${totalDocs !== 1 ? "s" : ""} reviewed with no RED flags. Your playbook positions are holding well.`;

    res.json({ groups, topRedCategories, byContractType, insight, totalDocuments: totalDocs, totalClauses: results.length });
  });

  // ── Timings ───────────────────────────────────────────────────────────────────

  app.get("/api/timings", requireAuth, async (_req: Request, res: Response) => {
    const company = await getCompany();
    if (!company) { res.json(null); return; }

    const [docs, allResults] = await Promise.all([
      pb.collection("uploaded_documents").getFullList({
        filter: `company = "${company.id}"`,
        sort: "-created",
      }),
      pb.collection("review_results").getFullList({
        filter: `document.company = "${company.id}"`,
        fields: "id,document,clauseCategory,ragStatus,clauseSummary",
      }),
    ]);

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
  });

  // ── Litigation Intake ─────────────────────────────────────────────────────────

  app.get("/api/litigation/intake/:documentId", requireAuth, async (req: Request, res: Response) => {
    const intakes = await pb.collection("litigation_intakes").getFullList({
      filter: `document = "${req.params.documentId}"`,
    });
    res.json(intakes.length > 0 ? mapIntake(intakes[0]) : null);
  });

  app.post("/api/litigation/intake/:documentId", requireAuth, async (req: Request, res: Response) => {
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
  });

  // ── Ancillary Documents ───────────────────────────────────────────────────────

  app.post(
    "/api/ancillary/:documentId",
    requireAuth,
    uploadAncillary.single("file"),
    async (req: Request, res: Response) => {
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
    }
  );

  app.get("/api/ancillary/:documentId", requireAuth, async (req: Request, res: Response) => {
    const docs = await pb.collection("ancillary_documents").getFullList({
      filter: `document = "${req.params.documentId}"`,
      sort: "-created",
    });
    res.json(docs.map(mapAncillary));
  });

  app.delete("/api/ancillary/:ancillaryId", requireAuth, async (req: Request, res: Response) => {
    await pb.collection("ancillary_documents").delete(req.params.ancillaryId);
    res.json({ ok: true });
  });

  // ── Health ───────────────────────────────────────────────────────────────────

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  return createServer(app);
}
