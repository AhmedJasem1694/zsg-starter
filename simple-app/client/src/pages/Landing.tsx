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

// ─── Animated product preview ─────────────────────────────────────────────────
const MOCK_CLAUSES = [
  { label: "Limitation of Liability", status: "RED",   summary: "Cap below 3 months' fees — breaches red line" },
  { label: "Data & Privacy",          status: "RED",   summary: "No DPA in place — GDPR exposure" },
  { label: "Indemnity",               status: "AMBER", summary: "One-sided indemnity — negotiate scope" },
  { label: "Auto-Renewal",            status: "AMBER", summary: "No notice provision — push back" },
  { label: "Confidentiality",         status: "GREEN", summary: "Mutual 2-year — meets preferred position" },
  { label: "Governing Law",           status: "GREEN", summary: "English law — acceptable" },
];

function ProductPreview() {
  const clauseDelays = [0.6, 1.1, 1.6, 2.1, 2.6, 3.1];

  return (
    <motion.div
      className="relative w-full max-w-sm mx-auto"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ ...SPRING_SNAP, delay: 0.2 }}
    >
      <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-2xl scale-95 opacity-70" />
      <div className="relative rounded-2xl border border-black/8 shadow-xl overflow-hidden bg-[#F2F1EE]">
        {/* Title bar */}
        <motion.div
          className="flex items-center gap-2 px-4 py-3 border-b border-black/6 bg-[#EEECEA]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.4 }}
        >
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-[10px] text-gray-500">Acme Corp — Supplier MSA.pdf</span>
          </div>
        </motion.div>

        {/* Risk bar */}
        <motion.div
          className="px-4 py-3 border-b border-black/6 flex items-center gap-3 bg-[#EEECEA]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45, duration: 0.4 }}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-semibold text-gray-800">Overall: HIGH RISK</span>
          </div>
          <div className="ml-auto flex gap-2 text-[10px]">
            <span className="bg-red-50 text-red-600 border border-red-200 rounded px-1.5 py-0.5 font-semibold">2 RED</span>
            <span className="bg-amber-50 text-amber-600 border border-amber-200 rounded px-1.5 py-0.5 font-semibold">2 AMBER</span>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5 font-semibold">2 GREEN</span>
          </div>
        </motion.div>

        {/* Clause rows — stagger in like chat bubbles */}
        <div className="px-4 py-1">
          {MOCK_CLAUSES.map((c, i) => {
            const cfg = {
              RED:   { dot: "bg-red-500",     badge: "bg-red-50 text-red-600 border-red-200",       text: "RED" },
              AMBER: { dot: "bg-amber-400",   badge: "bg-amber-50 text-amber-600 border-amber-200", text: "AMBER" },
              GREEN: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", text: "GREEN" },
            }[c.status] ?? { dot: "bg-slate-400", badge: "", text: "" };
            return (
              <motion.div
                key={c.label}
                className="flex items-center gap-3 py-2.5 border-b border-black/5 last:border-0"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.5, delay: clauseDelays[i] }}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-800">{c.label}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5 truncate">{c.summary}</div>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cfg.badge} shrink-0`}>
                  {cfg.text}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Footer */}
        <motion.div
          className="px-4 py-3 border-t border-black/6 bg-[#EEECEA] flex items-center justify-between"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.6, duration: 0.4 }}
        >
          <span className="text-[10px] text-gray-500">Reviewed in 1m 43s · UK GDPR flagged</span>
          <span className="text-[10px] text-primary font-medium">Do not sign yet →</span>
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
          <ZaneLogo size="sm" light={true} />
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

      {/* ─── HERO — dark ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden flex flex-col justify-center" style={{ minHeight: "calc(100vh - 57px)", background: "#0B1118" }}>
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

        <div className="relative max-w-4xl mx-auto px-6 py-10 text-center space-y-5">

          {/* Pill */}
          <motion.div
            className="inline-flex items-center gap-2 border border-white/12 rounded-full px-4 py-1.5 text-xs text-white/55"
            style={{ background: "#111A24" }}
            {...(shouldReduce ? {} : fadeUpHero(0.1))}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
            14 jurisdictions including UK · EU · UAE · US · KSA
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-white"
            {...(shouldReduce ? {} : fadeUpHero(0.25))}
          >
            Legal risk, made{" "}
            <br className="hidden sm:block" />
            decision-ready.
          </motion.h1>

          {/* Cycling phrase */}
          <motion.div
            className="text-xl sm:text-2xl font-semibold text-white/70 h-8"
            {...(shouldReduce ? {} : fadeUpHero(0.38))}
          >
            <CyclingPhrase />
          </motion.div>

          {/* Description */}
          <motion.p
            className="text-lg sm:text-xl text-white/55 leading-relaxed max-w-2xl mx-auto"
            {...(shouldReduce ? {} : fadeUpHero(0.52))}
          >
            Zane reviews contracts against your playbook, your regulatory obligations, and your history.
            It delivers a decision, not a summary. Know exactly where to push back before you sign.
          </motion.p>

          {/* Dismissal */}
          <motion.p
            className="text-xs text-white/30 tracking-wide"
            {...(shouldReduce ? {} : fadeUpHero(0.64))}
          >
            Not a chatbot. Not a contract summariser. Not a CLM. A legal intelligence layer.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2"
            {...(shouldReduce ? {} : fadeUpHero(0.76))}
          >
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link to="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 text-sm">
                Get started free <ArrowRight size={15} />
              </Link>
            </motion.div>
            <Link to="/login"
              className="inline-flex items-center justify-center px-6 py-3.5 border border-white/15 text-white/60 hover:text-white hover:border-white/30 rounded-xl transition-colors text-sm">
              Sign in
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="pt-2 grid grid-cols-4 gap-4 max-w-lg mx-auto border-t border-white/8 mt-2"
            {...(shouldReduce ? {} : fadeUpHero(0.88))}
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
            className="pt-2 flex flex-col items-center gap-1.5 opacity-25"
            {...(shouldReduce ? {} : fadeUpHero(1.05))}
          >
            <div className="w-px h-6 bg-white/40 rounded-full" />
            <span className="text-[10px] text-white/50 tracking-widest uppercase">scroll</span>
          </motion.div>
        </div>
      </section>

      {/* ─── COMPARISON ──────────────────────────────────────────────────────── */}
      <section id="why-zane" className="py-20 bg-[#F7F6F3] border-t border-black/5">
        <div className="max-w-5xl mx-auto px-6 space-y-10">
          <motion.div className="text-center space-y-4" {...headingReveal}>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Generic AI reviews documents.<br />
              <span style={{ background: "linear-gradient(90deg, #4A6CF7, #7B9BFA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Zane knows your company.
              </span>
            </h2>
            <p className="text-gray-600 text-sm max-w-xl mx-auto">
              Harvey, Legora, Microsoft Legal Agent. Every platform now has an AI that summarises contracts. Ask all of them the same question.
            </p>
            <div className="inline-flex items-center gap-3 rounded-xl border border-primary/15 px-5 py-3 bg-[#F2F1EE]">
              <span className="text-sm text-gray-600">Do they know your red lines?</span>
              <span className="text-sm font-bold text-gray-600">No.</span>
              <span className="text-sm font-bold text-primary">Zane does.</span>
            </div>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {/* Generic — slides in from left */}
            <motion.div
              className="rounded-2xl p-6 space-y-4 bg-[#F2F1EE] border border-black/6"
              {...slideLeft(0)}
            >
              <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Generic AI contract tools</div>
              <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true }}>
                {[
                  "Reviews the document in front of it",
                  "Applies generic market standards",
                  "No knowledge of your red lines",
                  "No regulatory context for your sector",
                  "No memory of what you signed before",
                  "No escalation routing",
                  "No business-facing explanation",
                ].map((item) => (
                  <motion.div key={item} className="flex items-start gap-2.5 text-sm text-gray-500" variants={staggerItem}>
                    <X size={12} className="text-gray-300 shrink-0 mt-0.5" />
                    {item}
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>

            {/* Zane — slides in from right */}
            <motion.div
              className="rounded-2xl p-6 space-y-4 ring-1 ring-primary/25 bg-[#F2F1EE]"
              {...slideRight(0.15)}
            >
              <div className="text-xs font-bold text-primary tracking-widest uppercase">Zane</div>
              <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true }}>
                {[
                  "Reviews against your exact playbook positions",
                  "Applies your preferred clauses, not market average",
                  "Knows your fallbacks and hard red lines",
                  "Cross-references live regulatory obligations",
                  "Learns from every accepted, edited, or escalated clause",
                  "Routes to the right approver automatically",
                  "Produces plain-English output for non-lawyers",
                ].map((item) => (
                  <motion.div key={item} className="flex items-start gap-2.5 text-sm text-gray-700" variants={staggerItem}>
                    <CheckCircle size={12} className="text-primary shrink-0 mt-0.5" />
                    {item}
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── KNOWLEDGE LAWYER ────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="rounded-2xl overflow-hidden bg-[#F2F1EE] border border-black/5">
            <div className="grid lg:grid-cols-2 gap-0">
              <motion.div className="p-10 space-y-5 border-b lg:border-b-0 lg:border-r border-black/5 flex flex-col justify-center" {...slideLeft(0)}>
                <div className="text-xs font-bold text-primary tracking-widest uppercase">The knowledge lawyer</div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight leading-snug">
                  The intelligence layer<br />your team never had
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  A knowledge lawyer at a City firm charges £300–500/hour to apply regulatory intelligence to every clause. Zane is that function — permanently on, always current, at a fraction of the cost.
                </p>
                <Link to="/register" className="inline-flex items-center gap-1.5 text-sm text-primary hover:opacity-80 transition-opacity font-medium self-start">
                  Start free <ArrowRight size={13} />
                </Link>
              </motion.div>
              <motion.div className="p-10 space-y-6" {...slideRight(0.15)}>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">What that means in practice</div>
                <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true }}>
                  {[
                    { icon: BookOpen,   title: "Knows your positions",  body: "Your preferred clauses, fallbacks, and hard red lines — applied consistently to every contract." },
                    { icon: Scale,      title: "Knows the law",         body: "Current regulatory obligations by sector and jurisdiction — UK GDPR, FCA Consumer Duty, KSA GCAM, and more." },
                    { icon: TrendingUp, title: "Knows your history",    body: "What you signed, what you pushed back on, what got escalated. Every decision sharpens Zane's output." },
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

      {/* ─── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-5xl mx-auto px-6 space-y-16">
          <motion.div className="text-center" {...headingReveal}>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">From upload to risk report in minutes</h2>
          </motion.div>

          <motion.div
            className="relative grid sm:grid-cols-3 gap-10"
            variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}
          >
            <div className="hidden sm:block absolute top-5 left-[calc(33%+1rem)] right-[calc(33%+1rem)] h-px bg-black/8" />
            {[
              { n: "01", title: "Set your playbook",    body: "Define your positions and red lines once. Zane pre-fills sensible defaults for your sector." },
              { n: "02", title: "Upload the contract",  body: "Drop in a PDF or DOCX. Zane maps every clause against your playbook and live regulatory obligations." },
              { n: "03", title: "Get your verdict",     body: "Red, Amber, Green per clause. Fallback language. Escalation triggers. Ready in minutes." },
            ].map(({ n, title, body }) => (
              <motion.div key={n} className="space-y-3" variants={staggerItem}>
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-mono text-primary shrink-0">{n}</div>
                <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
              </motion.div>
            ))}
          </motion.div>

          <div className="space-y-6">
            <motion.p className="text-center text-xs text-gray-500 uppercase tracking-widest" {...fadeUp(0)}>
              What the report looks like
            </motion.p>
            <div className="max-w-sm mx-auto">
              <ProductPreview />
            </div>
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto pt-2"
              variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true }}
            >
              {[
                { label: "Clause verdict",   sub: "RED / AMBER / GREEN" },
                { label: "Why it matters",   sub: "Plain English, not legalese" },
                { label: "Fallback wording", sub: "Ready to paste in" },
                { label: "Who approves",     sub: "Routed automatically" },
              ].map(({ label, sub }) => (
                <motion.div key={label} className="rounded-xl bg-[#F2F1EE] border border-black/5 px-4 py-3 text-center space-y-1" variants={staggerItem}>
                  <div className="text-xs font-semibold text-gray-700">{label}</div>
                  <div className="text-[10px] text-gray-600">{sub}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── WHO IT'S FOR ────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#F7F6F3] border-y border-black/5">
        <div className="max-w-6xl mx-auto px-6 space-y-10">
          <motion.div className="text-center space-y-3" {...headingReveal}>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Built for every side of the deal</h2>
            <p className="text-gray-600 text-sm max-w-xl mx-auto">Legal intelligence shouldn't be a luxury. Zane levels the playing field.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {[
              {
                who: "In-house legal teams",
                delay: 0,
                dir: "left" as const,
                bullets: [
                  "Review counterparty paper against your exact positions",
                  "Fallback language ready to paste into your redline",
                  "Escalation routing to the right approver, automatically",
                  "Legal Inheritance — bulk upload your contract library and surface hidden risk",
                ],
                link: null,
              },
              {
                who: "Founders & growing companies",
                delay: 0.15,
                dir: "right" as const,
                bullets: [
                  "From your first supplier agreement to Series B term sheet",
                  "Understand your exposure before you sign, not after",
                  "Investor document review — liquidation preference, anti-dilution, drag-along",
                ],
                link: { label: "Read the case study", to: "/case-study" },
              },
            ].map(({ who, delay, dir, bullets, link }) => (
              <motion.div
                key={who}
                className="rounded-2xl p-6 space-y-4 flex flex-col bg-[#F2F1EE] border border-black/6"
                {...(dir === "left" ? slideLeft(delay) : slideRight(delay))}
              >
                <div className="text-xs font-bold text-primary tracking-widest uppercase">{who}</div>
                <motion.ul className="space-y-2 flex-1" variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true }}>
                  {bullets.map((b) => (
                    <motion.li key={b} className="flex items-start gap-2 text-sm text-gray-600" variants={staggerItem}>
                      <CheckCircle size={12} className="text-primary mt-0.5 shrink-0" />
                      {b}
                    </motion.li>
                  ))}
                </motion.ul>
                {link && (
                  <Link to={link.to} className="inline-flex items-center gap-1 text-xs text-primary hover:opacity-80 transition-opacity font-medium mt-1">
                    {link.label} <ArrowRight size={11} />
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── REGULATORY — dark ───────────────────────────────────────────────── */}
      <section className="py-20" style={{ background: "#0B1118" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="rounded-2xl overflow-hidden" style={{ background: "#111A24" }}>
            <div className="grid lg:grid-cols-2 gap-0">
              <motion.div className="p-10 space-y-5" {...slideLeft(0)}>
                <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">Regulatory intelligence</div>
                <h2 className="text-2xl font-bold text-white tracking-tight leading-snug">
                  A knowledge lawyer reads<br />new guidance the day it drops
                </h2>
                <p className="text-sm text-white/50 leading-relaxed">
                  Hardcoded regulatory context is a liability the moment something changes. For a regulated business, that's not a minor gap — it's a trust-destroying one.
                </p>
                <p className="text-sm text-white/50 leading-relaxed">
                  Every contract review is cross-referenced against the regulatory frameworks that apply to your sector and jurisdiction. GDPR, FCA Consumer Duty, KSA GCAM, and more — automatically.
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

      {/* ─── FEEDBACK LOOP ───────────────────────────────────────────────────── */}
      <section className="py-20 border-b border-black/5">
        <div className="max-w-3xl mx-auto px-6 text-center space-y-6">
          <motion.div {...headingReveal}>
            <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase mb-4">The feedback loop</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Every correction makes Zane sharper
            </h2>
          </motion.div>
          <motion.p className="text-gray-600 leading-relaxed" {...fadeUp(0.1)}>
            When your lawyer accepts, edits, or escalates a clause — Zane learns. Over time it stops applying generic market standards and starts applying{" "}
            <em className="text-gray-800 not-italic font-medium">your</em> standards.
          </motion.p>
          <motion.div
            className="flex items-center justify-center gap-10 pt-4"
            variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true }}
          >
            {[
              { icon: CheckCircle,   color: "text-emerald-500", label: "Accept" },
              { icon: Zap,           color: "text-amber-500",   label: "Edit" },
              { icon: AlertTriangle, color: "text-red-500",     label: "Escalate" },
            ].map(({ icon: Icon, color, label }) => (
              <motion.div key={label} className="flex flex-col items-center gap-2" variants={staggerItem}>
                <motion.div
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
                  whileHover={{ scale: 1.15, backgroundColor: "#e8ecff" }}
                  transition={SPRING_SOFT}
                >
                  <Icon size={15} className={color} />
                </motion.div>
                <span className="text-xs text-gray-500">{label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── PRICING ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20 space-y-10">
        <motion.div className="text-center space-y-3" {...headingReveal}>
          <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">Pricing</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">A fraction of what a knowledge lawyer costs</h2>
          <p className="text-gray-600 text-sm max-w-xl mx-auto">Start free. Upgrade when the value is obvious.</p>
        </motion.div>

        <motion.div
          className="max-w-4xl mx-auto rounded-xl border border-black/8 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-[#F2F1EE]"
          {...fadeUp(0)}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-800">Zane Core</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-emerald-600 bg-emerald-50 border-emerald-200">Free · Open source</span>
            </div>
            <p className="text-xs text-gray-500 max-w-lg">
              Self-hostable. Document upload and parsing, basic clause extraction, generic output renderer. No company context, no playbook, no regulatory layer.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              {["Document upload & parsing", "Basic clause extraction", "Generic output renderer"].map((f) => (
                <span key={f} className="text-[10px] text-gray-500 flex items-center gap-1">
                  <CheckCircle size={9} className="text-gray-300" /> {f}
                </span>
              ))}
            </div>
          </div>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer"
            className="shrink-0 px-5 py-2.5 rounded-xl border border-black/10 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:border-black/20 transition-all whitespace-nowrap">
            View on GitHub →
          </a>
        </motion.div>

        <div className="flex items-center gap-4 max-w-4xl mx-auto">
          <div className="flex-1 h-px bg-black/6" />
          <span className="text-xs text-gray-500 whitespace-nowrap">Or start a 14-day free trial of managed Zane</span>
          <div className="flex-1 h-px bg-black/6" />
        </div>

        <motion.div
          className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto"
          variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}
        >
          {[
            {
              tier: "Zane Starter",   price: "£300", period: "/month", trial: "14-day free trial",
              trialColor: "text-primary bg-primary/8 border-primary/20", highlight: true,
              features: ["30-minute playbook onboarding","10 clause categories","Red / Amber / Green output","Fallback language per clause","Escalation routing to named approvers","One sector regulatory context","Basic contract storage"],
              cta: "Start free trial",
            },
            {
              tier: "Zane Professional", price: "£750", period: "/month", trial: "14-day free trial",
              trialColor: "text-gray-600 bg-[#EEECEA] border-black/10", highlight: false,
              features: ["Everything in Starter","Live regulatory feeds with citations","Contract memory and outcome capture","Portfolio dashboard","Legal Inheritance bulk upload","Renewal calendar","Cross-contract conflict detection"],
              cta: "Start free trial",
            },
            {
              tier: "Zane Enterprise", price: "Custom", period: "pricing", trial: "Book an intro call",
              trialColor: "text-gray-600 bg-[#EEECEA] border-black/10", highlight: false,
              features: ["Everything in Professional","Investment document review","Term sheet and cap table analysis","Multi-jurisdiction simultaneous analysis","SSO and enterprise security","API access","Custom regulatory modules"],
              cta: "Book an intro",
            },
          ].map(({ tier, price, period, trial, trialColor, features, cta, highlight }) => (
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
                <span className={`inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${trialColor}`}>{trial}</span>
              </div>
              <ul className="space-y-2">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                    <CheckCircle size={11} className={highlight ? "text-primary" : "text-gray-300"} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/register"
                className={`block text-center px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  highlight ? "bg-primary text-white hover:opacity-90 shadow shadow-primary/20" : "border border-black/10 text-gray-600 hover:text-gray-800 hover:border-black/20"
                }`}>
                {cta} →
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <motion.p className="text-center text-xs text-gray-500 max-w-lg mx-auto" {...fadeUp(0.1)}>
          No credit card required during the trial. £300/month is typically a credit card decision — one contract saved usually covers the annual cost.
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
              Your first contract review is waiting
            </h2>
            <p className="text-white/60 text-sm max-w-md mx-auto">
              Upload a contract. Get a structured risk report with regulatory citations, fallback language, and escalation triggers.
            </p>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link to="/register"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-gray-900 font-bold rounded-xl hover:opacity-95 transition-opacity shadow-xl text-sm">
                Get started free <ArrowRight size={15} />
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-black/6 mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <ZaneLogo size="sm" light={false} />
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
