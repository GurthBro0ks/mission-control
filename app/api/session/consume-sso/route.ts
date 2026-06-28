import { NextRequest, NextResponse } from "next/server";
import { logHarnessSsoBreadcrumb } from "@/lib/harness-sso-breadcrumb";
import { verifyHabitatSsoTicket } from "@/lib/habitat-auth";
import { getPublicOrigin, sanitizeReturnTo } from "@/lib/owner-auth";
import {
  createReportSessionToken,
  REPORT_SESSION_COOKIE,
  REPORT_SESSION_MAX_AGE_SECONDS,
} from "@/lib/report-session";

export const dynamic = "force-dynamic";

const REPORTS_ORIGIN = "https://harness.slimyai.xyz";

function normalizeReportsReturnUrl(raw: string | null): URL {
  if (!raw) return new URL("/reports", REPORTS_ORIGIN);

  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return raw.startsWith("/reports")
      ? new URL(raw, REPORTS_ORIGIN)
      : new URL("/reports", REPORTS_ORIGIN);
  }

  try {
    const parsed = new URL(raw);
    if (parsed.origin === REPORTS_ORIGIN && parsed.pathname.startsWith("/reports")) {
      return parsed;
    }
  } catch {
    return new URL("/reports", REPORTS_ORIGIN);
  }

  return new URL("/reports", REPORTS_ORIGIN);
}

function loginRedirect(request: NextRequest, returnUrl: URL): NextResponse {
  const loginUrl = new URL("/login", getPublicOrigin(request));
  loginUrl.searchParams.set("returnTo", sanitizeReturnTo(`${returnUrl.pathname}${returnUrl.search}`));
  return NextResponse.redirect(loginUrl, { status: 302 });
}

export async function GET(request: NextRequest) {
  const ticket = request.nextUrl.searchParams.get("ticket") || "";
  const returnUrl = normalizeReportsReturnUrl(request.nextUrl.searchParams.get("returnTo"));

  if (!ticket) {
    logHarnessSsoBreadcrumb("consume", {
      consume_seen: "yes",
      ticket_seen: "no",
      verify_response_valid: "no",
      verify_reason: "missing",
      report_session_cookie_set: "no",
      return_to_class: "reports_allowlisted",
    });
    return loginRedirect(request, returnUrl);
  }

  const verification = await verifyHabitatSsoTicket(
    ticket,
    returnUrl.toString(),
    request.headers.get("user-agent") || "mission-control-sso-consume",
  );

  if (!verification.valid || !verification.owner || !verification.returnToAllowed) {
    logHarnessSsoBreadcrumb("consume", {
      consume_seen: "yes",
      ticket_seen: "yes",
      verify_response_valid: "no",
      verify_reason: verification.reason,
      verify_status_code: verification.statusCode,
      report_session_cookie_set: "no",
      return_to_class: "reports_allowlisted",
    });
    return loginRedirect(request, returnUrl);
  }

  const now = Math.floor(Date.now() / 1000);
  const token = createReportSessionToken({
    sub: "habitat-owner-sso",
    username: "habitat-owner",
    email: "owner@habitat.local",
    role: "owner",
    iat: now,
    exp: now + REPORT_SESSION_MAX_AGE_SECONDS,
  });
  const response = NextResponse.redirect(returnUrl, { status: 302 });
  response.cookies.set(REPORT_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: REPORT_SESSION_MAX_AGE_SECONDS,
  });
  logHarnessSsoBreadcrumb("consume", {
    consume_seen: "yes",
    ticket_seen: "yes",
    verify_response_valid: "yes",
    verify_reason: "ok",
    verify_status_code: verification.statusCode,
    report_session_cookie_set: "yes",
    report_session_cookie_name: REPORT_SESSION_COOKIE,
    report_session_cookie_domain: "host-only",
    report_session_cookie_ttl_seconds: REPORT_SESSION_MAX_AGE_SECONDS,
    return_to_class: "reports_allowlisted",
  });
  return response;
}
