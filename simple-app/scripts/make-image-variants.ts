/**
 * Produces narrow variants of the homepage screenshots.
 *
 * The captures are 2880 wide so they stay sharp on a retina desktop. On a
 * phone the hero renders at about 343 CSS pixels, so the browser downloads
 * 168 kB to paint something 686 device pixels across: Lighthouse measured
 * 159 kB of that as waste, on the Largest Contentful Paint element.
 *
 * Each source gets a half-width companion, and the components reference both
 * through srcset so the browser picks. Chrome does the resampling and the WebP
 * encoding through a canvas, so there is still no image library to install.
 *
 *   npx tsx scripts/make-image-variants.ts
 */

import fs from "fs";
import path from "path";
import { launchChrome, sleep } from "./lib/cdp";

const DIR = path.join(process.cwd(), "client", "public", "images");
const SOURCES = ["hero-portfolio", "monthly-report", "review-clause-analysis"];
/** CSS-pixel width the variant targets, at 2x. */
const TARGET_WIDTH = 1440;

async function main() {
  const session = await launchChrome(9455, 800, 600);
  try {
    for (const name of SOURCES) {
      const src = path.join(DIR, `${name}.webp`);
      if (!fs.existsSync(src)) {
        console.log(`  ${name}: source missing, skipped`);
        continue;
      }
      const dataUrl = `data:image/webp;base64,${fs.readFileSync(src).toString("base64")}`;

      const result = await session.cdp.send<{ result: { value: string } }>("Runtime.evaluate", {
        expression: `(async () => {
          const img = new Image();
          img.src = ${JSON.stringify(dataUrl)};
          await img.decode();
          const w = ${TARGET_WIDTH};
          const h = Math.round(img.naturalHeight * (w / img.naturalWidth));
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          return c.toDataURL('image/webp', 0.86);
        })()`,
        awaitPromise: true,
        returnByValue: true,
      });

      const out = result.result?.value ?? "";
      if (!out.startsWith("data:image/webp")) {
        console.log(`  ${name}: encode failed`);
        continue;
      }
      const buf = Buffer.from(out.split(",")[1], "base64");
      const dest = path.join(DIR, `${name}-${TARGET_WIDTH}.webp`);
      fs.writeFileSync(dest, buf);
      const before = Math.round(fs.statSync(src).size / 1024);
      const after = Math.round(buf.byteLength / 1024);
      console.log(`  ${name}-${TARGET_WIDTH}.webp  ${after} kB  (full size ${before} kB)`);
      await sleep(200);
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
