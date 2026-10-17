const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process"),
  { createHash } = require("node:crypto"),
  { build } = require("./v7-learner-ui-fixture.cjs");
const root = path.resolve(__dirname, ".."),
  folder = path.join(root, "docs/next/reports/quiz-provenance-browser"),
  report = path.join(folder, "report.json"),
  cli = path.join(root, "node_modules/@playwright/cli/playwright-cli.js"),
  session = `lumio-v11-quiz-${process.pid}-${Date.now()}`;
fs.mkdirSync(folder, { recursive: true });
function call(...args) {
  const result = spawnSync(
    process.execPath,
    [cli, `-s=${session}`, ...args, "--json"],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 180000,
      maxBuffer: 5 * 1024 * 1024,
    },
  );
  if (result.error || result.status !== 0)
    throw (
      result.error ||
      Error((result.stdout || result.stderr || "CLI_FAILED").slice(0, 3000))
    );
  const value = JSON.parse(result.stdout);
  if (value.error || value.isError)
    throw Error(JSON.stringify(value).slice(0, 3000));
  return value;
}
try {
  const fixture = build({
    folder: path.join(root, "work/v11-quiz-provenance-ui"),
  });
  const browserSource = fs
    .readFileSync(
      path.join(root, "tests/v11-quiz-provenance.browser.js"),
      "utf8",
    )
    .trim()
    .replace(/;$/, "");
  fs.writeFileSync(path.join(fixture.folder, "browser.js"), browserSource);
  call("open", "about:blank", "--browser=msedge");
  const result = call(
    "run-code",
    "--filename=work/v11-quiz-provenance-ui/browser.js",
  );
  let details = result.result;
  for (let n = 0; n < 3 && typeof details === "string"; n++)
    details = JSON.parse(details);
  if (!["PASS", "FAIL"].includes(details?.status))
    throw Error(
      "BROWSER_TEST_NOT_EXECUTED:" + JSON.stringify(result).slice(0, 2500),
    );
  const final = {
    ...details,
    checkedAt: new Date().toISOString(),
    tool: "@playwright/cli@0.1.21",
    syntaxChecks: fixture.syntaxChecks,
    sourceSha256: Object.fromEntries(
      [
        "components/lumio/app.tsx",
        "components/lumio/study-tools.tsx",
        "components/lumio/ai-panel.tsx",
        "components/lumio/learning-view.tsx",
        "components/lumio/math-text.tsx",
        "lib/lumio/rich-content.ts",
        "lib/lumio/math-display.ts",
        "lib/lumio/quiz-provenance.ts",
        "lib/lumio/quiz-review-copy.ts",
        "lib/lumio/learning-plan.ts",
        "lib/lumio/types.ts",
        "app/manifest.ts",
        "lib/metadata.ts",
        "lib/lumio/storage.ts",
        "tests/v11-quiz-provenance.browser.js",
      ].map((file) => [
        file,
        createHash("sha256")
          .update(fs.readFileSync(path.join(root, file)))
          .digest("hex"),
      ]),
    ),
  };
  fs.writeFileSync(report, JSON.stringify(final, null, 2) + "\n");
  console.log(JSON.stringify(final, null, 2));
  if (final.status !== "PASS") process.exitCode = 1;
} catch (error) {
  fs.writeFileSync(
    report,
    JSON.stringify(
      {
        status: "FAIL",
        checkedAt: new Date().toISOString(),
        error: error.message.slice(0, 3000),
      },
      null,
      2,
    ) + "\n",
  );
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    call("close");
  } catch {}
}
