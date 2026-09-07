-- Migration 0003: Billing, Invoicing, and Sales Tracking

CREATE TABLE IF NOT EXISTS invoices (
    id                   TEXT PRIMARY KEY,
    pharmacy_id          TEXT NOT NULL REFERENCES pharmacy(id) ON DELETE CASCADE,
    invoice_number       TEXT NOT NULL UNIQUE,
    customer_name        TEXT,
    customer_phone       TEXT,
    doctor_name          TEXT,
    subtotal_paise       INTEGER NOT NULL DEFAULT 0,
    discount_paise       INTEGER NOT NULL DEFAULT 0,
    tax_paise            INTEGER NOT NULL DEFAULT 0,
    total_paise          INTEGER NOT NULL DEFAULT 0,
    payment_method       TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'upi', 'card', 'credit')),
    amount_paid_paise    INTEGER NOT NULL DEFAULT 0,
    change_paise         INTEGER NOT NULL DEFAULT 0,
    status               TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
    notes                TEXT,
    created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_pharmacy ON invoices(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_name ON invoices(customer_name);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE TABLE IF NOT EXISTS invoice_items (
    id                   TEXT PRIMARY KEY,
    invoice_id           TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    medicine_id          TEXT NOT NULL REFERENCES medicines(id),
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

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_medicine ON invoice_items(medicine_id);

-- Update inventory_movements to allow 'sale' and 'return'
CREATE TABLE IF NOT EXISTS inventory_movements_new (
    id                TEXT PRIMARY KEY,
    medicine_id       TEXT NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    type              TEXT NOT NULL CHECK (type IN ('adjustment','initial','import','sale','return')),
    quantity_before   INTEGER NOT NULL,
    quantity_after    INTEGER NOT NULL,
    reason            TEXT,
    created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT OR IGNORE INTO inventory_movements_new (id, medicine_id, type, quantity_before, quantity_after, reason, created_at)
SELECT id, medicine_id, type, quantity_before, quantity_after, reason, created_at FROM inventory_movements;

DROP TABLE IF EXISTS inventory_movements;

ALTER TABLE inventory_movements_new RENAME TO inventory_movements;

CREATE INDEX IF NOT EXISTS idx_movements_medicine ON inventory_movements(medicine_id);
