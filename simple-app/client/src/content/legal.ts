/**
 * Legal page copy: privacy notice and website terms.
 *
 * DRAFTS. Both carry a banner saying so, and neither is in force until someone
 * removes it deliberately. Every fact that only the business can supply is
 * marked [TODO] rather than guessed: there is no company number, registered
 * address, trading name or supervisory-authority registration in this
 * repository, and inventing any of them would put a false statement on a
 * public legal page.
 *
 * Where this describes the product it is grounded in the code, not aspiration.
 * The processing described matches ALLOWED_CLAIMS and the limits recorded in
 * NOT_YET_CLAIMS: contract text goes to a model routing service, personal data
 * is removed before it does and restored after, no retention or training
 * instruction is sent to the provider, uploaded files are kept after review,
 * and there are no backups. A privacy notice that contradicted any of that
 * would be the most expensive kind of wrong.
 *
 * Reviewer: anything in square brackets needs a decision. Everything else is a
 * statement about the product that can be checked against the codebase.
 */

export interface LegalBlock {
  heading: string;
  /** Prose paragraphs in reading order. */
  paragraphs?: string[];
  /** Flat list. Used where enumeration is clearer than prose. */
  bullets?: string[];
  /** Label and value pairs, for things like lawful bases per purpose. */
  rows?: Array<{ label: string; value: string }>;
}

export interface LegalPage {
  title: string;
  /** Shown under the title. Not a commitment to a review cadence. */
  updatedLabel: string;
  intro: string[];
  blocks: LegalBlock[];
}

/** Removing this line is the act of putting the page into force. Do it deliberately. */
export const LEGAL_BANNER = "Draft for review. Not yet in force.";

export const LEGAL_NAV = {
  links: [
    { to: "/", label: "Home" },
    { to: "/security", label: "Security" },
    { to: "/privacy", label: "Privacy" },
    { to: "/terms", label: "Terms" },
  ],
};

export const CONTACT_EMAIL = "ahmed@zanelegal.ai";

// ── Privacy notice ────────────────────────────────────────────────────────────

