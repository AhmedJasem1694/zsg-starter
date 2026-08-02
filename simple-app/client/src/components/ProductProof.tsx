/**
 * Product artefacts for the homepage.
 *
 * Every visual on the marketing page is a rendering of something the product
 * actually produces, not an illustration of it. The figures are the ones the
 * demo account really holds, so a reader who asks for the demo sees the same
 * numbers rather than a marketing approximation:
 *
 *   liability caps accepted below playbook   4 contracts, 1,062,000, Nexus Solutions Ltd
 *   the clause that broke the red line       Nexus Statement of Work Q2, 95,000
 *
 * All four share one frame. No browser chrome, no tilt, no collage: the point
 * is the content, and a window dressing around it would read as a mock rather
 * than the thing itself.
 */

import type { ReactNode } from "react";

/** The single frame every product visual sits in. */
export function ProductFrame({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line-light bg-white shadow-sm overflow-hidden transition-[border-color,box-shadow] duration-200 ease-out hover:border-slate-300 hover:shadow-lg">
      {label && (
        <div className="border-b border-line-light px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * A single RAG-rated finding as it appears on a review. Red status, the risk in
 * plain English, and the wording to send back.
 */
export function ClauseFindingCard() {
  return (
    <ProductFrame label="Review, Nexus Solutions Statement of Work Q2">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink">Limitation of Liability</div>
            <div className="text-xs text-slate-500 mt-0.5">Clause 11.2</div>
          </div>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-[#FDECEC] text-[#A32D2D] border border-[#F6D5D5]">
            Red
          </span>
        </div>

        <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3.5 py-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1.5">Why it matters</div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Liability is capped at 12 months of fees with data protection breach inside the cap rather
            than carved out. A single data incident on this work could exhaust the cap and leave you
            carrying the balance.
          </p>
        </div>

        <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3.5 py-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1.5">Wording to send back</div>
          <p className="text-xs text-slate-600 leading-relaxed font-mono">
            "...provided that nothing in this clause shall limit either party's liability for breach of
            its data protection obligations or for infringement of intellectual property rights."
          </p>
        </div>
      </div>
    </ProductFrame>
  );
}

/**
 * The decision as it is recorded: what was chosen, and the reasoning attached to
 * it. This is the step the mechanism section claims and the one that compounds.
 */
export function DecisionRecordCard() {
  return (
    <ProductFrame label="Decision recorded">
      <div className="p-5 space-y-3.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FAEEDA] text-[#854F0B]">
            Accepted below playbook
          </span>
          <span className="text-xs text-slate-400">Limitation of Liability</span>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Where it landed</div>
          <p className="text-xs text-slate-600">12 months of fees, data breach not carved out</p>
        </div>
        <div className="border-t border-line-light pt-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Reasoning, captured at the decision</div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Accepted under protest on a lower value statement of work. Explicitly not a precedent for
            the Nexus master agreement.
          </p>
        </div>
      </div>
    </ProductFrame>
  );
}

/**
 * The pattern that only exists because the decisions above were recorded. The
 * figures are the demo account's real totals.
 */
export function PatternCard() {
  return (
    <ProductFrame label="Negotiation intelligence">
      <div className="p-5 space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-semibold text-ink">Repeated acceptance below playbook</div>
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md bg-[#FAEEDA] text-[#854F0B]">
            Action
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          You have accepted Limitation of Liability below your playbook position in 4 contracts. Each
          one was flagged before it was signed.
        </p>
        <div className="grid grid-cols-2 gap-2.5 pt-0.5">
          <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Frequency</div>
            <div className="text-xs text-slate-600 tabular">4 contracts</div>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Value affected</div>
            <div className="text-xs text-slate-600 tabular">£1,062,000</div>
          </div>
        </div>
        <div className="pt-0.5">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Counterparty</div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EEF2F8] text-[#475569] border border-[#E2E8F0]">
            Nexus Solutions Ltd
          </span>
        </div>
      </div>
    </ProductFrame>
  );
}

/** The approval request as it arrives, matching the template the server sends. */
export function ApprovalEmailCard() {
  return (
    <ProductFrame label="Approval request, as it lands">
      <div className="px-5 py-4 border-b border-line-light">
        <div className="text-sm font-semibold text-ink leading-snug">
          Approval needed: Nexus Solutions, Statement of Work Q2
        </div>
        <div className="text-xs text-slate-400 mt-1">approvals@zanelegal.ai to the CFO</div>
      </div>
      <div className="px-5 py-4 space-y-2.5">
        <p className="text-xs text-slate-600 leading-relaxed">
          A contract is waiting for your CFO approval before the team can proceed.
        </p>
        <dl className="text-xs text-slate-600 space-y-1">
          {[
            ["Contract", "Nexus Solutions, Statement of Work Q2"],
            ["Counterparty", "Nexus Solutions Ltd"],
            ["Value", "£95,000"],
            ["Reason", "data protection breach sits inside the liability cap"],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <dt className="w-24 shrink-0 text-slate-400">{k}</dt>
              <dd className={k === "Value" ? "tabular" : ""}>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="pt-1 text-xs font-medium text-blue-600">Review and decide &rarr;</div>
      </div>
    </ProductFrame>
  );
}
