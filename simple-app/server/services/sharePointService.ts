/**
 * SharePoint Integration Service
 *
 * Uses Microsoft Graph API (REST - no extra SDK needed) to handle OAuth2 flow,
 * folder watching via Graph subscriptions, and file downloads.
 */

import { pb } from "../pb.js";
import { nanoid } from "nanoid";
import path from "path";
import fs from "fs";
import { processIntegrationDocument } from "./integrationProcessor.js";
import { audit } from "./auditLogger.js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const MS_AUTH_BASE = "https://login.microsoftonline.com";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PBRecord = Record<string, any>;

// ── Helper: authenticated Graph request ──────────────────────────────────────

async function graphRequest<T = unknown>(
  accessToken: string,
  method: string,
  url: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Graph ${method} ${url} → ${res.status}: ${text}`);
  }

  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

// ── Build token endpoint ──────────────────────────────────────────────────────

function tokenEndpoint(tenantId: string): string {
  return `${MS_AUTH_BASE}/${tenantId}/oauth2/v2.0/token`;
}

// ── Generate Microsoft OAuth2 auth URL ───────────────────────────────────────

export function getMicrosoftAuthUrl(companyId: string): string {
  const tenantId =
    process.env.MICROSOFT_TENANT_ID ?? "common";
  const clientId = process.env.MICROSOFT_CLIENT_ID ?? "";
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI ??
    `${process.env.APP_URL}/api/integrations/sharepoint/callback`;

  const scopes = [
    "Files.Read.All",
    "Sites.Read.All",
    "offline_access",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes,
    state: companyId,
    response_mode: "query",
  });

  return `${MS_AUTH_BASE}/${tenantId}/oauth2/v2.0/authorize?${params}`;
}

// ── Exchange code for tokens ──────────────────────────────────────────────────

export async function handleMicrosoftCallback(
  code: string,
  companyId: string
): Promise<void> {
  const tenantId =
    process.env.MICROSOFT_TENANT_ID ?? "common";
  const clientId = process.env.MICROSOFT_CLIENT_ID ?? "";
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET ?? "";
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI ??
    `${process.env.APP_URL}/api/integrations/sharepoint/callback`;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(tokenEndpoint(tenantId), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft token exchange failed: ${text}`);
  }

  const tokens = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const webhookSecret = nanoid(32);
  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const existing = await pb
    .collection("integration_configs")
    .getFullList({ filter: `companyId = "${companyId}" && provider = "sharepoint"` })
    .catch(() => [] as PBRecord[]);

  const data = {
    companyId,
    provider: "sharepoint",
    status: "connected",
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiry: expiry,
    tenantId,
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
    detail: { provider: "sharepoint" },
  });
}

// ── Refresh Microsoft token ───────────────────────────────────────────────────

