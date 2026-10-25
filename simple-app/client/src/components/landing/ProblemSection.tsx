/**
 * The problem.
 *
 * Three scenes rather than three arguments. Each card opens with the scene's
 * name in bold and follows with what happened, so a reader skimming only the
 * bold lines still gets the section.
 *
 * Nothing here describes Zane. The section's one product sentence is the
 * closing line, rendered by the Section shell.
 */

import { motion } from "framer-motion";
import { PROBLEM } from "../../content/homepage";
import { Section } from "./Section";
import { staggerContainer, staggerItem } from "./motion";

export function ProblemSection() {
  return (
    <Section copy={PROBLEM} tone="light">
      <motion.div
        className="mt-14 grid sm:grid-cols-3 gap-5"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
      >
        {PROBLEM.cards.map((c) => (
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
