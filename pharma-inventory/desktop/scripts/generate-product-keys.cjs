const crypto = require("crypto");

const SECRET_SALT = "PHARMA_INVENTORY_OFFLINE_SECRET_KEY_V1_2026";

function base64UrlEncode(str) {
  return Buffer.from(str, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function computeDigest(data) {
  const hmac = crypto.createHmac("sha256", SECRET_SALT);
  hmac.update(data);
  return hmac.digest("hex");
}

function generateSubscriptionKey(payload) {
  const payloadStr = JSON.stringify(payload);
  const encoded = base64UrlEncode(payloadStr);
  const signature = computeDigest(encoded);
  return `PHARMA-${encoded}-${signature}`;
}

const today = new Date().toISOString().slice(0, 10);
const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

console.log("\n=======================================================");
console.log("🔑 READY-TO-USE 1-YEAR OFFLINE ACTIVATION KEYS");
console.log("=======================================================\n");

// 1. Agro Kendra IMS Key
const agroPayload = {
  customerName: "Ramesh Patel",
  storeName: "Kisan Krishi Seva Kendra",
  planName: "Agro Kendra Annual Pro (1 Year)",
  pricePaisa: 499900,
  startDate: today,
  expiryDate: nextYear,
  businessType: "agro",
  issuedAt: Date.now(),
};
const agroKey = generateSubscriptionKey(agroPayload);
console.log("1. AGRO KENDRA IMS (Store: Kisan Krishi Seva Kendra)");
console.log(`Key: ${agroKey}\n`);

// 2. Kirana Store IMS Key
const kiranaPayload = {
  customerName: "Rajesh Gupta",
  storeName: "Mahavir Kirana & General Store",
  planName: "Kirana Supermarket Pro (1 Year)",
  pricePaisa: 399900,
  startDate: today,
  expiryDate: nextYear,
  businessType: "kirana",
  issuedAt: Date.now(),
};
const kiranaKey = generateSubscriptionKey(kiranaPayload);
console.log("2. KIRANA STORE IMS (Store: Mahavir Kirana & General Store)");
console.log(`Key: ${kiranaKey}\n`);

// 3. Pharma IMS Key
const pharmaPayload = {
  customerName: "Suresh Kumar",
  storeName: "Shree Ganesh Medical Store",
  planName: "Pharma IMS Standard (1 Year)",
  pricePaisa: 499900,
  startDate: today,
  expiryDate: nextYear,
  businessType: "pharma",
  issuedAt: Date.now(),
};
const pharmaKey = generateSubscriptionKey(pharmaPayload);
console.log("3. PHARMA IMS (Store: Shree Ganesh Medical Store)");
console.log(`Key: ${pharmaKey}\n`);
console.log("=======================================================\n");
