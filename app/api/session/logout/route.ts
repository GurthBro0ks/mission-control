import { NextRequest, NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/owner-auth";

const MAIN_SITE_ORIGIN = process.env.SLIMY_MAIN_SITE_ORIGIN || "http://127.0.0.1:3000";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const upstream = await fetch(`${MAIN_SITE_ORIGIN}/api/session/logout`, {
    method: "POST",
    headers: {
      cookie: request.headers.get("cookie") || "",
      "x-forwarded-proto": request.headers.get("x-forwarded-proto") || "https",
    },
    cache: "no-store",
  });

  const origin = getPublicOrigin(request);
  const response = NextResponse.redirect(new URL("/login", origin), { status: 302 });
  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) response.headers.set("set-cookie", setCookie);
  return response;
}
