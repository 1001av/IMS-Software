import { NextRequest, NextResponse } from "next/server";
import { getCustomerById } from "@/lib/storage";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customer = getCustomerById(params.id);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }

    return NextResponse.json({
      id: customer.id,
      storeName: customer.storeName,
      customerName: customer.customerName,
      status: customer.status,
      subscriptionKey: customer.subscriptionKey || "",
      planName: customer.planName,
      expiryDate: customer.expiryDate || "",
      startDate: customer.startDate || "",
      businessType: customer.businessType,
      isActivated: Boolean(customer.subscriptionKey && customer.status === "active"),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch status." },
      { status: 500 }
    );
  }
}
