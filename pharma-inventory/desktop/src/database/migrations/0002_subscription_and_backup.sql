-- Migration 0002: Offline Subscriptions and Local Backup Records

CREATE TABLE IF NOT EXISTS subscriptions (
    id                  TEXT PRIMARY KEY DEFAULT 'current',
    customer_name       TEXT NOT NULL,
    plan_name           TEXT NOT NULL,
    price_paise         INTEGER NOT NULL DEFAULT 0,
    start_date          TEXT NOT NULL,
    expiry_date         TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'active',
    subscription_key    TEXT,
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS backup_history (
    id                  TEXT PRIMARY KEY,
    file_path           TEXT NOT NULL,
    file_size_bytes     INTEGER DEFAULT 0,
    backup_type         TEXT NOT NULL DEFAULT 'manual',
    status              TEXT NOT NULL DEFAULT 'success',
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Seed an active starting subscription so new installs start smoothly
INSERT OR IGNORE INTO subscriptions (id, customer_name, plan_name, price_paise, start_date, expiry_date, status)
VALUES ('current', 'Local Pharmacy Store', 'Standard Plan', 0, date('now'), date('now', '+365 days'), 'active');
