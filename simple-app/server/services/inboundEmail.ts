/**
 * Inbound email infrastructure (Section 1).
 *
 * Every company has a dedicated address `{slug}@inbox.zanelegal.ai`. Users CC,
 * forward, or email contracts there; Mailgun's inbound route webhooks each
 * message into POST /api/inbound-email. This module owns:
 *   - per-company address generation (unique slug)
 *   - schema self-heal: companies.inbound_email + inbound_emails / inbound_rejections
 *   - backfill of inbound_email for existing companies
 *   - Mailgun signature verification
 *   - recipient → company resolution and sender authorisation
 *
 * Security (1d): only emails whose sender is a registered user of the recipient
 * company are persisted for processing. Anything else is logged silently to
 * inbound_rejections and ignored — no reply, nothing revealing. Attachment
 * *processing* (intent + model calls) is a later section and always runs through
 * the existing PII anonymisation pipeline, exactly like manual uploads.
 */

import crypto from "crypto";
import { pb } from "../pb.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

export function inboundDomain(): string {
  return (process.env.INBOUND_EMAIL_DOMAIN ?? "inbox.zanelegal.ai").trim().toLowerCase();
}

// ─── Slug / address generation ────────────────────────────────────────────────

/** Slugify a company name to a short, email-safe local part. */
export function slugifyCompanyName(name: string): string {
  const base = (name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")   // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, "")        // trim hyphens
    .replace(/-{2,}/g, "-");
  // Prefer the first meaningful token (e.g. "Seko Logistics Ltd" → "seko"),
  // but skip throwaway leading words; fall back to the whole slug.
  const STOP = new Set(["the", "a", "an"]);
  const tokens = base.split("-").filter((t) => t && !STOP.has(t));
  const first = tokens[0] ?? "";
  // Use the first token if it's distinctive enough, else the joined slug.
  const candidate = first.length >= 3 ? first : tokens.slice(0, 2).join("-");
  return (candidate || base || "company").slice(0, 40);
}

/**
 * Generate a unique inbound address for a company. Checks existing
 * companies.inbound_email values and disambiguates with a numeric suffix.
 */
export async function generateUniqueInboundEmail(name: string, excludeCompanyId?: string): Promise<string> {
  const domain = inboundDomain();
  const slug = slugifyCompanyName(name);

  let taken = new Set<string>();
  try {
    const all = await pb.collection("companies").getFullList({ fields: "id,inbound_email" });
    taken = new Set(
      all
        .filter((c) => c.id !== excludeCompanyId)
        .map((c) => String(c["inbound_email"] ?? "").trim().toLowerCase())
        .filter(Boolean)
    );
  } catch {
    // Field may not exist yet on older deployments — treat as no collisions.
  }

  let candidate = `${slug}@${domain}`;
  if (!taken.has(candidate)) return candidate;
  for (let n = 2; n < 1000; n++) {
    candidate = `${slug}-${n}@${domain}`;
    if (!taken.has(candidate)) return candidate;
  }
  // Extremely unlikely fallback
  return `${slug}-${crypto.randomBytes(3).toString("hex")}@${domain}`;
}

// ─── Schema self-heal ─────────────────────────────────────────────────────────

let schemaEnsured = false;

const AUTODATE = [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
];

async function ensureCollection(name: string, fields: PBRecord[]): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collections = pb.collections as any;
  try {
    const col = await collections.getOne(name);
    const existing: PBRecord[] = col.fields ?? col.schema ?? [];
    const names = new Set(existing.map((f) => f.name));
    const missing = fields.filter((f) => !names.has(f.name));
    if (missing.length > 0) {
      await collections.update(col.id, { fields: [...existing, ...missing] });
    }
  } catch {
    await collections.create({ name, type: "base", fields }).catch((e: unknown) =>
      console.warn(`[inbound] could not create ${name}:`, (e as Error)?.message));
  }
}

/** Add companies.inbound_email and create the inbound_emails / inbound_rejections collections. */
export async function ensureInboundSchema(): Promise<void> {
  if (schemaEnsured) return;
  try {
    // companies.inbound_email
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collections = pb.collections as any;
    const companies = await collections.getOne("companies");
    const compFields: PBRecord[] = companies.fields ?? companies.schema ?? [];
    if (!compFields.some((f) => f.name === "inbound_email")) {
      await collections.update(companies.id, {
        fields: [...compFields, { name: "inbound_email", type: "text", required: false }],
      });
    }

    // uploaded_documents.source — origin flag ("" | "email" | "integration").
    const docs = await collections.getOne("uploaded_documents").catch(() => null);
    if (docs) {
      const docFields: PBRecord[] = docs.fields ?? docs.schema ?? [];
      if (!docFields.some((f) => f.name === "source")) {
        await collections.update(docs.id, {
          fields: [...docFields, { name: "source", type: "text", required: false }],
        });
      }
    }

    await ensureCollection("inbound_emails", [
      { name: "company", type: "text", required: true },
      { name: "sender", type: "text", required: false },
      { name: "recipient", type: "text", required: false },
      { name: "subject", type: "text", required: false },
      { name: "bodyText", type: "text", required: false },
      { name: "attachments", type: "text", required: false }, // JSON array
      { name: "messageId", type: "text", required: false },
      { name: "status", type: "text", required: false },       // RECEIVED | CLARIFICATION_SENT | ...
      { name: "intent", type: "text", required: false },       // review_contract | draft_document | question | unclear
      { name: "intentParams", type: "text", required: false }, // JSON of extracted parameters
      ...AUTODATE,
    ]);

    await ensureCollection("inbound_rejections", [
      { name: "sender", type: "text", required: false },
      { name: "recipient", type: "text", required: false },
      { name: "subject", type: "text", required: false },
      { name: "reason", type: "text", required: false },
      { name: "companyId", type: "text", required: false },
      ...AUTODATE,
    ]);

    schemaEnsured = true;
  } catch (err) {
    console.warn("[inbound] ensureInboundSchema failed (non-fatal):", (err as Error)?.message);
  }
}

