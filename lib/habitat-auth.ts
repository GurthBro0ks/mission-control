const HABITAT_SITE_ORIGIN = process.env.HABITAT_SITE_ORIGIN || "http://127.0.0.1:5055";

export type HabitatSsoTicketVerification = {
  valid: boolean;
  owner: boolean;
  expired: boolean;
  redeemed: boolean;
  returnToAllowed: boolean;
};

type HabitatSsoTicketResponse = Partial<HabitatSsoTicketVerification>;

export async function verifyHabitatSsoTicket(
  ticket: string,
  returnTo: string,
  userAgent: string,
): Promise<HabitatSsoTicketVerification> {
  if (!ticket) return invalidVerification();

  let upstream: Response;
  try {
    upstream = await fetch(`${HABITAT_SITE_ORIGIN}/api/reports/sso-ticket/verify`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": userAgent,
        accept: "application/json",
      },
      body: JSON.stringify({ ticket, returnTo }),
      cache: "no-store",
    });
  } catch {
    return invalidVerification();
  }

  const data = (await upstream.json().catch(() => ({}))) as HabitatSsoTicketResponse;
  return {
    valid: upstream.ok && data.valid === true,
    owner: data.owner === true,
    expired: data.expired === true,
    redeemed: data.redeemed === true,
    returnToAllowed: data.returnToAllowed === true,
  };
}

function invalidVerification(): HabitatSsoTicketVerification {
  return {
    valid: false,
    owner: false,
    expired: false,
    redeemed: false,
    returnToAllowed: false,
  };
}
