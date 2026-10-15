// Disposed isolated browser, actual components, synthetic HTTP/auth declarations.
const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  { build } = require("../tests/teacher-admin-fixture.cjs"),
  cli = path.join(root, "node_modules/@playwright/cli/playwright-cli.js"),
  report = path.join(root, "docs/v3/qa-teacher-admin-report.json"),
  session = `lumio-teacher-admin-${process.pid}-${Date.now()}`;
function call(...args) {
  const run = spawnSync(
    process.execPath,
    [cli, `-s=${session}`, ...args, "--json"],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 180000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  if (run.error || run.status !== 0)
    throw run.error || Error(run.stdout || run.stderr || "CLI_FAILED");
  const result = JSON.parse(run.stdout);
  if (result.isError || result.error)
    throw Error(JSON.stringify(result).slice(0, 1800));
  return result;
}
try {
  const fixture = build();
  // CLI evaluates a function expression; prettier may append a statement ';'.
  const browserSource = fs.readFileSync(path.join(root, "tests/teacher-admin.browser.js"), "utf8").trim().replace(/;$/, "");
  if (typeof new Function("return (" + browserSource + ")")() !== "function")
    throw Error("BROWSER_FIXTURE_MUST_BE_A_FUNCTION");
  fs.writeFileSync(path.join(fixture.folder, "browser.js"), browserSource);
  fs.writeFileSync(
    report,
    JSON.stringify(
      { status: "RUNNING", checkedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  call("open", "http://localhost:3000/", "--browser=msedge");
  const response = call(
      "run-code",
      "--filename=work/teacher-admin-ui/browser.js",
    ),
    value =
      typeof response.result === "string"
        ? JSON.parse(response.result)
        : response.result;
  if (value?.status !== "PASS")
    throw Error(
      "UI_DID_NOT_EXECUTE: " + JSON.stringify(response).slice(0, 1200),
    );
  const result = {
    ...value,
    unitChecks: fixture.unitChecks,
    checkedAt: new Date().toISOString(),
    tool: "@playwright/cli@0.1.21",
    mode: "Actual React admin components in an intercepted fixture page; synthetic applicants/HTTP only, no auth bypass in product",
  };
  fs.writeFileSync(report, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  fs.writeFileSync(
    report,
    JSON.stringify(
      {
        status: "FAIL",
        checkedAt: new Date().toISOString(),
        error: error.message.slice(0, 1800),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  try {
    call("close");
  } catch {}
}
