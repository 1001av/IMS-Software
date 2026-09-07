/**
 * Business Tool: Offline Subscription Key Generator (Node.js)
 *
 * Standalone utility for our business operations team.
 * Generates valid offline subscription keys without requiring internet access.
 *
 * Usage:
 *   node cloud/tools/generateSubscriptionKey.js --customer "Apex Pharmacy" --plan "Standard Plan" --price 999 --days 365
 */

const SECRET_SALT = "PHARMA_INVENTORY_OFFLINE_SECRET_KEY_V1_2026";

function base64UrlEncode(str) {
  const bytes = Buffer.from(str, "utf8");
  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

async function computeDigest(data) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SECRET_SALT);
  const messageData = encoder.encode(data);

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

async function generateKey(payload) {
  const normalized = {
    customerName: payload.customerName.trim(),
    planName: payload.planName.trim(),
    pricePaise: Math.round(payload.pricePaise),
    startDate: payload.startDate,
    expiryDate: payload.expiryDate,
    issuedAt: payload.issuedAt || Date.now(),
  };

  const jsonStr = JSON.stringify(normalized);
  const encodedPayload = base64UrlEncode(jsonStr);
  const signature = await computeDigest(encodedPayload);

  return `PHARMA-${encodedPayload}-${signature}`;
}

async function verifyKey(key) {
  const trimmed = key.trim();
  const parts = trimmed.split("-");

  if (parts.length < 3 || parts[0] !== "PHARMA") {
    throw new Error("Invalid subscription key format. Expected PHARMA-xxxx-xxxx.");
  }

  const signature = parts[parts.length - 1];
  const encodedPayload = parts.slice(1, parts.length - 1).join("-");

  const expectedSignature = await computeDigest(encodedPayload);
  if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
    throw new Error("Subscription key signature mismatch!");
  }

  const jsonStr = base64UrlDecode(encodedPayload);
  return JSON.parse(jsonStr);
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
  };

  const customer = getArg("--customer") || "Apex Pharmacy";
  const plan = getArg("--plan") || "Standard Plan";
  const priceRupees = parseFloat(getArg("--price") || "999");
  const days = parseInt(getArg("--days") || "365", 10);

  const startDate = new Date();
  const startDateStr = startDate.toISOString().slice(0, 10);

  const expiryDate = new Date(startDate);
  expiryDate.setDate(expiryDate.getDate() + days);
  const expiryDateStr = expiryDate.toISOString().slice(0, 10);

  const payload = {
    customerName: customer,
    planName: plan,
    pricePaise: Math.round(priceRupees * 100),
    startDate: startDateStr,
    expiryDate: expiryDateStr,
    issuedAt: Date.now(),
  };

  const key = await generateKey(payload);

  console.log("\n==================================================");
  console.log("   PHARMA INVENTORY — OFFLINE SUBSCRIPTION KEY   ");
  console.log("==================================================");
  console.log(`Customer : ${payload.customerName}`);
  console.log(`Plan     : ${payload.planName}`);
  console.log(`Price    : ₹${(payload.pricePaise / 100).toFixed(2)}`);
  console.log(`Validity : ${payload.startDate} to ${payload.expiryDate} (${days} days)`);
  console.log("--------------------------------------------------");
  console.log("SUBSCRIPTION KEY (Give this key to the customer):");
  console.log(key);
  console.log("==================================================\n");

  // Verify roundtrip
  const verified = await verifyKey(key);
  if (verified.customerName === payload.customerName) {
    console.log("✓ Verification check passed: Key is cryptographically valid.\n");
  }
}

main().catch(console.error);
