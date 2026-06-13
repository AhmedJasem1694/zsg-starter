import { BookOpen, FileText, Zap, Scale, Users, BarChart3, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ZaneLogo } from "../components/ZaneLogo";

const GUIDES = [
  {
    icon: Scale,
    category: "Getting started",
    title: "How to build your first playbook in 20 minutes",
    description:
      "A step-by-step guide to calibrating Zane's playbook for your risk appetite, sector, and jurisdiction. With specific examples for UK financial services.",
    readTime: "8 min read",
    tag: "Guide",
    href: "/resources/first-playbook",
  },
  {
    icon: FileText,
    category: "Contract review",
    title: "Reading a Zane review: what each RAG status actually means",
    description:
      "RED, AMBER, GREEN, and ABSENT, with specific examples. Understanding the difference between a negotiation risk and a legal stop.",
    readTime: "5 min read",
    tag: "Guide",
    href: "/resources/rag-status",
  },
  {
    icon: Zap,
    category: "Case study",
    title: "Reducing review time from 4 hours to 20 minutes",
    description:
      "A detailed before-and-after walkthrough of a technology services agreement review at a financial services company.",
    readTime: "10 min read",
    tag: "Case study",
    href: "/resources/review-time-case-study",
  },
  {
    icon: Users,
    category: "Team",
    title: "Setting up your approval matrix",
    description:
      "The three escalation tiers Zane uses simultaneously. How to configure clause risk, value thresholds, and governance triggers.",
    readTime: "6 min read",
    tag: "Guide",
    href: "/resources/approval-matrix",
  },
  {
    icon: BarChart3,
    category: "Analytics",
    title: "Using the Portfolio Risk dashboard",
    description:
      "The four key metrics. The clause exposure chart. The counterparty risk analysis. And how to use the dashboard for board reporting.",
    readTime: "4 min read",
    tag: "Guide",
    href: "/resources/portfolio-dashboard",
  },
  {
    icon: Scale,
    category: "Legal",
    title: "Zane and the SRA Code of Conduct",
    description:
      "Can in-house solicitors use Zane without breaching their professional obligations? The short answer, with the relevant SRA paragraphs cited.",
    readTime: "5 min read",
    tag: "Legal",
    href: "/resources/sra-guidance",
  },
];

const FAQS = [
  {
    q: "Is Zane a law firm or providing legal advice?",
    a: "No. Zane is a decision support tool for in-house legal teams. It surfaces risks and suggests positions based on your playbook, but all decisions remain with your qualified lawyers. Zane does not provide legal advice and should not be relied upon as a substitute for professional legal judgment.",
  },
  {
    q: "What contract types does Zane support?",
    a: "Zane reviews any commercial contract in PDF or DOCX format. It works best on supplier agreements, customer agreements, NDAs, SaaS/tech contracts, employment agreements, and commercial leases. The playbook covers 22 clause categories across commercial and property contracts.",
  },
  {
    q: "How accurate is Zane's clause classification?",
    a: "Zane uses frontier LLMs (Claude Sonnet via OpenRouter) to classify and compare clauses. In testing on commercial contracts, clause identification accuracy is above 90% for clearly-drafted English law contracts. Performance may vary on heavily negotiated bespoke documents.",
  },
  {
    q: "What happens if Zane doesn't find a clause?",
    a: "Absent clauses are flagged as GREY - 'not found'. For high-risk categories like liability caps or data privacy, an absent clause is often itself a risk. Zane will flag this and suggest whether absence is acceptable given your playbook.",
  },
  {
    q: "Can Zane handle non-English contracts?",
    a: "Zane is optimised for English-language contracts under English, Scots, US, Singapore, and UAE law. Non-English contracts may produce lower confidence results. Multi-language support is on the roadmap.",
  },
  {
    q: "Does Zane replace my law firm?",
    a: "Zane is designed for the 80% of commercial contracts that don't need external counsel - the routine supplier paper that sits in inboxes for weeks. For high-value, heavily negotiated, or litigation-sensitive matters, you should always use qualified lawyers.",
  },
  {
    q: "What data does Zane store?",
    a: "Zane stores your company profile, playbook rules, uploaded documents (encrypted), and review results. Your contract text is processed by the LLM API for the purpose of review only. See our Security page for full details.",
  },
  {
    q: "Can I export Zane's review output?",
    a: "Export to PDF and Word is on the roadmap. Currently, review results are accessible in the Zane interface. Enterprise customers can access results via API.",
  },
];

