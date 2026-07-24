import { Info } from "lucide-react";

// ── Regulatory disclaimer ─────────────────────────────────────────────────────
// Prominent, consistent notice shown wherever regulatory content appears. Zane
// surfaces regulatory frameworks as review context only, never as legal advice.

export default function RegulatoryDisclaimer({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border border-[#CBE2F7] bg-[#F5F9FE] px-3.5 py-2.5 ${className}`}>
      <Info size={14} className="text-[#185FA5] shrink-0 mt-0.5" />
      <p className="text-xs text-[#185FA5] leading-relaxed">
        <span className="font-semibold">Review context, not legal advice.</span>{" "}
        Regulatory frameworks are curated from official instruments, not generated, and only
        source-cited frameworks are shown. References are AI-identified pointers into those
        frameworks; verify each against its cited official source before relying on it.
      </p>
    </div>
  );
}
