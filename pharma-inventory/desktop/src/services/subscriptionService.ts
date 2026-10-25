import { execute, query } from "@/database/client";
import { verifyAndParseSubscriptionKey } from "@/utils/subscriptionCrypto";
import {
  BUSINESS_CONFIGS,
  TARGET_PRODUCT_TYPE,
  type BusinessType,
} from "@/utils/businessConfig";
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

/** Guard against user turning back system clock to bypass expiration */
async function verifyClockIntegrity(): Promise<boolean> {
  try {
    const rows = await query<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'last_active_time' LIMIT 1"
    );
    const now = new Date();
    if (rows.length > 0 && rows[0].value) {
      const lastActive = new Date(rows[0].value);
      // If system clock is set back more than 1 hour into the past compared to last run
      if (!isNaN(lastActive.getTime()) && lastActive.getTime() > now.getTime() + 1000 * 60 * 60) {
        console.warn("Clock tampering detected: System clock is set behind last recorded operation.");
        return false;
      }
    }
    await execute(
      `INSERT INTO settings (key, value) VALUES ('last_active_time', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [now.toISOString()]
    );
    return true;
  } catch (err) {
    console.warn("Clock integrity check note:", err);
    return true;
  }
}

export async function getCurrentSubscription(): Promise<Subscription | null> {
  const rows = await query<Subscription>(
    "SELECT * FROM subscriptions WHERE id = 'current' LIMIT 1"
  );

  if (rows.length === 0) {
    return null;
  }

  const sub = rows[0];

  // If there is no valid key attached, the software has not been activated by admin
  if (!sub.subscription_key || sub.subscription_key.trim() === "") {
    sub.status = "unactivated";
    return sub;
  }

  const clockOk = await verifyClockIntegrity();
  const computedStatus = clockOk ? getStatusFromExpiry(sub.expiry_date) : "expired";

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

/** Service-layer write guard: prevents creating invoices or changing inventory when expired */
export async function assertSubscriptionActive(): Promise<void> {
  const sub = await getCurrentSubscription();
  if (!sub || sub.status === "expired" || sub.status === "unactivated") {
    throw new Error(
      "Your software license is expired or unactivated. Billing and stock writes are locked. Your historical data remains 100% safe."
    );
  }
}

export async function activateSubscriptionWithKey(
  key: string,
  expectedVertical?: BusinessType
): Promise<Subscription> {
  const payload = await verifyAndParseSubscriptionKey(key);
  const targetVertical = expectedVertical || TARGET_PRODUCT_TYPE;

  // Strict Product Vertical & Key Prefix Validation:
  // An AGRO key cannot activate Kirana or Pharma, and vice-versa!
  const keyPrefix = key.trim().split("-")[0]?.toUpperCase();
  const verticalToPrefix: Record<string, string> = {
    agro: "AGRO",
    kirana: "KIRANA",
    pharma: "PHARMA",
  };
  const expectedPrefix = verticalToPrefix[targetVertical];
  if (expectedPrefix && keyPrefix && keyPrefix !== expectedPrefix && keyPrefix !== "IMS") {
    const currentProduct = BUSINESS_CONFIGS[targetVertical]?.appName || targetVertical.toUpperCase();
    throw new Error(
      `Product Mismatch: This key starts with "${keyPrefix}-" but this application is "${currentProduct}" (requires an ${expectedPrefix}- key). Please request an ${expectedPrefix} key from your administrator.`
    );
  }

  if (payload.businessType && payload.businessType !== targetVertical) {
    const issuedFor =
      BUSINESS_CONFIGS[payload.businessType as BusinessType]?.appName ||
      payload.businessType.toUpperCase();
    const currentProduct =
      BUSINESS_CONFIGS[targetVertical]?.appName || targetVertical.toUpperCase();
    throw new Error(
      `Product Mismatch: This key was issued for "${issuedFor}". It cannot be used to activate "${currentProduct}". Please request a valid key from your software administrator.`
    );
  }

  const status = getStatusFromExpiry(payload.expiryDate);
  if (status === "expired") {
    throw new Error(
      `Expired License: This subscription key expired on ${payload.expiryDate}. Please enter an active key.`
    );
  }

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

  // If storeName was packaged in the key, update the pharmacy record
  if (payload.storeName) {
    await execute(
      `UPDATE pharmacy SET name = ?, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
      [payload.storeName]
    );
    localStorage.setItem("pharmacy_name", payload.storeName);
  }

  const updated = await getCurrentSubscription();
  if (!updated) {
    throw new Error("Failed to load activated subscription.");
  }
  return updated;
}
