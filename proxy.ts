import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: [
    "/login",
    "/reports",
    "/reports/:path*",
  ],
};

function getPublicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    const proto = forwardedProto === "https" ? "https" : "http";
    return `${proto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/login") {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-mission-control-pathname", "/login");
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const sessionToken = request.cookies.get("slimy_session")?.value;
  const habitatSessionToken = request.cookies.get("habitat_session")?.value;
  if (sessionToken || habitatSessionToken) {
    return NextResponse.next();
  }

  const origin = getPublicOrigin(request);
  const loginUrl = new URL("/login", origin);
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set("returnTo", returnTo);
  return NextResponse.redirect(loginUrl);
}
