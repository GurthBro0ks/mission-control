import { createHmac, timingSafeEqual } from "node:crypto";

export const REPORT_SESSION_COOKIE = "slimy_session";
const DEFAULT_REPORT_SESSION_MAX_AGE_SECONDS = 86400;
const parsedReportSessionMaxAgeSeconds = Number.parseInt(
  process.env.REPORT_SESSION_MAX_AGE_SECONDS || String(DEFAULT_REPORT_SESSION_MAX_AGE_SECONDS),
  10,
);
export const REPORT_SESSION_MAX_AGE_SECONDS =
  Number.isFinite(parsedReportSessionMaxAgeSeconds) && parsedReportSessionMaxAgeSeconds > 0
    ? parsedReportSessionMaxAgeSeconds
    : DEFAULT_REPORT_SESSION_MAX_AGE_SECONDS;

const REPORT_SESSION_SECRET =
  process.env.MISSION_CONTROL_REPORT_SESSION_SECRET ||
  process.env.REPORT_SESSION_SECRET ||
  process.env.HABITAT_SESSION_SECRET ||
  process.env.HOSTNAME ||
  "mission-control-report-session-fallback-seed";

export type ReportSessionPayload = {
  sub: string;
  username: string;
  email: string;
  role: "owner";
  iat: number;
  exp: number;
};

function base64urlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64urlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(payload: string): string {
  const hmac = createHmac("sha256", REPORT_SESSION_SECRET);
  hmac.update(payload);
  return hmac.digest("base64url");
}

function verifySignature(payload: string, signature: string): boolean {
  const expected = signPayload(payload);
  const expectedBuffer = Buffer.from(expected, "base64url");
  const actualBuffer = Buffer.from(signature, "base64url");
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function createReportSessionToken(session: ReportSessionPayload): string {
  const payload = base64urlEncode(JSON.stringify(session));
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function verifyReportSessionToken(token: string | null | undefined): ReportSessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!verifySignature(payload, signature)) return null;

  try {
    const session = JSON.parse(base64urlDecode(payload)) as ReportSessionPayload;
    if (session.role !== "owner") return null;
    if (session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}
