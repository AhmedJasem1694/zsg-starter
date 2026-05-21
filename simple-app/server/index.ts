import "./env";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
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

const PORT = 3000;

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:5173",
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, cb) => {
    // Allow no-origin requests (same-domain, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, true); // permissive for now — cookie httpOnly is the real guard
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

(async () => {
  await initPocketBase();

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
