const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, ".."),
  { build } = require("../tests/v9-theme-loading-fixture.cjs"),
  cli = path.join(root, "node_modules/@playwright/cli/playwright-cli.js"),
  session = `lumio-v9-loading-${process.pid}`,
  out = path.join(root, "docs/v9/qa-theme-loading.json");
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
  if (r.error || r.status !== 0) throw r.error || Error(r.stdout || r.stderr);
  const v = JSON.parse(r.stdout);
  if (v.isError || v.error) throw Error(JSON.stringify(v));
  return v;
}
fs.mkdirSync(path.dirname(out), { recursive: true });
try {
  const fixture = build(),
    source = fs
      .readFileSync(
        path.join(root, "tests/v9-theme-loading.browser.js"),
        "utf8",
      )
      .trim()
      .replace(/;$/, "");
  fs.writeFileSync(path.join(fixture.folder, "browser.js"), source);
  call("open", "about:blank", "--browser=msedge");
  const r = call("run-code", "--filename=work/v9-theme-loading-ui/browser.js"),
    v = typeof r.result === "string" ? JSON.parse(r.result) : r.result;
  if (v?.status !== "PASS") throw Error(JSON.stringify(v));
  const report = {
    ...v,
    checkedAt: new Date().toISOString(),
    prepaintHtmlSha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(fixture.folder, "prepaint.html")))
      .digest("hex"),
    fixtureSyntaxChecks: fixture.syntaxChecks,
  };
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  fs.writeFileSync(
    out,
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
