import { PieChart, Upload, AlertTriangle, CheckCircle, DollarSign, Users, Shield, ArrowRight, Zap, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPortfolio, getCompany, getTimings } from "../lib/api";
import { exportBoardPack } from "../lib/boardPack";
import AppLayout from "../components/layout/AppLayout";
import { CLAUSE_LABELS, type ClauseCategory } from "../lib/types";
import { useFeatureFlags } from "../contexts/FeatureFlagsContext";
import UpgradePrompt from "../components/UpgradePrompt";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `£${(n / 1_000).toFixed(0)}k`;
  return `£${n.toFixed(0)}`;
}

// ── Answer card, the main commercial answer format ───────────────────────────

function AnswerCard({
  question,
  answer,
  detail,
  icon: Icon,
  color = "text-foreground",
  urgent = false,
}: {
  question: string;
  answer: string;
  detail?: string;
  icon: React.ElementType;
  color?: string;
  urgent?: boolean;
}) {
  return (
    <div className={`card p-5 space-y-3 ${urgent ? "border-red-500/30" : ""}`}>
      <div className="flex items-center gap-2">
        <Icon size={14} className={color} />
        <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{question}</span>
      </div>
      <div className={`text-2xl font-bold leading-tight ${color}`}>{answer}</div>
      {detail && <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>}
    </div>
  );
}

// ── Stacked bar ───────────────────────────────────────────────────────────────

