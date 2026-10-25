/**
 * Security.
 *
 * Four statements, set as a plain list rather than cards, because a security
 * section that looks like a feature grid reads as marketing. No badges, no
 * shields, no certification marks: the page has none to show.
 *
 * What is NOT here, and why, is documented on SECURITY in content/homepage.ts.
 * Read that before adding a line.
 */

import { motion } from "framer-motion";
import { SECURITY } from "../../content/homepage";
import { Section } from "./Section";
import { rise, staggerContainer, staggerItem } from "./motion";

export function SecuritySection() {
  return (
    <Section copy={SECURITY} tone="dark">
      <motion.ul
        className="mt-10 max-w-2xl space-y-4"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
      >
        {SECURITY.items.map((item) => (
          <motion.li
            key={item}
            className="pl-5 border-l border-line-dark text-base text-slate-400 leading-relaxed"
            variants={staggerItem}
          >
            {item}
          </motion.li>
        ))}
      </motion.ul>

      <motion.p className="mt-10 text-sm text-slate-500" {...rise(0.08)}>
        <a
          href={`mailto:${SECURITY.contactEmail}`}
          className="text-slate-400 hover:text-white transition-colors underline underline-offset-4 decoration-slate-600 hover:decoration-slate-300"
        >
          {SECURITY.note}
        </a>
      </motion.p>
    </Section>
  );
}
