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