export const PRIVACY: LegalPage = {
  title: "Privacy notice",
  updatedLabel: "Last updated: [TODO: date this notice is approved]",
  intro: [
    "This notice explains what personal data Zane collects, why, and what rights you have over it. It covers both this website and the Zane product.",
    "It is written for UK GDPR and the Data Protection Act 2018. [TODO: confirm with the reviewing solicitor whether EU GDPR also applies, which depends on whether customers or their counterparties are established in the EU.]",
  ],
  blocks: [
    {
      heading: "Who is responsible for your data",
      paragraphs: [
        "[TODO: registered company name] is the controller for personal data collected through this website, and for the personal data of the people who use the product.",
        "[TODO: registered company number]. [TODO: registered office address]. Neither is recorded anywhere in this product, so both must be supplied rather than assumed.",
        "For personal data contained inside contracts that a customer uploads, the customer is the controller and Zane is a processor acting on their instructions. [TODO: confirm this split with the reviewing solicitor, and confirm whether a separate data processing agreement is needed before the first paying customer.]",
      ],
    },
    {
      heading: "What we collect through this website",
      bullets: [
        "The contact form: your name, work email address, company name, role, and anything you choose to write in the optional free-text field.",
        "The technical information any web server receives with a request, including your IP address. The contact form records the IP address of a submission to limit abuse of the form.",
        "[TODO: confirm whether any analytics or cookie-based measurement will be added. There is none in the product today, and none is described here because none exists. If any is added, this section and a cookie notice must be written before it ships.]",
      ],
    },
    {
      heading: "What we collect through the product",
      bullets: [
        "Account data: name, email address, and the role recorded against your account.",
        "The contracts you upload, and anything inside them. Commercial contracts routinely contain personal data such as signatory names, job titles, contact details and addresses. We do not control what a counterparty puts in a document.",
        "A record of actions taken in the product: uploads, reviews, decisions, escalations and approvals, together with the reason given for an approval decision and the identity of the person who recorded it.",
        "Files you add alongside a contract, including any supporting documents or recordings.",
      ],
    },
    {
      heading: "Why we use it, and on what lawful basis",
      rows: [
        {
          label: "Responding to a contact form submission",
          value: "Legitimate interests: replying to someone who has asked us to get in touch. You can ask us to delete the enquiry at any time.",
        },
        {
          label: "Providing the product to a customer",
          value: "Performance of a contract with the customer organisation. For individual users within that organisation, legitimate interests in operating the service they have been given access to.",
        },
        {
          label: "Reviewing contracts, including any personal data they contain",
          value: "Performance of a contract with the customer, who instructs the processing. [TODO: the reviewing solicitor should confirm whether any special category data is foreseeable in the contract types in scope, and if so what additional condition applies.]",
        },
        {
          label: "Keeping a record of decisions and approvals",
          value: "Legitimate interests in maintaining an auditable record, which is the purpose of the product, and the customer's own legal and governance obligations.",
        },
        {
          label: "Securing the service and preventing abuse",
          value: "Legitimate interests in keeping the service available and not being used to send unsolicited mail.",
        },
      ],
    },
    {
      heading: "Who else processes it",
      paragraphs: [
        "We use third parties to run the service. They act on our instructions and are named here by category, because the specific suppliers may change.",
      ],
      bullets: [
        "Hosting and database: the platform that runs the application and stores its data. [TODO: name the hosting provider and the region in which data is stored. No region is pinned anywhere in the product today, so this must be established as a fact before it is written down.]",
        "Email delivery: the service that sends notifications, approval requests and replies to contact form submissions. [TODO: name the email provider.]",
        "AI model providers, reached through a model routing service: contract text is sent to a routing service which forwards it to one of several model providers. Before any text is sent, party names and personal identifiers such as email addresses, telephone numbers, postcodes and bank details are replaced with placeholders, and restored only after the response comes back. [TODO: name the routing service and the model providers currently in use, and obtain their data processing terms.]",
        "[TODO: list any other processor, for example a document storage integration, once one is in use.]",
      ],
    },
    {
      heading: "A limitation you should know about",
      paragraphs: [
        "Anonymisation before a model call is ours and it is real. What a model provider does with the text it receives is governed by that provider's own terms. The product does not send any instruction to a provider asking it to withhold data from training or to delete it after the request, and it would be wrong to tell you otherwise.",
        "[TODO: once provider terms are obtained, replace this paragraph with what those terms actually commit the providers to.]",
      ],
    },
    {
      heading: "Sending data outside the UK",
      paragraphs: [
        "Some of the processors above may store or handle data outside the United Kingdom.",
        "[TODO: this section cannot be completed honestly until hosting and processor regions are established. Once they are, state for each processor where data goes and which transfer mechanism applies, for example UK adequacy regulations or the International Data Transfer Addendum to the EU Standard Contractual Clauses. Do not state a region until it is a verified fact about the deployment.]",
      ],
    },
    {
      heading: "How long we keep it",
      bullets: [
        "Contact form submissions: [TODO: decide a retention period, for example 24 months from last contact.]",
        "Account data: for as long as the account exists, and then [TODO: decide a period].",
        "Contracts and the review results drawn from them: for as long as the customer's account exists. Uploaded files remain stored after a review is complete; they are not deleted automatically.",
        "The record of actions and decisions: retained for the life of the account, because deleting it would defeat the purpose of keeping it. [TODO: decide whether a maximum period applies.]",
        "Deleting a whole account and everything attached to it is currently a manual request handled by a person rather than an automated process. [TODO: decide and state the period within which that will be completed.]",
      ],
    },
    {
      heading: "Your rights",
      paragraphs: [
        "Under UK GDPR you have the right to ask for a copy of your personal data, to have inaccurate data corrected, to have data erased in some circumstances, to restrict or object to processing, and to receive certain data in a portable form. Where we rely on legitimate interests, you can object and we will stop unless we have compelling grounds to continue.",
        "If the personal data is inside a contract uploaded by a customer, that customer is the controller and we will refer your request to them.",
        "To exercise any of these rights, contact us using the details below. You also have the right to complain to the Information Commissioner's Office, the UK supervisory authority, at ico.org.uk.",
        "[TODO: confirm whether the company is required to register with the ICO and pay the data protection fee, and add the registration number here once it exists. Most organisations processing personal data electronically are required to register.]",
      ],
    },
    {
      heading: "Security",
      paragraphs: [
        "What the product does and does not do to protect data is described in detail on the security page, including the things it does not yet do. Please read it before relying on this service for sensitive material.",
        "[TODO: once the measures described there change, revisit this notice and the security page together so they cannot drift apart.]",
      ],
    },
    {
      heading: "Changes to this notice",
      paragraphs: [
        "If this notice changes materially we will update the date at the top and, where the change affects customers, tell them directly.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        `Questions about this notice or about your data can be sent to ${CONTACT_EMAIL}.`,
        "[TODO: confirm whether a Data Protection Officer is required. For an organisation of this size and activity it is unlikely to be mandatory, but the decision should be recorded.]",
      ],
    },
  ],
};

