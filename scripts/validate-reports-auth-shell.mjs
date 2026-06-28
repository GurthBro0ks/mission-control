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
assert.match(proxy, /request\.cookies\.get\("habitat_session"\)/, "proxy allows Habitat owner session cookie through to the route gate");
assert.match(proxy, /x-mission-control-pathname/, "proxy marks login requests for root layout shell bypass");

const habitatAuth = read("lib/habitat-auth.ts");
assert.match(habitatAuth, /HABITAT_SESSION_COOKIE = "habitat_session"/, "Habitat cookie name is explicit");
assert.match(habitatAuth, /HABITAT_SITE_ORIGIN/, "Habitat auth origin is explicit");
assert.match(habitatAuth, /\/api\/auth\/me/, "Habitat session verification delegates to GH Tracker auth metadata endpoint");
assert.match(habitatAuth, /data\.user\?\.role !== "owner"/, "Habitat session verification requires owner role");
assert.match(habitatAuth, /return null/, "Habitat session verification fails closed");

const ownerAuth = read("lib/owner-auth.ts");
assert.match(ownerAuth, /verifyHabitatOwnerSession/, "report gate verifies Habitat sessions through GH Tracker");
assert.match(ownerAuth, /if \(habitatSessionToken\)/, "report gate only attempts Habitat verification when the shared cookie is present");
assert.match(ownerAuth, /if \(habitatSession\)/, "report gate accepts only verified Habitat owner sessions");
assert.match(ownerAuth, /REPORT_SESSION_COOKIE = "slimy_session"/, "report gate keeps Slimy session support");
assert.doesNotMatch(ownerAuth, /cookie\.includes\("slimy_session="/, "report gate does not rely on substring cookie checks");
assert.doesNotMatch(ownerAuth, /owner:\s*\{[\s\S]{0,200}habitatSessionToken/, "report gate never trusts the raw Habitat cookie string as an owner session");

const logout = read("app/api/session/logout/route.ts");
assert.match(logout, /REPORT_SESSION_COOKIE = "slimy_session"/, "logout names report session cookie");
assert.match(logout, /HABITAT_SESSION_COOKIE = "habitat_session"/, "logout names Habitat session cookie");
assert.match(logout, /export async function GET/, "logout supports browser top-level GET flow");
assert.match(logout, /export async function POST/, "logout keeps POST flow");
assert.match(logout, /clearCookie\(response, REPORT_SESSION_COOKIE/, "logout explicitly clears report cookie");
assert.match(logout, /clearCookie\(response, HABITAT_SESSION_COOKIE/, "logout explicitly clears Habitat cookie");
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

console.log("PASS reports auth/session shell invariants");
