import { invoke } from "@tauri-apps/api/core";
import { execute, query } from "@/database/client";
import { v4 as uuidv4 } from "uuid";
import { encryptVaultData, decryptVaultData, computeSha256 } from "@/utils/vaultCrypto";

export interface CloudDeviceInfo {
  apiUrl: string;
  customerId: string | null;
  storeName: string | null;
  deviceId: string;
  deviceName: string;
  devicePrefix: string;
  lastCloudSyncAt: string | null;
  vaultVersion: number;
}

export interface SyncPushResult {
  success: boolean;
  version?: number;
  conflict?: boolean;
  conflictInfo?: {
    cloudVersion: number;
    cloudUpdatedBy: string;
    cloudUpdatedAt: string;
  };
  error?: string;
}

export interface SyncPullResult {
  success: boolean;
  version?: number;
  updatedByDevice?: string;
  updatedAt?: string;
  error?: string;
}

const DEFAULT_API_URL = "https://ims-software-one-theta.vercel.app";

/** Retrieves cloud configuration and active device identity from local settings */
export async function getCloudDeviceInfo(): Promise<CloudDeviceInfo> {
  const rows = await query<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key IN ('cloud_api_url', 'customer_id', 'store_name', 'device_id', 'device_name', 'device_prefix', 'last_cloud_sync_at', 'vault_version')"
  );

  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }

  let deviceId = map["device_id"];
  if (!deviceId) {
    deviceId = `dev-${uuidv4().slice(0, 8)}`;
    await execute(
      "INSERT INTO settings (key, value) VALUES ('device_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [deviceId]
    );
  }

  return {
    apiUrl: map["cloud_api_url"] || DEFAULT_API_URL,
    customerId: map["customer_id"] || null,
    storeName: map["store_name"] || localStorage.getItem("pharmacy_name") || null,
    deviceId,
    deviceName: map["device_name"] || "Computer A",
    devicePrefix: map["device_prefix"] || "A",
    lastCloudSyncAt: map["last_cloud_sync_at"] || null,
    vaultVersion: parseInt(map["vault_version"] || "0", 10),
  };
}

/** Updates cloud configuration after login or setting changes */
export async function setCloudDeviceInfo(params: {
  apiUrl?: string;
  customerId?: string;
  storeName?: string;
  deviceId?: string;
  deviceName?: string;
  devicePrefix?: string;
}): Promise<void> {
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) {
      const dbKey =
        k === "apiUrl"
          ? "cloud_api_url"
          : k === "customerId"
          ? "customer_id"
          : k === "storeName"
          ? "store_name"
          : k === "deviceId"
          ? "device_id"
          : k === "deviceName"
          ? "device_name"
          : "device_prefix";

      await execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [dbKey, String(v)]
      );
    }
  }
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Pushes the local SQLite database as an E2EE encrypted snapshot to Cloud Vault.
 */
