import { NextRequest, NextResponse } from "next/server";
import { getCustomerById, saveCustomer } from "@/lib/storage";
import { generateSubscriptionKey } from "@/lib/crypto";
import { DurationUnit } from "@/lib/types";

interface RenewRequest {
  durationMode: DurationUnit;
  presetMonths?: number;
  customMonths?: number;
  customDays?: number;
  exactExpiryDate?: string;
  planName?: string;
  pricePaise?: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customer = getCustomerById(params.id);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const body = (await req.json()) as RenewRequest;

    // Start renewal date from current expiry or today, whichever is later
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentExpiry = new Date(customer.expiryDate);
    currentExpiry.setHours(0, 0, 0, 0);

    const renewalStart = currentExpiry > today ? currentExpiry : today;
    const startDateStr = renewalStart.toISOString().slice(0, 10);

    let newExpiryDate = "";
    switch (body.durationMode) {
      case "preset": {
        const months = Number(body.presetMonths || 12);
        const exp = new Date(renewalStart);
        exp.setMonth(exp.getMonth() + months);
        newExpiryDate = exp.toISOString().slice(0, 10);
        break;
      }
      case "months": {
        const months = Number(body.customMonths || 1);
        const exp = new Date(renewalStart);
        exp.setMonth(exp.getMonth() + months);
        newExpiryDate = exp.toISOString().slice(0, 10);
        break;
      }
      case "days": {
        const days = Number(body.customDays || 30);
        const exp = new Date(renewalStart);
        exp.setDate(exp.getDate() + days);
        newExpiryDate = exp.toISOString().slice(0, 10);
        break;
      }
      case "date": {
        if (!body.exactExpiryDate) {
          return NextResponse.json({ error: "Exact expiry date is required" }, { status: 400 });
        }
        newExpiryDate = body.exactExpiryDate;
        break;
      }
      default:
        return NextResponse.json({ error: "Invalid duration mode" }, { status: 400 });
    }

    const planName = body.planName || customer.planName;
    const pricePaise = body.pricePaise !== undefined ? Number(body.pricePaise) : customer.pricePaise;

    const newKey = generateSubscriptionKey({
      customerName: customer.customerName,
      storeName: customer.storeName,
      planName,
      pricePaise,
      startDate: startDateStr,
      expiryDate: newExpiryDate,
      businessType: customer.businessType,
    });

    const updated = saveCustomer({
      ...customer,
      planName,
      pricePaise,
      startDate: startDateStr,
      expiryDate: newExpiryDate,
      subscriptionKey: newKey,
    });

    return NextResponse.json({ customer: updated, key: newKey });
  } catch (err: any) {
    console.error("Renewal error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to renew customer subscription" },
      { status: 500 }
    );
  }
}
