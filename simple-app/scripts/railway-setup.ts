#!/usr/bin/env tsx
/**
 * Railway + PocketBase Setup Script
 *
 * 1. Links the local directory to a Railway project (interactive)
 * 2. Lists services so you can identify the PocketBase service
 * 3. Retrieves (or generates) the PocketBase service domain
 * 4. Creates the first PocketBase superuser via the API
 * 5. Sets POCKETBASE_URL / POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD
 *    on your app service so it can connect
 *
 * Usage:
 *   npx tsx scripts/railway-setup.ts
 */

import { execSync, spawnSync } from "child_process";
import * as readline from "readline";

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string) { console.log(`\n${msg}`); }
function step(msg: string) { console.log(`\n\x1b[36m▶ ${msg}\x1b[0m`); }
function ok(msg: string)   { console.log(`\x1b[32m✓ ${msg}\x1b[0m`); }
function warn(msg: string) { console.log(`\x1b[33m⚠ ${msg}\x1b[0m`); }
function fail(msg: string) { console.error(`\x1b[31m✗ ${msg}\x1b[0m`); }

function railway(args: string, { json = false, silent = false } = {}): string {
  const cmd = `railway ${args}${json ? " --json" : ""}`;
  try {
    return execSync(cmd, { encoding: "utf8", stdio: silent ? "pipe" : ["inherit", "pipe", "pipe"] }).trim();
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    if (!silent) {
      const msg = err.stderr?.trim() || err.stdout?.trim() || err.message || "unknown error";
      throw new Error(`railway ${args}: ${msg}`);
    }
    return "";
  }
}

function railwayInteractive(args: string): number {
  const result = spawnSync("railway", args.split(" "), { stdio: "inherit" });
  return result.status ?? 1;
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function prompt(question: string, defaultVal = ""): Promise<string> {
  const hint = defaultVal ? ` \x1b[2m(${defaultVal})\x1b[0m` : "";
  return new Promise((resolve) => {
    rl.question(`${question}${hint}: `, (answer) => {
      resolve(answer.trim() || defaultVal);
    });
  });
}

function promptSecret(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(`${question}: `);
    // Hide input if the terminal supports it
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    let value = "";
    const onData = (ch: Buffer) => {
      const c = ch.toString();
      if (c === "\r" || c === "\n") {
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(value);
      } else if (c === "") {
        process.exit(1); // Ctrl-C
      } else if (c === "" || c === "\b") {
        if (value.length > 0) { value = value.slice(0, -1); process.stdout.write("\b \b"); }
      } else {
        value += c;
        process.stdout.write("*");
      }
    };
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

// ── Step 1: Check Railway CLI ─────────────────────────────────────────────────

step("Checking Railway CLI");
try {
  const ver = execSync("railway --version", { encoding: "utf8" }).trim();
  ok(`Found: ${ver}`);
} catch {
  fail("Railway CLI not found. Install it with:");
  log("  npm install -g @railway/cli\n  or: brew install railway");
  process.exit(1);
}

// ── Step 2: Link project ──────────────────────────────────────────────────────

step("Linking Railway project");

let alreadyLinked = false;
try {
  const status = railway("status", { silent: true });
  if (status && !status.includes("No linked project")) {
    alreadyLinked = true;
    ok("Already linked to a project");
    log(status);
  }
} catch { /* not linked */ }

if (!alreadyLinked) {
  log("Running `railway link` — choose your project in the prompt below.\n");
  const exitCode = railwayInteractive("link");
  if (exitCode !== 0) {
    fail("railway link failed or was cancelled.");
    process.exit(1);
  }
  ok("Project linked");
}

// ── Step 3: List services ─────────────────────────────────────────────────────

step("Fetching services");

interface RailwayService { id: string; name: string; }

let services: RailwayService[] = [];
try {
  const raw = railway("service list", { json: true, silent: true });
  services = JSON.parse(raw) as RailwayService[];
} catch {
  // Older Railway CLI may not support --json on service list
  const raw = railway("service list", { silent: true });
  services = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((name, i) => ({ id: String(i), name }));
}

if (services.length === 0) {
  fail("No services found in this project. Add services in the Railway dashboard first.");
  process.exit(1);
}

log("Services in this project:");
services.forEach((s, i) => log(`  [${i + 1}] ${s.name}`));

// ── Step 4: Pick PocketBase service ──────────────────────────────────────────

let pbServiceName = "";
const autoDetected = services.find((s) =>
  s.name.toLowerCase().includes("pocket") || s.name.toLowerCase().includes("pb")
);

const pbIndexStr = await prompt(
  `\nWhich service is PocketBase? (enter number)`,
  autoDetected ? String(services.indexOf(autoDetected) + 1) : "1"
);
const pbIndex = parseInt(pbIndexStr, 10) - 1;
if (pbIndex < 0 || pbIndex >= services.length) {
  fail("Invalid selection.");
  process.exit(1);
}
pbServiceName = services[pbIndex].name;
ok(`PocketBase service: ${pbServiceName}`);

// ── Step 5: Get (or generate) the PocketBase domain ──────────────────────────

step(`Getting domain for '${pbServiceName}'`);

let pbUrl = "";
try {
  const domainOutput = railway(`domain -s "${pbServiceName}"`, { json: true, silent: true });
  const parsed = JSON.parse(domainOutput) as { domain?: string; url?: string } | { domain?: string; url?: string }[];
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  const domain = entry?.domain || entry?.url || "";
  if (domain) {
    pbUrl = domain.startsWith("http") ? domain : `https://${domain}`;
  }
} catch { /* will prompt */ }

if (!pbUrl) {
  warn("Could not auto-detect the PocketBase domain.");
  warn("Find it in Railway dashboard → your PocketBase service → Settings → Domains.");
  pbUrl = await prompt("Enter the PocketBase public URL", "https://your-pb.up.railway.app");
}

// Normalise: strip trailing slash
pbUrl = pbUrl.replace(/\/$/, "");
ok(`PocketBase URL: ${pbUrl}`);

// ── Step 6: Confirm PocketBase is reachable ───────────────────────────────────

step("Checking PocketBase health");
try {
  const res = await fetch(`${pbUrl}/api/health`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  ok("PocketBase is reachable");
} catch (e) {
  warn(`PocketBase not reachable at ${pbUrl}: ${e instanceof Error ? e.message : e}`);
  warn("Make sure the PocketBase service is deployed and has a public domain.");
  const proceed = await prompt("Continue anyway? (yes/no)", "no");
  if (!proceed.startsWith("y")) { rl.close(); process.exit(1); }
}

// ── Step 7: Superuser credentials ────────────────────────────────────────────

step("Create PocketBase superuser");
log("These credentials will become the admin account for PocketBase.");

const email = await prompt("Superuser email", "admin@mike.app");
let password = "";
while (password.length < 10) {
  password = await promptSecret("Superuser password (min 10 chars)");
  if (password.length < 10) warn("Password must be at least 10 characters.");
}

// ── Step 8: Create the superuser via PocketBase API ──────────────────────────

step("Creating superuser");

async function tryCreateSuperuser(baseUrl: string, em: string, pw: string): Promise<boolean> {
  // PocketBase 0.22+ uses _superusers collection
  const endpoints = [
    `${baseUrl}/api/collections/_superusers/records`,
    `${baseUrl}/api/admins`, // pre-0.22 fallback
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, password: pw, passwordConfirm: pw }),
      });

      if (res.ok) return true;

      const body = await res.json().catch(() => ({})) as { message?: string; code?: number };

      // 400 with "Failed to create record" or "already exists" means a superuser exists
      if (res.status === 400 || res.status === 403) {
        const msg = body.message ?? "";
        if (msg.toLowerCase().includes("exist") || msg.toLowerCase().includes("already")) {
          warn("A superuser already exists with that email. Verifying credentials...");
          return await verifySuperuser(baseUrl, em, pw);
        }
        warn(`${endpoint}: ${msg}`);
        continue; // try next endpoint
      }
    } catch (e) {
      // network error on this endpoint — try next
      if (endpoint.includes("_superusers")) continue;
      throw e;
    }
  }
  return false;
}

