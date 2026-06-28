export const HABITAT_SESSION_COOKIE = "habitat_session";

const HABITAT_SITE_ORIGIN = process.env.HABITAT_SITE_ORIGIN || "http://127.0.0.1:5055";

type HabitatMeResponse = {
  authenticated?: boolean;
  user?: {
    id?: string;
    email?: string;
    role?: string;
  };
};

export type HabitatOwnerSession = {
  id: string;
  email: string;
  role: "owner";
};

export async function verifyHabitatOwnerSession(
  cookieHeader: string,
  userAgent: string,
): Promise<HabitatOwnerSession | null> {
  let upstream: Response;
  try {
    upstream = await fetch(`${HABITAT_SITE_ORIGIN}/api/auth/me`, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
        "user-agent": userAgent,
        accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!upstream.ok) return null;

  const data = (await upstream.json().catch(() => ({}))) as HabitatMeResponse;
  if (!data.authenticated || data.user?.role !== "owner" || !data.user.id || !data.user.email) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email,
    role: "owner",
  };
}
