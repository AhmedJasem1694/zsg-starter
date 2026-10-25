/**
 * Captures the product screenshots the marketing site needs.
 *
 * The public page has three visual slots, all of them placeholders because no
 * raster image existed anywhere in the repository. This fills them from the
 * seeded demo account rather than from a mockup, which is the whole point: the
 * site claims these are the real screens.
 *
 * HOW IT AUTHENTICATES, AND WHY IT IS NOT TYPING A PASSWORD
 *
 * The screens are behind requireAuth. Rather than drive a login form, this
 * mints a session token for the demo user with the same secret the local
 * server is using, and sets it as the cookie the server reads. No password is
 * entered anywhere, and nothing is stored. The token lives for the length of
 * the run.
 *
 * It only ever talks to the local dev server. Point it at anything else and it
 * refuses.
 *
 * HOW IT ENCODES WEBP
 *
 * Chrome's DevTools Protocol encodes WebP directly, so there is no image
 * library to install. macOS sips cannot write WebP on 12.x, and adding sharp
 * for three files was not worth it. The only dependency is `ws`, already in
 * the tree.
 *
 * USAGE
 *
 *   npm run dev                              (in another terminal)
 *   npx tsx scripts/capture-screenshots.ts
 *
 * Quality steps down automatically until each file is under the size budget.
 */

import "../server/env";
import fs from "fs";
import path from "path";
import os from "os";
import { spawn, type ChildProcess } from "child_process";
import jwt from "jsonwebtoken";
import WebSocket from "ws";
import { resolveJwtSecret } from "../server/lib/jwtSecret";

const BASE = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "client", "public", "images");
const WIDTH = 1440;
const HEIGHT = 900;
const MAX_BYTES = 200 * 1024;
/** Tried in order until one fits the budget. */
const QUALITY_STEPS = [92, 85, 78, 70, 60, 50];

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DEBUG_PORT = 9222;

/** Demo account and the screens to capture. Ids come from the seeded demo. */
const DEMO_EMAIL = "demo@zanelegal.ai";
const DEMO_USER_ID = "r29c8k8l5s6kz5k";

const SHOTS = [
  {
    file: "hero-portfolio.webp",
    url: "/app/legal/portfolio",
    /** Selector that proves the page has rendered its data, not just its shell. */
    waitFor: "text:Where is your risk concentrated?",
  },
  {
    file: "finance-portfolio.webp",
    url: "/app/legal/portfolio",
    waitFor: "text:Where is your risk concentrated?",
  },
  {
    file: "legal-review.webp",
    // Halcyon Systems, Platform Subscription. Has a RED clause.
    url: "/app/legal/review/pc3sg4iezd31l0r",
    waitFor: "text:Escalation required",
    /**
     * The seeded demo contracts have no physical file on disk, so the split
     * view's document pane renders "No document text is available for this
     * contract", which is not something to put on a marketing page. Collapsing
     * the pane gives the clause analysis the full width instead.
     */
    click: "Hide document",
  },
];

// ── Minimal DevTools Protocol client ──────────────────────────────────────────

class CDP {
  private ws: WebSocket;
  private id = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  private constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.on("message", (raw: Buffer) => {
      const msg = JSON.parse(raw.toString()) as { id?: number; error?: { message: string }; result?: unknown };
      if (msg.id === undefined) return; // event, ignored
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg.result);
    });
  }

  static async connect(wsUrl: string): Promise<CDP> {
    const ws = new WebSocket(wsUrl, { maxPayload: 256 * 1024 * 1024 });
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });
    return new CDP(ws);
  }

  send<T = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = ++this.id;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function httpJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Returns the websocket for a PAGE target, not the browser target.
 *
 * /json/version hands back the browser-level endpoint, which does not
 * implement the Page or Emulation domains: connecting there fails with
 * "'Page.enable' wasn't found". The page targets are in /json/list.
 */
