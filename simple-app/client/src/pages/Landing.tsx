/**
 * The public homepage.
 *
 * This file is an assembler and nothing else. It holds no copy: every string
 * comes from ../content/homepage, and every claim that copy makes maps to an
 * entry in ../content/claims. It holds no layout beyond the order of sections
 * and the tone each one sits on.
 *
 * The page is written finance first. A CFO reading top to bottom should learn
 * what the company has committed to, who approved it and why, before the page
 * says anything about how a legal team uses it.
 *
 * Twelve parts: nav, hero, then the eight sections of SECTION_ORDER after the
 * hero, then the ask, then the footer. Nav and hero have structure of their
 * own so they are their own components. The rest share the Section shell and
 * graduate to their own files as later work gives them distinct layouts.
 *
 * Previously here and deliberately gone:
 *   - the cycling hero headline, which rotated through four words. The
 *     proposition is now one sentence, stated once.
 *   - the drifting cobalt wash behind the hero.
 *   - the pricing and FAQ sections, and their copy. Both carried figures that
 *     nothing in the codebase can support: a twenty minute setup, a sub five
 *     minute review, outside counsel rates. See NOT_YET_CLAIMS. They are not
 *     being quietly reinstated; if they return they return with evidence.
 */

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { LandingNav } from "../components/landing/LandingNav";
import { Hero } from "../components/landing/Hero";
import { Section, type Tone } from "../components/landing/Section";
import { LandingFooter } from "../components/landing/LandingFooter";
import { RequestAccessModal } from "../components/landing/RequestAccessModal";
import { rise } from "../components/landing/motion";
import { CTA, SECTION_ORDER, SECTIONS } from "../content/homepage";

/**
 * Background per section. Alternating paper and deep navy gives the page its
 * rhythm; `divided` adds a hairline where a light section follows a light one
 * and the join would otherwise be invisible.
 */
const TONES: Record<string, { tone: Tone; divided?: boolean }> = {
  "problem":      { tone: "light" },
  "how-it-works": { tone: "light", divided: true },
  "for-finance":  { tone: "light", divided: true },
  "for-legal":    { tone: "light", divided: true },
  "why-now":      { tone: "dark" },
  "start":        { tone: "light" },
  "security":     { tone: "dark" },
  "about":        { tone: "light" },
  "cta":          { tone: "dark" },
};

export default function Landing() {
  const shouldReduce = useReducedMotion();
  const [showRequestAccess, setShowRequestAccess] = useState(false);
  const lenisRef = useRef<import("@studio-freight/lenis").default | null>(null);

  // Lenis smooth scroll.
  //
  // The frame loop must be cancelled on unmount. destroy() alone leaves the
  // recursive requestAnimationFrame running, so every visit to this page used
  // to leak another permanent loop driving a destroyed instance. Enough of
  // them and the main thread has nothing left for the entrance animations,
  // which then stall part way through.
  //
  // Smooth scroll is itself non-essential motion, so it is skipped entirely
  // when the reader has asked for reduced motion.
  useEffect(() => {
    if (shouldReduce) return;
    let lenis: import("@studio-freight/lenis").default | null = null;
    let frame = 0;
    let cancelled = false;
    void import("@studio-freight/lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      lenis = new Lenis({ duration: 1.1, smoothWheel: true });
      lenisRef.current = lenis;
      const raf = (time: number) => {
        lenis?.raf(time);
        frame = requestAnimationFrame(raf);
      };
      frame = requestAnimationFrame(raf);
    });
    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      lenis?.destroy();
      lenisRef.current = null;
    };
  }, [shouldReduce]);

  /**
   * In-page anchor scrolling, owned here so the nav and hero hold no scroll
   * state. The offset clears the sticky header.
   */
  const scrollToSection = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("#")) return;
    e.preventDefault();
    const target = document.querySelector<HTMLElement>(href);
    if (!target) return;
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, { offset: -57 });
    } else {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Everything after the hero, in declared order. The hero is rendered on its
  // own because its structure is not the Section shell.
  const bodySections = SECTION_ORDER.filter((id) => id !== "hero");

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <LandingNav onAnchorClick={scrollToSection} />

      <Hero onAnchorClick={scrollToSection} />

      {bodySections.map((id) => {
        const copy = SECTIONS[id];
        const { tone, divided } = TONES[id] ?? { tone: "light" };

        // The ask carries the page's one conversion point, so it gets the
        // button as a child of the shell.
        if (id === "cta") {
          return (
            <Section key={id} copy={copy} tone={tone} divided={divided}>
              <motion.div className="mt-8" {...rise(0.16)}>
                <button
                  onClick={() => setShowRequestAccess(true)}
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-cobalt hover:bg-cobalt-hover text-white font-semibold rounded-lg text-sm transition-[background-color,box-shadow,transform] duration-150 ease-out hover:shadow-lg hover:shadow-cobalt/25 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0"
                >
                  {CTA.ctaLabel} <ArrowRight size={15} />
                </button>
                {CTA.contactLine && (
                  <p className="mt-4 text-xs text-slate-500">{CTA.contactLine}</p>
                )}
              </motion.div>
            </Section>
          );
        }

        return <Section key={id} copy={copy} tone={tone} divided={divided} />;
      })}

      <LandingFooter />

      {showRequestAccess && <RequestAccessModal onClose={() => setShowRequestAccess(false)} />}
    </div>
  );
}
