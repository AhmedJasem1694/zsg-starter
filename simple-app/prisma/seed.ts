/**
 * MIKE seed — creates a demo company + full MODERATE playbook.
 * Run with:  npm run db:seed
 *
 * Safe to re-run: clears the demo company and recreates it.
 * Does NOT affect any real company created through onboarding.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_COMPANY = {
  name:         "MIKE Demo Co",
  sector:       "Technology / SaaS",
  jurisdiction: "England & Wales",
  role:         "BUYER",
  riskAppetite: "MODERATE",
  industry:     "TECHNOLOGY_SAAS",
  persona:      "CORPORATE",
};

// Moderate-appetite defaults covering all 60 clause categories
const PLAYBOOK_RULES: Array<{
  clauseCategory: string;
  preferredPosition: string;
  acceptableFallback: string;
  hardRedLine: string;
  approvalRequired?: string;
  riskWeight: number;
}> = [
  {
    clauseCategory: "LIABILITY_CAP",
    preferredPosition: "Liability capped at 12 months fees. Confidentiality, data breach, IP infringement uncapped.",
    acceptableFallback: "6 months fees with confidentiality and data breach carved out.",
    hardRedLine: "Cap covering data breach or IP infringement liability.",
    approvalRequired: "GC",
    riskWeight: 5,
  },
  {
    clauseCategory: "INDEMNITY",
    preferredPosition: "Mutual indemnity for IP infringement and data breaches.",
    acceptableFallback: "Supplier indemnifies for its own IP and data breach; our exposure limited to misuse.",
    hardRedLine: "Uncapped unilateral indemnity against us.",
    approvalRequired: "GC",
    riskWeight: 5,
  },
  {
    clauseCategory: "IP_OWNERSHIP",
    preferredPosition: "Bespoke deliverables vest in us. Supplier retains background IP with licence.",
    acceptableFallback: "Joint ownership of bespoke deliverables with unrestricted licence to both parties.",
    hardRedLine: "Supplier owns all deliverables with no licence back.",
    riskWeight: 4,
  },
  {
    clauseCategory: "CONFIDENTIALITY",
    preferredPosition: "Mutual, 3-year post-termination confidentiality obligation.",
    acceptableFallback: "2-year obligation with standard residuals carve-out.",
    hardRedLine: "Less than 1 year post-termination.",
    riskWeight: 3,
  },
  {
    clauseCategory: "DATA_PRIVACY",
    preferredPosition: "DPA in place. Supplier is processor. Audit rights included.",
    acceptableFallback: "DPA in place with reasonable audit notice requirements.",
    hardRedLine: "No DPA where personal data is being processed.",
    approvalRequired: "LEGAL",
    riskWeight: 5,
  },
  {
    clauseCategory: "TERMINATION",
    preferredPosition: "60-day convenience termination. Immediate for material uncured breach.",
    acceptableFallback: "90-day convenience. 20-day cure period for breach.",
    hardRedLine: "No convenience termination right.",
    riskWeight: 4,
  },
  {
    clauseCategory: "PAYMENT_TERMS",
    preferredPosition: "30-day payment terms.",
    acceptableFallback: "45-day payment terms. Indexed price increases.",
    hardRedLine: "Payment within 7 days.",
    riskWeight: 3,
  },
  {
    clauseCategory: "AUTO_RENEWAL",
    preferredPosition: "No auto-renewal or 60 days notice required.",
    acceptableFallback: "Auto-renewal with 30 days notice.",
    hardRedLine: "Auto-renewal with less than 14 days notice.",
    riskWeight: 3,
  },
  {
    clauseCategory: "GOVERNING_LAW",
    preferredPosition: "English law. English courts.",
    acceptableFallback: "English law. Arbitration acceptable.",
    hardRedLine: "Foreign law without agreed dispute resolution.",
    riskWeight: 2,
  },
  {
    clauseCategory: "AUDIT_RIGHTS",
    preferredPosition: "Annual audit right on 10 days notice.",
    acceptableFallback: "Audit right on 15 days notice, once per year.",
    hardRedLine: "No audit right.",
    riskWeight: 2,
  },
  {
    clauseCategory: "FORCE_MAJEURE",
    preferredPosition: "Force majeure limited to events beyond reasonable control. 14-day notice; 6-month long-stop triggers mutual termination right.",
    acceptableFallback: "Standard force majeure covering Acts of God, government action, labour disputes. 30-day long-stop.",
    hardRedLine: "Force majeure covering economic hardship or events within the suppliers ordinary business risk.",
    riskWeight: 3,
  },
  {
    clauseCategory: "WARRANTIES",
    preferredPosition: "Warranties of title, authority, and material compliance with applicable law. 12-month survival post-termination.",
    acceptableFallback: "Warranties of authority and title only.",
    hardRedLine: "No warranties or as-is disclaimer for services with material legal or financial impact.",
    riskWeight: 3,
  },
  {
    clauseCategory: "DISPUTE_RESOLUTION",
    preferredPosition: "Escalation: senior management (15 days) then mediation (30 days) then LCIA arbitration. Courts for emergency relief.",
    acceptableFallback: "Direct arbitration under LCIA or ICC rules. English courts for injunctive relief.",
    hardRedLine: "Exclusive foreign court jurisdiction with no arbitration option.",
    riskWeight: 2,
  },
  {
    clauseCategory: "ASSIGNMENT",
    preferredPosition: "Assignment requires consent; not to be unreasonably withheld. Group assignments on notice.",
    acceptableFallback: "Free assignment within group. Third-party assignment with 10-day notice and consent.",
    hardRedLine: "Supplier may assign to competitors without our consent.",
    riskWeight: 3,
  },
  {
    clauseCategory: "INSURANCE",
    preferredPosition: "Professional Indemnity 2M+, Public Liability 5M+, Cyber Liability 2M+. Evidence on request.",
    acceptableFallback: "Professional Indemnity 1M+, Public Liability 2M+.",
    hardRedLine: "No insurance requirement for services involving personal data or material financial exposure.",
    riskWeight: 3,
  },
  {
    clauseCategory: "NON_SOLICITATION",
    preferredPosition: "Mutual 12-month post-termination restriction on active solicitation of key personnel.",
    acceptableFallback: "12-month restriction, excluding response to general advertising.",
    hardRedLine: "Restriction exceeding 24 months or covering all hiring not just direct solicitation.",
    riskWeight: 2,
  },
  {
    clauseCategory: "EXCLUSIVITY",
    preferredPosition: "No exclusivity without compensation and performance benchmarks.",
    acceptableFallback: "Limited exclusivity in specific territory/segment with quarterly performance reviews.",
    hardRedLine: "Open-ended exclusivity with no performance obligations or exit right.",
    riskWeight: 3,
  },
  {
    clauseCategory: "CHANGE_OF_CONTROL",
    preferredPosition: "Termination right on 60 days notice following supplier change of control.",
    acceptableFallback: "Right to renegotiate terms within 90 days of change of control.",
    hardRedLine: "No change of control protections.",
    riskWeight: 3,
  },
  {
    clauseCategory: "RENT_REVIEW",
    preferredPosition: "Rent review every 5 years, upward/downward to open market rent. RICS arbitration for disputes.",
    acceptableFallback: "Upward-only review capped at CPI annually compounded.",
    hardRedLine: "Uncapped upward-only review with no independent review mechanism.",
    riskWeight: 3,
  },
  {
    clauseCategory: "BREAK_CLAUSE",
    preferredPosition: "Tenant break at year 5. Conditions: vacant possession and no rent arrears. 6 months notice.",
    acceptableFallback: "Tenant break at year 7. Reasonable conditions. 6 months notice.",
    hardRedLine: "Break clause conditional on full compliance with all lease covenants.",
    riskWeight: 3,
  },
  {
    clauseCategory: "REPAIR_OBLIGATIONS",
    preferredPosition: "Internal non-structural repairs for tenant; landlord takes structural and external. Schedule of Condition attached.",
    acceptableFallback: "FRI with Schedule of Condition limiting dilapidations on exit.",
    hardRedLine: "FRI without Schedule of Condition or put and keep in repair obligation.",
    riskWeight: 3,
  },
  {
    clauseCategory: "SERVICE_CHARGE",
    preferredPosition: "Service charge capped; detailed accounts within 6 months of year end.",
    acceptableFallback: "Service charge with RPI+2% annual cap. Accounts within 9 months.",
    hardRedLine: "Uncapped service charge; no accounts or audit rights.",
    riskWeight: 2,
  },
  {
    clauseCategory: "ENTIRE_AGREEMENT",
    preferredPosition: "Entire agreement clause superseding all prior representations and discussions. Carve-out for fraud.",
    acceptableFallback: "Entire agreement clause with acknowledgement of written representations in the agreement.",
    hardRedLine: "No entire agreement clause where pre-contractual representations have been made.",
    riskWeight: 2,
  },
  {
    clauseCategory: "VARIATION",
    preferredPosition: "Variations in writing, signed by authorised representatives.",
    acceptableFallback: "Email from designated authorised accounts constitutes a valid variation for operational matters.",
    hardRedLine: "Counterparty has unilateral right to vary terms by notice.",
    riskWeight: 3,
  },
  {
    clauseCategory: "WAIVER",
    preferredPosition: "Waiver must be in writing. No waiver by course of dealing.",
    acceptableFallback: "Written waiver required. Partial exercise does not waive further rights.",
    hardRedLine: "Course of dealing may constitute a waiver of material rights.",
    riskWeight: 2,
  },
  {
    clauseCategory: "SEVERABILITY",
    preferredPosition: "Invalid provisions severable; remainder of contract survives.",
    acceptableFallback: "Standard severability; court may modify to minimum extent to achieve validity.",
    hardRedLine: "No severability where contract has provisions of doubtful enforceability.",
    riskWeight: 1,
  },
  {
    clauseCategory: "NOTICES",
    preferredPosition: "Notices in writing by courier or email with read receipt. Effective on actual receipt.",
    acceptableFallback: "Email deemed received after 24 hours; post deemed received after 2 business days.",
    hardRedLine: "No notices clause for formal communications.",
    riskWeight: 1,
  },
  {
    clauseCategory: "THIRD_PARTY_RIGHTS",
    preferredPosition: "Third party rights excluded. Contracts (Rights of Third Parties) Act 1999 excluded.",
    acceptableFallback: "Third party rights limited to named group companies.",
    hardRedLine: "Open-ended third party rights without identified beneficiaries.",
    riskWeight: 2,
  },
  {
    clauseCategory: "SET_OFF",
    preferredPosition: "We retain right to set off undisputed amounts. Counterparty right to set off excluded.",
    acceptableFallback: "Mutual set-off limited to undisputed sums under this agreement.",
    hardRedLine: "Our right to set off is excluded entirely.",
    riskWeight: 2,
  },
  {
    clauseCategory: "LIQUIDATED_DAMAGES",
    preferredPosition: "LDs capped at 100% of annual contract value. Genuine pre-estimate of loss required.",
    acceptableFallback: "LDs capped at 50% of contract value. Sole remedy for specified breach.",
    hardRedLine: "Uncapped LDs without reference to genuine pre-estimate of loss.",
    riskWeight: 3,
  },
  {
    clauseCategory: "MOST_FAVOURED_NATION",
    preferredPosition: "MFN on comparable volume tiers. Automatic price reduction on trigger.",
    acceptableFallback: "MFN notification-based; we may claim adjusted pricing within 30 days of notification.",
    hardRedLine: "No MFN where we are a significant customer.",
    riskWeight: 2,
  },
  {
    clauseCategory: "BENCHMARKING",
    preferredPosition: "Benchmarking every 2 years. Supplier must match market pricing within 60 days or face termination right.",
    acceptableFallback: "Benchmarking right every 3 years. Right to renegotiate on unfavourable result.",
    hardRedLine: "No benchmarking right on contracts of 2 years or more.",
    riskWeight: 2,
  },
  {
    clauseCategory: "STEP_IN_RIGHTS",
    preferredPosition: "Step-in rights on material breach or insolvency. 5 business days notice. Suppliers cost.",
    acceptableFallback: "Step-in on extended uncured breach. Reasonable costs shared initially, claimed back on resolution.",
    hardRedLine: "No step-in for critical services.",
    riskWeight: 3,
  },
  {
    clauseCategory: "SUBCONTRACTING",
    preferredPosition: "Written consent required for subcontracting core deliverables. Supplier remains liable.",
    acceptableFallback: "Operational subcontracting on 10 days notice. Supplier liable for subcontractor acts.",
    hardRedLine: "Supplier may subcontract freely with no liability for subcontractor failures.",
    riskWeight: 3,
  },
  {
    clauseCategory: "BUSINESS_CONTINUITY",
    preferredPosition: "BCP/DR maintained and tested annually. RTO/RPO agreed in writing.",
    acceptableFallback: "BCP/DR plan maintained. Evidence on reasonable request.",
    hardRedLine: "No BCP/DR obligations for critical services.",
    riskWeight: 3,
  },
  {
    clauseCategory: "SERVICE_LEVELS",
    preferredPosition: "Agreed SLAs with service credits for breach. Persistent failure triggers termination right.",
    acceptableFallback: "SLAs with credits as sole remedy. Termination right after 6 months of material underperformance.",
    hardRedLine: "No SLAs; or credits cap all liability for service failure.",
    riskWeight: 3,
  },
  {
    clauseCategory: "SOURCE_CODE_ESCROW",
    preferredPosition: "Escrow for bespoke software. Release on insolvency or material breach. Annual verification.",
    acceptableFallback: "Escrow with release on insolvency. Deposit and verification every 2 years.",
    hardRedLine: "No escrow for operationally critical bespoke software.",
    riskWeight: 3,
  },
  {
    clauseCategory: "MARKETING_RIGHTS",
    preferredPosition: "No marketing use without prior written consent on each occasion.",
    acceptableFallback: "Customer list inclusion only. All other uses require consent.",
    hardRedLine: "Blanket consent to use our name and brand in marketing.",
    riskWeight: 2,
  },
  {
    clauseCategory: "ANTI_BRIBERY",
    preferredPosition: "Bribery Act compliance warranted. Adequate procedures maintained. Immediate termination for breach.",
    acceptableFallback: "Anti-corruption warranty. Termination right on reasonable grounds of breach.",
    hardRedLine: "No anti-bribery provisions in contracts with material corruption risk.",
    riskWeight: 4,
  },
  {
    clauseCategory: "SANCTIONS_COMPLIANCE",
    preferredPosition: "Sanctions compliance warranty. Immediate notification of risk. Termination right without penalty.",
    acceptableFallback: "Sanctions warranty. 5-day notification obligation. Termination right on notice.",
    hardRedLine: "No sanctions clause.",
    approvalRequired: "GC",
    riskWeight: 5,
  },
  {
    clauseCategory: "MODERN_SLAVERY",
    preferredPosition: "Modern Slavery Act compliance warranted. Transparency statement on request. Audit right.",
    acceptableFallback: "MSA compliance warranty. Notification of known supply chain breaches.",
    hardRedLine: "No modern slavery obligations in supply chain-exposed contracts.",
    riskWeight: 3,
  },
  {
    clauseCategory: "ENVIRONMENTAL_OBLIGATIONS",
    preferredPosition: "Environmental law compliance warranted. Cooperation with our ESG reporting requirements.",
    acceptableFallback: "Compliance with applicable environmental law. Good faith cooperation on sustainability data.",
    hardRedLine: "No environmental obligations in contracts with significant environmental footprint.",
    riskWeight: 2,
  },
  {
    clauseCategory: "TUPE",
    preferredPosition: "TUPE compliance warranted. Indemnity for pre-transfer employment liabilities. Employee information on 28 days notice.",
    acceptableFallback: "TUPE warranty with indemnity for pre-transfer liabilities. Reasonable notice for employee information.",
    hardRedLine: "No TUPE indemnity where transfer is likely.",
    approvalRequired: "LEGAL",
    riskWeight: 4,
  },
  {
    clauseCategory: "RESTRICTIVE_COVENANTS",
    preferredPosition: "Non-compete 12 months post-termination in specific market segment only. Non-solicitation of key accounts.",
    acceptableFallback: "Non-compete up to 12 months in directly competed business area. Non-solicitation of introduced customers.",
    hardRedLine: "Non-compete exceeding 12 months or broader than specific competitive activity.",
    riskWeight: 3,
  },
  {
    clauseCategory: "ACCEPTANCE_TESTING",
    preferredPosition: "Written acceptance criteria. 20-business-day testing window. Rejection requires written notice.",
    acceptableFallback: "15-day testing window. Supplier cure period after failure. Deemed acceptance if no objection after two cycles.",
    hardRedLine: "No acceptance testing for bespoke deliverables.",
    riskWeight: 3,
  },
  {
    clauseCategory: "REGULATORY_CHANGE",
    preferredPosition: "Notification of regulatory change. 30-day renegotiation window. Termination right if no agreement.",
    acceptableFallback: "Obligation to notify. Good faith renegotiation. Termination if compliance becomes impossible.",
    hardRedLine: "No regulatory change mechanism for regulated services.",
    riskWeight: 3,
  },
  {
    clauseCategory: "CONTENT_MODERATION",
    preferredPosition: "Platform content moderation policy applies. 48-hour notice before removing our content unless illegal content. Dispute escalation to senior contacts agreed.",
    acceptableFallback: "Platform may remove content per its policies with reasonable notice. Dispute process available for contested takedowns.",
    hardRedLine: "Unilateral removal with no notice and no dispute process where commercial impact is significant.",
    riskWeight: 3,
  },
  {
    clauseCategory: "VIRTUAL_ITEMS",
    preferredPosition: "Virtual items licensed to end users; we retain IP. Platform follows our disclosure instructions. No unauthorised secondary market facilitation.",
    acceptableFallback: "Virtual items on our terms. Platform implements our pricing and disclosure instructions.",
    hardRedLine: "Platform claims ownership in our virtual items.",
    riskWeight: 3,
  },
  {
    clauseCategory: "PLATFORM_REVENUE_SHARE",
    preferredPosition: "Revenue share at agreed rates for the term. 90-day notice for any rate changes. Net revenue after taxes and chargebacks only.",
    acceptableFallback: "Agreed revenue share rates. Platform may adjust standard rates with 90-day notice.",
    hardRedLine: "Unilateral rate changes with less than 30 days notice; no reporting.",
    riskWeight: 3,
  },
  {
    clauseCategory: "LOOT_BOX_MECHANICS",
    preferredPosition: "Probability disclosure before purchase. Spend controls for minor accounts. Compliance with applicable law in all launch jurisdictions.",
    acceptableFallback: "Probability disclosure implemented. Legal review for primary markets. Minor spend controls active.",
    hardRedLine: "No probability disclosure; no minor spend controls; sole liability on us without publisher sign-off.",
    riskWeight: 4,
  },
];

const APPROVAL_CONTACTS = [
  { role: "LEGAL", name: "Sarah Chen",    email: "sarah.chen@mikedemo.co" },
  { role: "GC",    name: "James Hartley", email: "j.hartley@mikedemo.co" },
  { role: "CFO",   name: "Priya Mehta",   email: "p.mehta@mikedemo.co" },
];

async function main() {
  console.log("Seeding MIKE demo company...");

  // Remove any existing demo company (identified by name)
  const existing = await prisma.company.findFirst({
    where: { name: DEMO_COMPANY.name },
  });
  if (existing) {
    await prisma.company.delete({ where: { id: existing.id } });
    console.log("Removed existing demo company.");
  }

  const company = await prisma.company.create({
    data: {
      ...DEMO_COMPANY,
      playbookRules: {
        create: PLAYBOOK_RULES,
      },
      approvalContacts: {
        create: APPROVAL_CONTACTS,
      },
    },
  });

  console.log(`Demo company created: ${company.id} (${company.name})`);
  console.log(`Playbook rules: ${PLAYBOOK_RULES.length}`);
  console.log(`Approval contacts: ${APPROVAL_CONTACTS.length}`);
  console.log("\nRun the app and log in to explore MIKE with demo data.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
