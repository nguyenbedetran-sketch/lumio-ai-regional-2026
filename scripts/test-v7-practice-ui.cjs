const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  { build } = require("../tests/v7-practice-ui-fixture.cjs"),
  cli = path.join(root, "node_modules/@playwright/cli/playwright-cli.js"),
  report = path.join(root, "docs/v7/qa-practice-ui-report.json"),
  session = `lumio-v7-practice-${process.pid}-${Date.now()}`;
function call(...args) {
  const r = spawnSync(
    process.execPath,
    [cli, `-s=${session}`, ...args, "--json"],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 180000,
      maxBuffer: 6 * 1024 * 1024,
    },
  );
  if (r.error || r.status !== 0)
    throw r.error || Error(r.stdout || r.stderr || "CLI_FAILED");
  const v = JSON.parse(r.stdout);
  if (v.isError || v.error) throw Error(JSON.stringify(v).slice(0, 2800));
  return v;
}
try {
  const fixture = build(),
    source = fs
      .readFileSync(path.join(root, "tests/v7-practice-ui.browser.js"), "utf8")
      .trim()
      .replace(/;$/, "");
  if (typeof new Function("return (" + source + ")")() !== "function")
    throw Error("EXPECTED_FUNCTION");
  fs.writeFileSync(path.join(fixture.folder, "browser.js"), source);
  fs.mkdirSync(path.dirname(report), { recursive: true });
  fs.writeFileSync(
    report,
    JSON.stringify(
      { status: "RUNNING", checkedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  call("open", "about:blank", "--browser=msedge");
  const result = call("run-code", "--filename=work/v7-practice-ui/browser.js"),
    v =
      typeof result.result === "string"
        ? JSON.parse(result.result)
        : result.result;
  if (!["PASS", "FAIL"].includes(v?.status))
    throw Error("UI_DID_NOT_EXECUTE:" + JSON.stringify(result).slice(0, 2200));
  const final = {
    ...v,
    unitChecks: fixture.unitChecks,
    baselineUnitChecks: fixture.baselineUnitChecks,
    checkedAt: new Date().toISOString(),
    tool: "@playwright/cli@0.1.21",
    mode: "Actual teaching/student React/CSS with synthetic windows/retakes/auth/HTTP only; no real student grades, provider calls or public mutations",
  };
  fs.writeFileSync(report, JSON.stringify(final, null, 2) + "\n");
  console.log(JSON.stringify(final, null, 2));
  if (final.status !== "PASS") process.exitCode = 1;
} catch (e) {
  fs.writeFileSync(
    report,
    JSON.stringify(
      {
        status: "FAIL",
        checkedAt: new Date().toISOString(),
        error: e.message.slice(0, 3000),
      },
      null,
      2,
    ),
  );
  throw e;
} finally {
  try {
    call("close");
  } catch {}
}
