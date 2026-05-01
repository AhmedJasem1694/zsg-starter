import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "./db.js";
import { upload } from "./upload.js";
import { runReview } from "./services/reviewOrchestrator.js";
import {
  detectAndSaveRegulations,
} from "./services/regulatoryDetection.js";
import { requireAuth, signToken } from "./middleware/auth.js";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

const companySchema = z.object({
  name: z.string().min(1),
  sector: z.string().min(1),
  jurisdiction: z.string().min(1),
  role: z.enum(["BUYER", "SUPPLIER", "BOTH"]),
  riskAppetite: z.enum(["CONSERVATIVE", "MODERATE", "COMMERCIAL"]),
  industry: z.string().optional(),
  persona: z.enum(["CORPORATE", "FOUNDER", "PE_FUND"]).optional(),
});

const playbookRuleSchema = z.object({
  clauseCategory: z.string().min(1),
  preferredPosition: z.string().min(1),
  acceptableFallback: z.string().min(1),
  hardRedLine: z.string().min(1),
  approvalRequired: z.enum(["LEGAL", "GC", "CFO", "BOARD"]).optional(),
  fallbackTemplate: z.string().optional(),
  riskWeight: z.number().int().min(1).max(5).optional(),
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

function sendError(res: Response, status: number, message: string) {
  return res.status(status).json({ error: message });
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

    const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (exists) { sendError(res, 409, "An account with this email already exists"); return; }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: { name: parsed.data.name, email: parsed.data.email, passwordHash },
    });

    const token = signToken({ userId: user.id, email: user.email });
    res.cookie("token", token, COOKIE_OPTS);
    res.json({ id: user.id, name: user.name, email: user.email });
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const parsed = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, "Invalid email or password"); return; }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user) { sendError(res, 401, "Invalid email or password"); return; }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) { sendError(res, 401, "Invalid email or password"); return; }

    const token = signToken({ userId: user.id, email: user.email });
    res.cookie("token", token, COOKIE_OPTS);
    res.json({ id: user.id, name: user.name, email: user.email });
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

    await prisma.company.deleteMany();
    const company = await prisma.company.create({ data: parsed.data });

    // Kick off regulatory detection async
    detectAndSaveRegulations(company.id).catch(console.error);

    res.json(company);
  });

  app.get("/api/company", requireAuth, async (_req: Request, res: Response) => {
    const company = await prisma.company.findFirst({
      include: {
        playbookRules: { orderBy: { clauseCategory: "asc" } },
        approvalContacts: true,
        regulations: { orderBy: { jurisdiction: "asc" } },
      },
    });
    if (!company) { sendError(res, 404, "No company configured"); return; }
    res.json(company);
  });

  // ── Regulatory ───────────────────────────────────────────────────────────────

  app.post("/api/regulatory/detect", requireAuth, async (_req: Request, res: Response) => {
    const company = await prisma.company.findFirst();
    if (!company) { sendError(res, 404, "No company configured"); return; }

    await detectAndSaveRegulations(company.id);
    const regs = await prisma.companyRegulation.findMany({
      where: { companyId: company.id },
      orderBy: { jurisdiction: "asc" },
    });
    res.json(regs);
  });

  app.get("/api/regulatory", requireAuth, async (_req: Request, res: Response) => {
    const company = await prisma.company.findFirst();
    if (!company) { res.json([]); return; }

    const regs = await prisma.companyRegulation.findMany({
      where: { companyId: company.id },
      orderBy: { jurisdiction: "asc" },
    });
    res.json(regs);
  });

  // ── Playbook Rules ───────────────────────────────────────────────────────────

  app.post("/api/playbook/rules", requireAuth, async (req: Request, res: Response) => {
    const company = await prisma.company.findFirst();
    if (!company) { sendError(res, 404, "No company configured"); return; }

    const body = req.body as { rules?: unknown[] };
    if (!Array.isArray(body.rules)) { sendError(res, 400, "rules must be an array"); return; }

    const parsed = z.array(playbookRuleSchema).safeParse(body.rules);
    if (!parsed.success) { sendError(res, 400, parsed.error.message); return; }

    await prisma.playbookRule.deleteMany({ where: { companyId: company.id } });
    await prisma.playbookRule.createMany({
      data: parsed.data.map((r) => ({ ...r, companyId: company.id })),
    });

    const rules = await prisma.playbookRule.findMany({ where: { companyId: company.id } });
    res.json(rules);
  });

  app.get("/api/playbook/rules", requireAuth, async (_req: Request, res: Response) => {
    const company = await prisma.company.findFirst();
    if (!company) { sendError(res, 404, "No company configured"); return; }

    const rules = await prisma.playbookRule.findMany({
      where: { companyId: company.id },
      orderBy: { clauseCategory: "asc" },
    });
    res.json(rules);
  });

  app.put("/api/playbook/rule/:id", requireAuth, async (req: Request, res: Response) => {
    const parsed = playbookRuleSchema.partial().safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, parsed.error.message); return; }

    const rule = await prisma.playbookRule.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(rule);
  });

  app.delete("/api/playbook/rule/:id", requireAuth, async (req: Request, res: Response) => {
    await prisma.playbookRule.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  });

  // ── Approval Contacts ────────────────────────────────────────────────────────

  app.post("/api/company/contacts", requireAuth, async (req: Request, res: Response) => {
    const company = await prisma.company.findFirst();
    if (!company) { sendError(res, 404, "No company configured"); return; }

    const body = req.body as { contacts?: unknown[] };
    if (!Array.isArray(body.contacts)) { sendError(res, 400, "contacts must be an array"); return; }

    const parsed = z.array(approvalContactSchema).safeParse(body.contacts);
    if (!parsed.success) { sendError(res, 400, parsed.error.message); return; }

    await prisma.approvalContact.deleteMany({ where: { companyId: company.id } });
    await prisma.approvalContact.createMany({
      data: parsed.data.map((c) => ({ ...c, companyId: company.id })),
    });

    const contacts = await prisma.approvalContact.findMany({ where: { companyId: company.id } });
    res.json(contacts);
  });

  // ── Documents ────────────────────────────────────────────────────────────────

  app.post(
    "/api/documents/upload",
    requireAuth,
    upload.single("contract"),
    async (req: Request, res: Response) => {
      const company = await prisma.company.findFirst();
      if (!company) { sendError(res, 400, "Complete onboarding before uploading"); return; }

      const file = req.file;
      if (!file) { sendError(res, 400, "No file uploaded"); return; }

      const contractType =
        (req.body as { contractType?: string }).contractType ?? "SUPPLIER_AGREEMENT";

      const doc = await prisma.uploadedDocument.create({
        data: {
          companyId: company.id,
          filename: file.filename,
          originalName: file.originalname,
          contractType,
          status: "UPLOADED",
        },
      });

      res.json(doc);
    }
  );

  app.get("/api/documents", requireAuth, async (_req: Request, res: Response) => {
    const company = await prisma.company.findFirst();
    if (!company) { res.json([]); return; }

    const docs = await prisma.uploadedDocument.findMany({
      where: { companyId: company.id },
      orderBy: { uploadedAt: "desc" },
    });
    res.json(docs);
  });

  app.get("/api/documents/:id", requireAuth, async (req: Request, res: Response) => {
    const doc = await prisma.uploadedDocument.findUnique({
      where: { id: req.params.id },
      include: { reviewResults: { include: { feedback: true } } },
    });
    if (!doc) { sendError(res, 404, "Document not found"); return; }
    res.json(doc);
  });

  // ── Review ───────────────────────────────────────────────────────────────────

  app.post("/api/review/:documentId", requireAuth, async (req: Request, res: Response) => {
    const doc = await prisma.uploadedDocument.findUnique({
      where: { id: req.params.documentId },
    });
    if (!doc) { sendError(res, 404, "Document not found"); return; }
    if (doc.status === "PROCESSING") { sendError(res, 409, "Review already in progress"); return; }

    if (doc.status === "COMPLETE") {
      await prisma.reviewResult.deleteMany({ where: { documentId: doc.id } });
      await prisma.extractedClause.deleteMany({ where: { documentId: doc.id } });
    }

    runReview(doc.id).catch(console.error);
    res.json({ status: "started", documentId: doc.id });
  });

  app.get("/api/review/:documentId", requireAuth, async (req: Request, res: Response) => {
    const doc = await prisma.uploadedDocument.findUnique({
      where: { id: req.params.documentId },
      include: {
        reviewResults: {
          include: { feedback: true },
          orderBy: { clauseCategory: "asc" },
        },
      },
    });
    if (!doc) { sendError(res, 404, "Document not found"); return; }
    res.json(doc);
  });

  // ── Feedback ─────────────────────────────────────────────────────────────────

  app.post("/api/feedback/:resultId", requireAuth, async (req: Request, res: Response) => {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, parsed.error.message); return; }

    const feedback = await prisma.userFeedback.upsert({
      where: { resultId: req.params.resultId },
      create: { resultId: req.params.resultId, ...parsed.data },
      update: parsed.data,
    });
    res.json(feedback);
  });

  // ── Stats ────────────────────────────────────────────────────────────────────

  app.get("/api/stats", requireAuth, async (_req: Request, res: Response) => {
    const company = await prisma.company.findFirst();
    if (!company) { res.json(null); return; }

    const [docs, results] = await Promise.all([
      prisma.uploadedDocument.findMany({ where: { companyId: company.id } }),
      prisma.reviewResult.findMany({
        where: { document: { companyId: company.id } },
        include: { feedback: true },
      }),
    ]);

    const complete = docs.filter((d) => d.status === "COMPLETE").length;
    const redOpen = results.filter(
      (r) => r.ragStatus === "RED" && r.feedback?.userAction !== "ACCEPTED" && r.feedback?.userAction !== "DISMISSED"
    ).length;
    const escalations = results.filter(
      (r) => r.escalationRequired && r.feedback?.userAction !== "ESCALATED" && r.feedback?.userAction !== "DISMISSED"
    ).length;
    const accepted = results.filter((r) => r.feedback?.userAction === "ACCEPTED").length;

    const categoryRed: Record<string, number> = {};
    for (const r of results) {
      if (r.ragStatus === "RED") {
        categoryRed[r.clauseCategory] = (categoryRed[r.clauseCategory] ?? 0) + 1;
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
        RED:   results.filter((r) => r.ragStatus === "RED").length,
        AMBER: results.filter((r) => r.ragStatus === "AMBER").length,
        GREEN: results.filter((r) => r.ragStatus === "GREEN").length,
        GREY:  results.filter((r) => r.ragStatus === "GREY").length,
      },
      topIssues,
    });
  });

  // ── Portfolio ─────────────────────────────────────────────────────────────────

  app.get("/api/portfolio", requireAuth, async (_req: Request, res: Response) => {
    const company = await prisma.company.findFirst();
    if (!company) { res.json(null); return; }

    const results = await prisma.reviewResult.findMany({
      where: { document: { companyId: company.id, status: "COMPLETE" } },
      include: { document: { select: { contractType: true, id: true } } },
    });

    if (results.length === 0) { res.json(null); return; }

    const GROUPS = [
      { label: "Liability & Risk",      icon: "⚖️",  cats: ["LIABILITY_CAP","INDEMNITY","WARRANTIES","LIQUIDATED_DAMAGES","INSURANCE"] },
      { label: "Data & Privacy",        icon: "🔐",  cats: ["DATA_PRIVACY","CONFIDENTIALITY","SANCTIONS_COMPLIANCE","MODERN_SLAVERY","ANTI_BRIBERY"] },
      { label: "IP & Technology",       icon: "💡",  cats: ["IP_OWNERSHIP","SOURCE_CODE_ESCROW","ACCEPTANCE_TESTING","MARKETING_RIGHTS","SERVICE_LEVELS"] },
      { label: "Termination & Renewal", icon: "📅",  cats: ["TERMINATION","AUTO_RENEWAL","BREAK_CLAUSE","CHANGE_OF_CONTROL","REGULATORY_CHANGE"] },
    ];

    const groups = GROUPS.map((g) => {
      const gr = results.filter((r) => g.cats.includes(r.clauseCategory));
      return {
        label: g.label,
        icon:  g.icon,
        red:   gr.filter((r) => r.ragStatus === "RED").length,
        amber: gr.filter((r) => r.ragStatus === "AMBER").length,
        green: gr.filter((r) => r.ragStatus === "GREEN").length,
      };
    });

    const totalDocs = new Set(results.map((r) => r.documentId)).size;

    const categoryRed: Record<string, number> = {};
    const categoryTotal: Record<string, number> = {};
    for (const r of results) {
      categoryTotal[r.clauseCategory] = (categoryTotal[r.clauseCategory] ?? 0) + 1;
      if (r.ragStatus === "RED") categoryRed[r.clauseCategory] = (categoryRed[r.clauseCategory] ?? 0) + 1;
    }
    const topRedCategories = Object.entries(categoryRed)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([category, count]) => ({ category, count, pct: Math.round((count / totalDocs) * 100) }));

    const typeMap: Record<string, { red: number; amber: number; docIds: Set<string> }> = {};
    for (const r of results) {
      const t = r.document.contractType;
      if (!typeMap[t]) typeMap[t] = { red: 0, amber: 0, docIds: new Set() };
      typeMap[t].docIds.add(r.documentId);
      if (r.ragStatus === "RED")   typeMap[t].red++;
      if (r.ragStatus === "AMBER") typeMap[t].amber++;
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
    const company = await prisma.company.findFirst();
    if (!company) { res.json(null); return; }

    const docs = await prisma.uploadedDocument.findMany({
      where: { companyId: company.id },
      include: {
        reviewResults: {
          where: { clauseCategory: { in: ["AUTO_RENEWAL", "TERMINATION", "BREAK_CLAUSE", "PAYMENT_TERMS", "CHANGE_OF_CONTROL"] } },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });

    const flagged = docs
      .filter((d) => d.status === "COMPLETE")
      .flatMap((d) =>
        d.reviewResults
          .filter((r) => r.ragStatus === "RED" || r.ragStatus === "AMBER")
          .map((r) => ({
            id:            r.id,
            contractName:  d.originalName,
            contractType:  d.contractType.replace(/_/g, " "),
            clauseCategory: r.clauseCategory,
            ragStatus:     r.ragStatus,
            summary:       r.clauseSummary,
            uploadedAt:    d.uploadedAt.toISOString(),
          }))
      )
      .sort((a, b) => (a.ragStatus === "RED" && b.ragStatus !== "RED" ? -1 : 1));

    const total = docs.length || 1;
    const statusCounts = {
      complete:   docs.filter((d) => d.status === "COMPLETE").length,
      processing: docs.filter((d) => d.status === "PROCESSING").length,
      uploaded:   docs.filter((d) => d.status === "UPLOADED").length,
      failed:     docs.filter((d) => d.status === "FAILED").length,
    };
    const overview = [
      { label: "Reviewed",       count: statusCounts.complete,   pct: Math.round(statusCounts.complete   / total * 100) },
      { label: "Processing",     count: statusCounts.processing, pct: Math.round(statusCounts.processing / total * 100) },
      { label: "Awaiting review",count: statusCounts.uploaded,   pct: Math.round(statusCounts.uploaded   / total * 100) },
      { label: "Failed",         count: statusCounts.failed,     pct: Math.round(statusCounts.failed     / total * 100) },
    ].filter((o) => o.count > 0);

    res.json({ flagged, overview, totalDocuments: docs.length });
  });

  // ── Health ───────────────────────────────────────────────────────────────────

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  return createServer(app);
}
