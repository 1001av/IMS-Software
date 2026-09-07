import { execute, query } from "@/database/client";
import { verifyAndParseSubscriptionKey } from "@/utils/subscriptionCrypto";
import { setActiveBusinessType, type BusinessType } from "@/utils/businessConfig";
import type { Subscription, SubscriptionStatus } from "@/types/domain";

function getStatusFromExpiry(expiryDate: string): SubscriptionStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  if (expiry < today) {
    return "expired";
  }

  const soon = new Date(today);
  soon.setDate(soon.getDate() + 14); // 14 days notice
  if (expiry <= soon) {
    return "expiring_soon";
  }

  return "active";
}

export async function getCurrentSubscription(): Promise<Subscription> {
  const rows = await query<Subscription>(
    "SELECT * FROM subscriptions WHERE id = 'current' LIMIT 1"
  );

  if (rows.length === 0) {
    // Return a default initial trial subscription if not yet initialized
    const todayStr = new Date().toISOString().slice(0, 10);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const nextYearStr = nextYear.toISOString().slice(0, 10);

    const defaultSub: Subscription = {
      id: "current",
      customer_name: "Local Store",
      plan_name: "Standard Plan",
      price_paise: 0,
      start_date: todayStr,
      expiry_date: nextYearStr,
      status: "active",
      subscription_key: null,
    };

    await execute(
      `INSERT OR IGNORE INTO subscriptions (id, customer_name, plan_name, price_paise, start_date, expiry_date, status)
       VALUES ('current', ?, ?, ?, ?, ?, ?)`,
      [
        defaultSub.customer_name,
        defaultSub.plan_name,
        defaultSub.price_paise,
        defaultSub.start_date,
        defaultSub.expiry_date,
        defaultSub.status,
      ]
    );

    return defaultSub;
  }

  const sub = rows[0];
  const computedStatus = getStatusFromExpiry(sub.expiry_date);

  // Update status in db if changed
  if (computedStatus !== sub.status) {
    await execute(
      "UPDATE subscriptions SET status = ?, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = 'current'",
      [computedStatus]
    );
    sub.status = computedStatus;
  }

  return sub;
}

export async function activateSubscriptionWithKey(key: string): Promise<Subscription> {
  const payload = await verifyAndParseSubscriptionKey(key);
  const status = getStatusFromExpiry(payload.expiryDate);

  await execute(
    `INSERT INTO subscriptions (
       id, customer_name, plan_name, price_paise, start_date, expiry_date, status, subscription_key, updated_at
     ) VALUES ('current', ?, ?, ?, ?, ?, ?, ?, (strftime('%Y-%m-%dT%H:%M:%fZ','now')))
     ON CONFLICT(id) DO UPDATE SET
       customer_name = excluded.customer_name,
       plan_name = excluded.plan_name,
       price_paise = excluded.price_paise,
       start_date = excluded.start_date,
       expiry_date = excluded.expiry_date,
       status = excluded.status,
       subscription_key = excluded.subscription_key,
       updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    [
      payload.customerName,
      payload.planName,
      payload.pricePaise,
      payload.startDate,
      payload.expiryDate,
      status,
      key.trim(),
    ]
  );

  // If businessType was packaged in the key, update the business vertical
  if (payload.businessType && ["agro", "pharma", "kirana", "general"].includes(payload.businessType)) {
    await execute(
      `INSERT INTO settings (key, value) VALUES ('business_type', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [payload.businessType]
    );
    setActiveBusinessType(payload.businessType as BusinessType);
  }

  // If storeName was packaged in the key, update the pharmacy record
  if (payload.storeName) {
    await execute(
      `UPDATE pharmacy SET name = ?, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
      [payload.storeName]
    );
    localStorage.setItem("pharmacy_name", payload.storeName);
  }

  return getCurrentSubscription();
}
