-- Cloud PostgreSQL schema — licensing, subscriptions, admin. NOT the inventory store.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE admin_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customers (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_name  TEXT NOT NULL,
    owner_name     TEXT NOT NULL,
    email          TEXT NOT NULL UNIQUE,
    phone          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE plans (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT NOT NULL UNIQUE,
    price_paise    INTEGER NOT NULL,
    duration_days  INTEGER NOT NULL,
    medicine_limit INTEGER,             -- NULL = unlimited
    description    TEXT,
    is_active      BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id        UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    plan_id            UUID NOT NULL REFERENCES plans(id),
    custom_price_paise INTEGER,          -- overrides plan.price_paise when set
    start_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date        DATE NOT NULL,
    grace_period_days  INTEGER NOT NULL DEFAULT 14,
    status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_expiry   ON subscriptions(expiry_date);

CREATE TABLE licenses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    license_key         TEXT NOT NULL UNIQUE,
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','suspended')),
    activated_at        TIMESTAMPTZ,
    last_verified_at    TIMESTAMPTZ,
    application_version TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_licenses_customer ON licenses(customer_id);

CREATE TABLE application_versions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version       TEXT NOT NULL UNIQUE,
    release_notes TEXT,
    download_url  TEXT NOT NULL,
    is_mandatory  BOOLEAN NOT NULL DEFAULT false,
    released_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE backup_metadata (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id    UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    storage_key    TEXT NOT NULL,       -- path/key in object storage, never public
    size_bytes     BIGINT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_backup_customer ON backup_metadata(customer_id);

CREATE TABLE audit_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id     UUID REFERENCES admin_users(id),
    customer_id  UUID REFERENCES customers(id),
    action       TEXT NOT NULL,
    details      JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed example plans (admin can edit these later — never hardcoded in the desktop app)
INSERT INTO plans (name, price_paise, duration_days, medicine_limit, description) VALUES
  ('Basic',    49900, 30, 500,  'Up to 500 medicines'),
  ('Standard', 99900, 30, 2000, 'Up to 2000 medicines'),
  ('Premium', 199900, 30, NULL, 'Unlimited medicines');
