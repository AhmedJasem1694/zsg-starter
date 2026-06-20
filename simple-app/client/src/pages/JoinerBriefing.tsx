import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Brain, Loader2, RefreshCw, BookOpen, Scale, Users, Lightbulb, BarChart2, ShieldCheck } from "lucide-react";
import { getTeamBriefing, generateTeamBriefing, type TeamBriefing } from "../lib/api";
import { formatDateShort } from "../lib/dateUtils";
import AppLayout from "../components/layout/AppLayout";

// The inheritance layer made visible: a single briefing a new joiner reads on day
// one, assembled from everything Zane has captured for the company. Sections map
// one-to-one onto team_briefing_documents.

const SECTIONS: { key: keyof TeamBriefing; title: string; blurb: string; icon: typeof BookOpen }[] = [
  { key: "playbook_briefing",     title: "The playbook",            blurb: "Your company's positions on every clause type.",              icon: BookOpen },
  { key: "actual_vs_stated",      title: "Stated vs actual",        blurb: "Where real practice differs from the written playbook.",      icon: Scale },
  { key: "counterparty_intel",    title: "Counterparties",          blurb: "How the company has dealt with each counterparty.",          icon: Users },
  { key: "significant_decisions", title: "Decisions and reasoning", blurb: "The unusual calls the team made, and why.",                   icon: Lightbulb },
  { key: "portfolio_snapshot",    title: "The portfolio",           blurb: "What you are inheriting across the estate.",                  icon: BarChart2 },
  { key: "approval_matrix",       title: "Approval matrix",         blurb: "When to escalate, and to whom.",                             icon: ShieldCheck },
];

export default function JoinerBriefing() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["team-briefing"], queryFn: getTeamBriefing });
  const briefing = data?.briefing ?? null;
  const [open, setOpen] = useState<string | null>(SECTIONS[0].key);

  const genMutation = useMutation({
    mutationFn: generateTeamBriefing,
    onSuccess: (res) => {
      queryClient.setQueryData(["team-briefing"], res);
      setOpen(SECTIONS[0].key);
    },
  });

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Brain size={18} className="text-[#60A5FA]" />
              <h1 className="text-xl font-bold tracking-tight text-foreground">New joiner briefing</h1>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
              When someone leaves, the knowledge stays. This is everything Zane has captured about how
              your company decides, assembled so a new joiner inherits it instead of starting from zero.
            </p>
            {briefing && (
              <p className="text-xs text-muted-foreground/70">
                Generated {formatDateShort(briefing.generatedAt)}
                {briefing.validUntil ? ` · valid until ${formatDateShort(briefing.validUntil)}` : ""}
              </p>
            )}
          </div>
          <button
            onClick={() => genMutation.mutate()}
            disabled={genMutation.isPending}
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {genMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {briefing ? "Regenerate" : "Generate briefing"}
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
            <Loader2 size={16} className="animate-spin" /> Loading briefing…
          </div>
        ) : !briefing ? (
          <div className="rounded-xl border border-border bg-card px-6 py-12 text-center space-y-3">
            <Brain size={28} className="text-[#60A5FA] mx-auto" />
            <p className="text-sm text-foreground font-medium">No briefing generated yet.</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Generate one to pull together the playbook, the decision history, the counterparty patterns,
              the portfolio, and the approval matrix into a single inheritable document.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {SECTIONS.map(({ key, title, blurb, icon: Icon }) => {
              const body = String(briefing[key] ?? "").trim();
              const isOpen = open === key;
              return (
                <div key={key} className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setOpen(isOpen ? null : key)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-foreground/[0.02] transition-colors"
                  >
                    <Icon size={16} className="text-[#60A5FA] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground">{title}</div>
                      <div className="text-xs text-muted-foreground truncate">{blurb}</div>
                    </div>
                    <span className={`text-muted-foreground/50 text-xs transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-border">
                      <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/85 leading-relaxed">{body}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
