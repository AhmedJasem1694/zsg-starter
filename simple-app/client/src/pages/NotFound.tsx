/**
 * 404, in the marketing shell.
 *
 * Previously every unmatched path silently redirected to the homepage. That
 * hides the mistake from the reader, and tells a crawler the URL was valid,
 * so dead links stay in the index. This says what happened and offers the way
 * back.
 */

import { Link } from "react-router-dom";
import { ZaneLogo } from "@/components/ZaneLogo";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-navy-950 text-[#F8FAFC]">
      <header className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6">
        <Link to="/" className="inline-block hover:opacity-80 transition-opacity">
          <ZaneLogo size="sm" light={true} />
        </Link>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Error 404
          </p>
          <h1 className="mt-4 t-display text-3xl sm:text-4xl tracking-tight">
            That page is not here.
          </h1>
          <p className="mt-4 max-w-lg text-base text-slate-400 leading-relaxed">
            The link may be out of date, or the address may have a typo in it. Nothing has gone
            wrong with your account.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              to="/"
              className="inline-flex items-center justify-center px-6 py-3 bg-cobalt hover:bg-cobalt-hover text-white font-semibold rounded-lg text-sm transition-colors"
            >
              Back to the homepage
            </Link>
            <Link
              to="/security"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors underline underline-offset-4 decoration-slate-600 hover:decoration-slate-300"
            >
              Security
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-line-dark/60">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 text-xs text-slate-400">
          &copy; {new Date().getFullYear()} Zane. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
