import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle, AlertTriangle, Zap, BookOpen, Scale, TrendingUp, X } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ZaneLogo } from "../components/ZaneLogo";

// ─── Animation presets (matching aloft's spring physics) ─────────────────────
const SPRING_SNAP  = { type: "spring", damping: 100, mass: 3, stiffness: 500 } as const;
const SPRING_SOFT  = { type: "spring", damping: 27,  mass: 0.3, stiffness: 121 } as const;
const EASE_OUT_EXPO = { type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.9 } as const;

const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 40 },
  whileInView:{ opacity: 1, y: 0 },
  viewport:   { once: true, amount: 0.4 },
  transition: { ...SPRING_SNAP, delay },
});

const fadeUpHero = (delay = 0) => ({
  initial:   { opacity: 0, y: 32 },
  animate:   { opacity: 1, y: 0 },
  transition:{ ...SPRING_SOFT, delay },
});

const slideLeft = (delay = 0) => ({
  initial:    { opacity: 0, x: -80 },
  whileInView:{ opacity: 1, x: 0 },
  viewport:   { once: true, amount: 0.3 },
  transition: { ...SPRING_SNAP, delay },
});

const slideRight = (delay = 0) => ({
  initial:    { opacity: 0, x: 80 },
  whileInView:{ opacity: 1, x: 0 },
  viewport:   { once: true, amount: 0.3 },
  transition: { ...SPRING_SNAP, delay },
});

const headingReveal = {
  initial:    { opacity: 0, y: 60 },
  whileInView:{ opacity: 1, y: 0 },
  viewport:   { once: true, amount: 0.5 },
  transition: EASE_OUT_EXPO,
};

// ─── Stagger container ────────────────────────────────────────────────────────
const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: SPRING_SNAP },
};

