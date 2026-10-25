/**
 * A very small Chrome DevTools Protocol client.
 *
 * Shared by the screenshot capture and the brand asset generator. It exists so
 * neither has to pull in Playwright or Puppeteer: the system Chrome plus `ws`,
 * already in the tree, does everything either script needs, and Chrome encodes
 * both PNG and WebP itself.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { spawn, type ChildProcess } from "child_process";
import WebSocket from "ws";

export const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class CDP {
  private ws: WebSocket;
  private id = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  private constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.on("message", (raw: Buffer) => {
      const msg = JSON.parse(raw.toString()) as {
        id?: number;
        error?: { message: string };
        result?: unknown;
      };
      if (msg.id === undefined) return;
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

export interface Session {
  cdp: CDP;
  stop: () => void;
}

/**
 * Starts headless Chrome and attaches to a PAGE target.
 *
 * /json/version returns the browser-level endpoint, which does not implement
 * the Page or Emulation domains: connecting there fails with "'Page.enable'
 * wasn't found". The page targets live in /json/list.
 */
export async function launchChrome(port: number, width: number, height: number): Promise<Session> {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "zane-cdp-"));
  const chrome: ChildProcess = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      "--hide-scrollbars",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let wsUrl = "";
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = (await res.json()) as Array<{ type: string; webSocketDebuggerUrl?: string }>;
      wsUrl = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl ?? "";
    } catch {
      // not up yet
    }
    if (!wsUrl) await sleep(250);
  }
  if (!wsUrl) {
    chrome.kill();
    throw new Error("Chrome started but exposed no page target");
  }

  const cdp = await CDP.connect(wsUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  return {
    cdp,
    stop: () => {
      cdp.close();
      chrome.kill();
      try {
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
      } catch {
        // Chrome may still be releasing the profile directory.
      }
    },
  };
}

/** Render a standalone HTML document and write it out as a PNG. */
export async function renderHtmlToPng(
  cdp: CDP,
  html: string,
  outFile: string,
  width: number,
  height: number,
  scale = 1,
): Promise<number> {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: scale,
    mobile: false,
  });
  await cdp.send("Page.navigate", {
    url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
  });
  await sleep(600);
  const r = await cdp.send<{ data: string }>("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  const buf = Buffer.from(r.data, "base64");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, buf);
  return buf.byteLength;
}
