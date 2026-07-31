import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";
import { getDocumentText } from "../lib/api";

// ── Document pane (split review view) ─────────────────────────────────────────
// Left half of the split review layout: the contract text in readable navy on
// warm off-white. Selecting a finding (activeCategory) scrolls to and highlights
// the block that carries that clause. No character offsets are captured at
// review time, so anchoring is by clause-passage match, not exact offset; the
// server tags each block with the clause categories it contains.

export default function DocumentPane({
  documentId,
  activeCategory,
}: {
  documentId: string;
  activeCategory: string | null;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["document-text", documentId],
    queryFn: () => getDocumentText(documentId),
    staleTime: 5 * 60_000,
  });

  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const blocks = data?.blocks ?? [];

  // Which block carries the selected finding's clause.
  const activeBlockId = activeCategory
    ? blocks.find((b) => b.clauseCategories.includes(activeCategory))?.id ?? null
    : null;

  // Scroll within the pane's own scroll container (not the window) so the
  // passage lands near the top of the document pane. offsetTop is measured
  // against the container (which is the positioned offsetParent), so this is
  // absolute and correct on every repeated selection.
  useEffect(() => {
    if (!activeBlockId) return;
    const el = blockRefs.current.get(activeBlockId);
    const container = scrollRef.current;
    if (!el || !container) return;
    // Instant, not smooth: smooth scroll is a no-op inside this container.
    container.scrollTop = Math.max(0, el.offsetTop - 12);
  }, [activeBlockId]);

  return (
    <div className="rounded-xl border border-[#E7E2D8] bg-[#FBFAF7] flex flex-col overflow-hidden lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
      <div className="px-4 py-2.5 border-b border-[#E7E2D8] flex items-center gap-2 shrink-0 bg-[#F5F2EA]">
        <FileText size={13} className="text-[#64748B]" />
        <span className="text-xs font-semibold text-[#0B1020]">Document</span>
        {data?.source === "clauses" && (
          <span className="text-[10px] text-[#64748B] ml-auto">Extracted passages</span>
        )}
      </div>

      <div ref={scrollRef} className="relative flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {isLoading && (
          <div className="py-16 text-center text-sm text-[#64748B] flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading document…
          </div>
        )}
        {isError && (
          <div className="py-16 text-center text-sm text-[#A32D2D]">The document text could not be loaded.</div>
        )}
        {!isLoading && !isError && blocks.length === 0 && (
          <div className="py-16 text-center text-sm text-[#64748B]">
            No document text is available for this contract.
          </div>
        )}
        {blocks.map((b) => {
          const active = b.id === activeBlockId;
          return (
            <div
              key={b.id}
              ref={(el) => { if (el) blockRefs.current.set(b.id, el); else blockRefs.current.delete(b.id); }}
              className={`text-[13px] leading-relaxed whitespace-pre-wrap mb-3 rounded-md px-2 py-1.5 transition-colors -mx-2 ${
                active ? "bg-[#FDF3D6] text-[#0B1020]" : "text-[#1E293B]"
              }`}
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              {b.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
