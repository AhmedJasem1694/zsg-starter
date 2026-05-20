/**
 * Google Drive Integration Service
 *
 * Handles OAuth2 flow, folder watching via push channels, and file downloads
 * for the Google Drive watch folder integration.
 */

import { google } from "googleapis";
import { pb } from "../pb.js";
import { nanoid } from "nanoid";
import path from "path";
import fs from "fs";
import { processIntegrationDocument } from "./integrationProcessor.js";
import { audit } from "./auditLogger.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

// ── OAuth2 client ─────────────────────────────────────────────────────────────

export function getGoogleOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ??
      `${process.env.APP_URL}/api/integrations/google-drive/callback`
  );
}

// ── Generate auth URL ─────────────────────────────────────────────────────────

export function getGoogleAuthUrl(companyId: string): string {
  const oauth2Client = getGoogleOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ],
    state: companyId,
  });
}

// ── Exchange code for tokens ──────────────────────────────────────────────────

export async function handleGoogleCallback(
  code: string,
  companyId: string
): Promise<void> {
  const oauth2Client = getGoogleOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  const webhookSecret = nanoid(32);

  // Upsert integration config
  const existing = await pb
    .collection("integration_configs")
    .getFullList({ filter: `companyId = "${companyId}" && provider = "google_drive"` })
    .catch(() => [] as PBRecord[]);

  const data = {
    companyId,
    provider: "google_drive",
    status: "connected",
    accessToken: tokens.access_token ?? "",
    refreshToken: tokens.refresh_token ?? "",
    tokenExpiry: tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : "",
    webhookSecret,
    errorMessage: "",
  };

  if (existing.length > 0) {
    await pb.collection("integration_configs").update(existing[0].id, data);
  } else {
    await pb.collection("integration_configs").create(data);
  }

  await audit({
    action: "integration_connected" as never,
    entityType: "integration_configs",
    companyId,
    detail: { provider: "google_drive" },
  });
}

// ── Refresh token if expired ──────────────────────────────────────────────────

export async function refreshGoogleTokenIfNeeded(
  integrationId: string
): Promise<string> {
  const config = await pb
    .collection("integration_configs")
    .getOne(integrationId) as PBRecord;

  const expiry = config["tokenExpiry"]
    ? new Date(config["tokenExpiry"] as string).getTime()
    : 0;
  const now = Date.now();

  // Refresh if expired or expiring within 5 minutes
  if (expiry - now > 5 * 60 * 1000) {
    return config["accessToken"] as string;
  }

  const oauth2Client = getGoogleOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: config["refreshToken"] as string,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();

  await pb.collection("integration_configs").update(integrationId, {
    accessToken: credentials.access_token ?? "",
    tokenExpiry: credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : "",
  });

  return credentials.access_token ?? "";
}

// ── List folders ──────────────────────────────────────────────────────────────

export async function listGoogleFolders(
  integrationId: string
): Promise<Array<{ id: string; name: string }>> {
  const accessToken = await refreshGoogleTokenIfNeeded(integrationId);
  const oauth2Client = getGoogleOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const drive = google.drive({ version: "v3", auth: oauth2Client });
  const res = await drive.files.list({
    q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: "files(id, name)",
    orderBy: "name",
    pageSize: 100,
  });

  return (res.data.files ?? []).map((f) => ({
    id: f.id ?? "",
    name: f.name ?? "",
  }));
}

// ── Register watch on a folder ────────────────────────────────────────────────

