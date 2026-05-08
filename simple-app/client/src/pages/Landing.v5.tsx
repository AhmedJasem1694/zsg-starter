import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle, AlertTriangle, Zap, BookOpen, Scale, TrendingUp, X, LayoutGrid } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";

// ─── Cycling phrases ──────────────────────────────────────────────────────────
const PHRASES = ["always on.", "always current.", "never wrong.", "built for you."];

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
        background: "linear-gradient(90deg, hsl(172 84% 32%), hsl(172 84% 45%))",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}
    >
      {PHRASES[index]}
    </span>
  );
}

// ─── Scroll reveal ────────────────────────────────────────────────────────────
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add("visible"); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

// ─── Product preview mock ─────────────────────────────────────────────────────
const MOCK_CLAUSES = [
  { label: "Limitation of Liability", status: "RED",   summary: "Cap below 3 months' fees - breaches red line" },
  { label: "Data & Privacy",          status: "RED",   summary: "No DPA in place - GDPR exposure" },
  { label: "Indemnity",               status: "AMBER", summary: "One-sided indemnity - negotiate scope" },
  { label: "Auto-Renewal",            status: "AMBER", summary: "No notice provision - push back" },
  { label: "Confidentiality",         status: "GREEN", summary: "Mutual 2-year - meets preferred position" },
  { label: "Governing Law",           status: "GREEN", summary: "English law - acceptable" },
];

