/**
 * Marketing footer.
 *
 * Three columns, then the legal line. The year is computed rather than written
 * down, so the page does not quietly go stale on 1 January.
 *
 * The social column renders only when FOOTER.social has entries. It is empty:
 * no LinkedIn or other profile URL exists anywhere in the repository or the
 * environment, and a guessed one would send readers to a page that is not
 * ours. Put the real URL in the constants and the column appears.
 */

import type { MouseEvent } from "react";
import { Link } from "react-router-dom";
import { ZaneLogo } from "../ZaneLogo";
import { FOOTER } from "../../content/homepage";

export function LandingFooter({
  onAnchorClick,
}: {
  /** Anchor links only work on the homepage; elsewhere they fall through as hrefs. */
  onAnchorClick?: (e: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  return (
    <footer className="bg-paper border-t border-line-light mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {/* Identity */}
          <div>
            <Link to="/" className="inline-block hover:opacity-80 transition-opacity">
              <ZaneLogo size="sm" light={false} />
            </Link>
            <p className="mt-4 text-sm text-slate-600 leading-relaxed max-w-xs">{FOOTER.tagline}</p>
          </div>

          {/* Navigation */}
          <nav className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm" aria-label="Footer">
            {FOOTER.sectionLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={onAnchorClick ? (e) => onAnchorClick(e, l.href) : undefined}
                className="text-slate-600 hover:text-ink transition-colors"
              >
                {l.label}
              </a>
            ))}
            {FOOTER.pageLinks.map((l) => (
              <Link key={l.to} to={l.to} className="text-slate-600 hover:text-ink transition-colors">
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Contact */}
          <div className="text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-2.5">
              {FOOTER.contactLabel}
            </p>
            <a
              href={`mailto:${FOOTER.contactEmail}`}
              className="text-slate-600 hover:text-ink transition-colors underline underline-offset-4 decoration-slate-300 hover:decoration-slate-500"
            >
              {FOOTER.contactEmail}
            </a>
            {FOOTER.social.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {FOOTER.social.map((s) => (
                  <a
                    key={s.href}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-slate-600 hover:text-ink transition-colors"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-line-light flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>&copy; {new Date().getFullYear()} {FOOTER.legalSuffix}</span>
          {FOOTER.note && <span>{FOOTER.note}</span>}
        </div>
      </div>
    </footer>
  );
}
