import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle, AlertTriangle, Minus, Zap, BookOpen, Scale, TrendingUp } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

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
        <div className="text-xs font-medium text-white/80">{label}</div>
        <div className="text-[10px] text-white/40 mt-0.5 truncate">{summary}</div>
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
      <div className="relative rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-[10px] text-white/30">Acme Corp - Supplier MSA.pdf</span>
          </div>
        </div>
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-semibold text-white/80">Overall: HIGH RISK</span>
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
          <span className="text-[10px] text-white/30">Reviewed in 1m 43s · UK GDPR flagged</span>
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
    <div className="min-h-screen flex flex-col" style={{ background: "hsl(222 47% 6%)" }}>

      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-white/8 backdrop-blur-md" style={{ background: "hsl(222 47% 6% / 0.85)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="text-sm font-semibold text-white">MIKE</span>
            <span className="text-[10px] text-white/30 ml-1 tracking-widest uppercase hidden sm:block">Legal Intelligence</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-xs text-white/40">
            <a href="#how-it-works" className="hover:text-white/70 transition-colors">How it works</a>
            <a href="#why-mike" className="hover:text-white/70 transition-colors">Why MIKE</a>
            <a href="#pricing" className="hover:text-white/70 transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard" className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-lg shadow-primary/25">
                Go to app <ArrowRight size={13} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="px-4 py-1.5 text-sm text-white/60 hover:text-white transition-colors">Sign in</Link>
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
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: "linear-gradient(hsl(172 84% 30%) 1px, transparent 1px), linear-gradient(90deg, hsl(172 84% 30%) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
        <div className="absolute inset-0" style={{
          background: "radial-gradient(ellipse 80% 60% at 50% -10%, hsl(172 84% 20% / 0.3), transparent 70%)",
        }} />

        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 border border-white/10 rounded-full px-3 py-1 text-xs text-white/50 bg-white/5 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                UK · EU · US · Canada · KSA · South Korea
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] text-white">
                Your knowledge lawyer,{" "}
                <span style={{ background: "linear-gradient(90deg, hsl(172 84% 45%), hsl(172 84% 65%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  always on.
                </span>
              </h1>

              <p className="text-lg text-white/50 leading-relaxed max-w-lg">
                MIKE is the legal intelligence layer lean in-house teams have never been able to afford. It knows your playbook, your regulatory obligations, and your history - and applies all three to every contract it reviews.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/register" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-xl shadow-primary/30 text-sm">
                  Set up your playbook
                  <ArrowRight size={15} />
                </Link>
                <Link to="/login" className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-white/10 text-white/70 hover:text-white hover:border-white/20 rounded-xl transition-colors text-sm">
                  Sign in
                </Link>
              </div>

              <p className="text-xs text-white/25">5-minute setup · Works on your first contract today</p>
            </div>

            <ProductPreview />
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="border-y border-white/8" style={{ background: "hsl(222 47% 8%)" }}>
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { value: "50+",   label: "Clause types analysed" },
            { value: "12",    label: "Jurisdictions covered" },
            { value: "~2m",   label: "Per contract review" },
            { value: "100%",  label: "Playbook-calibrated" },
          ].map(({ value, label }) => (
            <div key={label} className="text-center space-y-1">
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-white/35">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge lawyer pitch */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: "hsl(222 47% 9%)" }}>
          <div className="grid lg:grid-cols-2 gap-0">
            <div className="p-10 space-y-5 border-b lg:border-b-0 lg:border-r border-white/8">
              <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">The knowledge lawyer</div>
              <h2 className="text-2xl font-bold text-white tracking-tight leading-snug">
                The intelligence layer<br />your team never had
              </h2>
              <p className="text-sm text-white/45 leading-relaxed">
                A knowledge lawyer at a City firm charges £300–500/hour. Their job: know what the current law says, how it applies to your situation, and what it means for a specific clause. They sit behind the fee earners and provide the regulatory intelligence that makes advice defensible.
              </p>
              <p className="text-sm text-white/45 leading-relaxed">
                MIKE is that person. Permanently on, always current, costs a fraction - available to in-house teams and founders who could never justify a dedicated knowledge function.
              </p>
            </div>
            <div className="p-10 space-y-6">
              <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">What that means in practice</div>
              <div className="space-y-4">
                {[
                  { icon: BookOpen, title: "Knows your positions", body: "Your preferred clauses, fallbacks, and hard red lines - applied consistently to every contract, not just the ones a lawyer has time to review." },
                  { icon: Scale,    title: "Knows the law",        body: "Current regulatory obligations by sector and jurisdiction. UK GDPR, FCA Consumer Duty, KSA GCAM, South Korea loot box disclosure - cross-referenced automatically." },
                  { icon: TrendingUp, title: "Knows your history", body: "What you signed, what you pushed back on, what got escalated. Every decision makes MIKE sharper on your specific positions." },
                ].map(({ icon: Icon, title, body }) => (
                  <div key={title} className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center shrink-0 mt-0.5" style={{ background: "hsl(222 47% 13%)" }}>
                      <Icon size={13} className="text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white/80">{title}</div>
                      <div className="text-xs text-white/40 mt-0.5 leading-relaxed">{body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="how-it-works" className="border-y border-white/8 py-20" style={{ background: "hsl(222 47% 8%)" }}>
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Built for every side of the deal</h2>
            <p className="text-white/40 text-sm max-w-xl mx-auto">Legal intelligence shouldn't be a luxury. MIKE levels the playing field.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                who: "In-house legal teams",
                what: "Review counterparty paper against your exact positions, not generic market standards. MIKE flags deviations, produces fallback language, routes escalations to the right approver, and cites the regulatory provisions that make your position defensible.",
              },
              {
                who: "Founders & growing companies",
                what: "From your first supplier agreement to your Series B term sheet - MIKE gives sophisticated legal intelligence across every contract your business touches. Know your exposure on commercial deals, employment contracts, investor documents, and IP agreements before you sign, not after.",
              },
              {
                who: "PE & M&A funds",
                what: "Run legal and regulatory DD on target companies before you invest or acquire. MIKE analyses the contract portfolio, maps the regulatory landscape by sector and jurisdiction - including concrete upcoming legislative changes in the pipeline - and stress-tests exposure against your fund's risk appetite.",
              },
            ].map(({ who, what }) => (
              <div key={who} className="rounded-xl border border-white/8 p-6 space-y-3 hover:border-white/15 transition-colors" style={{ background: "hsl(222 47% 9%)" }}>
                <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">{who}</div>
                <p className="text-sm text-white/50 leading-relaxed">{what}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The founder story */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: "hsl(222 47% 9%)" }}>
          <div className="grid lg:grid-cols-5 gap-0">
            <div className="lg:col-span-3 p-10 space-y-5 border-b lg:border-b-0 lg:border-r border-white/8">
              <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">Why this matters</div>
              <h2 className="text-2xl font-bold text-white tracking-tight leading-snug">
                The founder who walked away<br />with almost nothing
              </h2>
              <p className="text-sm text-white/45 leading-relaxed">
                A founder raises capital over six years, accepts investor terms he doesn't fully understand under pressure to close. Liquidation preferences and participating preferred stack up silently. A £150M exit arrives - and he walks away with almost nothing.
              </p>
              <p className="text-sm text-white/45 leading-relaxed">
                This is exactly what MIKE prevents - and it applies in both directions. For the founder reviewing a term sheet before they sign. For the PE fund running DD on a target company before they commit capital, assessing the regulatory exposure they're acquiring alongside the business.
              </p>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-white/60 leading-relaxed font-mono">
                <span className="text-primary font-semibold block mb-1">MIKE output - Liquidation Preference · RED</span>
                "The investor has included a 2x participating preferred. This means at exit they receive double their investment back before you see anything, and then participate in the remaining proceeds as if they had converted. On a £150M exit with £20M invested, the investor takes £40M off the top plus their pro-rata share of what remains. Model the exit waterfall before signing."
              </div>
            </div>
            <div className="lg:col-span-2 p-10 space-y-5">
              <div className="text-xs font-bold text-white/30 uppercase tracking-widest">Investment document clauses MIKE reviews</div>
              <div className="space-y-2">
                {[
                  ["Liquidation preference", "1x non-participating vs participating"],
                  ["Anti-dilution provisions", "Full ratchet is a red line"],
                  ["Option pool shuffle timing", "Before or after - matters enormously"],
                  ["Pay-to-play provisions", "What happens if you don't follow on"],
                  ["Drag-along provisions", "Who controls an exit decision"],
                  ["Vesting & leaver provisions", "Good/bad leaver cliff structures"],
                  ["Board composition", "Who controls the company post-raise"],
                  ["Redemption rights", "Investor ability to force a liquidity event"],
                ].map(([clause, note]) => (
                  <div key={clause} className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
                    <CheckCircle size={12} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-medium text-white/65">{clause}</div>
                      <div className="text-[10px] text-white/30">{note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PE / fund features */}
      <section className="border-y border-white/8 py-20" style={{ background: "hsl(222 47% 8%)" }}>
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div className="space-y-6">
              <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">For PE & M&A funds</div>
              <h2 className="text-2xl font-bold text-white tracking-tight leading-snug">
                DD that understands<br />what you're actually buying
              </h2>
              <p className="text-sm text-white/45 leading-relaxed">
                When you acquire a company, you acquire its regulatory exposure. MIKE analyses the target's contract portfolio against the regulatory landscape - not just where it operates today, but where legislation is heading.
              </p>
              <p className="text-sm text-white/45 leading-relaxed">
                Configure your fund's risk appetite once. Upload a portfolio of companies or contracts. MIKE runs the analysis and surfaces the exposure - by company, by jurisdiction, by regulatory risk - so you know what you're committing to before you close.
              </p>
              <div className="rounded-xl border border-white/10 p-5 space-y-3" style={{ background: "hsl(222 47% 11%)" }}>
                <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Anticipated regulatory changes - concrete pipeline only</div>
                <div className="space-y-2.5">
                  {[
                    { flag: "🇬🇧", text: "UK Data (Use and Access) Bill - currently in Parliament, amends UK GDPR processing grounds" },
                    { flag: "🇪🇺", text: "EU AI Act - phased implementation through 2026–27, high-risk system obligations" },
                    { flag: "🇪🇺", text: "DORA - Digital Operational Resilience Act, ICT contract requirements from Jan 2025" },
                    { flag: "🇺🇸", text: "American Privacy Rights Act - federal privacy framework, committee stage" },
                    { flag: "🇰🇷", text: "Enhanced loot box disclosure rules - KG&CC enforcement tightening 2025–26" },
                  ].map(({ flag, text }) => (
                    <div key={text} className="flex items-start gap-2.5 text-xs text-white/45">
                      <span className="shrink-0 mt-0.5">{flag}</span>
                      <span className="leading-relaxed">{text}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-white/20 pt-1">MIKE surfaces only concrete legislative pipeline - bills in committee, confirmed implementation timelines, regulator-confirmed guidance. Not speculation.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">What MIKE does for funds</div>
              {[
                {
                  title: "Portfolio contract analysis",
                  body: "Upload a set of target company agreements. MIKE maps clause-level exposure across the entire portfolio - liability caps, IP ownership, change of control, data processing - flagged against your fund's risk appetite.",
                },
                {
                  title: "Regulatory DD by jurisdiction",
                  body: "Understand the regulatory obligations the target company is operating under, what it has agreed to contractually, and where those two things conflict - before you close.",
                },
                {
                  title: "Incoming legislation risk",
                  body: "MIKE flags where a target's current contracts will require renegotiation or create compliance exposure under legislation that is concretely in the pipeline - giving you a cleaner picture of post-acquisition workload.",
                },
                {
                  title: "Investment document review",
                  body: "Term sheets, SHA, SSA, liquidation preference modelling, anti-dilution, drag-along, board composition. Same MIKE engine applied to the documents that determine who actually makes money at exit.",
                },
              ].map(({ title, body }) => (
                <div key={title} className="rounded-xl border border-white/8 p-5 space-y-2 hover:border-white/15 transition-colors" style={{ background: "hsl(222 47% 10%)" }}>
                  <div className="text-sm font-semibold text-white/75">{title}</div>
                  <div className="text-xs text-white/40 leading-relaxed">{body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why MIKE vs generic AI */}
      <section id="why-mike" className="border-y border-white/8 py-20" style={{ background: "hsl(222 47% 8%)" }}>
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Generic AI reviews documents.<br />MIKE knows your company.</h2>
            <p className="text-white/40 text-sm max-w-2xl mx-auto">
              Every major software platform now has an AI that can redline a contract. What none of them have is what makes legal advice actually useful.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="rounded-xl border border-white/8 p-6 space-y-4" style={{ background: "hsl(222 47% 9%)" }}>
              <div className="text-xs font-bold text-white/30 uppercase tracking-widest">Generic AI contract tools</div>
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
                  <div key={item} className="flex items-center gap-2.5 text-sm text-white/35">
                    <Minus size={12} className="text-white/20 shrink-0" />
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
                  <div key={item} className="flex items-center gap-2.5 text-sm text-white/70">
                    <CheckCircle size={12} className="text-primary shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-20 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">From upload to risk report in minutes</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-8 relative">
          <div className="hidden sm:block absolute top-5 left-1/3 right-1/3 h-px bg-white/8" />
          {[
            { n: "01", title: "Set your playbook", body: "Define preferred positions, fallbacks, and red lines for each clause type. Pre-filled from market defaults based on your sector, industry, and risk appetite." },
            { n: "02", title: "Upload counterparty paper", body: "Drop in a PDF or DOCX. MIKE parses the document, extracts every relevant clause, and maps it against your playbook and your live regulatory obligations." },
            { n: "03", title: "Get your risk report", body: "Red, Amber, Green per clause. Exact deviation from your position. Regulatory citations. Fallback language ready to paste into your redline. Business summary for the non-lawyers." },
          ].map(({ n, title, body }) => (
            <div key={n} className="space-y-4 relative">
              <div className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center text-xs font-mono text-primary" style={{ background: "hsl(222 47% 11%)" }}>
                {n}
              </div>
              <h3 className="text-base font-semibold text-white">{title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{body}</p>
            </div>
          ))}
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
                <Link to="/register" className="inline-flex items-center gap-1.5 text-sm text-primary hover:opacity-80 transition-opacity font-medium">
                  See how it works <ArrowRight size={13} />
                </Link>
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
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">The feedback loop</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Every correction makes MIKE sharper
          </h2>
          <p className="text-white/45 leading-relaxed">
            When your lawyer accepts, edits, or escalates a clause - MIKE learns. Over time it stops applying generic market standards and starts applying <em className="text-white/70 not-italic font-medium">your</em> standards. A legal intelligence layer that gets more valuable the more you use it.
          </p>
          <div className="flex items-center justify-center gap-8 pt-4">
            {[
              { icon: CheckCircle,   color: "text-emerald-400", label: "Accept" },
              { icon: Minus,         color: "text-amber-400",   label: "Edit" },
              { icon: AlertTriangle, color: "text-red-400",     label: "Escalate" },
            ].map(({ icon: Icon, color, label }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center" style={{ background: "hsl(222 47% 11%)" }}>
                  <Icon size={15} className={color} />
                </div>
                <span className="text-xs text-white/35">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-y border-white/8 py-20" style={{ background: "hsl(222 47% 8%)" }}>
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-3">
            <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">Pricing</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">A fraction of what a knowledge lawyer costs</h2>
            <p className="text-white/40 text-sm max-w-xl mx-auto">Start on a credit card. Scale as the value compounds.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[
              {
                tier: "V1 - Launch",
                price: "£300",
                period: "/month",
                tag: "Available now",
                tagColor: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
                features: [
                  "Playbook comparison",
                  "Red / Amber / Green output",
                  "Regulatory context citations",
                  "Escalation routing",
                  "50+ clause types",
                  "12 jurisdictions",
                ],
                cta: "Get started",
                highlight: true,
              },
              {
                tier: "V2 - Intelligence",
                price: "£500–750",
                period: "/month",
                tag: "Coming soon",
                tagColor: "text-white/30 bg-white/5 border-white/10",
                features: [
                  "Everything in V1",
                  "Contract portfolio view",
                  "Legal Inheritance memory",
                  "Outcome tracking",
                  "Renewal calendar",
                  "Cross-contract intelligence",
                ],
                cta: "Join waitlist",
                highlight: false,
              },
              {
                tier: "V3 - Full platform",
                price: "£1,000+",
                period: "/month",
                tag: "Roadmap",
                tagColor: "text-white/20 bg-white/3 border-white/8",
                features: [
                  "Everything in V2",
                  "Live regulatory retrieval",
                  "Investment document review",
                  "Audit trail & compliance",
                  "Law firm & enterprise tier",
                  "Custom integrations",
                ],
                cta: "Register interest",
                highlight: false,
              },
            ].map(({ tier, price, period, tag, tagColor, features, cta, highlight }) => (
              <div key={tier} className={`rounded-xl border p-6 space-y-5 ${highlight ? "border-primary/30" : "border-white/8"}`}
                style={{ background: highlight ? "hsl(172 84% 7%)" : "hsl(222 47% 9%)" }}>
                <div>
                  <div className="text-xs text-white/35 font-medium mb-1">{tier}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-white">{price}</span>
                    <span className="text-xs text-white/35">{period}</span>
                  </div>
                  <span className={`inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tagColor}`}>{tag}</span>
                </div>
                <ul className="space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-white/50">
                      <CheckCircle size={11} className={highlight ? "text-primary" : "text-white/20"} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register"
                  className={`block text-center px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    highlight
                      ? "bg-primary text-white hover:opacity-90 shadow-lg shadow-primary/25"
                      : "border border-white/10 text-white/40 hover:text-white/60 hover:border-white/20"
                  }`}>
                  {cta} →
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-white/25 max-w-lg mx-auto">
            Enterprise pricing for law firms and large in-house teams - <Link to="/register" className="text-primary hover:opacity-80">get in touch</Link>. Under £500/month is typically a credit card decision for a senior lawyer - no procurement process required.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="relative rounded-2xl overflow-hidden p-12 text-center space-y-6">
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, hsl(172 84% 15%), hsl(222 47% 15%))" }} />
          <div className="absolute inset-0 opacity-10" style={{
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
            <Link to="/register" className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-primary font-bold rounded-xl hover:opacity-95 transition-opacity shadow-2xl text-sm">
              Get started - it's free
              <ArrowRight size={15} />
            </Link>
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
            <span className="text-xs text-white/25">MIKE - Legal Intelligence</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/20">
            <Link to="/security" className="hover:text-white/40 transition-colors">Security</Link>
            <Link to="/resources" className="hover:text-white/40 transition-colors">Resources</Link>
            <span>© 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
