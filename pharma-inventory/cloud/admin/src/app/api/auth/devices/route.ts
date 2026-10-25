import { NextRequest, NextResponse } from "next/server";
import { getCustomerById, revokeCustomerDevice } from "@/lib/storage";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    const customer = getCustomerById(customerId);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({
      customerId: customer.id,
      maxDevices: customer.maxDevices || 2,
      registeredDevices: customer.registeredDevices || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, deviceId } = body;

    if (!customerId || !deviceId) {
      return NextResponse.json(
        { error: "customerId and deviceId are required" },
        { status: 400 }
      );
    }

    const updatedCustomer = revokeCustomerDevice(customerId, deviceId);

    return NextResponse.json({
      success: true,
      message: "Device revoked successfully. You may now connect a replacement computer.",
      registeredDevices: updatedCustomer.registeredDevices,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return DELETE(req);
}