function StackedBar({ red, amber, green, height = "h-2" }: { red: number; amber: number; green: number; height?: string }) {
  const total = red + amber + green;
  if (total === 0) return <div className={`${height} bg-muted rounded-full`} />;
  return (
    <div className={`flex ${height} rounded-full overflow-hidden gap-px`}>
      {red   > 0 && <div className="bg-red-400"   style={{ flex: red }} />}
      {amber > 0 && <div className="bg-amber-400" style={{ flex: amber }} />}
      {green > 0 && <div className="bg-green-400" style={{ flex: green }} />}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Portfolio() {
  const { data, isLoading } = useQuery({ queryKey: ["portfolio"], queryFn: getPortfolio });
  const { data: company }   = useQuery({ queryKey: ["company"],   queryFn: getCompany, retry: false });
  const { flags } = useFeatureFlags();

  return (
    <AppLayout>
      <div className="px-6 py-8 max-w-6xl mx-auto space-y-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Portfolio Risk</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Commercial answers about your contract portfolio. Not analytics, not percentages.
            </p>
          </div>
          {data && (
            <button
              onClick={async () => {
                const timings = await getTimings().catch(() => null);
                const companyName = (company as { name?: string } | undefined)?.name || "Your company";
                const dateLabel = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
                exportBoardPack({ companyName, data, timings, dateLabel });
              }}
              className="btn-secondary flex items-center gap-1.5 text-sm shrink-0"
            >
              <Download size={14} /> Export board pack
            </button>
          )}
        </div>

        {!flags.portfolioDashboard && (
          <UpgradePrompt feature="Portfolio Risk Dashboard" requiredTier="team" />
        )}

        {flags.portfolioDashboard && isLoading && (
          <div className="py-20 text-center text-sm text-muted-foreground">Loading portfolio…</div>
        )}

        {flags.portfolioDashboard && !isLoading && !data && (
          <div className="card p-14 text-center space-y-5">
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mx-auto">
              <PieChart size={24} className="text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <div className="font-semibold">No portfolio data yet</div>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                Upload 3 or more contracts to see recurring risk across your estate: which clause types consistently
                flag red, which counterparties deviate most from your playbook, and where contract value is concentrated.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              <Link to="/app/legal/library" className="btn-primary gap-2">
                <Upload size={14} />
                Upload a contract
              </Link>
              <p className="text-xs text-muted-foreground">Portfolio view populates after your first completed review</p>
            </div>
          </div>
        )}

        {flags.portfolioDashboard && data && <PortfolioContent data={data} />}
      </div>
    </AppLayout>
  );
}

// ── Real portfolio content ────────────────────────────────────────────────────

type PortfolioData = NonNullable<Awaited<ReturnType<typeof getPortfolio>>>;

function PortfolioContent({ data }: { data: PortfolioData }) {
  const deviatingCounterparties = data.byCounterparty.filter((cp) => cp.red > 0).length;

  return (
    <div className="space-y-6">

      {/* Commercial answers */}
      <div className="grid sm:grid-cols-3 gap-4">
        <AnswerCard
          question="How much am I exposed?"
          answer={data.valueAtRisk.RED > 0 ? fmt(data.valueAtRisk.RED) : "£0"}
          detail={
            data.valueAtRisk.RED > 0
              ? `Contract value in agreements with one or more RED-flagged clauses. ${data.totalRedResults} clause${data.totalRedResults !== 1 ? "s" : ""} outside your risk tolerance.`
              : "No contracts with RED-flagged clauses. Your portfolio is clean."
          }
          icon={DollarSign}
          color={data.valueAtRisk.RED > 0 ? "text-[#A32D2D]" : "text-[#1B7A4B]"}
          urgent={data.valueAtRisk.RED > 0}
        />
        <AnswerCard
          question="What needs approval before execution?"
          answer={`${data.escalationsOpen} contract${data.escalationsOpen !== 1 ? "s" : ""}`}
          detail={
            data.escalationsOpen > 0
              ? "These contracts contain clauses that require senior sign-off. Do not execute until approvals are recorded."
              : "No contracts are waiting for approval. All escalations are resolved."
          }
          icon={Shield}
          color={data.escalationsOpen > 0 ? "text-[#854F0B]" : "text-[#1B7A4B]"}
        />
        <AnswerCard
          question="Who is pushing back on your terms?"
          answer={`${deviatingCounterparties} counterpart${deviatingCounterparties !== 1 ? "ies" : "y"}`}
          detail={
            deviatingCounterparties > 0
              ? `${deviatingCounterparties} counterpart${deviatingCounterparties !== 1 ? "ies" : "y"} with RED-flagged clauses across ${data.totalDocuments} reviewed contracts.`
              : "No counterparties are pushing RED-flagged positions in your current portfolio."
          }
          icon={Users}
          color={deviatingCounterparties > 0 ? "text-[#185FA5]" : "text-[#1B7A4B]"}
        />
      </div>

      {/* Where is risk concentrated */}
      {data.topRedCategories.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <h3 className="text-sm font-semibold">Where is your risk concentrated?</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Clause types with the most RED flags across your portfolio</p>
          </div>
          <div className="divide-y divide-border/40">
            {data.topRedCategories.map(({ category, count }) => (
              <div key={category} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">
                    {CLAUSE_LABELS[category as ClauseCategory] ?? category.replace(/_/g, " ")}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-[#A32D2D]">{count} RED</div>
                  <div className="text-[10px] text-muted-foreground">{count > 1 ? "contracts" : "contract"}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-border/40 bg-card/50">
            <Link to="/app/legal/playbook" className="inline-flex items-center gap-1.5 text-xs text-[#185FA5] hover:text-[#2563EB] transition-colors">
              Review playbook positions
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      )}

      {/* Counterparties deviating */}
      {data.byCounterparty.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <h3 className="text-sm font-semibold">Counterparties deviating from your standard terms</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Counterparties with RED-flagged positions in your portfolio</p>
          </div>
          <div className="divide-y divide-border/40">
            {data.byCounterparty.map(({ name, red, amber, green, total, value }) => {
              const tot = red + amber + green;
              return (
                <div key={name} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {total} contract{total !== 1 ? "s" : ""}
                      {value > 0 && ` · ${fmt(value)}`}
                    </div>
                  </div>
                  <div className="w-32">
                    <StackedBar red={red} amber={amber} green={green} height="h-2" />
                  </div>
                  <div className="text-right shrink-0 w-20">
                    {red > 0 ? (
                      <span className="text-xs font-semibold text-[#A32D2D]">{red} RED</span>
                    ) : tot > 0 ? (
                      <span className="text-xs font-semibold text-[#854F0B]">{Math.round((amber / tot) * 100)}% amber</span>
                    ) : (
                      <span className="text-xs text-[#1B7A4B]">Clean</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Risk by contract type */}
      {data.byContractType.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <h3 className="text-sm font-semibold">Risk by contract type</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Which contract types are generating the most risk</p>
          </div>
          <div className="divide-y divide-border/50">
            {data.byContractType.map(({ type, red, amber, total }) => (
              <div key={type} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium capitalize">{type.toLowerCase().replace(/_/g, " ")}</div>
                  <div className="text-xs text-muted-foreground">{total} contract{total !== 1 ? "s" : ""}</div>
                </div>
                <div className="flex items-center gap-2">
                  {red   > 0 && <span className="rag-red text-xs">{red} RED</span>}
                  {amber > 0 && <span className="rag-amber text-xs">{amber} AMBER</span>}
                  {red === 0 && amber === 0 && <span className="rag-green text-xs">Clean</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio insight */}
      <div className="card bg-accent border-accent-border p-5">
        <div className="flex items-start gap-3">
          <Zap size={16} className="text-primary mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              Portfolio insight
              <span className="inline-flex items-center gap-1 text-[10px] font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {data.totalDocuments} contracts analysed
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{data.insight}</p>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {data.escalationsOpen > 0 && (
                <p className="text-xs text-[#854F0B] flex items-center gap-1.5">
                  <AlertTriangle size={11} />
                  {data.escalationsOpen} contract{data.escalationsOpen !== 1 ? "s" : ""} pending approval
                </p>
              )}
              {data.signedDocs > 0 && (
                <p className="text-xs text-[#1B7A4B] flex items-center gap-1.5">
                  <CheckCircle size={11} />
                  {data.signedDocs} contract{data.signedDocs !== 1 ? "s" : ""} signed or executed
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
