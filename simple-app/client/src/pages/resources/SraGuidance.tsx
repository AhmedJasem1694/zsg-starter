import ResourcePageLayout from "../../components/ResourcePageLayout";

export default function SraGuidance() {
  return (
    <ResourcePageLayout
      category="Legal"
      title="Zane and the SRA Code of Conduct"
      readTime="5 min read"
    >
      <p>
        In-house solicitors and their GCs regularly ask one question before deploying any AI
        tool in their legal workflow: does using this create professional obligations issues
        under the SRA Code of Conduct 2019?
      </p>
      <p>
        The short answer is no — provided Zane is used as it is designed to be used, which is
        as a decision support tool that informs human judgment rather than replacing it. This
        document explains why, with specific reference to the relevant SRA obligations.
      </p>

      <hr />

      <h2>The key SRA obligations in scope</h2>
      <p>
        Three provisions of the SRA Code of Conduct 2019 are most relevant to the use of
        AI-assisted contract review tools.
      </p>
      <p>
        <strong>Paragraph 4.2</strong> requires solicitors to maintain their own competence and
        keep their legal knowledge and skills up to date. The SRA's guidance on this provision
        makes clear that competence includes being aware of developments in the tools and
        technologies available to legal practitioners. Using AI tools to assist with research,
        document review, and risk analysis is consistent with — not in tension with — this
        obligation, provided the solicitor retains personal responsibility for the output and
        does not blindly adopt AI recommendations without applying their own judgment.
      </p>
      <p>
        <strong>Paragraph 4.3</strong> requires solicitors to act within the limits of their
        competence and refer matters to others where they lack the necessary competence to deal
        with them adequately. Using Zane to identify clause-level risks outside a solicitor's
        usual area of expertise — and then seeking advice from a specialist before making a
        decision — is entirely consistent with this obligation. The tool extends competence;
        it does not substitute for it.
      </p>
      <p>
        <strong>Paragraph 1.4</strong> requires solicitors to only make referrals or recommend
        third-party services when it is in the client's best interests. For in-house solicitors,
        the "client" is the business. Using Zane to process contracts more efficiently and
        consistently — and to surface risks that might otherwise be missed in a manual review —
        is plainly in the client's best interests when the output is reviewed critically by
        a qualified lawyer.
      </p>

      <hr />

      <h2>How Zane is designed with professional obligations in mind</h2>
      <p>
        Every element of Zane's output is framed as a recommendation, not a decision. The system
        never signs anything, never sends anything, and never takes any irreversible action
        without explicit human instruction.
      </p>
      <p>
        Specific design features that support professional obligations:
      </p>
      <ul>
        <li>
          <strong>Override functionality.</strong> Every Zane assessment can be overridden by the
          reviewing lawyer. When a lawyer marks a Zane recommendation as incorrect, they record
          their reasoning. This creates a documented trail of professional judgment applied to
          AI output — exactly what the SRA guidance contemplates. It also trains the system to
          be more accurate for that company's specific context over time.
        </li>
        <li>
          <strong>Confidence signals.</strong> Zane flags clauses where it has lower confidence
          in its assessment and recommends lawyer review. Flagging uncertainty is a design
          choice, not a limitation. The system is not designed to appear more confident than
          it is.
        </li>
        <li>
          <strong>Audit trail.</strong> Every Zane recommendation, every human decision made
          in response, and every override with recorded reasoning is stored in a timestamped,
          attributed audit trail. This audit trail is the documented evidence that a qualified
          lawyer reviewed the contract, considered the AI recommendations, and made informed
          decisions. It is the opposite of abdication of responsibility.
        </li>
        <li>
          <strong>Human-gated escalations.</strong> Escalation requests require human sign-off.
          Zane identifies who should approve a decision and routes the request — but the approval
          is a human act by a named, accountable individual. The system cannot approve its own
          escalation requests.
        </li>
      </ul>

      <hr />

      <h2>The data protection dimension</h2>
      <p>
        In-house solicitors reviewing contracts that contain client or counterparty personal data
        have a legitimate concern about what happens to that data when it is uploaded to any
        third-party tool. This is both a professional obligation concern and a UK GDPR compliance
        concern.
      </p>
      <p>
        Zane addresses this through PII anonymisation before any contract text reaches an AI model.
        The anonymisation engine identifies and replaces personally identifiable information
        — party names, individual names in signature blocks, email addresses, phone numbers,
        financial account details, and other regulated data categories — with placeholder tokens
        before analysis begins. The placeholder tokens are restored in the output after the AI
        analysis is complete.
      </p>
      <p>
        What this means in practice: the AI model that analyses your contract never processes
        the names of the individuals involved in the transaction, the names of the specific
        companies, or the financial figures that would identify the deal. It analyses the legal
        structure of the document, not the personal data within it.
      </p>
      <p>
        This does not eliminate all data protection considerations — your team should still
        review Zane's data processing agreement and understand what data is retained and for
        how long — but it significantly reduces the surface area of personal data exposure
        in the AI analysis pipeline.
      </p>

      <hr />

      <h2>Practical guidance for in-house solicitors</h2>
      <p>
        Using Zane in a way that is consistent with your SRA obligations is straightforward.
        The same professional habits that apply to any research or analysis tool apply here.
      </p>
      <ul>
        <li>
          <strong>Review the output critically.</strong> Read what Zane says about each clause.
          Do not accept its assessment without asking whether it makes sense given your knowledge
          of the contract, the counterparty, and the commercial context.
        </li>
        <li>
          <strong>Apply your own judgment.</strong> Zane knows your playbook and can apply it
          mechanically to a clause. You know the business, the relationship, and the risk
          tolerance for this particular transaction. Those are different inputs. Both matter.
        </li>
        <li>
          <strong>Record your reasoning when you override.</strong> If you disagree with Zane's
          assessment, say why. The override record is the documentation of your professional
          judgment. It is also the audit trail that demonstrates you engaged with the AI output
          rather than delegating your judgment to it.
        </li>
        <li>
          <strong>Know Zane's limitations.</strong> Zane is calibrated for standard commercial
          contracts in English. It performs less reliably on heavily negotiated bespoke structures,
          non-standard drafting conventions, and contracts in legal systems it has limited
          training data for. In these situations, apply additional scrutiny. Do not rely on
          the AI assessment as a substitute for careful manual review.
        </li>
        <li>
          <strong>Maintain awareness of the technology.</strong> This is itself a competence
          obligation under paragraph 4.2. Understanding what Zane does, how it does it, and
          what its limitations are is part of using it competently. The SRA expects solicitors
          who use AI tools to understand those tools well enough to apply appropriate judgment
          to their outputs.
        </li>
      </ul>

      <hr />

      <h2>A note on legal professional privilege</h2>
      <p>
        Contract review outputs generated through Zane — including risk summaries, escalation
        recommendations, and override reasoning — may be subject to legal professional privilege
        where they are created for the dominant purpose of anticipated litigation or in
        connection with legal advice from a qualified lawyer to their client.
      </p>
      <p>
        In-house solicitors should apply the same privilege analysis they would apply to any
        internal legal document. A risk memo generated with Zane's assistance and reviewed and
        approved by a qualified solicitor may attract privilege in appropriate circumstances.
        A purely administrative output — a contract value record or a renewal date alert —
        is unlikely to.
      </p>
      <p>
        If privilege is a concern for a particular contract or context, take specialist advice
        before sharing Zane outputs beyond the legal team. The existence of an AI tool in the
        review process does not change the privilege analysis, but the nature and purpose of
        the specific output does.
      </p>

      <hr />

      <p>
        <em>
          This document is guidance for in-house legal teams using Zane and does not constitute
          legal advice. Questions about specific professional obligations should be directed to
          the SRA or specialist professional regulation counsel.
        </em>
      </p>
    </ResourcePageLayout>
  );
}
