import { NextRequest, NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/owner-auth";

export const config = {
  matcher: [
    "/reports",
    "/reports/:path*",
  ],
};

export function proxy(request: NextRequest) {
  const sessionToken = request.cookies.get("slimy_session")?.value;
  if (sessionToken) {
    return NextResponse.next();
  }

  const origin = getPublicOrigin(request);
  const loginUrl = new URL("/login", origin);
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set("returnTo", returnTo);
  return NextResponse.redirect(loginUrl);
}
