// Pharma Inventory — Tauri backend entry point.
//
// Designed for offline-first Windows operation:
// 1. Embedded SQLite database via tauri-plugin-sql with WAL mode
// 2. Native database backup export and restore operations
// 3. Zero internet or cloud dependencies for application operation

use std::path::PathBuf;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init_schema",
            sql: include_str!("../../src/database/migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "offline_subscription_and_backup",
            sql: include_str!("../../src/database/migrations/0002_subscription_and_backup.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "billing_and_invoices",
            sql: include_str!("../../src/database/migrations/0003_billing_and_invoices.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[tauri::command]
fn get_database_info(app_handle: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;
    let db_path = app_dir.join("pharma.db");
    let exists = db_path.exists();
    let size_bytes = if exists {
        std::fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };
    Ok(serde_json::json!({
        "path": db_path.to_string_lossy(),
        "exists": exists,
        "size_bytes": size_bytes,
    }))
}

#[tauri::command]
fn export_database_backup(app_handle: tauri::AppHandle, destination_path: String) -> Result<u64, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;
    let db_path = app_dir.join("pharma.db");
    if !db_path.exists() {
        return Err("Database file does not exist yet".to_string());
    }
    let dest = PathBuf::from(&destination_path);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create destination folder: {e}"))?;
    }
    let bytes = std::fs::copy(&db_path, &dest)
        .map_err(|e| format!("Failed to copy database to backup: {e}"))?;
    Ok(bytes)
}

#[tauri::command]
fn restore_database_backup(app_handle: tauri::AppHandle, source_path: String) -> Result<u64, String> {
    let src = PathBuf::from(&source_path);
    if !src.exists() {
        return Err("Selected backup file does not exist".to_string());
    }
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;
    let db_path = app_dir.join("pharma.db");

    // Make safety backup of current db before overwriting
    if db_path.exists() {
        let pre_restore = app_dir.join("pharma.db.pre_restore.bak");
        let _ = std::fs::copy(&db_path, pre_restore);
    }

    let bytes = std::fs::copy(&src, &db_path)
        .map_err(|e| format!("Failed to restore database: {e}"))?;
    Ok(bytes)
}

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:pharma.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_database_info,
            export_database_backup,
            restore_database_backup
        ])
        .run(tauri::generate_context!())
        .expect("error while running Pharma Inventory");
}
