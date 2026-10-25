/**
 * Stand-in for a product screenshot that does not exist yet.
 *
 * There are no raster images anywhere in the repository. Every visual slot on
 * the public page is one of these until someone captures the screen, and each
 * one names its own capture target on screen so the gap is impossible to miss
 * in review and impossible to ship by accident.
 *
 * OUTSTANDING CAPTURES. All from the seeded demo account, viewport 1440 by 900,
 * no browser chrome, exported WebP under 200 kB into client/public/images/.
 *
 *   hero-portfolio.webp    /app/legal/portfolio
 *   finance-portfolio.webp /app/legal/portfolio, or the board pack export
 *   legal-review.webp      /app/legal/review/:id, a contract with a red clause
 *
 * Replacing one: drop the file in, swap this component for an <img> carrying
 * the section's visualAlt and explicit width and height, so the slot reserves
 * its own space and nothing shifts as it loads.
 *
 * Note for whoever captures the finance one: the Portfolio page does NOT show
 * total value under management. It renders red-flag exposure only. The board
 * pack is the screen that prints a total. Caption accordingly, and see
 * ALLOWED_CLAIMS.portfolio-total-value.
 */

export function ScreenshotPlaceholder({
  /** The screen to capture, shown on the placeholder itself. */
  target,
  /** Aspect ratio of the eventual capture, so the slot is already the right shape. */
  ratio = "1440 / 900",
  /** On navy. The caller supplies the frame, so this draws no chrome of its own. */
  dark = false,
}: {
  target: string;
  ratio?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={dark ? "" : "rounded-xl border border-line-light bg-white shadow-sm overflow-hidden"}
      style={{ aspectRatio: ratio }}
    >
      <div className="h-full w-full flex flex-col items-center justify-center gap-2 px-6 text-center">
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
            dark ? "text-slate-600" : "text-slate-400"
          }`}
        >
          Screenshot pending
        </span>
        <span className="text-xs text-slate-500 max-w-xs leading-relaxed">{target}</span>
      </div>
    </div>
  );
}
