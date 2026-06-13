import ResourcePageLayout from "../../components/ResourcePageLayout";

export default function FirstPlaybook() {
  return (
    <ResourcePageLayout
      category="Getting Started"
      title="How to build your first playbook in 20 minutes"
      readTime="8 min read"
    >
      <p>
        Most in-house legal teams have a playbook. It lives in a shared drive somewhere, last updated
        two years ago, and bears no resemblance to how the team actually negotiates. The positions
        in it are aspirational. Nobody enforces them. When a new lawyer joins, they discover the
        document by accident and realise quickly that ignoring it is the norm.
      </p>
      <p>
        This guide is about building a playbook that reflects reality, and using Zane to keep it
        there.
      </p>

      <hr />

      <h2>What a playbook actually is</h2>
      <p>
        A playbook is not a policy document. It is not a set of aspirational positions designed to
        impress auditors. It is a decision guide that tells a lawyer, or an AI, how to assess a
        clause and what to do about it.
      </p>
      <p>A well-constructed playbook has three levels for each clause category:</p>
      <ul>
        <li>
          <strong>Preferred position.</strong> What you want the clause to say if the counterparty
          agrees to your standard form. This should reflect what you actually achieve in roughly
          half your negotiations, not your opening ask in every negotiation.
        </li>
        <li>
          <strong>Acceptable fallback.</strong> The minimum you will accept without escalation. If
          the counterparty pushes back and you concede to this position, you can sign without senior
          sign-off.
        </li>
        <li>
          <strong>Hard red line.</strong> The position below which you will not go regardless of
          commercial pressure. Breaching this requires explicit sign-off from the GC, CFO, or board
          depending on your approval matrix.
        </li>
      </ul>
      <p>
        The common mistake is setting the preferred position as the red line. This makes everything
        escalate. It makes the playbook meaningless. And it trains your lawyers to ignore it.
      </p>

      <hr />

      <h2>The ten clause categories that matter most</h2>
      <p>
        For the majority of commercial contracts, such as supplier agreements, SaaS agreements, customer
        MSAs, and NDAs, ten clause categories account for roughly ninety percent of negotiation
        disputes. Start here.
      </p>
      <p>
        The examples below are calibrated for a UK financial services company with revenues of
        £50m to £200m. Adjust thresholds proportionally for your size and sector.
      </p>

      <h3>1. Limitation of Liability</h3>
      <p>
        <strong>Preferred:</strong> Mutual cap at the greater of £1 million or 12 months of fees
        paid or payable under the contract. Exclusions for death and personal injury, fraud, and
        wilful misconduct only.
      </p>
      <p>
        <strong>Fallback:</strong> Cap at 6 months of fees with the same exclusions. No uncapping
        of consequential loss.
      </p>
      <p>
        <strong>Red line:</strong> Cap below 3 months of fees is a hard stop. Any uncapping of
        consequential loss without mutual application is a hard stop. Asymmetric caps favouring
        the supplier without a corresponding indemnity is a hard stop.
      </p>

      <h3>2. Indemnity</h3>
      <p>
        <strong>Preferred:</strong> Mutual indemnity covering third-party claims arising from each
        party's breach of the agreement, limited to direct losses. No cross-indemnity for
        consequential loss.
      </p>
      <p>
        <strong>Fallback:</strong> Accept supplier indemnity for IP infringement claims provided
        there is a corresponding indemnity from us for misuse of the supplier's IP.
      </p>
      <p>
        <strong>Red line:</strong> Never accept an uncapped indemnity for consequential or indirect
        losses. Never accept a unilateral indemnity that does not flow both ways.
      </p>

      <h3>3. Data Protection and Privacy</h3>
      <p>
        <strong>Preferred:</strong> Comprehensive Data Processing Agreement as a schedule. Processor
        obligations including Article 28 UK GDPR requirements. Sub-processor restrictions with prior
        written consent. UK-only data storage unless adequate protection confirmed.
      </p>
      <p>
        <strong>Fallback:</strong> Accept standard controller-to-processor DPA with reasonable
        sub-processor list provided we have 30 days notice of changes.
      </p>
      <p>
        <strong>Red line:</strong> Processing personal data with no DPA in place is an absolute
        blocker. Non-UK storage without adequacy decision or appropriate safeguards is a hard stop.
        This is not a commercial negotiation. It is a regulatory requirement.
      </p>

      <h3>4. Payment Terms</h3>
      <p>
        <strong>Preferred:</strong> 30 days from receipt of valid invoice. Right to set off against
        disputed amounts. No interest on late payment beyond statutory rate.
      </p>
      <p>
        <strong>Fallback:</strong> 45 days from receipt of invoice. Acceptable for most supplier
        relationships.
      </p>
      <p>
        <strong>Red line:</strong> Beyond 60 days is a hard stop unless exceptional circumstances.
        Prepayment for services not yet delivered is a hard stop without a bank guarantee or
        escrow arrangement.
      </p>

      <h3>5. IP Ownership</h3>
      <p>
        <strong>Preferred:</strong> We own all bespoke deliverables created specifically for us
        under the contract. Supplier retains ownership of their background IP. We receive a
        perpetual licence to use background IP embedded in our deliverables.
      </p>
      <p>
        <strong>Fallback:</strong> Accept shared ownership of bespoke deliverables provided we
        have the right to use, adapt, and sublicense to group companies without restriction.
      </p>
      <p>
        <strong>Red line:</strong> Supplier ownership of bespoke deliverables with no perpetual
        licence back to us is a hard stop. Any restriction on our ability to use what we have paid
        to create is a hard stop.
      </p>

      <h3>6. Confidentiality</h3>
      <p>
        <strong>Preferred:</strong> Mutual obligations. Two-year survival post-termination.
        Standard carve-outs for publicly available information and disclosures required by law.
      </p>
      <p>
        <strong>Fallback:</strong> Accept five-year survival if supplier insists. Acceptable in
        most contexts.
      </p>
      <p>
        <strong>Red line:</strong> Perpetual confidentiality obligations on technical or commercial
        information that we need to disclose for regulatory purposes should be refused. Any
        obligation that prevents us disclosing to our regulator is a hard stop.
      </p>

      <h3>7. Governing Law and Jurisdiction</h3>
      <p>
        <strong>Preferred:</strong> English law. Exclusive jurisdiction of the English courts.
      </p>
      <p>
        <strong>Fallback:</strong> Scots law for Scottish suppliers. New York law for US-based
        technology contracts above £500k value where the supplier refuses English law.
      </p>
      <p>
        <strong>Red line:</strong> No jurisdiction without functioning rule of law. No clauses
        that require disputes to be resolved in a jurisdiction where we have no local counsel
        without GC approval.
      </p>

      <h3>8. Auto-Renewal</h3>
      <p>
        <strong>Preferred:</strong> No auto-renewal. Fixed term with explicit renewal process.
      </p>
      <p>
        <strong>Fallback:</strong> Auto-renewal with a minimum 60-day written notice window to
        prevent renewal. Clear notification obligation on the supplier 90 days before the notice
        window opens.
      </p>
      <p>
        <strong>Red line:</strong> Auto-renewal with less than 30 days notice window is a hard
        stop. Renewal with automatic price escalation without consent is a hard stop.
      </p>

      <h3>9. Termination</h3>
      <p>
        <strong>Preferred:</strong> Termination for convenience on 30 days written notice.
        Termination for cause immediately on written notice where breach is incapable of remedy,
        or 14 days to remedy if capable.
      </p>
      <p>
        <strong>Fallback:</strong> 60 days termination for convenience for contracts over 12 months
        duration. Acceptable where the supplier has genuine setup costs.
      </p>
      <p>
        <strong>Red line:</strong> No termination for convenience right at all is a hard stop.
        Termination only on cause in a long-term services contract creates significant lock-in risk.
      </p>

      <h3>10. Dispute Resolution</h3>
      <p>
        <strong>Preferred:</strong> Tiered escalation: commercial discussion between senior
        managers, then mediation, then court proceedings. No mandatory arbitration unless we
        are the claimant.
      </p>
      <p>
        <strong>Fallback:</strong> Accept arbitration under LCIA rules for contracts above £500k
        where the counterparty insists and there is a genuine reason to prefer confidential
        proceedings.
      </p>
      <p>
        <strong>Red line:</strong> Mandatory arbitration with no court option is a hard stop
        for contracts below £100k value. The cost of arbitration regularly exceeds the contract
        value at that level.
      </p>

      <hr />

      <h2>Setting your approval matrix</h2>
      <p>
        The approval matrix answers a specific question: when a clause falls below the playbook
        position, who has the authority to approve that deviation?
      </p>
      <p>
        Most teams configure three dimensions simultaneously:
      </p>
      <ul>
        <li>
          <strong>Clause risk.</strong> Certain clause categories always require legal review
          regardless of overall contract status. Data protection deviations always go to the DPO
          or senior privacy counsel. IP deviations always go to the Head of Legal or GC.
        </li>
        <li>
          <strong>Contract value.</strong> Typical configuration: under £10k is handler authority,
          £10k to £50k requires legal sign-off, £50k to £250k requires GC sign-off, over £250k
          requires CFO approval, over £1 million requires board approval.
        </li>
        <li>
          <strong>Governance triggers.</strong> Specific contract types always require senior
          approval regardless of value or clause status. Related party transactions always to board.
          Contracts with change of control provisions always to CEO. Processing of special category
          data always to DPO.
        </li>
      </ul>

      <hr />

      <h2>Calibrating for your sector</h2>
      <p>
        The positions above are a starting point. Three sector adjustments matter most:
      </p>
      <p>
        <strong>Financial services.</strong> Your regulator expects you to demonstrate control of
        your supply chain. FCA-regulated firms should treat data protection and third-party risk
        clauses as regulatory requirements not commercial negotiating positions. Material
        outsourcing arrangements have their own FCA requirements that override playbook defaults.
      </p>
      <p>
        <strong>Technology companies.</strong> IP ownership is more important than liability caps.
        Your ability to use, adapt, and build on the technology and data you pay for is often more
        valuable than the financial protection a liability cap provides. Treat IP as a red-line
        category, not a fallback category.
      </p>
      <p>
        <strong>Logistics and supply chain.</strong> Force majeure clauses matter more than in most
        sectors. Define what constitutes a force majeure event explicitly. Do not accept boilerplate.
        Business continuity obligations and step-in rights are important where supply disruption
        has operational consequences.
      </p>

      <hr />

      <h2>The most common first-playbook mistake</h2>
      <p>
        Teams building their first playbook almost always set their aspirational negotiating
        positions as their playbook positions. Every deviation triggers an escalation. The system
        becomes noise. The lawyers ignore it.
      </p>
      <p>
        The correct approach is to look at the last twenty contracts you signed and ask: what did
        we actually accept? Those positions are your fallback. Your preferred position should be
        one step better. Your red line should be the position that would have caused you a genuine
        business or regulatory problem.
      </p>
      <p>
        Zane's outcome tracking fixes this over time automatically. After ten contracts, Zane
        shows you which clause categories you consistently accept below your stated fallback. After
        twenty, it flags which counterparties push hardest on which clauses. After fifty, your
        playbook reflects reality rather than aspiration, and your red lines are the only ones
        that actually matter.
      </p>
    </ResourcePageLayout>
  );
}
