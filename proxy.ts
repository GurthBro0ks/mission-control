import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: [
    "/reports",
    "/reports/sessions",
    "/reports/sessions/(.*)",
    "/reports/blockers",
  ],
};

export function proxy(request: NextRequest) {
  const sessionToken = request.cookies.get("slimy_session")?.value;
  if (sessionToken) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set("returnTo", returnTo);
  return NextResponse.redirect(loginUrl);
}
