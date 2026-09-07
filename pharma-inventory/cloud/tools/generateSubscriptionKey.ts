/**
 * Business Tool: Offline Subscription Key Generator
 *
 * Used by our business operations side to issue offline subscription keys to customers.
 * Customers paste this key into their desktop application without needing any internet connection.
 *
 * Usage:
 *   npx ts-node cloud/tools/generateSubscriptionKey.ts --customer "City Pharmacy" --plan "Standard" --price 999 --days 365
 */

import { generateSubscriptionKey, SubscriptionPayload } from "../../desktop/src/utils/subscriptionCrypto";

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
  };

  const customer = getArg("--customer") || "Sunrise Medical Store";
  const plan = getArg("--plan") || "Standard Plan";
  const priceRupees = parseFloat(getArg("--price") || "999");
  const days = parseInt(getArg("--days") || "365", 10);

  const startDate = new Date();
  const startDateStr = startDate.toISOString().slice(0, 10);

  const expiryDate = new Date(startDate);
  expiryDate.setDate(expiryDate.getDate() + days);
  const expiryDateStr = expiryDate.toISOString().slice(0, 10);

  const payload: SubscriptionPayload = {
    customerName: customer,
    planName: plan,
    pricePaise: Math.round(priceRupees * 100),
    startDate: startDateStr,
    expiryDate: expiryDateStr,
    issuedAt: Date.now(),
  };

  const key = await generateSubscriptionKey(payload);

  console.log("==================================================");
  console.log("   PHARMA INVENTORY — OFFLINE SUBSCRIPTION KEY   ");
  console.log("==================================================");
  console.log(`Customer : ${payload.customerName}`);
  console.log(`Plan     : ${payload.planName}`);
  console.log(`Price    : ₹${(payload.pricePaise / 100).toFixed(2)}`);
  console.log(`Validity : ${payload.startDate} to ${payload.expiryDate} (${days} days)`);
  console.log("--------------------------------------------------");
  console.log("SUBSCRIPTION KEY:");
  console.log(key);
  console.log("==================================================");
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes("generateSubscriptionKey")) {
  main().catch(console.error);
}

export { generateSubscriptionKey };
