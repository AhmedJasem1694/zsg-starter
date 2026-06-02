import ResourcePageLayout from "../../components/ResourcePageLayout";

export default function PortfolioDashboard() {
  return (
    <ResourcePageLayout
      category="Analytics"
      title="Using the Portfolio Risk dashboard"
      readTime="4 min read"
    >
      <p>
        Most legal teams have no single view of their contract exposure. Risks are scattered across
        email threads, shared drives, individual lawyers' memories, and spreadsheets that are
        never quite up to date. A new risk in one contract cannot be compared to the same risk
        across ten contracts, because nobody has looked at them together.
      </p>
      <p>
        The Portfolio Risk dashboard changes that. Every contract Zane has reviewed contributes to
        a single view of your legal risk across the entire portfolio — in commercial terms, not in
        the abstract language of clause categories.
      </p>

      <hr />

      <h2>The four key metrics at the top</h2>
      <p>
        Four numbers sit at the top of the dashboard. These are designed to be the four numbers
        a CFO or board member asks about legal risk. They are not metrics for lawyers. They are
        metrics for the people who need to understand legal risk in order to run the business.
      </p>
      <p>
        <strong>Total contract value at risk.</strong> The sum of contract values where at least
        one clause was assessed as Red and that Red clause has not been resolved. This is not the
        total potential liability — it is a proxy for the commercial exposure represented by
        contracts where risk is unresolved. A £2 million figure here means £2 million of contract
        value is sitting in agreements where your legal team has identified unaddressed risk.
      </p>
      <p>
        <strong>Escalations currently open.</strong> The number of contracts with escalation
        requests that have not yet received the required sign-off. This is an operational metric
        as much as a risk metric. Open escalations represent bottlenecks in the contracting process.
        If this number is growing, either the approval matrix thresholds need adjusting or the
        approvers are not completing requests promptly.
      </p>
      <p>
        <strong>Total contracts reviewed.</strong> The baseline figure that puts the other numbers
        in context. Ten open escalations in a portfolio of twenty contracts is a very different
        picture from ten open escalations in a portfolio of two hundred contracts.
      </p>
      <p>
        <strong>Renewals due in the next 90 days.</strong> The number of contracts with a renewal
        or termination window opening in the next 90 days. Why 90 days? Because the typical notice
        period for opting out of auto-renewal is between 30 and 60 days. At 90 days you have
        enough lead time to make a considered commercial decision. At 30 days you are reacting.
      </p>

      <hr />

      <h2>The clause-type exposure chart</h2>
      <p>
        Below the headline metrics, the dashboard shows which clause categories are generating
        the most Red flags across your entire reviewed portfolio.
      </p>
      <p>
        This is one of the most useful diagnostic tools in the platform. If limitation of liability
        appears in 80 percent of your Red flags, there are two possible explanations: your playbook
        position on liability is set too aggressively for your market, or the counterparties you
        are dealing with consistently push hard on this clause. The answer matters for how you
        respond.
      </p>
      <p>
        If it is a playbook calibration problem, the outcome tracking data will show you — over
        time — that you are accepting below-fallback positions on liability more than half the time.
        That means your fallback is not your actual fallback. Adjust it.
      </p>
      <p>
        If it is a counterparty concentration problem, the counterparty analysis below the chart
        will show you which specific counterparties are driving the liability flags. That tells you
        where to invest your negotiation effort and where your standard positions need reinforcing.
      </p>

      <hr />

      <h2>The counterparty risk analysis</h2>
      <p>
        The counterparty section shows which counterparties are generating the most risk flags
        across your reviewed contracts. For each counterparty with multiple reviews, it shows
        the number of contracts reviewed, the proportion with Red clauses, and the clause
        categories where they most frequently deviate from your playbook.
      </p>
      <p>
        <strong>Using this before a new negotiation.</strong> Before entering negotiations with
        a counterparty you have dealt with before, look at their counterparty profile. If you
        have reviewed two previous agreements with them and they pushed back on data processing
        consent requirements in both, you know that clause is going to require negotiation. You
        can prepare your position in advance rather than discovering it mid-review.
      </p>
      <p>
        This kind of institutional memory is exactly what does not survive personnel changes in
        a small legal team. The lawyer who reviewed the first contract three years ago has left.
        The knowledge that this particular supplier always pushes on sub-processor consent left
        with them. The counterparty profile retains it.
      </p>

      <hr />

      <h2>The renewals calendar</h2>
      <p>
        Auto-renewal clauses with short notice windows are one of the most common sources of
        unintended contract extensions in small legal teams. The contract renews because nobody
        noticed the notice window opening. The commercial team complains six months later that
        they are locked into a supplier relationship they wanted to exit. The legal team points
        out it was in the contract. Nobody is wrong. The system just did not surface it at the
        right time.
      </p>
      <p>
        The renewals calendar surfaces every contract with a renewal or termination event in the
        next 90 days. For each contract it shows the notice deadline, the action required
        (opt out, renegotiate, or confirm renewal), and the contract value. Contracts with very
        short notice windows — 30 days or less — are flagged prominently.
      </p>
      <p>
        The calendar is most useful as a standing agenda item in the legal team's weekly or
        fortnightly review. Five minutes looking at renewals due in the next 90 days prevents
        most unintended extensions.
      </p>

      <hr />

      <h2>Using the dashboard for board reporting</h2>
      <p>
        The four numbers at the top of the dashboard are designed to translate directly into
        board-level reporting without additional work.
      </p>
      <p>
        A board update on legal risk that says "we have reviewed 47 contracts this quarter, we
        have £3.2 million of contract value in agreements with unresolved Red clause risk,
        we have 4 open escalations, and 6 contracts renewing in the next 90 days" is specific,
        quantified, and actionable. It gives the board the information they need to ask the
        right questions without requiring them to understand what a limitation of liability
        clause is.
      </p>
      <p>
        Compare that to the alternative — a verbal update that says legal risk is being managed
        and no material issues have arisen — and the difference in board confidence is significant.
        Boards are increasingly expecting in-house legal teams to quantify their risk management
        in terms that the rest of the business can interpret. The portfolio dashboard makes that
        straightforward.
      </p>
    </ResourcePageLayout>
  );
}