// ── Website terms of use ──────────────────────────────────────────────────────

export const TERMS: LegalPage = {
  title: "Terms of use",
  updatedLabel: "Last updated: [TODO: date these terms are approved]",
  intro: [
    "These terms govern your use of this website. They do not govern use of the Zane product itself, which is provided under a separate agreement with the customer organisation.",
    "[TODO: the product subscription terms are a separate document and have not been drafted. Do not rely on this page as a substitute for them.]",
  ],
  blocks: [
    {
      heading: "Who we are",
      paragraphs: [
        "This website is operated by [TODO: registered company name], [TODO: registered company number], whose registered office is at [TODO: registered office address].",
      ],
    },
    {
      heading: "Using this site",
      paragraphs: [
        "You may read this site and use the contact form to get in touch. Please do not use the site in a way that breaks any law, interferes with the site or anyone else's use of it, or attempts to gain access to any part of it you have not been given access to.",
        "We may change or withdraw any part of this site at any time. The site is provided as it is, and we do not promise it will always be available or free of errors.",
      ],
    },
    {
      heading: "Information on this site",
      paragraphs: [
        "The content of this site is for general information about the product. It is not legal advice and must not be relied on as legal advice. Zane is a tool used by legal and finance teams; it does not replace a qualified adviser, and no part of this site creates a solicitor and client relationship.",
        "We try to keep what we publish about the product accurate and current. If you find something on this site that is wrong, please tell us using the contact details below.",
      ],
    },
    {
      heading: "The contact form",
      paragraphs: [
        "When you submit the contact form, we use the details you give us to reply. How we handle that data is set out in the privacy notice.",
        "Please do not send confidential or privileged material through the contact form or by email before an agreement is in place.",
      ],
    },
    {
      heading: "Intellectual property",
      paragraphs: [
        "The content, design, wordmark and software behind this site belong to [TODO: registered company name] or are used with permission. You may not copy or reuse them except as the law allows or as we have agreed in writing.",
      ],
    },
    {
      heading: "Links to other sites",
      paragraphs: [
        "Where this site links elsewhere, those sites are not under our control and we are not responsible for their content.",
      ],
    },
    {
      heading: "Our responsibility to you",
      paragraphs: [
        "Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot lawfully be limited.",
        "Subject to that, we are not responsible for any loss arising from use of this site, in particular any business loss such as lost profit, lost revenue, lost data or lost opportunity.",
        "[TODO: the reviewing solicitor should set the liability position for the website, and confirm it is consistent with the product subscription terms once those exist.]",
      ],
    },
    {
      heading: "Changes to these terms",
      paragraphs: [
        "We may change these terms. The version on this page is the one that applies, and the date at the top shows when it last changed.",
      ],
    },
    {
      heading: "Governing law",
      paragraphs: [
        "These terms are governed by the law of England and Wales, and the courts of England and Wales have exclusive jurisdiction. [TODO: confirm this is right for the intended customer base.]",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [`You can reach us at ${CONTACT_EMAIL}.`],
    },
  ],
};
