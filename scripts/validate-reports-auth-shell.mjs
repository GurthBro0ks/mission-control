import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const reportRoutes = [
  "app/reports/route.ts",
  "app/reports/sessions/route.ts",
  "app/reports/sessions/[filename]/route.ts",
  "app/reports/blockers/route.ts",
];

for (const route of reportRoutes) {
  const source = read(route);
  assert.match(source, /requireOwnerReportAccess/, `${route} imports the owner gate`);
  assert.match(source, /await requireOwnerReportAccess\(request\)/, `${route} checks the owner gate`);
  assert.match(source, /if \('response' in auth\) return auth\.response/, `${route} returns auth redirect/block response`);
}

const detailRoute = read("app/reports/sessions/[filename]/route.ts");
assert.match(detailRoute, /getSessionReport\(decoded\)/, "dynamic report detail loads only after auth gate");

const proxy = read("proxy.ts");
assert.match(proxy, /"\/login"/, "proxy includes login route for shell bypass header");
assert.match(proxy, /"\/reports\/:path\*"/, "proxy protects all report descendants");
assert.match(proxy, /request\.cookies\.get\("slimy_session"\)/, "proxy checks the report owner session cookie");
assert.doesNotMatch(proxy, /request\.cookies\.get\("habitat_session"\)/, "proxy does not allow direct Habitat cookie report access");
assert.match(proxy, /x-mission-control-pathname/, "proxy marks login requests for root layout shell bypass");

const habitatAuth = read("lib/habitat-auth.ts");
assert.match(habitatAuth, /HABITAT_SITE_ORIGIN/, "Habitat auth origin is explicit");
assert.match(habitatAuth, /"https:\/\/habitat\.slimyai\.xyz"/, "Habitat verifier default uses public Habitat origin, not NUC-local localhost");
assert.doesNotMatch(habitatAuth, /"http:\/\/127\.0\.0\.1:5055"/, "Habitat verifier default does not point at NUC2 localhost");
assert.match(habitatAuth, /\/api\/reports\/sso-ticket\/verify/, "Habitat ticket verification delegates to GH Tracker verifier endpoint");
assert.match(habitatAuth, /method: "POST"/, "Habitat ticket verification uses server-side POST");
assert.match(habitatAuth, /JSON\.stringify\(\{ ticket, returnTo \}\)/, "Habitat ticket verification sends ticket server-side only");
assert.match(habitatAuth, /valid: upstream\.ok && data\.valid === true/, "Habitat ticket verification requires upstream valid=true");
assert.match(habitatAuth, /owner: data\.owner === true/, "Habitat ticket verification requires owner=true");
assert.match(habitatAuth, /returnToAllowed: data\.returnToAllowed === true/, "Habitat ticket verification requires allowlisted returnTo");
assert.match(habitatAuth, /reason: verificationReason\(upstream, data\)/, "Habitat ticket verification exposes safe reason codes");
assert.doesNotMatch(habitatAuth, /console\.(log|warn|error)/, "Habitat ticket verifier does not log ticket values");

