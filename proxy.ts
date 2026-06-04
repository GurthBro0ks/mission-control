import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/:path*"],
};

export function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/reports")) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get("slimy_session")?.value;
  if (sessionToken) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set("returnTo", returnTo);
  return NextResponse.redirect(loginUrl);
}
