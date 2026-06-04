import { NextResponse } from "next/server";

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

  if (!cookie.includes("slimy_session=")) {
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
