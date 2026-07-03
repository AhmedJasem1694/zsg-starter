import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDateTime } from "../lib/dateUtils";
import {
  HardDrive,
  Building2,
  FolderOpen,
  RefreshCw,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  Trash2,
  Mail,
  Copy,
  Check,
} from "lucide-react";
import AppLayout from "../components/layout/AppLayout";
import IntegrationStatusBadge from "../components/IntegrationStatusBadge";
import { req, clearAllContracts, getCompany, updateCompanySettings, getReviewCosts } from "../lib/api";
import {
  deriveRegulationProminence,
  PROMINENCE_TO_SETTING,
  SETTING_LABELS,
  type RegulationAnalysisSetting,
} from "../lib/regulationProminence";

// ── Types ─────────────────────────────────────────────────────────────────────

interface IntegrationConfig {
  id: string;
  provider: "google_drive" | "sharepoint";
  status: "connected" | "disconnected" | "error";
  folderName?: string;
  lastSyncAt?: string;
  errorMessage?: string;
}

interface SyncLogEntry {
  id: string;
  provider: string;
  externalFileName?: string;
  status: string;
  errorMessage?: string;
  created: string;
}

interface DriveFolder {
  id: string;
  name: string;
  siteId?: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────

const getGDriveStatus = () =>
  req<IntegrationConfig | null>("GET", "/api/integrations/google-drive/status");
const getSharePointStatus = () =>
  req<IntegrationConfig | null>("GET", "/api/integrations/sharepoint/status");
const getSyncLog = () =>
  req<{ entries: SyncLogEntry[] }>("GET", "/api/integrations/sync-log");
const getGDriveFolders = () =>
  req<{ folders: DriveFolder[] }>("GET", "/api/integrations/google-drive/folders");
const getSPFolders = () =>
  req<{ folders: DriveFolder[] }>("GET", "/api/integrations/sharepoint/folders");

// ── Sync log status helpers ───────────────────────────────────────────────────

function syncStatusIcon(status: string) {
  if (status === "review_complete")
    return <CheckCircle size={12} className="text-emerald-400 shrink-0" />;
  if (status === "error")
    return <AlertCircle size={12} className="text-red-400 shrink-0" />;
  if (status === "review_started" || status === "downloaded")
    return <RefreshCw size={12} className="text-blue-400 shrink-0 animate-spin" />;
  return <Clock size={12} className="text-[#64748B] shrink-0" />;
}

function syncStatusLabel(status: string): string {
  const map: Record<string, string> = {
    detected: "Detected",
    downloaded: "Downloaded",
    review_started: "Reviewing…",
    review_complete: "Complete",
    skipped: "Skipped",
    error: "Error",
  };
  return map[status] ?? status;
}

// ── Integration card ──────────────────────────────────────────────────────────

interface IntegrationCardProps {
  title: string;
  Icon: React.ElementType;
  provider: "google_drive" | "sharepoint";
  config: IntegrationConfig | null | undefined;
  isLoading: boolean;
  syncLog: SyncLogEntry[];
}

function IntegrationCard({
  title,
  Icon,
  provider,
  config,
  isLoading,
  syncLog,
}: IntegrationCardProps) {
  const qc = useQueryClient();
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [foldersError, setFoldersError] = useState("");
  const [watchLoading, setWatchLoading] = useState(false);
  const [watchError, setWatchError] = useState("");

  const isGDrive = provider === "google_drive";
  const status = config?.status ?? "disconnected";
  const connected = status === "connected";

  // Connect: open OAuth in new tab
  async function handleConnect() {
    const authRes = await req<{ authUrl: string }>(
      "GET",
      isGDrive
        ? "/api/integrations/google-drive/auth"
        : "/api/integrations/sharepoint/auth"
    );
    window.open(authRes.authUrl, "_blank");
    // Poll for connection
    const poll = setInterval(async () => {
      await qc.invalidateQueries({ queryKey: [provider + "Status"] });
      clearInterval(poll);
    }, 3000);
  }

  // Load folders
  async function handleOpenFolderPicker() {
    setShowFolderPicker(true);
    setFoldersError("");
    setFoldersLoading(true);
    try {
      const res = isGDrive ? await getGDriveFolders() : await getSPFolders();
      setFolders(res.folders);
    } catch (err) {
      setFoldersError((err as Error).message ?? "Failed to load folders");
    } finally {
      setFoldersLoading(false);
    }
  }

  // Watch a folder
  async function handleSelectFolder(folder: DriveFolder) {
    setWatchLoading(true);
    setWatchError("");
    try {
      if (isGDrive) {
        await req("POST", "/api/integrations/google-drive/watch", {
          folderId: folder.id,
          folderName: folder.name,
        });
      } else {
        await req("POST", "/api/integrations/sharepoint/watch", {
          driveId: folder.id,
          folderId: folder.id,
          folderName: folder.name,
        });
      }
      await qc.invalidateQueries({ queryKey: [provider + "Status"] });
      setShowFolderPicker(false);
    } catch (err) {
      setWatchError((err as Error).message ?? "Failed to watch folder");
    } finally {
      setWatchLoading(false);
    }
  }

  // Disconnect
  const disconnectMutation = useMutation({
    mutationFn: () =>
      req(
        "POST",
        isGDrive
          ? "/api/integrations/google-drive/disconnect"
          : "/api/integrations/sharepoint/disconnect"
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [provider + "Status"] }),
  });

