/**
 * Offline Subscription Cryptographic Utility.
 * 
 * Generates and validates offline subscription keys using Web Crypto (SHA-256).
 * Zero cloud/network connection is required.
 */

const SECRET_SALT = "PHARMA_INVENTORY_OFFLINE_SECRET_KEY_V1_2026";

export interface SubscriptionPayload {
  customerName: string;
  storeName?: string;
  planName: string;
  pricePaise: number;
  startDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  businessType?: string;
  issuedAt?: number;
}

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function computeDigest(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SECRET_SALT);
  const messageData = encoder.encode(data);

  // Use Web Crypto HMAC-SHA256
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const sigArray = Array.from(new Uint8Array(signatureBuffer));
  return sigArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/** Generates a formatted offline subscription key string from payload */
export async function generateSubscriptionKey(
  payload: SubscriptionPayload,
  prefix: "PHARMA" | "IMS" = "PHARMA"
): Promise<string> {
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
  const signature = await computeDigest(encodedPayload);

  return `${prefix}-${encodedPayload}-${signature}`;
}

/** Parses and verifies an offline subscription key string */
export async function verifyAndParseSubscriptionKey(key: string): Promise<SubscriptionPayload> {
  const trimmed = key.trim();
  const parts = trimmed.split("-");

  const validPrefixes = ["PHARMA", "IMS", "AGRO", "KIRANA"];
  if (parts.length < 3 || !validPrefixes.includes(parts[0])) {
    throw new Error("Invalid subscription key format. Expected PHARMA-xxxx-xxxx or IMS-xxxx-xxxx.");
  }

  // The last part is signature, middle part(s) is the payload
  const signature = parts[parts.length - 1];
  const encodedPayload = parts.slice(1, parts.length - 1).join("-");

  const expectedSignature = await computeDigest(encodedPayload);
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
