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
    /**
     * Dev only. In a production build the token is left in place and the
     * server substitutes it at boot (see serveStatic in server/vite.ts), so a
     * change to APP_URL takes effect on restart instead of requiring a full
     * rebuild.
     */
    apply: "serve",
    transformIndexHtml(html: string) {
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

    /**
     * Vite gzips every emitted chunk just to print a size column. With one
     * chunk that is free; after the route split there are dozens, and the
     * Railway build ran out of heap doing it. The numbers are nice to have
     * locally and not worth a failed deploy.
     */
    reportCompressedSize: false,

    rollupOptions: {
      output: {
        /**
         * Group third-party code into a handful of named chunks.
         *
         * Without this, tree-shaking lucide-react emitted one chunk per icon:
         * 36 of the 81 chunks were under 1 kB. That costs build memory, and at
         * runtime it is dozens of requests to fetch a few hundred bytes each.
         *
         * Route-level splitting (the lazy() imports in App.tsx) is untouched,
         * so the homepage still does not download the authenticated app.
         */
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          // Dynamically imported and skipped under reduced motion. Keep it
          // separate or it would be pulled into an eagerly loaded chunk.
          if (id.includes("lenis")) return "lenis";
          if (id.includes("react-router")) return "router";
          if (id.includes("@tanstack")) return "query";
          if (id.includes("framer-motion") || id.includes("@motionone") || id.includes("popmotion")) {
            return "motion";
          }
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) {
            return "react";
          }
          return "vendor";
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
