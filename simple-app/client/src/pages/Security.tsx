/**
 * Public security page.
 *
 * Holds no copy: every string comes from ../content/security, and every claim
 * that copy makes maps to ../content/claims. See the header of the copy file
 * for what was removed and why.
 *
 * The page has two halves on purpose. "What the product does today" is the
 * short list that survives a code check. "What Zane does not do" is the longer
 * one, and it is the more useful half: a general counsel evaluating an early
 * product needs to know where the gaps are, and stating them is cheaper than
 * being found out in a security questionnaire.
 *
 * The missing-things list is rendered in the same weight as the present-things
 * list rather than tucked into a footnote. That is the point of it.
 */

import { AlertCircle, CheckCircle2, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { ZaneLogo } from "@/components/ZaneLogo";
import { SECURITY_PAGE as C } from "@/content/security";

export default function Security() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/40 px-6 py-4 flex flex-wrap items-center justify-between gap-4 max-w-7xl mx-auto">
        <Link to="/" className="hover:opacity-80 transition-opacity">
          <ZaneLogo size="sm" />
        </Link>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {C.nav.links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={
                l.to === "/security"
                  ? "text-sm text-foreground"
                  : "text-sm text-muted-foreground hover:text-foreground transition-colors"
              }
            >
              {l.label}
            </Link>
          ))}
          <Link
            to={C.nav.signInHref}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {C.nav.signInLabel}
          </Link>
          <Link
            to={C.nav.ctaHref}
            className="text-sm bg-primary text-white px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
          >
            {C.nav.ctaLabel}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-6">
          <Shield size={12} />
          {C.hero.eyebrow}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">{C.hero.headline}</h1>
        <p className="text-base text-muted-foreground leading-relaxed">{C.hero.body}</p>
      </section>

      {/* What it does today */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-1">{C.today.heading}</h2>
          <p className="text-sm text-muted-foreground">{C.today.subheading}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {C.TODAY.map(({ title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5 flex gap-3">
              <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h3 className="font-semibold text-sm mb-1.5">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What it does not do. Same visual weight as the list above. */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-1">{C.notDone.heading}</h2>
          <p className="text-sm text-muted-foreground">{C.notDone.subheading}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {C.NOT_DONE.map(({ title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5 flex gap-3">
              <AlertCircle
                size={16}
                className="text-muted-foreground shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <h3 className="font-semibold text-sm mb-1.5">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Personal data */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="rounded-2xl border border-border bg-card p-8">
          <h2 className="text-xl font-bold mb-3">{C.processing.heading}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            {C.processing.body}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            {C.processing.noteBefore}{" "}
            <a
              href={`mailto:${C.processing.email}`}
              className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
            >
              {C.processing.email}
            </a>
          </p>
        </div>
      </section>

      {/* Disclosure */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-xl font-bold mb-3">{C.disclosure.heading}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mb-5">
          {C.disclosure.body}
        </p>
        <a
          href={`mailto:${C.disclosure.email}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-card text-sm font-medium hover:bg-accent transition-colors"
        >
          <Shield size={14} aria-hidden="true" />
          {C.disclosure.email}
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>{C.footer.copyright}</span>
          <div className="flex gap-4">
            {C.footer.links.map((l) => (
              <Link key={l.to} to={l.to} className="hover:text-foreground transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
