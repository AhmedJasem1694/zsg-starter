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

import { useEffect, useRef, type ComponentType, type MouseEvent } from "react";
import { useReducedMotion } from "framer-motion";
import { LandingNav } from "../components/landing/LandingNav";
import { Hero } from "../components/landing/Hero";
import { Section, type Tone } from "../components/landing/Section";
import { ProblemSection } from "../components/landing/ProblemSection";
import { HowItWorksSection } from "../components/landing/HowItWorksSection";
import { ForFinanceSection } from "../components/landing/ForFinanceSection";
import { ForLegalSection } from "../components/landing/ForLegalSection";
import { StartSection } from "../components/landing/StartSection";
import { SecuritySection } from "../components/landing/SecuritySection";
import { CtaSection } from "../components/landing/CtaSection";
import { LandingFooter } from "../components/landing/LandingFooter";
import { SECTION_ORDER, SECTIONS } from "../content/homepage";

/**
 * Background per section. Alternating paper and deep navy gives the page its
 * rhythm; `divided` adds a hairline where a light section follows a light one
 * and the join would otherwise be invisible.
 */
const TONES: Record<string, { tone: Tone; divided?: boolean }> = {
  "why-now":      { tone: "dark" },
  "about":        { tone: "light", divided: true },
  "cta":          { tone: "dark" },
};

/**
 * Sections whose layout has outgrown the shared shell and moved to their own
 * file. Each one owns its tone and divider, so it has no TONES entry. The rest
 * still render through Section until a layout of their own arrives.
 */
const GRADUATED: Record<string, ComponentType> = {
  "problem": ProblemSection,
  "how-it-works": HowItWorksSection,
  "for-finance": ForFinanceSection,
  "for-legal": ForLegalSection,
  "start": StartSection,
  "security": SecuritySection,
  "cta": CtaSection,
};

export default function Landing() {
  const shouldReduce = useReducedMotion();
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
        const Graduated = GRADUATED[id];
        if (Graduated) return <Graduated key={id} />;

        const copy = SECTIONS[id];
        const { tone, divided } = TONES[id] ?? { tone: "light" };

        return <Section key={id} copy={copy} tone={tone} divided={divided} />;
      })}

      <LandingFooter onAnchorClick={scrollToSection} />
    </div>
  );
}
