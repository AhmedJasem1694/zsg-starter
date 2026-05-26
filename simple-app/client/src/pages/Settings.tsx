import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import AppLayout from "../components/layout/AppLayout";
import IntegrationStatusBadge from "../components/IntegrationStatusBadge";
import { req, clearAllContracts } from "../lib/api";

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
  return <Clock size={12} className="text-slate-400 shrink-0" />;
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
              <div className="text-xs text-muted-foreground/40">Loading…</div>
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
        <div className="text-xs text-muted-foreground/40">
          Last sync:{" "}
          {new Date(config.lastSyncAt).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
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
              className="text-muted-foreground/40 hover:text-muted-foreground"
            >
              <X size={14} />
            </button>
          </div>

          {foldersLoading && (
            <div className="text-xs text-muted-foreground/40 py-2">
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
            <div className="text-xs text-muted-foreground/40 py-2">
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
              className="flex items-center gap-2 text-xs text-muted-foreground/60 py-0.5"
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

type Tab = "integrations" | "danger";

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>("integrations");
  const [clearConfirm, setClearConfirm] = useState(false);
  const queryClient = useQueryClient();

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
          <p className="text-sm text-muted-foreground/60 mt-1">
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
                : "border-transparent text-muted-foreground/50 hover:text-muted-foreground"
            }`}
          >
            Integrations
          </button>
          <button
            onClick={() => setActiveTab("danger")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === "danger"
                ? "border-[#FCA5A5] text-[#FCA5A5]"
                : "border-transparent text-muted-foreground/50 hover:text-muted-foreground"
            }`}
          >
            Danger Zone
          </button>
        </div>

        {/* Integrations tab */}
        {activeTab === "integrations" && (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-muted-foreground/60">
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

        {/* Danger Zone tab */}
        {activeTab === "danger" && (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-[#450A0A] bg-[#1F0A0A] p-5 space-y-4">
              <div className="flex items-start gap-3">
                <Trash2 size={18} className="text-[#FCA5A5] mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-[#FCA5A5]">Clear all contracts</div>
                  <p className="text-xs text-[#FCA5A5]/70 mt-1 leading-relaxed">
                    Remove all uploaded contracts and their analysis results. Your playbook and company
                    settings will not be affected. Use this to reset your workspace during testing.
                  </p>
                </div>
              </div>

              {!clearConfirm ? (
                <button
                  onClick={() => setClearConfirm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#450A0A] bg-transparent text-[#FCA5A5] text-sm font-semibold hover:bg-[#450A0A]/40 transition-colors"
                >
                  <Trash2 size={14} />
                  Clear all contracts
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[#FCA5A5] font-medium">
                    This will permanently remove all contracts and their analysis results. This cannot be undone.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      autoFocus
                      onClick={() => setClearConfirm(false)}
                      disabled={clearMutation.isPending}
                      className="px-4 py-2 rounded-lg border border-[#450A0A] text-[#FCA5A5]/70 text-sm font-semibold hover:text-[#FCA5A5] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => clearMutation.mutate()}
                      disabled={clearMutation.isPending}
                      className="px-4 py-2 rounded-lg bg-[#450A0A] hover:bg-[#5A0E0E] text-[#FCA5A5] text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {clearMutation.isPending ? "Clearing…" : "Clear all contracts"}
                    </button>
                  </div>
                  {clearMutation.isSuccess && (
                    <p className="text-xs text-[#86EFAC]">All contracts cleared successfully.</p>
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
        <span className="text-xs text-muted-foreground/40">
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
            <span className="shrink-0 text-muted-foreground/40">
              {syncStatusLabel(entry.status)}
            </span>
            <span className="shrink-0 text-muted-foreground/30 font-mono text-[10px]">
              {new Date(entry.created).toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ))}
      </div>
      {entries.length > 10 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full px-5 py-3 text-xs text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors flex items-center justify-center gap-1.5 border-t border-white/5"
        >
          <ChevronDown size={12} className={expanded ? "rotate-180" : ""} />
          {expanded ? "Show less" : `Show all ${entries.length} entries`}
        </button>
      )}
    </div>
  );
}