function ClauseRow({ label, status, summary }: { label: string; status: string; summary: string }) {
  const config = {
    RED:   { dot: "bg-red-500",     badge: "bg-red-50 text-red-600 border-red-200",       text: "RED" },
    AMBER: { dot: "bg-amber-400",   badge: "bg-amber-50 text-amber-600 border-amber-200", text: "AMBER" },
    GREEN: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", text: "GREEN" },
  }[status] ?? { dot: "bg-slate-400", badge: "", text: "" };

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-black/5 last:border-0">
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-gray-800">{label}</div>
        <div className="text-[10px] text-gray-400 mt-0.5 truncate">{summary}</div>
      </div>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${config.badge} shrink-0`}>
        {config.text}
      </span>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-2xl scale-95 opacity-70" />
      <div className="relative rounded-2xl border border-black/8 shadow-xl overflow-hidden bg-white">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-black/6 bg-gray-50">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-[10px] text-gray-400">Acme Corp - Supplier MSA.pdf</span>
          </div>
        </div>
        <div className="px-4 py-3 border-b border-black/6 flex items-center gap-3 bg-gray-50/60">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-semibold text-gray-800">Overall: HIGH RISK</span>
          </div>
          <div className="ml-auto flex gap-2 text-[10px]">
            <span className="bg-red-50 text-red-600 border border-red-200 rounded px-1.5 py-0.5 font-semibold">2 RED</span>
            <span className="bg-amber-50 text-amber-600 border border-amber-200 rounded px-1.5 py-0.5 font-semibold">2 AMBER</span>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5 font-semibold">2 GREEN</span>
          </div>
        </div>
        <div className="px-4 py-1">
          {MOCK_CLAUSES.map((c) => <ClauseRow key={c.label} {...c} />)}
        </div>
        <div className="px-4 py-3 border-t border-black/6 bg-gray-50/60 flex items-center justify-between">
          <span className="text-[10px] text-gray-400">Reviewed in 1m 43s · UK GDPR flagged</span>
          <span className="text-[10px] text-primary font-medium">Do not sign yet →</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Landing() {
  const { user } = useAuth();
  const revealComparison = useScrollReveal();
  const revealKnowledge  = useScrollReveal();
  const revealHowItWorks = useScrollReveal();
  const revealWhoItsFor  = useScrollReveal();
  const revealRegulatory = useScrollReveal();
  const revealFeedback   = useScrollReveal();
  const revealPricing    = useScrollReveal();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* Nav — dark */}
      <header className="sticky top-0 z-20 border-b border-white/8 backdrop-blur-md" style={{ background: "hsl(220 25% 11% / 0.97)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shadow-md shadow-primary/20">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-white leading-none">MIKE</div>
              <div className="text-[9px] text-white/40 tracking-widest uppercase mt-0.5 hidden sm:block">Legal Decision Engine</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-xs text-white/50">
            <a href="#why-mike" className="hover:text-white transition-colors">Why MIKE</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <Link to="/case-study" className="hover:text-white transition-colors">Case study</Link>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard" className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow shadow-primary/20">
                Go to dashboard <ArrowRight size={13} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-4 py-1.5 text-sm text-white/60 hover:text-white transition-colors">Sign in</Link>
                <Link to="/register" className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow shadow-primary/20">
                  Get started <ArrowRight size={13} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── HERO — dark ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden flex flex-col justify-center" style={{ minHeight: "calc(100vh - 57px)", background: "hsl(220 25% 11%)" }}>
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(hsl(172 84% 50%) 1px, transparent 1px), linear-gradient(90deg, hsl(172 84% 50%) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
        {/* Teal glow from top */}
        <div className="absolute inset-0" style={{
          background: "radial-gradient(ellipse 70% 50% at 50% -10%, hsl(172 84% 40% / 0.18), transparent 65%)",
        }} />

        <div className="relative max-w-4xl mx-auto px-6 py-20 text-center space-y-7">
          {/* Jurisdiction pill */}
          <div className="hero-animate inline-flex items-center gap-2 border border-white/12 rounded-full px-4 py-1.5 text-xs text-white/55" style={{ animationDelay: "0ms", background: "hsl(220 25% 16%)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
            14 jurisdictions including UK · EU · UAE · US · KSA
          </div>

          {/* Headline */}
          <h1 className="hero-animate text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-white" style={{ animationDelay: "120ms" }}>
            Your knowledge lawyer,{" "}
            <br className="hidden sm:block" />
            <CyclingPhrase />
          </h1>

          {/* Description */}
          <p className="hero-animate text-lg sm:text-xl text-white/55 leading-relaxed max-w-2xl mx-auto" style={{ animationDelay: "260ms" }}>
            MIKE reviews contracts against your playbook, your regulatory obligations, and your history - and tells you exactly where to push back before you sign.
          </p>

          {/* Dismissal line */}
          <p className="hero-animate text-xs text-white/35 tracking-wide" style={{ animationDelay: "360ms" }}>
            Not a chatbot. Not a contract summariser. Not a CLM. A decision engine that gets smarter with every contract processed.
          </p>

          {/* CTA */}
          <div className="hero-animate flex flex-col sm:flex-row items-center justify-center gap-3 pt-2" style={{ animationDelay: "460ms" }}>
            {user ? (
              <Link to="/dashboard" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 text-sm">
                Go to dashboard <ArrowRight size={15} />
              </Link>
            ) : (
              <>
                <Link to="/register" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 text-sm">
                  Get started free <ArrowRight size={15} />
                </Link>
                <Link to="/login" className="inline-flex items-center justify-center px-6 py-3.5 border border-white/15 text-white/60 hover:text-white hover:border-white/30 rounded-xl transition-colors text-sm">
                  Sign in
                </Link>
              </>
            )}
          </div>

          {/* Stats strip */}
          <div className="hero-animate pt-4 grid grid-cols-4 gap-4 max-w-lg mx-auto border-t border-white/8 mt-4" style={{ animationDelay: "560ms" }}>
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
          </div>

          {/* Scroll hint */}
          <div className="hero-animate pt-4 flex flex-col items-center gap-1.5 opacity-25" style={{ animationDelay: "700ms" }}>
            <div className="w-px h-6 bg-white/40 rounded-full" />
            <span className="text-[10px] text-white/50 tracking-widest uppercase">scroll</span>
          </div>
        </div>
      </section>

      {/* ─── COMPARISON ──────────────────────────────────────────────────────── */}
      <section id="why-mike" ref={revealComparison} className="scroll-reveal py-20 bg-gray-50 border-t border-black/5">
        <div className="max-w-5xl mx-auto px-6 space-y-10">
          <div className="text-center space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Generic AI reviews documents.<br />
              <span style={{ background: "linear-gradient(90deg, hsl(172 84% 32%), hsl(172 84% 45%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                MIKE knows your company.
              </span>
            </h2>
            <p className="text-gray-500 text-sm max-w-xl mx-auto">
              Harvey, Legora, Microsoft Legal Agent - every platform now has an AI that can redline a contract. Ask all of them the same question.
            </p>
            <div className="inline-flex items-center gap-3 rounded-xl border border-primary/15 px-5 py-3 bg-white">
              <span className="text-sm text-gray-500">Do they know your red lines?</span>
              <span className="text-sm font-bold text-gray-500">No.</span>
              <span className="text-sm font-bold text-primary">MIKE does.</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {/* Generic AI */}
            <div className="rounded-2xl p-6 space-y-4 bg-white border border-black/6">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Generic AI contract tools</div>
              <div className="space-y-3">
                {[
                  "Reviews the document in front of it",
                  "Applies generic market standards",
                  "No knowledge of your red lines",
                  "No regulatory context for your sector",
                  "No memory of what you signed before",
                  "No escalation routing",
                  "No business-facing explanation",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-sm text-gray-400">
                    <X size={12} className="text-gray-300 shrink-0 mt-0.5" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* MIKE */}
            <div className="rounded-2xl p-6 space-y-4 ring-1 ring-primary/25 bg-white">
              <div className="text-xs font-bold text-primary tracking-widest uppercase">MIKE</div>
              <div className="space-y-3">
                {[
                  "Reviews against your exact playbook positions",
                  "Applies your preferred clauses, not market average",
                  "Knows your fallbacks and hard red lines",
                  "Cross-references live regulatory obligations",
                  "Learns from every accepted, edited, or escalated clause",
                  "Routes to the right approver automatically",
                  "Produces plain-English output for non-lawyers",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <CheckCircle size={12} className="text-primary shrink-0 mt-0.5" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── KNOWLEDGE LAWYER ────────────────────────────────────────────────── */}
      <section ref={revealKnowledge} className="scroll-reveal py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="rounded-2xl overflow-hidden bg-gray-50 border border-black/5">
            <div className="grid lg:grid-cols-2 gap-0">
              <div className="p-10 space-y-5 border-b lg:border-b-0 lg:border-r border-black/5 flex flex-col justify-center">
                <div className="text-xs font-bold text-primary tracking-widest uppercase">The knowledge lawyer</div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight leading-snug">
                  The intelligence layer<br />your team never had
                </h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  A knowledge lawyer at a City firm charges £300-500/hour to apply regulatory intelligence to every clause. MIKE is that function - permanently on, always current, at a fraction of the cost.
                </p>
                <Link to="/register" className="inline-flex items-center gap-1.5 text-sm text-primary hover:opacity-80 transition-opacity font-medium self-start">
                  Start free <ArrowRight size={13} />
                </Link>
              </div>
              <div className="p-10 space-y-6">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">What that means in practice</div>
                <div className="space-y-6">
                  {[
                    { icon: BookOpen,   title: "Knows your positions",  body: "Your preferred clauses, fallbacks, and hard red lines - applied consistently to every contract." },
                    { icon: Scale,      title: "Knows the law",         body: "Current regulatory obligations by sector and jurisdiction - UK GDPR, FCA Consumer Duty, KSA GCAM, and more." },
                    { icon: TrendingUp, title: "Knows your history",    body: "What you signed, what you pushed back on, what got escalated. Every decision sharpens MIKE's output." },
                  ].map(({ icon: Icon, title, body }) => (
                    <div key={title} className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white border border-black/6 flex items-center justify-center shrink-0">
                        <Icon size={14} className="text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{title}</div>
                        <div className="text-xs text-gray-500 mt-1 leading-relaxed">{body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATS ───────────────────────────────────────────────────────────── */}
      <div className="border-y border-black/5 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { value: "50+",     label: "Clause types analysed" },
            { value: "14",      label: "Jurisdictions covered" },
            { value: "minutes", label: "Not hours" },
            { value: "100%",    label: "Playbook-calibrated" },
          ].map(({ value, label }) => (
            <div key={label} className="text-center space-y-1">
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-400">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section id="how-it-works" ref={revealHowItWorks} className="scroll-reveal py-20">
        <div className="max-w-5xl mx-auto px-6 space-y-16">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">From upload to risk report in minutes</h2>
          </div>
          <div className="relative grid sm:grid-cols-3 gap-10">
            <div className="hidden sm:block absolute top-5 left-[calc(33%+1rem)] right-[calc(33%+1rem)] h-px bg-black/8" />
            {[
              { n: "01", title: "Set your playbook",    body: "Define your positions and red lines once. MIKE pre-fills sensible defaults for your sector." },
              { n: "02", title: "Upload the contract",  body: "Drop in a PDF or DOCX. MIKE maps every clause against your playbook and live regulatory obligations." },
              { n: "03", title: "Get your verdict",     body: "Red, Amber, Green per clause. Fallback language. Escalation triggers. Ready in minutes." },
            ].map(({ n, title, body }) => (
              <div key={n} className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-mono text-primary shrink-0">
                  {n}
                </div>
                <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
          <div className="space-y-6">
            <p className="text-center text-xs text-gray-400 uppercase tracking-widest">What the report looks like</p>
            <div className="max-w-sm mx-auto">
              <ProductPreview />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto pt-2">
              {[
                { label: "Clause verdict",   sub: "RED / AMBER / GREEN" },
                { label: "Why it matters",   sub: "Plain English, not legalese" },
                { label: "Fallback wording", sub: "Ready to paste in" },
                { label: "Who approves",     sub: "Routed automatically" },
              ].map(({ label, sub }) => (
                <div key={label} className="rounded-xl bg-gray-50 border border-black/5 px-4 py-3 text-center space-y-1">
                  <div className="text-xs font-semibold text-gray-700">{label}</div>
                  <div className="text-[10px] text-gray-400">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── WHO IT'S FOR ────────────────────────────────────────────────────── */}
      <section ref={revealWhoItsFor} className="scroll-reveal py-20 bg-gray-50 border-y border-black/5">
        <div className="max-w-6xl mx-auto px-6 space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Built for every side of the deal</h2>
            <p className="text-gray-500 text-sm max-w-xl mx-auto">Legal intelligence shouldn't be a luxury. MIKE levels the playing field.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {[
              {
                who: "In-house legal teams",
                bullets: [
                  "Review counterparty paper against your exact positions",
                  "Fallback language ready to paste into your redline",
                  "Escalation routing to the right approver, automatically",
                  "Legal Inheritance - bulk upload your existing contract library and surface hidden risk across your whole portfolio",
                ],
                link: null,
              },
              {
                who: "Founders & growing companies",
                bullets: [
                  "From your first supplier agreement to Series B term sheet",
                  "Understand your exposure before you sign, not after",
                  "Investor document review - liquidation preference, anti-dilution, drag-along",
                ],
                link: { label: "Read the case study", to: "/case-study" },
              },
            ].map(({ who, bullets, link }) => (
              <div key={who} className="rounded-2xl p-6 space-y-4 flex flex-col bg-white border border-black/6">
                <div className="text-xs font-bold text-primary tracking-widest uppercase">{who}</div>
                <ul className="space-y-2 flex-1">
                  {bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle size={12} className="text-primary mt-0.5 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
                {link && (
                  <Link to={link.to} className="inline-flex items-center gap-1 text-xs text-primary hover:opacity-80 transition-opacity font-medium mt-1">
                    {link.label} <ArrowRight size={11} />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── REGULATORY — kept dark for drama ────────────────────────────────── */}
      <section ref={revealRegulatory} className="scroll-reveal py-20" style={{ background: "hsl(220 25% 12%)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="rounded-2xl overflow-hidden" style={{ background: "hsl(220 25% 15%)" }}>
            <div className="grid lg:grid-cols-2 gap-0">
              <div className="p-10 space-y-5">
                <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">Regulatory intelligence</div>
                <h2 className="text-2xl font-bold text-white tracking-tight leading-snug">
                  A knowledge lawyer reads<br />new guidance the day it drops
                </h2>
                <p className="text-sm text-white/50 leading-relaxed">
                  Hardcoded regulatory context is a liability the moment something changes. For a regulated business, that's not a minor gap - it's a trust-destroying one.
                </p>
                <p className="text-sm text-white/50 leading-relaxed">
                  Every contract review is cross-referenced against the regulatory frameworks that apply to your sector and jurisdiction. GDPR, FCA Consumer Duty, KSA GCAM, and more - automatically.
                </p>
                <a href="#how-it-works" className="inline-flex items-center gap-1.5 text-sm text-primary hover:opacity-80 transition-opacity font-medium">
                  See how it works <ArrowRight size={13} />
                </a>
              </div>
              <div className="border-l border-white/8 p-10 flex flex-col justify-center gap-3">
                {[
                  { flag: "🇬🇧", label: "United Kingdom",  regs: "FCA Consumer Duty · UK GDPR · ICO · Bribery Act" },
                  { flag: "🇪🇺", label: "European Union",  regs: "GDPR · EU AI Act · DORA · NIS2" },
                  { flag: "🇺🇸", label: "United States",   regs: "CCPA · HIPAA · SOX · NY SHIELD · NYDFS" },
                  { flag: "🇸🇦", label: "Saudi Arabia",    regs: "GCAM · PDPL · GEA · Vision 2030 compliance" },
                  { flag: "🇰🇷", label: "South Korea",     regs: "Game Industry Act · PIPA · Loot box disclosure" },
                  { flag: "🇨🇦", label: "Canada",          regs: "PIPEDA · Bill C-27 · CASL · Competition Act" },
                ].map(({ flag, label, regs }) => (
                  <div key={label} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                    <span className="text-lg">{flag}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white/70">{label}</div>
                      <div className="text-[10px] text-white/30 mt-0.5 truncate">{regs}</div>
                    </div>
                    <CheckCircle size={12} className="text-primary ml-auto shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEEDBACK LOOP ───────────────────────────────────────────────────── */}
      <section ref={revealFeedback} className="scroll-reveal py-20 border-b border-black/5">
        <div className="max-w-3xl mx-auto px-6 text-center space-y-6">
          <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">The feedback loop</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Every correction makes MIKE sharper
          </h2>
          <p className="text-gray-500 leading-relaxed">
            When your lawyer accepts, edits, or escalates a clause - MIKE learns. Over time it stops applying generic market standards and starts applying <em className="text-gray-800 not-italic font-medium">your</em> standards.
          </p>
          <div className="flex items-center justify-center gap-10 pt-4">
            {[
              { icon: CheckCircle,   color: "text-emerald-500", label: "Accept" },
              { icon: Zap,           color: "text-amber-500",   label: "Edit" },
              { icon: AlertTriangle, color: "text-red-500",     label: "Escalate" },
            ].map(({ icon: Icon, color, label }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Icon size={15} className={color} />
                </div>
                <span className="text-xs text-gray-400">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─────────────────────────────────────────────────────────── */}
      <section id="pricing" ref={revealPricing} className="scroll-reveal max-w-6xl mx-auto px-6 py-20 space-y-10">
        <div className="text-center space-y-3">
          <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">Pricing</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">A fraction of what a knowledge lawyer costs</h2>
          <p className="text-gray-500 text-sm max-w-xl mx-auto">Start free. Upgrade when the value is obvious.</p>
        </div>

        {/* Core free tier */}
        <div className="max-w-4xl mx-auto rounded-xl border border-black/8 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-gray-50">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-800">MIKE Core</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-emerald-600 bg-emerald-50 border-emerald-200">Free · Open source</span>
            </div>
            <p className="text-xs text-gray-400 max-w-lg">
              Self-hostable. Document upload and parsing, basic clause extraction, generic output renderer. No company context, no playbook, no regulatory layer.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              {["Document upload & parsing", "Basic clause extraction", "Generic output renderer"].map((f) => (
                <span key={f} className="text-[10px] text-gray-400 flex items-center gap-1">
                  <CheckCircle size={9} className="text-gray-300" /> {f}
                </span>
              ))}
            </div>
          </div>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer"
            className="shrink-0 px-5 py-2.5 rounded-xl border border-black/10 text-xs font-semibold text-gray-500 hover:text-gray-800 hover:border-black/20 transition-all whitespace-nowrap">
            View on GitHub →
          </a>
        </div>

        <div className="flex items-center gap-4 max-w-4xl mx-auto">
          <div className="flex-1 h-px bg-black/6" />
          <span className="text-xs text-gray-400 whitespace-nowrap">Or start a 14-day free trial of managed MIKE</span>
          <div className="flex-1 h-px bg-black/6" />
        </div>

        <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            {
              tier: "MIKE Starter",
              price: "£300", period: "/month",
              trial: "14-day free trial",
              trialColor: "text-primary bg-primary/8 border-primary/20",
              features: ["30-minute playbook onboarding", "10 clause categories", "Red / Amber / Green output", "Fallback language per clause", "Escalation routing to named approvers", "One sector regulatory context", "Basic contract storage"],
              cta: "Start free trial", highlight: true,
            },
            {
              tier: "MIKE Professional",
              price: "£750", period: "/month",
              trial: "14-day free trial",
              trialColor: "text-gray-400 bg-gray-50 border-gray-200",
              features: ["Everything in Starter", "Live regulatory feeds with citations", "Contract memory and outcome capture", "Portfolio dashboard", "Legal Inheritance bulk upload", "Renewal calendar", "Cross-contract conflict detection"],
              cta: "Start free trial", highlight: false,
            },
            {
              tier: "MIKE Enterprise",
              price: "Custom", period: "pricing",
              trial: "Book an intro call",
              trialColor: "text-gray-400 bg-gray-50 border-gray-200",
              features: ["Everything in Professional", "Investment document review", "Term sheet and cap table analysis", "Multi-jurisdiction simultaneous analysis", "SSO and enterprise security", "API access", "Custom regulatory modules"],
              cta: "Book an intro", highlight: false,
            },
          ].map(({ tier, price, period, trial, trialColor, features, cta, highlight }) => (
            <div key={tier} className={`rounded-xl border p-6 space-y-5 ${highlight ? "border-primary/25 shadow-sm shadow-primary/10" : "border-black/8"} bg-white`}>
              <div>
                <div className="text-xs text-gray-400 font-medium mb-1">{tier}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900">{price}</span>
                  <span className="text-xs text-gray-400">{period}</span>
                </div>
                <span className={`inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${trialColor}`}>{trial}</span>
              </div>
              <ul className="space-y-2">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-gray-500">
                    <CheckCircle size={11} className={highlight ? "text-primary" : "text-gray-300"} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to={user ? "/dashboard" : "/register"}
                className={`block text-center px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  highlight
                    ? "bg-primary text-white hover:opacity-90 shadow shadow-primary/20"
                    : "border border-black/10 text-gray-500 hover:text-gray-800 hover:border-black/20"
                }`}>
                {user && highlight ? "Go to dashboard" : cta} →
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 max-w-lg mx-auto">
          No credit card required during the trial. £300/month is typically a credit card decision for a senior in-house lawyer - one contract saved usually covers the annual cost.
        </p>
      </section>

      {/* ─── FINAL CTA ───────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="relative rounded-2xl overflow-hidden p-12 text-center space-y-6" style={{ background: "hsl(172 25% 12%)" }}>
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
            {user ? (
              <Link to="/dashboard" className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-gray-900 font-bold rounded-xl hover:opacity-95 transition-opacity shadow-xl text-sm">
                Go to dashboard <ArrowRight size={15} />
              </Link>
            ) : (
              <Link to="/register" className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-gray-900 font-bold rounded-xl hover:opacity-95 transition-opacity shadow-xl text-sm">
                Get started free <ArrowRight size={15} />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/6 mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
              <span className="text-white text-[9px] font-bold">M</span>
            </div>
            <span className="text-xs text-gray-400">MIKE - Legal Intelligence</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-400">
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
