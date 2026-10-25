import { NextRequest, NextResponse } from "next/server";
import { getAllCustomers, saveCustomer } from "@/lib/storage";
import { BusinessType, CustomerRecord } from "@/lib/types";

interface RegisterCustomerRequest {
  customerName: string;
  storeName: string;
  phone?: string;
  email?: string;
  city?: string;
  businessType?: BusinessType;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RegisterCustomerRequest;

    if (!body.customerName?.trim() || !body.storeName?.trim()) {
      return NextResponse.json(
        { error: "Customer name and store name are required." },
        { status: 400 }
      );
    }

    const cleanPhone = (body.phone || "").trim();
    const cleanEmail = (body.email || "").trim().toLowerCase();
    const cleanStore = body.storeName.trim();
    const cleanName = body.customerName.trim();
    const bType = body.businessType || "agro";

    const all = getAllCustomers();

    // Check if an existing customer matches by phone, email, or exact store name
    const existing = all.find((c) => {
      if (cleanPhone && c.phone && c.phone.replace(/\D/g, "") === cleanPhone.replace(/\D/g, "")) return true;
      if (cleanEmail && c.email && c.email.toLowerCase() === cleanEmail) return true;
      if (c.storeName.toLowerCase() === cleanStore.toLowerCase() && c.businessType === bType) return true;
      return false;
    });

    if (existing) {
      // If customer is already registered and has an active key, return current status
      return NextResponse.json({
        success: true,
        customerId: existing.id,
        status: existing.status,
        subscriptionKey: existing.subscriptionKey || "",
        message: existing.subscriptionKey
          ? "Customer record found with existing subscription."
          : "Registration request already received. Awaiting admin activation.",
      });
    }

    // Create a new pending registration
    const newRecord: CustomerRecord = {
      id: `cust-${bType}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      customerName: cleanName,
      storeName: cleanStore,
      phone: cleanPhone,
      email: cleanEmail,
      city: (body.city || "").trim(),
      businessType: bType,
      planName: "Pending Activation",
      pricePaise: 0,
      startDate: new Date().toISOString().slice(0, 10),
      expiryDate: "",
      subscriptionKey: "",
      status: "pending_activation",
      maxDevices: 2,
      registeredDevices: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = saveCustomer(newRecord);

    return NextResponse.json(
      {
        success: true,
        customerId: saved.id,
        status: "pending_activation",
        message: "Customer successfully registered in Admin Portal. Awaiting activation key.",
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Registration error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to register customer." },
      { status: 500 }
    );
  }
}
