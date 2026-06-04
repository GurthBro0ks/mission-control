import { NextRequest, NextResponse } from "next/server";

const MAIN_SITE_ORIGIN = process.env.SLIMY_MAIN_SITE_ORIGIN || "http://127.0.0.1:3000";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const upstream = await fetch(`${MAIN_SITE_ORIGIN}/api/session/me`, {
    method: "GET",
    headers: {
      cookie: request.headers.get("cookie") || "",
      accept: "application/json",
    },
    cache: "no-store",
  });

  const bodyText = await upstream.text();
  return new NextResponse(bodyText, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
