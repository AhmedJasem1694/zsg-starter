import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle } from "lucide-react";

const BG   = "hsl(220 20% 9%)";
const CARD = "hsl(220 20% 13%)";
const CARD2 = "hsl(220 20% 16%)";

export default function ForFunds() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG }}>

      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-white/8 backdrop-blur-md" style={{ background: `${BG}dd` }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="text-sm font-semibold text-white">MIKE</span>
          </div>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white transition-colors">
            <ArrowLeft size={14} /> Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-16 flex-1">

        {/* Header */}
        <div className="space-y-4 max-w-2xl">
          <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">For PE & M&A funds</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-snug">
            DD that understands<br />what you're actually buying
          </h1>
          <p className="text-white/65 text-base leading-relaxed">
            When you acquire a company, you acquire its regulatory exposure, its contractual obligations, and the incoming legislation it will have to comply with. MIKE maps all three before you close.
          </p>
        </div>

        {/* What MIKE does */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">What MIKE does for funds</h2>
          <div className="grid sm:grid-cols-2 gap-4">
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
                body: "MIKE flags where a target's current contracts will require renegotiation or create compliance exposure under legislation concretely in the pipeline - giving you a cleaner picture of post-acquisition workload.",
              },
              {
                title: "Investment document review",
                body: "Term sheets, SHA, SSA, liquidation preference modelling, anti-dilution, drag-along, board composition. The same MIKE engine applied to the documents that determine who makes money at exit.",
              },
            ].map(({ title, body }) => (
              <div key={title} className="rounded-xl border border-white/8 p-6 space-y-2 hover:border-white/20 transition-colors" style={{ background: CARD }}>
                <div className="text-sm font-semibold text-white">{title}</div>
                <div className="text-sm text-white/60 leading-relaxed">{body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Regulatory pipeline */}
        <div className="rounded-2xl border border-white/8 p-8 space-y-5" style={{ background: CARD }}>
          <div className="space-y-1">
            <div className="text-xs font-bold text-primary uppercase tracking-widest">Anticipated regulatory changes</div>
            <div className="text-[10px] text-white/35 uppercase tracking-wider">Concrete legislative pipeline only - not speculation</div>
          </div>
          <div className="space-y-3">
            {[
              { jurisdiction: "UK", text: "UK Data (Use and Access) Bill - currently in Parliament, amends UK GDPR processing grounds" },
              { jurisdiction: "EU", text: "EU AI Act - phased implementation through 2026-27, high-risk system obligations" },
              { jurisdiction: "EU", text: "DORA - Digital Operational Resilience Act, ICT contract requirements from Jan 2025" },
              { jurisdiction: "US", text: "American Privacy Rights Act - federal privacy framework, committee stage" },
              { jurisdiction: "KR", text: "Enhanced loot box disclosure rules - KG&CC enforcement tightening 2025-26" },
            ].map(({ jurisdiction, text }) => (
              <div key={text} className="flex items-start gap-3 text-sm text-white/65">
                <span className="shrink-0 mt-0.5 text-[10px] font-bold text-white/40 bg-white/8 px-1.5 py-0.5 rounded font-mono">{jurisdiction}</span>
                <span className="leading-relaxed">{text}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/30 border-t border-white/8 pt-4">
            MIKE surfaces only concrete legislative pipeline - bills in committee, confirmed implementation timelines, regulator-confirmed guidance.
          </p>
        </div>

        {/* How it applies to funds */}
        <div className="rounded-2xl border border-white/8 p-10 space-y-5" style={{ background: CARD }}>
          <h2 className="text-xl font-bold text-white">Configure once. Run across a portfolio.</h2>
          <div className="text-sm text-white/65 leading-relaxed space-y-3">
            <p>Set your fund's risk appetite once - acceptable liability cap structures, IP ownership requirements, change of control provisions, data processing standards. MIKE applies your positions across every company you're reviewing.</p>
            <p>Upload a portfolio of target company contracts. MIKE produces a cross-portfolio risk view: which companies have the cleanest contracts, which have regulatory exposure in specific jurisdictions, which will require renegotiation post-acquisition.</p>
            <p>Every flag comes with the regulatory citation that makes it defensible in an IC memo.</p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-4 pb-8">
          <p className="text-white/55 text-sm">Ready to run smarter DD?</p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/register" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm">
              Get started
            </Link>
            <Link to="/case-study" className="inline-flex items-center gap-2 px-6 py-3 border border-white/15 text-white hover:border-white/30 rounded-xl transition-colors text-sm">
              Read the founder case study
            </Link>
          </div>
        </div>

      </main>

      <footer className="border-t border-white/8">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="text-xs text-white/30">MIKE - Legal Intelligence</span>
          <Link to="/" className="text-xs text-white/30 hover:text-white/60 transition-colors">Back to home</Link>
        </div>
      </footer>
    </div>
  );
}