export async function refreshMicrosoftToken(
  integrationId: string
): Promise<string> {
  const config = await pb
    .collection("integration_configs")
    .getOne(integrationId) as PBRecord;

  const expiry = config["tokenExpiry"]
    ? new Date(config["tokenExpiry"] as string).getTime()
    : 0;

  if (expiry - Date.now() > 5 * 60 * 1000) {
    return config["accessToken"] as string;
  }

  const tenantId = (config["tenantId"] as string) || process.env.MICROSOFT_TENANT_ID || "common";
  const clientId = process.env.MICROSOFT_CLIENT_ID ?? "";
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET ?? "";

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: config["refreshToken"] as string,
    grant_type: "refresh_token",
    scope: "Files.Read.All Sites.Read.All offline_access",
  });

  const res = await fetch(tokenEndpoint(tenantId), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft token refresh failed: ${text}`);
  }

  const tokens = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await pb.collection("integration_configs").update(integrationId, {
    accessToken: tokens.access_token,
    tokenExpiry: newExpiry,
    ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
  });

  return tokens.access_token;
}

// ── List SharePoint sites + document libraries ────────────────────────────────

export async function listSharePointFolders(
  integrationId: string
): Promise<Array<{ id: string; name: string; siteId: string }>> {
  const accessToken = await refreshMicrosoftToken(integrationId);

  // Get sites
  const sitesRes = await graphRequest<{ value: Array<{ id: string; displayName: string }> }>(
    accessToken,
    "GET",
    `${GRAPH_BASE}/sites?search=*`
  );

  const results: Array<{ id: string; name: string; siteId: string }> = [];

  for (const site of (sitesRes.value ?? []).slice(0, 10)) {
    try {
      const drivesRes = await graphRequest<{
        value: Array<{ id: string; name: string }>;
      }>(accessToken, "GET", `${GRAPH_BASE}/sites/${site.id}/drives`);

      for (const drive of drivesRes.value ?? []) {
        results.push({
          id: drive.id,
          name: `${site.displayName} / ${drive.name}`,
          siteId: site.id,
        });
      }
    } catch {
      // Skip sites we can't access
    }
  }

  return results;
}

// ── Register Graph subscription (webhook) ────────────────────────────────────

export async function watchSharePointFolder(
  integrationId: string,
  driveId: string,
  folderId: string,
  folderName: string
): Promise<void> {
  const config = await pb
    .collection("integration_configs")
    .getOne(integrationId) as PBRecord;

  const accessToken = await refreshMicrosoftToken(integrationId);
  const appUrl = process.env.APP_URL ?? "https://localhost:3000";
  const notificationUrl = `${appUrl}/api/integrations/sharepoint/webhook`;

  // Graph subscriptions expire - max 30 days for OneDrive
  const expiryDate = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString();

  const sub = await graphRequest<{ id: string; expirationDateTime: string }>(
    accessToken,
    "POST",
    `${GRAPH_BASE}/subscriptions`,
    {
      changeType: "created",
      notificationUrl,
      resource: `/drives/${driveId}/root/children`,
      expirationDateTime: expiryDate,
      clientState: config["webhookSecret"],
    }
  );

  await pb.collection("integration_configs").update(integrationId, {
    driveId,
    folderId,
    folderName,
    webhookChannelId: sub.id,
    webhookExpiry: sub.expirationDateTime,
    status: "connected",
  });
}

// ── Renew Graph subscription ──────────────────────────────────────────────────

export async function renewSharePointSubscription(
  integrationId: string
): Promise<void> {
  const config = await pb
    .collection("integration_configs")
    .getOne(integrationId) as PBRecord;

  if (!config["webhookChannelId"]) return;

  const accessToken = await refreshMicrosoftToken(integrationId);
  const expiryDate = new Date(
    Date.now() + 29 * 24 * 60 * 60 * 1000
  ).toISOString();

  await graphRequest(
    accessToken,
    "PATCH",
    `${GRAPH_BASE}/subscriptions/${config["webhookChannelId"]}`,
    { expirationDateTime: expiryDate }
  );

  await pb.collection("integration_configs").update(integrationId, {
    webhookExpiry: expiryDate,
  });
}

// ── Sync: process webhook notification ───────────────────────────────────────

export async function syncSharePointFolder(
  integrationId: string,
  driveItemId?: string
): Promise<void> {
  const config = await pb
    .collection("integration_configs")
    .getOne(integrationId) as PBRecord;

  const driveId = config["driveId"] as string;
  if (!driveId) return;

  const accessToken = await refreshMicrosoftToken(integrationId);

  const SUPPORTED_EXTS = [".pdf", ".docx", ".doc"];

  try {
    let items: Array<{ id: string; name: string; file?: unknown }> = [];

    if (driveItemId) {
      // Specific item from webhook notification
      const item = await graphRequest<{ id: string; name: string; file?: unknown }>(
        accessToken,
        "GET",
        `${GRAPH_BASE}/drives/${driveId}/items/${driveItemId}`
      );
      items = [item];
    } else {
      // Full folder list for initial/periodic sync
      const folderId = config["folderId"] as string;
      if (!folderId) return;
      const res = await graphRequest<{
        value: Array<{ id: string; name: string; file?: unknown }>;
      }>(
        accessToken,
        "GET",
        `${GRAPH_BASE}/drives/${driveId}/items/${folderId}/children`
      );
      items = res.value ?? [];
    }

    await pb.collection("integration_configs").update(integrationId, {
      lastSyncAt: new Date().toISOString(),
    });

    for (const item of items) {
      if (!item.file) continue; // skip folders

      const ext = path.extname(item.name).toLowerCase();
      if (!SUPPORTED_EXTS.includes(ext)) continue;

      // Check for duplicate
      const existing = await pb
        .collection("integration_sync_log")
        .getFullList({
          filter: `integrationId = "${integrationId}" && externalFileId = "${item.id}"`,
        })
        .catch(() => [] as PBRecord[]);

      if (existing.length > 0) continue;

      const syncLog = await pb.collection("integration_sync_log").create({
        integrationId,
        provider: "sharepoint",
        externalFileId: item.id,
        externalFileName: item.name,
        status: "detected",
      });

      try {
        const docId = await downloadAndQueueSharePointFile(
          integrationId,
          item.id,
          item.name
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
        console.error(
          `[SharePoint] Failed to process file ${item.name}:`,
          err
        );
      }
    }
  } catch (err) {
    await pb.collection("integration_configs").update(integrationId, {
      status: "error",
      errorMessage: (err as Error)?.message ?? String(err),
    });
    console.error("[SharePoint] syncSharePointFolder error:", err);
  }
}

// ── Download a SharePoint file ────────────────────────────────────────────────

export async function downloadAndQueueSharePointFile(
  integrationId: string,
  itemId: string,
  fileName: string
): Promise<string> {
  const config = await pb
    .collection("integration_configs")
    .getOne(integrationId) as PBRecord;

  const accessToken = await refreshMicrosoftToken(integrationId);
  const driveId = config["driveId"] as string;

  // Graph returns a redirect to the download URL
  const downloadRes = await fetch(
    `${GRAPH_BASE}/drives/${driveId}/items/${itemId}/content`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      redirect: "follow",
    }
  );

  if (!downloadRes.ok) {
    throw new Error(`SharePoint download failed: ${downloadRes.status}`);
  }

  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const ext = path.extname(fileName).toLowerCase() || ".pdf";
  const savedFilename = `${nanoid()}${ext}`;
  const savedPath = path.join(uploadDir, savedFilename);

  const buffer = await downloadRes.arrayBuffer();
  fs.writeFileSync(savedPath, Buffer.from(buffer));

  const doc = await pb.collection("uploaded_documents").create({
    company: config["companyId"],
    filename: savedFilename,
    originalName: fileName,
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
      source: "sharepoint",
      externalFileId: itemId,
      originalName: fileName,
    },
  });

  return doc.id;
}
