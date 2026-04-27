import { config } from "dotenv";

config();

if (!process.env.DATABASE_URL) {
  console.warn("Warning: DATABASE_URL is not set — database features will fail");
}

if (!process.env.OPENROUTER_API_KEY) {
  console.warn("Warning: OPENROUTER_API_KEY is not set — LLM features will fail");
}
