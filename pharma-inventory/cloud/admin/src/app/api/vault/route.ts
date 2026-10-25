import { NextRequest, NextResponse } from "next/server";
import { getCustomerById, getLatestVaultSnapshot, saveVaultSnapshot } from "@/lib/storage";

/**
 * Cloud Vault API
 * Handles encrypted snapshot storage and recovery.
 * Provides instant zero-cost local storage on Cloud Admin with full Cloudflare R2 compatibility.
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const action = searchParams.get("action") || "latest"; // 'latest' | 'download'

    if (!customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    const customer = getCustomerById(customerId);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const snapshot = getLatestVaultSnapshot(customerId);
    if (!snapshot) {
      return NextResponse.json(
        { message: "No cloud vault snapshot found for this store yet.", exists: false },
        { status: 200 }
      );
    }

    if (action === "download") {
      return NextResponse.json({
        exists: true,
        metadata: snapshot.metadata,
        dataBase64: snapshot.dataBase64,
      });
    }

    // Default: return metadata only (fast, lightweight check)
    return NextResponse.json({
      exists: true,
      metadata: snapshot.metadata,
    });
  } catch (err: any) {
    console.error("Vault GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerId,
      deviceId,
      deviceName,
      devicePrefix,
      baseVersion,
      dataBase64,
      sizeBytes,
      checksumSha256,
    } = body;

    if (!customerId || !dataBase64) {
      return NextResponse.json(
        { error: "customerId and dataBase64 snapshot payload are required" },
        { status: 400 }
      );
    }

    const customer = getCustomerById(customerId);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Check existing snapshot version for collision / conflict warning
    const currentLatest = getLatestVaultSnapshot(customerId);
    let newVersion = 1;

    if (currentLatest) {
      const currentVer = currentLatest.metadata.version || 1;
      // Conflict detection: if client's base version is older than cloud version
      if (typeof baseVersion === "number" && baseVersion < currentVer) {
        return NextResponse.json(
          {
            error: "Conflict detected: The Cloud Vault has a newer backup uploaded by another device.",
            conflict: true,
            cloudVersion: currentVer,
            cloudUpdatedBy: currentLatest.metadata.uploadedByDeviceName,
            cloudUpdatedAt: currentLatest.metadata.updatedAt,
          },
          { status: 409 }
        );
      }
      newVersion = currentVer + 1;
    }

    const savedMeta = saveVaultSnapshot(customerId, dataBase64, {
      version: newVersion,
      uploadedByDeviceId: deviceId || "unknown-dev",
      uploadedByDeviceName: deviceName || "Computer",
      devicePrefix: devicePrefix || "A",
      sizeBytes: sizeBytes || dataBase64.length,
      checksumSha256,
    });

    return NextResponse.json({
      success: true,
      message: `Cloud Vault updated to version ${newVersion}`,
      metadata: savedMeta,
    });
  } catch (err: any) {
    console.error("Vault POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
