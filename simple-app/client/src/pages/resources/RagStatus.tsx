import ResourcePageLayout from "../../components/ResourcePageLayout";

export default function RagStatus() {
  return (
    <ResourcePageLayout
      category="Contract Review"
      title="Reading a Zane review: what each RAG status actually means"
      readTime="5 min read"
    >
      <p>
        When Zane completes a contract review, every clause gets one of four statuses: RED, AMBER,
        GREEN, or ABSENT. Understanding what each status actually means, and what action it
        requires, is the difference between a useful review and a piece of paper that goes in a
        drawer.
      </p>

      <hr />

      <h2>RED: This clause requires attention before signing</h2>
      <p>
        A RED status means the clause deviates from your playbook position in a material way. It
        either falls below your stated fallback position or breaches your hard red line entirely.
        RED clauses are not suggestions. They are flags that require a human decision before the
        contract can move forward.
      </p>
      <p>
        <strong>What RED does not mean:</strong> RED does not mean the contract cannot be signed.
        It means the clause needs to be addressed, either by negotiating it back toward your
        position, by getting explicit sign-off from the right person, or by recording a conscious
        decision to accept it and why.
      </p>
      <p>Specific examples of RED clauses:</p>
      <ul>
        <li>
          Liability cap set at one month's fees when your playbook red line is three months minimum.
          This is a quantified financial exposure breach.
        </li>
        <li>
          No data processing agreement in a contract where the supplier will process personal data
          of your customers. Under UK GDPR, this is a regulatory requirement not a negotiating
          position.
        </li>
        <li>
          Supplier-only limitation of liability, where the cap applies to them but not to you, combined
          with an unlimited indemnity obligation on your side.
        </li>
        <li>
          Auto-renewal clause with a 14-day notice window when your red line is 30 days minimum.
          At 14 days you will miss most renewal windows in practice.
        </li>
      </ul>
      <p>
        RED clauses automatically trigger Zane's escalation routing. The appropriate approver is
        determined by your approval matrix: clause category, contract value, and any applicable
        governance triggers.
      </p>

      <hr />

      <h2>AMBER: Negotiate but not a blocker</h2>
      <p>
        AMBER means the clause is not ideal. It is within your negotiating range, above your
        fallback but below your preferred position, but it is worth pushing back on if you have
        the commercial leverage to do so.
      </p>
      <p>
        AMBER clauses do not require escalation unless your approval matrix specifically
        requires it for that clause category. They should be reviewed, a negotiation decision
        should be made, and the decision should be recorded.
      </p>
      <p>Specific examples of AMBER clauses:</p>
      <ul>
        <li>
          Payment terms at 45 days when you prefer 30 days but your playbook fallback is 45. You
          can sign at 45 days without escalation, but it is worth asking for 30 if the commercial
          relationship allows it.
        </li>
        <li>
          Auto-renewal clause with 60 days notice when you prefer 90 days. Workable in practice
          if you have a reminder system. Worth pushing back on if the counterparty is flexible.
        </li>
        <li>
          Confidentiality obligation surviving for five years when you prefer two years. Not a
          problem in most contexts. Flag it, make a conscious decision, move on.
        </li>
        <li>
          Termination for convenience on 60 days notice when you prefer 30 days. Longer notice
          period increases lock-in risk marginally but is not a material breach of your position.
        </li>
      </ul>

      <hr />

      <h2>GREEN: This clause meets or exceeds your position</h2>
      <p>
        GREEN means the clause is consistent with or better than your preferred playbook position.
        No action needed. The clause can be accepted as drafted.
      </p>
      <p>Specific examples of GREEN clauses:</p>
      <ul>
        <li>
          English law and exclusive English court jurisdiction when that is your preferred
          governing law.
        </li>
        <li>
          Mutual confidentiality with two-year survival, standard carve-outs for public information
          and regulatory disclosures.
        </li>
        <li>
          Liability cap at 12 months of fees, mutual and with only standard exclusions for fraud
          and death and personal injury.
        </li>
        <li>
          Termination for convenience on 30 days written notice with no penalty.
        </li>
      </ul>
      <p>
        GREEN clauses require no action. They are logged in the audit trail and contribute to
        Zane's outcome data, which over time tells you which counterparties consistently offer
        strong positions and which consistently push on specific clauses.
      </p>

      <hr />

      <h2>ABSENT: The clause was not found</h2>
      <p>
        ABSENT means Zane could not identify this clause category in the contract. This is not
        necessarily a problem. Many clause types are irrelevant to many contracts. But for
        critical categories it can itself be a significant risk.
      </p>
      <p>
        <strong>When ABSENT is treated as RED:</strong> For certain clause categories, absence
        is inherently problematic. If a contract involves processing personal data and there is
        no data processing agreement, ABSENT is functionally equivalent to RED. If a contract
        is silent on intellectual property ownership of bespoke deliverables, ABSENT creates
        ambiguity that defaults in favour of the counterparty under English law.
      </p>
      <p>
        Zane applies your playbook's severity configuration to absent clauses. Clause categories
        you have flagged as critical will generate an ABSENT flag treated as RED. Categories you
        have flagged as optional will note the absence without triggering escalation.
      </p>
      <p>
        <strong>When ABSENT is acceptable:</strong> A force majeure clause absent from a short
        one-off services agreement is not a material concern. A change of control clause absent
        from an NDA between two private individuals is not a concern. Use judgment. Zane will
        tell you the clause is absent. You decide whether that matters in context.
      </p>

      <hr />

      <h2>Using the override function</h2>
      <p>
        Zane gets things wrong. Clause extraction from complex or non-standard documents is
        genuinely difficult, and even frontier language models misclassify clauses that are
        unusual, indirect, or buried in definitions.
      </p>
      <p>
        When Zane gets it wrong, whether it flags something as RED when you disagree with the analysis,
        or misses a clause that is clearly present, use the override function. Mark the result
        as a false positive and record your reasoning.
      </p>
      <p>
        This matters beyond the immediate review. Every override you record is a data point that
        Zane uses to understand your company's specific interpretation of clause language. Over
        time, this makes the system more accurate for your contracts, your counterparties, and
        your sector.
      </p>
      <p>
        Override data is also part of your audit trail. If a clause you overrode later becomes
        the subject of a dispute, your reasoning is recorded. That is significantly better than
        the alternative, which is a lawyer's memory.
      </p>

      <hr />

      <h2>The difference between a negotiation risk and a legal stop</h2>
      <p>
        Not all RED clauses are the same. There are two categories that matter for how you
        respond:
      </p>
      <p>
        <strong>Negotiation risks</strong> are clauses that deviate from your position and create
        commercial or legal exposure, but where a human decision-maker can weigh that exposure
        against the commercial value of the contract and decide to proceed. These require sign-off
        from the appropriate approver. They can be accepted. The right person just needs to say so,
        in writing, with their reasoning recorded.
      </p>
      <p>
        <strong>Legal stops</strong> are clauses where proceeding would breach a regulatory
        obligation, create an uninsurable risk, or create liability that cannot be bounded. No
        amount of commercial pressure makes these acceptable. Processing personal data without
        a DPA in a regulated environment is a legal stop. Signing a contract with an unlimited
        indemnity where your professional indemnity insurance has a £1 million cap is a legal stop.
      </p>
      <p>
        Zane flags both as RED. Your approval matrix determines how each routes. The distinction
        between a negotiation risk and a legal stop is a judgment call that belongs to the lawyer,
        not the system.
      </p>
    </ResourcePageLayout>
  );
}
