/**
 * Marketing footer.
 *
 * The three links are the public pages that exist as routes today. FOOTER.note
 * is empty on purpose: there is no privacy policy or terms page to link to yet,
 * so nothing is promised here.
 */

import { Link } from "react-router-dom";
import { ZaneLogo } from "../ZaneLogo";
import { FOOTER } from "../../content/homepage";

export function LandingFooter() {
  return (
    <footer className="bg-paper border-t border-line-light mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center justify-between gap-4">
        <Link to="/" className="hover:opacity-80 transition-opacity" aria-label="Zane, home">
          <ZaneLogo size="sm" light={false} />
        </Link>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
          {FOOTER.links.map((l) => (
            <Link key={l.to} to={l.to} className="hover:text-slate-700 transition-colors">
              {l.label}
            </Link>
          ))}
          <span>{new Date().getFullYear()}</span>
        </div>
        {FOOTER.note && <p className="w-full text-xs text-slate-400">{FOOTER.note}</p>}
      </div>
    </footer>
  );
}
