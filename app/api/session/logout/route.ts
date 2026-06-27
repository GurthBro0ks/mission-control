import { NextRequest, NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/owner-auth";

const MAIN_SITE_ORIGIN = process.env.SLIMY_MAIN_SITE_ORIGIN || "http://127.0.0.1:3000";
const REPORT_SESSION_COOKIE = "slimy_session";
const TRUSTED_RETURN_ORIGINS = new Set([
  "https://habitat.slimyai.xyz",
  "https://harness.slimyai.xyz",
]);

export const dynamic = "force-dynamic";

function safeReturnUrl(request: NextRequest): URL {
  const origin = getPublicOrigin(request);
  const raw = request.nextUrl.searchParams.get("returnTo");
  if (!raw) return new URL("/login", origin);

  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return new URL(raw, origin);
  }

  try {
    const parsed = new URL(raw);
    if (TRUSTED_RETURN_ORIGINS.has(parsed.origin)) return parsed;
  } catch {
    return new URL("/login", origin);
  }

  return new URL("/login", origin);
}

async function logout(request: NextRequest) {
  const upstream = await fetch(`${MAIN_SITE_ORIGIN}/api/session/logout`, {
    method: "POST",
    headers: {
      cookie: request.headers.get("cookie") || "",
      "x-forwarded-proto": request.headers.get("x-forwarded-proto") || "https",
    },
    cache: "no-store",
  });

  const response = NextResponse.redirect(safeReturnUrl(request), { status: 302 });
  response.cookies.set(REPORT_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: request.headers.get("x-forwarded-proto") === "https",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) response.headers.append("set-cookie", setCookie);
  return response;
}

export async function GET(request: NextRequest) {
  return logout(request);
}

export async function POST(request: NextRequest) {
  return logout(request);
}