/** Backfill inbound_email for every existing company that lacks one. */
export async function backfillInboundEmails(): Promise<number> {
  await ensureInboundSchema();
  let filled = 0;
  try {
    const all = await pb.collection("companies").getFullList({ fields: "id,name,inbound_email" });
    for (const c of all) {
      if (String(c["inbound_email"] ?? "").trim()) continue;
      const addr = await generateUniqueInboundEmail((c["name"] as string) ?? "company", c.id);
      await pb.collection("companies").update(c.id, { inbound_email: addr }).catch(() => {});
      filled++;
    }
    if (filled > 0) console.log(`[inbound] backfilled inbound_email for ${filled} company(ies)`);
  } catch (err) {
    console.warn("[inbound] backfill failed (non-fatal):", (err as Error)?.message);
  }
  return filled;
}

// ─── Mailgun signature verification ───────────────────────────────────────────

/**
 * Verify a Mailgun webhook signature.
 * signature == HMAC-SHA256(key=signing_key, msg=timestamp+token), hex.
 * Also rejects stale timestamps (> 15 min) to limit replay.
 */
export function verifyMailgunSignature(timestamp?: string, token?: string, signature?: string): boolean {
  const signingKey = process.env.MAILGUN_SIGNING_KEY;
  if (!signingKey) {
    console.warn("[inbound] MAILGUN_SIGNING_KEY not set — rejecting inbound email");
    return false;
  }
  if (!timestamp || !token || !signature) return false;

  // Replay guard: timestamp is unix seconds
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 15 * 60) return false;

  const computed = crypto.createHmac("sha256", signingKey).update(timestamp + token).digest("hex");
  // Timing-safe compare (lengths must match for timingSafeEqual)
  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ─── Recipient → company resolution ───────────────────────────────────────────

/** Extract every @inboundDomain address from a recipient/To/Cc string. */
export function extractInboundAddresses(...fields: Array<string | undefined>): string[] {
  const domain = inboundDomain();
  const found = new Set<string>();
  const re = /[a-z0-9._%+-]+@[a-z0-9.-]+/gi;
  for (const f of fields) {
    if (!f) continue;
    const matches = f.match(re) ?? [];
    for (const raw of matches) {
      const addr = raw.toLowerCase();
      if (addr.endsWith(`@${domain}`)) found.add(addr);
    }
  }
  return Array.from(found);
}

/** Resolve the company whose inbound_email matches one of the recipient addresses. */
export async function resolveCompanyByRecipient(addresses: string[]): Promise<PBRecord | null> {
  if (addresses.length === 0) return null;
  try {
    const all = await pb.collection("companies").getFullList({ fields: "id,name,inbound_email,role_in_contracts" });
    const wanted = new Set(addresses.map((a) => a.toLowerCase()));
    return all.find((c) => wanted.has(String(c["inbound_email"] ?? "").trim().toLowerCase())) ?? null;
  } catch {
    return null;
  }
}

// ─── Sender authorisation ─────────────────────────────────────────────────────

/** Pull a bare email out of a "Name <email>" style From/sender header. */
export function normaliseEmail(raw?: string): string {
  if (!raw) return "";
  const angle = raw.match(/<([^>]+)>/);
  const addr = (angle ? angle[1] : raw).trim().toLowerCase();
  const m = addr.match(/[a-z0-9._%+-]+@[a-z0-9.-]+/);
  return m ? m[0] : "";
}

/**
 * Set of email addresses authorised to act on a company's behalf:
 *   - the company owner (role_in_contracts holds the owner email)
 *   - users whose `company` relation points at this company
 *   - accepted team invites for this company
 */
export async function getAuthorisedSenders(company: PBRecord): Promise<Set<string>> {
  const out = new Set<string>();
  const owner = String(company["role_in_contracts"] ?? "").trim().toLowerCase();
  if (owner) out.add(owner);

  const [users, invites] = await Promise.all([
    pb.collection("users").getFullList({ filter: `company = "${company.id}"`, fields: "email" }).catch(() => [] as PBRecord[]),
    pb.collection("team_invites").getFullList({ filter: `companyId = "${company.id}" && status = "accepted"`, fields: "email" }).catch(() => [] as PBRecord[]),
  ]);
  for (const u of users) { const e = String(u["email"] ?? "").trim().toLowerCase(); if (e) out.add(e); }
  for (const i of invites) { const e = String(i["email"] ?? "").trim().toLowerCase(); if (e) out.add(e); }
  return out;
}

// ─── Rejection logging (silent) ───────────────────────────────────────────────

export async function logRejection(input: {
  sender: string; recipient: string; subject: string; reason: string; companyId?: string;
}): Promise<void> {
  try {
    await pb.collection("inbound_rejections").create({
      sender: input.sender.slice(0, 320),
      recipient: input.recipient.slice(0, 320),
      subject: (input.subject ?? "").slice(0, 500),
      reason: input.reason,
      companyId: input.companyId ?? "",
    });
  } catch (err) {
    console.warn("[inbound] could not log rejection (non-fatal):", (err as Error)?.message);
  }
}
