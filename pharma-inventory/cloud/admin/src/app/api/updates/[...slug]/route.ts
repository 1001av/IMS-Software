import { NextRequest, NextResponse } from "next/server";
import { GET as baseGet } from "../route";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug?: string[] } }
) {
  const slug = params.slug || [];
  let product = "pharma";
  let target = "windows-x86_64";
  let version = "1.0.0";

  // If format is /api/updates/[product]/[target]/[version]
  if (slug.length >= 3) {
    product = slug[0];
    target = slug[1];
    version = slug[2];
  } else if (slug.length === 2) {
    // /api/updates/[target]/[version]
    target = slug[0];
    version = slug[1];
  }

  const url = new URL(req.url);
  if (!url.searchParams.has("product")) url.searchParams.set("product", product);
  if (!url.searchParams.has("target")) url.searchParams.set("target", target);
  if (!url.searchParams.has("current_version")) url.searchParams.set("current_version", version);

  const forwardReq = new NextRequest(url, { headers: req.headers });
  return baseGet(forwardReq);
}
