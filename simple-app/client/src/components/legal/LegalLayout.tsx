/**
 * Shell for the legal pages.
 *
 * Shares the public-page chrome and tokens used by the security page, so the
 * legal pages read as part of the same site rather than as a bolted-on
 * document. One measure, one type scale, no cards: these are meant to be read
 * top to bottom, not scanned.
 *
 * The draft banner is rendered here rather than per page, so neither page can
 * lose it in an edit. It goes when LEGAL_BANNER is emptied, which is the
 * deliberate act of putting the pages into force.
 */

import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { ZaneLogo } from "@/components/ZaneLogo";
import { LEGAL_BANNER, LEGAL_NAV, type LegalPage } from "@/content/legal";

export function LegalLayout({ page }: { page: LegalPage }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {LEGAL_BANNER && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2.5">
          <p className="max-w-3xl mx-auto flex items-center gap-2 text-xs font-medium text-amber-200">
            <AlertTriangle size={13} aria-hidden="true" />
            {LEGAL_BANNER}
          </p>
        </div>
      )}

      <nav className="border-b border-border/40 px-6 py-4 flex flex-wrap items-center justify-between gap-4 max-w-7xl mx-auto w-full">
        <Link to="/" className="hover:opacity-80 transition-opacity">
          <ZaneLogo size="sm" />
        </Link>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {LEGAL_NAV.links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="max-w-3xl mx-auto w-full px-6 pt-14 pb-24">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{page.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{page.updatedLabel}</p>

        <div className="mt-8 space-y-4">
          {page.intro.map((p) => (
            <p key={p} className="text-base text-muted-foreground leading-relaxed">{p}</p>
          ))}
        </div>

        {page.blocks.map((block) => (
          <section key={block.heading} className="mt-12">
            <h2 className="text-lg font-bold tracking-tight mb-4">{block.heading}</h2>

            {block.paragraphs && (
              <div className="space-y-4">
                {block.paragraphs.map((p) => (
                  <p key={p} className="text-sm text-muted-foreground leading-relaxed">{p}</p>
                ))}
              </div>
            )}

            {block.bullets && (
              <ul className="mt-4 space-y-2.5">
                {block.bullets.map((b) => (
                  <li
                    key={b}
                    className="pl-4 border-l border-border text-sm text-muted-foreground leading-relaxed"
                  >
                    {b}
                  </li>
                ))}
              </ul>
            )}

            {block.rows && (
              <dl className="mt-4 space-y-4">
                {block.rows.map((r) => (
                  <div key={r.label} className="rounded-xl border border-border bg-card px-5 py-4">
                    <dt className="text-sm font-semibold">{r.label}</dt>
                    <dd className="mt-1 text-sm text-muted-foreground leading-relaxed">{r.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        ))}
      </main>

      <footer className="border-t border-border/40 py-8 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} Zane. All rights reserved.</span>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
