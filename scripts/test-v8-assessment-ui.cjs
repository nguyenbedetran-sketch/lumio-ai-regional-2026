const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  { build } = require("../tests/v7-teaching-ui-fixture.cjs"),
  cli = path.join(root, "node_modules/@playwright/cli/playwright-cli.js"),
  session = `lumio-v8-assessment-${process.pid}-${Date.now()}`;
const folder = path.join(root, "work/v8-assessment-ui"),
  report = path.join(root, "docs/v8/reports/assessment-ui.json");
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
  if (v.isError || v.error) throw Error(JSON.stringify(v).slice(0, 3000));
  return v;
}
fs.mkdirSync(folder, { recursive: true });
fs.mkdirSync(path.dirname(report), { recursive: true });
try {
  const fixture = build();
  fs.writeFileSync(
    path.join(folder, "browser.js"),
    fs
      .readFileSync(
        path.join(root, "tests/v8-assessment-ui.browser.js"),
        "utf8",
      )
      .trim()
      .replace(/;$/, ""),
  );
  call("open", "about:blank", "--browser=msedge");
  const result = call(
      "run-code",
      "--filename=work/v8-assessment-ui/browser.js",
    ),
    data =
      typeof result.result === "string"
        ? JSON.parse(result.result)
        : result.result;
  if (data?.status !== "PASS")
    throw Error("UI_DID_NOT_PASS:" + JSON.stringify(result).slice(0, 3000));
  const final = {
    ...data,
    baselineRenderChecks: fixture.unitChecks,
    checkedAt: new Date().toISOString(),
  };
  fs.writeFileSync(report, JSON.stringify(final, null, 2) + "\n");
  console.log(JSON.stringify(final, null, 2));
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
    ) + "\n",
  );
  throw e;
} finally {
  try {
    call("close");
  } catch {}
}
