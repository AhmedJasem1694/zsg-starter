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
  );
}

// ─── Animated product preview - matches real dark dashboard ──────────────────
const MOCK_CLAUSES = [
  { label: "Limitation of Liability", status: "RED",   summary: "Cap below 3 months' fees - breaches red line",   action: "Negotiate" },
  { label: "Data & Privacy",          status: "RED",   summary: "No DPA in place - GDPR exposure",                action: "Escalate"  },
  { label: "Indemnity",               status: "AMBER", summary: "One-sided indemnity - negotiate scope",           action: "Review"    },
  { label: "Auto-Renewal",            status: "AMBER", summary: "No notice provision - push back",                action: "Review"    },
  { label: "Confidentiality",         status: "GREEN", summary: "Mutual 2-year - meets preferred position",       action: "Accept"    },
  { label: "Governing Law",           status: "GREEN", summary: "English law - acceptable",                       action: "Accept"    },
];

const STATUS_CFG = {
  RED:   { bar: "#F87171", badge: "rgba(239,68,68,0.15)",   text: "#FCA5A5", border: "rgba(239,68,68,0.3)"   },
  AMBER: { bar: "#FBBF24", badge: "rgba(251,191,36,0.12)",  text: "#FCD34D", border: "rgba(251,191,36,0.25)" },
  GREEN: { bar: "#4ADE80", badge: "rgba(74,222,128,0.12)",  text: "#86EFAC", border: "rgba(74,222,128,0.25)" },
};

