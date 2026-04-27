import { Link } from "react-router-dom";
import { Shield, Zap, BookOpen, TrendingUp, CheckCircle, ArrowRight } from "lucide-react";

const FEATURES = [
  {
    icon: BookOpen,
    title: "Playbook-driven review",
    body: "Upload your legal positions once. MIKE flags every clause that deviates from your standards — automatically.",
  },
  {
    icon: Shield,
    title: "Live regulatory intelligence",
    body: "MIKE cross-references contracts against active regulations — GDPR, FCA Consumer Duty, HIPAA, MAS, VARA and more — relevant to your sector and jurisdiction.",
  },
  {
    icon: Zap,
    title: "Red / Amber / Green in minutes",
    body: "Every key clause gets a risk rating, a plain-English explanation, and a ready-to-use fallback position. No more reading contracts cold.",
  },
  {
    icon: TrendingUp,
    title: "Gets smarter with every review",
    body: "When you accept, edit, or escalate a clause, MIKE learns. Over time it calibrates to your exact risk appetite — not generic market standards.",
  },
];

const USECASES = [
  "In-house legal teams reviewing counterparty paper",
  "Founders signing their first vendor agreements",
  "Lean startups without dedicated legal resource",
  "PE firms running contract diligence at speed",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <div>
              <span className="text-sm font-semibold">MIKE</span>
              <span className="text-[10px] text-muted-foreground ml-2 hidden sm:inline tracking-wide uppercase">
                Legal Decision Engine
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-ghost text-sm px-3 py-1.5">
              Sign in
            </Link>
            <Link to="/register" className="btn-primary text-sm px-4 py-1.5">
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-accent border border-accent-border rounded-full px-3 py-1 text-xs font-medium text-accent-foreground mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Regulatory intelligence for 5 jurisdictions: UK · EU · US · Singapore · UAE
        </div>

        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-foreground max-w-3xl mx-auto leading-tight">
          Contract review that knows your{" "}
          <span className="text-primary">playbook</span>
        </h1>

        <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          MIKE reads counterparty paper against your legal positions and live regulations.
          Every deviation flagged. Every risk explained. Fallback language ready to send.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/register" className="btn-primary gap-2 text-base px-6 py-2.5">
            Set up your playbook
            <ArrowRight size={16} />
          </Link>
          <Link to="/login" className="btn-secondary text-base px-6 py-2.5">
            Sign in to MIKE
          </Link>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          No credit card required · Takes 5 minutes to configure
        </p>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid sm:grid-cols-2 gap-6">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card p-6 space-y-3">
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
                <Icon size={18} className="text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="card overflow-hidden">
          <div className="card-header">
            <h2 className="text-xl font-semibold">Who uses MIKE</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Built for teams that negotiate contracts without a full legal department behind them.
            </p>
          </div>
          <div className="card-body">
            <ul className="space-y-3">
              {USECASES.map((uc) => (
                <li key={uc} className="flex items-start gap-3">
                  <CheckCircle size={16} className="text-primary mt-0.5 shrink-0" />
                  <span className="text-sm text-foreground">{uc}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-xl font-semibold text-center mb-8">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-6 text-center">
          {[
            { step: "1", title: "Set your playbook", body: "Tell MIKE your preferred positions, fallbacks, and red lines for each key clause type. Takes 5 minutes." },
            { step: "2", title: "Upload counterparty paper", body: "Drag and drop a PDF or DOCX. MIKE extracts and classifies every key clause automatically." },
            { step: "3", title: "Get your risk report", body: "Every clause rated RAG with specific push-back language and regulatory flags relevant to your sector." },
          ].map(({ step, title, body }) => (
            <div key={step} className="space-y-3">
              <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold mx-auto">
                {step}
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="card bg-primary text-primary-foreground p-10 text-center space-y-4">
          <h2 className="text-2xl font-semibold">Start reviewing smarter</h2>
          <p className="text-primary-foreground/80 text-sm max-w-md mx-auto">
            Set up your playbook in 5 minutes. MIKE will be ready to review your first contract today.
          </p>
          <Link to="/register" className="inline-flex items-center gap-2 bg-white text-primary px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            Create your account
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>MIKE — Legal Decision Engine</span>
          <span>© 2025</span>
        </div>
      </footer>
    </div>
  );
}
