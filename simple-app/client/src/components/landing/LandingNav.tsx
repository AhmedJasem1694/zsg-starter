/**
 * Marketing navigation.
 *
 * Solid navy at the top of the page, translucent once the reader scrolls, so
 * the bar reads as part of the hero until it has to separate from the content
 * behind it. Collapses to a disclosure under 768px.
 *
 * Sign in is kept: /login is a live route rendering the Login page, so the link
 * goes somewhere. It sits far right as a quiet text link rather than competing
 * with the one thing this page is asking for.
 */

import { useEffect, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import { ZaneLogo } from "../ZaneLogo";
import { NAV } from "../../content/homepage";

export function LandingNav({
  onAnchorClick,
}: {
  /** Smooth-scroll handler owned by the page, so the nav holds no scroll state. */
  onAnchorClick: (e: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  // Solid at the top, translucent once the page moves under it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A menu left open while the viewport grows would hide behind the desktop bar.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const close = () => { if (mq.matches) setOpen(false); };
    mq.addEventListener("change", close);
    return () => mq.removeEventListener("change", close);
  }, []);

  const handleAnchor = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    setOpen(false);
    onAnchorClick(e, href);
  };

  return (
    <header
      className="sticky top-0 z-30 border-b transition-colors duration-300"
      style={{
        background: scrolled ? "rgba(6,10,20,0.82)" : "#060A14",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderColor: scrolled ? "rgba(30,41,59,0.6)" : "transparent",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <Link to="/" className="shrink-0 hover:opacity-80 transition-opacity" aria-label="Zane, home">
          <ZaneLogo size="sm" light={true} />
        </Link>

        {/* Desktop */}
        <nav className="hidden md:flex items-center gap-7 text-xs" aria-label="Primary">
          {NAV.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={(e) => handleAnchor(e, l.href)}
              className="text-slate-400 hover:text-white transition-colors duration-300"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link
            to={NAV.signInHref}
            className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors duration-300"
          >
            {NAV.signInLabel}
          </Link>
          <a
            href={NAV.ctaHref}
            onClick={(e) => handleAnchor(e, NAV.ctaHref)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-cobalt hover:bg-cobalt-hover text-white text-sm font-medium rounded-lg transition-[background-color,box-shadow] duration-150 ease-out"
          >
            {NAV.ctaLabel} <ArrowRight size={13} />
          </a>
        </div>

        {/* Mobile trigger */}
        <button
          type="button"
          className="md:hidden p-2 -mr-2 text-slate-300 hover:text-white transition-colors"
          aria-expanded={open}
          aria-controls="landing-menu"
          aria-label={open ? NAV.menuCloseLabel : NAV.menuOpenLabel}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu. hidden keeps it out of the a11y tree when closed. */}
      <div
        id="landing-menu"
        hidden={!open}
        className="md:hidden border-t border-line-dark/60 px-4 pb-4 pt-2"
        style={{ background: "#060A14" }}
      >
        <nav className="flex flex-col" aria-label="Primary">
          {NAV.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={(e) => handleAnchor(e, l.href)}
              className="py-3 text-sm text-slate-300 hover:text-white border-b border-line-dark/40 transition-colors"
            >
              {l.label}
            </a>
          ))}
          <a
            href={NAV.ctaHref}
            onClick={(e) => handleAnchor(e, NAV.ctaHref)}
            className="mt-4 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-cobalt hover:bg-cobalt-hover text-white text-sm font-medium rounded-lg transition-colors"
          >
            {NAV.ctaLabel} <ArrowRight size={14} />
          </a>
          <Link
            to={NAV.signInHref}
            className="mt-3 text-center py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            {NAV.signInLabel}
          </Link>
        </nav>
      </div>
    </header>
  );
}
