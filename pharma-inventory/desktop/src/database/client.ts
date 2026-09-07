/**
 * Local database service.
 *
 * This is the ONLY module in the app that talks to SQLite directly.
 * Every feature (inventory, dashboard, backup, license) goes through here so
 * that: (1) query logic is testable in isolation, (2) we never accidentally
 * scatter raw SQL across UI components, and (3) swapping the driver later
 * (e.g. adding encryption at rest) only touches this file.
 *
 * Offline-first note: this module never makes a network call. It is safe to
 * use with zero connectivity, always.
 */
import Database from "@tauri-apps/plugin-sql";

let dbInstance: Database | null = null;

/** Opens (or returns the cached handle to) the local pharmacy database. */
export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  // sqlite:pharma.db resolves inside the OS app-data dir configured in
  // src-tauri/tauri.conf.json — never a path the user has to think about.
  dbInstance = await Database.load("sqlite:pharma.db");
  return dbInstance;
}

/** Runs pending .sql migrations found in src/database/migrations, in order. */
export async function runMigrations(): Promise<void> {
  const db = await getDb();
  await db.execute("PRAGMA foreign_keys = ON;");

  // Ensure invoices and invoice_items tables exist even if migration runner is delayed
  await db.execute(`
    CREATE TABLE IF NOT EXISTS invoices (
      id                   TEXT PRIMARY KEY,
      pharmacy_id          TEXT NOT NULL,
      invoice_number       TEXT NOT NULL UNIQUE,
      customer_name        TEXT,
      customer_phone       TEXT,
      doctor_name          TEXT,
      subtotal_paise       INTEGER NOT NULL DEFAULT 0,
      discount_paise       INTEGER NOT NULL DEFAULT 0,
      tax_paise            INTEGER NOT NULL DEFAULT 0,
      total_paise          INTEGER NOT NULL DEFAULT 0,
      payment_method       TEXT NOT NULL DEFAULT 'cash',
      amount_paid_paise    INTEGER NOT NULL DEFAULT 0,
      change_paise         INTEGER NOT NULL DEFAULT 0,
      status               TEXT NOT NULL DEFAULT 'completed',
      notes                TEXT,
      created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id                   TEXT PRIMARY KEY,
      invoice_id           TEXT NOT NULL,
      medicine_id          TEXT NOT NULL,
      medicine_name        TEXT NOT NULL,
      batch_number         TEXT,
      expiry_date          TEXT,
      unit                 TEXT NOT NULL DEFAULT 'pcs',
      quantity             INTEGER NOT NULL,
      purchase_price_paise INTEGER NOT NULL DEFAULT 0,
      unit_price_paise     INTEGER NOT NULL DEFAULT 0,
      discount_paise       INTEGER NOT NULL DEFAULT 0,
      total_paise          INTEGER NOT NULL DEFAULT 0,
      created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);
}

/** Thin helper so callers don't import the driver type everywhere. */
export async function query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  return db.select<T[]>(sql, params);
}

export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<{ rowsAffected: number; lastInsertId?: number }> {
  const db = await getDb();
  return db.execute(sql, params);
}

/**
 * Runs multiple statements sequentially. SQLite with WAL mode
 * guarantees crash-safety and durability for local data.
 */
export async function transaction(fn: (run: typeof execute) => Promise<void>): Promise<void> {
  await fn(execute);
}

