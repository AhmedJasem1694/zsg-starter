import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle, AlertTriangle, Minus, Zap, BookOpen, Scale, TrendingUp } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const BG   = "hsl(220 20% 9%)";
const CARD = "hsl(220 20% 13%)";
const CARD2 = "hsl(220 20% 16%)";
const ALT  = "hsl(220 20% 11%)";

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
    RED:   { dot: "bg-red-500",     badge: "bg-red-500/10 text-red-400 border-red-500/20",       text: "RED" },
    AMBER: { dot: "bg-amber-400",   badge: "bg-amber-400/10 text-amber-300 border-amber-400/20", text: "AMBER" },
    GREEN: { dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", text: "GREEN" },
  }[status] ?? { dot: "bg-slate-500", badge: "", text: "" };

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-white">{label}</div>
        <div className="text-[10px] text-white/50 mt-0.5 truncate">{summary}</div>
      </div>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${config.badge} shrink-0`}>
        {config.text}
      </span>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="relative w-full max-w-sm mx-auto lg:mx-0">
      <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-2xl scale-95 opacity-60" />
      <div className="relative rounded-2xl border border-white/10 shadow-2xl overflow-hidden" style={{ background: CARD }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-[10px] text-white/40">Acme Corp - Supplier MSA.pdf</span>
          </div>
        </div>
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-semibold text-white">Overall: HIGH RISK</span>
          </div>
          <div className="ml-auto flex gap-2 text-[10px]">
            <span className="bg-red-500/15 text-red-400 border border-red-500/20 rounded px-1.5 py-0.5 font-semibold">2 RED</span>
            <span className="bg-amber-400/15 text-amber-300 border border-amber-400/20 rounded px-1.5 py-0.5 font-semibold">2 AMBER</span>
            <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5 font-semibold">2 GREEN</span>
          </div>
        </div>
        <div className="px-4 py-1">
          {MOCK_CLAUSES.map((c) => <ClauseRow key={c.label} {...c} />)}
        </div>
        <div className="px-4 py-3 border-t border-white/10 bg-white/[0.03] flex items-center justify-between">
          <span className="text-[10px] text-white/40">Reviewed in 1m 43s · UK GDPR flagged</span>
          <span className="text-[10px] text-primary font-medium">Do not sign yet →</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG }}>

      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-white/8 backdrop-blur-md" style={{ background: `${BG}dd` }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="text-sm font-semibold text-white">MIKE</span>
            <span className="text-[10px] text-white ml-1 tracking-widest uppercase hidden sm:block">Legal Intelligence</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-xs text-white">
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#why-mike" className="hover:text-white transition-colors">Why MIKE</a>
            <Link to="/case-study" className="hover:text-white transition-colors">Case study</Link>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard" className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-lg shadow-primary/25">
                Go to dashboard <ArrowRight size={13} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-4 py-1.5 text-sm text-white/70 hover:text-white transition-colors">Sign in</Link>
                <Link to="/register" className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-lg shadow-primary/25">
                  Get started <ArrowRight size={13} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: "linear-gradient(hsl(172 84% 30%) 1px, transparent 1px), linear-gradient(90deg, hsl(172 84% 30%) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
        <div className="absolute inset-0" style={{
          background: "radial-gradient(ellipse 80% 60% at 50% -10%, hsl(172 84% 20% / 0.25), transparent 70%)",
        }} />

        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 border border-white/10 rounded-full px-3 py-1 text-xs text-white/60 bg-white/5 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                UK · EU · US · India · Brazil · Singapore · +9 more
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] text-white">
                Your knowledge lawyer,{" "}
                <span style={{ background: "linear-gradient(90deg, hsl(172 84% 45%), hsl(172 84% 65%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  always on.
                </span>
              </h1>

              <p className="text-lg text-white/70 leading-relaxed max-w-lg">
                MIKE reviews contracts against your playbook, your regulatory obligations, and your history - and tells you exactly where to push back before you sign.
              </p>
              <p className="text-xs text-white/35 tracking-wide">
                Not a chatbot. Not a contract summariser. Not a CLM. A decision engine that gets smarter with every contract processed.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                {user ? (
                  <Link to="/dashboard" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-xl shadow-primary/30 text-sm">
                    Go to dashboard
                    <ArrowRight size={15} />
                  </Link>
                ) : (
                  <>
                    <Link to="/register" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-xl shadow-primary/30 text-sm">
                      Get started
                      <ArrowRight size={15} />
                    </Link>
                    <Link to="/login" className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-white/10 text-white/70 hover:text-white hover:border-white/20 rounded-xl transition-colors text-sm">
                      Sign in
                    </Link>
                  </>
                )}
              </div>
            </div>

            <ProductPreview />
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="border-y border-white/8" style={{ background: ALT }}>
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { value: "50+",  label: "Clause types analysed" },
            { value: "14",   label: "Jurisdictions covered" },
            { value: "~2m",  label: "Per contract review" },
            { value: "100%", label: "Playbook-calibrated" },
          ].map(({ value, label }) => (
            <div key={label} className="text-center space-y-1">
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-white/50">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge lawyer - trimmed */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: CARD }}>
          <div className="grid lg:grid-cols-2 gap-0">
            <div className="p-10 space-y-4 border-b lg:border-b-0 lg:border-r border-white/8 flex flex-col justify-center">
              <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">The knowledge lawyer</div>
              <h2 className="text-2xl font-bold text-white tracking-tight leading-snug">
                The intelligence layer<br />your team never had
              </h2>
              <p className="text-sm text-white/70 leading-relaxed">
                A knowledge lawyer at a City firm charges £300-500/hour to apply regulatory intelligence to every clause. MIKE is that function - permanently on, always current, at a fraction of the cost.
              </p>
            </div>
            <div className="p-10 space-y-6">
              <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">What that means in practice</div>
              <div className="space-y-5">
                {[
                  { icon: BookOpen,   title: "Knows your positions",  body: "Your preferred clauses, fallbacks, and hard red lines - applied consistently to every contract." },
                  { icon: Scale,      title: "Knows the law",         body: "Current regulatory obligations by sector and jurisdiction - UK GDPR, FCA Consumer Duty, KSA GCAM, and more." },
                  { icon: TrendingUp, title: "Knows your history",    body: "What you signed, what you pushed back on, what got escalated. Every decision sharpens MIKE's output." },
                ].map(({ icon: Icon, title, body }) => (
                  <div key={title} className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center shrink-0 mt-0.5" style={{ background: CARD2 }}>
                      <Icon size={13} className="text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{title}</div>
                      <div className="text-xs text-white/60 mt-0.5 leading-relaxed">{body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="how-it-works" className="border-y border-white/8 py-20" style={{ background: ALT }}>
        <div className="max-w-6xl mx-auto px-6 space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Built for every side of the deal</h2>
            <p className="text-white/55 text-sm max-w-xl mx-auto">Legal intelligence shouldn't be a luxury. MIKE levels the playing field.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {[
              {
                who: "In-house legal teams",
                bullets: [
                  "Review counterparty paper against your exact positions",
                  "Fallback language ready to paste into your redline",
                  "Escalation routing to the right approver, automatically",
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
              <div key={who} className="rounded-xl border border-white/8 p-6 space-y-4 hover:border-white/20 transition-colors flex flex-col" style={{ background: CARD }}>
                <div className="text-xs font-bold text-primary tracking-widest uppercase">{who}</div>
                <ul className="space-y-2 flex-1">
                  {bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-white/70">
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

      {/* Why MIKE vs generic AI */}
      <section id="why-mike" className="max-w-6xl mx-auto px-6 py-20 space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Generic AI reviews documents.<br />MIKE knows your company.</h2>
          <p className="text-white/55 text-sm max-w-2xl mx-auto">
            Harvey, Legora, Microsoft Legal Agent — every platform now has an AI that can redline a contract. Ask all of them the same question.
          </p>
          <div className="inline-block rounded-xl border border-primary/20 px-5 py-3" style={{ background: "hsl(172 84% 6%)" }}>
            <span className="text-sm text-white/60">Does it know your red lines?</span>
            <span className="ml-3 text-sm font-bold text-primary">The answer is always no. MIKE does.</span>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="rounded-xl border border-white/8 p-6 space-y-4" style={{ background: CARD }}>
            <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Generic AI contract tools</div>
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
                <div key={item} className="flex items-center gap-2.5 text-sm text-white/45">
                  <Minus size={12} className="text-white/25 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-primary/20 p-6 space-y-4" style={{ background: "hsl(172 84% 8%)" }}>
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
                <div key={item} className="flex items-center gap-2.5 text-sm text-white/80">
                  <CheckCircle size={12} className="text-primary shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-white/8 py-20" style={{ background: ALT }}>
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">From upload to risk report in minutes</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-8 relative">
            <div className="hidden sm:block absolute top-5 left-1/3 right-1/3 h-px bg-white/8" />
            {[
              { n: "01", title: "Set your playbook",        body: "Define preferred positions, fallbacks, and red lines for each clause. Pre-filled from market defaults for your sector and risk appetite." },
              { n: "02", title: "Upload counterparty paper", body: "Drop in a PDF or DOCX. MIKE extracts every relevant clause and maps it against your playbook and live regulatory obligations." },
              { n: "03", title: "Get your risk report",      body: "Red, Amber, Green per clause. Exact deviation from your position. Regulatory citations. Fallback language. Business summary for non-lawyers." },
            ].map(({ n, title, body }) => (
              <div key={n} className="space-y-4">
                <div className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center text-xs font-mono text-primary" style={{ background: CARD2 }}>
                  {n}
                </div>
                <h3 className="text-base font-semibold text-white">{title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Regulatory intelligence */}
      <section className="border-y border-white/8 py-20" style={{ background: "hsl(222 47% 8%)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: "hsl(222 47% 9%)" }}>
            <div className="grid lg:grid-cols-2 gap-0">
              <div className="p-10 space-y-5">
                <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">Regulatory intelligence</div>
                <h2 className="text-2xl font-bold text-white tracking-tight leading-snug">
                  A knowledge lawyer reads<br />new guidance the day it drops
                </h2>
                <p className="text-sm text-white/45 leading-relaxed">
                  Hardcoded regulatory context is a liability the moment something changes and MIKE doesn't know. For a regulated business, that's not a minor gap - it's a trust-destroying one.
                </p>
                <p className="text-sm text-white/45 leading-relaxed">
                  Every contract review is cross-referenced against the regulatory frameworks that apply to your sector and jurisdiction. GDPR, FCA Consumer Duty, KSA GCAM, South Korea's mandatory loot box disclosure laws, and more - automatically.
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

      {/* Feedback loop */}
      <section className="border-y border-white/8 py-20" style={{ background: ALT }}>
        <div className="max-w-3xl mx-auto px-6 text-center space-y-6">
          <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">The feedback loop</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Every correction makes MIKE sharper
          </h2>
          <p className="text-white/65 leading-relaxed">
            When your lawyer accepts, edits, or escalates a clause - MIKE learns. Over time it stops applying generic market standards and starts applying <em className="text-white not-italic font-medium">your</em> standards.
          </p>
          <div className="flex items-center justify-center gap-8 pt-4">
            {[
              { icon: CheckCircle,   color: "text-emerald-400", label: "Accept" },
              { icon: Minus,         color: "text-amber-400",   label: "Edit" },
              { icon: AlertTriangle, color: "text-red-400",     label: "Escalate" },
            ].map(({ icon: Icon, color, label }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center" style={{ background: CARD2 }}>
                  <Icon size={15} className={color} />
                </div>
                <span className="text-xs text-white/50">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20 space-y-10">
        <div className="text-center space-y-3">
          <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">Pricing</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">A fraction of what a knowledge lawyer costs</h2>
          <p className="text-white/55 text-sm max-w-xl mx-auto">Start free. Upgrade when the value is obvious.</p>
        </div>

        {/* MIKE Core — free open source tier */}
        <div className="max-w-4xl mx-auto rounded-xl border border-white/10 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6" style={{ background: CARD2 }}>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">MIKE Core</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-emerald-400 bg-emerald-400/10 border-emerald-400/20">Free · Open source</span>
            </div>
            <p className="text-xs text-white/50 max-w-lg">
              Self-hostable. Document upload and parsing, basic clause extraction, generic output renderer. No company context, no playbook, no regulatory layer.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              {["Document upload & parsing", "Basic clause extraction", "Generic output renderer"].map((f) => (
                <span key={f} className="text-[10px] text-white/40 flex items-center gap-1">
                  <CheckCircle size={9} className="text-white/25" /> {f}
                </span>
              ))}
            </div>
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-5 py-2.5 rounded-xl border border-white/15 text-xs font-semibold text-white/60 hover:text-white hover:border-white/30 transition-all whitespace-nowrap"
          >
            View on GitHub →
          </a>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 max-w-4xl mx-auto">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-xs text-white/30 whitespace-nowrap">Or start a 14-day free trial of managed MIKE</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        {/* Paid tiers */}
        <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            {
              tier: "MIKE Starter",
              price: "£300",
              period: "/month",
              trial: "14-day free trial",
              trialColor: "text-primary bg-primary/10 border-primary/20",
              features: [
                "30-minute playbook onboarding",
                "10 clause categories",
                "Red / Amber / Green output",
                "Fallback language per clause",
                "Escalation routing to named approvers",
                "One sector regulatory context",
                "Basic contract storage",
              ],
              cta: "Start free trial",
              highlight: true,
            },
            {
              tier: "MIKE Professional",
              price: "£750",
              period: "/month",
              trial: "14-day free trial",
              trialColor: "text-white/40 bg-white/5 border-white/10",
              features: [
                "Everything in Starter",
                "Live regulatory feeds with citations",
                "Contract memory and outcome capture",
                "Portfolio dashboard",
                "Legal Inheritance bulk upload",
                "Renewal calendar",
                "Cross-contract conflict detection",
              ],
              cta: "Start free trial",
              highlight: false,
            },
            {
              tier: "MIKE Enterprise",
              price: "Custom",
              period: "pricing",
              trial: "Book an intro call",
              trialColor: "text-white/30 bg-white/5 border-white/8",
              features: [
                "Everything in Professional",
                "Investment document review",
                "Term sheet and cap table analysis",
                "Multi-jurisdiction simultaneous analysis",
                "SSO and enterprise security",
                "API access",
                "Custom regulatory modules",
              ],
              cta: "Book an intro",
              highlight: false,
            },
          ].map(({ tier, price, period, trial, trialColor, features, cta, highlight }) => (
            <div key={tier} className={`rounded-xl border p-6 space-y-5 ${highlight ? "border-primary/30" : "border-white/8"}`}
              style={{ background: highlight ? "hsl(172 84% 7%)" : CARD }}>
              <div>
                <div className="text-xs text-white/50 font-medium mb-1">{tier}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-white">{price}</span>
                  <span className="text-xs text-white/45">{period}</span>
                </div>
                <span className={`inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${trialColor}`}>{trial}</span>
              </div>
              <ul className="space-y-2">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-white/65">
                    <CheckCircle size={11} className={highlight ? "text-primary" : "text-white/25"} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to={user ? "/dashboard" : "/register"}
                className={`block text-center px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  highlight
                    ? "bg-primary text-white hover:opacity-90 shadow-lg shadow-primary/25"
                    : "border border-white/10 text-white/50 hover:text-white/70 hover:border-white/20"
                }`}>
                {user && highlight ? "Go to dashboard" : cta} →
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-white/35 max-w-lg mx-auto">
          No credit card required during the trial. £300/month is typically a credit card decision for a senior in-house lawyer — one contract saved usually covers the annual cost.
        </p>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="relative rounded-2xl overflow-hidden p-12 text-center space-y-6">
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, hsl(172 84% 12%), hsl(220 20% 16%))" }} />
          <div className="absolute inset-0 opacity-8" style={{
            backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }} />
          <div className="relative space-y-5">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Your first contract review is waiting
            </h2>
            <p className="text-white/65 text-sm max-w-md mx-auto">
              Upload a contract. Get a structured risk report with regulatory citations, fallback language, and escalation triggers.
            </p>
            {user ? (
              <Link to="/dashboard" className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-primary font-bold rounded-xl hover:opacity-95 transition-opacity shadow-2xl text-sm">
                Go to dashboard
                <ArrowRight size={15} />
              </Link>
            ) : (
              <Link to="/register" className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-primary font-bold rounded-xl hover:opacity-95 transition-opacity shadow-2xl text-sm">
                Get started
                <ArrowRight size={15} />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
              <span className="text-white text-[9px] font-bold">M</span>
            </div>
            <span className="text-xs text-white/35">MIKE - Legal Intelligence</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/30">
            <Link to="/case-study" className="hover:text-white/60 transition-colors">Case study</Link>
            <Link to="/security" className="hover:text-white/60 transition-colors">Security</Link>
            <Link to="/resources" className="hover:text-white/60 transition-colors">Resources</Link>
            <span>2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
