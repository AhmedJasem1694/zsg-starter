/**
 * Hero.
 *
 * One sentence, stated once. The rotating headline that used to sit here is
 * gone: a CFO reads the proposition a single time and movement in the middle
 * of it costs more than it earns.
 *
 * Layout is two columns on desktop, copy then visual. On mobile it is one
 * column with the visual below the copy, so the proposition is read before
 * anything is looked at.
 *
 * TODO (hero visual): no product screenshot exists in the repository. The
 * placeholder below must be replaced before this page goes near a customer.
 * Capture /app/legal/portfolio signed in as the seeded demo account. See
 * ScreenshotPlaceholder for the full capture list and the export settings.
 *
 * An earlier version of this note said that screen shows "4,200,000 under
 * management". It does not: Portfolio.tsx renders red-flag exposure only and
 * never reads totalValue. The board pack is the screen that prints a total.
 */

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { MouseEvent } from "react";
import { HERO } from "../../content/homepage";
import { ScreenshotPlaceholder } from "./ScreenshotPlaceholder";
import { riseOnMount } from "./motion";

export function Hero({
  onAnchorClick,
}: {
  onAnchorClick: (e: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  const shouldReduce = useReducedMotion();
  const enter = (delay: number) => (shouldReduce ? {} : riseOnMount(delay));

  return (
    <section id={HERO.id} className="relative overflow-hidden bg-navy-950">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-12 lg:gap-16 items-center">

          {/* Copy */}
          <div className="flex flex-col gap-6">
            <motion.p
              className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
              {...enter(0)}
            >
              {HERO.eyebrow}
            </motion.p>

            <motion.h1
              className="t-display text-3xl sm:text-5xl tracking-tight leading-[1.1] text-[#F8FAFC]"
              {...enter(0.08)}
            >
              {HERO.headline}
            </motion.h1>

            <motion.p
              className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl"
              {...enter(0.16)}
            >
              {HERO.subheadline}
            </motion.p>

            <motion.div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-1" {...enter(0.24)}>
              <a
                href={HERO.primaryCta.href}
                onClick={(e) => onAnchorClick(e, HERO.primaryCta.href)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-cobalt hover:bg-cobalt-hover text-white font-semibold rounded-lg text-sm transition-[background-color,box-shadow,transform] duration-150 ease-out hover:shadow-lg hover:shadow-cobalt/25 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0"
              >
                {HERO.primaryCta.label} <ArrowRight size={15} />
              </a>
              <a
                href={HERO.secondaryCta.href}
                onClick={(e) => onAnchorClick(e, HERO.secondaryCta.href)}
                className="text-sm font-medium text-slate-300 hover:text-white transition-colors underline underline-offset-4 decoration-slate-600 hover:decoration-slate-300"
              >
                {HERO.secondaryCta.label}
              </a>
            </motion.div>

            <motion.p className="text-xs text-slate-500 leading-relaxed max-w-md" {...enter(0.32)}>
              {HERO.footnote}
            </motion.p>
          </div>

          {/* Visual. Placeholder until the capture exists. */}
          <motion.div {...enter(0.4)}>
            <div className="rounded-xl border border-line-dark bg-navy-900 shadow-2xl overflow-hidden">
              <ScreenshotPlaceholder target="Portfolio view, 1440 by 900, exported as WebP." dark />
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
