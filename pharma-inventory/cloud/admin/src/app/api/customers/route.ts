import { NextRequest, NextResponse } from "next/server";
import { getAllCustomers, saveCustomer } from "@/lib/storage";
import { CustomerRecord, GenerateKeyRequest } from "@/lib/types";
import { generateSubscriptionKey } from "@/lib/crypto";

export async function GET() {
  try {
    const customers = getAllCustomers();
    return NextResponse.json({ customers });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch customers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateKeyRequest;

    if (!body.customerName || !body.storeName) {
      return NextResponse.json(
        { error: "Customer name and store name are required." },
        { status: 400 }
      );
    }

    const startDate = body.startDate || new Date().toISOString().slice(0, 10);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    let expiryDate = "";
    switch (body.durationMode) {
      case "preset": {
        const months = Number(body.presetMonths || 12);
        const exp = new Date(start);
        exp.setMonth(exp.getMonth() + months);
        expiryDate = exp.toISOString().slice(0, 10);
        break;
      }
      case "months": {
        const months = Number(body.customMonths || 1);
        const exp = new Date(start);
        exp.setMonth(exp.getMonth() + months);
        expiryDate = exp.toISOString().slice(0, 10);
        break;
      }
      case "days": {
        const days = Number(body.customDays || 30);
        const exp = new Date(start);
        exp.setDate(exp.getDate() + days);
        expiryDate = exp.toISOString().slice(0, 10);
        break;
      }
      case "date": {
        if (!body.exactExpiryDate) {
          return NextResponse.json({ error: "Exact expiry date is required" }, { status: 400 });
        }
        expiryDate = body.exactExpiryDate;
        break;
      }
      default:
        return NextResponse.json({ error: "Invalid duration mode" }, { status: 400 });
    }

    const key = generateSubscriptionKey({
      customerName: body.customerName,
      storeName: body.storeName,
      planName: body.planName || "Annual Subscription",
      pricePaise: Number(body.pricePaise || 0),
      startDate,
      expiryDate,
      businessType: body.businessType || "agro",
    });

    const newRecord: CustomerRecord = {
      id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      customerName: body.customerName.trim(),
      storeName: body.storeName.trim(),
      phone: body.phone?.trim() || "",
      email: body.email?.trim() || "",
      city: body.city?.trim() || "",
      businessType: body.businessType || "agro",
      planName: body.planName || "Annual Subscription",
      pricePaise: Number(body.pricePaise || 0),
      startDate,
      expiryDate,
      subscriptionKey: key,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = saveCustomer(newRecord);
    return NextResponse.json({ customer: saved }, { status: 201 });
  } catch (err: any) {
    console.error("Create customer error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create customer" },
      { status: 500 }
    );
  }
}
