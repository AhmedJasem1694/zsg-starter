import express, { type Express } from "express";
import { canonicalOrigin } from "./lib/canonicalOrigin.js";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // index:false matters. express.static otherwise answers "/" with index.html
  // straight off disk, before the handler below that substitutes __SITE_URL__,
  // so the homepage would ship the raw token while every other path resolved.
  app.use(express.static(distPath, { index: false }));

  /**
   * Canonical and Open Graph URLs are resolved per request.
   *
   * They were resolved once at boot from APP_URL. That coupled the preferred
   * public host to a variable whose real job is building email links, and it
   * meant the value could only change on a restart. Both are now handled by
   * canonicalOrigin, which maps every host this site answers on to the one it
   * should be indexed under.
   *
   * The substitution is a string replace on a 4 kB file. Results are cached by
   * origin, so in practice it runs once per host.
   */
  const indexPath = path.resolve(distPath, "index.html");
  let template = "";
  try {
    template = fs.readFileSync(indexPath, "utf8");
  } catch (err) {
    console.error("[static] Could not read index.html:", (err as Error)?.message);
  }
  const byOrigin = new Map<string, string>();

  // fall through to index.html if the file doesn't exist
  app.use("*", (req, res) => {
    if (!template) {
      res.sendFile(indexPath);
      return;
    }
    const origin = canonicalOrigin(req);
    let html = byOrigin.get(origin);
    if (!html) {
      html = template.replaceAll("__SITE_URL__", origin);
      byOrigin.set(origin, html);
    }
    res.type("html").send(html);
  });
}
