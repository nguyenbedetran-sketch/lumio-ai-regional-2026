// Reuse the actual-workspace acceptance bundler in an isolated V9 output folder.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  ts = require("typescript"),
  { build: buildLearner } = require("./v7-learner-ui-fixture.cjs");
const root = path.resolve(__dirname, "..");
function build() {
  const result = buildLearner({ folder: path.join(root, "work/v9-home-ui") }),
    html = path.join(result.folder, "fixture.html");
  fs.writeFileSync(
    html,
    fs.readFileSync(html, "utf8").replaceAll("__v7-learner-ui", "__v9-home-ui"),
  );
  const targets = [
    "components/lumio/dashboard.tsx",
    "components/lumio/dashboard-motion.tsx",
    "components/lumio/preview-notice.tsx",
    "lib/lumio/home-v8-copy.ts",
  ];
  for (const file of targets) {
    const parsed = ts.transpileModule(
      fs.readFileSync(path.join(root, file), "utf8"),
      {
        reportDiagnostics: true,
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2022,
        },
      },
    );
    assert.equal(
      (parsed.diagnostics || []).filter(
        (d) => d.category === ts.DiagnosticCategory.Error,
      ).length,
      0,
      file,
    );
  }
  return { ...result, syntaxChecks: result.syntaxChecks + targets.length };
}
module.exports = { build };
if (require.main === module)
  console.log(JSON.stringify({ status: "PASS", ...build() }));
