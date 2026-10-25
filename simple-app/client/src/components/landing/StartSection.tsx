/**
 * Start.
 *
 * Three mini-steps, titles only, set as a numbered row under the body. They
 * are deliberately lighter than the mechanism cards in HowItWorksSection:
 * this is the shape of a first week, not a second explanation of the product.
 */

import { motion } from "framer-motion";
import { START } from "../../content/homepage";
import { Section } from "./Section";
import { staggerContainer, staggerItem } from "./motion";

export function StartSection() {
  return (
    <Section copy={START} tone="light" divided>
      <motion.ol
        className="mt-12 grid sm:grid-cols-3 gap-px rounded-xl border border-line-light overflow-hidden bg-line-light"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
      >
        {START.steps.map((s) => (
          <motion.li key={s.step} className="bg-paper px-6 py-7" variants={staggerItem}>
            <span className="text-xs font-semibold tracking-[0.18em] text-slate-500">{s.step}</span>
            <p className="mt-3 text-base font-semibold text-ink">{s.title}</p>
            {s.body && <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.body}</p>}
          </motion.li>
        ))}
      </motion.ol>
    </Section>
  );
}
