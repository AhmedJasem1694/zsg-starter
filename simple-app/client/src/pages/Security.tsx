import { Shield, Lock, Eye, Server, FileCheck, RefreshCw, CheckCircle2, Clock, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { ZaneLogo } from "@/components/ZaneLogo";

const PILLARS = [
  {
    icon: Lock,
    title: "Encryption at Rest & in Transit",
    description:
      "All data is encrypted at rest using AES-256. All communications use TLS 1.3. Encryption keys are never stored alongside data.",
    checks: [
      "AES-256 encryption for all stored data",
      "TLS 1.3 for all API and web traffic",
      "Encrypted database backups",
      "Secrets managed via environment variables - never hardcoded",
    ],
  },
  {
    icon: Eye,
    title: "Access Controls",
    description:
      "Strict role-based access control limits what each user can see and do. All access events are logged with full audit trails.",
    checks: [
      "Role-based access control (RBAC)",
      "JWT sessions with configurable expiry",
      "bcrypt password hashing (cost factor 12)",
      "Structured audit log of all significant actions",
    ],
  },
  {
    icon: Server,
    title: "Data Isolation",
    description:
      "Each organisation's data is logically isolated. Your playbook rules, contracts, and review results are never accessible to other organisations.",
    checks: [
      "Per-organisation data isolation",
      "No cross-tenant data access",
      "Uploaded files stored with randomised filenames",
      "All database queries scoped to authenticated company",
    ],
  },
  {
    icon: FileCheck,
    title: "Document Handling",
    description:
      "Uploaded contracts are processed in memory. Documents are never used to train models. Your contracts are yours.",
    checks: [
      "Contracts never used for model training",
      "Files stored with nanoid randomised names",
      "No document content logged to external services",
      "Secure deletion on company off-boarding",
    ],
  },
  {
    icon: RefreshCw,
    title: "LLM Data Privacy",
    description:
      "Contract text is anonymised before any model call - party names and sensitive identifiers are replaced with placeholders and restored in your output.",
    checks: [
      "PII anonymisation before every LLM call",
      "Contract text sent as ephemeral user message, not cached system prompt",
      "No contract data retained by model provider beyond session",
      "Configurable model routing - use your own API keys",
    ],
  },
  {
    icon: Shield,
    title: "Infrastructure Security",
    description:
      "Zane is designed to run on your own infrastructure or in a dedicated cloud environment. No shared compute or multi-tenant processing queues.",
    checks: [
      "Self-hosted deployment option available",
      "No shared processing queues",
      "Health endpoints expose no user data",
      "All secrets injected at runtime via environment variables",
    ],
  },
];

// ── Split into "current" (verifiable today) vs "enterprise / roadmap"
const COMPLIANCE_CURRENT = [
  {
    name: "UK GDPR",
    label: "Designed for compliance",
    detail: "Architecture aligns with UK GDPR obligations. Data Processing Agreement available on Enterprise tier.",
  },
  {
    name: "EU GDPR",
    label: "Designed for compliance",
    detail: "Architecture aligns with EU GDPR obligations. Standard Contractual Clauses available on Enterprise tier.",
  },
];

const COMPLIANCE_ENTERPRISE = [
  {
    name: "ISO 27001",
    label: "Roadmap",
    detail: "Controls framework aligned to ISO 27001. Formal certification is on our enterprise roadmap.",
  },
  {
    name: "SOC 2 Type II",
    label: "Roadmap",
    detail: "Controls framework in place. Third-party audit is on our enterprise roadmap.",
  },
  {
    name: "Cyber Essentials",
    label: "In assessment",
    detail: "Self-assessment in progress. Certification targeted ahead of enterprise general availability.",
  },
  {
    name: "Penetration Testing",
    label: "Available on Enterprise",
    detail: "Penetration test report available to Enterprise customers on request under NDA.",
  },
];

export default function Security() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/40 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <Link to="/" className="hover:opacity-80 transition-opacity">
          <ZaneLogo size="sm" />
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Home</Link>
          <Link to="/resources" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Resources</Link>
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign in</Link>
          <Link
            to="/register"
            className="text-sm bg-primary text-white px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-6">
          <Shield size={12} />
          Security & Trust
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">
          Your contracts stay{" "}
          <span className="bg-gradient-to-r from-primary to-teal-400 bg-clip-text text-transparent">
            yours
          </span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Zane is built for legal teams handling sensitive commercial agreements. Security controls are
          designed so you can review counterparty paper without putting client data at risk.
        </p>
      </section>

      {/* Pillars */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="mb-8 text-center">
          <h2 className="text-xl font-bold mb-2">Current security architecture</h2>
          <p className="text-sm text-muted-foreground">Controls that are live in the platform today</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PILLARS.map(({ icon: Icon, title, description, checks }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon size={18} className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-2">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
              </div>
              <ul className="space-y-1.5 mt-auto pt-2 border-t border-border">
                {checks.map((c) => (
                  <li key={c} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 size={12} className="text-primary mt-0.5 shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Compliance - Current */}
      <section className="max-w-4xl mx-auto px-6 pb-12">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-1">Compliance alignment</h2>
          <p className="text-muted-foreground text-sm">
            What Zane is designed for - and what requires Enterprise engagement.
          </p>
        </div>

        {/* Current alignment */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={14} className="text-[#86EFAC]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Current</span>
          </div>
          <div className="space-y-3">
            {COMPLIANCE_CURRENT.map(({ name, label, detail }) => (
              <div
                key={name}
                className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4"
              >
                <CheckCircle2 size={18} className="text-[#86EFAC] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-0.5">
                    <span className="text-sm font-medium">{name}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide bg-[#86EFAC]/10 text-[#86EFAC]">
                      {label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Enterprise / roadmap */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Enterprise & Roadmap</span>
          </div>
          <div className="space-y-3">
            {COMPLIANCE_ENTERPRISE.map(({ name, label, detail }) => (
              <div
                key={name}
                className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4"
              >
                <Clock size={18} className="text-muted-foreground/50 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-0.5">
                    <span className="text-sm font-medium">{name}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide bg-muted text-muted-foreground">
                      {label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data residency */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="rounded-2xl border border-border bg-card p-8 md:p-10">
          <h2 className="text-xl font-bold mb-3">Data residency & hosting</h2>
          <div className="grid md:grid-cols-2 gap-6 text-sm text-muted-foreground leading-relaxed">
            <div>
              <h3 className="text-foreground font-medium mb-2">Cloud deployment</h3>
              <p>
                Zane's cloud offering runs in UK/EU data centres. Your contract data never leaves
                your chosen jurisdiction. Separate environments are available for EU GDPR and UK GDPR compliance.
              </p>
            </div>
            <div>
              <h3 className="text-foreground font-medium mb-2">Self-hosted option</h3>
              <p>
                Enterprise customers can deploy Zane entirely within their own infrastructure.
                Bring your own cloud, your own database, and your own LLM API keys.
                Zero data leaves your environment.
              </p>
            </div>
            <div>
              <h3 className="text-foreground font-medium mb-2">LLM routing</h3>
              <p>
                Zane routes LLM calls via OpenRouter. Enterprise customers can configure direct
                API integration with Anthropic, OpenAI, or Azure OpenAI for dedicated zero-retention
                processing agreements.
              </p>
            </div>
            <div>
              <h3 className="text-foreground font-medium mb-2">Deletion & off-boarding</h3>
              <p>
                Customers can delete their organisation and all associated data at any time.
                A signed off-boarding request triggers secure deletion within 30 days,
                with written confirmation provided.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="max-w-4xl mx-auto px-6 pb-24 text-center">
        <h2 className="text-2xl font-bold mb-3">Responsible disclosure</h2>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto mb-6">
          If you discover a security vulnerability, please report it responsibly.
          We commit to acknowledging reports within 24 hours and providing a fix timeline within 72 hours.
        </p>
        <a
          href="mailto:ahmed@zanelegal.ai"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-card text-sm font-medium hover:bg-accent transition-colors"
        >
          <Shield size={14} />
          ahmed@zanelegal.ai
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>© 2026 Zane Legal Decision Engine</span>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link to="/resources" className="hover:text-foreground transition-colors">Resources</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
