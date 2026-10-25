/**
 * Security page copy, in one place.
 *
 * This page was rewritten because almost none of it was true. Of nineteen
 * claims checked against the codebase, twelve were false: encryption at rest,
 * encrypted backups, key management, role-based access control, a bcrypt cost
 * factor, in-memory document processing, secure deletion on off-boarding,
 * self-hosting, customer-supplied API keys, UK/EU data residency, provider
 * retention terms, and "secrets never hardcoded".
 *
 * The rule for this file is the rule for the whole public site: every sentence
 * that states what Zane does maps to an entry in ALLOWED_CLAIMS. What is new
 * here is the second half, NOT_DONE. A security page for an early product is
 * more useful to a general counsel when it says what is missing, and the
 * absences are the exact things a buyer would otherwise assume. Each one maps
 * to a NOT_YET_CLAIMS entry so it cannot quietly return as a feature.
 *
 * Before adding anything to TODAY, open the claim it rests on and check the
 * code still says what the claim says.
 */

export interface SecurityPoint {
  title: string;
  body: string;
  /** Ids from ALLOWED_CLAIMS this point depends on. */
  claims: string[];
}

export interface Absence {
  title: string;
  body: string;
  /** Id from NOT_YET_CLAIMS that records why this must not be claimed. */
  notYet: string;
}

export const SECURITY_PAGE = {
  nav: {
    links: [
      { to: "/", label: "Home" },
      { to: "/case-study", label: "Case study" },
      { to: "/resources", label: "Resources" },
      { to: "/security", label: "Security" },
    ],
    signInLabel: "Sign in",
    signInHref: "/login",
    /**
     * Kept as it was. /register is a live route rendering the Register page.
     * Worth noting that a self-serve sign-up sits awkwardly beside the
     * homepage, which says onboarding is done personally and asks for a
     * conversation. That is a product question, not a copy fix, so the button
     * stays until someone decides which of the two is right.
     */
    ctaLabel: "Get started",
    ctaHref: "/register",
  },

  hero: {
    eyebrow: "Security",
    headline: "What happens to your contracts, precisely.",
    body: "Zane is early and privately piloted. This page describes what the product does today and, below that, what it does not do. Where something is not built, it says so rather than describing the intention.",
  },

  today: {
    heading: "What the product does today",
    subheading: "Each of these is implemented and can be shown in the code.",
  },

  /** Verified against the codebase on 25 October 2026. */
  TODAY: [
    {
      title: "Personal data is removed before any model call",
      body: "Party names, emails, phone numbers, postcodes and bank identifiers are replaced with placeholders before text leaves the server, and restored afterwards. The reversal map is stored by Zane and is never returned to the browser.",
      claims: ["anonymisation"],
    },
    {
      title: "Your wording is never rewritten",
      body: "Clause text is taken from your document, not from model output. The model that sorts clauses returns positions in the text, never the text itself, and stored clauses are written once and never updated.",
      claims: ["source-text-integrity"],
    },
    {
      title: "Contract text is sent, not cached",
      body: "Text travels as an ordinary message in a single request. Zane uses no prompt caching, so nothing is held between calls on our side.",
      claims: ["llm-transport"],
    },
    {
      title: "Nothing is sent to an analytics service",
      body: "There is no telemetry, no analytics and no external logging in the product. Logs go to the server console and record lengths, counts and categories rather than the text of your contracts.",
      claims: ["no-telemetry"],
    },
    {
      title: "Uploads are stored under randomised names",
      body: "A file is written under a generated identifier rather than the name it arrived with, so the directory listing does not disclose counterparties or deal names. The original name is kept in the database for display.",
      claims: ["file-naming"],
    },
    {
      title: "Every significant action is recorded",
      body: "Uploads, reviews, decisions, escalations and approvals are written to an audit trail, readable across the business and per contract, with the reason captured on every approval decision.",
      claims: ["audit-trail", "approval-decision"],
    },
    {
      title: "Not tied to one model vendor",
      body: "Model calls are routed per task through a single client, so the provider behind a given task can change without changing the product.",
      claims: ["model-routing"],
    },
  ] as SecurityPoint[],

  notDone: {
    heading: "What Zane does not do",
    subheading:
      "Plainly, because a buyer would reasonably assume otherwise. Ask for any of these and the answer will be a date, not a yes.",
  },

  NOT_DONE: [
    {
      title: "No certifications",
      body: "Zane holds no ISO 27001, SOC 2 or Cyber Essentials certification, and there is no penetration test report. None of these is in progress.",
      notYet: "certifications",
    },
    {
      title: "No encryption at rest by Zane",
      body: "The application encrypts nothing itself. Uploaded files and extracted clause text are stored as ordinary data, protected by the hosting platform and by access control rather than by cryptography we apply.",
      notYet: "encryption-at-rest",
    },
    {
      title: "No backups",
      body: "There is no backup or restore mechanism. Data loss at the hosting layer would be data loss.",
      notYet: "backups",
    },
    {
      title: "No guaranteed hosting region",
      body: "Nothing in the product pins a region or offers a choice of jurisdiction. The current region can be confirmed on request, but it is not a contractual control today.",
      notYet: "data-residency",
    },
    {
      title: "No retention agreement with the model provider",
      body: "Anonymisation before each call is ours and is real. What the model provider does with what it receives is governed by its own terms, and Zane sends no retention or training instruction. Anyone telling you otherwise is describing something that is not built.",
      notYet: "provider-retention",
    },
    {
      title: "No role-based access control",
      body: "Any signed-in member of your company can act on anything in your account, including recording an approval decision routed to someone else. Roles are shown in the record; they do not restrict what a person can do.",
      notYet: "rbac",
    },
    {
      title: "No self-hosting, no bring-your-own keys",
      body: "Zane runs as a hosted service with its own model credentials. There is no deployment you can run yourself and no way to supply your own provider keys.",
      notYet: "self-hosting",
    },
    {
      title: "No automated deletion",
      body: "Contracts can be deleted from the library in the product. Removing an account and everything attached to it is a manual request to a person, not a button, and no deletion window is promised.",
      notYet: "offboarding-deletion",
    },
  ] as Absence[],

  processing: {
    heading: "Personal data and GDPR",
    body: "Contracts contain personal data, and Zane processes it to review them: names, contact details and anything else the document happens to carry. Anonymisation runs before any model call. A data processing agreement can be discussed as part of a pilot conversation rather than being offered as a standard document today.",
    noteBefore: "Full data-processing details on request:",
    email: "ahmed@zanelegal.ai",
  },

  disclosure: {
    heading: "Reporting a vulnerability",
    /**
     * The old version promised acknowledgement within 24 hours and a fix
     * timeline within 72. One person is building Zane and no on-call rota
     * exists, so that was a service level nobody was holding.
     */
    body: "If you find a security problem, please report it to the address below rather than disclosing it publicly. Reports are read by the person building Zane and answered directly.",
    email: "ahmed@zanelegal.ai",
  },

  footer: {
    copyright: "2026 Zane",
    links: [
      { to: "/", label: "Home" },
      { to: "/resources", label: "Resources" },
    ],
  },
};
