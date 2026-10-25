import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getActiveBusinessType } from "@/utils/businessConfig";
import { getCloudDeviceInfo } from "@/services/cloudVaultService";

export interface UpdateCheckResult {
  available: boolean;
  upToDate?: boolean;
  offline?: boolean;
  currentVersion?: string;
  version?: string;
  date?: string;
  notes?: string;
  downloadUrl?: string;
  rawUpdate?: Update | null;
  error?: string;
}

export const CURRENT_APP_VERSION = "1.0.0";
 
function semverCompare(v1: string, v2: string): number {
  const p1 = (v1 || "0").replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const p2 = (v2 || "0").replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

/**
 * Checks for new software updates safely.
 * Directly queries the update server manifest with semver comparison.
 * Never blocks application startup or fails silently if offline.
 */
export async function checkForAppUpdates(clientVersion = CURRENT_APP_VERSION): Promise<UpdateCheckResult> {
  if (typeof window !== "undefined" && !navigator.onLine) {
    return {
      available: false,
      offline: true,
      currentVersion: clientVersion,
      notes: "You are currently offline. Connect to the internet to check for updates.",
    };
  }

  const cloudInfo = await getCloudDeviceInfo().catch(() => null);
  const apiUrl = cloudInfo?.apiUrl || "https://ims-software-one-theta.vercel.app";
  const product = getActiveBusinessType() || "agro";

  try {
    // 1. Direct query to Cloud Admin update manifest
    const endpoint = `${apiUrl}/api/updates?target=windows-x86_64&current_version=${clientVersion}&product=${product}`;
    const res = await fetch(endpoint);

    // 2. HTTP 204 No Content: User is already on latest version!
    if (res.status === 204) {
      return {
        available: false,
        upToDate: true,
        currentVersion: clientVersion,
        notes: `Your software is completely up to date! You are running the latest version (v${clientVersion}). No updates are needed.`,
      };
    }

    // 3. HTTP 200 OK: Newer version available on the server!
    if (res.ok) {
      const manifest = await res.json();



      // If server version is less than or equal to current version, app is up to date
      if (!manifest.version || semverCompare(manifest.version, clientVersion) <= 0) {
        return {
          available: false,
          upToDate: true,
          currentVersion: clientVersion,
          notes: `Your software is completely up to date! You are running the latest version (v${clientVersion}). No updates are needed.`,
        };
      }

      // Try native Tauri updater if in desktop environment
      let rawUpdate: Update | null = null;
      if (typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__)) {
        try {
          rawUpdate = await check();
        } catch (tauriErr) {
          console.info("Native updater note (using manifest info):", tauriErr);
        }
      }

      return {
        available: true,
        upToDate: false,
        currentVersion: clientVersion,
        version: manifest.version,
        date: manifest.pub_date,
        notes: manifest.notes || `A new version (v${manifest.version}) with improvements is ready to download.`,
        downloadUrl: manifest.url,
        rawUpdate,
      };
    }

    throw new Error(`Update server responded with status ${res.status}`);
  } catch (err: any) {
    console.warn("Update check warning:", err);
    return {
      available: false,
      currentVersion: clientVersion,
      error: `Could not reach update server at ${apiUrl}. Please ensure the server is running and check your internet connection.`,
    };
  }
}

/**
 * Downloads and applies the update, then safely relaunches the app.
 * User data in %APPDATA% is completely preserved.
 */
export async function downloadAndApplyUpdate(
  update: Update,
  onProgress?: (downloadedBytes: number, totalBytes: number) => void
): Promise<void> {
  let downloaded = 0;
  let total = 0;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        total = event.data.contentLength || 0;
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        if (onProgress) onProgress(downloaded, total);
        break;
      case "Finished":
        break;
    }
  });

  // Safely restart desktop app
  await relaunch();
}
