import { useState } from "react";
import { Brain, CheckCircle } from "lucide-react";
import { saveDecisionReasoning } from "../lib/api";
import { REASONING_QUICK_REASONS, type SignificanceResult } from "../lib/types";

// ─── Reasoning capture prompt (Section 2) ────────────────────────────────────
// Shown inline only when the decision the lawyer just made was flagged
// significant. It states what is specifically unusual and asks why, with quick
// reasons plus free text. It never blocks: the decision is already captured, and
// skipping simply leaves it without a reason. Shared by the corporate review
// (ReviewDetail) and the founder review so both personas behave identically.
export default function ReasoningPrompt({
  significance,
  decisionEventId,
  onClose,
}: {
  significance: SignificanceResult;
  decisionEventId: string;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<string>("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await saveDecisionReasoning(decisionEventId, { category, text: text.trim() });
      setSaved(true);
      setTimeout(onClose, 900);
    } catch {
      onClose(); // non-blocking: closing is fine even if the note did not persist
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-[#1E3A8A]/50 bg-[#0B1220] p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Brain size={15} className="text-[#60A5FA] mt-0.5 shrink-0" />
        <div className="space-y-1 flex-1 min-w-0">
          <div className="text-sm font-semibold text-white leading-snug">{significance.headline}</div>
          {significance.description && (
            <div className="text-xs text-white/55 leading-relaxed">{significance.description}</div>
          )}
          <div className="text-xs text-white/70 pt-0.5">
            What is the reason? This helps Zane apply the right judgment next time.
          </div>
        </div>
        <button onClick={onClose} aria-label="Dismiss" className="text-white/30 hover:text-white/70 transition-colors text-xs shrink-0">
          Skip
        </button>
      </div>

      {saved ? (
        <div className="text-xs text-[#86EFAC] flex items-center gap-1.5">
          <CheckCircle size={13} /> Saved. Zane will remember this.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {REASONING_QUICK_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setCategory(category === r ? "" : r)}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  category === r
                    ? "bg-[#2563EB] text-white border-[#2563EB]"
                    : "border-[#1E293B] text-white/60 hover:border-[#334155]"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            className="w-full rounded-lg border border-[#1E293B] bg-[#020617] px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#2563EB] min-h-[60px] resize-y"
            placeholder="Add any detail (optional)…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => void save()}
              disabled={saving || (!category && !text.trim())}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium transition-colors disabled:opacity-40"
            >
              {saving ? "Saving…" : <><CheckCircle size={12} /> Save reason</>}
            </button>
            <button onClick={onClose} className="text-xs text-white/40 hover:text-white/70 transition-colors">
              Not now
            </button>
          </div>
        </>
      )}
    </div>
  );
}