const CLAUSE_EXPLAINERS = [
  { category: "Limitation of Liability", summary: "Caps the maximum financial exposure of each party. Often the most negotiated clause in any commercial contract." },
  { category: "Indemnity", summary: "One party agrees to cover the other's losses for specific events. Broader than liability caps - indemnities can operate outside the cap." },
  { category: "Force Majeure", summary: "Excuses performance during extraordinary events. Scope matters: does it cover pandemics, supply chain issues, or only 'Acts of God'?" },
  { category: "IP Ownership", summary: "Who owns what was created. Bespoke deliverables often need explicit assignment - default position may vest IP in the creator." },
  { category: "Warranties", summary: "Representations about the current state of affairs. Breach of warranty gives rise to damages without needing to prove negligence." },
  { category: "Dispute Resolution", summary: "How disagreements are resolved. Tiered escalation (commercial → mediation → arbitration) saves litigation costs." },
  { category: "Change of Control", summary: "Rights triggered by ownership changes. Without this, a competitor could acquire your supplier and inherit your contract." },
  { category: "Break Clause (leases)", summary: "Tenant's right to exit a lease early. Conditions - beyond vacant possession and no rent arrears - can make breaks unexercisable in practice." },
];

export default function Resources() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav matches landing page sticky header exactly */}
      <header className="sticky top-0 z-20 border-b border-white/8 backdrop-blur-md" style={{ background: "rgba(11,17,24,0.97)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <ZaneLogo size="sm" light={true} />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-xs">
            <Link to="/" className="text-white/50 hover:text-white transition-colors duration-300">Home</Link>
            <Link to="/case-study" className="text-white/50 hover:text-white transition-colors duration-300">Case study</Link>
            <Link to="/resources" className="text-white hover:text-white transition-colors duration-300">Resources</Link>
            <Link to="/security" className="text-white/50 hover:text-white transition-colors duration-300">Security</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-4 py-1.5 text-sm text-white/50 hover:text-white transition-colors duration-300">Sign in</Link>
            <Link to="/register"
              className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow shadow-primary/20">
              Get started <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-6">
          <BookOpen size={12} />
          Resources & Learning
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">
          Everything you need to{" "}
          <span className="bg-gradient-to-r from-primary to-teal-400 bg-clip-text text-transparent">
            get up to speed
          </span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Guides, explainers, and FAQs for in-house teams deploying Zane for the first time.
        </p>
      </section>

      {/* Guides */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-xl font-bold mb-6">Guides & case studies</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {GUIDES.map(({ icon: Icon, category, title, description, readTime, tag, href }) => (
            <Link
              key={title}
              to={href}
              className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3 hover:border-primary/40 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                  {category}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {tag}
                </span>
              </div>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon size={16} className="text-primary" />
              </div>
              <h3 className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1">{description}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t border-border">
                <FileText size={11} />
                {readTime}
              </div>
            </Link>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-6 text-center">
          Full guide library coming soon. <a href="mailto:ahmed@zanelegal.ai" className="text-primary hover:underline">Email us</a> if you need help with a specific use case.
        </p>
      </section>

      {/* Clause explainers */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-xl font-bold mb-2">Clause explainers</h2>
        <p className="text-muted-foreground text-sm mb-8">
          Plain-English summaries of the clause categories Zane reviews.
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          {CLAUSE_EXPLAINERS.map(({ category, summary }) => (
            <div
              key={category}
              className="rounded-xl border border-border bg-card px-5 py-4"
            >
              <h3 className="text-sm font-medium mb-1">{category}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{summary}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-5 text-center">
          Zane reviews 22 clause categories in total - 10 standard commercial + 4 property-specific + 8 general commercial.
        </p>
      </section>

      {/* FAQs */}
      <section className="max-w-3xl mx-auto px-6 pb-24">
        <h2 className="text-xl font-bold mb-8 text-center">Frequently asked questions</h2>
        <div className="space-y-4">
          {FAQS.map(({ q, a }) => (
            <div key={q} className="rounded-xl border border-border bg-card px-6 py-5">
              <h3 className="text-sm font-semibold mb-2">{q}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-24 text-center">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-10">
          <h2 className="text-2xl font-bold mb-3">Ready to run your first review?</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            Upload a contract, set your playbook, and get a structured risk report.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Zap size={14} />
            Get started free
          </Link>
        </div>
      </section>

      {/* Footer matches landing page footer exactly */}
      <footer className="border-t border-black/6 mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <ZaneLogo size="sm" light={false} />
          </Link>
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <Link to="/case-study" className="hover:text-gray-600 transition-colors">Case study</Link>
            <Link to="/security" className="hover:text-gray-600 transition-colors">Security</Link>
            <Link to="/resources" className="hover:text-gray-600 transition-colors">Resources</Link>
            <span>2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
