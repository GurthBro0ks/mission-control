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
assert.match(proxy, /"\/reports\/:path\*"/, "proxy protects all report descendants");
assert.match(proxy, /request\.cookies\.get\("slimy_session"\)/, "proxy checks the report owner session cookie");

const logout = read("app/api/session/logout/route.ts");
assert.match(logout, /REPORT_SESSION_COOKIE = "slimy_session"/, "logout names report session cookie");
assert.match(logout, /export async function GET/, "logout supports browser top-level GET flow");
assert.match(logout, /export async function POST/, "logout keeps POST flow");
assert.match(logout, /response\.cookies\.set\(REPORT_SESSION_COOKIE/, "logout explicitly clears report cookie");
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

console.log("PASS reports auth/session shell invariants");
