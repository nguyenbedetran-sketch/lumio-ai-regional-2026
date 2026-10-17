const fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module"),
  { spawnSync } = require("node:child_process"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, ".."),
  folder = "work/content-rendering-teacher",
  reportDir = "docs/next/reports/content-rendering",
  report = path.join(root, reportDir, "teacher-consumers.json");
fs.mkdirSync(path.join(root, reportDir), { recursive: true });
const fixturePath = path.join(root, "tests/v7-teaching-ui-fixture.cjs"),
  fixtureModule = new Module(fixturePath, module);
fixtureModule.filename = fixturePath;
fixtureModule.paths = Module._nodeModulePaths(path.dirname(fixturePath));
fixtureModule._compile(
  fs
    .readFileSync(fixturePath, "utf8")
    .replaceAll("work/v7-teaching-ui", folder),
  fixturePath,
);
const session = `lumio-content-teacher-${process.pid}-${Date.now()}`,
  cli = path.join(root, "node_modules/@playwright/cli/playwright-cli.js");
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
    throw Error(JSON.stringify(value).slice(0, 2400));
  return value;
}
try {
  const fixture = fixtureModule.exports.build(),
    browser = fs
      .readFileSync(
        path.join(root, "tests/teaching-content-rendering.browser.js"),
        "utf8",
      )
      .trim()
      .replace(/;$/, "");
  if (typeof new Function("return (" + browser + ")")() !== "function")
    throw Error("BROWSER_FUNCTION_REQUIRED");
  fs.writeFileSync(path.join(root, folder, "browser.js"), browser);
  call("open", "about:blank", "--browser=msedge");
  const result = call("run-code", "--filename=" + folder + "/browser.js"),
    value =
      typeof result.result === "string"
        ? JSON.parse(result.result)
        : result.result;
  if (value?.status !== "PASS")
    throw Error(
      "CONTENT_BROWSER_DID_NOT_PASS:" + JSON.stringify(result).slice(0, 2200),
    );
  const sourceExport = fs.readFileSync(
    path.join(root, folder, "export.md"),
    "utf8",
  );
  if (
    !sourceExport.includes(value.expectedExportBody) ||
    !sourceExport.includes("Với $x \\ge 0$, ta có $\\sqrt{x^2}=x$.")
  )
    throw Error("SOURCE_EXPORT_CHANGED_NOTATION_OR_QUOTE");
  delete value.expectedExportBody;
  const final = {
    ...value,
    checkedAt: new Date().toISOString(),
    inheritedSSRChecks: fixture.unitChecks,
    sourceExportPreserved: true,
    sourceSha256: Object.fromEntries(
      [
        "components/teaching/content-preview.tsx",
        "components/teaching/content.tsx",
        "components/teaching/student.tsx",
        "components/teaching/assessment.tsx",
        "components/lumio/math-text.tsx",
        "lib/lumio/rich-content.ts",
        "lib/lumio/math-display.ts",
      ].map((file) => [
        file,
        crypto
          .createHash("sha256")
          .update(fs.readFileSync(path.join(root, file)))
          .digest("hex"),
      ]),
    ),
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
        error: error.message.slice(0, 2600),
      },
      null,
      2,
    ) + "\n",
  );
  throw error;
} finally {
  try {
    call("close");
  } catch {}
}
