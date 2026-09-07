import crypto from "crypto";
import { BusinessType } from "./types";

const SECRET_SALT = "PHARMA_INVENTORY_OFFLINE_SECRET_KEY_V1_2026";

export interface SubscriptionPayload {
  customerName: string;
  storeName?: string;
  planName: string;
  pricePaise: number;
  startDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  businessType?: BusinessType;
  issuedAt?: number;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

function computeDigest(data: string): string {
  return crypto
    .createHmac("sha256", SECRET_SALT)
    .update(data)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Generates an offline cryptographic subscription key.
 * Compatible with desktop app HMAC-SHA256 offline verification.
 */
export function generateSubscriptionKey(
  payload: SubscriptionPayload,
  prefix: "PHARMA" | "IMS" = "PHARMA"
): string {
  const normalized: SubscriptionPayload = {
    customerName: payload.customerName.trim(),
    storeName: payload.storeName ? payload.storeName.trim() : undefined,
    planName: payload.planName.trim(),
    pricePaise: Math.round(payload.pricePaise),
    startDate: payload.startDate,
    expiryDate: payload.expiryDate,
    businessType: payload.businessType,
    issuedAt: payload.issuedAt || Date.now(),
  };

  const jsonStr = JSON.stringify(normalized);
  const encodedPayload = base64UrlEncode(jsonStr);
  const signature = computeDigest(encodedPayload);

  return `${prefix}-${encodedPayload}-${signature}`;
}

/**
 * Verifies and decodes an offline subscription key.
 */
export function verifyAndParseSubscriptionKey(key: string): SubscriptionPayload {
  const trimmed = key.trim();
  const parts = trimmed.split("-");

  const validPrefixes = ["PHARMA", "IMS", "AGRO", "KIRANA"];
  if (parts.length < 3 || !validPrefixes.includes(parts[0])) {
    throw new Error("Invalid subscription key format. Expected PHARMA-xxxx-xxxx or IMS-xxxx-xxxx.");
  }

  const signature = parts[parts.length - 1];
  const encodedPayload = parts.slice(1, parts.length - 1).join("-");

  const expectedSignature = computeDigest(encodedPayload);
  if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
    throw new Error("Subscription key signature is invalid or has been tampered with.");
  }

  try {
    const jsonStr = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(jsonStr) as SubscriptionPayload;

    if (!payload.customerName || !payload.planName || !payload.expiryDate) {
      throw new Error("Subscription key is missing required fields.");
    }

    return payload;
  } catch (err: any) {
    throw new Error(`Failed to decode subscription key: ${err?.message || "Unknown error"}`);
  }
}
