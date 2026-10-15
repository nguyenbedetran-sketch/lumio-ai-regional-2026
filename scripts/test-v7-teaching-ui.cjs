const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  { build } = require("../tests/v7-teaching-ui-fixture.cjs"),
  cli = path.join(root, "node_modules/@playwright/cli/playwright-cli.js"),
  report = path.join(root, "docs/v7/qa-teaching-ui-report.json"),
  session = `lumio-teaching-${process.pid}-${Date.now()}`;
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
  const value = JSON.parse(run.stdout);
  if (value.isError || value.error)
    throw Error(JSON.stringify(value).slice(0, 2200));
  return value;
}
try {
  const fixture = build(),
    source = fs
      .readFileSync(path.join(root, "tests/v7-teaching-ui.browser.js"), "utf8")
      .trim()
      .replace(/;$/, "");
  if (typeof new Function("return (" + source + ")")() !== "function")
    throw Error("EXPECTED_FUNCTION");
  fs.writeFileSync(path.join(fixture.folder, "browser.js"), source);
  fs.writeFileSync(
    report,
    JSON.stringify(
      { status: "RUNNING", checkedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  call("open", "about:blank", "--browser=msedge");
  const response = call(
      "run-code",
      "--filename=work/v7-teaching-ui/browser.js",
    ),
    value =
      typeof response.result === "string"
        ? JSON.parse(response.result)
        : response.result;
  if (value?.status !== "PASS")
    throw Error(
      "UI_DID_NOT_EXECUTE:" + JSON.stringify(response).slice(0, 1400),
    );
  const final = {
    ...value,
    unitChecks: fixture.unitChecks,
    checkedAt: new Date().toISOString(),
    tool: "@playwright/cli@0.1.21",
    mode: "Actual teaching and student React/CSS; intercepted synthetic HTTP only; no product auth bypass, real students, payments or provider calls",
  };
  fs.writeFileSync(report, JSON.stringify(final, null, 2) + "\n");
  console.log(JSON.stringify(final, null, 2));
} catch (error) {
  fs.writeFileSync(
    report,
    JSON.stringify(
      {
        status: "FAIL",
        checkedAt: new Date().toISOString(),
        error: error.message.slice(0, 2200),
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
