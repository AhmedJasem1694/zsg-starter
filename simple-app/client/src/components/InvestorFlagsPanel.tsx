/**
 * InvestorFlagsPanel — shown on FounderDashboard when investment-related docs exist.
 * Surfaces RED/AMBER results from term sheets, SHAs, etc. with founder-friendly language.
 */
import { useQuery } from "@tanstack/react-query";
import { TrendingDown, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getDocuments } from "../lib/api";
import type { UploadedDocument, ReviewResult } from "../lib/types";
import { CLAUSE_LABELS } from "../lib/types";
import type { ClauseCategory } from "../lib/types";

const INVESTMENT_DOC_TYPES = new Set([
  "TERM_SHEET", "SUBSCRIPTION_AGREEMENT", "SHA", "CONVERTIBLE_NOTE",
  "SAFE", "INVESTMENT_AGREEMENT", "SHARE_PURCHASE",
]);

const INVESTOR_UNFRIENDLY_CLAUSES = new Set([
  "LIQUIDATION_PREFERENCE", "ANTI_DILUTION", "DRAG_ALONG",
  "REDEMPTION_RIGHTS", "PAY_TO_PLAY", "BOARD_COMPOSITION",
  "OPTION_POOL_SHUFFLE",
]);

const FOUNDER_FLAG_LABELS: Partial<Record<ClauseCategory, string>> = {
  LIQUIDATION_PREFERENCE: "Liquidation preference — who gets paid first",
  ANTI_DILUTION:          "Anti-dilution — how investors protect their %",
  DRAG_ALONG:             "Drag-along — investors can force a sale",
  REDEMPTION_RIGHTS:      "Redemption rights — investors can demand cash back",
  PAY_TO_PLAY:            "Pay-to-play — penalties if you don't invest in next round",
  BOARD_COMPOSITION:      "Board composition — who controls decisions",
  OPTION_POOL_SHUFFLE:    "Option pool — dilution before investors come in",
};

type DocWithResults = UploadedDocument;

export default function InvestorFlagsPanel() {
  const navigate = useNavigate();
  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getDocuments(),
  });

  // Only investment docs with completed reviews
  const investmentDocs = (documents as DocWithResults[]).filter(
    (d) => INVESTMENT_DOC_TYPES.has(d.contractType) && d.status === "COMPLETE"
  );

  if (investmentDocs.length === 0) return null;

  // Collect all investor-flag RED/AMBER results
  const flags: { docId: string; docName: string; result: ReviewResult }[] = [];
  for (const doc of investmentDocs) {
    for (const r of (doc.reviewResults ?? [])) {
      if (
        INVESTOR_UNFRIENDLY_CLAUSES.has(r.clauseCategory as ClauseCategory) &&
        (r.ragStatus === "RED" || r.ragStatus === "AMBER")
      ) {
        flags.push({ docId: doc.id, docName: doc.originalName, result: r });
      }
    }
  }

  if (flags.length === 0) return null;

  return (
    <div className="card border-amber-200 bg-amber-50/40">
      <div className="card-body space-y-3">
        <div className="flex items-center gap-2">
          <TrendingDown size={14} className="text-amber-600" />
          <span className="text-sm font-semibold text-amber-800">Investor term flags</span>
        </div>
        <p className="text-xs text-amber-700">
          MIKE spotted these investor-unfriendly terms in your investment documents.
        </p>
        <div className="space-y-2">
          {flags.slice(0, 5).map(({ docId, docName, result }) => (
            <button
              key={result.id}
              className="w-full flex items-start gap-2.5 text-left rounded-lg hover:bg-amber-100/60 px-2 py-1.5 transition-colors"
              onClick={() => navigate(`/app/founder/review/${docId}`)}
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${result.ragStatus === "RED" ? "bg-red-500" : "bg-amber-400"}`} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground">
                  {FOUNDER_FLAG_LABELS[result.clauseCategory as ClauseCategory]
                   ?? CLAUSE_LABELS[result.clauseCategory as ClauseCategory]
                   ?? result.clauseCategory.replace(/_/g, " ")}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{docName}</div>
              </div>
              <ChevronRight size={12} className="text-muted-foreground shrink-0 mt-1" />
            </button>
          ))}
          {flags.length > 5 && (
            <p className="text-xs text-muted-foreground pl-2">+{flags.length - 5} more in your reviews</p>
          )}
        </div>
      </div>
    </div>
  );
}
