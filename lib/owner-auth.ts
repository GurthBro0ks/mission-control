import { NextResponse } from "next/server";
import {
  HABITAT_SESSION_COOKIE,
  verifyHabitatOwnerSession,
} from "@/lib/habitat-auth";

const MAIN_SITE_ORIGIN = process.env.SLIMY_MAIN_SITE_ORIGIN || "http://127.0.0.1:3000";
const REPORT_SESSION_COOKIE = "slimy_session";

type SessionMeResponse = {
  authenticated?: boolean;
  id?: string;
  username?: string;
  email?: string;
  role?: string;
};

export type OwnerSession = {
  id: string;
  username: string;
  email: string;
  role: string;
};

function parseCookieHeader(cookieHeader: string): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName || rawValue.length === 0) continue;
    cookies.set(rawName, rawValue.join("="));
  }
  return cookies;
}

export function getPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    const proto = forwardedProto === "https" ? "https" : "http";
    return `${proto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/reports";
  return value;
}

function getSafeReturnTo(request: Request): string {
  const url = new URL(request.url);
  const returnTo = `${url.pathname}${url.search}`;
  return returnTo.startsWith("/") ? returnTo : "/reports";
}

function buildLoginRedirect(request: Request): NextResponse {
  const origin = getPublicOrigin(request);
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("returnTo", getSafeReturnTo(request));
  return NextResponse.redirect(loginUrl, { status: 302 });
}

export async function requireOwnerReportAccess(
  request: Request,
): Promise<{ owner: OwnerSession } | { response: NextResponse }> {
  const cookie = request.headers.get("cookie") || "";
  const cookieMap = parseCookieHeader(cookie);
  const habitatSessionToken = cookieMap.get(HABITAT_SESSION_COOKIE);

  if (habitatSessionToken) {
    const habitatSession = await verifyHabitatOwnerSession(
      cookie,
      request.headers.get("user-agent") || "mission-control-habitat-owner-gate",
    );
    if (habitatSession) {
      return {
        owner: {
          id: habitatSession.id,
          username: habitatSession.email,
          email: habitatSession.email,
          role: habitatSession.role,
        },
      };
    }
  }

  if (!cookieMap.has(REPORT_SESSION_COOKIE)) {
    return { response: buildLoginRedirect(request) };
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${MAIN_SITE_ORIGIN}/api/session/me`, {
      method: "GET",
      headers: {
        cookie,
        "user-agent": request.headers.get("user-agent") || "mission-control-owner-gate",
        accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    return {
      response: NextResponse.json(
        { error: "owner_auth_unavailable" },
        { status: 503 },
      ),
    };
  }

  if (upstream.status === 401) {
    return { response: buildLoginRedirect(request) };
  }

  if (!upstream.ok) {
    return {
      response: NextResponse.json(
        { error: "owner_auth_failed" },
        { status: 503 },
      ),
    };
  }

  const data = (await upstream.json()) as SessionMeResponse;
  if (!data.authenticated) {
    return { response: buildLoginRedirect(request) };
  }

  if (data.role !== "owner" || !data.id || !data.username || !data.email) {
    return {
      response: NextResponse.json(
        { error: "forbidden", message: "Owner access required" },
        { status: 403 },
      ),
    };
  }

  return {
    owner: {
      id: data.id,
      username: data.username,
      email: data.email,
      role: data.role,
    },
  };
}