export async function watchGoogleFolder(
  integrationId: string,
  folderId: string,
  folderName: string
): Promise<void> {
  const accessToken = await refreshGoogleTokenIfNeeded(integrationId);
  const oauth2Client = getGoogleOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  // Get a page token for changes
  const startPageTokenRes = await drive.changes.getStartPageToken({});
  const pageToken = startPageTokenRes.data.startPageToken ?? "";

  // Register push notification channel
  const config = await pb
    .collection("integration_configs")
    .getOne(integrationId) as PBRecord;

  const channelId = nanoid();
  const appUrl =
    process.env.APP_URL ?? "https://localhost:3000";
  const webhookUrl = `${appUrl}/api/integrations/google-drive/webhook`;

  const watchRes = await drive.changes.watch({
    pageToken,
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: webhookUrl,
      token: config["webhookSecret"] as string,
      expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  const expiry = watchRes.data.expiration
    ? new Date(parseInt(watchRes.data.expiration)).toISOString()
    : "";

  await pb.collection("integration_configs").update(integrationId, {
    folderId,
    folderName,
    syncToken: pageToken,
    webhookChannelId: channelId,
    webhookExpiry: expiry,
    status: "connected",
  });
}

// ── Renew watch channel ───────────────────────────────────────────────────────

export async function renewGoogleWatch(integrationId: string): Promise<void> {
  const config = await pb
    .collection("integration_configs")
    .getOne(integrationId) as PBRecord;

  if (!config["folderId"]) return;

  await watchGoogleFolder(
    integrationId,
    config["folderId"] as string,
    config["folderName"] as string
  );
}

// ── Sync: process new files in the watched folder ────────────────────────────

export async function syncGoogleFolder(integrationId: string): Promise<void> {
  const config = await pb
    .collection("integration_configs")
    .getOne(integrationId) as PBRecord;

  if (!config["syncToken"] || !config["folderId"]) return;

  const accessToken = await refreshGoogleTokenIfNeeded(integrationId);
  const oauth2Client = getGoogleOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  const folderId = config["folderId"] as string;
  let pageToken = config["syncToken"] as string;
  const newPageToken = pageToken;

  try {
    const changesRes = await drive.changes.list({
      pageToken,
      fields:
        "nextPageToken,newStartPageToken,changes(fileId,file(id,name,mimeType,parents,trashed))",
      includeRemoved: false,
    });

    // Update sync token
    const updatedToken =
      changesRes.data.newStartPageToken ??
      changesRes.data.nextPageToken ??
      newPageToken;
    await pb.collection("integration_configs").update(integrationId, {
      syncToken: updatedToken,
      lastSyncAt: new Date().toISOString(),
    });

    const changes = changesRes.data.changes ?? [];
    const SUPPORTED_MIMES = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.google-apps.document",
    ];

    for (const change of changes) {
      const file = change.file;
      if (!file || file.trashed) continue;
      if (!file.parents?.includes(folderId)) continue;
      if (!SUPPORTED_MIMES.includes(file.mimeType ?? "")) continue;

      const fileId = file.id ?? change.fileId ?? "";
      const fileName = file.name ?? "unknown";

      // Create sync log entry
      const syncLog = await pb
        .collection("integration_sync_log")
        .create({
          integrationId,
          provider: "google_drive",
          externalFileId: fileId,
          externalFileName: fileName,
          status: "detected",
        });

      try {
        const docId = await downloadAndQueueDriveFile(
          integrationId,
          fileId,
          fileName,
          file.mimeType ?? ""
        );

        await processIntegrationDocument(
          integrationId,
          syncLog.id,
          docId,
          config["companyId"] as string
        );
      } catch (err) {
        await pb.collection("integration_sync_log").update(syncLog.id, {
          status: "error",
          errorMessage: (err as Error)?.message ?? String(err),
        });
        console.error(`[Google Drive] Failed to process file ${fileName}:`, err);
      }
    }
  } catch (err) {
    await pb.collection("integration_configs").update(integrationId, {
      status: "error",
      errorMessage: (err as Error)?.message ?? String(err),
    });
    console.error("[Google Drive] syncGoogleFolder error:", err);
  }
}

// ── Download a Drive file ─────────────────────────────────────────────────────

export async function downloadAndQueueDriveFile(
  integrationId: string,
  fileId: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  const config = await pb
    .collection("integration_configs")
    .getOne(integrationId) as PBRecord;

  const accessToken = await refreshGoogleTokenIfNeeded(integrationId);
  const oauth2Client = getGoogleOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  let ext = ".pdf";
  let downloadMime: string | undefined;

  if (mimeType === "application/vnd.google-apps.document") {
    ext = ".docx";
    downloadMime =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    ext = ".docx";
  }

  const savedFilename = `${nanoid()}${ext}`;
  const savedPath = path.join(uploadDir, savedFilename);

  if (downloadMime) {
    // Google Docs — export as DOCX
    const res = await drive.files.export(
      { fileId, mimeType: downloadMime },
      { responseType: "stream" }
    );
    await new Promise<void>((resolve, reject) => {
      const dest = fs.createWriteStream(savedPath);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (res.data as any).pipe(dest);
      dest.on("finish", resolve);
      dest.on("error", reject);
    });
  } else {
    // Binary file — download as media
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );
    await new Promise<void>((resolve, reject) => {
      const dest = fs.createWriteStream(savedPath);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (res.data as any).pipe(dest);
      dest.on("finish", resolve);
      dest.on("error", reject);
    });
  }

  // Normalise filename for display
  const originalName = fileName.endsWith(ext) ? fileName : `${fileName}${ext}`;

  const doc = await pb.collection("uploaded_documents").create({
    company: config["companyId"],
    filename: savedFilename,
    originalName,
    contractType: "SUPPLIER_AGREEMENT",
    status: "UPLOADED",
    counterpartyName: "",
    reviewType: "INBOUND",
  });

  await audit({
    action: "contract_uploaded" as never,
    entityType: "uploaded_document",
    entityId: doc.id,
    companyId: config["companyId"] as string,
    detail: {
      source: "google_drive",
      externalFileId: fileId,
      originalName,
    },
  });

  return doc.id;
}
