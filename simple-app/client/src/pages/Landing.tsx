import { Link } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ZaneLogo } from "../components/ZaneLogo";
import { requestAccess } from "../lib/api";

// ─── Animation presets ────────────────────────────────────────────────────────
const SPRING_SNAP  = { type: "spring", damping: 100, mass: 3, stiffness: 500 } as const;
const SPRING_SOFT  = { type: "spring", damping: 27,  mass: 0.3, stiffness: 121 } as const;
const EASE_OUT_EXPO = { type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.9 } as const;

const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 32 },
  whileInView:{ opacity: 1, y: 0 },
  viewport:   { once: true, amount: 0.3 },
  transition: { ...SPRING_SNAP, delay },
});

const fadeUpHero = (delay = 0) => ({
  initial:   { opacity: 0, y: 24 },
  animate:   { opacity: 1, y: 0 },
  transition:{ ...SPRING_SOFT, delay },
});

const headingReveal = {
  initial:    { opacity: 0, y: 40 },
  whileInView:{ opacity: 1, y: 0 },
  viewport:   { once: true, amount: 0.5 },
  transition: EASE_OUT_EXPO,
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: SPRING_SNAP },
};

// Slow, sequential reveal for the product-preview rows: elegant, one after another.
const rowsReveal = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.18, delayChildren: 0.2 } },
};
const rowReveal = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

// ─── Type scale ───────────────────────────────────────────────────────────────
// hero:     text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]
// section:  text-3xl sm:text-4xl font-bold tracking-tight
// card:     text-base font-semibold
// body:     text-base leading-relaxed, muted colour
// caption:  text-xs font-semibold uppercase tracking-[0.18em], muted colour

// ─── FAQ copy ─────────────────────────────────────────────────────────────────
const LANDING_FAQS = [
  { q: "How do I get started?", a: "A pilot begins with a short onboarding conversation to set up your playbook positions and approval thresholds. From there you can be set up and reviewing your first contract within about twenty minutes. No implementation project. No technical setup. No long sales process." },
  { q: "Do I need a technical team to set this up?", a: "No. There is no technical setup and no implementation project. Your positions are configured during a short onboarding conversation, and all you need to use Zane day to day is a browser or your email." },
  { q: "Are my contracts used to train AI models?", a: "Never. Your contracts are anonymised before any AI model sees them and are never used for model training of any kind. Your data stays yours." },
  { q: "How is Zane different from Claude for Legal or Harvey?", a: "Claude for Legal is a generic assistant that starts from zero every session. Harvey is built for Magic Circle law firms at six figures a year. Neither of them knows your company. Zane is built specifically for lean in-house teams and gets smarter about your company with every contract reviewed." },
  { q: "Can I use Zane from my email?", a: "Yes. You can CC or forward any contract to your dedicated Zane address and it will review it against your playbook and reply in the thread, with everything filed in your library." },
  { q: "Does Zane cover regulatory requirements?", a: "Zane surfaces relevant regulatory references where they matter for your sector, for example healthcare or financial services, and keeps them out of the way for straightforward commercial work." },
  { q: "What happens to my data if I cancel?", a: "Your data is yours. You can export everything before you cancel. We do not hold your data hostage." },
  { q: "Does Zane replace my lawyer?", a: "No. Zane handles the objective layer so your lawyer can focus on the judgment calls that actually require a lawyer. Every recommendation Zane makes requires a human decision before anything happens." },
  { q: "What contract types does Zane support?", a: "Commercial contracts, supplier agreements, customer MSAs, NDAs, technology agreements, employment contracts, and more. Zane works for any contract type you configure it for, and remembers your decisions across all of them." },
  { q: "Is there a minimum contract or commitment?", a: "No implementation fee. No setup cost. Pilot terms are agreed up front in conversation before you commit." },
];

// ─── Cycling phrases: the hero's rolling text ──────────────────────────────────
const PHRASES = ["remembers.", "learns.", "compounds.", "inherits."];

