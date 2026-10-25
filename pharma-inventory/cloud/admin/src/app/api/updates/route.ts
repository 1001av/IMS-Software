import { NextRequest, NextResponse } from "next/server";
import { getProductReleases, deployProductRelease } from "@/lib/storage";

function semverCompare(v1: string, v2: string): number {
  const p1 = (v1 || "0").replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const p2 = (v2 || "0").replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Admin Dashboard management query
  if (searchParams.get("manage") === "true") {
    return NextResponse.json({ releases: getProductReleases() });
  }

  const product = (searchParams.get("product") || "pharma").toLowerCase();
  const target = searchParams.get("target") || "windows-x86_64";
  const currentVersion = searchParams.get("current_version") || searchParams.get("version") || "1.0.0";

  const allReleases = getProductReleases();
  const release = allReleases[product] || allReleases.agro;

  // 1. If no update has been explicitly deployed by the admin/user, return 204 No Content
  if (!release || !release.isDeployed) {
    return new Response(null, { status: 204 });
  }

  // 2. If client is already on current or newer version, return 204 No Content
  if (semverCompare(currentVersion, release.version) >= 0) {
    return new Response(null, { status: 204 });
  }

  // 3. Client is running an older version and an actual update is deployed!
  return NextResponse.json({
    version: release.version,
    notes: release.notes,
    pub_date: release.pub_date,
    url: release.url,
    signature: release.signature || "",
    platforms: {
      [target]: {
        url: release.url,
        signature: release.signature || "",
      },
    },
  });
}

/** Admin API to deploy, toggle, or update a software release */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { product, version, notes, url, signature, isDeployed } = body;

    if (!product || !version) {
      return NextResponse.json({ error: "Product and version are required." }, { status: 400 });
    }

    const updated = deployProductRelease(product.toLowerCase(), {
      version,
      notes,
      url,
      signature,
      isDeployed: isDeployed !== undefined ? Boolean(isDeployed) : true,
    });

    return NextResponse.json({ success: true, release: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update release." }, { status: 500 });
  }
}