function ProductPreview() {
  const clauseDelays = [0.5, 0.9, 1.3, 1.7, 2.1, 2.5];

  return (
    <motion.div
      className="relative w-full max-w-md mx-auto"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ ...SPRING_SNAP, delay: 0.2 }}
    >
      {/* Glow */}
      <div className="absolute inset-0 rounded-2xl blur-2xl scale-95 opacity-50" style={{ background: "radial-gradient(ellipse at 50% 60%, rgba(96,165,250,0.18), transparent 70%)" }} />

      {/* Window chrome */}
      <div className="relative rounded-2xl shadow-2xl overflow-hidden" style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.08)" }}>

        {/* Top bar */}
        <motion.div
          className="flex items-center gap-3 px-4 py-3"
          style={{ background: "#161B22", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.35 }}
        >
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-[10px] text-white/30">Acme Corp - Supplier MSA.pdf</span>
          </div>
          <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
        </motion.div>

        {/* Risk summary bar */}
        <motion.div
          className="px-4 py-2.5 flex items-center gap-3"
          style={{ background: "rgba(239,68,68,0.07)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.35 }}
        >
          <span className="text-[11px] font-bold text-red-400 uppercase tracking-wide">HIGH RISK</span>
          <div className="flex gap-1.5 ml-auto text-[10px] font-semibold">
            <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.18)", color: "#FCA5A5" }}>2 RED</span>
            <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(251,191,36,0.15)", color: "#FCD34D" }}>2 AMBER</span>
            <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(74,222,128,0.15)", color: "#86EFAC" }}>2 GREEN</span>
          </div>
        </motion.div>

        {/* Clause rows */}
        <div className="divide-y divide-white/[0.05]">
          {MOCK_CLAUSES.map((c, i) => {
            const cfg = STATUS_CFG[c.status as keyof typeof STATUS_CFG];
            return (
              <motion.div
                key={c.label}
                className="flex items-center gap-3 px-4 py-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", bounce: 0.15, duration: 0.45, delay: clauseDelays[i] }}
              >
                <div className="w-0.5 h-8 rounded-full shrink-0" style={{ background: cfg.bar }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-white/80">{c.label}</div>
                  <div className="text-[10px] text-white/35 mt-0.5 truncate">{c.summary}</div>
                </div>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0"
                  style={{ background: cfg.badge, color: cfg.text, border: `1px solid ${cfg.border}` }}
                >
                  {c.status}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Footer */}
        <motion.div
          className="px-4 py-2.5 flex items-center justify-between"
          style={{ background: "#161B22", borderTop: "1px solid rgba(255,255,255,0.06)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.0, duration: 0.35 }}
        >
          <span className="text-[10px] text-white/25">Reviewed in 1m 43s · UK GDPR flagged</span>
          <span className="text-[10px] font-medium" style={{ color: "#60A5FA" }}>Do not sign yet →</span>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Landing() {
  const shouldReduce = useReducedMotion();

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
            Review contracts against your real negotiation history, escalation thresholds, and commercial risk positions. Not generic market standard. Yours.
          </motion.p>

          {/* CTA */}
          <motion.div
            className="flex flex-col items-center gap-2.5 pt-1"
            {...(shouldReduce ? {} : fadeUpHero(0.52))}
          >
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link to="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 text-sm">
                See it in action - book a 30 minute demo <ArrowRight size={15} />
              </Link>
            </motion.div>
            <p className="text-xs text-white/25">No implementation. No enterprise contract. Working in 30 minutes.</p>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="pt-2 grid grid-cols-4 gap-4 max-w-lg mx-auto border-t border-white/8"
            {...(shouldReduce ? {} : fadeUpHero(0.64))}
          >
            {[
              { value: "50+",     label: "Clause types" },
              { value: "14",      label: "Jurisdictions" },
              { value: "minutes", label: "Not hours" },
              { value: "100%",    label: "Playbook-calibrated" },
            ].map(({ value, label }) => (
              <div key={label} className="text-center space-y-0.5">
                <div className="text-lg font-bold text-white">{value}</div>
                <div className="text-[10px] text-white/35">{label}</div>
              </div>
            ))}
          </motion.div>

          {/* Scroll hint */}
          <motion.div
            className="pt-1 flex flex-col items-center gap-1.5 opacity-25"
            {...(shouldReduce ? {} : fadeUpHero(0.82))}
          >
            <div className="w-px h-5 bg-white/40 rounded-full" />
            <span className="text-[10px] text-white/50 tracking-widest uppercase">scroll</span>
          </motion.div>
        </div>
      </section>

      {/* ─── PROBLEM ─────────────────────────────────────────────────────────── */}
      <section id="why-zane" className="py-20 bg-[#F7F6F3] border-t border-black/5">
        <div className="max-w-3xl mx-auto px-6 space-y-8">
          <motion.div className="space-y-4" {...headingReveal}>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Most legal teams renegotiate the same risks over and over again.
            </h2>
          </motion.div>
          <motion.div className="space-y-5 text-gray-600 leading-relaxed text-sm" {...fadeUp(0.1)}>
            <p>
              Because the reasoning behind prior negotiations is never captured. A new contract lands. The team analyses it from scratch. They accept a position they have accepted seven times before without knowing it. Or they push back on something they have always conceded, wasting everyone's time.
            </p>
            <p>
              The problem is not speed. It is that legal knowledge lives in one person's head, in old email threads, in contracts nobody reads until something goes wrong.
            </p>
            <p>
              When that person leaves, the knowledge leaves with them. When the team grows, consistency disappears. When a regulator asks why a decision was made, nobody can answer.
            </p>
          </motion.div>
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
                <p className="text-xs text-gray-500 leading-relaxed border-t border-black/5 pt-5">
                  That intelligence does not come from training an AI model on your contracts. Your data never enters any model training pool. It comes from structured retrieval of your own negotiation history applied to every new review. That is a distinction your procurement team, your DPO, and your GC will all care about.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATS ───────────────────────────────────────────────────────────── */}
      <div className="border-y border-black/5 bg-[#F2F1EE]">
        <motion.div
          className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6"
          variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.5 }}
        >
          {[
            { value: "50+",     label: "Clause types analysed" },
            { value: "14",      label: "Jurisdictions covered" },
            { value: "minutes", label: "Not hours" },
            { value: "100%",    label: "Playbook-calibrated" },
          ].map(({ value, label }) => (
            <motion.div key={label} className="text-center space-y-1" variants={staggerItem}>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ─── OUTPUT ──────────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-5xl mx-auto px-6 space-y-16">
          <motion.div className="text-center space-y-3" {...headingReveal}>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">This is what Zane produces on every contract.</h2>
            <p className="text-gray-600 text-sm max-w-xl mx-auto">
              For every clause that deviates from your positions Zane gives you:
            </p>
          </motion.div>

          <div className="space-y-6">
            <motion.div
              className="grid sm:grid-cols-2 gap-3 max-w-3xl mx-auto"
              variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true }}
            >
              {[
                { label: "Risk status",              sub: "Red, Amber, or Green against your specific positions - not generic market standard" },
                { label: "Plain English explanation", sub: "What the clause actually says and why it matters commercially" },
                { label: "Exact fallback language",   sub: "The wording to send back, ready to paste" },
                { label: "Escalation routing",        sub: "Who needs to approve this, by name, based on your approval matrix" },
                { label: "Regulatory citation",       sub: "The specific provision that applies to your sector, with source and date" },
                { label: "Business explanation",      sub: "One paragraph safe to forward to your CFO or CEO without translation" },
              ].map(({ label, sub }) => (
                <motion.div key={label} className="rounded-xl bg-[#F2F1EE] border border-black/5 px-4 py-3.5 space-y-1" variants={staggerItem}>
                  <div className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <CheckCircle size={10} className="text-primary shrink-0" />
                    {label}
                  </div>
                  <div className="text-[11px] text-gray-500 leading-relaxed pl-4">{sub}</div>
                </motion.div>
              ))}
            </motion.div>

            <motion.p className="text-center text-sm font-medium text-gray-700 max-w-lg mx-auto" {...fadeUp(0.1)}>
              Not a memo. Not a summary. A decision with a routing instruction.
            </motion.p>

            <div className="max-w-sm mx-auto pt-4">
              <motion.p className="text-center text-xs text-gray-500 uppercase tracking-widest mb-6" {...fadeUp(0)}>
                What the report looks like
              </motion.p>
              <ProductPreview />
            </div>
          </div>
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
            <p className="text-white/70 font-medium">Here is how Zane actually improves over time.</p>
            <p>
              Every contract reviewed adds to your negotiation history. Every override your team makes - with the mandatory reason behind it - teaches Zane how your company actually makes decisions. Every outcome logged after a contract is signed closes the gap between your written playbook and your real risk tolerance. Every pattern detected across your portfolio surfaces insight no individual review would ever reveal.
            </p>
            <p>
              The intelligence compounds at the system level, not the model level. Your company's history, your GC's judgment, your sector's regulatory requirements - these become part of how Zane analyses the next contract. Not because an AI was retrained on your data. Because your data is structured, stored, and retrieved in a way that makes every future review more accurate than the last.
            </p>
            <p>
              This is also why the switching cost grows over time. After twelve months of using Zane you have something no other tool can give you. Your company's legal memory. Starting over means losing it.
            </p>
          </motion.div>
          <motion.div
            className="flex items-center justify-center gap-10 pt-4"
            variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true }}
          >
            {[
              { icon: CheckCircle,   color: "text-emerald-400", label: "Accept" },
              { icon: Zap,           color: "text-amber-400",   label: "Override" },
              { icon: AlertTriangle, color: "text-red-400",     label: "Escalate" },
            ].map(({ icon: Icon, color, label }) => (
              <motion.div key={label} className="flex flex-col items-center gap-2" variants={staggerItem}>
                <motion.div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: "#111A24" }}
                  whileHover={{ scale: 1.15 }}
                  transition={SPRING_SOFT}
                >
                  <Icon size={15} className={color} />
                </motion.div>
                <span className="text-xs text-white/30">{label}</span>
              </motion.div>
            ))}
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
              ["One-off AI answers",                               "Longitudinal risk intelligence"],
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

          {/* Competitor paragraphs */}
          <motion.div
            className="max-w-3xl mx-auto space-y-6 pt-4"
            variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}
          >
            {[
              {
                name: "Wordsmith",
                body: "Wordsmith is a capable product trusted by Deliveroo, Skyscanner, and Tide. It is built primarily as a workflow orchestration and legal request management layer for larger legal departments with dedicated legal ops teams. If you need internal intake management across a team of ten or more lawyers, Wordsmith is worth evaluating. If you are a solo GC or a small team who needs your specific negotiation history applied to every contract reviewed automatically, Zane is built for you.",
              },
              {
                name: "Claude for Legal",
                body: "Claude for Legal lives in Word and is genuinely useful for first-pass drafting and review. It does not know your red lines. It does not remember your decisions. Every session starts from zero. It is a powerful generic assistant. It is not a system that learns your company.",
              },
              {
                name: "Harvey",
                body: "Harvey charges five to six figures per year and is built for Magic Circle law firms. It is not relevant for a lean in-house team.",
              },
            ].map(({ name, body }) => (
              <motion.div key={name} className="space-y-1" variants={staggerItem}>
                <div className="text-xs font-bold text-gray-700">{name}</div>
                <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
              </motion.div>
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

      {/* ─── PRICING ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20 space-y-10">
        <motion.div className="text-center space-y-3" {...headingReveal}>
          <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">Pricing</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Transparent pricing. No surprises.</h2>
        </motion.div>

        <motion.div
          className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto"
          variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}
        >
          {[
            {
              tier: "Starter",
              price: "£500",
              period: "/month",
              highlight: true,
              description: "Solo GC or first in-house hire.",
              features: [
                "Full playbook engine",
                "Contract review",
                "Red / Amber / Green risk output",
                "Governance escalation routing",
                "Regulatory citations",
                "Outcome capture",
                "Includes one user seat",
              ],
              cta: "Get started",
              // Relative path — resolves to production domain automatically
              link: "/register",
              external: false,
            },
            {
              tier: "Team",
              price: "£900",
              period: "/month",
              highlight: false,
              description: "Up to five users.",
              features: [
                "Everything in Starter",
                "Portfolio dashboard",
                "Legal Inheritance bulk upload",
                "New hire onboarding briefings",
                "Negotiating pattern intelligence",
                "Contradiction detection across your contract library",
              ],
              cta: "Get started",
              // Relative path — resolves to production domain automatically
              link: "/register",
              external: false,
            },
            {
              tier: "Growth",
              price: "£1,500",
              period: "/month",
              highlight: false,
              description: "Unlimited users.",
              features: [
                "Everything in Team",
                "Advanced regulatory intelligence with live feeds",
                "Board-ready reporting",
                "Full audit trail for regulatory compliance",
                "Priority support",
              ],
              cta: "Book a demo",
              // TODO: replace with dedicated demo-booking URL (e.g. Calendly) before launch
              link: "mailto:hello@zanelegal.ai",
              external: true,
            },
          ].map(({ tier, price, period, highlight, description, features, cta, link, external }) => (
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
                  <span className="text-2xl font-bold text-gray-900">{price}</span>
                  <span className="text-xs text-gray-500">{period}</span>
                </div>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">{description}</p>
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
                  className={`block text-center px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    highlight ? "bg-primary text-white hover:opacity-90 shadow shadow-primary/20" : "border border-black/10 text-gray-600 hover:text-gray-800 hover:border-black/20"
                  }`}>
                  {cta} →
                </a>
              ) : (
                <Link to={link}
                  className={`block text-center px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    highlight ? "bg-primary text-white hover:opacity-90 shadow shadow-primary/20" : "border border-black/10 text-gray-600 hover:text-gray-800 hover:border-black/20"
                  }`}>
                  {cta} →
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
          All plans include 30-minute onboarding. No implementation fee. No minimum contract. Cancel anytime.
        </motion.p>
      </section>

      {/* ─── FINAL CTA ───────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
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
              <Link to="/register"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-gray-900 font-bold rounded-xl hover:opacity-95 transition-opacity shadow-xl text-sm">
                Book a 30 minute demo <ArrowRight size={15} />
              </Link>
            </motion.div>
            <p className="text-white/30 text-xs">
              Or email{" "}
              <a href="mailto:hello@zanelegal.ai" className="text-white/50 hover:text-white/70 transition-colors underline underline-offset-2">
                hello@zanelegal.ai
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