const ownerAuth = read("lib/owner-auth.ts");
assert.match(ownerAuth, /verifyReportSessionToken/, "report gate verifies Mission-Control report sessions locally");
assert.match(ownerAuth, /logHarnessSsoBreadcrumb/, "report gate emits safe auth breadcrumbs");
assert.match(ownerAuth, /report_auth_reason: "ok"/, "report gate logs accepted report sessions safely");
assert.match(ownerAuth, /report_auth_reason: "invalid"/, "report gate logs invalid report sessions safely");
assert.match(ownerAuth, /if \(!reportSessionToken\)/, "report gate blocks requests without report session cookie");
assert.match(ownerAuth, /if \(reportSession\)/, "report gate accepts only valid local report sessions before legacy fallback");
assert.match(ownerAuth, /REPORT_SESSION_COOKIE/, "report gate keeps Slimy session support");
assert.doesNotMatch(ownerAuth, /cookie\.includes\("slimy_session="/, "report gate does not rely on substring cookie checks");
assert.doesNotMatch(ownerAuth, /habitatSessionToken|verifyHabitatOwnerSession|HABITAT_SESSION_COOKIE/, "report gate never trusts raw Habitat cookies as report access");

const reportSession = read("lib/report-session.ts");
assert.match(reportSession, /REPORT_SESSION_COOKIE = "slimy_session"/, "local report session cookie name is explicit");
assert.match(reportSession, /createHmac\("sha256"/, "local report session is HMAC signed");
assert.match(reportSession, /timingSafeEqual/, "local report session signature comparison is timing-safe");
assert.match(reportSession, /session\.role !== "owner"/, "local report session requires owner role");
assert.match(reportSession, /session\.exp < Math\.floor\(Date\.now\(\) \/ 1000\)/, "local report session enforces expiry");

const consumeSso = read("app/api/session/consume-sso/route.ts");
assert.match(consumeSso, /verifyHabitatSsoTicket/, "consume endpoint verifies tickets server-to-server");
assert.match(consumeSso, /logHarnessSsoBreadcrumb/, "consume endpoint emits safe SSO breadcrumbs");
assert.match(consumeSso, /consume_seen: "yes"/, "consume endpoint logs route hit safely");
assert.match(consumeSso, /verify_response_valid: "yes"/, "consume endpoint logs successful verification safely");
assert.match(consumeSso, /report_session_cookie_set: "yes"/, "consume endpoint logs cookie-set boolean safely");
assert.match(consumeSso, /report_session_cookie_domain: "host-only"/, "consume endpoint logs host-only cookie domain safely");
assert.match(consumeSso, /normalizeReportsReturnUrl/, "consume endpoint normalizes return targets");
assert.match(consumeSso, /parsed\.origin === REPORTS_ORIGIN && parsed\.pathname\.startsWith\("\/reports"\)/, "consume endpoint allowlists Harness Reports descendants");
assert.match(consumeSso, /if \(!ticket\)/, "consume endpoint blocks missing tickets");
assert.match(consumeSso, /!verification\.valid \|\| !verification\.owner \|\| !verification\.returnToAllowed/, "consume endpoint blocks invalid, replayed, expired, or wrong-return tickets");
assert.match(consumeSso, /response\.cookies\.set\(REPORT_SESSION_COOKIE, token/, "consume endpoint sets Mission-Control report session cookie");
assert.match(consumeSso, /httpOnly: true/, "consume report session cookie is HttpOnly");
assert.match(consumeSso, /secure: true/, "consume report session cookie is Secure");
assert.match(consumeSso, /sameSite: "lax"/, "consume report session cookie uses SameSite=Lax");
assert.match(consumeSso, /path: "\/"/, "consume report session cookie is path-wide");
assert.doesNotMatch(consumeSso, /console\.(log|warn|error)/, "consume endpoint does not log ticket values");

const breadcrumb = read("lib/harness-sso-breadcrumb.ts");
assert.match(breadcrumb, /LONG_SECRET_SHAPED_VALUE/, "breadcrumb helper blocks secret-shaped values");
assert.match(breadcrumb, /\[redacted\]/, "breadcrumb helper redacts unsafe values");

const logout = read("app/api/session/logout/route.ts");
assert.match(logout, /REPORT_SESSION_COOKIE = "slimy_session"/, "logout names report session cookie");
assert.match(logout, /HABITAT_SESSION_COOKIE = "habitat_session"/, "logout names Habitat session cookie");
assert.match(logout, /export async function GET/, "logout supports browser top-level GET flow");
assert.match(logout, /export async function POST/, "logout keeps POST flow");
assert.match(logout, /appendClearCookie\(response, REPORT_SESSION_COOKIE/, "logout explicitly clears report cookie");
assert.match(logout, /appendClearCookie\(response, HABITAT_SESSION_COOKIE/, "logout explicitly clears Habitat cookie");
assert.match(logout, /response\.headers\.append\("Set-Cookie"/, "logout appends explicit duplicate Set-Cookie clear headers");
assert.match(logout, /serializeClearCookie/, "logout serializes clear headers with duplicate cookie names safely");
assert.match(logout, /SHARED_SESSION_DOMAIN = "\.slimyai\.xyz"/, "logout clears shared parent-domain cookies");
assert.match(logout, /return SHARED_SESSION_DOMAIN/, "secure logout clears parent-domain cookies even if proxy host is internal");
assert.match(logout, /https:\/\/habitat\.slimyai\.xyz/, "logout allows safe return to Habitat login");

const renderer = read("lib/reports-renderer.ts");
for (const label of [
  "Mission-Control Reports",
  "Habitat /harness",
  "Repo Dashboard",
  "Index",
  "Sessions",
  "Blockers",
]) {
  assert.ok(renderer.includes(label), `renderer includes ${label}`);
}
assert.match(renderer, /aria-current="page"/, "nav exposes active page state");
assert.match(renderer, /activeNav: 'index'/, "index page sets active nav");
assert.match(renderer, /activeNav: 'sessions'/, "session pages set active nav");
assert.match(renderer, /activeNav: 'blockers'/, "blocker page sets active nav");

const shell = read("app/Shell.tsx");
assert.match(shell, /usePathname/, "shell can detect report login route");
assert.match(shell, /clientPathname === "\/login"/, "login route has reports-specific shell bypass");
assert.match(shell, /if \(!shouldShowChrome\)/, "login route bypasses Mission Control chrome during server render");

const rootLayout = read("app/layout.tsx");
assert.match(rootLayout, /headers\(\)/, "root layout can read proxy shell-bypass header");
assert.match(rootLayout, /x-mission-control-pathname/, "root layout reads login shell-bypass header");
assert.match(rootLayout, /!== "\/login"|=== "\/login"/, "root layout has login-specific branch");

const loginPage = read("app/login/page.tsx");
assert.match(loginPage, /Harness Reports Access/, "login page title is report-specific");
assert.match(loginPage, /title: "Harness Reports Access"/, "login page metadata is report-specific");
assert.doesNotMatch(loginPage, /SLIMYAI MISSION CONTROL/, "login page does not render old Mission Control title");

assert.match(proxy, /logHarnessSsoBreadcrumb/, "reports proxy emits safe auth breadcrumbs");
assert.match(proxy, /report_auth_reason: "missing"/, "reports proxy logs missing report cookie safely");
assert.match(proxy, /report_auth_reason: "proxy_cookie_seen"/, "reports proxy logs cookie presence without values");

console.log("PASS reports auth/session shell invariants");