function CyclingPhrase() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    const tick = setInterval(() => {
      setPhase("out");
      setTimeout(() => {
        setIndex((i) => (i + 1) % PHRASES.length);
        setPhase("in");
      }, 150);
    }, 1800);
    return () => clearInterval(tick);
  }, []);

  return (
    // Fixed min-width = width of the longest cycling phrase at the headline
    // weight. inline-block + centered text keeps the cycling word from
    // reflowing or shifting the line as it changes.
    <span style={{ display: "inline-block", minWidth: "10.5em", textAlign: "center" }}>
      <span key={index} className={phase === "in" ? "phrase-in" : "phrase-out"}>
        {PHRASES[index]}
      </span>
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Landing() {
  const shouldReduce = useReducedMotion();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  // Manual onboarding: "Request access" form modal
  const [showRequestAccess, setShowRequestAccess] = useState(false);
  const lenisRef = useRef<import("@studio-freight/lenis").default | null>(null);

  // Lenis smooth scroll
  useEffect(() => {
    let lenis: import("@studio-freight/lenis").default | null = null;
    import("@studio-freight/lenis").then(({ default: Lenis }) => {
      lenis = new Lenis({ duration: 1.1, smoothWheel: true });
      lenisRef.current = lenis;
      function raf(time: number) {
        lenis!.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    });
    return () => { lenis?.destroy(); lenisRef.current = null; };
  }, []);

  // Smooth-scroll for in-page anchor links; offset clears the sticky header
  const scrollToSection = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const target = document.querySelector<HTMLElement>(href);
    if (!target) return;
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, { offset: -57 });
    } else {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-paper">

      {/* ─── NAV ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-line-dark/60 backdrop-blur-md" style={{ background: "rgba(6,10,20,0.92)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <ZaneLogo size="sm" light={true} />
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-xs">
            {["#why-zane:Why Zane","#how-it-works:How it works","#pricing:Pricing"].map(s => {
              const [href, label] = s.split(":");
              return (
                <a key={href} href={href} onClick={(e) => scrollToSection(e, href)}
                  className="text-slate-400 hover:text-white transition-colors duration-300">
                  {label}
                </a>
              );
            })}
            <Link to="/case-study" className="text-slate-400 hover:text-white transition-colors duration-300">Case study</Link>
            <Link to="/resources" className="text-slate-400 hover:text-white transition-colors duration-300">Resources</Link>
            <Link to="/security" className="text-slate-400 hover:text-white transition-colors duration-300">Security</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-4 py-1.5 text-sm text-slate-400 hover:text-white transition-colors duration-300">Sign in</Link>
            <button onClick={() => setShowRequestAccess(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-cobalt hover:bg-cobalt-hover text-white text-sm font-medium rounded-lg transition-colors">
              Request access <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* ─── HERO: near-black, one idea ─────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy-950">
        {/* Single hero accent: soft cobalt wash that drifts very slowly, the page's one glow */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 45% at 50% -10%, rgba(37,99,235,0.14), transparent 65%)" }}
          {...(shouldReduce ? {} : {
            animate: { opacity: [0.8, 1, 0.8], scale: [1, 1.05, 1], x: ["-1.5%", "1.5%", "-1.5%"] },
            transition: { duration: 22, ease: "easeInOut", repeat: Infinity },
          })}
        />

        <div className="relative max-w-3xl mx-auto px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
          {/* Headline: carries the rolling text */}
          <motion.h1
            className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.08] text-[#F8FAFC]"
            {...(shouldReduce ? {} : fadeUpHero(0.1))}
          >
            Legal intelligence that{" "}<CyclingPhrase />
          </motion.h1>

          {/* Subline */}
          <motion.p
            className="mt-8 text-lg sm:text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto"
            {...(shouldReduce ? {} : fadeUpHero(0.25))}
          >
            Most legal AI forgets the moment you close the document. Zane remembers what your company decided, and gets smarter with every contract.
          </motion.p>

          {/* Supporting line */}
          <motion.p
            className="mt-5 text-base text-slate-400 leading-relaxed max-w-xl mx-auto"
            {...(shouldReduce ? {} : fadeUpHero(0.35))}
          >
            Your positions, your history, your counterparties, captured and working for you.
          </motion.p>

          {/* Primary CTA: the hero's one cobalt accent */}
          <motion.div
            className="mt-12 flex flex-col items-center gap-3"
            {...(shouldReduce ? {} : fadeUpHero(0.5))}
          >
            <button onClick={() => setShowRequestAccess(true)}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-cobalt hover:bg-cobalt-hover text-white font-semibold rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-cobalt/25 motion-safe:hover:-translate-y-0.5 text-sm">
              Request access <ArrowRight size={15} />
            </button>
            <p className="text-xs text-slate-500">No implementation. No enterprise contract. Working in 20 minutes.</p>
          </motion.div>

          {/* Quiet stats row, part of the hero group, directly under the supporting line */}
          <motion.div
            className="mt-10 flex flex-wrap items-start justify-center gap-x-10 sm:gap-x-16 gap-y-5 text-center"
            {...(shouldReduce ? {} : fadeUpHero(0.6))}
          >
            {[
              { value: "11 minutes",     label: "Average review time" },
              { value: "100%",           label: "Company-specific from day one" },
              { value: "1 to 5 lawyers", label: "The team size we are built for" },
            ].map(({ value, label }) => (
              <div key={label} className="space-y-0.5">
                <div className="text-base sm:text-lg font-semibold text-[#F8FAFC]">{value}</div>
                <div className="text-[11px] text-slate-500 leading-snug">{label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── PRODUCT PREVIEW: Next actions, lifted out of the hero ───────────── */}
      <section className="bg-navy-900 border-t border-line-dark py-24 sm:py-32">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div className="text-center space-y-3" {...headingReveal}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">The product</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#F8FAFC]">
              See what needs your attention.
            </h2>
          </motion.div>

          {/* Clean framed product visual */}
          <motion.div
            className="mt-12 mx-auto max-w-xl text-left rounded-xl border border-line-dark bg-navy-800 shadow-2xl overflow-hidden"
            {...(shouldReduce ? {} : fadeUp(0.1))}
          >
            <div className="px-4 py-2.5 border-b border-line-dark text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Next actions
            </div>
            <motion.div
              className="divide-y divide-line-dark/60"
              {...(shouldReduce ? {} : { variants: rowsReveal, initial: "hidden", whileInView: "show", viewport: { once: true, amount: 0.4 } })}
            >
              {[
                { name: "Technology Services Agreement", cp: "Acme Technologies Ltd",  dot: "bg-red-400/80",   label: "Do not sign yet" },
                { name: "Master Services Agreement",     cp: "Nexus Solutions Ltd",    dot: "bg-amber-400/80", label: "Negotiate first" },
                { name: "Software Licence Agreement",    cp: "DataFlow Technologies",  dot: "bg-red-400/80",   label: "Review required" },
              ].map((item) => (
                <motion.div key={item.name} className="px-4 py-3 flex items-center gap-3" {...(shouldReduce ? {} : { variants: rowReveal })}>
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[#F8FAFC] truncate">{item.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">{item.cp}</div>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">{item.label}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── PROBLEM ─────────────────────────────────────────────────────────── */}
      <section id="why-zane" className="bg-paper py-24 sm:py-36">
        <div className="max-w-2xl mx-auto px-6">
          <motion.div className="space-y-6" {...headingReveal}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">The problem</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">
              Most legal teams get this wrong every day.
            </h2>
          </motion.div>
          <motion.div className="mt-8 space-y-5 text-base text-slate-600 leading-relaxed" {...fadeUp(0.1)}>
            <p className="text-justify">
              Every contract a company signs carries decisions that are never recorded. The same positions get renegotiated from scratch because no one captured how they were resolved last time. Paper often reaches the business before it reaches a lawyer, so deals get signed that should not be, or the legal team is buried in work that never needed them. And when a lawyer leaves, their judgment leaves too. Whoever inherits the relationship spends hours reconstructing what was already known.
            </p>
            <p className="text-ink font-medium">
              Most contracts are signed exactly as they arrive. Not because the terms are fair, but because there is no infrastructure to do anything else.
            </p>
          </motion.div>

          {/* The cost of the status quo: quiet stat row */}
          <motion.div
            className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-px rounded-xl border border-line-light overflow-hidden bg-line-light"
            variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}
          >
            {[
              { value: "2 to 4 hours",     label: "Manual review time per contract" },
              { value: "£800 to £1,600",   label: "The same review at outside counsel rates" },
              { value: "11 minutes",    label: "Average review time with Zane" },
            ].map(({ value, label }) => (
              <motion.div key={label} className="bg-paper px-6 py-7" variants={staggerItem}>
                <div className="text-2xl font-bold tracking-tight text-ink">{value}</div>
                <div className="mt-1.5 text-xs text-slate-500 leading-relaxed">{label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── HOW ZANE WORKS: 3 steps ────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-paper border-t border-line-light py-24 sm:py-36">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div className="max-w-2xl space-y-6" {...headingReveal}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">How Zane works</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">
              From counterparty paper to a decision that compounds.
            </h2>
          </motion.div>

          <motion.div
            className="mt-14 grid sm:grid-cols-3 gap-5"
            variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.25 }}
          >
            {[
              {
                step: "01",
                title: "Give Zane a contract",
                body: "PDF or DOCX. Zane reads it and identifies every clause that matters.",
              },
              {
                step: "02",
                title: "See it against everything you know",
                body: "Each clause is checked against your company's own positions and your history with this counterparty, not generic market standard. You get a Red, Amber, or Green verdict, the risk in plain English, and the exact wording to send back.",
              },
              {
                step: "03",
                title: "Decide once. Zane remembers",
                body: "You make the call and Zane records it, with the reasoning behind it. Every decision sharpens the next review, and stays with the company when people move on.",
              },
            ].map(({ step, title, body }) => (
              <motion.div key={step} className="rounded-xl border border-line-light bg-white px-6 py-7 transition-shadow duration-300 hover:shadow-xl" variants={staggerItem} whileHover={shouldReduce ? undefined : { y: -4, transition: { duration: 0.3, ease: "easeOut" } }}>
                <div className="text-xs font-semibold tracking-[0.18em] text-slate-400">{step}</div>
                <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── EMAIL AGENT: works where you already work ──────────────────────── */}
      <section id="email-agent" className="bg-paper border-t border-line-light py-24 sm:py-36">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div className="space-y-6" {...headingReveal}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Email native</p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">
                Zane works where you already work.
              </h2>
              <p className="text-base text-slate-600 leading-relaxed">
                You do not have to log in to use Zane. Copy it on an email and it reviews the attached
                contract against your positions, replies in the thread, and files everything in your
                library. Every review adds to what Zane knows about your counterparties. First drafts
                of NDAs and routine agreements on request.
              </p>
            </motion.div>

            {/* Simple email-thread visual */}
            <motion.div {...fadeUp(0.1)}>
              <div className="rounded-xl border border-line-light bg-white shadow-sm overflow-hidden">
                <div className="border-b border-line-light px-5 py-3 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                  <span className="ml-2 text-xs text-slate-400 truncate">Re: Acme MSA, for review</span>
                </div>
                <div className="divide-y divide-line-light">
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink">You</span>
                      <span className="text-xs text-slate-400">9:02</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                      Cc’ing zane@. Can you take a look at the attached MSA before I reply?
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-line-light px-2 py-1 text-xs text-slate-500">
                      📎 Acme_MSA_v2.pdf
                    </div>
                  </div>
                  <div className="px-5 py-4 bg-paper">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink">Zane</span>
                      <span className="text-xs text-slate-400">9:04</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                      Reviewed against your positions: <span className="font-semibold text-ink">2 amber, 1 red</span>.
                      Liability cap is below your 24-month floor; indemnity is one-sided. Suggested
                      fallback language is in the full review. Filed to your library.
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600">
                      View full review →
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── THE MEMORY STORY: dark ─────────────────────────────────────────── */}
      <section className="bg-navy-900 py-24 sm:py-36">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div className="max-w-2xl space-y-6" {...headingReveal}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">The intelligence that compounds</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#F8FAFC]">
              Most legal AI starts from zero every time. Zane never forgets.
            </h2>
            <p className="text-base text-slate-400 leading-relaxed">
              It reviews every contract against everything your company has already decided, remembers the reasoning behind your toughest calls, and even catches when a schedule points to the wrong clause in the master agreement. The review itself is becoming a commodity. The memory is what cannot be copied.
            </p>
          </motion.div>

          <motion.div
            className="mt-14 grid sm:grid-cols-3 gap-5"
            variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.25 }}
          >
            {[
              { count: "01", title: "Inheritance",            body: "When someone leaves, the knowledge stays. A new joiner inherits the playbook, the decision history, and the counterparty patterns, instead of starting from zero." },
              { count: "02", title: "Per vendor intelligence", body: "Zane aligns what it learns to each counterparty. The next contract from a known vendor surfaces how they negotiate, what they push on, and what you accepted before and why." },
              { count: "03", title: "Portfolio risk",          body: "Across your whole contract estate, Zane shows your exposure, your open escalations, and your upcoming renewals. The view a head of legal needs for the board." },
            ].map(({ count, title, body }) => (
              <motion.div key={count} className="rounded-xl border border-line-dark bg-navy-800 px-6 py-7 transition-shadow duration-300 hover:shadow-lg" variants={staggerItem} whileHover={shouldReduce ? undefined : { y: -4, transition: { duration: 0.3, ease: "easeOut" } }}>
                <div className="text-2xl font-bold tracking-tight text-[#F8FAFC]">{count}</div>
                <h3 className="mt-4 text-base font-semibold text-[#F8FAFC]">{title}</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── WHO IT IS FOR ───────────────────────────────────────────────────── */}
      <section className="bg-paper py-24 sm:py-36">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div className="max-w-2xl space-y-6" {...headingReveal}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Who it is for</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">
              Whether you have a legal team or you are doing it yourself.
            </h2>
          </motion.div>

          <motion.div
            className="mt-14 grid sm:grid-cols-3 gap-5"
            variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.25 }}
          >
            {[
              {
                title: "In-house team of 1 to 5 lawyers",
                body: "The team size Zane is built for. One shared playbook, approval thresholds enforced automatically, every review remembered and applied, and nothing lost when someone leaves.",
              },
              {
                title: "Founder with contracts and no lawyer",
                body: "A supplier sends you an MSA. You are not a lawyer, and outside counsel is not cheap. Upload it and know what to do in minutes.",
              },
              {
                title: "Business team, before legal",
                body: "Sales and procurement often touch contracts before legal does. Zane gives them guardrails, so routine paper keeps moving and only the real risks reach a lawyer. It is bowling with the bumpers up.",
              },
            ].map(({ title, body }) => (
              <motion.div key={title} className="rounded-xl border border-line-light bg-white px-6 py-7 transition-shadow duration-300 hover:shadow-xl" variants={staggerItem} whileHover={shouldReduce ? undefined : { y: -4, transition: { duration: 0.3, ease: "easeOut" } }}>
                <h3 className="text-base font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── LEGACY CONTRACT REVIEW ──────────────────────────────────────────── */}
      <section className="bg-paper border-t border-line-light py-24 sm:py-36">
        <div className="max-w-2xl mx-auto px-6">
          <motion.div className="rounded-xl border border-line-light bg-white px-8 py-10 text-center space-y-5 transition-shadow duration-300 hover:shadow-xl" {...headingReveal} whileHover={shouldReduce ? undefined : { y: -4, transition: { duration: 0.3, ease: "easeOut" } }}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Legacy contract review</p>
            <h2 className="text-2xl font-bold tracking-tight text-ink">Have hundreds of historical contracts nobody has reviewed?</h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-lg mx-auto">
              Most companies have hundreds of signed contracts no one has read since. Zane maps the whole estate, the terms, the renewal dates, the risks, so you know what you are sitting on. Days, not months.
            </p>
            <div className="pt-1">
              <a href="https://calendly.com/ahmedljasem/30min"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-cobalt hover:bg-cobalt-hover text-white font-semibold rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-cobalt/25 motion-safe:hover:-translate-y-0.5 text-sm">
                Book a conversation <ArrowRight size={15} />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── PRICING: conversation-led ──────────────────────────────────────── */}
      <section id="pricing" className="bg-navy-900 py-24 sm:py-36">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <motion.div className="space-y-6" {...headingReveal}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#F8FAFC]">Pricing built around your team</h2>
            <p className="text-base text-slate-400 leading-relaxed max-w-xl mx-auto">
              Zane is priced for lean legal functions, not enterprise budgets. Every pilot starts with a conversation so we can configure Zane around your contracts, your sector, and your risk positions. Pricing is agreed before you commit to anything.
            </p>
            <div className="pt-2">
              <a href="https://calendly.com/ahmedljasem/30min"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-cobalt hover:bg-cobalt-hover text-white font-semibold rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-cobalt/25 motion-safe:hover:-translate-y-0.5 text-sm">
                Book a conversation <ArrowRight size={15} />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────────────────────────── */}
      <section className="bg-paper py-24 sm:py-36">
        <div className="max-w-2xl mx-auto px-6">
          <motion.div className="space-y-6" {...headingReveal}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Questions</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">Frequently asked questions</h2>
          </motion.div>
          <div className="mt-12 border-t border-line-light">
            {LANDING_FAQS.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} className="border-b border-line-light">
                  <button
                    className="w-full flex items-center justify-between py-5 text-left gap-4"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                  >
                    <span className="text-base font-semibold text-ink">{faq.q}</span>
                    <span className={`shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`}>
                      <X size={14} className="rotate-45" />
                    </span>
                  </button>
                  <div
                    className="overflow-hidden transition-all duration-300 ease-in-out"
                    style={{ maxHeight: isOpen ? "300px" : "0px", opacity: isOpen ? 1 : 0 }}
                  >
                    <p className="pb-6 text-sm text-slate-600 leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── REQUEST ACCESS: final ──────────────────────────────────────────── */}
      <section className="bg-navy-950 py-24 sm:py-36">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <motion.div className="space-y-6" {...headingReveal}>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#F8FAFC]">
              The first contract you review will show you exactly what it can do.
            </h2>
            <p className="text-base text-slate-400 leading-relaxed max-w-lg mx-auto">
              Most tools ask you to trust them before showing you anything. Zane asks for 20 minutes and a contract.
            </p>
            <div className="pt-2">
              <button onClick={() => setShowRequestAccess(true)}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-cobalt hover:bg-cobalt-hover text-white font-semibold rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-cobalt/25 motion-safe:hover:-translate-y-0.5 text-sm">
                Request access <ArrowRight size={15} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Or email{" "}
              <a href="mailto:ahmed@zanelegal.ai" className="text-slate-400 hover:text-white transition-colors underline underline-offset-2">
                ahmed@zanelegal.ai
              </a>
              {" "}with any questions first.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="bg-paper border-t border-line-light mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <ZaneLogo size="sm" light={false} />
          </Link>
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <Link to="/case-study" className="hover:text-slate-700 transition-colors">Case study</Link>
            <Link to="/security" className="hover:text-slate-700 transition-colors">Security</Link>
            <Link to="/resources" className="hover:text-slate-700 transition-colors">Resources</Link>
            <span>2026</span>
          </div>
        </div>
      </footer>

      {/* ─── REQUEST ACCESS MODAL (manual onboarding) ────────────────────────── */}
      {showRequestAccess && <RequestAccessModal onClose={() => setShowRequestAccess(false)} />}
    </div>
  );
}

// ─── Request access modal ─────────────────────────────────────────────────────

function RequestAccessModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", company: "", role: "", contractsDescription: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const canSubmit =
    form.name.trim().length > 0 &&
    form.email.trim().includes("@") &&
    form.company.trim().length > 0 &&
    form.role.trim().length > 0;

  function set(field: keyof typeof form) {
    return (e: { target: { value: string } }) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await requestAccess({
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        role: form.role.trim(),
        contractsDescription: form.contractsDescription.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong - please try again or email ahmed@zanelegal.ai.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-line-dark bg-white/5 px-3.5 py-2.5 text-sm text-[#F8FAFC] placeholder:text-slate-600 focus:outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/15 transition-colors";
  const labelCls = "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-xl border border-line-dark bg-navy-800 p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-lg">
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors">
          <X size={16} />
        </button>

        {submitted ? (
          <div className="py-10 text-center space-y-4">
            <h3 className="text-lg font-bold text-[#F8FAFC] tracking-tight leading-snug">
              Thanks. Ahmed will personally onboard you within 24 hours.
            </h3>
            <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2">
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-1.5 pr-6">
              <h3 className="text-lg font-bold text-[#F8FAFC] tracking-tight">Request access</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Zane onboarding is currently done personally. Tell us a little about you and Ahmed will set you up within 24 hours.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className={labelCls}>Name</label>
                <input type="text" className={inputCls} placeholder="Jane Smith" value={form.name} onChange={set("name")} autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Work email</label>
                <input type="email" className={inputCls} placeholder="jane@company.com" value={form.email} onChange={set("email")} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Company</label>
                <input type="text" className={inputCls} placeholder="Acme Ltd" value={form.company} onChange={set("company")} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Role</label>
                <input type="text" className={inputCls} placeholder="e.g. GC, Head of Legal, Founder" value={form.role} onChange={set("role")} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>What kind of contracts do you deal with?</label>
                <textarea className={`${inputCls} min-h-[80px] resize-y`} placeholder="e.g. Supplier MSAs, customer agreements, NDAs…" value={form.contractsDescription} onChange={set("contractsDescription")} />
              </div>

              {error && (
                <div className="text-xs text-red-300 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-cobalt hover:bg-cobalt-hover text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Sending…" : "Request access →"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
