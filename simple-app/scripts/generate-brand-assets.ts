/**
 * Generates the static brand assets the public site needs.
 *
 *   favicon.svg              the routing symbol, navy ground, cobalt strokes
 *   favicon-32.png           browsers that ignore SVG favicons
 *   apple-touch-icon.png     180 square, no transparency, iOS adds the radius
 *   icon-192.png, icon-512.png   for the web app manifest
 *   og-image.png             1200 by 630 share card
 *
 * The symbol is the one in client/src/components/ZaneLogo.tsx: three paths
 * enter from the left, two cross and swap position, the third holds. Kept in
 * sync by hand, so if that file changes, change SYMBOL_PATHS too.
 *
 * The share card uses the hero headline from content/homepage.ts verbatim.
 * It is not read from that file at build time on purpose: this script writes a
 * static PNG that is committed, and silently regenerating it from changing
 * copy would mean the committed image and the page could drift apart without
 * anyone noticing. Re-run this script when the headline changes.
 *
 *   npx tsx scripts/generate-brand-assets.ts
 */

import path from "path";
import { launchChrome, renderHtmlToPng } from "./lib/cdp";

const OUT = path.join(process.cwd(), "client", "public");

const NAVY = "#080E1C";
const COBALT = "#2563EB";
const PAPER = "#F8FAFC";

/** From ZaneLogo.tsx, viewBox 0 0 56 38. */
const SYMBOL_PATHS = [
  "M2 6 L18 6 C26 6 30 19 38 19 C44 19 48 32 54 32",
  "M2 19 L18 19 C26 19 30 6 38 6 L54 6",
  "M2 32 L18 32 L54 32",
];

function symbolSvg(stroke: string, strokeWidth = 2.5): string {
  return `<svg viewBox="0 0 56 38" fill="none" xmlns="http://www.w3.org/2000/svg">
    ${SYMBOL_PATHS.map(
      (d) =>
        `<path d="${d}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none"/>`,
    ).join("\n    ")}
  </svg>`;
}

/** Square icon: the symbol centred on navy with comfortable padding. */
function iconHtml(size: number, rounded: boolean): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${size}px;height:${size}px;background:transparent}
    .plate{width:${size}px;height:${size}px;background:${NAVY};
      ${rounded ? `border-radius:${Math.round(size * 0.22)}px;` : ""}
      display:flex;align-items:center;justify-content:center}
    svg{width:${Math.round(size * 0.62)}px;height:auto}
  </style></head><body>
    <div class="plate">${symbolSvg(COBALT, size <= 64 ? 3.5 : 2.5)}</div>
  </body></html>`;
}

/**
 * Share card. The headline is the page's own h1, set in Source Serif 4 to
 * match the site. The font is loaded from the public folder by absolute file
 * URL so the card renders with the real typeface rather than a fallback.
 */
function ogHtml(fontUrl: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:'Source Serif 4';src:url('${fontUrl}') format('woff2');font-weight:200 900;font-display:block}
    html,body{margin:0;padding:0;width:1200px;height:630px}
    body{background:${NAVY};color:${PAPER};
      font-family:'Source Serif 4',Georgia,serif;
      display:flex;flex-direction:column;justify-content:space-between;
      padding:72px 80px;box-sizing:border-box}
    .mark{display:flex;align-items:center;gap:16px}
    .mark svg{width:56px;height:38px}
    .word{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
      font-weight:700;letter-spacing:.34em;font-size:20px;color:${PAPER}}
    h1{font-size:68px;line-height:1.1;letter-spacing:-.02em;margin:0;max-width:16ch;font-weight:500}
    .rule{height:3px;width:96px;background:${COBALT};border-radius:2px;margin-bottom:28px}
    .foot{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
      font-size:19px;color:#94A3B8;letter-spacing:.01em}
  </style></head><body>
    <div class="mark">${symbolSvg(COBALT)}<span class="word">ZANE</span></div>
    <div>
      <div class="rule"></div>
      <h1>Know what your company has signed, who approved it, and why.</h1>
    </div>
    <div class="foot">For CFOs, and the lean legal teams who work with them</div>
  </body></html>`;
}

async function main() {
  const fontUrl = `file://${path.join(OUT, "fonts", "SourceSerif4-Variable.woff2")}`;
  const session = await launchChrome(9444, 1200, 630);
  try {
    const jobs: Array<[string, string, number, number, number]> = [
      // file, html, width, height, deviceScaleFactor
      ["favicon-32.png", iconHtml(32, false), 32, 32, 1],
      ["apple-touch-icon.png", iconHtml(180, false), 180, 180, 1],
      ["icon-192.png", iconHtml(192, true), 192, 192, 1],
      ["icon-512.png", iconHtml(512, true), 512, 512, 1],
      ["og-image.png", ogHtml(fontUrl), 1200, 630, 1],
    ];
    for (const [file, html, w, h, scale] of jobs) {
      const bytes = await renderHtmlToPng(session.cdp, html, path.join(OUT, file), w, h, scale);
      console.log(`  ${file.padEnd(24)} ${w}x${h}  ${Math.round(bytes / 1024)} kB`);
    }
  } finally {
    session.stop();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", (err as Error)?.message ?? err);
    process.exit(1);
  });
