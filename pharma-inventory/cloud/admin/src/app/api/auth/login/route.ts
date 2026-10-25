import { NextRequest, NextResponse } from "next/server";
import { findCustomerByEmail, registerCustomerDevice } from "@/lib/storage";
import { verifyPassword } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, deviceId, deviceName, productVertical } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const customer = findCustomerByEmail(email);
    if (!customer) {
      return NextResponse.json(
        { error: "No store account found with this email address. Please check your spelling or register a new store." },
        { status: 404 }
      );
    }

    // Verify Password
    if (customer.passwordHash && !verifyPassword(password, customer.passwordHash)) {
      return NextResponse.json(
        { error: "Incorrect password. Please verify your credentials." },
        { status: 401 }
      );
    }

    // Enforce Strict Product Vertical Isolation:
    // A user registered for Agro Kendra IMS cannot sign into Pharma IMS or Kirana IMS!
    if (productVertical && customer.businessType !== productVertical) {
      const verticalLabels: Record<string, string> = {
        agro: "Agro Kendra IMS",
        pharma: "Pharma IMS",
        kirana: "Kirana Store IMS",
        general: "General Retail IMS",
      };
      const allowed = verticalLabels[customer.businessType] || customer.businessType;
      const attempted = verticalLabels[productVertical] || productVertical;
      return NextResponse.json(
        {
          error: `Product Mismatch: Your account is registered for "${allowed}". You cannot use it to sign in to "${attempted}". Please install and open ${allowed}.`,
        },
        { status: 403 }
      );
    }

    // Enforce 2-Device Quota Limit & Register Device
    const devId = deviceId || `dev-${Date.now()}`;
    const devName = deviceName || "Computer";

    let registrationResult;
    try {
      registrationResult = registerCustomerDevice(customer.id, devId, devName);
    } catch (err: any) {
      return NextResponse.json(
        {
          error: err.message || "Device limit exceeded. Max 2 authorized computers allowed.",
          deviceLimitReached: true,
          customerId: customer.id,
          registeredDevices: customer.registeredDevices,
        },
        { status: 403 }
      );
    }

    const { device, customer: updatedCustomer } = registrationResult;

    return NextResponse.json({
      success: true,
      customerId: updatedCustomer.id,
      customerName: updatedCustomer.customerName,
      storeName: updatedCustomer.storeName,
      phone: updatedCustomer.phone,
      email: updatedCustomer.email,
      city: updatedCustomer.city,
      businessType: updatedCustomer.businessType,
      subscriptionKey: updatedCustomer.subscriptionKey,
      device: {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        devicePrefix: device.devicePrefix,
      },
      registeredDevices: updatedCustomer.registeredDevices,
      activeSubscription: {
        planName: updatedCustomer.planName,
        pricePaise: updatedCustomer.pricePaise,
        startDate: updatedCustomer.startDate,
        expiryDate: updatedCustomer.expiryDate,
        status: updatedCustomer.status,
      },
    });
  } catch (err: any) {
    console.error("Auth login error:", err);
    return NextResponse.json(
      { error: err?.message || "Authentication failed. Please try again." },
      { status: 500 }
    );
  }
}
