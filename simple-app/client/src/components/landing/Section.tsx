/**
 * Shared section shell for the public page.
 *
 * Every section on the homepage is one of these, carrying its own stable
 * anchor id from the copy constants. The shell owns only the things every
 * section shares: the id, the background tone, the vertical rhythm, the
 * measure, and the entrance order (eyebrow and headline first, body next,
 * anything passed as children last).
 *
 * Sections 3 and 5 to 11 currently carry headings only. Where a section's
 * body is unwritten the shell renders a quiet "copy pending" marker rather
 * than collapsing to nothing, because the nav links into several of these
 * ids and an anchor that jumps to an empty box reads as a broken page.
 * The marker is the signal that copy is outstanding; it is not final design.
 */

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import type { Section as SectionCopy } from "../../content/homepage";
import { rise } from "./motion";

/** light sits on paper, dark on deep navy. Alternation is set by the page. */
export type Tone = "light" | "dark";

const TONE = {
  light: {
    section: "bg-paper",
    divider: "border-t border-line-light",
    // slate-500 on paper is 4.55:1, the lowest AA-passing step available here.
    eyebrow: "text-slate-500",
    headline: "text-ink",
    body: "text-slate-600",
    closing: "text-ink",
    pending: "text-slate-500",
  },
  dark: {
    section: "bg-navy-900",
    divider: "",
    // slate-500 on navy is only 4.05:1. slate-400 is 7.51:1.
    eyebrow: "text-slate-400",
    headline: "text-[#F8FAFC]",
    body: "text-slate-400",
    closing: "text-[#F8FAFC]",
    pending: "text-slate-400",
  },
} as const;

export function Section({
  copy,
  tone = "light",
  divided = false,
  children,
}: {
  copy: SectionCopy;
  tone?: Tone;
  /** Hairline rule at the top, for light sections that follow light sections. */
  divided?: boolean;
  children?: ReactNode;
}) {
  const t = TONE[tone];
  const hasCopy = Boolean(copy.headline || copy.body.length);

  return (
    <section
      id={copy.id}
      className={`${t.section} ${divided ? t.divider : ""} py-24 sm:py-36`}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div className="max-w-2xl space-y-6" {...rise(0)}>
          {copy.eyebrow && (
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${t.eyebrow}`}>
              {copy.eyebrow}
            </p>
          )}
          {copy.headline && (
            <h2 className={`t-display text-3xl sm:text-4xl tracking-tight ${t.headline}`}>
              {copy.headline}
            </h2>
          )}
        </motion.div>

        {copy.body.length > 0 && (
          <motion.div
            className={`mt-8 max-w-2xl space-y-5 text-base leading-relaxed ${t.body}`}
            {...rise(0.08)}
          >
            {copy.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </motion.div>
        )}

        {!hasCopy && (
          <p className={`text-xs ${t.pending}`}>Copy pending for this section.</p>
        )}

        {children}

        {copy.closingLine && (
          <motion.p
            className={`mt-20 max-w-3xl text-xl sm:text-2xl font-medium leading-snug ${t.closing}`}
            {...rise(0.08)}
          >
            {copy.closingLine}
          </motion.p>
        )}
      </div>
    </section>
  );
}
