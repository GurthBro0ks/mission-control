import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const source = readFileSync(join(root, "lib/reports-renderer.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const sandbox = {
  exports: {},
  require(specifier) {
    if (specifier === "./reports-data") return {};
    throw new Error(`Unexpected require: ${specifier}`);
  },
};
sandbox.module = { exports: sandbox.exports };
vm.runInNewContext(compiled, sandbox, { filename: "reports-renderer.js" });

const raw = JSON.parse(readFileSync(join(root, "tests/fixtures/report-fidelity-session.json"), "utf8"));
const report = {
  ...raw,
  filename: "report-fidelity-session.json",
  filepath: "/tmp/report-fidelity-session.json",
  attempt_count: 0,
  raw,
};
const html = sandbox.module.exports.renderSessionDetailPage({
  report,
  failedApproaches: [],
  example: null,
  filename: report.filename,
  versionInfo: null,
});

for (const expected of [
  "TESTS PASS",
  "Focused tests: 33/33 PASS",
  "Full tests: 83/83 PASS",
  "Harness validation: 145/0 PASS",
  "9m",
  "44 total proof files; 4 displayed.",
  "RUN_ID",
  raw.run_id,
  "SUBJECT_ID",
  raw.subject_id,
  "Pushed: <span class=\"mono\">no</span>",
  "Production storage: <span class=\"mono\">inactive</span>",
  "Manual QA: <span class=\"mono\">pending_owner_review</span>",
  "Operator QA: <span class=\"mono\">pending_owner_review</span>",
  "Next Recommended Action",
  "Owner reviews the protected QA report.",
  "No blockers reported.",
]) {
  assert.ok(html.includes(expected), `renderer includes ${expected}`);
}
assert.doesNotMatch(html, /TESTS NOT RUN/, "executed tests are never rendered as not run");
assert.doesNotMatch(html, /Suggested next feature:<\/strong>.*none/, "actionable next step replaces the empty feature suggestion");

console.log("PASS reports renderer fidelity fixture");
