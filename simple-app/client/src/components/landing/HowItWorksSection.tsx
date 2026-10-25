/**
 * How it works.
 *
 * Four steps, a real sequence, so they are numbered and read left to right on
 * desktop. Two up on tablet and stacked on mobile, because four columns below
 * about 1000px leaves each one too narrow to read.
 *
 * Icons come from lucide-react, already a dependency and used throughout the
 * app, so this adds no new asset and no new network request. They are drawn in
 * slate, not cobalt: the accent belongs to the one thing the page is asking
 * for, not to decoration.
 */

import { motion } from "framer-motion";
import { CircleCheck, History, Inbox, Split, type LucideIcon } from "lucide-react";
import { HOW_IT_WORKS } from "../../content/homepage";
import { Section } from "./Section";
import { rise, staggerContainer, staggerItem } from "./motion";

/** One per step, in order. Kept beside the steps rather than in the copy file,
 *  which holds strings only. */
const ICONS: LucideIcon[] = [Inbox, Split, CircleCheck, History];

export function HowItWorksSection() {
  return (
    <Section copy={HOW_IT_WORKS} tone="light" divided>
      <motion.div
        className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
      >
        {HOW_IT_WORKS.steps.map((s, i) => {
          const Icon = ICONS[i];
          return (
            <motion.div
              key={s.step}
              className="rounded-xl border border-line-light bg-white px-6 py-7 transition-[border-color,box-shadow] duration-200 ease-out hover:border-slate-300 hover:shadow-lg"
              variants={staggerItem}
            >
              <div className="flex items-center justify-between">
                {Icon && <Icon size={18} className="text-slate-500" aria-hidden="true" />}
                <span className="text-xs font-semibold tracking-[0.18em] text-slate-500">
                  {s.step}
                </span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.body}</p>
            </motion.div>
          );
        })}
      </motion.div>

      <motion.p className="mt-10 text-sm text-slate-500 leading-relaxed" {...rise(0.08)}>
        {HOW_IT_WORKS.note}
      </motion.p>
    </Section>
  );
}
