import ResourcePageLayout from "../../components/ResourcePageLayout";

export default function ReviewTimeCaseStudy() {
  return (
    <ResourcePageLayout
      category="Case Study"
      title="Reducing review time from 4 hours to 20 minutes"
      readTime="10 min read"
    >
      <p>
        A typical supplier agreement review for a lean in-house legal team takes three to four hours
        when done manually. This is not because the lawyer is slow. It is because the process is
        fragmented, disconnected, and designed around individual effort rather than institutional
        memory.
      </p>
      <p>
        This guide walks through a realistic before-and-after scenario for a technology services
        agreement at a UK financial services company. The numbers are representative of what teams
        report in practice.
      </p>

      <hr />

      <h2>The contract</h2>
      <p>
        A 47-page technology services agreement with a SaaS provider. Annual contract value of
        £84,000. Three-year initial term with auto-renewal. The supplier is providing a data
        analytics platform that will process customer transaction data on behalf of the company.
        Standard supplier paper drafted in the supplier's favour.
      </p>
      <p>
        The legal team is three people: the General Counsel, a senior in-house solicitor, and a
        paralegal. The senior solicitor is handling this review.
      </p>

      <hr />

      <h2>Before: the manual review process</h2>
      <h3>Day 1, 9am: Contract arrives</h3>
      <p>
        The contract arrives by email from the procurement team. The email says the supplier needs
        a decision by end of week. The solicitor downloads the PDF, opens a blank Word document for
        notes, and opens the playbook in a third window.
      </p>

      <h3>Day 1, 9am to 11am: Reading the contract</h3>
      <p>
        First read: 90 minutes. The contract is well-drafted but dense. The liability clause is in
        clause 14 but references definitions in clause 2 and a schedule. The data processing
        obligations are split across clause 9 and Schedule 3. The auto-renewal mechanism is buried
        in clause 17.3 of the general terms.
      </p>
      <p>
        The solicitor notes ten clauses that need attention. She does not yet know which are Red,
        which are Amber, and which are acceptable.
      </p>

      <h3>Day 1, 11am to 1pm: Cross-referencing the playbook</h3>
      <p>
        The solicitor goes through each clause category against the playbook. Limitation of
        liability: the supplier's cap is six months of fees, mutual. The playbook preferred
        position is 12 months. Fallback is six months. She notes this is at fallback, not Red.
        She moves on.
      </p>
      <p>
        Data processing: the supplier has included a DPA as Schedule 3. The solicitor reviews it
        against the UK GDPR requirements. The sub-processor list is attached but the mechanism for
        adding sub-processors is a 14-day notice with no right to object. The playbook requires
        prior written consent or at least the right to object. This is Red.
      </p>
      <p>
        She works through all ten flagged clauses. One is Red. Three are Amber. Six are either
        Green or acceptable without comment. Total time: two hours.
      </p>

      <h3>Day 1, afternoon: Writing the risk memo</h3>
      <p>
        The solicitor drafts a risk memo in Word. She explains each issue, quantifies the
        exposure where possible, recommends negotiation positions, and identifies that the contract
        value triggers GC sign-off. The memo runs to four pages. She emails it to the GC at 4pm.
        Total time: 60 minutes.
      </p>

      <h3>Day 2: The back-and-forth</h3>
      <p>
        The GC reads the memo the following morning and has a question about the sub-processor
        clause. She wants to know whether the 14-day notice period is standard in the market for
        this type of supplier. The solicitor goes back to the contract, checks her notes, and
        drafts a brief reply. Total time: 30 minutes.
      </p>
      <p>
        The GC approves proceeding with the negotiation. The solicitor emails the counterparty with
        redlines. Two more rounds of negotiation follow over the next week.
      </p>
      <p>
        <strong>Total lawyer time for the initial review: approximately 4 hours.</strong> Spread
        across two days. The counterparty was waiting throughout.
      </p>

      <hr />

      <h2>After: the Zane-assisted review</h2>
      <h3>Upload: 2 minutes</h3>
      <p>
        The solicitor uploads the 47-page PDF to Zane. She selects the contract type (Technology
        Services Agreement), enters the counterparty name, and enters the contract value of £84,000.
        She clicks Review.
      </p>

      <h3>PII anonymisation: automatic</h3>
      <p>
        Before any contract text reaches an AI model, Zane's anonymisation engine runs. It
        identifies the company name, the counterparty name, individual names in the signature
        block, and financial figures. These are replaced with placeholder tokens. The AI model
        never sees the real counterparty name, the real contract value, or the names of the
        individuals signing.
      </p>

      <h3>Clause extraction and comparison: 8 minutes</h3>
      <p>
        Zane extracts and classifies every clause in the document, maps each to the relevant
        playbook category, and compares the extracted text to the company's playbook positions.
        It identifies:
      </p>
      <ul>
        <li>Limitation of liability: AMBER. Cap at six months fees, mutual. At fallback.</li>
        <li>
          Data processing: RED. Sub-processor mechanism requires 14-day notice with no right to
          object. Playbook requires prior written consent. Zane generates fallback language:
          "Supplier shall not engage any additional Sub-Processor without providing 30 days written
          notice to Company. Company shall have the right to object to the appointment of any
          new Sub-Processor within such notice period."
        </li>
        <li>Auto-renewal: AMBER. 60-day notice window. Playbook preferred is 90 days.</li>
        <li>Payment terms: GREEN. 30 days from valid invoice.</li>
        <li>Governing law: GREEN. English law, English courts.</li>
        <li>IP ownership: AMBER. Licence-back mechanism adequate but non-exclusive only.</li>
        <li>Seven further clause categories: assessed and reported.</li>
      </ul>

      <h3>Escalation routing: automatic</h3>
      <p>
        Zane's escalation engine runs three checks simultaneously. Clause risk: one Red clause
        (data protection) triggers legal review. Contract value: £84,000 triggers GC sign-off
        per the approval matrix (threshold: £50,000). Governance: the contract processes
        customer transaction data at scale, which is a configured governance trigger requiring
        DPO sign-off.
      </p>
      <p>
        The sign-off sequence is generated: Handler then Legal then GC then DPO.
      </p>

      <h3>Lawyer review: 10 minutes</h3>
      <p>
        The solicitor reviews Zane's output. She reads the Red clause analysis. She agrees with
        the assessment and accepts the generated fallback language with one edit. She changes
        "30 days" to "14 days" based on her knowledge that this supplier has accepted 14-day
        notice periods with objection rights in similar contracts. She records her reasoning.
      </p>
      <p>
        She reviews the two Amber clauses. She decides the auto-renewal notice period is worth
        pushing back on and accepts the liability cap fallback position. She copies the generated
        redlines for the data protection clause.
      </p>
      <p>
        <strong>Total lawyer time: approximately 20 minutes.</strong> The GC receives a structured
        risk summary through the platform with a single-click approval request. The DPO receives
        a targeted notification about the data processing scope.
      </p>

      <hr />

      <h2>What the solicitor does with three hours and forty minutes</h2>
      <p>
        This is the question that gets asked in every conversation about AI-assisted legal work.
        The answer is: the work that actually requires a lawyer.
      </p>
      <p>
        The solicitor uses the recovered time for a call with the commercial team to understand
        what they are actually trying to achieve with this supplier relationship and whether the
        standard terms even fit the transaction. She identifies that the supplier is going to be
        involved in a customer-facing workflow that triggers additional FCA notification obligations
        the procurement team had not considered. That conversation changes the shape of the
        negotiation entirely. No AI would have had it.
      </p>
      <p>
        She also uses time to close out three other contracts that had been waiting for attention.
        She reviews a lease renewal. She has a conversation with the CFO about the company's
        approach to third-party risk that results in a change to the approval matrix.
      </p>
      <p>
        The time saving is real. What you do with it is your choice.
      </p>

      <hr />

      <h2>The compounding effect</h2>
      <p>
        The twenty-minute review is useful on the first contract. It becomes significantly more
        valuable by the tenth.
      </p>
      <p>
        After ten contracts with the same counterparty, Zane knows that this supplier consistently
        pushes back on the sub-processor consent requirement and always accepts 14-day objection
        windows if you ask. It knows that their standard payment terms are 30 days and you have
        never needed to negotiate them. It knows which clauses are worth fighting for with this
        counterparty and which ones will be conceded in the first round.
      </p>
      <p>
        After fifty contracts across your supplier base, the Negotiation Intelligence page shows
        which clause categories generate the most Red flags across your entire portfolio. You can
        see that limitation of liability is consistently the hardest clause to negotiate across
        technology suppliers and that your fallback of six months fees is being accepted
        approximately 70 percent of the time. This tells you that your red line of three months
        is the right position and that pushing from six months to 12 months is usually going to
        cost you negotiating capital you could spend elsewhere.
      </p>
      <p>
        The review gets faster. The outcome data gets more accurate. The playbook gets more
        calibrated. The lawyers get better at knowing where to spend their time.
      </p>
    </ResourcePageLayout>
  );
}
