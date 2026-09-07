import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { execute, query } from "@/database/client";
import { v4 as uuidv4 } from "uuid";
import type { BackupRecord, DatabaseInfo } from "@/types/domain";

export async function getDatabaseInfo(): Promise<DatabaseInfo> {
  try {
    return await invoke<DatabaseInfo>("get_database_info");
  } catch (e: any) {
    console.error("Failed to get database info:", e);
    return { path: "pharma.db", exists: true, size_bytes: 0 };
  }
}

export async function getBackupHistory(): Promise<BackupRecord[]> {
  try {
    return await query<BackupRecord>(
      "SELECT * FROM backup_history ORDER BY created_at DESC LIMIT 15"
    );
  } catch (e) {
    console.warn("Could not query backup_history, returning empty list:", e);
    return [];
  }
}

export async function createLocalBackup(): Promise<{ filePath: string; sizeBytes: number } | null> {
  const dateStr = new Date().toISOString().slice(0, 10);
  const timeStr = new Date().toTimeString().slice(0, 5).replace(":", "");
  const defaultName = `pharma-backup-${dateStr}-${timeStr}.db`;

  const selectedPath = await save({
    title: "Choose where to save database backup",
    defaultPath: defaultName,
    filters: [
      {
        name: "SQLite Database",
        extensions: ["db", "sqlite"],
      },
    ],
  });

  if (!selectedPath) {
    return null; // User cancelled
  }

  const bytesCopied = await invoke<number>("export_database_backup", {
    destinationPath: selectedPath,
  });

  // Log in backup_history
  const id = uuidv4();
  await execute(
    `INSERT INTO backup_history (id, file_path, file_size_bytes, backup_type, status, created_at)
     VALUES (?, ?, ?, 'manual', 'success', (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
    [id, selectedPath, bytesCopied]
  );

  return {
    filePath: selectedPath,
    sizeBytes: bytesCopied,
  };
}

export async function restoreLocalBackup(): Promise<{ restored: boolean; filePath: string | null }> {
  const selected = await open({
    title: "Select database backup file to restore",
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Database Backup Files",
        extensions: ["db", "sqlite", "bak"],
      },
    ],
  });

  if (!selected || typeof selected !== "string") {
    return { restored: false, filePath: null };
  }

  await invoke<number>("restore_database_backup", {
    sourcePath: selected,
  });

  return { restored: true, filePath: selected };
}
