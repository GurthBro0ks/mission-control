import { NextResponse } from "next/server";
import { logHarnessSsoBreadcrumb } from "@/lib/harness-sso-breadcrumb";
import { REPORT_SESSION_COOKIE, verifyReportSessionToken } from "@/lib/report-session";

const MAIN_SITE_ORIGIN = process.env.SLIMY_MAIN_SITE_ORIGIN || "http://127.0.0.1:3000";

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
  if (!value.startsWith("/reports")) return "/reports";
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
  const reportSessionToken = cookieMap.get(REPORT_SESSION_COOKIE);

  if (!reportSessionToken) {
    logHarnessSsoBreadcrumb("reports_auth", {
      report_session_seen: "no",
      report_auth_reason: "missing",
      report_auth_accepted: "no",
    });
    return { response: buildLoginRedirect(request) };
  }

  const reportSession = verifyReportSessionToken(reportSessionToken);
  if (reportSession) {
    logHarnessSsoBreadcrumb("reports_auth", {
      report_session_seen: "yes",
      report_auth_reason: "ok",
      report_auth_accepted: "yes",
    });
    return {
      owner: {
        id: reportSession.sub,
        username: reportSession.username,
        email: reportSession.email,
        role: reportSession.role,
      },
    };
  }
  logHarnessSsoBreadcrumb("reports_auth", {
    report_session_seen: "yes",
    report_auth_reason: "invalid",
    report_auth_accepted: "no",
  });

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
    logHarnessSsoBreadcrumb("reports_auth", {
      report_session_seen: "yes",
      report_auth_reason: "legacy_unavailable",
      report_auth_accepted: "no",
    });
    return {
      response: NextResponse.json(
        { error: "owner_auth_unavailable" },
        { status: 503 },
      ),
    };
  }

  if (upstream.status === 401) {
    logHarnessSsoBreadcrumb("reports_auth", {
      report_session_seen: "yes",
      report_auth_reason: "legacy_unauthorized",
      report_auth_accepted: "no",
    });
    return { response: buildLoginRedirect(request) };
  }

  if (!upstream.ok) {
    logHarnessSsoBreadcrumb("reports_auth", {
      report_session_seen: "yes",
      report_auth_reason: "legacy_failed",
      report_auth_accepted: "no",
    });
    return {
      response: NextResponse.json(
        { error: "owner_auth_failed" },
        { status: 503 },
      ),
    };
  }

  const data = (await upstream.json()) as SessionMeResponse;
  if (!data.authenticated) {
    logHarnessSsoBreadcrumb("reports_auth", {
      report_session_seen: "yes",
      report_auth_reason: "legacy_unauthenticated",
      report_auth_accepted: "no",
    });
    return { response: buildLoginRedirect(request) };
  }

  if (data.role !== "owner" || !data.id || !data.username || !data.email) {
    logHarnessSsoBreadcrumb("reports_auth", {
      report_session_seen: "yes",
      report_auth_reason: "legacy_forbidden",
      report_auth_accepted: "no",
    });
    return {
      response: NextResponse.json(
        { error: "forbidden", message: "Owner access required" },
        { status: 403 },
      ),
    };
  }

  logHarnessSsoBreadcrumb("reports_auth", {
    report_session_seen: "yes",
    report_auth_reason: "legacy_ok",
    report_auth_accepted: "yes",
  });
  return {
    owner: {
      id: data.id,
      username: data.username,
      email: data.email,
      role: data.role,
    },
  };
}
