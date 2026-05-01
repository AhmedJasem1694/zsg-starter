import { Shield, Lock, Eye, Server, FileCheck, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

const PILLARS = [
  {
    icon: Lock,
    title: "Encryption at Rest & in Transit",
    description:
      "All data is encrypted at rest using AES-256. All communications use TLS 1.3. Encryption keys are rotated automatically and never stored alongside data.",
    checks: [
      "AES-256 encryption for all stored data",
      "TLS 1.3 for all API and web traffic",
      "Automatic key rotation",
      "Encrypted database backups",
    ],
  },
  {
    icon: Eye,
    title: "Access Controls",
    description:
      "Strict role-based access control (RBAC) limits what each user can see and do. All access events are logged with full audit trails.",
    checks: [
      "Role-based access control (RBAC)",
      "JWT sessions with 30-day expiry",
      "bcrypt password hashing (cost factor 12)",
      "Full audit log of all access events",
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
      "Database queries scoped to authenticated company",
    ],
  },
  {
    icon: FileCheck,
    title: "Document Handling",
    description:
      "Uploaded contracts are processed in memory and stored encrypted. Documents are never used to train models. Your contracts are yours.",
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
      "MIKE uses OpenRouter to access frontier models. Contract text is sent to the model only for the purpose of the review. Ephemeral prompt caching is used for playbook context - no contract data is cached.",
    checks: [
      "Prompt caching applied only to playbook rules (not contract text)",
      "No contract data retained by model provider beyond session",
      "OpenRouter zero-data-retention option available on Enterprise",
      "Configurable model routing - use your own API keys",
    ],
  },
  {
    icon: Shield,
    title: "Infrastructure Security",
    description:
      "MIKE is designed to run on your own infrastructure or in a dedicated cloud environment. No shared compute or multi-tenant processing queues.",
    checks: [
      "Self-hosted deployment option available",
      "No shared processing queues",
      "Environment variables for all secrets - never hardcoded",
      "Health endpoint monitoring with no data exposure",
    ],
  },
];

const COMPLIANCE = [
  { name: "UK GDPR", status: "compliant", detail: "Data Processing Agreement available. UK SCCs for international transfers." },
  { name: "EU GDPR", status: "compliant", detail: "DPA available. Standard Contractual Clauses for EEA data transfers." },
  { name: "ISO 27001", status: "in-progress", detail: "Aligned to ISO 27001 controls. Formal certification roadmap for 2025." },
  { name: "SOC 2 Type II", status: "in-progress", detail: "Controls framework in place. Audit scheduled for 2025." },
  { name: "Cyber Essentials", status: "compliant", detail: "Meets all Cyber Essentials baseline controls." },
];

export default function Security() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/40 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <span className="font-semibold text-sm">MIKE</span>
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
          MIKE is built for legal teams handling sensitive commercial agreements. We apply enterprise-grade
          security controls so you can review counterparty paper without putting client data at risk.
        </p>
      </section>

      {/* Pillars */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
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

      {/* Compliance */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold mb-2 text-center">Compliance status</h2>
        <p className="text-muted-foreground text-sm text-center mb-10">
          Current certification and regulatory alignment status.
        </p>
        <div className="space-y-3">
          {COMPLIANCE.map(({ name, status, detail }) => (
            <div
              key={name}
              className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4"
            >
              {status === "compliant" ? (
                <CheckCircle2 size={18} className="text-green-500 shrink-0" />
              ) : (
                <AlertCircle size={18} className="text-amber-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-0.5">
                  <span className="text-sm font-medium">{name}</span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                      status === "compliant"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {status === "compliant" ? "Compliant" : "In Progress"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{detail}</p>
              </div>
            </div>
          ))}
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
                MIKE's cloud offering runs in UK/EU data centres. Your contract data never leaves
                your chosen jurisdiction. Separate environments are available for EU GDPR and UK GDPR compliance.
              </p>
            </div>
            <div>
              <h3 className="text-foreground font-medium mb-2">Self-hosted option</h3>
              <p>
                Enterprise customers can deploy MIKE entirely within their own infrastructure.
                Bring your own cloud, your own database, and your own LLM API keys.
                Zero data leaves your environment.
              </p>
            </div>
            <div>
              <h3 className="text-foreground font-medium mb-2">LLM routing</h3>
              <p>
                MIKE routes LLM calls via OpenRouter. Enterprise customers can configure direct
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
          href="mailto:security@usemike.ai"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-card text-sm font-medium hover:bg-accent transition-colors"
        >
          <Shield size={14} />
          security@usemike.ai
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>© 2025 MIKE Legal Decision Engine</span>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link to="/resources" className="hover:text-foreground transition-colors">Resources</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
