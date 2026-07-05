/**
 * Counterparty Name Backfill
 *
 * Re-runs the review pipeline's counterparty extraction (same prompt and
 * model as reviewOrchestrator stage 2) for documents whose counterpartyName
 * is empty, and persists the result to uploaded_documents.
 *
 * Document text is read from the uploaded file on disk when present,
 * otherwise reconstructed from the document's extracted_clauses.
 *
 * Usage:
 *   npx tsx scripts/backfill-counterparty.ts <docId> [docId...]   # specific documents
 *   npx tsx scripts/backfill-counterparty.ts --all                # every COMPLETE doc with empty counterpartyName
 *   npx tsx scripts/backfill-counterparty.ts --all --dry-run      # report only, no writes
 */

import { config } from "dotenv";
config();

import PocketBase from "pocketbase";
import fs from "fs";
import path from "path";
import { parseDocument } from "../server/services/documentParser.js";
import { chatComplete } from "../server/services/openrouter.js";
import { getModelForTask } from "../server/services/modelRouter.js";

const POCKETBASE_URL = process.env.POCKETBASE_URL ?? "http://localhost:8090";
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL ?? "admin@zane.local";
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD ?? "changeme1234";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const all = args.includes("--all");
const docIds = args.filter((a) => !a.startsWith("--"));

if (!all && docIds.length === 0) {
  console.error("Usage: npx tsx scripts/backfill-counterparty.ts <docId> [docId...] | --all [--dry-run]");
  process.exit(1);
}

const pb = new PocketBase(POCKETBASE_URL);
// Concurrent requests to the same collection would otherwise cancel each other.
pb.autoCancellation(false);

async function getDocumentText(doc: Record<string, unknown>): Promise<string> {
  const filename = String(doc["filename"] ?? "");
  if (filename) {
    const filePath = path.join(process.cwd(), "uploads", filename);
    if (fs.existsSync(filePath)) {
      try {
        const parsed = await parseDocument(filePath);
        if (parsed.text.trim().length > 20) return parsed.text;
      } catch (err) {
        console.warn(`  file parse failed (${filename}), falling back to extracted clauses:`, (err as Error)?.message);
      }
    }
  }
  const clauses = await pb.collection("extracted_clauses").getFullList({
    filter: `document = "${doc.id}"`,
    fields: "rawText",
    sort: "+id",
  });
  return clauses.map((c) => String(c["rawText"] ?? "")).join("\n\n");
}

// Same model and acceptance rules as reviewOrchestrator stage 2. The prompt is
// extended for backfill: the text here is reconstructed from extracted clause
// chunks, which often lack the formal "between X and Y" parties clause, so the
// document title and references to a parent agreement are valid evidence too.
async function extractCounterparty(text: string, originalName: string): Promise<string | null> {
  const model = getModelForTask("metadata_extraction");
  const snippet = text.slice(0, 12_000);
  const response = await chatComplete([{
    role: "user",
    content: `Extract the counterparty company or individual name from this contract document. Look in: (1) the opening "between X and Y" parties clause, (2) definitions of "Supplier", "Vendor", "Customer", "Client", "Service Provider", (3) the agreement title/header or the name of a parent agreement this document is a schedule to, (4) the signature block, (5) company names in support email domains or product names. Return ONLY the entity name, preferring the full legal name if stated (e.g. "Attio Limited") but a consistently used trading or product name is acceptable when no legal name appears. No explanation, no JSON, just the name. If genuinely not identifiable return the single word: unknown\n\nDocument name: ${originalName}\n\n${snippet}`,
  }], 60, 25_000, model);
  const extracted = response.trim().replace(/^["']|["']$/g, "");
  if (extracted && extracted.toLowerCase() !== "unknown" && extracted.length < 120) return extracted;
  return null;
}

async function main() {
  await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

  let docs: Record<string, unknown>[];
  if (all) {
    const found = await pb.collection("uploaded_documents").getFullList({ filter: `status = "COMPLETE"` });
    docs = found.filter((d) => !String(d["counterpartyName"] ?? "").trim());
    console.log(`Found ${docs.length} COMPLETE document(s) with empty counterpartyName.`);
  } else {
    docs = await Promise.all(docIds.map((id) => pb.collection("uploaded_documents").getOne(id)));
  }

  let updated = 0;
  for (const doc of docs) {
    const label = `${doc.id} (${doc["originalName"]})`;
    const existing = String(doc["counterpartyName"] ?? "").trim();
    if (existing) {
      console.log(`skip ${label}: already has counterpartyName "${existing}"`);
      continue;
    }
    const text = await getDocumentText(doc);
    if (text.trim().length < 20) {
      console.log(`skip ${label}: no text available (no file on disk, no extracted clauses)`);
      continue;
    }
    const name = await extractCounterparty(text, String(doc["originalName"] ?? "")).catch((err) => {
      console.warn(`  extraction failed for ${label}:`, (err as Error)?.message);
      return null;
    });
    if (!name) {
      console.log(`no name found for ${label}`);
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] would set counterpartyName="${name}" on ${label}`);
    } else {
      await pb.collection("uploaded_documents").update(String(doc.id), { counterpartyName: name });
      console.log(`updated ${label}: counterpartyName="${name}"`);
    }
    updated++;
  }
  console.log(`Done. ${updated}/${docs.length} document(s) ${dryRun ? "would be" : ""} updated.`);
}

main().catch((err) => {
  const e = err as { message?: string; status?: number; response?: unknown; url?: string; stack?: string };
  console.error("Backfill failed:", e?.message ?? err);
  if (e?.status !== undefined) console.error("  status:", e.status, "url:", e.url, "response:", JSON.stringify(e.response));
  if (e?.stack) console.error(e.stack.split("\n").slice(0, 6).join("\n"));
  process.exit(1);
});
