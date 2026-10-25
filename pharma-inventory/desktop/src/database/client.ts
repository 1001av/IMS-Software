/**
 * Local database service.
 *
 * This is the ONLY module in the app that talks to SQLite directly.
 * Seamlessly supports both:
 * 1. Native Windows Desktop via Tauri (Rust SQLite engine with WAL mode)
 * 2. Browser Dev / Preview Mode via LocalStorage-backed reactive mock store
 */
import Database from "@tauri-apps/plugin-sql";

export function isTauri(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
}

let dbInstance: Database | null = null;

/** Opens (or returns the cached handle to) the local pharmacy database. */
export async function getDb(): Promise<Database | null> {
  if (!isTauri()) {
    return null;
  }
  if (dbInstance) return dbInstance;
  dbInstance = await Database.load("sqlite:pharma.db");
  return dbInstance;
}

// -------------------------------------------------------------
// Browser Mock Store (for running Vite directly in Web Browser)
// -------------------------------------------------------------
interface MockStore {
  pharmacy: any[];
  settings: { key: string; value: string }[];
  subscriptions: any[];
  medicines: any[];
  batches: any[];
  invoices: any[];
  invoice_items: any[];
  backup_history: any[];
}

function getMockStore(): MockStore {
  try {
    const raw = localStorage.getItem("ims_mock_db");
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    pharmacy: [],
    settings: [],
    subscriptions: [],
    medicines: [],
    batches: [],
    invoices: [],
    invoice_items: [],
    backup_history: [],
  };
}

function saveMockStore(store: MockStore) {
  try {
    localStorage.setItem("ims_mock_db", JSON.stringify(store));
  } catch {}
}

/** Runs pending .sql migrations found in src/database/migrations, in order. */
export async function runMigrations(): Promise<void> {
  if (!isTauri()) {
    console.info("[Database] Running in browser preview mode (LocalStorage fallback active).");
    return;
  }

  const db = await getDb();
  if (!db) return;

  await db.execute("PRAGMA foreign_keys = ON;");

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

/** Query helper */
export async function query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!isTauri()) {
    const store = getMockStore();
    const upper = sql.toUpperCase();

    if (upper.includes("FROM PHARMACY")) {
      return store.pharmacy as T[];
    }
    if (upper.includes("FROM SUBSCRIPTIONS")) {
      return store.subscriptions as T[];
    }
    if (upper.includes("FROM SETTINGS")) {
      if (params.length > 0) {
        return store.settings.filter((s) => s.key === params[0]) as T[];
      }
      return store.settings as T[];
    }
    if (upper.includes("FROM MEDICINES")) {
      return store.medicines as T[];
    }
    if (upper.includes("FROM BATCHES")) {
      return store.batches as T[];
    }
    if (upper.includes("FROM INVOICES")) {
      return store.invoices as T[];
    }
    if (upper.includes("FROM INVOICE_ITEMS")) {
      return store.invoice_items as T[];
    }
    if (upper.includes("FROM BACKUP_HISTORY")) {
      return store.backup_history as T[];
    }
    return [];
  }

  const db = await getDb();
  if (!db) return [];
  return db.select<T[]>(sql, params);
}

/** Execute helper */
export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<{ rowsAffected: number; lastInsertId?: number }> {
  if (!isTauri()) {
    const store = getMockStore();
    const upper = sql.toUpperCase();

    if (upper.includes("INSERT INTO PHARMACY")) {
      store.pharmacy = [
        {
          id: params[0],
          name: params[1],
          owner_name: params[2],
          phone: params[3] || null,
          email: params[4] || null,
          timezone: "Asia/Kolkata",
          currency: "INR",
          created_at: params[5] || new Date().toISOString(),
          updated_at: params[6] || new Date().toISOString(),
        },
      ];
      saveMockStore(store);
      return { rowsAffected: 1 };
    }

    if (upper.includes("INSERT INTO SETTINGS")) {
      const key = String(params[0]);
      const value = String(params[1]);
      store.settings = store.settings.filter((s) => s.key !== key).concat({ key, value });
      saveMockStore(store);
      return { rowsAffected: 1 };
    }

    if (upper.includes("INSERT INTO SUBSCRIPTIONS")) {
      const sub = {
        id: params[0],
        store_name: params[1],
        customer_name: params[2],
        plan_name: params[3],
        price_paise: params[4],
        start_date: params[5],
        expiry_date: params[6],
        business_type: params[7],
        subscription_key: params[8],
        status: params[9],
        created_at: params[10],
        updated_at: params[11],
      };
      store.subscriptions = [sub];
      saveMockStore(store);
      return { rowsAffected: 1 };
    }

    if (upper.includes("INSERT INTO MEDICINES")) {
      store.medicines.push({ id: params[0], name: params[1], category: params[2] });
      saveMockStore(store);
      return { rowsAffected: 1 };
    }

    if (upper.includes("INSERT INTO INVOICES")) {
      store.invoices.push({ id: params[0], invoice_number: params[2] });
      saveMockStore(store);
      return { rowsAffected: 1 };
    }

    if (upper.includes("INSERT INTO BACKUP_HISTORY")) {
      store.backup_history.unshift({
        id: params[0],
        file_name: params[1],
        file_path: params[2],
        file_size_bytes: params[3],
        status: params[4],
        created_at: params[5] || new Date().toISOString(),
      });
      saveMockStore(store);
      return { rowsAffected: 1 };
    }

    return { rowsAffected: 1, lastInsertId: Date.now() };
  }

  const db = await getDb();
  if (!db) return { rowsAffected: 0 };
  return db.execute(sql, params);
}

/** Transaction helper */
export async function transaction(fn: (run: typeof execute) => Promise<void>): Promise<void> {
  await fn(execute);
}
