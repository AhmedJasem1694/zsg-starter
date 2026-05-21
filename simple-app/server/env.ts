import { config } from "dotenv";

config();

if (!process.env.POCKETBASE_URL) {
  console.warn("Warning: POCKETBASE_URL is not set - defaulting to http://localhost:8090");
}

if (!process.env.POCKETBASE_ADMIN_EMAIL || !process.env.POCKETBASE_ADMIN_PASSWORD) {
  console.warn(
    "Warning: POCKETBASE_ADMIN_EMAIL or POCKETBASE_ADMIN_PASSWORD not set - using insecure defaults"
  );
}

if (!process.env.OPENROUTER_API_KEY) {
  console.warn("Warning: OPENROUTER_API_KEY is not set - LLM features will fail");
}

if (!process.env.COMPANIES_HOUSE_API_KEY) {
  console.warn("Warning: COMPANIES_HOUSE_API_KEY is not set - company search will fall back to OpenCorporates/LLM only");
}

// SMTP is optional - escalation emails are skipped gracefully if not configured
// Required vars: SMTP_HOST, SMTP_USER, SMTP_PASS
// Optional vars: SMTP_PORT (default 587), SMTP_FROM, APP_URL

if (!process.env.JWT_SECRET) {
  console.warn("Warning: JWT_SECRET not set — using insecure default. Set this in production.");
}

if (!process.env.FRONTEND_URL) {
  console.info("Info: FRONTEND_URL not set — assuming same-origin deployment.");
}

if (process.env.NODE_ENV !== "production") {
  console.info(`Info: NODE_ENV is "${process.env.NODE_ENV ?? "undefined"}" — not running in production mode.`);
}

if (!process.env.APP_URL) {
  console.warn("Warning: APP_URL is not set - webhook registration for integrations will fail");
}

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn("Warning: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set - Google Drive integration disabled");
}

if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
  console.warn("Warning: MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET not set - SharePoint integration disabled");
}
