const fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module"),
  { spawnSync } = require("node:child_process"),
  { createHash } = require("node:crypto");
const root = path.resolve(__dirname, ".."),
  fixturePath = path.join(root, "tests/paid-plan-fixture.cjs"),
  fixtureModule = new Module(fixturePath, module);
fixtureModule.filename = fixturePath;
fixtureModule.paths = Module._nodeModulePaths(path.dirname(fixturePath));
fixtureModule._compile(
  fs
    .readFileSync(fixturePath, "utf8")
    .replaceAll("work/paid-plan-ui", "work/billing-modal-ui"),
  fixturePath,
);
const fixture = fixtureModule.exports.build(),
  folder = "docs/next/reports/billing-modal",
  report = path.join(root, folder, "report.json"),
  session = `billing-modal-${process.pid}-${Date.now()}`,
  cli = path.join(root, "node_modules/@playwright/cli/playwright-cli.js");
fs.mkdirSync(path.join(root, folder), { recursive: true });
const html = path.join(fixture.folder, "fixture.html");
fs.writeFileSync(
  html,
  fs
    .readFileSync(html, "utf8")
    .replace(
      '<main class="paid-fixture">',
      '<div class="lumio"><aside class="lm-sidebar"><strong>Lumio · KIỂM THỬ</strong><p>Thanh bên tổng hợp</p></aside><main class="lm-main paid-fixture billing-fixture-content">',
    )
    .replace("</main><script", "</main></div><script"),
);
fs.appendFileSync(
  path.join(fixture.folder, "fixture.css"),
  "\n.billing-fixture-content{margin-left:222px;max-width:none;transform:translateZ(0);min-height:100vh}.lm-sidebar{width:222px}@media(max-width:760px){.billing-fixture-content{margin-left:0}.lm-sidebar{display:none}}",
);
fs.writeFileSync(
  path.join(fixture.folder, "browser.js"),
  fs
    .readFileSync(path.join(root, "tests/billing-modal.browser.js"), "utf8")
    .trim()
    .replace(/;$/, ""),
);
function call(...args) {
  const run = spawnSync(
    process.execPath,
    [cli, `-s=${session}`, ...args, "--json"],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 180000,
      maxBuffer: 5 * 1024 * 1024,
    },
  );
  if (run.error || run.status !== 0)
    throw run.error || Error(run.stdout || run.stderr || "CLI_FAILED");
  const value = JSON.parse(run.stdout);
  if (value.error || value.isError)
    throw Error(JSON.stringify(value).slice(0, 2400));
  return value;
}
let final;
try {
  call("open", "about:blank", "--browser=msedge");
  const result = call(
    "run-code",
    "--filename=work/billing-modal-ui/browser.js",
  );
  let detail = result.result;
  for (let i = 0; i < 3 && typeof detail === "string"; i++)
    detail = JSON.parse(detail);
  if (!["PASS", "FAIL"].includes(detail?.status))
    throw Error(
      "BROWSER_NOT_EXECUTED:" + JSON.stringify(result).slice(0, 1600),
    );
  final = {
    ...detail,
    checkedAt: new Date().toISOString(),
    sourceSha256: Object.fromEntries(
      [
        "components/lumio/billing.tsx",
        "components/lumio/billing-dialog.tsx",
        "lib/lumio/checkout-copy.ts",
        "app/billing.css",
        "tests/billing-modal.browser.js",
        "tests/billing-modal-ui.cjs",
      ].map((file) => [
        file,
        createHash("sha256")
          .update(fs.readFileSync(path.join(root, file)))
          .digest("hex"),
      ]),
    ),
  };
} catch (error) {
  final = {
    status: "FAIL",
    error: error.message.slice(0, 2500),
    checkedAt: new Date().toISOString(),
  };
} finally {
  try {
    call("close");
  } catch {}
}
fs.writeFileSync(report, JSON.stringify(final, null, 2) + "\n");
console.log(JSON.stringify(final, null, 2));
if (final.status !== "PASS") process.exitCode = 1;