// ─── Cycling phrases ──────────────────────────────────────────────────────────
const PHRASES = ["always on.", "always current.", "always auditable.", "built for you."];

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
    // Fixed min-width = width of the longest phrase ("always auditable.")
    // Prevents the badge from reflowing/shifting width as the text cycles.
    <span
      style={{ display: "inline-block", minWidth: "10em", textAlign: "center" }}
    >
      <span
        key={index}
        className={phase === "in" ? "phrase-in" : "phrase-out"}
        style={{
          background: "linear-gradient(90deg, #4A6CF7, #7B9BFA)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {PHRASES[index]}
      </span>
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const LANDING_FAQS = [
  { q: "How long does it take to get started?", a: "Around 30 minutes. You configure your playbook positions, set your approval thresholds, and upload your first contract. No implementation project. No technical setup. No enterprise sales process." },
  { q: "Do I need a technical team to set this up?", a: "No. Zane is entirely self-serve. If you can fill in a form you can configure Zane. The only technical requirement is a browser." },
  { q: "Are my contracts used to train AI models?", a: "Never. Your contracts are anonymised before any AI model sees them and are never used for model training of any kind. Your data stays yours." },
  { q: "How is Zane different from Claude for Legal or Harvey?", a: "Claude for Legal is a generic assistant that starts from zero every session. Harvey is built for Magic Circle law firms at six figures a year. Neither of them knows your company. Zane is built specifically for lean in-house teams and gets smarter about your company with every contract reviewed." },
  { q: "What happens to my data if I cancel?", a: "Your data is yours. You can export everything before you cancel. We do not hold your data hostage." },
  { q: "Does Zane replace my lawyer?", a: "No. Zane handles the objective layer so your lawyer can focus on the judgment calls that actually require a lawyer. Every recommendation Zane makes requires a human decision before anything happens." },
  { q: "What contract types does Zane support?", a: "Commercial contracts, supplier agreements, customer MSAs, NDAs, technology agreements, employment contracts, and more. The playbook engine works for any contract type you configure it for." },
  { q: "Is there a minimum contract or commitment?", a: "No minimum contract beyond the billing period. No implementation fee. No setup cost. All plans include a 14 day free trial with no credit card required. Billed quarterly or annually." },
];

export default function Landing() {
  const shouldReduce = useReducedMotion();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  // Audience toggle: "gc" | "founder" | "both". Default shows both, stacked.
  const [audience, setAudience] = useState<"gc" | "founder" | "both">("both");
  // Billing toggle: quarterly (default) or annual
  const [billing, setBilling] = useState<"quarterly" | "annual">("quarterly");

  // Lenis smooth scroll
  useEffect(() => {
    let lenis: import("@studio-freight/lenis").default | null = null;
    import("@studio-freight/lenis").then(({ default: Lenis }) => {
      lenis = new Lenis({ duration: 1.1, smoothWheel: true });
      function raf(time: number) {
        lenis!.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    });
    return () => { lenis?.destroy(); };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6F3]">

      {/* ─── NAV ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-white/8 backdrop-blur-md" style={{ background: "rgba(11,17,24,0.97)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <ZaneLogo size="sm" light={true} />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-xs">
            {["#why-zane:Why Zane","#how-it-works:How it works","#pricing:Pricing"].map(s => {
              const [href, label] = s.split(":");
              return (
                <a key={href} href={href}
                  className="text-white/50 hover:text-white transition-colors duration-300">
                  {label}
                </a>
              );
            })}
            <Link to="/case-study" className="text-white/50 hover:text-white transition-colors duration-300">Case study</Link>
            <Link to="/resources" className="text-white/50 hover:text-white transition-colors duration-300">Resources</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-4 py-1.5 text-sm text-white/50 hover:text-white transition-colors duration-300">Sign in</Link>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link to="/register"
                className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow shadow-primary/20">
                Get started <ArrowRight size={13} />
              </Link>
            </motion.div>
          </div>
        </div>
      </header>

      {/* ─── HERO - dark ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden flex flex-col justify-center" style={{ minHeight: "calc(100vh - 57px)", background: "#111827" }}>
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(#4A6CF7 1px, transparent 1px), linear-gradient(90deg, #4A6CF7 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
        {/* Glow */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2, delay: 0.5 }}
          style={{ background: "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(74,108,247,0.22), transparent 65%)" }}
        />

        <div className="relative max-w-4xl mx-auto px-6 py-6 text-center space-y-4">

          {/* Cycling badge */}
          <motion.div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/4 text-xs text-white/50"
            {...(shouldReduce ? {} : fadeUpHero(0.1))}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
            Legal intelligence that's{" "}<CyclingPhrase />
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.08] text-white"
            {...(shouldReduce ? {} : fadeUpHero(0.25))}
          >
            Your legal team already has a playbook.{" "}
            <br className="hidden sm:block" />
            Zane makes sure the company{" "}
            <span style={{ background: "linear-gradient(90deg, #4A6CF7, #7B9BFA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              actually follows it.
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            className="text-base sm:text-lg text-white/55 leading-relaxed max-w-2xl mx-auto"
            {...(shouldReduce ? {} : fadeUpHero(0.4))}
          >
            Review contracts against your real positions. Not generic market standard. Yours.
          </motion.p>

          {/* CTA */}
          <motion.div
            className="flex flex-col items-center gap-2.5 pt-1"
            {...(shouldReduce ? {} : fadeUpHero(0.52))}
          >
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <a href="https://calendly.com/ahmedljasem/30min"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 text-sm">
                Book a 30 minute demo <ArrowRight size={15} />
              </a>
            </motion.div>
            <p className="text-xs text-white/25">No implementation. No enterprise contract. Working in 30 minutes.</p>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="pt-2 grid grid-cols-4 gap-4 max-w-lg mx-auto border-t border-white/8"
            {...(shouldReduce ? {} : fadeUpHero(0.64))}
          >
            {[
              { value: "11 minutes",      label: "Average review time" },
              { value: "100%",             label: "Company-specific from day one" },
              { value: "Every decision",  label: "Remembered and applied" },
              { value: "1 to 5 lawyers",  label: "The team size we are built for" },
            ].map(({ value, label }) => (
              <div key={label} className="text-center space-y-0.5">
                <div className="text-lg font-bold text-white">{value}</div>
                <div className="text-[10px] text-white/35">{label}</div>
              </div>
            ))}
          </motion.div>

          {/* ── Audience toggle ── */}
          <motion.div
            className="pt-3 flex flex-col items-center gap-3"
            {...(shouldReduce ? {} : fadeUpHero(0.75))}
          >
            <p className="text-[11px] text-white/30 uppercase tracking-widest">Who are you?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setAudience(audience === "gc" ? "both" : "gc")}
                className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all duration-200 ${
                  audience === "gc"
                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/25"
                    : "bg-white/5 text-white/50 border-white/10 hover:border-white/25 hover:text-white/70"
                }`}
              >
                GC or Head of Legal
              </button>
              <button
                onClick={() => setAudience(audience === "founder" ? "both" : "founder")}
                className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all duration-200 ${
                  audience === "founder"
                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/25"
                    : "bg-white/5 text-white/50 border-white/10 hover:border-white/25 hover:text-white/70"
                }`}
              >
                Founder or startup operator
              </button>
            </div>
          </motion.div>

          {/* Scroll hint */}
          <motion.div
            className="pt-1 flex flex-col items-center gap-1.5 opacity-25"
            {...(shouldReduce ? {} : fadeUpHero(0.9))}
          >
            <div className="w-px h-5 bg-white/40 rounded-full" />
            <span className="text-[10px] text-white/50 tracking-widest uppercase">scroll</span>
          </motion.div>
        </div>
      </section>

      {/* ─── PROBLEM ─────────────────────────────────────────────────────────── */}
      <section id="why-zane" className="py-20 bg-[#F7F6F3] border-t border-black/5">
        <div className="max-w-3xl mx-auto px-6 space-y-8">

          {/* GC version — shown when audience is gc or both */}
          {(audience === "gc" || audience === "both") && (
            <motion.div className="space-y-8" {...headingReveal} key="gc-problem">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                Most legal teams get this wrong every day.
              </h2>
              <div className="space-y-5 text-gray-600 leading-relaxed text-sm">
                <p>
                  They review the same clauses repeatedly because nobody documented the last decision. They make inconsistent risk calls because the playbook lives in one person's head. They miss approval thresholds because there is no system enforcing them. And when someone leaves the team, everything they knew leaves with them.
                </p>
                <p>
                  The problem is not speed. It is that legal knowledge was never captured in the first place.
                </p>
              </div>
            </motion.div>
          )}

          {/* Visual separator when showing both */}
          {audience === "both" && (
            <div className="flex items-center gap-4 py-2">
              <div className="flex-1 h-px bg-black/8" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest shrink-0">For founders and startup operators</span>
              <div className="flex-1 h-px bg-black/8" />
            </div>
          )}

          {/* Founder version — shown when audience is founder or both */}
          {(audience === "founder" || audience === "both") && (
            <motion.div className="space-y-8" {...(audience === "both" ? fadeUp(0.1) : headingReveal)} key="founder-problem">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                Every founder reviews contracts they should not have to review alone.
              </h2>
              <div className="space-y-5 text-gray-600 leading-relaxed text-sm">
                <p>
                  A supplier sends you an MSA. A customer wants you to sign their standard terms. A partner sends over an NDA. You are not a lawyer. You do not have one on staff. You either sign without really knowing what you are agreeing to or you spend £400 an hour finding out.
                </p>
                <p className="font-medium text-gray-800">
                  There is a better way.
                </p>
              </div>
            </motion.div>
          )}

        </div>
      </section>


      {/* ─── WHAT ZANE DOES ──────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#F2F1EE] border-t border-black/5">
        <div className="max-w-5xl mx-auto px-6">
          <div className="rounded-2xl overflow-hidden bg-white border border-black/6">
            <div className="grid lg:grid-cols-2 gap-0">
              <motion.div className="p-10 space-y-5 border-b lg:border-b-0 lg:border-r border-black/5 flex flex-col justify-center" {...slideLeft(0)}>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight leading-snug">
                  Zane does not just review contracts. It builds institutional legal memory.
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Every contract your team reviews, every position accepted or pushed back on, every exception approved, every override made - it all feeds into Zane's memory. Over time Zane learns how your company actually negotiates. Not how it thinks it does.
                </p>
                <Link to="/register" className="inline-flex items-center gap-1.5 text-sm text-primary hover:opacity-80 transition-opacity font-medium self-start">
                  See it in action <ArrowRight size={13} />
                </Link>
              </motion.div>
              <motion.div className="p-10 space-y-6" {...slideRight(0.15)}>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">How the memory compounds</div>
                <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true }}>
                  {[
                    { icon: BookOpen,   title: "After 10 contracts",  body: "Zane knows your common risk patterns." },
                    { icon: Scale,      title: "After 50 contracts",  body: "Zane knows which counterparties push back hardest and where." },
                    { icon: TrendingUp, title: "After 100 contracts", body: "Zane knows the gap between your written playbook and your real risk tolerance." },
                  ].map(({ icon: Icon, title, body }) => (
                    <motion.div key={title} className="flex gap-3" variants={staggerItem}>
                      <div className="w-8 h-8 rounded-lg bg-[#EEECEA] border border-black/6 flex items-center justify-center shrink-0">
                        <Icon size={14} className="text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{title}</div>
                        <div className="text-xs text-gray-600 mt-1 leading-relaxed">{body}</div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOUNDER OUTPUT SECTION ──────────────────────────────────────────── */}
      {(audience === "founder" || audience === "both") && (
        <section className="py-20 bg-[#111827]">
          <div className="max-w-4xl mx-auto px-6 space-y-12">
            <motion.div className="text-center space-y-3" {...headingReveal}>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Upload the contract. Get a plain English verdict in minutes.
              </h2>
              <p className="text-white/50 text-sm max-w-xl mx-auto">
                No legal jargon. No ambiguity. Just a clear answer and exactly what to do next.
              </p>
            </motion.div>

            <motion.div className="grid md:grid-cols-3 gap-5" {...fadeUp(0.1)}>
              {/* SAFE TO SIGN */}
              <div className="rounded-2xl border border-[#14532D] bg-[#052E16] p-6 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#14532D] text-white text-xs font-bold uppercase tracking-wide">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  Safe to sign
                </div>
                <div className="space-y-2">
                  <p className="text-white text-sm font-semibold leading-snug">Nothing material to worry about.</p>
                  <p className="text-white/60 text-xs leading-relaxed">Standard terms that do not expose you.</p>
                </div>
                <div className="pt-2 border-t border-white/10">
                  <p className="text-white/40 text-[11px] leading-relaxed italic">
                    Example: Mutual liability cap at 12 months of fees. Standard English law. Clean DPA attached.
                  </p>
                </div>
              </div>

              {/* NEGOTIATE FIRST */}
              <div className="rounded-2xl border border-[#431407] bg-[#1C0F00] p-6 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#431407] text-white text-xs font-bold uppercase tracking-wide">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  Negotiate first
                </div>
                <div className="space-y-2">
                  <p className="text-white text-sm font-semibold leading-snug">These clauses need pushing back on.</p>
                  <p className="text-white/60 text-xs leading-relaxed">Here is exactly what to say.</p>
                </div>
                <div className="pt-2 border-t border-white/10">
                  <p className="text-white/40 text-[11px] leading-relaxed italic">
                    Example: Auto-renewal with only 14 days notice. Miss the window and you're locked in for another year at £24,000.
                  </p>
                </div>
              </div>

              {/* DO NOT SIGN YET */}
              <div className="rounded-2xl border border-[#450A0A] bg-[#1F0A0A] p-6 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#450A0A] text-white text-xs font-bold uppercase tracking-wide">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  Do not sign yet
                </div>
                <div className="space-y-2">
                  <p className="text-white text-sm font-semibold leading-snug">This contract has serious problems.</p>
                  <p className="text-white/60 text-xs leading-relaxed">Here is what needs fixing before you commit.</p>
                </div>
                <div className="pt-2 border-t border-white/10">
                  <p className="text-white/40 text-[11px] leading-relaxed italic">
                    Example: They have capped their liability at one month of fees. If their software fails and costs you £50,000 to fix, you have no recourse.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Founder testimonial */}
            <motion.div
              className="rounded-2xl border border-white/8 bg-white/4 p-8 max-w-2xl mx-auto"
              {...fadeUp(0.2)}
            >
              <div className="space-y-4">
                <div className="text-2xl text-white/20 font-serif leading-none">"</div>
                <p className="text-white/80 text-sm leading-relaxed italic">
                  I used to spend a week going back and forth with lawyers before signing supplier agreements. Now I upload the contract and know what to do in ten minutes.
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                    FD
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white/60">Founder, B2B SaaS</div>
                    <div className="text-[10px] text-white/30">Early design partner — testimonial placeholder</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ─── PRODUCT SCREENSHOT SHOWCASE ─────────────────────────────────────── */}
      <section className="py-20 px-6 bg-[#080F18]">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-semibold text-white">See exactly what Zane produces.</h2>
            <p className="text-muted-foreground text-lg">Every screen. No mockups. This is the real product.</p>
          </div>
          {/* ── Mockup 1: Dashboard next actions ── */}
          <div className="flex flex-col md:flex-row gap-10 items-center">
            <div className="flex-1 rounded-xl bg-[#0B1118] border border-[#1B2533] aspect-video overflow-hidden p-5 space-y-3 select-none pointer-events-none">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#4A6CF7]/60 pb-1 border-b border-[#1E293B]">Next Actions</div>
              {[
                { name: "Technology Services Agreement", cp: "Acme Technologies Ltd", red: true, label: "Do not sign yet" },
                { name: "Master Services Agreement",     cp: "Nexus Solutions Ltd",    red: false, label: "Negotiate first" },
                { name: "Software Licence Agreement",    cp: "DataFlow Technologies", red: true, label: "Review required" },
              ].map((item) => (
                <div key={item.name} className="rounded-lg bg-[#111A24] border border-[#1E293B] px-3 py-2.5 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${item.red ? "bg-red-400" : "bg-amber-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-white truncate">{item.name}</div>
                    <div className="text-[10px] text-white/40 truncate">{item.cp}</div>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border shrink-0 ${item.red ? "bg-[#1F0A0A] text-white border-[#450A0A]" : "bg-[#1C0F00] text-white border-[#431407]"}`}>
                    {item.label}
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#4A6CF7] text-white shrink-0">Review →</span>
                </div>
              ))}
            </div>
            <div className="flex-1 space-y-3">
              <h3 className="text-xl font-semibold text-white">What needs attention today</h3>
              <p className="text-muted-foreground leading-relaxed">Every contract requiring action surfaces immediately. No digging through emails. No missed deadlines.</p>
            </div>
          </div>

          {/* ── Mockup 2: Contract review clause detail ── */}
          <div className="flex flex-col md:flex-row-reverse gap-10 items-center">
            <div className="flex-1 rounded-xl bg-[#0B1118] border border-[#1B2533] aspect-video overflow-hidden p-5 space-y-3 select-none pointer-events-none">
              <div className="flex items-center gap-2 pb-2 border-b border-[#1E293B]">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-[11px] font-bold text-white">Liability Cap</span>
                <span className="ml-auto text-[9px] bg-[#1F0A0A] text-white border border-[#450A0A] rounded px-1.5 py-0.5">RED: High Risk</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-[#1F0A0A] border border-[#450A0A] px-2.5 py-2 space-y-1">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-white/50">Issue</div>
                  <div className="text-[10px] text-white leading-snug">Cap set at £500k, below your 1x annual fees minimum threshold.</div>
                </div>
                <div className="rounded-lg bg-[#0D1521] border border-[#1E293B] px-2.5 py-2 space-y-1">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-white/30">Why it matters</div>
                  <div className="text-[10px] text-white/70 leading-snug">Exposes you to uncapped loss if contract value exceeds the cap.</div>
                </div>
                <div className="rounded-lg bg-[#0D1521] border border-[#1E293B] px-2.5 py-2 space-y-1">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-white/30">Fallback</div>
                  <div className="text-[9px] text-white/70 font-mono leading-snug">"...liability shall not exceed the greater of £1,000,000 or 1× annual fees..."</div>
                </div>
                <div className="rounded-lg bg-[#1F0A0A] border border-[#450A0A] px-2.5 py-2 space-y-1">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-white/50">Escalation</div>
                  <div className="text-[10px] text-white font-semibold">Legal → GC sign-off required</div>
                  <div className="text-[9px] text-white/50">Clause exceeds unilateral authority</div>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <h3 className="text-xl font-semibold text-white">Not just a flag. A decision.</h3>
              <p className="text-muted-foreground leading-relaxed">Every Red clause comes with the exact fallback language to send back, who needs to approve it, and the specific regulation that applies to your sector.</p>
            </div>
          </div>

          {/* ── Mockup 3: Escalation and sign-off workflow ── */}
          <div className="flex flex-col md:flex-row gap-10 items-center">
            <div className="flex-1 rounded-xl bg-[#0B1118] border border-[#1B2533] aspect-video overflow-hidden p-5 space-y-3 select-none pointer-events-none">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 pb-2 border-b border-[#1E293B]">Escalation Required: 2 tiers triggered</div>
              <div className="space-y-2">
                <div className="rounded-lg bg-[#1F0A0A] border border-[#450A0A] px-3 py-2.5 space-y-1.5">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-white">Tier 1: Clause Risk</div>
                  <div className="text-[10px] text-white/80">· <span className="font-semibold">Liability Cap:</span> Cap set below your 1× annual fees minimum</div>
                  <div className="text-[10px] text-white/80">· <span className="font-semibold">Indemnity:</span> Broad consequential loss coverage accepted</div>
                </div>
                <div className="rounded-lg bg-[#1C0F00] border border-[#431407] px-3 py-2.5">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-white mb-1">Tier 2: Contract Value</div>
                  <div className="text-[10px] text-white/80">£840,000: CFO approval required above £500k threshold</div>
                </div>
              </div>
              <div className="pt-1">
                <div className="text-[9px] text-white/30 uppercase tracking-widest mb-2">Sign-off sequence</div>
                <div className="flex items-center gap-1.5">
                  {["Handler", "Legal", "GC", "CFO"].map((a, i, arr) => (
                    <span key={a} className="flex items-center gap-1.5">
                      <span className="bg-[#4A6CF7] text-white text-[9px] font-bold px-2.5 py-1 rounded-full">{a}</span>
                      {i < arr.length - 1 && <span className="text-white/20 text-xs">→</span>}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <h3 className="text-xl font-semibold text-white">Governance routing built in</h3>
              <p className="text-muted-foreground leading-relaxed">Zane works out who needs to approve what based on your approval matrix. Clause risk, contract value, and governance triggers all checked simultaneously.</p>
            </div>
          </div>

          {/* ── Mockup 4: Playbook with outcome variance ── */}
          <div className="flex flex-col md:flex-row-reverse gap-10 items-center">
            <div className="flex-1 rounded-xl bg-[#0B1118] border border-[#1B2533] aspect-video overflow-hidden p-5 select-none pointer-events-none">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 pb-2 border-b border-[#1E293B] mb-3">Liability Cap: Written vs Actual</div>
              <div className="grid grid-cols-2 gap-5 h-[calc(100%-36px)]">
                <div className="space-y-2">
                  <div className="text-[9px] text-white/40 uppercase tracking-widest">Written position</div>
                  <div className="rounded-lg bg-[#111A24] border border-[#1E293B] p-2.5">
                    <div className="text-[10px] text-white/70 font-mono leading-relaxed">"Liability capped at the greater of £1M or 1× annual fees paid in the preceding 12 months."</div>
                  </div>
                  <div className="text-[9px] text-white/30 italic">Hard red line: no uncapped liability</div>
                  <div className="mt-2 text-[9px] bg-[#1F0A0A] text-white border border-[#450A0A] rounded px-2 py-1">⚠ Drifting below preferred</div>
                </div>
                <div className="space-y-3">
                  <div className="text-[9px] text-white/40 uppercase tracking-widest">Actual outcomes: 6 contracts</div>
                  {[
                    { label: "Preferred", pct: 33, bg: "bg-[#14532D]" },
                    { label: "Fallback",  pct: 33, bg: "bg-[#431407]" },
                    { label: "Below fallback", pct: 34, bg: "bg-[#450A0A]" },
                  ].map((bar) => (
                    <div key={bar.label} className="space-y-1">
                      <div className="flex justify-between text-[9px]">
                        <span className="text-white/50">{bar.label}</span>
                        <span className="text-white/30">{bar.pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#1E293B] overflow-hidden">
                        <div className={`h-full rounded-full ${bar.bg}`} style={{ width: `${bar.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <h3 className="text-xl font-semibold text-white">Your playbook learns from reality</h3>
              <p className="text-muted-foreground leading-relaxed">See the gap between what your playbook says and what your team actually signs. Automatically. After every contract.</p>
            </div>
          </div>

          {/* ── Mockup 5: Portfolio risk ── */}
          <div className="flex flex-col md:flex-row gap-10 items-center">
            <div className="flex-1 rounded-xl bg-[#0B1118] border border-[#1B2533] aspect-video overflow-hidden p-5 space-y-3 select-none pointer-events-none">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 pb-2 border-b border-[#1E293B]">Portfolio Risk</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Value at risk",                value: "£2.8M", color: "text-red-400"     },
                  { label: "Pending approval",             value: "3",     color: "text-amber-400"   },
                  { label: "Counterparties pushing back",  value: "4",     color: "text-[#60A5FA]"  },
                  { label: "Contracts reviewed",           value: "12",    color: "text-[#86EFAC]"  },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg bg-[#111A24] border border-[#1E293B] px-3 py-2.5">
                    <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-[9px] text-white/30 mt-0.5 leading-tight">{stat.label}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg bg-[#111A24] border border-[#1E293B] px-3 py-2.5 space-y-2">
                <div className="text-[9px] text-white/30 uppercase tracking-widest">Risk by clause category</div>
                {[
                  { label: "Liability Cap",  pct: 80, bg: "bg-red-400"   },
                  { label: "Auto-Renewal",   pct: 55, bg: "bg-amber-400" },
                  { label: "Indemnity",      pct: 45, bg: "bg-red-400"   },
                  { label: "Payment Terms",  pct: 30, bg: "bg-amber-400" },
                ].map((bar) => (
                  <div key={bar.label} className="flex items-center gap-2">
                    <span className="text-[9px] text-white/40 w-20 shrink-0">{bar.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-[#1E293B] overflow-hidden">
                      <div className={`h-full rounded-full ${bar.bg}`} style={{ width: `${bar.pct}%` }} />
                    </div>
                    <span className="text-[9px] text-white/20 w-6 text-right">{bar.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <h3 className="text-xl font-semibold text-white">Your entire exposure in one view</h3>
              <p className="text-muted-foreground leading-relaxed">Every contract in your portfolio. Every risk quantified in pounds. Every renewal flagged before it becomes a problem.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOUNDER SECTION ─────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row gap-10 items-start">
            <div className="shrink-0">
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold select-none">
                AJ
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-900">Built by a lawyer who lived this problem.</h2>
              <p className="text-muted-foreground leading-relaxed">
                Ahmed is a commercial solicitor. He has worked across private practice at firms including Dentons, Macfarlanes and Norton Rose Fulbright, in private banking, in-house at Uber Boat by Thames Clippers and Fora, a Blackstone portfolio company, and more recently advising founders and startups independently.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Across every environment he watched the same problem repeat itself. Legal knowledge built up over years of negotiations, hard-won positions and accepted risks, then disappeared the moment someone left. The next lawyer would start from scratch. The same clauses renegotiated. The same risks accepted without anyone knowing they had been accepted before.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                The tools that existed were built for law firms. Not for the one to five person legal function doing this work under pressure every day.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                So he built Zane himself.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Qualified solicitor, England and Wales
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Built without a technical co-founder
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── WHY TRUST ZANE ──────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#F7F6F3] border-t border-black/5">
        <div className="max-w-3xl mx-auto px-6 space-y-8">
          <motion.div className="text-center space-y-3" {...headingReveal}>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Why legal teams trust Zane.</h2>
          </motion.div>
          <motion.div
            className="space-y-3"
            variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}
          >
            {[
              "Built for in-house teams of 1 to 5 lawyers",
              "Every recommendation linked to source material",
              "Escalation routing based on your approval matrix",
              "Contracts never used for model training",
              "Full audit trail of every recommendation",
            ].map((item) => (
              <motion.div key={item} className="flex items-center gap-3 rounded-xl bg-white border border-black/6 px-5 py-4" variants={staggerItem}>
                <CheckCircle size={14} className="text-primary shrink-0" />
                <p className="text-sm text-gray-700 font-medium">{item}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── HOW ZANE GETS SMARTER - dark ────────────────────────────────────── */}
      <section className="py-20" style={{ background: "#0B1118" }}>
        <div className="max-w-4xl mx-auto px-6 space-y-8">
          <motion.div className="space-y-4" {...headingReveal}>
            <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">How it improves</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-snug">
              Zane gets smarter about your company without touching your data.
            </h2>
          </motion.div>
          <motion.div className="space-y-5 text-white/50 leading-relaxed text-sm" {...fadeUp(0.1)}>
            <p>
              Your contracts are never used to train AI models. Not ours, not anyone else's. That is not a limitation. It is a deliberate architectural choice that makes Zane safer for legal work than almost any alternative.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── COMPARISON TABLE ────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#F7F6F3] border-t border-black/5">
        <div className="max-w-5xl mx-auto px-6 space-y-10">
          <motion.div className="text-center space-y-3" {...headingReveal}>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              How Zane compares to everything else out there.
            </h2>
          </motion.div>

          {/* Philosophy table */}
          <motion.div
            className="max-w-3xl mx-auto rounded-2xl overflow-hidden border border-black/8 bg-[#F2F1EE]"
            {...fadeUp(0.1)}
          >
            <div className="grid grid-cols-2 border-b border-black/8">
              <div className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-widest border-r border-black/8">Generic Legal AI</div>
              <div className="px-6 py-3 text-xs font-bold text-primary uppercase tracking-widest">Zane</div>
            </div>
            {[
              ["Reviews contracts in isolation",                   "Learns from your negotiation history"],
              ["Produces generic market-standard outputs",         "Aligns every review to your actual playbook and past decisions"],
              ["Stateless - starts from zero every session",       "Builds institutional memory that compounds over time"],
              ["Focused on document review",                       "Focused on operational consistency across the business"],
              ["One-off AI answers",                               "Remembers which risks were accepted and why"],
            ].map(([left, right], i) => (
              <div key={i} className="grid grid-cols-2 border-b border-black/5 last:border-0">
                <div className="px-6 py-4 text-sm text-gray-500 border-r border-black/5 flex items-start gap-2">
                  <X size={11} className="text-gray-300 shrink-0 mt-0.5" />
                  {left}
                </div>
                <div className="px-6 py-4 text-sm text-gray-700 flex items-start gap-2">
                  <CheckCircle size={11} className="text-primary shrink-0 mt-0.5" />
                  {right}
                </div>
              </div>
            ))}
          </motion.div>

        </div>
      </section>

      {/* ─── TIME AND VALUE ───────────────────────────────────────────────────── */}
      <section className="py-20 border-t border-black/5">
        <div className="max-w-3xl mx-auto px-6 space-y-10">
          <motion.div className="text-center space-y-3" {...headingReveal}>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">What this means in practice.</h2>
          </motion.div>
          <motion.div
            className="space-y-4"
            variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}
          >
            {[
              "A contract review that takes hours manually takes a fraction of the time with Zane.",
              "A new lawyer joining the team gets a full briefing document generated from your contract history in minutes rather than spending six weeks reading through everything.",
              "A GC who leaves takes their experience with them. With Zane that experience stays.",
              "A regulation changes. Zane immediately identifies which active contracts are affected.",
              "A contract comes up for renewal. Zane flags that the last version had a clause accepted below your red line that should be fixed this time.",
            ].map((item) => (
              <motion.div key={item} className="flex items-start gap-3 rounded-xl bg-[#F2F1EE] border border-black/5 px-5 py-4" variants={staggerItem}>
                <CheckCircle size={13} className="text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700 leading-relaxed">{item}</p>
              </motion.div>
            ))}
            <motion.p className="text-sm font-semibold text-gray-800 pt-2 text-center" variants={staggerItem}>
              Stop renegotiating risks your team has already resolved before.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ─── VALUE FRAMING ───────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-2 text-center space-y-4">
        {audience !== "founder" ? (
          /* GC / both version */
          <motion.div className="space-y-4" {...headingReveal} key="gc-value">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              What does it actually cost you today?
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xl mx-auto">
              Every contract your team reviews manually takes two to four hours. At outside counsel rates
              that is £800 to £1,600 per contract. At in-house rates it is your most qualified person
              doing work a structured system could handle in minutes.
            </p>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xl mx-auto">
              Zane starts at £450 a month billed quarterly. That is less than one hour of outside counsel fees per week.
              Handles the first pass every time so your lawyer focuses on the decisions that actually need a lawyer.
            </p>
          </motion.div>
        ) : (
          /* Founder version */
          <motion.div className="space-y-4" {...headingReveal} key="founder-value">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Outside counsel charges £400 an hour to review a contract.
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xl mx-auto">
              Most founder contracts take two to three hours. That is £800 to £1,200 per contract.
              Zane starts at £450 a month billed quarterly. That is less than one hour of outside counsel fees per week.
            </p>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xl mx-auto">
              Upload the contract. Know what to do in minutes. Keep the lawyer for the decisions that actually need one.
            </p>
          </motion.div>
        )}
      </section>

      {/* ─── PRICING ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20 space-y-10">
        <motion.div className="text-center space-y-3" {...headingReveal}>
          <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">Pricing</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Transparent pricing. No surprises.</h2>
          <p className="text-sm text-gray-500">14 day free trial on all plans. No credit card required.</p>
        </motion.div>

        {/* Billing toggle */}
        <motion.div className="flex justify-center" {...fadeUp(0.05)}>
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-black/5 border border-black/8">
            <button
              onClick={() => setBilling("quarterly")}
              className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all ${
                billing === "quarterly"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Quarterly
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                billing === "annual"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Annual
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">Save up to 13%</span>
            </button>
          </div>
        </motion.div>

        <motion.div
          className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto"
          variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}
        >
          {[
            {
              tier: "Starter",
              monthlyRate: "£450",
              quarterly: "£1,350",
              annual: "£4,800",
              annualSave: "Save 11%",
              highlight: true,
              description: "Solo GC or first in-house hire.",
              trial: true,
              features: [
                "Full playbook engine",
                "Contract review",
                "Red / Amber / Green risk output",
                "Governance escalation routing",
                "Regulatory citations",
                "Outcome capture",
                "Includes one user seat",
              ],
              link: "/register",
              external: false,
            },
            {
              tier: "Team",
              monthlyRate: "£800",
              quarterly: "£2,400",
              annual: "£8,400",
              annualSave: "Save 13%",
              highlight: false,
              description: "Up to five users.",
              trial: true,
              features: [
                "Everything in Starter",
                "Portfolio dashboard",
                "Legal Inheritance bulk upload",
                "New hire onboarding briefings",
                "Negotiating pattern intelligence",
                "Contradiction detection across your contract library",
              ],
              link: "/register",
              external: false,
            },
            {
              tier: "Growth",
              monthlyRate: "£1,350",
              quarterly: "£4,050",
              annual: "£14,400",
              annualSave: "Save 11%",
              highlight: false,
              description: "Unlimited users.",
              trial: true,
              features: [
                "Everything in Team",
                "Advanced regulatory intelligence with live feeds",
                "Board-ready reporting",
                "Full audit trail for regulatory compliance",
                "Priority support",
              ],
              link: "https://calendly.com/ahmedljasem/30min",
              external: true,
            },
          ].map(({ tier, monthlyRate, quarterly, annual, annualSave, highlight, description, trial, features, link, external }) => (
            <motion.div
              key={tier}
              className={`rounded-xl border p-6 space-y-5 ${highlight ? "border-primary/25 shadow-sm shadow-primary/10" : "border-black/8"} bg-[#F2F1EE]`}
              variants={staggerItem}
              whileHover={{ y: -4, boxShadow: "0 12px 32px rgba(0,0,0,0.08)" }}
              transition={SPRING_SOFT}
            >
              <div>
                <div className="text-xs text-gray-500 font-medium mb-1">{tier}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900">{monthlyRate}</span>
                  <span className="text-xs text-gray-500">/mo</span>
                </div>
                {billing === "quarterly" ? (
                  <p className="text-[11px] text-gray-400 mt-1">Billed {quarterly} quarterly</p>
                ) : (
                  <div className="flex items-center gap-1.5 mt-1">
                    <p className="text-[11px] text-gray-400">Billed {annual} annually</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">{annualSave}</span>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">{description}</p>
                {trial && (
                  <p className="text-[11px] text-primary font-medium mt-1">14 day free trial — no credit card required</p>
                )}
              </div>
              <ul className="space-y-2">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                    <CheckCircle size={11} className={highlight ? "text-primary" : "text-gray-300"} />
                    {f}
                  </li>
                ))}
              </ul>
              {external ? (
                <a
                  href={link}
                  target="_blank" rel="noopener noreferrer"
                  className={`block text-center px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    highlight ? "bg-primary text-white hover:opacity-90 shadow shadow-primary/20" : "border border-black/10 text-gray-600 hover:text-gray-800 hover:border-black/20"
                  }`}>
                  Book a demo →
                </a>
              ) : (
                <Link to={link}
                  className={`block text-center px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    highlight ? "bg-primary text-white hover:opacity-90 shadow shadow-primary/20" : "border border-black/10 text-gray-600 hover:text-gray-800 hover:border-black/20"
                  }`}>
                  Start free trial →
                </Link>
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* Trust callout */}
        <motion.div
          className="max-w-xl mx-auto rounded-xl border border-slate-200 bg-slate-50 px-6 py-4 text-center space-y-1"
          {...fadeUp(0.15)}
        >
          <p className="text-xs font-medium text-slate-600">
            Your contracts are never used to train AI models. Your data stays yours.
          </p>
        </motion.div>

        <motion.p className="text-center text-xs text-gray-500 max-w-lg mx-auto" {...fadeUp(0.2)}>
          All plans include a 14 day free trial. No implementation fee. No setup cost. Billed quarterly or annually.
        </motion.p>
      </section>

      {/* ─── REGULATORY - dark ───────────────────────────────────────────────── */}
      <section className="py-20" style={{ background: "#0B1118" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="rounded-2xl overflow-hidden" style={{ background: "#111A24" }}>
            <div className="grid lg:grid-cols-2 gap-0">
              <motion.div className="p-10 space-y-5" {...slideLeft(0)}>
                <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">Regulatory intelligence</div>
                <h2 className="text-2xl font-bold text-white tracking-tight leading-snug">
                  A regulation changes.<br />Zane tells you which contracts are affected.
                </h2>
                <p className="text-sm text-white/50 leading-relaxed">
                  Hardcoded regulatory context is a liability the moment something changes. For a regulated business, that is not a minor gap - it is a trust-destroying one.
                </p>
                <p className="text-sm text-white/50 leading-relaxed">
                  Every contract review is cross-referenced against the regulatory frameworks that apply to your sector and jurisdiction. GDPR, FCA Consumer Duty, KSA GCAM, and more - automatically.
                </p>
                <a href="#how-it-works" className="inline-flex items-center gap-1.5 text-sm text-primary hover:opacity-80 transition-opacity font-medium">
                  See how it works <ArrowRight size={13} />
                </a>
              </motion.div>
              <motion.div
                className="border-l border-white/8 p-10 flex flex-col justify-center gap-3"
                variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}
              >
                {[
                  { flag: "🇬🇧", label: "United Kingdom",  regs: "FCA Consumer Duty · UK GDPR · ICO · Bribery Act" },
                  { flag: "🇪🇺", label: "European Union",  regs: "GDPR · EU AI Act · DORA · NIS2" },
                  { flag: "🇺🇸", label: "United States",   regs: "CCPA · HIPAA · SOX · NY SHIELD · NYDFS" },
                  { flag: "🇸🇦", label: "Saudi Arabia",    regs: "GCAM · PDPL · GEA · Vision 2030 compliance" },
                  { flag: "🇰🇷", label: "South Korea",     regs: "Game Industry Act · PIPA · Loot box disclosure" },
                  { flag: "🇨🇦", label: "Canada",          regs: "PIPEDA · Bill C-27 · CASL · Competition Act" },
                ].map(({ flag, label, regs }) => (
                  <motion.div key={label} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0" variants={staggerItem}>
                    <span className="text-lg">{flag}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white/70">{label}</div>
                      <div className="text-[10px] text-white/30 mt-0.5 truncate">{regs}</div>
                    </div>
                    <CheckCircle size={12} className="text-primary ml-auto shrink-0" />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <motion.div className="text-center mb-10" {...headingReveal}>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Frequently asked questions</h2>
        </motion.div>
        <div className="space-y-3">
          {LANDING_FAQS.map((faq, i) => {
            const isOpen = openFaq === i;
            return (
              <motion.div
                key={i}
                className="rounded-xl border border-[#1B2533] bg-[#111A24] overflow-hidden"
                {...fadeUp(i * 0.04)}
              >
                <button
                  className="w-full flex items-center justify-between px-6 py-4 text-left gap-4"
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                >
                  <span className="text-sm font-semibold text-white">{faq.q}</span>
                  <span className={`shrink-0 w-5 h-5 rounded-full border border-white/20 flex items-center justify-center transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`}>
                    <X size={10} className="text-white/50" />
                  </span>
                </button>
                <div
                  className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{ maxHeight: isOpen ? "300px" : "0px", opacity: isOpen ? 1 : 0 }}
                >
                  <p className="px-6 pb-5 text-sm text-white/60 leading-relaxed">{faq.a}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ─── FINAL CTA ───────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <motion.div
          className="relative rounded-2xl overflow-hidden p-12 text-center space-y-6"
          style={{ background: "#0B1118", border: "1px solid #1B2533" }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={EASE_OUT_EXPO}
        >
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }} />
          <div className="relative space-y-5">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              The first contract you review will show you exactly what it can do.
            </h2>
            <p className="text-white/60 text-sm max-w-md mx-auto">
              Most tools ask you to trust them before showing you anything. Zane asks for 30 minutes and a contract. Book a demo. Bring a real contract. We will run it through Zane live and show you the output before you make any decision.
            </p>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <a href="https://calendly.com/ahmedljasem/30min"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-gray-900 font-bold rounded-xl hover:opacity-95 transition-opacity shadow-xl text-sm">
                Book a 30 minute demo <ArrowRight size={15} />
              </a>
            </motion.div>
            <p className="text-white/30 text-xs">
              Or email{" "}
              <a href="mailto:ahmed@zanelegal.ai" className="text-white/50 hover:text-white/70 transition-colors underline underline-offset-2">
                ahmed@zanelegal.ai
              </a>
              {" "}with any questions first.
            </p>
          </div>
        </motion.div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-black/6 mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <ZaneLogo size="sm" light={false} />
          </Link>
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <Link to="/case-study" className="hover:text-gray-600 transition-colors">Case study</Link>
            <Link to="/security" className="hover:text-gray-600 transition-colors">Security</Link>
            <Link to="/resources" className="hover:text-gray-600 transition-colors">Resources</Link>
            <span>2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
