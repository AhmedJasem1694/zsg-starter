/**
 * For finance.
 *
 * The five items are a list, not a sequence, so they are unnumbered and sit in
 * a single column beside the visual rather than in a card grid. A CFO scanning
 * the bold labels alone gets the whole section.
 *
 * The visual is a placeholder. See ScreenshotPlaceholder for the capture list.
 */

import { motion } from "framer-motion";
import { FOR_FINANCE } from "../../content/homepage";
import { Section } from "./Section";
import { ScreenshotPlaceholder } from "./ScreenshotPlaceholder";
import { rise, staggerContainer, staggerItem } from "./motion";

export function ForFinanceSection() {
  return (
    <Section copy={FOR_FINANCE} tone="light" divided>
      <div className="mt-14 grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
        <motion.dl
          className="space-y-7"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          {FOR_FINANCE.items.map((item) => (
            <motion.div key={item.title} variants={staggerItem}>
              <dt className="text-base font-semibold text-ink">{item.title}</dt>
              <dd className="mt-1.5 text-sm text-slate-600 leading-relaxed">{item.body}</dd>
            </motion.div>
          ))}
        </motion.dl>

        <motion.div className="lg:sticky lg:top-28" {...rise(0.16)}>
          <ScreenshotPlaceholder target="Portfolio view or board pack export, 1440 by 900, exported as WebP." />
        </motion.div>
      </div>
    </Section>
  );
}
