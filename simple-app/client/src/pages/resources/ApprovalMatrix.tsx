import ResourcePageLayout from "../../components/ResourcePageLayout";

export default function ApprovalMatrix() {
  return (
    <ResourcePageLayout
      category="Team"
      title="Setting up your approval matrix"
      readTime="6 min read"
    >
      <p>
        The playbook tells Zane what is risky. The approval matrix tells Zane what to do about it.
        Of the two, teams consistently underinvest in the approval matrix, and consistently
        regret it when a significant clause deviation slips through because nobody was clearly
        responsible for signing off on it.
      </p>
      <p>
        A well-configured approval matrix does three things: it routes escalations to the right
        person at the right level, it creates a clear record of every deviation that was knowingly
        accepted, and it gives the GC a defensible answer to the question "who approved this?"
        when something goes wrong later.
      </p>

      <hr />

      <h2>The three escalation tiers Zane checks simultaneously</h2>
      <p>
        Zane evaluates three separate escalation dimensions for every contract review. These run
        in parallel. All three are checked at the same time, and the highest escalation level
        from any dimension determines the required sign-off.
      </p>

      <h3>Tier 1: Clause risk escalation</h3>
      <p>
        This tier is driven by your playbook. When a clause is assessed as RED, either because
        it falls below your fallback position or breaches your hard red line, it triggers a
        clause-specific escalation request.
      </p>
      <p>
        The approver for each clause category is configured in your playbook. You set who needs
        to sign off on each type of deviation. Typical configurations:
      </p>
      <ul>
        <li>
          <strong>Limitation of liability deviations:</strong> GC sign-off. The GC needs to know
          when the financial exposure on a contract exceeds your standard position.
        </li>
        <li>
          <strong>Data protection deviations:</strong> DPO or Senior Privacy Counsel sign-off,
          in addition to any other required approver. This is not optional in a regulated
          environment. It creates a documented decision trail for your data protection officer.
        </li>
        <li>
          <strong>IP ownership deviations:</strong> Head of Legal or GC sign-off. IP decisions
          can have long-term consequences that outlast the contract itself.
        </li>
        <li>
          <strong>Payment terms deviations:</strong> Commercial manager or CFO depending on the
          scale of the deviation. Legal review is not always necessary for a pure commercial
          timing decision.
        </li>
      </ul>

      <h3>Tier 2: Contract value escalation</h3>
      <p>
        This tier is driven by the contract value you enter at upload. Value thresholds are
        configured independently of clause positions and apply regardless of whether any clause
        is Red or Amber.
      </p>
      <p>
        A typical configuration for a company with a three to five person legal team and annual
        revenues between £20m and £100m:
      </p>
      <ul>
        <li><strong>Under £10,000:</strong> Handler authority. No sign-off required.</li>
        <li><strong>£10,000 to £50,000:</strong> Legal team sign-off. Senior solicitor can approve.</li>
        <li><strong>£50,000 to £250,000:</strong> GC sign-off required.</li>
        <li><strong>£250,000 to £1,000,000:</strong> CFO approval required in addition to GC.</li>
        <li><strong>Over £1,000,000:</strong> Board approval required.</li>
      </ul>
      <p>
        These thresholds should be calibrated to your organisation's actual decision-making
        structure. If your GC signs off on everything above £10,000, your CFO will be receiving
        approval requests every week. If your threshold is £500,000, material contracts will
        be approved at too low a level.
      </p>
      <p>
        Adjust annually. Companies that grow quickly find their thresholds become inappropriate
        within 18 months.
      </p>

      <h3>Tier 3: Governance trigger escalation</h3>
      <p>
        This tier is driven by specific contract characteristics that always require a particular
        approver regardless of clause status or contract value. Governance triggers are the
        most important and most overlooked part of the approval matrix.
      </p>
      <p>
        Examples of governance triggers that most teams should configure:
      </p>
      <ul>
        <li>
          <strong>Related party counterparty:</strong> Always to board. A contract with a company
          connected to a director or significant shareholder requires board visibility regardless
          of size or clause status.
        </li>
        <li>
          <strong>Change of control clause present:</strong> Always to CEO. A change of control
          provision has implications that reach beyond the legal team and the CFO.
        </li>
        <li>
          <strong>Processing of special category data:</strong> Always to DPO. Contracts involving
          health data, financial data of regulated clients, or other special categories require DPO
          sign-off in regulated environments.
        </li>
        <li>
          <strong>Subcontracting or outsourcing of a core function:</strong> Always to GC and COO.
          Where a supplier is taking over a function that was previously done in-house, the
          operational implications extend beyond legal risk.
        </li>
        <li>
          <strong>Guarantees or surety arrangements:</strong> Always to CFO and legal. These create
          contingent liabilities that need to appear on the balance sheet.
        </li>
      </ul>

      <hr />

      <h2>The sign-off sequence and why order matters</h2>
      <p>
        When multiple approvers are required, the sequence matters. Legal should review before
        the GC escalates to the CFO. The GC should have reached a view on the legal risk before
        asking the CFO whether the commercial deal makes sense at that risk level.
      </p>
      <p>
        A logical sequence for a contract that triggers all three tiers:
      </p>
      <ol>
        <li>
          <strong>Handler review.</strong> The person managing the commercial relationship reads
          the Zane output and confirms the factual context.
        </li>
        <li>
          <strong>Legal review.</strong> Senior solicitor or paralegal reviews each Red and Amber
          clause, accepts or overrides Zane's assessment, and requests negotiation where
          appropriate.
        </li>
        <li>
          <strong>GC sign-off.</strong> GC reviews the legal team's assessment and any unresolved
          Red clauses. Makes or confirms the legal risk decision.
        </li>
        <li>
          <strong>CFO approval.</strong> CFO reviews the contract value, any financial exposure
          from Red clauses that were accepted, and any contingent liabilities.
        </li>
        <li>
          <strong>Board approval (where required).</strong> Board sees the final position across
          all dimensions.
        </li>
      </ol>
      <p>
        Configure Zane to enforce this sequence. If you allow CFO approval requests to be sent
        before the GC has reviewed, the CFO will be approving financial risk without legal
        context. They will either approve everything (because they assume legal has seen it)
        or reject everything (because they do not have the information to judge).
      </p>

      <hr />

      <h2>The two most common mistakes</h2>
      <p>
        <strong>Setting thresholds too low.</strong> If every contract above £10,000 requires
        GC sign-off and your company signs fifty supplier agreements a year, your GC spends
        a meaningful part of their time approving routine commercial arrangements. The sign-off
        becomes a formality. People approve without reading. The system loses its meaning.
      </p>
      <p>
        The test: if your GC is approving more than two contracts per week through the approval
        matrix, your thresholds are probably too low. Raise them until GC sign-off is genuinely
        reserved for decisions that require GC judgment.
      </p>
      <p>
        <strong>Setting thresholds too high.</strong> If your threshold for CFO approval is
        £5 million and you sign contracts at £2 million annually, you have no upper governance
        check. A contract at £3 million could be signed at GC level with an accepted Red clause
        that creates £3 million of uncapped liability exposure with no CFO visibility.
      </p>
      <p>
        The test: look at your five largest contracts from last year. Were they approved at an
        appropriate level? If any of them went through on GC authority alone and you are not
        comfortable with that, lower your CFO threshold.
      </p>

      <hr />

      <h2>A note on accountability and audit trails</h2>
      <p>
        Every sign-off decision in Zane is timestamped, attributed to a named approver, and
        stored in the audit trail. This is not just useful for internal governance. It is the
        answer to the question that gets asked when a contract dispute arises two years later:
        who knew what, and when?
      </p>
      <p>
        A well-configured approval matrix means that question has a clear answer. The GC
        reviewed this clause on this date and made this decision. The CFO approved the contract
        value on this date with these Red clauses disclosed. That documentation matters.
      </p>
    </ResourcePageLayout>
  );
}