async function verifySuperuser(baseUrl: string, em: string, pw: string): Promise<boolean> {
  const endpoints = [
    `${baseUrl}/api/collections/_superusers/auth-with-password`,
    `${baseUrl}/api/admins/auth-with-password`,
  ];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity: em, password: pw }),
      });
      if (res.ok) return true;
    } catch { continue; }
  }
  return false;
}

const created = await tryCreateSuperuser(pbUrl, email, password);
if (!created) {
  fail("Could not create or verify the superuser.");
  fail("You can do it manually: visit " + pbUrl + "/_/ in your browser.");
  rl.close(); process.exit(1);
}
ok("Superuser ready");

// ── Step 9: Pick app service and set env vars ─────────────────────────────────

step("Setting environment variables on your app service");

const appServices = services.filter((s) => s.name !== pbServiceName);
let appServiceName = "";

if (appServices.length === 0) {
  warn("No other services found. Set these env vars manually in Railway:");
  log(`  POCKETBASE_URL=${pbUrl}`);
  log(`  POCKETBASE_ADMIN_EMAIL=${email}`);
  log(`  POCKETBASE_ADMIN_PASSWORD=<your password>`);
} else {
  if (appServices.length === 1) {
    appServiceName = appServices[0].name;
    ok(`App service: ${appServiceName}`);
  } else {
    log("Which service is the Node/Express app?");
    appServices.forEach((s, i) => log(`  [${i + 1}] ${s.name}`));
    const idx = parseInt(await prompt("Enter number", "1"), 10) - 1;
    appServiceName = appServices[Math.max(0, Math.min(idx, appServices.length - 1))].name;
  }

  const vars = [
    `POCKETBASE_URL=${pbUrl}`,
    `POCKETBASE_ADMIN_EMAIL=${email}`,
    `POCKETBASE_ADMIN_PASSWORD=${password}`,
  ];

  log(`Setting on '${appServiceName}'...`);
  for (const kv of vars) {
    const [key] = kv.split("=");
    try {
      railway(`variable set "${kv}" -s "${appServiceName}" --skip-deploys`, { silent: true });
      ok(`  ${key} set`);
    } catch (e) {
      warn(`  Could not set ${key}: ${e instanceof Error ? e.message : e}`);
    }
  }
}

// ── Done ──────────────────────────────────────────────────────────────────────

rl.close();

log(`\n\x1b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`);
log(`\x1b[32m✅  Setup complete!\x1b[0m`);
log(`\x1b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n`);
log(`PocketBase admin UI:  ${pbUrl}/_/`);
log(`Superuser email:      ${email}`);
log(`\nNext step: create PocketBase collections`);
log(`  POCKETBASE_URL=${pbUrl} POCKETBASE_ADMIN_EMAIL=${email} POCKETBASE_ADMIN_PASSWORD=<pw> npm run pb:setup\n`);
