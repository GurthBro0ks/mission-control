import { NextRequest, NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/owner-auth";

const MAIN_SITE_ORIGIN = process.env.SLIMY_MAIN_SITE_ORIGIN || "http://127.0.0.1:3000";
const REPORT_SESSION_COOKIE = "slimy_session";
const HABITAT_SESSION_COOKIE = "habitat_session";
const SHARED_SESSION_DOMAIN = ".slimyai.xyz";
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

function getSharedSessionCookieDomain(request: NextRequest): string | null {
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(":")[0]
    .toLowerCase();
  if (host === "slimyai.xyz" || host.endsWith(".slimyai.xyz")) {
    return SHARED_SESSION_DOMAIN;
  }
  return null;
}

function clearCookie(
  response: NextResponse,
  name: string,
  secure: boolean,
  domain?: string | null,
) {
  response.cookies.set(name, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    ...(domain ? { domain } : {}),
    expires: new Date(0),
    maxAge: 0,
  });
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
  const isSecure = request.headers.get("x-forwarded-proto") === "https";
  const sharedDomain = isSecure ? getSharedSessionCookieDomain(request) : null;
  clearCookie(response, REPORT_SESSION_COOKIE, isSecure);
  clearCookie(response, HABITAT_SESSION_COOKIE, isSecure);
  if (sharedDomain) {
    clearCookie(response, REPORT_SESSION_COOKIE, true, sharedDomain);
    clearCookie(response, HABITAT_SESSION_COOKIE, true, sharedDomain);
  }
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
