import "./env";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initPocketBase } from "./pb";
import { startIntegrationRenewalLoop } from "./services/integrationRenewal";
import { startMonthlyReportLoop } from "./services/monthlyReportSchedule";
import { isOriginAllowed } from "./lib/corsPolicy";
import { missingEmailConfig } from "./services/emailService";

// Prevent unhandled promise rejections from crashing the server.
// In Node 20, the default behaviour is to exit(1) on unhandled rejections,
// which kills the Express process and causes clients to see "Failed to fetch"
// on every subsequent request. Logging here keeps the server alive.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

// Railway (and most PaaS) sets PORT dynamically. Always prefer the env var so
// the server is reachable via the platform's load balancer. Fall back to 3000
// for local dev where PORT is typically unset.
const PORT = parseInt(process.env.PORT ?? "3000", 10);

const app = express();

// Trust Railway's reverse proxy so req.headers['x-forwarded-proto'] is populated
// correctly. Without this, the HTTPS redirect reads the raw (always HTTP) connection
// and causes a redirect loop.
app.set("trust proxy", 1);

// The rule lives in server/lib/corsPolicy.ts, with tests. In production the
// allowlist is always enforced; it is no longer conditional on FRONTEND_URL,
// which describes a deployment shape rather than a security posture.
app.use(cors({
  // A disallowed origin gets cb(null, false), not an Error. Both withhold the
  // Access-Control-Allow-Origin header, which is the whole protection, but an
  // Error reaches the global handler and answers 500, so every probe from an
  // unknown origin was logged as a server fault and billed as one. Withholding
  // the header quietly is the correct response: the browser blocks the read.
  origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
  credentials: true,
}));

// Force HTTPS in production (Railway terminates TLS and sets x-forwarded-proto).
// trust proxy (set above) ensures Express reads the header correctly.
// Guard: only redirect when the header is EXPLICITLY "http". If it is absent
// (undefined) do not redirect, as that would create a loop in environments
// where the proxy does not forward the header.
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    const proto = req.headers["x-forwarded-proto"];
    if (proto && proto !== "https") {
      return res.redirect(301, "https://" + req.headers.host + req.url);
    }
    next();
  });
}

// Security headers on every response
app.use((_req, res, next) => {
  // HSTS: browsers will only use HTTPS for this domain for 1 year
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  // Prevent MIME-type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Prevent clickjacking via iframe embedding
  res.setHeader("X-Frame-Options", "DENY");
  // Legacy XSS filter (belt-and-suspenders; CSP is the modern replacement)
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Recover documents stuck in processing state from a previous crash
async function recoverStuckDocuments() {
  try {
    const { pb } = await import("./pb.js");
    const processingStatuses = ["PROCESSING", "PARSING", "ANONYMISING", "CLASSIFYING", "COMPARING"];
    const stuckThreshold = new Date(Date.now() - 25 * 60 * 1000).toISOString(); // 25 minutes ago

    for (const status of processingStatuses) {
      const docs = await pb.collection("uploaded_documents").getFullList({
        filter: `status = "${status}" && updated < "${stuckThreshold}"`,
        fields: "id,originalName,status,updated",
      }).catch(() => [] as Array<{ id: string; originalName: string; status: string; updated: string }>);

      for (const doc of docs) {
        console.warn(`[recovery] Document ${doc.id} (${doc.originalName}) stuck in ${status} since ${doc.updated}. Marking FAILED.`);
        await pb.collection("uploaded_documents").update(doc.id, {
          status: "FAILED",
          lastError: `Review did not complete (stuck in ${status} state). The server may have restarted during processing. Please retry.`,
        }).catch((e: unknown) => console.error("[recovery] Failed to update stuck doc:", e));
      }
    }
  } catch (err) {
    console.error("[recovery] Stuck document check failed:", err);
  }
}

(async () => {
  // Ensure uploads directory exists (Railway ephemeral disk may not have it)
  fs.mkdirSync(path.join(process.cwd(), "uploads"), { recursive: true });

  await initPocketBase();

  // Outbound email is optional, but silently missing it means approvers are
  // never notified while the app looks like it worked. Say so once, at boot.
  {
    const missing = missingEmailConfig();
    if (missing.length) {
      console.warn(`[Zane] Outbound email is NOT configured (missing ${missing.join(", ")}). Approval requests will be created and audited, but no one will be notified. Run: npx tsx scripts/check-smtp.ts`);
    }
  }

  // Run recovery on startup
  recoverStuckDocuments().catch(console.error);
  // Also run every 30 minutes to catch any newly-stuck documents
  setInterval(() => { recoverStuckDocuments().catch(console.error); }, 30 * 60 * 1000);

  // Keep watch-folder webhooks (Google Drive / SharePoint) alive past their TTL.
  startIntegrationRenewalLoop();

  // Send the monthly legal report to each company's CFO and GC. Off unless
  // MONTHLY_REPORT_SEND is set; logs which it is either way.
  startMonthlyReportLoop();

  const server = await registerRoutes(app);

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  server.listen(PORT, () => {
    log(`serving on port ${PORT}`);
  });
})();
