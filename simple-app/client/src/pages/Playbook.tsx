import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Save } from "lucide-react";
import { getPlaybookRules, updatePlaybookRule } from "../lib/api";
import AppLayout from "../components/layout/AppLayout";
import { CLAUSE_LABELS, type ClauseCategory, type PlaybookRule, type ApprovalRole } from "../lib/types";

const APPROVAL_OPTIONS = [
  { value: "",      label: "No approval needed" },
  { value: "LEGAL", label: "Legal team" },
  { value: "GC",    label: "General Counsel" },
  { value: "CFO",   label: "CFO" },
  { value: "BOARD", label: "Board" },
];

function RuleCard({ rule }: { rule: PlaybookRule }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PlaybookRule>(rule);
  const [saved, setSaved] = useState(false);

  const mut = useMutation({
    mutationFn: () => updatePlaybookRule(rule.id, {
      preferredPosition: draft.preferredPosition,
      acceptableFallback: draft.acceptableFallback,
      hardRedLine: draft.hardRedLine,
      approvalRequired: draft.approvalRequired,
      fallbackTemplate: draft.fallbackTemplate,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["playbook-rules"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const dirty = JSON.stringify(draft) !== JSON.stringify(rule);

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-semibold">{CLAUSE_LABELS[rule.clauseCategory as ClauseCategory]}</span>
        <div className="flex items-center gap-3">
          {rule.approvalRequired && (
            <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              Escalates to {rule.approvalRequired}
            </span>
          )}
          {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-card-border px-5 pb-5 pt-4 space-y-4">
          {[
            { field: "preferredPosition" as const, label: "Preferred position" },
            { field: "acceptableFallback" as const, label: "Acceptable fallback" },
            { field: "hardRedLine" as const, label: "Hard red line (non-negotiable)" },
            { field: "fallbackTemplate" as const, label: "Fallback wording template (optional)" },
          ].map(({ field, label }) => (
            <div key={field} className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
              <textarea
                className="input min-h-[80px] resize-y text-sm"
                value={draft[field] ?? ""}
                onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
              />
            </div>
          ))}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Who approves exceptions?</label>
            <select
              className="input text-sm"
              value={draft.approvalRequired ?? ""}
              onChange={(e) => setDraft({ ...draft, approvalRequired: (e.target.value || undefined) as ApprovalRole | undefined })}
            >
              {APPROVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            {saved && <span className="text-xs text-emerald-600 flex items-center gap-1">✓ Saved</span>}
            <button
              className="btn-primary gap-2 text-sm"
              onClick={() => mut.mutate()}
              disabled={!dirty || mut.isPending}
            >
              <Save size={13} />
              {mut.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Playbook() {
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["playbook-rules"],
    queryFn: getPlaybookRules,
  });

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Playbook</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your legal positions for each key clause type. MIKE flags any contract that deviates from these.
          </p>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading playbook…</div>
        ) : rules.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted-foreground">
            No playbook rules found. Go through onboarding to set up your playbook.
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <RuleCard key={rule.id} rule={rule} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
