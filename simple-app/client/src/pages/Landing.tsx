import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle, AlertTriangle, Minus } from "lucide-react";

// ─── Product preview mock ─────────────────────────────────────────────────────

const MOCK_CLAUSES = [
  { label: "Limitation of Liability", status: "RED",   summary: "Cap below 3 months' fees — breaches red line" },
  { label: "Data & Privacy",          status: "RED",   summary: "No DPA in place — GDPR exposure" },
  { label: "Indemnity",               status: "AMBER", summary: "One-sided indemnity — negotiate scope" },
  { label: "Auto-Renewal",            status: "AMBER", summary: "No notice provision — push back" },
  { label: "Confidentiality",         status: "GREEN", summary: "Mutual 2-year — meets preferred position" },
  { label: "Governing Law",           status: "GREEN", summary: "English law — acceptable" },
];

function ClauseRow({ label, status, summary }: { label: string; status: string; summary: string }) {
  const config = {
    RED:   { dot: "bg-red-500",     badge: "bg-red-500/10 text-red-400 border-red-500/20",   text: "RED" },
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
      {/* Glow */}
      <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-2xl scale-95 opacity-60" />

      {/* Window chrome */}
      <div className="relative rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-[10px] text-white/30">Acme Corp — MSA.pdf</span>
          </div>
        </div>

        {/* Summary bar */}
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

        {/* Clauses */}
        <div className="px-4 py-1">
          {MOCK_CLAUSES.map((c) => (
            <ClauseRow key={c.label} {...c} />
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10 bg-white/[0.03] flex items-center justify-between">
          <span className="text-[10px] text-white/30">Reviewed in 1m 43s</span>
          <span className="text-[10px] text-primary font-medium">Do not sign yet →</span>
        </div>
      </div>
    </div>
  );
}

// ─── Stats row ────────────────────────────────────────────────────────────────

const STATS = [
  { value: "10",   label: "Clause types reviewed" },
  { value: "5",    label: "Jurisdictions covered" },
  { value: "~2m",  label: "Per contract review" },
  { value: "100%", label: "Playbook-calibrated" },
];

// ─── Use cases ────────────────────────────────────────────────────────────────

const USE_CASES = [
  {
    who: "In-house legal",
    what: "Review counterparty paper against your exact positions, not generic market standards. MIKE flags deviations, drafts push-back language, and routes escalations to the right approver.",
  },
  {
    who: "Founders & BD",
    what: "Stop signing contracts you haven't fully read. MIKE tells you in plain English what's risky, what to negotiate, and whether it's safe to sign — without needing a lawyer on call.",
  },
  {
    who: "PE & M&A teams",
    what: "Run contract diligence at speed. Upload a portfolio of agreements and get a portfolio-wide risk view in minutes, not weeks.",
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Landing() {
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
            <span className="text-[10px] text-white/30 ml-1 tracking-widest uppercase hidden sm:block">Legal Decision Engine</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-4 py-1.5 text-sm text-white/60 hover:text-white transition-colors">
              Sign in
            </Link>
            <Link to="/register" className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-lg shadow-primary/25">
              Get started
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: "linear-gradient(hsl(172 84% 30%) 1px, transparent 1px), linear-gradient(90deg, hsl(172 84% 30%) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
        {/* Radial fade */}
        <div className="absolute inset-0" style={{
          background: "radial-gradient(ellipse 80% 60% at 50% -10%, hsl(172 84% 20% / 0.3), transparent 70%)",
        }} />

        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left: copy */}
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 border border-white/10 rounded-full px-3 py-1 text-xs text-white/50 bg-white/5 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                UK · EU · US · Singapore · UAE
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] text-white">
                Your contracts,<br />
                reviewed against{" "}
                <span style={{ background: "linear-gradient(90deg, hsl(172 84% 45%), hsl(172 84% 65%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  your rules.
                </span>
              </h1>

              <p className="text-lg text-white/50 leading-relaxed max-w-lg">
                MIKE reads counterparty paper against your legal playbook and live regulations.
                Every risk flagged. Every deviation explained. Fallback language ready to send.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/register" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-xl shadow-primary/30 text-sm">
                  Set up your playbook — free
                  <ArrowRight size={15} />
                </Link>
                <Link to="/login" className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-white/10 text-white/70 hover:text-white hover:border-white/20 rounded-xl transition-colors text-sm">
                  Sign in
                </Link>
              </div>

              <p className="text-xs text-white/25">No credit card · 5-minute setup · Works on your first contract today</p>
            </div>

            {/* Right: product preview */}
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="border-y border-white/8" style={{ background: "hsl(222 47% 8%)" }}>
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center space-y-1">
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-white/35">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Use cases */}
      <section className="max-w-6xl mx-auto px-6 py-20 space-y-10">
        <div className="text-center space-y-3">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Built for every side of the deal</h2>
          <p className="text-white/40 text-sm max-w-xl mx-auto">Legal expertise shouldn't be a luxury. MIKE levels the playing field.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {USE_CASES.map(({ who, what }) => (
            <div key={who} className="rounded-xl border border-white/8 p-6 space-y-3 hover:border-white/15 transition-colors" style={{ background: "hsl(222 47% 9%)" }}>
              <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">{who}</div>
              <p className="text-sm text-white/50 leading-relaxed">{what}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-white/8 py-20" style={{ background: "hsl(222 47% 8%)" }}>
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">From upload to risk report in minutes</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 relative">
            {/* connector line */}
            <div className="hidden sm:block absolute top-5 left-1/3 right-1/3 h-px bg-white/8" />

            {[
              { n: "01", title: "Set your playbook", body: "Define your preferred positions, fallbacks, and red lines for each key clause. Pre-filled from market defaults based on your sector and risk appetite." },
              { n: "02", title: "Upload counterparty paper", body: "Drop in a PDF or DOCX. MIKE parses the document, extracts every relevant clause, and maps it to your playbook." },
              { n: "03", title: "Get your risk report", body: "Red, Amber, Green per clause. Exact deviation from your position. Fallback language ready to paste into your redline." },
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
        </div>
      </section>

      {/* Regulatory */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: "hsl(222 47% 9%)" }}>
          <div className="grid lg:grid-cols-2 gap-0">
            <div className="p-10 space-y-5">
              <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">Regulatory intelligence</div>
              <h2 className="text-2xl font-bold text-white tracking-tight leading-snug">
                MIKE knows the rules<br />you're operating under
              </h2>
              <p className="text-sm text-white/45 leading-relaxed">
                Every contract review is cross-referenced against the regulatory frameworks that apply to your sector and jurisdiction — automatically. GDPR, FCA Consumer Duty, HIPAA, MAS TRM, VARA, UAE PDPL and more.
              </p>
              <Link to="/register" className="inline-flex items-center gap-1.5 text-sm text-primary hover:opacity-80 transition-opacity font-medium">
                See how it works <ArrowRight size={13} />
              </Link>
            </div>
            <div className="border-l border-white/8 p-10 flex flex-col justify-center gap-3">
              {[
                { flag: "🇬🇧", label: "United Kingdom", regs: "FCA Consumer Duty · UK GDPR · ICO" },
                { flag: "🇪🇺", label: "European Union",  regs: "GDPR · EU AI Act · DORA · NIS2" },
                { flag: "🇺🇸", label: "United States",   regs: "CCPA · HIPAA · SOX · GLBA" },
                { flag: "🇸🇬", label: "Singapore",        regs: "MAS TRM · PDPA · Banking Act" },
                { flag: "🇦🇪", label: "UAE",              regs: "DIFC · ADGM · VARA · UAE PDPL" },
              ].map(({ flag, label, regs }) => (
                <div key={label} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                  <span className="text-lg">{flag}</span>
                  <div>
                    <div className="text-xs font-medium text-white/70">{label}</div>
                    <div className="text-[10px] text-white/30 mt-0.5">{regs}</div>
                  </div>
                  <CheckCircle size={12} className="text-primary ml-auto shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The moat */}
      <section className="border-y border-white/8 py-20" style={{ background: "hsl(222 47% 8%)" }}>
        <div className="max-w-3xl mx-auto px-6 text-center space-y-6">
          <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">The feedback loop</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Every correction makes MIKE sharper
          </h2>
          <p className="text-white/45 leading-relaxed">
            When your lawyer accepts, edits, or escalates a clause — MIKE learns. Over time it stops applying generic market standards and starts applying <em className="text-white/70 not-italic font-medium">your</em> standards. A legal AI that gets more valuable the more you use it.
          </p>
          <div className="flex items-center justify-center gap-8 pt-4">
            {[
              { icon: CheckCircle,    color: "text-emerald-400", label: "Accept" },
              { icon: Minus,          color: "text-amber-400",   label: "Edit" },
              { icon: AlertTriangle,  color: "text-red-400",     label: "Escalate" },
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

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="relative rounded-2xl overflow-hidden p-12 text-center space-y-6">
          {/* Background */}
          <div className="absolute inset-0" style={{
            background: "linear-gradient(135deg, hsl(172 84% 15%), hsl(222 47% 15%))",
          }} />
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }} />
          <div className="relative space-y-5">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Your first contract review is waiting
            </h2>
            <p className="text-white/60 text-sm max-w-md mx-auto">
              Set up your playbook in 5 minutes. Upload a contract. Get your risk report. No lawyers required.
            </p>
            <Link to="/register" className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-primary font-bold rounded-xl hover:opacity-95 transition-opacity shadow-2xl text-sm">
              Get started — it's free
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
            <span className="text-xs text-white/25">MIKE — Legal Decision Engine</span>
          </div>
          <span className="text-xs text-white/20">© 2026</span>
        </div>
      </footer>
    </div>
  );
}
