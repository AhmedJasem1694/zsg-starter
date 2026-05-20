import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle } from "lucide-react";

const BG   = "hsl(220 20% 9%)";
const CARD = "hsl(220 20% 13%)";
const CARD2 = "hsl(220 20% 16%)";

export default function CaseStudy() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG }}>

      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-white/8 backdrop-blur-md" style={{ background: `${BG}dd` }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="text-sm font-semibold text-white">Zane</span>
          </div>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white transition-colors">
            <ArrowLeft size={14} /> Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-16 flex-1">

        {/* Header */}
        <div className="space-y-4 max-w-2xl">
          <div className="inline-block text-xs font-bold text-primary tracking-widest uppercase">Case study</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-snug">
            The founder who walked away<br />with almost nothing
          </h1>
          <p className="text-white/65 text-base leading-relaxed">
            A founder raises capital over six years, accepts investor terms under pressure to close. Liquidation preferences stack up silently. A £150M exit arrives - and he walks away with almost nothing. This is exactly what Zane prevents.
          </p>
        </div>

        {/* Story */}
        <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: CARD }}>
          <div className="grid lg:grid-cols-5 gap-0">
            <div className="lg:col-span-3 p-10 space-y-6 border-b lg:border-b-0 lg:border-r border-white/8">
              <div className="space-y-4 text-sm text-white/70 leading-relaxed">
                <p>
                  It starts with a seed round. The terms look standard. The founder is in a hurry to close and the lawyer is expensive - so he skims the SHA and signs. The participating preferred clause goes unnoticed.
                </p>
                <p>
                  Series A arrives. The lead investor insists on a 2x liquidation preference. The founder pushes back weakly - he doesn't fully understand the mechanics, and the investor's counsel is faster and more experienced. He signs.
                </p>
                <p>
                  By Series B, there are three tranches of participating preferred stacked on top of each other. No single round felt catastrophic. The cumulative effect was.
                </p>
                <p>
                  The exit is a genuine success - £150M to a strategic buyer. The founder's lawyers model the waterfall the week before close. The participating preferred holders take £60M off the top. The remaining proceeds are split pro-rata. After six years, the founder's net is under £8M.
                </p>
                <p className="text-white/80 font-medium">
                  Every term that caused this outcome was reviewable at the time it was signed.
                </p>
              </div>

              {/* MIKE output mock */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-xs text-white/70 leading-relaxed font-mono space-y-1">
                <span className="text-primary font-semibold block mb-2">Zane output - Liquidation Preference · RED</span>
                <p>
                  "The investor has included a 2x participating preferred. This means at exit they receive double their investment back before you see anything, and then participate in the remaining proceeds as if they had converted. On a £150M exit with £20M invested, the investor takes £40M off the top plus their pro-rata share of what remains."
                </p>
                <p className="text-primary/80 mt-2">Recommended action: Model the exit waterfall across three exit scenarios (£50M, £100M, £200M) before signing. Push for 1x non-participating as preferred position. 1x participating is acceptable fallback. 2x in any form is a red line.</p>
              </div>
            </div>

            {/* Investment clauses */}
            <div className="lg:col-span-2 p-10 space-y-5">
              <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Investment document clauses Zane reviews</div>
              <div className="space-y-2">
                {[
                  ["Liquidation preference",      "1x non-participating vs participating"],
                  ["Anti-dilution provisions",    "Full ratchet is a red line"],
                  ["Option pool shuffle timing",  "Before or after - matters enormously"],
                  ["Pay-to-play provisions",      "What happens if you don't follow on"],
                  ["Drag-along provisions",       "Who controls an exit decision"],
                  ["Vesting & leaver provisions", "Good/bad leaver cliff structures"],
                  ["Board composition",           "Who controls the company post-raise"],
                  ["Redemption rights",           "Investor ability to force a liquidity event"],
                  ["Information rights",          "What you must disclose and when"],
                  ["Pre-emption rights",          "Who can block a secondary sale"],
                ].map(([clause, note]) => (
                  <div key={clause} className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
                    <CheckCircle size={12} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-medium text-white">{clause}</div>
                      <div className="text-[10px] text-white/45">{note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Applies both ways */}
        <div className="rounded-2xl border border-white/8 p-10 space-y-5" style={{ background: CARD }}>
          <h2 className="text-xl font-bold text-white">This applies in both directions</h2>
          <div className="grid sm:grid-cols-2 gap-8 text-sm text-white/65 leading-relaxed">
            <div className="space-y-2">
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-3">For founders</div>
              <p>Before you sign a term sheet, Zane tells you exactly what you're agreeing to - in plain English, with the exit waterfall modelled, and with a recommended action for every clause that deviates from market standard or your hard red lines.</p>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-3">For in-house legal teams</div>
              <p>Before you sign a supplier or customer contract, Zane checks every clause against your playbook, flags what deviates from your standard positions, and gives you the fallback language to push back with.</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-4 pb-8">
          <p className="text-white/55 text-sm">Ready to review your next contract?</p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/register" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm">
              Get started
            </Link>
          </div>
        </div>

      </main>

      <footer className="border-t border-white/8">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="text-xs text-white/30">Zane - Legal Intelligence</span>
          <Link to="/" className="text-xs text-white/30 hover:text-white/60 transition-colors">Back to home</Link>
        </div>
      </footer>
    </div>
  );
}
