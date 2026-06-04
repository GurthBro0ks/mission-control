import { NextRequest, NextResponse } from "next/server";

const MAIN_SITE_ORIGIN = process.env.SLIMY_MAIN_SITE_ORIGIN || "http://127.0.0.1:3000";

function getSafeReturnTo(value?: string): string {
  if (!value || !value.startsWith("/")) return "/reports";
  return value;
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  const isForm = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");

  let email = "";
  let password = "";
  let returnTo = "/reports";

  if (isForm) {
    const form = await request.formData();
    email = String(form.get("email") || "").trim();
    password = String(form.get("password") || "");
    returnTo = getSafeReturnTo(String(form.get("returnTo") || "/reports"));
  } else {
    const body = await request.json().catch(() => ({}));
    email = String(body.email || "").trim();
    password = String(body.password || "");
    returnTo = getSafeReturnTo(String(body.returnTo || "/reports"));
  }

  const upstream = await fetch(`${MAIN_SITE_ORIGIN}/api/session/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-proto": request.headers.get("x-forwarded-proto") || "https",
      "user-agent": request.headers.get("user-agent") || "mission-control-login",
      ...(request.headers.get("x-forwarded-for")
        ? { "x-forwarded-for": request.headers.get("x-forwarded-for") as string }
        : {}),
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const setCookie = upstream.headers.get("set-cookie");

  if (isForm) {
    const redirectUrl = new URL(upstream.ok ? returnTo : `/login?error=invalid&returnTo=${encodeURIComponent(returnTo)}`, request.url);
    const response = NextResponse.redirect(redirectUrl, { status: upstream.ok ? 302 : 303 });
    if (setCookie) response.headers.set("set-cookie", setCookie);
    return response;
  }

  const bodyText = await upstream.text();
  const response = new NextResponse(bodyText, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
  if (setCookie) response.headers.set("set-cookie", setCookie);
  return response;
}
