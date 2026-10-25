/**
 * For legal.
 *
 * Four items in a 2 by 2 card grid, the same treatment as the mechanism steps
 * but unnumbered, because these are four things the team gets rather than four
 * stages of anything. The visual leads on desktop so the section reads as the
 * mirror of the finance one above it rather than a repeat of its layout.
 *
 * The visual is a real capture from the seeded demo account. Re-run
 * scripts/capture-screenshots.ts rather than editing it by hand.
 */

import { motion } from "framer-motion";
import { FOR_LEGAL } from "../../content/homepage";
import { Section } from "./Section";
import { rise, staggerContainer, staggerItem } from "./motion";

export function ForLegalSection() {
  return (
    <Section copy={FOR_LEGAL} tone="light" divided>
      <motion.div className="mt-14" {...rise(0.08)}>
        <img
          src="/images/review-clause-analysis.webp"
          alt={FOR_LEGAL.visualAlt}
          width={1440}
          height={900}
          loading="lazy"
          decoding="async"
          className="block w-full h-auto rounded-xl border border-line-light shadow-sm"
        />
      </motion.div>

      <motion.div
        className="mt-10 grid sm:grid-cols-2 gap-5"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
      >
        {FOR_LEGAL.cards.map((c) => (
          <motion.div
            key={c.title}
            className="rounded-xl border border-line-light bg-white px-6 py-7 transition-[border-color,box-shadow] duration-200 ease-out hover:border-slate-300 hover:shadow-lg"
            variants={staggerItem}
          >
            <h3 className="text-base font-semibold text-ink">{c.title}</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{c.body}</p>
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
}