export async function pushToCloudVault(
  passphrase?: string,
  forceOverwrite = false
): Promise<SyncPushResult> {
  if (typeof window !== "undefined" && !navigator.onLine) {
    return { success: false, error: "Cannot sync to cloud while offline. Connect to the internet and retry." };
  }

  const info = await getCloudDeviceInfo();
  if (!info.customerId) {
    return { success: false, error: "This store is not linked to a cloud account yet. Please sign in or register." };
  }

  const encryptionSecret = passphrase || info.customerId;

  try {
    // 1. Read native database file bytes as base64 (or mock if running in browser)
    let rawDbBase64 = "";
    if (typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__)) {
      rawDbBase64 = await invoke<string>("read_database_base64");
    } else {
      rawDbBase64 = btoa(localStorage.getItem("ims_mock_db") || "BROWSER_MOCK_SQLITE_PAYLOAD");
    }
    const rawDbBytes = base64ToUint8(rawDbBase64);

    // 2. Compute SHA-256 integrity checksum
    const checksum = await computeSha256(rawDbBytes);

    // 3. Encrypt payload with AES-256-GCM
    const encryptedBase64 = await encryptVaultData(rawDbBytes, encryptionSecret);

    // 4. Send encrypted blob to Cloud Vault API
    const res = await fetch(`${info.apiUrl}/api/vault`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: info.customerId,
        deviceId: info.deviceId,
        deviceName: info.deviceName,
        devicePrefix: info.devicePrefix,
        baseVersion: forceOverwrite ? undefined : info.vaultVersion,
        dataBase64: encryptedBase64,
        sizeBytes: rawDbBytes.length,
        checksumSha256: checksum,
      }),
    });

    const data = await res.json();

    if (res.status === 409) {
      return {
        success: false,
        conflict: true,
        conflictInfo: {
          cloudVersion: data.cloudVersion,
          cloudUpdatedBy: data.cloudUpdatedBy,
          cloudUpdatedAt: data.cloudUpdatedAt,
        },
        error: data.error || "Conflict: A newer backup exists in the Cloud Vault.",
      };
    }

    if (!res.ok) {
      throw new Error(data.error || "Failed to push backup to Cloud Vault.");
    }

    // 5. Update local sync metadata
    const now = new Date().toISOString();
    const newVer = data.metadata?.version || info.vaultVersion + 1;

    await execute(
      "INSERT INTO settings (key, value) VALUES ('last_cloud_sync_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [now]
    );
    await execute(
      "INSERT INTO settings (key, value) VALUES ('vault_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [String(newVer)]
    );

    // 6. Log in backup_history
    const historyId = uuidv4();
    await execute(
      `INSERT INTO backup_history (id, file_path, file_size_bytes, backup_type, status, created_at)
       VALUES (?, 'Cloud Vault (Version ' || ? || ')', ?, 'cloud', 'success', (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
      [historyId, String(newVer), rawDbBytes.length]
    );

    return {
      success: true,
      version: newVer,
    };
  } catch (err: any) {
    console.error("Cloud Vault push error:", err);
    return { success: false, error: err.message || "Cloud Vault synchronization failed." };
  }
}

/**
 * Downloads and restores the latest Cloud Vault snapshot into the local SQLite database.
 * Automatically preserves a local safety copy (pharma.db.pre_restore.bak) before applying.
 */
export async function pullFromCloudVault(passphrase?: string): Promise<SyncPullResult> {
  if (typeof window !== "undefined" && !navigator.onLine) {
    return { success: false, error: "Cannot pull from Cloud Vault while offline. Connect to the internet and retry." };
  }

  const info = await getCloudDeviceInfo();
  if (!info.customerId) {
    return { success: false, error: "This store is not linked to a cloud account yet." };
  }

  const encryptionSecret = passphrase || info.customerId;

  try {
    const res = await fetch(`${info.apiUrl}/api/vault?customerId=${info.customerId}&action=download`);
    const data = await res.json();

    if (!res.ok || !data.exists) {
      return { success: false, error: data.error || data.message || "No Cloud Vault snapshot found." };
    }

    // Decrypt AES-256-GCM payload
    const decryptedBytes = await decryptVaultData(data.dataBase64, encryptionSecret);
    const decryptedBase64 = uint8ToBase64(decryptedBytes);

    // Write back to local SQLite database natively (or simulate in browser mode)
    if (typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__)) {
      await invoke<number>("write_database_base64", {
        dataBase64: decryptedBase64,
      });
    } else {
      console.info("[Browser Mock] Database restore simulated.");
    }

    // Update local sync metadata
    const now = new Date().toISOString();
    const ver = data.metadata?.version || 1;

    await execute(
      "INSERT INTO settings (key, value) VALUES ('last_cloud_sync_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [now]
    );
    await execute(
      "INSERT INTO settings (key, value) VALUES ('vault_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [String(ver)]
    );

    return {
      success: true,
      version: ver,
      updatedByDevice: data.metadata?.uploadedByDeviceName,
      updatedAt: data.metadata?.updatedAt,
    };
  } catch (err: any) {
    console.error("Cloud Vault pull error:", err);
    return { success: false, error: err.message || "Failed to restore Cloud Vault snapshot." };
  }
}

/** Checks for the latest Cloud Vault snapshot metadata */
export async function checkLatestVaultSnapshot(): Promise<{
  exists: boolean;
  version?: number;
  uploadedByDeviceName?: string;
  updatedAt?: string;
  sizeBytes?: number;
}> {
  if (typeof window !== "undefined" && !navigator.onLine) {
    return { exists: false };
  }

  const info = await getCloudDeviceInfo();
  if (!info.customerId) return { exists: false };

  try {
    const res = await fetch(`${info.apiUrl}/api/vault?customerId=${info.customerId}&action=latest`);
    const data = await res.json();
    if (res.ok && data.exists && data.metadata) {
      return {
        exists: true,
        version: data.metadata.version,
        uploadedByDeviceName: data.metadata.uploadedByDeviceName,
        updatedAt: data.metadata.updatedAt,
        sizeBytes: data.metadata.sizeBytes,
      };
    }
  } catch (e) {
    // Non-fatal check
  }

  return { exists: false };
}
