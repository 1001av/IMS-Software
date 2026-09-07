import { NextRequest, NextResponse } from "next/server";
import { GenerateKeyRequest, GenerateKeyResponse } from "@/lib/types";
import { generateSubscriptionKey } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateKeyRequest;

    if (!body.customerName || !body.planName) {
      return NextResponse.json(
        { error: "Customer name and plan name are required." },
        { status: 400 }
      );
    }

    const startDate = body.startDate || new Date().toISOString().slice(0, 10);
    let expiryDate = "";

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    // Calculate expiry date according to duration mode
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
        if (months <= 0) {
          return NextResponse.json({ error: "Months must be at least 1." }, { status: 400 });
        }
        const exp = new Date(start);
        exp.setMonth(exp.getMonth() + months);
        expiryDate = exp.toISOString().slice(0, 10);
        break;
      }
      case "days": {
        const days = Number(body.customDays || 30);
        if (days <= 0) {
          return NextResponse.json({ error: "Days must be at least 1." }, { status: 400 });
        }
        const exp = new Date(start);
        exp.setDate(exp.getDate() + days);
        expiryDate = exp.toISOString().slice(0, 10);
        break;
      }
      case "date": {
        if (!body.exactExpiryDate) {
          return NextResponse.json(
            { error: "Exact expiry date is required when using date mode." },
            { status: 400 }
          );
        }
        expiryDate = body.exactExpiryDate;
        break;
      }
      default: {
        return NextResponse.json({ error: "Invalid duration mode." }, { status: 400 });
      }
    }

    const expTime = new Date(expiryDate).getTime();
    const startTime = start.getTime();
    const totalDays = Math.max(1, Math.round((expTime - startTime) / (1000 * 60 * 60 * 24)));

    const key = generateSubscriptionKey({
      customerName: body.customerName,
      storeName: body.storeName,
      planName: body.planName,
      pricePaise: Number(body.pricePaise || 0),
      startDate,
      expiryDate,
      businessType: body.businessType || "agro",
    });

    const response: GenerateKeyResponse = {
      key,
      customerName: body.customerName,
      storeName: body.storeName || "",
      businessType: body.businessType || "agro",
      planName: body.planName,
      pricePaise: Number(body.pricePaise || 0),
      startDate,
      expiryDate,
      totalDays,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Key generation error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate subscription key." },
      { status: 500 }
    );
  }
}
