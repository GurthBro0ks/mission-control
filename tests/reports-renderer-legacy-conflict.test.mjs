import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const source = readFileSync(join(root, "lib/reports-renderer.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
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

const { renderSessionDetailPage } = sandbox.module.exports;

function makeReport({ status = "PASS", result = undefined, tests }) {
  const raw = {
    status,
    summary: "Renderer test report",
    tests,
  };
  if (result !== undefined) raw.result = result;

  return {
    filename: "report-test.json",
    filepath: "/tmp/report-test.json",
    session_id: "session-test",
    agent: "Codex",
    nuc: "NUC2",
    project: "mission-control",
    feature_id: "renderer-test",
    prompt_type: "test",
    status,
    summary: "Renderer test report",
    timestamp: "2026-07-02T00:00:00Z",
    duration_minutes: 1,
    attempt_count: 1,
    raw,
    changes: [],
    tests,
    blockers: [],
    recommendation: {
      next_feature_id: null,
      reasoning: "none",
      risk_notes: null,
    },
    kb_learnings: [],
  };
}

function render(report) {
  return renderSessionDetailPage({
    report,
    failedApproaches: [],
    example: null,
    filename: report.filename,
    versionInfo: null,
  });
}

for (const status of ["PASS", "pass", "completed", "success", "ok"]) {
  const html = render(makeReport({ status, tests: { ran: true, passed: false, details: "unit failure" } }));
  assert.match(html, /LEGACY METADATA CONFLICT/, `${status} renders legacy conflict`);
  assert.match(
    html,
    /Archived report metadata says the result passed, but test metadata says tests failed\./,
    `${status} renders conflict note`,
  );
  assert.doesNotMatch(html, /TESTS FAIL/, `${status} does not render normal failed-test label`);
}

{
  const html = render(makeReport({ status: "FAIL", tests: { ran: true, passed: false, details: "unit failure" } }));
  assert.match(html, /TESTS FAIL/, "failed status still renders TESTS FAIL");
  assert.doesNotMatch(html, /LEGACY METADATA CONFLICT/, "failed status is not legacy conflict");
}

{
  const html = render(makeReport({ status: "PASS", result: "FAIL", tests: { ran: true, passed: false, details: "unit failure" } }));
  assert.match(html, /TESTS FAIL/, "fail-like top-level result preserves TESTS FAIL");
  assert.doesNotMatch(html, /LEGACY METADATA CONFLICT/, "fail-like top-level result is not legacy conflict");
}

{
  const html = render(makeReport({ status: "FAIL", tests: { ran: false, passed: false, details: "not run" } }));
  assert.match(html, /TESTS NOT RUN/, "no-tests-ran short-circuits before failed-test metadata");
  assert.doesNotMatch(html, /TESTS FAIL/, "no-tests-ran does not render TESTS FAIL");
}

{
  const html = render(makeReport({ status: "PASS", tests: { ran: false, passed: false, details: "smoke check only" } }));
  assert.match(html, /SMOKE ONLY/, "smoke-only reports keep smoke label");
  assert.doesNotMatch(html, /TESTS FAIL/, "smoke-only reports do not render TESTS FAIL");
}

console.log("PASS reports renderer legacy conflict invariants");
