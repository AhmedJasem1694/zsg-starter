import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Replaces %SITE_URL% in index.html with the public origin.
 *
 * Canonical, og:url and og:image must be absolute, and the value belongs to
 * the deployment rather than the source, so it comes from APP_URL (the same
 * variable the server uses to build links in email). SITE_URL overrides it if
 * the public marketing origin ever differs from the app's.
 *
 * The fallback is the live origin rather than localhost: a share card pointing
 * at localhost is worse than one pointing at production from a dev build.
 *
 * The token is __SITE_URL__ rather than Vite's %VAR% style on purpose. Vite
 * runs decodeURI over href and src attributes while parsing index.html, and a
 * bare % that is not valid percent-encoding throws "URI malformed" before any
 * plugin runs.
 */
function siteUrlPlugin(): Plugin {
  const raw = process.env.SITE_URL ?? process.env.APP_URL ?? "https://www.zanelegal.ai";
  const origin = raw.replace(/\/+$/, "");
  return {
    name: "zane-site-url",
    transformIndexHtml(html) {
      return html.replaceAll("__SITE_URL__", origin);
    },
  };
}

export default defineConfig({
  plugins: [react(), siteUrlPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
