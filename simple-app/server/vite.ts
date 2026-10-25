import express, { type Express } from "express";
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
   * The canonical and Open Graph URLs are resolved here, at boot, rather than
   * baked in by the build.
   *
   * They have to be absolute, and the right value belongs to the deployment
   * rather than to the source. Injecting it at build time meant a change to
   * APP_URL only took effect on a full rebuild: setting the variable restarts
   * the service, which re-runs this file against an artefact still carrying
   * the old origin. That cost two deploys to spot and is the wrong coupling
   * for a value that can change without the code changing.
   *
   * Vite leaves __SITE_URL__ in the built HTML for exactly this. The dev
   * server still substitutes it through the plugin in vite.config.ts, so both
   * paths produce absolute URLs.
   *
   * Read once: index.html is small and does not change between restarts.
   */
  const indexPath = path.resolve(distPath, "index.html");
  const origin = (process.env.SITE_URL ?? process.env.APP_URL ?? "https://www.zanelegal.ai")
    .replace(/\/+$/, "");
  let indexHtml = "";
  try {
    indexHtml = fs.readFileSync(indexPath, "utf8").replaceAll("__SITE_URL__", origin);
    if (!process.env.APP_URL && !process.env.SITE_URL) {
      console.warn(
        `[static] Neither APP_URL nor SITE_URL is set. Canonical and Open Graph URLs fall back to ${origin}.`,
      );
    }
  } catch (err) {
    console.error("[static] Could not read index.html:", (err as Error)?.message);
  }

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    if (indexHtml) {
      res.type("html").send(indexHtml);
      return;
    }
    res.sendFile(indexPath);
  });
}