async function waitForPageTarget(): Promise<string> {
  for (let i = 0; i < 60; i++) {
    try {
      const targets = await httpJson<Array<{ type: string; webSocketDebuggerUrl?: string }>>(
        `http://127.0.0.1:${DEBUG_PORT}/json/list`,
      );
      const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome not up yet.
    }
    await sleep(250);
  }
  throw new Error("Chrome started but exposed no page target");
}

/** Poll the page until the marker text appears, so data has actually painted. */
async function waitForText(cdp: CDP, needle: string, timeoutMs = 25_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await cdp.send<{ result: { value: boolean } }>("Runtime.evaluate", {
      expression: `document.body && document.body.innerText.includes(${JSON.stringify(needle)})`,
      returnByValue: true,
    });
    if (r.result?.value) return true;
    await sleep(400);
  }
  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const host = new URL(BASE).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error(`Refusing to run against ${BASE}. This script is for the local dev server only.`);
  }

  const health = await fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false);
  if (!health) throw new Error(`No dev server at ${BASE}. Start it with: npm run dev`);

  // Same secret the running server resolved, so the cookie it mints is accepted.
  const token = jwt.sign({ userId: DEMO_USER_ID, email: DEMO_EMAIL }, resolveJwtSecret(), { expiresIn: "1h" });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "zane-shot-"));

  let chrome: ChildProcess | null = null;
  let cdp: CDP | null = null;
  try {
    chrome = spawn(CHROME, [
      "--headless=new",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profile}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      "--hide-scrollbars",
      "--force-device-scale-factor=2",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ], { stdio: "ignore" });

    cdp = await CDP.connect(await waitForPageTarget());
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");

    await cdp.send("Network.setCookie", {
      name: "token",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
    });

    // 2x device pixels gives a crisp image; the capture is then downscaled by
    // the browser when displayed at 1440 wide.
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 2,
      mobile: false,
    });

    for (const shot of SHOTS) {
      const url = `${BASE}${shot.url}`;
      process.stdout.write(`${shot.file.padEnd(24)} `);
      await cdp.send("Page.navigate", { url });
      await sleep(1200);

      const marker = shot.waitFor.replace(/^text:/, "");
      const painted = await waitForText(cdp, marker);

      const click = (shot as { click?: string }).click;
      if (click) {
        const clicked = await cdp.send<{ result: { value: boolean } }>("Runtime.evaluate", {
          expression: `(() => {
            const el = Array.from(document.querySelectorAll('button,[role=button]'))
              .find(b => (b.textContent || '').trim() === ${JSON.stringify(click)});
            if (!el) return false;
            el.click();
            return true;
          })()`,
          returnByValue: true,
        });
        if (!clicked.result?.value) console.log(`\n    note: could not find a control labelled "${click}"`);
        await sleep(700);
      }
      await sleep(1500); // let entrance animations and any scroll settle

      // Print a sample of what rendered. A capture of a login redirect or an
      // empty state looks identical in the file listing; this makes it obvious.
      const sample = await cdp.send<{ result: { value: string } }>("Runtime.evaluate", {
        expression: "(document.body.innerText||'').replace(/\\s+/g,' ').trim().slice(0,110)",
        returnByValue: true,
      });

      let written = false;
      for (const quality of QUALITY_STEPS) {
        const r = await cdp.send<{ data: string }>("Page.captureScreenshot", {
          format: "webp",
          quality,
          captureBeyondViewport: false,
        });
        const buf = Buffer.from(r.data, "base64");
        if (buf.byteLength <= MAX_BYTES || quality === QUALITY_STEPS[QUALITY_STEPS.length - 1]) {
          fs.writeFileSync(path.join(OUT_DIR, shot.file), buf);
          const kb = Math.round(buf.byteLength / 1024);
          console.log(`${kb} kB q${quality} ${painted ? "OK" : "MARKER MISSING"}\n    page: ${sample.result?.value ?? "(no text)"}`);
          written = true;
          break;
        }
      }
      if (!written) console.log("failed to write");
    }
  } finally {
    cdp?.close();
    chrome?.kill();
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch { /* Chrome may still be releasing the profile */ }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", (err as Error)?.message ?? err);
    process.exit(1);
  });
