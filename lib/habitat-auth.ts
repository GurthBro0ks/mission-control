const HABITAT_SITE_ORIGIN = process.env.HABITAT_SITE_ORIGIN || "https://habitat.slimyai.xyz";

export type HabitatSsoTicketVerification = {
  valid: boolean;
  owner: boolean;
  expired: boolean;
  redeemed: boolean;
  returnToAllowed: boolean;
  statusCode: number | null;
  reason: "ok" | "missing" | "network_error" | "bad_status" | "expired" | "replayed" | "return_to_mismatch" | "not_found";
};

type HabitatSsoTicketResponse = Partial<HabitatSsoTicketVerification>;

export async function verifyHabitatSsoTicket(
  ticket: string,
  returnTo: string,
  userAgent: string,
): Promise<HabitatSsoTicketVerification> {
  if (!ticket) return invalidVerification("missing", null);

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
    return invalidVerification("network_error", null);
  }

  const data = (await upstream.json().catch(() => ({}))) as HabitatSsoTicketResponse;
  return {
    valid: upstream.ok && data.valid === true,
    owner: data.owner === true,
    expired: data.expired === true,
    redeemed: data.redeemed === true,
    returnToAllowed: data.returnToAllowed === true,
    statusCode: upstream.status,
    reason: verificationReason(upstream, data),
  };
}

function verificationReason(
  upstream: Response,
  data: HabitatSsoTicketResponse,
): HabitatSsoTicketVerification["reason"] {
  if (upstream.ok && data.valid === true) return "ok";
  if (data.expired === true) return "expired";
  if (data.redeemed === true) return "replayed";
  if (data.returnToAllowed === false && data.owner === true) return "return_to_mismatch";
  if (!upstream.ok && data.valid === false) return "not_found";
  if (!upstream.ok) return "bad_status";
  return "not_found";
}

function invalidVerification(
  reason: HabitatSsoTicketVerification["reason"],
  statusCode: number | null,
): HabitatSsoTicketVerification {
  return {
    valid: false,
    owner: false,
    expired: false,
    redeemed: false,
    returnToAllowed: false,
    statusCode,
    reason,
  };
}