  const recentLog = syncLog
    .filter((e) => e.provider === provider)
    .slice(0, 5);

  return (
    <div
      style={{ background: "hsl(220 20% 13%)" }}
      className="rounded-xl border border-white/5 p-5 flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
            <Icon size={18} className="text-blue-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{title}</div>
            {isLoading ? (
              <div className="text-xs text-muted-foreground">Loading…</div>
            ) : (
              <IntegrationStatusBadge
                status={status as "connected" | "disconnected" | "error"}
                label={
                  connected && config?.folderName
                    ? `Connected - watching ${config.folderName}`
                    : undefined
                }
              />
            )}
          </div>
        </div>

        {/* Actions */}
        {!isLoading && (
          <div className="flex items-center gap-2">
            {!connected && (
              <button
                onClick={handleConnect}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                Connect
              </button>
            )}
            {connected && !config?.folderName && (
              <button
                onClick={handleOpenFolderPicker}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/15 text-foreground transition-colors flex items-center gap-1.5"
              >
                <FolderOpen size={13} />
                Pick folder
              </button>
            )}
            {connected && config?.folderName && (
              <button
                onClick={handleOpenFolderPicker}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground transition-colors flex items-center gap-1.5"
              >
                <FolderOpen size={12} />
                Change
              </button>
            )}
            {connected && (
              <button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-red-900/30 text-red-400/70 hover:text-red-400 transition-colors flex items-center gap-1.5"
              >
                <X size={12} />
                Disconnect
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error state */}
      {config?.errorMessage && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2">
          {config.errorMessage}
        </div>
      )}

      {/* Last sync */}
      {config?.lastSyncAt && (
        <div className="text-xs text-muted-foreground">
          Last sync:{" "}
          {formatDateTime(config.lastSyncAt)}
        </div>
      )}

      {/* Folder picker */}
      {showFolderPicker && (
        <div
          style={{ background: "hsl(220 20% 10%)" }}
          className="rounded-lg border border-white/5 p-3 flex flex-col gap-2"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-muted-foreground">
              Select a folder to watch
            </span>
            <button
              onClick={() => setShowFolderPicker(false)}
              className="text-muted-foreground hover:text-muted-foreground"
            >
              <X size={14} />
            </button>
          </div>

          {foldersLoading && (
            <div className="text-xs text-muted-foreground py-2">
              Loading folders…
            </div>
          )}
          {foldersError && (
            <div className="text-xs text-red-400">{foldersError}</div>
          )}
          {watchError && (
            <div className="text-xs text-red-400">{watchError}</div>
          )}

          {!foldersLoading && folders.length === 0 && !foldersError && (
            <div className="text-xs text-muted-foreground py-2">
              No folders found.
            </div>
          )}

          <div className="max-h-48 overflow-y-auto space-y-1">
            {folders.map((f) => (
              <button
                key={f.id}
                disabled={watchLoading}
                onClick={() => handleSelectFolder(f)}
                className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-white/5 text-foreground/80 hover:text-foreground transition-colors flex items-center gap-2"
              >
                <FolderOpen size={12} className="text-blue-400 shrink-0" />
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Watching confirmation */}
      {connected && config?.folderName && !showFolderPicker && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-900/10 border border-emerald-900/30 rounded-lg px-3 py-2">
          <CheckCircle size={12} />
          Now watching: <span className="font-medium">{config.folderName}</span>
        </div>
      )}

      {/* Recent sync log */}
      {recentLog.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/30 font-medium mb-1">
            Recent activity
          </div>
          {recentLog.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 text-xs text-muted-foreground py-0.5"
            >
              {syncStatusIcon(entry.status)}
              <span className="truncate flex-1">
                {entry.externalFileName ?? "Unknown file"}
              </span>
              <span className="shrink-0 text-muted-foreground/30">
                {syncStatusLabel(entry.status)}
              </span>
              {entry.status === "error" && entry.errorMessage && (
                <span
                  className="shrink-0 text-red-400/60"
                  title={entry.errorMessage}
                >
                  <AlertCircle size={11} />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Settings page ─────────────────────────────────────────────────────────────

type Tab = "integrations" | "email" | "regulatory" | "costs" | "danger";

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>("integrations");
  const [clearConfirm, setClearConfirm] = useState(false);
  const queryClient = useQueryClient();

  // Admin-only: review cost report. 403 for non-admins → tab stays hidden.
  const { data: costReport } = useQuery({
    queryKey: ["reviewCosts"],
    queryFn: getReviewCosts,
    retry: false,
  });

  const clearMutation = useMutation({
    mutationFn: clearAllContracts,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["document-stats"] });
      setClearConfirm(false);
    },
  });

  const { data: gDriveConfig, isLoading: gDriveLoading } = useQuery({
    queryKey: ["google_driveStatus"],
    queryFn: getGDriveStatus,
  });

  const { data: spConfig, isLoading: spLoading } = useQuery({
    queryKey: ["sharepointStatus"],
    queryFn: getSharePointStatus,
  });

  const { data: syncLogData } = useQuery({
    queryKey: ["integrationSyncLog"],
    queryFn: getSyncLog,
    refetchInterval: 10_000,
  });

  const syncLog = syncLogData?.entries ?? [];

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure integrations and preferences for Zane.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-white/5 pb-0">
          <button
            onClick={() => setActiveTab("integrations")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === "integrations"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-muted-foreground hover:text-muted-foreground"
            }`}
          >
            Integrations
          </button>
          <button
            onClick={() => setActiveTab("email")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === "email"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-muted-foreground hover:text-muted-foreground"
            }`}
          >
            Email Zane
          </button>
          <button
            onClick={() => setActiveTab("regulatory")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === "regulatory"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-muted-foreground hover:text-muted-foreground"
            }`}
          >
            Regulatory analysis
          </button>
          {costReport && (
            <button
              onClick={() => setActiveTab("costs")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === "costs"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-muted-foreground hover:text-muted-foreground"
              }`}
            >
              Costs
            </button>
          )}
          <button
            onClick={() => setActiveTab("danger")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === "danger"
                ? "border-[#A32D2D] text-[#A32D2D]"
                : "border-transparent text-muted-foreground hover:text-muted-foreground"
            }`}
          >
            Danger Zone
          </button>
        </div>

        {/* Integrations tab */}
        {activeTab === "integrations" && (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-muted-foreground">
              Connect a cloud storage folder. Zane will automatically review any
              contract document added to the watched folder.
            </p>

            <IntegrationCard
              title="Google Drive"
              Icon={HardDrive}
              provider="google_drive"
              config={gDriveConfig}
              isLoading={gDriveLoading}
              syncLog={syncLog}
            />

            <IntegrationCard
              title="SharePoint / OneDrive"
              Icon={Building2}
              provider="sharepoint"
              config={spConfig}
              isLoading={spLoading}
              syncLog={syncLog}
            />

            {/* Full sync log */}
            {syncLog.length > 0 && (
              <SyncLogTable entries={syncLog} />
            )}
          </div>
        )}

        {/* Email Zane tab */}
        {activeTab === "email" && <EmailZaneSettings />}

        {/* Regulatory analysis tab */}
        {activeTab === "regulatory" && <RegulatoryAnalysisSettings />}

        {/* Admin-only: review costs tab */}
        {activeTab === "costs" && costReport && (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-muted-foreground">
              Estimated LLM cost per company per month, from token usage logged on every
              pipeline run. Cached reviews cost $0.
            </p>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Company</th>
                    {costReport.months.map((m) => (
                      <th key={m} className="px-4 py-3 text-right">{m}</th>
                    ))}
                    <th className="px-4 py-3 text-right">Reviews</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {costReport.companies.length === 0 && (
                    <tr>
                      <td colSpan={costReport.months.length + 3} className="px-4 py-6 text-center text-muted-foreground">
                        No review costs logged yet. Costs appear after the next pipeline run.
                      </td>
                    </tr>
                  )}
                  {costReport.companies.map((c) => (
                    <tr key={c.companyId} className="border-b border-card-border/50 last:border-0">
                      <td className="px-4 py-3 text-foreground/90">{c.name}</td>
                      {costReport.months.map((m) => (
                        <td key={m} className="px-4 py-3 text-right text-muted-foreground">
                          {c.monthly[m] != null ? `$${c.monthly[m].toFixed(2)}` : "-"}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right text-muted-foreground">{c.reviews}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground/90">${c.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                {costReport.companies.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-card-border">
                      <td className="px-4 py-3 font-semibold text-foreground/90">All companies</td>
                      <td colSpan={costReport.months.length + 1} />
                      <td className="px-4 py-3 text-right font-semibold text-foreground/90">${costReport.grandTotal.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* Danger Zone tab */}
        {activeTab === "danger" && (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-[#FCEBEB] bg-[#FCEBEB] p-5 space-y-4">
              <div className="flex items-start gap-3">
                <Trash2 size={18} className="text-[#A32D2D] mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-[#A32D2D]">Clear all contracts</div>
                  <p className="text-xs text-[#A32D2D]/70 mt-1 leading-relaxed">
                    Remove all uploaded contracts and their analysis results. Your playbook and company
                    settings will not be affected. Use this to reset your workspace during testing.
                  </p>
                </div>
              </div>

              {!clearConfirm ? (
                <button
                  onClick={() => setClearConfirm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#FCEBEB] bg-transparent text-[#A32D2D] text-sm font-semibold hover:bg-[#FCEBEB]/40 transition-colors"
                >
                  <Trash2 size={14} />
                  Clear all contracts
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[#A32D2D] font-medium">
                    This will permanently remove all contracts and their analysis results. This cannot be undone.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      autoFocus
                      onClick={() => setClearConfirm(false)}
                      disabled={clearMutation.isPending}
                      className="px-4 py-2 rounded-lg border border-[#FCEBEB] text-[#A32D2D]/70 text-sm font-semibold hover:text-[#A32D2D] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => clearMutation.mutate()}
                      disabled={clearMutation.isPending}
                      className="px-4 py-2 rounded-lg bg-[#FCEBEB] hover:bg-[#F8D4D4] text-[#A32D2D] text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {clearMutation.isPending ? "Clearing…" : "Clear all contracts"}
                    </button>
                  </div>
                  {clearMutation.isSuccess && (
                    <p className="text-xs text-[#1B7A4B]">All contracts cleared successfully.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// ── Regulatory analysis settings ──────────────────────────────────────────────

const REGULATORY_OPTIONS: { value: RegulationAnalysisSetting; label: string; desc: string }[] = [
  {
    value: "FULL",
    label: "Full",
    desc: "Regulatory citations shown prominently on every clause, plus a regulatory summary panel on each review. Recommended for regulated sectors.",
  },
  {
    value: "RELEVANT",
    label: "Relevant only",
    desc: "Citations appear inline only where directly relevant to a clause (e.g. UK GDPR on data clauses). No standalone regulatory panel.",
  },
  {
    value: "MINIMAL",
    label: "Minimal",
    desc: "All regulatory content is collapsed into a single “Regulatory references” section at the bottom of each review, closed by default.",
  },
];

function EmailZaneSettings() {
  const { data: company } = useQuery({ queryKey: ["company"], queryFn: getCompany, retry: false });
  const [copied, setCopied] = useState(false);
  const address = company?.inbound_email ?? "";

  function copy() {
    if (!address) return;
    void navigator.clipboard?.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
          <Mail size={18} className="text-blue-400" />
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground">Your company's Zane address</div>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            CC or forward any contract to this address and Zane will handle it, review it,
            summarise it, or draft from your playbook, then reply by email with the result.
          </p>
        </div>
      </div>

      {address ? (
        <div className="flex items-center gap-2 rounded-lg border border-card-border bg-card px-4 py-3 max-w-xl">
          <code className="flex-1 text-sm text-foreground font-mono truncate">{address}</code>
          <button
            onClick={copy}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-card-border hover:bg-white/5 transition-colors"
          >
            {copied ? <Check size={13} className="text-[#1B7A4B]" /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Your inbound address is being set up. Refresh in a moment, or contact support if it doesn't appear.
        </p>
      )}

      <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
        Only emails sent from a registered member of your team are processed. Anything from an
        unrecognised address is ignored.
      </p>
    </div>
  );
}

function RegulatoryAnalysisSettings() {
  const queryClient = useQueryClient();
  const { data: company } = useQuery({ queryKey: ["company"], queryFn: getCompany, retry: false });

  const derivedSetting = PROMINENCE_TO_SETTING[deriveRegulationProminence(company)];
  const override = (company?.regulationProminence ?? "") as RegulationAnalysisSetting | "";
  const effective: RegulationAnalysisSetting = override || derivedSetting;

  const mutation = useMutation({
    mutationFn: (value: string) => updateCompanySettings({ regulationProminence: value }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["company"] }),
  });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        How prominently regulatory citations appear in contract reviews. The default
        is derived from your sector
        {company ? <> (<span className="text-foreground/70">{SETTING_LABELS[derivedSetting]}</span> for your profile)</> : null}
        {". "}Override it here if regulation matters more or less for your work.
      </p>

      <div className="space-y-3">
        {REGULATORY_OPTIONS.map(({ value, label, desc }) => {
          const selected = effective === value;
          return (
            <button
              key={value}
              type="button"
              disabled={mutation.isPending || !company}
              onClick={() => mutation.mutate(value)}
              className={`w-full text-left rounded-xl border p-4 transition-colors disabled:opacity-60 ${
                selected
                  ? "border-blue-500/60 bg-blue-500/10"
                  : "border-card-border bg-card hover:border-muted-foreground/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  selected ? "border-blue-400" : "border-muted-foreground/40"
                }`}>
                  {selected && <div className="w-2 h-2 rounded-full bg-blue-400" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                    {label}
                    {value === derivedSetting && (
                      <span className="text-[10px] font-medium text-muted-foreground border border-card-border rounded px-1.5 py-0.5">
                        Sector default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-xs">
        {override && (
          <button
            onClick={() => mutation.mutate("")}
            disabled={mutation.isPending}
            className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            Reset to sector default ({SETTING_LABELS[derivedSetting]})
          </button>
        )}
        {mutation.isPending && <span className="text-muted-foreground">Saving…</span>}
        {mutation.isSuccess && !mutation.isPending && <span className="text-[#1B7A4B]">Saved.</span>}
        {mutation.isError && <span className="text-[#A32D2D]">Could not save - please try again.</span>}
      </div>
    </div>
  );
}

// ── Full sync log table ────────────────────────────────────────────────────────

function SyncLogTable({ entries }: { entries: SyncLogEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? entries : entries.slice(0, 10);

  return (
    <div
      style={{ background: "hsl(220 20% 13%)" }}
      className="rounded-xl border border-white/5 overflow-hidden"
    >
      <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          Sync log
        </span>
        <span className="text-xs text-muted-foreground">
          {entries.length} entries
        </span>
      </div>
      <div className="divide-y divide-white/5">
        {shown.map((entry) => (
          <div
            key={entry.id}
            className="px-5 py-2.5 flex items-center gap-3 text-xs"
          >
            {syncStatusIcon(entry.status)}
            <span className="text-muted-foreground/30 w-8 shrink-0 uppercase font-medium text-[10px]">
              {entry.provider === "google_drive" ? "GD" : "SP"}
            </span>
            <span className="flex-1 truncate text-foreground/70">
              {entry.externalFileName ?? "Unknown file"}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {syncStatusLabel(entry.status)}
            </span>
            <span className="shrink-0 text-muted-foreground/30 font-mono text-[10px]">
              {formatDateTime(entry.created)}
            </span>
          </div>
        ))}
      </div>
      {entries.length > 10 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full px-5 py-3 text-xs text-muted-foreground hover:text-muted-foreground transition-colors flex items-center justify-center gap-1.5 border-t border-white/5"
        >
          <ChevronDown size={12} className={expanded ? "rotate-180" : ""} />
          {expanded ? "Show less" : `Show all ${entries.length} entries`}
        </button>
      )}
    </div>
  );
}
