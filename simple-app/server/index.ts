import "./env";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initPocketBase } from "./pb";

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

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://zanelegal.ai",
  "https://www.zanelegal.ai",
  "https://app.zanelegal.ai",
  "http://localhost:3000",
  "http://localhost:5173",
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, cb) => {
    // Allow no-origin requests (same-domain, curl, mobile apps, etc.)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    // In production with FRONTEND_URL set, only listed origins are allowed.
    // Without FRONTEND_URL (local dev / same-origin Railway), we allow all -
    // httpOnly cookies are the real auth boundary in that case.
    if (process.env.NODE_ENV === "production" && process.env.FRONTEND_URL) {
      return cb(new Error(`CORS: origin ${origin} not allowed`));
    }
    cb(null, true);
  },
  credentials: true,
}));

// Force HTTPS in production (Railway terminates TLS and sets x-forwarded-proto).
// trust proxy (set above) ensures Express reads the header correctly.
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] !== "https") {
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

  // Run recovery on startup
  recoverStuckDocuments().catch(console.error);
  // Also run every 30 minutes to catch any newly-stuck documents
  setInterval(() => { recoverStuckDocuments().catch(console.error); }, 30 * 60 * 1000);

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
